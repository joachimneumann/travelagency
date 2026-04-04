import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import { BOOKING_PERSON_SCHEMA } from "../../Generated/Models/generated_Booking.js";
import {
  bookingActivitiesRequest,
  bookingPersonCreateRequest,
  bookingPersonDeleteRequest,
  bookingPersonPhotoRequest,
  bookingPersonUpdateRequest
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
import { wireAuthLogoutLink } from "../shared/auth.js";
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

function renderOfferCurrencyMenu(selectEl, mount) {
  if (!(selectEl instanceof HTMLSelectElement) || !mount) return;
  const options = Array.from(selectEl.options)
    .map((option) => ({
      value: String(option.value || "").trim(),
      label: String(option.textContent || option.value || "").trim()
    }))
    .filter((option) => option.value);
  const selectedValue = String(selectEl.value || options[0]?.value || "USD").trim();
  const active = options.find((option) => option.value === selectedValue) || { value: selectedValue, label: selectedValue };
  let root = mount.querySelector(".lang-menu[data-offer-currency-menu='true']");
  if (!root) {
    root = document.createElement("div");
    root.className = "lang-menu";
    root.dataset.offerCurrencyMenu = "true";
    mount.replaceChildren(root);
  }

  const disabledAttr = selectEl.disabled ? " disabled" : "";
  root.classList.remove("is-open");
  root.innerHTML = `
    <button type="button" class="lang-menu-trigger" aria-haspopup="menu" aria-expanded="false"${disabledAttr}>
      <span class="lang-menu-code">${escapeHtml(active.label)}</span>
      <span class="lang-menu-caret" aria-hidden="true"></span>
    </button>
    <div class="lang-menu-panel" role="menu" hidden>
      ${options
        .filter((option) => option.value !== active.value)
        .map((option) => `<button type="button" class="lang-menu-item" data-offer-currency-option="${escapeHtml(option.value)}" role="menuitem">${escapeHtml(option.label)}</button>`)
        .join("")}
    </div>
  `;

  const trigger = root.querySelector(".lang-menu-trigger");
  const panel = root.querySelector(".lang-menu-panel");
  if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLDivElement)) return;

  const closeMenu = () => {
    root.classList.remove("is-open");
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    if (selectEl.disabled) return;
    root.classList.add("is-open");
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    if (panel.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  panel.addEventListener("click", (event) => {
    const optionButton = event.target instanceof Element
      ? event.target.closest("[data-offer-currency-option]")
      : null;
    if (!(optionButton instanceof HTMLButtonElement)) return;
    const nextValue = String(optionButton.dataset.offerCurrencyOption || "").trim();
    if (!nextValue || nextValue === selectEl.value) {
      closeMenu();
      return;
    }
    selectEl.value = nextValue;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || root.contains(event.target)) return;
    closeMenu();
  }, { once: true });
}

function logBookingSave(message, details = {}) {
  const payload = details && typeof details === "object" ? { ...details } : { details };
  console.info(message, payload);
}

function setupBookingFilterPanels() {
  const controls = [
    { trigger: els.destinationsTrigger, panel: els.destinationsPanel },
    { trigger: els.travelStylesTrigger, panel: els.travelStylesPanel }
  ].filter((item) => item.trigger && item.panel);

  if (!controls.length) return;

  const closeAllPanels = () => {
    controls.forEach(({ trigger, panel }) => {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    });
  };

  controls.forEach(({ trigger, panel }) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = panel.hidden;
      closeAllPanels();
      panel.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.addEventListener("click", closeAllPanels);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllPanels();
  });
}

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

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
  latestActivityAt: "",
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
    offer_component_links: [],
    attachments: []
  },
  offerDraft: {
    currency: "USD",
    offer_detail_level_internal: "trip",
    offer_detail_level_visible: "trip",
    category_rules: [],
    components: [],
    days_internal: [],
    additional_items: [],
    totals: {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      components_count: 0
    }
  }
};

state.dirty = { core: false, note: false, persons: false, travel_plan: false, offer: false, payment_terms: false, pricing: false, invoice: false };
state.dirtyDiagnostics = {};
state.originalTravelPlanSnapshot = "";
state.originalTravelPlanState = null;
state.originalInvoiceSnapshot = "";
state.pricingDepositReceiptArmed = false;
state.pageSaveInFlight = false;
state.pageDiscardInFlight = false;
state.pageDirtyBarStatus = "";
state.pageSaveActionError = "";
state.pendingSavedCustomerLanguage = "";
state.lastMutationError = null;
state.cloneBookingInFlight = false;

