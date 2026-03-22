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
  logBrowserConsoleError,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { createBookingPageLanguageController } from "./booking_page_language.js";
import { createBookingPageDataController } from "./booking_page_data.js";
import { resolveBackendSectionHref } from "../shared/nav.js";
import { createBookingWhatsAppController } from "../booking/whatsapp.js";
import { initializeBookingSections, renderBookingSectionHeader } from "../booking/sections.js";
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
  }
};

state.dirty = { core: false, note: false, persons: false, travel_plan: false, offer: false, payment_terms: false, pricing: false, invoice: false };
state.originalTravelPlanSnapshot = "";
state.originalInvoiceSnapshot = "";
state.pageSaveInFlight = false;
state.pageDiscardInFlight = false;
state.pageDirtyBarStatus = "";
state.pageSaveActionError = "";

let bookingWhatsApp = null;

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  dirtyBar: document.getElementById("booking_dirty_bar"),
  dirtyBarTitle: document.getElementById("booking_dirty_bar_title"),
  dirtyBarSummary: document.getElementById("booking_dirty_bar_summary"),
  discardEditsBtn: document.getElementById("booking_discard_edits_btn"),
  saveEditsBtn: document.getElementById("booking_save_edits_btn"),
  saveErrorHint: document.getElementById("booking_save_error_hint"),
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
  notePanel: document.getElementById("booking_note_panel"),
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
  personModalPublicActionsMount: document.getElementById("booking_person_modal_public_actions_mount"),
  personModalDeleteBtn: document.getElementById("booking_person_modal_delete_btn"),
  travelPlanItemLibraryModal: document.getElementById("travel_plan_item_library_modal"),
  travelPlanItemLibraryCloseBtn: document.getElementById("travel_plan_item_library_close_btn"),
  travelPlanItemLibrarySubtitle: document.getElementById("travel_plan_item_library_subtitle"),
  travelPlanItemLibraryQuery: document.getElementById("travel_plan_item_library_query"),
  travelPlanItemLibraryKind: document.getElementById("travel_plan_item_library_kind"),
  travelPlanItemLibrarySearchBtn: document.getElementById("travel_plan_item_library_search_btn"),
  travelPlanItemLibraryStatus: document.getElementById("travel_plan_item_library_status"),
  travelPlanItemLibraryResults: document.getElementById("travel_plan_item_library_results"),
  travelPlanImagePreviewModal: document.getElementById("travel_plan_image_preview_modal"),
  travelPlanImagePreviewCloseBtn: document.getElementById("travel_plan_image_preview_close_btn"),
  travelPlanImagePreviewImage: document.getElementById("travel_plan_image_preview_image"),
  travelPlanItemImageInput: document.getElementById("travel_plan_item_image_input"),
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
  actionStatus: document.getElementById("booking_action_status"),
  travel_plan_panel: document.getElementById("travel_plan_panel"),
  travel_plan_panel_summary: document.getElementById("travel_plan_panel_summary"),
  travel_plan_editor: document.getElementById("travel_plan_editor"),
  travel_plan_status: document.getElementById("travel_plan_status"),
  pricing_panel: document.getElementById("pricing_panel"),
  pricingPanelSummary: document.getElementById("pricing_panel_summary"),
  pricing_summary_table: document.getElementById("pricing_summary_table"),
  pricing_currency_input: document.getElementById("pricing_currency_input"),
  pricing_agreed_net_label: document.getElementById("pricing_agreed_net_label"),
  pricing_agreed_net_input: document.getElementById("pricing_agreed_net_input"),
  pricing_adjustments_table: document.getElementById("pricing_adjustments_table"),
  pricing_payments_table: document.getElementById("pricing_payments_table"),
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
  generateOfferDirtyHint: document.getElementById("generate_offer_dirty_hint"),
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
  state.dirty[sectionKey] = Boolean(isDirty);
  if (hasUnsavedBookingChanges()) {
    state.pageDirtyBarStatus = "";
  }
  state.pageSaveActionError = "";
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
}

function hasUnsavedBookingChanges() {
  return Object.values(state.dirty).some(Boolean);
}

