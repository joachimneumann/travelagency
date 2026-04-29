import { createTravelPlanEditorCore } from "../shared/travel_plan_editor_core.js";
import {
  tourTravelPlanDayImportRequest,
  tourTravelPlanDaySearchRequest,
  tourTravelPlanServiceImportRequest,
  tourTravelPlanServiceSearchRequest,
  tourTravelPlanServiceImageDeleteRequest,
  tourTravelPlanServiceImageUploadRequest,
  tourTravelPlanUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { formatDateTime } from "../shared/api.js";
import { initializeBookingSection, setBookingSectionOpen } from "../booking/sections.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function omitDerivedTravelPlanDestinations(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return plan;
  const { destinations: _derivedDestinations, ...next } = plan;
  return next;
}

function currentBackendLang() {
  return typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
}

function backendLangQuery() {
  const lang = currentBackendLang();
  return lang ? { lang } : {};
}

function withBackendLang(urlLike) {
  const url = new URL(urlLike, window.location.origin);
  const lang = currentBackendLang();
  if (lang && !url.searchParams.has("lang")) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function fakeBookingFromTour(tour, fallbackId = "") {
  const tourId = normalizeText(tour?.id) || normalizeText(fallbackId);
  return {
    id: tourId,
    updated_at: normalizeText(tour?.updated_at) || null,
    travel_plan: tour?.travel_plan && typeof tour.travel_plan === "object" ? tour.travel_plan : { days: [] },
    travel_plan_revision: 0,
    translation_enabled: false,
    travel_plan_translation_status: {},
    travel_plan_pdfs: []
  };
}

function parseTravelPlanServiceImageMutation(urlLike) {
  const url = new URL(urlLike, window.location.origin);
  const imageMatch = url.pathname.match(/^\/api\/v1\/(?:bookings|tours)\/[^/]+\/travel-plan\/days\/([^/]+)\/services\/([^/]+)\/image$/);
  if (!imageMatch) return null;
  return {
    dayId: decodeURIComponent(imageMatch[1]),
    serviceId: decodeURIComponent(imageMatch[2])
  };
}

function findTravelPlanServiceImage(plan, dayId, serviceId) {
  const normalizedDayId = normalizeText(dayId);
  const normalizedServiceId = normalizeText(serviceId);
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const day = days.find((item) => normalizeText(item?.id) === normalizedDayId);
  const service = (Array.isArray(day?.services) ? day.services : [])
    .find((item) => normalizeText(item?.id) === normalizedServiceId);
  return service?.image && typeof service.image === "object" && !Array.isArray(service.image)
    ? service.image
    : null;
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeLocalizedMap(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([lang, text]) => [normalizeText(lang), normalizeText(text)])
      .filter(([lang, text]) => lang && text)
  );
}

function preferredEnglishImportText(mapValue, plainValue) {
  const source = normalizeLocalizedMap(mapValue);
  const englishText = normalizeText(source.en);
  if (englishText) return englishText;
  const normalizedPlainText = normalizeText(plainValue);
  if (normalizedPlainText) return normalizedPlainText;
  return "";
}

function cloneTourMarketingServiceForLocalImport({ searchResult }) {
  const sourceService = searchResult?.source_service && typeof searchResult.source_service === "object" && !Array.isArray(searchResult.source_service)
    ? searchResult.source_service
    : null;
  if (!sourceService) return null;
  return cloneJson({
    timing_kind: sourceService.timing_kind,
    time_label: preferredEnglishImportText(sourceService.time_label_i18n, sourceService.time_label) || null,
    time_label_i18n: {},
    time_point: sourceService.time_point,
    kind: sourceService.kind,
    title: preferredEnglishImportText(sourceService.title_i18n, sourceService.title),
    title_i18n: {},
    details: preferredEnglishImportText(sourceService.details_i18n, sourceService.details) || null,
    details_i18n: {},
    image_subtitle: preferredEnglishImportText(sourceService.image_subtitle_i18n, sourceService.image_subtitle) || null,
    image_subtitle_i18n: {},
    location: preferredEnglishImportText(sourceService.location_i18n, sourceService.location) || null,
    location_i18n: {},
    start_time: sourceService.start_time,
    end_time: sourceService.end_time,
    id: undefined,
    image: sourceService.image && typeof sourceService.image === "object" && !Array.isArray(sourceService.image)
      ? {
          ...sourceService.image,
          id: undefined
        }
      : sourceService.image
  });
}

