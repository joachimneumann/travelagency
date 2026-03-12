import { GENERATED_ATP_STAFF_ROLES } from "../../Generated/Models/generated_ATPStaff.js";
import { GENERATED_LANGUAGE_CODES } from "../../Generated/Models/generated_Language.js";
import {
  BOOKING_PERSON_SCHEMA,
  GENERATED_BOOKING_STAGES as GENERATED_BOOKING_STAGE_LIST
} from "../../Generated/Models/generated_Booking.js";
import {
  bookingActivitiesRequest,
  bookingDeleteRequest,
  bookingDetailRequest,
  bookingImageRequest,
  bookingNameRequest,
  bookingNotesRequest,
  bookingOwnerRequest,
  bookingPersonCreateRequest,
  bookingPersonDeleteRequest,
  bookingPersonPhotoRequest,
  bookingPersonUpdateRequest,
  bookingStageRequest,
  keycloakUsersRequest,
  tourDetailRequest,
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
import {
  buildDocumentPayloadFromDraft,
  collectPersonEmails,
  collectPersonPhoneNumbers,
  documentHasAnyData,
  formatPersonRoleLabel,
  getAbbreviatedPersonName,
  getPersonDocument,
  getPersonFooterRoleLabel,
  getPersonIdentityStatus,
  getPersonPrimaryRoleLabel,
  getPreferredPersonDocumentType,
  normalizePersonDocumentDraft,
  personHasCompleteAddress,
  personHasCompleteContact,
  personHasCompleteIdentityDocument,
  renderPersonCardStatusLine
} from "../booking/person_helpers.js";
import {
  getBookingPersons,
  getPersonInitials,
  getRepresentativeTraveler,
  isTravelingPerson,
  normalizeStringList
} from "../shared/booking_persons.js";
import { COUNTRY_CODE_OPTIONS } from "../shared/generated_catalogs.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const STAGES = GENERATED_BOOKING_STAGE_LIST;
const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_ATP_STAFF_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

let lastPersonModalTrigger = null;

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

let heroCopyClipboardPoll = null;
let heroCopiedValue = "";
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
  if (els.personsEditorList) els.personsEditorList.addEventListener("click", handlePersonsEditorListClick);
  if (els.personModal) els.personModal.addEventListener("click", handlePersonModalClick);
  if (els.personModal) {
    els.personModal.addEventListener("input", handlePersonModalInput);
    els.personModal.addEventListener("change", handlePersonModalInput);
  }
  if (els.personModalAvatarBtn) els.personModalAvatarBtn.addEventListener("click", triggerPersonPhotoPicker);
  if (els.personModalPhotoInput) {
    els.personModalPhotoInput.addEventListener("change", async () => {
      await uploadPersonPhoto(state.active_person_index, els.personModalPhotoInput);
    });
  }
  if (els.personModalCloseBtn) els.personModalCloseBtn.addEventListener("click", closePersonModal);
  window.addEventListener("keydown", handlePersonModalKeydown);
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
  if (!state.booking) return;
  const primaryContact = getPrimaryContact(state.booking);
  const title = normalizeText(state.booking.name) || primaryContact?.name || getSubmittedContact(state.booking)?.name || "Booking";
  if (els.title) els.title.textContent = title;
  if (els.titleInput && document.activeElement !== els.titleInput) {
    els.titleInput.value = title;
  }
  if (els.titleEditBtn) {
    els.titleEditBtn.hidden = !state.permissions.canEditBooking;
    els.titleEditBtn.disabled = !state.permissions.canEditBooking;
  }
  if (els.heroPhotoBtn) {
    els.heroPhotoBtn.disabled = !state.permissions.canEditBooking;
    els.heroPhotoBtn.classList.toggle("is-editable", state.permissions.canEditBooking);
    els.heroPhotoBtn.setAttribute("aria-label", state.permissions.canEditBooking ? "Change booking picture" : "Booking picture");
  }
  if (els.subtitle) {
    const bookingId = normalizeText(state.booking.id);
    const shortId = bookingId ? bookingId.slice(-6) : "-";
    els.subtitle.textContent = `ID: ${shortId}`;
    els.subtitle.hidden = false;
  }
  if (heroCopiedValue && heroCopiedValue !== getCurrentBookingIdentifier()) {
    clearHeroCopyStatus();
  }
  renderBookingHeroImage();
}

function renderBookingHeroImage() {
  if (!els.heroImage) return;
  const bookingImage = normalizeText(state.booking?.image);
  if (bookingImage) {
    els.heroImage.src = resolveBookingImageSrc(bookingImage);
    els.heroImage.alt = normalizeText(state.booking?.name) || "Booking picture";
    els.heroImage.hidden = false;
    els.heroImage.style.display = "block";
    if (els.heroInitials) els.heroInitials.hidden = true;
    if (els.heroInitials) els.heroInitials.style.display = "none";
    return;
  }

  if (normalizeText(state.tour_image)) {
    els.heroImage.src = resolveBookingImageSrc(state.tour_image);
    els.heroImage.alt = normalizeText(state.booking?.web_form_submission?.booking_name) || "Tour picture";
    els.heroImage.hidden = false;
    els.heroImage.style.display = "block";
    if (els.heroInitials) els.heroInitials.hidden = true;
    if (els.heroInitials) els.heroInitials.style.display = "none";
    return;
  }

  const representativeTraveler = getRepresentativeTraveler(state.booking);

  if (representativeTraveler && normalizeText(representativeTraveler.photo_ref)) {
    els.heroImage.src = resolvePersonPhotoSrc(representativeTraveler.photo_ref);
    els.heroImage.alt = representativeTraveler.name ? `${representativeTraveler.name}` : "";
    els.heroImage.hidden = false;
    els.heroImage.style.display = "block";
    if (els.heroInitials) els.heroInitials.hidden = true;
    if (els.heroInitials) els.heroInitials.style.display = "none";
    return;
  }

  if (representativeTraveler && normalizeText(representativeTraveler.name)) {
    els.heroImage.hidden = true;
    els.heroImage.style.display = "none";
    if (els.heroInitials) {
      els.heroInitials.textContent = getPersonInitials(representativeTraveler.name);
      els.heroInitials.hidden = false;
      els.heroInitials.style.display = "block";
    }
    return;
  }

  els.heroImage.src = "assets/img/profile_person.png";
  els.heroImage.alt = "";
  els.heroImage.hidden = false;
   els.heroImage.style.display = "block";
  if (els.heroInitials) els.heroInitials.hidden = true;
  if (els.heroInitials) els.heroInitials.style.display = "none";
}