function dirtySectionLabels() {
  const labels = [];
  const pushLabel = (label) => {
    if (label && !labels.includes(label)) labels.push(label);
  };
  if (state.dirty.core) pushLabel(backendT("booking.dirty.core", "Booking details"));
  if (state.dirty.note) pushLabel(backendT("booking.dirty.note", "Notes"));
  if (state.dirty.persons) pushLabel(backendT("booking.dirty.persons", "Persons"));
  if (state.dirty.offer || state.dirty.payment_terms) pushLabel(backendT("booking.dirty.offer", "Offer"));
  if (state.dirty.travel_plan) pushLabel(backendT("booking.dirty.travel_plan", "Travel plan"));
  if (state.dirty.pricing) pushLabel(backendT("booking.dirty.pricing", "Payments"));
  if (state.dirty.invoice) pushLabel(backendT("booking.dirty.invoice", "Invoice"));
  return labels;
}

function updatePageDirtyBar() {
  if (!els.dirtyBar || !els.dirtyBarSummary || !els.saveEditsBtn || !els.discardEditsBtn) return;
  const labels = dirtySectionLabels();
  const isDirty = labels.length > 0;
  const isSaving = state.pageSaveInFlight;
  const isDiscarding = state.pageDiscardInFlight;
  const isBusy = isSaving || isDiscarding;
  els.dirtyBar.classList.toggle("booking-dirty-bar--dirty", isDirty);
  els.dirtyBar.hidden = false;
  if (els.dirtyBarTitle) {
    if (isSaving) {
      els.dirtyBarTitle.textContent = backendT("booking.page_save.saving", "Saving edits...");
    } else if (isDiscarding) {
      els.dirtyBarTitle.textContent = backendT("booking.page_discard.running", "Discarding edits...");
    } else if (isDirty) {
      els.dirtyBarTitle.textContent = backendT("booking.page_save.unsaved", "Unsaved edits");
    } else if (state.pageDirtyBarStatus === "saved") {
      els.dirtyBarTitle.textContent = backendT("booking.page_save.saved", "All edits saved");
    } else if (state.pageDirtyBarStatus === "discarded") {
      els.dirtyBarTitle.textContent = backendT("booking.page_discard.saved", "All edits reverted");
    } else {
      els.dirtyBarTitle.textContent = backendT("booking.page_save.clean", "No unsaved edits");
    }
  }
  els.dirtyBarSummary.textContent = isDirty
    ? backendT("booking.page_save.summary", "Changed sections: {sections}", { sections: labels.join(", ") })
    : "";
  if (els.saveErrorHint) {
    els.saveErrorHint.textContent = state.pageSaveActionError || "";
  }
  els.saveEditsBtn.disabled = isBusy || !isDirty;
  els.discardEditsBtn.disabled = isBusy || !isDirty;
}

function cleanStateBlockMessage() {
  return backendT("booking.action_requires_save", "Save edits to enable.");
}

