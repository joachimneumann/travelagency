import { createApiFetcher, escapeHtml, formatDateTime, normalizeText, setDirtySurface } from "./shared/backend-common.js";
import { mountBackendNav } from "./shared/backend-nav.js";
import { setupBackendAuth } from "./shared/backend-auth.js";

const apiOrigin = `${window.location.protocol}//${window.location.hostname}:8787`;
const fetchApi = createApiFetcher({ apiBase: apiOrigin, onError: showStatus });
const bookingId = new URLSearchParams(window.location.search).get("id") || "";

const state = {
  booking: null,
  activities: [],
  originalNotes: ""
};

const els = {
  navMount: document.getElementById("backendNavMount"),
  title: document.getElementById("bookingTitle"),
  idLabel: document.getElementById("bookingIdLabel"),
  copyBtn: document.getElementById("bookingCopyIdBtn"),
  copyStatus: document.getElementById("bookingCopyStatus"),
  summaryGrid: document.getElementById("bookingSummaryGrid"),
  personsList: document.getElementById("bookingPersonsList"),
  formSubmissionGrid: document.getElementById("bookingFormSubmissionGrid"),
  noteInput: document.getElementById("bookingNoteInput"),
  noteSaveBtn: document.getElementById("bookingNoteSaveBtn"),
  noteStatus: document.getElementById("bookingNoteStatus"),
  notesSection: document.getElementById("bookingNotesSection"),
  activitiesTable: document.getElementById("bookingActivitiesTable")
};

void init();

async function init() {
  mountBackendNav(els.navMount, { currentSection: "bookings" });
  setupBackendAuth({ navRoot: els.navMount, websiteLabel: "Website" });
  bindControls();
  await loadPage();
}

function bindControls() {
  els.copyBtn?.addEventListener("click", async () => {
    if (!state.booking?.id) return;
    await navigator.clipboard.writeText(state.booking.id);
    if (els.copyStatus) els.copyStatus.textContent = "copied";
  });
  els.noteInput?.addEventListener("input", () => {
    const isDirty = normalizeText(els.noteInput.value) !== normalizeText(state.originalNotes);
    setDirtySurface(els.notesSection, isDirty);
    if (els.noteSaveBtn) els.noteSaveBtn.disabled = !isDirty;
  });
  els.noteSaveBtn?.addEventListener("click", saveNotes);
}

async function loadPage() {
  const [detail, activities] = await Promise.all([
    fetchApi(`/api/v1/bookings/${encodeURIComponent(bookingId)}`),
    fetchApi(`/api/v1/bookings/${encodeURIComponent(bookingId)}/activities`)
  ]);
  state.booking = detail?.booking || null;
  state.activities = Array.isArray(activities?.activities) ? activities.activities : [];
  state.originalNotes = state.booking?.notes || "";
  render();
}

function render() {
  renderHeader();
  renderSummary();
  renderPersons();
  renderFormSubmission();
  renderNotes();
  renderActivities();
}

function renderHeader() {
  const booking = state.booking;
  if (!booking) return;
  const destinations = joinList(booking.destinations);
  if (els.title) els.title.textContent = destinations === "-" ? "Booking" : destinations;
  if (els.idLabel) els.idLabel.textContent = `ID: ${booking.id}`;
}

function renderSummary() {
  if (!els.summaryGrid || !state.booking) return;
  const booking = state.booking;
  els.summaryGrid.innerHTML = buildKeyValueGrid([
    ["Stage", booking.stage || "-"],
    ["ATP staff", booking.atp_staff_name || "-"],
    ["Destinations", joinList(booking.destinations)],
    ["Travel styles", joinList(booking.travel_styles)],
    ["Preferred currency", booking.preferredCurrency || booking.preferred_currency || "-"],
    ["Travel start day", booking.travel_start_day || "-"],
    ["Travel end day", booking.travel_end_day || "-"],
    ["Created", formatDateTime(booking.created_at)],
    ["Updated", formatDateTime(booking.updated_at)]
  ]);
}

