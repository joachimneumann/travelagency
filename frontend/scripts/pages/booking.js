import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  BOOKING_PERSON_SCHEMA,
  GENERATED_BOOKING_STAGES as GENERATED_BOOKING_STAGE_LIST
} from "../../Generated/Models/generated_Booking.js";
import {
  bookingActivitiesRequest,
  bookingPersonCreateRequest,
  bookingPersonDeleteRequest,
  bookingPersonPhotoRequest,
  bookingPersonUpdateRequest,
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText,
  resolveApiUrl,
  setDirtySurface
} from "../shared/api.js";
import { createBookingPageLanguageController } from "./booking_page_language.js";
import { createBookingPageDataController } from "./booking_page_data.js";
import { resolveBackendSectionHref } from "../shared/nav.js";
import { createBookingWhatsAppController } from "../booking/whatsapp.js";
import { initializeBookingCollapsibles, renderBookingSegmentHeader } from "../booking/segment_headers.js";
import {
  createBookingPricingModule,
  populateCurrencySelect as populateCurrencySelectFromModule
} from "../booking/pricing.js";
import { createBookingOfferModule } from "../booking/offers.js";
import { createBookingTravelPlanModule } from "../booking/travel_plan.js";
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
import {
  bookingContentLang,
  normalizeBookingContentLang,
  setBookingContentLang
} from "../booking/i18n.js";