function resolvePersonPhotoSrc(photoRef) {
  const imagePath = normalizeText(photoRef) || "assets/img/profile_person.png";
  return /^assets\//.test(imagePath) ? imagePath : resolveApiUrl(apiBase, imagePath);
}

function resolveBookingImageSrc(imageRef) {
  const imagePath = normalizeText(imageRef) || "assets/img/profile_person.png";
  return /^assets\//.test(imagePath) ? imagePath : resolveApiUrl(apiBase, imagePath);
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
  bookingWhatsApp?.rerender(state.booking);
  const booking = state.booking;
  const submittedContact = getSubmittedContact(booking);
  const sections = [{
      title: "Web form submission",
      entries: [
        ["name", booking.web_form_submission?.name || submittedContact?.name],
        ["email", booking.web_form_submission?.email || submittedContact?.email],
        ["phone_number", booking.web_form_submission?.phone_number || submittedContact?.phone_number],
        ["booking_name", booking.web_form_submission?.booking_name],
        ["preferred_language", booking.web_form_submission?.preferred_language],
        ["preferred_currency", booking.web_form_submission?.preferred_currency],
        ["destinations", Array.isArray(booking.web_form_submission?.destinations) ? booking.web_form_submission.destinations.join(", ") : booking.web_form_submission?.destinations],
        ["travel_style", Array.isArray(booking.web_form_submission?.travel_style) ? booking.web_form_submission.travel_style.join(", ") : booking.web_form_submission?.travel_style],
        ["travel_month", booking.web_form_submission?.travel_month],
        ["number_of_travelers", booking.web_form_submission?.number_of_travelers],
        ["travel_duration_days_min", booking.web_form_submission?.travel_duration_days_min],
        ["travel_duration_days_max", booking.web_form_submission?.travel_duration_days_max],
        ["budget_lower_usd", booking.web_form_submission?.budget_lower_usd],
        ["budget_upper_usd", booking.web_form_submission?.budget_upper_usd],
        ["tour_id", booking.web_form_submission?.tour_id],
        ["page_url", booking.web_form_submission?.page_url],
        ["ip_address", booking.web_form_submission?.ip_address],
        ["ip_country_guess", booking.web_form_submission?.ip_country_guess],
        ["referrer", booking.web_form_submission?.referrer],
        ["utm_source", booking.web_form_submission?.utm_source],
        ["utm_medium", booking.web_form_submission?.utm_medium],
        ["utm_campaign", booking.web_form_submission?.utm_campaign],
        ["notes", booking.web_form_submission?.notes],
        ["submitted_at", formatDateTime(booking.web_form_submission?.submitted_at)]
      ]
        .map(([key, value]) => ({ key, value: String(value ?? "-") }))
    }];

  renderSections(sections);
}

function renderSections(sections) {
  if (!els.booking_data_view) return;
  const html = sections
    .map((section) => {
      const rows = (section.entries || [])
        .map((entry) => {
          return `<tr><th>${escapeHtml(entry.key)}</th><td>${escapeHtml(String(entry.value || "-"))}</td></tr>`;
        })
        .join("");
      return `
        <details class="booking-collapsible">
          <summary class="booking-collapsible__summary">${escapeHtml(section.title)}</summary>
          <div class="booking-collapsible__body">
            <div class="backend-table-wrap">
              <table class="backend-table"><tbody>${rows || '<tr><td colspan="2">-</td></tr>'}</tbody></table>
            </div>
          </div>
        </details>
      `;
    })
    .join("");
  els.booking_data_view.innerHTML = html;
}

