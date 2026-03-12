import { GENERATED_ATP_STAFF_ROLES } from "../../Generated/Models/generated_ATPStaff.js";
import { GENERATED_LANGUAGE_CODES } from "../../Generated/Models/generated_Language.js";
import {
  BOOKING_PERSON_SCHEMA,
  GENERATED_BOOKING_STAGES as GENERATED_BOOKING_STAGE_LIST
} from "../../Generated/Models/generated_Booking.js";
import {
  bookingActivitiesRequest,
  bookingDetailRequest,
  bookingPersonCreateRequest,
  bookingPersonDeleteRequest,
  bookingPersonPhotoRequest,
  bookingPersonUpdateRequest,
  keycloakUsersRequest,
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText,
  resolveApiUrl,
  setDirtySurface
} from "../shared/api.js";
import { resolveBackendSectionHref } from "../shared/nav.js";
import { createBookingWhatsAppController } from "../booking/whatsapp.js";
import {
  createBookingPricingModule,
  populateCurrencySelect as populateCurrencySelectFromModule,
  populateOfferCategorySelect as populateOfferCategorySelectFromModule
} from "../booking/pricing.js";
import {
  createBookingInvoicesModule,
  formatDateInput as formatInvoiceDateInput,
  plusOneMonthDateInput as plusOneMonthInvoiceDateInput
} from "../booking/invoices.js";
import { createBookingCoreModule } from "../booking/core.js";
import {
  formatPersonRoleLabel,
  getPersonFooterRoleLabel,
  getPersonPrimaryRoleLabel,
} from "../booking/person_helpers.js";
import { createBookingPersonsModule } from "../booking/persons.js";
import {
  getBookingPersons,
  getPersonInitials,
  getRepresentativeTraveler,
  isTravelingPerson,
  normalizeStringList
} from "../shared/booking_persons.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const STAGES = GENERATED_BOOKING_STAGE_LIST;
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

const BOOKING_PERSON_ROLE_OPTIONS = Object.freeze(
  (BOOKING_PERSON_SCHEMA.fields.find((field) => field.name === "roles")?.options || []).map((option) => option.value)
);
const state = {
  id: qs.get("id") || "",
  user: "",
  authUser: null,
  roles: [],
  permissions: {
    canChangeAssignment: false,
    canReadAssignmentDirectory: false,
    canChangeStage: false,
    canEditBooking: false
  },
  booking: null,
  tour_image: "",
  tour_image_tour_id: "",
  personDrafts: [],
  active_person_index: -1,
  active_person_id: "",
  active_person_document_type: "passport",
  keycloakUsers: [],
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
  persons_autosave_timer: null,
  persons_autosave_person_id: "",
  persons_save_in_flight: null,
  persons_save_queued: false
};

state.dirty = { note: false, persons: false, offer: false, pricing: false, invoice: false };
state.originalPricingSnapshot = "";
state.originalPersonsSnapshot = "";
state.originalInvoiceSnapshot = "";

