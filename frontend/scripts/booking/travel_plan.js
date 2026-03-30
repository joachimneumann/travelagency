import {
  bookingTravelPlanPdfRequest,
  bookingTravelPlanPdfCreateRequest,
  bookingTravelPlanRequest,
  bookingTravelPlanTranslateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { logBrowserConsoleError } from "../shared/api.js";
import {
  bookingContentLang,
  bookingLanguageQuery,
  bookingContentLanguageOption,
  bookingSourceLang,
  bookingSourceLanguageLabel,
  bookingT
} from "./i18n.js";
import { formatMoneyDisplay } from "./pricing.js";
import { renderBookingSectionHeader } from "./sections.js";
import {
  buildDualLocalizedPayload,
  mergeDualLocalizedPayload,
  renderLocalizedStackedField,
  requestBookingFieldTranslation,
  resolveLocalizedEditorBranchText
} from "./localized_editor.js";
import {
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS,
  TRAVEL_PLAN_SERVICE_KIND_OPTIONS
} from "../shared/generated_catalogs.js";
import {
  countTravelPlanServices,
  countUncoveredTravelPlanServices,
  createEmptyTravelPlan,
  createEmptyTravelPlanDay,
  createEmptyTravelPlanOfferComponentLink,
  createEmptyTravelPlanService,
  getLinkableOfferComponents,
  TRAVEL_PLAN_TIMING_KIND_OPTIONS,
  getTravelPlanServiceCoverageStatus,
  normalizeTravelPlanDraft
} from "./travel_plan_helpers.js";
import {
  applyTravelPlanDatePickerValue as applyTravelPlanDatePickerValueImpl,
  combineDateAndTime as combineDateAndTimeImpl,
  deriveNextTravelPlanDayDate as deriveNextTravelPlanDayDateImpl,
  openTravelPlanDatePicker as openTravelPlanDatePickerImpl,
  renderTravelPlanDateInput as renderTravelPlanDateInputImpl,
  splitDateTimeValue as splitDateTimeValueImpl,
  validateTravelPlanDateFieldsInDom as validateTravelPlanDateFieldsInDomImpl,
  validateTravelPlanDateTextInput as validateTravelPlanDateTextInputImpl,
  isValidIsoCalendarDate as isValidIsoCalendarDateImpl
} from "./travel_plan_dates.js";
import { validateTravelPlanDraft as validateTravelPlanDraftState } from "./travel_plan_validation.js";
import { createBookingTravelPlanImagesModule } from "./travel_plan_images.js";
import { createBookingTravelPlanAttachmentsModule } from "./travel_plan_attachments.js";
import { createBookingTravelPlanServiceLibraryModule } from "./travel_plan_service_library.js";
import { createBookingTravelPlanPdfsModule } from "./travel_plan_pdfs.js";
import {
  retranslateConfirmText,
  translationBusyText
} from "./translation_status.js";
import { setBookingPageOverlay } from "./page_overlay.js";

export function createBookingTravelPlanModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderBookingData,
    renderOfferPanel,
    loadActivities,
    escapeHtml,
    formatDateTime,
    setBookingSectionDirty,
    setPageSaveActionError,
    hasUnsavedBookingChanges
  } = ctx;

  function logTravelPlanSave(message, details = {}) {
    const payload = details && typeof details === "object" ? { ...details } : { details };
    console.info(message, payload);
  }

  function withBookingLanguageQuery(urlLike) {
    const url = new URL(urlLike, window.location.origin);
    const query = bookingLanguageQuery();
    url.searchParams.set("content_lang", query.content_lang);
    url.searchParams.set("source_lang", query.source_lang);
    return url.toString();
  }

  function currentInternalOfferDetailLevel() {
    const explicit = String(state.offerDraft?.offer_detail_level_internal || state.booking?.offer?.offer_detail_level_internal || "").trim().toLowerCase();
    if (explicit === "component" || explicit === "day" || explicit === "trip") return explicit;
    if (Array.isArray(state.offerDraft?.components) && state.offerDraft.components.length) return "component";
    if (Array.isArray(state.offerDraft?.days_internal) && state.offerDraft.days_internal.length) return "day";
    if (state.offerDraft?.trip_price_internal && typeof state.offerDraft.trip_price_internal === "object") return "trip";
    return "trip";
  }

  function syncAccommodationCreateDaysButtonStates() {
    if (!els.travel_plan_editor) return;
    const itemNodes = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-service]"));
    itemNodes.forEach((itemNode) => {
      const createDaysButton = itemNode.querySelector("[data-travel-plan-create-days]");
      if (!(createDaysButton instanceof HTMLButtonElement)) return;
      const kindValue = String(itemNode.querySelector('[data-travel-plan-service-field="kind"]')?.value || "").trim();
      const accommodationDaysValue = String(itemNode.querySelector('[data-travel-plan-service-field="accommodation_days"]')?.value || "").trim();
      const isEnabled = kindValue === "accommodation" && (normalizeAccommodationDays(accommodationDaysValue) || 0) > 1;
      createDaysButton.disabled = !isEnabled;
    });
  }

  function findDraftDay(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).find((day) => day.id === dayId) || null;
  }

  function findDraftItem(dayId, itemId) {
    const day = findDraftDay(dayId);
    return (Array.isArray(day?.services) ? day.services : []).find((item) => item.id === itemId) || null;
  }

  function travelPlanLocalId(prefix) {
    const safePrefix = String(prefix || "travel_plan").replace(/[^a-z0-9_]+/gi, "_").toLowerCase();
    if (globalThis.crypto?.randomUUID) {
      return `${safePrefix}_${globalThis.crypto.randomUUID()}`;
    }
    return `${safePrefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function escapeSelectorValue(value) {
    const raw = String(value || "");
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(raw);
    return raw.replace(/["\\]/g, "\\$&");
  }

  function normalizeAccommodationDays(value) {
    const raw = String(value ?? "").trim();
    if (!raw || !/^\d+$/.test(raw)) return null;
    const parsed = Number.parseInt(raw, 10);
    return parsed >= 1 && parsed <= 100 ? parsed : null;
  }

  function accommodationDaysInputValue(item) {
    return String(normalizeAccommodationDays(item?.accommodation_days) || 1);
  }

  function canCreateAccommodationDays(item) {
    return Boolean(
      (normalizeAccommodationDays(item?.accommodation_days) || 0) > 1
    );
  }

  function createGeneratedDayTitle(dayNumber) {
    return bookingT("booking.travel_plan.generated_day_title", "Day {day}", { day: dayNumber });
  }

  function buildGeneratedDayTitleMap(dayNumber) {
    return buildDualLocalizedPayload(createGeneratedDayTitle(dayNumber), "", bookingContentLang()).map;
  }

  function cloneTravelPlanServiceImage(image, imageIndex) {
    return {
      ...image,
      id: travelPlanLocalId("travel_plan_service_image"),
      sort_order: imageIndex,
      is_primary: imageIndex === 0
    };
  }

  function cloneTravelPlanServiceForGeneratedDay(sourceItem) {
    const clonedItem = createEmptyTravelPlanService();
    clonedItem.timing_kind = String(sourceItem?.timing_kind || "label").trim() || "label";
    clonedItem.time_label = String(sourceItem?.time_label || "").trim();
    clonedItem.time_label_i18n = sourceItem?.time_label_i18n && typeof sourceItem.time_label_i18n === "object"
      ? { ...sourceItem.time_label_i18n }
      : {};
    clonedItem.time_point = String(sourceItem?.time_point || "").trim();
    clonedItem.kind = String(sourceItem?.kind || "accommodation").trim() || "accommodation";
    clonedItem.accommodation_days = 1;
    clonedItem.title = String(sourceItem?.title || "").trim();
    clonedItem.title_i18n = sourceItem?.title_i18n && typeof sourceItem.title_i18n === "object"
      ? { ...sourceItem.title_i18n }
      : {};
    clonedItem.details = String(sourceItem?.details || "").trim();
    clonedItem.details_i18n = sourceItem?.details_i18n && typeof sourceItem.details_i18n === "object"
      ? { ...sourceItem.details_i18n }
      : {};
    clonedItem.location = String(sourceItem?.location || "").trim();
    clonedItem.location_i18n = sourceItem?.location_i18n && typeof sourceItem.location_i18n === "object"
      ? { ...sourceItem.location_i18n }
      : {};
    clonedItem.supplier_id = String(sourceItem?.supplier_id || "").trim();
    clonedItem.start_time = String(sourceItem?.start_time || "").trim();
    clonedItem.end_time = String(sourceItem?.end_time || "").trim();
    clonedItem.financial_coverage_needed = sourceItem?.financial_coverage_needed !== false;
    clonedItem.financial_note = String(sourceItem?.financial_note || "").trim();
    clonedItem.financial_note_i18n = sourceItem?.financial_note_i18n && typeof sourceItem.financial_note_i18n === "object"
      ? { ...sourceItem.financial_note_i18n }
      : {};
    clonedItem.images = (Array.isArray(sourceItem?.images) ? sourceItem.images : []).map((image, imageIndex) => cloneTravelPlanServiceImage(image, imageIndex));
    clonedItem.copied_from = sourceItem?.copied_from && typeof sourceItem.copied_from === "object"
      ? { ...sourceItem.copied_from }
      : null;
    return clonedItem;
  }

  function applyTravelPlanMutationBooking(booking) {
    if (!booking) return;
    state.booking = booking;
    renderBookingHeader();
    renderBookingData();
    applyBookingPayload();
    renderTravelPlanPanel();
  }

  function travelPlanStatus(message, type = "info") {
    if (!els.travel_plan_status) return;
    els.travel_plan_status.textContent = message;
    els.travel_plan_status.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info",
      "booking-inline-status--loading"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" || type === "loading" ? type : "info";
    els.travel_plan_status.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function setTravelPlanTranslationOverlay(isVisible, message = "") {
    setBookingPageOverlay(
      els,
      isVisible,
      message || bookingT("booking.translation.translating_overlay", "Translating travel plan. Please wait.")
    );
  }

  function travelPlanSectionLabel() {
    return bookingT("booking.travel_plan", "Travel plan");
  }

  function travelPlanTranslateButtonState() {
    const targetLang = bookingContentLang();
    const sourceLang = bookingSourceLang();
    const status = state.booking?.travel_plan_translation_status || {};
    const disabledReason = !state.permissions.canEditBooking
      ? bookingT("booking.translation.disabled.no_permission", "Disabled: you do not have permission to edit this booking.")
      : targetLang === sourceLang
        ? bookingT("booking.translation.not_needed_for_matching_languages", "ATP staff language matches customer language. No translation is needed.")
        : state.travelPlanDirty
          ? bookingT("booking.travel_plan.translate_everything_clean_state", "Save or discard unsaved travel-plan edits before translating everything.")
          : !status.has_source_content
          ? bookingT("booking.translation.disabled.no_source", "Disabled: add {language} {section} content first.", {
                language: bookingSourceLanguageLabel(),
                section: travelPlanSectionLabel()
              })
            : "";
    return {
      disabled: Boolean(disabledReason),
      disabledReason
    };
  }

  function syncTravelPlanTranslateButton() {
    if (!(els.travel_plan_translate_all_btn instanceof HTMLButtonElement)) return;
    const button = els.travel_plan_translate_all_btn;
    const targetLang = bookingContentLang();
    const sourceLang = bookingSourceLang();
    const shouldShow = targetLang !== sourceLang;
    button.hidden = !shouldShow;
    if (!shouldShow) {
      button.disabled = true;
      button.removeAttribute("title");
      return;
    }
    const { disabled, disabledReason } = travelPlanTranslateButtonState();
    const targetOption = bookingContentLanguageOption(targetLang);
    button.textContent = bookingT(
      "booking.translation.translate_everything_to_language",
      "Update {language}",
      { language: targetOption.label || targetOption.shortLabel || String(targetOption.code || "").trim().toUpperCase() || "EN" }
    );
    button.disabled = disabled;
    if (disabledReason) {
      button.title = disabledReason;
    } else {
      button.removeAttribute("title");
    }
  }

  function validateTravelPlanDraft(plan) {
    return validateTravelPlanDraftState(plan, {
      getOfferComponentsForLinks,
      validTimingKinds: new Set(TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => option.value)),
      validItemKinds: new Set(TRAVEL_PLAN_SERVICE_KIND_OPTIONS.map((option) => option.value)),
      validCoverageTypes: new Set(TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS.map((option) => option.value)),
      splitDateTimeValue,
      isValidIsoCalendarDate
    });
  }

  function getOfferComponentsForLinks() {
    const offerDraftComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const bookingOfferComponents = Array.isArray(state.booking?.offer?.components) ? state.booking.offer.components : [];
    const sourceComponents = state.dirty?.offer ? offerDraftComponents : bookingOfferComponents;
    return getLinkableOfferComponents(sourceComponents);
  }

  function setTravelPlanDirty(isDirty, diagnostic = undefined) {
    state.travelPlanDirty = Boolean(isDirty) && state.permissions.canEditBooking;
    setBookingSectionDirty("travel_plan", state.travelPlanDirty, diagnostic);
  }

  function getTravelPlanNormalizationOptions() {
    return {
      targetLang: bookingContentLang(),
      sourceLang: bookingSourceLang()
    };
  }

  function normalizeTravelPlanState(plan = state.travelPlanDraft, offerComponents = getOfferComponentsForLinks()) {
    return normalizeTravelPlanDraft(plan, offerComponents, getTravelPlanNormalizationOptions());
  }

  function buildTravelPlanPayload(plan = state.travelPlanDraft) {
    return normalizeTravelPlanState({
      ...plan,
      offer_component_links: (Array.isArray(plan?.offer_component_links) ? plan.offer_component_links : [])
        .filter((link) => String(link?.offer_component_id || "").trim())
    }, getOfferComponentsForLinks());
  }

  function getTravelPlanSnapshot(plan = state.travelPlanDraft) {
    return JSON.stringify(normalizeTravelPlanState(plan, getOfferComponentsForLinks()));
  }

  function summarizeTravelPlanDiffValue(value) {
    if (typeof value === "string") {
      return value.length > 120 ? `${value.slice(0, 117)}...` : value;
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (value && typeof value === "object") {
      return "{...}";
    }
    return value;
  }

  function findFirstTravelPlanDifference(savedValue, draftValue, path = "travel_plan") {
    if (savedValue === draftValue) return null;
    const savedIsArray = Array.isArray(savedValue);
    const draftIsArray = Array.isArray(draftValue);
    if (savedIsArray || draftIsArray) {
      if (!savedIsArray || !draftIsArray) {
        return {
          path,
          saved: summarizeTravelPlanDiffValue(savedValue),
          draft: summarizeTravelPlanDiffValue(draftValue)
        };
      }
      if (savedValue.length !== draftValue.length) {
        return {
          path: `${path}.length`,
          saved: savedValue.length,
          draft: draftValue.length
        };
      }
      for (let index = 0; index < savedValue.length; index += 1) {
        const nested = findFirstTravelPlanDifference(savedValue[index], draftValue[index], `${path}[${index}]`);
        if (nested) return nested;
      }
      return {
        path,
        saved: summarizeTravelPlanDiffValue(savedValue),
        draft: summarizeTravelPlanDiffValue(draftValue)
      };
    }
    const savedIsObject = Boolean(savedValue) && typeof savedValue === "object";
    const draftIsObject = Boolean(draftValue) && typeof draftValue === "object";
    if (savedIsObject || draftIsObject) {
      if (!savedIsObject || !draftIsObject) {
        return {
          path,
          saved: summarizeTravelPlanDiffValue(savedValue),
          draft: summarizeTravelPlanDiffValue(draftValue)
        };
      }
      const keys = [...new Set([...Object.keys(savedValue), ...Object.keys(draftValue)])].sort();
      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(savedValue, key) || !Object.prototype.hasOwnProperty.call(draftValue, key)) {
          return {
            path: `${path}.${key}`,
            saved: summarizeTravelPlanDiffValue(savedValue[key]),
            draft: summarizeTravelPlanDiffValue(draftValue[key])
          };
        }
        const nested = findFirstTravelPlanDifference(savedValue[key], draftValue[key], `${path}.${key}`);
        if (nested) return nested;
      }
      return {
        path,
        saved: summarizeTravelPlanDiffValue(savedValue),
        draft: summarizeTravelPlanDiffValue(draftValue)
      };
    }
    return {
      path,
      saved: summarizeTravelPlanDiffValue(savedValue),
      draft: summarizeTravelPlanDiffValue(draftValue)
    };
  }

  function updateTravelPlanDirtyState() {
    const normalizedDraft = normalizeTravelPlanState(state.travelPlanDraft, getOfferComponentsForLinks());
    const nextSnapshot = JSON.stringify(normalizedDraft);
    const isDirty = nextSnapshot !== state.originalTravelPlanSnapshot;
    state.travelPlanDraft = normalizedDraft;
    setTravelPlanDirty(
      isDirty,
      isDirty
        ? {
            reason: "travel_plan_snapshot_mismatch",
            source_lang: bookingSourceLang(),
            target_lang: bookingContentLang(),
            first_difference: findFirstTravelPlanDifference(state.originalTravelPlanState, normalizedDraft)
          }
        : null
    );
    if (isDirty) {
      travelPlanStatus("");
    }
    syncTravelPlanTranslateButton();
  }

  async function ensureTravelPlanReadyForMutation() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return false;
    if (!state.travelPlanDirty) return true;
    travelPlanStatus("Save edits to enable.", "info");
    return false;
  }

  async function finalizeTravelPlanMutation(result, successMessage) {
    if (!result?.booking) return false;
    applyTravelPlanMutationBooking(result.booking);
    await loadActivities();
    travelPlanStatus(successMessage, "success");
    return true;
  }

  function applyBookingPayload() {
    state.travelPlanDraft = normalizeTravelPlanState(state.booking?.travel_plan || createEmptyTravelPlan(), getOfferComponentsForLinks());
    state.travelPlanCollapsedServiceIds = new Set(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .flatMap((day) => (Array.isArray(day?.services) ? day.services : []))
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean)
    );
    state.originalTravelPlanState = normalizeTravelPlanState(state.travelPlanDraft, getOfferComponentsForLinks());
    state.originalTravelPlanSnapshot = JSON.stringify(state.originalTravelPlanState);
    setTravelPlanDirty(false, null);
    travelPlanStatus("");
    travelPlanServiceLibraryModule.populateTravelPlanServiceLibraryKindOptions();
  }

  function resolveLocalizedDraftBranchText(map, lang = "en", fallback = "") {
    return resolveLocalizedEditorBranchText(map, lang, fallback);
  }

  function renderTravelPlanLocalizedField({ label, idBase, dataScope, dayId = "", itemId = "", field, type = "input", rows = 3, sourceValue = "", localizedValue = "" }) {
    return renderLocalizedStackedField({
      escapeHtml,
      idBase,
      label,
      type,
      rows,
      targetLang: bookingContentLang(),
      disabled: !state.permissions.canEditBooking,
      translateEnabled: Boolean(state.booking?.translation_enabled),
      sourceValue,
      localizedValue,
      commonData: {
        [dataScope]: field,
        ...(dayId ? { "travel-plan-day-id": dayId } : {}),
        ...(itemId ? { "travel-plan-service-id": itemId } : {})
      },
      translatePayload: {
        "travel-plan-translate": field,
        ...(dayId ? { "travel-plan-day-id": dayId } : {}),
        ...(itemId ? { "travel-plan-service-id": itemId } : {})
      }
    });
  }

  function formatTravelPlanDayHeading(dayIndex) {
    return bookingT("booking.travel_plan.day_heading", "Day {day}", { day: dayIndex + 1 });
  }

  const travelPlanImagesModule = createBookingTravelPlanImagesModule({
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    findDraftItem,
    syncTravelPlanDraftFromDom,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    renderTravelPlanPanel,
    loadActivities,
    travelPlanStatus
  });

  const travelPlanAttachmentsModule = createBookingTravelPlanAttachmentsModule({
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    formatDateTime,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    loadActivities,
    travelPlanStatus
  });

  const travelPlanPdfsModule = createBookingTravelPlanPdfsModule({
    state,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    formatDateTime,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation
  });

  const travelPlanServiceLibraryModule = createBookingTravelPlanServiceLibraryModule({
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    findDraftDay,
    formatTravelPlanDayHeading
  });

  function isIsoDateString(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
  }

  function formatIsoLocalDate(date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function nextIsoDate(value) {
    const raw = String(value || "").trim();
    if (!isIsoDateString(raw)) return "";
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + 1);
    return formatIsoLocalDate(date);
  }

  function deriveNextTravelPlanDayDate(days) {
    const items = Array.isArray(days) ? days : [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const candidate = nextIsoDate(items[index]?.date);
      if (candidate) return candidate;
    }
    return "";
  }

  function travelPlanSummary() {
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days.length : 0;
    const items = countTravelPlanServices(state.travelPlanDraft);
    const uncovered = countUncoveredTravelPlanServices(state.travelPlanDraft);
    if (!days && !items) {
      return {
        primary: bookingT("booking.travel_plan", "Travel plan"),
        secondary: bookingT("booking.no_travel_plan", "No travel plan yet.")
      };
    }
    const secondary = [
      bookingT(
        days === 1 ? "booking.travel_plan.summary.day" : "booking.travel_plan.summary.days",
        days === 1 ? "{count} day" : "{count} days",
        { count: days }
      ),
      bookingT(
        items === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items",
        items === 1 ? "{count} service" : "{count} services",
        { count: items }
      )
    ];
    if (uncovered > 0) secondary.push(bookingT("booking.travel_plan.summary.uncovered", "{count} uncovered", { count: uncovered }));
    return {
      primary: bookingT("booking.travel_plan", "Travel plan"),
      secondary: secondary.join(" · ")
    };
  }

  function coverageBadgeLabel(status) {
    switch (status) {
      case "covered":
        return bookingT("booking.travel_plan.coverage.covered", "Covered");
      case "partially_covered":
        return bookingT("booking.travel_plan.coverage.partially_covered", "Partially covered");
      case "not_applicable":
        return bookingT("booking.travel_plan.coverage.not_applicable", "Not applicable");
      case "not_covered":
      default:
        return bookingT("booking.travel_plan.coverage.not_covered", "Not covered");
    }
  }

  function ensureTravelPlanCollapsedServiceIds() {
    if (!(state.travelPlanCollapsedServiceIds instanceof Set)) {
      state.travelPlanCollapsedServiceIds = new Set();
    }
    return state.travelPlanCollapsedServiceIds;
  }

  function syncTravelPlanCollapsedServiceIds() {
    const activeIds = new Set(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .flatMap((day) => (Array.isArray(day?.services) ? day.services : []))
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean)
    );
    const collapsedIds = ensureTravelPlanCollapsedServiceIds();
    for (const itemId of [...collapsedIds]) {
      if (!activeIds.has(itemId)) collapsedIds.delete(itemId);
    }
    return collapsedIds;
  }

  function isTravelPlanServiceCollapsed(itemId) {
    return syncTravelPlanCollapsedServiceIds().has(String(itemId || "").trim());
  }

  function ensureTravelPlanCollapsedDayIds() {
    if (!(state.travelPlanCollapsedDayIds instanceof Set)) {
      state.travelPlanCollapsedDayIds = new Set();
    }
    return state.travelPlanCollapsedDayIds;
  }

  function syncTravelPlanCollapsedDayIds() {
    const activeIds = new Set(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .map((day) => String(day?.id || "").trim())
        .filter(Boolean)
    );
    const collapsedIds = ensureTravelPlanCollapsedDayIds();
    for (const dayId of [...collapsedIds]) {
      if (!activeIds.has(dayId)) collapsedIds.delete(dayId);
    }
    return collapsedIds;
  }

  function isTravelPlanDayCollapsed(dayId) {
    return syncTravelPlanCollapsedDayIds().has(String(dayId || "").trim());
  }

  function compactTravelPlanDateTime(dayDate, value) {
    const parts = splitDateTimeValue(dayDate, value);
    const dayValue = String(dayDate || "").trim();
    if (parts.date && parts.time) {
      return parts.date === dayValue ? parts.time : `${parts.date} ${parts.time}`;
    }
    return parts.date || parts.time || "";
  }

  function travelPlanTimingSummary(day, item) {
    const timingKind = String(item?.timing_kind || "label").trim();
    if (timingKind === "point") {
      return compactTravelPlanDateTime(day?.date, item?.time_point);
    }
    if (timingKind === "range") {
      const startLabel = compactTravelPlanDateTime(day?.date, item?.start_time);
      const endLabel = compactTravelPlanDateTime(day?.date, item?.end_time);
      if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
      return startLabel || endLabel || "";
    }
    return resolveLocalizedDraftBranchText(item?.time_label_i18n ?? item?.time_label, bookingSourceLang(), "");
  }

  function toggleTravelPlanServiceCollapsed(itemId) {
    syncTravelPlanDraftFromDom();
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId) return;
    const collapsedIds = ensureTravelPlanCollapsedServiceIds();
    if (collapsedIds.has(normalizedId)) {
      collapsedIds.delete(normalizedId);
    } else {
      collapsedIds.add(normalizedId);
    }
    renderTravelPlanPanel();
  }

  function toggleTravelPlanDayCollapsed(dayId) {
    syncTravelPlanDraftFromDom();
    const normalizedId = String(dayId || "").trim();
    if (!normalizedId) return;
    const collapsedIds = ensureTravelPlanCollapsedDayIds();
    if (collapsedIds.has(normalizedId)) {
      collapsedIds.delete(normalizedId);
    } else {
      collapsedIds.add(normalizedId);
    }
    renderTravelPlanPanel();
  }

  function travelPlanDayCollapsedSummary(day, items) {
    const title = resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), "").trim();
    const overnightLocation = resolveLocalizedDraftBranchText(
      day?.overnight_location_i18n ?? day?.overnight_location,
      bookingSourceLang(),
      ""
    ).trim();
    const parts = [];
    if (title) parts.push(title);
    if (overnightLocation) {
      parts.push(bookingT("booking.travel_plan.overnight_location_summary", "Overnight: {location}", {
        location: overnightLocation
      }));
    }
    if (!parts.length && items.length) {
      parts.push(items.length === 1 ? "1 service" : `${items.length} services`);
    }
    return parts.join(" · ");
  }

  function toggleTravelPlanServiceFinancialCoverageNeeded(itemId) {
    syncTravelPlanDraftFromDom();
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId) return;
    const item = (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
      .flatMap((day) => (Array.isArray(day?.services) ? day.services : []))
      .find((entry) => String(entry?.id || "").trim() === normalizedId);
    if (!item) return;
    const hasLinkedOfferComponents = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .some((link) => String(link?.travel_plan_service_id || "").trim() === normalizedId && String(link?.offer_component_id || "").trim());
    if (hasLinkedOfferComponents) return;
    item.financial_coverage_needed = item.financial_coverage_needed === false;
    state.travelPlanDraft = normalizeTravelPlanState(state.travelPlanDraft, getOfferComponentsForLinks());
    updateTravelPlanDirtyState();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    renderTravelPlanPanel();
  }

  function offerComponentsForTravelPlanDay(dayNumber, selectedId = "") {
    const normalizedSelectedId = String(selectedId || "").trim();
    const normalizedDayNumber = Number.isInteger(Number(dayNumber)) && Number(dayNumber) >= 1
      ? Number(dayNumber)
      : null;
    return getOfferComponentsForLinks().filter((component) => {
      const componentId = String(component?.id || "").trim();
      if (componentId && componentId === normalizedSelectedId) return true;
      const componentDayNumber = Number.parseInt(component?.day_number, 10);
      if (!Number.isInteger(componentDayNumber) || componentDayNumber < 1) return true;
      if (!normalizedDayNumber) return false;
      return componentDayNumber === normalizedDayNumber;
    });
  }

  function offerComponentSelectOptions(selectedId = "", dayNumber = null) {
    const selected = String(selectedId || "").trim();
    const options = [`<option value="">${escapeHtml(bookingT("booking.travel_plan.select_offer_component", "Select offer component"))}</option>`];
    for (const component of offerComponentsForTravelPlanDay(dayNumber, selectedId)) {
      const labelParts = [];
      const category = String(component?.category || "").trim();
      const details = String(component?.details || component?.label || "").trim();
      const componentDayNumber = Number.parseInt(component?.day_number, 10);
      if (category) labelParts.push(category.replace(/_/g, " ").toLowerCase());
      if (details) labelParts.push(details);
      if (Number.isInteger(componentDayNumber) && componentDayNumber >= 1) {
        labelParts.push(bookingT("booking.offer.day_number.day", "Day {day}", { day: componentDayNumber }));
      } else {
        labelParts.push(bookingT("booking.offer.day_number.not_applicable", "Not applicable"));
      }
      labelParts.push(formatMoneyDisplay(component?.line_total_amount_cents || 0, component?.currency || state.booking?.offer?.currency || "USD"));
      options.push(
        `<option value="${escapeHtml(component.id)}"${component.id === selected ? " selected" : ""}>${escapeHtml(labelParts.join(" · "))}</option>`
      );
    }
    return options.join("");
  }

  function coverageTypeOptions(selectedValue = "full") {
    return TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(bookingT(`booking.travel_plan.coverage_type.${option.value}`, option.label))}</option>`
    )).join("");
  }

  function itemKindOptions(selectedValue = "other") {
    return TRAVEL_PLAN_SERVICE_KIND_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(bookingT(`booking.travel_plan.kind.${option.value}`, option.label))}</option>`
    )).join("");
  }

  function timingKindOptions(selectedValue = "label") {
    return TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    )).join("");
  }

  function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function alignDateTimeLocalValue(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match) return raw;
    const date = new Date(`${match[1]}T${match[2]}:${match[3]}:00`);
    if (Number.isNaN(date.getTime())) return raw;
    date.setSeconds(0, 0);
    date.setMinutes(Math.round(date.getMinutes() / 5) * 5);
    return formatDateTimeLocal(date);
  }

  function toDateTimeLocalValue(dayDate, value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const isoDateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (isoDateTimeMatch) return alignDateTimeLocalValue(isoDateTimeMatch[1]);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) return alignDateTimeLocalValue(raw.replace(" ", "T"));
    if (/^\d{2}:\d{2}$/.test(raw) && String(dayDate || "").trim()) {
      return alignDateTimeLocalValue(`${String(dayDate).trim()}T${raw}`);
    }
    return "";
  }

  function splitDateTimeValue(dayDate, value) {
    const aligned = toDateTimeLocalValue(dayDate, value);
    const match = aligned.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
    if (!match) {
      return {
        date: String(dayDate || "").trim(),
        time: ""
      };
    }
    return {
      date: match[1],
      time: match[2]
    };
  }

  function combineDateAndTime(dateValue, timeValue) {
    const date = String(dateValue || "").trim();
    const time = String(timeValue || "").trim();
    if (!date || !time) return "";
    return alignDateTimeLocalValue(`${date}T${time}`);
  }

  function isValidIsoCalendarDate(value) {
    const normalized = String(value || "").trim();
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    );
  }

  function getTravelPlanDateValidationMessage(value, { allowPartial = false } = {}) {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (allowPartial && normalized.length < 10) return "";
    if (!isValidIsoCalendarDate(normalized)) {
      return bookingT("booking.travel_plan.date_invalid", "Use YYYY-MM-DD, for example 1963-08-20.");
    }
    return "";
  }

  function renderTravelPlanDateInput({ id, dataAttribute, value = "", disabled = false, ariaLabel = "" }) {
    return `
      <div class="booking-person-modal__date-input travel-plan-date-input">
        <input
          id="${escapeHtml(id)}"
          class="travel-plan-date-input__text"
          data-travel-plan-date-text="true"
          ${dataAttribute}
          type="text"
          inputmode="numeric"
          spellcheck="false"
          placeholder="YYYY-MM-DD"
          pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
          maxlength="10"
          value="${escapeHtml(value || "")}"
          ${disabled ? "disabled" : ""}
          ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ""}
        />
        <button
          class="booking-person-modal__date-picker-btn travel-plan-date-input__picker-btn"
          data-travel-plan-date-picker-btn="${escapeHtml(id)}"
          type="button"
          aria-label="${escapeHtml(bookingT("booking.open_date_picker", "Open date picker"))}"
          ${disabled ? "disabled" : ""}
        >📅</button>
        <input
          id="${escapeHtml(`${id}_picker`)}"
          type="date"
          tabindex="-1"
          aria-hidden="true"
          class="booking-person-modal__date-picker-proxy"
          data-travel-plan-date-picker-for="${escapeHtml(id)}"
          ${disabled ? "disabled" : ""}
        />
      </div>
      <div class="error" data-travel-plan-date-error="${escapeHtml(id)}"></div>
    `;
  }

  function setTravelPlanDateFieldValidation(textInput, message) {
    const field = textInput?.closest(".field");
    if (field instanceof HTMLElement) field.classList.toggle("invalid", Boolean(message));
    const errorNode = field?.querySelector(`[data-travel-plan-date-error="${textInput?.id || ""}"]`);
    if (errorNode instanceof HTMLElement) {
      errorNode.textContent = message || "";
    }
  }

  function syncTravelPlanDatePickerValue(textInput, pickerInput) {
    if (!(textInput instanceof HTMLInputElement) || !(pickerInput instanceof HTMLInputElement)) return;
    const normalized = String(textInput.value || "").trim();
    pickerInput.value = isValidIsoCalendarDate(normalized) ? normalized : "";
  }

  function validateTravelPlanDateTextInput(textInput, { allowPartial = false } = {}) {
    if (!(textInput instanceof HTMLInputElement)) return true;
    const message = getTravelPlanDateValidationMessage(textInput.value, { allowPartial });
    setTravelPlanDateFieldValidation(textInput, message);
    const pickerInput = document.getElementById(`${textInput.id}_picker`);
    if (pickerInput instanceof HTMLInputElement) {
      syncTravelPlanDatePickerValue(textInput, pickerInput);
    }
    return !message;
  }

  function applyTravelPlanDatePickerValue(pickerInput) {
    if (!(pickerInput instanceof HTMLInputElement)) return null;
    const targetId = String(pickerInput.getAttribute("data-travel-plan-date-picker-for") || "").trim();
    const textInput = targetId ? document.getElementById(targetId) : null;
    if (!(textInput instanceof HTMLInputElement)) return null;
    textInput.value = String(pickerInput.value || "").trim();
    validateTravelPlanDateTextInput(textInput, { allowPartial: false });
    return textInput;
  }

  function openTravelPlanDatePicker(button) {
    const targetId = String(button?.getAttribute("data-travel-plan-date-picker-btn") || "").trim();
    const pickerInput = targetId ? document.getElementById(`${targetId}_picker`) : null;
    const textInput = targetId ? document.getElementById(targetId) : null;
    if (!(pickerInput instanceof HTMLInputElement) || pickerInput.disabled) return;
    if (textInput instanceof HTMLInputElement) {
      syncTravelPlanDatePickerValue(textInput, pickerInput);
    }
    if (typeof pickerInput.showPicker === "function") {
      try {
        pickerInput.showPicker();
        return;
      } catch (_) {
        // Fall through.
      }
    }
    pickerInput.focus();
    pickerInput.click();
  }

  function validateTravelPlanDateFieldsInDom({ allowPartial = false, focusFirstInvalid = false } = {}) {
    if (!els.travel_plan_editor) return { ok: true, message: "" };
    const dateInputs = Array.from(els.travel_plan_editor.querySelectorAll('[data-travel-plan-date-text="true"]'));
    let firstInvalid = null;
    for (const textInput of dateInputs) {
      const isValid = validateTravelPlanDateTextInput(textInput, { allowPartial });
      if (!isValid && !firstInvalid) {
        firstInvalid = textInput;
      }
    }
    if (focusFirstInvalid && firstInvalid instanceof HTMLInputElement) {
      firstInvalid.focus();
    }
    return {
      ok: !firstInvalid,
      message: firstInvalid
        ? getTravelPlanDateValidationMessage(firstInvalid.value, { allowPartial: false })
        : ""
    };
  }

  function timeSelectOptions(selectedValue = "") {
    const selected = String(selectedValue || "").trim();
    const options = ['<option value=""></option>'];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 5) {
        const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        options.push(`<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`);
      }
    }
    return options.join("");
  }

  function renderTravelPlanTimingFields(day, item) {
    const timingKind = String(item?.timing_kind || "label");
    if (timingKind === "point") {
      const pointParts = splitDateTimeValue(day?.date, item.time_point);
      return `
        <div class="field">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_time_point_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.date", "Date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_time_point_date_${item.id}`,
            dataAttribute: 'data-travel-plan-service-field="time_point_date"',
            value: pointParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.date", "Date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_time_point_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.time", "Time"))}</label>
          <select id="travel_plan_time_point_time_${escapeHtml(item.id)}" data-travel-plan-service-field="time_point_time">
            ${timeSelectOptions(pointParts.time)}
          </select>
        </div>
      `;
    }
    if (timingKind === "range") {
      const startParts = splitDateTimeValue(day?.date, item.start_time);
      const endParts = splitDateTimeValue(day?.date, item.end_time);
      return `
        <div class="field">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_start_time_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.start_date", "Start date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_start_time_date_${item.id}`,
            dataAttribute: 'data-travel-plan-service-field="start_time_date"',
            value: startParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.start_date", "Start date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_start_time_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.start_time", "Start time"))}</label>
          <select id="travel_plan_start_time_time_${escapeHtml(item.id)}" data-travel-plan-service-field="start_time_time">
            ${timeSelectOptions(startParts.time)}
          </select>
        </div>
        <div class="field">
          <label for="travel_plan_end_time_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.end_date", "End date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_end_time_date_${item.id}`,
            dataAttribute: 'data-travel-plan-service-field="end_time_date"',
            value: endParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.end_date", "End date")
          })}
        </div>
        <div class="field">
          <label for="travel_plan_end_time_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.end_time", "End time"))}</label>
          <select id="travel_plan_end_time_time_${escapeHtml(item.id)}" data-travel-plan-service-field="end_time_time">
            ${timeSelectOptions(endParts.time)}
          </select>
        </div>
      `;
    }
    return `
      <div class="field">
        <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "Time information"))}</label>
        <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
          ${timingKindOptions(timingKind)}
        </select>
      </div>
      <div class="field">
        ${renderTravelPlanLocalizedField({
          label: bookingT("booking.travel_plan.human_readable_time", "Human readable time"),
          idBase: `travel_plan_time_${item.id}`,
          dataScope: "travel-plan-service-field",
          dayId: day.id,
          itemId: item.id,
          field: "time_label",
          type: "input",
          sourceValue: resolveLocalizedDraftBranchText(item.time_label_i18n ?? item.time_label, bookingSourceLang(), ""),
          localizedValue: resolveLocalizedDraftBranchText(item.time_label_i18n ?? item.time_label, bookingContentLang(), "")
        })}
      </div>
    `;
  }

  function renderTravelPlanLinkRows(itemId, dayNumber = null) {
    const itemLinks = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_service_id === itemId);
    const selectableOfferComponents = offerComponentsForTravelPlanDay(dayNumber);

    if (!itemLinks.length) {
      return `
        <div class="travel-plan-link-empty">
          ${selectableOfferComponents.length
            ? escapeHtml(bookingT("booking.travel_plan.no_linked_components", "No linked offer components yet."))
            : escapeHtml(bookingT("booking.travel_plan.no_day_matching_offer_components", "No offer components match this day."))}
        </div>
      `;
    }

    return itemLinks.map((link) => `
      <div class="travel-plan-link-row" data-travel-plan-link="${escapeHtml(link.id)}">
        <select data-travel-plan-link-component="${escapeHtml(link.id)}">
          ${offerComponentSelectOptions(link.offer_component_id, dayNumber)}
        </select>
        <select data-travel-plan-link-coverage-type="${escapeHtml(link.id)}">
          ${coverageTypeOptions(link.coverage_type)}
        </select>
        <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-link="${escapeHtml(link.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_linked_offer_component", "Remove linked offer component"))}">&times;</button>
      </div>
    `).join("");
  }

  function renderTravelPlanService(day, item, itemIndex) {
    const links = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_service_id === item.id && link.offer_component_id);
    const hasLinkedOfferComponents = links.length > 0;
    const noFinancialCoverageNeeded = item.financial_coverage_needed === false;
    const coverageStatus = getTravelPlanServiceCoverageStatus(item.kind, links, item.financial_coverage_needed);
    const showFinancialCoverage = currentInternalOfferDetailLevel() === "component";
    const coverageLabel = coverageBadgeLabel(coverageStatus);
    const collapsed = isTravelPlanServiceCollapsed(item.id);
    const sourceTitle = resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), "").trim();
    const collapsedTitle = sourceTitle || bookingT("booking.travel_plan.item_heading", "Service {item}", { item: itemIndex + 1 });
    const timingSummary = travelPlanTimingSummary(day, item).trim();
    const shouldShowCoverageBadge = showFinancialCoverage && coverageStatus !== "not_applicable";
    const coverageBadge = !shouldShowCoverageBadge
      ? ""
      : `<span class="travel-plan-coverage-badge travel-plan-coverage-badge--${escapeHtml(coverageStatus.replace(/_/g, "-"))}" data-travel-plan-coverage-badge="${escapeHtml(item.id)}">${escapeHtml(coverageLabel)}</span>`;
    const createDaysEnabled = canCreateAccommodationDays(item);
    const accommodationControls = item.kind === "accommodation"
      ? `
        <div class="field">
          <label for="travel_plan_accommodation_days_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.accommodation_days", "Number of days"))}</label>
          <input
            id="travel_plan_accommodation_days_${escapeHtml(item.id)}"
            data-travel-plan-service-field="accommodation_days"
            type="number"
            min="1"
            max="100"
            step="1"
            value="${escapeHtml(accommodationDaysInputValue(item))}"
          />
        </div>
        <div class="field travel-plan-service__create-days-field">
          <span class="field-label" aria-hidden="true">&nbsp;</span>
          <button class="btn btn-ghost travel-plan-service__create-days-btn" data-travel-plan-create-days="${escapeHtml(item.id)}" type="button"${createDaysEnabled ? "" : " disabled"}>${escapeHtml(bookingT("booking.travel_plan.create_days", "Create days"))}</button>
        </div>
      `
      : "";
    return `
      <div class="travel-plan-service travel-plan-service--${escapeHtml(coverageStatus.replace(/_/g, "-"))}${collapsed ? " travel-plan-service--collapsed" : ""}" data-travel-plan-service="${escapeHtml(item.id)}" data-travel-plan-financial-coverage-needed="${noFinancialCoverageNeeded ? "false" : "true"}">
        <div class="travel-plan-service__rail">
          <button
            class="btn btn-ghost travel-plan-service__toggle"
            data-travel-plan-toggle-item="${escapeHtml(item.id)}"
            type="button"
            aria-label="${escapeHtml(collapsed
              ? bookingT("booking.travel_plan.expand_item", "Expand service")
              : bookingT("booking.travel_plan.collapse_item", "Collapse service"))}"
            aria-expanded="${collapsed ? "false" : "true"}"
          >${collapsed ? "+" : "−"}</button>
        </div>
        <div class="travel-plan-service__main">
          <div class="travel-plan-service__head">
            <div class="travel-plan-service__title">
              <span class="travel-plan-service__collapsed-title">${escapeHtml(collapsedTitle)}</span>
              ${collapsed && timingSummary ? `<span class="travel-plan-service__collapsed-timing">${escapeHtml(timingSummary)}</span>` : ""}
              ${coverageBadge}
            </div>
            <div class="travel-plan-service__actions">
              <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-item-up="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_item_up", "Move service up"))}">&#8593;</button>
              <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-item-down="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_item_down", "Move service down"))}">&#8595;</button>
              <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-item="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_item", "Remove service"))}">&times;</button>
            </div>
          </div>
          <div class="travel-plan-service__body">
          <div class="travel-plan-grid travel-plan-grid--item-kind${item.kind === "accommodation" ? " travel-plan-grid--item-kind-accommodation" : ""}">
            <div class="field">
              <label for="travel_plan_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.kind_label", "Kind"))}</label>
              <select id="travel_plan_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="kind">
                ${itemKindOptions(item.kind)}
              </select>
            </div>
            ${accommodationControls}
          </div>
          <div class="travel-plan-grid">
            <div class="field">
              ${renderTravelPlanLocalizedField({
                label: bookingT("booking.travel_plan.item_title", "Service title"),
                idBase: `travel_plan_title_${item.id}`,
                dataScope: "travel-plan-service-field",
                dayId: day.id,
                itemId: item.id,
                field: "title",
                type: "input",
                sourceValue: resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), ""),
                localizedValue: resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingContentLang(), "")
              })}
            </div>
            <div class="field">
              ${renderTravelPlanLocalizedField({
                label: bookingT("booking.location", "Location"),
                idBase: `travel_plan_location_${item.id}`,
                dataScope: "travel-plan-service-field",
                dayId: day.id,
                itemId: item.id,
                field: "location",
                type: "input",
                sourceValue: resolveLocalizedDraftBranchText(item.location_i18n ?? item.location, bookingSourceLang(), ""),
                localizedValue: resolveLocalizedDraftBranchText(item.location_i18n ?? item.location, bookingContentLang(), "")
              })}
            </div>
          </div>
          <div class="travel-plan-grid travel-plan-grid--item travel-plan-grid--item-timing">
            ${renderTravelPlanTimingFields(day, item)}
          </div>
          <div class="travel-plan-grid travel-plan-grid--item">
            <div class="field">
              ${renderTravelPlanLocalizedField({
                label: bookingT("booking.details", "Details"),
                idBase: `travel_plan_details_${item.id}`,
                dataScope: "travel-plan-service-field",
                dayId: day.id,
                itemId: item.id,
                field: "details",
                type: "textarea",
                rows: 3,
                sourceValue: resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, bookingSourceLang(), ""),
                localizedValue: resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, bookingContentLang(), "")
              })}
            </div>
            <div class="field">
              <label for="travel_plan_financial_note_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.financial_note", "Supplier / financial note (ATP internal)"))}</label>
              <textarea class="booking-text-field booking-text-field--internal" id="travel_plan_financial_note_${escapeHtml(item.id)}" data-travel-plan-service-field="financial_note" rows="3">${escapeHtml(item.financial_note || "")}</textarea>
            </div>
          </div>
          ${travelPlanImagesModule.renderTravelPlanServiceImages(day, item)}
          ${showFinancialCoverage ? `<div class="travel-plan-links">
            <div class="travel-plan-links__head">
              <h4>${escapeHtml(bookingT("booking.travel_plan.financial_coverage", "Financial coverage"))}</h4>
              <div class="travel-plan-links__actions">
                <button class="btn btn-ghost travel-plan-link-add-btn" data-travel-plan-add-link="${escapeHtml(item.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.link_offer_component", "Add offer component"))}</button>
                <button class="btn btn-ghost travel-plan-link-toggle-btn${noFinancialCoverageNeeded ? " travel-plan-link-toggle-btn--active" : ""}" data-travel-plan-toggle-no-coverage="${escapeHtml(item.id)}" type="button" aria-pressed="${noFinancialCoverageNeeded ? "true" : "false"}"${hasLinkedOfferComponents ? ` disabled title="${escapeHtml(bookingT("booking.travel_plan.no_financial_coverage_blocked", "Remove linked offer components first."))}"` : ""}>${escapeHtml(bookingT("booking.travel_plan.no_financial_coverage_needed", "No financial coverage needed"))}</button>
              </div>
            </div>
            ${renderTravelPlanLinkRows(item.id, day.day_number)}
          </div>
          ` : ""}
          </div>
          </div>
        </div>
    `;
  }

  function renderTravelPlanDay(day, dayIndex) {
    const items = Array.isArray(day.services) ? day.services : [];
    const collapsed = isTravelPlanDayCollapsed(day.id);
    const collapsedSummary = travelPlanDayCollapsedSummary(day, items);
    return `
      <section class="travel-plan-day${collapsed ? " travel-plan-day--collapsed" : ""}" data-travel-plan-day="${escapeHtml(day.id)}">
        <div class="travel-plan-day__rail">
          <button
            class="btn btn-ghost travel-plan-day__toggle"
            data-travel-plan-toggle-day="${escapeHtml(day.id)}"
            type="button"
            aria-label="${escapeHtml(collapsed
              ? bookingT("booking.travel_plan.expand_day", "Expand day")
              : bookingT("booking.travel_plan.collapse_day", "Collapse day"))}"
            aria-expanded="${collapsed ? "false" : "true"}"
          >${collapsed ? "+" : "−"}</button>
        </div>
        <div class="travel-plan-day__main">
          <div class="travel-plan-day__head">
            <div class="travel-plan-day__head-copy">
              <div class="travel-plan-day__title-row">
                <h3>${escapeHtml(formatTravelPlanDayHeading(dayIndex))}:</h3>
                <div class="field travel-plan-day__date-field">
                  ${renderTravelPlanDateInput({
                    id: `travel_plan_day_date_${day.id}`,
                    dataAttribute: 'data-travel-plan-day-field="date"',
                    value: day.date,
                    disabled: !state.permissions.canEditBooking,
                    ariaLabel: `${formatTravelPlanDayHeading(dayIndex)} ${bookingT("booking.date", "Date")}`
                  })}
                </div>
              </div>
              ${collapsed && collapsedSummary ? `<div class="travel-plan-day__collapsed-summary">${escapeHtml(collapsedSummary)}</div>` : ""}
            </div>
            <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-day="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_day", "Remove day"))}">&times;</button>
          </div>
          <div class="travel-plan-day__content">
            <div class="travel-plan-grid">
              <div class="field">
                ${renderTravelPlanLocalizedField({
                  label: bookingT("booking.travel_plan.day_title", "Summary: What is happening on this day?"),
                  idBase: `travel_plan_day_title_${day.id}`,
                  dataScope: "travel-plan-day-field",
                  dayId: day.id,
                  field: "title",
                  type: "input",
                  sourceValue: resolveLocalizedDraftBranchText(day.title_i18n ?? day.title, bookingSourceLang(), ""),
                  localizedValue: resolveLocalizedDraftBranchText(day.title_i18n ?? day.title, bookingContentLang(), "")
                })}
              </div>
              <div class="field">
                ${renderTravelPlanLocalizedField({
                  label: bookingT("booking.travel_plan.overnight_location", "Overnight location (optional)"),
                  idBase: `travel_plan_day_overnight_${day.id}`,
                  dataScope: "travel-plan-day-field",
                  dayId: day.id,
                  field: "overnight_location",
                  type: "input",
                  sourceValue: resolveLocalizedDraftBranchText(day.overnight_location_i18n ?? day.overnight_location, bookingSourceLang(), ""),
                  localizedValue: resolveLocalizedDraftBranchText(day.overnight_location_i18n ?? day.overnight_location, bookingContentLang(), "")
                })}
              </div>
            </div>
            <div class="field">
              ${renderTravelPlanLocalizedField({
                label: bookingT("booking.travel_plan.day_notes", "Customer-facing additional notes about this day"),
                idBase: `travel_plan_day_notes_${day.id}`,
                dataScope: "travel-plan-day-field",
                dayId: day.id,
                field: "notes",
                type: "textarea",
                rows: 3,
                sourceValue: resolveLocalizedDraftBranchText(day.notes_i18n ?? day.notes, bookingSourceLang(), ""),
                localizedValue: resolveLocalizedDraftBranchText(day.notes_i18n ?? day.notes, bookingContentLang(), "")
              })}
            </div>
            <div class="travel-plan-day__services">
              ${items.map((item, itemIndex) => renderTravelPlanService(day, item, itemIndex)).join("")}
            </div>
          </div>
          <div class="travel-plan-service-footer">
            <button class="btn travel-plan-service-footer__plus" type="button" disabled aria-hidden="true">+</button>
            <div class="travel-plan-service-footer__main">
              <div class="travel-plan-service-footer__actions">
                <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service" data-travel-plan-add-item="${escapeHtml(day.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.new_item", "New service"))}</button>
                <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service" data-travel-plan-open-import="${escapeHtml(day.id)}" data-requires-clean-state type="button">${escapeHtml(bookingT("booking.travel_plan.insert_existing", "Copy existing service"))}</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function readLocalizedFieldPayload(container, dataScope, field, existingValue = null) {
    const sourceInput = container?.querySelector(`[data-${dataScope}="${field}"][data-localized-role="source"]`);
    const sourceLang = bookingSourceLang();
    const targetLang = bookingContentLang();
    const localizedInput = targetLang === sourceLang
      ? null
      : container?.querySelector(`[data-${dataScope}="${field}"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    const sourceValue = String(sourceInput?.value || "").trim();
    const localizedValue = targetLang === sourceLang ? "" : String(localizedInput?.value || "").trim();
    return mergeDualLocalizedPayload(existingValue, sourceValue, localizedValue, targetLang, sourceLang);
  }

  function syncTravelPlanDraftFromDom() {
    if (!els.travel_plan_editor) return state.travelPlanDraft;
    const previousItemsById = new Map(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .flatMap((day) => (Array.isArray(day?.services) ? day.services : []))
        .map((item) => [item.id, item])
    );
    const draft = createEmptyTravelPlan();
    draft.days = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]")).map((dayNode, dayIndex) => {
      const dayId = String(dayNode.getAttribute("data-travel-plan-day") || "").trim();
      const day = createEmptyTravelPlanDay(dayIndex);
      day.id = dayId || day.id;
      day.day_number = dayIndex + 1;
      const previousDay = (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).find((candidate) => candidate?.id === day.id) || null;
      const dayTitle = readLocalizedFieldPayload(dayNode, "travel-plan-day-field", "title", previousDay?.title_i18n ?? previousDay?.title);
      day.title = dayTitle.text;
      day.title_i18n = dayTitle.map;
      day.date = String(dayNode.querySelector('[data-travel-plan-day-field="date"]')?.value || "").trim();
      const overnight = readLocalizedFieldPayload(
        dayNode,
        "travel-plan-day-field",
        "overnight_location",
        previousDay?.overnight_location_i18n ?? previousDay?.overnight_location
      );
      day.overnight_location = overnight.text;
      day.overnight_location_i18n = overnight.map;
      const dayNotes = readLocalizedFieldPayload(
        dayNode,
        "travel-plan-day-field",
        "notes",
        previousDay?.notes_i18n ?? previousDay?.notes
      );
      day.notes = dayNotes.text;
      day.notes_i18n = dayNotes.map;
      day.services = Array.from(dayNode.querySelectorAll("[data-travel-plan-service]")).map((itemNode) => {
        const itemId = String(itemNode.getAttribute("data-travel-plan-service") || "").trim();
        const previousItem = previousItemsById.get(itemId);
        const item = createEmptyTravelPlanService();
        item.id = itemId || item.id;
        item.timing_kind = String(itemNode.querySelector('[data-travel-plan-service-field="timing_kind"]')?.value || "label").trim();
        const timeLabel = readLocalizedFieldPayload(
          itemNode,
          "travel-plan-service-field",
          "time_label",
          previousItem?.time_label_i18n ?? previousItem?.time_label
        );
        item.time_label = timeLabel.text;
        item.time_label_i18n = timeLabel.map;
        item.time_point = combineDateAndTime(
          String(itemNode.querySelector('[data-travel-plan-service-field="time_point_date"]')?.value || day.date || "").trim(),
          String(itemNode.querySelector('[data-travel-plan-service-field="time_point_time"]')?.value || "").trim()
        );
        item.kind = String(itemNode.querySelector('[data-travel-plan-service-field="kind"]')?.value || "").trim();
        item.accommodation_days = String(itemNode.querySelector('[data-travel-plan-service-field="accommodation_days"]')?.value || "").trim();
        const itemTitle = readLocalizedFieldPayload(
          itemNode,
          "travel-plan-service-field",
          "title",
          previousItem?.title_i18n ?? previousItem?.title
        );
        item.title = itemTitle.text;
        item.title_i18n = itemTitle.map;
        const itemLocation = readLocalizedFieldPayload(
          itemNode,
          "travel-plan-service-field",
          "location",
          previousItem?.location_i18n ?? previousItem?.location
        );
        item.location = itemLocation.text;
        item.location_i18n = itemLocation.map;
        const itemDetails = readLocalizedFieldPayload(
          itemNode,
          "travel-plan-service-field",
          "details",
          previousItem?.details_i18n ?? previousItem?.details
        );
        item.details = itemDetails.text;
        item.details_i18n = itemDetails.map;
        item.start_time = combineDateAndTime(
          String(itemNode.querySelector('[data-travel-plan-service-field="start_time_date"]')?.value || day.date || "").trim(),
          String(itemNode.querySelector('[data-travel-plan-service-field="start_time_time"]')?.value || "").trim()
        );
        item.end_time = combineDateAndTime(
          String(itemNode.querySelector('[data-travel-plan-service-field="end_time_date"]')?.value || day.date || "").trim(),
          String(itemNode.querySelector('[data-travel-plan-service-field="end_time_time"]')?.value || "").trim()
        );
        item.financial_coverage_needed = itemNode.getAttribute("data-travel-plan-financial-coverage-needed") !== "false";
        item.financial_note = String(itemNode.querySelector('[data-travel-plan-service-field="financial_note"]')?.value || "").trim();
        item.images = Array.isArray(previousItem?.images) ? previousItem.images : [];
        item.copied_from = previousItem?.copied_from || null;
        return item;
      });
      return day;
    });
    draft.offer_component_links = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-link]")).map((linkNode) => ({
      id: String(linkNode.getAttribute("data-travel-plan-link") || "").trim(),
      travel_plan_service_id: String(linkNode.closest("[data-travel-plan-service]")?.getAttribute("data-travel-plan-service") || "").trim(),
      offer_component_id: String(linkNode.querySelector("[data-travel-plan-link-component]")?.value || "").trim(),
      coverage_type: String(linkNode.querySelector("[data-travel-plan-link-coverage-type]")?.value || "full").trim()
    }));
    draft.attachments = Array.isArray(state.travelPlanDraft?.attachments) ? state.travelPlanDraft.attachments : [];
    state.travelPlanDraft = normalizeTravelPlanState(draft, getOfferComponentsForLinks());
    return state.travelPlanDraft;
  }

  function findDayIndex(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).findIndex((day) => day.id === dayId);
  }

  function removeItemLinks(itemId) {
    state.travelPlanDraft.offer_component_links = (Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : []).filter((link) => link.travel_plan_service_id !== itemId);
  }

  function addDay() {
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const nextDay = createEmptyTravelPlanDay(days.length);
    nextDay.date = deriveNextTravelPlanDayDate(days);
    days.push(nextDay);
    state.travelPlanDraft.days = days;
    renderTravelPlanPanel();
    renderOfferPanel?.();
  }

  function removeDay(dayId) {
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    if (!window.confirm(bookingT("booking.travel_plan.remove_day_confirm", "Remove this day and all its services?"))) return;
    const [removedDay] = state.travelPlanDraft.days.splice(dayIndex, 1);
    for (const item of Array.isArray(removedDay?.services) ? removedDay.services : []) {
      removeItemLinks(item.id);
    }
    renderTravelPlanPanel();
    renderOfferPanel?.();
  }

  function addItem(dayId) {
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    const day = state.travelPlanDraft.days[dayIndex];
    day.services = Array.isArray(day.services) ? day.services : [];
    day.services.push(createEmptyTravelPlanService());
    renderTravelPlanPanel();
  }

  function createAccommodationDays(itemId) {
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
    const sourceDayIndex = days.findIndex((day) => Array.isArray(day?.services) && day.services.some((item) => item.id === itemId));
    if (sourceDayIndex < 0) return;

    const sourceDay = days[sourceDayIndex];
    const sourceItemIndex = (Array.isArray(sourceDay?.services) ? sourceDay.services : []).findIndex((item) => item.id === itemId);
    if (sourceItemIndex < 0) return;
    const sourceItem = sourceDay.services[sourceItemIndex];
    if (sourceItem?.kind !== "accommodation") return;

    const accommodationDays = normalizeAccommodationDays(sourceItem.accommodation_days);
    if (!accommodationDays) {
      travelPlanStatus(
        bookingT(
          "booking.travel_plan.validation.accommodation_days_invalid",
          "Day {day}, service {item}: Accommodation days must be between 1 and 100.",
          { day: sourceDayIndex + 1, item: sourceItemIndex + 1 }
        ),
        "error"
      );
      const invalidInput = els.travel_plan_editor?.querySelector(`[data-travel-plan-service="${escapeSelectorValue(itemId)}"] [data-travel-plan-service-field="accommodation_days"]`);
      invalidInput?.focus?.();
      return;
    }

    const additionalDays = accommodationDays - 1;
    if (additionalDays < 1) {
      travelPlanStatus(bookingT("booking.travel_plan.create_days_no_extra", "This accommodation already spans one day."), "info");
      return;
    }

    const sourceLinks = (Array.isArray(state.travelPlanDraft?.offer_component_links) ? state.travelPlanDraft.offer_component_links : [])
      .filter((link) => link.travel_plan_service_id === itemId);
    const generatedDays = [];
    const generatedLinks = [];
    let nextDateValue = String(sourceDay?.date || "").trim();

    for (let offset = 1; offset <= additionalDays; offset += 1) {
      const generatedDay = createEmptyTravelPlanDay(sourceDayIndex + offset);
      const generatedDayNumber = sourceDayIndex + offset + 1;
      generatedDay.title = createGeneratedDayTitle(generatedDayNumber);
      generatedDay.title_i18n = buildGeneratedDayTitleMap(generatedDayNumber);
      generatedDay.overnight_location = String(sourceItem.location || sourceDay?.overnight_location || "").trim();
      generatedDay.overnight_location_i18n = sourceItem.location_i18n && typeof sourceItem.location_i18n === "object"
        ? { ...sourceItem.location_i18n }
        : sourceDay?.overnight_location_i18n && typeof sourceDay.overnight_location_i18n === "object"
          ? { ...sourceDay.overnight_location_i18n }
          : {};
      nextDateValue = nextIsoDate(nextDateValue);
      generatedDay.date = nextDateValue;

      const generatedItem = cloneTravelPlanServiceForGeneratedDay(sourceItem);
      generatedDay.services = [generatedItem];
      generatedDays.push(generatedDay);

      sourceLinks.forEach((link) => {
        generatedLinks.push({
          ...link,
          id: travelPlanLocalId("travel_plan_offer_link"),
          travel_plan_service_id: generatedItem.id
        });
      });
    }

    sourceItem.accommodation_days = 1;
    days.splice(sourceDayIndex + 1, 0, ...generatedDays);
    state.travelPlanDraft.days = days;
    state.travelPlanDraft.offer_component_links = [
      ...(Array.isArray(state.travelPlanDraft.offer_component_links) ? state.travelPlanDraft.offer_component_links : []),
      ...generatedLinks
    ];
    renderTravelPlanPanel();
    travelPlanStatus(
      bookingT("booking.travel_plan.create_days_created", "Created {count} additional days for this accommodation.", { count: additionalDays }),
      "success"
    );
  }

  function removeItem(itemId) {
    syncTravelPlanDraftFromDom();
    if (!window.confirm(bookingT("booking.travel_plan.remove_item_confirm", "Remove this service?"))) return;
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const itemIndex = (Array.isArray(day.services) ? day.services : []).findIndex((item) => item.id === itemId);
      if (itemIndex < 0) continue;
      day.services.splice(itemIndex, 1);
      removeItemLinks(itemId);
      renderTravelPlanPanel();
      return;
    }
  }

  function moveItem(itemId, direction) {
    syncTravelPlanDraftFromDom();
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const items = Array.isArray(day.services) ? day.services : [];
      const itemIndex = items.findIndex((item) => item.id === itemId);
      if (itemIndex < 0) continue;
      const nextIndex = direction === "up" ? itemIndex - 1 : itemIndex + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return;
      const [item] = items.splice(itemIndex, 1);
      items.splice(nextIndex, 0, item);
      renderTravelPlanPanel();
      return;
    }
  }

  function addLink(itemId) {
    syncTravelPlanDraftFromDom();
    state.travelPlanDraft.offer_component_links = Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : [];
    state.travelPlanDraft.offer_component_links.push(createEmptyTravelPlanOfferComponentLink(itemId));
    renderTravelPlanPanel();
  }

  function openTravelPlanPdf() {
    if (!state.booking?.id) return;
    if (hasUnsavedBookingChanges?.() || state.pageSaveInFlight || state.pageDiscardInFlight) {
      travelPlanStatus(bookingT("booking.action_requires_save", "Save edits to enable."), "info");
      return;
    }
    const request = bookingTravelPlanPdfCreateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        lang: bookingContentLang(),
        actor: state.user
      }
    });
    setBookingPageOverlay(els, true, bookingT("booking.travel_plan.generating_pdf_overlay", "Generating travel plan PDF. Please wait."));
    void fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    }).then((result) => {
      const artifact = result?.artifact;
      if (!artifact || !state.booking) return;
      const currentArtifacts = Array.isArray(state.booking.travel_plan_pdfs) ? state.booking.travel_plan_pdfs : [];
      state.booking.travel_plan_pdfs = [...currentArtifacts.filter((item) => item?.id !== artifact.id), artifact]
        .sort((left, right) => String(right?.created_at || "").localeCompare(String(left?.created_at || "")));
      renderTravelPlanPanel();
      const link = document.createElement("a");
      link.href = withBookingLanguageQuery(artifact.pdf_url);
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      travelPlanStatus(bookingT("booking.travel_plan.pdf_created", "Travel plan PDF created."), "success");
    }).finally(() => {
      setBookingPageOverlay(els, false);
    });
  }

  function previewTravelPlanPdf() {
    if (!state.booking?.id) return;
    if (hasUnsavedBookingChanges?.() || state.pageSaveInFlight || state.pageDiscardInFlight) {
      travelPlanStatus(bookingT("booking.action_requires_save", "Save edits to enable."), "info");
      return;
    }
    const request = bookingTravelPlanPdfRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      query: bookingLanguageQuery()
    });
    const previewUrl = new URL(request.url, window.location.origin);
    previewUrl.searchParams.set("preview", "1");
    const link = document.createElement("a");
    link.href = previewUrl.toString();
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }

  function removeLink(linkId) {
    syncTravelPlanDraftFromDom();
    state.travelPlanDraft.offer_component_links = (Array.isArray(state.travelPlanDraft.offer_component_links)
      ? state.travelPlanDraft.offer_component_links
      : []).filter((link) => link.id !== linkId);
    renderTravelPlanPanel();
  }

  async function persistTravelPlan() {
    if (!state.permissions.canEditBooking || !state.booking || state.travelPlanSaving) {
      logTravelPlanSave("[booking-save][travel-plan] Persist returned early.", {
        booking_id: state.booking?.id || null,
        can_edit_booking: state.permissions.canEditBooking === true,
        has_booking: Boolean(state.booking),
        page_travel_plan_dirty: state.dirty?.travel_plan === true,
        travel_plan_dirty: state.travelPlanDirty === true,
        travel_plan_saving: state.travelPlanSaving === true
      });
      return false;
    }
    if (!state.travelPlanDirty) {
      syncTravelPlanDraftFromDom();
      updateTravelPlanDirtyState();
      if (!state.travelPlanDirty) {
        logTravelPlanSave("[booking-save][travel-plan] Persist found no remaining dirty state after sync.", {
          booking_id: state.booking.id,
          page_travel_plan_dirty: state.dirty?.travel_plan === true
        });
        return true;
      }
    }
    const saveStartedAt = Date.now();
    let pendingWarningTimer = null;
    const dateFieldValidation = validateTravelPlanDateFieldsInDom({ allowPartial: false, focusFirstInvalid: true });
    if (!dateFieldValidation.ok) {
      logTravelPlanSave("[booking-save][travel-plan] Date validation blocked save.", {
        booking_id: state.booking.id,
        message: dateFieldValidation.message || ""
      });
      travelPlanStatus(dateFieldValidation.message, "error");
      return false;
    }
    syncTravelPlanDraftFromDom();
    const travelPlanPayload = buildTravelPlanPayload();
    logTravelPlanSave("[booking-save][travel-plan] Persist started.", {
      booking_id: state.booking.id,
      day_count: Array.isArray(travelPlanPayload?.days) ? travelPlanPayload.days.length : 0,
      service_count: countTravelPlanServices(travelPlanPayload)
    });
    const validation = validateTravelPlanDraft(travelPlanPayload);
    if (!validation.ok) {
      logTravelPlanSave("[booking-save][travel-plan] Schema validation blocked save.", {
        booking_id: state.booking.id,
        code: validation.code || null,
        message: validation.error || ""
      });
      if (validation.code === "accommodation_days_invalid") {
        setPageSaveActionError?.(
          bookingT(
            "booking.travel_plan.validation.accommodation_days_action_error",
            "Accommodation stay on day {day}, service {item} needs a day count between 1 and 100.",
            { item: validation.itemNumber, day: validation.dayNumber }
          )
        );
        const invalidInput = els.travel_plan_editor?.querySelector(`[data-travel-plan-service="${escapeSelectorValue(validation.itemId || "")}"] [data-travel-plan-service-field="accommodation_days"]`);
        invalidInput?.focus?.();
      }
      travelPlanStatus(validation.error, "error");
      return false;
    }
    state.travelPlanSaving = true;
    travelPlanStatus(bookingT("booking.travel_plan.saving", "Saving travel plan..."), "info");
    pendingWarningTimer = window.setTimeout(() => {
      logTravelPlanSave("[booking-save][travel-plan] Mutation is still pending after 3000ms.", {
        booking_id: state.booking?.id || null,
        pending_for_ms: Date.now() - saveStartedAt,
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision")
      });
    }, 3000);
    try {
      const expectedTravelPlanRevision = getBookingRevision("travel_plan_revision");
      const request = bookingTravelPlanRequest({
        baseURL: apiOrigin,
        params: { booking_id: state.booking.id },
        body: {
          expected_travel_plan_revision: expectedTravelPlanRevision,
          travel_plan: travelPlanPayload,
          content_lang: bookingContentLang()
        }
      });
      logTravelPlanSave("[booking-save][travel-plan] Sending mutation request.", {
        booking_id: state.booking.id,
        expected_travel_plan_revision: expectedTravelPlanRevision,
        request_url: request.url,
        method: request.method
      });
      const response = await fetchBookingMutation(request.url, {
        method: request.method,
        body: request.body
      });
      if (!response?.booking) {
        logTravelPlanSave("[booking-save][travel-plan] Mutation returned no booking payload.", {
          booking_id: state.booking.id,
          duration_ms: Date.now() - saveStartedAt
        });
        travelPlanStatus("");
        return false;
      }
      logTravelPlanSave("[booking-save][travel-plan] Mutation succeeded.", {
        booking_id: state.booking.id,
        duration_ms: Date.now() - saveStartedAt,
        unchanged: response.unchanged === true,
        next_travel_plan_revision: response.booking?.travel_plan_revision ?? null
      });
      state.booking = response.booking;
      renderBookingHeader();
      renderBookingData();
      applyBookingPayload();
      renderTravelPlanPanel();
      await loadActivities();
      travelPlanStatus(
        response.unchanged
          ? ""
          : bookingT("booking.travel_plan.saved", "Travel plan saved."),
        response.unchanged ? "info" : "success"
      );
      return true;
    } catch (error) {
      logBrowserConsoleError("[booking-save][travel-plan] Mutation threw an error.", {
        booking_id: state.booking?.id || null,
        duration_ms: Date.now() - saveStartedAt
      }, error);
      throw error;
    } finally {
      if (pendingWarningTimer) {
        window.clearTimeout(pendingWarningTimer);
        pendingWarningTimer = null;
      }
      logTravelPlanSave("[booking-save][travel-plan] Persist finished.", {
        booking_id: state.booking?.id || null,
        duration_ms: Date.now() - saveStartedAt,
        still_dirty: state.travelPlanDirty === true
      });
      state.travelPlanSaving = false;
    }
  }

  async function saveTravelPlan() {
    return await persistTravelPlan();
  }

  async function translateTravelPlanField(button) {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    const editor = button.closest(".localized-pair");
    if (!editor) return;
    const direction = String(button.getAttribute("data-localized-translate-direction") || "source-to-target").trim();
    const editingLang = bookingSourceLang();
    const sourceFieldInput = editor?.querySelector('[data-localized-role="source"]');
    const targetLang = bookingContentLang();
    const localizedInput = targetLang === editingLang
      ? null
      : editor?.querySelector(`[data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    if (!sourceFieldInput || !localizedInput || targetLang === editingLang) return;
    const sourceInput = direction === "target-to-source" ? localizedInput : sourceFieldInput;
    const destinationInput = direction === "target-to-source" ? sourceFieldInput : localizedInput;
    const sourceLang = direction === "target-to-source" ? targetLang : editingLang;
    const destinationLang = direction === "target-to-source" ? editingLang : targetLang;
    const sourceText = String(sourceInput?.value || "").trim();
    if (!sourceText) return;
    const targetOption = bookingContentLanguageOption(destinationLang);
    const statusMessage = bookingT("booking.translation.translating_field_from_language", "Translating field from {language}...", {
      language: bookingContentLanguageOption(sourceLang).label
    });
    travelPlanStatus(statusMessage);
    let translated = "";
    try {
      const translatedEntries = await requestBookingFieldTranslation({
        bookingId: state.booking?.id,
        entries: { value: sourceText },
        fetchBookingMutation,
        apiBase: apiOrigin,
        sourceLang,
        targetLang: destinationLang
      });
      translated = String(translatedEntries?.value || "").trim();
      if (!translated) throw new Error(bookingT("booking.translation.error", "Could not translate this section."));
    } catch (error) {
      logBrowserConsoleError("[travel-plan] Failed to translate a travel-plan field.", {
        booking_id: state.booking?.id || "",
        day_id: button.getAttribute("data-travel-plan-day-id") || "",
        service_id: button.getAttribute("data-travel-plan-service-id") || "",
        field: button.getAttribute("data-travel-plan-translate") || "",
        source_lang: sourceLang,
        target_lang: destinationLang,
        source_text: sourceText,
        direction
      }, error);
      travelPlanStatus(error?.message || bookingT("booking.translation.error", "Could not translate this section."));
      return;
    }
    destinationInput.value = translated;
    syncTravelPlanDraftFromDom();
    updateTravelPlanDirtyState();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    travelPlanStatus(
      direction === "target-to-source"
        ? bookingT("booking.translation.field_translated_to_language", "Field translated to {lang}.", { lang: targetOption.shortLabel })
        : bookingT("booking.translation.field_translated_to_customer_language", "Field translated to {lang}.", { lang: targetOption.shortLabel })
    );
  }

  async function translateEntireTravelPlan() {
    if (!state.booking?.id) return;
    const { disabled, disabledReason } = travelPlanTranslateButtonState();
    if (disabled) {
      travelPlanStatus(disabledReason, "info");
      return;
    }

    const status = state.booking?.travel_plan_translation_status || {};
    if (status.has_target_content && !window.confirm(retranslateConfirmText(status, travelPlanSectionLabel()))) {
      return;
    }

    const request = bookingTravelPlanTranslateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        source_lang: bookingSourceLang(),
        target_lang: bookingContentLang(),
        actor: state.user || "keycloak_user"
      }
    });

    travelPlanStatus(translationBusyText(travelPlanSectionLabel(), status.source_lang || bookingSourceLang()), "loading");
    if (els.travel_plan_translate_all_btn instanceof HTMLButtonElement) {
      els.travel_plan_translate_all_btn.disabled = true;
    }
    setTravelPlanTranslationOverlay(true);

    try {
      const response = await fetchBookingMutation(request.url, {
        method: request.method,
        body: request.body
      });
      if (!response?.booking) {
        travelPlanStatus("");
        syncTravelPlanTranslateButton();
        return;
      }
      state.booking = response.booking;
      renderBookingHeader();
      renderBookingData();
      applyBookingPayload();
      renderTravelPlanPanel();
      await loadActivities();
      travelPlanStatus(bookingT("booking.translation.complete", "Translations complete"), "success");
    } catch (error) {
      logBrowserConsoleError("[travel-plan] Failed to translate the full travel plan.", {
        booking_id: state.booking?.id || "",
        target_lang: bookingContentLang()
      }, error);
      travelPlanStatus(error?.message || bookingT("booking.translation.error", "Could not translate this section."), "error");
    } finally {
      setTravelPlanTranslationOverlay(false);
      syncTravelPlanTranslateButton();
    }
  }

  function bindEvents() {
    if (els.travel_plan_editor && els.travel_plan_editor.dataset.travelPlanBound !== "true") {
      els.travel_plan_editor.addEventListener("input", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: true });
        }
        syncTravelPlanDraftFromDom();
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        syncAccommodationCreateDaysButtonStates();
      });
      els.travel_plan_editor.addEventListener("change", (event) => {
        const target = event.target;
        if (target?.matches?.("[data-travel-plan-pdf-sent]")) {
          const artifactId = String(target.getAttribute("data-travel-plan-pdf-sent") || "").trim();
          const sentToCustomer = target.checked === true;
          void travelPlanPdfsModule.setTravelPlanPdfSentToCustomer(artifactId, sentToCustomer).then((ok) => {
            if (!ok) renderTravelPlanPanel();
          });
          return;
        }
        if (target?.matches?.("[data-travel-plan-date-picker-for]")) {
          applyTravelPlanDatePickerValue(target);
        }
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
        syncTravelPlanDraftFromDom();
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        syncAccommodationCreateDaysButtonStates();
        const shouldRerender = Boolean(
          target?.matches?.('[data-travel-plan-service-field="timing_kind"]')
          || target?.matches?.('[data-travel-plan-service-field="kind"]')
          || target?.matches?.("[data-travel-plan-link-component]")
          || target?.matches?.("[data-travel-plan-link-coverage-type]")
        );
        if (shouldRerender) {
          renderTravelPlanPanel();
        }
      });
      els.travel_plan_editor.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-travel-plan-add-day")) {
          addDay();
          return;
        }
        if (button.hasAttribute("data-travel-plan-toggle-day")) {
          toggleTravelPlanDayCollapsed(button.getAttribute("data-travel-plan-toggle-day"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-toggle-item")) {
          toggleTravelPlanServiceCollapsed(button.getAttribute("data-travel-plan-toggle-item"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-create-pdf")) {
          openTravelPlanPdf();
          return;
        }
        if (button.hasAttribute("data-travel-plan-preview-pdf")) {
          previewTravelPlanPdf();
          return;
        }
        if (button.hasAttribute("data-travel-plan-upload-attachments")) {
          travelPlanAttachmentsModule.triggerTravelPlanAttachmentPicker();
          return;
        }
        if (button.hasAttribute("data-travel-plan-delete-attachment")) {
          void travelPlanAttachmentsModule.deleteTravelPlanAttachment(button.getAttribute("data-travel-plan-delete-attachment"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-delete-pdf")) {
          void travelPlanPdfsModule.deleteTravelPlanPdf(button.getAttribute("data-travel-plan-delete-pdf"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-day")) {
          removeDay(button.getAttribute("data-travel-plan-remove-day"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-item")) {
          addItem(button.getAttribute("data-travel-plan-add-item"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-create-days")) {
          createAccommodationDays(button.getAttribute("data-travel-plan-create-days"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-open-import")) {
          travelPlanServiceLibraryModule.openTravelPlanServiceLibrary(button.getAttribute("data-travel-plan-open-import"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-item")) {
          removeItem(button.getAttribute("data-travel-plan-remove-item"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-item-up")) {
          moveItem(button.getAttribute("data-travel-plan-move-item-up"), "up");
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-item-down")) {
          moveItem(button.getAttribute("data-travel-plan-move-item-down"), "down");
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-link")) {
          addLink(button.getAttribute("data-travel-plan-add-link"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-toggle-no-coverage")) {
          toggleTravelPlanServiceFinancialCoverageNeeded(button.getAttribute("data-travel-plan-toggle-no-coverage"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-image")) {
          travelPlanImagesModule.triggerTravelPlanServiceImagePicker(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-add-image")
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-preview-image")) {
          travelPlanImagesModule.openTravelPlanImagePreview(
            button.getAttribute("data-travel-plan-preview-src"),
            button.getAttribute("data-travel-plan-preview-alt")
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-image-left")) {
          void travelPlanImagesModule.reorderTravelPlanServiceImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-service-id"),
            button.getAttribute("data-travel-plan-move-image-left"),
            "left"
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-image-right")) {
          void travelPlanImagesModule.reorderTravelPlanServiceImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-service-id"),
            button.getAttribute("data-travel-plan-move-image-right"),
            "right"
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-image")) {
          void travelPlanImagesModule.removeTravelPlanServiceImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-service-id"),
            button.getAttribute("data-travel-plan-remove-image")
          );
          return;
        }
        if (button.hasAttribute("data-localized-translate")) {
          void translateTravelPlanField(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-date-picker-btn")) {
          openTravelPlanDatePicker(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-link")) {
          removeLink(button.getAttribute("data-travel-plan-remove-link"));
        }
      });
      els.travel_plan_editor.addEventListener("focusout", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
      });
      els.travel_plan_editor.dataset.travelPlanBound = "true";
    }
    if (els.travel_plan_translate_all_btn instanceof HTMLButtonElement && els.travel_plan_translate_all_btn.dataset.travelPlanBound !== "true") {
      els.travel_plan_translate_all_btn.addEventListener("click", () => {
        void translateEntireTravelPlan();
      });
      els.travel_plan_translate_all_btn.dataset.travelPlanBound = "true";
    }
    travelPlanServiceLibraryModule.bindTravelPlanServiceLibrary();
    travelPlanImagesModule.bindTravelPlanImageInput();
    travelPlanImagesModule.bindTravelPlanImagePreviewModal();
    travelPlanAttachmentsModule.bindTravelPlanAttachmentInput();
    syncTravelPlanTranslateButton();
  }

  function renderTravelPlanPanel() {
    if (!els.travel_plan_panel || !els.travel_plan_editor || !state.booking) return;
    state.travelPlanDraft = normalizeTravelPlanState(state.travelPlanDraft || state.booking.travel_plan, getOfferComponentsForLinks());
    syncTravelPlanCollapsedServiceIds();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    els.travel_plan_editor.innerHTML = `
      ${(Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []).map((day, dayIndex) => renderTravelPlanDay(day, dayIndex)).join("") || `<p class="travel-plan-empty">${escapeHtml(bookingT("booking.travel_plan.no_days", "No travel-plan days yet."))}</p>`}
      <div class="travel-plan-footer">
        <div class="travel-plan-footer__new-day">
          <button class="btn travel-plan-footer__new-day-plus" type="button" disabled aria-hidden="true">+</button>
          <button class="btn btn-ghost booking-offer-add-btn travel-plan-add-day-btn" data-travel-plan-add-day type="button">${escapeHtml(bookingT("booking.travel_plan.new_day", "New day"))}</button>
        </div>
        <div class="travel-plan-footer__separator" aria-hidden="true"></div>
        <div class="travel-plan-footer__existing-pdfs">
          ${travelPlanPdfsModule.renderTravelPlanPdfsTable()}
        </div>
        <div class="travel-plan-footer__create-pdf">
          <div class="travel-plan-pdf-actions">
            <div class="travel-plan-pdf-actions__buttons">
              <button class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn" data-travel-plan-preview-pdf data-requires-clean-state data-clean-state-hint-id="travel_plan_pdf_dirty_hint" type="button">${escapeHtml(bookingT("booking.travel_plan.preview_pdf", "Preview Travel Plan PDF"))}</button>
              <button class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn" data-travel-plan-create-pdf data-requires-clean-state data-clean-state-hint-id="travel_plan_pdf_dirty_hint" type="button">${escapeHtml(bookingT("booking.travel_plan.create_pdf", "Create Travel Plan PDF"))}</button>
            </div>
            <span id="travel_plan_pdf_dirty_hint" class="micro booking-inline-status travel-plan-pdf-actions__hint"></span>
          </div>
        </div>
        <div class="travel-plan-footer__attachments">
          ${travelPlanAttachmentsModule.renderTravelPlanAttachments(state.travelPlanDraft)}
        </div>
      </div>
    `;
    updateTravelPlanDirtyState();
    syncAccommodationCreateDaysButtonStates();
    syncTravelPlanTranslateButton();
  }

  return {
    applyBookingPayload,
    bindEvents,
    renderTravelPlanPanel,
    updateTravelPlanDirtyState,
    saveTravelPlan
  };
}