function renderActionControls() {
  if (!state.booking) return;

  if (els.stageSelect) {
    const options = STAGES.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("");
    els.stageSelect.innerHTML = options;
    els.stageSelect.value = state.booking.stage || STAGES[0];
  }

  if (els.ownerSelect) {
    const currentOwnerId = normalizeText(state.booking.assigned_keycloak_user_id);
    const knownOwners = new Map((state.keycloakUsers || []).map((user) => [String(user.id || ""), user]));
    const currentOwner = knownOwners.get(currentOwnerId) || resolveCurrentAuthKeycloakUser(currentOwnerId);
    const currentOwnerName = displayKeycloakUser(currentOwner) || currentOwnerId;
    if (currentOwnerId && currentOwnerName && !knownOwners.has(currentOwnerId)) {
      knownOwners.set(currentOwnerId, {
        id: currentOwnerId,
        name: displayKeycloakUser(currentOwner) || currentOwnerId,
        username: normalizeText(currentOwner?.username) || null
      });
    }

    const options = state.permissions.canChangeAssignment
      ? ['<option value="">Unassigned</option>']
          .concat([...knownOwners.values()].map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(displayKeycloakUser(user) || user.id)}</option>`))
          .join("")
      : currentOwnerId
        ? `<option value="${escapeHtml(currentOwnerId)}">${escapeHtml(currentOwnerName || "Assigned user")}</option>`
        : '<option value="">Unassigned</option>';
    els.ownerSelect.innerHTML = options;
    els.ownerSelect.value = currentOwnerId || "";
    els.ownerSelect.disabled = !state.permissions.canChangeAssignment;
  }

  if (els.stageSelect) els.stageSelect.disabled = !state.permissions.canChangeStage;
  if (els.noteInput) {
    els.noteInput.disabled = !state.permissions.canEditBooking;
    els.noteInput.value = state.booking.notes || "";
  }
  state.originalNote = String(state.booking.notes || "");
  if (els.noteSaveBtn) {
    els.noteSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";
    updateNoteSaveButtonState();
  }
  if (els.invoice_create_btn) els.invoice_create_btn.style.display = state.permissions.canEditBooking ? "" : "none";
  if (els.deleteBtn) {
    els.deleteBtn.style.display = state.permissions.canEditBooking ? "" : "none";
    els.deleteBtn.disabled = !state.permissions.canEditBooking;
  }
}

function applyBookingPayload(payload = {}) {
  const active_person_id = state.active_person_id;
  const previousTourId = normalizeText(state.booking?.web_form_submission?.tour_id);
  state.booking = payload.booking || state.booking || null;
  const nextTourId = normalizeText(state.booking?.web_form_submission?.tour_id);
  if (normalizeText(state.booking?.image)) {
    state.tour_image = "";
    state.tour_image_tour_id = "";
  } else if (nextTourId !== previousTourId) {
    state.tour_image = "";
    state.tour_image_tour_id = "";
  }
  state.personDrafts = getBookingPersons(state.booking).map(clonePersonDraft);
  if (active_person_id) {
    state.active_person_index = state.personDrafts.findIndex((person) => person.id === active_person_id);
    if (state.active_person_index < 0) {
      state.active_person_id = "";
      finalizeClosePersonModal();
    } else {
      state.active_person_id = state.personDrafts[state.active_person_index]?.id || "";
    }
  }
  markPersonsSnapshotClean();
}

async function ensureTourImageLoaded() {
  if (!state.booking) return;
  if (normalizeText(state.booking.image)) {
    state.tour_image = "";
    state.tour_image_tour_id = "";
    return;
  }
  const tourId = normalizeText(state.booking?.web_form_submission?.tour_id);
  if (!tourId) {
    state.tour_image = "";
    state.tour_image_tour_id = "";
    return;
  }
  if (state.tour_image_tour_id === tourId) return;

  const request = tourDetailRequest({ baseURL: apiOrigin, params: { tour_id: tourId } });
  const payload = await fetchApi(request.url);
  if (!payload?.tour) return;
  if (normalizeText(state.booking?.web_form_submission?.tour_id) !== tourId) return;
  state.tour_image_tour_id = tourId;
  state.tour_image = normalizeText(payload.tour.image) || "";
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

function getDisplayedTravelerCount() {
  return state.personDrafts.filter((person) => !person?._is_new && isTravelingPerson(person)).length;
}

function buildTravelerMismatchMessage(booking) {
  const declared = Number(booking?.web_form_submission?.number_of_travelers || 0);
  if (!declared) return "";
  const listed = getDisplayedTravelerCount();
  if (declared === listed) return "";
  const declaredLabel = `${declared} traveler${declared === 1 ? "" : "s"}`;
  if (listed < declared) {
    const listedLabel = listed === 1 ? "one traveler only" : `${listed} travelers only`;
    return `The web form indicates ${declaredLabel}, but this booking currently has ${listedLabel}.`;
  }
  if (listed === 1) {
    return `The web form indicates ${declaredLabel}, but this booking currently has one traveler.`;
  }
  return `The web form indicates ${declaredLabel}, but this booking currently has ${listed} travelers.`;
}

function renderTravelerMismatchWarning() {
  if (!els.personsMismatchWarning) return;
  const message = buildTravelerMismatchMessage(state.booking);
  els.personsMismatchWarning.textContent = message;
  els.personsMismatchWarning.hidden = !message;
}

function clonePersonDraft(person = {}, index = 0) {
  return {
    _is_new: false,
    id: normalizeText(person.id) || `${state.id || "booking"}_person_${index + 1}`,
    name: normalizeText(person.name) || "",
    photo_ref: normalizeText(person.photo_ref) || "",
    emails: Array.isArray(person.emails) ? [...person.emails] : [],
    phone_numbers: Array.isArray(person.phone_numbers) ? [...person.phone_numbers] : [],
    preferred_language: normalizeText(person.preferred_language) || "",
    date_of_birth: normalizeText(person.date_of_birth) || "",
    nationality: normalizeText(person.nationality) || "",
    address: person.address && typeof person.address === "object" ? { ...person.address } : {},
    roles: normalizeStringList(person.roles),
    consents: Array.isArray(person.consents) ? person.consents.map((consent) => ({ ...consent })) : [],
    documents: Array.isArray(person.documents)
      ? person.documents.map((document) => normalizePersonDocumentDraft(document, normalizeText(document?.document_type) || "other"))
      : [],
    notes: normalizeText(person.notes) || ""
  };
}

function buildEmptyPersonDraft() {
  return {
    _is_new: true,
    id: `${state.id || "booking"}_person_${Date.now()}`,
    name: "",
    photo_ref: "",
    emails: [],
    phone_numbers: [],
    preferred_language: "",
    date_of_birth: "",
    nationality: "",
    address: {},
    roles: ["traveler"],
    consents: [],
    documents: [],
    notes: ""
  };
}

function ensurePersonDocument(draft, document_type) {
  if (!draft) return null;
  draft.documents = Array.isArray(draft.documents) ? draft.documents : [];
  const existing = getPersonDocument(draft, document_type);
  if (existing) return existing;
  const document = normalizePersonDocumentDraft(
    {
      id: `${normalizeText(draft.id) || state.id || "booking"}_${document_type}`,
      document_type
    },
    document_type
  );
  draft.documents.push(document);
  return document;
}

function pruneEmptyPersonDocuments(draft) {
  if (!draft) return;
  draft.documents = (Array.isArray(draft.documents) ? draft.documents : []).filter(documentHasAnyData);
}

function updatePersonDocumentField(draft, document_type, field, value) {
  if (!draft) return;
  const normalized_value = field === "issuing_country"
    ? normalizeText(value).toUpperCase()
    : field === "no_expiration_date"
      ? value === true
      : String(value || "");
  const document = ensurePersonDocument(draft, document_type);
  if (!document) return;
  document[field] = normalized_value;
  if (document_type === "national_id" && field === "no_expiration_date" && normalized_value === true) {
    document.expires_on = "";
  }
  document.document_type = document_type;
  const timestamp = new Date().toISOString();
  document.created_at = normalizeText(document.created_at) || timestamp;
  document.updated_at = timestamp;
  pruneEmptyPersonDocuments(draft);
}

function getPersonTravelDocumentStatus(person) {
  if (personHasCompleteIdentityDocument(person, "passport")) {
    return { is_complete: true, label: "OK Passport" };
  }
  if (personHasCompleteIdentityDocument(person, "national_id")) {
    return { is_complete: true, label: "OK ID card" };
  }
  return { is_complete: false, label: "Incomplete" };
}


function serializePersonDrafts(drafts = state.personDrafts) {
  return JSON.stringify(
    (Array.isArray(drafts) ? drafts : []).map((draft, index) => buildPersonPayloadFromDraft(draft, index))
  );
}

function markPersonsSnapshotClean() {
  state.originalPersonsSnapshot = serializePersonDrafts();
  setBookingSectionDirty("persons", false);
  updatePersonsEditorSaveButton();
}

function updatePersonsDirtyState() {
  const isDirty = state.permissions.canEditBooking && serializePersonDrafts() !== state.originalPersonsSnapshot;
  setBookingSectionDirty("persons", isDirty);
  updatePersonsEditorSaveButton();
}

function setPersonsEditorStatus(message) {
  if (!els.personsEditorStatus) return;
  els.personsEditorStatus.textContent = message || "";
}

function updatePersonsEditorSaveButton() {
  if (!els.personsEditorSaveBtn) return;
  const isDirty = Boolean(state.dirty.persons) && state.permissions.canEditBooking;
  els.personsEditorSaveBtn.disabled = !isDirty;
}

function clearPersonsAutosaveTimer() {
  if (state.persons_autosave_timer) {
    window.clearTimeout(state.persons_autosave_timer);
    state.persons_autosave_timer = null;
  }
  state.persons_autosave_person_id = "";
}

function getBookingRevision(field) {
  const value = Number(state.booking?.[field]);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function schedulePersonsAutosave(person_id = state.active_person_id, delay_ms = 700) {
  if (!state.permissions.canEditBooking || !state.booking) return;
  const targetPersonId = normalizeText(person_id) || normalizeText(state.active_person_id);
  if (!targetPersonId) return;
  clearPersonsAutosaveTimer();
  state.persons_autosave_person_id = targetPersonId;
  state.persons_autosave_timer = window.setTimeout(() => {
    state.persons_autosave_timer = null;
    const autosavePersonId = state.persons_autosave_person_id;
    state.persons_autosave_person_id = "";
    void savePersonDrafts(autosavePersonId);
  }, delay_ms);
}

function buildPersonPayloadFromDraft(draft, index) {
  const address = draft?.address && typeof draft.address === "object" ? {
    line_1: normalizeText(draft.address.line_1),
    line_2: normalizeText(draft.address.line_2),
    city: normalizeText(draft.address.city),
    state_region: normalizeText(draft.address.state_region),
    postal_code: normalizeText(draft.address.postal_code),
    country_code: normalizeText(draft.address.country_code).toUpperCase()
  } : {};
  const cleanedAddress = Object.fromEntries(Object.entries(address).filter(([, value]) => value));

  return {
    id: normalizeText(draft?.id) || `${state.id || "booking"}_person_${index + 1}`,
    name: normalizeText(draft?.name) || "",
    photo_ref: normalizeText(draft?.photo_ref) || undefined,
    emails: collectCommaSeparatedValues(draft?.emails),
    phone_numbers: collectCommaSeparatedValues(draft?.phone_numbers),
    preferred_language: normalizeText(draft?.preferred_language) || undefined,
    date_of_birth: normalizeText(draft?.date_of_birth) || undefined,
    nationality: normalizeText(draft?.nationality).toUpperCase() || undefined,
    address: Object.keys(cleanedAddress).length ? cleanedAddress : undefined,
    roles: normalizeStringList(draft?.roles),
    consents: Array.isArray(draft?.consents) ? draft.consents.map((consent) => ({ ...consent })) : [],
    documents: (Array.isArray(draft?.documents) ? draft.documents : [])
      .map((document, document_index) => buildDocumentPayloadFromDraft(document, draft?.id, state.id || "booking", document_index))
      .filter(Boolean),
    notes: normalizeText(draft?.notes) || undefined
  };
}

function personDraftHasMeaningfulInput(draft) {
  if (!draft || typeof draft !== "object") return false;
  const roles = normalizeStringList(draft.roles);
  const hasNonDefaultRoles = roles.length !== 1 || roles[0] !== "traveler";
  const addressValues = draft.address && typeof draft.address === "object" ? Object.values(draft.address) : [];
  return Boolean(
    normalizeText(draft.name) ||
    normalizeText(draft.photo_ref) ||
    collectCommaSeparatedValues(draft.emails).length ||
    collectCommaSeparatedValues(draft.phone_numbers).length ||
    normalizeText(draft.preferred_language) ||
    normalizeText(draft.date_of_birth) ||
    normalizeText(draft.nationality) ||
    addressValues.some((value) => normalizeText(value)) ||
    hasNonDefaultRoles ||
    (Array.isArray(draft.consents) && draft.consents.length) ||
    (Array.isArray(draft.documents) && draft.documents.some(documentHasAnyData)) ||
    normalizeText(draft.notes)
  );
}

function collectCommaSeparatedValues(values) {
  const items = Array.isArray(values) ? values : String(values || "").split(",");
  return Array.from(new Set(items.map((value) => normalizeText(value)).filter(Boolean)));
}

function renderPersonsEditor({ include_modal = true } = {}) {
  if (!els.personsEditorList) return;
  const canEdit = state.permissions.canEditBooking;

  const person_cards = state.personDrafts.map((person, index) => {
      const person_name = normalizeText(person.name);
      const title = person_name || "Unnamed person";
      const identity = getPersonIdentityStatus(person);
      const hasCompleteContact = personHasCompleteContact(person);
      const hasCompleteAddress = personHasCompleteAddress(person);
      const role_label = getPersonFooterRoleLabel(person);
      const photo_src = resolvePersonPhotoSrc(person.photo_ref);
      const initials = getPersonInitials(title);
      const status_markup = [
        renderPersonCardStatusLine(identity.label, identity.is_complete),
        renderPersonCardStatusLine("Contact", hasCompleteContact),
        renderPersonCardStatusLine("Address", hasCompleteAddress)
      ].join("");
      const image_markup = normalizeText(person.photo_ref)
        ? `<img src="${escapeHtml(photo_src)}" alt="${escapeHtml(title)}" />`
        : !person_name
          ? `<img src="assets/img/profile_person.png" alt="" />`
        : `<span class="booking-person-card__initials">${escapeHtml(initials)}</span>`;
      return `
        <button class="booking-person-card" type="button" data-person-card="${index}">
          <span class="booking-person-card__media">${image_markup}</span>
          <span class="booking-person-card__content">
            <span class="booking-person-card__title">${escapeHtml(title)}</span>
            <span class="booking-person-card__status-list">${status_markup}</span>
            <span class="booking-person-card__subtitle"></span>
          </span>
          <span class="booking-person-card__role-footer">${escapeHtml(role_label)}</span>
        </button>
      `;
    });

  const add_card = canEdit ? `
    <button class="booking-person-card booking-person-card--add" type="button" data-person-add="true" aria-label="Add person">
      <span class="booking-person-card__add-layout">
        <span class="booking-person-card__media booking-person-card__media--add">
          <img src="assets/img/profile_person.png" alt="" />
        </span>
        <span class="booking-person-card__add-cta">
          <span class="booking-person-card__add-button">new</span>
        </span>
      </span>
    </button>
  ` : "";

  if (!person_cards.length && !add_card) {
    els.personsEditorList.innerHTML = `<div class="booking-person-card__empty">No persons listed on this booking.</div>`;
    finalizeClosePersonModal();
    updatePersonsEditorSaveButton();
    return;
  }

  els.personsEditorList.innerHTML = `${person_cards.join("")}${add_card}`;

  if (include_modal) renderPersonModal();
  renderTravelerMismatchWarning();
  updatePersonsEditorSaveButton();
}

function handlePersonsEditorListClick(event) {
  const add_card = event.target.closest("[data-person-add]");
  if (add_card) {
    lastPersonModalTrigger = add_card;
    addPersonDraft();
    return;
  }
  const card = event.target.closest("[data-person-card]");
  if (!card) return;
  const index = Number(card.getAttribute("data-person-card"));
  if (!Number.isInteger(index) || index < 0 || index >= state.personDrafts.length) return;
  lastPersonModalTrigger = card;
  openPersonModal(index);
}

function addPersonDraft() {
  if (!state.permissions.canEditBooking || !state.booking) return;
  const draft = buildEmptyPersonDraft();
  state.personDrafts.push(draft);
  renderPersonsEditor();
  updatePersonsDirtyState();
  openPersonModal(state.personDrafts.length - 1);
  setPersonsEditorStatus("");
}

async function savePersonDrafts(person_id = state.active_person_id) {
  if (!state.permissions.canEditBooking || !state.booking) return false;
  if (!state.dirty.persons) return true;
  if (state.persons_save_in_flight) {
    state.persons_save_queued = true;
    return await state.persons_save_in_flight;
  }
  const targetPersonId = normalizeText(person_id) || normalizeText(state.active_person_id);
  const personIndex = state.personDrafts.findIndex((draft) => draft.id === targetPersonId);
  const currentDraft = personIndex >= 0 ? state.personDrafts[personIndex] : null;
  if (!currentDraft) return false;
  clearPersonsAutosaveTimer();
  const isNewDraft = currentDraft._is_new === true;
  if (isNewDraft && !personDraftHasMeaningfulInput(currentDraft)) return true;
  const request = isNewDraft
    ? bookingPersonCreateRequest({
        baseURL: apiOrigin,
        params: { booking_id: state.booking.id }
      })
    : bookingPersonUpdateRequest({
        baseURL: apiOrigin,
        params: { booking_id: state.booking.id, person_id: targetPersonId }
      });
  const existingPersonIds = new Set(getBookingPersons(state.booking).map((person) => person.id));
  const activeLocalPersonId = normalizeText(state.active_person_id);
  const save_operation = (async () => {
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_persons_revision: getBookingRevision("persons_revision"),
        person: buildPersonPayloadFromDraft(currentDraft, personIndex),
        actor: state.user
      }
    });
    if (!result?.booking) return false;

    const createdPersonId = isNewDraft
      ? normalizeText(
          result.booking?.persons?.find((person) => !existingPersonIds.has(normalizeText(person?.id)))?.id ||
          result.booking?.persons?.[result.booking.persons.length - 1]?.id
        )
      : "";
    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    if (isNewDraft && activeLocalPersonId === targetPersonId && createdPersonId) {
      const createdIndex = state.personDrafts.findIndex((person) => person.id === createdPersonId);
      if (createdIndex >= 0) openPersonModal(createdIndex);
    }
    return true;
  })();
  state.persons_save_in_flight = save_operation;
  const saved = await save_operation;
  state.persons_save_in_flight = null;
  if (state.persons_save_queued) {
    state.persons_save_queued = false;
    if (state.dirty.persons) void savePersonDrafts();
  }
  return saved;
}

function openPersonModal(index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.personDrafts.length) return;
  state.active_person_index = index;
  state.active_person_id = state.personDrafts[index]?.id || "";
  state.active_person_document_type = getPreferredPersonDocumentType(state.personDrafts[index]);
  renderPersonModal();
  if (els.personModal) els.personModal.hidden = false;
}

function finalizeClosePersonModal() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && els.personModal?.contains(activeElement)) {
    activeElement.blur();
  }
  if (els.personModal) els.personModal.hidden = true;
  state.active_person_index = -1;
  state.active_person_id = "";
  state.active_person_document_type = "passport";
  if (els.personModalPhotoInput) els.personModalPhotoInput.value = "";
  if (lastPersonModalTrigger instanceof HTMLElement && document.contains(lastPersonModalTrigger)) {
    lastPersonModalTrigger.focus();
  }
}

async function closePersonModal() {
  const activeIndex = state.active_person_index;
  const draft = state.personDrafts[activeIndex];
  clearPersonsAutosaveTimer();
  if (draft?._is_new && !personDraftHasMeaningfulInput(draft)) {
    state.personDrafts.splice(activeIndex, 1);
    finalizeClosePersonModal();
    renderPersonsEditor({ include_modal: false });
    updatePersonsDirtyState();
    setPersonsEditorStatus("");
    return;
  }
  if (draft && state.permissions.canEditBooking && state.dirty.persons) {
    const saved = await savePersonDrafts(draft.id);
    if (!saved && personDraftHasMeaningfulInput(draft)) return;
  }
  finalizeClosePersonModal();
}

function triggerPersonPhotoPicker() {
  const draft = state.personDrafts[state.active_person_index];
  if (!state.permissions.canEditBooking || !draft || draft._is_new) {
    return;
  }
  if (els.personModalPhotoInput) els.personModalPhotoInput.click();
}

function handlePersonModalKeydown(event) {
  if (event.key !== "Escape" || els.personModal?.hidden !== false) return;
  void closePersonModal();
}

function handleBookingDetailKeydown(event) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (els.personModal?.hidden === false) return;
  if (!els.titleInput?.hidden) return;
  if (event.target === els.titleInput) return;
  event.preventDefault();
  closeBookingDetailScreen();
}

function renderPersonModal() {
  if (!els.personModal) return;
  const draft = state.personDrafts[state.active_person_index];
  const is_open = els.personModal.hidden === false;
  if (!draft) {
    if (is_open) finalizeClosePersonModal();
    return;
  }

  const can_edit = state.permissions.canEditBooking;
  const person_name = normalizeText(draft.name);
  const title = person_name || "Unnamed person";
  const initials = getPersonInitials(title);
  const photo_src = resolvePersonPhotoSrc(draft.photo_ref);

  if (els.personModalSubtitle) {
    els.personModalSubtitle.textContent = `${getPersonPrimaryRoleLabel(draft)}`;
  }
  if (els.personModalPhoto) {
    const show_profile_image = Boolean(normalizeText(draft.photo_ref)) || !person_name;
    els.personModalPhoto.src = normalizeText(draft.photo_ref) ? photo_src : "assets/img/profile_person.png";
    els.personModalPhoto.alt = normalizeText(draft.photo_ref) ? title : "";
    els.personModalPhoto.hidden = !show_profile_image;
    els.personModalPhoto.style.display = show_profile_image ? "block" : "none";
  }
  if (els.personModalInitials) {
    els.personModalInitials.textContent = initials;
    const show_initials = !normalizeText(draft.photo_ref) && Boolean(person_name);
    els.personModalInitials.hidden = !show_initials;
    els.personModalInitials.style.display = show_initials ? "block" : "none";
  }
  if (els.personModalName) {
    els.personModalName.value = normalizeText(draft.name) || "";
    els.personModalName.disabled = !can_edit;
  }
  if (els.personModalPreferredLanguage) {
    els.personModalPreferredLanguage.innerHTML = [
      '<option value="">Select language</option>',
      ...GENERATED_LANGUAGE_CODES.map((language) => `<option value="${escapeHtml(language)}">${escapeHtml(language)}</option>`)
    ].join("");
    els.personModalPreferredLanguage.value = normalizeText(draft.preferred_language) || "";
    els.personModalPreferredLanguage.disabled = !can_edit;
  }
  if (els.personModalDateOfBirth) {
    els.personModalDateOfBirth.value = normalizeText(draft.date_of_birth) || "";
    els.personModalDateOfBirth.disabled = !can_edit;
  }
  if (els.personModalNationality) {
    populateCountryCodeSelect(els.personModalNationality, "Select nationality");
    els.personModalNationality.value = normalizeText(draft.nationality) || "";
    els.personModalNationality.disabled = !can_edit;
  }
  if (els.personModalEmails) {
    els.personModalEmails.value = collectCommaSeparatedValues(draft.emails).join(", ");
    els.personModalEmails.disabled = !can_edit;
  }
  if (els.personModalPhoneNumbers) {
    els.personModalPhoneNumbers.value = collectCommaSeparatedValues(draft.phone_numbers).join(", ");
    els.personModalPhoneNumbers.disabled = !can_edit;
  }
  if (els.personModalRoles) {
    els.personModalRoles.innerHTML = BOOKING_PERSON_ROLE_OPTIONS.map((role) => `
      <label class="booking-person-modal__role">
        <input type="checkbox" data-person-role="${escapeHtml(role)}" ${draft.roles.includes(role) ? "checked" : ""} ${can_edit ? "" : "disabled"} />
        <span>${escapeHtml(formatPersonRoleLabel(role))}</span>
      </label>
    `).join("");
  }

  const passport = getPersonDocument(draft, "passport") || normalizePersonDocumentDraft({}, "passport");
  const national_id = getPersonDocument(draft, "national_id") || normalizePersonDocumentDraft({}, "national_id");
  const active_document_type = state.active_person_document_type || getPreferredPersonDocumentType(draft);
  const field_bindings = [
    [els.personModalAddressLine1, normalizeText(draft.address?.line_1) || ""],
    [els.personModalAddressLine2, normalizeText(draft.address?.line_2) || ""],
    [els.personModalCity, normalizeText(draft.address?.city) || ""],
    [els.personModalStateRegion, normalizeText(draft.address?.state_region) || ""],
    [els.personModalPostalCode, normalizeText(draft.address?.postal_code) || ""],
    [els.personModalCountryCode, normalizeText(draft.address?.country_code) || ""],
    [els.personModalNotes, normalizeText(draft.notes) || ""],
    [document.getElementById("booking_person_modal_passport_holder_name"), normalizeText(passport.holder_name) || ""],
    [document.getElementById("booking_person_modal_passport_number"), normalizeText(passport.document_number) || ""],
    [document.getElementById("booking_person_modal_passport_issuing_country"), normalizeText(passport.issuing_country) || ""],
    [document.getElementById("booking_person_modal_passport_issued_on"), normalizeText(passport.issued_on) || ""],
    [document.getElementById("booking_person_modal_passport_expires_on"), normalizeText(passport.expires_on) || ""],
    [document.getElementById("booking_person_modal_national_id_holder_name"), normalizeText(national_id.holder_name) || ""],
    [document.getElementById("booking_person_modal_national_id_number"), normalizeText(national_id.document_number) || ""],
    [document.getElementById("booking_person_modal_national_id_issuing_country"), normalizeText(national_id.issuing_country) || ""],
    [document.getElementById("booking_person_modal_national_id_issued_on"), normalizeText(national_id.issued_on) || ""],
    [document.getElementById("booking_person_modal_national_id_expires_on"), normalizeText(national_id.expires_on) || ""]
  ];
  field_bindings.forEach(([element, value]) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return;
    element.value = value;
    element.disabled = !can_edit;
  });
  const national_id_no_expiration_input = document.getElementById("booking_person_modal_national_id_no_expiration_date");
  if (national_id_no_expiration_input instanceof HTMLInputElement) {
    national_id_no_expiration_input.checked = national_id.no_expiration_date === true;
    national_id_no_expiration_input.disabled = !can_edit;
  }
  updateNationalIdExpirationInputState(can_edit);
  if (els.personModalPhotoInput) els.personModalPhotoInput.disabled = !can_edit || draft._is_new;
  if (els.personModalAvatarBtn) els.personModalAvatarBtn.disabled = !can_edit || draft._is_new;
  if (els.personModalDeleteBtn) {
    els.personModalDeleteBtn.disabled = !can_edit;
    els.personModalDeleteBtn.style.display = can_edit ? "" : "none";
  }
  updatePersonModalDocumentSwitcher(draft, active_document_type, can_edit);
}

function updatePersonModalDocumentSwitcher(draft, active_document_type, can_edit) {
  const passport_switch = document.getElementById("booking_person_modal_switch_passport");
  const national_id_switch = document.getElementById("booking_person_modal_switch_national_id");
  const switches = [
    [passport_switch, "passport", "Passport"],
    [national_id_switch, "national_id", "ID card"]
  ];
  switches.forEach(([button, document_type, label]) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const is_active = active_document_type === document_type;
    const is_complete = personHasCompleteIdentityDocument(draft, document_type);
    button.classList.toggle("is-active", is_active);
    button.setAttribute("aria-selected", String(is_active));
    button.disabled = !can_edit;
    button.innerHTML = is_complete
      ? `${escapeHtml(label)} <span class="booking-person-modal__document-switch-check" aria-hidden="true">&#10003;</span>`
      : escapeHtml(label);
  });
  document.querySelectorAll("[data-document-panel]").forEach((panel) => {
    const matches = panel.getAttribute("data-document-panel") === active_document_type;
    panel.hidden = !matches;
    panel.style.display = matches ? "" : "none";
  });

  const abbreviated_name = getAbbreviatedPersonName(draft?.name);
  const nationality_code = normalizeText(draft?.nationality).toUpperCase() || "Code";
  Object.entries(PERSON_MODAL_AUTOFILL_CONFIG).forEach(([id, config]) => {
    const button = document.getElementById(id);
    if (!(button instanceof HTMLButtonElement)) return;
    const is_active = config.document_type === active_document_type;
    button.hidden = !is_active;
    button.disabled = !can_edit;
    button.textContent = config.source === "name" ? abbreviated_name : nationality_code;
  });
}

