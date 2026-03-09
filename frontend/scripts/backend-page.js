import { buildBookingHref } from "./shared/backend-links.js";
import { createApiFetcher, escapeHtml, formatDateTime, normalizeText } from "./shared/backend-common.js";
import { mountBackendNav } from "./shared/backend-nav.js";
import { setupBackendAuth } from "./shared/backend-auth.js";

const apiOrigin = `${window.location.protocol}//${window.location.hostname}:8787`;
const fetchApi = createApiFetcher({ apiBase: apiOrigin, onError: showStatusMessage });

const els = {
  navMount: document.getElementById("backendNavMount"),
  dashboardPanel: document.getElementById("dashboardPanel"),
  bookingsPanel: document.getElementById("bookingsPanel"),
  customersPanel: document.getElementById("customersPanel"),
  toursPanel: document.getElementById("toursPanel"),
  settingsPanel: document.getElementById("settingsPanel"),
  dashboardBookingsCount: document.getElementById("dashboardBookingsCount"),
  dashboardCustomersCount: document.getElementById("dashboardCustomersCount"),
  dashboardToursCount: document.getElementById("dashboardToursCount"),
  bookingsSearch: document.getElementById("bookingsSearch"),
  bookingsSearchBtn: document.getElementById("bookingsSearchBtn"),
  bookingsClearBtn: document.getElementById("bookingsClearBtn"),
  bookingsCountInfo: document.getElementById("bookingsCountInfo"),
  bookingsTable: document.getElementById("bookingsTable"),
  bookingsPagination: document.getElementById("bookingsPagination"),
  customersSearch: document.getElementById("customersSearch"),
  customersSearchBtn: document.getElementById("customersSearchBtn"),
  customersClearBtn: document.getElementById("customersClearBtn"),
  customersCountInfo: document.getElementById("customersCountInfo"),
  customersTable: document.getElementById("customersTable"),
  customersPagination: document.getElementById("customersPagination"),
  toursCountInfo: document.getElementById("toursCountInfo"),
  toursTable: document.getElementById("toursTable")
};

const state = {
  section: "dashboard",
  bookings: { page: 1, pageSize: 10, total: 0, totalPages: 1, search: "", items: [] },
  personSearch: { page: 1, pageSize: 10, total: 0, totalPages: 1, search: "", items: [] },
  tours: []
};

void init();

async function init() {
  state.section = normalizeSection(new URLSearchParams(window.location.search).get("section"));
  mountBackendNav(els.navMount, { currentSection: state.section });
  setupBackendAuth({ navRoot: els.navMount, websiteLabel: "Website" });
  bindControls();
  await Promise.all([loadBookings(), loadPersonSearch(), loadTours()]);
  renderSection();
  renderDashboard();
}

function bindControls() {
  bindSearch(els.bookingsSearchBtn, els.bookingsSearch, state.bookings, loadBookings);
  bindSearch(els.customersSearchBtn, els.customersSearch, state.personSearch, loadPersonSearch);
  els.bookingsClearBtn?.addEventListener("click", async () => {
    resetSearchState(state.bookings, els.bookingsSearch);
    await loadBookings();
  });
  els.customersClearBtn?.addEventListener("click", async () => {
    resetSearchState(state.personSearch, els.customersSearch);
    await loadPersonSearch();
  });
}

function bindSearch(button, input, model, loader) {
  button?.addEventListener("click", async () => {
    model.page = 1;
    model.search = normalizeText(input?.value);
    await loader();
  });
  input?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    model.page = 1;
    model.search = normalizeText(input.value);
    await loader();
  });
}

function resetSearchState(model, input) {
  model.page = 1;
  model.search = "";
  if (input) input.value = "";
}

function normalizeSection(value) {
  return ["dashboard", "bookings", "customers", "tours", "settings"].includes(value) ? value : "dashboard";
}

async function loadBookings() {
  const payload = await fetchBookingsPage(state.bookings);
  applyPagedModel(state.bookings, payload);
  renderBookingsTable();
  renderPagination(els.bookingsPagination, state.bookings, loadBookings);
  renderDashboard();
}

