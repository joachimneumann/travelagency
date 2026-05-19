export const TRAVEL_PLAN_EDITOR_PRESETS = Object.freeze({
  booking: Object.freeze({
    workspace: "focused",
    mapPanel: true,
    routeList: true,
    customizer: true,
    customizerStorage: "copiedDays",
    pdfs: true,
    dates: true,
    deriveDatesFromFirstDay: true,
    timing: true,
    arrivalDeparture: true,
    arrivalDepartureTiming: true,
    dayTitleEdit: true,
    dayDetailsEdit: true,
    mapPointEdit: true,
    dayAdd: true,
    dayDelete: true,
    dayReorder: true,
    destinationScope: "derived",
    services: "editable",
    serviceTiming: true,
    serviceImages: true,
    serviceDetails: true,
    tourCardImageSelection: false
  }),

  marketingTour: Object.freeze({
    workspace: "focused",
    mapPanel: true,
    routeList: true,
    customizer: true,
    customizerStorage: "resolvedDays",
    pdfs: true,
    dates: false,
    deriveDatesFromFirstDay: false,
    timing: false,
    arrivalDeparture: true,
    arrivalDepartureTiming: false,
    dayTitleEdit: true,
    dayDetailsEdit: true,
    mapPointEdit: true,
    dayAdd: true,
    dayDelete: true,
    dayReorder: true,
    destinationScope: "derived",
    services: "editable",
    serviceTiming: false,
    serviceImages: true,
    serviceDetails: true,
    tourCardImageSelection: true
  }),

  tourVariant: Object.freeze({
    workspace: "focused",
    mapPanel: true,
    routeList: true,
    customizer: true,
    customizerStorage: "dayReferences",
    pdfs: true,
    dates: false,
    deriveDatesFromFirstDay: false,
    timing: false,
    arrivalDeparture: true,
    arrivalDepartureTiming: false,
    dayTitleEdit: false,
    dayDetailsEdit: false,
    mapPointEdit: false,
    dayAdd: false,
    dayDelete: true,
    dayReorder: true,
    destinationScope: "derived",
    services: "readonlyCompact",
    serviceTiming: false,
    serviceImages: false,
    serviceDetails: true,
    tourCardImageSelection: true
  })
});

const PRESET_FEATURE_ALIASES = Object.freeze({
  focusedBookingWorkspace: (preset) => preset.workspace === "focused",
  dates: (preset) => preset.dates === true,
  sequentialDayDates: (preset) => preset.deriveDatesFromFirstDay === true,
  serviceDetails: (preset) => preset.serviceDetails !== false,
  imageUpload: (preset) => preset.serviceImages === true,
  timing: (preset) => preset.timing === true || preset.serviceTiming === true,
  arrivalDeparture: (preset) => preset.arrivalDeparture === true,
  airportSelect: (preset) => preset.arrivalDeparture === true,
  pdfs: (preset) => preset.pdfs === true,
  tourCardImageSelection: (preset) => preset.tourCardImageSelection === true,
  dayTitleEdit: (preset) => preset.dayTitleEdit === true,
  dayDetailsEdit: (preset) => preset.dayDetailsEdit === true,
  mapPointEdit: (preset) => preset.mapPointEdit === true,
  dayAdd: (preset) => preset.dayAdd === true,
  dayDelete: (preset) => preset.dayDelete === true,
  dayReorder: (preset) => preset.dayReorder === true,
  customizer: (preset) => preset.customizer === true,
  services: (preset) => preset.services || "editable"
});

function normalizePresetName(value) {
  const normalized = String(value || "").trim();
  if (normalized === "marketing-tour" || normalized === "marketing_tour") return "marketingTour";
  if (normalized === "tour-variant" || normalized === "tour_variant") return "tourVariant";
  return normalized;
}

export function resolveTravelPlanEditorPreset(presetName = "booking", featureOverrides = {}) {
  const normalizedName = normalizePresetName(presetName) || "booking";
  const preset = TRAVEL_PLAN_EDITOR_PRESETS[normalizedName] || TRAVEL_PLAN_EDITOR_PRESETS.booking;
  const derivedFeatures = Object.fromEntries(
    Object.entries(PRESET_FEATURE_ALIASES).map(([key, resolve]) => [key, resolve(preset)])
  );
  return {
    name: TRAVEL_PLAN_EDITOR_PRESETS[normalizedName] ? normalizedName : "booking",
    preset,
    features: {
      ...derivedFeatures,
      ...featureOverrides
    }
  };
}