function updateNationalIdExpirationInputState(can_edit = state.permissions.canEditBooking) {
  const expires_input = document.getElementById("booking_person_modal_national_id_expires_on");
  const no_expiration_input = document.getElementById("booking_person_modal_national_id_no_expiration_date");
  if (!(expires_input instanceof HTMLInputElement)) return;
  const no_expiration = no_expiration_input instanceof HTMLInputElement && no_expiration_input.checked;
  expires_input.disabled = !can_edit || no_expiration;
}

function refreshOpenPersonModalHeader() {
  const draft = state.personDrafts[state.active_person_index];
  if (!draft) return;
  if (els.personModalSubtitle) {
    els.personModalSubtitle.textContent = `${getPersonPrimaryRoleLabel(draft)}`;
  }
  if (els.personModalInitials && !normalizeText(draft.photo_ref)) {
    els.personModalInitials.textContent = getPersonInitials(draft.name);
  }
}

function handlePersonModalInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  const draft = state.personDrafts[state.active_person_index];
  if (!draft) return;

  if (target.dataset.personRole) {
    const role = normalizeText(target.dataset.personRole);
    const next_roles = new Set(draft.roles);
    if (target.checked) next_roles.add(role);
    else next_roles.delete(role);
    draft.roles = Array.from(next_roles);
  } else if (target.dataset.addressField) {
    draft.address = draft.address && typeof draft.address === "object" ? draft.address : {};
    const field = String(target.dataset.addressField || "");
    draft.address[field] = field === "country_code" ? normalizeText(target.value).toUpperCase() : target.value;
  } else if (target.dataset.documentField && target.dataset.documentType) {
    const document_field = target.dataset.documentField;
    const next_value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
    updatePersonDocumentField(draft, target.dataset.documentType, document_field, next_value);
    if (document_field === "no_expiration_date") {
      updateNationalIdExpirationInputState(state.permissions.canEditBooking);
      if (target instanceof HTMLInputElement && target.checked) {
        const national_id_expires_input = document.getElementById("booking_person_modal_national_id_expires_on");
        if (national_id_expires_input instanceof HTMLInputElement) national_id_expires_input.value = "";
      }
    }
  } else if (target.dataset.personField) {
    const field = String(target.dataset.personField || "");
    if (field === "emails" || field === "phone_numbers") {
      draft[field] = collectCommaSeparatedValues(target.value);
    } else if (field === "nationality") {
      draft[field] = normalizeText(target.value).toUpperCase();
      target.value = draft[field];
    } else {
      draft[field] = target.value;
    }
  } else {
    return;
  }

  renderPersonsEditor({ include_modal: false });
  refreshOpenPersonModalHeader();
  updatePersonModalDocumentSwitcher(
    draft,
    state.active_person_document_type || getPreferredPersonDocumentType(draft),
    state.permissions.canEditBooking
  );
  updatePersonsDirtyState();
  schedulePersonsAutosave(draft.id);
}

