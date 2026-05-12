const TOUR_CUSTOMIZE_STORAGE_PREFIX = "asiatravelplan.custom_tour.";
const TOUR_CUSTOMIZE_TITLE_PROPOSAL_LIMIT = 1;
const TOUR_CUSTOMIZE_TITLE_LOCATION_LIMIT = 3;
const TOUR_CUSTOMIZE_REORDER_ANIMATION_MS = 170;
const TOUR_CUSTOMIZE_DROP_ANIMATION_MS = 190;
const TOUR_CUSTOMIZE_DELETE_ANIMATION_MS = 220;
const TOUR_CUSTOMIZE_SMOKE_ANIMATION_MS = 460;
const TOUR_CUSTOMIZE_IMAGE_DISSOLVE_MS = 170;
const TOUR_CUSTOMIZE_TIMELINE_DELETE_DISTANCE_PX = 50;
const TOUR_CUSTOMIZE_STICKY_DRAG_THRESHOLD_PX = 6;
const TOUR_CUSTOMIZE_CARD_WIDTH_PX = 116;
const TOUR_CUSTOMIZE_CARD_HEIGHT_PX = 154;
const TOUR_CUSTOMIZE_MAP_ZOOM_MIN_CENTER = 0;
const TOUR_CUSTOMIZE_MAP_ZOOM_MAX_CENTER = 100;
const TOUR_CUSTOMIZE_DEFAULT_ROUTE_BOUNDS = Object.freeze({
  north: 24.398444,
  south: 7.528160,
  west: 101.183227,
  east: 109.987724
});
const TOUR_CUSTOMIZE_MAP_ZOOM_FACTOR = 3;

function normalizeText(value) {
  return String(value ?? "").trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function storageAvailable() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const key = "__atp_customizer_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function storageKey(tourId) {
  return `${TOUR_CUSTOMIZE_STORAGE_PREFIX}${tourId}`;
}

function projectLatLng(routePoint, bounds = TOUR_CUSTOMIZE_DEFAULT_ROUTE_BOUNDS) {
  const lat = Number(routePoint?.lat);
  const lng = Number(routePoint?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const activeBounds = bounds && typeof bounds === "object" ? bounds : TOUR_CUSTOMIZE_DEFAULT_ROUTE_BOUNDS;
  const width = Math.max(0.01, Number(activeBounds.east) - Number(activeBounds.west));
  const height = Math.max(0.01, Number(activeBounds.north) - Number(activeBounds.south));
  const x = ((lng - Number(activeBounds.west)) / width) * 100;
  const y = ((Number(activeBounds.north) - lat) / height) * 100;
  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(96, Math.max(4, y))
  };
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveLocalizedField(source, field, lang) {
  const map = source?.[`${field}_i18n`];
  const localized = map && typeof map === "object" && !Array.isArray(map)
    ? normalizeText(map[lang]) || normalizeText(map.en)
    : "";
  return localized || normalizeText(source?.[field]);
}

function resolveLocalizedText(value, lang) {
  if (typeof value === "string") return normalizeText(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const candidates = [lang, "en", ...Object.keys(value)];
  for (const candidate of candidates) {
    const text = normalizeText(value[candidate]);
    if (text) return text;
  }
  return "";
}

function normalizeCoordinate(value) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function locationCatalogById(catalog) {
  const source = catalog && typeof catalog === "object" && !Array.isArray(catalog) ? catalog : {};
  return new Map([
    ...(Array.isArray(source.destination_places) ? source.destination_places : []),
    ...(Array.isArray(source.places) ? source.places : [])
  ].map((location) => {
    const id = normalizeText(location?.id);
    return [id, {
      id,
      label: normalizeText(location?.label || location?.name || location?.code || id),
      aliases: [
        normalizeText(location?.label),
        normalizeText(location?.name),
        normalizeText(location?.code),
        id
      ].filter(Boolean),
      latitude: normalizeCoordinate(location?.latitude),
      longitude: normalizeCoordinate(location?.longitude)
    }];
  }).filter(([id]) => id));
}

function customizerRouteBounds() {
  return TOUR_CUSTOMIZE_DEFAULT_ROUTE_BOUNDS;
}

function locationCatalogRoutePoints(catalog) {
  return Array.from(locationCatalogById(catalog).values())
    .filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude))
    .map((location) => ({
      id: location.id,
      label: location.label,
      lat: location.latitude,
      lng: location.longitude,
      aliases: location.aliases
    }));
}

function daySearchText(day, lang) {
  const services = Array.isArray(day?.services) ? day.services : [];
  return [
    resolveLocalizedField(day, "title", lang),
    resolveLocalizedField(day, "overnight_location", lang),
    resolveLocalizedField(day, "notes", lang),
    ...services.flatMap((service) => [
      resolveLocalizedField(service, "title", lang),
      resolveLocalizedField(service, "location", lang),
      resolveLocalizedField(service, "details", lang)
    ])
  ].join(" ");
}

function resolveRoutePoints(day, lang, catalog = null, { allowTextFallback = true } = {}) {
  const locationsById = locationCatalogById(catalog);
  const explicitLocationIds = [
    { id: normalizeText(day?.primary_location_id), role: "primary" },
    { id: normalizeText(day?.secondary_location_id), role: "secondary" }
  ].filter((entry) => entry.id);
  const explicitPoints = [];
  for (const { id, role } of explicitLocationIds) {
    if (explicitPoints.some((point) => point.locationId === id)) continue;
    const location = locationsById.get(id);
    if (Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)) {
      explicitPoints.push({
        lat: location.latitude,
        lng: location.longitude,
        label: location.label || resolveLocalizedField(day, "overnight_location", lang),
        locationId: id,
        role
      });
    }
  }
  if (explicitPoints.length) return explicitPoints;
  const explicit = day?.route_point || day?.routePoint;
  if (explicit && Number.isFinite(Number(explicit.lat)) && Number.isFinite(Number(explicit.lng))) {
    const label = normalizeText(explicit.label) || resolveLocalizedField(day, "overnight_location", lang);
    return [{ lat: Number(explicit.lat), lng: Number(explicit.lng), label, role: "primary" }];
  }
  if (!allowTextFallback) return [];
  const haystack = normalizeSearchText(daySearchText(day, lang));
  let match = null;
  for (const point of locationCatalogRoutePoints(catalog)) {
    for (const alias of point.aliases) {
      const normalizedAlias = normalizeSearchText(alias);
      const index = normalizedAlias ? haystack.lastIndexOf(normalizedAlias) : -1;
      if (index < 0) continue;
      if (
        !match
        || index > match.index
        || (index === match.index && normalizedAlias.length > match.aliasLength)
      ) {
        match = { point, index, aliasLength: normalizedAlias.length };
      }
    }
  }
  return match ? [{ lat: match.point.lat, lng: match.point.lng, label: match.point.label, role: "primary" }] : [];
}

function customerVisibleDayImageUrls(day) {
  const urls = [];
  const seen = new Set();
  for (const service of Array.isArray(day?.services) ? day.services : []) {
    const images = [
      service?.image,
      ...(Array.isArray(service?.images) ? service.images : [])
    ];
    for (const image of images) {
      if (!image || typeof image !== "object" || Array.isArray(image)) continue;
      if (image.is_customer_visible === false) continue;
      const src = normalizeText(image.storage_path || image.url || image.src || image.path);
      if (!src || seen.has(src)) continue;
      seen.add(src);
      urls.push(src);
    }
  }
  return urls;
}

function summarizeDay(day, lang) {
  const notes = compactText(resolveLocalizedField(day, "notes", lang));
  if (notes) return notes.length > 150 ? `${notes.slice(0, 147).trim()}...` : notes;
  const service = (Array.isArray(day?.services) ? day.services : [])
    .map((item) => compactText(resolveLocalizedField(item, "title", lang) || resolveLocalizedField(item, "details", lang)))
    .find(Boolean);
  return service || "";
}

function dayModuleFromDay({ day, sourceTourId, originalTourId, lang, destinationCatalog = null }) {
  const sourceDayId = normalizeText(day?.id);
  const title = resolveLocalizedField(day, "title", lang);
  const imageUrls = customerVisibleDayImageUrls(day);
  const thumbnailUrl = imageUrls[0] || "";
  const routeBounds = customizerRouteBounds();
  const routePoints = resolveRoutePoints(day, lang, destinationCatalog, { allowTextFallback: false })
    .map((routePoint) => ({
      routePoint,
      mapPoint: projectLatLng(routePoint, routeBounds),
      label: normalizeText(routePoint?.label)
    }))
    .filter((entry) => entry.mapPoint);
  if (!sourceTourId || !sourceDayId || !title || !thumbnailUrl || !routePoints.length) return null;
  const { routePoint, mapPoint } = routePoints[0];
  const locationLabel = normalizeText(routePoint.label)
    || resolveLocalizedField(day, "overnight_location", lang);
  if (!locationLabel) return null;
  return {
    id: `${sourceTourId}:${sourceDayId}`,
    source: sourceTourId === originalTourId ? "original" : "optional",
    sourceTourId,
    sourceDayId,
    title,
    locationLabel,
    summary: summarizeDay(day, lang),
    thumbnailUrl,
    routePoint,
    routePoints,
    mapPoint,
    imageUrls,
    day: cloneJson(day)
  };
}