function backendT(id, fallback, vars) {
  if (typeof window.backendT === "function") {
    return window.backendT(id, fallback, vars);
  }
  const template = String(fallback ?? id);
  if (!vars || typeof vars !== "object") return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey in vars ? String(vars[normalizedKey]) : match;
  });
}

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const STAGES = GENERATED_BOOKING_STAGE_LIST;
const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
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
  contentLang: qs.has("content_lang") ? normalizeBookingContentLang(qs.get("content_lang") || "") : "",
  contentLangInitialized: qs.has("content_lang"),
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
  travelPlanDraft: {
    title: "",
    summary: "",
    days: [],
    offer_component_links: []
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

state.dirty = { note: false, persons: false, travel_plan: false, offer: false, payment_terms: false, pricing: false, invoice: false };
state.originalPricingSnapshot = "";
state.originalPersonsSnapshot = "";
state.originalTravelPlanSnapshot = "";
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
  personsPanelSummary: document.getElementById("persons_editor_panel_summary"),
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
  travelPlanSegmentLibraryModal: document.getElementById("travel_plan_segment_library_modal"),
  travelPlanSegmentLibraryCloseBtn: document.getElementById("travel_plan_segment_library_close_btn"),
  travelPlanSegmentLibrarySubtitle: document.getElementById("travel_plan_segment_library_subtitle"),
  travelPlanSegmentLibraryQuery: document.getElementById("travel_plan_segment_library_query"),
  travelPlanSegmentLibraryKind: document.getElementById("travel_plan_segment_library_kind"),
  travelPlanSegmentLibrarySearchBtn: document.getElementById("travel_plan_segment_library_search_btn"),
  travelPlanSegmentLibraryStatus: document.getElementById("travel_plan_segment_library_status"),
  travelPlanSegmentLibraryResults: document.getElementById("travel_plan_segment_library_results"),
  travelPlanSegmentImageInput: document.getElementById("travel_plan_segment_image_input"),
  personModalPreferredLanguage: document.getElementById("booking_person_modal_preferred_language"),
  personModalDateOfBirth: document.getElementById("booking_person_modal_date_of_birth"),
  personModalDateOfBirthPickerBtn: document.getElementById("booking_person_modal_date_of_birth_picker_btn"),
  personModalDateOfBirthPicker: document.getElementById("booking_person_modal_date_of_birth_picker"),
  personModalDateOfBirthError: document.getElementById("booking_person_modal_date_of_birth_error"),
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
  contentLanguageField: document.getElementById("booking_content_language_field"),
  contentLanguageMenuMount: document.getElementById("booking_content_language_menu_mount"),
  contentLanguageSelect: document.getElementById("booking_content_language_select"),
  stageSelect: document.getElementById("booking_stage_select"),
  noteInput: document.getElementById("booking_note_input"),
  noteSaveBtn: document.getElementById("booking_note_save_btn"),
  actionStatus: document.getElementById("booking_action_status"),
  travel_plan_panel: document.getElementById("travel_plan_panel"),
  travel_plan_panel_summary: document.getElementById("travel_plan_panel_summary"),
  travel_plan_editor: document.getElementById("travel_plan_editor"),
  travel_plan_save_btn: document.getElementById("travel_plan_save_btn"),
  travel_plan_status: document.getElementById("travel_plan_status"),
  pricing_panel: document.getElementById("pricing_panel"),
  pricingPanelSummary: document.getElementById("pricing_panel_summary"),
  pricing_summary_table: document.getElementById("pricing_summary_table"),
  pricing_currency_input: document.getElementById("pricing_currency_input"),
  pricing_agreed_net_label: document.getElementById("pricing_agreed_net_label"),
  pricing_agreed_net_input: document.getElementById("pricing_agreed_net_input"),
  pricing_adjustments_table: document.getElementById("pricing_adjustments_table"),
  pricing_payments_table: document.getElementById("pricing_payments_table"),
  pricing_save_btn: document.getElementById("pricing_save_btn"),
  pricing_status: document.getElementById("pricing_status"),
  offer_panel: document.getElementById("offer_panel"),
  offerPanelSummary: document.getElementById("offer_panel_summary"),
  offer_payment_terms_panel: document.getElementById("offer_payment_terms_panel"),
  offerPaymentTermsPanelSummary: document.getElementById("offer_payment_terms_panel_summary"),
  offer_acceptance_panel: document.getElementById("offer_acceptance_panel"),
  offerAcceptancePanelSummary: document.getElementById("offer_acceptance_panel_summary"),
  offer_currency_input: document.getElementById("offer_currency_input"),
  offer_currency_hint: document.getElementById("offer_currency_hint"),
  offer_components_table: document.getElementById("offer_components_table"),
  offer_payment_terms: document.getElementById("offer_payment_terms"),
  offer_quotation_summary: document.getElementById("offer_quotation_summary"),
  generated_offers_table: document.getElementById("generated_offers_table"),
  offer_generation_route_mode: document.getElementById("offer_generation_route_mode"),
  offer_payment_terms_notes: document.getElementById("offer_payment_terms_notes"),
  generate_offer_btn: document.getElementById("generate_offer_btn"),
  offer_status: document.getElementById("offer_status"),
  activities_table: document.getElementById("activities_table"),
  activitiesPanelSummary: document.getElementById("activities_panel_summary"),
  meta_chat_mount: document.getElementById("booking_whatsapp_mount"),
  invoice_panel: document.getElementById("invoice_panel"),
  invoice_select: document.getElementById("invoice_select"),
  invoice_number_input: document.getElementById("invoice_number_input"),
  invoice_currency_input: document.getElementById("invoice_currency_input"),
  invoice_issue_date_input: document.getElementById("invoice_issue_date_input"),
  invoice_issue_today_btn: document.getElementById("invoice_issue_today_btn"),
  invoice_due_date_input: document.getElementById("invoice_due_date_input"),
  invoice_due_month_btn: document.getElementById("invoice_due_month_btn"),
  invoice_title_field: document.getElementById("invoice_title_field"),
  invoice_title_input: document.getElementById("invoice_title_input"),
  invoice_components_field: document.getElementById("invoice_components_field"),
  invoice_components_input: document.getElementById("invoice_components_input"),
  invoice_due_amount_input: document.getElementById("invoice_due_amount_input"),
  invoice_due_amount_label: document.getElementById("invoice_due_amount_label"),
  invoice_components_label: document.getElementById("invoice_components_label"),
  invoice_vat_input: document.getElementById("invoice_vat_input"),
  invoice_notes_field: document.getElementById("invoice_notes_field"),
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
    travel_plan: els.travel_plan_panel,
    offer: els.offer_panel,
    payment_terms: els.offer_payment_terms_panel,
    offer_acceptance: els.offer_acceptance_panel,
    pricing: els.pricing_panel,
    invoice: els.invoice_panel
  };
  state.dirty[sectionKey] = Boolean(isDirty);
  setDirtySurface(sectionMap[sectionKey], state.dirty[sectionKey]);
}

function hasUnsavedBookingChanges() {
  return Object.values(state.dirty).some(Boolean);
}