async function handlePersonModalClick(event) {
  if (event.target === els.personModal) {
    await closePersonModal();
    return;
  }
  const draft = state.personDrafts[state.active_person_index];
  if (!draft) return;
  const document_switch = event.target.closest("[data-document-switch]");
  if (document_switch) {
    state.active_person_document_type = normalizeText(document_switch.getAttribute("data-document-switch")) || "passport";
    renderPersonModal();
    return;
  }
  const autofill_button = event.target.closest(".booking-person-modal__autofill-btn");
  if (autofill_button) {
    const config = PERSON_MODAL_AUTOFILL_CONFIG[autofill_button.id];
    if (!config) return;
    const source_value = config.source === "name"
      ? normalizeText(draft.name)
      : normalizeText(draft.nationality).toUpperCase();
    if (!source_value) return;
    updatePersonDocumentField(draft, config.document_type, config.field, source_value);
    renderPersonsEditor({ include_modal: false });
    renderPersonModal();
    updatePersonsDirtyState();
    schedulePersonsAutosave(draft.id);
    return;
  }
  if (event.target.closest("#booking_person_modal_delete_btn")) {
    if (!window.confirm(`Remove ${normalizeText(draft.name) || "this person"} from the booking?`)) return;
    if (draft._is_new) {
      state.personDrafts.splice(state.active_person_index, 1);
      finalizeClosePersonModal();
      renderPersonsEditor();
      updatePersonsDirtyState();
      return;
    }
    const request = bookingPersonDeleteRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id, person_id: draft.id }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_persons_revision: getBookingRevision("persons_revision"),
        actor: state.user
      }
    });
    if (!result?.booking) return;
    finalizeClosePersonModal();
    applyBookingPayload(result);
    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    return;
  }
}