function updateCleanStateActionAvailability() {
  const blocked = hasUnsavedBookingChanges() || state.pageSaveInFlight || state.pageDiscardInFlight;
  const message = cleanStateBlockMessage();
  document.querySelectorAll("[data-requires-clean-state]").forEach((element) => {
    if (!(element instanceof HTMLElement) || !("disabled" in element)) return;
    if (!Object.prototype.hasOwnProperty.call(element.dataset, "cleanStateBaseDisabled")) {
      element.dataset.cleanStateBaseDisabled = element.disabled ? "true" : "false";
    }
    if (blocked) {
      element.disabled = true;
      element.dataset.cleanStateBlocked = "true";
      element.title = message;
    } else {
      element.disabled = element.dataset.cleanStateBaseDisabled === "true";
      delete element.dataset.cleanStateBlocked;
      if (element.title === message) element.title = "";
    }
    const hintId = String(element.dataset.cleanStateHintId || "").trim();
    const hintNode = hintId ? document.getElementById(hintId) : null;
    if (hintNode instanceof HTMLElement) {
      hintNode.textContent = blocked ? message : "";
    }
  });
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

window.addEventListener("beforeunload", (event) => {
  bookingWhatsApp?.stopAutoRefresh();
  if (!hasUnsavedBookingChanges()) return;
  event.preventDefault();
  event.returnValue = "";
});

function closeBookingDetailScreen() {
  if (hasUnsavedBookingChanges() && !window.confirm(backendT("booking.discard_navigation_confirm", "Discard unsaved edits and leave this page?"))) {
    return;
  }
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

  initializeBookingSections(document);
  renderStaticSectionHeaders();
  populateCurrencySelectFromModule(els.pricing_currency_input);
  populateCurrencySelectFromModule(els.offer_currency_input);
  populateCurrencySelectFromModule(els.invoice_currency_input);
  populateContentLanguageSelect();
  updatePageDirtyBar();

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
    els.titleInput.addEventListener("input", updateCoreDirtyState);
    els.titleInput.addEventListener("keydown", handleBookingTitleInputKeydown);
  }
  if (els.ownerSelect) els.ownerSelect.addEventListener("change", updateCoreDirtyState);
  if (els.contentLanguageSelect) els.contentLanguageSelect.addEventListener("change", () => {
    void handleContentLanguageChange();
  });
  if (els.stageSelect) els.stageSelect.addEventListener("change", updateCoreDirtyState);
  if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteBooking);
  if (els.noteInput) els.noteInput.addEventListener("input", updateNoteSaveButtonState);
  if (els.noteInput) els.noteInput.addEventListener("change", updateNoteSaveButtonState);
  if (els.discardEditsBtn) els.discardEditsBtn.addEventListener("click", discardPageEdits);
  if (els.saveEditsBtn) els.saveEditsBtn.addEventListener("click", () => {
    void savePageEdits();
  });
  if (els.personModal) {
    els.personModal.addEventListener("click", (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest("[data-person-modal-traveler-details-action]")
        : null;
      if (!(actionButton instanceof HTMLButtonElement)) return;
      const action = normalizeText(actionButton.dataset.personModalTravelerDetailsAction);
      if (action === "copy") {
        void copyTravelerDetailsLink();
      }
    });
  }
  if (els.pricing_panel) {
    const schedulePricingDirtyState = () => window.setTimeout(updatePricingDirtyState, 0);
    els.pricing_panel.addEventListener("input", schedulePricingDirtyState);
    els.pricing_panel.addEventListener("change", schedulePricingDirtyState);
    els.pricing_panel.addEventListener("click", (event) => {
      if (event.target.closest("button")) schedulePricingDirtyState();
    });
  }
  if (els.offer_currency_input)
    els.offer_currency_input.addEventListener("change", () => {
      void handleOfferCurrencyChange();
    });
  personsModule.bindEvents();
  travelPlanModule.bindEvents();
  document.addEventListener("keydown", handleBookingDetailKeydown, true);
  document.addEventListener("keydown", handlePageSaveKeydown, true);
  if (els.invoice_select) els.invoice_select.addEventListener("change", onInvoiceSelectChange);
  if (els.invoice_panel) {
    const scheduleInvoiceDirtyState = () => window.setTimeout(updateInvoiceDirtyState, 0);
    els.invoice_panel.addEventListener("input", scheduleInvoiceDirtyState);
    els.invoice_panel.addEventListener("change", scheduleInvoiceDirtyState);
  }
  if (els.invoice_currency_input) els.invoice_currency_input.addEventListener("change", renderInvoiceMoneyLabels);
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
      if (hasUnsavedBookingChanges() && !window.confirm(backendT("booking.discard_navigation_confirm", "Discard unsaved edits and leave this page?"))) {
        return;
      }
      window.location.href = resolveBackendSectionHref(section);
    });
  });
}

async function loadBookingPage() {
  const result = await bookingPageDataController.loadBookingPage();
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
  return result;
}

function renderBookingHeader() {
  const result = coreModule.renderBookingHeader();
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
  return result;
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
  const result = coreModule.renderBookingData();
  updateCleanStateActionAvailability();
  return result;
}

function renderActionControls() {
  const result = coreModule.renderActionControls();
  updateCleanStateActionAvailability();
  return result;
}