let bookingWhatsApp = null;

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),
  userLabel: document.getElementById("backendUserLabel"),
  title: document.getElementById("detail_title"),
  titleInput: document.getElementById("detail_title_input"),
  titleEditBtn: document.getElementById("detail_title_edit_btn"),
  subtitle: document.getElementById("detail_sub_title"),
  heroPhotoBtn: document.getElementById("booking_hero_photo_btn"),
  heroPhotoInput: document.getElementById("booking_hero_photo_input"),
  heroImage: document.getElementById("booking_hero_image"),
  heroInitials: document.getElementById("booking_hero_initials"),
  heroCopyBtn: document.getElementById("booking_hero_copy_btn"),
  heroCopyStatus: document.getElementById("booking_hero_copy_status"),
  deleteBtn: document.getElementById("booking_delete_btn"),
  error: document.getElementById("detail_error"),
  booking_data_view: document.getElementById("booking_data_view"),
  actionsPanel: document.getElementById("booking_actions_panel"),
  persons_editor_panel: document.getElementById("persons_editor_panel"),
  personsEditorList: document.getElementById("booking_persons_editor_list"),
  personsEditorStatus: document.getElementById("booking_persons_editor_status"),
  personsMismatchWarning: document.getElementById("booking_persons_mismatch_warning"),
  personModal: document.getElementById("booking_person_modal"),
  personModalSubtitle: document.getElementById("booking_person_modal_subtitle"),
  personModalCloseBtn: document.getElementById("booking_person_modal_close_btn"),
  personModalAvatarBtn: document.getElementById("booking_person_modal_avatar_btn"),
  personModalPhoto: document.getElementById("booking_person_modal_photo"),
  personModalInitials: document.getElementById("booking_person_modal_initials"),
  personModalName: document.getElementById("booking_person_modal_name"),
  personModalPhotoInput: document.getElementById("booking_person_modal_photo_input"),
  personModalDeleteBtn: document.getElementById("booking_person_modal_delete_btn"),
  personModalPreferredLanguage: document.getElementById("booking_person_modal_preferred_language"),
  personModalDateOfBirth: document.getElementById("booking_person_modal_date_of_birth"),
  personModalNationality: document.getElementById("booking_person_modal_nationality"),
  personModalEmails: document.getElementById("booking_person_modal_emails"),
  personModalPhoneNumbers: document.getElementById("booking_person_modal_phone_numbers"),
  personModalRoles: document.getElementById("booking_person_modal_roles"),
  personModalAddressLine1: document.getElementById("booking_person_modal_address_line_1"),
  personModalAddressLine2: document.getElementById("booking_person_modal_address_line_2"),
  personModalCity: document.getElementById("booking_person_modal_city"),
  personModalStateRegion: document.getElementById("booking_person_modal_state_region"),
  personModalPostalCode: document.getElementById("booking_person_modal_postal_code"),
  personModalCountryCode: document.getElementById("booking_person_modal_country_code"),
  personModalNotes: document.getElementById("booking_person_modal_notes"),
  ownerSelect: document.getElementById("booking_owner_select"),
  stageSelect: document.getElementById("booking_stage_select"),
  noteInput: document.getElementById("booking_note_input"),
  noteSaveBtn: document.getElementById("booking_note_save_btn"),
  actionStatus: document.getElementById("booking_action_status"),
  pricing_panel: document.getElementById("pricing_panel"),
  pricing_summary_table: document.getElementById("pricing_summary_table"),
  pricing_currency_input: document.getElementById("pricing_currency_input"),
  pricing_agreed_net_label: document.getElementById("pricing_agreed_net_label"),
  pricing_agreed_net_input: document.getElementById("pricing_agreed_net_input"),
  pricing_adjustments_table: document.getElementById("pricing_adjustments_table"),
  pricing_payments_table: document.getElementById("pricing_payments_table"),
  pricing_save_btn: document.getElementById("pricing_save_btn"),
  pricing_status: document.getElementById("pricing_status"),
  offer_panel: document.getElementById("offer_panel"),
  offer_currency_input: document.getElementById("offer_currency_input"),
  offer_component_category_select: document.getElementById("offer_component_category_select"),
  offer_add_component_btn: document.getElementById("offer_add_component_btn"),
  offer_components_table: document.getElementById("offer_components_table"),
  offer_components_total_table: document.getElementById("offer_components_total_table"),
  offer_save_btn: document.getElementById("offer_save_btn"),
  offer_status: document.getElementById("offer_status"),
  activities_table: document.getElementById("activities_table"),
  meta_chat_mount: document.getElementById("booking_whatsapp_mount"),
  invoice_panel: document.getElementById("invoice_panel"),
  invoice_select: document.getElementById("invoice_select"),
  invoice_number_input: document.getElementById("invoice_number_input"),
  invoice_currency_input: document.getElementById("invoice_currency_input"),
  invoice_issue_date_input: document.getElementById("invoice_issue_date_input"),
  invoice_issue_today_btn: document.getElementById("invoice_issue_today_btn"),
  invoice_due_date_input: document.getElementById("invoice_due_date_input"),
  invoice_due_month_btn: document.getElementById("invoice_due_month_btn"),
  invoice_title_input: document.getElementById("invoice_title_input"),
  invoice_components_input: document.getElementById("invoice_components_input"),
  invoice_due_amount_input: document.getElementById("invoice_due_amount_input"),
  invoice_due_amount_label: document.getElementById("invoice_due_amount_label"),
  invoice_components_label: document.getElementById("invoice_components_label"),
  invoice_vat_input: document.getElementById("invoice_vat_input"),
  invoice_notes_input: document.getElementById("invoice_notes_input"),
  invoice_create_btn: document.getElementById("invoice_create_btn"),
  invoice_status: document.getElementById("invoice_status"),
  invoices_table: document.getElementById("invoices_table")
};

