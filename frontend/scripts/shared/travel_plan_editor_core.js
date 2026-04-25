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
  bookingT,
  normalizeBookingContentLang
} from "../booking/i18n.js";
import { renderBookingSectionHeader } from "../booking/sections.js";
import {
  mergeDualLocalizedPayload,
  normalizeLocalizedEditorMap,
  renderLocalizedStackedField,
  requestBookingFieldTranslation,
  resolveLocalizedEditorBranchText
} from "../booking/localized_editor.js";
import {
  TRAVEL_PLAN_SERVICE_KIND_OPTIONS
} from "../shared/generated_catalogs.js";
import {
  countTravelPlanServices,
  createEmptyTravelPlan,
  createEmptyTravelPlanDay,
  createEmptyTravelPlanService,
  TRAVEL_PLAN_TIMING_KIND_OPTIONS,
  normalizeTravelPlanDraft
} from "../booking/travel_plan_helpers.js";
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
} from "../booking/travel_plan_dates.js";
import { validateTravelPlanDraft as validateTravelPlanDraftState } from "../booking/travel_plan_validation.js";
import { createBookingTravelPlanImagesModule } from "../booking/travel_plan_images.js";
import { createBookingTravelPlanAttachmentsModule } from "../booking/travel_plan_attachments.js";
import { createBookingTravelPlanServiceLibraryModule } from "../booking/travel_plan_service_library.js";
import { createBookingTravelPlanPdfsModule } from "../booking/travel_plan_pdfs.js";
import { buildBookingPdfWorkspaceMarkup } from "../booking/pdf_workspace.js";
import { BOOKING_PDF_PERSONALIZATION_PANELS } from "../booking/pdf_personalization_panel.js";
import {
  retranslateConfirmText,
  translationBusyText
} from "../booking/translation_status.js";
import { setBookingPageOverlay } from "../booking/page_overlay.js";

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
    hasUnsavedBookingChanges,
    updatePageDirtyBar,
    prepareTravelPlanMutation,
    features = {}
  } = ctx;
  let lastMissingTravelPlanControlsDiagnosticKey = "";
  let lastTravelPlanTranslationIncomplete = null;

  function isFeatureEnabled(key, defaultValue = true) {
    if (!Object.prototype.hasOwnProperty.call(features, key)) return defaultValue;
    return features[key] !== false;
  }

  const allowDayImport = isFeatureEnabled("dayImport");
  const allowPlanImport = isFeatureEnabled("planImport");
  const allowTourImport = isFeatureEnabled("tourImport", isFeatureEnabled("standardTourImport"));
  const allowServiceImport = isFeatureEnabled("serviceImport");
  const allowImageUpload = isFeatureEnabled("imageUpload");
  const allowDates = isFeatureEnabled("dates");
  const allowTiming = isFeatureEnabled("timing", allowDates);
  const allowServiceDetails = isFeatureEnabled("serviceDetails");
  const allowTranslation = isFeatureEnabled("translation");
  const allowRenumberDays = isFeatureEnabled("renumberDays", allowDates);
  const allowPdfs = isFeatureEnabled("pdfs");

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

  function findDraftDay(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).find((day) => day.id === dayId) || null;
  }

  function findDraftItem(dayId, itemId) {
    const day = findDraftDay(dayId);
    return (Array.isArray(day?.services) ? day.services : []).find((item) => item.id === itemId) || null;
  }

  function escapeSelectorValue(value) {
    const raw = String(value || "");
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(raw);
    return raw.replace(/["\\]/g, "\\$&");
  }

  function applyTravelPlanMutationBooking(booking, options = {}) {
    if (!booking) return;
    state.booking = booking;
    renderBookingHeader();
    renderBookingData();
    applyBookingPayload(options);
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
    if (!allowTranslation) {
      return {
        disabled: true,
        disabledReason: bookingT("booking.translation.disabled", "Translation is disabled for this editor.")
      };
    }
    const targetLang = bookingContentLang();
    const sourceLang = bookingSourceLang();
    const status = state.booking?.travel_plan_translation_status || {};
    const disabledReason = !state.permissions.canEditBooking
      ? bookingT("booking.translation.disabled.no_permission", "Disabled: you do not have permission to edit this booking.")
      : targetLang === sourceLang
        ? bookingT("booking.translation.not_needed_for_matching_languages", "Master language matches customer language. No translation is needed.")
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
    if (!allowTranslation) {
      button.hidden = true;
      button.disabled = true;
      button.removeAttribute("title");
      return;
    }
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

  function firstTravelPlanDayHasSpecifiedDate(days = state.travelPlanDraft?.days) {
    if (!allowDates) return false;
    const firstDay = Array.isArray(days) ? days[0] : null;
    return isValidIsoCalendarDate(firstDay?.date);
  }

  function syncTravelPlanRenumberDaysAction() {
    if (!(els.travel_plan_renumber_days_btn instanceof HTMLButtonElement)) return;
    const button = els.travel_plan_renumber_days_btn;
    if (!allowRenumberDays) {
      button.hidden = true;
      button.disabled = true;
      button.removeAttribute("title");
      return;
    }
    button.textContent = bookingT("booking.travel_plan.renumber_days", "Renumber days");
    const canEdit = state.permissions.canEditBooking === true;
    const hasFirstDate = firstTravelPlanDayHasSpecifiedDate();
    button.disabled = !canEdit || !hasFirstDate;
    if (!canEdit) {
      button.title = bookingT("booking.translation.disabled.no_permission", "Disabled: you do not have permission to edit this booking.");
      return;
    }
    if (!hasFirstDate) {
      button.title = bookingT("booking.travel_plan.renumber_days_disabled", "Set a date on the first day to enable renumbering.");
      return;
    }
    button.title = "";
  }

  function validateTravelPlanDraft(plan) {
    return validateTravelPlanDraftState(plan, {
      validTimingKinds: new Set(TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => option.value)),
      validItemKinds: new Set(TRAVEL_PLAN_SERVICE_KIND_OPTIONS.map((option) => option.value)),
      splitDateTimeValue,
      isValidIsoCalendarDate
    });
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

  function normalizeTravelPlanState(plan = state.travelPlanDraft) {
    const normalized = normalizeTravelPlanDraft(plan, getTravelPlanNormalizationOptions());
    return normalizeTravelPlanForEnabledFeatures(normalized);
  }

  function buildTravelPlanPayload(plan = state.travelPlanDraft) {
    return normalizeTravelPlanState(plan);
  }

  function normalizeTravelPlanForEnabledFeatures(plan) {
    const source = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
    const next = {
      days: (Array.isArray(source.days) ? source.days : []).map((day, dayIndex) => {
        const sourceDay = day && typeof day === "object" && !Array.isArray(day) ? day : {};
        const nextDay = {
          ...sourceDay,
          day_number: dayIndex + 1,
          services: (Array.isArray(sourceDay.services) ? sourceDay.services : []).map((item) => {
            const sourceItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
            const nextItem = { ...sourceItem };
            if (!allowTiming) {
              nextItem.timing_kind = "label";
              nextItem.time_label = "";
              nextItem.time_label_i18n = {};
              nextItem.time_point = "";
              nextItem.start_time = "";
              nextItem.end_time = "";
            }
            if (!allowServiceDetails) {
              delete nextItem.details;
              delete nextItem.details_i18n;
            }
            return nextItem;
          })
        };
        if (!allowDates) {
          delete nextDay.date;
          delete nextDay.date_string;
        }
        return nextDay;
      })
    };
    if (allowPdfs) {
      next.attachments = Array.isArray(source.attachments) ? source.attachments : [];
    }
    if (Object.prototype.hasOwnProperty.call(source, "translation_meta")) {
      next.translation_meta = source.translation_meta && typeof source.translation_meta === "object" && !Array.isArray(source.translation_meta)
        ? source.translation_meta
        : {};
    }
    return next;
  }

  function getTravelPlanSnapshot(plan = state.travelPlanDraft) {
    return JSON.stringify(normalizeTravelPlanState(plan));
  }

  function hasSharedBookingStylesheetLoaded() {
    if (typeof document === "undefined") return false;
    return Array.from(document.styleSheets || []).some((sheet) => {
      const href = String(sheet?.href || "");
      return href.includes("/assets/css/styles.css") || href.includes("/shared/css/styles.css");
    });
  }

  function warnIfTravelPlanControlsMissing(reason = "renderTravelPlanPanel") {
    if (!(els.travel_plan_editor instanceof HTMLElement) || !state.booking) return;
    const addDayButtons = els.travel_plan_editor.querySelectorAll("[data-travel-plan-add-day]");
    if (addDayButtons.length > 0) {
      lastMissingTravelPlanControlsDiagnosticKey = "";
      return;
    }
    const html = String(els.travel_plan_editor.innerHTML || "").trim();
    const diagnostic = {
      booking_id: state.booking?.id || null,
      reason,
      draft_days_count: Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days.length : 0,
      rendered_day_nodes: els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]").length,
      editor_child_count: els.travel_plan_editor.childElementCount,
      editor_html_length: html.length,
      editor_html_preview: html.replace(/\s+/g, " ").slice(0, 240) || null,
      stylesheet_link_present: Boolean(document.querySelector('link[rel="stylesheet"][href*="assets/css/styles.css"]')),
      stylesheet_loaded: hasSharedBookingStylesheetLoaded(),
      location_href: window.location.href
    };
    const diagnosticKey = JSON.stringify(diagnostic);
    if (diagnosticKey === lastMissingTravelPlanControlsDiagnosticKey) return;
    lastMissingTravelPlanControlsDiagnosticKey = diagnosticKey;
    console.warn("[booking-travel-plan] Expected new-day controls are missing after render.", diagnostic);
  }

  function scheduleTravelPlanControlsDiagnostic(reason = "renderTravelPlanPanel") {
    if (typeof window === "undefined") return;
    const schedule = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0);
    schedule(() => {
      warnIfTravelPlanControlsMissing(reason);
    });
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
    const normalizedDraft = normalizeTravelPlanState(state.travelPlanDraft);
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
    syncTravelPlanRenumberDaysAction();
  }

  async function ensureTravelPlanReadyForMutation() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return false;
    if (!state.travelPlanDirty) return true;
    if (typeof prepareTravelPlanMutation === "function") {
      return await prepareTravelPlanMutation({
        applyTravelPlanMutationBooking,
        buildTravelPlanPayload,
        syncTravelPlanDraftFromDom,
        travelPlanStatus
      });
    }
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

  function applyBookingPayload({ preserveCollapsedState = false } = {}) {
    const previousCollapsedServiceIds = preserveCollapsedState && state.travelPlanCollapsedServiceIds instanceof Set
      ? new Set(state.travelPlanCollapsedServiceIds)
      : null;
    const previousCollapsedDayIds = preserveCollapsedState && state.travelPlanCollapsedDayIds instanceof Set
      ? new Set(state.travelPlanCollapsedDayIds)
      : null;
    state.travelPlanDraft = normalizeTravelPlanState(state.booking?.travel_plan || createEmptyTravelPlan());
    const activeServiceIds = (
      Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []
    )
      .flatMap((day) => (Array.isArray(day?.services) ? day.services : []))
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);
    state.travelPlanCollapsedServiceIds = previousCollapsedServiceIds
      ? new Set(activeServiceIds.filter((itemId) => previousCollapsedServiceIds.has(itemId)))
      : new Set(activeServiceIds);
    const activeDayIds = (
      Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []
    )
      .map((day) => String(day?.id || "").trim())
      .filter(Boolean);
    state.travelPlanCollapsedDayIds = previousCollapsedDayIds
      ? new Set(activeDayIds.filter((dayId) => previousCollapsedDayIds.has(dayId)))
      : new Set(activeDayIds);
    state.originalTravelPlanState = normalizeTravelPlanState(state.travelPlanDraft);
    state.originalTravelPlanSnapshot = JSON.stringify(state.originalTravelPlanState);
    setTravelPlanDirty(false, null);
    travelPlanStatus("");
    travelPlanServiceLibraryModule.populateTravelPlanServiceLibraryKindOptions();
    renderTravelPlanTranslationPanel();
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
      targetLang: bookingSourceLang(),
      disabled: !state.permissions.canEditBooking,
      translateEnabled: false,
      sourceValue,
      localizedValue: "",
      commonData: {
        [dataScope]: field,
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

  const TRAVEL_PLAN_DAY_DATE_STRING = Object.freeze({
    BEFORE_TRIP: "before_trip",
    AFTER_TRIP: "after_trip"
  });

  function normalizeTravelPlanDayDateString(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = raw.toLowerCase().replace(/\s+/g, "_");
    if (normalized === TRAVEL_PLAN_DAY_DATE_STRING.BEFORE_TRIP || normalized === "before-the-trip") {
      return TRAVEL_PLAN_DAY_DATE_STRING.BEFORE_TRIP;
    }
    if (normalized === TRAVEL_PLAN_DAY_DATE_STRING.AFTER_TRIP || normalized === "after-the-trip") {
      return TRAVEL_PLAN_DAY_DATE_STRING.AFTER_TRIP;
    }
    return raw;
  }

  function deriveNextTravelPlanDayDate(days) {
    if (!allowDates) return "";
    const items = Array.isArray(days) ? days : [];
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const candidate = nextIsoDate(items[index]?.date);
      if (candidate) return candidate;
    }
    return "";
  }

  function suggestedNextTravelPlanDayDate(dayIndex) {
    if (!allowDates) return "";
    const index = Number(dayIndex);
    if (!Number.isInteger(index) || index <= 0) return "";
    const previousDay = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days[index - 1] : null;
    return nextIsoDate(previousDay?.date);
  }

  function travelPlanSummary() {
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days.length : 0;
    const items = countTravelPlanServices(state.travelPlanDraft);
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
    return {
      primary: bookingT("booking.travel_plan", "Travel plan"),
      secondary: secondary.join(" · ")
    };
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

  function ensureTravelPlanCollapsedDayIds(initialIds = null) {
    if (!(state.travelPlanCollapsedDayIds instanceof Set)) {
      state.travelPlanCollapsedDayIds = new Set(initialIds instanceof Set ? [...initialIds] : initialIds || []);
    }
    return state.travelPlanCollapsedDayIds;
  }

  function syncTravelPlanCollapsedDayIds() {
    const activeIds = new Set(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .map((day) => String(day?.id || "").trim())
        .filter(Boolean)
    );
    const collapsedIds = ensureTravelPlanCollapsedDayIds(activeIds);
    for (const dayId of [...collapsedIds]) {
      if (!activeIds.has(dayId)) collapsedIds.delete(dayId);
    }
    return collapsedIds;
  }

  function isTravelPlanDayCollapsed(dayId) {
    return syncTravelPlanCollapsedDayIds().has(String(dayId || "").trim());
  }

  const TRAVEL_PLAN_TOGGLE_ANIMATION_MS = 240;
  const TRAVEL_PLAN_TOGGLE_INTERACTIVE_SELECTOR = [
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "label",
    "summary",
    "[role='button']",
    "[contenteditable='true']"
  ].join(", ");

  function resolveTravelPlanToggleArea(target, selector) {
    if (!(target instanceof Element)) return null;
    const area = target.closest(selector);
    if (!(area instanceof HTMLElement)) return null;
    const interactive = target.closest(TRAVEL_PLAN_TOGGLE_INTERACTIVE_SELECTOR);
    if (interactive instanceof HTMLElement && interactive !== area && area.contains(interactive)) {
      return null;
    }
    return area;
  }

  function finishTravelPlanToggleBody(body, isOpen) {
    if (!(body instanceof HTMLElement)) return;
    if (body._travelPlanToggleCleanup) {
      body.removeEventListener("transitionend", body._travelPlanToggleCleanup);
      body._travelPlanToggleCleanup = null;
    }
    if (body._travelPlanToggleTimer) {
      window.clearTimeout(body._travelPlanToggleTimer);
      body._travelPlanToggleTimer = null;
    }
    body.dataset.animating = "false";
    body.style.overflow = isOpen ? "" : "hidden";
    body.style.height = isOpen ? "auto" : "0px";
  }

  function animateTravelPlanToggleBody(body, isOpen) {
    if (!(body instanceof HTMLElement)) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      finishTravelPlanToggleBody(body, isOpen);
      return;
    }
    finishTravelPlanToggleBody(body, !isOpen);
    const startHeight = body.getBoundingClientRect().height;
    body.dataset.animating = "true";
    body.style.overflow = "hidden";
    body.style.height = `${startHeight}px`;
    const targetHeight = isOpen ? body.scrollHeight : 0;
    void body.offsetHeight;
    const cleanup = (event) => {
      if (event && event.target !== body) return;
      if (event && event.propertyName !== "height") return;
      finishTravelPlanToggleBody(body, isOpen);
    };
    body._travelPlanToggleCleanup = cleanup;
    body.addEventListener("transitionend", cleanup);
    body._travelPlanToggleTimer = window.setTimeout(() => {
      finishTravelPlanToggleBody(body, isOpen);
    }, TRAVEL_PLAN_TOGGLE_ANIMATION_MS + 80);
    body.style.height = `${targetHeight}px`;
  }

  function updateTravelPlanServiceCollapsedCopy(itemId) {
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId || !(els.travel_plan_editor instanceof HTMLElement)) return;
    const itemNode = els.travel_plan_editor.querySelector(`[data-travel-plan-service="${escapeSelectorValue(normalizedId)}"]`);
    if (!(itemNode instanceof HTMLElement)) return;
    const dayNode = itemNode.closest("[data-travel-plan-day]");
    const dayId = String(dayNode?.getAttribute("data-travel-plan-day") || "").trim();
    const day = findDraftDay(dayId);
    const item = findDraftItem(dayId, normalizedId);
    if (!day || !item) return;
    const titleNode = itemNode.querySelector(".travel-plan-service__collapsed-title");
    const timingNode = itemNode.querySelector(".travel-plan-service__collapsed-timing");
    const sourceTitle = resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), "").trim();
    const collapsedTitle = sourceTitle || bookingT("booking.travel_plan.item_heading", "Service {item}", {
      item: (Array.isArray(day.services) ? day.services : []).findIndex((entry) => entry?.id === item.id) + 1 || 1
    });
    const timingSummary = travelPlanTimingSummary(day, item).trim();
    if (titleNode instanceof HTMLElement) {
      titleNode.textContent = collapsedTitle;
    }
    if (timingNode instanceof HTMLElement) {
      timingNode.textContent = timingSummary;
      timingNode.hidden = !timingSummary;
    }
  }

  function updateTravelPlanDayCollapsedCopy(dayId) {
    const normalizedId = String(dayId || "").trim();
    if (!normalizedId || !(els.travel_plan_editor instanceof HTMLElement)) return;
    const dayNode = els.travel_plan_editor.querySelector(`[data-travel-plan-day="${escapeSelectorValue(normalizedId)}"]`);
    if (!(dayNode instanceof HTMLElement)) return;
    const headingNode = dayNode.querySelector(".travel-plan-day__collapsed-heading");
    if (!(headingNode instanceof HTMLElement)) return;
    const day = findDraftDay(normalizedId);
    const items = Array.isArray(day?.services) ? day.services : [];
    const fallback = headingNode.getAttribute("data-travel-plan-day-fallback") || "";
    const summary = travelPlanDayCollapsedSummary(day, items, { dayHeading: fallback }).trim() || fallback;
    headingNode.textContent = summary;
    headingNode.setAttribute("title", summary);
  }

  function refreshTravelPlanVisibleHeadCopy(target) {
    if (!(target instanceof Element) || !(els.travel_plan_editor instanceof HTMLElement)) return;
    const serviceNode = target.closest("[data-travel-plan-service]");
    if (serviceNode instanceof HTMLElement) {
      updateTravelPlanServiceCollapsedCopy(serviceNode.getAttribute("data-travel-plan-service"));
    }
    const dayNode = target.closest("[data-travel-plan-day]");
    if (dayNode instanceof HTMLElement) {
      updateTravelPlanDayCollapsedCopy(dayNode.getAttribute("data-travel-plan-day"));
    }
  }

  function applyTravelPlanServiceCollapsedUi(itemId, collapsed, { animate = true } = {}) {
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId || !(els.travel_plan_editor instanceof HTMLElement)) return;
    const itemNode = els.travel_plan_editor.querySelector(`[data-travel-plan-service="${escapeSelectorValue(normalizedId)}"]`);
    if (!(itemNode instanceof HTMLElement)) return;
    updateTravelPlanServiceCollapsedCopy(normalizedId);
    itemNode.classList.toggle("travel-plan-service--collapsed", collapsed);
    const toggleButton = itemNode.querySelector("[data-travel-plan-toggle-item]");
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.textContent = collapsed ? "+" : "−";
      toggleButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggleButton.setAttribute("aria-label", collapsed
        ? bookingT("booking.travel_plan.expand_item", "Expand service")
        : bookingT("booking.travel_plan.collapse_item", "Collapse service"));
    }
    const body = itemNode.querySelector(".travel-plan-service__body");
    if (body instanceof HTMLElement) {
      if (animate) {
        animateTravelPlanToggleBody(body, !collapsed);
      } else {
        finishTravelPlanToggleBody(body, !collapsed);
      }
    }
  }

  function applyTravelPlanDayCollapsedUi(dayId, collapsed, { animate = true } = {}) {
    const normalizedId = String(dayId || "").trim();
    if (!normalizedId || !(els.travel_plan_editor instanceof HTMLElement)) return;
    const dayNode = els.travel_plan_editor.querySelector(`[data-travel-plan-day="${escapeSelectorValue(normalizedId)}"]`);
    if (!(dayNode instanceof HTMLElement)) return;
    updateTravelPlanDayCollapsedCopy(normalizedId);
    dayNode.classList.toggle("travel-plan-day--collapsed", collapsed);
    const toggleButton = dayNode.querySelector("[data-travel-plan-toggle-day]");
    if (toggleButton instanceof HTMLButtonElement) {
      toggleButton.textContent = collapsed ? "+" : "−";
      toggleButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
      toggleButton.setAttribute("aria-label", collapsed
        ? bookingT("booking.travel_plan.expand_day", "Expand day")
        : bookingT("booking.travel_plan.collapse_day", "Collapse day"));
    }
    const body = dayNode.querySelector(".travel-plan-day__body");
    if (body instanceof HTMLElement) {
      if (animate) {
        animateTravelPlanToggleBody(body, !collapsed);
      } else {
        finishTravelPlanToggleBody(body, !collapsed);
      }
    }
  }

  function syncTravelPlanCollapsibleUi(animate = false) {
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    els.travel_plan_editor.querySelectorAll("[data-travel-plan-service]").forEach((element) => {
      const itemId = String(element.getAttribute("data-travel-plan-service") || "").trim();
      if (!itemId) return;
      applyTravelPlanServiceCollapsedUi(itemId, isTravelPlanServiceCollapsed(itemId), { animate });
    });
    els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]").forEach((element) => {
      const dayId = String(element.getAttribute("data-travel-plan-day") || "").trim();
      if (!dayId) return;
      applyTravelPlanDayCollapsedUi(dayId, isTravelPlanDayCollapsed(dayId), { animate });
    });
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
    if (!allowTiming) return "";
    const timingKind = String(item?.timing_kind || "label").trim();
    if (timingKind === "not_applicable") {
      return bookingT("booking.travel_plan.timing_kind.not_applicable", "Not applicable");
    }
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
    applyTravelPlanServiceCollapsedUi(normalizedId, collapsedIds.has(normalizedId), { animate: true });
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
    applyTravelPlanDayCollapsedUi(normalizedId, collapsedIds.has(normalizedId), { animate: true });
  }

  function travelPlanDayCollapsedSummary(day, items, { dayHeading = "" } = {}) {
    const title = resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), "").trim();
    const serviceCount = Array.isArray(items) ? items.length : 0;
    const parts = [String(dayHeading || "").trim()].filter(Boolean);
    parts.push(bookingT(
      serviceCount === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items",
      serviceCount === 1 ? "{count} service" : "{count} services",
      { count: serviceCount }
    ));
    if (title) parts.push(title);
    return parts.join(" · ");
  }

  function itemKindOptions(selectedValue = "other") {
    const orderedOptions = [
      ...TRAVEL_PLAN_SERVICE_KIND_OPTIONS.filter((option) => option.value === "other"),
      ...TRAVEL_PLAN_SERVICE_KIND_OPTIONS.filter((option) => option.value !== "other")
    ];
    return orderedOptions.map((option) => (
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

  function renderTravelPlanDateInput({ id, dataAttribute, value = "", disabled = false, ariaLabel = "", trailingContent = "" }) {
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
        ${trailingContent}
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
    clearTravelPlanDayDateString(textInput);
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

  function applySuggestedTravelPlanDayDate(button) {
    if (!allowDates) return null;
    const targetId = String(button?.getAttribute("data-travel-plan-apply-next-day") || "").trim();
    const suggestedDate = String(button?.getAttribute("data-travel-plan-next-day-date") || "").trim();
    const textInput = targetId ? document.getElementById(targetId) : null;
    if (!(textInput instanceof HTMLInputElement) || !suggestedDate) return null;
    return applyTravelPlanDayDateSelection(textInput, { date: suggestedDate });
  }

  function clearTravelPlanDayDateString(textInput) {
    if (!allowDates) return;
    const hiddenInput = textInput?.closest(".travel-plan-date-input")?.querySelector('[data-travel-plan-day-field="date_string"]');
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = "";
    }
  }

  function applyTravelPlanDayDateSelection(textInput, { date = "", dateString = "" } = {}) {
    if (!allowDates) return null;
    if (!(textInput instanceof HTMLInputElement)) return null;
    const hiddenInput = textInput.closest(".travel-plan-date-input")?.querySelector('[data-travel-plan-day-field="date_string"]');
    textInput.value = String(date || "").trim();
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = textInput.value ? "" : normalizeTravelPlanDayDateString(dateString);
    }
    validateTravelPlanDateTextInput(textInput, { allowPartial: false });
    syncTravelPlanDraftFromDom();
    refreshTravelPlanVisibleHeadCopy(textInput);
    updateTravelPlanDirtyState();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    syncTravelPlanDayDateShortcutButtons();
    return textInput;
  }

  function applyTravelPlanDayDateString(button) {
    if (!allowDates) return null;
    const targetId = String(button?.getAttribute("data-travel-plan-date-input-id") || "").trim();
    const dateString = normalizeTravelPlanDayDateString(button?.getAttribute("data-travel-plan-set-date-string"));
    const textInput = targetId ? document.getElementById(targetId) : null;
    if (!(textInput instanceof HTMLInputElement) || !dateString) return null;
    return applyTravelPlanDayDateSelection(textInput, { date: "", dateString });
  }

  function syncTravelPlanDayDateShortcutButtons() {
    if (!allowDates) return;
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    const dayNodes = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]"));
    dayNodes.forEach((dayNode, index) => {
      const dateInput = dayNode.querySelector('[data-travel-plan-day-field="date"]');
      const dateStringInput = dayNode.querySelector('[data-travel-plan-day-field="date_string"]');
      const nextDayButton = dayNode.querySelector("[data-travel-plan-apply-next-day]");
      const beforeTripButton = dayNode.querySelector(`[data-travel-plan-set-date-string="${TRAVEL_PLAN_DAY_DATE_STRING.BEFORE_TRIP}"]`);
      const afterTripButton = dayNode.querySelector(`[data-travel-plan-set-date-string="${TRAVEL_PLAN_DAY_DATE_STRING.AFTER_TRIP}"]`);
      const previousDateInput = index > 0
        ? dayNodes[index - 1]?.querySelector?.('[data-travel-plan-day-field="date"]')
        : null;
      const suggestedDate = nextIsoDate(previousDateInput?.value);
      const currentDate = String(dateInput?.value || "").trim();
      const currentDateString = currentDate ? "" : normalizeTravelPlanDayDateString(dateStringInput?.value);

      if (nextDayButton instanceof HTMLButtonElement) {
        nextDayButton.textContent = suggestedDate || bookingT("booking.travel_plan.next_day_button", "Next day");
        nextDayButton.setAttribute("data-travel-plan-next-day-date", suggestedDate);
        nextDayButton.disabled = !state.permissions.canEditBooking || !suggestedDate;
        nextDayButton.classList.toggle("is-active", Boolean(suggestedDate) && currentDate === suggestedDate && !currentDateString);
      }
      if (beforeTripButton instanceof HTMLButtonElement) {
        beforeTripButton.disabled = !state.permissions.canEditBooking;
        beforeTripButton.classList.toggle("is-active", !currentDate && currentDateString === TRAVEL_PLAN_DAY_DATE_STRING.BEFORE_TRIP);
      }
      if (afterTripButton instanceof HTMLButtonElement) {
        afterTripButton.disabled = !state.permissions.canEditBooking;
        afterTripButton.classList.toggle("is-active", !currentDate && currentDateString === TRAVEL_PLAN_DAY_DATE_STRING.AFTER_TRIP);
      }
    });
  }

  function validateTravelPlanDateFieldsInDom({ allowPartial = false, focusFirstInvalid = false } = {}) {
    if (!allowDates) return { ok: true, message: "" };
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
    if (!allowTiming) return "";
    const timingKind = String(item?.timing_kind || "label");
    if (timingKind === "not_applicable") {
      return `
        <div class="field travel-plan-timing-field travel-plan-timing-field--kind">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "When?"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
      `;
    }
    if (timingKind === "point") {
      const pointParts = splitDateTimeValue(day?.date, item.time_point);
      return `
        <div class="field travel-plan-timing-field travel-plan-timing-field--kind">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "When?"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field travel-plan-timing-field travel-plan-timing-field--date">
          <label for="travel_plan_time_point_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.date", "Date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_time_point_date_${item.id}`,
            dataAttribute: 'data-travel-plan-service-field="time_point_date"',
            value: pointParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.date", "Date")
          })}
        </div>
        <div class="field travel-plan-timing-field travel-plan-timing-field--time">
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
        <div class="field travel-plan-timing-field travel-plan-timing-field--kind">
          <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "When?"))}</label>
          <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
            ${timingKindOptions(timingKind)}
          </select>
        </div>
        <div class="field travel-plan-timing-field travel-plan-timing-field--start-date">
          <label for="travel_plan_start_time_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.start_date", "Start date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_start_time_date_${item.id}`,
            dataAttribute: 'data-travel-plan-service-field="start_time_date"',
            value: startParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.start_date", "Start date")
          })}
        </div>
        <div class="field travel-plan-timing-field travel-plan-timing-field--start-time">
          <label for="travel_plan_start_time_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.start_time", "Start time"))}</label>
          <select id="travel_plan_start_time_time_${escapeHtml(item.id)}" data-travel-plan-service-field="start_time_time">
            ${timeSelectOptions(startParts.time)}
          </select>
        </div>
        <div class="field travel-plan-timing-field travel-plan-timing-field--end-date">
          <label for="travel_plan_end_time_date_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.end_date", "End date"))}</label>
          ${renderTravelPlanDateInput({
            id: `travel_plan_end_time_date_${item.id}`,
            dataAttribute: 'data-travel-plan-service-field="end_time_date"',
            value: endParts.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: bookingT("booking.travel_plan.end_date", "End date")
          })}
        </div>
        <div class="field travel-plan-timing-field travel-plan-timing-field--end-time">
          <label for="travel_plan_end_time_time_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.end_time", "End time"))}</label>
          <select id="travel_plan_end_time_time_${escapeHtml(item.id)}" data-travel-plan-service-field="end_time_time">
            ${timeSelectOptions(endParts.time)}
          </select>
        </div>
      `;
    }
    return `
      <div class="field travel-plan-timing-field travel-plan-timing-field--kind">
        <label for="travel_plan_timing_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.time_information", "When?"))}</label>
        <select id="travel_plan_timing_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="timing_kind">
          ${timingKindOptions(timingKind)}
        </select>
      </div>
      <div class="field travel-plan-timing-field travel-plan-timing-field--label">
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

  function renderTravelPlanService(day, item, itemIndex) {
    const collapsed = isTravelPlanServiceCollapsed(item.id);
    const sourceTitle = resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), "").trim();
    const collapsedTitle = sourceTitle || bookingT("booking.travel_plan.item_heading", "Service {item}", { item: itemIndex + 1 });
    const timingSummary = travelPlanTimingSummary(day, item).trim();
    return `
      <div class="travel-plan-service${collapsed ? " travel-plan-service--collapsed" : ""}" data-travel-plan-service="${escapeHtml(item.id)}">
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
            <div class="travel-plan-service__title" data-travel-plan-toggle-item-area="${escapeHtml(item.id)}">
              <span class="travel-plan-service__collapsed-title">${escapeHtml(collapsedTitle)}</span>
              <span class="travel-plan-service__collapsed-timing"${timingSummary ? "" : " hidden"}>${escapeHtml(timingSummary)}</span>
            </div>
            <div class="travel-plan-service__actions">
              <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-item-up="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_item_up", "Move service up"))}">&#8593;</button>
              <button class="btn btn-ghost travel-plan-move-btn" data-travel-plan-move-item-down="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_item_down", "Move service down"))}">&#8595;</button>
              <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-item="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_item", "Remove service"))}">&times;</button>
            </div>
          </div>
          <div class="travel-plan-service__body">
          <div class="travel-plan-service__overview">
            <div class="travel-plan-service__overview-main">
              <div class="field">
                ${renderTravelPlanLocalizedField({
                  label: bookingT("booking.travel_plan.item_title", "Service Title"),
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
              ${allowServiceDetails
                ? `<div class="field">
                    ${renderTravelPlanLocalizedField({
                      label: bookingT("booking.travel_plan.item_notes", "Service Details"),
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
                  </div>`
                : ""}
            </div>
            <div class="travel-plan-service__overview-media">
              ${travelPlanImagesModule.renderTravelPlanServiceImages(day, item, {
                variant: "sidebar",
                editable: allowImageUpload && state.permissions.canEditBooking
              })}
              <div class="field travel-plan-service__image-subtitle-field">
                ${renderTravelPlanLocalizedField({
                  label: bookingT("booking.travel_plan.image_subtitle_optional", "Image subtitle (optional)"),
                  idBase: `travel_plan_image_subtitle_${item.id}`,
                  dataScope: "travel-plan-service-field",
                  dayId: day.id,
                  itemId: item.id,
                  field: "image_subtitle",
                  type: "input",
                  sourceValue: resolveLocalizedDraftBranchText(item.image_subtitle_i18n ?? item.image_subtitle, bookingSourceLang(), ""),
                  localizedValue: resolveLocalizedDraftBranchText(item.image_subtitle_i18n ?? item.image_subtitle, bookingContentLang(), "")
                })}
              </div>
            </div>
          </div>
          <div class="travel-plan-grid travel-plan-grid--item">
            <div class="field">
              <label for="travel_plan_kind_${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.travel_plan.kind_label", "Kind"))}</label>
              <select id="travel_plan_kind_${escapeHtml(item.id)}" data-travel-plan-service-field="kind">
                ${itemKindOptions(item.kind)}
              </select>
            </div>
            <div class="field">
              ${renderTravelPlanLocalizedField({
                label: bookingT("booking.travel_plan.location_optional", "Location (optional)"),
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
          ${allowTiming
            ? `<div class="travel-plan-grid travel-plan-grid--item travel-plan-grid--item-timing travel-plan-grid--item-timing-${escapeHtml(String(item.timing_kind || "label").trim() || "label")}">
                ${renderTravelPlanTimingFields(day, item)}
              </div>`
            : ""}
          </div>
          </div>
        </div>
    `;
  }

  function renderTravelPlanDay(day, dayIndex) {
    const items = Array.isArray(day.services) ? day.services : [];
    const collapsed = isTravelPlanDayCollapsed(day.id);
    const dayHeading = formatTravelPlanDayHeading(dayIndex);
    const collapsedSummary = travelPlanDayCollapsedSummary(day, items, { dayHeading });
    const headingLabel = collapsedSummary || dayHeading;
    const dateInputId = `travel_plan_day_date_${day.id}`;
    const dateStringValue = normalizeTravelPlanDayDateString(day?.date_string);
    const nextDaySuggestion = !String(day?.date || "").trim() ? suggestedNextTravelPlanDayDate(dayIndex) : "";
    const nextDayButtonLabel = nextDaySuggestion || bookingT("booking.travel_plan.next_day_button", "Next day");
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
            <div class="travel-plan-day__head-copy" data-travel-plan-toggle-day-area="${escapeHtml(day.id)}">
              <h3 class="travel-plan-day__collapsed-heading" data-travel-plan-day-fallback="${escapeHtml(dayHeading)}" title="${escapeHtml(headingLabel)}">${escapeHtml(headingLabel)}</h3>
            </div>
            <div class="travel-plan-day__actions">
              <button class="btn btn-ghost travel-plan-move-btn travel-plan-move-btn--day" data-travel-plan-move-day-up="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_day_up", "Move day up"))}">&#8593;</button>
              <button class="btn btn-ghost travel-plan-move-btn travel-plan-move-btn--day" data-travel-plan-move-day-down="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_day_down", "Move day down"))}">&#8595;</button>
              <button class="btn btn-ghost offer-remove-btn travel-plan-move-btn--day" data-travel-plan-remove-day="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_day", "Remove day"))}">&times;</button>
            </div>
          </div>
          <div class="travel-plan-day__body">
            <div class="travel-plan-day__content">
              ${allowDates
                ? `<div class="field travel-plan-day__date-field">
                    <label for="${escapeHtml(dateInputId)}">${escapeHtml(bookingT("booking.date", "Date"))}</label>
                    ${renderTravelPlanDateInput({
                      id: dateInputId,
                      dataAttribute: 'data-travel-plan-day-field="date"',
                      value: day.date,
                      disabled: !state.permissions.canEditBooking,
                      ariaLabel: `${formatTravelPlanDayHeading(dayIndex)} ${bookingT("booking.date", "Date")}`,
                      trailingContent: `
                        <input type="hidden" data-travel-plan-day-field="date_string" value="${escapeHtml(String(dateStringValue || day?.date_string || "").trim())}" />
                        <div class="travel-plan-day__date-shortcuts">
                          <button class="btn btn-ghost travel-plan-day__date-shortcut${nextDaySuggestion && String(day?.date || "").trim() === nextDaySuggestion && !dateStringValue ? " is-active" : ""}" data-travel-plan-apply-next-day="${escapeHtml(dateInputId)}" data-travel-plan-next-day-date="${escapeHtml(nextDaySuggestion)}" type="button" ${!nextDaySuggestion || !state.permissions.canEditBooking ? "disabled" : ""}>${escapeHtml(nextDayButtonLabel)}</button>
                          <button class="btn btn-ghost travel-plan-day__date-shortcut${dateStringValue === TRAVEL_PLAN_DAY_DATE_STRING.BEFORE_TRIP ? " is-active" : ""}" data-travel-plan-date-input-id="${escapeHtml(dateInputId)}" data-travel-plan-set-date-string="${escapeHtml(TRAVEL_PLAN_DAY_DATE_STRING.BEFORE_TRIP)}" type="button" ${!state.permissions.canEditBooking ? "disabled" : ""}>${escapeHtml(bookingT("booking.travel_plan.date_string.before_trip", "Before the trip"))}</button>
                          <button class="btn btn-ghost travel-plan-day__date-shortcut${dateStringValue === TRAVEL_PLAN_DAY_DATE_STRING.AFTER_TRIP ? " is-active" : ""}" data-travel-plan-date-input-id="${escapeHtml(dateInputId)}" data-travel-plan-set-date-string="${escapeHtml(TRAVEL_PLAN_DAY_DATE_STRING.AFTER_TRIP)}" type="button" ${!state.permissions.canEditBooking ? "disabled" : ""}>${escapeHtml(bookingT("booking.travel_plan.date_string.after_trip", "After the trip"))}</button>
                        </div>`
                    })}
                  </div>`
                : ""}
              <div class="travel-plan-grid">
              <div class="field">
                ${renderTravelPlanLocalizedField({
                  label: bookingT("booking.travel_plan.day_title", "Day Title"),
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
                  label: bookingT("booking.travel_plan.location_optional", "Location (optional)"),
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
                label: bookingT("booking.travel_plan.day_notes", "Day Details"),
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
              <div class="travel-plan-service-footer__actions">
                <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--service-create" data-travel-plan-add-item="${escapeHtml(day.id)}" type="button">
                  <span class="travel-plan-add-btn__icon" aria-hidden="true">+</span>
                  <span class="travel-plan-add-btn__label">${escapeHtml(bookingT("booking.travel_plan.new_item", "New service"))}</span>
                </button>
                ${allowServiceImport
                  ? `<button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service" data-travel-plan-open-import="${escapeHtml(day.id)}" data-requires-clean-state type="button">${escapeHtml(bookingT("booking.travel_plan.insert_existing", "Copy existing service"))}</button>`
                  : ""}
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
    if (!localizedInput) {
      const nextMap = normalizeLocalizedEditorMap(existingValue, sourceLang);
      if (sourceValue) nextMap[sourceLang] = sourceValue;
      else delete nextMap[sourceLang];
      return {
        map: nextMap,
        text: sourceValue
      };
    }
    const localizedValue = String(localizedInput.value || "").trim();
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
      if (allowDates) {
        day.date = String(dayNode.querySelector('[data-travel-plan-day-field="date"]')?.value || "").trim();
        day.date_string = day.date ? "" : normalizeTravelPlanDayDateString(dayNode.querySelector('[data-travel-plan-day-field="date_string"]')?.value);
      } else {
        delete day.date;
        delete day.date_string;
      }
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
      day.copied_from = previousDay?.copied_from || null;
      day.services = Array.from(dayNode.querySelectorAll("[data-travel-plan-service]")).map((itemNode) => {
        const itemId = String(itemNode.getAttribute("data-travel-plan-service") || "").trim();
        const previousItem = previousItemsById.get(itemId);
        const item = createEmptyTravelPlanService();
        item.id = itemId || item.id;
        item.timing_kind = allowTiming
          ? String(itemNode.querySelector('[data-travel-plan-service-field="timing_kind"]')?.value || "label").trim()
          : "label";
        if (allowTiming) {
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
        } else {
          item.time_label = "";
          item.time_label_i18n = {};
          item.time_point = "";
        }
        item.kind = String(itemNode.querySelector('[data-travel-plan-service-field="kind"]')?.value || "").trim();
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
        if (allowServiceDetails) {
          const itemDetails = readLocalizedFieldPayload(
            itemNode,
            "travel-plan-service-field",
            "details",
            previousItem?.details_i18n ?? previousItem?.details
          );
          item.details = itemDetails.text;
          item.details_i18n = itemDetails.map;
        } else {
          delete item.details;
          delete item.details_i18n;
        }
        if (allowTiming) {
          item.start_time = combineDateAndTime(
            String(itemNode.querySelector('[data-travel-plan-service-field="start_time_date"]')?.value || day.date || "").trim(),
            String(itemNode.querySelector('[data-travel-plan-service-field="start_time_time"]')?.value || "").trim()
          );
          item.end_time = combineDateAndTime(
            String(itemNode.querySelector('[data-travel-plan-service-field="end_time_date"]')?.value || day.date || "").trim(),
            String(itemNode.querySelector('[data-travel-plan-service-field="end_time_time"]')?.value || "").trim()
          );
        } else {
          item.start_time = "";
          item.end_time = "";
        }
        const itemImageSubtitle = readLocalizedFieldPayload(
          itemNode,
          "travel-plan-service-field",
          "image_subtitle",
          previousItem?.image_subtitle_i18n ?? previousItem?.image_subtitle
        );
        item.image_subtitle = itemImageSubtitle.text;
        item.image_subtitle_i18n = itemImageSubtitle.map;
        item.image = previousItem?.image && typeof previousItem.image === "object" && !Array.isArray(previousItem.image)
          ? previousItem.image
          : null;
        item.copied_from = previousItem?.copied_from || null;
        return item;
      });
      return day;
    });
    if (allowPdfs) {
      draft.attachments = Array.isArray(state.travelPlanDraft?.attachments) ? state.travelPlanDraft.attachments : [];
    }
    if (Object.prototype.hasOwnProperty.call(state.travelPlanDraft || {}, "translation_meta")) {
      draft.translation_meta = state.travelPlanDraft.translation_meta;
    }
    state.travelPlanDraft = normalizeTravelPlanState(draft);
    return state.travelPlanDraft;
  }

  function findDayIndex(dayId) {
    return (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).findIndex((day) => day.id === dayId);
  }

  function addDay() {
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const nextDay = createEmptyTravelPlanDay(days.length);
    if (allowDates) {
      nextDay.date = deriveNextTravelPlanDayDate(days);
    } else {
      delete nextDay.date;
      delete nextDay.date_string;
    }
    days.push(nextDay);
    state.travelPlanDraft.days = days;
    renderTravelPlanPanel();
    renderOfferPanel?.();
  }

  function renumberTravelPlanDays() {
    if (!allowRenumberDays || !state.permissions.canEditBooking) return false;
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
    if (!days.length) return false;
    const firstDayDate = String(days[0]?.date || "").trim();
    if (!isValidIsoCalendarDate(firstDayDate)) {
      syncTravelPlanRenumberDaysAction();
      travelPlanStatus(
        bookingT("booking.travel_plan.renumber_days_disabled", "Set a date on the first day to enable renumbering."),
        "error"
      );
      return false;
    }
    let nextDate = firstDayDate;
    for (let index = 1; index < days.length; index += 1) {
      nextDate = nextIsoDate(nextDate);
      if (!nextDate) break;
      days[index].date = nextDate;
      days[index].date_string = "";
    }
    state.travelPlanDraft.days = days;
    renderTravelPlanPanel();
    travelPlanStatus(bookingT("booking.travel_plan.renumber_days_done", "Days renumbered from the first day."), "success");
    return true;
  }

  function removeDay(dayId) {
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    if (!window.confirm(bookingT("booking.travel_plan.remove_day_confirm", "Remove this day and all its services?"))) return;
    state.travelPlanDraft.days.splice(dayIndex, 1);
    renderTravelPlanPanel();
    renderOfferPanel?.();
  }

  function moveDay(dayId, direction) {
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const dayIndex = days.findIndex((day) => day.id === dayId);
    if (dayIndex < 0) return;
    const nextIndex = direction === "up" ? dayIndex - 1 : dayIndex + 1;
    if (nextIndex < 0 || nextIndex >= days.length) return;
    const [day] = days.splice(dayIndex, 1);
    days.splice(nextIndex, 0, day);
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

  function removeItem(itemId) {
    syncTravelPlanDraftFromDom();
    if (!window.confirm(bookingT("booking.travel_plan.remove_item_confirm", "Remove this service?"))) return;
    for (const day of Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []) {
      const itemIndex = (Array.isArray(day.services) ? day.services : []).findIndex((item) => item.id === itemId);
      if (itemIndex < 0) continue;
      day.services.splice(itemIndex, 1);
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
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      travelPlanStatus(bookingT("booking.travel_plan.preview_popup_blocked", "Allow pop-ups to preview the PDF."), "error");
      return;
    }
    previewWindow.document.title = bookingT("booking.travel_plan.preview_pdf", "Preview PDF");
    previewWindow.document.documentElement.innerHTML = `
      <head>
        <title>${escapeHtml(bookingT("booking.travel_plan.preview_pdf", "Preview PDF"))}</title>
        <style>
          :root {
            color-scheme: light;
          }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: rgba(245, 241, 232, 0.78);
            backdrop-filter: blur(3px);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .booking-page-overlay__panel {
            min-width: min(28rem, calc(100vw - 3rem));
            max-width: 32rem;
            display: grid;
            justify-items: center;
            gap: 0.9rem;
            padding: 1.45rem 1.6rem;
            border: 1px solid rgba(202, 191, 173, 0.9);
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 24px 48px rgba(24, 35, 52, 0.16);
            text-align: center;
          }
          .booking-page-overlay__spinner {
            width: 2.2rem;
            height: 2.2rem;
            border: 3px solid rgba(202, 191, 173, 0.9);
            border-top-color: rgba(84, 93, 105, 1);
            border-radius: 999px;
            animation: booking-inline-status-spin 0.8s linear infinite;
          }
          .booking-page-overlay__text {
            color: rgba(35, 52, 73, 1);
            font-size: 1rem;
            font-weight: 600;
          }
          @keyframes booking-inline-status-spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="booking-page-overlay__panel" role="status" aria-live="polite">
          <span class="booking-page-overlay__spinner" aria-hidden="true"></span>
          <span class="booking-page-overlay__text">${escapeHtml(bookingT("booking.travel_plan.generating_pdf_overlay", "Generating travel plan PDF. Please wait."))}</span>
        </div>
      </body>
    `;
    const request = bookingTravelPlanPdfRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      query: bookingLanguageQuery()
    });
    const previewUrl = new URL(request.url, window.location.origin);
    previewUrl.searchParams.set("preview", "1");
    setBookingPageOverlay(els, true, bookingT("booking.travel_plan.generating_pdf_overlay", "Generating travel plan PDF. Please wait."));
    void fetch(previewUrl.toString(), {
      method: request.method,
      credentials: "include",
      headers: request.headers
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Preview request failed with status ${response.status}`);
      }
      const pdfBlob = await response.blob();
      const objectUrl = URL.createObjectURL(pdfBlob);
      previewWindow.location.replace(objectUrl);
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    }).catch((error) => {
      previewWindow.close();
      travelPlanStatus(bookingT("booking.travel_plan.preview_pdf_failed", "Could not preview the travel plan PDF."), "error");
      logBrowserConsoleError("[travel-plan] Failed to preview the travel plan PDF.", {
        booking_id: state.booking?.id || null,
        url: previewUrl.toString()
      }, error);
    }).finally(() => {
      setBookingPageOverlay(els, false);
    });
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
      travelPlanStatus("");
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

  function collectTravelPlanPayload({ focusFirstInvalid = true } = {}) {
    const dateFieldValidation = validateTravelPlanDateFieldsInDom({ allowPartial: false, focusFirstInvalid });
    if (!dateFieldValidation.ok) {
      return {
        ok: false,
        error: dateFieldValidation.message || bookingT("booking.travel_plan.invalid_date", "Please fix the invalid date.")
      };
    }
    syncTravelPlanDraftFromDom();
    const travelPlanPayload = buildTravelPlanPayload();
    const validation = validateTravelPlanDraft(travelPlanPayload);
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.error || bookingT("booking.travel_plan.invalid", "Travel plan is invalid.")
      };
    }
    return {
      ok: true,
      payload: travelPlanPayload
    };
  }

  async function translateTravelPlanField(button) {
    if (!allowTranslation) return;
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
    if (!allowTranslation) return;
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

  const TRAVEL_PLAN_REVIEW_SOURCE_LANG = "en";
  const BOOKING_PDF_FIELD_CONFIG_BY_KEY = new Map(
    BOOKING_PDF_PERSONALIZATION_PANELS.flatMap((panel) => (
      Array.isArray(panel.items)
        ? panel.items
            .filter((item) => item?.kind === "localized")
            .map((item) => [`${panel.scope}.${item.field}`, item])
        : []
    ))
  );

  function normalizeReviewText(value) {
    return String(value ?? "").trim();
  }

  function reviewPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function cloneReviewPlainObject(value) {
    try {
      return JSON.parse(JSON.stringify(reviewPlainObject(value)));
    } catch {
      return { ...reviewPlainObject(value) };
    }
  }

  function currentTravelPlanReviewTargetLang() {
    return normalizeBookingContentLang(
      state.coreDraft?.customer_language
      || state.booking?.customer_language
      || state.booking?.web_form_submission?.preferred_language
      || bookingContentLang("en")
    );
  }

  function pdfReviewMap(branch, field) {
    return normalizeLocalizedEditorMap(branch?.[`${field}_i18n`] ?? branch?.[field], TRAVEL_PLAN_REVIEW_SOURCE_LANG);
  }

  function ensureCorePdfPersonalizationRoot() {
    if (!state.coreDraft || typeof state.coreDraft !== "object" || Array.isArray(state.coreDraft)) {
      state.coreDraft = {};
    }
    if (!state.coreDraft.pdf_personalization || typeof state.coreDraft.pdf_personalization !== "object" || Array.isArray(state.coreDraft.pdf_personalization)) {
      state.coreDraft.pdf_personalization = cloneReviewPlainObject(state.booking?.pdf_personalization);
    }
    return state.coreDraft.pdf_personalization;
  }

  function ensureBookingPdfPersonalizationRoot() {
    if (!state.booking || typeof state.booking !== "object" || Array.isArray(state.booking)) return null;
    if (!state.booking.pdf_personalization || typeof state.booking.pdf_personalization !== "object" || Array.isArray(state.booking.pdf_personalization)) {
      state.booking.pdf_personalization = {};
    }
    return state.booking.pdf_personalization;
  }

  function ensurePdfReviewBranch(root, scope) {
    if (!root || typeof root !== "object" || Array.isArray(root)) return null;
    const normalizedScope = normalizeReviewText(scope);
    if (!normalizedScope) return null;
    if (!root[normalizedScope] || typeof root[normalizedScope] !== "object" || Array.isArray(root[normalizedScope])) {
      root[normalizedScope] = {};
    }
    return root[normalizedScope];
  }

  function pdfScopeLabel(scope) {
    switch (normalizeReviewText(scope)) {
      case "travel_plan":
        return bookingT("booking.travel_plan.travel_plan_pdf", "Travel plan PDF");
      case "offer":
        return bookingT("booking.proposal_pdf", "Offer PDF");
      case "payment_request_deposit":
      case "payment_request_installment":
      case "payment_request_final":
        return bookingT("booking.pricing.request_pdfs", "Request payment");
      case "payment_confirmation_deposit":
      case "payment_confirmation_installment":
      case "payment_confirmation_final":
        return bookingT("booking.pricing.customer_receipt", "Confirm payment");
      default:
        return bookingT("booking.pdf_texts", "PDF Texts");
    }
  }

  function pdfFieldFallbackLabel(scope, field) {
    const config = BOOKING_PDF_FIELD_CONFIG_BY_KEY.get(`${scope}.${field}`);
    if (config) return bookingT(config.labelKey, config.labelFallback);
    return normalizeReviewText(field)
      .split("_")
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  function closestText(node, selector) {
    const closest = typeof node?.closest === "function" ? node.closest(selector) : null;
    return normalizeReviewText(closest?.textContent);
  }

  function descendantText(node, selector) {
    const closest = typeof node?.closest === "function" ? node.closest(selector.root) : null;
    const descendant = closest && typeof closest.querySelector === "function"
      ? closest.querySelector(selector.child)
      : null;
    return normalizeReviewText(descendant?.textContent);
  }

  function pdfReviewFieldLabel(input, scope, field) {
    const fieldLabel = descendantText(input, {
      root: ".booking-pdf-panel__field",
      child: ".booking-pdf-panel__toggle-label span"
    })
      || closestText(input, ".localized-pair__label")
      || pdfFieldFallbackLabel(scope, field);
    const sectionLabel = descendantText(input, {
      root: ".booking-payment-document",
      child: ".booking-payment-document__title"
    })
      || descendantText(input, {
        root: ".booking-section",
        child: ".backend-section-header__primary"
      })
      || pdfScopeLabel(scope);
    return sectionLabel && fieldLabel
      ? `${sectionLabel} · ${fieldLabel}`
      : fieldLabel || sectionLabel || pdfFieldFallbackLabel(scope, field);
  }

  function setPdfReviewFieldTranslation({
    root,
    scope,
    field,
    sourceText,
    targetLang,
    targetText
  }) {
    const branch = ensurePdfReviewBranch(root, scope);
    if (!branch) return;
    const sourceValue = normalizeReviewText(sourceText || branch[field]);
    const merged = mergeDualLocalizedPayload(
      branch?.[`${field}_i18n`] ?? branch?.[field],
      sourceValue,
      normalizeReviewText(targetText),
      targetLang,
      TRAVEL_PLAN_REVIEW_SOURCE_LANG
    );
    branch[field] = sourceValue;
    branch[`${field}_i18n`] = merged.map;
  }

  function travelPlanReviewManualKeys(plan, targetLang) {
    return Array.from(
      new Set(
        (Array.isArray(plan?.translation_meta?.[targetLang]?.manual_keys) ? plan.translation_meta[targetLang].manual_keys : [])
          .map((entry) => normalizeReviewText(entry))
          .filter(Boolean)
      )
    );
  }

  function travelPlanReviewSourceHash(fields, { excludedKeys = [] } = {}) {
    const excluded = new Set((Array.isArray(excludedKeys) ? excludedKeys : []).map((entry) => normalizeReviewText(entry)).filter(Boolean));
    const source = JSON.stringify(
      (Array.isArray(fields) ? fields : [])
        .filter((field) => !excluded.has(field.key))
        .map((field) => [field.key, field.sourceText])
    );
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function travelPlanReviewFieldMap(holder, mapField) {
    return normalizeLocalizedEditorMap(holder?.[mapField], TRAVEL_PLAN_REVIEW_SOURCE_LANG);
  }

  function collectTravelPlanReviewFields(plan, targetLang) {
    const fields = [];
    const days = Array.isArray(plan?.days) ? plan.days : [];
    const normalizedTargetLang = normalizeBookingContentLang(targetLang || bookingContentLang("en"));

    function addField({ holder, mapField, plainField, key, label }) {
      if (!holder || !key) return;
      const map = travelPlanReviewFieldMap(holder, mapField);
      const sourceText = normalizeReviewText(holder?.[plainField]) || normalizeReviewText(map[TRAVEL_PLAN_REVIEW_SOURCE_LANG]);
      if (!sourceText) return;
      fields.push({
        key,
        label,
        holder,
        mapField,
        plainField,
        sourceText,
        targetText: normalizeReviewText(map[normalizedTargetLang])
      });
    }

    days.forEach((day, dayIndex) => {
      const dayId = normalizeReviewText(day?.id) || `day_${dayIndex + 1}`;
      const dayLabel = bookingT("booking.travel_plan.day_heading", "Day {day}", { day: String(dayIndex + 1) });
      addField({
        holder: day,
        mapField: "title_i18n",
        plainField: "title",
        key: `travel_plan.${dayId}.title`,
        label: `${dayLabel} · ${bookingT("booking.travel_plan.day_title", "Day Title")}`
      });
      addField({
        holder: day,
        mapField: "overnight_location_i18n",
        plainField: "overnight_location",
        key: `travel_plan.${dayId}.overnight_location`,
        label: `${dayLabel} · ${bookingT("booking.travel_plan.location_optional", "Location (optional)")}`
      });
      addField({
        holder: day,
        mapField: "notes_i18n",
        plainField: "notes",
        key: `travel_plan.${dayId}.notes`,
        label: `${dayLabel} · ${bookingT("booking.travel_plan.day_notes", "Day Details")}`
      });

      const services = Array.isArray(day?.services) ? day.services : [];
      services.forEach((service, serviceIndex) => {
        const serviceId = normalizeReviewText(service?.id) || `service_${dayIndex + 1}_${serviceIndex + 1}`;
        const serviceLabel = `${dayLabel} · ${bookingT("booking.travel_plan.service_label", "Service")} ${serviceIndex + 1}`;
        if (normalizeReviewText(service?.timing_kind || "label") === "label") {
          addField({
            holder: service,
            mapField: "time_label_i18n",
            plainField: "time_label",
            key: `travel_plan.${dayId}.${serviceId}.time_label`,
            label: `${serviceLabel} · ${bookingT("booking.travel_plan.time_label", "Time label")}`
          });
        }
        addField({
          holder: service,
          mapField: "title_i18n",
          plainField: "title",
          key: `travel_plan.${dayId}.${serviceId}.title`,
          label: `${serviceLabel} · ${bookingT("booking.travel_plan.service_title", "Title")}`
        });
        if (allowServiceDetails) {
          addField({
            holder: service,
            mapField: "details_i18n",
            plainField: "details",
            key: `travel_plan.${dayId}.${serviceId}.details`,
            label: `${serviceLabel} · ${bookingT("booking.travel_plan.item_notes", "Service Details")}`
          });
        }
        addField({
          holder: service,
          mapField: "location_i18n",
          plainField: "location",
          key: `travel_plan.${dayId}.${serviceId}.location`,
          label: `${serviceLabel} · ${bookingT("booking.travel_plan.location_optional", "Location (optional)")}`
        });
        addField({
          holder: service,
          mapField: "image_subtitle_i18n",
          plainField: "image_subtitle",
          key: `travel_plan.${dayId}.${serviceId}.image_subtitle`,
          label: `${serviceLabel} · ${bookingT("booking.travel_plan.image_subtitle_optional", "Image subtitle (optional)")}`
        });
        addField({
          holder: service?.image,
          mapField: "caption_i18n",
          plainField: "caption",
          key: `travel_plan.${dayId}.${serviceId}.image.caption`,
          label: `${serviceLabel} · ${bookingT("booking.travel_plan.image_caption", "Image caption")}`
        });
        addField({
          holder: service?.image,
          mapField: "alt_text_i18n",
          plainField: "alt_text",
          key: `travel_plan.${dayId}.${serviceId}.image.alt_text`,
          label: `${serviceLabel} · ${bookingT("booking.travel_plan.image_alt_text", "Image alt text")}`
        });
      });
    });

    return fields;
  }

  function collectBookingPdfReviewFields(targetLang) {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return [];
    const normalizedTargetLang = normalizeBookingContentLang(targetLang || bookingContentLang("en"));
    const root = reviewPlainObject(state.coreDraft?.pdf_personalization || state.booking?.pdf_personalization);
    const seen = new Set();
    return Array.from(document.querySelectorAll("[data-booking-pdf-field][data-localized-role='source']"))
      .map((input) => {
        const path = normalizeReviewText(input.getAttribute("data-booking-pdf-field"));
        const [scope, ...fieldParts] = path.split(".");
        const field = fieldParts.join(".");
        if (!scope || !field) return null;
        const key = `booking_pdf.${scope}.${field}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const branch = reviewPlainObject(root?.[scope]);
        const map = pdfReviewMap(branch, field);
        const sourceText = normalizeReviewText(input.value) || normalizeReviewText(branch?.[field]) || normalizeReviewText(map[TRAVEL_PLAN_REVIEW_SOURCE_LANG]);
        if (!sourceText) return null;
        return {
          kind: "booking_pdf",
          key,
          label: pdfReviewFieldLabel(input, scope, field),
          scope,
          field,
          sourceText,
          targetText: normalizeReviewText(map[normalizedTargetLang])
        };
      })
      .filter(Boolean);
  }

  function collectPaymentPdfReviewFields(targetLang) {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return [];
    const normalizedTargetLang = normalizeBookingContentLang(targetLang || bookingContentLang("en"));
    const root = reviewPlainObject(state.booking?.pdf_personalization);
    const seen = new Set();
    return Array.from(document.querySelectorAll("[data-payment-pdf-field][data-localized-role='source']"))
      .map((input) => {
        const scope = normalizeReviewText(input.getAttribute("data-payment-pdf-scope"));
        const path = normalizeReviewText(input.getAttribute("data-payment-pdf-field"));
        const field = normalizeReviewText(input.getAttribute("data-payment-pdf-field-name")) || path.split(".").slice(1).join(".");
        if (!scope || !field) return null;
        const key = `payment_pdf.${scope}.${field}`;
        if (seen.has(key)) return null;
        seen.add(key);
        const branch = reviewPlainObject(root?.[scope]);
        const map = pdfReviewMap(branch, field);
        const sourceText = normalizeReviewText(input.value) || normalizeReviewText(branch?.[field]) || normalizeReviewText(map[TRAVEL_PLAN_REVIEW_SOURCE_LANG]);
        if (!sourceText) return null;
        return {
          kind: "payment_pdf",
          key,
          label: pdfReviewFieldLabel(input, scope, field),
          scope,
          field,
          sourceText,
          targetText: normalizeReviewText(map[normalizedTargetLang])
        };
      })
      .filter(Boolean);
  }

  function collectBookingTranslationReviewFields(plan, targetLang) {
    const travelSummary = travelPlanReviewStatus(plan, targetLang);
    return [
      ...collectTravelPlanReviewFields(plan, targetLang).map((field) => ({
        ...field,
        kind: "travel_plan",
        stale: travelSummary.stale === true
      })),
      ...collectBookingPdfReviewFields(targetLang),
      ...collectPaymentPdfReviewFields(targetLang)
    ];
  }

  function setTravelPlanReviewFieldTranslation(holder, {
    mapField,
    plainField,
    sourceText,
    targetLang,
    targetText
  }) {
    if (!holder || targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) return;
    const sourceValue = normalizeReviewText(sourceText || holder?.[plainField]);
    const targetValue = normalizeReviewText(targetText);
    const merged = mergeDualLocalizedPayload(
      holder?.[mapField] ?? holder?.[plainField],
      sourceValue,
      targetValue,
      targetLang,
      TRAVEL_PLAN_REVIEW_SOURCE_LANG
    );
    holder[plainField] = sourceValue;
    holder[mapField] = merged.map;
  }

  function touchTravelPlanReviewMeta(plan, targetLang, origin = "machine", options = {}) {
    if (!plan || targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) return;
    const fields = collectTravelPlanReviewFields(plan, targetLang);
    if (!fields.length) return;
    const meta = plan.translation_meta && typeof plan.translation_meta === "object" && !Array.isArray(plan.translation_meta)
      ? { ...plan.translation_meta }
      : {};
    const manualKeys = Object.prototype.hasOwnProperty.call(options, "manualKeys")
      ? Array.from(new Set((Array.isArray(options.manualKeys) ? options.manualKeys : []).map((entry) => normalizeReviewText(entry)).filter(Boolean)))
      : travelPlanReviewManualKeys(plan, targetLang);
    meta[targetLang] = {
      source_lang: TRAVEL_PLAN_REVIEW_SOURCE_LANG,
      source_hash: travelPlanReviewSourceHash(fields, { excludedKeys: manualKeys }),
      origin: manualKeys.length || origin === "manual" ? "manual" : "machine",
      updated_at: new Date().toISOString(),
      ...(manualKeys.length ? { manual_keys: manualKeys } : {})
    };
    plan.translation_meta = meta;
  }

  function travelPlanReviewStatus(plan, targetLang) {
    const fields = collectTravelPlanReviewFields(plan, targetLang);
    const totalFields = fields.length;
    const translatedFields = fields.reduce((count, field) => count + (normalizeReviewText(field.targetText) ? 1 : 0), 0);
    const missingFields = Math.max(0, totalFields - translatedFields);
    const meta = plan?.translation_meta?.[targetLang] && typeof plan.translation_meta[targetLang] === "object"
      ? plan.translation_meta[targetLang]
      : null;
    const sourceHash = travelPlanReviewSourceHash(fields, {
      excludedKeys: travelPlanReviewManualKeys(plan, targetLang)
    });
    const stale = Boolean(meta?.source_hash) && meta.source_hash !== sourceHash;
    let status = "missing";
    if (targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) status = "source";
    else if (!totalFields) status = "empty";
    else if (!translatedFields) status = "missing";
    else if (stale) status = "stale";
    else if (missingFields > 0) status = "partial";
    else if (meta?.origin === "machine") status = "machine";
    else status = "current";
    return {
      status,
      totalFields,
      translatedFields,
      missingFields,
      stale
    };
  }

  function travelPlanReviewStatusLabel(status) {
    switch (status) {
      case "empty":
        return bookingT("tour.travel_plan_translation.status.empty", "No source text");
      case "partial":
        return bookingT("tour.travel_plan_translation.status.partial", "Partial");
      case "stale":
        return bookingT("tour.travel_plan_translation.status.stale", "Outdated");
      case "machine":
        return bookingT("tour.travel_plan_translation.status.machine", "Machine translated");
      case "current":
        return bookingT("tour.travel_plan_translation.status.current", "Reviewed");
      default:
        return bookingT("tour.travel_plan_translation.status.missing", "Missing");
    }
  }

  function bookingTranslationReviewStatus(fields) {
    const totalFields = Array.isArray(fields) ? fields.length : 0;
    const translatedFields = (Array.isArray(fields) ? fields : []).reduce((count, field) => (
      count + (normalizeReviewText(field?.targetText) ? 1 : 0)
    ), 0);
    const missingFields = Math.max(0, totalFields - translatedFields);
    let status = "missing";
    if (!totalFields) status = "empty";
    else if (!translatedFields) status = "missing";
    else if ((Array.isArray(fields) ? fields : []).some((field) => field?.stale === true)) status = "stale";
    else if (missingFields > 0) status = "partial";
    else status = "current";
    return {
      status,
      totalFields,
      translatedFields,
      missingFields,
      stale: status === "stale"
    };
  }

  function isTranslationIncompleteStatus(status) {
    return ["missing", "partial", "stale"].includes(String(status || ""));
  }

  function setTravelPlanTranslationSummaryState(isIncomplete) {
    const summaryButton = els.travel_plan_translation_summary;
    const nextIncomplete = Boolean(isIncomplete);
    if (lastTravelPlanTranslationIncomplete !== nextIncomplete) {
      lastTravelPlanTranslationIncomplete = nextIncomplete;
      if (typeof updatePageDirtyBar === "function") updatePageDirtyBar();
    }
    if (!(summaryButton instanceof HTMLElement)) return;
    const title = summaryButton.querySelector("[data-translation-summary-title]");
    const labelKey = isIncomplete
      ? "booking.translation.section_title_incomplete"
      : "booking.translation.section_title";
    const fallback = isIncomplete ? "Translation: incomplete" : "Translations";
    summaryButton.classList.toggle("booking-section__summary--translation-incomplete", isIncomplete);
    summaryButton.classList.toggle("backend-section__summary--translation-incomplete", isIncomplete);
    if (title instanceof HTMLElement) {
      title.dataset.i18nId = labelKey;
      title.textContent = bookingT(labelKey, fallback);
    }
  }

  function hasIncompleteTravelPlanTranslation() {
    const targetLang = currentTravelPlanReviewTargetLang();
    if (targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) return false;
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    const sourceFields = collectBookingTranslationReviewFields(plan, targetLang);
    const summary = bookingTranslationReviewStatus(sourceFields);
    return isTranslationIncompleteStatus(summary.status);
  }

  function renderBookingReviewFields(fields, targetLang) {
    if (!fields.length) {
      return `<div class="tour-reel-empty micro">${escapeHtml(bookingT("booking.translation.no_customer_content_source", "Add English travel-plan or PDF text before translating."))}</div>`;
    }
    return `
      <div class="tour-travel-plan-translation__review">
        ${fields.map((field) => `
          <div class="tour-travel-plan-translation__review-row">
            <div class="micro">${escapeHtml(field.label)}</div>
            <div class="tour-travel-plan-translation__source">${escapeHtml(field.sourceText)}</div>
            <textarea
              class="booking-text-field tour-travel-plan-translation__target"
              rows="2"
              data-booking-translation-review-key="${escapeHtml(field.key)}"
              data-booking-translation-review-lang="${escapeHtml(targetLang)}"
              ${state.permissions.canEditBooking ? "" : "disabled"}
            >${escapeHtml(field.targetText)}</textarea>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderTravelPlanTranslationPanel() {
    const section = els.travel_plan_translation_section;
    const panel = els.travel_plan_translation_panel;
    if (!(section instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;
    const targetLang = currentTravelPlanReviewTargetLang();
    if (targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) {
      setTravelPlanTranslationSummaryState(false);
      section.hidden = true;
      panel.innerHTML = "";
      return;
    }
    section.hidden = false;
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    const sourceFields = collectBookingTranslationReviewFields(plan, targetLang);
    const summary = bookingTranslationReviewStatus(sourceFields);
    setTravelPlanTranslationSummaryState(isTranslationIncompleteStatus(summary.status));
    const canTranslate = state.permissions.canEditBooking && sourceFields.length > 0;
    const progress = bookingT("tour.travel_plan_translation.progress", "{translated}/{total} fields", {
      translated: String(summary.translatedFields),
      total: String(summary.totalFields)
    });
    panel.innerHTML = `
      <div class="tour-travel-plan-translation__header">
        <div class="tour-travel-plan-translation__copy">
          <strong>${escapeHtml(bookingT("booking.translation.review_title", "Translate English customer-facing content"))}</strong>
        </div>
        <div class="tour-travel-plan-translation__actions">
          <button class="btn btn-ghost" type="button" data-travel-plan-review-translate-missing ${canTranslate ? "" : "disabled"}>
            ${escapeHtml(bookingT("tour.travel_plan_translation.translate_missing", "Translate missing/outdated"))}
          </button>
          <button class="btn btn-ghost" type="button" data-travel-plan-review-translate-all ${canTranslate ? "" : "disabled"}>
            ${escapeHtml(bookingT("tour.travel_plan_translation.translate_all", "Translate all"))}
          </button>
        </div>
      </div>
      <div class="tour-travel-plan-translation__list">
        <div class="tour-travel-plan-translation__row">
          <div>
            <strong>${escapeHtml(bookingContentLanguageOption(targetLang).label)}</strong>
            <div class="micro">${escapeHtml(bookingContentLanguageOption(targetLang).shortLabel)}</div>
          </div>
          <span class="micro tour-travel-plan-translation__status">${escapeHtml(travelPlanReviewStatusLabel(summary.status))}</span>
          <span class="micro">${escapeHtml(progress)}</span>
          <div class="tour-travel-plan-translation__actions"></div>
          ${renderBookingReviewFields(sourceFields, targetLang)}
        </div>
      </div>
    `;
  }

  function updateTravelPlanReviewField(targetLang, key, value, { rerender = false } = {}) {
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    const field = collectTravelPlanReviewFields(plan, targetLang).find((candidate) => candidate.key === key);
    if (!field) return;
    setTravelPlanReviewFieldTranslation(field.holder, {
      mapField: field.mapField,
      plainField: field.plainField,
      sourceText: field.sourceText,
      targetLang,
      targetText: value
    });
    const manualKeys = new Set(travelPlanReviewManualKeys(plan, targetLang));
    if (normalizeReviewText(value)) manualKeys.add(key);
    else manualKeys.delete(key);
    touchTravelPlanReviewMeta(plan, targetLang, "manual", { manualKeys: Array.from(manualKeys) });
    state.travelPlanDraft = plan;
    if (state.booking) state.booking.travel_plan = plan;
    updateTravelPlanDirtyState();
    if (rerender) renderTravelPlanTranslationPanel();
  }

  function updateBookingReviewField(targetLang, key, value, { rerender = false } = {}) {
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    const field = collectBookingTranslationReviewFields(plan, targetLang).find((candidate) => candidate.key === key);
    if (!field) return;
    if (field.kind === "travel_plan") {
      updateTravelPlanReviewField(targetLang, key, value, { rerender });
      return;
    }
    if (field.kind === "booking_pdf") {
      setPdfReviewFieldTranslation({
        root: ensureCorePdfPersonalizationRoot(),
        scope: field.scope,
        field: field.field,
        sourceText: field.sourceText,
        targetLang,
        targetText: value
      });
      setBookingSectionDirty("core", true, {
        reason: "pdf_translation_review_field_changed",
        field: key
      });
    } else if (field.kind === "payment_pdf") {
      setPdfReviewFieldTranslation({
        root: ensureBookingPdfPersonalizationRoot(),
        scope: field.scope,
        field: field.field,
        sourceText: field.sourceText,
        targetLang,
        targetText: value
      });
    }
    if (rerender) renderTravelPlanTranslationPanel();
  }

  function applyTravelPlanReviewTranslations(plan, targetLang, translatedEntries, origin = "machine") {
    const fields = collectTravelPlanReviewFields(plan, targetLang);
    const manualKeys = origin === "machine" ? new Set(travelPlanReviewManualKeys(plan, targetLang)) : new Set();
    for (const field of fields) {
      if (manualKeys.has(field.key)) continue;
      if (!Object.prototype.hasOwnProperty.call(translatedEntries || {}, field.key)) continue;
      setTravelPlanReviewFieldTranslation(field.holder, {
        mapField: field.mapField,
        plainField: field.plainField,
        sourceText: field.sourceText,
        targetLang,
        targetText: translatedEntries[field.key]
      });
    }
    touchTravelPlanReviewMeta(plan, targetLang, origin, { manualKeys: Array.from(manualKeys) });
  }

  function applyPdfReviewTranslations(fields, targetLang, translatedEntries) {
    const coreRoot = ensureCorePdfPersonalizationRoot();
    const paymentRoot = ensureBookingPdfPersonalizationRoot();
    let changedCore = false;
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!Object.prototype.hasOwnProperty.call(translatedEntries || {}, field.key)) continue;
      if (field.kind === "booking_pdf") {
        setPdfReviewFieldTranslation({
          root: coreRoot,
          scope: field.scope,
          field: field.field,
          sourceText: field.sourceText,
          targetLang,
          targetText: translatedEntries[field.key]
        });
        changedCore = true;
      } else if (field.kind === "payment_pdf") {
        setPdfReviewFieldTranslation({
          root: paymentRoot,
          scope: field.scope,
          field: field.field,
          sourceText: field.sourceText,
          targetLang,
          targetText: translatedEntries[field.key]
        });
      }
    }
    if (changedCore) {
      setBookingSectionDirty("core", true, {
        reason: "pdf_translation_review_machine_translation"
      });
    }
  }

  async function translateTravelPlanReview({ force = false } = {}) {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    const targetLang = currentTravelPlanReviewTargetLang();
    if (targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) return;
    syncTravelPlanDraftFromDom();
    const plan = state.travelPlanDraft || { days: [] };
    const allFields = collectBookingTranslationReviewFields(plan, targetLang);
    const summary = bookingTranslationReviewStatus(allFields);
    if (!force && !["missing", "partial", "stale"].includes(summary.status)) return;
    const fields = allFields.filter((field) => force || field.stale === true || !normalizeReviewText(field.targetText));
    const sourceEntries = Object.fromEntries(fields.map((field) => [field.key, field.sourceText]));
    if (!Object.keys(sourceEntries).length) {
      travelPlanStatus(bookingT("booking.translation.no_customer_content_source", "Add English travel-plan or PDF text before translating."), "info");
      return;
    }

    travelPlanStatus(bookingT("booking.translation.translating_customer_content", "Translating customer-facing content..."), "loading");
    setTravelPlanTranslationOverlay(true, bookingT("booking.translation.translating_customer_content_overlay", "Translating customer-facing content. Please wait."));
    try {
      const translatedEntries = await requestBookingFieldTranslation({
        bookingId: state.booking.id,
        entries: sourceEntries,
        fetchBookingMutation,
        apiBase: apiOrigin,
        actor: state.user || "keycloak_user",
        sourceLang: TRAVEL_PLAN_REVIEW_SOURCE_LANG,
        targetLang
      });
      if (!translatedEntries) return;
      applyTravelPlanReviewTranslations(plan, targetLang, translatedEntries, "machine");
      applyPdfReviewTranslations(fields, targetLang, translatedEntries);
      state.travelPlanDraft = plan;
      if (state.booking) state.booking.travel_plan = plan;
      renderTravelPlanTranslationPanel();
      updateTravelPlanDirtyState();
      travelPlanStatus(bookingT("tour.travel_plan_translation.done", "Translations updated."), "success");
    } catch (error) {
      logBrowserConsoleError("[travel-plan] Failed to translate travel-plan review fields.", {
        booking_id: state.booking?.id || "",
        target_lang: targetLang
      }, error);
      travelPlanStatus(error?.message || bookingT("booking.translation.error", "Could not translate this section."), "error");
    } finally {
      setTravelPlanTranslationOverlay(false);
    }
  }

  function bindEvents() {
    if (els.travel_plan_editor && els.travel_plan_editor.dataset.travelPlanBound !== "true") {
      els.travel_plan_editor.addEventListener("input", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          clearTravelPlanDayDateString(target);
          validateTravelPlanDateTextInput(target, { allowPartial: true });
        }
        syncTravelPlanDraftFromDom();
        syncTravelPlanDayDateShortcutButtons();
        refreshTravelPlanVisibleHeadCopy(target);
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        renderTravelPlanTranslationPanel();
      });
      els.travel_plan_editor.addEventListener("change", (event) => {
        let target = event.target;
        if (target?.matches?.("[data-travel-plan-date-picker-for]")) {
          target = applyTravelPlanDatePickerValue(target) || target;
        }
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          clearTravelPlanDayDateString(target);
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
        syncTravelPlanDraftFromDom();
        syncTravelPlanDayDateShortcutButtons();
        refreshTravelPlanVisibleHeadCopy(target);
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        renderTravelPlanTranslationPanel();
        const shouldRerender = Boolean(
          target?.matches?.('[data-travel-plan-service-field="timing_kind"]')
          || target?.matches?.('[data-travel-plan-service-field="kind"]')
        );
        if (shouldRerender) {
          renderTravelPlanPanel();
        }
      });
      els.travel_plan_editor.addEventListener("click", (event) => {
        const dayToggleArea = resolveTravelPlanToggleArea(event.target, "[data-travel-plan-toggle-day-area]");
        if (dayToggleArea) {
          toggleTravelPlanDayCollapsed(dayToggleArea.getAttribute("data-travel-plan-toggle-day-area"));
          return;
        }
        const itemToggleArea = resolveTravelPlanToggleArea(event.target, "[data-travel-plan-toggle-item-area]");
        if (itemToggleArea) {
          toggleTravelPlanServiceCollapsed(itemToggleArea.getAttribute("data-travel-plan-toggle-item-area"));
          return;
        }
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
        if (button.hasAttribute("data-travel-plan-remove-day")) {
          removeDay(button.getAttribute("data-travel-plan-remove-day"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-apply-next-day")) {
          applySuggestedTravelPlanDayDate(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-set-date-string")) {
          applyTravelPlanDayDateString(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-day-up")) {
          moveDay(button.getAttribute("data-travel-plan-move-day-up"), "up");
          return;
        }
        if (button.hasAttribute("data-travel-plan-move-day-down")) {
          moveDay(button.getAttribute("data-travel-plan-move-day-down"), "down");
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-item")) {
          addItem(button.getAttribute("data-travel-plan-add-item"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-open-day-import")) {
          travelPlanServiceLibraryModule.openTravelPlanDayLibrary();
          return;
        }
        if (button.hasAttribute("data-travel-plan-open-plan-import")) {
          travelPlanServiceLibraryModule.openTravelPlanLibrary();
          return;
        }
        if (button.hasAttribute("data-travel-plan-open-tour-import") || button.hasAttribute("data-travel-plan-open-standard-tour-import")) {
          travelPlanServiceLibraryModule.openStandardTourLibrary();
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
        if (button.hasAttribute("data-travel-plan-remove-image")) {
          void travelPlanImagesModule.removeTravelPlanServiceImage(
            button.getAttribute("data-travel-plan-day-id"),
            button.getAttribute("data-travel-plan-service-id"),
            button.getAttribute("data-travel-plan-remove-image")
          );
          return;
        }
        if (button.hasAttribute("data-localized-translate")) {
          if (!allowTranslation) return;
          void translateTravelPlanField(button);
          return;
        }
        if (button.hasAttribute("data-travel-plan-date-picker-btn")) {
          openTravelPlanDatePicker(button);
          return;
        }
      });
      els.travel_plan_editor.addEventListener("focusout", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
      });
      els.travel_plan_editor.dataset.travelPlanBound = "true";
      window.setTimeout(() => {
        warnIfTravelPlanControlsMissing("post-load-watchdog");
      }, 1500);
    }
    if (els.travel_plan_translation_panel && els.travel_plan_translation_panel.dataset.travelPlanBound !== "true") {
      els.travel_plan_translation_panel.addEventListener("input", (event) => {
        const field = event.target instanceof HTMLElement
          ? event.target.closest("[data-booking-translation-review-key]")
          : null;
        if (!field) return;
        updateBookingReviewField(
          normalizeBookingContentLang(field.getAttribute("data-booking-translation-review-lang")),
          normalizeReviewText(field.getAttribute("data-booking-translation-review-key")),
          field.value || ""
        );
      });
      els.travel_plan_translation_panel.addEventListener("change", (event) => {
        const field = event.target instanceof HTMLElement
          ? event.target.closest("[data-booking-translation-review-key]")
          : null;
        if (!field) return;
        updateBookingReviewField(
          normalizeBookingContentLang(field.getAttribute("data-booking-translation-review-lang")),
          normalizeReviewText(field.getAttribute("data-booking-translation-review-key")),
          field.value || "",
          { rerender: true }
        );
      });
      els.travel_plan_translation_panel.addEventListener("click", (event) => {
        const translateMissingButton = event.target instanceof Element
          ? event.target.closest("[data-travel-plan-review-translate-missing]")
          : null;
        if (translateMissingButton) {
          event.preventDefault();
          void translateTravelPlanReview({ force: false });
          return;
        }
        const translateAllButton = event.target instanceof Element
          ? event.target.closest("[data-travel-plan-review-translate-all]")
          : null;
        if (translateAllButton) {
          event.preventDefault();
          void translateTravelPlanReview({ force: true });
        }
      });
      els.travel_plan_translation_panel.dataset.travelPlanBound = "true";
    }
    if (allowPdfs && els.travel_plan_pdf_workspace && els.travel_plan_pdf_workspace.dataset.travelPlanBound !== "true") {
      els.travel_plan_pdf_workspace.addEventListener("click", (event) => {
        const button = event.target instanceof Element ? event.target.closest("button") : null;
        if (!(button instanceof HTMLButtonElement)) return;
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
        if (button.hasAttribute("data-travel-plan-pdf-save-comment")) {
          const artifactId = String(button.getAttribute("data-travel-plan-pdf-save-comment") || "").trim();
          const input = els.travel_plan_pdf_workspace.querySelector(`[data-travel-plan-pdf-comment-input="${CSS.escape(artifactId)}"]`);
          const nextValue = input instanceof HTMLTextAreaElement ? input.value : "";
          void travelPlanPdfsModule.saveTravelPlanPdfComment(artifactId, nextValue).then((ok) => {
            if (!ok) renderTravelPlanPanel();
          });
        }
      });
      els.travel_plan_pdf_workspace.addEventListener("change", (event) => {
        const target = event.target;
        if (target?.matches?.("[data-travel-plan-pdf-sent]")) {
          const artifactId = String(target.getAttribute("data-travel-plan-pdf-sent") || "").trim();
          const sentToCustomer = target.checked === true;
          void travelPlanPdfsModule.setTravelPlanPdfSentToCustomer(artifactId, sentToCustomer).then((ok) => {
            if (!ok) renderTravelPlanPanel();
          });
        }
      });
      els.travel_plan_pdf_workspace.dataset.travelPlanBound = "true";
    }
    if (allowTranslation && els.travel_plan_translate_all_btn instanceof HTMLButtonElement && els.travel_plan_translate_all_btn.dataset.travelPlanBound !== "true") {
      els.travel_plan_translate_all_btn.addEventListener("click", () => {
        void translateEntireTravelPlan();
      });
      els.travel_plan_translate_all_btn.dataset.travelPlanBound = "true";
    }
    if (allowRenumberDays && els.travel_plan_renumber_days_btn instanceof HTMLButtonElement && els.travel_plan_renumber_days_btn.dataset.travelPlanBound !== "true") {
      els.travel_plan_renumber_days_btn.addEventListener("click", () => {
        renumberTravelPlanDays();
      });
      els.travel_plan_renumber_days_btn.dataset.travelPlanBound = "true";
    }
    travelPlanServiceLibraryModule.bindTravelPlanServiceLibrary();
    if (allowImageUpload) {
      travelPlanImagesModule.bindTravelPlanImageInput();
      travelPlanImagesModule.bindTravelPlanImagePreviewModal();
    }
    if (allowPdfs) {
      travelPlanAttachmentsModule.bindTravelPlanAttachmentInput();
    }
    syncTravelPlanTranslateButton();
    syncTravelPlanRenumberDaysAction();
  }

  function renderTravelPlanPanel() {
    if (!els.travel_plan_panel || !els.travel_plan_editor || !state.booking) return;
    state.travelPlanDraft = normalizeTravelPlanState(state.travelPlanDraft || state.booking.travel_plan);
    syncTravelPlanCollapsedServiceIds();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    const hasDays = Array.isArray(state.travelPlanDraft.days) && state.travelPlanDraft.days.length > 0;
    const tourTemplateLabel = hasDays
      ? bookingT("booking.travel_plan.append_marketing_tour", "Append a Marketing Tour")
      : bookingT("booking.travel_plan.use_marketing_tour", "Use a Marketing Tour");
    const bookingPlanLabel = hasDays
      ? bookingT("booking.travel_plan.append_existing_plan", "Append a Travel Plan from another Booking")
      : bookingT("booking.travel_plan.use_existing_plan", "Use a Travel Plan from another Booking");
    const primaryActionRowClass = allowDayImport
      ? "travel-plan-footer__action-row travel-plan-footer__action-row--double"
      : "travel-plan-footer__action-row";
    els.travel_plan_editor.innerHTML = `
      ${(Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : []).map((day, dayIndex) => renderTravelPlanDay(day, dayIndex)).join("") || `<p class="travel-plan-empty">${escapeHtml(bookingT("booking.travel_plan.no_days", "No travel-plan days yet."))}</p>`}
      <div class="travel-plan-footer">
        <div class="travel-plan-footer__action-rows">
          <div class="${primaryActionRowClass}">
            <button class="btn btn-ghost booking-offer-add-btn travel-plan-add-day-btn travel-plan-add-day-btn--combined" data-travel-plan-add-day type="button">
              <span class="travel-plan-add-btn__icon" aria-hidden="true">+</span>
              <span class="travel-plan-add-btn__label">${escapeHtml(bookingT("booking.travel_plan.new_day", "New day"))}</span>
            </button>
            ${allowDayImport
              ? `<button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--day-copy" data-travel-plan-open-day-import data-requires-clean-state type="button">${escapeHtml(bookingT("booking.travel_plan.insert_existing_day", "Copy existing day"))}</button>`
              : ""}
          </div>
          ${allowTourImport
            ? `<div class="travel-plan-footer__action-row">
                <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--day-copy" data-travel-plan-open-tour-import data-requires-clean-state type="button">${escapeHtml(tourTemplateLabel)}</button>
              </div>`
            : ""}
          ${allowPlanImport
            ? `<div class="travel-plan-footer__action-row">
                <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--day-copy" data-travel-plan-open-plan-import data-requires-clean-state type="button">${escapeHtml(bookingPlanLabel)}</button>
              </div>`
            : ""}
        </div>
      </div>
    `;
    if (allowPdfs && els.travel_plan_pdf_workspace) {
      els.travel_plan_pdf_workspace.innerHTML = buildBookingPdfWorkspaceMarkup({
        escapeHtml,
        previewButtonMarkup: `<button class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn travel-plan-pdf-btn--preview" data-travel-plan-preview-pdf data-requires-clean-state data-clean-state-hint-id="travel_plan_pdf_dirty_hint" type="button">${escapeHtml(bookingT("booking.travel_plan.preview_pdf", "Preview"))}</button>`,
        previewStatusMarkup: `<span id="travel_plan_pdf_dirty_hint" class="micro booking-inline-status travel-plan-pdf-actions__hint"></span>`,
        documentsMarkup: travelPlanPdfsModule.renderTravelPlanPdfsTable(),
        createButtonMarkup: `<button class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn" data-travel-plan-create-pdf data-requires-clean-state data-clean-state-hint-id="travel_plan_pdf_dirty_hint" type="button">${escapeHtml(bookingT("booking.travel_plan.create_pdf", "Create PDF"))}</button>`,
        attachmentsMarkup: travelPlanAttachmentsModule.renderTravelPlanAttachments(state.travelPlanDraft)
      });
    } else if (els.travel_plan_pdf_workspace) {
      els.travel_plan_pdf_workspace.innerHTML = "";
    }
    syncTravelPlanCollapsibleUi(false);
    syncTravelPlanDayDateShortcutButtons();
    updateTravelPlanDirtyState();
    syncTravelPlanTranslateButton();
    syncTravelPlanRenumberDaysAction();
    renderTravelPlanTranslationPanel();
    scheduleTravelPlanControlsDiagnostic("renderTravelPlanPanel");
  }

  return {
    applyBookingPayload,
    bindEvents,
    collectTravelPlanPayload,
    renderTravelPlanPanel,
    renderTravelPlanTranslationPanel,
    hasIncompleteTravelPlanTranslation,
    updateTravelPlanDirtyState,
    saveTravelPlan
  };
}

export const createTravelPlanEditorCore = createBookingTravelPlanModule;
