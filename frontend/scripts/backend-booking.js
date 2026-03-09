import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../Generated/Models/generated_Currency.js";
import { GENERATED_ATP_STAFF_ROLES } from "../Generated/Models/generated_ATPStaff.js";
import { GENERATED_BOOKING_STAGES as GENERATED_BOOKING_STAGE_LIST, GENERATED_OFFER_CATEGORIES as GENERATED_OFFER_CATEGORY_LIST } from "../Generated/Models/generated_Booking.js";
import {
  atpStaffRequest,
  bookingActivitiesRequest,
  bookingAssignmentRequest,
  bookingChatRequest,
  bookingDetailRequest,
  bookingInvoicesRequest,
  bookingNoteRequest,
  bookingOfferRequest,
  bookingPricingRequest,
  bookingStageRequest,
} from "../Generated/API/generated_APIRequestFactory.js";
import { normalizeLocalDateTimeToIso } from "../../shared/js/datetime.js";
import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText,
  resolveApiUrl,
  setDirtySurface
} from "./shared/backend-common.js";
import { resolveBackendSectionHref } from "./shared/backend-nav.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const STAGES = GENERATED_BOOKING_STAGE_LIST;
const OFFER_CATEGORIES = GENERATED_OFFER_CATEGORY_LIST.map((code) => ({
  code,
  label: code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}));

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_ATP_STAFF_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  MANAGER: GENERATED_ROLE_LOOKUP.MANAGER,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT,
  STAFF: GENERATED_ROLE_LOOKUP.STAFF
});

const state = {
  id: qs.get("id") || "",
  roles: [],
  permissions: {
    canChangeAssignment: false,
    canChangeStage: false,
    canEditBooking: false
  },
  booking: null,
  staff: [],
  invoices: [],
  selectedInvoiceId: "",
  originalNote: "",
  pricingDraft: {
    adjustments: [],
    payments: []
  },
  offerDraft: {
    currency: "USD",
    category_rules: [],
    components: [],
    totals: {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      components_count: 0
    }
  },
  chat: {
    items: [],
    conversations: [],
    initialized: false,
    pollTimer: null,
    isPolling: false
  }
};

state.dirty = { note: false, offer: false, pricing: false, invoice: false };
state.originalPricingSnapshot = "";
state.originalInvoiceSnapshot = "";

let heroCopyClipboardPoll = null;
let heroCopiedValue = "";

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),
  userLabel: document.getElementById("backendUserLabel"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  heroCopyBtn: document.getElementById("bookingHeroCopyBtn"),
  heroCopyStatus: document.getElementById("bookingHeroCopyStatus"),
  deleteBtn: document.getElementById("bookingDeleteBtn"),
  error: document.getElementById("detailError"),
  bookingDataView: document.getElementById("bookingDataView"),
  actionsPanel: document.getElementById("bookingActionsPanel"),
  ownerSelect: document.getElementById("bookingOwnerSelect"),
  stageSelect: document.getElementById("bookingStageSelect"),
  personsSummary: document.getElementById("bookingPersonsSummary"),
  personsStatus: document.getElementById("bookingPersonsStatus"),
  noteInput: document.getElementById("bookingNoteInput"),
  noteSaveBtn: document.getElementById("bookingNoteSaveBtn"),
  actionStatus: document.getElementById("bookingActionStatus"),
  pricingPanel: document.getElementById("pricingPanel"),
  pricingSummaryTable: document.getElementById("pricingSummaryTable"),
  pricingCurrencyInput: document.getElementById("pricingCurrencyInput"),
  pricingAgreedNetLabel: document.getElementById("pricingAgreedNetLabel"),
  pricingAgreedNetInput: document.getElementById("pricingAgreedNetInput"),
  pricingAdjustmentsTable: document.getElementById("pricingAdjustmentsTable"),
  pricingPaymentsTable: document.getElementById("pricingPaymentsTable"),
  pricingSaveBtn: document.getElementById("pricingSaveBtn"),
  pricingStatus: document.getElementById("pricingStatus"),
  offerPanel: document.getElementById("offerPanel"),
  offerCurrencyInput: document.getElementById("offerCurrencyInput"),
  offerComponentCategorySelect: document.getElementById("offerComponentCategorySelect"),
  offerAddComponentBtn: document.getElementById("offerAddComponentBtn"),
  offerComponentsTable: document.getElementById("offerComponentsTable"),
  offerComponentsTotalTable: document.getElementById("offerComponentsTotalTable"),
  offerSaveBtn: document.getElementById("offerSaveBtn"),
  offerStatus: document.getElementById("offerStatus"),
  activitiesTable: document.getElementById("activitiesTable"),
  metaChatPanel: document.getElementById("metaChatPanel"),
  metaChatSummary: document.getElementById("metaChatSummary"),
  metaChatTable: document.getElementById("metaChatTable"),
  invoicePanel: document.getElementById("invoicePanel"),
  invoiceSelect: document.getElementById("invoiceSelect"),
  invoiceNumberInput: document.getElementById("invoiceNumberInput"),
  invoiceCurrencyInput: document.getElementById("invoiceCurrencyInput"),
  invoiceIssueDateInput: document.getElementById("invoiceIssueDateInput"),
  invoiceIssueTodayBtn: document.getElementById("invoiceIssueTodayBtn"),
  invoiceDueDateInput: document.getElementById("invoiceDueDateInput"),
  invoiceDueMonthBtn: document.getElementById("invoiceDueMonthBtn"),
  invoiceTitleInput: document.getElementById("invoiceTitleInput"),
  invoiceComponentsInput: document.getElementById("invoiceComponentsInput"),
  invoiceDueAmountInput: document.getElementById("invoiceDueAmountInput"),
  invoiceDueAmountLabel: document.getElementById("invoiceDueAmountLabel"),
  invoiceComponentsLabel: document.getElementById("invoiceComponentsLabel"),
  invoiceVatInput: document.getElementById("invoiceVatInput"),
  invoiceNotesInput: document.getElementById("invoiceNotesInput"),
  invoiceCreateBtn: document.getElementById("invoiceCreateBtn"),
  invoiceStatus: document.getElementById("invoiceStatus"),
  invoicesTable: document.getElementById("invoicesTable")
};

function setOfferSaveEnabled(enabled) {
  if (!els.offerSaveBtn) return;
  els.offerSaveBtn.disabled = !enabled || !state.permissions.canEditBooking;
  setBookingSectionDirty("offer", Boolean(enabled) && state.permissions.canEditBooking);
}

function setBookingSectionDirty(sectionKey, isDirty) {
  const sectionMap = {
    note: els.actionsPanel,
    offer: els.offerPanel,
    pricing: els.pricingPanel,
    invoice: els.invoicePanel
  };
  state.dirty[sectionKey] = Boolean(isDirty);
  setDirtySurface(sectionMap[sectionKey], state.dirty[sectionKey]);
}

function captureControlSnapshot(root) {
  if (!root) return "";
  const controls = Array.from(root.querySelectorAll("input, select, textarea"));
  const snapshot = controls.map((control, index) => {
    const key = control.id || control.name || control.dataset.field || `${control.tagName.toLowerCase()}-${index}`;
    let value = "";
    if (control.type === "checkbox" || control.type === "radio") {
      value = control.checked;
    } else if (control.type === "file") {
      value = Array.from(control.files || []).map((file) => `${file.name}:${file.size}:${file.lastModified}`);
    } else {
      value = control.value ?? "";
    }
    return [key, value];
  });
  return JSON.stringify(snapshot);
}

function updatePricingDirtyState() {
  const isDirty = state.permissions.canEditBooking && captureControlSnapshot(els.pricingPanel) !== state.originalPricingSnapshot;
  setBookingSectionDirty("pricing", isDirty);
}

function markPricingSnapshotClean() {
  state.originalPricingSnapshot = captureControlSnapshot(els.pricingPanel);
  setBookingSectionDirty("pricing", false);
}

function updateInvoiceDirtyState() {
  const isDirty = state.permissions.canEditBooking && captureControlSnapshot(els.invoicePanel) !== state.originalInvoiceSnapshot;
  setBookingSectionDirty("invoice", isDirty);
}

function markInvoiceSnapshotClean() {
  state.originalInvoiceSnapshot = captureControlSnapshot(els.invoicePanel);
  setBookingSectionDirty("invoice", false);
}

init();
window.addEventListener("beforeunload", () => {
  if (state.chat.pollTimer) {
    window.clearInterval(state.chat.pollTimer);
    state.chat.pollTimer = null;
  }
});

async function init() {
  const backHref = "backend.html";

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  populateCurrencySelect(els.pricingCurrencyInput);
  populateCurrencySelect(els.offerCurrencyInput);
  populateCurrencySelect(els.invoiceCurrencyInput);
  populateOfferCategorySelect(els.offerComponentCategorySelect);

  if (els.heroCopyBtn) els.heroCopyBtn.addEventListener("click", copyHeroIdToClipboard);
  if (els.ownerSelect) els.ownerSelect.addEventListener("change", saveOwner);
  if (els.stageSelect) els.stageSelect.addEventListener("change", saveStage);
  if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteBooking);
  if (els.noteInput) els.noteInput.addEventListener("input", updateNoteSaveButtonState);
  if (els.noteSaveBtn) els.noteSaveBtn.addEventListener("click", saveNote);
  if (els.pricingPanel) {
    const schedulePricingDirtyState = () => window.setTimeout(updatePricingDirtyState, 0);
    els.pricingPanel.addEventListener("input", schedulePricingDirtyState);
    els.pricingPanel.addEventListener("change", schedulePricingDirtyState);
    els.pricingPanel.addEventListener("click", (event) => {
      if (event.target.closest("button")) schedulePricingDirtyState();
    });
  }
  if (els.pricingSaveBtn) els.pricingSaveBtn.addEventListener("click", savePricing);
  if (els.offerCurrencyInput)
    els.offerCurrencyInput.addEventListener("change", () => {
      void handleOfferCurrencyChange();
    });
  if (els.offerAddComponentBtn) els.offerAddComponentBtn.addEventListener("click", addOfferComponentFromSelector);
  if (els.offerSaveBtn) els.offerSaveBtn.addEventListener("click", saveOffer);
  if (els.invoiceSelect) els.invoiceSelect.addEventListener("change", onInvoiceSelectChange);
  if (els.invoicePanel) {
    const scheduleInvoiceDirtyState = () => window.setTimeout(updateInvoiceDirtyState, 0);
    els.invoicePanel.addEventListener("input", scheduleInvoiceDirtyState);
    els.invoicePanel.addEventListener("change", scheduleInvoiceDirtyState);
  }
  if (els.invoiceCurrencyInput) els.invoiceCurrencyInput.addEventListener("change", renderInvoiceMoneyLabels);
  if (els.invoiceCreateBtn) els.invoiceCreateBtn.addEventListener("click", createInvoice);
  if (els.invoiceIssueTodayBtn) {
    els.invoiceIssueTodayBtn.addEventListener("click", () => {
      if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = formatDateInput(new Date());
    });
  }
  if (els.invoiceDueMonthBtn) {
    els.invoiceDueMonthBtn.addEventListener("click", () => {
      if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = plusOneMonthDateInput(new Date());
    });
  }

  bindSectionNavigation("bookings");
  if (!state.id) {
    showError("Missing record id.");
    return;
  }

  await loadAuthStatus();

  loadBookingPage();
}