async function loadPersonSearch() {
  const payload = await fetchBookingsPage(state.personSearch);
  applyPagedModel(state.personSearch, payload);
  renderPersonSearchTable();
  renderPagination(els.customersPagination, state.personSearch, loadPersonSearch);
  renderDashboard();
}

async function loadTours() {
  const payload = await fetchApi("/api/v1/tours");
  state.tours = Array.isArray(payload?.items) ? payload.items : [];
  renderToursTable();
  renderDashboard();
}

async function fetchBookingsPage(model) {
  const params = new URLSearchParams({
    page: String(model.page),
    page_size: String(model.pageSize),
    sort: "created_at_desc"
  });
  if (model.search) params.set("search", model.search);
  return fetchApi(`/api/v1/bookings?${params.toString()}`);
}

function applyPagedModel(model, payload) {
  model.items = Array.isArray(payload?.items) ? payload.items : [];
  model.total = Number(payload?.total || 0);
  model.totalPages = Number(payload?.total_pages || 1);
}

function renderSection() {
  const panelBySection = {
    dashboard: els.dashboardPanel,
    bookings: els.bookingsPanel,
    customers: els.customersPanel,
    tours: els.toursPanel,
    settings: els.settingsPanel
  };
  Object.values(panelBySection).forEach((panel) => {
    if (panel) panel.hidden = true;
  });
  const activePanel = panelBySection[state.section];
  if (activePanel) activePanel.hidden = false;
}

function renderDashboard() {
  if (els.dashboardBookingsCount) els.dashboardBookingsCount.textContent = String(state.bookings.total || 0);
  if (els.dashboardCustomersCount) els.dashboardCustomersCount.textContent = String(countSearchablePersons(state.bookings.items));
  if (els.dashboardToursCount) els.dashboardToursCount.textContent = String(state.tours.length || 0);
}

function countSearchablePersons(bookings) {
  return (bookings || []).reduce((sum, booking) => sum + (Array.isArray(booking.persons) ? booking.persons.length : 0), 0);
}

function renderBookingsTable() {
  if (!els.bookingsTable) return;
  const header = `<thead><tr><th>ID</th><th>Destinations</th><th>Lead person</th><th>Travel styles</th><th>ATP staff</th><th>Updated</th></tr></thead>`;
  const rows = state.bookings.items.map((booking) => {
    const lead = primaryPerson(booking);
    return `<tr>
      <td><a href="${buildBookingHref(booking.id)}">${escapeHtml(shortBookingId(booking.id))}</a></td>
      <td>${escapeHtml(joinList(booking.destinations))}</td>
      <td>${escapeHtml(personSummary(lead) || fallbackFormSummary(booking))}</td>
      <td>${escapeHtml(joinList(booking.travel_styles))}</td>
      <td>${escapeHtml(booking.atp_staff_name || "-")}</td>
      <td>${escapeHtml(formatDateTime(booking.updated_at || booking.created_at))}</td>
    </tr>`;
  }).join("");
  const empty = `<tr><td colspan="6">${escapeHtml(state.bookings.search ? `No bookings found for "${state.bookings.search}"` : "No bookings found")}</td></tr>`;
  els.bookingsTable.innerHTML = `${header}<tbody>${rows || empty}</tbody>`;
  if (els.bookingsCountInfo) els.bookingsCountInfo.textContent = `${state.bookings.total} booking result(s)`;
}