function cloneTourMarketingDayForLocalImport({ searchResult, targetDayIndex = 0 }) {
  const sourceDay = searchResult?.source_day && typeof searchResult.source_day === "object" && !Array.isArray(searchResult.source_day)
    ? searchResult.source_day
    : null;
  if (!sourceDay) return null;
  return cloneJson({
    date: sourceDay.date,
    date_string: sourceDay.date_string,
    title: preferredEnglishImportText(sourceDay.title_i18n, sourceDay.title),
    title_i18n: {},
    overnight_location: preferredEnglishImportText(sourceDay.overnight_location_i18n, sourceDay.overnight_location) || null,
    overnight_location_i18n: {},
    notes: preferredEnglishImportText(sourceDay.notes_i18n, sourceDay.notes) || null,
    notes_i18n: {},
    id: undefined,
    day_number: Math.max(1, Number(targetDayIndex) + 1),
    services: (Array.isArray(sourceDay.services) ? sourceDay.services : []).map((service) => (
      cloneTourMarketingServiceForLocalImport({
        searchResult: { source_service: service }
      })
    )).filter(Boolean)
  });
}

export function createTourTravelPlanAdapter({
  state,
  els,
  apiOrigin,
  fetchApi,
  escapeHtml,
  onDirtyChange,
  onTourMutation,
  setPageOverlay
}) {
  let core = null;

  function setTourTravelPlanDirty(_section, _isDirty, _diagnostic = null) {
    if (typeof onDirtyChange === "function") onDirtyChange();
  }

  function expectedTourUpdatedAtPayload(sourceState = state) {
    const expectedUpdatedAt = normalizeText(sourceState.tour?.updated_at || sourceState.booking?.updated_at);
    return expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {};
  }

  async function fetchTourTravelPlanMutation(url, options = {}) {
    const serviceImageMutation = parseTravelPlanServiceImageMutation(url);
    const requestUrl = withBackendLang(url);
    if (serviceImageMutation) {
      console.info("[tour-travel-plan-image] Sending service image mutation", {
        tour_id: normalizeText(state.id || state.booking?.id),
        day_id: serviceImageMutation.dayId,
        service_id: serviceImageMutation.serviceId,
        method: options.method || "GET",
        url: requestUrl
      });
    }
    const result = await fetchApi(requestUrl, {
      method: options.method || "GET",
      body: options.body
    });
    if (result?.tour) {
      if (serviceImageMutation) {
        console.info("[tour-travel-plan-image] Service image mutation returned tour", {
          tour_id: normalizeText(result.tour?.id || state.id || state.booking?.id),
          day_id: serviceImageMutation.dayId,
          service_id: serviceImageMutation.serviceId,
          image: findTravelPlanServiceImage(result.tour?.travel_plan, serviceImageMutation.dayId, serviceImageMutation.serviceId),
          travel_plan_days: Array.isArray(result.tour?.travel_plan?.days) ? result.tour.travel_plan.days.length : 0
        });
      }
      if (typeof onTourMutation === "function") onTourMutation(result.tour);
      return {
        ...result,
        booking: fakeBookingFromTour(result.tour, state.id)
      };
    }
    if (serviceImageMutation) {
      console.warn("[tour-travel-plan-image] Service image mutation did not return a tour", {
        tour_id: normalizeText(state.id || state.booking?.id),
        day_id: serviceImageMutation.dayId,
        service_id: serviceImageMutation.serviceId,
        response_keys: result && typeof result === "object" ? Object.keys(result) : []
      });
    }
    return result;
  }

  async function prepareTourTravelPlanMutation({
    applyTravelPlanMutationBooking,
    buildTravelPlanPayload,
    saveTravelPlan,
    syncTravelPlanDraftFromDom,
    travelPlanStatus
  } = {}) {
    if (!state.travelPlanDirty) return true;
    if (!state.booking?.id) return false;
    if (typeof saveTravelPlan === "function") {
      return await saveTravelPlan();
    }
    if (typeof syncTravelPlanDraftFromDom === "function") syncTravelPlanDraftFromDom();
    const travelPlan = typeof buildTravelPlanPayload === "function"
      ? buildTravelPlanPayload()
      : (state.travelPlanDraft || state.booking?.travel_plan || { days: [] });
    if (typeof travelPlanStatus === "function") {
      travelPlanStatus("Saving travel plan before uploading image...", "info");
    }
    const request = tourTravelPlanUpdateRequest({
      baseURL: apiOrigin,
      params: { tour_id: state.booking.id },
      query: backendLangQuery(),
      body: {
        travel_plan: omitDerivedTravelPlanDestinations(travelPlan),
        ...expectedTourUpdatedAtPayload(state),
        actor: state.user
      }
    });
    const result = await fetchTourTravelPlanMutation(request.url, {
      method: request.method,
      body: request.body
    });
    if (!result?.booking) return false;
    if (typeof applyTravelPlanMutationBooking === "function") {
      applyTravelPlanMutationBooking(result.booking, { preserveCollapsedState: true });
    }
    return true;
  }

  function buildTourTravelPlanSaveRequest({ apiOrigin: requestApiOrigin, state: requestState, travelPlanPayload }) {
    return tourTravelPlanUpdateRequest({
      baseURL: requestApiOrigin,
      params: { tour_id: normalizeText(requestState.booking?.id || requestState.id) },
      query: backendLangQuery(),
      body: {
        travel_plan: omitDerivedTravelPlanDestinations(travelPlanPayload),
        ...expectedTourUpdatedAtPayload(requestState),
        actor: requestState.user
      }
    });
  }

  function buildTourTravelPlanServiceImageUploadRequest({ apiOrigin: requestApiOrigin, state: requestState, dayId, itemId, file, dataBase64 }) {
    return tourTravelPlanServiceImageUploadRequest({
      baseURL: requestApiOrigin,
      params: {
        tour_id: normalizeText(requestState.booking?.id || requestState.id),
        day_id: dayId,
        service_id: itemId
      },
      query: backendLangQuery(),
      body: {
        filename: file.name,
        data_base64: dataBase64,
        actor: requestState.user
      }
    });
  }

  function buildTourTravelPlanServiceImageDeleteRequest({ apiOrigin: requestApiOrigin, state: requestState, dayId, itemId }) {
    return tourTravelPlanServiceImageDeleteRequest({
      baseURL: requestApiOrigin,
      params: {
        tour_id: normalizeText(requestState.booking?.id || requestState.id),
        day_id: dayId,
        service_id: itemId
      },
      query: backendLangQuery(),
      body: {
        actor: requestState.user
      }
    });
  }

  function buildTourTravelPlanDaySearchRequest({ apiOrigin: requestApiOrigin, state: requestState, query }) {
    return tourTravelPlanDaySearchRequest({
      baseURL: requestApiOrigin,
      query: {
        ...(normalizeText(query) ? { q: normalizeText(query) } : {}),
        exclude_tour_id: normalizeText(requestState.booking?.id || requestState.id)
      }
    });
  }

  function buildTourTravelPlanServiceSearchRequest({ apiOrigin: requestApiOrigin, state: requestState, query, kind }) {
    return tourTravelPlanServiceSearchRequest({
      baseURL: requestApiOrigin,
      query: {
        ...(normalizeText(query) ? { q: normalizeText(query) } : {}),
        ...(normalizeText(kind) ? { service_kind: normalizeText(kind) } : {}),
        exclude_tour_id: normalizeText(requestState.booking?.id || requestState.id)
      }
    });
  }

  function buildTourTravelPlanDayImportRequest({ apiOrigin: requestApiOrigin, state: requestState, sourceTourId, sourceDayId, targetTravelPlan = null }) {
    return tourTravelPlanDayImportRequest({
      baseURL: requestApiOrigin,
      params: {
        tour_id: normalizeText(requestState.booking?.id || requestState.id)
      },
      query: backendLangQuery(),
      body: {
        source_tour_id: sourceTourId,
        source_day_id: sourceDayId,
        ...(targetTravelPlan ? { target_travel_plan: omitDerivedTravelPlanDestinations(targetTravelPlan) } : {}),
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: false,
        ...expectedTourUpdatedAtPayload(requestState),
        actor: requestState.user
      }
    });
  }

  function buildTourTravelPlanServiceImportRequest({ apiOrigin: requestApiOrigin, state: requestState, targetDayId, sourceTourId, sourceServiceId, targetTravelPlan = null }) {
    return tourTravelPlanServiceImportRequest({
      baseURL: requestApiOrigin,
      params: {
        tour_id: normalizeText(requestState.booking?.id || requestState.id),
        day_id: targetDayId
      },
      query: backendLangQuery(),
      body: {
        source_tour_id: sourceTourId,
        source_service_id: sourceServiceId,
        ...(targetTravelPlan ? { target_travel_plan: omitDerivedTravelPlanDestinations(targetTravelPlan) } : {}),
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: false,
        ...expectedTourUpdatedAtPayload(requestState),
        actor: requestState.user
      }
    });
  }

  function ensureCore() {
    if (core) return core;
    state.permissions.canEditBooking = state.permissions.canEditTours === true;
    state.booking = state.booking || fakeBookingFromTour(state.tour, state.id);
    core = createTravelPlanEditorCore({
      state,
      els,
      apiOrigin,
      fetchBookingMutation: fetchTourTravelPlanMutation,
      getBookingRevision: () => 0,
      renderBookingHeader: () => {},
      renderBookingData: () => {},
      renderOfferPanel: () => {},
      loadActivities: async () => {},
      escapeHtml,
      formatDateTime,
      setBookingSectionDirty: setTourTravelPlanDirty,
      setPageSaveActionError: () => {},
      hasUnsavedBookingChanges: () => false,
      prepareTravelPlanMutation: prepareTourTravelPlanMutation,
      buildTravelPlanSaveRequest: buildTourTravelPlanSaveRequest,
      buildTravelPlanServiceImageUploadRequest: buildTourTravelPlanServiceImageUploadRequest,
      buildTravelPlanServiceImageDeleteRequest: buildTourTravelPlanServiceImageDeleteRequest,
      buildTravelPlanDaySearchRequest: buildTourTravelPlanDaySearchRequest,
      buildTravelPlanServiceSearchRequest: buildTourTravelPlanServiceSearchRequest,
      buildTravelPlanDayImportRequest: buildTourTravelPlanDayImportRequest,
      buildTravelPlanServiceImportRequest: buildTourTravelPlanServiceImportRequest,
      cloneTravelPlanDayForLocalImport: cloneTourMarketingDayForLocalImport,
      cloneTravelPlanServiceForLocalImport: cloneTourMarketingServiceForLocalImport,
      travelPlanLibrarySource: "marketing_tour",
      setPageOverlay,
      features: {
        dates: false,
        timing: false,
        dayImport: true,
        tourImport: false,
        serviceImport: true,
        imageUpload: true,
        attachments: false,
        pdfs: false,
        translation: false,
        tourCardImageSelection: true,
        serviceDetails: true,
        renumberDays: false,
        destinationScope: true,
        destinationScopeCreate: false,
        pruneEmptyTravelPlanContentOnCollect: true
      }
    });
    return core;
  }

  function bind() {
    const instance = ensureCore();
    if (els.travel_plan_panel instanceof HTMLElement) {
      initializeBookingSection(els.travel_plan_panel);
      setBookingSectionOpen(els.travel_plan_panel, true, { animate: false });
    }
    instance.bindEvents();
  }

  function applyTour(tour) {
    state.tour = tour || state.tour;
    state.permissions.canEditBooking = state.permissions.canEditTours === true;
    state.booking = fakeBookingFromTour(state.tour, state.id);
    const instance = ensureCore();
    instance.applyBookingPayload();
    instance.renderTravelPlanPanel();
  }

  function collectPayload(options = {}) {
    return ensureCore().collectTravelPlanPayload(options);
  }

  function renderTravelPlanPanel({ syncFromDom = true } = {}) {
    const instance = ensureCore();
    if (syncFromDom) {
      instance.collectTravelPlanPayload({
        focusFirstInvalid: false,
        pruneEmptyContent: false
      });
    }
    instance.renderTravelPlanPanel();
  }

  function snapshot() {
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    return JSON.stringify(plan);
  }

  return {
    applyTour,
    bind,
    collectPayload,
    renderTravelPlanPanel,
    snapshot
  };
}
