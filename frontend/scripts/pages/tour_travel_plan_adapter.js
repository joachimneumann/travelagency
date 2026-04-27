import { createTravelPlanEditorCore } from "../shared/travel_plan_editor_core.js";
import {
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
    const expectedUpdatedAt = normalizeText(sourceState.tour?.updated_at);
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
      setPageOverlay,
      features: {
        dates: false,
        timing: false,
        dayImport: false,
        planImport: false,
        tourImport: false,
        serviceImport: false,
        imageUpload: true,
        attachments: false,
        pdfs: false,
        translation: false,
        tourCardImageSelection: true,
        serviceDetails: false,
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

  function snapshot() {
    const plan = state.travelPlanDraft || state.booking?.travel_plan || { days: [] };
    return JSON.stringify(plan);
  }

  return {
    applyTour,
    bind,
    collectPayload,
    snapshot
  };
}