function bindSectionNavigation(activeSection) {
  Array.from(els.sectionNavButtons || []).forEach((button) => {
    const section = button.dataset.backendSection;
    if (!section) return;
    button.classList.toggle("is-active", section === activeSection);
    if (section === activeSection) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
    button.addEventListener("click", () => {
      window.location.href = resolveBackendSectionHref(section);
    });
  });
}

async function loadBookingPage() {
  clearStatus();
  const requests = [fetchApi(bookingDetailRequest({ baseURL: apiOrigin, params: { bookingId: state.id } }).url)];
  if (state.permissions.canChangeAssignment) {
    requests.push(fetchApi(atpStaffRequest({ baseURL: apiOrigin, query: { active: true } }).url));
  }
  const [bookingPayload, staffPayload] = await Promise.all(requests);
  if (!bookingPayload) return;

  applyBookingPayload(bookingPayload);
  state.staff = Array.isArray(staffPayload?.items) ? staffPayload.items : [];

  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPricingPanel();
  renderOfferPanel();
  await loadActivities();
  await loadBookingChat();
  await loadInvoices();
  startBookingChatAutoRefresh();
}

function renderBookingHeader() {
  if (!state.booking) return;
  const primaryContact = getPrimaryContact(state.booking);
  const title = primaryContact?.name || getSubmittedContact(state.booking)?.name || "Booking";
  if (els.title) els.title.textContent = title;
  if (els.subtitle) {
    els.subtitle.textContent = `ID: ${state.booking.id}`;
    els.subtitle.hidden = false;
  }
  if (heroCopiedValue && heroCopiedValue !== getCurrentBookingIdentifier()) {
    clearHeroCopyStatus();
  }
}

function getCurrentBookingIdentifier() {
  return normalizeText(state.booking?.id) || "";
}

function setHeroCopyStatus(message, copiedValue = "") {
  if (els.heroCopyStatus) {
    els.heroCopyStatus.textContent = message || "";
  }
  heroCopiedValue = copiedValue || "";
  if (heroCopyClipboardPoll) {
    window.clearInterval(heroCopyClipboardPoll);
    heroCopyClipboardPoll = null;
  }
  if (heroCopiedValue) {
    startHeroClipboardWatcher();
  }
}

function clearHeroCopyStatus() {
  setHeroCopyStatus("");
}

function startHeroClipboardWatcher() {
  if (!heroCopiedValue || !navigator.clipboard?.readText) return;
  heroCopyClipboardPoll = window.setInterval(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText !== heroCopiedValue) {
        clearHeroCopyStatus();
      }
    } catch {
      if (heroCopyClipboardPoll) {
        window.clearInterval(heroCopyClipboardPoll);
        heroCopyClipboardPoll = null;
      }
    }
  }, 1800);
}

async function copyHeroIdToClipboard() {
  const id = getCurrentBookingIdentifier();
  if (!id || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(id);
    setHeroCopyStatus("copied", id);
  } catch {
    setHeroCopyStatus("copy failed");
  }
}

function renderBookingData() {
  if (!state.booking) return;
  const booking = state.booking;
  const persons = getBookingPersons(booking);
  const primaryContact = getPrimaryContact(booking);
  const submittedContact = getSubmittedContact(booking);
  const travelerCount = getTravelerCount(booking);
  const mismatchWarning = buildTravelerMismatchMessage(booking);
  const formatBudgetRange = (lower, upper) => {
    const numericLower = Number(lower);
    const numericUpper = Number(upper);
    if (!Number.isFinite(numericLower) && !Number.isFinite(numericUpper)) return null;
    if (Number.isFinite(numericLower) && Number.isFinite(numericUpper)) return `$${numericLower}-$${numericUpper}`;
    if (Number.isFinite(numericLower)) return `$${numericLower}+`;
    return `Up to $${numericUpper}`;
  };
  const sections = [
    {
      title: "Booking",
      entries: [
        ["id", booking.id],
        ["stage", booking.stage],
        ["staff", booking.atp_staff_name || "Unassigned"],
        ["destination", Array.isArray(booking.destination) ? booking.destination.join(", ") : booking.destination],
        ["style", Array.isArray(booking.style) ? booking.style.join(", ") : booking.style],
        ["web_form_travel_month", booking.web_form_travel_month],
        ["number_of_travelers", booking.number_of_travelers],
        ["persons_listed", persons.length],
        ["travelers_marked", travelerCount],
        ["persons_warning", mismatchWarning],
        ["budget_range_USD", formatBudgetRange(booking.budget_lower_USD, booking.budget_upper_USD)],
        ["service_level_agreement_due_at", formatDateTime(booking.service_level_agreement_due_at)],
        ["created_at", formatDateTime(booking.created_at)],
        ["updated_at", formatDateTime(booking.updated_at)]
      ]
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => ({ key, value: String(value ?? "-") }))
    },
    {
      title: "Primary contact",
      entries: buildContactEntries(primaryContact || submittedContact)
    },
    {
      title: "Persons",
      entries: buildPersonEntries(persons)
    },
    {
      title: "Source",
      entries: [
        ["submitted_name", submittedContact?.name],
        ["submitted_email", submittedContact?.email],
        ["submitted_phone_number", submittedContact?.phone_number],
        ["page_url", booking.source?.page_url],
        ["ip_address", booking.source?.ip_address],
        ["ip_country_guess", booking.source?.ip_country_guess],
        ["referrer", booking.source?.referrer],
        ["utm_source", booking.source?.utm_source],
        ["utm_medium", booking.source?.utm_medium],
        ["utm_campaign", booking.source?.utm_campaign]
      ]
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => ({ key, value: String(value ?? "-") }))
    }
  ];

  renderSections(sections);
}

function renderSections(sections) {
  if (!els.bookingDataView) return;
  const html = sections
    .map((section) => {
      const rows = (section.entries || [])
        .map((entry) => {
          return `<tr><th>${escapeHtml(entry.key)}</th><td>${escapeHtml(String(entry.value || "-"))}</td></tr>`;
        })
        .join("");
      return `
        <div style="margin-bottom: 0.9rem;">
          <h3 style="margin: 0 0 0.4rem; font-size: 0.98rem;">${escapeHtml(section.title)}</h3>
          <div class="backend-table-wrap">
            <table class="backend-table"><tbody>${rows || '<tr><td colspan="2">-</td></tr>'}</tbody></table>
          </div>
        </div>
      `;
    })
    .join("");
  els.bookingDataView.innerHTML = html;
}

function renderActionControls() {
  if (!state.booking) return;

  if (els.stageSelect) {
    const options = STAGES.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("");
    els.stageSelect.innerHTML = options;
    els.stageSelect.value = state.booking.stage || STAGES[0];
  }

  if (els.ownerSelect) {
    const options = ['<option value="">Unassigned</option>']
      .concat((state.staff || []).map((staff) => `<option value="${escapeHtml(staff.id)}">${escapeHtml(staff.name)}</option>`))
      .join("");
    els.ownerSelect.innerHTML = options;
    els.ownerSelect.value = state.booking.atp_staff || "";
    els.ownerSelect.disabled = !state.permissions.canChangeAssignment;
  }

  if (els.stageSelect) els.stageSelect.disabled = !state.permissions.canChangeStage;
  renderPersonsSummary();
  if (els.noteInput) {
    els.noteInput.disabled = !state.permissions.canEditBooking;
    els.noteInput.value = state.booking.notes || "";
  }
  state.originalNote = String(state.booking.notes || "");
  if (els.noteSaveBtn) {
    els.noteSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";
    updateNoteSaveButtonState();
  }
  if (els.invoiceCreateBtn) els.invoiceCreateBtn.style.display = state.permissions.canEditBooking ? "" : "none";
  if (els.deleteBtn) {
    els.deleteBtn.style.display = state.permissions.canEditBooking ? "" : "none";
    els.deleteBtn.disabled = !state.permissions.canEditBooking;
  }
}

function applyBookingPayload(payload = {}) {
  state.booking = payload.booking || state.booking || null;
}

function getBookingPersons(booking) {
  if (!Array.isArray(booking?.persons)) return [];
  return booking.persons
    .filter((person) => person && typeof person === "object" && !Array.isArray(person))
    .map((person, index) => ({
      ...person,
      id: normalizeText(person.id) || `person_${index + 1}`,
      name: normalizeText(person.name) || `Person ${index + 1}`,
      roles: normalizeStringList(person.roles),
      emails: collectPersonEmails(person),
      phone_numbers: collectPersonPhoneNumbers(person)
    }));
}

function normalizeStringList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean)));
}