const PERSON_MODAL_AUTOFILL_CONFIG = Object.freeze({
  booking_person_modal_passport_holder_name_autofill: { document_type: "passport", field: "holder_name", source: "name" },
  booking_person_modal_passport_issuing_country_autofill: { document_type: "passport", field: "issuing_country", source: "nationality" },
  booking_person_modal_national_id_holder_name_autofill: { document_type: "national_id", field: "holder_name", source: "name" },
  booking_person_modal_national_id_issuing_country_autofill: { document_type: "national_id", field: "issuing_country", source: "nationality" }
});

function setBookingSectionDirty(sectionKey, isDirty) {
  const sectionMap = {
    note: els.actionsPanel,
    persons: els.persons_editor_panel,
    offer: els.offer_panel,
    pricing: els.pricing_panel,
    invoice: els.invoice_panel
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

window.addEventListener("beforeunload", () => {
  bookingWhatsApp?.stopAutoRefresh();
});

function closeBookingDetailScreen() {
  const fallbackHref = normalizeText(els.back?.href) || "backend.html";
  window.location.href = fallbackHref;
}

async function init() {
  const backHref = "backend.html";

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  if (!bookingWhatsApp && els.meta_chat_mount) {
    bookingWhatsApp = createBookingWhatsAppController({
      apiOrigin,
      fetchApi,
      getBookingPersons,
      formatPersonRoleLabel,
      getPersonInitials,
      resolvePersonPhotoSrc,
      onNotice: setStatus
    });
    bookingWhatsApp.mount(els.meta_chat_mount);
  }

  populateCurrencySelectFromModule(els.pricing_currency_input);
  populateCurrencySelectFromModule(els.offer_currency_input);
  populateCurrencySelectFromModule(els.invoice_currency_input);
  populateOfferCategorySelectFromModule(els.offer_component_category_select, escapeHtml);

  if (els.heroCopyBtn) els.heroCopyBtn.addEventListener("click", copyHeroIdToClipboard);
  if (els.heroPhotoBtn) els.heroPhotoBtn.addEventListener("click", triggerBookingPhotoPicker);
  if (els.heroPhotoInput) {
    els.heroPhotoInput.addEventListener("change", async () => {
      await uploadBookingPhoto();
    });
  }
  if (els.back) els.back.addEventListener("click", closeBookingDetailScreen);
  if (els.titleEditBtn) els.titleEditBtn.addEventListener("click", startBookingTitleEdit);
  if (els.titleInput) {
    els.titleInput.addEventListener("keydown", handleBookingTitleInputKeydown);
    els.titleInput.addEventListener("blur", () => {
      void commitBookingTitleEdit();
    });
  }
  if (els.ownerSelect) els.ownerSelect.addEventListener("change", saveOwner);
  if (els.stageSelect) els.stageSelect.addEventListener("change", saveStage);
  if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteBooking);
  if (els.noteInput) els.noteInput.addEventListener("input", updateNoteSaveButtonState);
  if (els.noteSaveBtn) els.noteSaveBtn.addEventListener("click", saveNote);
  if (els.pricing_panel) {
    const schedulePricingDirtyState = () => window.setTimeout(updatePricingDirtyState, 0);
    els.pricing_panel.addEventListener("input", schedulePricingDirtyState);
    els.pricing_panel.addEventListener("change", schedulePricingDirtyState);
    els.pricing_panel.addEventListener("click", (event) => {
      if (event.target.closest("button")) schedulePricingDirtyState();
    });
  }
  if (els.pricing_save_btn) els.pricing_save_btn.addEventListener("click", savePricing);
  if (els.offer_currency_input)
    els.offer_currency_input.addEventListener("change", () => {
      void handleOfferCurrencyChange();
    });
  if (els.offer_add_component_btn) els.offer_add_component_btn.addEventListener("click", addOfferComponentFromSelector);
  if (els.offer_save_btn) els.offer_save_btn.addEventListener("click", saveOffer);
  personsModule.bindEvents();
  document.addEventListener("keydown", handleBookingDetailKeydown, true);
  if (els.invoice_select) els.invoice_select.addEventListener("change", onInvoiceSelectChange);
  if (els.invoice_panel) {
    const scheduleInvoiceDirtyState = () => window.setTimeout(updateInvoiceDirtyState, 0);
    els.invoice_panel.addEventListener("input", scheduleInvoiceDirtyState);
    els.invoice_panel.addEventListener("change", scheduleInvoiceDirtyState);
  }
  if (els.invoice_currency_input) els.invoice_currency_input.addEventListener("change", renderInvoiceMoneyLabels);
  if (els.invoice_create_btn) els.invoice_create_btn.addEventListener("click", createInvoice);
  if (els.invoice_issue_today_btn) {
    els.invoice_issue_today_btn.addEventListener("click", () => {
      if (els.invoice_issue_date_input) els.invoice_issue_date_input.value = formatInvoiceDateInput(new Date());
    });
  }
  if (els.invoice_due_month_btn) {
    els.invoice_due_month_btn.addEventListener("click", () => {
      if (els.invoice_due_date_input) els.invoice_due_date_input.value = plusOneMonthInvoiceDateInput(new Date());
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
  const requests = [
    fetchApi(bookingDetailRequest({ baseURL: apiOrigin, params: { booking_id: state.id } }).url),
    state.permissions.canReadAssignmentDirectory
      ? fetchApi(keycloakUsersRequest({ baseURL: apiOrigin }).url, { suppressNotFound: true })
      : Promise.resolve(null)
  ];
  const [bookingPayload, usersPayload] = await Promise.all(requests);
  if (!bookingPayload) return;

  applyBookingPayload(bookingPayload);
  state.keycloakUsers = Array.isArray(usersPayload?.items) ? usersPayload.items : [];
  await ensureTourImageLoaded();

  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPersonsEditor();
  renderPricingPanel();
  renderOfferPanel();
  await loadActivities();
  await bookingWhatsApp?.load(state.booking);
  await loadInvoices();
  bookingWhatsApp?.startAutoRefresh(() => state.booking);
}

function renderBookingHeader() {
  return coreModule.renderBookingHeader();
}

function resolvePersonPhotoSrc(photoRef) {
  const imagePath = normalizeText(photoRef) || "assets/img/profile_person.png";
  return /^assets\//.test(imagePath) ? imagePath : resolveApiUrl(apiBase, imagePath);
}

function resolveBookingImageSrc(imageRef) {
  const imagePath = normalizeText(imageRef) || "assets/img/profile_person.png";
  return /^assets\//.test(imagePath) ? imagePath : resolveApiUrl(apiBase, imagePath);
}

function copyHeroIdToClipboard() {
  return coreModule.copyHeroIdToClipboard();
}

function renderBookingData() {
  return coreModule.renderBookingData();
}

function renderActionControls() {
  return coreModule.renderActionControls();
}

function applyBookingPayload(payload = {}) {
  coreModule.applyBookingPayload(payload);
  personsModule.applyBookingPayload();
}

async function ensureTourImageLoaded() {
  return coreModule.ensureTourImageLoaded();
}

function getBookingRevision(field) {
  const value = Number(state.booking?.[field]);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}
function handleBookingDetailKeydown(event) {
  return coreModule.handleBookingDetailKeydown(event);
}

function triggerBookingPhotoPicker() {
  return coreModule.triggerBookingPhotoPicker();
}

async function uploadBookingPhoto() {
  return coreModule.uploadBookingPhoto();
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

function updateNoteSaveButtonState() {
  return coreModule.updateNoteSaveButtonState();
}

async function saveOwner() {
  return coreModule.saveOwner();
}

async function saveStage() {
  return coreModule.saveStage();
}

async function saveNote() {
  return coreModule.saveNote();
}

function startBookingTitleEdit() {
  return coreModule.startBookingTitleEdit();
}

function commitBookingTitleEdit() {
  return coreModule.commitBookingTitleEdit();
}

function handleBookingTitleInputKeydown(event) {
  return coreModule.handleBookingTitleInputKeydown(event);
}

function deleteBooking() {
  return coreModule.deleteBooking();
}

function renderPersonsEditor(options) {
  return personsModule.renderPersonsEditor(options);
}

function closePersonModal() {
  return personsModule.closePersonModal();
}

function renderActivitiesTable(items = []) {
  if (!els.activities_table) return;
  const rows = (Array.isArray(items) ? items : [])
    .map((activity) => `
      <tr>
        <td>${escapeHtml(formatDateTime(activity.created_at || ""))}</td>
        <td>${escapeHtml(normalizeText(activity.type) || "-")}</td>
        <td>${escapeHtml(normalizeText(activity.actor) || "-")}</td>
        <td>${escapeHtml(normalizeText(activity.detail) || "-")}</td>
      </tr>
    `)
    .join("");
  const header = "<thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th></tr></thead>";
  const body = rows || '<tr><td colspan="4">No activities yet.</td></tr>';
  els.activities_table.innerHTML = `${header}<tbody>${body}</tbody>`;
}

async function loadActivities() {
  if (!state.booking?.id || !els.activities_table) return;
  const request = bookingActivitiesRequest({
    baseURL: apiOrigin,
    params: { booking_id: state.booking.id }
  });
  const payload = await fetchApi(request.url, { suppressNotFound: true });
  renderActivitiesTable(Array.isArray(payload?.items) ? payload.items : payload?.activities);
}

function renderPricingPanel() {
  return pricingModule.renderPricingPanel();
}

function renderOfferPanel() {
  return pricingModule.renderOfferPanel();
}

function updateInvoiceDirtyState() {
  return invoicesModule.updateInvoiceDirtyState();
}

function renderInvoiceMoneyLabels() {
  return invoicesModule.renderInvoiceMoneyLabels();
}

function loadInvoices() {
  return invoicesModule.loadInvoices();
}

function onInvoiceSelectChange() {
  return invoicesModule.onInvoiceSelectChange();
}

function createInvoice() {
  return invoicesModule.createInvoice();
}

function savePricing() {
  return pricingModule.savePricing();
}

function addOfferComponentFromSelector() {
  return pricingModule.addOfferComponentFromSelector();
}

function handleOfferCurrencyChange() {
  return pricingModule.handleOfferCurrencyChange();
}

function saveOffer() {
  return pricingModule.saveOffer();
}

function updatePricingDirtyState() {
  return pricingModule.updatePricingDirtyState();
}

function markPricingSnapshotClean() {
  return pricingModule.markPricingSnapshotClean();
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

const pricingModule = createBookingPricingModule({
  state,
  els,
  apiOrigin,
  fetchApi,
  fetchBookingMutation,
  getBookingRevision,
  renderBookingHeader,
  renderBookingData,
  loadActivities,
  escapeHtml,
  captureControlSnapshot,
  setBookingSectionDirty
});

const invoicesModule = createBookingInvoicesModule({
  state,
  els,
  apiBase,
  apiOrigin,
  fetchApi,
  fetchBookingMutation,
  getBookingRevision,
  renderBookingHeader,
  renderBookingData,
  renderOfferPanel,
  renderPricingPanel,
  escapeHtml,
  formatDateTime,
  captureControlSnapshot,
  setBookingSectionDirty
});

const personsModule = createBookingPersonsModule({
  state,
  els,
  apiOrigin,
  bookingId: state.id,
  bookingPersonRoleOptions: BOOKING_PERSON_ROLE_OPTIONS,
  personModalAutofillConfig: PERSON_MODAL_AUTOFILL_CONFIG,
  escapeHtml,
  normalizeText,
  resolvePersonPhotoSrc,
  fetchBookingMutation,
  getBookingRevision,
  renderBookingHeader,
  renderBookingData,
  renderActionControls,
  setBookingSectionDirty
});

const coreModule = createBookingCoreModule({
  state,
  els,
  stages: STAGES,
  apiBase,
  apiOrigin,
  fetchApi,
  fetchBookingMutation,
  getBookingRevision,
  getBookingPersons,
  getRepresentativeTraveler,
  getPersonInitials,
  normalizeText,
  escapeHtml,
  formatDateTime,
  resolveApiUrl,
  resolvePersonPhotoSrc,
  resolveBookingImageSrc,
  displayKeycloakUser,
  resolveCurrentAuthKeycloakUser,
  setBookingSectionDirty,
  rerenderWhatsApp: (booking) => bookingWhatsApp?.rerender(booking),
  renderPersonsEditor: (...args) => personsModule.renderPersonsEditor(...args)
});

init();

function getConflictReloadInstruction() {
  const userAgent = String(window.navigator.userAgent || "");
  const platform = String(window.navigator.platform || "");
  const touchPoints = Number(window.navigator.maxTouchPoints || 0);
  const isIPhone = /iPhone/i.test(userAgent);
  const isIPad = /iPad/i.test(userAgent) || (/Mac/i.test(platform) && touchPoints > 1);
  const isIOS = isIPhone || isIPad;
  if (isIOS) {
    return "Reload this page in Safari by tapping the reload button in the address bar.";
  }
  if (/Android/i.test(userAgent)) {
    return "Reload this page in your browser by tapping the reload button in the toolbar.";
  }
  if (/Mac/i.test(platform)) {
    return "Reload this page with Command-R.";
  }
  if (/Win/i.test(platform)) {
    return "Reload this page with Ctrl-R or F5.";
  }
  return "Reload this page in your browser.";
}

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
      if (response.status === 409 && payload?.code === "BOOKING_REVISION_MISMATCH" && payload?.booking) {
        const instruction = getConflictReloadInstruction();
        showError(`This booking was changed on another device. Please reload before editing again. ${instruction}`);
        setStatus("This booking was changed in the backend. Reload required.");
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
      state.authUser = null;
      if (els.userLabel) els.userLabel.textContent = "";
      return;
    }
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    state.authUser = payload.user || null;
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    state.user = user || "";
    if (els.userLabel) {
      els.userLabel.textContent = user || "";
    }
    state.permissions = {
      canChangeAssignment: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER),
      canReadAssignmentDirectory: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT),
      canChangeStage: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF),
      canEditBooking: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF)
    };
  } catch {
    state.user = "";
    state.authUser = null;
    if (els.userLabel) els.userLabel.textContent = "";
    // leave defaults
  }
}

function displayKeycloakUser(user) {
  if (!user || typeof user !== "object") return "";
  return normalizeText(user.name) || normalizeText(user.username) || normalizeText(user.id) || "";
}

function resolveCurrentAuthKeycloakUser(expectedId = "") {
  const authUserId = normalizeText(state.authUser?.sub);
  if (!authUserId) return null;
  if (expectedId && authUserId !== normalizeText(expectedId)) return null;
  return {
    id: authUserId,
    name: normalizeText(state.authUser?.name) || null,
    username: normalizeText(state.authUser?.preferred_username) || null
  };
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