function routeKeyForPoint(routePoint) {
  const lat = Number(routePoint?.lat);
  const lng = Number(routePoint?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

function modulePrimaryLocationKey(module) {
  return routeKeyForPoint(module?.routePoint) || normalizeSearchText(module?.locationLabel || module?.title);
}

function modulePrimaryLatitude(module) {
  const direct = Number(module?.routePoint?.lat);
  if (Number.isFinite(direct)) return direct;
  const firstPoint = Array.isArray(module?.routePoints) ? module.routePoints[0]?.routePoint : null;
  const fallback = Number(firstPoint?.lat);
  return Number.isFinite(fallback) ? fallback : -Infinity;
}

function sortModulesNorthToSouth(modules) {
  return [...(Array.isArray(modules) ? modules : [])].sort((left, right) => {
    const leftLocationKey = modulePrimaryLocationKey(left);
    const rightLocationKey = modulePrimaryLocationKey(right);
    if (leftLocationKey !== rightLocationKey) {
      const latitudeDelta = modulePrimaryLatitude(right) - modulePrimaryLatitude(left);
      if (latitudeDelta) return latitudeDelta;
      return leftLocationKey.localeCompare(rightLocationKey);
    }

    const leftDayNumber = Number(left?.day?.day_number);
    const rightDayNumber = Number(right?.day?.day_number);
    if (Number.isFinite(leftDayNumber) && Number.isFinite(rightDayNumber) && leftDayNumber !== rightDayNumber) {
      return leftDayNumber - rightDayNumber;
    }
    return normalizeText(left?.id).localeCompare(normalizeText(right?.id));
  });
}

function normalizeCustomizationPayload(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const originalTourId = normalizeText(source.originalTourId);
  const timelineDays = (Array.isArray(source.timelineDays) ? source.timelineDays : [])
    .map((item) => {
      const sourceTourId = normalizeText(item?.sourceTourId);
      const sourceDayId = normalizeText(item?.sourceDayId);
      const day = item?.day && typeof item.day === "object" && !Array.isArray(item.day) ? item.day : null;
      if (!sourceTourId || !sourceDayId || !day) return null;
      const sourceId = `${sourceTourId}:${sourceDayId}`;
      const timelineInstanceId = normalizeText(item?.timelineInstanceId) || normalizeText(item?.id) || sourceId;
      return {
        ...item,
        id: sourceId,
        timelineInstanceId,
        sourceTourId,
        sourceDayId,
        day
      };
    })
    .filter(Boolean);
  return originalTourId && timelineDays.length ? { originalTourId, timelineDays } : null;
}

export function createTourCustomizer({
  state,
  frontendT,
  currentFrontendLang,
  normalizeFrontendTourLang,
  escapeHTML,
  escapeAttr,
  travelPlanDays,
  destinationScopeCatalog,
  findTripById,
  ensureTourDetailsLoaded,
  allTrips,
  renderVisibleTrips
}) {
  const customizations = new Map();
  const canUseStorage = storageAvailable();
  let modal = null;
  let draft = null;
  let lastFocusedElement = null;
  let activeDragPayload = null;
  let activeDropIndex = null;
  let activePointerDrag = null;
  let activeMapPan = null;
  let timelineInstanceCounter = 0;

  function t(key, fallback, vars) {
    return typeof frontendT === "function" ? frontendT(key, fallback, vars) : fallback;
  }

  function lang() {
    return typeof normalizeFrontendTourLang === "function"
      ? normalizeFrontendTourLang(currentFrontendLang?.())
      : normalizeText(currentFrontendLang?.()) || "en";
  }

  function timelineItemKey(item) {
    return normalizeText(item?.timelineInstanceId) || normalizeText(item?.id);
  }

  function createTimelineInstanceId(sourceId) {
    const normalizedSourceId = normalizeText(sourceId);
    timelineInstanceCounter += 1;
    return `${normalizedSourceId}::timeline-${Date.now().toString(36)}-${timelineInstanceCounter.toString(36)}`;
  }

  function timelineItemFromModule(item, timelineInstanceId = "") {
    const sourceId = normalizeText(item?.id);
    if (!sourceId) return null;
    return {
      ...item,
      timelineInstanceId: normalizeText(timelineInstanceId) || createTimelineInstanceId(sourceId)
    };
  }

  function loadStoredCustomization(tourId) {
    const normalizedTourId = normalizeText(tourId);
    if (!normalizedTourId || customizations.has(normalizedTourId) || !canUseStorage) {
      return customizations.get(normalizedTourId) || null;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey(normalizedTourId)) || "null");
      const normalized = normalizeCustomizationPayload(parsed);
      if (normalized?.originalTourId === normalizedTourId) {
        customizations.set(normalizedTourId, normalized);
        return normalized;
      }
    } catch {
      return null;
    }
    return null;
  }

  function saveCustomization(customization) {
    const normalized = normalizeCustomizationPayload(customization);
    if (!normalized) return false;
    customizations.set(normalized.originalTourId, normalized);
    if (canUseStorage) {
      try {
        window.localStorage.setItem(storageKey(normalized.originalTourId), JSON.stringify(normalized));
      } catch {
        // Local persistence is best effort; the active page state still works.
      }
    }
    return true;
  }

  function clearCustomization(tourId) {
    const normalizedTourId = normalizeText(tourId);
    const hadCustomization = customizations.has(normalizedTourId) || Boolean(loadStoredCustomization(normalizedTourId));
    customizations.delete(normalizedTourId);
    if (canUseStorage) {
      try {
        window.localStorage.removeItem(storageKey(normalizedTourId));
      } catch {
        // Ignore storage failures.
      }
    }
    return hadCustomization;
  }

  function draftCustomizationPayload() {
    if (!draft || !draft.timelineDays.length) return null;
    return {
      originalTourId: draft.tourId,
      timelineDays: draft.timelineDays.map((item) => ({
        id: item.id,
        timelineInstanceId: timelineItemKey(item),
        source: item.source,
        sourceTourId: item.sourceTourId,
        sourceDayId: item.sourceDayId,
        day: item.day
      }))
    };
  }

  function persistDraftCustomization() {
    if (!draft) return false;
    if (!draft.timelineDays.length || !draftHasCustomizedTimeline()) {
      return clearCustomization(draft.tourId);
    }
    return saveCustomization(draftCustomizationPayload());
  }

  function hasCustomization(tourId) {
    return Boolean(loadStoredCustomization(tourId));
  }

  function findCurrentDayForTimelineItem(item, baseTrip) {
    const sourceTourId = normalizeText(item?.sourceTourId);
    const sourceDayId = normalizeText(item?.sourceDayId);
    if (!sourceTourId || !sourceDayId) return null;
    const baseTourId = normalizeText(baseTrip?.id);
    const loadedTrips = typeof allTrips === "function" ? allTrips() : [];
    const sourceTrip = sourceTourId === baseTourId
      ? baseTrip
      : (typeof findTripById === "function" ? findTripById(sourceTourId) : null)
        || (Array.isArray(loadedTrips) ? loadedTrips.find((trip) => normalizeText(trip?.id) === sourceTourId) : null);
    const days = typeof travelPlanDays === "function" ? travelPlanDays(sourceTrip) : [];
    return (Array.isArray(days) ? days : []).find((day) => normalizeText(day?.id) === sourceDayId) || null;
  }

  function rehydratedTimelineDay(item, baseTrip) {
    const currentDay = findCurrentDayForTimelineItem(item, baseTrip);
    if (currentDay) return cloneJson(currentDay);
    const sourceTourId = normalizeText(item?.sourceTourId);
    const baseTourId = normalizeText(baseTrip?.id);
    const baseDays = typeof travelPlanDays === "function" ? travelPlanDays(baseTrip) : [];
    if (sourceTourId && sourceTourId === baseTourId && Array.isArray(baseDays) && baseDays.length) return null;
    return cloneJson(item?.day);
  }

  function activeDaysForTrip(trip) {
    const tourId = normalizeText(trip?.id);
    const customization = loadStoredCustomization(tourId);
    if (!customization) return typeof travelPlanDays === "function" ? travelPlanDays(trip) : [];
    return customization.timelineDays
      .map((item) => rehydratedTimelineDay(item, trip))
      .filter(Boolean)
      .map((day, index) => ({
        ...day,
        day_number: index + 1
      }));
  }

  function baseSelectedDaysForPdf(tourId) {
    const normalizedTourId = normalizeText(tourId);
    const trip = typeof findTripById === "function" ? findTripById(normalizedTourId) : null;
    const sourceTourId = normalizeText(trip?.id) || normalizedTourId;
    const days = typeof travelPlanDays === "function" ? travelPlanDays(trip) : [];
    return (Array.isArray(days) ? days : [])
      .map((day) => ({
        source_tour_id: sourceTourId,
        source_day_id: normalizeText(day?.id)
      }))
      .filter((item) => item.source_tour_id && item.source_day_id);
  }

  function selectedDaysForPdf(tourId) {
    const normalizedTourId = normalizeText(tourId);
    const customization = loadStoredCustomization(normalizedTourId);
    if (!customization) return baseSelectedDaysForPdf(normalizedTourId);
    return selectedDaysFromTimeline(customization.timelineDays);
  }

  function selectedDaysFromTimeline(timelineDays) {
    return (Array.isArray(timelineDays) ? timelineDays : []).map((item) => ({
      source_tour_id: item.sourceTourId,
      source_day_id: item.sourceDayId
    })).filter((item) => item.source_tour_id && item.source_day_id);
  }

  function timelineSignature(timelineDays) {
    return selectedDaysFromTimeline(timelineDays)
      .map((item) => `${item.source_tour_id}:${item.source_day_id}`)
      .join("|");
  }

  function uniqueOrderedTexts(values) {
    const seen = new Set();
    const result = [];
    for (const value of Array.isArray(values) ? values : []) {
      const text = compactText(value);
      const key = normalizeSearchText(text);
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
    return result;
  }

  function humanList(values) {
    const items = uniqueOrderedTexts(values);
    if (!items.length) return "";
    if (items.length === 1) return items[0];
    const andText = compactText(t("common.and", "and")) || "and";
    if (items.length === 2) return `${items[0]} ${andText} ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} ${andText} ${items[items.length - 1]}`;
  }

  function titleLocationLabelsFromDay(day) {
    const catalog = locationCatalogById(typeof destinationScopeCatalog === "function" ? destinationScopeCatalog() : null);
    const locationIds = [
      normalizeText(day?.primary_location_id),
      normalizeText(day?.secondary_location_id)
    ].filter(Boolean);
    const labels = [];
    for (const locationId of locationIds) {
      const location = catalog.get(locationId);
      if (location?.label) labels.push(location.label);
    }
    const explicit = day?.route_point || day?.routePoint;
    if (explicit?.label) labels.push(explicit.label);
    labels.push(resolveLocalizedField(day, "overnight_location", lang()));
    return uniqueOrderedTexts(labels);
  }

  function titleLocationLabelsFromItem(item) {
    const labels = [];
    for (const point of routePointEntriesForItem(item)) {
      labels.push(point?.label, point?.routePoint?.label);
    }
    labels.push(item?.locationLabel);
    if (!uniqueOrderedTexts(labels).length) {
      labels.push(...titleLocationLabelsFromDay(item?.day));
    }
    return uniqueOrderedTexts(labels);
  }

  function buildCustomizedTourTitleProposals(timelineDays) {
    const days = Array.isArray(timelineDays) ? timelineDays : [];
    const dayCount = days.length;
    if (!dayCount) return [];
    const routeLabel = humanList(
      uniqueOrderedTexts(days.flatMap(titleLocationLabelsFromItem))
        .slice(0, TOUR_CUSTOMIZE_TITLE_LOCATION_LIMIT)
    );
    const proposal = routeLabel || t("tour.customize.title_proposal_custom", "Custom Tour");
    return uniqueOrderedTexts([proposal]).slice(0, TOUR_CUSTOMIZE_TITLE_PROPOSAL_LIMIT);
  }

  function draftHasCustomizedTimeline() {
    if (!draft) return false;
    return timelineSignature(draft.timelineDays) !== timelineSignature(draft.originalTimelineDays);
  }

  function draftTitleProposals() {
    return draftHasCustomizedTimeline() ? buildCustomizedTourTitleProposals(draft.timelineDays) : [];
  }

  function draftTimelineTitle() {
    const proposedTitle = draftTitleProposals()[0] || "";
    const title = proposedTitle || normalizeText(draft?.tourTitle);
    return title
      ? t("tour.customize.timeline_named", "Your Itinerary: {name}", { name: title })
      : t("tour.customize.timeline", "Your Itinerary");
  }

  function closeActionLabel() {
    return draftHasCustomizedTimeline()
      ? t("tour.customize.confirm", "I am happy")
      : t("tour.customize.close", "Close");
  }

  function renderCloseActionButton() {
    const label = closeActionLabel();
    return `<button class="tour-customize__close" type="button" data-customize-close aria-label="${escapeAttr(label)}">${escapeHTML(label)}</button>`;
  }

  function refreshCloseActionDom() {
    if (!modal) return false;
    const closeButton = modal.querySelector("[data-customize-close]");
    if (!(closeButton instanceof HTMLElement)) return false;
    const label = closeActionLabel();
    closeButton.textContent = label;
    closeButton.setAttribute("aria-label", label);
    return true;
  }

  function tourTitleForTimeline(trip) {
    const currentLang = lang();
    return resolveLocalizedText(trip?.title_i18n, currentLang)
      || resolveLocalizedText(trip?.title, currentLang);
  }

  function customizedTitleForTrip(trip) {
    const tourId = normalizeText(trip?.id);
    const customization = loadStoredCustomization(tourId);
    if (!customization) return "";
    const timelineDays = customization.timelineDays.map((item) => ({
      ...item,
      day: rehydratedTimelineDay(item, trip)
    })).filter((item) => item.day);
    const originalTimelineDays = originalTimelineFromTrip(trip);
    if (timelineSignature(timelineDays) === timelineSignature(originalTimelineDays)) return "";
    return buildCustomizedTourTitleProposals(timelineDays)[0] || "";
  }

  function routePreviewForTrip(trip) {
    const tourId = normalizeText(trip?.id);
    const days = activeDaysForTrip(trip);
    const destinationCatalog = typeof destinationScopeCatalog === "function" ? destinationScopeCatalog() : null;
    const modules = days
      .map((day) => dayModuleFromDay({
        day,
        sourceTourId: tourId,
        originalTourId: tourId,
        lang: lang(),
        destinationCatalog
      }))
      .filter(Boolean);
    const groups = routeGroups(modules);
    return {
      points: routePolylinePoints(modules),
      path: routePathData(routeSequencePoints(modules)),
      groups: groups.map((group) => ({
        label: formatDayNumbers(group.dayNumbers),
        locationLabel: group.locationLabel || group.item.locationLabel,
        x: group.mapPoint.x,
        y: group.mapPoint.y
      }))
    };
  }

  async function candidateModulesForTrip(baseTrip) {
    const currentLang = lang();
    const baseTourId = normalizeText(baseTrip?.id);
    const destinationCatalog = typeof destinationScopeCatalog === "function" ? destinationScopeCatalog() : null;
    const trips = typeof allTrips === "function" ? allTrips() : [];
    await Promise.all((Array.isArray(trips) ? trips : []).map(async (trip) => {
      const tripId = normalizeText(trip?.id);
      if (!tripId || (typeof travelPlanDays === "function" && travelPlanDays(trip).length)) return;
      try {
        await ensureTourDetailsLoaded?.(tripId);
      } catch {
        // Optional days are opportunistic; skip tours whose details fail to load.
      }
    }));
    const modules = (Array.isArray(trips) ? trips : []).flatMap((trip) => {
      const sourceTourId = normalizeText(trip?.id);
      return (typeof travelPlanDays === "function" ? travelPlanDays(trip) : [])
        .map((day) => dayModuleFromDay({ day, sourceTourId, originalTourId: baseTourId, lang: currentLang, destinationCatalog }))
        .filter(Boolean);
    });
    return sortModulesNorthToSouth(modules);
  }

  function originalTimelineFromTrip(baseTrip, modules = []) {
    const baseTourId = normalizeText(baseTrip?.id);
    const destinationCatalog = typeof destinationScopeCatalog === "function" ? destinationScopeCatalog() : null;
    const sourceModules = Array.isArray(modules) && modules.length
      ? modules
      : (typeof travelPlanDays === "function" ? travelPlanDays(baseTrip) : [])
        .map((day) => dayModuleFromDay({
          day,
          sourceTourId: baseTourId,
          originalTourId: baseTourId,
          lang: lang(),
          destinationCatalog
        }))
        .filter(Boolean);
    const originalModules = sortModulesNorthToSouth(sourceModules
      .filter((item) => item.sourceTourId === baseTourId)
    );
    if (originalModules.length) return originalModules;
    return (typeof travelPlanDays === "function" ? travelPlanDays(baseTrip) : [])
      .map((day) => {
        const sourceDayId = normalizeText(day?.id);
        return sourceDayId ? {
          id: `${baseTourId}:${sourceDayId}`,
          sourceTourId: baseTourId,
          sourceDayId,
          day
        } : null;
      })
      .filter(Boolean);
  }

  function initialTimelineFromTrip(baseTrip, modules) {
    const baseTourId = normalizeText(baseTrip?.id);
    const stored = loadStoredCustomization(baseTourId);
    if (stored) {
      const byId = new Map(modules.map((item) => [item.id, item]));
      const destinationCatalog = typeof destinationScopeCatalog === "function" ? destinationScopeCatalog() : null;
      const timelineDays = stored.timelineDays
        .map((item) => {
          const module = byId.get(`${item.sourceTourId}:${item.sourceDayId}`) || dayModuleFromDay({
            day: item.day,
            sourceTourId: item.sourceTourId,
            originalTourId: baseTourId,
            lang: lang(),
            destinationCatalog
          });
          return timelineItemFromModule(module, item.timelineInstanceId || item.id);
        })
        .filter(Boolean);
      if (timelineDays.length) return timelineDays;
    }
    return originalTimelineFromTrip(baseTrip, modules);
  }

  function optionalModules(modules, originalTimelineDays) {
    const originalDayIds = new Set((Array.isArray(originalTimelineDays) ? originalTimelineDays : [])
      .map((item) => item.id));
    return sortModulesNorthToSouth(modules.filter((item) => !originalDayIds.has(item.id)));
  }

  function routeGroups(timelineDays) {
    const groups = [];
    const byPoint = new Map();
    timelineDays.forEach((item, index) => {
      for (const point of routePointEntriesForItem(item)) {
        const key = routeKeyForPoint(point?.routePoint);
        if (!key) continue;
        if (!byPoint.has(key)) {
          const group = {
            key,
            item,
            mapPoint: point.mapPoint,
            locationLabel: normalizeText(point.label) || item.locationLabel,
            dayNumbers: [],
            visits: []
          };
          byPoint.set(key, group);
          groups.push(group);
        }
        const group = byPoint.get(key);
        if (!group.dayNumbers.includes(index + 1)) group.dayNumbers.push(index + 1);
        group.visits.push({ item, routePoint: point.routePoint });
      }
    });
    return groups;
  }

  function routePointEntriesForItem(item) {
    return Array.isArray(item?.routePoints) && item.routePoints.length
      ? item.routePoints
      : [{ routePoint: item?.routePoint, mapPoint: item?.mapPoint, label: item?.locationLabel }];
  }

  function routeKeyForItem(item) {
    return routeKeyForPoint(item?.routePoint);
  }

  function formatDayNumbers(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const ranges = [];
    for (let index = 0; index < sorted.length; index += 1) {
      const start = sorted[index];
      let end = start;
      while (sorted[index + 1] === end + 1) {
        end = sorted[index + 1];
        index += 1;
      }
      ranges.push(start === end ? String(start) : `${start}-${end}`);
    }
    return ranges.join(", ");
  }

  function routePolylinePoints(timelineDays) {
    return routeSequencePoints(timelineDays)
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");
  }

  function routeSequencePoints(timelineDays) {
    const points = [];
    for (const item of Array.isArray(timelineDays) ? timelineDays : []) {
      for (const point of routePointEntriesForItem(item)) {
        const x = Number(point?.mapPoint?.x);
        const y = Number(point?.mapPoint?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const previous = points[points.length - 1];
        if (!previous || previous.x.toFixed(2) !== x.toFixed(2) || previous.y.toFixed(2) !== y.toFixed(2)) {
          points.push({ x, y });
        }
      }
    }
    return points;
  }

  function clampRouteCoordinate(value) {
    return Math.min(98, Math.max(2, value));
  }

  function routePathData(points) {
    const routePoints = Array.isArray(points) ? points : [];
    if (!routePoints.length) return "";
    const commands = [`M ${routePoints[0].x.toFixed(2)} ${routePoints[0].y.toFixed(2)}`];
    for (let index = 1; index < routePoints.length; index += 1) {
      const start = routePoints[index - 1];
      const end = routePoints[index];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (!distance) continue;
      const bend = Math.min(7, Math.max(2.2, distance * 0.13));
      const side = index % 2 === 0 ? -1 : 1;
      const controlX = clampRouteCoordinate((start.x + end.x) / 2 + (-dy / distance) * bend * side);
      const controlY = clampRouteCoordinate((start.y + end.y) / 2 + (dx / distance) * bend * side);
      commands.push(`Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
    }
    return commands.join(" ");
  }

  function currentMapZoom() {
    const zoom = draft?.mapZoom;
    const x = Number(zoom?.x);
    const y = Number(zoom?.y);
    return {
      zoomed: Boolean(zoom?.zoomed),
      x: Number.isFinite(x) ? x : 50,
      y: Number.isFinite(y) ? y : 50
    };
  }

  function displayedMapPoint(mapPoint) {
    const x = Number(mapPoint?.x);
    const y = Number(mapPoint?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    const zoom = currentMapZoom();
    if (!zoom.zoomed) return { x, y };
    return {
      x: zoom.x + TOUR_CUSTOMIZE_MAP_ZOOM_FACTOR * (x - zoom.x),
      y: zoom.y + TOUR_CUSTOMIZE_MAP_ZOOM_FACTOR * (y - zoom.y)
    };
  }

  function clampMapZoomCenter(value) {
    return Math.min(TOUR_CUSTOMIZE_MAP_ZOOM_MAX_CENTER, Math.max(TOUR_CUSTOMIZE_MAP_ZOOM_MIN_CENTER, value));
  }

  function displayedRouteGroups(groups) {
    return groups.map((group) => ({
      ...group,
      mapPoint: displayedMapPoint(group.mapPoint)
    }));
  }

  function displayedRoutePoints(points) {
    return points.map((point) => displayedMapPoint(point));
  }

  function renderMap() {
    const sourceGroups = routeGroups(draft.timelineDays);
    const groups = displayedRouteGroups(sourceGroups);
    const points = displayedRoutePoints(routeSequencePoints(draft.timelineDays));
    const zoom = currentMapZoom();
    const zoomClass = zoom.zoomed ? " is-zoomed" : "";
    const zoomStyle = zoom.zoomed
      ? ` style="--tour-customize-map-zoom-x:${zoom.x.toFixed(2)}%;--tour-customize-map-zoom-y:${zoom.y.toFixed(2)}%;"`
      : "";
    const path = routePathData(points);
    return `
      <section class="tour-customize-map${zoomClass}"${zoomStyle} aria-label="${escapeAttr(t("tour.customize.map", "Route map"))}">
        <div class="tour-customize-map__region" aria-hidden="true"></div>
        <button class="tour-customize-map__zoom-out" type="button" data-customize-map-zoom-out aria-label="${escapeAttr(t("tour.customize.zoom_out", "Zoom out"))}" title="${escapeAttr(t("tour.customize.zoom_out", "Zoom out"))}">
          <span aria-hidden="true"></span>
        </button>
        <svg class="tour-customize-map__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${path ? `<path d="${escapeAttr(path)}" fill="none" vector-effect="non-scaling-stroke" />` : ""}
        </svg>
        ${groups.map((group) => {
          const label = formatDayNumbers(group.dayNumbers);
          const location = group.locationLabel || group.item.locationLabel;
          const aria = t("tour.customize.marker_label", "Days {days}, {location}", { days: label, location });
          return `
            <button class="tour-customize-map__marker" type="button" data-customize-route-key="${escapeAttr(group.key)}" style="left:${group.mapPoint.x}%;top:${group.mapPoint.y}%;" aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}">
              ${escapeHTML(label)}
            </button>
          `;
        }).join("")}
      </section>
    `;
  }

  function optionalLocationGroupKey(item) {
    return modulePrimaryLocationKey(item) || normalizeSearchText(item?.locationLabel);
  }

  function renderDayCard(item, {
    className = "tour-customize-option",
    dataAttributeName = "data-customize-option-id",
    dataAttributeValue = item?.id,
    startsLocationGroup = false,
    controls = ""
  } = {}) {
    const locationBreakClass = startsLocationGroup ? " tour-customize-option--location-break" : "";
    const imageUrls = Array.isArray(item?.imageUrls)
      ? item.imageUrls.map((url) => normalizeText(url)).filter(Boolean)
      : (item?.thumbnailUrl ? [normalizeText(item.thumbnailUrl)] : []);
    const imageCount = imageUrls.length;
    const imageLabel = imageCount > 1
      ? t("tour.customize.next_day_image", "Show next day image")
      : t("tour.customize.day_image", "Day image");
    return `
      <article class="${escapeAttr(className)}${locationBreakClass}" ${dataAttributeName}="${escapeAttr(dataAttributeValue)}">
        ${item.thumbnailUrl
          ? `<button class="tour-customize-option__image" type="button" data-customize-card-image data-customize-image-index="0" data-customize-image-count="${escapeAttr(String(imageCount))}" aria-label="${escapeAttr(imageLabel)}">
              <img src="${escapeAttr(item.thumbnailUrl)}" alt="" loading="lazy" draggable="false" />
            </button>`
          : `<span class="tour-customize-option__thumb" aria-hidden="true"></span>`}
        <div class="tour-customize-option__body">
          <p class="tour-customize-option__location">${escapeHTML(item.locationLabel)}</p>
          <h4>${escapeHTML(item.title)}</h4>
          ${item.summary ? `<p>${escapeHTML(item.summary)}</p>` : ""}
        </div>
        <span class="tour-customize-option__drag-dots" aria-hidden="true"></span>
        ${controls}
      </article>
    `;
  }

  function renderOptionalCard(item, startsLocationGroup = false) {
    return renderDayCard(item, { startsLocationGroup });
  }

  function renderOptionalCards(optionalDays) {
    return optionalDays.map((item, index) => {
      const previous = index > 0 ? optionalDays[index - 1] : null;
      const startsLocationGroup = Boolean(previous)
        && optionalLocationGroupKey(item) !== optionalLocationGroupKey(previous);
      return renderOptionalCard(item, startsLocationGroup);
    }).join("");
  }

  function renderTimelineItem(item, index) {
    return renderDayCard(item, {
      className: "tour-customize-option tour-customize-timeline__item",
      dataAttributeName: "data-customize-timeline-id",
      dataAttributeValue: timelineItemKey(item),
      controls: `
        <span class="tour-customize-timeline__day">${escapeHTML(t("tour.customize.day", "Day {day}", { day: String(index + 1) }))}</span>
        <span class="tour-customize-timeline__move-placeholder" aria-hidden="true">
          <span>+</span>
          <strong>${escapeHTML(t("tour.customize.move_here", "move here"))}</strong>
        </span>
      `
    });
  }

  function renderModalBody() {
    const optionalDays = optionalModules(draft.modules, draft.originalTimelineDays);
    const timelineTitle = draftTimelineTitle();
    return `
      <div class="tour-customize__dialog" role="dialog" aria-modal="true" aria-labelledby="tour_customize_title">
        <header class="tour-customize__header">
          <div>
            <h2 id="tour_customize_title">${escapeHTML(t("tour.customize.title", "Customize this tour"))}</h2>
            <p>${escapeHTML(t("tour.customize.subtitle", "Adapt the day-by-day route before previewing your trip."))}</p>
          </div>
          <div class="tour-customize__header-actions">
            <button class="btn btn-secondary" type="button" data-customize-reset>${escapeHTML(t("tour.customize.reset", "Reset tour"))}</button>
            ${renderCloseActionButton()}
          </div>
        </header>
        <div class="tour-customize__workspace">
          ${renderMap()}
          <section class="tour-customize-options" aria-label="${escapeAttr(t("tour.customize.optional_days", "Optional days"))}">
            <h3>${escapeHTML(t("tour.customize.optional_days", "Optional days"))}</h3>
            <div class="tour-customize-options__list">
              ${optionalDays.length
                ? renderOptionalCards(optionalDays)
                : `<p class="tour-customize__empty">${escapeHTML(t("tour.customize.no_optional_days", "No optional days are available for this route yet."))}</p>`}
            </div>
            </section>
            <section class="tour-customize-timeline" aria-label="${escapeAttr(timelineTitle)}">
              <div class="tour-customize-timeline__header">
            <h3>${escapeHTML(timelineTitle)}</h3>
          </div>
          <div class="tour-customize-timeline__list" data-customize-timeline>
                ${draft.timelineDays.length
                ? draft.timelineDays.map(renderTimelineItem).join("")
                : `<p class="tour-customize__empty">${escapeHTML(t("tour.customize.empty_timeline", "Add at least one day to keep customizing."))}</p>`}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderModal() {
    if (!modal) return;
    modal.innerHTML = renderModalBody();
    bindModalEvents();
  }

  function refreshMapDom() {
    if (!modal) return false;
    const currentMap = modal.querySelector(".tour-customize-map");
    if (!(currentMap instanceof HTMLElement)) return false;
    currentMap.outerHTML = renderMap();
    bindMapZoom(modal);
    return true;
  }

  function refreshOptionsDom() {
    if (!modal || !draft) return false;
    const optionsList = modal.querySelector(".tour-customize-options__list");
    if (!(optionsList instanceof HTMLElement)) return false;
    const optionalDays = optionalModules(draft.modules, draft.originalTimelineDays);
    optionsList.innerHTML = optionalDays.length
      ? renderOptionalCards(optionalDays)
      : `<p class="tour-customize__empty">${escapeHTML(t("tour.customize.no_optional_days", "No optional days are available for this route yet."))}</p>`;
    optionsList.querySelectorAll("[data-customize-option-id]").forEach((element) => {
      if (element instanceof HTMLElement) bindDraggableElement(element, modal);
    });
    return true;
  }

  function refreshTimelineTitleDom() {
    if (!modal || !draft) return false;
    const title = modal.querySelector(".tour-customize-timeline__header h3");
    const section = modal.querySelector(".tour-customize-timeline");
    if (!(title instanceof HTMLElement)) return false;
    const timelineTitle = draftTimelineTitle();
    title.textContent = timelineTitle;
    if (section instanceof HTMLElement) section.setAttribute("aria-label", timelineTitle);
    return true;
  }

  function insertTimelineItemDom(item, insertIndex) {
    if (!modal || !draft) return false;
    const timeline = modal.querySelector("[data-customize-timeline]");
    if (!(timeline instanceof HTMLElement)) return false;
    timeline.querySelector(".tour-customize__empty")?.remove();
    const template = document.createElement("template");
    template.innerHTML = renderTimelineItem(item, insertIndex).trim();
    const element = template.content.firstElementChild;
    if (!(element instanceof HTMLElement)) return false;
    const items = timelineItemElements(timeline);
    timeline.insertBefore(element, items[insertIndex] || null);
    bindDraggableElement(element, modal);
    updateTimelineDayLabels(timeline);
    return true;
  }

  function refreshAfterTimelineChange() {
    refreshMapDom();
    refreshOptionsDom();
    refreshTimelineTitleDom();
    refreshCloseActionDom();
  }

  function addDay(itemId, insertIndex = draft.timelineDays.length) {
    if (!draft) return false;
    const item = timelineItemFromModule(draft.modules.find((candidate) => candidate.id === itemId));
    if (!item) return false;
    const next = [...draft.timelineDays];
    const boundedInsertIndex = Math.min(Math.max(0, insertIndex), next.length);
    next.splice(boundedInsertIndex, 0, item);
    draft.timelineDays = next;
    if (insertTimelineItemDom(item, boundedInsertIndex)) {
      refreshAfterTimelineChange();
    } else {
      renderModal();
    }
    return true;
  }

  function animateFloatingCardToRect(card, targetRect, {
    duration = TOUR_CUSTOMIZE_DROP_ANIMATION_MS,
    removeAfter = true,
    onComplete = null
  } = {}) {
    if (!(card instanceof HTMLElement) || !targetRect) {
      onComplete?.();
      return;
    }
    const startRect = card.getBoundingClientRect();
    card.style.left = `${startRect.left}px`;
    card.style.top = `${startRect.top}px`;
    card.style.width = `${startRect.width}px`;
    card.style.height = `${startRect.height}px`;
    card.style.transition = [
      `left ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      `top ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      `width ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      `height ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      `opacity ${duration}ms ease`
    ].join(", ");
    card.offsetHeight;
    window.requestAnimationFrame(() => {
      card.style.left = `${targetRect.left}px`;
      card.style.top = `${targetRect.top}px`;
      card.style.width = `${targetRect.width}px`;
      card.style.height = `${targetRect.height}px`;
      card.style.transform = "rotate(0deg)";
      card.style.opacity = "1";
    });
    window.setTimeout(() => {
      if (removeAfter) card.remove();
      onComplete?.();
    }, duration + 30);
  }

  function animateFloatingCardSmokeDissolve(card, {
    duration = TOUR_CUSTOMIZE_SMOKE_ANIMATION_MS,
    onComplete = null
  } = {}) {
    if (!(card instanceof HTMLElement)) {
      onComplete?.();
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      card.remove();
      onComplete?.();
      return;
    }
    const rect = card.getBoundingClientRect();
    card.style.left = `${rect.left}px`;
    card.style.top = `${rect.top}px`;
    card.style.width = `${rect.width}px`;
    card.style.height = `${rect.height}px`;
    card.style.transition = "none";
    card.classList.remove("is-delete-target");
    card.classList.add("is-smoke-dissolving");
    [
      ["-28px", "-16px", "1.25", "0ms"],
      ["-8px", "-28px", "1.45", "35ms"],
      ["18px", "-20px", "1.35", "65ms"],
      ["31px", "2px", "1.18", "25ms"],
      ["8px", "18px", "1.3", "80ms"],
      ["-22px", "14px", "1.15", "55ms"]
    ].forEach(([x, y, scale, delay], index) => {
      const puff = document.createElement("span");
      puff.className = "tour-customize-smoke-puff";
      puff.style.setProperty("--smoke-x", x);
      puff.style.setProperty("--smoke-y", y);
      puff.style.setProperty("--smoke-scale", scale);
      puff.style.animationDelay = delay;
      puff.setAttribute("aria-hidden", "true");
      puff.dataset.smokePuff = String(index + 1);
      card.appendChild(puff);
    });
    window.setTimeout(() => {
      card.remove();
      onComplete?.();
    }, duration + 40);
  }

  function optionsReturnTargetRect() {
    const optionsList = modal?.querySelector?.(".tour-customize-options__list");
    if (!(optionsList instanceof HTMLElement)) return null;
    const firstOption = optionsList.querySelector("[data-customize-option-id]");
    if (firstOption instanceof HTMLElement) return firstOption.getBoundingClientRect();
    const rect = optionsList.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      left: rect.left,
      top: rect.top,
      width: TOUR_CUSTOMIZE_CARD_WIDTH_PX,
      height: TOUR_CUSTOMIZE_CARD_HEIGHT_PX
    };
  }

  function removeDay(itemId, { sourceElement = null } = {}) {
    if (!draft) return;
    const timelineKey = normalizeText(itemId);
    const commitRemoval = () => {
      draft.timelineDays = draft.timelineDays.filter((item) => timelineItemKey(item) !== timelineKey);
      renderModal();
    };
    if (!(sourceElement instanceof HTMLElement)) {
      commitRemoval();
      return;
    }
    const targetRect = optionsReturnTargetRect();
    if (!targetRect) {
      commitRemoval();
      return;
    }
    const rect = sourceElement.getBoundingClientRect();
    const clone = sourceElement.cloneNode(true);
    clone.classList.add("tour-customize-drag-ghost");
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("data-customize-timeline-id");
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    document.body.appendChild(clone);
    sourceElement.classList.add("is-dragging");
    animateFloatingCardToRect(clone, targetRect, {
      duration: TOUR_CUSTOMIZE_DELETE_ANIMATION_MS,
      onComplete: commitRemoval
    });
  }

  function cleanupMapPan() {
    if (activeMapPan?.map instanceof HTMLElement) {
      activeMapPan.map.classList.remove("is-panning");
      try {
        activeMapPan.map.releasePointerCapture?.(activeMapPan.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
    }
    activeMapPan = null;
  }

  function closeModal({ restoreFocus = true, persistDraft = true } = {}) {
    if (activePointerDrag) cleanupPointerDrag({ animateCancel: false });
    const shouldRefreshTrips = persistDraft ? persistDraftCustomization() : false;
    if (modal?.parentNode) modal.parentNode.removeChild(modal);
    modal = null;
    draft = null;
    activeDragPayload = null;
    activeDropIndex = null;
    activePointerDrag = null;
    cleanupMapPan();
    document.documentElement.classList.remove("tour-customize-modal-open");
    document.documentElement.classList.remove("tour-customize-pointer-dragging");
    document.documentElement.classList.remove("tour-customize-sticky-dragging");
    if (restoreFocus && lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
    if (shouldRefreshTrips) renderVisibleTrips?.();
  }

  function resetDraftToOriginal() {
    if (!draft) return;
    clearCustomization(draft.tourId);
    draft.originalTimelineDays = originalTimelineFromTrip({ id: draft.tourId }, draft.modules);
    draft.timelineDays = draft.originalTimelineDays;
    renderModal();
  }

  function dragPayloadFromEvent(event) {
    if (activeDragPayload) return activeDragPayload;
    try {
      const payload = JSON.parse(event.dataTransfer?.getData("text/plain") || "null");
      const id = normalizeText(payload?.id);
      const kind = payload?.kind === "timeline" ? "timeline" : payload?.kind === "option" ? "option" : "";
      return kind && id ? { kind, id } : null;
    } catch {
      return null;
    }
  }

  function timelineItemElements(timeline) {
    return [...timeline.querySelectorAll("[data-customize-timeline-id]")]
      .filter((element) => element instanceof HTMLElement);
  }

  function elementRectWithoutInlineTransform(element) {
    if (!(element instanceof HTMLElement)) return null;
    const previousTransition = element.style.transition;
    const previousTransform = element.style.transform;
    element.style.transition = "none";
    element.style.transform = "";
    const rect = element.getBoundingClientRect();
    element.style.transform = previousTransform;
    element.style.transition = previousTransition;
    return rect;
  }

  function timelineInsertIndex(timeline, clientX) {
    const items = timelineItemElements(timeline);
    for (let index = 0; index < items.length; index += 1) {
      const isActiveTimelineItem = activePointerDrag?.kind === "timeline"
        && items[index].getAttribute("data-customize-timeline-id") === activePointerDrag.id;
      const rect = isActiveTimelineItem
        ? elementRectWithoutInlineTransform(items[index])
        : items[index].getBoundingClientRect();
      if (!rect) continue;
      if (clientX < rect.left + rect.width / 2) return index;
    }
    return items.length;
  }

  function clearDropSlot(timeline) {
    timeline?.querySelector(".tour-customize-timeline__drop-slot")?.remove();
    timeline?.querySelectorAll(".tour-customize-timeline__item.is-move-placeholder").forEach((element) => {
      element.classList.remove("is-move-placeholder");
    });
    timeline?.closest(".tour-customize-timeline")?.classList.remove("tour-customize-timeline--drop-active");
    activeDropIndex = null;
  }

  function renderDropSlot(timeline, insertIndex, variant = "day") {
    if (!draft || !(timeline instanceof HTMLElement)) return;
    const existing = timeline.querySelector(".tour-customize-timeline__drop-slot");
    const slot = existing instanceof HTMLElement ? existing : document.createElement("div");
    const normalizedVariant = variant === "day" ? "day" : "move";
    let boundedIndex = Math.min(Math.max(0, insertIndex), draft.timelineDays.length);
    if (normalizedVariant === "move") {
      const draggedId = activePointerDrag?.kind === "timeline"
        ? activePointerDrag.id
        : activeDragPayload?.kind === "timeline"
          ? activeDragPayload.id
          : "";
      const source = draggedId
        ? timeline.querySelector(`[data-customize-timeline-id="${CSS.escape(draggedId)}"]`)
        : null;
      if (!(source instanceof HTMLElement)) {
        renderDropSlot(timeline, insertIndex, "day");
        return;
      }
      timeline.querySelectorAll(".tour-customize-timeline__item.is-move-placeholder").forEach((element) => {
        if (element !== source) element.classList.remove("is-move-placeholder");
      });
      source.classList.add("is-move-placeholder");
      source.style.removeProperty("transform");
      source.style.removeProperty("z-index");
      ensureDragGhostCardVisible(activePointerDrag);
      const currentIndex = draft.timelineDays.findIndex((item) => timelineItemKey(item) === draggedId);
      boundedIndex = currentIndex >= 0 ? currentIndex : boundedIndex;
    }
    slot.className = "tour-customize-timeline__drop-slot";
    if (!existing || slot.getAttribute("data-customize-drop-variant") !== normalizedVariant) {
      const label = normalizedVariant === "move"
        ? t("tour.customize.move_here", "Move here")
        : t("tour.customize.drop_here", "Drop here");
      slot.setAttribute("aria-hidden", "true");
      slot.innerHTML = `<span>+</span><strong>${escapeHTML(label)}</strong>`;
    }
    slot.setAttribute("data-customize-drop-index", String(boundedIndex));
    slot.setAttribute("data-customize-drop-variant", normalizedVariant);
    const items = timelineItemElements(timeline);
    timeline.insertBefore(slot, items[boundedIndex] || null);
    timeline.closest(".tour-customize-timeline")?.classList.add("tour-customize-timeline--drop-active");
    activeDropIndex = boundedIndex;
  }

  function updateTimelineDayLabels(timeline) {
    const items = timelineItemElements(timeline);
    const hasDeletePreview = items.some((element) => element.classList.contains("is-delete-candidate"));
    let visibleIndex = 0;
    let lastVisibleItem = null;
    items.forEach((element) => {
      element.classList.remove("is-delete-preview-terminal");
      if (element.classList.contains("is-delete-candidate")) return;
      visibleIndex += 1;
      lastVisibleItem = element;
      const day = element.querySelector(".tour-customize-timeline__day");
      if (day) {
        day.textContent = t("tour.customize.day", "Day {day}", { day: String(visibleIndex) });
      }
    });
    if (hasDeletePreview && lastVisibleItem) lastVisibleItem.classList.add("is-delete-preview-terminal");
  }

  function syncTimelineDomOrder(timeline) {
    const byId = new Map(timelineItemElements(timeline).map((element) => [
      element.getAttribute("data-customize-timeline-id"),
      element
    ]));
    draft.timelineDays.forEach((item) => {
      const element = byId.get(timelineItemKey(item));
      if (element) timeline.appendChild(element);
    });
    updateTimelineDayLabels(timeline);
  }

  function animateTimelineDomOrder(timeline, applyOrderChange) {
    if (!(timeline instanceof HTMLElement) || typeof applyOrderChange !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      applyOrderChange();
      return;
    }
    const before = new Map(timelineItemElements(timeline).map((element) => [
      element.getAttribute("data-customize-timeline-id"),
      element.getBoundingClientRect()
    ]));
    applyOrderChange();
    const movingElements = [];
    timelineItemElements(timeline).forEach((element) => {
      if (activePointerDrag?.kind === "timeline" && element.getAttribute("data-customize-timeline-id") === activePointerDrag.id) return;
      const previousRect = before.get(element.getAttribute("data-customize-timeline-id"));
      if (!previousRect) return;
      const nextRect = element.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;
      element.classList.remove("is-reordering");
      element.style.transition = "none";
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      movingElements.push(element);
    });
    if (!movingElements.length) return;
    timeline.offsetHeight;
    movingElements.forEach((element) => {
      element.classList.add("is-reordering");
      element.style.removeProperty("transition");
      element.style.removeProperty("transform");
      window.setTimeout(() => {
        element.classList.remove("is-reordering");
      }, TOUR_CUSTOMIZE_REORDER_ANIMATION_MS + 40);
    });
  }

  function reorderTimelineDuringDrag(timeline, draggedId, insertIndex) {
    if (!draft || !(timeline instanceof HTMLElement)) return false;
    const currentIndex = draft.timelineDays.findIndex((item) => timelineItemKey(item) === draggedId);
    if (currentIndex < 0) return false;
    const boundedInsertIndex = Math.min(Math.max(0, insertIndex), draft.timelineDays.length);
    const nextIndex = boundedInsertIndex > currentIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
    if (nextIndex < 0 || nextIndex >= draft.timelineDays.length || nextIndex === currentIndex) return false;
    const next = [...draft.timelineDays];
    const [item] = next.splice(currentIndex, 1);
    next.splice(nextIndex, 0, item);
    draft.timelineDays = next;
    animateTimelineDomOrder(timeline, () => syncTimelineDomOrder(timeline));
    return true;
  }

  function autoScrollTimelineDuringDrag(timeline, event) {
    const rect = timeline.getBoundingClientRect();
    const edge = 44;
    if (event.clientX < rect.left + edge) {
      timeline.scrollLeft -= Math.ceil((rect.left + edge - event.clientX) / 4);
    } else if (event.clientX > rect.right - edge) {
      timeline.scrollLeft += Math.ceil((event.clientX - (rect.right - edge)) / 4);
    }
  }

  function isNearTimeline(timeline, event) {
    const rect = timeline.getBoundingClientRect();
    const padding = 72;
    return event.clientX >= rect.left - padding
      && event.clientX <= rect.right + padding
      && event.clientY >= rect.top - padding
      && event.clientY <= rect.bottom + padding;
  }

  function dropIntoTimeline(event, timeline) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayloadFromEvent(event);
    const id = normalizeText(payload?.id);
    if (!draft || !id) return;
    const insertIndex = Number.isInteger(activeDropIndex)
      ? activeDropIndex
      : timelineInsertIndex(timeline, event.clientX);
    clearDropSlot(timeline);
    activeDragPayload = null;
    if (payload.kind === "option") {
      addDay(id, insertIndex);
      return;
    }
    if (payload.kind === "timeline") {
      updateTimelineDayLabels(timeline);
      refreshAfterTimelineChange();
    }
  }

  function moveDragGhost(event) {
    if (!activePointerDrag?.ghost) return;
    ensureDragGhostCardVisible(activePointerDrag);
    const nextTop = event.clientY - activePointerDrag.offsetY;
    const nextLeft = event.clientX - activePointerDrag.offsetX;
    activePointerDrag.ghost.style.left = `${nextLeft}px`;
    activePointerDrag.ghost.style.top = `${nextTop}px`;
    updateTimelineDeleteTarget(activePointerDrag);
    if (activePointerDrag.kind === "timeline" && activePointerDrag.source instanceof HTMLElement) {
      const source = activePointerDrag.source;
      if (activePointerDrag.deleteActive || source.classList.contains("is-move-placeholder")) {
        source.style.removeProperty("transform");
        source.style.removeProperty("z-index");
        return;
      }
      const baseRect = elementRectWithoutInlineTransform(source);
      if (!baseRect) return;
      source.style.transition = "none";
      source.style.zIndex = "20";
      source.style.transform = `translate3d(${nextLeft - baseRect.left}px, ${nextTop - baseRect.top}px, 0)`;
    }
  }

  function ensureDragGhostCardVisible(pointerDrag) {
    if (!(pointerDrag?.ghost instanceof HTMLElement)) return;
    const ghost = pointerDrag.ghost;
    ghost.classList.add("tour-customize-drag-ghost--card");
    ghost.classList.remove("is-move-placeholder");
    ghost.querySelector(".tour-customize-timeline__move-placeholder")?.remove();
    ghost.style.opacity = "1";
    ghost.style.visibility = "visible";
  }

  function updateTimelineDeleteTarget(pointerDrag) {
    if (pointerDrag?.kind !== "timeline" || !(pointerDrag.timeline instanceof HTMLElement) || !(pointerDrag.ghost instanceof HTMLElement)) return false;
    const timelineRect = pointerDrag.timeline.getBoundingClientRect();
    const ghostRect = pointerDrag.ghost.getBoundingClientRect();
    const isDeleteTarget = ghostRect.top < timelineRect.top - TOUR_CUSTOMIZE_TIMELINE_DELETE_DISTANCE_PX;
    const sourceById = normalizeText(pointerDrag.id)
      ? pointerDrag.timeline.querySelector(`[data-customize-timeline-id="${CSS.escape(pointerDrag.id)}"]`)
      : null;
    const source = sourceById instanceof HTMLElement
      ? sourceById
      : pointerDrag.source instanceof HTMLElement
        ? pointerDrag.source
        : null;
    const deletePreviewChanged = source instanceof HTMLElement
      && source.classList.contains("is-delete-candidate") !== isDeleteTarget;
    pointerDrag.deleteActive = isDeleteTarget;
    pointerDrag.ghost.classList.toggle("is-delete-target", isDeleteTarget);
    if (source instanceof HTMLElement) {
      source.classList.toggle("is-delete-candidate", isDeleteTarget);
      if (isDeleteTarget) {
        source.classList.remove("is-move-placeholder");
        source.style.removeProperty("transform");
        source.style.removeProperty("z-index");
      }
      if (deletePreviewChanged) updateTimelineDayLabels(pointerDrag.timeline);
    }
    return isDeleteTarget;
  }

  function clearMapDragHighlight() {
    modal?.querySelectorAll(".tour-customize-map__marker.is-drag-location").forEach((marker) => {
      marker.classList.remove("is-drag-location");
    });
    modal?.querySelector("[data-customize-drag-map-marker]")?.remove();
  }

  function itemById(itemId) {
    const id = normalizeText(itemId);
    if (!id || !draft) return null;
    return draft.timelineDays.find((item) => timelineItemKey(item) === id)
      || draft.modules.find((item) => item.id === id)
      || null;
  }

  function imageUrlsForItem(item) {
    const sourceUrls = Array.isArray(item?.imageUrls) && item.imageUrls.length
      ? item.imageUrls
      : customerVisibleDayImageUrls(item?.day);
    const seen = new Set();
    const urls = [];
    for (const sourceUrl of sourceUrls) {
      const url = normalizeText(sourceUrl);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    return urls;
  }

  function itemForImageButton(imageButton) {
    if (!(imageButton instanceof Element)) return null;
    const card = imageButton.closest("[data-customize-option-id], [data-customize-timeline-id]");
    if (!(card instanceof HTMLElement)) return null;
    return itemById(
      card.getAttribute("data-customize-option-id")
      || card.getAttribute("data-customize-timeline-id")
    );
  }

  function currentCardImageIndex(imageButton, urls, currentSrc) {
    const storedIndex = Number.parseInt(imageButton?.dataset?.customizeImageIndex || "", 10);
    if (Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < urls.length) {
      return storedIndex;
    }
    const currentIndex = urls.indexOf(normalizeText(currentSrc));
    return currentIndex >= 0 ? currentIndex : 0;
  }

  function animateCardImageSwap(imageButton, img, nextUrl) {
    if (!(imageButton instanceof HTMLElement) || !(img instanceof HTMLElement) || !nextUrl) return;
    const previousSrc = normalizeText(img.getAttribute("src"));
    imageButton.querySelectorAll(".tour-customize-option__image-dissolve").forEach((element) => {
      element.remove();
    });
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!previousSrc || reduceMotion) {
      img.setAttribute("src", nextUrl);
      return;
    }
    const overlay = img.cloneNode(false);
    if (overlay instanceof HTMLElement) {
      overlay.className = "tour-customize-option__image-dissolve";
      overlay.setAttribute("src", previousSrc);
      overlay.setAttribute("aria-hidden", "true");
      overlay.removeAttribute("alt");
      overlay.removeAttribute("loading");
      overlay.removeAttribute("draggable");
      imageButton.appendChild(overlay);
    }
    imageButton.classList.add("is-swapping-image");
    img.setAttribute("src", nextUrl);
    const scheduleTimeout = typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? window.setTimeout.bind(window)
      : setTimeout;
    scheduleTimeout(() => {
      overlay?.remove?.();
      imageButton.classList.remove("is-swapping-image");
    }, TOUR_CUSTOMIZE_IMAGE_DISSOLVE_MS + 40);
  }

  function cycleCardImage(imageButton) {
    if (!(imageButton instanceof HTMLElement)) return false;
    const item = itemForImageButton(imageButton);
    const urls = imageUrlsForItem(item);
    if (urls.length < 2) return false;
    const img = imageButton.querySelector("img");
    if (!(img instanceof HTMLElement)) return false;
    const currentSrc = normalizeText(img.getAttribute("src"));
    const currentIndex = currentCardImageIndex(imageButton, urls, currentSrc);
    const nextIndex = (currentIndex + 1) % urls.length;
    const nextUrl = urls[nextIndex];
    imageButton.dataset.customizeImageIndex = String(nextIndex);
    animateCardImageSwap(imageButton, img, nextUrl);
    return true;
  }

  function highlightMapLocation(itemId) {
    clearMapDragHighlight();
    const item = itemById(itemId);
    const key = routeKeyForItem(item);
    if (!item || !key || !item.mapPoint) return;
    const existingMarker = Array.from(modal?.querySelectorAll(".tour-customize-map__marker") || [])
      .find((marker) => marker.getAttribute("data-customize-route-key") === key);
    if (existingMarker instanceof HTMLElement) {
      existingMarker.classList.add("is-drag-location");
      return;
    }
    const marker = document.createElement("span");
    marker.className = "tour-customize-map__marker is-drag-location";
    marker.setAttribute("data-customize-drag-map-marker", "");
    marker.setAttribute("aria-hidden", "true");
    const mapPoint = displayedMapPoint(item.mapPoint);
    marker.style.left = `${mapPoint.x}%`;
    marker.style.top = `${mapPoint.y}%`;
    modal?.querySelector(".tour-customize-map")?.appendChild(marker);
  }

  function removePointerDragListeners() {
    document.removeEventListener("pointermove", handlePointerDragMove);
    document.removeEventListener("pointerup", handlePointerDragEnd);
    document.removeEventListener("pointercancel", handlePointerDragCancel);
    document.removeEventListener("pointermove", handleStickyDragMove);
    document.removeEventListener("pointerdown", handleStickyDragPointerDown, true);
    document.removeEventListener("keydown", handleStickyDragKeydown, true);
  }

  function pointerDragMovedBeyondClick(pointerDrag, event) {
    if (!pointerDrag || !event) return false;
    const deltaX = Number(event.clientX) - Number(pointerDrag.startX);
    const deltaY = Number(event.clientY) - Number(pointerDrag.startY);
    return Math.hypot(deltaX, deltaY) >= TOUR_CUSTOMIZE_STICKY_DRAG_THRESHOLD_PX;
  }

  function stickyDragSourceFromTarget(pointerDrag, target) {
    if (!(target instanceof Element) || !pointerDrag) return null;
    const selector = pointerDrag.kind === "option"
      ? "[data-customize-option-id]"
      : "[data-customize-timeline-id]";
    const element = target.closest(selector);
    if (!(element instanceof HTMLElement)) return null;
    const elementId = pointerDrag.kind === "option"
      ? element.getAttribute("data-customize-option-id")
      : element.getAttribute("data-customize-timeline-id");
    return normalizeText(elementId) === normalizeText(pointerDrag.id) ? element : null;
  }

  function activateStickyPointerDrag(event) {
    const pointerDrag = activePointerDrag;
    if (!pointerDrag) return false;
    removePointerDragListeners();
    pointerDrag.sticky = true;
    pointerDrag.hasMoved = true;
    pointerDrag.source?.classList?.add("is-sticky-dragging");
    try {
      pointerDrag.source?.releasePointerCapture?.(pointerDrag.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    document.documentElement.classList.add("tour-customize-sticky-dragging");
    moveDragGhost(event);
    document.addEventListener("pointermove", handleStickyDragMove, { passive: false });
    document.addEventListener("pointerdown", handleStickyDragPointerDown, true);
    document.addEventListener("keydown", handleStickyDragKeydown, true);
    return true;
  }

  function cleanupPointerDrag({ commit = false, event = null, animateCancel = true } = {}) {
    const pointerDrag = activePointerDrag;
    if (!pointerDrag) return;
    activePointerDrag = null;
    activeDragPayload = null;
    clearMapDragHighlight();
    removePointerDragListeners();
    document.documentElement.classList.remove("tour-customize-pointer-dragging");
    document.documentElement.classList.remove("tour-customize-sticky-dragging");
    const restoreCancelledTimelineDrag = () => {
      if (commit || pointerDrag.kind !== "timeline" || !Array.isArray(pointerDrag.timelineDaysBeforeDrag) || !draft) return;
      draft.timelineDays = pointerDrag.timelineDaysBeforeDrag;
      if (pointerDrag.timeline instanceof HTMLElement) syncTimelineDomOrder(pointerDrag.timeline);
    };
    const resetPointerDragSource = ({ hideSource = false, preserveDeleteCandidate = false } = {}) => {
      if (!(pointerDrag.source instanceof HTMLElement)) return;
      try {
        pointerDrag.source.releasePointerCapture?.(pointerDrag.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      pointerDrag.source.classList.remove("is-dragging");
      pointerDrag.source.classList.remove("is-sticky-dragging");
      pointerDrag.source.classList.remove("is-move-placeholder");
      if (!preserveDeleteCandidate) pointerDrag.source.classList.remove("is-delete-candidate");
      pointerDrag.source.style.removeProperty("transform");
      pointerDrag.source.style.removeProperty("z-index");
      pointerDrag.source.style.removeProperty("transition");
      if (hideSource) {
        pointerDrag.source.style.visibility = "hidden";
      } else {
        pointerDrag.source.style.removeProperty("visibility");
      }
      if (pointerDrag.timeline instanceof HTMLElement) updateTimelineDayLabels(pointerDrag.timeline);
    };
    const animateCancelReturn = () => {
      if (!animateCancel || !(pointerDrag.ghost instanceof HTMLElement) || !(pointerDrag.source instanceof HTMLElement)) return false;
      restoreCancelledTimelineDrag();
      if (pointerDrag.timeline instanceof HTMLElement) clearDropSlot(pointerDrag.timeline);
      resetPointerDragSource({ hideSource: true });
      const targetRect = elementRectWithoutInlineTransform(pointerDrag.source);
      if (!targetRect || !targetRect.width || !targetRect.height) {
        pointerDrag.source.style.removeProperty("visibility");
        return false;
      }
      animateFloatingCardToRect(pointerDrag.ghost, targetRect, {
        onComplete: () => {
          pointerDrag.source?.style?.removeProperty("visibility");
        }
      });
      return true;
    };
    if (pointerDrag.timeline instanceof HTMLElement) {
      const shouldAddOption = commit
        && event
        && pointerDrag.kind === "option"
        && isNearTimeline(pointerDrag.timeline, event);
      const insertIndex = Number.isInteger(activeDropIndex)
        ? activeDropIndex
        : event
          ? timelineInsertIndex(pointerDrag.timeline, event.clientX)
          : draft?.timelineDays.length || 0;
      if (commit && pointerDrag.kind === "timeline" && pointerDrag.deleteActive) {
        clearDropSlot(pointerDrag.timeline);
        if (pointerDrag.ghost instanceof HTMLElement) {
          resetPointerDragSource({ preserveDeleteCandidate: true });
          animateFloatingCardSmokeDissolve(pointerDrag.ghost, {
            onComplete: () => removeDay(pointerDrag.id)
          });
          return;
        }
        resetPointerDragSource();
        pointerDrag.ghost?.remove();
        removeDay(pointerDrag.id);
        return;
      }
      if (shouldAddOption) {
        const dropSlot = pointerDrag.timeline.querySelector(".tour-customize-timeline__drop-slot");
        const targetRect = dropSlot instanceof HTMLElement ? dropSlot.getBoundingClientRect() : null;
        if (targetRect && pointerDrag.ghost instanceof HTMLElement) {
          animateFloatingCardToRect(pointerDrag.ghost, targetRect, {
            onComplete: () => {
              resetPointerDragSource();
              clearDropSlot(pointerDrag.timeline);
              addDay(pointerDrag.id, insertIndex);
            }
          });
          return;
        }
        clearDropSlot(pointerDrag.timeline);
        resetPointerDragSource();
        pointerDrag.ghost?.remove();
        addDay(pointerDrag.id, insertIndex);
        return;
      }
      if (commit && pointerDrag.kind === "timeline") {
        const target = pointerDrag.timeline.querySelector(`[data-customize-timeline-id="${CSS.escape(pointerDrag.id)}"]`);
        const dropSlot = pointerDrag.timeline.querySelector(".tour-customize-timeline__drop-slot");
        const startRect = pointerDrag.ghost instanceof HTMLElement
          ? pointerDrag.ghost.getBoundingClientRect()
          : pointerDrag.source instanceof HTMLElement
            ? pointerDrag.source.getBoundingClientRect()
            : null;
        if (startRect && pointerDrag.ghost instanceof HTMLElement) {
          pointerDrag.ghost.style.left = `${startRect.left}px`;
          pointerDrag.ghost.style.top = `${startRect.top}px`;
          pointerDrag.ghost.style.width = `${startRect.width}px`;
          pointerDrag.ghost.style.height = `${startRect.height}px`;
          pointerDrag.ghost.style.opacity = "1";
          pointerDrag.ghost.style.visibility = "visible";
        }
        if (pointerDrag.source instanceof HTMLElement) pointerDrag.source.style.visibility = "hidden";
        const targetRect = dropSlot instanceof HTMLElement
          ? dropSlot.getBoundingClientRect()
          : target instanceof HTMLElement
            ? elementRectWithoutInlineTransform(target)
            : null;
        if (targetRect && pointerDrag.ghost instanceof HTMLElement) {
          animateFloatingCardToRect(pointerDrag.ghost, targetRect, {
            onComplete: () => {
              clearDropSlot(pointerDrag.timeline);
              resetPointerDragSource();
              refreshAfterTimelineChange();
            }
          });
          return;
        }
        clearDropSlot(pointerDrag.timeline);
        resetPointerDragSource();
        pointerDrag.ghost?.remove();
        refreshAfterTimelineChange();
        return;
      }
      clearDropSlot(pointerDrag.timeline);
    }
    if (animateCancelReturn()) return;
    restoreCancelledTimelineDrag();
    resetPointerDragSource();
    pointerDrag.ghost?.remove();
  }

  function updatePointerDragFromEvent(event) {
    if (!activePointerDrag) return;
    event.preventDefault();
    moveDragGhost(event);
    const timeline = activePointerDrag.timeline;
    if (!(timeline instanceof HTMLElement)) return;
    autoScrollTimelineDuringDrag(timeline, event);
    if (activePointerDrag.kind === "timeline" && activePointerDrag.deleteActive) {
      clearDropSlot(timeline);
      return;
    }
    if (!isNearTimeline(timeline, event)) {
      clearDropSlot(timeline);
      return;
    }
    const insertIndex = timelineInsertIndex(timeline, event.clientX);
    if (activePointerDrag.kind === "timeline") {
      const didReorder = reorderTimelineDuringDrag(timeline, activePointerDrag.id, insertIndex);
      if (didReorder) moveDragGhost(event);
      activePointerDrag.timelineDropVisible = activePointerDrag.timelineDropVisible || didReorder;
      if (!activePointerDrag.timelineDropVisible) {
        clearDropSlot(timeline);
        return;
      }
      const currentIndex = draft?.timelineDays.findIndex((item) => timelineItemKey(item) === activePointerDrag.id) ?? -1;
      renderDropSlot(timeline, currentIndex >= 0 ? currentIndex : insertIndex, "move");
      return;
    }
    renderDropSlot(timeline, insertIndex);
  }

  function handlePointerDragMove(event) {
    if (!activePointerDrag || activePointerDrag.sticky || event.pointerId !== activePointerDrag.pointerId) return;
    if (!activePointerDrag.hasMoved && pointerDragMovedBeyondClick(activePointerDrag, event)) {
      activePointerDrag.hasMoved = true;
    }
    updatePointerDragFromEvent(event);
  }

  function handlePointerDragEnd(event) {
    if (!activePointerDrag || activePointerDrag.sticky || event.pointerId !== activePointerDrag.pointerId) return;
    event.preventDefault();
    if (!activePointerDrag.hasMoved && pointerDragMovedBeyondClick(activePointerDrag, event)) {
      activePointerDrag.hasMoved = true;
    }
    if (!activePointerDrag.hasMoved) {
      activateStickyPointerDrag(event);
      return;
    }
    cleanupPointerDrag({ commit: true, event });
  }

  function handlePointerDragCancel(event) {
    if (!activePointerDrag || event.pointerId !== activePointerDrag.pointerId) return;
    cleanupPointerDrag();
  }

  function handleStickyDragMove(event) {
    if (!activePointerDrag?.sticky) return;
    updatePointerDragFromEvent(event);
  }

  function handleStickyDragPointerDown(event) {
    const pointerDrag = activePointerDrag;
    if (!pointerDrag?.sticky || event.button !== 0) return;
    if (isCustomizeDragBlockedTarget(event.target)) {
      cleanupPointerDrag();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (pointerDrag.kind === "timeline" && pointerDrag.deleteActive) {
      updatePointerDragFromEvent(event);
      cleanupPointerDrag({ commit: true, event });
      return;
    }
    if (stickyDragSourceFromTarget(pointerDrag, event.target)) {
      cleanupPointerDrag();
      return;
    }
    if (pointerDrag.timeline instanceof HTMLElement && isNearTimeline(pointerDrag.timeline, event)) {
      updatePointerDragFromEvent(event);
      cleanupPointerDrag({ commit: true, event });
      return;
    }
    cleanupPointerDrag();
  }

  function handleStickyDragKeydown(event) {
    if (!activePointerDrag?.sticky || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    cleanupPointerDrag();
  }

  function startPointerDrag(element, event, root) {
    if (!(element instanceof HTMLElement) || event.button !== 0 || activePointerDrag) return;
    const optionId = element.getAttribute("data-customize-option-id");
    const timelineId = element.getAttribute("data-customize-timeline-id");
    const id = normalizeText(optionId || timelineId);
    const kind = optionId ? "option" : timelineId ? "timeline" : "";
    const timeline = root.querySelector("[data-customize-timeline]");
    if (!id || !kind || !(timeline instanceof HTMLElement)) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true);
    ghost.classList.add("tour-customize-drag-ghost");
    ghost.classList.remove("is-dragging", "is-reordering", "is-move-placeholder");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-customize-option-id");
    ghost.removeAttribute("data-customize-timeline-id");
    ghost.querySelector(".tour-customize-timeline__move-placeholder")?.remove();
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = "1";
    ghost.style.visibility = "visible";
    document.body.appendChild(ghost);
    activePointerDrag = {
      kind,
      id,
      pointerId: event.pointerId,
      source: element,
      ghost,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      sticky: false,
      timelineDropVisible: false,
      deleteActive: false,
      timeline,
      timelineDaysBeforeDrag: kind === "timeline" && draft ? [...draft.timelineDays] : null
    };
    activeDragPayload = { kind, id };
    element.classList.remove("is-reordering");
    if (kind === "timeline") {
      element.style.transition = "none";
      element.style.zIndex = "20";
    }
    element.classList.add("is-dragging");
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      // Some browsers deny pointer capture once the pointer has moved.
    }
    highlightMapLocation(id);
    document.documentElement.classList.add("tour-customize-pointer-dragging");
    moveDragGhost(event);
    document.addEventListener("pointermove", handlePointerDragMove, { passive: false });
    document.addEventListener("pointerup", handlePointerDragEnd, { passive: false });
    document.addEventListener("pointercancel", handlePointerDragCancel);
  }

  function isCustomizeDragBlockedTarget(target) {
    return target instanceof Element && Boolean(target.closest([
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "[contenteditable]",
      "[data-customize-card-image]"
    ].join(",")));
  }

  function bindCardImageCycleButtons(element) {
    if (!(element instanceof HTMLElement)) return;
    element.querySelectorAll("[data-customize-card-image]").forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.customizeImageCycleBound === "1") return;
      button.dataset.customizeImageCycleBound = "1";
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
      });
      button.addEventListener("dragstart", (event) => {
        event.preventDefault();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        cycleCardImage(button);
      });
    });
  }

  function bindDraggableElement(element, root) {
    if (!(element instanceof HTMLElement) || !(root instanceof HTMLElement) || element.dataset.customizeDragBound === "1") return;
    element.dataset.customizeDragBound = "1";
    bindCardImageCycleButtons(element);
    if (element.matches("[data-customize-option-id], [data-customize-timeline-id]")) {
      element.addEventListener("pointerdown", (event) => {
        if (isCustomizeDragBlockedTarget(event.target)) return;
        startPointerDrag(element, event, root);
      });
    }
    element.addEventListener("dragstart", (event) => {
      const optionId = element.getAttribute("data-customize-option-id");
      const timelineId = element.getAttribute("data-customize-timeline-id");
      activeDragPayload = {
        kind: optionId ? "option" : "timeline",
        id: optionId || timelineId
      };
      element.classList.add("is-dragging");
      highlightMapLocation(activeDragPayload.id);
      if (event.dataTransfer) {
        event.dataTransfer.setData("text/plain", JSON.stringify(activeDragPayload));
        event.dataTransfer.effectAllowed = "move";
      }
    });
    element.addEventListener("dragend", () => {
      element.classList.remove("is-dragging");
      const wasTimelineDrag = activeDragPayload?.kind === "timeline";
      activeDragPayload = null;
      clearMapDragHighlight();
      const timeline = root.querySelector("[data-customize-timeline]");
      if (timeline instanceof HTMLElement) clearDropSlot(timeline);
      if (wasTimelineDrag) refreshAfterTimelineChange();
    });
  }

  function bindMapZoom(root) {
    const map = root?.querySelector?.(".tour-customize-map");
    if (!(map instanceof HTMLElement) || map.dataset.customizeMapZoomBound === "1") return;
    map.dataset.customizeMapZoomBound = "1";
    const zoomOutButton = map.querySelector("[data-customize-map-zoom-out]");
    const applyZoomStateToCurrentMap = () => {
      const zoom = currentMapZoom();
      map.classList.toggle("is-zoomed", zoom.zoomed);
      if (zoom.zoomed) {
        map.style.setProperty("--tour-customize-map-zoom-x", `${zoom.x.toFixed(2)}%`);
        map.style.setProperty("--tour-customize-map-zoom-y", `${zoom.y.toFixed(2)}%`);
      } else {
        map.style.removeProperty("--tour-customize-map-zoom-x");
        map.style.removeProperty("--tour-customize-map-zoom-y");
      }
    };
    const updateMapOverlays = () => {
      const groups = displayedRouteGroups(routeGroups(draft?.timelineDays || []));
      const routePoints = displayedRoutePoints(routeSequencePoints(draft?.timelineDays || []));
      const routePath = routePathData(routePoints);
      const route = map.querySelector(".tour-customize-map__route");
      const path = route?.querySelector("path");
      if (path instanceof SVGPathElement) {
        path.setAttribute("d", routePath);
      } else if (route instanceof SVGElement && routePath) {
        route.innerHTML = `<path d="${escapeAttr(routePath)}" fill="none" vector-effect="non-scaling-stroke" />`;
      }
      groups.forEach((group) => {
        const marker = map.querySelector(`[data-customize-route-key="${CSS.escape(group.key)}"]`);
        if (!(marker instanceof HTMLElement)) return;
        marker.style.left = `${group.mapPoint.x}%`;
        marker.style.top = `${group.mapPoint.y}%`;
      });
      const dragMarker = map.querySelector("[data-customize-drag-map-marker]");
      const dragId = activePointerDrag?.id || activeDragPayload?.id;
      const item = itemById(dragId);
      if (dragMarker instanceof HTMLElement && item?.mapPoint) {
        const mapPoint = displayedMapPoint(item.mapPoint);
        dragMarker.style.left = `${mapPoint.x}%`;
        dragMarker.style.top = `${mapPoint.y}%`;
      }
    };
    const zoomOut = () => {
      if (draft) draft.mapZoom = { zoomed: false, x: 50, y: 50 };
      refreshMapDom();
    };
    zoomOutButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      zoomOut();
    });
    map.addEventListener("dblclick", (event) => {
      if (event.target instanceof Element && event.target.closest("[data-customize-map-zoom-out]")) return;
      event.preventDefault();
      if (map.classList.contains("is-zoomed")) {
        zoomOut();
        return;
      }
      const rect = map.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = clampMapZoomCenter(((event.clientX - rect.left) / rect.width) * 100);
      const y = clampMapZoomCenter(((event.clientY - rect.top) / rect.height) * 100);
      if (draft) draft.mapZoom = { zoomed: true, x, y };
      refreshMapDom();
    });
    map.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !draft?.mapZoom?.zoomed) return;
      if (event.target instanceof Element && event.target.closest("[data-customize-map-zoom-out]")) return;
      event.preventDefault();
      event.stopPropagation();
      const zoom = currentMapZoom();
      activeMapPan = {
        pointerId: event.pointerId,
        map,
        startX: event.clientX,
        startY: event.clientY,
        zoomX: zoom.x,
        zoomY: zoom.y
      };
      map.classList.add("is-panning");
      map.setPointerCapture?.(event.pointerId);
    });
    map.addEventListener("pointermove", (event) => {
      if (!activeMapPan || activeMapPan.pointerId !== event.pointerId || activeMapPan.map !== map) return;
      event.preventDefault();
      const rect = map.getBoundingClientRect();
      if (!rect.width || !rect.height || !draft) return;
      draft.mapZoom = {
        zoomed: true,
        x: clampMapZoomCenter(activeMapPan.zoomX - ((event.clientX - activeMapPan.startX) / rect.width) * 100),
        y: clampMapZoomCenter(activeMapPan.zoomY - ((event.clientY - activeMapPan.startY) / rect.height) * 100)
      };
      applyZoomStateToCurrentMap();
      updateMapOverlays();
    });
    const finishPan = (event) => {
      if (!activeMapPan || activeMapPan.pointerId !== event.pointerId || activeMapPan.map !== map) return;
      cleanupMapPan();
    };
    map.addEventListener("pointerup", finishPan);
    map.addEventListener("pointercancel", finishPan);
  }

  function bindDragAndDrop(root) {
    root.querySelectorAll("[data-customize-option-id], [data-customize-timeline-id]").forEach((element) => {
      if (element instanceof HTMLElement) bindDraggableElement(element, root);
    });

    const timeline = root.querySelector("[data-customize-timeline]");
    if (!(timeline instanceof HTMLElement)) return;
    timeline.addEventListener("dragover", (event) => {
      const payload = dragPayloadFromEvent(event);
      if (!payload) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      if (payload.kind === "timeline") {
        reorderTimelineDuringDrag(timeline, payload.id, timelineInsertIndex(timeline, event.clientX));
        const currentIndex = draft?.timelineDays.findIndex((item) => timelineItemKey(item) === payload.id) ?? -1;
        renderDropSlot(timeline, currentIndex >= 0 ? currentIndex : timelineInsertIndex(timeline, event.clientX), "move");
        return;
      }
      renderDropSlot(timeline, timelineInsertIndex(timeline, event.clientX));
    });
    timeline.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && timeline.contains(event.relatedTarget)) return;
      if (isNearTimeline(timeline, event)) return;
      clearDropSlot(timeline);
    });
    root.addEventListener("dragover", (event) => {
      const payload = dragPayloadFromEvent(event);
      if (!payload || !isNearTimeline(timeline, event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      if (payload.kind === "timeline") {
        reorderTimelineDuringDrag(timeline, payload.id, timelineInsertIndex(timeline, event.clientX));
        const currentIndex = draft?.timelineDays.findIndex((item) => timelineItemKey(item) === payload.id) ?? -1;
        renderDropSlot(timeline, currentIndex >= 0 ? currentIndex : timelineInsertIndex(timeline, event.clientX), "move");
        return;
      }
      renderDropSlot(timeline, timelineInsertIndex(timeline, event.clientX));
    });
    timeline.addEventListener("drop", (event) => {
      dropIntoTimeline(event, timeline);
    });
    root.addEventListener("drop", (event) => {
      if (!activeDragPayload || !isNearTimeline(timeline, event)) return;
      dropIntoTimeline(event, timeline);
    });
  }

  function bindModalEvents() {
    if (!modal) return;
    bindMapZoom(modal);
    modal.querySelector("[data-customize-reset]")?.addEventListener("click", resetDraftToOriginal);
    modal.querySelector("[data-customize-close]")?.addEventListener("click", () => closeModal());
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    });
    bindDragAndDrop(modal);
  }

  async function open(tourId) {
    if (typeof document === "undefined") return;
    const normalizedTourId = normalizeText(tourId);
    let trip = typeof findTripById === "function" ? findTripById(normalizedTourId) : null;
    if (!trip) return;
    trip = await ensureTourDetailsLoaded?.(normalizedTourId) || trip;
    const modules = await candidateModulesForTrip(trip);
    const originalTimelineDays = originalTimelineFromTrip(trip, modules);
    const timelineDays = initialTimelineFromTrip(trip, modules);
    if (!timelineDays.length) return;
    lastFocusedElement = document.activeElement;
    draft = {
      tourId: normalizedTourId,
      tourTitle: tourTitleForTimeline(trip),
      modules,
      originalTimelineDays,
      timelineDays,
      mapZoom: { zoomed: false, x: 50, y: 50 }
    };
    modal = document.createElement("div");
    modal.className = "tour-customize";
    document.body.appendChild(modal);
    document.documentElement.classList.add("tour-customize-modal-open");
    renderModal();
    const closeButton = modal.querySelector("[data-customize-close]");
    if (closeButton instanceof HTMLElement) closeButton.focus();
  }

  async function createCustomizedOverviewPdfPreview(tourId, selectedDays, title = "") {
    const normalizedTourId = normalizeText(tourId);
    const normalizedSelectedDays = Array.isArray(selectedDays) ? selectedDays : [];
    const normalizedTitle = compactText(title);
    if (!normalizedTourId || !normalizedSelectedDays.length) return "";
    const response = await fetch(`/public/v1/tours/${encodeURIComponent(normalizedTourId)}/one-pager-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: lang(),
        selected_days: normalizedSelectedDays,
        ...(normalizedTitle ? { title: normalizedTitle } : {})
      })
    });
    if (!response.ok) throw new Error(`Customized overview PDF preview failed: ${response.status}`);
    const payload = await response.json();
    const pdfUrl = normalizeText(payload?.pdf_url);
    if (!pdfUrl) throw new Error("Customized overview PDF preview did not return a URL.");
    return pdfUrl;
  }

  async function createCustomizedTravelPlanPdfPreview(tourId, selectedDays, title = "") {
    const normalizedTourId = normalizeText(tourId);
    const normalizedSelectedDays = Array.isArray(selectedDays) ? selectedDays : [];
    const normalizedTitle = compactText(title);
    if (!normalizedTourId || !normalizedSelectedDays.length) return "";
    const response = await fetch(`/public/v1/tours/${encodeURIComponent(normalizedTourId)}/travel-plan-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: lang(),
        selected_days: normalizedSelectedDays,
        ...(normalizedTitle ? { title: normalizedTitle } : {})
      })
    });
    if (!response.ok) throw new Error(`Customized travel-plan PDF preview failed: ${response.status}`);
    const payload = await response.json();
    const pdfUrl = normalizeText(payload?.pdf_url);
    if (!pdfUrl) throw new Error("Customized travel-plan PDF preview did not return a URL.");
    return pdfUrl;
  }

  function openPendingPdfWindow() {
    if (typeof window === "undefined") return null;
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) return null;
    previewWindow.document.title = t("tour.customize.pdf_loading_title", "Creating Tour PDF");
    previewWindow.document.documentElement.innerHTML = `
      <head><title>${escapeHTML(t("tour.customize.pdf_loading_title", "Creating Tour PDF"))}</title></head>
      <body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f2e9;color:#213443;">
        <strong>${escapeHTML(t("tour.customize.pdf_loading", "Creating Tour PDF..."))}</strong>
      </body>
    `;
    return previewWindow;
  }

  function showPdfInWindow(previewWindow, pdfUrl) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.replace(pdfUrl);
      return;
    }
    window.open(pdfUrl, "_blank", "noopener");
  }

  async function openCustomizedPdfWith(tourId, createPreview) {
    const normalizedTourId = normalizeText(tourId);
    const selectedDays = selectedDaysForPdf(normalizedTourId);
    if (!normalizedTourId || !selectedDays.length) return false;
    const trip = typeof findTripById === "function" ? findTripById(normalizedTourId) : null;
    const proposedTitle = customizedTitleForTrip(trip);
    const previewWindow = openPendingPdfWindow();
    try {
      const pdfUrl = await createPreview(normalizedTourId, selectedDays, proposedTitle);
      showPdfInWindow(previewWindow, pdfUrl);
    } catch (error) {
      previewWindow?.close?.();
      throw error;
    }
    return true;
  }

  async function openCustomizedOverviewPdf(tourId) {
    return openCustomizedPdfWith(tourId, createCustomizedOverviewPdfPreview);
  }

  async function openCustomizedTravelPlanPdf(tourId) {
    return openCustomizedPdfWith(tourId, createCustomizedTravelPlanPdfPreview);
  }

  async function openCustomizedPdf(tourId) {
    return openCustomizedTravelPlanPdf(tourId);
  }

  return {
    hasCustomization,
    activeDaysForTrip,
    selectedDaysForPdf,
    customizedTitleForTrip,
    routePreviewForTrip,
    open,
    openCustomizedOverviewPdf,
    openCustomizedTravelPlanPdf,
    openCustomizedPdf,
    clearCustomization
  };
}
