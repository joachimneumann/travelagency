import { createTravelPlanEditorCore } from "../shared/travel_plan_editor_core.js";
import { formatDateTime } from "../shared/api.js";
import { initializeBookingSection, setBookingSectionOpen } from "../booking/sections.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function currentBackendLang() {
  return typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
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

function rewriteTourTravelPlanMutationUrl(urlLike, tourId) {
  const url = new URL(urlLike, window.location.origin);
  const normalizedTourId = encodeURIComponent(normalizeText(tourId));
  const imageMatch = url.pathname.match(/^\/api\/v1\/bookings\/[^/]+\/travel-plan\/days\/([^/]+)\/services\/([^/]+)\/image$/);
  if (imageMatch && normalizedTourId) {
    return withBackendLang(`/api/v1/tours/${normalizedTourId}/travel-plan/days/${imageMatch[1]}/services/${imageMatch[2]}/image${url.search}`);
  }
  if (/^\/api\/v1\/bookings\/[^/]+\/travel-plan$/.test(url.pathname) && normalizedTourId) {
    return withBackendLang(`/api/v1/tours/${normalizedTourId}/travel-plan${url.search}`);
  }
  return withBackendLang(`${url.pathname}${url.search}`);
}

function rewriteTourTravelPlanMutationBody(urlLike, body) {
  const url = new URL(urlLike, window.location.origin);
  if (!/^\/api\/v1\/bookings\/[^/]+\/travel-plan$/.test(url.pathname)) {
    return body;
  }
  return {
    travel_plan: body?.travel_plan || { days: [] },
    actor: body?.actor
  };
}

export function createTourTravelPlanAdapter({
  state,
  els,
  apiOrigin,
  fetchApi,
  escapeHtml,
  onDirtyChange,
  onTourMutation
}) {
  let core = null;

  function setTourTravelPlanDirty(_section, _isDirty, _diagnostic = null) {
    if (typeof onDirtyChange === "function") onDirtyChange();
  }

  async function fetchTourTravelPlanMutation(url, options = {}) {
    const rewrittenUrl = rewriteTourTravelPlanMutationUrl(url, state.id || state.booking?.id);
    const rewrittenBody = rewriteTourTravelPlanMutationBody(url, options.body);
    const result = await fetchApi(rewrittenUrl, {
      method: options.method || "GET",
      body: rewrittenBody
    });
    if (result?.tour) {
      if (typeof onTourMutation === "function") onTourMutation(result.tour);
      return {
        ...result,
        booking: fakeBookingFromTour(result.tour, state.id)
      };
    }
    return result;
  }

  async function prepareTourTravelPlanMutation({
    applyTravelPlanMutationBooking,
    buildTravelPlanPayload,
    syncTravelPlanDraftFromDom,
    travelPlanStatus
  } = {}) {
    if (!state.travelPlanDirty) return true;
    if (!state.booking?.id) return false;
    if (typeof syncTravelPlanDraftFromDom === "function") syncTravelPlanDraftFromDom();
    const travelPlan = typeof buildTravelPlanPayload === "function"
      ? buildTravelPlanPayload()
      : (state.travelPlanDraft || state.booking?.travel_plan || { days: [] });
    if (typeof travelPlanStatus === "function") {
      travelPlanStatus("Saving travel plan before uploading image...", "info");
    }
    const bookingTravelPlanUrl = `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/travel-plan`;
    const result = await fetchTourTravelPlanMutation(bookingTravelPlanUrl, {
      method: "PATCH",
      body: {
        travel_plan: travelPlan,
        actor: state.user
      }
    });
    if (!result?.booking) return false;
    if (typeof applyTravelPlanMutationBooking === "function") {
      applyTravelPlanMutationBooking(result.booking, { preserveCollapsedState: true });
    }
    return true;
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
        serviceDetails: false,
        renumberDays: false
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