function collectPersonEmails(person) {
  return Array.from(
    new Set(
      [person?.email, ...(Array.isArray(person?.emails) ? person.emails : [])]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function collectPersonPhoneNumbers(person) {
  return Array.from(
    new Set(
      [person?.phone_number, person?.phone, ...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function getSubmittedContact(booking) {
  const submission = booking?.web_form_submission || {};
  return {
    name: normalizeText(submission.name) || "",
    email: normalizeText(submission.email) || "",
    phone_number: normalizeText(submission.phone_number) || ""
  };
}

function getPrimaryContact(booking) {
  const persons = getBookingPersons(booking);
  return persons.find((person) => person.roles.includes("primary_contact")) || persons[0] || null;
}

function getTravelerCount(booking) {
  const persons = getBookingPersons(booking);
  const travelers = persons.filter((person) => person.roles.includes("traveler"));
  return travelers.length || persons.length;
}

function buildTravelerMismatchMessage(booking) {
  const declared = Number(booking?.number_of_travelers || 0);
  if (!declared) return "";
  const listed = getTravelerCount(booking);
  if (declared === listed) return "";
  return `Declared travelers: ${declared}. Listed persons/travelers: ${listed}.`;
}

function renderPersonsSummary() {
  const persons = getBookingPersons(state.booking);
  const primaryContact = getPrimaryContact(state.booking);
  const submittedContact = getSubmittedContact(state.booking);
  const travelerCount = getTravelerCount(state.booking);
  const mismatchWarning = buildTravelerMismatchMessage(state.booking);
  if (els.personsSummary) {
    const summaryParts = [];
    const contactName = primaryContact?.name || submittedContact?.name;
    if (contactName) summaryParts.push(`Primary contact: ${contactName}`);
    summaryParts.push(`${persons.length} persons listed`);
    summaryParts.push(`${travelerCount} traveler${travelerCount === 1 ? "" : "s"} marked`);
    els.personsSummary.textContent = summaryParts.join(" | ");
  }
  if (els.personsStatus) {
    els.personsStatus.textContent = mismatchWarning || "Persons are stored directly on this booking.";
  }
}

function buildContactEntries(contact) {
  if (!contact) return [];
  return [
    ["name", contact.name],
    ["email", contact.emails?.[0] || contact.email],
    ["phone_number", contact.phone_numbers?.[0] || contact.phone_number],
    ["roles", Array.isArray(contact.roles) && contact.roles.length ? contact.roles.join(", ") : null]
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({ key, value: String(value) }));
}

function buildPersonEntries(persons) {
  return (Array.isArray(persons) ? persons : []).map((person, index) => {
    const summaryParts = [];
    if (person.roles.length) summaryParts.push(`roles: ${person.roles.join(", ")}`);
    if (person.emails.length) summaryParts.push(`email: ${person.emails.join(", ")}`);
    if (person.phone_numbers.length) summaryParts.push(`phone: ${person.phone_numbers.join(", ")}`);
    if (person.date_of_birth) summaryParts.push(`born: ${person.date_of_birth}`);
    if (person.nationality) summaryParts.push(`nationality: ${person.nationality}`);
    if (person.address?.country_code || person.address?.city || person.address?.street_address) {
      summaryParts.push(`address: ${formatPersonAddress(person.address)}`);
    }
    if (Array.isArray(person.documents) && person.documents.length) summaryParts.push(`documents: ${person.documents.length}`);
    if (Array.isArray(person.consents) && person.consents.length) summaryParts.push(`consents: ${person.consents.length}`);
    if (person.photo_ref) summaryParts.push("photo attached");
    return {
      key: `${index + 1}. ${person.name}`,
      value: summaryParts.join(" | ") || "No details"
    };
  });
}

function formatPersonAddress(address) {
  if (!address || typeof address !== "object") return "";
  return [
    normalizeText(address.street_address),
    normalizeText(address.city),
    normalizeText(address.postal_code),
    normalizeText(address.region),
    normalizeText(address.country_code)
  ]
    .filter(Boolean)
    .join(", ");
}

async function deleteBooking() {
  if (!state.permissions.canEditBooking || !state.booking?.id) return;
  const label = normalizeText(getPrimaryContact(state.booking)?.name) || state.booking.id;
  if (!window.confirm(`Delete booking for ${label}? This cannot be undone.`)) return;

  if (els.deleteBtn) els.deleteBtn.disabled = true;
  clearStatus();
  const result = await fetchApi(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}`, {
    method: "DELETE",
    body: {
      booking_hash: state.booking.booking_hash
    }
  });
  if (els.deleteBtn) els.deleteBtn.disabled = false;
  if (!result?.deleted) return;

  window.location.href = "backend.html?section=bookings";
}

function renderPricingPanel() {
  if (!els.pricingPanel || !state.booking) return;
  const pricing = clonePricing(state.booking.pricing || {});
  state.pricingDraft = pricing;
  const currency = normalizeCurrencyCode(pricing.currency);

  if (els.pricingCurrencyInput) {
    els.pricingCurrencyInput.value = currency;
    els.pricingCurrencyInput.disabled = !state.permissions.canEditBooking;
  }
  if (els.pricingAgreedNetLabel) {
    els.pricingAgreedNetLabel.textContent = `Agreed Net Amount (${currency})`;
  }
  if (els.pricingAgreedNetInput) {
    els.pricingAgreedNetInput.value = formatMoneyInputValue(pricing.agreed_net_amount_cents || 0, currency);
    els.pricingAgreedNetInput.disabled = !state.permissions.canEditBooking;
  }
  if (els.pricingSaveBtn) els.pricingSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";

  renderPricingSummaryTable(pricing);
  renderPricingAdjustmentsTable();
  renderPricingPaymentsTable();
  clearPricingStatus();
  markPricingSnapshotClean();
}

function defaultOfferCategoryRules() {
  return OFFER_CATEGORIES.map((category) => ({
    category: category.code,
    tax_rate_basis_points: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
  }));
}

function cloneOffer(offer) {
  const source = offer && typeof offer === "object" ? offer : {};
  const categoryRulesByCode = new Map(
    (Array.isArray(source.category_rules) ? source.category_rules : []).map((rule) => [
      String(rule?.category || "").toUpperCase(),
      {
        category: String(rule?.category || "").toUpperCase(),
        tax_rate_basis_points: Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS)
      }
    ])
  );

  const category_rules = OFFER_CATEGORIES.map((category) => {
    const existing = categoryRulesByCode.get(category.code);
    return {
      category: category.code,
      tax_rate_basis_points:
        Number.isFinite(Number(existing?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(existing.tax_rate_basis_points)))
          : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
    };
  });

  const sourceComponents = Array.isArray(source.components) ? source.components : [];

  return {
    currency: normalizeCurrencyCode(source.currency || state.booking?.preferredCurrency || "USD"),
    category_rules,
    components: sourceComponents.map((component, index) => ({
      id: String(component?.id || ""),
      category: normalizeOfferCategory(component?.category),
      label: String(component?.label || ""),
      details: String(component?.details || component?.description || ""),
      quantity: Math.max(1, Number(component?.quantity || 1)),
      unit_amount_cents: Math.max(0, Number(component?.unit_amount_cents || 0)),
      tax_rate_basis_points: Number.isFinite(Number(component?.tax_rate_basis_points))
        ? Math.max(0, Math.round(Number(component.tax_rate_basis_points)))
            : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
      currency: normalizeCurrencyCode(component?.currency || source.currency || state.booking?.preferredCurrency || "USD"),
      notes: String(component?.notes || ""),
      sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index
    })),
    totals: source.totals || {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      components_count: 0
    }
  };
}

function normalizeOfferCategory(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return OFFER_CATEGORIES.some((category) => category.code === normalized) ? normalized : "OTHER";
}

function offerCategoryLabel(code) {
  return OFFER_CATEGORIES.find((entry) => entry.code === normalizeOfferCategory(code))?.label || "Other";
}

function offerCategorySign(code) {
  return normalizeOfferCategory(code) === "DISCOUNTS_CREDITS" ? -1 : 1;
}

function getOfferCategoryTaxRateBasisPoints(category) {
  const normalizedCategory = normalizeOfferCategory(category);
  const rule = Array.isArray(state.offerDraft?.category_rules)
    ? state.offerDraft.category_rules.find((componentRule) => normalizeOfferCategory(componentRule?.category) === normalizedCategory)
    : null;
  const basisPoints = Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS);
  return Number.isFinite(basisPoints) ? Math.max(0, Math.round(basisPoints)) : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
}

function addOfferComponentFromSelector() {
  if (!state.permissions.canEditBooking || !state.offerDraft) return;
  const selectedCategory = els.offerComponentCategorySelect?.value || "";
  if (!selectedCategory) return;
  const category = normalizeOfferCategory(selectedCategory);
  state.offerDraft.components.push({
    id: "",
    category,
    label: "",
    details: "",
    quantity: 1,
    unit_amount_cents: 0,
    tax_rate_basis_points: getOfferCategoryTaxRateBasisPoints(category),
    currency: state.offerDraft.currency,
    notes: "",
    sort_order: state.offerDraft.components.length
  });
  setOfferSaveEnabled(true);
  renderOfferComponentsTable();
}

function renderOfferPanel() {
  if (!els.offerPanel || !state.booking) return;
  const offer = cloneOffer(state.booking.offer || {});
  state.offerDraft = offer;
  const currency = normalizeCurrencyCode(offer.currency || state.booking.preferredCurrency || "USD");
  state.offerDraft.currency = currency;

  if (els.offerCurrencyInput) {
    setSelectValue(els.offerCurrencyInput, currency);
    els.offerCurrencyInput.disabled = !state.permissions.canEditBooking;
  }
  if (els.offerComponentCategorySelect) {
    els.offerComponentCategorySelect.disabled = !state.permissions.canEditBooking;
    if (state.permissions.canEditBooking) {
      els.offerComponentCategorySelect.value = "";
    }
  }
  if (els.offerAddComponentBtn) {
    els.offerAddComponentBtn.style.display = state.permissions.canEditBooking ? "" : "none";
  }
  if (els.offerSaveBtn) els.offerSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";
  setOfferSaveEnabled(false);

  renderOfferComponentsTable();
  clearOfferStatus();
}

function renderOfferComponentsTable() {
  if (!els.offerComponentsTable) return;
  const readOnly = !state.permissions.canEditBooking;
  const showActionsCol = !readOnly;
  const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferredCurrency || "USD");
  const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
  const hasMultiQuantityComponent = (offerComponents || []).some(
    (component) => Math.max(1, Number(component?.quantity || 1)) !== 1
  );
  const showDualPrice = hasMultiQuantityComponent;
  const priceHeaders = showDualPrice
    ? `<th class="offer-col-price-single">PRICE (SINGLE, ${escapeHtml(currency)})</th><th class="offer-col-price-total">PRICE (with TAX, ${escapeHtml(currency)})</th>`
    : `<th class="offer-col-price-total">PRICE (with TAX, ${escapeHtml(currency)})</th>`;
  const actionHeader = showActionsCol ? `<th class="offer-col-actions"></th>` : "";
  const header = `<thead><tr><th class="offer-col-category">Category</th><th class="offer-col-details">Details</th><th class="offer-col-qty">Quantity</th>${priceHeaders}${actionHeader}</tr></thead>`;
  const rows = (offerComponents || [])
    .map((component, index) => {
      const quantity = Math.max(1, Number(component.quantity || 1));
      const unitAmount = Math.max(0, Number(component.unit_amount_cents || 0));
      const rawLineTotal = computeOfferComponentLineTotals(component).gross_amount_cents;
      const componentTotalText = formatMoneyDisplay(Math.round(rawLineTotal), currency);
      const taxRateBasisPoints = Number(component?.tax_rate_basis_points || 0);
      const taxLabel = `Tax: ${formatTaxRatePercent(taxRateBasisPoints)}%`;
      const removeButton = showActionsCol
        ? `<button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-component="${index}" title="Remove offer component" aria-label="Remove offer component">×</button>`
        : "";
      const singleInput = `<input data-offer-component-unit="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(
        formatMoneyInputValue(unitAmount, currency)
      )}" ${readOnly ? "disabled" : ""} />`;
      const totalPriceCell = showDualPrice
        ? `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value">${escapeHtml(componentTotalText)}</span></div></td>`
        : `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value">${singleInput}</span></div></td>`;
      const unitInputCell = showDualPrice ? `<td class="offer-col-price-single">${singleInput}</td>` : "";
      const actionCell = showActionsCol ? `<td class="offer-col-actions">${removeButton}</td>` : "";
      const priceCells = showDualPrice ? `${unitInputCell}${totalPriceCell}` : totalPriceCell;
      return `<tr>
      <td class="offer-col-category">
        <div>${escapeHtml(offerCategoryLabel(component.category))}</div>
        <div class="offer-category-tax">${escapeHtml(taxLabel)}</div>
      </td>
      <td class="offer-col-details"><textarea data-offer-component-details="${index}" rows="2" ${
        readOnly ? "disabled" : ""
      }>${escapeHtml(component.details || component.description || "")}</textarea></td>
      <td class="offer-col-qty"><input data-offer-component-quantity="${index}" type="number" min="1" step="1" value="${escapeHtml(String(quantity))}" ${
        readOnly ? "disabled" : ""
      } /></td>
      ${priceCells}${actionCell}
    </tr>`;
    })
    .join("");
  const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
  const columns = 3 + (showDualPrice ? 2 : 1) + (showActionsCol ? 1 : 0);
  const noRows = `<tr><td colspan="${columns}" style="padding-top:50px;padding-bottom:50px;">no components yet</td></tr>`;
  const totalAlignCols = 3 + (showDualPrice ? 1 : 0);
  const totalCellOffset = `<td colspan="${totalAlignCols}"></td>`;
  const totalRow = `<tr>${totalCellOffset}<td class="offer-col-price-total"><div class="offer-total-sum"><strong class="offer-total-value">Total with Tax: ${escapeHtml(offerTotalValue)}</strong></div></td>${
    showActionsCol ? '<td class="offer-col-actions"></td>' : ""
  }</tr>`;
  const body = rows || noRows;
  els.offerComponentsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  if (els.offerComponentsTotalTable) {
    els.offerComponentsTotalTable.innerHTML = `<tbody>${totalRow}</tbody>`;
  } else {
    els.offerComponentsTable.insertAdjacentHTML("beforeend", `<tbody>${totalRow}</tbody>`);
  }

  if (!readOnly) {
    const syncOfferInputTotals = () => {
      state.offerDraft.components = readOfferDraftComponentsForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      renderOfferComponentsTable();
    };
    els.offerComponentsTable.querySelectorAll("[data-offer-remove-component]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-remove-component"));
        if (!window.confirm("Remove this offer component?")) {
          return;
        }
        state.offerDraft.components.splice(index, 1);
        setOfferSaveEnabled(true);
        renderOfferComponentsTable();
      });
    });
    els.offerComponentsTable.querySelectorAll("[data-offer-component-details], [data-offer-component-quantity], [data-offer-component-unit]").forEach((input) => {
      input.addEventListener("change", syncOfferInputTotals);
    });
  }
}