function applyBookingPayload(payload = {}, options = {}) {
  coreModule.applyBookingPayload(payload, options);
  personsModule.applyBookingPayload();
  travelPlanModule.applyBookingPayload();
  setTravelerDetailsLinkStatus("");
  updatePageDirtyBar();
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

function setTravelerDetailsLinkStatus(message) {
  const statusNode = document.getElementById("booking_person_modal_traveler_details_link_status");
  if (!(statusNode instanceof HTMLElement)) return;
  statusNode.textContent = message || "";
}

function getActiveTravelerDetailsDraft() {
  const activeIndex = Number(state.active_person_index);
  if (!Number.isInteger(activeIndex) || activeIndex < 0) return null;
  return state.personDrafts[activeIndex] || null;
}

function getTravelerDetailsRecipientEmail() {
  const draft = getActiveTravelerDetailsDraft();
  return String(Array.isArray(draft?.emails) ? draft.emails[0] : "").trim();
}

function getTravelerDetailsRecipientPhone() {
  const draft = getActiveTravelerDetailsDraft();
  return String(Array.isArray(draft?.phone_numbers) ? draft.phone_numbers[0] : "").trim();
}

function travelerDetailsLinkUnavailableMessage(message = "") {
  return normalizeText(message)
    || backendT("booking.traveler_details.link_unavailable", "Traveler details link is not available.");
}

function buildTravelerDetailsLink({ bookingId, personId, token, expiresAt }) {
  const normalizedBookingId = normalizeText(bookingId);
  const normalizedPersonId = normalizeText(personId);
  const normalizedToken = normalizeText(token);
  const normalizedExpiresAt = normalizeText(expiresAt);
  const expiresAtMs = Date.parse(normalizedExpiresAt);
  if (!normalizedBookingId || !normalizedPersonId || !normalizedToken) return "";
  if (normalizedExpiresAt && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) return "";
  const url = new URL("/traveler-details.html", window.location.origin);
  url.searchParams.set("booking_id", normalizedBookingId);
  url.searchParams.set("person_id", normalizedPersonId);
  url.searchParams.set("token", normalizedToken);
  const lang = normalizeText(state.booking?.customer_language).toLowerCase();
  if (lang) url.searchParams.set("lang", lang);
  return url.toString();
}

async function requestTravelerDetailsLink() {
  const draft = getActiveTravelerDetailsDraft();
  const bookingId = normalizeText(state.booking?.id);
  const personId = normalizeText(draft?.id);
  if (!bookingId || !personId) {
    return {
      ok: false,
      error: backendT("booking.traveler_details.link_unavailable", "Traveler details link is not available.")
    };
  }

  const requestUrl = resolveApiUrl(
    apiOrigin,
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/persons/${encodeURIComponent(personId)}/traveler-details-link`
  );

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      credentials: "include"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) {
        redirectToBackendLogin();
        return { ok: false, error: "" };
      }
      return {
        ok: false,
        error: normalizeText(payload?.error) || backendT("booking.error.request_failed", "Request failed")
      };
    }
    const link = buildTravelerDetailsLink({
      bookingId,
      personId,
      token: payload?.traveler_details_token,
      expiresAt: payload?.traveler_details_expires_at
    });
    if (!link) {
      return {
        ok: false,
        error: backendT("booking.traveler_details.link_unavailable", "Traveler details link is not available.")
      };
    }
    return {
      ok: true,
      link,
      expiresAt: normalizeText(payload?.traveler_details_expires_at)
    };
  } catch {
    return {
      ok: false,
      error: backendT("booking.error.connect", "Could not connect to backend API.")
    };
  }
}

async function copyTravelerDetailsLink() {
  const result = await requestTravelerDetailsLink();
  if (!result.ok || !result.link) {
    setTravelerDetailsLinkStatus(travelerDetailsLinkUnavailableMessage(result.error));
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(result.link);
      setTravelerDetailsLinkStatus(backendT("booking.traveler_details.link_copied", "Traveler details link copied."));
      return;
    }
    window.prompt(
      backendT("booking.traveler_details.copy_prompt", "Copy this traveler details link:"),
      result.link
    );
    setTravelerDetailsLinkStatus(backendT("booking.traveler_details.link_copied", "Traveler details link copied."));
  } catch {
    setTravelerDetailsLinkStatus(
      backendT("booking.traveler_details.link_copy_failed", "Could not copy the traveler details link.")
    );
  }
}

async function emailTravelerDetailsLink() {
  const result = await requestTravelerDetailsLink();
  if (!result.ok || !result.link) {
    setTravelerDetailsLinkStatus(travelerDetailsLinkUnavailableMessage(result.error));
    return;
  }
  const recipientEmail = getTravelerDetailsRecipientEmail();
  if (!recipientEmail) {
    setTravelerDetailsLinkStatus(
      backendT("booking.traveler_details.email_missing", "Traveler has no email for the traveler details link.")
    );
    return;
  }
  const draft = getActiveTravelerDetailsDraft();
  const bookingName = normalizeText(state.booking?.name || state.booking?.web_form_submission?.booking_name || state.booking?.id)
    || backendT("booking.title", "Booking");
  const travelerName = normalizeText(draft?.name) || backendT("booking.persons.this_person", "this traveler");
  const subject = backendT("booking.traveler_details.email_subject", "Traveler details for {traveler} | {booking}", {
    traveler: travelerName,
    booking: bookingName
  });
  const body = backendT(
    "booking.traveler_details.email_body",
    "Hello,\n\nplease fill in your traveler details here:\n{link}\n\nBest regards,\nAsia Travel Plan",
    { link: result.link }
  );
  window.location.href = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  setTravelerDetailsLinkStatus(backendT("booking.traveler_details.email_opening", "Opening your mail client..."));
}

async function openTravelerDetailsWhatsAppLink() {
  const result = await requestTravelerDetailsLink();
  if (!result.ok || !result.link) {
    setTravelerDetailsLinkStatus(travelerDetailsLinkUnavailableMessage(result.error));
    return;
  }
  const draft = getActiveTravelerDetailsDraft();
  const travelerName = normalizeText(draft?.name) || backendT("booking.persons.this_person", "this traveler");
  const bookingName = normalizeText(state.booking?.name || state.booking?.web_form_submission?.booking_name || state.booking?.id)
    || backendT("booking.title", "Booking");
  const message = backendT(
    "booking.traveler_details.whatsapp_body",
    "Hello {traveler}, please fill in your traveler details for {booking} here: {link}",
    { traveler: travelerName, booking: bookingName, link: result.link }
  );
  const recipientPhone = getTravelerDetailsRecipientPhone().replace(/\D+/g, "");
  const whatsappUrl = new URL("https://api.whatsapp.com/send");
  if (recipientPhone) whatsappUrl.searchParams.set("phone", recipientPhone);
  whatsappUrl.searchParams.set("text", message);
  window.open(whatsappUrl.toString(), "_blank", "noopener");
  setTravelerDetailsLinkStatus(backendT("booking.traveler_details.whatsapp_opening", "Opening WhatsApp..."));
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

function updateCoreDirtyState() {
  return coreModule.updateCoreDirtyState();
}

async function saveCoreEdits() {
  return await coreModule.saveCoreEdits();
}

async function saveNoteEdits() {
  return await coreModule.saveNoteEdits();
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
  const result = personsModule.renderPersonsEditor(options);
  updateCleanStateActionAvailability();
  return result;
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

function renderStaticSectionHeaders() {
  renderBookingSectionHeader(els.personsPanelSummary, { primary: backendT("booking.no_persons", "No persons listed.") });
  renderBookingSectionHeader(els.travel_plan_panel_summary, {
    primary: backendT("booking.travel_plan", "Travel plan"),
    secondary: backendT("booking.no_travel_plan", "No travel plan yet.")
  });
  renderBookingSectionHeader(els.offerPanelSummary, { primary: backendT("booking.offer", "Offer") });
  renderBookingSectionHeader(els.offerPaymentTermsPanelSummary, { primary: backendT("booking.payment_terms", "Payment terms") });
  renderBookingSectionHeader(els.offerAcceptancePanelSummary, {
    primary: backendT("booking.offer_acceptance", "Offer acceptance"),
    secondary: backendT("booking.offer_acceptance_none", "No generated offers yet.")
  });
  renderBookingSectionHeader(els.pricingPanelSummary, { primary: backendT("booking.payments", "Payments") });
  renderBookingSectionHeader(els.activitiesPanelSummary, { primary: backendT("booking.activities", "Activities") });
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
  const result = pricingModule.renderPricingPanel();
  updateCleanStateActionAvailability();
  return result;
}

function renderOfferPanel() {
  const result = offerModule.renderOfferPanel();
  updateCleanStateActionAvailability();
  return result;
}

function renderTravelPlanPanel() {
  const result = travelPlanModule.renderTravelPlanPanel();
  updateCleanStateActionAvailability();
  return result;
}

function updateInvoiceDirtyState() {
  return invoicesModule.updateInvoiceDirtyState();
}

function renderInvoiceMoneyLabels() {
  return invoicesModule.renderInvoiceMoneyLabels();
}

function loadInvoices() {
  const result = invoicesModule.loadInvoices();
  Promise.resolve(result).finally(() => {
    updateCleanStateActionAvailability();
  });
  return result;
}

function onInvoiceSelectChange() {
  const result = invoicesModule.onInvoiceSelectChange();
  updateCleanStateActionAvailability();
  return result;
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

function handlePageSaveKeydown(event) {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
  event.preventDefault();
  void savePageEdits();
}

async function savePageEdits() {
  if (!hasUnsavedBookingChanges() || state.pageSaveInFlight || state.pageDiscardInFlight) return true;
  state.pageSaveInFlight = true;
  state.pageDirtyBarStatus = "saving";
  state.pageSaveActionError = "";
  clearError();
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
  let saveCompleted = false;
  const tasks = [
    {
      shouldRun: () => state.dirty.core,
      label: backendT("booking.dirty.core", "Booking details"),
      run: () => saveCoreEdits()
    },
    {
      shouldRun: () => state.dirty.note,
      label: backendT("booking.dirty.note", "Notes"),
      run: () => saveNoteEdits()
    },
    {
      shouldRun: () => state.dirty.persons,
      label: backendT("booking.dirty.persons", "Persons"),
      run: () => personsModule.saveAllPersonDrafts()
    },
    {
      shouldRun: () => state.dirty.offer || state.dirty.payment_terms,
      label: backendT("booking.dirty.offer", "Offer"),
      run: () => saveOffer()
    },
    {
      shouldRun: () => state.dirty.travel_plan,
      label: backendT("booking.dirty.travel_plan", "Travel plan"),
      run: () => travelPlanModule.saveTravelPlan()
    },
    {
      shouldRun: () => state.dirty.pricing,
      label: backendT("booking.dirty.pricing", "Payments"),
      run: () => savePricing()
    },
    {
      shouldRun: () => state.dirty.invoice,
      label: backendT("booking.dirty.invoice", "Invoice"),
      run: () => createInvoice()
    }
  ];

  try {
    for (const task of tasks) {
      if (!task.shouldRun()) continue;
      const saved = await task.run();
      if (saved === false) return false;
    }
    clearStatus();
    state.pageDirtyBarStatus = "saved";
    saveCompleted = true;
    return true;
  } finally {
    state.pageSaveInFlight = false;
    if (!saveCompleted && state.pageDirtyBarStatus === "saving") {
      state.pageDirtyBarStatus = "";
    }
    updatePageDirtyBar();
    updateCleanStateActionAvailability();
  }
}

async function discardPageEdits() {
  if (!hasUnsavedBookingChanges() || state.pageSaveInFlight || state.pageDiscardInFlight) return;
  if (!window.confirm(backendT("booking.discard_edits_confirm", "Discard all unsaved edits?"))) return;
  clearError();
  clearStatus();
  state.pageSaveActionError = "";
  state.pageDiscardInFlight = true;
  state.pageDirtyBarStatus = "discarding";
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
  let discardCompleted = false;
  try {
    discardCompleted = await loadBookingPage();
    if (discardCompleted !== false) {
      state.pageDirtyBarStatus = "discarded";
      discardCompleted = true;
    }
  } finally {
    state.pageDiscardInFlight = false;
    if (!discardCompleted && state.pageDirtyBarStatus === "discarding") {
      state.pageDirtyBarStatus = "";
    }
    updatePageDirtyBar();
    updateCleanStateActionAvailability();
  }
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
  setBookingSectionDirty,
  setPageSaveActionError: (message) => {
    state.pageSaveActionError = normalizeText(message);
    updatePageDirtyBar();
  },
  hasUnsavedBookingChanges
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
  setBookingSectionDirty,
  updateCleanStateActionAvailability
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
  hasUnsavedBookingChanges,
  reportPersistedActionBlocked: () => setStatus(cleanStateBlockMessage()),
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
  logBrowserConsoleError("[booking] Booking page initialization failed.", {
    booking_id: state.id || null,
    current_url: window.location.href
  }, error);
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