let bookingWhatsApp = null;

const els = {
  pageBody: document.body,
  pageHeader: document.getElementById("top"),
  mainContent: document.getElementById("main-content"),
  booking_page_overlay: document.getElementById("travel_plan_translate_overlay"),
  booking_page_overlay_text: document.getElementById("travel_plan_translate_overlay_text"),
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
  cloneTitleLabel: document.getElementById("booking_clone_title_label"),
  cloneTitleInput: document.getElementById("booking_clone_title_input"),
  cloneIncludeTravelersInput: document.getElementById("booking_clone_include_travelers_input"),
  cloneIncludeTravelersLabel: document.getElementById("booking_clone_include_travelers_label"),
  cloneBtn: document.getElementById("booking_clone_btn"),
  cloneStatus: document.getElementById("booking_clone_status"),
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
  personModalActionStatus: document.getElementById("booking_person_modal_action_status"),
  personModalDiscardBtn: document.getElementById("booking_person_modal_discard_btn"),
  personModalSaveBtn: document.getElementById("booking_person_modal_save_btn"),
  personModalDeleteBtn: document.getElementById("booking_person_modal_delete_btn"),
  travelPlanServiceLibraryModal: document.getElementById("travel_plan_service_library_modal"),
  travelPlanServiceLibraryCloseBtn: document.getElementById("travel_plan_service_library_close_btn"),
  travelPlanServiceLibraryTitle: document.getElementById("travel_plan_service_library_title"),
  travelPlanServiceLibraryQuery: document.getElementById("travel_plan_service_library_query"),
  travelPlanServiceLibraryKind: document.getElementById("travel_plan_service_library_kind"),
  travelPlanServiceLibrarySearchBtn: document.getElementById("travel_plan_service_library_search_btn"),
  travelPlanServiceLibraryStatus: document.getElementById("travel_plan_service_library_status"),
  travelPlanServiceLibraryResults: document.getElementById("travel_plan_service_library_results"),
  travelPlanImagePreviewModal: document.getElementById("travel_plan_image_preview_modal"),
  travelPlanImagePreviewCloseBtn: document.getElementById("travel_plan_image_preview_close_btn"),
  travelPlanImagePreviewImage: document.getElementById("travel_plan_image_preview_image"),
  travelPlanServiceImageInput: document.getElementById("travel_plan_service_image_input"),
  travelPlanAttachmentInput: document.getElementById("travel_plan_attachment_input"),
  personModalPreferredLanguage: document.getElementById("booking_person_modal_preferred_language"),
  personModalDateOfBirth: document.getElementById("booking_person_modal_date_of_birth"),
  personModalDateOfBirthPickerBtn: document.getElementById("booking_person_modal_date_of_birth_picker_btn"),
  personModalDateOfBirthPicker: document.getElementById("booking_person_modal_date_of_birth_picker"),
  personModalDateOfBirthError: document.getElementById("booking_person_modal_date_of_birth_error"),
  personModalGender: document.getElementById("booking_person_modal_gender"),
  personModalNationality: document.getElementById("booking_person_modal_nationality"),
  personModalEmails: document.getElementById("booking_person_modal_emails"),
  personModalPhoneNumbers: document.getElementById("booking_person_modal_phone_numbers"),
  personModalFoodPreferences: document.getElementById("booking_person_modal_food_preferences"),
  personModalAllergies: document.getElementById("booking_person_modal_allergies"),
  personModalHotelRoomSmoker: document.getElementById("booking_person_modal_hotel_room_smoker"),
  personModalHotelRoomPreference: document.getElementById("booking_person_modal_hotel_room_preference"),
  personModalRoles: document.getElementById("booking_person_modal_roles"),
  personModalAddressLine1: document.getElementById("booking_person_modal_address_line_1"),
  personModalAddressLine2: document.getElementById("booking_person_modal_address_line_2"),
  personModalCity: document.getElementById("booking_person_modal_city"),
  personModalStateRegion: document.getElementById("booking_person_modal_state_region"),
  personModalPostalCode: document.getElementById("booking_person_modal_postal_code"),
  personModalCountryCode: document.getElementById("booking_person_modal_country_code"),
  personModalNotes: document.getElementById("booking_person_modal_notes"),
  ownerSelect: document.getElementById("booking_owner_select"),
  sourceChannelSelect: document.getElementById("booking_source_channel_select"),
  referralKindSelect: document.getElementById("booking_referral_kind_select"),
  referralLabelField: document.getElementById("booking_referral_label_field"),
  referralLabelLabel: document.getElementById("booking_referral_label_label"),
  referralLabelInput: document.getElementById("booking_referral_label_input"),
  referralLabelHint: document.getElementById("booking_referral_label_hint"),
  referralStaffSelect: document.getElementById("booking_referral_staff_select"),
  destinationsTrigger: document.getElementById("booking_destinations_trigger"),
  destinationsSummary: document.getElementById("booking_destinations_summary"),
  destinationsPanel: document.getElementById("booking_destinations_panel"),
  destinationsOptions: document.getElementById("booking_destinations_options"),
  travelStylesTrigger: document.getElementById("booking_travel_styles_trigger"),
  travelStylesSummary: document.getElementById("booking_travel_styles_summary"),
  travelStylesPanel: document.getElementById("booking_travel_styles_panel"),
  travelStylesOptions: document.getElementById("booking_travel_styles_options"),
  pdfPersonalizationPanel: document.getElementById("booking_pdf_personalization_panel"),
  pdfTravelPlanSubtitleMount: document.getElementById("booking_pdf_travel_plan_subtitle_mount"),
  pdfTravelPlanWelcomeMount: document.getElementById("booking_pdf_travel_plan_welcome_mount"),
  pdfTravelPlanChildrenPolicyMount: document.getElementById("booking_pdf_travel_plan_children_policy_mount"),
  pdfTravelPlanWhatsNotIncludedMount: document.getElementById("booking_pdf_travel_plan_whats_not_included_mount"),
  pdfTravelPlanClosingMount: document.getElementById("booking_pdf_travel_plan_closing_mount"),
  pdfTravelPlanIncludeWhoIsTravelingMount: document.getElementById("booking_pdf_travel_plan_include_who_is_traveling_mount"),
  pdfOfferSubtitleMount: document.getElementById("booking_pdf_offer_subtitle_mount"),
  pdfOfferWelcomeMount: document.getElementById("booking_pdf_offer_welcome_mount"),
  pdfOfferClosingMount: document.getElementById("booking_pdf_offer_closing_mount"),
  pdfOfferIncludeWhoIsTravelingMount: document.getElementById("booking_pdf_offer_include_who_is_traveling_mount"),
  pdfCustomerReference: document.getElementById("booking_pdf_customer_reference"),
  contentLanguageField: document.getElementById("booking_content_language_field"),
  contentLanguageMenuMount: document.getElementById("booking_content_language_menu_mount"),
  contentLanguageSelect: document.getElementById("booking_content_language_select"),
  lastActionDetail: document.getElementById("booking_last_action_detail"),
  milestoneActionsBefore: document.getElementById("booking_milestone_actions_before"),
  milestoneActionsAfter: document.getElementById("booking_milestone_actions_after"),
  bookingStatusPhaseBefore: document.getElementById("booking_status_phase_before"),
  bookingStatusPhaseAfter: document.getElementById("booking_status_phase_after"),
  noteInput: document.getElementById("booking_note_input"),
  actionStatus: document.getElementById("booking_action_status"),
  travel_plan_panel: document.getElementById("travel_plan_panel"),
  travel_plan_panel_summary: document.getElementById("travel_plan_panel_summary"),
  travel_plan_pdf_panel: document.getElementById("travel_plan_pdf_panel"),
  travel_plan_pdf_panel_summary: document.getElementById("travel_plan_pdf_panel_summary"),
  travel_plan_pdf_workspace: document.getElementById("travel_plan_pdf_workspace"),
  travel_plan_editor: document.getElementById("travel_plan_editor"),
  travel_plan_translate_all_btn: document.getElementById("travel_plan_translate_all_btn"),
  travel_plan_status: document.getElementById("travel_plan_status"),
  travel_plan_translate_overlay: document.getElementById("travel_plan_translate_overlay"),
  travel_plan_translate_overlay_text: document.getElementById("travel_plan_translate_overlay_text"),
  pricing_panel: document.getElementById("pricing_panel"),
  pricingPanelSummary: document.getElementById("pricing_panel_summary"),
  pricing_summary_table: document.getElementById("pricing_summary_table"),
  pricing_deposit_controls: document.getElementById("pricing_deposit_controls"),
  pricing_deposit_amount: document.getElementById("pricing_deposit_amount"),
  pricing_deposit_received_at_input: document.getElementById("pricing_deposit_received_at_input"),
  pricing_deposit_confirmed_by_select: document.getElementById("pricing_deposit_confirmed_by_select"),
  pricing_deposit_reference_input: document.getElementById("pricing_deposit_reference_input"),
  pricing_deposit_received_btn: document.getElementById("pricing_deposit_received_btn"),
  pricing_management_approval_btn: document.getElementById("pricing_management_approval_btn"),
  pricing_deposit_action_hint: document.getElementById("pricing_deposit_action_hint"),
  pricing_deposit_hint_row: document.getElementById("pricing_deposit_hint_row"),
  pricing_deposit_hint: document.getElementById("pricing_deposit_hint"),
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
  booking_confirmation_panel: document.getElementById("booking_confirmation_panel"),
  bookingConfirmationPanelSummary: document.getElementById("booking_confirmation_panel_summary"),
  offer_detail_level_panel: document.getElementById("offer_detail_level_panel"),
  offer_currency_input: document.getElementById("offer_currency_input"),
  offerCurrencyMenuMount: document.getElementById("booking_currency_menu_mount"),
  offer_currency_hint: document.getElementById("offer_currency_hint"),
  offer_detail_level_internal_input: document.getElementById("offer_detail_level_internal_input"),
  offer_detail_level_visible_input: document.getElementById("offer_detail_level_visible_input"),
  offer_detail_level_internal_pill: document.getElementById("offer_detail_level_internal_pill"),
  offer_detail_level_visible_pill: document.getElementById("offer_detail_level_visible_pill"),
  offer_detail_level_confirm_modal: document.getElementById("offer_detail_level_confirm_modal"),
  offer_detail_level_confirm_message: document.getElementById("offer_detail_level_confirm_message"),
  offer_detail_level_confirm_close_btn: document.getElementById("offer_detail_level_confirm_close_btn"),
  offer_detail_level_confirm_cancel_btn: document.getElementById("offer_detail_level_confirm_cancel_btn"),
  offer_detail_level_confirm_accept_btn: document.getElementById("offer_detail_level_confirm_accept_btn"),
  offer_visible_pricing_hint: document.getElementById("offer_visible_pricing_hint"),
  offer_components_table: document.getElementById("offer_components_table"),
  offer_additional_items_table: document.getElementById("offer_additional_items_table"),
  offer_discount_editor: document.getElementById("offer_discount_editor"),
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

function refreshBackendNavRefs() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

async function waitForBackendNavRefs(timeoutMs = 1500) {
  refreshBackendNavRefs();
  if (els.logoutLink || els.userLabel) return;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("backend-nav-mounted", onMounted);
      resolve();
    };
    const onMounted = () => {
      window.setTimeout(finish, 0);
    };
    window.addEventListener("backend-nav-mounted", onMounted, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
  refreshBackendNavRefs();
}

function currentDirtyDiagnostics() {
  return Object.fromEntries(
    Object.entries(state.dirty)
      .filter(([, isDirty]) => Boolean(isDirty))
      .map(([sectionKey]) => [sectionKey, state.dirtyDiagnostics?.[sectionKey] || null])
  );
}

function setBookingSectionDirty(sectionKey, isDirty, diagnostic = undefined) {
  const previousDirty = Boolean(state.dirty[sectionKey]);
  const nextDirty = Boolean(isDirty);
  if (!state.dirtyDiagnostics || typeof state.dirtyDiagnostics !== "object") {
    state.dirtyDiagnostics = {};
  }
  if (!nextDirty) {
    delete state.dirtyDiagnostics[sectionKey];
  } else if (diagnostic && typeof diagnostic === "object") {
    state.dirtyDiagnostics[sectionKey] = diagnostic;
  } else if (diagnostic === null) {
    delete state.dirtyDiagnostics[sectionKey];
  }
  state.dirty[sectionKey] = nextDirty;
  if (hasUnsavedBookingChanges()) {
    state.pageDirtyBarStatus = "";
  }
  state.pageSaveActionError = "";
  if (previousDirty !== nextDirty) {
    console.info("[booking-dirty] Section dirty state changed.", {
      booking_id: state.id || null,
      section: sectionKey,
      dirty: nextDirty,
      diagnostic: nextDirty ? state.dirtyDiagnostics?.[sectionKey] || null : null,
      dirty_sections: Object.keys(state.dirty).filter((key) => Boolean(state.dirty[key]))
    });
  }
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
  pricingModule.refreshDepositReceiptActionState?.();
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
  if (els.cloneBtn instanceof HTMLButtonElement) {
    const cloneTitle = normalizeText(els.cloneTitleInput?.value);
    els.cloneBtn.dataset.cleanStateBaseDisabled = (
      !state.permissions.canEditBooking
      || state.cloneBookingInFlight
      || !state.booking?.id
      || !cloneTitle
    ) ? "true" : "false";
  }
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
  escapeHtml,
  backendT,
  updateCoreDirtyState: () => updateCoreDirtyState(),
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
  window.addEventListener("backend-nav-mounted", refreshBackendNavRefs);
  await waitForBackendNavRefs();
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
    wireAuthLogoutLink(els.logoutLink, { apiBase: apiOrigin, returnTo });
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
  renderOfferCurrencyMenu(els.offer_currency_input, els.offerCurrencyMenuMount);
  populateContentLanguageSelect();
  setupBookingFilterPanels();
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
  if (els.sourceChannelSelect) els.sourceChannelSelect.addEventListener("change", updateCoreDirtyState);
  if (els.referralKindSelect) {
    els.referralKindSelect.addEventListener("change", () => {
      updateCoreDirtyState();
      renderActionControls();
    });
  }
  if (els.referralLabelInput) els.referralLabelInput.addEventListener("input", updateCoreDirtyState);
  if (els.referralStaffSelect) els.referralStaffSelect.addEventListener("change", updateCoreDirtyState);
  if (els.destinationsOptions) {
    els.destinationsOptions.addEventListener("change", () => {
      updateCoreDirtyState();
      renderActionControls();
    });
  }
  if (els.travelStylesOptions) {
    els.travelStylesOptions.addEventListener("change", () => {
      updateCoreDirtyState();
      renderActionControls();
    });
  }
  if (els.pdfPersonalizationPanel) {
    els.pdfPersonalizationPanel.addEventListener("input", updateCoreDirtyState);
    els.pdfPersonalizationPanel.addEventListener("change", updateCoreDirtyState);
  }
  if (els.contentLanguageSelect) els.contentLanguageSelect.addEventListener("change", () => {
    void handleContentLanguageChange();
  });
  [els.milestoneActionsBefore, els.milestoneActionsAfter].filter(Boolean).forEach((mount) => {
    mount.addEventListener("click", (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest("[data-booking-milestone-action]")
        : null;
      if (!(actionButton instanceof HTMLButtonElement)) return;
      void recordBookingMilestoneAction(actionButton.dataset.bookingMilestoneAction);
    });
  });
  if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteBooking);
  if (els.cloneTitleInput) {
    els.cloneTitleInput.addEventListener("input", () => {
      const defaultValue = normalizeText(els.cloneTitleInput?.dataset.defaultValue);
      els.cloneTitleInput.dataset.userEdited = normalizeText(els.cloneTitleInput.value) !== defaultValue ? "true" : "false";
      updateCleanStateActionAvailability();
    });
  }
  if (els.cloneBtn) els.cloneBtn.addEventListener("click", cloneBooking);
  if (els.noteInput) els.noteInput.addEventListener("input", updateNoteSaveButtonState);
  if (els.noteInput) els.noteInput.addEventListener("change", updateNoteSaveButtonState);
  if (els.discardEditsBtn) els.discardEditsBtn.addEventListener("click", discardPageEdits);
  if (els.saveEditsBtn) els.saveEditsBtn.addEventListener("click", () => {
    logBookingSave("[booking-save] Save button clicked.", {
      booking_id: state.id || null,
      dirty: { ...state.dirty },
      has_unsaved_changes: hasUnsavedBookingChanges(),
      page_save_in_flight: state.pageSaveInFlight,
      page_discard_in_flight: state.pageDiscardInFlight
    });
    void savePageEdits();
  });
  if (els.personModal) {
    els.personModal.addEventListener("click", async (event) => {
      const actionButton = event.target instanceof Element
        ? event.target.closest("[data-person-modal-traveler-details-action]")
        : null;
      if (!(actionButton instanceof HTMLButtonElement)) return;
      const action = normalizeText(actionButton.dataset.personModalTravelerDetailsAction);
      if (action === "copy") {
        const ready = await personsModule.prepareTravelerDetailsLinkAction();
        if (!ready) return;
        void copyTravelerDetailsLink();
      }
    });
  }
  if (els.pricing_panel) {
    const schedulePricingDirtyState = () => window.setTimeout(updatePricingDirtyState, 0);
    els.pricing_panel.addEventListener("input", () => {
      disarmDepositReceiptConfirmation();
      schedulePricingDirtyState();
    });
    els.pricing_panel.addEventListener("change", (event) => {
      if (event.target === els.pricing_deposit_confirmed_by_select) {
        if (String(els.pricing_deposit_confirmed_by_select?.value || "").trim()) {
          delete els.pricing_deposit_confirmed_by_select.dataset.userClearedSelection;
        } else {
          els.pricing_deposit_confirmed_by_select.dataset.userClearedSelection = "true";
        }
      }
      disarmDepositReceiptConfirmation();
      schedulePricingDirtyState();
    });
    els.pricing_panel.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.closest(".booking-section__head, .backend-section__head")) return;
      schedulePricingDirtyState();
    });
  }
  if (els.pricing_deposit_received_btn) {
    els.pricing_deposit_received_btn.addEventListener("click", async () => {
      const armed = applyDefaultDepositReceiptDraft();
      if (!armed) return;
      logBookingSave("[booking-save] Full deposit received requested direct pricing save.", {
        booking_id: state.id || null,
        dirty: { ...state.dirty }
      });
      await savePricing();
    });
  }
  if (els.pricing_management_approval_btn) {
    els.pricing_management_approval_btn.addEventListener("click", async () => {
      await confirmGeneratedOfferByManagementFromPricing();
    });
  }
  if (els.offer_currency_input)
    els.offer_currency_input.addEventListener("change", () => {
      renderOfferCurrencyMenu(els.offer_currency_input, els.offerCurrencyMenuMount);
      void handleOfferCurrencyChange();
    });
  document.addEventListener("booking:offer-currency-sync", () => {
    renderOfferCurrencyMenu(els.offer_currency_input, els.offerCurrencyMenuMount);
  });
  if (els.offer_detail_level_internal_input)
    els.offer_detail_level_internal_input.addEventListener("change", () => {
      void handleOfferInternalDetailLevelChange();
    });
  if (els.offer_detail_level_visible_input)
    els.offer_detail_level_visible_input.addEventListener("change", () => {
      void handleOfferVisibleDetailLevelChange();
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
  if (result && hasUnsavedBookingChanges()) {
    console.warn("[booking-dirty] Booking page loaded with unsaved state after refresh.", {
      booking_id: state.id || null,
      dirty_sections: dirtySectionLabels(),
      diagnostics: currentDirtyDiagnostics()
    });
  }
  return result;
}

async function reloadBookingPageForLatestTravelerData(_personId = "") {
  const latestBookingPayload = await bookingPageDataController.fetchLatestBookingDetail();
  if (!latestBookingPayload?.booking) return false;
  const applied = personsModule.applyLatestTravelerPayload(latestBookingPayload.booking, _personId);
  if (!applied) return false;
  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPersonsEditor();
  return true;
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
  syncContentLanguageSelector();
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

async function recordBookingMilestoneAction(actionKey) {
  const result = await coreModule.recordBookingMilestoneAction(actionKey);
  renderPricingPanel({ preserveDraft: true, markDerivedChangesDirty: true });
  return result;
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

function cloneBooking() {
  return coreModule.cloneBooking();
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

function resolveLatestActivityTimestamp(items = []) {
  let latestTimestamp = "";
  let latestTimeMs = Number.NEGATIVE_INFINITY;
  for (const activity of Array.isArray(items) ? items : []) {
    const candidate = normalizeText(activity?.updated_at) || normalizeText(activity?.created_at);
    if (!candidate) continue;
    const timeMs = new Date(candidate).getTime();
    if (!Number.isFinite(timeMs)) continue;
    if (timeMs > latestTimeMs) {
      latestTimeMs = timeMs;
      latestTimestamp = candidate;
    }
  }
  return latestTimestamp;
}

function renderStaticSectionHeaders() {
  renderBookingSectionHeader(els.personsPanelSummary, { primary: backendT("booking.no_persons", "No persons listed.") });
  renderBookingSectionHeader(els.travel_plan_panel_summary, {
    primary: backendT("booking.travel_plan", "Travel plan"),
    secondary: backendT("booking.no_travel_plan", "No travel plan yet.")
  });
  renderBookingSectionHeader(els.travel_plan_pdf_panel_summary, {
    primary: backendT("booking.travel_plan.travel_plan_pdf", "Travel plan PDF")
  });
  renderBookingSectionHeader(els.offerPanelSummary, { primary: backendT("booking.offer", "Offer") });
  renderBookingSectionHeader(els.offerPaymentTermsPanelSummary, { primary: backendT("booking.payment_terms", "Payment terms") });
  renderBookingSectionHeader(els.bookingConfirmationPanelSummary, {
    primary: backendT("booking.booking_confirmation", "Booking confirmation"),
    secondary: backendT("booking.booking_confirmation_none", "No generated offers yet.")
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
  const items = Array.isArray(payload?.items) ? payload.items : payload?.activities;
  const nextLatestActivityAt = resolveLatestActivityTimestamp(items);
  const latestActivityChanged = nextLatestActivityAt !== state.latestActivityAt;
  state.latestActivityAt = nextLatestActivityAt;
  renderActivitiesTable(items);
  if (latestActivityChanged) {
    renderBookingHeader();
  }
}

function renderPricingPanel(options = {}) {
  const result = pricingModule.renderPricingPanel(options);
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

function confirmGeneratedOfferByManagementFromPricing() {
  return pricingModule.confirmGeneratedOfferByManagement?.();
}

function applyDefaultDepositReceiptDraft() {
  return pricingModule.applyDefaultDepositReceiptDraft();
}

function disarmDepositReceiptConfirmation() {
  return pricingModule.disarmDepositReceiptConfirmation?.();
}

function addOfferComponent() {
  return offerModule.addOfferComponent();
}

function handleOfferCurrencyChange() {
  return offerModule.handleOfferCurrencyChange();
}

function handleOfferInternalDetailLevelChange() {
  return offerModule.handleOfferInternalDetailLevelChange();
}

function handleOfferVisibleDetailLevelChange() {
  return offerModule.handleOfferVisibleDetailLevelChange();
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
  if (!hasUnsavedBookingChanges() || state.pageSaveInFlight || state.pageDiscardInFlight) {
    logBookingSave("[booking-save] Save request returned early.", {
      booking_id: state.id || null,
      reason: !hasUnsavedBookingChanges()
        ? "no_unsaved_changes"
        : state.pageSaveInFlight
          ? "page_save_in_flight"
          : "page_discard_in_flight",
      dirty: { ...state.dirty }
    });
    return true;
  }
  state.pageSaveInFlight = true;
  state.pageDirtyBarStatus = "saving";
  state.pageSaveActionError = "";
  state.pendingSavedCustomerLanguage = "";
  clearError();
  updatePageDirtyBar();
  updateCleanStateActionAvailability();
  const saveStartedAt = Date.now();
  let savePendingWarningTimer = window.setTimeout(() => {
    logBookingSave("[booking-save] Save flow is still pending after 3000ms.", {
      booking_id: state.id || null,
      pending_for_ms: Date.now() - saveStartedAt,
      dirty: { ...state.dirty },
      page_dirty_bar_status: state.pageDirtyBarStatus || ""
    });
  }, 3000);
  logBookingSave("[booking-save] Save flow started.", {
    booking_id: state.id || null,
    dirty: { ...state.dirty },
    page_dirty_bar_status: state.pageDirtyBarStatus || ""
  });
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
      if (!task.shouldRun()) {
        logBookingSave("[booking-save] Skipping clean save task.", {
          booking_id: state.id || null,
          task: task.label
        });
        continue;
      }
      const taskStartedAt = Date.now();
      logBookingSave("[booking-save] Running save task.", {
        booking_id: state.id || null,
        task: task.label
      });
      const saved = await task.run();
      logBookingSave("[booking-save] Save task finished.", {
        booking_id: state.id || null,
        task: task.label,
        duration_ms: Date.now() - taskStartedAt,
        result: saved === false ? "blocked_or_failed" : "completed"
      });
      if (saved === false) {
        logBookingSave("[booking-save] Save flow stopped because a task returned false.", {
          booking_id: state.id || null,
          task: task.label,
          dirty: { ...state.dirty }
        });
        return false;
      }
    }
    if (state.pendingSavedCustomerLanguage) {
      logBookingSave("[booking-save] Reloading booking page to apply saved customer language.", {
        booking_id: state.id || null,
        pending_saved_customer_language: state.pendingSavedCustomerLanguage
      });
      state.contentLang = setBookingContentLang(state.pendingSavedCustomerLanguage);
      state.contentLangInitialized = true;
      updateContentLangInUrl(state.contentLang);
      state.pendingSavedCustomerLanguage = "";
      const reloaded = await loadBookingPage();
      logBookingSave("[booking-save] Booking page reload after language save finished.", {
        booking_id: state.id || null,
        result: reloaded === false ? "failed" : "completed"
      });
      if (reloaded === false) return false;
    }
    clearStatus();
    state.pageDirtyBarStatus = "saved";
    saveCompleted = true;
    logBookingSave("[booking-save] Save flow completed.", {
      booking_id: state.id || null,
      duration_ms: Date.now() - saveStartedAt
    });
    return true;
  } catch (error) {
    logBrowserConsoleError("[booking-save] Save flow threw an error.", {
      booking_id: state.id || null,
      dirty: { ...state.dirty },
      page_dirty_bar_status: state.pageDirtyBarStatus || ""
    }, error);
    throw error;
  } finally {
    if (savePendingWarningTimer) {
      window.clearTimeout(savePendingWarningTimer);
      savePendingWarningTimer = null;
    }
    state.pageSaveInFlight = false;
    if (!saveCompleted) {
      state.pendingSavedCustomerLanguage = "";
    }
    if (!saveCompleted && state.pageDirtyBarStatus === "saving") {
      state.pageDirtyBarStatus = "";
    }
    logBookingSave("[booking-save] Save flow finalized.", {
      booking_id: state.id || null,
      save_completed: saveCompleted,
      duration_ms: Date.now() - saveStartedAt,
      page_dirty_bar_status: state.pageDirtyBarStatus || "",
      dirty: { ...state.dirty }
    });
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
  state.pendingSavedCustomerLanguage = "";
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
  getBookingRevision,
  renderBookingHeader,
  renderActionControls,
  renderBookingData,
  loadActivities,
  escapeHtml,
  captureControlSnapshot,
  setBookingSectionDirty,
  setPageSaveActionError: (message) => {
    state.pageSaveActionError = normalizeText(message);
    updatePageDirtyBar();
  },
  hasUnsavedBookingChanges
});

const travelPlanModule = createBookingTravelPlanModule({
  state,
  els,
  apiOrigin,
  fetchBookingMutation,
  getBookingRevision,
  renderBookingHeader,
  renderBookingData,
  renderOfferPanel,
  renderTravelPlanPanel,
  loadActivities,
  escapeHtml,
  formatDateTime,
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
  fetchApi,
  fetchBookingMutation,
  getBookingRevision,
  renderBookingHeader,
  renderBookingData,
  renderActionControls,
  setBookingSectionDirty,
  updateCleanStateActionAvailability,
  reloadBookingPageForLatestTravelerData
});

const coreModule = createBookingCoreModule({
  state,
  els,
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
  canReadAllBookingsInUi: () => (
    state.roles.includes(ROLES.ADMIN)
    || state.roles.includes(ROLES.MANAGER)
    || state.roles.includes(ROLES.ACCOUNTANT)
  ),
  setBookingSectionDirty,
  hasUnsavedBookingChanges,
  reportPersistedActionBlocked: () => setStatus(cleanStateBlockMessage()),
  updateContentLangInUrl,
  setPendingSavedCustomerLanguage: (lang) => {
    state.pendingSavedCustomerLanguage = normalizeBookingContentLang(lang || "");
  },
  setStatus,
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