function renderPersons() {
  if (!els.personsList || !state.booking) return;
  const persons = Array.isArray(state.booking.persons) ? state.booking.persons : [];
  if (!persons.length) {
    const fallback = formSubmissionPerson(state.booking);
    els.personsList.innerHTML = fallback ? `<div class="backend-card-row">${escapeHtml(personSummary(fallback))}</div>` : '<p class="micro">No persons yet.</p>';
    return;
  }
  els.personsList.innerHTML = persons.map((person) => {
    const badges = [];
    if (person.is_lead_contact) badges.push("lead contact");
    if (person.is_traveling === false) badges.push("not traveling");
    const meta = badges.length ? `<div class="micro">${escapeHtml(badges.join(" · "))}</div>` : "";
    return `<div class="backend-card-row"><strong>${escapeHtml(person.name || "-")}</strong><div>${escapeHtml(personSummary(person))}</div>${meta}</div>`;
  }).join("");
}

function renderFormSubmission() {
  if (!els.formSubmissionGrid || !state.booking) return;
  const form = state.booking.web_form_submission || {};
  els.formSubmissionGrid.innerHTML = buildKeyValueGrid([
    ["Name", form.name || "-"],
    ["Email", form.email || "-"],
    ["Phone number", form.phone_number || "-"],
    ["Preferred language", form.preferred_language || "-"],
    ["Preferred currency", form.preferred_currency || "-"],
    ["Destinations", joinList(form.destinations)],
    ["Travel style", joinList(form.travel_style)],
    ["Travel month", form.travel_month || "-"],
    ["Number of travelers", form.number_of_travelers ?? "-"],
    ["Travel duration min", form.travel_duration_days_min ?? "-"],
    ["Travel duration max", form.travel_duration_days_max ?? "-"],
    ["Budget lower USD", form.budget_lower_USD ?? "-"],
    ["Budget upper USD", form.budget_upper_USD ?? "-"],
    ["Notes", form.notes || "-"],
    ["Submitted at", formatDateTime(form.submitted_at)]
  ]);
}

function renderNotes() {
  if (!els.noteInput || !state.booking) return;
  els.noteInput.value = state.booking.notes || "";
  setDirtySurface(els.notesSection, false);
  if (els.noteSaveBtn) els.noteSaveBtn.disabled = true;
  if (els.noteStatus) els.noteStatus.textContent = "";
}

function renderActivities() {
  if (!els.activitiesTable) return;
  const header = `<thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th></tr></thead>`;
  const rows = state.activities.map((activity) => `<tr>
    <td>${escapeHtml(formatDateTime(activity.created_at))}</td>
    <td>${escapeHtml(activity.type || "-")}</td>
    <td>${escapeHtml(activity.actor || "-")}</td>
    <td>${escapeHtml(activity.detail || "-")}</td>
  </tr>`).join("");
  els.activitiesTable.innerHTML = `${header}<tbody>${rows || '<tr><td colspan="4">No activities yet</td></tr>'}</tbody>`;
}

async function saveNotes() {
  if (!state.booking?.id) return;
  const trimmed = normalizeText(els.noteInput?.value);
  const result = await fetchApi(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/notes`, {
    method: "PATCH",
    body: {
      notes: trimmed,
      booking_hash: state.booking.booking_hash
    }
  });
  if (!result?.booking) return;
  state.booking = result.booking;
  state.originalNotes = result.booking.notes || "";
  renderNotes();
  if (els.noteStatus) els.noteStatus.textContent = "Updated";
  const activities = await fetchApi(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/activities`);
  state.activities = Array.isArray(activities?.activities) ? activities.activities : [];
  renderActivities();
}

function buildKeyValueGrid(entries) {
  return entries.map(([label, value]) => `<div class="backend-key-value-grid__item"><span class="micro">${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? "-"))}</strong></div>`).join("");
}

function joinList(values) {
  return Array.isArray(values) && values.length ? values.join(", ") : "-";
}

function personSummary(person) {
  return [person.name, ...(person.emails || []), ...(person.phone_numbers || [])].filter(Boolean).join(" · ");
}

function formSubmissionPerson(booking) {
  const form = booking?.web_form_submission || {};
  if (!form.name && !form.email && !form.phone_number) return null;
  return {
    name: form.name || "",
    emails: form.email ? [form.email] : [],
    phone_numbers: form.phone_number ? [form.phone_number] : []
  };
}

function showStatus(message) {
  if (!message) return;
  console.error(message);
  if (els.noteStatus) els.noteStatus.textContent = message;
}