const bookingLanguageController = createBookingPageLanguageController({
  state,
  els,
  apiOrigin,
  escapeHtml,
  backendT,
  getBookingRevision,
  hasUnsavedBookingChanges,
  showError,
  clearError,
  setStatus,
  loadBookingPage
});
const {
  handleContentLanguageChange,
  populateContentLanguageSelect,
  resolveSubmissionCustomerLanguage,
  syncContentLanguageSelector,
  updateContentLangInUrl,
  waitForBackendI18n,
  withBackendLang,
  withBookingContentLang
} = bookingLanguageController;

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
  const fallbackHref = normalizeText(els.back?.href) || withBackendLang("/backend.html", { section: "bookings" });
  window.location.href = fallbackHref;
}

function redirectToBackendLogin() {
  const returnTo = `${window.location.origin}${withBackendLang("/booking.html", {
    id: state.id,
    ...(state.contentLang ? { content_lang: state.contentLang } : {})
  })}`;
  const loginParams = new URLSearchParams({
    return_to: returnTo,
    prompt: "login"
  });
  window.location.href = `${apiBase}/auth/login?${loginParams.toString()}`;
}

async function init() {
  await waitForBackendI18n();
  if (state.contentLangInitialized && state.contentLang) {
    state.contentLang = setBookingContentLang(state.contentLang);
    updateContentLangInUrl(state.contentLang);
  } else {
    delete window.__BOOKING_CONTENT_LANG;
    delete document.documentElement.dataset.bookingContentLang;
  }
  const backHref = withBackendLang("/backend.html", { section: "bookings" });

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}${withBackendLang("/index.html")}`;
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

  initializeBookingCollapsibles(document);
  renderStaticSegmentHeaders();
  populateCurrencySelectFromModule(els.pricing_currency_input);
  populateCurrencySelectFromModule(els.offer_currency_input);
  populateCurrencySelectFromModule(els.invoice_currency_input);
  populateContentLanguageSelect();

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
  if (els.contentLanguageSelect) els.contentLanguageSelect.addEventListener("change", () => {
    void handleContentLanguageChange();
  });
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
  personsModule.bindEvents();
  travelPlanModule.bindEvents();
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
    showError(backendT("booking.error.missing_record_id", "Missing record id."));
    return;
  }

  await loadAuthStatus();

  await loadBookingPage();
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
  return bookingPageDataController.loadBookingPage();
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
  travelPlanModule.applyBookingPayload();
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
    [backendT("booking.name", "Name"), contact.name],
    [backendT("booking.email", "Email"), contact.emails?.[0] || contact.email],
    [backendT("booking.phone", "Phone"), contact.phone_numbers?.[0] || contact.phone_number],
    [backendT("booking.roles", "Roles"), Array.isArray(contact.roles) && contact.roles.length ? contact.roles.join(", ") : null]
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({ key, value: String(value) }));
}

function buildPersonEntries(persons) {
  return (Array.isArray(persons) ? persons : []).map((person, index) => {
    const summaryParts = [];
    if (person.roles.length) summaryParts.push(backendT("booking.person_summary.roles", "Roles: {value}", { value: person.roles.join(", ") }));
    if (person.emails.length) summaryParts.push(backendT("booking.person_summary.email", "Email: {value}", { value: person.emails.join(", ") }));
    if (person.phone_numbers.length) summaryParts.push(backendT("booking.person_summary.phone", "Phone: {value}", { value: person.phone_numbers.join(", ") }));
    if (person.date_of_birth) summaryParts.push(backendT("booking.person_summary.born", "Born: {value}", { value: person.date_of_birth }));
    if (person.nationality) summaryParts.push(backendT("booking.person_summary.nationality", "Nationality: {value}", { value: person.nationality }));
    if (person.address?.country_code || person.address?.city || person.address?.street_address) {
      summaryParts.push(backendT("booking.person_summary.address", "Address: {value}", { value: formatPersonAddress(person.address) }));
    }
    if (Array.isArray(person.documents) && person.documents.length) summaryParts.push(backendT("booking.person_summary.documents", "Documents: {count}", { count: person.documents.length }));
    if (Array.isArray(person.consents) && person.consents.length) summaryParts.push(backendT("booking.person_summary.consents", "Consents: {count}", { count: person.consents.length }));
    if (person.photo_ref) summaryParts.push(backendT("booking.person_summary.photo_attached", "Photo attached"));
    return {
      key: `${index + 1}. ${person.name}`,
      value: summaryParts.join(" | ") || backendT("booking.no_details", "No details")
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
  const header = `<thead><tr><th>${escapeHtml(backendT("booking.activity_time", "Time"))}</th><th>${escapeHtml(backendT("booking.activity_type", "Type"))}</th><th>${escapeHtml(backendT("booking.activity_actor", "Actor"))}</th><th>${escapeHtml(backendT("booking.activity_detail", "Detail"))}</th></tr></thead>`;
  const body = rows || `<tr><td colspan="4">${escapeHtml(backendT("booking.no_activities", "No activities yet."))}</td></tr>`;
  els.activities_table.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderStaticSegmentHeaders() {
  renderBookingSegmentHeader(els.personsPanelSummary, { primary: backendT("booking.no_persons", "No persons listed.") });
  renderBookingSegmentHeader(els.travel_plan_panel_summary, {
    primary: backendT("booking.travel_plan", "Travel plan"),
    secondary: backendT("booking.no_travel_plan", "No travel plan yet.")
  });
  renderBookingSegmentHeader(els.offerPanelSummary, { primary: backendT("booking.offer", "Offer") });
  renderBookingSegmentHeader(els.offerPaymentTermsPanelSummary, { primary: backendT("booking.payment_terms", "Payment terms") });
  renderBookingSegmentHeader(els.offerAcceptancePanelSummary, {
    primary: backendT("booking.offer_acceptance", "Offer acceptance"),
    secondary: backendT("booking.offer_acceptance_none", "No generated offers yet.")
  });
  renderBookingSegmentHeader(els.pricingPanelSummary, { primary: backendT("booking.payments", "Payments") });
  renderBookingSegmentHeader(els.activitiesPanelSummary, { primary: backendT("booking.activities", "Activities") });
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
  return offerModule.renderOfferPanel();
}

function renderTravelPlanPanel() {
  return travelPlanModule.renderTravelPlanPanel();
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

function addOfferComponent() {
  return offerModule.addOfferComponent();
}

function handleOfferCurrencyChange() {
  return offerModule.handleOfferCurrencyChange();
}

function saveOffer() {
  return offerModule.saveOffer();
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
  onError: (message, _payload, response) => {
    if (response?.status === 401) {
      redirectToBackendLogin();
      return;
    }
    showError(message);
  },
  onSuccess: () => clearError(),
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

const pricingModule = createBookingPricingModule({
  state,
  els,
  apiOrigin,
  fetchBookingMutation,
  renderBookingHeader,
  renderBookingData,
  loadActivities,
  escapeHtml,
  captureControlSnapshot,
  setBookingSectionDirty
});

const travelPlanModule = createBookingTravelPlanModule({
  state,
  els,
  apiOrigin,
  fetchBookingMutation,
  getBookingRevision,
  renderBookingHeader,
  renderBookingData,
  renderTravelPlanPanel,
  loadActivities,
  escapeHtml,
  setBookingSectionDirty
});

const offerModule = createBookingOfferModule({
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

const bookingPageDataController = createBookingPageDataController({
  state,
  els,
  apiBase,
  apiOrigin,
  roles: ROLES,
  backendT,
  normalizeBookingContentLang,
  redirectToBackendLogin,
  fetchApi,
  showError,
  clearError,
  clearStatus,
  setStatus,
  resolveSubmissionCustomerLanguage,
  updateContentLangInUrl,
  syncContentLanguageSelector,
  withBookingContentLang,
  applyBookingPayload,
  renderBookingHeader,
  renderBookingData,
  renderActionControls,
  renderPersonsEditor,
  renderPricingPanel,
  renderTravelPlanPanel,
  renderOfferPanel,
  loadActivities,
  loadInvoices,
  ensureTourImageLoaded,
  bookingWhatsAppRef: () => bookingWhatsApp
});

void init().catch((error) => {
  console.error(error);
  showError(backendT("booking.error.load", "Could not load booking."));
  setStatus(backendT("booking.error.load", "Could not load booking."));
});

async function fetchBookingMutation(path, options = {}) {
  return bookingPageDataController.fetchBookingMutation(path, options);
}

function setStatus(message) {
  if (!els.actionStatus) return;
  els.actionStatus.textContent = message;
}

function clearStatus() {
  setStatus("");
}

async function loadAuthStatus() {
  return bookingPageDataController.loadAuthStatus();
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
