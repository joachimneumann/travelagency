import {
  bookingTravelPlanPdfRequest,
  bookingTravelPlanPdfCreateRequest,
  bookingTravelPlanRequest,
  bookingTravelPlanTranslateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { fetchApiJson, logBrowserConsoleError } from "../shared/api.js";
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
  createEmptyTravelPlanBoundaryService,
  createEmptyTravelPlanDay,
  createEmptyTravelPlanService,
  normalizeTravelPlanDraft
} from "../booking/travel_plan_helpers.js";
import { validateTravelPlanDraft as validateTravelPlanDraftState } from "../booking/travel_plan_validation.js";
import {
  createBookingTravelPlanImagesModule,
  resolveTravelPlanImageSrc
} from "../booking/travel_plan_images.js";
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
import {
  normalizeDestinationScope,
  normalizeDestinationScopeCatalog,
  renderDestinationScopeEditor
} from "./destination_scope_editor.js";
import {
  applyTravelPlanBoundaryAirportSelection,
  applyTravelPlanBoundaryPlacementSelection,
  createTravelPlanBoundarySectionsRenderer,
  normalizeAirportCatalogItems,
  travelPlanBoundaryDetailsLabel,
  travelPlanBoundaryLabel,
  travelPlanBoundaryTitleLabel
} from "./travel_plan_boundary_sections.js";
import { fetchAndShowPdfPreview } from "./pdf_preview_window.js";
import {
  appendTravelPlanRouteSmokePuffs,
  TRAVEL_PLAN_ROUTE_DELETE_DISTANCE_PX,
  TRAVEL_PLAN_ROUTE_SMOKE_ANIMATION_MS
} from "./travel_plan_route_drag_effects.js";
import { resolveTravelPlanEditorPreset } from "./travel_plan_presets.js";
import { createTourCustomizerWorkspace } from "../tour_customize.js";

