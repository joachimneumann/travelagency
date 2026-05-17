const TOUR_CUSTOMIZE_STORAGE_PREFIX = "asiatravelplan.custom_tour.";
const TOUR_CUSTOMIZE_TITLE_PROPOSAL_LIMIT = 1;
const TOUR_CUSTOMIZE_TITLE_LOCATION_LIMIT = 3;
const TOUR_CUSTOMIZE_REORDER_ANIMATION_MS = 170;
const TOUR_CUSTOMIZE_OPTIMIZE_REORDER_ANIMATION_MS = 520;
const TOUR_CUSTOMIZE_DROP_ANIMATION_MS = 190;
const TOUR_CUSTOMIZE_DELETE_ANIMATION_MS = 220;
const TOUR_CUSTOMIZE_SMOKE_ANIMATION_MS = 460;
const TOUR_CUSTOMIZE_IMAGE_DISSOLVE_MS = 170;
const TOUR_CUSTOMIZE_IMAGE_TITLE_RESET_MS = 5000;
const TOUR_CUSTOMIZE_TIMELINE_DELETE_DISTANCE_PX = 50;
const TOUR_CUSTOMIZE_STICKY_DRAG_THRESHOLD_PX = 6;
const TOUR_CUSTOMIZE_DOUBLE_CLICK_DRAG_GRACE_MS = 360;
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
const TOUR_CUSTOMIZE_EARTH_RADIUS_KM = 6371;
const TOUR_CUSTOMIZE_DISTANCE_IMPROVEMENT_EPSILON = 0.001;

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
    resolveLocalizedField(day, "notes", lang),
    ...services.flatMap((service) => [
      resolveLocalizedField(service, "title", lang),
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
        label: location.label || resolveLocalizedField(day, "title", lang),
        locationId: id,
        role
      });
    }
  }
  if (explicitPoints.length) return explicitPoints;
  const explicit = day?.route_point || day?.routePoint;
  if (explicit && Number.isFinite(Number(explicit.lat)) && Number.isFinite(Number(explicit.lng))) {
    const label = normalizeText(explicit.label) || resolveLocalizedField(day, "title", lang);
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

function customerVisibleDayImages(day, lang) {
  const entries = [];
  const seen = new Set();
  for (const service of Array.isArray(day?.services) ? day.services : []) {
    const title = compactText(resolveLocalizedField(service, "title", lang));
    const images = [
      service?.image,
      ...(Array.isArray(service?.images) ? service.images : [])
    ];
    for (const image of images) {
      if (!image || typeof image !== "object" || Array.isArray(image)) continue;
      if (image.is_customer_visible === false) continue;
      const src = normalizeText(
        image.thumbnail_storage_path
        || image.thumbnail_url
        || image.thumb_url
        || image.storage_path
        || image.url
        || image.src
        || image.path
      );
      const sourceKey = normalizeText(image.storage_path || image.url || image.src || image.path) || src;
      if (!src || seen.has(sourceKey)) continue;
      seen.add(sourceKey);
      entries.push({ url: src, title });
    }
  }
  return entries;
}

function summarizeDay(day, lang) {
  const notes = compactText(resolveLocalizedField(day, "notes", lang));
  if (notes) return notes.length > 150 ? `${notes.slice(0, 147).trim()}...` : notes;
  const service = (Array.isArray(day?.services) ? day.services : [])
    .map((item) => compactText(resolveLocalizedField(item, "title", lang) || resolveLocalizedField(item, "details", lang)))
    .find(Boolean);
  return service || "";
}

function dayModuleFromDay({ day, sourceTourId, originalTourId, lang, destinationCatalog = null, sourceTourTitle = "" }) {
  const sourceDayId = normalizeText(day?.id);
  const title = resolveLocalizedField(day, "title", lang);
  const imageEntries = customerVisibleDayImages(day, lang);
  const imageUrls = imageEntries.map((image) => image.url);
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
    || resolveLocalizedField(day, "title", lang);
  if (!locationLabel) return null;
  return {
    id: `${sourceTourId}:${sourceDayId}`,
    source: sourceTourId === originalTourId ? "original" : "optional",
    sourceTourId,
    sourceDayId,
    sourceTourTitle: normalizeText(sourceTourTitle),
    title,
    locationLabel,
    summary: summarizeDay(day, lang),
    thumbnailUrl,
    routePoint,
    routePoints,
    mapPoint,
    imageEntries,
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

function routeCoordinateForEntry(entry) {
  const lat = Number(entry?.routePoint?.lat);
  const lng = Number(entry?.routePoint?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, kind: "geo" };
  const x = Number(entry?.mapPoint?.x);
  const y = Number(entry?.mapPoint?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y, kind: "map" };
  return null;
}

function routeCoordinatesForItem(item) {
  const entries = Array.isArray(item?.routePoints) && item.routePoints.length
    ? item.routePoints
    : [{ routePoint: item?.routePoint, mapPoint: item?.mapPoint }];
  return entries
    .map(routeCoordinateForEntry)
    .filter(Boolean);
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function routeCoordinateDistance(left, right) {
  if (!left || !right) return 0;
  if (left.kind === "geo" && right.kind === "geo") {
    const deltaLat = degreesToRadians(right.lat - left.lat);
    const deltaLng = degreesToRadians(right.lng - left.lng);
    const startLat = degreesToRadians(left.lat);
    const endLat = degreesToRadians(right.lat);
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
    return 2 * TOUR_CUSTOMIZE_EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const leftX = left.kind === "map" ? left.x : left.lng;
  const leftY = left.kind === "map" ? left.y : left.lat;
  const rightX = right.kind === "map" ? right.x : right.lng;
  const rightY = right.kind === "map" ? right.y : right.lat;
  return Math.hypot(rightX - leftX, rightY - leftY);
}

function timelineTravelDistance(timelineDays) {
  const coordinates = (Array.isArray(timelineDays) ? timelineDays : [])
    .flatMap(routeCoordinatesForItem);
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += routeCoordinateDistance(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function itemConnectionDistance(left, right) {
  const leftCoordinates = routeCoordinatesForItem(left);
  const rightCoordinates = routeCoordinatesForItem(right);
  return routeCoordinateDistance(leftCoordinates[leftCoordinates.length - 1], rightCoordinates[0]);
}

function nearestNeighborTimelineOrder(items, startIndex = 0) {
  const source = Array.isArray(items) ? items : [];
  if (source.length <= 1) return [...source];
  const remaining = source.map((item, index) => ({ item, index }));
  const boundedStartIndex = Math.min(Math.max(0, startIndex), remaining.length - 1);
  const [start] = remaining.splice(boundedStartIndex, 1);
  const ordered = [start.item];
  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    let bestRemainingIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const distance = itemConnectionDistance(current, remaining[index].item);
      if (
        distance < bestDistance
        || (distance === bestDistance && remaining[index].index < remaining[bestRemainingIndex].index)
      ) {
        bestDistance = distance;
        bestRemainingIndex = index;
      }
    }
    const [next] = remaining.splice(bestRemainingIndex, 1);
    ordered.push(next.item);
  }
  return ordered;
}

function improveTimelineOrderWithTwoOpt(items) {
  let best = Array.isArray(items) ? [...items] : [];
  let bestDistance = timelineTravelDistance(best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let start = 0; start < best.length - 1; start += 1) {
      for (let end = start + 1; end < best.length; end += 1) {
        const candidate = [
          ...best.slice(0, start),
          ...best.slice(start, end + 1).reverse(),
          ...best.slice(end + 1)
        ];
        const candidateDistance = timelineTravelDistance(candidate);
        if (candidateDistance + TOUR_CUSTOMIZE_DISTANCE_IMPROVEMENT_EPSILON < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }
  return best;
}

function optimizeLocatedTimelineRun(items) {
  const source = Array.isArray(items) ? items : [];
  if (source.length <= 1) return [...source];
  let best = [...source];
  let bestDistance = timelineTravelDistance(best);
  for (let startIndex = 0; startIndex < source.length; startIndex += 1) {
    const candidate = improveTimelineOrderWithTwoOpt(nearestNeighborTimelineOrder(source, startIndex));
    const candidateDistance = timelineTravelDistance(candidate);
    if (candidateDistance + TOUR_CUSTOMIZE_DISTANCE_IMPROVEMENT_EPSILON < bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }
  return best;
}

function optimizeTimelineDaysByDistance(timelineDays) {
  const source = Array.isArray(timelineDays) ? timelineDays : [];
  const optimized = [];
  let locatedRun = [];
  const flushLocatedRun = () => {
    if (!locatedRun.length) return;
    optimized.push(...optimizeLocatedTimelineRun(locatedRun));
    locatedRun = [];
  };
  for (const item of source) {
    if (routeCoordinatesForItem(item).length) {
      locatedRun.push(item);
      continue;
    }
    flushLocatedRun();
    optimized.push(item);
  }
  flushLocatedRun();
  return optimized;
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

function defaultEscapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function templateLabel(labels, key, fallback, vars = {}) {
  const source = labels && Object.prototype.hasOwnProperty.call(labels, key)
    ? labels[key]
    : fallback;
  if (typeof source === "function") return source(vars);
  return normalizeText(source || fallback).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : ""
  ));
}

const TOUR_CUSTOMIZER_WORKSPACE_LABEL_KEYS = Object.freeze({
  "common.and": "and",
  "tour.customize.map": "map",
  "tour.customize.optimize": "optimize",
  "tour.customize.zoom_out": "zoomOut",
  "tour.customize.optional_days": "optionalDays",
  "tour.customize.no_optional_days": "noOptionalDays",
  "tour.customize.empty_timeline": "emptyTimeline",
  "tour.customize.timeline": "timeline",
  "tour.customize.timeline_with_count": "timelineWithCount",
  "tour.customize.day": "day",
  "tour.customize.move_here": "moveHere",
  "tour.customize.drop_here": "dropHere",
  "tour.customize.marker_label": "marker",
  "tour.customize.next_day_image": "nextDayImage",
  "tour.customize.day_image": "dayImage"
});

const TOUR_CUSTOMIZER_COMPONENT_CSS = `
:host {
  all: initial;
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 0;
  color-scheme: light;
  contain: content;
  --bg: #e2ecde;
  --surface: #ffffff;
  --surface-muted: #f3f5f6;
  --text: #1c2b35;
  --text-strong: #16313d;
  --text-muted: #5c6c76;
  --line: #deeaef;
  --line-strong: #cfdbe3;
  --line-focus-strong: rgba(104, 133, 145, 0.95);
  --accent: #30796b;
  --accent-dark: #246052;
  --font-family-sans: "Source Sans 3", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-size-button: 1rem;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --tour-customize-card-width: 116px;
  --tour-customize-card-height: 154px;
  --tour-customize-options-gap: 0.56rem;
  --tour-customize-card-border-color: var(--line-focus-strong);
  --tour-customize-line-color: var(--line);
  --tour-customize-workspace-background: #f7f9f7;
}

:host([data-tour-configurator-mode="modal"]) {
  position: fixed !important;
  top: var(--tour-customize-modal-top, 0px) !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  z-index: 2300 !important;
  width: auto !important;
  height: auto !important;
  contain: none;
}

.tour-customize-root,
.tour-customize-root :where(button, input, select, textarea, article, section, div, span, p, h2, h3, h4, svg, img) {
  box-sizing: border-box;
}

.tour-customize-root {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  color: var(--text);
  font-family: var(--font-family-sans);
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.tour-customize-root :where(button, input, select, textarea) {
  font: inherit;
}

.tour-customize-root :where(button, [role="button"], img, svg, [aria-hidden="true"], .tour-customize-drag-ghost, .is-dragging) {
  -webkit-user-select: none;
  user-select: none;
}

.tour-customize-root :where(img) {
  display: block;
  max-width: 100%;
  -webkit-user-drag: none;
  user-drag: none;
}

.tour-customize-root.tour-customize {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 100vw;
  height: auto;
  min-height: 0;
  overflow: hidden;
  background: rgba(14, 28, 32, 0.48);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.tour-customize-root.tour-customize-runtime-root,
.tour-customize-root .tour-customize-embedded,
.tour-customize-root.tour-customize {
  --tour-customize-card-width: 116px;
  --tour-customize-card-height: 154px;
  --tour-customize-options-gap: 0.56rem;
  --tour-customize-card-border-color: var(--line-focus-strong);
  --tour-customize-line-color: var(--line);
  --tour-customize-workspace-background: #f7f9f7;
}

.tour-customize-root .btn,
.tour-customize-root .tour-customize__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  padding: 0.62rem 1rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--text-strong);
  font-size: var(--font-size-button);
  line-height: 1.1;
  font-weight: var(--font-weight-semibold);
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.tour-customize-root .btn:hover,
.tour-customize-root .btn:focus-visible {
  border-color: var(--accent);
  outline: 2px solid rgba(48, 121, 107, 0.22);
  outline-offset: 2px;
}

.tour-customize-root .btn-secondary {
  border-color: var(--line);
  background: #fff;
}

.tour-customize-root .tour-customize__dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  border: 1px solid rgba(16, 27, 43, 0.14);
  border-radius: 0;
  background: #fff;
  box-shadow: 0 24px 70px rgba(16, 27, 43, 0.22);
}

.tour-customize-root .tour-customize__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--line);
}

.tour-customize-root .tour-customize__header h2,
.tour-customize-root .tour-customize__workspace h3,
.tour-customize-root .tour-customize-option h4,
.tour-customize-root .tour-customize-timeline__item h4 {
  margin: 0;
  color: var(--text-strong);
  letter-spacing: 0;
}

.tour-customize-root .tour-customize__header h2 {
  font-size: clamp(1.3rem, 2vw, 1.9rem);
  line-height: 1.05;
}

.tour-customize-root .tour-customize__header p,
.tour-customize-root .tour-customize-option p,
.tour-customize-root .tour-customize-timeline__item p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.35;
}

.tour-customize-root .tour-customize__header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.tour-customize-root .tour-customize__close {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.tour-customize-root .tour-customize__close:hover,
.tour-customize-root .tour-customize__close:focus-visible {
  border-color: var(--accent);
  background: var(--accent-dark);
  color: #fff;
}

.tour-customize-root .tour-customize__workspace {
  display: grid;
  grid-template-columns: 30% minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  background: var(--tour-customize-workspace-background);
}

.tour-customize-root .tour-customize-embedded {
  overflow: hidden;
  border: 1px solid var(--tour-customize-line-color);
  border-radius: 8px;
  background: var(--tour-customize-workspace-background);
}

.tour-customize-root .tour-customize-embedded .tour-customize__workspace {
  max-height: min(72vh, 760px);
}

.tour-customize-root .tour-customize-embedded--full {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
}

.tour-customize-root .tour-customize-embedded--full .tour-customize__workspace {
  width: 100%;
  height: 100%;
  max-height: none;
}

.tour-customize-root .tour-customize-embedded--preview {
  width: 100%;
  height: 100%;
  min-height: var(--tour-customize-preview-min-height, 0);
  border: 0;
  border-radius: 0;
}

.tour-customize-root .tour-customize-embedded--preview .tour-customize__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: var(--tour-customize-preview-min-height, 0);
  max-height: none;
}

.tour-customize-root .tour-customize-embedded--preview .tour-customize-map {
  width: 100%;
  height: 100%;
  min-height: var(--tour-customize-preview-min-height, 0);
  border: 0;
}

.tour-customize-root .tour-customize-embedded--preview .tour-customize-map__controls,
.tour-customize-root .tour-customize-embedded--preview .tour-customize-options,
.tour-customize-root .tour-customize-embedded--preview .tour-customize-timeline {
  display: none;
}

.tour-customize-root .tour-customize-embedded.is-disabled .tour-customize-option,
.tour-customize-root .tour-customize-embedded.is-disabled .tour-customize-timeline__item {
  cursor: default;
  opacity: 0.68;
}

.tour-customize-root .tour-customize-map {
  position: relative;
  display: grid;
  place-items: center;
  align-self: stretch;
  width: 100%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #e7f5f7;
  container-type: size;
  cursor: zoom-in;
  touch-action: manipulation;
  user-select: none;
}

.tour-customize-root .tour-customize-map__stage {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  aspect-ratio: 1 / 2;
}

@supports (width: 1cqw) {
  .tour-customize-root .tour-customize-map__stage {
    width: min(100cqw, 50cqh);
    height: min(100cqh, 200cqw);
  }
}

.tour-customize-root .tour-customize-map__region {
  position: absolute;
  inset: 0;
  background-color: #e7f5f7;
  background-image: url("/assets/img/map.webp");
  background-position: var(--tour-customize-map-zoom-x, 50%) var(--tour-customize-map-zoom-y, 50%);
  background-repeat: no-repeat;
  background-size: 100% 100%;
  transition: background-size 0.22s ease, background-position 0.22s ease;
}

.tour-customize-root .tour-customize-map.is-zoomed {
  cursor: grab;
}

.tour-customize-root .tour-customize-map.is-zoomed.is-panning {
  cursor: grabbing;
}

.tour-customize-root .tour-customize-map.is-zoomed .tour-customize-map__region {
  background-size: 300% 300%;
}

.tour-customize-root .tour-customize-map.is-panning .tour-customize-map__region {
  transition: none;
}

.tour-customize-root .tour-customize-map__controls {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.tour-customize-root .tour-customize-map__optimize,
.tour-customize-root .tour-customize-map__zoom-out {
  display: none;
  place-items: center;
  height: 2rem;
  border: 1px solid rgba(25, 79, 147, 0.22);
  background: rgba(255, 255, 255, 0.92);
  color: #194f93;
  box-shadow: 0 8px 18px rgba(16, 27, 43, 0.18);
  cursor: pointer;
}

.tour-customize-root .tour-customize-map__optimize {
  display: inline-grid;
  min-width: 5.25rem;
  padding: 0 0.82rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
}

.tour-customize-root .tour-customize-map__optimize:hover,
.tour-customize-root .tour-customize-map__optimize:focus-visible,
.tour-customize-root .tour-customize-map__zoom-out:hover,
.tour-customize-root .tour-customize-map__zoom-out:focus-visible {
  border-color: rgba(25, 79, 147, 0.34);
  background: #fff;
}

.tour-customize-root .tour-customize-map__zoom-out {
  width: 2rem;
  border-radius: 999px;
}

.tour-customize-root .tour-customize-map.is-zoomed .tour-customize-map__zoom-out {
  display: grid;
}

.tour-customize-root .tour-customize-map__zoom-out span {
  position: relative;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-radius: 999px;
}

.tour-customize-root .tour-customize-map__zoom-out span::before,
.tour-customize-root .tour-customize-map__zoom-out span::after {
  content: "";
  position: absolute;
  background: currentColor;
}

.tour-customize-root .tour-customize-map__zoom-out span::before {
  left: 0.22rem;
  right: 0.22rem;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
}

.tour-customize-root .tour-customize-map__zoom-out span::after {
  right: -0.38rem;
  bottom: -0.28rem;
  width: 0.48rem;
  height: 2px;
  transform: rotate(45deg);
}

.tour-customize-root .tour-customize-map__route {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tour-customize-root .tour-customize-map__route path,
.tour-customize-root .tour-customize-map__route polyline {
  stroke: #194f93;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 5 5;
}

.tour-customize-root .tour-customize-map__marker {
  position: absolute;
  z-index: 2;
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
  height: 2rem;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  border-radius: 999px;
  background: #194f93;
  color: #fff;
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  box-shadow: 0 7px 16px rgba(16, 27, 43, 0.24);
}

.tour-customize-root .tour-customize-map__marker.is-drag-location {
  z-index: 4;
  min-width: 1.45rem;
  width: 1.45rem;
  height: 1.45rem;
  overflow: hidden;
  background: #d71920;
  color: transparent;
  font-size: 0;
  box-shadow: 0 0 0 0 rgba(215, 25, 32, 0.46), 0 9px 20px rgba(16, 27, 43, 0.28);
  text-indent: -999px;
  animation: tour-customize-map-drag-location 0.72s ease-in-out infinite;
}

@keyframes tour-customize-map-drag-location {
  0%,
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  50% {
    opacity: 0.42;
    transform: translate(-50%, -50%) scale(1.22);
  }
}

.tour-customize-root .tour-customize-options {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  padding: 1rem;
  border-bottom: 1px solid var(--line);
  background: #fff;
  overflow: hidden;
}

.tour-customize-root .tour-customize-options__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, var(--tour-customize-card-width));
  gap: var(--tour-customize-options-gap);
  align-content: start;
  justify-content: start;
  min-height: 0;
  margin-top: 0.8rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.tour-customize-root .tour-customize-option {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.26rem;
  width: var(--tour-customize-card-width);
  max-width: none;
  height: var(--tour-customize-card-height);
  min-height: 0;
  padding: 0.34rem 0.34rem 0.88rem;
  border: 2px solid var(--tour-customize-card-border-color);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(17, 27, 33, 0.08);
  text-align: center;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.tour-customize-root .tour-customize-option.is-dragging,
.tour-customize-root .tour-customize-timeline__item.is-dragging {
  opacity: 0.72;
}

.tour-customize-root .tour-customize-option.is-sticky-dragging,
.tour-customize-root .tour-customize-timeline__item.is-sticky-dragging {
  outline: 2px solid #2aa84a;
  outline-offset: 2px;
}

.tour-customize-root .tour-customize-timeline__item.is-dragging {
  position: relative;
  z-index: 1300;
}

.tour-customize-root .tour-customize-timeline__item.is-reordering {
  transition: transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tour-customize-root .tour-customize-timeline__item.is-optimizing-reorder {
  z-index: 6;
  box-shadow: 0 14px 28px rgba(16, 27, 43, 0.24);
  transition:
    transform 520ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 520ms ease;
}

.tour-customize-root .tour-customize-timeline__item.is-move-placeholder,
.tour-customize-root .tour-customize-timeline__item.is-move-placeholder.is-dragging,
.tour-customize-root .tour-customize-timeline__item.is-delete-candidate,
.tour-customize-root .tour-customize-timeline__item.is-delete-preview-terminal::after {
  display: none;
}

.tour-customize-root .tour-customize-option--location-break {
  grid-column-start: 1;
}

.tour-customize-root.tour-customize-pointer-dragging,
.tour-customize-root.tour-customize-pointer-dragging :where(button, [role="button"], article, section, div, span) {
  cursor: grabbing !important;
}

.tour-customize-root.tour-customize-pointer-dragging .tour-customize-timeline {
  position: relative;
  z-index: 30;
}

.tour-customize-root .tour-customize-drag-ghost {
  position: fixed;
  z-index: 2400;
  margin: 0;
  pointer-events: none;
  opacity: 1;
  visibility: visible;
  background: #fff;
  box-shadow: 0 16px 36px rgba(16, 27, 43, 0.26);
  isolation: isolate;
  transform: rotate(-1deg);
}

.tour-customize-root .tour-customize-drag-ghost.tour-customize-timeline__item,
.tour-customize-root .tour-customize-drag-ghost.tour-customize-timeline__item.is-dragging {
  z-index: 2400;
  opacity: 1;
  visibility: visible;
}

.tour-customize-root .tour-customize-drag-ghost.tour-customize-drag-ghost--card,
.tour-customize-root .tour-customize-drag-ghost.tour-customize-drag-ghost--card.is-dragging {
  z-index: 2400;
  border: 2px solid var(--tour-customize-card-border-color);
  background: #fff !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.tour-customize-root .tour-customize-drag-ghost.tour-customize-drag-ghost--card > * {
  visibility: visible;
}

.tour-customize-root .tour-customize-drag-ghost.tour-customize-drag-ghost--card .tour-customize-option__body {
  background: #fff !important;
}

.tour-customize-root .tour-customize-drag-ghost.tour-customize-drag-ghost--card .tour-customize-timeline__move-placeholder {
  display: none;
  visibility: hidden;
}

.tour-customize-root .tour-customize-drag-ghost.is-delete-target {
  box-shadow: 0 18px 42px rgba(158, 42, 43, 0.3);
}

.tour-customize-root .tour-customize-drag-ghost.is-delete-target::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: rgba(243, 244, 246, 0.94);
  box-shadow: 0 8px 20px rgba(16, 27, 43, 0.18);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.tour-customize-root .tour-customize-drag-ghost.is-delete-target::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  width: 25px;
  height: 25px;
  background: #9e2a2b;
  transform: translate(-50%, -50%);
  -webkit-mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M3%206h18'/%3E%3Cpath%20d='M8%206V4c0-1%201-2%202-2h4c1%200%202%201%202%202v2'/%3E%3Cpath%20d='M19%206l-1%2014c0%201-1%202-2%202H8c-1%200-2-1-2-2L5%206'/%3E%3Cpath%20d='M10%2011v6'/%3E%3Cpath%20d='M14%2011v6'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M3%206h18'/%3E%3Cpath%20d='M8%206V4c0-1%201-2%202-2h4c1%200%202%201%202%202v2'/%3E%3Cpath%20d='M19%206l-1%2014c0%201-1%202-2%202H8c-1%200-2-1-2-2L5%206'/%3E%3Cpath%20d='M10%2011v6'/%3E%3Cpath%20d='M14%2011v6'/%3E%3C/svg%3E") center / contain no-repeat;
  pointer-events: none;
}

.tour-customize-root .tour-customize-drag-ghost.is-smoke-dissolving {
  overflow: visible;
  border-color: transparent;
  background: transparent !important;
  box-shadow: none;
}

.tour-customize-root .tour-customize-drag-ghost.is-smoke-dissolving > :not(.tour-customize-smoke-puff) {
  opacity: 0;
  transition: opacity 120ms ease;
}

.tour-customize-root .tour-customize-drag-ghost.is-smoke-dissolving::before,
.tour-customize-root .tour-customize-drag-ghost.is-smoke-dissolving::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 5;
  width: 76px;
  height: 52px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 32% 48%, rgba(255, 255, 255, 0.95) 0 24%, transparent 52%),
    radial-gradient(circle at 56% 34%, rgba(217, 221, 226, 0.88) 0 28%, transparent 58%),
    radial-gradient(circle at 70% 58%, rgba(181, 189, 198, 0.52) 0 24%, transparent 58%);
  box-shadow: none;
  filter: blur(1px);
  opacity: 0;
  pointer-events: none;
  -webkit-mask: none;
  mask: none;
  animation: tour-customize-smoke-cloud 460ms ease-out both;
}

.tour-customize-root .tour-customize-drag-ghost.is-smoke-dissolving::after {
  width: 96px;
  height: 62px;
  animation-delay: 55ms;
}

.tour-customize-root .tour-customize-smoke-puff {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 6;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.96) 0 25%, transparent 58%),
    radial-gradient(circle at 58% 60%, rgba(195, 203, 212, 0.74) 0 34%, transparent 68%);
  filter: blur(0.8px);
  opacity: 0;
  pointer-events: none;
  animation: tour-customize-smoke-puff 430ms ease-out both;
}

@keyframes tour-customize-smoke-cloud {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.42);
  }

  28% {
    opacity: 0.9;
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -70%) scale(1.55);
  }
}

@keyframes tour-customize-smoke-puff {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.32);
  }

  30% {
    opacity: 0.86;
  }

  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--smoke-x, 0px)), calc(-50% + var(--smoke-y, -20px))) scale(var(--smoke-scale, 1.3));
  }
}

.tour-customize-root .tour-customize-option__image,
.tour-customize-root .tour-customize-option__thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  background: var(--surface-muted);
}

.tour-customize-root .tour-customize-option__image {
  position: relative;
  display: block;
  min-width: 0;
  padding: 0;
  border: 0;
  overflow: hidden;
  appearance: none;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}

.tour-customize-root .tour-customize-option__image[data-customize-image-count="0"],
.tour-customize-root .tour-customize-option__image[data-customize-image-count="1"] {
  cursor: default;
}

.tour-customize-root .tour-customize-option__image:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tour-customize-root .tour-customize-option__image img,
.tour-customize-root .tour-customize-option__image-dissolve {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.tour-customize-root .tour-customize-option__image > img:not(.tour-customize-option__image-dissolve) {
  transform: scale(1);
  transform-origin: center bottom;
  transition: transform 0.9s cubic-bezier(0.16, 0.88, 0.2, 1), filter 0.45s ease;
  will-change: transform;
}

.tour-customize-root .tour-customize-option__image[data-customize-image-count]:not([data-customize-image-count="0"]):not([data-customize-image-count="1"]):hover > img:not(.tour-customize-option__image-dissolve) {
  transform: scale(1.05);
  filter: saturate(1.03);
}

.tour-customize-root .tour-customize-option__image-dissolve {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  animation: tour-customize-image-dissolve 170ms ease-out forwards;
}

.tour-customize-root .tour-customize-option__image.is-swapping-image img {
  animation: tour-customize-image-reveal 170ms ease-out both;
}

@keyframes tour-customize-image-dissolve {
  100% {
    opacity: 0;
    filter: blur(3px);
  }
}

@keyframes tour-customize-image-reveal {
  0% {
    opacity: 0.72;
    filter: saturate(0.94);
  }

  100% {
    opacity: 1;
    filter: saturate(1);
  }
}

.tour-customize-root .tour-customize-option__thumb {
  display: block;
}

.tour-customize-root .tour-customize-option__body {
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.tour-customize-root .tour-customize-option h4 {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: var(--font-weight-regular);
  line-height: 1.12;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.tour-customize-root .tour-customize-option p {
  overflow: hidden;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tour-customize-root .tour-customize-option__location {
  color: var(--accent);
  font-weight: var(--font-weight-bold);
}

.tour-customize-root .tour-customize-option__body p:not(.tour-customize-option__location) {
  display: none;
}

.tour-customize-root .tour-customize-option__drag-dots {
  position: absolute;
  left: 50%;
  bottom: 0.28rem;
  width: 28px;
  height: 4px;
  background:
    linear-gradient(#000 0 0) 0 0 / 4px 4px no-repeat,
    linear-gradient(#000 0 0) 8px 0 / 4px 4px no-repeat,
    linear-gradient(#000 0 0) 16px 0 / 4px 4px no-repeat,
    linear-gradient(#000 0 0) 24px 0 / 4px 4px no-repeat;
  pointer-events: none;
  transform: translateX(-50%);
}

.tour-customize-root .tour-customize-timeline {
  grid-column: 1 / -1;
  min-height: 0;
  overflow: hidden;
  padding: 0.85rem 1rem 0.95rem;
  background: #f4faf5;
}

.tour-customize-root .tour-customize-timeline--drop-active {
  background: #eef8f0;
}

.tour-customize-root .tour-customize-timeline__day {
  position: absolute;
  z-index: 2;
  top: -1.28rem;
  left: 50%;
  width: 100%;
  max-width: 100%;
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: var(--font-weight-bold);
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  text-transform: none;
  transform: translateX(-50%);
  white-space: nowrap;
}

.tour-customize-root .tour-customize-timeline__list {
  --tour-customize-timeline-gap: 0.62rem;
  display: flex;
  flex-wrap: nowrap;
  gap: var(--tour-customize-timeline-gap);
  min-height: 10.4rem;
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
  padding-top: 1.25rem;
  padding-bottom: 0.25rem;
  scroll-snap-type: x proximity;
}

.tour-customize-root .tour-customize-timeline__item {
  flex: 0 0 var(--tour-customize-card-width);
  z-index: 1;
  scroll-snap-align: start;
}

.tour-customize-root .tour-customize-timeline__item:not(:last-of-type)::after {
  content: "";
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 100%;
  width: var(--tour-customize-timeline-gap);
  height: 4px;
  background: var(--line-strong);
  transform: translateY(-50%);
  pointer-events: none;
}

.tour-customize-root .tour-customize-timeline__move-placeholder {
  display: none;
  position: absolute;
  inset: 0;
  z-index: 3;
  place-items: center;
  align-content: center;
  gap: 0.2rem;
  color: #21843b;
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  pointer-events: none;
}

.tour-customize-root .tour-customize-timeline__move-placeholder span {
  display: inline-grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 999px;
  background: #2aa84a;
  color: #fff;
  font-size: 1.15rem;
  line-height: 1;
}

.tour-customize-root .tour-customize-timeline__move-placeholder strong,
.tour-customize-root .tour-customize-timeline__drop-slot strong {
  color: inherit;
  font-size: 0.76rem;
  letter-spacing: 0;
}

.tour-customize-root .tour-customize-timeline__item.is-move-placeholder .tour-customize-timeline__move-placeholder {
  display: grid;
  visibility: visible;
}

.tour-customize-root .tour-customize-timeline__drop-slot {
  position: relative;
  z-index: 1;
  flex: 0 0 var(--tour-customize-card-width);
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.2rem;
  width: var(--tour-customize-card-width);
  height: var(--tour-customize-card-height);
  min-height: 0;
  padding: 0.3rem;
  border: 1px dashed #2aa84a;
  border-radius: 8px;
  background: rgba(42, 168, 74, 0.07);
  color: #21843b;
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  scroll-snap-align: start;
}

.tour-customize-root .tour-customize-timeline__drop-slot span {
  display: inline-grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 999px;
  background: #2aa84a;
  color: #fff;
  font-size: 1.15rem;
  line-height: 1;
}

.tour-customize-root .tour-customize__empty {
  margin: 0;
  padding: 1rem;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--text-muted);
}

@media (max-width: 760px) {
  .tour-customize-root.tour-customize {
    align-items: start;
  }

  .tour-customize-root .tour-customize__dialog {
    width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .tour-customize-root .tour-customize__header {
    align-items: flex-start;
    flex-direction: column;
    padding: 0.85rem;
  }

  .tour-customize-root .tour-customize__header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .tour-customize-root .tour-customize__close {
    flex: 1 1 13rem;
    white-space: normal;
  }

  .tour-customize-root .tour-customize__workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(7rem, 0.4fr) minmax(0, 1fr) auto;
  }

  .tour-customize-root .tour-customize-embedded .tour-customize__workspace {
    max-height: none;
  }

  .tour-customize-root .tour-customize-map {
    min-height: 7rem;
  }

  .tour-customize-root .tour-customize-options {
    max-height: none;
    border-bottom: 1px solid var(--line);
  }

  .tour-customize-root .tour-customize-option {
    grid-template-columns: minmax(0, 1fr);
  }

  .tour-customize-root .tour-customize-timeline__item,
  .tour-customize-root .tour-customize-timeline__drop-slot {
    flex-basis: var(--tour-customize-card-width);
  }
}
`;

function createTourConfiguratorShadowMount(container, { mode = "embedded" } = {}) {
  if (typeof HTMLElement === "undefined" || !(container instanceof HTMLElement)) return null;
  const ownerDocument = container.ownerDocument || document;
  const host = ownerDocument.createElement("div");
  host.setAttribute("data-tour-configurator-host", "");
  host.setAttribute("data-tour-configurator-mode", mode === "modal" ? "modal" : "embedded");
  host.style.display = "block";
  host.style.width = "100%";
  host.style.minWidth = "0";
  host.style.minHeight = mode === "modal" ? "0" : "inherit";
  if (mode === "modal") {
    host.style.position = "fixed";
    host.style.top = "var(--tour-customize-modal-top, 0px)";
    host.style.right = "0";
    host.style.bottom = "0";
    host.style.left = "0";
    host.style.zIndex = "2300";
  } else {
    host.style.height = "100%";
  }
  const shadow = host.attachShadow({ mode: "open" });
  const style = ownerDocument.createElement("style");
  style.textContent = TOUR_CUSTOMIZER_COMPONENT_CSS;
  const root = ownerDocument.createElement("div");
  root.className = "tour-customize-root";
  shadow.append(style, root);
  container.appendChild(host);
  return {
    host,
    root,
    shadow,
    destroy() {
      host.remove();
    }
  };
}

export function createTourCustomizerWorkspace({
  root,
  mode = "default",
  labels = {},
  escapeHTML = defaultEscapeHTML,
  escapeAttr = escapeHTML,
  currentFrontendLang = () => "en",
  normalizeFrontendTourLang = (value) => normalizeText(value).toLowerCase() || "en",
  destinationScopeCatalog = () => null,
  travelPlanDays = () => [],
  findTripById = () => null,
  ensureTourDetailsLoaded = async () => null,
  allTrips = () => [],
  renderVisibleTrips = () => {},
  onTimelineChange = null
} = {}) {
  const frontendT = (key, fallback, vars = {}) => {
    const labelKey = TOUR_CUSTOMIZER_WORKSPACE_LABEL_KEYS[key] || key;
    return templateLabel(labels, labelKey, fallback, vars);
  };
  const runtime = createTourCustomizer({
    state: {},
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
  });
  return runtime.mountWorkspace({ root, mode, onTimelineChange });
}

export function createTourConfiguratorComponent(container, options = {}) {
  return createTourCustomizerWorkspace({
    ...options,
    root: container
  });
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
  let modalComponent = null;
  let draft = null;
  let lastFocusedElement = null;
  let activeDragPayload = null;
  let activeDropIndex = null;
  let activePointerDrag = null;
  let activeMapPan = null;
  let timelineInstanceCounter = 0;
  let lastStickyDragReleaseAt = Number.NEGATIVE_INFINITY;
  let modalCloseCallback = null;
  let lastStickyDragReleaseTargetKey = "";
  let forceTripRefreshOnClose = false;
  let embeddedWorkspaceRoot = null;
  let embeddedWorkspaceComponent = null;
  let embeddedWorkspaceTourId = "tour_variant_workspace";
  let embeddedWorkspaceTourTitle = "";
  let embeddedWorkspaceModules = [];
  let embeddedWorkspaceTimelineItems = [];
  let embeddedWorkspaceOriginalTimelineItems = [];
  let embeddedWorkspaceDisabled = false;
  let embeddedWorkspaceMode = "default";
  let embeddedWorkspaceEmptyOptionsLabel = "";
  let embeddedWorkspaceEmptyTimelineLabel = "";
  let embeddedWorkspaceOnTimelineChange = null;
  const cardTitleResetTimers = new WeakMap();
  const activeTimeouts = new Set();

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

  function isEmbeddedWorkspace() {
    return typeof HTMLElement !== "undefined" && embeddedWorkspaceRoot instanceof HTMLElement && modal === embeddedWorkspaceRoot;
  }

  function normalizeWorkspaceMode(value) {
    const normalized = normalizeText(value).toLowerCase().replace(/_/g, "-");
    return [
      "default",
      "preview",
      "full"
    ].includes(normalized) ? normalized : "default";
  }

  function customizerOwnerDocument() {
    if (typeof document === "undefined") return null;
    if (modal?.ownerDocument) return modal.ownerDocument;
    if (embeddedWorkspaceRoot?.ownerDocument) return embeddedWorkspaceRoot.ownerDocument;
    return document;
  }

  function setCustomizerDocumentClass(className, enabled, ownerDocument = customizerOwnerDocument()) {
    if (!className) return;
    const target = modal instanceof HTMLElement
      ? modal
      : embeddedWorkspaceRoot instanceof HTMLElement
        ? embeddedWorkspaceRoot
        : null;
    if (!(target instanceof HTMLElement)) return;
    if (enabled) {
      target.classList.add(className);
    } else {
      target.classList.remove(className);
    }
  }

  function scheduleTimeout(callback, delay = 0) {
    const setSchedule = typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? window.setTimeout.bind(window)
      : setTimeout;
    const handle = setSchedule(() => {
      activeTimeouts.delete(handle);
      callback();
    }, delay);
    activeTimeouts.add(handle);
    return handle;
  }

  function clearScheduledTimeout(handle) {
    if (!handle) return;
    const clearSchedule = typeof window !== "undefined" && typeof window.clearTimeout === "function"
      ? window.clearTimeout.bind(window)
      : clearTimeout;
    clearSchedule(handle);
    activeTimeouts.delete(handle);
  }

  function clearScheduledSideEffects() {
    for (const handle of activeTimeouts) {
      clearScheduledTimeout(handle);
    }
  }

  function appendCustomizerFloatingElement(element) {
    if (typeof HTMLElement === "undefined" || !(element instanceof HTMLElement)) return false;
    const root = modal instanceof HTMLElement
      ? modal
      : embeddedWorkspaceRoot instanceof HTMLElement
        ? embeddedWorkspaceRoot
        : null;
    if (!(root instanceof HTMLElement)) return false;
    root.appendChild(element);
    return true;
  }

  function forceOpaqueDragGhostCard(ghost) {
    if (!(ghost instanceof HTMLElement)) return;
    ghost.classList.add("tour-customize-drag-ghost--card");
    ghost.classList.remove("is-dragging", "is-sticky-dragging", "is-reordering", "is-move-placeholder");
    ghost.style.setProperty("box-sizing", "border-box", "important");
    ghost.style.setProperty("border", "2px solid var(--tour-customize-card-border-color, rgba(104, 133, 145, 0.95))", "important");
    ghost.style.setProperty("opacity", "1", "important");
    ghost.style.setProperty("visibility", "visible", "important");
    ghost.style.setProperty("background", "#fff", "important");
    ghost.style.setProperty("background-color", "#fff", "important");
    const body = ghost.querySelector(".tour-customize-option__body");
    if (body instanceof HTMLElement) {
      body.style.setProperty("background", "#fff", "important");
      body.style.setProperty("background-color", "#fff", "important");
    }
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

  function fallbackTimelineItemFromDayRef(item, {
    sourceTourId,
    sourceDayId,
    baseTourId,
    timelineInstanceId = "",
    rawDay = null
  } = {}) {
    const sourceId = sourceTourId && sourceDayId ? `${sourceTourId}:${sourceDayId}` : "";
    if (!sourceId) return null;
    const currentLang = lang();
    const title = normalizeText(
      resolveLocalizedField(rawDay, "title", currentLang)
      || item?.sourceDayTitle
      || item?.source_day_title
      || item?.title
      || sourceDayId
    );
    const sourceTourTitle = normalizeText(item?.sourceTourTitle || item?.source_tour_title || sourceTourId);
    const day = rawDay && typeof rawDay === "object" && !Array.isArray(rawDay)
      ? cloneJson(rawDay)
      : {
          id: sourceDayId,
          day_number: Number(item?.day_number) || null,
          title,
          title_i18n: title ? { [currentLang]: title } : {},
          services: []
        };
    return {
      id: sourceId,
      timelineInstanceId: normalizeText(timelineInstanceId) || createTimelineInstanceId(sourceId),
      variantDayId: normalizeText(item?.variantDayId || item?.variant_day_id || item?.id),
      source: sourceTourId === baseTourId ? "original" : "optional",
      sourceTourId,
      sourceDayId,
      sourceTourTitle,
      sourceDayExists: item?.sourceDayExists !== false && item?.source_day_exists !== false,
      sourceTourPublished: item?.sourceTourPublished !== false && item?.source_tour_published_on_webpage !== false,
      title,
      locationLabel: sourceTourTitle || sourceTourId,
      summary: item?.sourceDayExists === false || item?.source_day_exists === false
        ? t("tour.customize.source_day_unavailable", "Source day unavailable")
        : "",
      thumbnailUrl: "",
      routePoint: null,
      routePoints: [],
      mapPoint: null,
      imageEntries: [],
      imageUrls: [],
      day
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

  function timelineOrderSignature(timelineDays) {
    return (Array.isArray(timelineDays) ? timelineDays : [])
      .map(timelineItemKey)
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
    const routeLabel = customizedTimelineRouteLabel(days);
    const proposal = routeLabel || t("tour.customize.title_proposal_custom", "Custom Tour");
    return uniqueOrderedTexts([proposal]).slice(0, TOUR_CUSTOMIZE_TITLE_PROPOSAL_LIMIT);
  }

  function customizedTimelineRouteLabel(timelineDays) {
    const days = Array.isArray(timelineDays) ? timelineDays : [];
    return humanList(
      uniqueOrderedTexts(days.flatMap(titleLocationLabelsFromItem))
        .slice(0, TOUR_CUSTOMIZE_TITLE_LOCATION_LIMIT)
    );
  }

  function draftHasCustomizedTimeline() {
    if (!draft) return false;
    return timelineSignature(draft.timelineDays) !== timelineSignature(draft.originalTimelineDays);
  }

  function draftTitleProposals() {
    return draftHasCustomizedTimeline() ? buildCustomizedTourTitleProposals(draft.timelineDays) : [];
  }

  function draftTimelineTitle() {
    if (isEmbeddedWorkspace()) {
      const count = Array.isArray(draft?.timelineDays) ? draft.timelineDays.length : 0;
      return count
        ? t("tour.customize.timeline_with_count", "Tour Variant timeline ({count})", { count: String(count) })
        : t("tour.customize.timeline", "Tour Variant timeline");
    }
    const proposedTitle = draftTitleProposals()[0] || "";
    const title = proposedTitle || normalizeText(draft?.tourTitle);
    return title
      ? t("tour.customize.timeline_named", "Your Itinerary: {name}", { name: title })
      : t("tour.customize.timeline", "Your Itinerary");
  }

  function draftModalTitle() {
    const proposedTitle = draftTitleProposals()[0] || "";
    return proposedTitle
      || normalizeText(draft?.tourTitle)
      || t("tour.customize.title_proposal_custom", "Custom Tour");
  }

  function closeActionLabel() {
    return draftHasCustomizedTimeline()
      ? t(
          "tour.customize.confirm_refine",
          "Happy with this idea? Our local travel team will refine it from here"
        )
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

  function refreshModalTitleDom() {
    if (!modal || isEmbeddedWorkspace()) return false;
    const title = modal.querySelector("#tour_customize_title");
    if (!(title instanceof HTMLElement)) return false;
    title.textContent = draftModalTitle();
    return true;
  }

  function tourTitleForTimeline(trip) {
    const currentLang = lang();
    return resolveLocalizedText(trip?.title_i18n, currentLang)
      || resolveLocalizedText(trip?.title, currentLang);
  }

  function isTourVariantLikeTrip(trip) {
    const recordType = normalizeText(trip?.record_type).toLowerCase();
    if (recordType === "tour_variant") return true;
    return Boolean(normalizeText(trip?.base_marketing_tour_id));
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

  function customizationSummaryForTrip(trip) {
    const tourId = normalizeText(trip?.id);
    const customization = loadStoredCustomization(tourId);
    if (!customization) return "";
    const timelineDays = customization.timelineDays.map((item) => ({
      ...item,
      day: rehydratedTimelineDay(item, trip)
    })).filter((item) => item.day);
    const originalTimelineDays = originalTimelineFromTrip(trip);
    if (!timelineDays.length || timelineSignature(timelineDays) === timelineSignature(originalTimelineDays)) return "";
    const duration = t("tour.card.days", "{days} days", { days: String(timelineDays.length) });
    const route = customizedTimelineRouteLabel(timelineDays);
    return route
      ? t("tour.customize.summary", "Customized: {duration} via {route}", { duration, route })
      : t("tour.customize.summary_no_route", "Customized: {duration}", { duration });
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
        destinationCatalog,
        sourceTourTitle: tourTitleForTimeline(trip)
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
    const sourceTrips = (Array.isArray(trips) ? trips : []).filter((trip) => {
      const tripId = normalizeText(trip?.id);
      return tripId && (tripId === baseTourId || !isTourVariantLikeTrip(trip));
    });
    await Promise.all(sourceTrips.map(async (trip) => {
      const tripId = normalizeText(trip?.id);
      if (!tripId || (typeof travelPlanDays === "function" && travelPlanDays(trip).length)) return;
      try {
        await ensureTourDetailsLoaded?.(tripId);
      } catch {
        // Optional days are opportunistic; skip tours whose details fail to load.
      }
    }));
    const modules = sourceTrips.flatMap((trip) => {
      const sourceTourId = normalizeText(trip?.id);
      const sourceTourTitle = tourTitleForTimeline(trip);
      return (typeof travelPlanDays === "function" ? travelPlanDays(trip) : [])
        .map((day) => dayModuleFromDay({ day, sourceTourId, originalTourId: baseTourId, lang: currentLang, destinationCatalog, sourceTourTitle }))
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
          destinationCatalog,
          sourceTourTitle: tourTitleForTimeline(baseTrip)
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

  function timelineFromDayRefs(dayRefs, modules, baseTrip) {
    const baseTourId = normalizeText(baseTrip?.id);
    const byId = new Map((Array.isArray(modules) ? modules : []).map((item) => [normalizeText(item?.id), item]));
    const destinationCatalog = typeof destinationScopeCatalog === "function" ? destinationScopeCatalog() : null;
    return (Array.isArray(dayRefs) ? dayRefs : [])
      .map((item) => {
        const sourceTourId = normalizeText(item?.sourceTourId || item?.source_tour_id);
        const sourceDayId = normalizeText(item?.sourceDayId || item?.source_day_id);
        if (!sourceTourId || !sourceDayId) return null;
        const sourceId = `${sourceTourId}:${sourceDayId}`;
        const rawDay = item?.source_day && typeof item.source_day === "object" && !Array.isArray(item.source_day)
          ? item.source_day
          : item?.day && typeof item.day === "object" && !Array.isArray(item.day)
            ? item.day
            : null;
        const module = byId.get(sourceId) || (rawDay
          ? dayModuleFromDay({
              day: rawDay,
              sourceTourId,
              originalTourId: baseTourId,
              lang: lang(),
              destinationCatalog,
              sourceTourTitle: normalizeText(item?.sourceTourTitle || item?.source_tour_title)
            })
          : null);
        const timelineInstanceId = normalizeText(item?.timelineInstanceId || item?.timeline_instance_id || item?.id);
        const timelineItem = timelineItemFromModule(module, timelineInstanceId)
          || fallbackTimelineItemFromDayRef(item, {
            sourceTourId,
            sourceDayId,
            baseTourId,
            timelineInstanceId,
            rawDay
          });
        if (!timelineItem) return null;
        timelineItem.variantDayId = normalizeText(item?.variantDayId || item?.variant_day_id || item?.id);
        timelineItem.sourceTourTitle = normalizeText(item?.sourceTourTitle || item?.source_tour_title) || timelineItem.sourceTourTitle;
        timelineItem.sourceDayExists = item?.sourceDayExists !== false && item?.source_day_exists !== false;
        timelineItem.sourceTourPublished = item?.sourceTourPublished !== false && item?.source_tour_published_on_webpage !== false;
        return timelineItem;
      })
      .filter(Boolean);
  }

  function moduleMatchesWorkspaceQuery(module, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    const currentLang = lang();
    const day = module?.day && typeof module.day === "object" && !Array.isArray(module.day) ? module.day : {};
    const haystack = normalizeSearchText([
      module?.title,
      module?.locationLabel,
      module?.summary,
      module?.sourceTourTitle,
      module?.sourceTourId,
      module?.sourceDayId,
      resolveLocalizedField(day, "title", currentLang),
      resolveLocalizedField(day, "notes", currentLang),
      daySearchText(day, currentLang)
    ].join(" "));
    return haystack.includes(normalizedQuery);
  }

  function filterWorkspaceModules(modules, query) {
    const source = Array.isArray(modules) ? modules : [];
    return source.filter((module) => moduleMatchesWorkspaceQuery(module, query));
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
        const key = normalizeText(point?.key) || routeKeyForPoint(point?.routePoint);
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
    const entries = Array.isArray(item?.routePoints) && item.routePoints.length
      ? item.routePoints
      : [{ routePoint: item?.routePoint, mapPoint: item?.mapPoint, label: item?.locationLabel, key: item?.fallbackRouteKey }];
    return entries
      .map((entry) => {
        const mapPoint = entry?.mapPoint;
        const x = Number(mapPoint?.x);
        const y = Number(mapPoint?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return {
          ...entry,
          key: normalizeText(entry?.key) || routeKeyForPoint(entry?.routePoint),
          mapPoint: { x, y }
        };
      })
      .filter(Boolean);
  }

  function routeKeyForItem(item) {
    const entry = routePointEntriesForItem(item)[0];
    return normalizeText(entry?.key) || routeKeyForPoint(entry?.routePoint);
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
    const optimizeDisabled = isEmbeddedWorkspace() && (embeddedWorkspaceDisabled || draft.timelineDays.length <= 1);
    return `
      <section class="tour-customize-map${zoomClass}"${zoomStyle} aria-label="${escapeAttr(t("tour.customize.map", "Route map"))}">
        <div class="tour-customize-map__stage">
          <div class="tour-customize-map__region" aria-hidden="true"></div>
          <div class="tour-customize-map__controls">
            <button class="tour-customize-map__optimize" type="button" data-customize-optimize data-customize-map-control aria-label="${escapeAttr(t("tour.customize.optimize", "Optimize"))}" title="${escapeAttr(t("tour.customize.optimize", "Optimize"))}"${optimizeDisabled ? " disabled" : ""}>
              ${escapeHTML(t("tour.customize.optimize", "Optimize"))}
            </button>
            <button class="tour-customize-map__zoom-out" type="button" data-customize-map-zoom-out data-customize-map-control aria-label="${escapeAttr(t("tour.customize.zoom_out", "Zoom out"))}" title="${escapeAttr(t("tour.customize.zoom_out", "Zoom out"))}">
              <span aria-hidden="true"></span>
            </button>
          </div>
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
        </div>
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
      <article class="${escapeAttr(className)}${locationBreakClass}" ${dataAttributeName}="${escapeAttr(dataAttributeValue)}" draggable="false">
        ${item.thumbnailUrl
          ? `<button class="tour-customize-option__image" type="button" data-customize-card-image data-customize-image-index="0" data-customize-image-count="${escapeAttr(String(imageCount))}" aria-label="${escapeAttr(imageLabel)}">
              <img src="${escapeAttr(item.thumbnailUrl)}" alt="" loading="lazy" draggable="false" />
            </button>`
          : `<span class="tour-customize-option__thumb" aria-hidden="true"></span>`}
        <div class="tour-customize-option__body">
          <p class="tour-customize-option__location">${escapeHTML(item.locationLabel)}</p>
          <h4 data-customize-card-title data-customize-day-title="${escapeAttr(item.title)}">${escapeHTML(item.title)}</h4>
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

  function renderTimelineEmptyState() {
    const label = isEmbeddedWorkspace() && embeddedWorkspaceEmptyTimelineLabel
      ? embeddedWorkspaceEmptyTimelineLabel
      : t("tour.customize.empty_timeline", "Add at least one day to keep customizing.");
    return `<p class="tour-customize__empty">${escapeHTML(label)}</p>`;
  }

  function createTourCustomizerWorkspaceModule() {
    function emptyOptionsLabel() {
      return isEmbeddedWorkspace() && embeddedWorkspaceEmptyOptionsLabel
        ? embeddedWorkspaceEmptyOptionsLabel
        : t("tour.customize.no_optional_days", "No optional days are available for this route yet.");
    }

    function renderEmptyOptionsState() {
      return `<p class="tour-customize__empty">${escapeHTML(emptyOptionsLabel())}</p>`;
    }

    function currentOptionalDays() {
      return optionalModules(draft.modules, draft.originalTimelineDays);
    }

    function render() {
      const optionalDays = currentOptionalDays();
      const timelineTitle = draftTimelineTitle();
      return `
        <div class="tour-customize__workspace">
          ${renderMap()}
          <section class="tour-customize-options" aria-label="${escapeAttr(t("tour.customize.optional_days", "Optional days"))}">
            <h3>${escapeHTML(t("tour.customize.optional_days", "Optional days"))}</h3>
            <div class="tour-customize-options__list">
              ${optionalDays.length ? renderOptionalCards(optionalDays) : renderEmptyOptionsState()}
            </div>
            </section>
            <section class="tour-customize-timeline" aria-label="${escapeAttr(timelineTitle)}">
          <div class="tour-customize-timeline__list" data-customize-timeline>
                ${draft.timelineDays.length
                ? draft.timelineDays.map(renderTimelineItem).join("")
                : renderTimelineEmptyState()}
            </div>
          </section>
        </div>
      `;
    }

    function bind(root) {
      bindMapZoom(root);
      bindDragAndDrop(root);
    }

    function refreshMap(root) {
      if (!root) return false;
      const currentMap = root.querySelector(".tour-customize-map");
      if (!(currentMap instanceof HTMLElement)) return false;
      currentMap.outerHTML = renderMap();
      bindMapZoom(root);
      return true;
    }

    function refreshOptions(root) {
      if (!root || !draft) return false;
      const optionsList = root.querySelector(".tour-customize-options__list");
      if (!(optionsList instanceof HTMLElement)) return false;
      const optionalDays = currentOptionalDays();
      optionsList.innerHTML = optionalDays.length
        ? renderOptionalCards(optionalDays)
        : renderEmptyOptionsState();
      optionsList.querySelectorAll("[data-customize-option-id]").forEach((element) => {
        if (element instanceof HTMLElement) bindDraggableElement(element, root);
      });
      return true;
    }

    function refreshTimelineTitle(root) {
      if (!root || !draft) return false;
      const section = root.querySelector(".tour-customize-timeline");
      const timelineTitle = draftTimelineTitle();
      if (!(section instanceof HTMLElement)) return false;
      section.setAttribute("aria-label", timelineTitle);
      return true;
    }

    function insertTimelineItem(root, item, insertIndex) {
      if (!root || !draft) return false;
      const timeline = root.querySelector("[data-customize-timeline]");
      if (!(timeline instanceof HTMLElement)) return false;
      timeline.querySelector(".tour-customize__empty")?.remove();
      const template = (root.ownerDocument || customizerOwnerDocument() || document).createElement("template");
      template.innerHTML = renderTimelineItem(item, insertIndex).trim();
      const element = template.content.firstElementChild;
      if (!(element instanceof HTMLElement)) return false;
      const items = timelineItemElements(timeline);
      timeline.insertBefore(element, items[insertIndex] || null);
      bindDraggableElement(element, root);
      updateTimelineDayLabels(timeline);
      return true;
    }

    function refreshTimeline(root) {
      if (!root || !draft) return false;
      const timeline = root.querySelector("[data-customize-timeline]");
      if (!(timeline instanceof HTMLElement)) return false;
      timeline.innerHTML = draft.timelineDays.length
        ? draft.timelineDays.map(renderTimelineItem).join("")
        : renderTimelineEmptyState();
      timeline.querySelectorAll("[data-customize-timeline-id]").forEach((element) => {
        if (element instanceof HTMLElement) bindDraggableElement(element, root);
      });
      return true;
    }

    function removeTimelineItem(root, itemId, sourceElement = null) {
      if (!root || !draft) return false;
      const timelineKey = normalizeText(itemId);
      const timeline = root.querySelector("[data-customize-timeline]");
      if (!timelineKey || !(timeline instanceof HTMLElement)) return false;
      const sourceMatches = sourceElement instanceof HTMLElement
        && timeline.contains(sourceElement)
        && normalizeText(sourceElement.getAttribute("data-customize-timeline-id")) === timelineKey;
      const element = sourceMatches
        ? sourceElement
        : timeline.querySelector(`[data-customize-timeline-id="${CSS.escape(timelineKey)}"]`);
      if (!(element instanceof HTMLElement)) return refreshTimeline(root);
      element.remove();
      if (!draft.timelineDays.length) {
        timeline.innerHTML = renderTimelineEmptyState();
      } else {
        updateTimelineDayLabels(timeline);
      }
      return true;
    }

    return {
      render,
      bind,
      refreshMap,
      refreshOptions,
      refreshTimelineTitle,
      insertTimelineItem,
      refreshTimeline,
      removeTimelineItem
    };
  }

  const customizerWorkspaceModule = createTourCustomizerWorkspaceModule();

  function renderModalBody() {
    const modalTitle = draftModalTitle();
    return `
      <div class="tour-customize__dialog" role="dialog" aria-modal="true" aria-labelledby="tour_customize_title">
        <header class="tour-customize__header">
          <div>
            <h2 id="tour_customize_title">${escapeHTML(modalTitle)}</h2>
          </div>
          <div class="tour-customize__header-actions">
            <button class="btn btn-secondary" type="button" data-customize-reset>${escapeHTML(t("tour.customize.reset", "Reset tour"))}</button>
            ${renderCloseActionButton()}
          </div>
        </header>
        ${customizerWorkspaceModule.render()}
      </div>
    `;
  }

  function renderModal() {
    if (!modal) return;
    if (isEmbeddedWorkspace()) {
      renderEmbeddedWorkspace();
      return;
    }
    modal.innerHTML = renderModalBody();
    bindModalEvents();
  }

  function renderEmbeddedWorkspace() {
    if (!(embeddedWorkspaceRoot instanceof HTMLElement)) return;
    modal = embeddedWorkspaceRoot;
    modal.classList.add("tour-customize-runtime-root");
    const modeClass = embeddedWorkspaceMode === "default" ? "" : ` tour-customize-embedded--${embeddedWorkspaceMode}`;
    modal.innerHTML = `
      <div class="tour-customize-embedded${modeClass}${embeddedWorkspaceDisabled ? " is-disabled" : ""}" data-tour-customize-embedded>
        ${customizerWorkspaceModule.render()}
      </div>
    `;
    bindModalEvents();
    syncEmbeddedWorkspaceInteractivity();
  }

  function syncEmbeddedWorkspaceInteractivity() {
    if (!isEmbeddedWorkspace() || embeddedWorkspaceMode !== "preview" || !(modal instanceof HTMLElement)) return;
    modal.querySelectorAll("button, [tabindex]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.setAttribute("tabindex", "-1");
      element.setAttribute("aria-hidden", "true");
    });
  }

  function refreshMapDom() {
    return customizerWorkspaceModule.refreshMap(modal);
  }

  function refreshOptionsDom() {
    return customizerWorkspaceModule.refreshOptions(modal);
  }

  function refreshTimelineTitleDom() {
    return customizerWorkspaceModule.refreshTimelineTitle(modal);
  }

  function insertTimelineItemDom(item, insertIndex) {
    return customizerWorkspaceModule.insertTimelineItem(modal, item, insertIndex);
  }

  function refreshTimelineDom() {
    return customizerWorkspaceModule.refreshTimeline(modal);
  }

  function removeTimelineItemDom(itemId, sourceElement = null) {
    return customizerWorkspaceModule.removeTimelineItem(modal, itemId, sourceElement);
  }

  function notifyEmbeddedWorkspaceTimelineChange() {
    if (!isEmbeddedWorkspace() || typeof embeddedWorkspaceOnTimelineChange !== "function" || !draft) return;
    embeddedWorkspaceTimelineItems = Array.isArray(draft.timelineDays) ? draft.timelineDays : [];
    try {
      embeddedWorkspaceOnTimelineChange(cloneJson(embeddedWorkspaceTimelineItems));
    } catch (error) {
      console.error("Tour customizer workspace change callback failed.", error);
    }
  }

  function refreshAfterTimelineChange({ refreshOptions = false } = {}) {
    refreshMapDom();
    if (refreshOptions) refreshOptionsDom();
    refreshTimelineTitleDom();
    refreshModalTitleDom();
    refreshCloseActionDom();
    notifyEmbeddedWorkspaceTimelineChange();
  }

  function optimizeTimelineOrder() {
    if (!draft || !Array.isArray(draft.timelineDays) || draft.timelineDays.length < 2) return false;
    const currentDistance = timelineTravelDistance(draft.timelineDays);
    const optimizedTimelineDays = optimizeTimelineDaysByDistance(draft.timelineDays);
    const optimizedDistance = timelineTravelDistance(optimizedTimelineDays);
    const currentSignature = timelineOrderSignature(draft.timelineDays);
    const optimizedSignature = timelineOrderSignature(optimizedTimelineDays);
    if (
      optimizedSignature === currentSignature
      || !(optimizedDistance + TOUR_CUSTOMIZE_DISTANCE_IMPROVEMENT_EPSILON < currentDistance)
    ) {
      return false;
    }
    draft.timelineDays = optimizedTimelineDays;
    const timeline = modal?.querySelector("[data-customize-timeline]");
    if (timeline instanceof HTMLElement) {
      animateTimelineDomOrder(timeline, () => syncTimelineDomOrder(timeline), {
        className: "is-optimizing-reorder",
        duration: TOUR_CUSTOMIZE_OPTIMIZE_REORDER_ANIMATION_MS
      });
    } else {
      refreshTimelineDom();
    }
    refreshAfterTimelineChange();
    return true;
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
    scheduleTimeout(() => {
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
    card.style.removeProperty("border");
    card.style.removeProperty("box-sizing");
    card.style.removeProperty("background");
    card.style.removeProperty("background-color");
    card.style.removeProperty("opacity");
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
      const puff = (card.ownerDocument || customizerOwnerDocument() || document).createElement("span");
      puff.className = "tour-customize-smoke-puff";
      puff.style.setProperty("--smoke-x", x);
      puff.style.setProperty("--smoke-y", y);
      puff.style.setProperty("--smoke-scale", scale);
      puff.style.animationDelay = delay;
      puff.setAttribute("aria-hidden", "true");
      puff.dataset.smokePuff = String(index + 1);
      card.appendChild(puff);
    });
    scheduleTimeout(() => {
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
      const previousLength = draft.timelineDays.length;
      draft.timelineDays = draft.timelineDays.filter((item) => timelineItemKey(item) !== timelineKey);
      if (draft.timelineDays.length === previousLength) return;
      if (removeTimelineItemDom(timelineKey, sourceElement)) {
        refreshAfterTimelineChange();
      } else {
        renderModal();
      }
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
    forceOpaqueDragGhostCard(clone);
    clone.setAttribute("aria-hidden", "true");
    clone.removeAttribute("data-customize-timeline-id");
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    if (!appendCustomizerFloatingElement(clone)) {
      commitRemoval();
      return;
    }
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
    const ownerDocument = customizerOwnerDocument();
    if (activePointerDrag) cleanupPointerDrag({ animateCancel: false });
    const onClose = modalCloseCallback;
    const closedTourId = normalizeText(draft?.tourId);
    const shouldRefreshTrips = (persistDraft ? persistDraftCustomization() : false) || forceTripRefreshOnClose;
    setCustomizerDocumentClass("tour-customize-pointer-dragging", false, ownerDocument);
    setCustomizerDocumentClass("tour-customize-sticky-dragging", false, ownerDocument);
    if (modalComponent) {
      modalComponent.destroy();
      modalComponent = null;
    } else if (modal?.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    modal = null;
    draft = null;
    modalCloseCallback = null;
    forceTripRefreshOnClose = false;
    activeDragPayload = null;
    activeDropIndex = null;
    activePointerDrag = null;
    cleanupMapPan();
    clearScheduledSideEffects();
    if (restoreFocus && lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
    if (shouldRefreshTrips) renderVisibleTrips?.();
    if (typeof onClose === "function") {
      try {
        onClose({ tourId: closedTourId, refreshedTrips: shouldRefreshTrips });
      } catch (error) {
        console.error("Tour customizer close callback failed.", error);
      }
    }
  }

  function resetDraftToOriginal() {
    if (!draft) return;
    if (clearCustomization(draft.tourId)) forceTripRefreshOnClose = true;
    draft.originalTimelineDays = originalTimelineFromTrip({ id: draft.tourId }, draft.modules);
    draft.timelineDays = draft.originalTimelineDays;
    renderModal();
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
    const slot = existing instanceof HTMLElement
      ? existing
      : (timeline.ownerDocument || customizerOwnerDocument() || document).createElement("div");
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

  function animateTimelineDomOrder(timeline, applyOrderChange, options = {}) {
    if (!(timeline instanceof HTMLElement) || typeof applyOrderChange !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      applyOrderChange();
      return;
    }
    const className = normalizeText(options?.className) || "is-reordering";
    const duration = Math.max(
      0,
      Number.isFinite(Number(options?.duration)) ? Number(options.duration) : TOUR_CUSTOMIZE_REORDER_ANIMATION_MS
    );
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
      element.classList.remove("is-optimizing-reorder");
      element.style.transition = "none";
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      movingElements.push(element);
    });
    if (!movingElements.length) return;
    timeline.offsetHeight;
    movingElements.forEach((element) => {
      element.classList.add(className);
      element.style.removeProperty("transition");
      element.style.removeProperty("transform");
      scheduleTimeout(() => {
        element.classList.remove(className);
      }, duration + 40);
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
    forceOpaqueDragGhostCard(ghost);
    ghost.querySelector(".tour-customize-timeline__move-placeholder")?.remove();
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

  function imageEntriesForItem(item) {
    const sourceEntries = Array.isArray(item?.imageEntries) && item.imageEntries.length
      ? item.imageEntries
      : customerVisibleDayImages(item?.day, lang());
    const seen = new Set();
    const entries = [];
    for (const sourceEntry of sourceEntries) {
      const url = normalizeText(sourceEntry?.url || sourceEntry);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      entries.push({
        url,
        title: compactText(sourceEntry?.title)
      });
    }
    if (entries.length || !Array.isArray(item?.imageUrls)) return entries;
    for (const sourceUrl of item.imageUrls) {
      const url = normalizeText(sourceUrl);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      entries.push({ url, title: "" });
    }
    return entries;
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
    scheduleTimeout(() => {
      overlay?.remove?.();
      imageButton.classList.remove("is-swapping-image");
    }, TOUR_CUSTOMIZE_IMAGE_DISSOLVE_MS + 40);
  }

  function showTemporaryCardImageTitle(imageButton, item, imageTitle) {
    if (!(imageButton instanceof Element)) return;
    const card = imageButton.closest("[data-customize-option-id], [data-customize-timeline-id]");
    const titleElement = card?.querySelector("[data-customize-card-title]");
    if (!(titleElement instanceof HTMLElement)) return;
    const dayTitle = normalizeText(titleElement.dataset.customizeDayTitle) || normalizeText(item?.title);
    if (!dayTitle) return;
    titleElement.dataset.customizeDayTitle = dayTitle;
    titleElement.textContent = compactText(imageTitle) || dayTitle;
    const existingTimer = cardTitleResetTimers.get(titleElement);
    if (existingTimer) {
      clearScheduledTimeout(existingTimer);
    }
    const timer = scheduleTimeout(() => {
      titleElement.textContent = normalizeText(titleElement.dataset.customizeDayTitle) || dayTitle;
      cardTitleResetTimers.delete(titleElement);
    }, TOUR_CUSTOMIZE_IMAGE_TITLE_RESET_MS);
    cardTitleResetTimers.set(titleElement, timer);
  }

  function cycleCardImage(imageButton) {
    if (!(imageButton instanceof HTMLElement)) return false;
    const item = itemForImageButton(imageButton);
    const entries = imageEntriesForItem(item);
    const urls = entries.map((image) => image.url);
    if (!urls.length) return false;
    const img = imageButton.querySelector("img");
    if (!(img instanceof HTMLElement)) return false;
    const currentSrc = normalizeText(img.getAttribute("src"));
    const currentIndex = currentCardImageIndex(imageButton, urls, currentSrc);
    const nextIndex = urls.length > 1 ? (currentIndex + 1) % urls.length : currentIndex;
    const nextEntry = entries[nextIndex];
    const nextUrl = nextEntry?.url;
    imageButton.dataset.customizeImageIndex = String(nextIndex);
    if (urls.length > 1) animateCardImageSwap(imageButton, img, nextUrl);
    showTemporaryCardImageTitle(imageButton, item, nextEntry?.title);
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
    const marker = (modal?.ownerDocument || customizerOwnerDocument() || document).createElement("span");
    marker.className = "tour-customize-map__marker is-drag-location";
    marker.setAttribute("data-customize-drag-map-marker", "");
    marker.setAttribute("aria-hidden", "true");
    const mapPoint = displayedMapPoint(item.mapPoint);
    marker.style.left = `${mapPoint.x}%`;
    marker.style.top = `${mapPoint.y}%`;
    const mapStage = modal?.querySelector(".tour-customize-map__stage")
      || modal?.querySelector(".tour-customize-map");
    mapStage?.appendChild(marker);
  }

  function removePointerDragListeners(ownerDocument = activePointerDrag?.ownerDocument || customizerOwnerDocument()) {
    if (!ownerDocument) return;
    ownerDocument.removeEventListener("pointermove", handlePointerDragMove);
    ownerDocument.removeEventListener("pointerup", handlePointerDragEnd);
    ownerDocument.removeEventListener("pointercancel", handlePointerDragCancel);
    ownerDocument.removeEventListener("pointermove", handleStickyDragMove);
    ownerDocument.removeEventListener("pointerdown", handleStickyDragPointerDown, true);
    ownerDocument.removeEventListener("keydown", handleStickyDragKeydown, true);
  }

  function pointerDragMovedBeyondClick(pointerDrag, event) {
    if (!pointerDrag || !event) return false;
    const deltaX = Number(event.clientX) - Number(pointerDrag.startX);
    const deltaY = Number(event.clientY) - Number(pointerDrag.startY);
    return Math.hypot(deltaX, deltaY) >= TOUR_CUSTOMIZE_STICKY_DRAG_THRESHOLD_PX;
  }

  function dragEventTimestamp(event) {
    const timestamp = Number(event?.timeStamp);
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  }

  function dragTargetKeyFromElement(element) {
    if (!(element instanceof HTMLElement)) return "";
    const optionId = normalizeText(element.getAttribute("data-customize-option-id"));
    if (optionId) return `option:${optionId}`;
    const timelineId = normalizeText(element.getAttribute("data-customize-timeline-id"));
    return timelineId ? `timeline:${timelineId}` : "";
  }

  function dragTargetKeyFromTarget(target) {
    if (!(target instanceof Element)) return "";
    const element = target.closest("[data-customize-option-id], [data-customize-timeline-id]");
    return element instanceof HTMLElement ? dragTargetKeyFromElement(element) : "";
  }

  function isFreshStickyDragSecondPress(pointerDrag, event, sourceElement) {
    if (!pointerDrag?.sticky || !(sourceElement instanceof HTMLElement)) return false;
    const elapsed = dragEventTimestamp(event) - Number(pointerDrag.stickyActivatedAt || 0);
    return elapsed >= 0 && elapsed <= TOUR_CUSTOMIZE_DOUBLE_CLICK_DRAG_GRACE_MS;
  }

  function noteStickyDragRelease(event) {
    lastStickyDragReleaseAt = dragEventTimestamp(event);
    lastStickyDragReleaseTargetKey = dragTargetKeyFromTarget(event?.target);
  }

  function shouldSuppressDragStartAfterStickyRelease(event) {
    const elapsed = dragEventTimestamp(event) - lastStickyDragReleaseAt;
    if (elapsed < 0 || elapsed > TOUR_CUSTOMIZE_DOUBLE_CLICK_DRAG_GRACE_MS) return false;
    const targetKey = dragTargetKeyFromTarget(event?.target);
    return Boolean(targetKey && targetKey === lastStickyDragReleaseTargetKey);
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
    const ownerDocument = pointerDrag.ownerDocument || customizerOwnerDocument();
    if (!ownerDocument) return false;
    removePointerDragListeners(ownerDocument);
    pointerDrag.sticky = true;
    pointerDrag.stickyActivatedAt = dragEventTimestamp(event);
    pointerDrag.hasMoved = true;
    pointerDrag.source?.classList?.add("is-sticky-dragging");
    try {
      pointerDrag.source?.releasePointerCapture?.(pointerDrag.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    setCustomizerDocumentClass("tour-customize-sticky-dragging", true, ownerDocument);
    moveDragGhost(event);
    ownerDocument.addEventListener("pointermove", handleStickyDragMove, { passive: false });
    ownerDocument.addEventListener("pointerdown", handleStickyDragPointerDown, true);
    ownerDocument.addEventListener("keydown", handleStickyDragKeydown, true);
    return true;
  }

  function cleanupPointerDrag({ commit = false, event = null, animateCancel = true } = {}) {
    const pointerDrag = activePointerDrag;
    if (!pointerDrag) return;
    const ownerDocument = pointerDrag.ownerDocument || customizerOwnerDocument();
    activePointerDrag = null;
    activeDragPayload = null;
    clearMapDragHighlight();
    removePointerDragListeners(ownerDocument);
    setCustomizerDocumentClass("tour-customize-pointer-dragging", false, ownerDocument);
    setCustomizerDocumentClass("tour-customize-sticky-dragging", false, ownerDocument);
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
            onComplete: () => removeDay(pointerDrag.id, { sourceElement: pointerDrag.source })
          });
          return;
        }
        resetPointerDragSource();
        pointerDrag.ghost?.remove();
        removeDay(pointerDrag.id, { sourceElement: pointerDrag.source });
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
      noteStickyDragRelease(event);
      cleanupPointerDrag();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sourceElement = stickyDragSourceFromTarget(pointerDrag, event.target);
    if (isFreshStickyDragSecondPress(pointerDrag, event, sourceElement)) {
      moveDragGhost(event);
      return;
    }
    noteStickyDragRelease(event);
    if (pointerDrag.kind === "timeline" && pointerDrag.deleteActive) {
      updatePointerDragFromEvent(event);
      cleanupPointerDrag({ commit: true, event });
      return;
    }
    if (sourceElement) {
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

  function startPointerDrag(element, event, root, {
    startX = event?.clientX,
    startY = event?.clientY,
    hasMoved = false
  } = {}) {
    const isPrimaryAction = event?.button === 0 || (event?.type === "pointermove" && event?.buttons === 1);
    if (!(element instanceof HTMLElement) || !(root instanceof HTMLElement) || !isPrimaryAction || activePointerDrag) return false;
    const ownerDocument = root.ownerDocument || customizerOwnerDocument();
    if (!ownerDocument) return false;
    const optionId = element.getAttribute("data-customize-option-id");
    const timelineId = element.getAttribute("data-customize-timeline-id");
    const id = normalizeText(optionId || timelineId);
    const kind = optionId ? "option" : timelineId ? "timeline" : "";
    const timeline = root.querySelector("[data-customize-timeline]");
    if (!id || !kind || !(timeline instanceof HTMLElement)) return false;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true);
    ghost.classList.add("tour-customize-drag-ghost");
    forceOpaqueDragGhostCard(ghost);
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-customize-option-id");
    ghost.removeAttribute("data-customize-timeline-id");
    ghost.querySelector(".tour-customize-timeline__move-placeholder")?.remove();
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = "1";
    ghost.style.visibility = "visible";
    if (!appendCustomizerFloatingElement(ghost)) return false;
    activePointerDrag = {
      kind,
      id,
      pointerId: event.pointerId,
      source: element,
      ghost,
      ownerDocument,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: Number(startX),
      startY: Number(startY),
      hasMoved: Boolean(hasMoved),
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
    setCustomizerDocumentClass("tour-customize-pointer-dragging", true, ownerDocument);
    moveDragGhost(event);
    ownerDocument.addEventListener("pointermove", handlePointerDragMove, { passive: false });
    ownerDocument.addEventListener("pointerup", handlePointerDragEnd, { passive: false });
    ownerDocument.addEventListener("pointercancel", handlePointerDragCancel);
    return true;
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

  function bindCardImageCycleButtons(element, root = null) {
    if (!(element instanceof HTMLElement)) return;
    element.querySelectorAll("[data-customize-card-image]").forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.customizeImageCycleBound === "1") return;
      button.dataset.customizeImageCycleBound = "1";
      let imagePointerIntent = null;
      const cardElement = () => {
        const card = button.closest("[data-customize-option-id], [data-customize-timeline-id]");
        return card instanceof HTMLElement ? card : null;
      };
      const suppressNextImageClick = () => {
        button.dataset.customizeSuppressImageClick = "1";
      };
      const clearImagePointerIntent = () => {
        if (!imagePointerIntent) return;
        const ownerDocument = imagePointerIntent.ownerDocument || button.ownerDocument || customizerOwnerDocument();
        ownerDocument?.removeEventListener("pointermove", handleImagePointerMove);
        ownerDocument?.removeEventListener("pointerup", handleImagePointerEnd);
        ownerDocument?.removeEventListener("pointercancel", handleImagePointerCancel);
        try {
          button.releasePointerCapture?.(imagePointerIntent.pointerId);
        } catch {
          // Pointer capture may have already ended.
        }
        imagePointerIntent = null;
      };
      const startImagePointerIntent = (event) => {
        if (!(root instanceof HTMLElement) || !(cardElement() instanceof HTMLElement)) return;
        const ownerDocument = root.ownerDocument || button.ownerDocument || customizerOwnerDocument();
        if (!ownerDocument) return;
        clearImagePointerIntent();
        imagePointerIntent = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          ownerDocument
        };
        try {
          button.setPointerCapture?.(event.pointerId);
        } catch {
          // Some browsers deny pointer capture for nested button targets.
        }
        ownerDocument.addEventListener("pointermove", handleImagePointerMove, { passive: false });
        ownerDocument.addEventListener("pointerup", handleImagePointerEnd, { passive: false });
        ownerDocument.addEventListener("pointercancel", handleImagePointerCancel);
      };
      function handleImagePointerMove(event) {
        if (!imagePointerIntent || event.pointerId !== imagePointerIntent.pointerId) return;
        const deltaX = Number(event.clientX) - Number(imagePointerIntent.startX);
        const deltaY = Number(event.clientY) - Number(imagePointerIntent.startY);
        if (Math.hypot(deltaX, deltaY) < TOUR_CUSTOMIZE_STICKY_DRAG_THRESHOLD_PX) return;
        const card = cardElement();
        const startX = imagePointerIntent.startX;
        const startY = imagePointerIntent.startY;
        clearImagePointerIntent();
        if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
        event.preventDefault();
        event.stopPropagation();
        suppressNextImageClick();
        if (startPointerDrag(card, event, root, { startX, startY, hasMoved: true })) {
          updatePointerDragFromEvent(event);
        }
      }
      function handleImagePointerEnd(event) {
        if (!imagePointerIntent || event.pointerId !== imagePointerIntent.pointerId) return;
        clearImagePointerIntent();
      }
      function handleImagePointerCancel(event) {
        if (!imagePointerIntent || event.pointerId !== imagePointerIntent.pointerId) return;
        suppressNextImageClick();
        clearImagePointerIntent();
      }
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        startImagePointerIntent(event);
      });
      button.addEventListener("dragstart", (event) => {
        event.preventDefault();
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.dataset.customizeSuppressImageClick === "1") {
          delete button.dataset.customizeSuppressImageClick;
          return;
        }
        if (event.detail > 1) return;
        cycleCardImage(button);
      });
      button.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearImagePointerIntent();
        const card = cardElement();
        if (!(root instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
        if (startPointerDrag(card, event, root, { startX: event.clientX, startY: event.clientY, hasMoved: true })) {
          activateStickyPointerDrag(event);
        }
      });
    });
  }

  function bindDraggableElement(element, root) {
    if (!(element instanceof HTMLElement) || !(root instanceof HTMLElement) || element.dataset.customizeDragBound === "1") return;
    element.dataset.customizeDragBound = "1";
    element.draggable = false;
    element.setAttribute("draggable", "false");
    bindCardImageCycleButtons(element, root);
    if (element.matches("[data-customize-option-id], [data-customize-timeline-id]")) {
      element.addEventListener("pointerdown", (event) => {
        if (shouldSuppressDragStartAfterStickyRelease(event)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (isCustomizeDragBlockedTarget(event.target)) return;
        startPointerDrag(element, event, root);
      });
    }
    element.addEventListener("dragstart", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  function bindMapZoom(root) {
    const map = root?.querySelector?.(".tour-customize-map");
    if (!(map instanceof HTMLElement) || map.dataset.customizeMapZoomBound === "1") return;
    map.dataset.customizeMapZoomBound = "1";
    const zoomOutButton = map.querySelector("[data-customize-map-zoom-out]");
    const optimizeButton = map.querySelector("[data-customize-optimize]");
    const isMapControlTarget = (target) => target instanceof Element && Boolean(target.closest("[data-customize-map-control]"));
    const mapCoordinateRect = () => {
      const stage = map.querySelector(".tour-customize-map__stage");
      return (stage instanceof HTMLElement ? stage : map).getBoundingClientRect();
    };
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
    optimizeButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      optimizeTimelineOrder();
    });
    map.addEventListener("dblclick", (event) => {
      if (isMapControlTarget(event.target)) return;
      event.preventDefault();
      if (map.classList.contains("is-zoomed")) {
        zoomOut();
        return;
      }
      const rect = mapCoordinateRect();
      if (!rect.width || !rect.height) return;
      const x = clampMapZoomCenter(((event.clientX - rect.left) / rect.width) * 100);
      const y = clampMapZoomCenter(((event.clientY - rect.top) / rect.height) * 100);
      if (draft) draft.mapZoom = { zoomed: true, x, y };
      refreshMapDom();
    });
    map.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !draft?.mapZoom?.zoomed) return;
      if (isMapControlTarget(event.target)) return;
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
      const rect = mapCoordinateRect();
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
    if (isEmbeddedWorkspace() && embeddedWorkspaceDisabled) {
      root.querySelectorAll("[data-customize-option-id], [data-customize-timeline-id]").forEach((element) => {
        if (element instanceof HTMLElement) bindCardImageCycleButtons(element);
      });
      return;
    }
    root.querySelectorAll("[data-customize-option-id], [data-customize-timeline-id]").forEach((element) => {
      if (element instanceof HTMLElement) bindDraggableElement(element, root);
    });
  }

  function bindModalEvents() {
    if (!modal) return;
    if (!isEmbeddedWorkspace()) {
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
    }
    customizerWorkspaceModule.bind(modal);
  }

  function mountWorkspace({
    root,
    mode = "default",
    modules = [],
    timelineItems = [],
    disabled = false,
    emptyOptionsLabel = "",
    emptyTimelineLabel = "",
    onTimelineChange = null
  } = {}) {
    if (typeof HTMLElement === "undefined" || !(root instanceof HTMLElement)) {
      return {
        setState() {},
        setTripState() {},
        destroy() {}
      };
    }

    embeddedWorkspaceComponent = createTourConfiguratorShadowMount(root, { mode: "embedded" });
    if (!embeddedWorkspaceComponent?.root) {
      return {
        setState() {},
        setTripState() {},
        destroy() {}
      };
    }

    embeddedWorkspaceRoot = embeddedWorkspaceComponent.root;
    embeddedWorkspaceMode = normalizeWorkspaceMode(mode);
    embeddedWorkspaceOnTimelineChange = onTimelineChange;
    embeddedWorkspaceEmptyOptionsLabel = t("tour.customize.no_optional_days", "No optional days are available for this route yet.");
    embeddedWorkspaceEmptyTimelineLabel = t("tour.customize.empty_timeline", "Add at least one day to keep customizing.");
    let tripStateRequestId = 0;

    function setState(nextState = {}) {
      if (!(embeddedWorkspaceRoot instanceof HTMLElement)) return;
      if (Object.prototype.hasOwnProperty.call(nextState, "tourId")) {
        embeddedWorkspaceTourId = normalizeText(nextState.tourId) || embeddedWorkspaceTourId || "tour_variant_workspace";
      }
      if (Object.prototype.hasOwnProperty.call(nextState, "tourTitle")) {
        embeddedWorkspaceTourTitle = normalizeText(nextState.tourTitle);
      }
      if (Array.isArray(nextState.modules)) embeddedWorkspaceModules = nextState.modules.filter(Boolean);
      if (Array.isArray(nextState.timelineItems)) embeddedWorkspaceTimelineItems = nextState.timelineItems.filter(Boolean);
      if (Array.isArray(nextState.originalTimelineItems)) {
        embeddedWorkspaceOriginalTimelineItems = nextState.originalTimelineItems.filter(Boolean);
      }
      if (Object.prototype.hasOwnProperty.call(nextState, "disabled")) {
        embeddedWorkspaceDisabled = Boolean(nextState.disabled);
      }
      if (Object.prototype.hasOwnProperty.call(nextState, "mode")) {
        embeddedWorkspaceMode = normalizeWorkspaceMode(nextState.mode);
      }
      embeddedWorkspaceEmptyOptionsLabel = normalizeText(nextState.emptyOptionsLabel)
        || embeddedWorkspaceEmptyOptionsLabel;
      embeddedWorkspaceEmptyTimelineLabel = normalizeText(nextState.emptyTimelineLabel)
        || embeddedWorkspaceEmptyTimelineLabel;
      const previousZoom = isEmbeddedWorkspace() && draft?.mapZoom
        ? draft.mapZoom
        : { zoomed: false, x: 50, y: 50 };
      modal = embeddedWorkspaceRoot;
      draft = {
        tourId: embeddedWorkspaceTourId || "tour_variant_workspace",
        tourTitle: embeddedWorkspaceTourTitle || t("tour.customize.timeline", "Tour Variant timeline"),
        modules: embeddedWorkspaceModules,
        originalTimelineDays: embeddedWorkspaceOriginalTimelineItems,
        timelineDays: embeddedWorkspaceTimelineItems,
        mapZoom: previousZoom
      };
      renderEmbeddedWorkspace();
    }

    async function setTripState(nextState = {}) {
      const requestId = ++tripStateRequestId;
      const baseTrip = nextState.baseTrip && typeof nextState.baseTrip === "object" && !Array.isArray(nextState.baseTrip)
        ? nextState.baseTrip
        : null;
      const modules = baseTrip ? await candidateModulesForTrip(baseTrip) : [];
      if (requestId !== tripStateRequestId || !(embeddedWorkspaceRoot instanceof HTMLElement)) return;
      const originalTimelineItems = baseTrip ? originalTimelineFromTrip(baseTrip, modules) : [];
      const timelineItems = timelineFromDayRefs(nextState.selectedDayRefs, modules, baseTrip);
      setState({
        tourId: normalizeText(nextState.tourId) || normalizeText(baseTrip?.id) || "tour_variant_workspace",
        tourTitle: normalizeText(nextState.tourTitle) || tourTitleForTimeline(baseTrip),
        modules: filterWorkspaceModules(modules, nextState.moduleQuery),
        originalTimelineItems,
        timelineItems,
        disabled: nextState.disabled,
        emptyOptionsLabel: nextState.emptyOptionsLabel,
        emptyTimelineLabel: nextState.emptyTimelineLabel
      });
    }

    function destroy() {
      const ownerDocument = customizerOwnerDocument();
      const root = embeddedWorkspaceRoot;
      if (activePointerDrag) cleanupPointerDrag({ animateCancel: false });
      setCustomizerDocumentClass("tour-customize-pointer-dragging", false, ownerDocument);
      setCustomizerDocumentClass("tour-customize-sticky-dragging", false, ownerDocument);
      if (root instanceof HTMLElement) {
        root.classList.remove("tour-customize-runtime-root");
      }
      if (modal === embeddedWorkspaceRoot) {
        modal = null;
        draft = null;
      }
      activeDragPayload = null;
      activeDropIndex = null;
      cleanupMapPan();
      clearScheduledSideEffects();
      embeddedWorkspaceComponent?.destroy?.();
      embeddedWorkspaceComponent = null;
      embeddedWorkspaceRoot = null;
      embeddedWorkspaceTourId = "tour_variant_workspace";
      embeddedWorkspaceTourTitle = "";
      embeddedWorkspaceModules = [];
      embeddedWorkspaceTimelineItems = [];
      embeddedWorkspaceOriginalTimelineItems = [];
      embeddedWorkspaceDisabled = false;
      embeddedWorkspaceMode = "default";
      embeddedWorkspaceEmptyOptionsLabel = "";
      embeddedWorkspaceEmptyTimelineLabel = "";
      embeddedWorkspaceOnTimelineChange = null;
    }

    setState({ modules, timelineItems, disabled, emptyOptionsLabel, emptyTimelineLabel });
    return {
      setState,
      setTripState,
      destroy,
      getRootElement: () => embeddedWorkspaceRoot,
      getShadowRoot: () => embeddedWorkspaceComponent?.shadow || null
    };
  }

  async function open(tourId, options = {}) {
    if (typeof document === "undefined") return false;
    if (modalComponent || (modal instanceof HTMLElement && !isEmbeddedWorkspace())) {
      closeModal({ restoreFocus: false, persistDraft: true });
    }
    const normalizedTourId = normalizeText(tourId);
    let trip = typeof findTripById === "function" ? findTripById(normalizedTourId) : null;
    if (!trip) return false;
    trip = await ensureTourDetailsLoaded?.(normalizedTourId) || trip;
    const modules = await candidateModulesForTrip(trip);
    const originalTimelineDays = originalTimelineFromTrip(trip, modules);
    const timelineDays = initialTimelineFromTrip(trip, modules);
    if (!timelineDays.length) return false;
    lastFocusedElement = document.activeElement;
    modalCloseCallback = typeof options?.onClose === "function" ? options.onClose : null;
    forceTripRefreshOnClose = false;
    draft = {
      tourId: normalizedTourId,
      tourTitle: tourTitleForTimeline(trip),
      modules,
      originalTimelineDays,
      timelineDays,
      mapZoom: { zoomed: false, x: 50, y: 50 }
    };
    const mountContainer = options?.container instanceof HTMLElement ? options.container : document.body;
    modalComponent = createTourConfiguratorShadowMount(mountContainer, { mode: "modal" });
    if (!modalComponent?.root) {
      modalComponent = null;
      return false;
    }
    modal = modalComponent.root;
    modal.className = "tour-customize-root tour-customize";
    renderModal();
    const closeButton = modal.querySelector("[data-customize-close]");
    if (closeButton instanceof HTMLElement) closeButton.focus();
    return true;
  }

  function close(options = {}) {
    if (!modal || isEmbeddedWorkspace()) return false;
    closeModal(options);
    return true;
  }

  function isOpen() {
    return Boolean(modal && !isEmbeddedWorkspace());
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
    customizationSummaryForTrip,
    routePreviewForTrip,
    open,
    close,
    isOpen,
    mountWorkspace,
    openCustomizedOverviewPdf,
    openCustomizedTravelPlanPdf,
    openCustomizedPdf,
    clearCustomization
  };
}