function readOfferDraftComponentsForRender() {
  const rows = Array.from(document.querySelectorAll("[data-offer-component-details]"));
  const fallbackComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
  if (!rows.length) {
    return fallbackComponents;
  }
  const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferredCurrency || "USD");
  return rows.map((_, index) => {
    const category = normalizeOfferCategory(state.offerDraft?.components?.[index]?.category || "OTHER");
    const details = String(document.querySelector(`[data-offer-component-details="${index}"]`)?.value || "").trim();
    const quantityRaw = Number(document.querySelector(`[data-offer-component-quantity="${index}"]`)?.value || "1");
    const unitAmountRaw = document.querySelector(`[data-offer-component-unit="${index}"]`)?.value || "0";
    const quantity = Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.round(quantityRaw) : 1;
    const unitAmount = parseMoneyInputValue(unitAmountRaw, currency);
    const fallbackComponent = fallbackComponents[index] || {};
    return {
      id: String(fallbackComponent.id || ""),
      category,
      label: String(fallbackComponent.label || ""),
      details: details || null,
      quantity,
      unit_amount_cents: Number.isFinite(unitAmount) && unitAmount >= 0 ? Math.round(unitAmount) : Math.max(0, Number(fallbackComponent.unit_amount_cents || 0)),
      tax_rate_basis_points: Number.isFinite(Number(fallbackComponent.tax_rate_basis_points))
        ? Math.max(0, Math.round(Number(fallbackComponent.tax_rate_basis_points)))
        : getOfferCategoryTaxRateBasisPoints(category),
      currency,
      notes: String(fallbackComponent.notes || ""),
      sort_order: fallbackComponent.sort_order ?? index
    };
  });
}

function resolveOfferTotalCents() {
  const explicitTotal = Number(state.offerDraft?.total_price_cents);
  if (Number.isFinite(explicitTotal)) {
    return Math.round(explicitTotal);
  }
  const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
  const offerTotals = computeOfferDraftTotalsFromComponents(offerComponents);
  return offerTotals?.gross_amount_cents || 0;
}

function computeOfferDraftTotals() {
  return computeOfferDraftTotalsFromComponents(state.offerDraft?.components || []);
}

function computeOfferDraftTotalsFromComponents(components) {
  const normalizedComponents = Array.isArray(components) ? components : [];
  let net_amount_cents = 0;
  let tax_amount_cents = 0;
  for (const component of normalizedComponents) {
    const line = computeOfferComponentLineTotals(component);
    net_amount_cents += line.net_amount_cents;
    tax_amount_cents += line.tax_amount_cents;
  }
  const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferredCurrency || "USD");
  return {
    currency,
    net_amount_cents,
    tax_amount_cents,
    gross_amount_cents: net_amount_cents + tax_amount_cents,
    components_count: normalizedComponents.length
  };
}

function computeOfferComponentLineTotals(component) {
  const sign = offerCategorySign(component?.category);
  const quantity = Math.max(1, Number(component?.quantity || 1));
  const unitAmount = Math.max(0, Number(component?.unit_amount_cents || 0));
  const taxBasisPoints = Math.max(0, Number(component?.tax_rate_basis_points || 0));
  const net_amount_cents = sign * quantity * unitAmount;
  const tax_amount_cents = sign * Math.round((quantity * unitAmount * taxBasisPoints) / 10000);
  return {
    net_amount_cents,
    tax_amount_cents,
    gross_amount_cents: net_amount_cents + tax_amount_cents
  };
}

function renderPricingSummaryTable(pricing) {
  if (!els.pricingSummaryTable) return;
  const summary = pricing.summary || {};
  const moneyRows = [
    ["agreed_net_amount", pricing.agreed_net_amount_cents],
    ["adjustments_delta", summary.adjustments_delta_cents],
    ["adjusted_net_amount", summary.adjusted_net_amount_cents],
    ["scheduled_net_amount", summary.scheduled_net_amount_cents],
    ["unscheduled_net_amount", summary.unscheduled_net_amount_cents],
    ["scheduled_tax_amount", summary.scheduled_tax_amount_cents],
    ["scheduled_gross_amount", summary.scheduled_gross_amount_cents],
    ["paid_gross_amount", summary.paid_gross_amount_cents],
    ["outstanding_gross_amount", summary.outstanding_gross_amount_cents]
  ]
    .filter(([, value]) => Number(value || 0) !== 0)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatMoneyDisplay(value, pricing.currency))}</td></tr>`);
  const rows = []
    .concat(moneyRows)
    .concat(summary.is_schedule_balanced === false ? ['<tr><th>schedule_balanced</th><td>no</td></tr>'] : [])
    .join("");
  els.pricingSummaryTable.innerHTML = `<tbody>${rows || '<tr><td colspan="2">No payment totals yet</td></tr>'}</tbody>`;
}

function renderPricingAdjustmentsTable() {
  if (!els.pricingAdjustmentsTable) return;
  const readOnly = !state.permissions.canEditBooking;
  const items = Array.isArray(state.pricingDraft.adjustments) ? state.pricingDraft.adjustments : [];
  const currency = normalizeCurrencyCode(state.pricingDraft.currency);
  const header = `<thead><tr><th>Label</th><th>Type</th><th>Amount (${escapeHtml(currency)})</th><th>Notes</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
  const rows = items
    .map((item, index) => `<tr>
      <td><input data-pricing-adjustment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select data-pricing-adjustment-type="${index}" ${readOnly ? "disabled" : ""}>
          ${["DISCOUNT", "CREDIT", "SURCHARGE"]
            .map((type) => `<option value="${type}" ${item.type === type ? "selected" : ""}>${type}</option>`)
            .join("")}
        </select>
      </td>
      <td><input data-pricing-adjustment-amount="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-adjustment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-adjustment="${index}">Remove</button></td>`}
    </tr>`)
    .join("");
  const addRow = readOnly
    ? ""
    : `<tr><td colspan="5"><button class="btn btn-ghost" type="button" data-pricing-add-adjustment>Add</button></td></tr>`;
  const body = (rows || `<tr><td colspan="${readOnly ? 4 : 5}">No adjustments</td></tr>`) + addRow;
  els.pricingAdjustmentsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  if (!readOnly) {
    els.pricingAdjustmentsTable.querySelectorAll("[data-pricing-remove-adjustment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-pricing-remove-adjustment"));
        removePricingAdjustmentRow(index);
      });
    });
    els.pricingAdjustmentsTable.querySelector("[data-pricing-add-adjustment]")?.addEventListener("click", addPricingAdjustmentRow);
  }
}

function renderPricingPaymentsTable() {
  if (!els.pricingPaymentsTable) return;
  const readOnly = !state.permissions.canEditBooking;
  const items = Array.isArray(state.pricingDraft.payments) ? state.pricingDraft.payments : [];
  const currency = normalizeCurrencyCode(state.pricingDraft.currency);
  const header = `<thead><tr><th>Label</th><th>Due Date</th><th>Net (${escapeHtml(currency)})</th><th>Tax %</th><th>Status</th><th>Paid At</th><th>Notes</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
  const rows = items
    .map((item, index) => `<tr>
      <td><input data-pricing-payment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-due-date="${index}" type="date" value="${escapeHtml(item.due_date || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-net="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.net_amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-tax="${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(formatTaxRatePercent(item.tax_rate_basis_points))}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select data-pricing-payment-status="${index}" ${readOnly ? "disabled" : ""}>
          ${["PENDING", "PAID"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td><input data-pricing-payment-paid-at="${index}" type="datetime-local" value="${escapeHtml(normalizeDateTimeLocal(item.paid_at))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-payment="${index}">Remove</button></td>`}
    </tr>`)
    .join("");
  const addRow = readOnly
    ? ""
    : `<tr><td colspan="8"><button class="btn btn-ghost" type="button" data-pricing-add-payment>Add</button></td></tr>`;
  const body = (rows || `<tr><td colspan="${readOnly ? 7 : 8}">No payments scheduled</td></tr>`) + addRow;
  els.pricingPaymentsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  if (!readOnly) {
    els.pricingPaymentsTable.querySelectorAll("[data-pricing-remove-payment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-pricing-remove-payment"));
        removePricingPaymentRow(index);
      });
    });
    els.pricingPaymentsTable.querySelectorAll("[data-pricing-payment-status]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.getAttribute("data-pricing-payment-status"));
        const paidAtInput = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`);
        if (!(paidAtInput instanceof HTMLInputElement)) return;
        if (String(select.value || "").toUpperCase() === "PAID") {
          if (!paidAtInput.value) paidAtInput.value = normalizeDateTimeLocal(new Date().toISOString());
        } else {
          paidAtInput.value = "";
        }
      });
    });
    els.pricingPaymentsTable.querySelector("[data-pricing-add-payment]")?.addEventListener("click", addPricingPaymentRow);
  }
}