export function resolveTravelPlanExperienceHighlightTitle(item, {
  displayLang = "en",
  sourceLang = "en",
  fallbackTitle = ""
} = {}) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const titleMap = source.title_i18n && typeof source.title_i18n === "object" && !Array.isArray(source.title_i18n)
    ? source.title_i18n
    : {};
  const normalizedDisplayLang = normalizeBookingContentLang(displayLang || "en");
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || "en");
  const candidates = [
    titleMap[normalizedDisplayLang],
    titleMap[normalizedSourceLang],
    titleMap.en,
    source.title,
    fallbackTitle
  ];
  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

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
    buildTravelPlanSaveRequest,
    buildTravelPlanPdfPreviewRequest,
    buildTravelPlanServiceImageUploadRequest,
    buildTravelPlanServiceImageDeleteRequest,
    buildTravelPlanDaySearchRequest,
    buildTravelPlanServiceSearchRequest,
    buildTravelPlanDayImportRequest,
    buildTravelPlanServiceImportRequest,
    cloneTravelPlanDayForLocalImport,
    cloneTravelPlanServiceForLocalImport,
    travelPlanLibrarySource,
    preset = "booking",
    features: featureOverrides = {}
  } = ctx;
  const resolvedPreset = resolveTravelPlanEditorPreset(preset, featureOverrides);
  const features = resolvedPreset.features;
  const setTravelPlanPageOverlay = typeof ctx.setPageOverlay === "function"
    ? ctx.setPageOverlay
    : (isVisible, message = "") => setBookingPageOverlay(els, isVisible, message);
  let lastMissingTravelPlanControlsDiagnosticKey = "";
  let lastTravelPlanTranslationIncomplete = null;
  let configuredTranslationProviderDisplay = "";
  let configuredTranslationProviderDisplayPromise = null;

  function isFeatureEnabled(key, defaultValue = true) {
    if (!Object.prototype.hasOwnProperty.call(features, key)) return defaultValue;
    return features[key] !== false;
  }

  const allowDayImport = isFeatureEnabled("dayImport");
  const allowTourImport = isFeatureEnabled("tourImport");
  const allowServiceImport = isFeatureEnabled("serviceImport");
  const allowImageUpload = isFeatureEnabled("imageUpload");
  const allowDates = isFeatureEnabled("dates");
  const allowTiming = isFeatureEnabled("timing", allowDates);
  const allowServiceDetails = isFeatureEnabled("serviceDetails");
  const allowTranslation = isFeatureEnabled("translation");
  const allowSequentialDayDates = isFeatureEnabled("sequentialDayDates", allowDates);
  const allowPdfs = isFeatureEnabled("pdfs");
  const allowDestinationScope = isFeatureEnabled("destinationScope");
  const allowDestinationScopeCreate = isFeatureEnabled("destinationScopeCreate", false);
  const allowTourCardImageSelection = isFeatureEnabled("tourCardImageSelection", false);
  const travelPlanServiceMode = String(features.services || "editable").trim() || "editable";
  const allowEditableServices = travelPlanServiceMode === "editable";
  const allowDayTitleEdit = isFeatureEnabled("dayTitleEdit");
  const allowDayDetailsEdit = isFeatureEnabled("dayDetailsEdit");
  const allowDayReadOnlyInfo = isFeatureEnabled("dayReadOnlyInfo");
  const allowMapPointEdit = isFeatureEnabled("mapPointEdit");
  const allowDayAdd = isFeatureEnabled("dayAdd");
  const allowDayDelete = isFeatureEnabled("dayDelete");
  const allowDayReorder = isFeatureEnabled("dayReorder");
  const allowCustomizer = isFeatureEnabled("customizer");
  const customizerStorageMode = String(features.customizerStorage || resolvedPreset.preset.customizerStorage || "copiedDays").trim();
  const pruneEmptyTravelPlanContentOnCollect = isFeatureEnabled("pruneEmptyTravelPlanContentOnCollect", false);
  const allowAllPrimaryMapPointOptions = isFeatureEnabled("allPrimaryMapPointOptions", false);
  const allowAirportSelect = isFeatureEnabled("airportSelect", false);
  const showDepartureBoundaryAfterDays = isFeatureEnabled("departureBoundaryAfterDays", false);
  const showDayDetailsAfterTitle = isFeatureEnabled("dayDetailsAfterTitle", false);
  const useFocusedBookingWorkspace = isFeatureEnabled("focusedBookingWorkspace", false);
  let travelPlanCustomizerPreviewWorkspace = null;
  let travelPlanCustomizerOverlayWorkspace = null;
  let travelPlanCustomizerSourceRowsPromise = null;
  let travelPlanCustomizerOverlayOpen = false;
  let draggedTravelPlanRouteDayId = "";
  let travelPlanRouteDeleteActive = false;
  let travelPlanRouteDragGhost = null;
  let travelPlanRouteNativeDragImage = null;
  let travelPlanRouteDragOffset = { x: 0, y: 0 };
  let travelPlanRouteDocumentListeners = null;
  let draggedTravelPlanServiceItemId = "";
  let travelPlanServiceDragGhost = null;
  let travelPlanServiceNativeDragImage = null;
  let travelPlanServiceDragOffset = { x: 0, y: 0 };
  let travelPlanEventController = null;
  let suppressTravelPlanRouteClickUntil = 0;

  const travelPlanCustomizerLabels = {
    map: "Route map",
    optimize: "Reorder route",
    zoomOut: "Zoom out",
    optionalDays: "Optional days",
    noOptionalDays: "No optional days are available from marketing tours yet.",
    timeline: "Booking travel plan",
    timelineWithCount: "Booking travel plan ({count})",
    emptyTimeline: "Add at least one day to keep customizing.",
    day: "Day {day}",
    moveHere: "move here",
    dropHere: "drop here"
  };

  function destinationScopeEditorRoot() {
    if (els.travel_plan_destination_scope_editor instanceof HTMLElement) {
      return els.travel_plan_destination_scope_editor;
    }
    return els.travel_plan_editor;
  }

  function usesExternalDestinationScopeEditor() {
    return allowDestinationScope
      && els.travel_plan_destination_scope_editor instanceof HTMLElement
      && els.travel_plan_destination_scope_editor !== els.travel_plan_editor;
  }

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

  function withBackendLangQuery(urlLike) {
    const url = new URL(urlLike, window.location.origin);
    const lang = typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
    if (lang && !url.searchParams.has("lang")) url.searchParams.set("lang", lang);
    return url.toString();
  }

  function withDestinationScopeEnglishLangQuery(urlLike) {
    const url = new URL(urlLike, window.location.origin);
    url.searchParams.set("lang", "en");
    return url.toString();
  }

  function shouldMarkEnglishDestinationScopeInputs() {
    const lang = typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
    return String(lang || "").trim().toLowerCase() === "vi";
  }

  function travelPlanExperienceHighlightDisplayLang() {
    const backendLang = typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
    return normalizeBookingContentLang(backendLang || bookingContentLang());
  }

  function destinationScopeEnglishInputLabel(label) {
    return shouldMarkEnglishDestinationScopeInputs() ? `${label} (EN)` : label;
  }

  async function loadDestinationScopeCatalog({ force = false } = {}) {
    if (!allowDestinationScope && !allowAllPrimaryMapPointOptions) return null;
    if (state.destinationScopeCatalog && !force) return state.destinationScopeCatalog;
    try {
      const url = withBackendLangQuery(`${apiOrigin}/api/v1/destination-scope/catalog`);
      const response = await fetchBookingMutation(url, { method: "GET" });
      state.destinationScopeCatalog = normalizeDestinationScopeCatalog(response);
    } catch (error) {
      logBrowserConsoleError("[destination-scope] Failed to load destination scope catalog.", {
        booking_id: state.booking?.id || null
      }, error);
      state.destinationScopeCatalog = normalizeDestinationScopeCatalog({});
    }
    return state.destinationScopeCatalog;
  }

  async function loadAirportCatalog({ force = false } = {}) {
    if (!allowAirportSelect) return [];
    if (Array.isArray(state.airportCatalog) && !force) return state.airportCatalog;
    if (state.airportCatalogPromise && !force) return state.airportCatalogPromise;
    state.airportCatalogPromise = fetch("/config/airports.json", {
      cache: "no-cache",
      credentials: "same-origin"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Airport catalog request failed with ${response.status}`);
        }
        const payload = await response.json();
        state.airportCatalog = normalizeAirportCatalogItems(payload);
        return state.airportCatalog;
      })
      .catch((error) => {
        logBrowserConsoleError("[travel-plan] Failed to load airport catalog.", {
          booking_id: state.booking?.id || null
        }, error);
        state.airportCatalog = [];
        return state.airportCatalog;
      })
      .finally(() => {
        state.airportCatalogPromise = null;
      });
    return state.airportCatalogPromise;
  }

  async function createDestinationScopeRegion(destination) {
    const name = window.prompt(destinationScopeEnglishInputLabel(bookingT("booking.travel_plan.add_region_prompt", "Region name")));
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return false;
    const url = withDestinationScopeEnglishLangQuery(`${apiOrigin}/api/v1/destination-scope/regions`);
    const result = await fetchBookingMutation(url, {
      method: "POST",
      body: {
        destination,
        name: normalizedName
      }
    });
    if (!result) return false;
    if (result.catalog) state.destinationScopeCatalog = normalizeDestinationScopeCatalog(result.catalog);
    if (result?.region?.id) {
      state.travelPlanDraft.destination_scope = normalizeDestinationScope([
        ...normalizeDestinationScope(state.travelPlanDraft.destination_scope),
        {
          destination,
          regions: [{ region_id: result.region.id, places: [] }],
          places: []
        }
      ]);
      renderTravelPlanPanel();
      return true;
    }
    await loadDestinationScopeCatalog({ force: true });
    renderTravelPlanPanel();
    return true;
  }

  async function createDestinationScopePlace(regionId, destination = "") {
    const name = window.prompt(destinationScopeEnglishInputLabel(bookingT("booking.travel_plan.add_place_prompt", "Place name")));
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return false;
    const url = withDestinationScopeEnglishLangQuery(`${apiOrigin}/api/v1/destination-scope/places`);
    const result = await fetchBookingMutation(url, {
      method: "POST",
      body: {
        destination,
        ...(regionId ? { region_id: regionId } : {}),
        name: normalizedName
      }
    });
    if (!result) return false;
    if (result.catalog) state.destinationScopeCatalog = normalizeDestinationScopeCatalog(result.catalog);
    if (result?.place?.id) {
      const scope = normalizeDestinationScope(state.travelPlanDraft.destination_scope);
      const placeDestination = result.place.destination || destination;
      for (const entry of scope) {
        if (!regionId && entry.destination === placeDestination) {
          entry.places = Array.isArray(entry.places) ? entry.places : [];
          if (!entry.places.some((place) => place.place_id === result.place.id)) {
            entry.places.push({ place_id: result.place.id });
          }
          continue;
        }
        const region = (Array.isArray(entry.regions) ? entry.regions : []).find((item) => item.region_id === regionId);
        if (!region) continue;
        region.places = Array.isArray(region.places) ? region.places : [];
        if (!region.places.some((place) => place.place_id === result.place.id)) {
          region.places.push({ place_id: result.place.id });
        }
      }
      state.travelPlanDraft.destination_scope = normalizeDestinationScope(scope);
      renderTravelPlanPanel();
      return true;
    }
    await loadDestinationScopeCatalog({ force: true });
    renderTravelPlanPanel();
    return true;
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

  function refreshActivitiesInBackground(reason = "travel_plan_mutation") {
    void Promise.resolve()
      .then(() => loadActivities())
      .catch((error) => {
        logBrowserConsoleError("[travel-plan] Failed to refresh activities in the background.", {
          booking_id: state.booking?.id || "",
          reason
        }, error);
      });
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
    setTravelPlanPageOverlay(
      isVisible,
      message || bookingT("booking.translation.translating_overlay", "Translating travel plan. Please wait.")
    );
  }

  const MIN_TRAVEL_PLAN_TRANSLATION_OVERLAY_MS = 500;

  function waitForMs(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  async function waitForMinimumElapsed(startedAt, minimumMs) {
    const remainingMs = Math.max(0, (Number(minimumMs) || 0) - (Date.now() - Number(startedAt || 0)));
    if (remainingMs > 0) await waitForMs(remainingMs);
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

  function validateTravelPlanDraft(plan) {
    return validateTravelPlanDraftState(plan, {
      validItemKinds: new Set(TRAVEL_PLAN_SERVICE_KIND_OPTIONS.map((option) => option.value)),
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

  function hasTravelPlanTextContent(value) {
    return String(value ?? "").trim().length > 0;
  }

  function localizedTravelPlanMapHasContent(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.values(value).some((entry) => hasTravelPlanTextContent(entry));
  }

  function localizedTravelPlanFieldHasContent(source, fieldName) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return false;
    return hasTravelPlanTextContent(source[fieldName])
      || localizedTravelPlanMapHasContent(source[`${fieldName}_i18n`]);
  }

  function travelPlanImageHasContent(image) {
    return Boolean(image && typeof image === "object" && !Array.isArray(image) && hasTravelPlanTextContent(image.storage_path));
  }

  function travelPlanServiceHasContent(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return [
      "time",
      "title",
      "details",
      "image_subtitle"
    ].some((fieldName) => localizedTravelPlanFieldHasContent(item, fieldName))
      || (hasTravelPlanTextContent(item.kind) && String(item.kind).trim().toLowerCase() !== "other")
      || travelPlanImageHasContent(item.image);
  }

  function travelPlanBoundaryHasContent(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return [
      "time",
      "title",
      "details",
      "image_subtitle",
      "airport_code",
      "from_label",
      "to_label"
    ].some((fieldName) => localizedTravelPlanFieldHasContent(item, fieldName))
      || travelPlanImageHasContent(item.image);
  }

  function normalizeTravelPlanBoundaryKind(value) {
    return String(value || "").trim().toLowerCase() === "departure" ? "departure" : "arrival";
  }

  function normalizeTravelPlanBoundaryPlacement(value, boundaryKind, fallback = "") {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    const normalized = String(value || fallback || "").trim().toLowerCase();
    if (normalizedBoundaryKind === "departure") {
      return normalized === "after_last_day" ? "after_last_day" : "last_day";
    }
    return normalized === "before_first_day" ? "before_first_day" : "first_day";
  }

  function defaultTravelPlanBoundaryPresentation(boundaryKind, placement = "") {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    const normalizedPlacement = normalizeTravelPlanBoundaryPlacement(placement, normalizedBoundaryKind);
    return {
      attach_to: normalizedPlacement,
      position: normalizedBoundaryKind === "departure" ? "end" : "start"
    };
  }

  function travelPlanBoundarySelectionValue(item, boundaryKind) {
    if (!item || item.enabled !== true) return "none";
    return normalizeTravelPlanBoundaryPlacement(item?.presentation?.attach_to, boundaryKind);
  }

  function normalizeTravelPlanBoundaryDraft(source, boundaryKind) {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    const fallback = createEmptyTravelPlanBoundaryService(normalizedBoundaryKind);
    const raw = source && typeof source === "object" && !Array.isArray(source) ? source : {};
    const next = {
      ...fallback,
      ...raw,
      id: String(raw.id || fallback.id || "").trim(),
      boundary_kind: normalizedBoundaryKind,
      enabled: raw.enabled === true,
      kind: String(raw.kind || "transport").trim() || "transport",
      airport_code: String(raw.airport_code || "").trim(),
      from_label: String(raw.from_label || "").trim(),
      to_label: String(raw.to_label || "").trim(),
      presentation: defaultTravelPlanBoundaryPresentation(normalizedBoundaryKind, raw?.presentation?.attach_to)
    };
    return next;
  }

  function normalizeTravelPlanBoundaryLogisticsForEnabledFeatures(sourceBoundaryLogistics) {
    const source = sourceBoundaryLogistics && typeof sourceBoundaryLogistics === "object" && !Array.isArray(sourceBoundaryLogistics)
      ? sourceBoundaryLogistics
      : {};
    const arrival = normalizeTravelPlanBoundaryDraft(source.arrival, "arrival");
    const departure = normalizeTravelPlanBoundaryDraft(source.departure, "departure");
    return {
      ...(arrival.enabled || travelPlanBoundaryHasContent(arrival) ? { arrival } : {}),
      ...(departure.enabled || travelPlanBoundaryHasContent(departure) ? { departure } : {})
    };
  }

  function travelPlanDayHasContent(day) {
    if (!day || typeof day !== "object" || Array.isArray(day)) return false;
    return [
      "title",
      "notes"
    ].some((fieldName) => localizedTravelPlanFieldHasContent(day, fieldName))
      || hasTravelPlanTextContent(day.date)
      || hasTravelPlanTextContent(day.primary_location_id)
      || hasTravelPlanTextContent(day.secondary_location_id)
      || (Array.isArray(day.experience_highlight_ids) && day.experience_highlight_ids.some(hasTravelPlanTextContent))
      || (Array.isArray(day.services) && day.services.length > 0);
  }

  function pruneEmptyTravelPlanContent(plan) {
    const source = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
    const days = (Array.isArray(source.days) ? source.days : [])
      .map((day) => {
        const sourceDay = day && typeof day === "object" && !Array.isArray(day) ? day : {};
        return {
          ...sourceDay,
          services: (Array.isArray(sourceDay.services) ? sourceDay.services : []).filter(travelPlanServiceHasContent)
        };
      })
      .filter(travelPlanDayHasContent)
      .map((day, dayIndex) => ({
        ...day,
        day_number: dayIndex + 1
      }));
    return {
      ...source,
      boundary_logistics: normalizeTravelPlanBoundaryLogisticsForEnabledFeatures(source.boundary_logistics),
      days
    };
  }

  function buildTravelPlanPayload(plan = state.travelPlanDraft, { pruneEmptyContent = false } = {}) {
    const normalized = normalizeTravelPlanState(plan);
    return pruneEmptyContent ? pruneEmptyTravelPlanContent(normalized) : normalized;
  }

  function normalizeTravelPlanForEnabledFeatures(plan) {
    const source = plan && typeof plan === "object" && !Array.isArray(plan) ? plan : {};
    const next = {
      ...source,
      tour_card_image_ids: Array.isArray(source.tour_card_image_ids) ? source.tour_card_image_ids : [],
      one_pager_hero_image_id: source.one_pager_hero_image_id || null,
      one_pager_image_ids: Array.isArray(source.one_pager_image_ids) ? source.one_pager_image_ids : [],
      boundary_logistics: normalizeTravelPlanBoundaryLogisticsForEnabledFeatures(source.boundary_logistics),
      days: (Array.isArray(source.days) ? source.days : []).map((day, dayIndex) => {
        const sourceDay = day && typeof day === "object" && !Array.isArray(day) ? day : {};
        const nextDay = {
          ...sourceDay,
          day_number: dayIndex + 1,
          primary_location_id: String(sourceDay.primary_location_id || "").trim(),
          secondary_location_id: String(sourceDay.secondary_location_id || "").trim(),
          experience_highlight_ids: normalizeTravelPlanDayExperienceHighlightIds(sourceDay.experience_highlight_ids),
          services: (Array.isArray(sourceDay.services) ? sourceDay.services : []).map((item) => {
            const sourceItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
            return { ...sourceItem };
          })
        };
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
    if (!allowDayAdd) return;
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
  }

  async function ensureTravelPlanReadyForMutation() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return false;
    if (!state.travelPlanDirty) return true;
    if (typeof prepareTravelPlanMutation === "function") {
      return await prepareTravelPlanMutation({
        applyTravelPlanMutationBooking,
        buildTravelPlanPayload,
        saveTravelPlan: persistTravelPlan,
        syncTravelPlanDraftFromDom,
        travelPlanStatus
      });
    }
    return await persistTravelPlan();
  }

  async function finalizeTravelPlanMutation(result, successMessage) {
    if (!result?.booking) return false;
    applyTravelPlanMutationBooking(result.booking);
    refreshActivitiesInBackground("travel_plan_mutation");
    travelPlanStatus(successMessage, "success");
    return true;
  }

  function applyBookingPayload({ preserveCollapsedState = false } = {}) {
    const previousCollapsedDayIds = preserveCollapsedState && state.travelPlanCollapsedDayIds instanceof Set
      ? new Set(state.travelPlanCollapsedDayIds)
      : null;
    state.travelPlanDraft = normalizeTravelPlanState(state.booking?.travel_plan || createEmptyTravelPlan());
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

  function applyLocalTravelPlanDraft(nextPlan) {
    state.travelPlanDraft = nextPlan && typeof nextPlan === "object"
      ? nextPlan
      : createEmptyTravelPlan();
    renderTravelPlanPanel();
  }

  function resolveLocalizedDraftBranchText(map, lang = "en", fallback = "") {
    return resolveLocalizedEditorBranchText(map, lang, fallback);
  }

  function renderTravelPlanLocalizedField({
    label,
    idBase,
    dataScope,
    dayId = "",
    itemId = "",
    field,
    type = "input",
    rows = 3,
    sourceValue = "",
    localizedValue = "",
    sourcePlaceholder = "",
    showLabel = true,
    disabled = false
  }) {
    return renderLocalizedStackedField({
      escapeHtml,
      idBase,
      label,
      showLabel,
      type,
      rows,
      targetLang: bookingSourceLang(),
      disabled: disabled || !state.permissions.canEditBooking,
      translateEnabled: false,
      sourceValue,
      englishPlaceholder: sourcePlaceholder,
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
    travelPlanStatus,
    setPageOverlay: setTravelPlanPageOverlay,
    buildServiceImageUploadRequest: buildTravelPlanServiceImageUploadRequest,
    buildServiceImageDeleteRequest: buildTravelPlanServiceImageDeleteRequest,
    allowTourCardImageSelection
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
    collectTravelPlanPayload,
    findDraftDay,
    formatTravelPlanDayHeading,
    buildTravelPlanDaySearchRequest,
    buildTravelPlanServiceSearchRequest,
    buildTravelPlanDayImportRequest,
    buildTravelPlanServiceImportRequest,
    cloneTravelPlanDayForLocalImport,
    cloneTravelPlanServiceForLocalImport,
    applyLocalTravelPlanDraft,
    setPageOverlay: setTravelPlanPageOverlay,
    travelPlanLibrarySource
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

  function shiftIsoDate(value, dayOffset) {
    const raw = String(value || "").trim();
    if (!isIsoDateString(raw)) return "";
    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + dayOffset);
    return formatIsoLocalDate(date);
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
    "textregion",
    "a",
    "label",
    "summary",
    "[role='button']",
    "[contenteditable='true']"
  ].join(", ");

  function resolveTravelPlanToggleRegion(target, selector) {
    if (!(target instanceof Element)) return null;
    const region = target.closest(selector);
    if (!(region instanceof HTMLElement)) return null;
    const interactive = target.closest(TRAVEL_PLAN_TOGGLE_INTERACTIVE_SELECTOR);
    if (interactive instanceof HTMLElement && interactive !== region && region.contains(interactive)) {
      return null;
    }
    return region;
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
    const dayNode = target.closest("[data-travel-plan-day]");
    if (dayNode instanceof HTMLElement) {
      updateTravelPlanDayCollapsedCopy(dayNode.getAttribute("data-travel-plan-day"));
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
    els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]").forEach((element) => {
      const dayId = String(element.getAttribute("data-travel-plan-day") || "").trim();
      if (!dayId) return;
      applyTravelPlanDayCollapsedUi(dayId, isTravelPlanDayCollapsed(dayId), { animate });
    });
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

  function renderTravelPlanDateInput({ id, dataAttribute, value = "", disabled = false, readOnly = false, showPicker = true, ariaLabel = "", trailingContent = "" }) {
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
          ${readOnly ? 'readonly aria-readonly="true"' : ""}
          ${ariaLabel ? `aria-label="${escapeHtml(ariaLabel)}"` : ""}
        />
        ${showPicker
          ? `<button
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
            />`
          : ""}
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

  function applyTravelPlanDayDateSelection(textInput, { date = "" } = {}) {
    if (!allowDates) return null;
    if (!(textInput instanceof HTMLInputElement)) return null;
    textInput.value = String(date || "").trim();
    validateTravelPlanDateTextInput(textInput, { allowPartial: false });
    syncTravelPlanDraftFromDom();
    if (recalculateTravelPlanDayDates()) {
      renderTravelPlanPanel();
      renderOfferPanel?.();
      return textInput;
    }
    refreshTravelPlanVisibleHeadCopy(textInput);
    updateTravelPlanDirtyState();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    return textInput;
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

  function renderTravelPlanTimingFields(day, item) {
    if (!allowTiming) return "";
    return `
      <div class="field travel-plan-timing-field travel-plan-timing-field--label">
        ${renderTravelPlanLocalizedField({
          label: bookingT("booking.travel_plan.time", "Time"),
          showLabel: false,
          sourcePlaceholder: bookingT("booking.travel_plan.time", "Time"),
          idBase: `travel_plan_time_${item.id}`,
          dataScope: "travel-plan-service-field",
          dayId: day.id,
          itemId: item.id,
          field: "time",
          type: "input",
          sourceValue: resolveLocalizedDraftBranchText(item.time_i18n ?? item.time, bookingSourceLang(), ""),
          localizedValue: resolveLocalizedDraftBranchText(item.time_i18n ?? item.time, bookingContentLang(), "")
        })}
      </div>
    `;
  }

  function renderTravelPlanServiceTimingSection(day, item, { aligned = false } = {}) {
    if (!allowTiming) return "";
    const timingFields = renderTravelPlanTimingFields(day, item);
    return aligned
      ? `<div class="travel-plan-service__timing-row">
          ${timingFields}
        </div>`
      : `<div class="travel-plan-grid travel-plan-grid--item travel-plan-grid--item-timing">
          ${timingFields}
        </div>`;
  }

  function renderTravelPlanServiceActions(item) {
    return `
      <div class="travel-plan-service__actions">
        <button class="btn btn-ghost offer-remove-btn" data-travel-plan-remove-item="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_item", "Remove service"))}"><span aria-hidden="true">&times;</span></button>
      </div>
    `;
  }

  function renderTravelPlanReadonlyCompactService(_day, item, itemIndex) {
    const serviceNumber = itemIndex + 1;
    const title = resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), "").trim()
      || bookingT("booking.travel_plan.item_heading", "Service {item}", { item: serviceNumber });
    const details = resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, bookingSourceLang(), "").trim();
    const image = item?.image && typeof item.image === "object" && !Array.isArray(item.image) && item.image.storage_path
      ? item.image
      : null;
    const imageSrc = image ? resolveTravelPlanImageSrc(image.storage_path, apiOrigin) : "";
    const imageAlt = image ? (image.alt_text || image.caption || title) : "";
    return `
      <article class="travel-plan-service-readonly" data-travel-plan-service-readonly="${escapeHtml(item.id || `service_${serviceNumber}`)}">
        ${imageSrc
          ? `<img class="travel-plan-service-readonly__thumb" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt)}" loading="lazy" decoding="async" />`
          : `<span class="travel-plan-service-readonly__thumb travel-plan-service-readonly__thumb--placeholder" aria-hidden="true"></span>`}
        <div class="travel-plan-service-readonly__body">
          <strong class="travel-plan-service-readonly__title">${escapeHtml(title)}</strong>
          ${details ? `<p class="travel-plan-service-readonly__details">${escapeHtml(details)}</p>` : ""}
        </div>
      </article>
    `;
  }

  function renderTravelPlanService(day, item, itemIndex, { focusedBookingEditor = false } = {}) {
    if (travelPlanServiceMode === "hidden") return "";
    if (!allowEditableServices) {
      return renderTravelPlanReadonlyCompactService(day, item, itemIndex);
    }
    const serviceNumber = itemIndex + 1;
    const serviceActions = renderTravelPlanServiceActions(item);
    const canDragService = state.permissions.canEditBooking === true && allowEditableServices;
    return `
      <div class="travel-plan-service" data-travel-plan-service="${escapeHtml(item.id)}" draggable="${canDragService ? "true" : "false"}" aria-grabbed="false">
        <div class="travel-plan-service__main">
          <div class="travel-plan-service__body">
          <div class="travel-plan-service__overview">
            <span class="travel-plan-service__drag-handle" data-travel-plan-service-drag-handle="${escapeHtml(item.id)}" aria-hidden="true">
              <img src="/assets/img/drag-indicator.svg" alt="" loading="lazy" decoding="async" />
            </span>
            <div class="travel-plan-service__overview-media">
              ${travelPlanImagesModule.renderTravelPlanServiceImages(day, item, {
                variant: "sidebar",
                editable: allowImageUpload && state.permissions.canEditBooking
              })}
            </div>
            <div class="travel-plan-service__overview-main">
              <div class="travel-plan-service__title-row">
                <div class="field travel-plan-service__title-field">
                  ${renderTravelPlanLocalizedField({
                    label: bookingT("booking.travel_plan.item_numbered_title", "Service {item}", { item: serviceNumber }),
                    showLabel: false,
                    sourcePlaceholder: bookingT("booking.travel_plan.service_title_placeholder", "Service title"),
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
                ${serviceActions}
              </div>
              ${allowServiceDetails
                ? `<div class="field">
                    ${renderTravelPlanLocalizedField({
                      label: bookingT("booking.travel_plan.item_notes", "Detail"),
                      showLabel: false,
                      idBase: `travel_plan_details_${item.id}`,
                      dataScope: "travel-plan-service-field",
                      dayId: day.id,
                      itemId: item.id,
                      field: "details",
                      type: "textregion",
                      rows: 3,
                      sourceValue: resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, bookingSourceLang(), ""),
                      localizedValue: resolveLocalizedDraftBranchText(item.details_i18n ?? item.details, bookingContentLang(), "")
                    })}
                  </div>`
                : ""}
              ${focusedBookingEditor ? renderTravelPlanServiceTimingSection(day, item, { aligned: true }) : ""}
            </div>
          </div>
          ${focusedBookingEditor ? "" : renderTravelPlanServiceTimingSection(day, item)}
          </div>
          </div>
        </div>
    `;
  }

  function renderTravelPlanBoundaryTimingFields(boundaryKind, item, { disabled = false } = {}) {
    if (!allowTiming) return "";
    const idPart = `${boundaryKind}_${item.id}`;
    return `
      <div class="field travel-plan-timing-field travel-plan-timing-field--label">
        ${renderTravelPlanLocalizedField({
          label: bookingT("booking.travel_plan.time", "Time"),
          idBase: `travel_plan_boundary_time_${idPart}`,
          dataScope: "travel-plan-boundary-field",
          field: "time",
          type: "input",
          disabled,
          sourceValue: resolveLocalizedDraftBranchText(item.time_i18n ?? item.time, bookingSourceLang(), ""),
          localizedValue: resolveLocalizedDraftBranchText(item.time_i18n ?? item.time, bookingContentLang(), "")
        })}
      </div>
    `;
  }

  function boundaryLabel(boundaryKind) {
    return travelPlanBoundaryLabel(boundaryKind, { t: bookingT });
  }

  function boundaryTitleLabel(boundaryKind) {
    return travelPlanBoundaryTitleLabel(boundaryKind, { t: bookingT });
  }

  function boundaryDetailsLabel(boundaryKind) {
    return travelPlanBoundaryDetailsLabel(boundaryKind, { t: bookingT, compact: allowAirportSelect });
  }

  function travelPlanBoundaryItem(boundaryKind) {
    const source = state.travelPlanDraft?.boundary_logistics?.[boundaryKind] || createEmptyTravelPlanBoundaryService(boundaryKind);
    return normalizeTravelPlanBoundaryDraft(source, boundaryKind);
  }

  function renderTravelPlanBoundaryLocalizedField({
    item,
    label,
    idBase,
    field,
    type,
    rows,
    disabled = false
  }) {
    const sourceItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const localizedMap = sourceItem[`${field}_i18n`] ?? sourceItem[field];
    return renderTravelPlanLocalizedField({
      label,
      idBase,
      dataScope: "travel-plan-boundary-field",
      field,
      type,
      rows,
      disabled,
      sourceValue: resolveLocalizedDraftBranchText(localizedMap, bookingSourceLang(), ""),
      localizedValue: resolveLocalizedDraftBranchText(localizedMap, bookingContentLang(), "")
    });
  }

  function travelPlanBoundarySectionsRenderer() {
    return createTravelPlanBoundarySectionsRenderer({
      escapeHtml,
      t: bookingT,
      canEdit: state.permissions.canEditBooking,
      allowAirportSelect,
      allowServiceDetails,
      allowTiming,
      airportCatalog: state.airportCatalog,
      resolvePlacementValue: travelPlanBoundarySelectionValue,
      renderLocalizedField: renderTravelPlanBoundaryLocalizedField,
      renderTimingFields: renderTravelPlanBoundaryTimingFields
    });
  }

  function renderTravelPlanBoundarySection(boundaryKind) {
    return travelPlanBoundarySectionsRenderer().renderSection(boundaryKind, travelPlanBoundaryItem(boundaryKind));
  }

  function renderTravelPlanBoundaryLogistics(boundaryKinds) {
    return travelPlanBoundarySectionsRenderer().renderLogistics(travelPlanBoundaryItem, { boundaryKinds });
  }

  function normalizeLocationCoordinate(value) {
    if (value === undefined || value === null || value === "") return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  function travelPlanLocationCatalog({ includeAllLocations = false } = {}) {
    const catalog = normalizeDestinationScopeCatalog(state.destinationScopeCatalog || {});
    if (includeAllLocations) {
      return {
        ...catalog,
        regions: catalog.regions.filter((region) => region.is_active !== false),
        places: catalog.places.filter((place) => place.is_active !== false)
      };
    }
    const selectedScope = normalizeDestinationScope(state.travelPlanDraft?.destination_scope);
    const selectedRegionIds = new Set(
      selectedScope.flatMap((entry) => (Array.isArray(entry.regions) ? entry.regions : []).map((region) => region.region_id))
    );
    const selectedDestinationIds = new Set(selectedScope.map((entry) => entry.destination));
    const selectedCountryPlaceIds = new Set(
      selectedScope.flatMap((entry) => (Array.isArray(entry.places) ? entry.places : []).map((place) => place.place_id))
    );
    const hasSelectedRegions = selectedRegionIds.size > 0;
    const hasSelectedDestinations = selectedDestinationIds.size > 0;
    const regions = catalog.regions
      .filter((region) => region.is_active !== false)
      .filter((region) => {
        if (hasSelectedRegions) return selectedRegionIds.has(region.id);
        if (hasSelectedDestinations) return selectedDestinationIds.has(region.destination);
        return true;
      });
    const regionById = new Map(catalog.regions.map((region) => [region.id, region]));
    const selectedPlaceIds = new Set(
      selectedScope.flatMap((entry) => (
        Array.isArray(entry.regions)
          ? entry.regions.flatMap((region) => (Array.isArray(region.places) ? region.places : []).map((place) => place.place_id))
          : []
      ))
    );
    for (const placeId of selectedCountryPlaceIds) selectedPlaceIds.add(placeId);
    const hasSelectedPlaces = selectedPlaceIds.size > 0;
    const places = catalog.places
      .filter((place) => place.is_active !== false)
      .filter((place) => {
        if (hasSelectedPlaces) return selectedPlaceIds.has(place.id);
        if (hasSelectedRegions) return selectedRegionIds.has(place.region_id);
        if (hasSelectedDestinations) return selectedDestinationIds.has(place.destination);
        return true;
      });
    return { ...catalog, regions, places };
  }

  function travelPlanLocationOptions({ includeAllLocations = false, includeRegions = true } = {}) {
    const catalog = travelPlanLocationCatalog({ includeAllLocations });
    const regionById = new Map(catalog.regions.map((region) => [region.id, region]));
    const options = [];
    if (includeRegions) {
      for (const region of catalog.regions) {
        options.push({
          id: region.id,
          label: region.label || region.code || region.id,
          group: bookingT("booking.travel_plan.location_group_regions", "Regions"),
          latitude: null,
          longitude: null
        });
      }
    }
    for (const place of catalog.places) {
      options.push({
        id: place.id,
        label: place.label || place.code || place.id,
        group: regionById.get(place.region_id)?.label || bookingT("booking.travel_plan.location_group_places", "Places"),
        latitude: normalizeLocationCoordinate(place.latitude),
        longitude: normalizeLocationCoordinate(place.longitude)
      });
    }
    return options.sort((left, right) => {
      const groupCompare = left.group.localeCompare(right.group, "en", { sensitivity: "base" });
      if (groupCompare !== 0) return groupCompare;
      return left.label.localeCompare(right.label, "en", { sensitivity: "base" });
    });
  }

  function renderTravelPlanLocationSelect({
    id,
    field,
    value,
    label,
    labelIconSrc = "",
    labelIconNumber = "",
    includeAllLocations = false,
    includeRegions = true
  }) {
    const options = travelPlanLocationOptions({ includeAllLocations, includeRegions });
    const selectedValue = String(value || "").trim();
    const groups = new Map();
    for (const option of options) {
      if (!groups.has(option.group)) groups.set(option.group, []);
      groups.get(option.group).push(option);
    }
    const labelContent = labelIconSrc
      ? `<span class="travel-plan-location-label-icon-wrap"><img class="travel-plan-location-label-icon" src="${escapeHtml(labelIconSrc)}" alt="" aria-hidden="true" loading="lazy" decoding="async" />${labelIconNumber ? `<span class="travel-plan-location-label-number" aria-hidden="true">${escapeHtml(labelIconNumber)}</span>` : ""}</span>`
      : escapeHtml(label);
    return `
      <label for="${escapeHtml(id)}" class="${labelIconSrc ? "travel-plan-location-label travel-plan-location-label--icon" : ""}"${labelIconSrc ? ` aria-label="${escapeHtml(label)}"` : ""}>${labelContent}</label>
      <select id="${escapeHtml(id)}" data-travel-plan-day-location-field="${escapeHtml(field)}" ${!state.permissions.canEditBooking ? "disabled" : ""}>
        <option value="">${escapeHtml(bookingT("booking.travel_plan.location_none", "No map point"))}</option>
        ${Array.from(groups.entries()).map(([groupLabel, groupOptions]) => `
          <optgroup label="${escapeHtml(groupLabel)}">
            ${groupOptions.map((option) => `
              <option value="${escapeHtml(option.id)}" ${option.id === selectedValue ? "selected" : ""}>
                ${escapeHtml(option.label)}${option.latitude === null || option.longitude === null ? ` ${escapeHtml(bookingT("booking.travel_plan.location_missing_coordinates_short", "(no coordinates)"))}` : ""}
              </option>
            `).join("")}
          </optgroup>
        `).join("")}
      </select>
    `;
  }

  function normalizeTravelPlanDayExperienceHighlightIds(values, { availableIds = null } = {}) {
    const allowed = availableIds instanceof Set ? availableIds : null;
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        if (allowed && !allowed.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 1);
  }

  function travelPlanExperienceHighlightOptions() {
    const displayLang = travelPlanExperienceHighlightDisplayLang();
    const sourceLang = bookingSourceLang();
    return (Array.isArray(state.experienceHighlights) ? state.experienceHighlights : [])
      .map((item) => {
        const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
        const id = String(source.id || item || "").trim();
        if (!id) return null;
        return {
          ...source,
          id,
          title: resolveTravelPlanExperienceHighlightTitle(source, {
            displayLang,
            sourceLang,
            fallbackTitle: id
          })
        };
      })
      .filter(Boolean);
  }

  function renderTravelPlanDayExperienceHighlights(day) {
    if (!allowMapPointEdit) return "";
    const options = travelPlanExperienceHighlightOptions();
    if (!options.length) return "";
    const availableIds = new Set(options.map((item) => item.id));
    const selectedId = normalizeTravelPlanDayExperienceHighlightIds(day?.experience_highlight_ids, { availableIds })[0] || "";
    const selectId = `travel_plan_day_highlight_${day.id}`;
    return `
      <div class="field travel-plan-day-highlights">
        <label for="${escapeHtml(selectId)}">${escapeHtml(bookingT("booking.travel_plan.experience_highlight", "Experience highlight"))}</label>
        <select id="${escapeHtml(selectId)}" data-travel-plan-day-highlight ${!state.permissions.canEditBooking ? "disabled" : ""}>
          <option value="">${escapeHtml(bookingT("booking.travel_plan.experience_highlight_none", "No experience highlight"))}</option>
          ${options.map((item) => `
            <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.title || item.id)}</option>
          `).join("")}
        </select>
      </div>
    `;
  }

  function travelPlanDayExperienceHighlightLabel(day) {
    const ids = normalizeTravelPlanDayExperienceHighlightIds(day?.experience_highlight_ids);
    const selectedId = ids[0] || "";
    if (!selectedId) return bookingT("booking.travel_plan.experience_highlight_none", "No experience highlight");
    const option = travelPlanExperienceHighlightOptions().find((item) => item.id === selectedId);
    return option?.title || selectedId;
  }

  function travelPlanDayLocationReadOnlyLabel(locationId, optionMap = travelPlanLocationOptionMap()) {
    const normalizedId = String(locationId || "").trim();
    if (!normalizedId) return bookingT("booking.travel_plan.location_none", "No map point");
    return optionMap.get(normalizedId)?.label || normalizedId;
  }

  function renderTravelPlanDayReadOnlyInfoRow({ label, value, className = "" }) {
    return `
      <div class="travel-plan-day-readonly-info__row${className ? ` ${escapeHtml(className)}` : ""}">
        <div class="travel-plan-day-readonly-info__label">${escapeHtml(label)}</div>
        <div class="travel-plan-day-readonly-info__value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function renderTravelPlanDayReadOnlyInfo(day) {
    if (!allowDayReadOnlyInfo) return "";
    const optionMap = travelPlanLocationOptionMap();
    const details = resolveLocalizedDraftBranchText(day?.notes_i18n ?? day?.notes, bookingContentLang(), "")
      || resolveLocalizedDraftBranchText(day?.notes_i18n ?? day?.notes, bookingSourceLang(), "")
      || bookingT("booking.travel_plan.day_details_empty", "No day details");
    const primaryLocationId = String(day?.primary_location_id || "").trim();
    const secondaryLocationId = String(day?.secondary_location_id || "").trim();
    const rows = [
      renderTravelPlanDayReadOnlyInfoRow({
        label: bookingT("booking.travel_plan.day_details", "Day details"),
        value: details,
        className: "travel-plan-day-readonly-info__row--details"
      }),
      renderTravelPlanDayReadOnlyInfoRow({
        label: bookingT("booking.travel_plan.map_point_1", "Map point 1"),
        value: travelPlanDayLocationReadOnlyLabel(primaryLocationId, optionMap)
      }),
      secondaryLocationId
        ? renderTravelPlanDayReadOnlyInfoRow({
            label: bookingT("booking.travel_plan.map_point_2", "Map point 2"),
            value: travelPlanDayLocationReadOnlyLabel(secondaryLocationId, optionMap)
          })
        : "",
      renderTravelPlanDayReadOnlyInfoRow({
        label: bookingT("booking.travel_plan.experience_highlight", "Experience highlight"),
        value: travelPlanDayExperienceHighlightLabel(day)
      })
    ].filter(Boolean);
    return rows.length
      ? `<div class="travel-plan-day-readonly-info">${rows.join("")}</div>`
      : "";
  }

  function renderTravelPlanDayDetailsField(day, { label = bookingT("booking.travel_plan.day_notes", "Details") } = {}) {
    return `
      <div class="field">
        ${renderTravelPlanLocalizedField({
          label,
          idBase: `travel_plan_day_notes_${day.id}`,
          dataScope: "travel-plan-day-field",
          dayId: day.id,
          field: "notes",
          type: "textregion",
          rows: 3,
          sourceValue: resolveLocalizedDraftBranchText(day.notes_i18n ?? day.notes, bookingSourceLang(), ""),
          localizedValue: resolveLocalizedDraftBranchText(day.notes_i18n ?? day.notes, bookingContentLang(), "")
        })}
      </div>
    `;
  }

  function renderTravelPlanDayTitleField(day) {
    return `
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
    `;
  }

  function renderTravelPlanDayInlineTitleField(day, dayIndex) {
    return `
      <div class="travel-plan-booking-editor__title-field">
        ${renderTravelPlanLocalizedField({
          label: bookingT("booking.travel_plan.day_title", "Day Title"),
          idBase: `travel_plan_day_title_${day.id}`,
          dataScope: "travel-plan-day-field",
          dayId: day.id,
          field: "title",
          type: "input",
          sourceValue: resolveLocalizedDraftBranchText(day.title_i18n ?? day.title, bookingSourceLang(), ""),
          sourcePlaceholder: travelPlanDayTitle(day, dayIndex),
          localizedValue: "",
          showLabel: false
        })}
      </div>
    `;
  }

  function renderFocusedTravelPlanDayHeader(day, dayIndex) {
    const title = travelPlanFocusedDayTitle(day, dayIndex);
    return `
      <div class="travel-plan-booking-editor__toolbar">
        <div class="travel-plan-booking-editor__title">
          <span class="travel-plan-booking-editor__badge">${escapeHtml(formatTravelPlanDayHeading(dayIndex))}</span>
          <div class="travel-plan-booking-editor__title-copy">
            ${allowDayTitleEdit
              ? renderTravelPlanDayInlineTitleField(day, dayIndex)
              : `<h3>${escapeHtml(title)}</h3>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderTravelPlanDay(day, dayIndex, { focusedBookingEditor = false } = {}) {
    const items = Array.isArray(day.services) ? day.services : [];
    const collapsed = isTravelPlanDayCollapsed(day.id);
    const dayHeading = formatTravelPlanDayHeading(dayIndex);
    const collapsedSummary = travelPlanDayCollapsedSummary(day, items, { dayHeading });
    const headingLabel = collapsedSummary || dayHeading;
    const dateInputId = `travel_plan_day_date_${day.id}`;
    const dayDetailsField = allowDayDetailsEdit ? renderTravelPlanDayDetailsField(day) : "";
    const dayReadOnlyInfo = allowDayReadOnlyInfo ? renderTravelPlanDayReadOnlyInfo(day) : "";
    const dayTitleField = focusedBookingEditor || !allowDayTitleEdit ? "" : renderTravelPlanDayTitleField(day);
    const showDayDateField = allowDates && (!allowSequentialDayDates || dayIndex === 0);
    const dayDateField = showDayDateField
      ? `<div class="field travel-plan-day__date-field">
          <label for="${escapeHtml(dateInputId)}">${escapeHtml(bookingT("booking.date", "Date"))}</label>
          ${renderTravelPlanDateInput({
            id: dateInputId,
            dataAttribute: 'data-travel-plan-day-field="date"',
            value: day.date,
            disabled: !state.permissions.canEditBooking,
            ariaLabel: `${formatTravelPlanDayHeading(dayIndex)} ${bookingT("booking.date", "Date")}`
          })}
        </div>`
      : "";
    const dayMapLocationFields = allowMapPointEdit ? `
      <div class="travel-plan-grid travel-plan-grid--map-locations${focusedBookingEditor ? " travel-plan-focused-day-grid__map" : ""}">
        <div class="field">
          ${renderTravelPlanLocationSelect({
            id: `travel_plan_day_primary_location_${day.id}`,
            field: "primary_location_id",
            value: day.primary_location_id,
            label: bookingT("booking.travel_plan.primary_location", "Primary map point"),
            labelIconSrc: "/assets/img/map%20pin.png",
            includeAllLocations: allowAllPrimaryMapPointOptions,
            includeRegions: false
          })}
        </div>
        <div class="field">
          ${renderTravelPlanLocationSelect({
            id: `travel_plan_day_secondary_location_${day.id}`,
            field: "secondary_location_id",
            value: day.secondary_location_id,
            label: bookingT("booking.travel_plan.secondary_location", "secondary"),
            labelIconSrc: "/assets/img/map%20pin.png",
            labelIconNumber: "2"
          })}
        </div>
      </div>
    ` : "";
    return `
      <section class="travel-plan-day${collapsed ? " travel-plan-day--collapsed" : ""}${focusedBookingEditor ? " travel-plan-day--focused-editor" : ""}" data-travel-plan-day="${escapeHtml(day.id)}">
        ${focusedBookingEditor ? renderFocusedTravelPlanDayHeader(day, dayIndex) : ""}
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
            <div class="travel-plan-day__head-copy" data-travel-plan-toggle-day-region="${escapeHtml(day.id)}">
              <h3 class="travel-plan-day__collapsed-heading" data-travel-plan-day-fallback="${escapeHtml(dayHeading)}" title="${escapeHtml(headingLabel)}">${escapeHtml(headingLabel)}</h3>
            </div>
            <div class="travel-plan-day__actions">
              ${allowDayReorder
                ? `<button class="btn btn-ghost travel-plan-move-btn travel-plan-move-btn--day" data-travel-plan-move-day-up="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_day_up", "Move day up"))}">&#8593;</button>
                   <button class="btn btn-ghost travel-plan-move-btn travel-plan-move-btn--day" data-travel-plan-move-day-down="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.move_day_down", "Move day down"))}">&#8595;</button>`
                : ""}
              ${allowDayDelete
                ? `<button class="btn btn-ghost offer-remove-btn travel-plan-move-btn--day" data-travel-plan-remove-day="${escapeHtml(day.id)}" type="button" aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_day", "Remove day"))}">&times;</button>`
                : ""}
            </div>
          </div>
          <div class="travel-plan-day__body">
            <div class="travel-plan-day__content">
              ${focusedBookingEditor
                ? `<div class="travel-plan-focused-day-grid">
                    ${dayDetailsField
                      ? `<div class="travel-plan-focused-day-grid__row travel-plan-focused-day-grid__row--details">
                          ${dayDetailsField}
                        </div>`
                      : ""}
                    ${dayReadOnlyInfo
                      ? `<div class="travel-plan-focused-day-grid__row travel-plan-focused-day-grid__row--readonly-info">
                          ${dayReadOnlyInfo}
                        </div>`
                      : ""}
                    ${dayDateField
                      ? `<div class="travel-plan-focused-day-grid__row travel-plan-focused-day-grid__row--date">
                          ${dayDateField}
                        </div>`
                      : ""}
                    ${dayMapLocationFields}
                  </div>`
                : dayDateField}
              ${dayTitleField
                ? `<div class="travel-plan-grid">
                    ${dayTitleField}
                  </div>`
                : ""}
              ${!focusedBookingEditor ? dayReadOnlyInfo : ""}
              ${!focusedBookingEditor && showDayDetailsAfterTitle ? dayDetailsField : ""}
              ${focusedBookingEditor ? "" : dayMapLocationFields}
              ${renderTravelPlanDayExperienceHighlights(day)}
              ${!focusedBookingEditor && !showDayDetailsAfterTitle ? dayDetailsField : ""}
              <div class="travel-plan-day__services">
                ${items.map((item, itemIndex) => renderTravelPlanService(day, item, itemIndex, { focusedBookingEditor })).join("")}
              </div>
            </div>
            ${allowEditableServices
              ? `<div class="travel-plan-service-footer">
                  <div class="travel-plan-service-footer__actions">
                    <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--service-create" data-travel-plan-add-item="${escapeHtml(day.id)}" type="button">
                      <span class="travel-plan-add-btn__icon" aria-hidden="true">+</span>
                      <span class="travel-plan-add-btn__label">${escapeHtml(bookingT("booking.travel_plan.new_item", "New service"))}</span>
                    </button>
                    ${allowServiceImport
                      ? `<button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service" data-travel-plan-open-import="${escapeHtml(day.id)}" type="button">${escapeHtml(bookingT("booking.travel_plan.insert_existing", "Copy existing service"))}</button>`
                      : ""}
                  </div>
                </div>`
              : ""}
          </div>
        </div>
      </section>
    `;
  }

  function normalizeFocusedBoundaryKind(value) {
    const normalized = String(value || "").trim();
    return normalized === "arrival" || normalized === "departure" ? normalized : "";
  }

  function travelPlanDays() {
    return Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
  }

  function ensureFocusedTravelPlanSelection() {
    const requestedBoundary = normalizeFocusedBoundaryKind(state.travelPlanFocusedBoundaryKind);
    if (requestedBoundary) {
      state.travelPlanFocusedBoundaryKind = requestedBoundary;
      state.travelPlanFocusedDayId = "";
      return { type: "boundary", boundaryKind: requestedBoundary, dayId: "" };
    }
    const days = travelPlanDays();
    const requestedDayId = String(state.travelPlanFocusedDayId || "").trim();
    const selectedDay = requestedDayId
      ? days.find((day) => String(day?.id || "").trim() === requestedDayId)
      : null;
    const fallbackDay = selectedDay || days[0] || null;
    if (fallbackDay?.id) {
      state.travelPlanFocusedDayId = String(fallbackDay.id || "").trim();
      state.travelPlanFocusedBoundaryKind = "";
      return { type: "day", dayId: state.travelPlanFocusedDayId, boundaryKind: "" };
    }
    state.travelPlanFocusedDayId = "";
    state.travelPlanFocusedBoundaryKind = "arrival";
    return { type: "boundary", boundaryKind: "arrival", dayId: "" };
  }

  function selectFocusedTravelPlanDay(dayId) {
    syncTravelPlanDraftFromDom();
    const normalizedDayId = String(dayId || "").trim();
    if (!normalizedDayId) return;
    state.travelPlanFocusedDayId = normalizedDayId;
    state.travelPlanFocusedBoundaryKind = "";
    renderTravelPlanPanel();
  }

  function selectFocusedTravelPlanBoundary(boundaryKind) {
    syncTravelPlanDraftFromDom();
    const normalizedBoundaryKind = normalizeFocusedBoundaryKind(boundaryKind);
    if (!normalizedBoundaryKind) return;
    state.travelPlanFocusedBoundaryKind = normalizedBoundaryKind;
    state.travelPlanFocusedDayId = "";
    renderTravelPlanPanel();
  }

  function travelPlanLocationOptionMap() {
    return new Map(travelPlanLocationOptions({ includeAllLocations: true }).map((option) => [option.id, option]));
  }

  function travelPlanDayLocationLabel(day, optionMap = travelPlanLocationOptionMap()) {
    const primaryId = String(day?.primary_location_id || "").trim();
    const secondaryId = String(day?.secondary_location_id || "").trim();
    const option = optionMap.get(primaryId) || optionMap.get(secondaryId);
    return option?.label || bookingT("booking.travel_plan.location_none", "No map point");
  }

  function travelPlanDayDateLabel(day) {
    if (!allowDates) return "";
    return String(day?.date || "").trim();
  }

  function travelPlanDayTitle(day, dayIndex) {
    const title = resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), "").trim();
    const heading = formatTravelPlanDayHeading(dayIndex);
    return title ? `${heading} · ${title}` : heading;
  }

  function travelPlanFocusedDayTitle(day, dayIndex) {
    return resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), "").trim()
      || formatTravelPlanDayHeading(dayIndex);
  }

  function travelPlanDayListTitle(day, dayIndex) {
    const title = resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), "").trim();
    return title || formatTravelPlanDayHeading(dayIndex);
  }

  function travelPlanDayMissingWarningLabels(day, dayIndex = -1) {
    const title = resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), "").trim();
    const description = resolveLocalizedDraftBranchText(day?.notes_i18n ?? day?.notes, bookingSourceLang(), "").trim();
    const hasLocation = Boolean(String(day?.primary_location_id || day?.secondary_location_id || "").trim());
    return [
      allowDates && dayIndex === 0 && !isValidIsoCalendarDate(day?.date)
        ? bookingT("booking.travel_plan.warning_missing_date", "Missing date")
        : "",
      hasLocation ? "" : bookingT("booking.travel_plan.warning_missing_location", "Missing location"),
      title ? "" : bookingT("booking.travel_plan.warning_missing_title", "Missing title"),
      description ? "" : bookingT("booking.travel_plan.warning_missing_description", "Missing description")
    ].filter(Boolean);
  }

  function travelPlanDayWarningText(day, dayIndex = -1) {
    return travelPlanDayMissingWarningLabels(day, dayIndex).join(" / ");
  }

  function renderTravelPlanDayWarnings(day, dayIndex = -1) {
    const warningText = travelPlanDayWarningText(day, dayIndex);
    return `
      <span class="travel-plan-route-list__warnings" data-travel-plan-route-day-warnings ${warningText ? "" : "hidden"}>
        ${escapeHtml(warningText)}
      </span>
    `;
  }

  function refreshTravelPlanRouteDayRow(dayId) {
    const normalizedDayId = String(dayId || "").trim();
    if (!normalizedDayId || !(els.travel_plan_editor instanceof HTMLElement)) return;
    const row = els.travel_plan_editor.querySelector(`[data-travel-plan-route-day="${escapeSelectorValue(normalizedDayId)}"]`);
    if (!(row instanceof HTMLElement)) return;
    const days = travelPlanDays();
    const dayIndex = days.findIndex((day) => String(day?.id || "").trim() === normalizedDayId);
    const day = dayIndex >= 0 ? days[dayIndex] : null;
    if (!day) return;
    const optionMap = travelPlanLocationOptionMap();
    const meta = [travelPlanDayDateLabel(day), travelPlanDayLocationLabel(day, optionMap)].filter(Boolean).join(" · ");
    const titleNode = row.querySelector("[data-travel-plan-route-day-title]");
    if (titleNode instanceof HTMLElement) titleNode.textContent = travelPlanDayListTitle(day, dayIndex);
    const metaNode = row.querySelector("[data-travel-plan-route-day-meta]");
    if (metaNode instanceof HTMLElement) metaNode.textContent = meta || bookingT("booking.travel_plan.location_none", "No map point");
    const warningNode = row.querySelector("[data-travel-plan-route-day-warnings]");
    const warningText = travelPlanDayWarningText(day, dayIndex);
    row.classList.toggle("has-warnings", Boolean(warningText));
    if (warningNode instanceof HTMLElement) {
      warningNode.textContent = warningText;
      warningNode.hidden = !warningText;
    }
  }

  function refreshTravelPlanRouteDayRows() {
    travelPlanDays().forEach((day) => {
      refreshTravelPlanRouteDayRow(String(day?.id || "").trim());
    });
  }

  function refreshTravelPlanRouteDayRowForTarget(target) {
    const dayNode = target instanceof Element ? target.closest("[data-travel-plan-day]") : null;
    refreshTravelPlanRouteDayRow(dayNode?.getAttribute("data-travel-plan-day"));
  }

  function refreshTravelPlanRouteBoundaryRow(boundaryKind) {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    const row = els.travel_plan_editor.querySelector(`[data-travel-plan-select-boundary="${escapeSelectorValue(normalizedBoundaryKind)}"]`);
    if (!(row instanceof HTMLElement)) return;
    const display = travelPlanBoundaryRouteCardDisplay(normalizedBoundaryKind);
    row.classList.toggle("is-inactive", !display.enabled);
    const titleNode = row.querySelector(`[data-travel-plan-route-boundary-title="${escapeSelectorValue(normalizedBoundaryKind)}"]`);
    if (titleNode instanceof HTMLElement) {
      titleNode.textContent = display.title;
    }
    const subtitleNode = row.querySelector(`[data-travel-plan-route-boundary-subtitle="${escapeSelectorValue(normalizedBoundaryKind)}"]`);
    if (subtitleNode instanceof HTMLElement) {
      subtitleNode.textContent = display.subtitle;
      subtitleNode.hidden = !display.subtitle;
    }
  }

  function refreshTravelPlanRouteBoundaryRows() {
    refreshTravelPlanRouteBoundaryRow("arrival");
    refreshTravelPlanRouteBoundaryRow("departure");
  }

  function travelPlanBoundaryDisplay(boundaryKind, { titleOnly = false } = {}) {
    const source = state.travelPlanDraft?.boundary_logistics?.[boundaryKind] || createEmptyTravelPlanBoundaryService(boundaryKind);
    const item = normalizeTravelPlanBoundaryDraft(source, boundaryKind);
    const title = resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), "").trim();
    if (titleOnly) return item.enabled ? (title || "None") : "None";
    const airport = String(item.airport_code || "").trim();
    const fallback = item.enabled ? "" : "None";
    return [title || fallback, airport].filter(Boolean).join(" · ") || "None";
  }

  function travelPlanBoundaryDateLabel(boundaryKind, item) {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    const days = travelPlanDays();
    if (!days.length || !item?.enabled) return "";
    const placement = travelPlanBoundarySelectionValue(item, normalizedBoundaryKind);
    if (normalizedBoundaryKind === "departure") {
      const date = String(days[days.length - 1]?.date || "").trim();
      if (!isValidIsoCalendarDate(date)) return "";
      return placement === "after_last_day" ? shiftIsoDate(date, 1) : date;
    }
    const date = String(days[0]?.date || "").trim();
    if (!isValidIsoCalendarDate(date)) return "";
    return placement === "before_first_day" ? shiftIsoDate(date, -1) : date;
  }

  function travelPlanBoundaryRouteCardDisplay(boundaryKind) {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    const source = state.travelPlanDraft?.boundary_logistics?.[normalizedBoundaryKind] || createEmptyTravelPlanBoundaryService(normalizedBoundaryKind);
    const item = normalizeTravelPlanBoundaryDraft(source, normalizedBoundaryKind);
    if (!item.enabled) {
      return {
        enabled: false,
        title: normalizedBoundaryKind === "departure"
          ? bookingT("booking.travel_plan.departure_none", "No departure")
          : bookingT("booking.travel_plan.arrival_none", "No arrival"),
        subtitle: ""
      };
    }
    const title = resolveLocalizedDraftBranchText(item.title_i18n ?? item.title, bookingSourceLang(), "").trim();
    const time = resolveLocalizedDraftBranchText(item.time_i18n ?? item.time, bookingSourceLang(), "").trim();
    const dateLabel = travelPlanBoundaryDateLabel(normalizedBoundaryKind, item);
    const placement = travelPlanBoundarySelectionValue(item, normalizedBoundaryKind);
    const fallbackTitle = normalizedBoundaryKind === "departure"
      ? boundaryLabel("departure")
      : normalizedBoundaryKind === "arrival" && placement === "first_day"
        ? boundaryLabel("arrival")
        : "None";
    return {
      enabled: true,
      title: title || fallbackTitle,
      subtitle: [dateLabel, time].filter(Boolean).join(" · ")
    };
  }

  function cloneTravelPlanCustomizerJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeTravelPlanCustomizerText(value) {
    return String(value ?? "").trim();
  }

  function travelPlanCustomizerBookingTourId() {
    const bookingId = normalizeTravelPlanCustomizerText(state.booking?.id || state.id || "draft");
    return `booking_travel_plan_${bookingId || "draft"}`;
  }

  function travelPlanCustomizerBookingTourTitle() {
    const booking = state.booking && typeof state.booking === "object" && !Array.isArray(state.booking)
      ? state.booking
      : {};
    return normalizeTravelPlanCustomizerText(booking.tour_title || booking.title || booking.name || booking.id)
      || "Booking travel plan";
  }

  function travelPlanCustomizerSourceRows() {
    return Array.isArray(state.travelPlanCustomizerSourceRows) ? state.travelPlanCustomizerSourceRows : [];
  }

  function normalizeTravelPlanCustomizerSourceDayId(row) {
    return normalizeTravelPlanCustomizerText(row?.source_day_id || row?.day_id || row?.source_day?.id);
  }

  function travelPlanCustomizerSourceDay(row) {
    const sourceDayId = normalizeTravelPlanCustomizerSourceDayId(row);
    const rawDay = row?.source_day && typeof row.source_day === "object" && !Array.isArray(row.source_day)
      ? cloneTravelPlanCustomizerJson(row.source_day)
      : {
          id: sourceDayId,
          day_number: Number(row?.day_number) || null,
          title: normalizeTravelPlanCustomizerText(row?.title),
          primary_location_id: normalizeTravelPlanCustomizerText(row?.primary_location_id),
          secondary_location_id: normalizeTravelPlanCustomizerText(row?.secondary_location_id),
          experience_highlight_ids: Array.isArray(row?.experience_highlight_ids) ? row.experience_highlight_ids : [],
          notes: normalizeTravelPlanCustomizerText(row?.notes),
          services: []
        };
    if (!rawDay || typeof rawDay !== "object" || Array.isArray(rawDay)) return null;
    rawDay.id = normalizeTravelPlanCustomizerText(rawDay.id) || sourceDayId;
    return rawDay.id ? rawDay : null;
  }

  function sortTravelPlanCustomizerTripDays(days) {
    return [...(Array.isArray(days) ? days : [])].sort((left, right) => {
      const leftNumber = Number(left?.day_number);
      const rightNumber = Number(right?.day_number);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      return normalizeTravelPlanCustomizerText(left?.id).localeCompare(normalizeTravelPlanCustomizerText(right?.id));
    });
  }

  function travelPlanCustomizerTripDayIds(trip) {
    return new Set(
      (Array.isArray(trip?.travel_plan?.days) ? trip.travel_plan.days : [])
        .map((day) => normalizeTravelPlanCustomizerText(day?.source_day_id || day?.id))
        .filter(Boolean)
    );
  }

  function buildTravelPlanCustomizerSourceTrip(sourceTourId) {
    const normalizedSourceTourId = normalizeTravelPlanCustomizerText(sourceTourId);
    if (!normalizedSourceTourId) return null;
    const trip = {
      id: normalizedSourceTourId,
      title: normalizedSourceTourId,
      published_on_webpage: true,
      travel_plan: { days: [] },
      dayIds: new Set()
    };
    let hasSourceDay = false;
    for (const row of travelPlanCustomizerSourceRows()) {
      if (normalizeTravelPlanCustomizerText(row?.source_tour_id) !== normalizedSourceTourId) continue;
      const sourceDayId = normalizeTravelPlanCustomizerSourceDayId(row);
      const rawDay = travelPlanCustomizerSourceDay(row);
      if (!sourceDayId || !rawDay || trip.dayIds.has(sourceDayId)) continue;
      if (!hasSourceDay) {
        trip.title = normalizeTravelPlanCustomizerText(row?.source_tour_title || row?.source_tour_code) || normalizedSourceTourId;
      }
      hasSourceDay = true;
      trip.dayIds.add(sourceDayId);
      trip.travel_plan.days.push({
        ...rawDay,
        id: normalizeTravelPlanCustomizerText(rawDay.id) || sourceDayId,
        day_number: Number(rawDay.day_number || row?.day_number) || trip.travel_plan.days.length + 1
      });
    }
    if (!hasSourceDay) return null;
    const { dayIds: _dayIds, ...sourceTrip } = trip;
    return {
      ...sourceTrip,
      travel_plan: {
        ...sourceTrip.travel_plan,
        days: sortTravelPlanCustomizerTripDays(sourceTrip.travel_plan.days)
      }
    };
  }

  function travelPlanCustomizerBookingTrip() {
    if (customizerStorageMode === "dayReferences") {
      const baseTourId = normalizeTravelPlanCustomizerText(state.travelPlanCustomizerBaseTourId || state.booking?.base_marketing_tour_id);
      const baseTrip = buildTravelPlanCustomizerSourceTrip(baseTourId);
      if (baseTrip) return baseTrip;
      return {
        id: baseTourId || travelPlanCustomizerBookingTourId(),
        title: normalizeTravelPlanCustomizerText(state.travelPlanCustomizerBaseTourTitle) || travelPlanCustomizerBookingTourTitle(),
        published_on_webpage: true,
        travel_plan: { days: [] }
      };
    }
    return {
      id: travelPlanCustomizerBookingTourId(),
      title: travelPlanCustomizerBookingTourTitle(),
      published_on_webpage: true,
      travel_plan: {
        days: travelPlanDays().map((day, index) => ({
          ...(day && typeof day === "object" && !Array.isArray(day) ? cloneTravelPlanCustomizerJson(day) : {}),
          id: normalizeTravelPlanCustomizerText(day?.id) || `booking_day_${index + 1}`,
          day_number: index + 1
        }))
      }
    };
  }

  function travelPlanCustomizerTrips() {
    const tripsById = new Map();
    const bookingTrip = travelPlanCustomizerBookingTrip();
    tripsById.set(bookingTrip.id, { ...bookingTrip, dayIds: travelPlanCustomizerTripDayIds(bookingTrip) });
    for (const row of travelPlanCustomizerSourceRows()) {
      const sourceTourId = normalizeTravelPlanCustomizerText(row?.source_tour_id);
      const sourceDayId = normalizeTravelPlanCustomizerSourceDayId(row);
      const rawDay = travelPlanCustomizerSourceDay(row);
      if (!sourceTourId || !sourceDayId || !rawDay) continue;
      if (!tripsById.has(sourceTourId)) {
        tripsById.set(sourceTourId, {
          id: sourceTourId,
          title: normalizeTravelPlanCustomizerText(row?.source_tour_title || row?.source_tour_code) || sourceTourId,
          published_on_webpage: true,
          travel_plan: { days: [] },
          dayIds: new Set()
        });
      }
      const trip = tripsById.get(sourceTourId);
      if (trip.dayIds.has(sourceDayId)) continue;
      trip.dayIds.add(sourceDayId);
      trip.travel_plan.days.push({
        ...rawDay,
        id: normalizeTravelPlanCustomizerText(rawDay.id) || sourceDayId,
        day_number: Number(rawDay.day_number || row?.day_number) || trip.travel_plan.days.length + 1
      });
    }
    return Array.from(tripsById.values()).map(({ dayIds: _dayIds, ...trip }) => ({
      ...trip,
      travel_plan: {
        ...trip.travel_plan,
        days: sortTravelPlanCustomizerTripDays(trip.travel_plan?.days)
      }
    }));
  }

  function travelPlanCustomizerTravelPlanDays(trip) {
    return Array.isArray(trip?.travel_plan?.days) ? trip.travel_plan.days : [];
  }

  function findTravelPlanCustomizerTripById(tourId) {
    const normalizedTourId = normalizeTravelPlanCustomizerText(tourId);
    return travelPlanCustomizerTrips().find((trip) => normalizeTravelPlanCustomizerText(trip?.id) === normalizedTourId) || null;
  }

  function travelPlanCustomizerSelectedDayRefs() {
    if (customizerStorageMode === "dayReferences") {
      return travelPlanDays().map((day, index) => {
        const sourceTourId = normalizeTravelPlanCustomizerText(day?.source_tour_id);
        const sourceDayId = normalizeTravelPlanCustomizerText(day?.source_day_id);
        const sourceRow = findTravelPlanCustomizerSourceRow(sourceTourId, sourceDayId);
        const sourceDay = sourceRow ? travelPlanCustomizerSourceDay(sourceRow) : null;
        const resolvedDay = day && typeof day === "object" && !Array.isArray(day)
          ? {
              ...cloneTravelPlanCustomizerJson(day),
              id: sourceDayId || normalizeTravelPlanCustomizerText(day?.id)
            }
          : null;
        const selectedSourceDay = sourceDay || resolvedDay;
        const timelineInstanceId = normalizeTravelPlanCustomizerText(day?.id) || `tour_variant_day_${index + 1}`;
        return {
          id: timelineInstanceId,
          timelineInstanceId,
          variantDayId: timelineInstanceId,
          source_tour_id: sourceTourId,
          source_day_id: sourceDayId,
          source_tour_title: normalizeTravelPlanCustomizerText(sourceRow?.source_tour_title || day?.source_tour_title),
          source_day_title: normalizeTravelPlanCustomizerText(sourceRow?.title || day?.source_day_title || day?.title),
          source_day_exists: Boolean(selectedSourceDay) && day?.source_day_exists !== false,
          source_tour_published_on_webpage: sourceRow
            ? sourceRow.source_tour_published_on_webpage !== false
            : day?.source_tour_published_on_webpage !== false,
          ...(selectedSourceDay ? {
            source_day: cloneTravelPlanCustomizerJson(selectedSourceDay),
            day: cloneTravelPlanCustomizerJson(selectedSourceDay)
          } : {})
        };
      }).filter((item) => item.source_tour_id && item.source_day_id);
    }
    const sourceTourId = travelPlanCustomizerBookingTourId();
    return travelPlanDays().map((day, index) => ({
      id: normalizeTravelPlanCustomizerText(day?.id) || `booking_day_${index + 1}`,
      timelineInstanceId: normalizeTravelPlanCustomizerText(day?.id) || `booking_day_${index + 1}`,
      source_tour_id: sourceTourId,
      source_day_id: normalizeTravelPlanCustomizerText(day?.id) || `booking_day_${index + 1}`,
      source_tour_title: travelPlanCustomizerBookingTourTitle(),
      source_day_title: resolveLocalizedDraftBranchText(day?.title_i18n ?? day?.title, bookingSourceLang(), ""),
      source_day_exists: true,
      source_tour_published_on_webpage: true,
      source_day: cloneTravelPlanCustomizerJson(day),
      day: cloneTravelPlanCustomizerJson(day)
    }));
  }

  function travelPlanCustomizerTripState({ forceDisabled = false } = {}) {
    const bookingTrip = travelPlanCustomizerBookingTrip();
    return {
      baseTrip: bookingTrip,
      selectedDayRefs: travelPlanCustomizerSelectedDayRefs(),
      disabled: forceDisabled || !state.permissions.canEditBooking,
      emptyOptionsLabel: "No optional days are available from marketing tours yet.",
      emptyTimelineLabel: "Add at least one day to keep customizing.",
      tourId: bookingTrip.id,
      tourTitle: bookingTrip.title
    };
  }

  function findTravelPlanCustomizerSourceRow(sourceTourId, sourceDayId) {
    const normalizedTourId = normalizeTravelPlanCustomizerText(sourceTourId);
    const normalizedDayId = normalizeTravelPlanCustomizerText(sourceDayId);
    return travelPlanCustomizerSourceRows().find((row) => (
      normalizeTravelPlanCustomizerText(row?.source_tour_id) === normalizedTourId
      && normalizeTravelPlanCustomizerSourceDayId(row) === normalizedDayId
    )) || null;
  }

  function cloneTravelPlanDayFromCustomizerItem(item, targetDayIndex) {
    const sourceTourId = normalizeTravelPlanCustomizerText(item?.sourceTourId || item?.source_tour_id);
    const sourceDayId = normalizeTravelPlanCustomizerText(item?.sourceDayId || item?.source_day_id);
    const previousDays = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
    if (sourceTourId === travelPlanCustomizerBookingTourId()) {
      const previousDay = previousDays.find((day) => normalizeTravelPlanCustomizerText(day?.id) === sourceDayId);
      if (previousDay) {
        return {
          ...cloneTravelPlanCustomizerJson(previousDay),
          day_number: targetDayIndex + 1
        };
      }
    }

    const sourceRow = findTravelPlanCustomizerSourceRow(sourceTourId, sourceDayId);
    const rawDay = sourceRow ? travelPlanCustomizerSourceDay(sourceRow) : (
      item?.day && typeof item.day === "object" && !Array.isArray(item.day)
        ? cloneTravelPlanCustomizerJson(item.day)
        : null
    );
    if (!rawDay) return null;
    if (customizerStorageMode === "dayReferences") {
      return {
        ...cloneTravelPlanCustomizerJson(rawDay),
        id: normalizeTravelPlanCustomizerText(item?.variantDayId || item?.timelineInstanceId) || `tour_variant_day_${targetDayIndex + 1}`,
        day_number: targetDayIndex + 1,
        source_tour_id: sourceTourId,
        source_day_id: sourceDayId
      };
    }
    if (typeof cloneTravelPlanDayForLocalImport === "function") {
      const importedDay = cloneTravelPlanDayForLocalImport({
        searchResult: {
          ...(sourceRow && typeof sourceRow === "object" && !Array.isArray(sourceRow) ? cloneTravelPlanCustomizerJson(sourceRow) : {}),
          source_tour_id: sourceTourId,
          source_day_id: sourceDayId,
          day_id: sourceDayId,
          source_day: cloneTravelPlanCustomizerJson(rawDay)
        },
        targetTravelPlan: cloneTravelPlanCustomizerJson(state.travelPlanDraft || createEmptyTravelPlan()),
        targetDayIndex
      });
      if (importedDay && typeof importedDay === "object" && !Array.isArray(importedDay)) {
        return {
          ...importedDay,
          id: normalizeTravelPlanCustomizerText(importedDay.id),
          day_number: targetDayIndex + 1
        };
      }
    }
    return {
      ...cloneTravelPlanCustomizerJson(rawDay),
      id: "",
      day_number: targetDayIndex + 1,
      date: null,
      services: (Array.isArray(rawDay.services) ? rawDay.services : []).map((service) => ({
        ...(service && typeof service === "object" && !Array.isArray(service) ? cloneTravelPlanCustomizerJson(service) : {}),
        id: ""
      }))
    };
  }

  function applyTravelPlanCustomizerTimeline(items) {
    const timelineItems = Array.isArray(items) ? items : [];
    const nextDays = timelineItems
      .map((item, index) => cloneTravelPlanDayFromCustomizerItem(item, index))
      .filter(Boolean)
      .map((day, index) => ({
        ...day,
        day_number: index + 1
      }));
    state.travelPlanDraft = normalizeTravelPlanState({
      ...(state.travelPlanDraft || createEmptyTravelPlan()),
      days: nextDays
    });
    const activeDay = state.travelPlanDraft.days.find((day) => day.id === state.travelPlanFocusedDayId)
      || state.travelPlanDraft.days[0]
      || null;
    state.travelPlanFocusedDayId = normalizeTravelPlanCustomizerText(activeDay?.id);
    state.travelPlanFocusedBoundaryKind = state.travelPlanFocusedDayId ? "" : "arrival";
    updateTravelPlanDirtyState();
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    renderTravelPlanTranslationPanel();
    renderOfferPanel?.();
  }

  function renderTravelPlanCustomizerLauncher() {
    return `
      <div
        class="travel-plan-customizer-preview travel-plan-customizer-preview__mount"
        role="button"
        tabindex="0"
        aria-controls="travelPlanCustomizerOverlay"
        aria-expanded="${travelPlanCustomizerOverlayOpen ? "true" : "false"}"
        aria-label="Open route customizer"
        data-travel-plan-open-customizer
        data-travel-plan-customizer-preview
      ></div>
      <div
        id="travelPlanCustomizerOverlay"
        class="travel-plan-customizer-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Route customizer"
        ${travelPlanCustomizerOverlayOpen ? "" : "hidden"}
      >
        <div class="travel-plan-customizer-overlay__mount" data-travel-plan-customizer-overlay></div>
        <button class="btn btn-ghost travel-plan-customizer-overlay__close" type="button" data-travel-plan-close-customizer${travelPlanCustomizerOverlayOpen ? "" : " hidden"}>Use</button>
      </div>
    `;
  }

  function renderTravelPlanSidebarDateActions() {
    if (!allowDayAdd) return "";
    return `
      <div class="travel-plan-sidebar-actions">
        <button
          class="btn btn-ghost travel-plan-sidebar-add-day-btn"
          data-travel-plan-add-day
          type="button"
        >
          <span class="travel-plan-sidebar-add-day-btn__icon" aria-hidden="true">+</span>
          <span>${escapeHtml(bookingT("booking.travel_plan.add_day", "Add Day"))}</span>
        </button>
      </div>
    `;
  }

  function renderTravelPlanMapPdfActions() {
    if (!allowPdfs) return "";
    return `
      <div class="travel-plan-map-pdf-actions" aria-label="${escapeHtml(bookingT("booking.travel_plan.pdf_preview_actions", "PDF preview actions"))}">
        <button
          class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn travel-plan-map-pdf-actions__btn"
          data-travel-plan-preview-one-pager-pdf
          data-requires-clean-state
          data-clean-state-hint-id="travel_plan_map_pdf_dirty_hint"
          type="button"
        >${escapeHtml(bookingT("booking.travel_plan.preview_one_pager_pdf", "Preview one-pager PDF"))}</button>
        <button
          class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn travel-plan-pdf-btn--preview travel-plan-map-pdf-actions__btn"
          data-travel-plan-preview-pdf
          data-requires-clean-state
          data-clean-state-hint-id="travel_plan_map_pdf_dirty_hint"
          type="button"
        >${escapeHtml(bookingT("booking.travel_plan.preview_travel_plan_pdf", "Preview Travel Plan PDF"))}</button>
        <span id="travel_plan_map_pdf_dirty_hint" class="micro booking-inline-status travel-plan-pdf-actions__hint"></span>
      </div>
    `;
  }

  function renderTravelPlanMapPanel() {
    return `
      <aside class="travel-plan-booking-map" aria-label="${escapeHtml(bookingT("tour.customize.map", "Map"))}">
        ${allowCustomizer ? renderTravelPlanCustomizerLauncher() : ""}
        ${renderTravelPlanMapPdfActions()}
      </aside>
    `;
  }

  async function loadTravelPlanCustomizerSourceRows() {
    if (!useFocusedBookingWorkspace || !allowCustomizer) return [];
    if (Array.isArray(state.travelPlanCustomizerSourceRows)) return state.travelPlanCustomizerSourceRows;
    if (travelPlanCustomizerSourceRowsPromise) return travelPlanCustomizerSourceRowsPromise;
    const url = withBackendLangQuery(`${apiOrigin}/api/v1/tours/travel-plan-days/search?limit=50`);
    travelPlanCustomizerSourceRowsPromise = fetchBookingMutation(url, { method: "GET" })
      .then((payload) => {
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        state.travelPlanCustomizerSourceRows = rows;
        return rows;
      })
      .catch((error) => {
        state.travelPlanCustomizerSourceRows = [];
        logBrowserConsoleError("[travel-plan-customizer] Failed to load marketing-tour source days.", {
          booking_id: state.booking?.id || ""
        }, error);
        return [];
      })
      .finally(() => {
        travelPlanCustomizerSourceRowsPromise = null;
      });
    return travelPlanCustomizerSourceRowsPromise;
  }

  function createTravelPlanCustomizerWorkspace(root, onTimelineChange = null, mode = "default") {
    return createTourCustomizerWorkspace({
      root,
      mode,
      labels: travelPlanCustomizerLabels,
      escapeHTML: escapeHtml,
      escapeAttr: escapeHtml,
      currentFrontendLang: bookingSourceLang,
      destinationScopeCatalog: () => state.destinationScopeCatalog,
      travelPlanDays: travelPlanCustomizerTravelPlanDays,
      allTrips: travelPlanCustomizerTrips,
      findTripById: findTravelPlanCustomizerTripById,
      ensureTourDetailsLoaded: async (tourId) => findTravelPlanCustomizerTripById(tourId),
      onTimelineChange
    });
  }

  function destroyTravelPlanCustomizerWorkspaces() {
    travelPlanCustomizerPreviewWorkspace?.destroy?.();
    travelPlanCustomizerOverlayWorkspace?.destroy?.();
    travelPlanCustomizerPreviewWorkspace = null;
    travelPlanCustomizerOverlayWorkspace = null;
    removePortaledTravelPlanCustomizerElements();
    travelPlanCustomizerOverlayOpen = false;
  }

  function removePortaledTravelPlanCustomizerElements() {
    const overlay = document.getElementById("travelPlanCustomizerOverlay");
    if (overlay instanceof HTMLElement && overlay.parentElement === document.body) {
      overlay.remove();
    }
  }

  function travelPlanCustomizerOverlayElement() {
    const overlay = document.getElementById("travelPlanCustomizerOverlay")
      || els.travel_plan_editor?.querySelector?.("#travelPlanCustomizerOverlay");
    return overlay instanceof HTMLElement ? overlay : null;
  }

  function travelPlanCustomizerCloseButtonElement() {
    const closeButton = travelPlanCustomizerOverlayElement()?.querySelector?.("[data-travel-plan-close-customizer]")
      || els.travel_plan_editor?.querySelector?.("[data-travel-plan-close-customizer]");
    return closeButton instanceof HTMLElement ? closeButton : null;
  }

  function handleTravelPlanCustomizerOverlayClick(event) {
    if (!travelPlanCustomizerOverlayOpen) return;
    const button = event.target instanceof Element
      ? event.target.closest("[data-travel-plan-close-customizer]")
      : null;
    if (!button) return;
    event.preventDefault();
    closeTravelPlanCustomizerOverlay();
  }

  function handleTravelPlanCustomizerOverlayKeydown(event) {
    if (event.key !== "Escape" || !travelPlanCustomizerOverlayOpen) return;
    event.preventDefault();
    closeTravelPlanCustomizerOverlay();
  }

  function refreshTravelPlanCustomizerPreviewTrigger() {
    const trigger = els.travel_plan_editor?.querySelector?.("[data-travel-plan-open-customizer]");
    if (!(trigger instanceof HTMLElement)) return;
    trigger.setAttribute("aria-expanded", travelPlanCustomizerOverlayOpen ? "true" : "false");
    trigger.setAttribute("title", "Open route customizer");
    const previewMount = els.travel_plan_editor?.querySelector?.("[data-travel-plan-customizer-preview]");
    previewMount?.querySelectorAll?.("button, [tabindex]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.setAttribute("tabindex", "-1");
      element.setAttribute("aria-hidden", "true");
    });
  }

  function refreshTravelPlanCustomizerWorkspaceState() {
    const tripState = travelPlanCustomizerTripState();
    const previewState = {
      ...tripState,
      disabled: true
    };
    void travelPlanCustomizerPreviewWorkspace?.setTripState?.(previewState)
      ?.then?.(refreshTravelPlanCustomizerPreviewTrigger)
      ?.catch?.((error) => {
        logBrowserConsoleError("[travel-plan-customizer] Failed to render preview.", {
          booking_id: state.booking?.id || ""
        }, error);
      });
    void travelPlanCustomizerOverlayWorkspace?.setTripState?.(tripState)
      ?.catch?.((error) => {
        logBrowserConsoleError("[travel-plan-customizer] Failed to render overlay.", {
          booking_id: state.booking?.id || ""
        }, error);
      });
  }

  function renderTravelPlanCustomizerWorkspaces() {
    if (!useFocusedBookingWorkspace || !allowCustomizer || !els.travel_plan_editor) return;
    destroyTravelPlanCustomizerWorkspaces();
    const previewRoot = els.travel_plan_editor.querySelector("[data-travel-plan-customizer-preview]");
    const overlayRoot = els.travel_plan_editor.querySelector("[data-travel-plan-customizer-overlay]");
    if (previewRoot instanceof HTMLElement) {
      travelPlanCustomizerPreviewWorkspace = createTravelPlanCustomizerWorkspace(previewRoot, null, "preview");
    }
    if (overlayRoot instanceof HTMLElement) {
      travelPlanCustomizerOverlayWorkspace = createTravelPlanCustomizerWorkspace(overlayRoot, applyTravelPlanCustomizerTimeline, "full");
    }
    refreshTravelPlanCustomizerWorkspaceState();
    void loadTravelPlanCustomizerSourceRows().then(() => {
      if (!els.travel_plan_editor?.querySelector?.("[data-travel-plan-customizer-preview]")) return;
      refreshTravelPlanCustomizerWorkspaceState();
    });
  }

  function openTravelPlanCustomizerOverlay() {
    if (!useFocusedBookingWorkspace || !allowCustomizer || !els.travel_plan_editor) return;
    syncTravelPlanDraftFromDom();
    renderTravelPlanCustomizerWorkspaces();
    const overlay = els.travel_plan_editor.querySelector("#travelPlanCustomizerOverlay");
    if (!(overlay instanceof HTMLElement)) return;
    const closeButton = els.travel_plan_editor.querySelector("[data-travel-plan-close-customizer]");
    document.body.appendChild(overlay);
    travelPlanCustomizerOverlayOpen = true;
    overlay.hidden = false;
    if (closeButton instanceof HTMLElement) closeButton.hidden = false;
    if (overlay.dataset.travelPlanCustomizerOverlayBound !== "1") {
      overlay.addEventListener("click", handleTravelPlanCustomizerOverlayClick);
      overlay.addEventListener("keydown", handleTravelPlanCustomizerOverlayKeydown);
      overlay.dataset.travelPlanCustomizerOverlayBound = "1";
    }
    refreshTravelPlanCustomizerPreviewTrigger();
    refreshTravelPlanCustomizerWorkspaceState();
    window.setTimeout(() => {
      if (!travelPlanCustomizerOverlayOpen) return;
      closeButton?.focus?.();
    }, 0);
  }

  function closeTravelPlanCustomizerOverlay({ rerender = true } = {}) {
    if (!travelPlanCustomizerOverlayOpen) return;
    travelPlanCustomizerOverlayOpen = false;
    const overlay = travelPlanCustomizerOverlayElement();
    if (overlay instanceof HTMLElement) overlay.hidden = true;
    const closeButton = travelPlanCustomizerCloseButtonElement();
    if (closeButton instanceof HTMLElement) closeButton.hidden = true;
    refreshTravelPlanCustomizerPreviewTrigger();
    if (rerender) {
      renderTravelPlanPanel();
    } else {
      removePortaledTravelPlanCustomizerElements();
    }
  }

  function renderTravelPlanSidebar(selection) {
    const days = travelPlanDays();
    const optionMap = travelPlanLocationOptionMap();
    const arrivalSelected = selection.type === "boundary" && selection.boundaryKind === "arrival";
    const departureSelected = selection.type === "boundary" && selection.boundaryKind === "departure";
    const arrivalDisplay = travelPlanBoundaryRouteCardDisplay("arrival");
    const departureDisplay = travelPlanBoundaryRouteCardDisplay("departure");
    return `
      <aside class="travel-plan-booking-sidebar" aria-label="Travel plan navigation">
        ${renderTravelPlanSidebarDateActions()}
        <div class="travel-plan-route-list">
          <button class="travel-plan-route-list__item travel-plan-route-list__item--boundary travel-plan-route-list__item--arrival${arrivalSelected ? " is-selected" : ""}${arrivalDisplay.enabled ? "" : " is-inactive"}" data-travel-plan-select-boundary="arrival" type="button">
            <span class="travel-plan-route-list__badge travel-plan-route-list__badge--image" aria-hidden="true">
              <img src="/assets/img/arrival.png" alt="" loading="lazy" decoding="async" />
            </span>
            <span class="travel-plan-route-list__copy">
              <strong data-travel-plan-route-boundary-title="arrival">${escapeHtml(arrivalDisplay.title)}</strong>
              <small data-travel-plan-route-boundary-subtitle="arrival" ${arrivalDisplay.subtitle ? "" : "hidden"}>${escapeHtml(arrivalDisplay.subtitle)}</small>
            </span>
          </button>
          ${days.map((day, index) => {
            const dayId = String(day?.id || "").trim();
            const selected = selection.type === "day" && selection.dayId === dayId;
            const meta = [travelPlanDayDateLabel(day), travelPlanDayLocationLabel(day, optionMap)].filter(Boolean).join(" · ");
            const warningText = travelPlanDayWarningText(day, index);
            return `
              <button
                class="travel-plan-route-list__item travel-plan-route-list__item--day${selected ? " is-selected" : ""}${warningText ? " has-warnings" : ""}"
                data-travel-plan-select-day="${escapeHtml(dayId)}"
                data-travel-plan-route-day="${escapeHtml(dayId)}"
                draggable="${state.permissions.canEditBooking && allowDayReorder ? "true" : "false"}"
                aria-grabbed="false"
                type="button"
              >
                <span class="travel-plan-route-list__drag-handle" aria-hidden="true">
                  <img src="/assets/img/drag-indicator.svg" alt="" loading="lazy" decoding="async" />
                </span>
                <span class="travel-plan-route-list__badge">${escapeHtml(String(index + 1))}</span>
                <span class="travel-plan-route-list__copy">
                  <strong data-travel-plan-route-day-title>${escapeHtml(travelPlanDayListTitle(day, index))}</strong>
                  <small data-travel-plan-route-day-meta>${escapeHtml(meta || bookingT("booking.travel_plan.location_none", "No map point"))}</small>
                  ${renderTravelPlanDayWarnings(day, index)}
                </span>
              </button>
            `;
          }).join("")}
          <button class="travel-plan-route-list__item travel-plan-route-list__item--boundary travel-plan-route-list__item--departure${departureSelected ? " is-selected" : ""}${departureDisplay.enabled ? "" : " is-inactive"}" data-travel-plan-select-boundary="departure" type="button">
            <span class="travel-plan-route-list__badge travel-plan-route-list__badge--image" aria-hidden="true">
              <img src="/assets/img/departure.png" alt="" loading="lazy" decoding="async" />
            </span>
            <span class="travel-plan-route-list__copy">
              <strong data-travel-plan-route-boundary-title="departure">${escapeHtml(departureDisplay.title)}</strong>
              <small data-travel-plan-route-boundary-subtitle="departure" ${departureDisplay.subtitle ? "" : "hidden"}>${escapeHtml(departureDisplay.subtitle)}</small>
            </span>
          </button>
        </div>
      </aside>
    `;
  }

  function renderTravelPlanFocusedEditor(selection) {
    if (selection.type === "boundary") {
      const title = boundaryLabel(selection.boundaryKind);
      if (allowAirportSelect) {
        return `
          <section class="travel-plan-booking-editor travel-plan-booking-editor--boundary-card" aria-label="${escapeHtml(title)}">
            ${renderTravelPlanBoundarySection(selection.boundaryKind)}
          </section>
        `;
      }
      const iconSrc = selection.boundaryKind === "arrival" ? "/assets/img/arrival.png" : "/assets/img/departure.png";
      return `
        <section class="travel-plan-booking-editor" aria-label="${escapeHtml(title)}">
          <div class="travel-plan-booking-editor__toolbar">
            <div class="travel-plan-booking-editor__title">
              <span class="travel-plan-booking-editor__badge travel-plan-booking-editor__badge--image" aria-hidden="true">
                <img src="${escapeHtml(iconSrc)}" alt="" loading="lazy" decoding="async" />
              </span>
              <div>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(travelPlanBoundaryDisplay(selection.boundaryKind))}</p>
              </div>
            </div>
          </div>
          ${renderTravelPlanBoundarySection(selection.boundaryKind)}
        </section>
      `;
    }
    const days = travelPlanDays();
    const dayIndex = days.findIndex((day) => String(day?.id || "").trim() === selection.dayId);
    const day = dayIndex >= 0 ? days[dayIndex] : null;
    if (!day) {
      return `
        <section class="travel-plan-booking-editor travel-plan-booking-editor--empty">
          <p class="travel-plan-empty">${escapeHtml(bookingT("booking.travel_plan.no_days", "No travel-plan days yet."))}</p>
        </section>
      `;
    }
    return `
      <section class="travel-plan-booking-editor" aria-label="${escapeHtml(travelPlanDayTitle(day, dayIndex))}">
        ${renderTravelPlanDay(day, dayIndex, { focusedBookingEditor: true })}
      </section>
    `;
  }

  function renderFocusedTravelPlanWorkspace({ destinationScopeMarkup = "" } = {}) {
    const selection = ensureFocusedTravelPlanSelection();
    return `
      ${usesExternalDestinationScopeEditor() ? "" : destinationScopeMarkup}
      <div class="travel-plan-booking-workspace">
        ${renderTravelPlanMapPanel()}
        ${renderTravelPlanSidebar(selection)}
        ${renderTravelPlanFocusedEditor(selection)}
      </div>
    `;
  }

  function readLocalizedFieldPayload(container, dataScope, field, existingValue = null) {
    const sourceInput = container?.querySelector(`[data-${dataScope}="${field}"][data-localized-role="source"]`);
    const sourceLang = bookingSourceLang();
    const targetLang = bookingContentLang();
    const localizedInput = targetLang === sourceLang
      ? null
      : container?.querySelector(`[data-${dataScope}="${field}"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    if (!sourceInput && !localizedInput) {
      const existingMap = normalizeLocalizedEditorMap(existingValue, sourceLang);
      return {
        map: existingMap,
        text: resolveLocalizedDraftBranchText(existingMap, sourceLang, "")
      };
    }
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

  function readTravelPlanBoundaryServiceFromDom(boundaryKind, previousBoundary) {
    const normalizedBoundaryKind = normalizeTravelPlanBoundaryKind(boundaryKind);
    const node = els.travel_plan_editor?.querySelector?.(`[data-travel-plan-boundary="${escapeSelectorValue(normalizedBoundaryKind)}"]`);
    const previous = previousBoundary && typeof previousBoundary === "object" && !Array.isArray(previousBoundary)
      ? previousBoundary
      : {};
    if (!(node instanceof HTMLElement)) {
      return normalizeTravelPlanBoundaryDraft(
        Object.keys(previous).length ? previous : createEmptyTravelPlanBoundaryService(normalizedBoundaryKind),
        normalizedBoundaryKind
      );
    }
    const item = {
      ...createEmptyTravelPlanBoundaryService(normalizedBoundaryKind),
      ...previous
    };
    item.id = String(previous.id || item.id || "").trim();
    item.boundary_kind = normalizedBoundaryKind;
    const placement = String(node?.querySelector('[data-travel-plan-boundary-field="placement"]')?.value || "").trim();
    item.enabled = placement !== "none";
    item.kind = "transport";
    item.airport_code = String(node?.querySelector('[data-travel-plan-boundary-field="airport_code"]')?.value || "").trim();
    item.from_label = String(previous.from_label || "").trim();
    item.to_label = String(previous.to_label || "").trim();
    item.presentation = defaultTravelPlanBoundaryPresentation(normalizedBoundaryKind, placement);
    if (allowTiming) {
      const time = readLocalizedFieldPayload(
        node,
        "travel-plan-boundary-field",
        "time",
        previous?.time_i18n ?? previous?.time
      );
      item.time = time.text;
      item.time_i18n = time.map;
    } else {
      item.time = previous.time || "";
      item.time_i18n = previous.time_i18n || {};
    }
    const title = readLocalizedFieldPayload(
      node,
      "travel-plan-boundary-field",
      "title",
      previous?.title_i18n ?? previous?.title
    );
    item.title = title.text;
    item.title_i18n = title.map;
    if (allowServiceDetails) {
      const details = readLocalizedFieldPayload(
        node,
        "travel-plan-boundary-field",
        "details",
        previous?.details_i18n ?? previous?.details
      );
      item.details = details.text;
      item.details_i18n = details.map;
    } else {
      item.details = previous.details || item.details || "";
      item.details_i18n = previous.details_i18n || item.details_i18n || {};
    }
    item.image_subtitle = previous.image_subtitle || "";
    item.image_subtitle_i18n = previous.image_subtitle_i18n || {};
    item.image = previous?.image && typeof previous.image === "object" && !Array.isArray(previous.image)
      ? { ...previous.image }
      : null;
    return normalizeTravelPlanBoundaryDraft(item, normalizedBoundaryKind);
  }

  function syncTravelPlanDraftFromDom() {
    if (!els.travel_plan_editor) return state.travelPlanDraft;
    const previousItemsById = new Map(
      (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])
        .flatMap((day) => (Array.isArray(day?.services) ? day.services : []))
        .map((item) => [item.id, item])
    );
    const previousDraft = state.travelPlanDraft && typeof state.travelPlanDraft === "object" && !Array.isArray(state.travelPlanDraft)
      ? cloneTravelPlanCustomizerJson(state.travelPlanDraft)
      : {};
    const draft = {
      ...createEmptyTravelPlan(),
      ...previousDraft
    };
    draft.tour_card_image_ids = Array.isArray(state.travelPlanDraft?.tour_card_image_ids)
      ? [...state.travelPlanDraft.tour_card_image_ids]
      : [];
    draft.one_pager_hero_image_id = state.travelPlanDraft?.one_pager_hero_image_id || null;
    draft.one_pager_image_ids = Array.isArray(state.travelPlanDraft?.one_pager_image_ids)
      ? [...state.travelPlanDraft.one_pager_image_ids]
      : [];
    const previousBoundaryLogistics = state.travelPlanDraft?.boundary_logistics && typeof state.travelPlanDraft.boundary_logistics === "object" && !Array.isArray(state.travelPlanDraft.boundary_logistics)
      ? state.travelPlanDraft.boundary_logistics
      : {};
    const arrivalBoundary = readTravelPlanBoundaryServiceFromDom("arrival", previousBoundaryLogistics.arrival);
    const departureBoundary = readTravelPlanBoundaryServiceFromDom("departure", previousBoundaryLogistics.departure);
    draft.boundary_logistics = {
      ...(arrivalBoundary.enabled || travelPlanBoundaryHasContent(arrivalBoundary) ? { arrival: arrivalBoundary } : {}),
      ...(departureBoundary.enabled || travelPlanBoundaryHasContent(departureBoundary) ? { departure: departureBoundary } : {})
    };
    const renderedDays = Array.from(els.travel_plan_editor.querySelectorAll("[data-travel-plan-day]")).map((dayNode, dayIndex) => {
      const dayId = String(dayNode.getAttribute("data-travel-plan-day") || "").trim();
      const previousDay = (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : []).find((candidate) => candidate?.id === dayId) || null;
      const day = previousDay && typeof previousDay === "object" && !Array.isArray(previousDay)
        ? cloneTravelPlanCustomizerJson(previousDay)
        : createEmptyTravelPlanDay(dayIndex);
      day.id = dayId || day.id;
      day.day_number = dayIndex + 1;
      if (allowDayTitleEdit) {
        const dayTitle = readLocalizedFieldPayload(dayNode, "travel-plan-day-field", "title", previousDay?.title_i18n ?? previousDay?.title);
        day.title = dayTitle.text;
        day.title_i18n = dayTitle.map;
      }
      if (allowDates) {
        const dateInput = dayNode.querySelector('[data-travel-plan-day-field="date"]');
        day.date = dateInput
          ? String(dateInput.value || "").trim()
          : String(previousDay?.date || "").trim();
      }
      if (allowMapPointEdit) {
        day.primary_location_id = String(dayNode.querySelector('[data-travel-plan-day-location-field="primary_location_id"]')?.value || "").trim();
        day.secondary_location_id = String(dayNode.querySelector('[data-travel-plan-day-location-field="secondary_location_id"]')?.value || "").trim();
        const highlightInput = dayNode.querySelector("[data-travel-plan-day-highlight]");
        day.experience_highlight_ids = highlightInput
          ? normalizeTravelPlanDayExperienceHighlightIds([highlightInput.value])
          : normalizeTravelPlanDayExperienceHighlightIds(previousDay?.experience_highlight_ids);
      }
      if (allowDayDetailsEdit) {
        const dayNotes = readLocalizedFieldPayload(
          dayNode,
          "travel-plan-day-field",
          "notes",
          previousDay?.notes_i18n ?? previousDay?.notes
        );
        day.notes = dayNotes.text;
        day.notes_i18n = dayNotes.map;
      }
      if (allowEditableServices) {
        day.services = Array.from(dayNode.querySelectorAll("[data-travel-plan-service]")).map((itemNode) => {
          const itemId = String(itemNode.getAttribute("data-travel-plan-service") || "").trim();
          const previousItem = previousItemsById.get(itemId);
          const item = previousItem && typeof previousItem === "object" && !Array.isArray(previousItem)
            ? cloneTravelPlanCustomizerJson(previousItem)
            : createEmptyTravelPlanService();
          item.id = itemId || item.id;
          if (allowTiming) {
            const time = readLocalizedFieldPayload(
              itemNode,
              "travel-plan-service-field",
              "time",
              previousItem?.time_i18n ?? previousItem?.time
            );
            item.time = time.text;
            item.time_i18n = time.map;
          }
          const kindInput = itemNode.querySelector('[data-travel-plan-service-field="kind"]');
          item.kind = kindInput
            ? String(kindInput.value || "").trim()
            : String(previousItem?.kind || "").trim();
          const itemTitle = readLocalizedFieldPayload(
            itemNode,
            "travel-plan-service-field",
            "title",
            previousItem?.title_i18n ?? previousItem?.title
          );
          item.title = itemTitle.text;
          item.title_i18n = itemTitle.map;
          if (allowServiceDetails) {
            const itemDetails = readLocalizedFieldPayload(
              itemNode,
              "travel-plan-service-field",
              "details",
              previousItem?.details_i18n ?? previousItem?.details
            );
            item.details = itemDetails.text;
            item.details_i18n = itemDetails.map;
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
            ? { ...previousItem.image }
            : null;
          return item;
        });
      }
      return day;
    });
    if (useFocusedBookingWorkspace) {
      const renderedById = new Map(renderedDays.map((day) => [String(day?.id || "").trim(), day]));
      const previousDays = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
      const previousIds = new Set(previousDays.map((day) => String(day?.id || "").trim()).filter(Boolean));
      draft.days = previousDays.map((previousDay, dayIndex) => {
        const previousDayId = String(previousDay?.id || "").trim();
        const nextDay = previousDayId && renderedById.has(previousDayId)
          ? renderedById.get(previousDayId)
          : previousDay && typeof previousDay === "object" && !Array.isArray(previousDay)
            ? { ...previousDay }
            : createEmptyTravelPlanDay(dayIndex);
        nextDay.day_number = dayIndex + 1;
        return nextDay;
      });
      for (const renderedDay of renderedDays) {
        const renderedDayId = String(renderedDay?.id || "").trim();
        if (!renderedDayId || previousIds.has(renderedDayId)) continue;
        draft.days.push(renderedDay);
      }
      draft.days.forEach((day, dayIndex) => {
        day.day_number = dayIndex + 1;
      });
    } else {
      draft.days = renderedDays;
    }
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
    if (!allowDayAdd || state.permissions.canEditBooking !== true) return;
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const firstDayDate = String(days[0]?.date || "").trim();
    const nextDay = createEmptyTravelPlanDay(days.length);
    if (!allowDates) {
      delete nextDay.date;
    }
    days.push(nextDay);
    state.travelPlanDraft.days = days;
    if (!recalculateTravelPlanDayDates({ anchorDate: firstDayDate })) clearTravelPlanDerivedDayDates();
    if (useFocusedBookingWorkspace) {
      state.travelPlanFocusedDayId = String(nextDay.id || "").trim();
      state.travelPlanFocusedBoundaryKind = "";
    }
    renderTravelPlanPanel();
    renderOfferPanel?.();
  }

  function recalculateTravelPlanDayDates({ anchorDate = "", syncFromDom = false } = {}) {
    if (!allowSequentialDayDates || !allowDates) return false;
    if (syncFromDom) syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
    if (!days.length) return false;
    const firstDayDate = String(anchorDate || days[0]?.date || "").trim();
    if (!isValidIsoCalendarDate(firstDayDate)) {
      return false;
    }
    let currentDate = firstDayDate;
    days.forEach((day, index) => {
      if (!day || typeof day !== "object" || Array.isArray(day)) return;
      const dayDate = index === 0 ? firstDayDate : nextIsoDate(currentDate);
      if (!dayDate) return;
      day.date = dayDate;
      currentDate = dayDate;
    });
    state.travelPlanDraft.days = days;
    return true;
  }

  function clearTravelPlanDerivedDayDates() {
    if (!allowDates) return false;
    const days = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
    let changed = false;
    for (let index = 1; index < days.length; index += 1) {
      const day = days[index];
      if (!day || typeof day !== "object" || Array.isArray(day)) continue;
      if (String(day.date || "").trim()) {
        day.date = "";
        changed = true;
      }
    }
    return changed;
  }

  function recalculateTravelPlanDayDatesAndRender({ anchorDate = "", syncFromDom = false } = {}) {
    if (!recalculateTravelPlanDayDates({ anchorDate, syncFromDom })) {
      updateTravelPlanDirtyState();
      refreshTravelPlanRouteDayRow(String(state.travelPlanDraft?.days?.[0]?.id || "").trim());
      renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
      renderTravelPlanTranslationPanel();
      return false;
    }
    renderTravelPlanPanel();
    renderOfferPanel?.();
    return true;
  }

  function removeDay(dayId, { confirm = true } = {}) {
    if (!allowDayDelete || state.permissions.canEditBooking !== true) return false;
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return false;
    if (confirm && !window.confirm(bookingT("booking.travel_plan.remove_day_confirm", "Remove this day and all its services?"))) return false;
    state.travelPlanDraft.days.splice(dayIndex, 1);
    if (useFocusedBookingWorkspace && state.travelPlanFocusedDayId === dayId) {
      const fallbackDay = state.travelPlanDraft.days[Math.min(dayIndex, state.travelPlanDraft.days.length - 1)] || null;
      state.travelPlanFocusedDayId = String(fallbackDay?.id || "").trim();
      state.travelPlanFocusedBoundaryKind = state.travelPlanFocusedDayId ? "" : "arrival";
    }
    if (!recalculateTravelPlanDayDates()) clearTravelPlanDerivedDayDates();
    renderTravelPlanPanel();
    renderOfferPanel?.();
    return true;
  }

  function syncTravelPlanDayNumbers(days) {
    (Array.isArray(days) ? days : []).forEach((day, dayIndex) => {
      if (day && typeof day === "object" && !Array.isArray(day)) {
        day.day_number = dayIndex + 1;
      }
    });
  }

  function moveDay(dayId, direction) {
    if (!allowDayReorder || state.permissions.canEditBooking !== true) return;
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const dayIndex = days.findIndex((day) => day.id === dayId);
    if (dayIndex < 0) return;
    const firstDayDate = String(days[0]?.date || "").trim();
    const nextIndex = direction === "up" ? dayIndex - 1 : dayIndex + 1;
    if (nextIndex < 0 || nextIndex >= days.length) return;
    const [day] = days.splice(dayIndex, 1);
    days.splice(nextIndex, 0, day);
    syncTravelPlanDayNumbers(days);
    if (!recalculateTravelPlanDayDates({ anchorDate: firstDayDate })) clearTravelPlanDerivedDayDates();
    renderTravelPlanPanel();
    renderOfferPanel?.();
  }

  function moveTravelPlanDayNearRouteTarget(dayId, targetDayId, placement = "before") {
    if (!allowDayReorder || state.permissions.canEditBooking !== true) return false;
    const normalizedDayId = String(dayId || "").trim();
    const normalizedTargetDayId = String(targetDayId || "").trim();
    if (!normalizedDayId || !normalizedTargetDayId || normalizedDayId === normalizedTargetDayId) return false;
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    const sourceIndex = days.findIndex((day) => String(day?.id || "").trim() === normalizedDayId);
    const targetIndex = days.findIndex((day) => String(day?.id || "").trim() === normalizedTargetDayId);
    if (sourceIndex < 0 || targetIndex < 0) return false;
    const firstDayDate = String(days[0]?.date || "").trim();
    const [day] = days.splice(sourceIndex, 1);
    let insertIndex = targetIndex;
    if (sourceIndex < targetIndex) insertIndex -= 1;
    if (placement === "after") insertIndex += 1;
    days.splice(Math.max(0, Math.min(insertIndex, days.length)), 0, day);
    syncTravelPlanDayNumbers(days);
    if (!recalculateTravelPlanDayDates({ anchorDate: firstDayDate })) clearTravelPlanDerivedDayDates();
    if (useFocusedBookingWorkspace) {
      state.travelPlanFocusedDayId = normalizedDayId;
      state.travelPlanFocusedBoundaryKind = "";
    }
    renderTravelPlanPanel();
    renderOfferPanel?.();
    return true;
  }

  function travelPlanRouteDayElementFromTarget(target) {
    const row = target instanceof Element ? target.closest("[data-travel-plan-route-day]") : null;
    return row instanceof HTMLElement ? row : null;
  }

  function travelPlanRouteBoundaryElementFromTarget(target) {
    const row = target instanceof Element ? target.closest("[data-travel-plan-select-boundary]") : null;
    return row instanceof HTMLElement ? row : null;
  }

  function travelPlanRouteListElement() {
    const routeList = els.travel_plan_editor?.querySelector?.(".travel-plan-route-list");
    return routeList instanceof HTMLElement ? routeList : null;
  }

  function travelPlanRouteDayRows(routeList = travelPlanRouteListElement()) {
    if (!(routeList instanceof HTMLElement)) return [];
    return Array.from(routeList.querySelectorAll("[data-travel-plan-route-day]")).filter((row) => row instanceof HTMLElement);
  }

  function travelPlanRouteDropContextForRow(row, placement = "") {
    const targetDayId = String(row?.getAttribute("data-travel-plan-route-day") || "").trim();
    if (!(row instanceof HTMLElement) || !targetDayId) return null;
    return {
      placeholder: null,
      row,
      targetDayId,
      placement
    };
  }

  function travelPlanRouteDayElementById(dayId) {
    const normalizedDayId = String(dayId || "").trim();
    if (!normalizedDayId || !(els.travel_plan_editor instanceof HTMLElement)) return null;
    const row = els.travel_plan_editor.querySelector(`[data-travel-plan-route-day="${CSS.escape(normalizedDayId)}"]`);
    return row instanceof HTMLElement ? row : null;
  }

  function travelPlanRouteDropPlaceholderElementFromTarget(target) {
    const placeholder = target instanceof Element ? target.closest("[data-travel-plan-route-placeholder]") : null;
    return placeholder instanceof HTMLElement ? placeholder : null;
  }

  function travelPlanRouteBoundaryDropContextFromTarget(target) {
    const boundary = travelPlanRouteBoundaryElementFromTarget(target);
    if (!(boundary instanceof HTMLElement)) return null;
    const routeList = boundary.closest(".travel-plan-route-list");
    const dayRows = travelPlanRouteDayRows(routeList);
    const boundaryKind = String(boundary.getAttribute("data-travel-plan-select-boundary") || "").trim();
    if (!dayRows.length) return null;
    if (boundaryKind === "arrival") return travelPlanRouteDropContextForRow(dayRows[0], "before");
    if (boundaryKind === "departure") return travelPlanRouteDropContextForRow(dayRows[dayRows.length - 1], "after");
    return null;
  }

  function travelPlanRouteEdgeDropContext(event) {
    const routeList = travelPlanRouteListElement();
    const target = event?.target;
    if (!(routeList instanceof HTMLElement) || !(target instanceof Element) || !routeList.contains(target)) return null;
    const dayRows = travelPlanRouteDayRows(routeList);
    if (!dayRows.length) return null;
    const y = Number(event?.clientY);
    const x = Number(event?.clientX);
    if (!Number.isFinite(y)) return null;
    const routeRect = routeList.getBoundingClientRect();
    if (Number.isFinite(x) && (x < routeRect.left - 8 || x > routeRect.right + 8)) return null;
    const firstRow = dayRows[0];
    const lastRow = dayRows[dayRows.length - 1];
    const firstRect = firstRow.getBoundingClientRect();
    const lastRect = lastRow.getBoundingClientRect();
    const edgePadding = Math.min(42, Math.max(22, Math.min(firstRect.height, lastRect.height) * 0.45));
    if (y <= firstRect.top + edgePadding) return travelPlanRouteDropContextForRow(firstRow, "before");
    if (y >= lastRect.bottom - edgePadding) return travelPlanRouteDropContextForRow(lastRow, "after");
    return null;
  }

  function travelPlanRouteDropContextFromTarget(target) {
    const placeholder = travelPlanRouteDropPlaceholderElementFromTarget(target);
    if (placeholder) {
      return {
        placeholder,
        row: null,
        targetDayId: String(placeholder.dataset.travelPlanRouteDropTargetDayId || "").trim(),
        placement: String(placeholder.dataset.travelPlanRouteDropPlacement || "").trim()
      };
    }
    const boundaryContext = travelPlanRouteBoundaryDropContextFromTarget(target);
    if (boundaryContext) return boundaryContext;
    const row = travelPlanRouteDayElementFromTarget(target);
    return travelPlanRouteDropContextForRow(row) || {
      placeholder: null,
      row: null,
      targetDayId: "",
      placement: ""
    };
  }

  function clearTravelPlanRouteDropState() {
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    els.travel_plan_editor.querySelector("[data-travel-plan-route-placeholder]")?.remove();
    clearTravelPlanRouteDropTargetRows();
  }

  function clearTravelPlanRouteDropTargetRows() {
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    els.travel_plan_editor.querySelectorAll(".travel-plan-route-list__item.is-drop-before, .travel-plan-route-list__item.is-drop-after, .travel-plan-route-list__item.is-drop-target").forEach((row) => {
      row.classList.remove("is-drop-before", "is-drop-after", "is-drop-target");
      delete row.dataset.travelPlanRouteDropPlacement;
    });
  }

  function clearTravelPlanRouteDeleteState() {
    travelPlanRouteDeleteActive = false;
    travelPlanRouteDragGhost?.classList?.remove("is-delete-target");
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    els.travel_plan_editor.querySelectorAll(".travel-plan-route-list__item.is-delete-target").forEach((row) => {
      row.classList.remove("is-delete-target");
    });
  }

  function clearTravelPlanRouteNativeDragImage() {
    travelPlanRouteNativeDragImage?.remove?.();
    travelPlanRouteNativeDragImage = null;
  }

  function clearTravelPlanRouteDragGhost() {
    travelPlanRouteDragGhost?.remove?.();
    travelPlanRouteDragGhost = null;
    travelPlanRouteDragOffset = { x: 0, y: 0 };
  }

  function clearTravelPlanRouteDragState() {
    if (els.travel_plan_editor instanceof HTMLElement) {
      els.travel_plan_editor.querySelectorAll(".travel-plan-route-list__item.is-dragging").forEach((row) => {
        row.classList.remove("is-dragging");
        row.setAttribute("aria-grabbed", "false");
      });
    }
    clearTravelPlanRouteDropState();
    clearTravelPlanRouteDeleteState();
    clearTravelPlanRouteDragGhost();
    clearTravelPlanRouteNativeDragImage();
    draggedTravelPlanRouteDayId = "";
  }

  function clearTravelPlanRouteDocumentListeners() {
    if (!travelPlanRouteDocumentListeners) return;
    const { ownerDocument, dragOverHandler, dropHandler } = travelPlanRouteDocumentListeners;
    ownerDocument?.removeEventListener?.("dragover", dragOverHandler);
    ownerDocument?.removeEventListener?.("drop", dropHandler);
    travelPlanRouteDocumentListeners = null;
  }

  function moveTravelPlanRouteDragGhost(event) {
    if (!(travelPlanRouteDragGhost instanceof HTMLElement) || !event) return;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    travelPlanRouteDragGhost.style.left = `${x - travelPlanRouteDragOffset.x}px`;
    travelPlanRouteDragGhost.style.top = `${y - travelPlanRouteDragOffset.y}px`;
  }

  function createTravelPlanRouteDragGhost(row, event) {
    if (!(row instanceof HTMLElement)) return;
    clearTravelPlanRouteDragGhost();
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) return;
    ghost.classList.remove("is-dragging", "is-drop-target", "has-warnings");
    ghost.classList.add("travel-plan-route-list__drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-travel-plan-select-day");
    ghost.removeAttribute("data-travel-plan-route-day");
    ghost.removeAttribute("draggable");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    travelPlanRouteDragOffset = {
      x: Number.isFinite(clientX) ? Math.max(0, clientX - rect.left) : rect.width / 2,
      y: Number.isFinite(clientY) ? Math.max(0, clientY - rect.top) : rect.height / 2
    };
    ghost.style.left = `${Number.isFinite(clientX) ? clientX - travelPlanRouteDragOffset.x : rect.left}px`;
    ghost.style.top = `${Number.isFinite(clientY) ? clientY - travelPlanRouteDragOffset.y : rect.top}px`;
    (row.ownerDocument?.body || document.body)?.appendChild(ghost);
    travelPlanRouteDragGhost = ghost;
    moveTravelPlanRouteDragGhost(event);
  }

  function hideNativeTravelPlanRouteDragImage(event, row) {
    if (!event?.dataTransfer || !(row instanceof HTMLElement)) return;
    try {
      clearTravelPlanRouteNativeDragImage();
      const ownerDocument = row.ownerDocument || document;
      const dragImage = ownerDocument.createElement("div");
      dragImage.setAttribute("aria-hidden", "true");
      dragImage.style.position = "fixed";
      dragImage.style.left = "-10000px";
      dragImage.style.top = "-10000px";
      dragImage.style.width = "1px";
      dragImage.style.height = "1px";
      dragImage.style.opacity = "0";
      dragImage.style.pointerEvents = "none";
      (ownerDocument.body || document.body)?.appendChild(dragImage);
      travelPlanRouteNativeDragImage = dragImage;
      event.dataTransfer.setDragImage(dragImage, 0, 0);
    } catch {
      clearTravelPlanRouteNativeDragImage();
      // Some browsers reject custom drag images; the fixed ghost still tracks the drag.
    }
  }

  function travelPlanRouteDeleteDistance(event, routeList) {
    if (!event || !(routeList instanceof HTMLElement)) return 0;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    const rect = routeList.getBoundingClientRect();
    return Math.max(
      rect.left - x,
      x - rect.right,
      rect.top - y,
      y - rect.bottom,
      0
    );
  }

  function updateTravelPlanRouteDeleteTarget(event) {
    const dayId = String(draggedTravelPlanRouteDayId || event?.dataTransfer?.getData("text/plain") || "").trim();
    const routeList = travelPlanRouteListElement();
    const sourceRow = travelPlanRouteDayElementById(dayId);
    moveTravelPlanRouteDragGhost(event);
    if (!dayId || !(routeList instanceof HTMLElement) || !(sourceRow instanceof HTMLElement)) {
      clearTravelPlanRouteDeleteState();
      return false;
    }
    const isDeleteTarget = travelPlanRouteDeleteDistance(event, routeList) >= TRAVEL_PLAN_ROUTE_DELETE_DISTANCE_PX;
    travelPlanRouteDeleteActive = isDeleteTarget;
    sourceRow.classList.remove("is-delete-target");
    travelPlanRouteDragGhost?.classList?.toggle("is-delete-target", isDeleteTarget);
    if (isDeleteTarget) clearTravelPlanRouteDropState();
    return isDeleteTarget;
  }

  function animateTravelPlanRouteDaySmokeDissolve(row, onComplete, { removeAfter = false } = {}) {
    if (!(row instanceof HTMLElement)) {
      onComplete?.();
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      if (removeAfter) row.remove();
      onComplete?.();
      return;
    }
    row.classList.remove("is-dragging", "is-delete-target");
    row.classList.add("is-smoke-dissolving");
    row.setAttribute("aria-grabbed", "false");
    appendTravelPlanRouteSmokePuffs(row);
    window.setTimeout(() => {
      if (removeAfter) row.remove();
      onComplete?.();
    }, TRAVEL_PLAN_ROUTE_SMOKE_ANIMATION_MS + 40);
  }

  function deleteDraggedTravelPlanRouteDay(dayId) {
    const normalizedDayId = String(dayId || "").trim();
    if (!normalizedDayId) {
      clearTravelPlanRouteDragState();
      return;
    }
    const row = travelPlanRouteDayElementById(normalizedDayId);
    const ghost = travelPlanRouteDragGhost;
    travelPlanRouteDragGhost = null;
    draggedTravelPlanRouteDayId = "";
    travelPlanRouteDeleteActive = false;
    clearTravelPlanRouteNativeDragImage();
    clearTravelPlanRouteDropState();
    suppressTravelPlanRouteClick();
    if (row instanceof HTMLElement) {
      row.classList.remove("is-delete-target");
      row.classList.add("is-delete-pending");
      row.setAttribute("aria-grabbed", "false");
    }
    const commitDelete = () => {
      if (!removeDay(normalizedDayId, { confirm: false }) && row instanceof HTMLElement) {
        row.classList.remove("is-delete-pending");
      }
    };
    if (ghost instanceof HTMLElement) {
      animateTravelPlanRouteDaySmokeDissolve(ghost, commitDelete, { removeAfter: true });
      return;
    }
    if (row instanceof HTMLElement) {
      commitDelete();
      return;
    }
    commitDelete();
  }

  function routeDropPlacement(event, row, currentPlacement = "") {
    const rect = row.getBoundingClientRect();
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return currentPlacement || "before";
    const midpoint = rect.top + rect.height / 2;
    const hysteresisPx = Math.min(18, Math.max(8, rect.height * 0.18));
    if (currentPlacement === "before" && y < midpoint + hysteresisPx) return "before";
    if (currentPlacement === "after" && y > midpoint - hysteresisPx) return "after";
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  function renderTravelPlanRouteDropPlaceholder(row, placement) {
    if (!(row instanceof HTMLElement)) return null;
    const routeList = row.closest(".travel-plan-route-list");
    const targetDayId = String(row.getAttribute("data-travel-plan-route-day") || "").trim();
    if (!(routeList instanceof HTMLElement) || !targetDayId) return null;
    const ownerDocument = routeList.ownerDocument || document;
    let placeholder = routeList.querySelector("[data-travel-plan-route-placeholder]");
    if (!(placeholder instanceof HTMLElement)) {
      placeholder = ownerDocument.createElement("div");
      placeholder.className = "travel-plan-route-list__drop-placeholder";
      placeholder.setAttribute("data-travel-plan-route-placeholder", "");
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.innerHTML = `
        <strong>${escapeHtml(travelPlanCustomizerLabels.moveHere)}</strong>
      `;
    }
    placeholder.dataset.travelPlanRouteDropTargetDayId = targetDayId;
    placeholder.dataset.travelPlanRouteDropPlacement = placement;
    clearTravelPlanRouteDropTargetRows();
    const referenceNode = placement === "after" ? row.nextSibling : row;
    if (placeholder !== referenceNode) {
      routeList.insertBefore(placeholder, referenceNode);
    }
    row.classList.add("is-drop-target");
    row.dataset.travelPlanRouteDropPlacement = placement;
    return placeholder;
  }

  function suppressTravelPlanRouteClick() {
    suppressTravelPlanRouteClickUntil = Date.now() + 250;
  }

  function handleTravelPlanRouteDragStart(event) {
    const row = travelPlanRouteDayElementFromTarget(event.target);
    const dayId = String(row?.getAttribute("data-travel-plan-route-day") || "").trim();
    if (!row || !dayId || state.permissions.canEditBooking !== true || !allowDayReorder) {
      event.preventDefault();
      return;
    }
    draggedTravelPlanRouteDayId = dayId;
    row.classList.add("is-dragging");
    row.setAttribute("aria-grabbed", "true");
    createTravelPlanRouteDragGhost(row, event);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dayId);
      hideNativeTravelPlanRouteDragImage(event, row);
    }
  }

  function handleTravelPlanRouteDragOver(event) {
    const sourceDayId = String(draggedTravelPlanRouteDayId || event.dataTransfer?.getData("text/plain") || "").trim();
    if (!sourceDayId) return;
    if (updateTravelPlanRouteDeleteTarget(event)) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      return;
    }
    let context = travelPlanRouteDropContextFromTarget(event.target);
    if (!context.placeholder && !context.row) {
      context = travelPlanRouteEdgeDropContext(event) || context;
    }
    if (context.placeholder && context.targetDayId && context.targetDayId !== sourceDayId) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      return;
    }
    const row = context.row;
    const targetDayId = context.targetDayId;
    if (!row || !targetDayId || targetDayId === sourceDayId) {
      clearTravelPlanRouteDropState();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const currentPlaceholder = els.travel_plan_editor?.querySelector?.("[data-travel-plan-route-placeholder]");
    const currentPlacement = currentPlaceholder instanceof HTMLElement
      && String(currentPlaceholder.dataset.travelPlanRouteDropTargetDayId || "").trim() === targetDayId
      ? String(currentPlaceholder.dataset.travelPlanRouteDropPlacement || "").trim()
      : "";
    const placement = context.placement || routeDropPlacement(event, row, currentPlacement);
    renderTravelPlanRouteDropPlaceholder(row, placement);
  }

  function handleTravelPlanRouteDrop(event) {
    let context = travelPlanRouteDropContextFromTarget(event.target);
    if (!context.targetDayId) {
      context = travelPlanRouteEdgeDropContext(event) || context;
    }
    const targetDayId = context.targetDayId;
    const sourceDayId = String(draggedTravelPlanRouteDayId || event.dataTransfer?.getData("text/plain") || "").trim();
    if (sourceDayId && (travelPlanRouteDeleteActive || updateTravelPlanRouteDeleteTarget(event))) {
      event.preventDefault();
      event.stopPropagation();
      deleteDraggedTravelPlanRouteDay(sourceDayId);
      return;
    }
    if (!sourceDayId || !targetDayId || sourceDayId === targetDayId) {
      if (sourceDayId) event.stopPropagation();
      clearTravelPlanRouteDragState();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const placement = context.placement || context.row?.dataset.travelPlanRouteDropPlacement || (context.row ? routeDropPlacement(event, context.row) : "before");
    clearTravelPlanRouteDragState();
    if (moveTravelPlanDayNearRouteTarget(sourceDayId, targetDayId, placement)) {
      suppressTravelPlanRouteClick();
    }
  }

  function handleTravelPlanRouteDocumentDragOver(event) {
    const sourceDayId = String(draggedTravelPlanRouteDayId || event.dataTransfer?.getData("text/plain") || "").trim();
    if (!sourceDayId) return;
    if (updateTravelPlanRouteDeleteTarget(event)) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      return;
    }
    const routeList = travelPlanRouteListElement();
    const isOutsideRouteList = !(routeList instanceof HTMLElement) || !(event.target instanceof Element) || !routeList.contains(event.target);
    if (isOutsideRouteList) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
      clearTravelPlanRouteDropState();
    }
  }

  function handleTravelPlanRouteDocumentDrop(event) {
    const sourceDayId = String(draggedTravelPlanRouteDayId || event.dataTransfer?.getData("text/plain") || "").trim();
    if (!sourceDayId) return;
    event.preventDefault();
    if (travelPlanRouteDeleteActive || updateTravelPlanRouteDeleteTarget(event)) {
      deleteDraggedTravelPlanRouteDay(sourceDayId);
      return;
    }
    clearTravelPlanRouteDragState();
  }

  function travelPlanServiceElementFromTarget(target) {
    const row = target instanceof Element ? target.closest("[data-travel-plan-service]") : null;
    return row instanceof HTMLElement ? row : null;
  }

  function travelPlanServiceDropPlaceholderElementFromTarget(target) {
    const placeholder = target instanceof Element ? target.closest("[data-travel-plan-service-placeholder]") : null;
    return placeholder instanceof HTMLElement ? placeholder : null;
  }

  function travelPlanServiceDropContextFromTarget(target) {
    const placeholder = travelPlanServiceDropPlaceholderElementFromTarget(target);
    if (placeholder) {
      return {
        placeholder,
        row: null,
        targetItemId: String(placeholder.dataset.travelPlanServiceDropTargetItemId || "").trim(),
        placement: String(placeholder.dataset.travelPlanServiceDropPlacement || "").trim()
      };
    }
    const row = travelPlanServiceElementFromTarget(target);
    return {
      placeholder: null,
      row,
      targetItemId: String(row?.getAttribute("data-travel-plan-service") || "").trim(),
      placement: ""
    };
  }

  function clearTravelPlanServiceDropState() {
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    els.travel_plan_editor.querySelector("[data-travel-plan-service-placeholder]")?.remove();
    clearTravelPlanServiceDropTargetRows();
  }

  function clearTravelPlanServiceDropTargetRows() {
    if (!(els.travel_plan_editor instanceof HTMLElement)) return;
    els.travel_plan_editor.querySelectorAll(".travel-plan-service.is-drop-target").forEach((row) => {
      row.classList.remove("is-drop-target");
      delete row.dataset.travelPlanServiceDropPlacement;
    });
  }

  function clearTravelPlanServiceNativeDragImage() {
    travelPlanServiceNativeDragImage?.remove?.();
    travelPlanServiceNativeDragImage = null;
  }

  function clearTravelPlanServiceDragGhost() {
    travelPlanServiceDragGhost?.remove?.();
    travelPlanServiceDragGhost = null;
    travelPlanServiceDragOffset = { x: 0, y: 0 };
  }

  function clearTravelPlanServiceDragState() {
    if (els.travel_plan_editor instanceof HTMLElement) {
      els.travel_plan_editor.querySelectorAll(".travel-plan-service.is-dragging").forEach((row) => {
        row.classList.remove("is-dragging");
        row.setAttribute("aria-grabbed", "false");
      });
    }
    clearTravelPlanServiceDropState();
    clearTravelPlanServiceDragGhost();
    clearTravelPlanServiceNativeDragImage();
    draggedTravelPlanServiceItemId = "";
  }

  function moveTravelPlanServiceDragGhost(event) {
    if (!(travelPlanServiceDragGhost instanceof HTMLElement) || !event) return;
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    travelPlanServiceDragGhost.style.left = `${x - travelPlanServiceDragOffset.x}px`;
    travelPlanServiceDragGhost.style.top = `${y - travelPlanServiceDragOffset.y}px`;
  }

  function createTravelPlanServiceDragGhost(row, event) {
    if (!(row instanceof HTMLElement)) return;
    clearTravelPlanServiceDragGhost();
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) return;
    ghost.classList.remove("is-dragging", "is-drop-target");
    ghost.classList.add("travel-plan-service__drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-travel-plan-service");
    ghost.removeAttribute("draggable");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    travelPlanServiceDragOffset = {
      x: Number.isFinite(clientX) ? Math.max(0, clientX - rect.left) : rect.width / 2,
      y: Number.isFinite(clientY) ? Math.max(0, clientY - rect.top) : rect.height / 2
    };
    ghost.style.left = `${Number.isFinite(clientX) ? clientX - travelPlanServiceDragOffset.x : rect.left}px`;
    ghost.style.top = `${Number.isFinite(clientY) ? clientY - travelPlanServiceDragOffset.y : rect.top}px`;
    (row.ownerDocument?.body || document.body)?.appendChild(ghost);
    travelPlanServiceDragGhost = ghost;
    moveTravelPlanServiceDragGhost(event);
  }

  function hideNativeTravelPlanServiceDragImage(event, row) {
    if (!event?.dataTransfer || !(row instanceof HTMLElement)) return;
    try {
      clearTravelPlanServiceNativeDragImage();
      const ownerDocument = row.ownerDocument || document;
      const dragImage = ownerDocument.createElement("div");
      dragImage.setAttribute("aria-hidden", "true");
      dragImage.style.position = "fixed";
      dragImage.style.left = "-10000px";
      dragImage.style.top = "-10000px";
      dragImage.style.width = "1px";
      dragImage.style.height = "1px";
      dragImage.style.opacity = "0";
      dragImage.style.pointerEvents = "none";
      (ownerDocument.body || document.body)?.appendChild(dragImage);
      travelPlanServiceNativeDragImage = dragImage;
      event.dataTransfer.setDragImage(dragImage, 0, 0);
    } catch {
      clearTravelPlanServiceNativeDragImage();
    }
  }

  function travelPlanServiceDragShouldIgnoreTarget(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest("[data-travel-plan-service-drag-handle]")) return false;
    return Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true']"));
  }

  function serviceDropPlacement(event, row, currentPlacement = "") {
    const rect = row.getBoundingClientRect();
    const y = Number(event?.clientY);
    if (!Number.isFinite(y)) return currentPlacement || "before";
    const midpoint = rect.top + rect.height / 2;
    const hysteresisPx = Math.min(22, Math.max(10, rect.height * 0.18));
    if (currentPlacement === "before" && y < midpoint + hysteresisPx) return "before";
    if (currentPlacement === "after" && y > midpoint - hysteresisPx) return "after";
    return y > midpoint ? "after" : "before";
  }

  function renderTravelPlanServiceDropPlaceholder(row, placement) {
    if (!(row instanceof HTMLElement)) return null;
    const servicesList = row.closest(".travel-plan-day__services");
    const targetItemId = String(row.getAttribute("data-travel-plan-service") || "").trim();
    if (!(servicesList instanceof HTMLElement) || !targetItemId) return null;
    const ownerDocument = servicesList.ownerDocument || document;
    let placeholder = servicesList.querySelector("[data-travel-plan-service-placeholder]");
    if (!(placeholder instanceof HTMLElement)) {
      placeholder = ownerDocument.createElement("div");
      placeholder.className = "travel-plan-service__drop-placeholder";
      placeholder.setAttribute("data-travel-plan-service-placeholder", "");
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.innerHTML = `<strong>${escapeHtml(travelPlanCustomizerLabels.moveHere)}</strong>`;
    }
    placeholder.dataset.travelPlanServiceDropTargetItemId = targetItemId;
    placeholder.dataset.travelPlanServiceDropPlacement = placement;
    clearTravelPlanServiceDropTargetRows();
    const referenceNode = placement === "after" ? row.nextSibling : row;
    if (placeholder !== referenceNode) {
      servicesList.insertBefore(placeholder, referenceNode);
    }
    row.classList.add("is-drop-target");
    row.dataset.travelPlanServiceDropPlacement = placement;
    return placeholder;
  }

  function moveTravelPlanServiceNearTarget(sourceItemId, targetItemId, placement = "before") {
    const normalizedSourceItemId = String(sourceItemId || "").trim();
    const normalizedTargetItemId = String(targetItemId || "").trim();
    if (!normalizedSourceItemId || !normalizedTargetItemId || normalizedSourceItemId === normalizedTargetItemId) return false;
    syncTravelPlanDraftFromDom();
    const days = Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [];
    let sourceDay = null;
    let targetDay = null;
    let sourceIndex = -1;
    let targetIndex = -1;
    for (const day of days) {
      const services = Array.isArray(day.services) ? day.services : [];
      if (sourceIndex < 0) {
        const index = services.findIndex((item) => item?.id === normalizedSourceItemId);
        if (index >= 0) {
          sourceDay = day;
          sourceIndex = index;
        }
      }
      if (targetIndex < 0) {
        const index = services.findIndex((item) => item?.id === normalizedTargetItemId);
        if (index >= 0) {
          targetDay = day;
          targetIndex = index;
        }
      }
    }
    if (!sourceDay || !targetDay || sourceIndex < 0 || targetIndex < 0) return false;
    sourceDay.services = Array.isArray(sourceDay.services) ? sourceDay.services : [];
    targetDay.services = Array.isArray(targetDay.services) ? targetDay.services : [];
    const [item] = sourceDay.services.splice(sourceIndex, 1);
    let insertIndex = targetIndex;
    if (sourceDay === targetDay && sourceIndex < targetIndex) insertIndex -= 1;
    if (placement === "after") insertIndex += 1;
    targetDay.services.splice(Math.max(0, Math.min(insertIndex, targetDay.services.length)), 0, item);
    renderTravelPlanPanel();
    renderOfferPanel?.();
    return true;
  }

  function handleTravelPlanServiceDragStart(event) {
    const row = travelPlanServiceElementFromTarget(event.target);
    const itemId = String(row?.getAttribute("data-travel-plan-service") || "").trim();
    if (!row || !itemId || state.permissions.canEditBooking !== true || !allowEditableServices || travelPlanServiceDragShouldIgnoreTarget(event.target)) {
      event.preventDefault();
      return false;
    }
    draggedTravelPlanServiceItemId = itemId;
    row.classList.add("is-dragging");
    row.setAttribute("aria-grabbed", "true");
    createTravelPlanServiceDragGhost(row, event);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-travel-plan-service-id", itemId);
      hideNativeTravelPlanServiceDragImage(event, row);
    }
    return true;
  }

  function handleTravelPlanServiceDragOver(event) {
    const sourceItemId = String(draggedTravelPlanServiceItemId || event.dataTransfer?.getData("application/x-travel-plan-service-id") || "").trim();
    if (!sourceItemId) return false;
    moveTravelPlanServiceDragGhost(event);
    const context = travelPlanServiceDropContextFromTarget(event.target);
    if (context.placeholder && context.targetItemId && context.targetItemId !== sourceItemId) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      return true;
    }
    const row = context.row;
    const targetItemId = context.targetItemId;
    if (!row || !targetItemId || targetItemId === sourceItemId) {
      clearTravelPlanServiceDropState();
      return true;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const currentPlaceholder = els.travel_plan_editor?.querySelector?.("[data-travel-plan-service-placeholder]");
    const currentPlacement = currentPlaceholder instanceof HTMLElement
      && String(currentPlaceholder.dataset.travelPlanServiceDropTargetItemId || "").trim() === targetItemId
      ? String(currentPlaceholder.dataset.travelPlanServiceDropPlacement || "").trim()
      : "";
    const placement = serviceDropPlacement(event, row, currentPlacement);
    renderTravelPlanServiceDropPlaceholder(row, placement);
    return true;
  }

  function handleTravelPlanServiceDrop(event) {
    const context = travelPlanServiceDropContextFromTarget(event.target);
    const sourceItemId = String(draggedTravelPlanServiceItemId || event.dataTransfer?.getData("application/x-travel-plan-service-id") || "").trim();
    const targetItemId = context.targetItemId;
    if (!sourceItemId) return false;
    if (!targetItemId || sourceItemId === targetItemId) {
      event.stopPropagation();
      clearTravelPlanServiceDragState();
      return true;
    }
    event.preventDefault();
    event.stopPropagation();
    const placement = context.placement || context.row?.dataset.travelPlanServiceDropPlacement || (context.row ? serviceDropPlacement(event, context.row) : "before");
    clearTravelPlanServiceDragState();
    moveTravelPlanServiceNearTarget(sourceItemId, targetItemId, placement);
    return true;
  }

  function handleTravelPlanServiceDocumentDragOver(event) {
    const sourceItemId = String(draggedTravelPlanServiceItemId || event.dataTransfer?.getData("application/x-travel-plan-service-id") || "").trim();
    if (!sourceItemId) return false;
    moveTravelPlanServiceDragGhost(event);
    const servicesList = event.target instanceof Element ? event.target.closest(".travel-plan-day__services") : null;
    if (!(servicesList instanceof HTMLElement)) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
      clearTravelPlanServiceDropState();
    }
    return true;
  }

  function handleTravelPlanServiceDocumentDrop(event) {
    const sourceItemId = String(draggedTravelPlanServiceItemId || event.dataTransfer?.getData("application/x-travel-plan-service-id") || "").trim();
    if (!sourceItemId) return false;
    event.preventDefault();
    clearTravelPlanServiceDragState();
    return true;
  }

  function handleTravelPlanEditorDragStart(event) {
    if (travelPlanServiceElementFromTarget(event.target)) {
      handleTravelPlanServiceDragStart(event);
      return;
    }
    handleTravelPlanRouteDragStart(event);
  }

  function handleTravelPlanEditorDragOver(event) {
    if (draggedTravelPlanServiceItemId) {
      handleTravelPlanServiceDragOver(event);
      return;
    }
    handleTravelPlanRouteDragOver(event);
  }

  function handleTravelPlanEditorDrop(event) {
    if (draggedTravelPlanServiceItemId) {
      handleTravelPlanServiceDrop(event);
      return;
    }
    handleTravelPlanRouteDrop(event);
  }

  function handleTravelPlanEditorDragEnd() {
    clearTravelPlanServiceDragState();
    clearTravelPlanRouteDragState();
  }

  function handleTravelPlanEditorDocumentDragOver(event) {
    if (draggedTravelPlanServiceItemId) {
      handleTravelPlanServiceDocumentDragOver(event);
      return;
    }
    handleTravelPlanRouteDocumentDragOver(event);
  }

  function handleTravelPlanEditorDocumentDrop(event) {
    if (draggedTravelPlanServiceItemId) {
      handleTravelPlanServiceDocumentDrop(event);
      return;
    }
    handleTravelPlanRouteDocumentDrop(event);
  }

  function addItem(dayId) {
    if (!allowEditableServices || state.permissions.canEditBooking !== true) return;
    syncTravelPlanDraftFromDom();
    const dayIndex = findDayIndex(dayId);
    if (dayIndex < 0) return;
    const day = state.travelPlanDraft.days[dayIndex];
    day.services = Array.isArray(day.services) ? day.services : [];
    day.services.push(createEmptyTravelPlanService());
    renderTravelPlanPanel();
  }

  function removeItem(itemId) {
    if (!allowEditableServices || state.permissions.canEditBooking !== true) return;
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
    if (!allowEditableServices || state.permissions.canEditBooking !== true) return;
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

  function previewBookingTravelPlanPdf({
    pdfType = "travel-plan",
    previewTitle = bookingT("booking.travel_plan.preview_pdf", "Preview PDF"),
    loadingMessage = bookingT("booking.travel_plan.generating_pdf_overlay", "Generating travel plan PDF. Please wait.")
  } = {}) {
    if (!state.booking?.id) return;
    if (hasUnsavedBookingChanges?.() || state.pageSaveInFlight || state.pageDiscardInFlight) {
      travelPlanStatus(bookingT("booking.action_requires_save", "Save edits to enable."), "info");
      return;
    }
    const requestQuery = {
      ...bookingLanguageQuery(),
      ...(pdfType === "one-pager" ? { pdf: "one-pager" } : {})
    };
    const request = typeof buildTravelPlanPdfPreviewRequest === "function"
      ? buildTravelPlanPdfPreviewRequest({
          apiOrigin,
          state,
          pdfType,
          contentLang: bookingContentLang(),
          sourceLang: bookingSourceLang(),
          query: requestQuery
        })
      : bookingTravelPlanPdfRequest({
          baseURL: apiOrigin,
          params: { booking_id: state.booking.id },
          query: requestQuery
        });
    if (!request?.url) return;
    const previewUrl = new URL(request.url, window.location.origin);
    previewUrl.searchParams.set("preview", "1");
    previewUrl.searchParams.set("_", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const previewErrorMessage = pdfType === "one-pager"
      ? bookingT("booking.travel_plan.preview_one_pager_pdf_failed", "Could not preview the one-pager PDF.")
      : bookingT("booking.travel_plan.preview_pdf_failed", "Could not preview the travel plan PDF.");
    void fetchAndShowPdfPreview({
      url: previewUrl.toString(),
      title: previewTitle,
      loadingMessage,
      errorMessage: previewErrorMessage,
      escapeHtml,
      onPopupBlocked: () => {
        travelPlanStatus(bookingT("booking.travel_plan.preview_popup_blocked", "Allow pop-ups to preview the PDF."), "error");
      },
      onError: (error) => {
        logBrowserConsoleError("[travel-plan] Failed to preview PDF.", {
          booking_id: state.booking?.id || "",
          pdf_type: pdfType
        }, error);
        travelPlanStatus(error?.message || previewErrorMessage, "error");
      }
    });
  }

  function previewTravelPlanPdf() {
    previewBookingTravelPlanPdf({
      pdfType: "travel-plan",
      previewTitle: bookingT("booking.travel_plan.preview_travel_plan_pdf", "Preview Travel Plan PDF")
    });
  }

  function previewOnePagerPdf() {
    previewBookingTravelPlanPdf({
      pdfType: "one-pager",
      previewTitle: bookingT("booking.travel_plan.preview_one_pager_pdf", "Preview one-pager PDF"),
      loadingMessage: bookingT("booking.travel_plan.generating_one_pager_pdf_overlay", "Generating one-pager PDF. Please wait.")
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
    if (!recalculateTravelPlanDayDates()) clearTravelPlanDerivedDayDates();
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
      const request = typeof buildTravelPlanSaveRequest === "function"
        ? buildTravelPlanSaveRequest({
            apiOrigin,
            state,
            travelPlanPayload,
            expectedTravelPlanRevision,
            contentLang: bookingContentLang(),
            sourceLang: bookingSourceLang(),
            getBookingRevision
          })
        : bookingTravelPlanRequest({
            baseURL: apiOrigin,
            params: { booking_id: state.booking.id },
            body: {
              expected_travel_plan_revision: expectedTravelPlanRevision,
              travel_plan: travelPlanPayload,
              content_lang: bookingContentLang(),
              source_lang: bookingSourceLang()
            },
            query: bookingLanguageQuery()
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
      applyBookingPayload({ preserveCollapsedState: true });
      renderTravelPlanPanel();
      refreshActivitiesInBackground("travel_plan_save");
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

  function collectTravelPlanPayload({
    focusFirstInvalid = true,
    pruneEmptyContent = pruneEmptyTravelPlanContentOnCollect
  } = {}) {
    const dateFieldValidation = validateTravelPlanDateFieldsInDom({ allowPartial: false, focusFirstInvalid });
    if (!dateFieldValidation.ok) {
      return {
        ok: false,
        error: dateFieldValidation.message || bookingT("booking.travel_plan.invalid_date", "Please fix the invalid date.")
      };
    }
    syncTravelPlanDraftFromDom();
    if (!recalculateTravelPlanDayDates()) clearTravelPlanDerivedDayDates();
    const travelPlanPayload = buildTravelPlanPayload(state.travelPlanDraft, { pruneEmptyContent });
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
        targetLang: destinationLang,
        translationProfile: "customer_travel_plan"
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
        translation_profile: "customer_travel_plan",
        actor: state.user || "keycloak_user"
      }
    });

    travelPlanStatus(translationBusyText(travelPlanSectionLabel(), status.source_lang || bookingSourceLang()), "loading");
    if (els.travel_plan_translate_all_btn instanceof HTMLButtonElement) {
      els.travel_plan_translate_all_btn.disabled = true;
    }
    const configuredTranslator = await loadConfiguredTranslationProviderDisplay();
    const overlayStartedAt = Date.now();
    setTravelPlanTranslationOverlay(true, travelPlanReviewOverlayMessage(bookingContentLang(), configuredTranslator));

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
      await waitForMinimumElapsed(overlayStartedAt, MIN_TRAVEL_PLAN_TRANSLATION_OVERLAY_MS);
      setTravelPlanTranslationOverlay(false);
      syncTravelPlanTranslateButton();
    }
  }

  const TRAVEL_PLAN_REVIEW_SOURCE_LANG = "en";
  const TRAVEL_PLAN_REVIEW_TRANSLATION_BATCH_SIZE = 12;
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

  function rememberTranslationProviderDisplay(translationProvider) {
    const display = normalizeReviewText(
      translationProvider?.display
      || translationProvider?.model
      || translationProvider?.provider
    );
    if (!display) return normalizeReviewText(configuredTranslationProviderDisplay);
    configuredTranslationProviderDisplay = display;
    return configuredTranslationProviderDisplay;
  }

  async function loadConfiguredTranslationProviderDisplay() {
    if (normalizeReviewText(configuredTranslationProviderDisplay)) {
      return configuredTranslationProviderDisplay;
    }
    if (!configuredTranslationProviderDisplayPromise) {
      configuredTranslationProviderDisplayPromise = (async () => {
        const payload = await fetchApiJson("/health", {
          apiBase: apiOrigin,
          method: "GET",
          cache: "no-store"
        });
        return rememberTranslationProviderDisplay({
          display: payload?.translation?.display || payload?.translation?.provider
        });
      })().finally(() => {
        configuredTranslationProviderDisplayPromise = null;
      });
    }
    return normalizeReviewText(await configuredTranslationProviderDisplayPromise);
  }

  function partitionReviewFields(fields, batchSize) {
    const normalizedFields = Array.isArray(fields) ? fields : [];
    const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);
    const batches = [];
    for (let start = 0; start < normalizedFields.length; start += normalizedBatchSize) {
      batches.push(normalizedFields.slice(start, start + normalizedBatchSize));
    }
    return batches;
  }

  function travelPlanReviewOverlayMessage(targetLang, translator = "") {
    if (!normalizeReviewText(targetLang)) {
      return bookingT("booking.translation.translating_customer_content_overlay", "Translating customer-facing content. Please wait.");
    }
    const normalizedTranslator = normalizeReviewText(translator);
    if (!normalizedTranslator) {
      return bookingT("booking.translation.translating_customer_content_overlay", "Translating customer-facing content. Please wait.");
    }
    return bookingT(
      "booking.translation.translating_current_overlay",
      "Translating {language} using {translator}. Please wait.",
      {
        language: bookingContentLanguageOption(targetLang).label,
        translator: normalizedTranslator
      }
    );
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

    const boundaryLogistics = plan?.boundary_logistics && typeof plan.boundary_logistics === "object" && !Array.isArray(plan.boundary_logistics)
      ? plan.boundary_logistics
      : {};
    ["arrival", "departure"].forEach((boundaryKind) => {
      const service = boundaryLogistics[boundaryKind];
      if (!service || typeof service !== "object" || Array.isArray(service)) return;
      const serviceLabel = boundaryLabel(boundaryKind);
      addField({
        holder: service,
        mapField: "time_i18n",
        plainField: "time",
        key: `travel_plan.boundary.${boundaryKind}.time`,
        label: `${serviceLabel} · ${bookingT("booking.travel_plan.time", "Time")}`
      });
      addField({
        holder: service,
        mapField: "title_i18n",
        plainField: "title",
        key: `travel_plan.boundary.${boundaryKind}.title`,
        label: `${serviceLabel} · ${boundaryTitleLabel(boundaryKind)}`
      });
      if (allowServiceDetails) {
        addField({
          holder: service,
          mapField: "details_i18n",
          plainField: "details",
          key: `travel_plan.boundary.${boundaryKind}.details`,
          label: `${serviceLabel} · ${boundaryDetailsLabel(boundaryKind)}`
        });
      }
    });

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
        mapField: "notes_i18n",
        plainField: "notes",
        key: `travel_plan.${dayId}.notes`,
        label: `${dayLabel} · ${bookingT("booking.travel_plan.day_notes", "Details")}`
      });

      const services = Array.isArray(day?.services) ? day.services : [];
      services.forEach((service, serviceIndex) => {
        const serviceId = normalizeReviewText(service?.id) || `service_${dayIndex + 1}_${serviceIndex + 1}`;
        const serviceLabel = `${dayLabel} · ${bookingT("booking.travel_plan.service_label", "Service")} ${serviceIndex + 1}`;
        addField({
          holder: service,
          mapField: "time_i18n",
          plainField: "time",
          key: `travel_plan.${dayId}.${serviceId}.time`,
          label: `${serviceLabel} · ${bookingT("booking.travel_plan.time", "Time")}`
        });
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
            label: `${serviceLabel} · ${bookingT("booking.travel_plan.item_notes", "Detail")}`
          });
        }
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

  function syncTravelPlanTranslationReviewActions(summary = null, sourceFields = null) {
    const panel = els.travel_plan_translation_panel;
    if (!(panel instanceof HTMLElement)) return;
    const targetLang = currentTravelPlanReviewTargetLang();
    if (targetLang === TRAVEL_PLAN_REVIEW_SOURCE_LANG) return;
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    const fields = Array.isArray(sourceFields)
      ? sourceFields
      : collectBookingTranslationReviewFields(plan, targetLang);
    const reviewSummary = summary || bookingTranslationReviewStatus(fields);
    const hasSourceFields = fields.length > 0;
    const needsTranslation = isTranslationIncompleteStatus(reviewSummary.status);
    const canTranslateMissing = state.permissions.canEditBooking && hasSourceFields && needsTranslation;
    const missingButton = panel.querySelector("[data-travel-plan-review-translate-missing]");
    if (missingButton instanceof HTMLButtonElement) {
      missingButton.disabled = !canTranslateMissing;
      missingButton.dataset.translationReviewDirty = needsTranslation ? "true" : "false";
      if (!hasSourceFields) {
        missingButton.title = bookingT("booking.translation.no_customer_content_source", "Add English travel-plan or PDF text before translating.");
      } else if (!needsTranslation) {
        missingButton.title = travelPlanReviewStatusLabel(reviewSummary.status);
      } else {
        missingButton.removeAttribute("title");
      }
    }
    const translateAllButton = panel.querySelector("[data-travel-plan-review-translate-all]");
    if (translateAllButton instanceof HTMLButtonElement) {
      translateAllButton.disabled = !(state.permissions.canEditBooking && hasSourceFields);
    }
    setTravelPlanTranslationSummaryState(needsTranslation);
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
            <textregion
              class="booking-text-field tour-travel-plan-translation__target"
              rows="2"
              data-booking-translation-review-key="${escapeHtml(field.key)}"
              data-booking-translation-review-lang="${escapeHtml(targetLang)}"
              ${state.permissions.canEditBooking ? "" : "disabled"}
            >${escapeHtml(field.targetText)}</textregion>
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
    const canTranslateMissing = canTranslate && isTranslationIncompleteStatus(summary.status);
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
          <button class="btn btn-primary" type="button" data-travel-plan-review-translate-missing data-translation-review-dirty="${isTranslationIncompleteStatus(summary.status) ? "true" : "false"}" ${canTranslateMissing ? "" : "disabled"}>
            ${escapeHtml(bookingT("tour.travel_plan_translation.translate_missing", "Translate"))}
          </button>
          <button class="btn btn-ghost" type="button" data-travel-plan-review-translate-all ${canTranslate ? "" : "disabled"}>
            ${escapeHtml(bookingT("tour.travel_plan_translation.translate_all", "Delete all translations and translate"))}
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
    syncTravelPlanTranslationReviewActions(summary, sourceFields);
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
    else syncTravelPlanTranslationReviewActions();
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
    else syncTravelPlanTranslationReviewActions();
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
    if (!fields.length) {
      travelPlanStatus(bookingT("booking.translation.no_customer_content_source", "Add English travel-plan or PDF text before translating."), "info");
      return;
    }

    travelPlanStatus(bookingT("booking.translation.translating_customer_content", "Translating customer-facing content..."), "loading");
    const fieldBatches = partitionReviewFields(fields, TRAVEL_PLAN_REVIEW_TRANSLATION_BATCH_SIZE);
    const configuredTranslator = await loadConfiguredTranslationProviderDisplay();
    const overlayStartedAt = Date.now();
    setTravelPlanTranslationOverlay(true, travelPlanReviewOverlayMessage(targetLang, configuredTranslator));
    try {
      for (const fieldBatch of fieldBatches) {
        setTravelPlanTranslationOverlay(
          true,
          travelPlanReviewOverlayMessage(targetLang, normalizeReviewText(configuredTranslationProviderDisplay) || configuredTranslator)
        );
        const translationResult = await requestBookingFieldTranslation({
          bookingId: state.booking.id,
          entries: Object.fromEntries(fieldBatch.map((field) => [field.key, field.sourceText])),
          fetchBookingMutation,
          apiBase: apiOrigin,
          actor: state.user || "keycloak_user",
          sourceLang: TRAVEL_PLAN_REVIEW_SOURCE_LANG,
          targetLang,
          translationProfile: "customer_travel_plan",
          includeMeta: true
        });
        const translatedEntries = translationResult?.entries || null;
        rememberTranslationProviderDisplay(translationResult?.translationProvider);
        if (!translatedEntries) continue;
        applyTravelPlanReviewTranslations(plan, targetLang, translatedEntries, "machine");
        applyPdfReviewTranslations(fieldBatch, targetLang, translatedEntries);
      }
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
      await waitForMinimumElapsed(overlayStartedAt, MIN_TRAVEL_PLAN_TRANSLATION_OVERLAY_MS);
      setTravelPlanTranslationOverlay(false);
    }
  }

  function bindEvents() {
    if (!travelPlanEventController && typeof AbortController !== "undefined") {
      travelPlanEventController = new AbortController();
    }
    const eventOptions = travelPlanEventController
      ? { signal: travelPlanEventController.signal }
      : undefined;
    if (els.travel_plan_editor && els.travel_plan_editor.dataset.travelPlanBound !== "true") {
      els.travel_plan_editor.addEventListener("input", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: true });
        }
        const isTravelPlanDayDateInput = Boolean(target?.matches?.('[data-travel-plan-day-field="date"]'));
        syncTravelPlanDraftFromDom();
        const hasValidFirstDayDate = isValidIsoCalendarDate(state.travelPlanDraft?.days?.[0]?.date);
        if (isTravelPlanDayDateInput && hasValidFirstDayDate && recalculateTravelPlanDayDates()) {
          refreshTravelPlanRouteDayRows();
        } else if (isTravelPlanDayDateInput && !hasValidFirstDayDate && clearTravelPlanDerivedDayDates()) {
          refreshTravelPlanRouteDayRows();
        }
        if (isTravelPlanDayDateInput) {
          refreshTravelPlanRouteBoundaryRows();
        }
        refreshTravelPlanRouteDayRowForTarget(target);
        if (target?.matches?.('[data-travel-plan-boundary-field="title"], [data-travel-plan-boundary-field="time"]')) {
          refreshTravelPlanRouteBoundaryRow(target.closest("[data-travel-plan-boundary]")?.getAttribute("data-travel-plan-boundary"));
        }
        refreshTravelPlanVisibleHeadCopy(target);
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        renderTravelPlanTranslationPanel();
      }, eventOptions);
      els.travel_plan_editor.addEventListener("change", (event) => {
        let target = event.target;
        if (target?.matches?.("[data-travel-plan-date-picker-for]")) {
          target = applyTravelPlanDatePickerValue(target) || target;
        }
        const isTravelPlanBoundaryAirportSelect = Boolean(target?.matches?.("[data-travel-plan-boundary-airport-select]"));
        if (isTravelPlanBoundaryAirportSelect) {
          applyTravelPlanBoundaryAirportSelection(target);
        }
        const isTravelPlanBoundaryPlacementSelect = Boolean(target?.matches?.('[data-travel-plan-boundary-field="placement"]'));
        if (isTravelPlanBoundaryPlacementSelect) {
          applyTravelPlanBoundaryPlacementSelection(target);
        }
        const isTravelPlanDayDateInput = Boolean(target?.matches?.('[data-travel-plan-day-field="date"]'));
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
        syncTravelPlanDraftFromDom();
        const hasValidFirstDayDate = isValidIsoCalendarDate(state.travelPlanDraft?.days?.[0]?.date);
        if (isTravelPlanDayDateInput && hasValidFirstDayDate && recalculateTravelPlanDayDatesAndRender()) {
          return;
        }
        if (
          isTravelPlanDayDateInput
          && !hasValidFirstDayDate
          && clearTravelPlanDerivedDayDates()
        ) {
          renderTravelPlanPanel();
          renderOfferPanel?.();
          return;
        }
        refreshTravelPlanRouteDayRowForTarget(target);
        refreshTravelPlanVisibleHeadCopy(target);
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        renderTravelPlanTranslationPanel();
        const shouldRerender = Boolean(
          isTravelPlanBoundaryPlacementSelect
          || isTravelPlanBoundaryAirportSelect
          || target?.matches?.('[data-travel-plan-service-field="kind"]')
          || target?.matches?.("[data-travel-plan-day-location-field]")
          || target?.matches?.("[data-destination-scope-destination]")
          || target?.matches?.("[data-destination-scope-country-place]")
          || target?.matches?.("[data-destination-scope-region]")
        );
        if (shouldRerender) {
          renderTravelPlanPanel();
        }
      }, eventOptions);
      els.travel_plan_editor.addEventListener("click", (event) => {
        const customizerTrigger = event.target instanceof Element
          ? event.target.closest("[data-travel-plan-open-customizer]")
          : null;
        if (customizerTrigger) {
          event.preventDefault();
          openTravelPlanCustomizerOverlay();
          return;
        }
        const dayToggleRegion = resolveTravelPlanToggleRegion(event.target, "[data-travel-plan-toggle-day-region]");
        if (dayToggleRegion) {
          toggleTravelPlanDayCollapsed(dayToggleRegion.getAttribute("data-travel-plan-toggle-day-region"));
          return;
        }
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-travel-plan-preview-one-pager-pdf")) {
          previewOnePagerPdf();
          return;
        }
        if (button.hasAttribute("data-travel-plan-preview-pdf")) {
          previewTravelPlanPdf();
          return;
        }
        if (button.hasAttribute("data-destination-scope-add-region")) {
          void createDestinationScopeRegion(button.getAttribute("data-destination-scope-add-region"));
          return;
        }
        if (button.hasAttribute("data-destination-scope-add-place")) {
          void createDestinationScopePlace(button.getAttribute("data-destination-scope-add-place"));
          return;
        }
        if (button.hasAttribute("data-destination-scope-add-country-place")) {
          void createDestinationScopePlace("", button.getAttribute("data-destination-scope-add-country-place"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-select-day")) {
          if (Date.now() < suppressTravelPlanRouteClickUntil) {
            event.preventDefault();
            return;
          }
          selectFocusedTravelPlanDay(button.getAttribute("data-travel-plan-select-day"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-select-boundary")) {
          selectFocusedTravelPlanBoundary(button.getAttribute("data-travel-plan-select-boundary"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-close-customizer")) {
          closeTravelPlanCustomizerOverlay();
          return;
        }
        if (button.hasAttribute("data-travel-plan-add-day")) {
          addDay();
          return;
        }
        if (button.hasAttribute("data-travel-plan-toggle-day")) {
          toggleTravelPlanDayCollapsed(button.getAttribute("data-travel-plan-toggle-day"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-remove-day")) {
          removeDay(button.getAttribute("data-travel-plan-remove-day"));
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
        if (button.hasAttribute("data-travel-plan-open-tour-import")) {
          travelPlanServiceLibraryModule.openTourLibrary();
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
      }, eventOptions);
      els.travel_plan_editor.addEventListener("dragstart", handleTravelPlanEditorDragStart, eventOptions);
      els.travel_plan_editor.addEventListener("dragover", handleTravelPlanEditorDragOver, eventOptions);
      els.travel_plan_editor.addEventListener("drop", handleTravelPlanEditorDrop, eventOptions);
      els.travel_plan_editor.addEventListener("dragend", handleTravelPlanEditorDragEnd, eventOptions);
      const travelPlanEditorDocument = els.travel_plan_editor.ownerDocument || document;
      travelPlanEditorDocument.addEventListener("dragover", handleTravelPlanEditorDocumentDragOver, eventOptions);
      travelPlanEditorDocument.addEventListener("drop", handleTravelPlanEditorDocumentDrop, eventOptions);
      travelPlanRouteDocumentListeners = {
        ownerDocument: travelPlanEditorDocument,
        dragOverHandler: handleTravelPlanEditorDocumentDragOver,
        dropHandler: handleTravelPlanEditorDocumentDrop
      };
      els.travel_plan_editor.addEventListener("focusout", (event) => {
        const target = event.target;
        if (target?.matches?.('[data-travel-plan-date-text="true"]')) {
          validateTravelPlanDateTextInput(target, { allowPartial: false });
        }
      }, eventOptions);
      els.travel_plan_editor.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && travelPlanCustomizerOverlayOpen) {
          event.preventDefault();
          closeTravelPlanCustomizerOverlay();
          return;
        }
        const customizerTrigger = event.target instanceof Element
          ? event.target.closest("[data-travel-plan-open-customizer]")
          : null;
        if (!customizerTrigger || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        openTravelPlanCustomizerOverlay();
      }, eventOptions);
      els.travel_plan_editor.dataset.travelPlanBound = "true";
      window.setTimeout(() => {
        warnIfTravelPlanControlsMissing("post-load-watchdog");
      }, 1500);
    }
    const externalDestinationScopeRoot = destinationScopeEditorRoot();
    if (
      externalDestinationScopeRoot
      && externalDestinationScopeRoot !== els.travel_plan_editor
      && externalDestinationScopeRoot.dataset.travelPlanDestinationScopeBound !== "true"
    ) {
      externalDestinationScopeRoot.addEventListener("change", (event) => {
        const target = event.target;
        syncTravelPlanDraftFromDom();
        updateTravelPlanDirtyState();
        renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
        renderTravelPlanTranslationPanel();
        if (
          target?.matches?.("[data-destination-scope-destination]")
          || target?.matches?.("[data-destination-scope-country-place]")
          || target?.matches?.("[data-destination-scope-region]")
        ) {
          renderTravelPlanPanel();
        }
      }, eventOptions);
      externalDestinationScopeRoot.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-destination-scope-add-region")) {
          void createDestinationScopeRegion(button.getAttribute("data-destination-scope-add-region"));
          return;
        }
        if (button.hasAttribute("data-destination-scope-add-place")) {
          void createDestinationScopePlace(button.getAttribute("data-destination-scope-add-place"));
          return;
        }
        if (button.hasAttribute("data-destination-scope-add-country-place")) {
          void createDestinationScopePlace("", button.getAttribute("data-destination-scope-add-country-place"));
        }
      }, eventOptions);
      externalDestinationScopeRoot.dataset.travelPlanDestinationScopeBound = "true";
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
      }, eventOptions);
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
      }, eventOptions);
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
      }, eventOptions);
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
          const nextValue = input instanceof HTMLTextRegionElement ? input.value : "";
          void travelPlanPdfsModule.saveTravelPlanPdfComment(artifactId, nextValue).then((ok) => {
            if (!ok) renderTravelPlanPanel();
          });
        }
      }, eventOptions);
      els.travel_plan_pdf_workspace.addEventListener("change", (event) => {
        const target = event.target;
        if (target?.matches?.("[data-travel-plan-pdf-sent]")) {
          const artifactId = String(target.getAttribute("data-travel-plan-pdf-sent") || "").trim();
          const sentToCustomer = target.checked === true;
          void travelPlanPdfsModule.setTravelPlanPdfSentToCustomer(artifactId, sentToCustomer).then((ok) => {
            if (!ok) renderTravelPlanPanel();
          });
        }
      }, eventOptions);
      els.travel_plan_pdf_workspace.dataset.travelPlanBound = "true";
    }
    if (allowTranslation && els.travel_plan_translate_all_btn instanceof HTMLButtonElement && els.travel_plan_translate_all_btn.dataset.travelPlanBound !== "true") {
      els.travel_plan_translate_all_btn.addEventListener("click", () => {
        void translateEntireTravelPlan();
      }, eventOptions);
      els.travel_plan_translate_all_btn.dataset.travelPlanBound = "true";
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
  }

  function renderTravelPlanPanel() {
    if (!els.travel_plan_panel || !els.travel_plan_editor || !state.booking) return;
    state.travelPlanDraft = normalizeTravelPlanState(state.travelPlanDraft || state.booking.travel_plan);
    if (!recalculateTravelPlanDayDates()) clearTravelPlanDerivedDayDates();
    if ((allowDestinationScope || allowAllPrimaryMapPointOptions) && !state.destinationScopeCatalog) {
      void loadDestinationScopeCatalog().then(() => renderTravelPlanPanel());
    }
    if (allowAirportSelect && !Array.isArray(state.airportCatalog) && !state.airportCatalogPromise) {
      void loadAirportCatalog().then(() => renderTravelPlanPanel());
    }
    renderBookingSectionHeader(els.travel_plan_panel_summary, travelPlanSummary());
    const hasDays = Array.isArray(state.travelPlanDraft.days) && state.travelPlanDraft.days.length > 0;
    const tourTemplateLabel = hasDays
      ? bookingT("booking.travel_plan.append_marketing_tour", "Append a Marketing Tour")
      : bookingT("booking.travel_plan.use_marketing_tour", "Use a Marketing Tour");
    const primaryActionRowClass = allowDayImport
      ? "travel-plan-footer__action-row travel-plan-footer__action-row--double"
      : "travel-plan-footer__action-row";
    const boundaryLogisticsBeforeDays = showDepartureBoundaryAfterDays
      ? renderTravelPlanBoundaryLogistics(["arrival"])
      : renderTravelPlanBoundaryLogistics();
    const boundaryLogisticsAfterDays = showDepartureBoundaryAfterDays
      ? renderTravelPlanBoundaryLogistics(["departure"])
      : "";
    const travelPlanDaysMarkup = (Array.isArray(state.travelPlanDraft.days) ? state.travelPlanDraft.days : [])
      .map((day, dayIndex) => renderTravelPlanDay(day, dayIndex))
      .join("") || `<p class="travel-plan-empty">${escapeHtml(bookingT("booking.travel_plan.no_days", "No travel-plan days yet."))}</p>`;
    const destinationScopeMarkup = allowDestinationScope
      ? renderDestinationScopeEditor({
          catalog: state.destinationScopeCatalog,
          scope: state.travelPlanDraft.destination_scope,
          escapeHtml,
          canEdit: state.permissions.canEditBooking,
          allowCreate: allowDestinationScopeCreate,
          t: bookingT
        })
      : "";
    if (usesExternalDestinationScopeEditor()) {
      els.travel_plan_destination_scope_editor.innerHTML = destinationScopeMarkup;
    }
    if (useFocusedBookingWorkspace) {
      destroyTravelPlanCustomizerWorkspaces();
    }
    els.travel_plan_editor.innerHTML = useFocusedBookingWorkspace
      ? renderFocusedTravelPlanWorkspace({ destinationScopeMarkup })
      : `
        ${usesExternalDestinationScopeEditor() ? "" : destinationScopeMarkup}
        ${boundaryLogisticsBeforeDays}
        ${travelPlanDaysMarkup}
        ${boundaryLogisticsAfterDays}
        <div class="travel-plan-footer">
          <div class="travel-plan-footer__action-rows">
            <div class="${primaryActionRowClass}">
              ${allowDayAdd
                ? `<button class="btn btn-ghost booking-offer-add-btn travel-plan-add-day-btn travel-plan-add-day-btn--combined" data-travel-plan-add-day type="button">
                    <span class="travel-plan-add-btn__icon" aria-hidden="true">+</span>
                    <span class="travel-plan-add-btn__label">${escapeHtml(bookingT("booking.travel_plan.new_day", "New day"))}</span>
                  </button>`
                : ""}
              ${allowDayImport
                ? `<button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--day-copy" data-travel-plan-open-day-import type="button">${escapeHtml(bookingT("booking.travel_plan.insert_existing_day", "Copy existing day"))}</button>`
                : ""}
            </div>
            ${allowTourImport
              ? `<div class="travel-plan-footer__action-row">
                  <button class="btn travel-plan-day-add-btn travel-plan-day-add-btn--service travel-plan-day-add-btn--day-copy" data-travel-plan-open-tour-import data-requires-clean-state type="button">${escapeHtml(tourTemplateLabel)}</button>
                </div>`
              : ""}
          </div>
        </div>
      `;
    if (useFocusedBookingWorkspace) {
      renderTravelPlanCustomizerWorkspaces();
    }
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
    updateTravelPlanDirtyState();
    syncTravelPlanTranslateButton();
    renderTravelPlanTranslationPanel();
    scheduleTravelPlanControlsDiagnostic("renderTravelPlanPanel");
  }

  function destroy() {
    travelPlanEventController?.abort?.();
    travelPlanEventController = null;
    clearTravelPlanRouteDocumentListeners();
    clearTravelPlanRouteDragState();
    clearTravelPlanServiceDragState();
    destroyTravelPlanCustomizerWorkspaces();
    if (els.travel_plan_editor instanceof HTMLElement) {
      delete els.travel_plan_editor.dataset.travelPlanBound;
    }
    const externalDestinationScopeRoot = destinationScopeEditorRoot();
    if (externalDestinationScopeRoot instanceof HTMLElement) {
      delete externalDestinationScopeRoot.dataset.travelPlanDestinationScopeBound;
    }
    if (els.travel_plan_translation_panel instanceof HTMLElement) {
      delete els.travel_plan_translation_panel.dataset.travelPlanBound;
    }
    if (els.travel_plan_pdf_workspace instanceof HTMLElement) {
      delete els.travel_plan_pdf_workspace.dataset.travelPlanBound;
    }
    if (els.travel_plan_translate_all_btn instanceof HTMLButtonElement) {
      delete els.travel_plan_translate_all_btn.dataset.travelPlanBound;
    }
  }

  return {
    applyBookingPayload,
    bindEvents,
    collectTravelPlanPayload,
    destroy,
    renderTravelPlanPanel,
    renderTravelPlanTranslationPanel,
    hasIncompleteTravelPlanTranslation,
    updateTravelPlanDirtyState,
    saveTravelPlan
  };
}

export const createTravelPlanEditorCore = createBookingTravelPlanModule;