function renderPersonSearchTable() {
  if (!els.customersTable) return;
  const header = `<thead><tr><th>Booking</th><th>Person</th><th>Email</th><th>Phone</th><th>Destinations</th></tr></thead>`;
  const rows = flattenBookingsForPersonSearch(state.personSearch.items, state.personSearch.search).map((row) => `<tr>
    <td><a href="${buildBookingHref(row.booking.id)}">${escapeHtml(shortBookingId(row.booking.id))}</a></td>
    <td>${escapeHtml(row.person.name || fallbackFormSummary(row.booking))}</td>
    <td>${escapeHtml((row.person.emails || []).join(", ") || "-")}</td>
    <td>${escapeHtml((row.person.phone_numbers || []).join(", ") || "-")}</td>
    <td>${escapeHtml(joinList(row.booking.destinations))}</td>
  </tr>`).join("");
  const empty = `<tr><td colspan="5">${escapeHtml(state.personSearch.search ? `No bookings found for "${state.personSearch.search}"` : "No bookings found")}</td></tr>`;
  els.customersTable.innerHTML = `${header}<tbody>${rows || empty}</tbody>`;
  if (els.customersCountInfo) els.customersCountInfo.textContent = `${state.personSearch.total} booking result(s)`;
}

function flattenBookingsForPersonSearch(bookings, search) {
  const normalized = normalizeText(search).toLowerCase();
  const rows = [];
  for (const booking of bookings || []) {
    const persons = Array.isArray(booking.persons) && booking.persons.length ? booking.persons : [formSubmissionAsPerson(booking)];
    for (const person of persons) {
      const haystack = [person.name, ...(person.emails || []), ...(person.phone_numbers || []), ...(booking.destinations || [])].map((value) => normalizeText(value).toLowerCase()).join(" ");
      if (!normalized || haystack.includes(normalized)) {
        rows.push({ booking, person });
      }
    }
  }
  return rows;
}

function renderToursTable() {
  if (!els.toursTable) return;
  const header = `<thead><tr><th>ID</th><th>Title</th><th>Destinations</th><th>Travel styles</th></tr></thead>`;
  const rows = state.tours.map((tour) => `<tr>
    <td>${escapeHtml(shortBookingId(tour.id))}</td>
    <td>${escapeHtml(tour.title || "-")}</td>
    <td>${escapeHtml(joinList(tour.destinations))}</td>
    <td>${escapeHtml(joinList(tour.travel_styles))}</td>
  </tr>`).join("");
  const empty = '<tr><td colspan="4">No tours found</td></tr>';
  els.toursTable.innerHTML = `${header}<tbody>${rows || empty}</tbody>`;
  if (els.toursCountInfo) els.toursCountInfo.textContent = `${state.tours.length} tour(s)`;
}

function renderPagination(mount, model, loader) {
  if (!mount) return;
  if ((model.totalPages || 1) <= 1) {
    mount.innerHTML = "";
    return;
  }
  const buttons = [];
  for (let page = 1; page <= model.totalPages; page += 1) {
    buttons.push(`<button type="button" class="btn btn-ghost${page === model.page ? " is-active" : ""}" data-page="${page}">${page}</button>`);
  }
  mount.innerHTML = buttons.join("");
  mount.querySelectorAll("button[data-page]").forEach((button) => {
    button.addEventListener("click", async () => {
      model.page = Number(button.getAttribute("data-page"));
      await loader();
    });
  });
}

function primaryPerson(booking) {
  const persons = Array.isArray(booking?.persons) ? booking.persons : [];
  return persons.find((person) => person?.is_lead_contact) || persons[0] || null;
}

function formSubmissionAsPerson(booking) {
  const form = booking?.web_form_submission || {};
  return {
    name: form.name || "",
    emails: form.email ? [form.email] : [],
    phone_numbers: form.phone_number ? [form.phone_number] : []
  };
}

function personSummary(person) {
  if (!person) return "";
  return [person.name, ...(person.emails || []), ...(person.phone_numbers || [])].filter(Boolean).join(" · ");
}

function fallbackFormSummary(booking) {
  return personSummary(formSubmissionAsPerson(booking));
}

function joinList(values) {
  return Array.isArray(values) && values.length ? values.join(", ") : "-";
}

function shortBookingId(value) {
  const text = String(value || "");
  return text.length > 12 ? text.slice(-6) : text;
}

function showStatusMessage(message) {
  if (!message) return;
  console.error(message);
}