async function uploadPersonPhoto(index, input = els.personModalPhotoInput) {
  if (!state.permissions.canEditBooking || !state.booking) return;
  const person = state.personDrafts[index];
  if (!person || person._is_new) {
    return;
  }
  const file = input?.files?.[0] || null;
  if (!file) {
    return;
  }
  const base64 = await fileToBase64(file);
  const request = bookingPersonPhotoRequest({
    baseURL: apiOrigin,
    params: { booking_id: state.booking.id, person_id: person.id }
  });
  const result = await fetchBookingMutation(request.url, {
    method: request.method,
    body: {
      expected_persons_revision: getBookingRevision("persons_revision"),
      filename: file.name,
      data_base64: base64,
      actor: state.user
    }
  });
  if (!result?.booking) return;

  applyBookingPayload(result);
  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPersonsEditor();
  if (state.active_person_index >= 0) openPersonModal(state.active_person_index);
}

function triggerBookingPhotoPicker() {
  if (!state.permissions.canEditBooking) return;
  els.heroPhotoInput?.click();
}

async function uploadBookingPhoto() {
  if (!state.permissions.canEditBooking || !state.booking) return;
  const file = els.heroPhotoInput?.files?.[0] || null;
  if (!file) return;
  const base64 = await fileToBase64(file);
  const request = bookingImageRequest({
    baseURL: apiOrigin,
    params: { booking_id: state.booking.id }
  });
  const result = await fetchBookingMutation(request.url, {
    method: request.method,
    body: {
      expected_core_revision: getBookingRevision("core_revision"),
      filename: file.name,
      data_base64: base64,
      actor: state.user
    }
  });
  if (els.heroPhotoInput) els.heroPhotoInput.value = "";
  if (!result?.booking) return;
  applyBookingPayload(result);
  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPersonsEditor();
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
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
  const request = bookingDeleteRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
  const result = await fetchApi(request.url, {
    method: request.method,
    body: {
      expected_core_revision: getBookingRevision("core_revision")
    }
  });
  if (els.deleteBtn) els.deleteBtn.disabled = false;
  if (!result?.deleted) return;

  window.location.href = "backend.html?section=bookings";
}