function addPricingAdjustmentRow() {
  state.pricingDraft.adjustments.push({
    id: "",
    type: "DISCOUNT",
    label: "",
    amount_cents: 0,
    notes: ""
  });
  renderPricingAdjustmentsTable();
}

function removePricingAdjustmentRow(index) {
  state.pricingDraft.adjustments.splice(index, 1);
  renderPricingAdjustmentsTable();
}

function addPricingPaymentRow() {
  state.pricingDraft.payments.push({
    id: "",
    label: "",
    due_date: "",
    net_amount_cents: 0,
    tax_rate_basis_points: 0,
    status: "PENDING",
    paid_at: "",
    notes: ""
  });
  renderPricingPaymentsTable();
}

function removePricingPaymentRow(index) {
  state.pricingDraft.payments.splice(index, 1);
  renderPricingPaymentsTable();
}

async function saveOwner() {
  if (!state.booking || !els.ownerSelect) return;
  const result = await fetchBookingMutation(bookingAssignmentRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      atp_staff: els.ownerSelect.value || null,
      actor: state.user
    }
  });
  if (!result?.booking) return;
  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  setStatus("Staff updated.");
  await loadActivities();
}

async function saveStage() {
  if (!state.booking || !els.stageSelect) return;
  const result = await fetchBookingMutation(bookingStageRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      stage: els.stageSelect.value,
      actor: state.user
    }
  });
  if (!result?.booking) return;
  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  setStatus("Stage updated.");
  await loadActivities();
}

async function saveNote() {
  if (!state.booking || !els.noteInput) return;
  if (!hasBookingNoteChanged()) {
    updateNoteSaveButtonState();
    setStatus("No changes to update.");
    return;
  }
  const result = await fetchBookingMutation(bookingNoteRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      notes: String(els.noteInput.value || "").trim(),
      actor: state.user,
    }
  });
  if (!result?.booking) return;

  state.booking = result.booking;
  state.originalNote = String(result.booking.notes || "");
  if (els.noteInput) els.noteInput.value = state.originalNote;
  updateNoteSaveButtonState();
  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  setStatus(result.unchanged ? "Note unchanged." : "Note updated.");
  await loadActivities();
}

function hasBookingNoteChanged() {
  if (!els.noteInput) return false;
  const current = String(els.noteInput.value || "").trim();
  const original = String(state.originalNote || "").trim();
  return current !== original;
}

function updateNoteSaveButtonState() {
  if (!els.noteSaveBtn) return;
  const canUpdate = state.permissions.canEditBooking && hasBookingNoteChanged();
  els.noteSaveBtn.disabled = !canUpdate;
  els.noteSaveBtn.style.opacity = canUpdate ? "1" : "0.55";
  els.noteSaveBtn.style.cursor = canUpdate ? "" : "not-allowed";
  setBookingSectionDirty("note", canUpdate);
}

async function savePricing() {
  if (!state.booking) return;
  let pricing;
  try {
    pricing = collectPricingPayload();
  } catch (error) {
    setPricingStatus(String(error?.message || error));
    return;
  }

  const result = await fetchBookingMutation(bookingPricingRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      pricing,
      actor: state.user
    }
  });
  if (!result?.booking) {
    if (els.error?.textContent) setPricingStatus(els.error.textContent);
    return;
  }

  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  renderPricingPanel();
  setPricingStatus(result.unchanged ? "Payments unchanged." : "Payments saved.");
  await loadActivities();
}

async function loadActivities() {
  if (!state.booking) return;
  const payload = await fetchApi(bookingActivitiesRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url);
  if (!payload) return;
  renderActivitiesTable(payload.items || []);
}

async function loadBookingChat({ fromPoll = false } = {}) {
  if (!state.booking || !els.metaChatTable) return;
  const previousIds = new Set((Array.isArray(state.chat.items) ? state.chat.items : []).map((item) => String(item?.id || "")));
  const payload = await fetchApi(
    bookingChatRequest({
      baseURL: apiOrigin,
      params: { bookingId: state.booking.id },
      query: { limit: 100 }
    }).url
  );
  if (!payload) return;
  const nextItems = Array.isArray(payload.items) ? payload.items : [];
  const newlyArrived = nextItems.filter((item) => {
    const id = String(item?.id || "");
    return id && !previousIds.has(id);
  });
  const inboundNew = newlyArrived.filter((item) => String(item?.direction || "").toLowerCase() === "inbound");
  state.chat.items = nextItems;
  state.chat.conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
  renderMetaChatPanel();
  if (fromPoll && state.chat.initialized && inboundNew.length) {
    notifyNewChatMessages(inboundNew);
  }
  state.chat.initialized = true;
}

function startBookingChatAutoRefresh() {
  if (!state.booking || state.chat.pollTimer) return;
  state.chat.pollTimer = window.setInterval(async () => {
    if (state.chat.isPolling) return;
    state.chat.isPolling = true;
    try {
      await loadBookingChat({ fromPoll: true });
    } finally {
      state.chat.isPolling = false;
    }
  }, 10000);
}

function notifyNewChatMessages(items) {
  const count = Array.isArray(items) ? items.length : 0;
  if (!count) return;
  const newest = items[0];
  const summary = count === 1 ? "New WhatsApp message received." : `${count} new WhatsApp messages received.`;
  setStatus(summary);

  if (!("Notification" in window)) return;
  const body = String(newest?.text_preview || "Open booking chat to read.");
  if (Notification.permission === "granted") {
    new Notification("WhatsApp message", { body });
    return;
  }
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification("WhatsApp message", { body });
      }
    });
  }
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function resolveChatPhoneNumber(items) {
  const primaryPhone = String(getPrimaryContact(state.booking)?.phone_numbers?.[0] || "").trim();
  if (primaryPhone) return primaryPhone;
  const submittedPhone = String(getSubmittedContact(state.booking)?.phone_number || "").trim();
  if (submittedPhone) return submittedPhone;
  const firstSender = (Array.isArray(items) ? items : []).find((item) => String(item?.sender_contact || "").trim());
  return String(firstSender?.sender_contact || "").trim();
}

function parseChatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatChatTime(value) {
  const date = parseChatDate(value);
  if (!date) return "-";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function chatDayKey(value) {
  const date = parseChatDate(value);
  if (!date) return "";
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatChatDayLabel(value) {
  const date = parseChatDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function parseDeliveredStatusPayload(textPreview) {
  const text = String(textPreview || "").trim();
  const withMessage = text.match(/^Status:\s*([a-z_ ]+)\s*-\s*(.+)$/i);
  if (withMessage) {
    return { status: String(withMessage[1] || "").trim(), message: String(withMessage[2] || "").trim() };
  }
  const onlyStatus = text.match(/^Status:\s*(.+)$/i);
  if (onlyStatus) {
    return { status: String(onlyStatus[1] || "").trim(), message: "" };
  }
  return { status: "", message: "" };
}

function isSingleEmojiMessage(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const compact = raw.replace(/\s+/g, "");
  if (!compact) return false;
  let graphemes = [];
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    graphemes = [...segmenter.segment(compact)].map((part) => part.segment);
  } else {
    graphemes = Array.from(compact);
  }
  if (graphemes.length !== 1) return false;
  return /\p{Extended_Pictographic}/u.test(graphemes[0]);
}

function isDeliveredStatusText(text) {
  const status = String(text || "").trim().toLowerCase();
  return status === "delivered";
}

function buildDeliveredTicksMarkup(isDelivered) {
  if (!isDelivered) return "";
  return '<span class="wa-meta-ticks" aria-label="delivered">&#10003;</span>';
}

function renderMetaChatPanel() {
  if (!els.metaChatTable) return;
  const items = Array.isArray(state.chat.items) ? state.chat.items : [];
  const orderedItems = [...items].sort((left, right) => {
    const leftTime = String(left?.sent_at || left?.created_at || "");
    const rightTime = String(right?.sent_at || right?.created_at || "");
    return leftTime.localeCompare(rightTime);
  });

  if (els.metaChatSummary) {
    const phone = resolveChatPhoneNumber(items) || "-";
    const waDigits = normalizePhoneDigits(phone);
    const waUrl = waDigits ? `https://wa.me/${waDigits}` : "";
    const button = waUrl
      ? `<a class="btn btn-ghost" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener">Open WhatsApp</a>`
      : `<span class="btn btn-ghost" aria-disabled="true">Open WhatsApp</span>`;
    els.metaChatSummary.innerHTML = `<span class="wa-meta-item">Phone: ${escapeHtml(phone)}</span><span class="wa-meta-gap"></span>${button}`;
  }

  let previousDay = "";
  const rows = orderedItems
    .map((item) => {
      const direction = String(item?.direction || "").toLowerCase();
      const eventType = String(item?.event_type || "").toLowerCase();
      const sentAt = item?.sent_at || item?.created_at || item?.received_at;
      const day = chatDayKey(sentAt);
      const daySeparator =
        day && day !== previousDay
          ? `<div class="wa-day-sep"><span>${escapeHtml(formatChatDayLabel(sentAt))}</span></div>`
          : "";
      if (day) previousDay = day;

      let rowClass = eventType === "status" ? "is-status" : direction === "outbound" ? "is-out" : "is-in";
      let text = String(item?.text_preview || "-");
      const parsedStatus = parseDeliveredStatusPayload(text);
      let deliveredLine = "";
      let deliveredForMeta = false;
      if (eventType === "status" && parsedStatus.message) {
        text = parsedStatus.message;
        rowClass = "is-out";
        deliveredForMeta = isDeliveredStatusText(parsedStatus.status);
        deliveredLine = parsedStatus.status && !isDeliveredStatusText(parsedStatus.status)
          ? `<div class="wa-msg-status"><em>${escapeHtml(parsedStatus.status)}</em></div>`
          : "";
      } else if (eventType === "status" && parsedStatus.status) {
        text = "Status update";
        deliveredForMeta = isDeliveredStatusText(parsedStatus.status);
        deliveredLine = isDeliveredStatusText(parsedStatus.status)
          ? ""
          : `<div class="wa-msg-status"><em>${escapeHtml(parsedStatus.status)}</em></div>`;
      } else if (item?.external_status) {
        deliveredForMeta = isDeliveredStatusText(item.external_status);
        deliveredLine = isDeliveredStatusText(item.external_status)
          ? ""
          : `<div class="wa-msg-status"><em>${escapeHtml(String(item.external_status))}</em></div>`;
      }

      const safeText = escapeHtml(text);
      const time = escapeHtml(formatChatTime(sentAt));
      const bubbleClass = isSingleEmojiMessage(text) ? "wa-msg-bubble is-emoji" : "wa-msg-bubble";
      const metaLine = `${time}${buildDeliveredTicksMarkup(deliveredForMeta)}`;
      return `${daySeparator}<div class="wa-msg-row ${rowClass}">
        <div class="${bubbleClass}">
          <div class="wa-msg-text">${safeText}</div>
          ${deliveredLine}
          <div class="wa-msg-meta">${metaLine}</div>
        </div>
      </div>`;
    })
    .join("");
  els.metaChatTable.innerHTML = rows || '<div class="wa-empty">No chat events for this booking yet</div>';
  const canvas = els.metaChatTable.parentElement;
  if (canvas) {
    canvas.scrollTop = canvas.scrollHeight;
  }
}

function renderActivitiesTable(items) {
  if (!els.activitiesTable) return;
  const header = `<thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th></tr></thead>`;
  const rows = items
    .map(
      (activity) => `<tr>
      <td>${escapeHtml(formatDateTime(activity.created_at))}</td>
      <td>${escapeHtml(activity.type || "-")}</td>
      <td>${escapeHtml(activity.actor || "-")}</td>
      <td>${escapeHtml(activity.detail || "-")}</td>
    </tr>`
    )
    .join("");

  const body = rows || '<tr><td colspan="4">No activities</td></tr>';
  els.activitiesTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

async function loadInvoices() {
  if (!state.booking) return;
  const payload = await fetchApi(bookingInvoicesRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url);
  if (!payload) return;
  state.invoices = (Array.isArray(payload.items) ? payload.items : []).sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  );
  renderInvoiceSelect();
  renderInvoicesTable();
  if (state.selectedInvoiceId) {
    const selected = state.invoices.find((item) => item.id === state.selectedInvoiceId);
    if (selected) {
      fillInvoiceForm(selected);
      return;
    }
  }
  resetInvoiceForm();
}

function renderInvoiceSelect() {
  if (!els.invoiceSelect) return;
  const options = ['<option value="">New invoice</option>']
    .concat(
      state.invoices.map(
        (invoice) =>
          `<option value="${escapeHtml(invoice.id)}">${escapeHtml(invoice.invoice_number || shortId(invoice.id))} (${escapeHtml(
            invoice.status || "DRAFT"
          )})</option>`
      )
    )
    .join("");
  els.invoiceSelect.innerHTML = options;
  els.invoiceSelect.value = state.selectedInvoiceId || "";
}

function renderInvoicesTable() {
  if (!els.invoicesTable) return;
  const header = `<thead><tr><th>PDF</th><th>Invoice</th><th>Version</th><th>Sent to recipient</th><th>Total</th><th>Updated</th><th>Actions</th></tr></thead>`;
  const rows = state.invoices
    .map((invoice) => {
      const checked = invoice.sent_to_recipient ? "checked" : "";
      const disabled = state.permissions.canEditBooking ? "" : "disabled";
      return `<tr>
        <td><a class="btn btn-ghost" href="${escapeHtml(`${apiBase}/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`)}" target="_blank" rel="noopener">PDF</a></td>
        <td>${escapeHtml(invoice.invoice_number || shortId(invoice.id))}</td>
        <td>${escapeHtml(String(invoice.version || 1))}</td>
        <td><input type="checkbox" data-invoice-sent="${escapeHtml(invoice.id)}" ${checked} ${disabled} /></td>
        <td>${escapeHtml(formatMoneyDisplay(invoice.total_amount_cents || 0, invoice.currency || "USD"))}</td>
        <td>${escapeHtml(formatDateTime(invoice.updated_at))}</td>
        <td><button type="button" class="btn btn-ghost" data-select-invoice="${escapeHtml(invoice.id)}">Load data</button></td>
      </tr>`;
    })
    .join("");
  const body = rows || '<tr><td colspan="7">No invoices</td></tr>';
  els.invoicesTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  els.invoicesTable.querySelectorAll("[data-select-invoice]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String(button.getAttribute("data-select-invoice") || "");
      state.selectedInvoiceId = id;
      renderInvoiceSelect();
      const invoice = state.invoices.find((item) => item.id === id);
      if (invoice) fillInvoiceForm(invoice);
    });
  });
  els.invoicesTable.querySelectorAll("[data-invoice-sent]").forEach((input) => {
    input.addEventListener("change", async () => {
      const invoiceId = String(input.getAttribute("data-invoice-sent") || "");
      await toggleInvoiceSent(invoiceId, Boolean(input.checked));
    });
  });
}

function onInvoiceSelectChange() {
  const id = String(els.invoiceSelect?.value || "");
  state.selectedInvoiceId = id;
  clearInvoiceStatus();
  if (!id) {
    resetInvoiceForm();
    return;
  }
  const invoice = state.invoices.find((item) => item.id === id);
  if (invoice) fillInvoiceForm(invoice);
}

function fillInvoiceForm(invoice) {
  state.selectedInvoiceId = invoice.id;
  if (els.invoiceSelect) els.invoiceSelect.value = invoice.id;
  if (els.invoiceNumberInput) els.invoiceNumberInput.value = invoice.invoice_number || "";
  if (els.invoiceCurrencyInput) setSelectValue(els.invoiceCurrencyInput, invoice.currency || "USD");
  renderInvoiceMoneyLabels();
  if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = normalizeDateInput(invoice.issue_date);
  if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = normalizeDateInput(invoice.due_date);
  if (els.invoiceTitleInput) els.invoiceTitleInput.value = invoice.title || "";
  if (els.invoiceComponentsInput) els.invoiceComponentsInput.value = invoiceComponentsToText(invoice.components || [], invoice.currency || "USD");
  if (els.invoiceDueAmountInput) els.invoiceDueAmountInput.value = invoice.due_amount_cents ? formatMoneyInputValue(invoice.due_amount_cents, invoice.currency || "USD") : "";
  if (els.invoiceVatInput) {
    const vat = Number(invoice.vat_percentage || 0);
    els.invoiceVatInput.value = Number.isFinite(vat) ? String(vat) : "0";
  }
  if (els.invoiceNotesInput) els.invoiceNotesInput.value = invoice.notes || "";
  applyInvoicePermissions();
  markInvoiceSnapshotClean();
}

function resetInvoiceForm() {
  state.selectedInvoiceId = "";
  if (els.invoiceSelect) els.invoiceSelect.value = "";
  if (els.invoiceNumberInput) els.invoiceNumberInput.value = "";
  if (els.invoiceCurrencyInput) setSelectValue(els.invoiceCurrencyInput, "USD");
  renderInvoiceMoneyLabels();
  if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = "";
  if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = "";
  if (els.invoiceTitleInput) els.invoiceTitleInput.value = "";
  if (els.invoiceComponentsInput) els.invoiceComponentsInput.value = "";
  if (els.invoiceDueAmountInput) els.invoiceDueAmountInput.value = "";
  if (els.invoiceVatInput) els.invoiceVatInput.value = "0";
  if (els.invoiceNotesInput) els.invoiceNotesInput.value = "";
  clearInvoiceStatus();
  applyInvoicePermissions();
  markInvoiceSnapshotClean();
}

function invoiceComponentsToText(components, currency) {
  return (Array.isArray(components) ? components : [])
    .map((component) => `${component.description || ""} | ${Number(component.quantity || 1)} | ${formatMoneyInputValue(component.unit_amount_cents || 0, currency || "USD")}`)
    .join("\n");
}

function parseInvoiceComponentsText(text) {
  const currency = normalizeCurrencyCode(els.invoiceCurrencyInput?.value || "USD");
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const components = [];
  for (const line of lines) {
    const parts = line.split("|").map((value) => value.trim());
    if (parts.length < 3) throw new Error(`Invalid line: "${line}". Use "Description | Quantity | Unit amount".`);
    const description = parts[0];
    const quantity = Number(parts[1]);
    const unitAmountCents = parseMoneyInputValue(parts[2], currency);
    if (!description) throw new Error(`Missing description in line: "${line}"`);
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`Invalid quantity in line: "${line}"`);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 1) throw new Error(`Invalid amount in line: "${line}"`);
    components.push({ description, quantity: Math.round(quantity), unit_amount_cents: Math.round(unitAmountCents) });
  }
  return components;
}

