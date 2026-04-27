import {
  escapeHtml,
  normalizeText
} from "./api.js";
import { createBookingTravelPlanModule } from "../booking/travel_plan.js";
import {
  initializeBookingSection,
  setBookingSectionOpen
} from "../booking/sections.js";

export function createStandardTourEditor({
  state,
  els,
  apiOrigin,
  fetchApi,
  onDirtyChange
} = {}) {
  const travelPlanModule = createBookingTravelPlanModule({
    state,
    els,
    apiOrigin,
    fetchBookingMutation: (url, options = {}) => fetchApi(url, options),
    getBookingRevision: () => "",
    renderBookingHeader: () => {},
    renderBookingData: () => {},
    renderOfferPanel: () => {},
    loadActivities: async () => {},
    escapeHtml,
    formatDateTime: (value) => normalizeText(value),
    setBookingSectionDirty: () => {
      onDirtyChange?.();
    },
    setPageSaveActionError: () => {},
    hasUnsavedBookingChanges: () => false,
    features: {
      dayImport: false,
      planImport: false,
      standardTourImport: false,
      serviceImport: false,
      imageUpload: false,
      destinationScope: false
    }
  });

  function bind() {
    initializeBookingSection(els?.travel_plan_panel);
    setBookingSectionOpen(els?.travel_plan_panel, true, { animate: false });
    travelPlanModule.bindEvents();
  }

  function applyStandardTour(standardTour) {
    state.booking = {
      id: normalizeText(standardTour?.id),
      travel_plan: standardTour?.travel_plan || { days: [], attachments: [] },
      translation_enabled: false,
      travel_plan_translation_status: {}
    };
    travelPlanModule.applyBookingPayload();
    travelPlanModule.renderTravelPlanPanel();
  }

  return {
    applyStandardTour,
    bind,
    collectPayload: (options) => travelPlanModule.collectTravelPlanPayload(options)
  };
}