async function saveBookingName(next_name_override = null) {
  if (!state.permissions.canEditBooking || !state.booking) return;
  const nextName = normalizeText(next_name_override ?? els.titleInput?.value) || "";
  const previousName = normalizeText(state.booking.name) || "";
  state.booking.name = nextName;
  renderBookingHeader();
  const request = bookingNameRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
  const result = await fetchBookingMutation(request.url, {
    method: request.method,
    body: {
      expected_core_revision: getBookingRevision("core_revision"),
      name: nextName,
      actor: state.user
    }
  });
  if (!result?.booking) {
    state.booking.name = previousName;
    renderBookingHeader();
    return;
  }

  applyBookingPayload(result);
  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPersonsEditor();
  stopBookingTitleEdit();
}

function startBookingTitleEdit() {
  if (!state.permissions.canEditBooking || !els.title || !els.titleInput) return;
  els.title.hidden = true;
  els.titleInput.hidden = false;
  els.titleInput.value = normalizeText(state.booking?.name) || els.title.textContent || "";
  window.requestAnimationFrame(() => {
    els.titleInput.focus();
    const length = els.titleInput.value.length;
    try {
      els.titleInput.setSelectionRange(length, length);
    } catch {
      // Ignore browsers that do not support explicit caret placement here.
    }
  });
}

function stopBookingTitleEdit() {
  if (!els.title || !els.titleInput) return;
  els.title.hidden = false;
  els.titleInput.hidden = true;
}

async function commitBookingTitleEdit() {
  if (!els.titleInput || els.titleInput.hidden) return;
  const currentName = normalizeText(state.booking?.name) || "";
  const nextName = normalizeText(els.titleInput.value) || "";
  if (nextName === currentName) {
    stopBookingTitleEdit();
    return;
  }
  stopBookingTitleEdit();
  await saveBookingName(nextName);
}

function handleBookingTitleInputKeydown(event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.key === "Enter") {
    event.preventDefault();
    void commitBookingTitleEdit();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.target.value = normalizeText(state.booking?.name) || "";
    stopBookingTitleEdit();
  }
}

function renderPricingPanel() {
  return pricingModule.renderPricingPanel();
}

function renderOfferPanel() {
  return pricingModule.renderOfferPanel();
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

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}