function collectInvoicePayload() {
  const currency = normalizeCurrencyCode(els.invoiceCurrencyInput?.value || "USD");
  const components = parseInvoiceComponentsText(els.invoiceComponentsInput?.value || "");
  const dueAmountRaw = String(els.invoiceDueAmountInput?.value || "").trim();
  const dueAmount = dueAmountRaw ? parseMoneyInputValue(dueAmountRaw, currency) : null;
  if (dueAmountRaw && (!Number.isFinite(dueAmount) || dueAmount < 1)) {
    throw new Error("Due amount must be a positive number.");
  }
  const vatRaw = String(els.invoiceVatInput?.value || "").trim();
  const vat = vatRaw ? Number(vatRaw) : 0;
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    throw new Error("VAT must be between 0 and 100.");
  }
  return {
    invoice_number: String(els.invoiceNumberInput?.value || "").trim(),
    currency,
    issue_date: String(els.invoiceIssueDateInput?.value || "").trim(),
    due_date: String(els.invoiceDueDateInput?.value || "").trim(),
    title: String(els.invoiceTitleInput?.value || "").trim(),
    notes: String(els.invoiceNotesInput?.value || "").trim(),
    vat_percentage: vat,
    due_amount_cents: dueAmount ? Math.round(dueAmount) : null,
    components
  };
}

async function createInvoice() {
  if (!state.booking) return;
  if (!state.permissions.canEditBooking) return;
  clearInvoiceStatus();
  let payload;
  try {
    payload = collectInvoicePayload();
  } catch (error) {
    setInvoiceStatus(String(error?.message || error));
    return;
  }
  const isUpdate = Boolean(state.selectedInvoiceId);
  const path = isUpdate
    ? `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices/${encodeURIComponent(state.selectedInvoiceId)}`
    : `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices`;
  const method = isUpdate ? "PATCH" : "POST";
  const result = await fetchApi(path, {
    method,
    body: {
      ...payload,
      booking_hash: state.booking.booking_hash
    }
  });
  if (!result?.invoice) return;
  if (result.booking) {
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderOfferPanel();
    renderPricingPanel();
  }
  state.selectedInvoiceId = result.invoice.id;
  setInvoiceStatus(isUpdate ? "Invoice updated." : "Invoice created.");
  await loadInvoices();
}

async function toggleInvoiceSent(invoiceId, sent) {
  if (!state.booking || !invoiceId) return;
  if (!state.permissions.canEditBooking) return;
  clearInvoiceStatus();
  const result = await fetchApi(
    `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "PATCH",
      body: {
        sent_to_recipient: Boolean(sent),
        booking_hash: state.booking.booking_hash
      }
    }
  );
  if (!result?.invoice) return;
  if (result.booking) {
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderOfferPanel();
    renderPricingPanel();
  }
  setInvoiceStatus(sent ? "Invoice marked as sent to recipient." : "Invoice marked as not sent.");
  await loadInvoices();
}

function setInvoiceStatus(message) {
  if (!els.invoiceStatus) return;
  els.invoiceStatus.textContent = message;
}

function clearInvoiceStatus() {
  setInvoiceStatus("");
}

function setPricingStatus(message) {
  if (!els.pricingStatus) return;
  els.pricingStatus.textContent = message;
}

function clearPricingStatus() {
  setPricingStatus("");
}

function setOfferStatus(message) {
  if (!els.offerStatus) return;
  els.offerStatus.textContent = message;
}

function clearOfferStatus() {
  setOfferStatus("");
}

function applyInvoicePermissions() {
  const disabled = !state.permissions.canEditBooking;
  [
    els.invoiceSelect,
    els.invoiceNumberInput,
    els.invoiceCurrencyInput,
    els.invoiceIssueDateInput,
    els.invoiceIssueTodayBtn,
    els.invoiceDueDateInput,
    els.invoiceDueMonthBtn,
    els.invoiceTitleInput,
    els.invoiceComponentsInput,
    els.invoiceDueAmountInput,
    els.invoiceVatInput,
    els.invoiceNotesInput
  ].forEach((el) => {
    if (el) el.disabled = disabled;
  });
}

function collectPricingPayload() {
  const currency = normalizeCurrencyCode(els.pricingCurrencyInput?.value || "USD");
  const agreedNet = parseMoneyInputValue(els.pricingAgreedNetInput?.value || "0", currency);
  if (!currency) throw new Error("Currency is required.");
  if (!Number.isFinite(agreedNet) || agreedNet < 0) throw new Error("Agreed net amount must be zero or positive.");

  const adjustments = Array.from(document.querySelectorAll("[data-pricing-adjustment-label]")).map((input) => {
    const index = Number(input.getAttribute("data-pricing-adjustment-label"));
    const type = String(document.querySelector(`[data-pricing-adjustment-type="${index}"]`)?.value || "DISCOUNT").trim().toUpperCase();
    const label = String(document.querySelector(`[data-pricing-adjustment-label="${index}"]`)?.value || "").trim();
    const amount = parseMoneyInputValue(document.querySelector(`[data-pricing-adjustment-amount="${index}"]`)?.value || "0", currency);
    const notes = String(document.querySelector(`[data-pricing-adjustment-notes="${index}"]`)?.value || "").trim();
    if (!label) throw new Error(`Adjustment ${index + 1} requires a label.`);
    if (!["DISCOUNT", "CREDIT", "SURCHARGE"].includes(type)) throw new Error(`Adjustment ${index + 1} has an invalid type.`);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`Adjustment ${index + 1} requires a valid non-negative amount.`);
    return {
      id: state.pricingDraft.adjustments[index]?.id || "",
      type,
      label,
      amount_cents: Math.round(amount),
      notes: notes || null
    };
  });

  const payments = Array.from(document.querySelectorAll("[data-pricing-payment-label]")).map((input) => {
    const index = Number(input.getAttribute("data-pricing-payment-label"));
    const label = String(document.querySelector(`[data-pricing-payment-label="${index}"]`)?.value || "").trim();
    const dueDate = String(document.querySelector(`[data-pricing-payment-due-date="${index}"]`)?.value || "").trim();
    const netAmount = parseMoneyInputValue(document.querySelector(`[data-pricing-payment-net="${index}"]`)?.value || "0", currency);
    const taxPercent = Number(document.querySelector(`[data-pricing-payment-tax="${index}"]`)?.value || "0");
    const status = String(document.querySelector(`[data-pricing-payment-status="${index}"]`)?.value || "PENDING").trim().toUpperCase();
    const paidAtInputValue = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`)?.value || "";
    const paidAt = normalizeLocalDateTimeToIso(paidAtInputValue || (status === "PAID" ? normalizeDateTimeLocal(new Date().toISOString()) : ""));
    const notes = String(document.querySelector(`[data-pricing-payment-notes="${index}"]`)?.value || "").trim();
    if (!label) throw new Error(`Payment ${index + 1} requires a label.`);
    if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error(`Payment ${index + 1} requires a valid non-negative net amount.`);
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new Error(`Payment ${index + 1} requires a tax rate between 0 and 100.`);
    if (!["PENDING", "PAID"].includes(status)) throw new Error(`Payment ${index + 1} has an invalid status.`);
    if (status === "PAID" && !paidAt) throw new Error(`Payment ${index + 1} needs a paid time when marked paid.`);
    return {
      id: state.pricingDraft.payments[index]?.id || "",
      label,
      due_date: dueDate || null,
      net_amount_cents: Math.round(netAmount),
      tax_rate_basis_points: Math.round(taxPercent * 100),
      status,
      paid_at: paidAt || null,
      notes: notes || null
    };
  });

  return {
    currency,
    agreed_net_amount_cents: Math.round(agreedNet),
    adjustments,
    payments
  };
}

function collectOfferCategoryRules() {
  const defaults = defaultOfferCategoryRules();
  const byCategory = new Map((Array.isArray(state.offerDraft?.category_rules) ? state.offerDraft.category_rules : []).map((rule) => [
    normalizeOfferCategory(rule?.category),
    rule
  ]));
  return OFFER_CATEGORIES.map((category) => {
    const override = byCategory.get(category.code);
    const raw = override?.tax_rate_basis_points;
    const taxRateBasisPoints = Number.isFinite(Number(raw))
      ? Math.max(0, Math.round(Number(raw)))
      : defaults.find((entry) => entry.category === category.code)?.tax_rate_basis_points || DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
    return {
      category: category.code,
      tax_rate_basis_points: taxRateBasisPoints
    }
  });
}

function collectOfferComponents({ throwOnError = true } = {}) {
  const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferredCurrency || "USD");
  const rows = Array.from(document.querySelectorAll("[data-offer-component-details]"));
  const components = [];
  for (const input of rows) {
    const index = Number(input.getAttribute("data-offer-component-details"));
    const category = normalizeOfferCategory(state.offerDraft?.components[index]?.category || "OTHER");
    const details = String(document.querySelector(`[data-offer-component-details="${index}"]`)?.value || "").trim();
    const quantity = Number(document.querySelector(`[data-offer-component-quantity="${index}"]`)?.value || "1");
    const unitAmount = parseMoneyInputValue(document.querySelector(`[data-offer-component-unit="${index}"]`)?.value || "0", currency);
    const label = String(offerCategoryLabel(category)).trim();
    const notes = String(state.offerDraft?.components[index]?.notes || "").trim();
    if (!Number.isFinite(quantity) || quantity < 1) {
      if (throwOnError) throw new Error(`Offer component ${index + 1} quantity must be at least 1.`);
      continue;
    }
    if (!Number.isFinite(unitAmount) || unitAmount < 0) {
      if (throwOnError) throw new Error(`Offer component ${index + 1} requires a valid non-negative unit amount.`);
      continue;
    }
    components.push({
      id: state.offerDraft.components[index]?.id || "",
      category,
      label,
      details: details || null,
      quantity: Math.round(quantity),
      unit_amount_cents: Math.round(unitAmount),
      tax_rate_basis_points: getOfferCategoryTaxRateBasisPoints(category),
      currency,
      notes: notes || null,
      sort_order: index
    });
  }
  return components;
}

function collectOfferPayload() {
  const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferredCurrency || "USD");
  const category_rules = collectOfferCategoryRules();
  const components = collectOfferComponents();
  return {
    currency,
    category_rules,
    components
  };
}

async function convertOfferComponentsInBackend(currentCurrency, nextCurrency, components) {
  const response = await fetchApi(`${apiOrigin}/api/v1/offers/exchange-rates`, {
    method: "POST",
    body: {
      from_currency: currentCurrency,
      to_currency: nextCurrency,
      components: components.map((component, index) => ({
        id: component.id || `component_${index}`,
        unit_amount_cents: Number(component.unit_amount_cents || 0),
        category: component.category || "OTHER",
        quantity: Number(component.quantity || 1),
        tax_rate_basis_points: Number(component.tax_rate_basis_points || 1000)
      }))
    }
  });

  const convertedComponentsRaw = Array.isArray(response?.converted_components)
    ? response.converted_components
    : null;
  if (!response || !Array.isArray(convertedComponentsRaw)) {
    throw new Error(response?.detail || response?.error || "Offer exchange failed.");
  }
  return {
    convertedComponents: convertedComponentsRaw.map((component, index) => ({
      id: component.id || `component_${index}`,
      unit_amount_cents: Math.max(0, Number(component.unit_amount_cents) || 0),
      line_total_amount_cents: Number.isFinite(Number(component.line_total_amount_cents))
        ? Number(component.line_total_amount_cents)
        : Number(component.line_gross_amount_cents) || 0
    })),
    totalPriceCents: Number.isFinite(Number(response.total_price_cents))
      ? Number(response.total_price_cents)
      : null
  };
}

async function handleOfferCurrencyChange() {
  if (!state.booking || !state.offerDraft || !els.offerCurrencyInput) return;
  if (!state.permissions.canEditBooking) {
    setSelectValue(els.offerCurrencyInput, normalizeCurrencyCode(state.offerDraft.currency || "USD"));
    return;
  }

  const nextCurrency = normalizeCurrencyCode(els.offerCurrencyInput.value);
  const currentCurrency = normalizeCurrencyCode(state.offerDraft.currency || state.booking.preferredCurrency || "USD");
  if (!nextCurrency || nextCurrency === currentCurrency) {
    setSelectValue(els.offerCurrencyInput, currentCurrency);
    return;
  }

  let components;
  try {
    components = collectOfferComponents({ throwOnError: true });
  } catch (error) {
    setOfferStatus(String(error?.message || error));
    setSelectValue(els.offerCurrencyInput, currentCurrency);
    return;
  }

  const restoreSelectState = () => {
    if (els.offerCurrencyInput) {
      els.offerCurrencyInput.disabled = false;
    }
  };
  if (els.offerCurrencyInput) {
    els.offerCurrencyInput.disabled = true;
  }
  setOfferStatus("Converting prices...");
  try {
    const converted = await convertOfferComponentsInBackend(currentCurrency, nextCurrency, components);
    const convertedComponents = converted.convertedComponents;
    state.offerDraft.currency = nextCurrency;
    state.offerDraft.components = components.map((component, index) => {
      const convertedComponent = convertedComponents[index] || {};
      return {
        ...component,
        unit_amount_cents:
          Number.isFinite(convertedComponent.unit_amount_cents) && convertedComponent.unit_amount_cents >= 0
            ? convertedComponent.unit_amount_cents
            : component.unit_amount_cents,
        line_total_amount_cents: Number.isFinite(convertedComponent.line_total_amount_cents)
          ? convertedComponent.line_total_amount_cents
          : component.line_total_amount_cents,
        currency: nextCurrency
      };
    });
    if (Number.isFinite(Number(converted.totalPriceCents))) {
      state.offerDraft.total_price_cents = Math.round(Number(converted.totalPriceCents));
    }
    setOfferSaveEnabled(true);
  } catch (error) {
    setOfferStatus(`Exchange rate lookup failed: ${error?.message || error}`);
    restoreSelectState();
    setSelectValue(els.offerCurrencyInput, currentCurrency);
    return;
  }
  restoreSelectState();
  setOfferStatus("");
  renderOfferComponentsTable();
}

async function saveOffer() {
  if (!state.booking || !state.permissions.canEditBooking) return;
  clearOfferStatus();
  let offer;
  try {
    offer = collectOfferPayload();
  } catch (error) {
    setOfferStatus(String(error?.message || error));
    return;
  }

  const result = await fetchBookingMutation(bookingOfferRequest({ baseURL: apiOrigin, params: { bookingId: state.booking.id } }).url, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      offer,
      actor: state.user
    }
  });

  if (!result?.booking) {
    if (els.error?.textContent) setOfferStatus(els.error.textContent);
    return;
  }

  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  renderOfferPanel();
  setOfferStatus(result.unchanged ? "Offer unchanged." : "Offer saved.");
  setOfferSaveEnabled(false);
  await loadActivities();
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatTaxRatePercent(value) {
  const basisPoints = Number(value || 0);
  if (!Number.isFinite(basisPoints)) return "0";
  return (basisPoints / 100).toFixed(2).replace(/\.00$/, "");
}

function getCurrencyDefinitions() {
  return GENERATED_CURRENCIES;
}

function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || "USD";
}

function currencyDefinition(currency) {
  const code = normalizeCurrencyCode(currency);
  const definitions = getCurrencyDefinitions();
  const definition = definitions[code] || definitions.USD || { symbol: code, decimalPlaces: 2 };
  return {
    code,
    symbol: definition.symbol || code,
    decimalPlaces: Number.isFinite(Number(definition.decimal_places ?? definition.decimalPlaces))
      ? Number(definition.decimal_places ?? definition.decimalPlaces)
      : 2
  };
}

function currencySymbol(currency) {
  return currencyDefinition(currency).symbol;
}

function currencyDecimalPlaces(currency) {
  return currencyDefinition(currency).decimalPlaces;
}

function isWholeUnitCurrency(currency) {
  return currencyDecimalPlaces(currency) === 0;
}

function populateCurrencySelect(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const definitions = getCurrencyDefinitions();
  const selectedValue = normalizeCurrencyCode(selectEl.value || "USD");
  selectEl.innerHTML = Object.keys(definitions)
    .map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`)
    .join("");
  selectEl.value = selectedValue;
}

function populateOfferCategorySelect(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const currentValue = String(selectEl.value || "").trim().toUpperCase();
  selectEl.innerHTML = [
    '<option value="" selected disabled>Category</option>',
    ...OFFER_CATEGORIES.map((category) => `<option value="${escapeHtml(category.code)}">${escapeHtml(category.label)}</option>`)
  ].join("");
  if (currentValue && OFFER_CATEGORIES.some((category) => category.code === currentValue)) {
    selectEl.value = currentValue;
  }
}

function formatMoneyDisplay(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "-";
  const major = amount / 10 ** definition.decimalPlaces;
  return `${definition.symbol} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: definition.decimalPlaces,
    maximumFractionDigits: definition.decimalPlaces,
    useGrouping: true
  }).format(major)}`;
}

function formatMoneyInputValue(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "0";
  if (definition.decimalPlaces === 0) return String(Math.round(amount));
  return (amount / 10 ** definition.decimalPlaces).toFixed(definition.decimalPlaces);
}

function parseMoneyInputValue(value, currency) {
  const definition = currencyDefinition(currency);
  const normalized = String(value || "0").trim().replace(",", ".");
  const amount = Number(normalized || "0");
  if (!Number.isFinite(amount)) return NaN;
  if (definition.decimalPlaces === 0) return Math.round(amount);
  return Math.round(amount * 10 ** definition.decimalPlaces);
}

function renderInvoiceMoneyLabels() {
  const currency = normalizeCurrencyCode(els.invoiceCurrencyInput?.value || "USD");
  if (els.invoiceDueAmountLabel) {
    els.invoiceDueAmountLabel.textContent = `Due Amount (${currency}, optional)`;
  }
  if (els.invoiceComponentsLabel) {
    els.invoiceComponentsLabel.textContent = `Components (one per line: Description | Quantity | Unit amount in ${currency})`;
  }
  if (els.invoiceDueAmountInput) {
    els.invoiceDueAmountInput.step = isWholeUnitCurrency(currency) ? "1" : "0.01";
  }
}

function clonePricing(pricing) {
  return JSON.parse(
    JSON.stringify({
      currency: pricing.currency || "USD",
      agreed_net_amount_cents: pricing.agreed_net_amount_cents || 0,
      adjustments: Array.isArray(pricing.adjustments) ? pricing.adjustments : [],
      payments: Array.isArray(pricing.payments) ? pricing.payments : [],
      summary: pricing.summary || {}
    })
  );
}

function formatDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function plusOneMonthDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < originalDay) {
    d.setDate(0);
  }
  return formatDateInput(d);
}

function setSelectValue(selectEl, rawValue) {
  if (!selectEl) return;
  const value = normalizeCurrencyCode(rawValue || "USD");
  const hasOption = Array.from(selectEl.options).some((option) => option.value === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
  selectEl.value = value;
}

function toEntries(obj) {
  return Object.entries(obj || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)
    }));
}

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  onSuccess: () => clearError(),
  connectionErrorMessage: "Could not connect to backend API."
});

async function fetchBookingMutation(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;

  try {
    const response = await fetch(resolveApiUrl(path), {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 409 && payload?.code === "BOOKING_HASH_MISMATCH" && payload?.booking) {
        state.booking = payload.booking;
        if (els.noteInput) els.noteInput.value = state.booking.notes || "";
        state.originalNote = String(state.booking.notes || "");
        renderBookingHeader();
        renderBookingData();
        renderActionControls();
        renderPricingPanel();
        renderOfferPanel();
        loadActivities();
        setStatus("The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.");
        clearError();
        return null;
      }
      const message = payload?.detail ? `${payload.error || "Request failed"}: ${payload.detail}` : payload.error || "Request failed";
      showError(message);
      return null;
    }

    clearError();
    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

function setStatus(message) {
  if (!els.actionStatus) return;
  els.actionStatus.textContent = message;
}

function clearStatus() {
  setStatus("");
}

async function loadAuthStatus() {
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      if (els.userLabel) els.userLabel.textContent = "";
      return;
    }
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    if (els.userLabel) {
      els.userLabel.textContent = user || "";
    }
    state.permissions = {
      canChangeAssignment: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER),
      canChangeStage: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF),
      canEditBooking: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF)
    };
  } catch {
    if (els.userLabel) els.userLabel.textContent = "";
    // leave defaults
  }
}

function hasAnyRole(...roles) {
  return roles.some((role) => state.roles.includes(role));
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = "";
  els.error.classList.remove("show");
}

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}
