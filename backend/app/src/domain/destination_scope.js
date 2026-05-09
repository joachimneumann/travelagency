import { normalizeText } from "../lib/text.js";
import { enumOptionsFor, enumValueSetFor } from "../lib/generated_catalogs.js";
import {
  DESTINATION_COUNTRY_CODES,
  DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE,
  TOUR_DESTINATION_TO_COUNTRY_CODE
} from "../../../../shared/js/destination_country_codes.js";
import {
  normalizeTourDestinationCode
} from "./tour_catalog_i18n.js";

const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");
const DESTINATION_COUNTRY_ORDER = Object.freeze([...DESTINATION_COUNTRY_CODES]);
const DESTINATION_COUNTRY_LABELS = Object.freeze({
  VN: "Vietnam",
  TH: "Thailand",
  KH: "Cambodia",
  LA: "Laos"
});
const COUNTRY_LABELS_BY_CODE = Object.freeze(
  Object.fromEntries(
    enumOptionsFor("CountryCode").map((option) => {
      const code = normalizeText(option?.value).toUpperCase();
      const label = normalizeText(option?.label).replace(new RegExp(`^${code}\\s+`, "i"), "");
      return [code, label || code];
    })
  )
);
const DEFAULT_DESTINATION_CATALOG = Object.freeze(
  DESTINATION_COUNTRY_ORDER.map((code, index) => Object.freeze({
    code,
    label: DESTINATION_COUNTRY_LABELS[code] || code,
    sort_order: index,
    is_active: true
  }))
);

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || "";
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCoordinate(value, { min, max } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  if (Number.isFinite(min) && numberValue < min) return null;
  if (Number.isFinite(max) && numberValue > max) return null;
  return Number(numberValue.toFixed(5));
}

function normalizeMapZoom(value) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  const normalized = Math.round(numberValue);
  return normalized >= 0 && normalized <= 22 ? normalized : null;
}

function destinationLabel(value) {
  const countryCode = normalizeDestinationCountryCode(value);
  return DESTINATION_COUNTRY_LABELS[countryCode] || COUNTRY_LABELS_BY_CODE[countryCode] || countryCode;
}

export function normalizeDestinationCountryCode(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const directCode = normalized.toUpperCase();
  if (COUNTRY_CODE_SET.has(directCode)) return directCode;
  const tourCode = normalizeTourDestinationCode(normalized);
  return TOUR_DESTINATION_TO_COUNTRY_CODE[tourCode] || "";
}

export function countryCodeToTourDestinationCode(value) {
  const countryCode = normalizeDestinationCountryCode(value);
  return DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE[countryCode] || countryCode.toLowerCase();
}

export function tourDestinationCodeToCountryCode(value) {
  return normalizeDestinationCountryCode(value);
}

export function sortDestinationCountryCodes(values) {
  const orderLookup = new Map(DESTINATION_COUNTRY_ORDER.map((code, index) => [code, index]));
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map(normalizeDestinationCountryCode).filter(Boolean))
  ).sort((left, right) => {
    const leftIndex = orderLookup.has(left) ? orderLookup.get(left) : Number.POSITIVE_INFINITY;
    const rightIndex = orderLookup.has(right) ? orderLookup.get(right) : Number.POSITIVE_INFINITY;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.localeCompare(right);
  });
}

export function destinationScopeDestinations(scope) {
  return sortDestinationCountryCodes(
    (Array.isArray(scope) ? scope : [])
      .map((entry) => normalizeDestinationCountryCode(entry?.destination))
      .filter(Boolean)
  );
}

export function destinationScopeTourDestinations(scope) {
  return destinationScopeDestinations(scope).map(countryCodeToTourDestinationCode).filter(Boolean);
}

export function filterDestinationScopeByTourDestinations(scope, tourDestinations) {
  const allowedCountries = new Set(sortDestinationCountryCodes(tourDestinations));
  return normalizeDestinationScope(scope).filter((entry) => allowedCountries.has(entry.destination));
}

function normalizeDestinationScopeRegionSelection(rawRegion) {
  const source = rawRegion && typeof rawRegion === "object" && !Array.isArray(rawRegion) ? rawRegion : {};
  const regionId = normalizeOptionalText(source.region_id || source.area_id || source.id);
  if (!regionId) return null;
  const places = Array.from(
    new Set(
      (Array.isArray(source.places) ? source.places : [])
        .map((rawPlace) => {
          const placeSource = rawPlace && typeof rawPlace === "object" && !Array.isArray(rawPlace) ? rawPlace : {};
          return normalizeOptionalText(placeSource.place_id || placeSource.id || rawPlace);
        })
        .filter(Boolean)
    )
  ).map((placeId) => ({ place_id: placeId }));
  return {
    region_id: regionId,
    places
  };
}

function destinationEntryFromCode(destination) {
  const countryCode = normalizeDestinationCountryCode(destination);
  return countryCode ? { destination: countryCode, regions: [], places: [] } : null;
}

function normalizeDestinationScopePlaceSelections(rawPlaces) {
  return Array.from(
    new Set(
      (Array.isArray(rawPlaces) ? rawPlaces : [])
        .map((rawPlace) => {
          const placeSource = rawPlace && typeof rawPlace === "object" && !Array.isArray(rawPlace) ? rawPlace : {};
          return normalizeOptionalText(placeSource.place_id || placeSource.id || rawPlace);
        })
        .filter(Boolean)
    )
  ).map((placeId) => ({ place_id: placeId }));
}

export function normalizeDestinationScope(value, fallbackDestinations = []) {
  const entries = Array.isArray(value) && value.length
    ? value
    : sortDestinationCountryCodes(fallbackDestinations).map(destinationEntryFromCode).filter(Boolean);
  const byDestination = new Map();

  for (const rawEntry of entries) {
    const entry = rawEntry && typeof rawEntry === "object" && !Array.isArray(rawEntry) ? rawEntry : {};
    const destination = normalizeDestinationCountryCode(entry.destination || rawEntry);
    if (!destination) continue;
    const current = byDestination.get(destination) || { destination, regions: [], places: [] };
    const regionIds = new Set(current.regions.map((region) => region.region_id));
    const entryPlaces = normalizeDestinationScopePlaceSelections(entry.places);
    const currentPlaceIds = new Set(current.places.map((place) => place.place_id));
    for (const place of entryPlaces) {
      if (!currentPlaceIds.has(place.place_id)) {
        current.places.push(place);
        currentPlaceIds.add(place.place_id);
      }
    }
    const rawRegions = Array.isArray(entry.regions) ? entry.regions : (Array.isArray(entry.areas) ? entry.areas : []);
    for (const region of rawRegions.map(normalizeDestinationScopeRegionSelection).filter(Boolean)) {
      const existing = current.regions.find((item) => item.region_id === region.region_id);
      if (existing) {
        const placeIds = new Set(existing.places.map((place) => place.place_id));
        for (const place of region.places) {
          if (!placeIds.has(place.place_id)) {
            existing.places.push(place);
            placeIds.add(place.place_id);
          }
        }
        continue;
      }
      if (!regionIds.has(region.region_id)) {
        current.regions.push(region);
        regionIds.add(region.region_id);
      }
    }
    byDestination.set(destination, current);
  }

  return Array.from(byDestination.values()).sort((left, right) => {
    const leftIndex = DESTINATION_COUNTRY_ORDER.indexOf(left.destination);
    const rightIndex = DESTINATION_COUNTRY_ORDER.indexOf(right.destination);
    const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.POSITIVE_INFINITY;
    const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.POSITIVE_INFINITY;
    if (normalizedLeftIndex !== normalizedRightIndex) return normalizedLeftIndex - normalizedRightIndex;
    return left.destination.localeCompare(right.destination);
  });
}

export function normalizeTravelPlanDestinationScope(rawTravelPlan) {
  const source = rawTravelPlan && typeof rawTravelPlan === "object" && !Array.isArray(rawTravelPlan)
    ? rawTravelPlan
    : {};
  return normalizeDestinationScope(source.destination_scope);
}

function mergeDestinationScopeEntries(entries) {
  return normalizeDestinationScope(entries);
}

function addDestinationScopeRegion(entries, destination, regionId, placeId = "") {
  const normalizedDestination = normalizeDestinationCountryCode(destination);
  const normalizedRegionId = normalizeOptionalText(regionId);
  const normalizedPlaceId = normalizeOptionalText(placeId);
  if (!normalizedDestination || !normalizedRegionId) return;
  let destinationEntry = entries.find((entry) => entry.destination === normalizedDestination);
  if (!destinationEntry) {
    destinationEntry = { destination: normalizedDestination, regions: [], places: [] };
    entries.push(destinationEntry);
  }
  let regionEntry = destinationEntry.regions.find((entry) => entry.region_id === normalizedRegionId);
  if (!regionEntry) {
    regionEntry = { region_id: normalizedRegionId, places: [] };
    destinationEntry.regions.push(regionEntry);
  }
  if (normalizedPlaceId && !regionEntry.places.some((entry) => entry.place_id === normalizedPlaceId)) {
    regionEntry.places.push({ place_id: normalizedPlaceId });
  }
}

function addDestinationScopePlace(entries, destination, placeId) {
  const normalizedDestination = normalizeDestinationCountryCode(destination);
  const normalizedPlaceId = normalizeOptionalText(placeId);
  if (!normalizedDestination || !normalizedPlaceId) return;
  let destinationEntry = entries.find((entry) => entry.destination === normalizedDestination);
  if (!destinationEntry) {
    destinationEntry = { destination: normalizedDestination, regions: [], places: [] };
    entries.push(destinationEntry);
  }
  if (!destinationEntry.places.some((entry) => entry.place_id === normalizedPlaceId)) {
    destinationEntry.places.push({ place_id: normalizedPlaceId });
  }
}

export function destinationScopeFromLocationIds(locationIds, store) {
  const catalog = normalizeDestinationScopeCatalog(store);
  const destinationByCode = new Map(catalog.destinations.map((destination) => [destination.code, destination]));
  const regionById = new Map(catalog.regions.map((region) => [region.id, region]));
  const placeById = new Map(catalog.places.map((place) => [place.id, place]));
  const entries = [];

  for (const rawLocationId of Array.isArray(locationIds) ? locationIds : []) {
    const locationId = normalizeOptionalText(rawLocationId);
    if (!locationId) continue;
    const region = regionById.get(locationId);
    if (region) {
      addDestinationScopeRegion(entries, region.destination, region.id);
      continue;
    }
    const place = placeById.get(locationId);
    if (place) {
      const parentRegion = regionById.get(place.region_id);
      if (parentRegion) {
        addDestinationScopeRegion(entries, parentRegion.destination, parentRegion.id, place.id);
      } else {
        addDestinationScopePlace(entries, place.destination, place.id);
      }
      continue;
    }
    const countryCode = normalizeDestinationCountryCode(locationId);
    if (countryCode && destinationByCode.has(countryCode)) {
      entries.push({ destination: countryCode, regions: [], places: [] });
    }
  }

  return mergeDestinationScopeEntries(entries);
}

export function deriveDestinationScopeFromTravelPlanLocations(travelPlan, store) {
  const locationIds = [];
  for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
    const primaryLocationId = normalizeOptionalText(day?.primary_location_id);
    const secondaryLocationId = normalizeOptionalText(day?.secondary_location_id);
    if (primaryLocationId) locationIds.push(primaryLocationId);
    if (secondaryLocationId) locationIds.push(secondaryLocationId);
  }
  return destinationScopeFromLocationIds(locationIds, store);
}

export function mergeDestinationScopeWithTravelPlanLocations(scope, travelPlan, store) {
  return mergeDestinationScopeEntries([
    ...normalizeDestinationScope(scope),
    ...deriveDestinationScopeFromTravelPlanLocations(travelPlan, store)
  ]);
}

export function validateTravelPlanDayLocationIdsAgainstCatalog(travelPlan, store) {
  const catalog = normalizeDestinationScopeCatalog(store);
  if (!catalog.regions.length && !catalog.places.length) return { ok: true };
  const knownLocationIds = new Set([
    ...catalog.destinations.map((destination) => destination.code),
    ...catalog.regions.map((region) => region.id),
    ...catalog.places.map((place) => place.id)
  ]);
  for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
    for (const field of ["primary_location_id", "secondary_location_id"]) {
      const locationId = normalizeOptionalText(day?.[field]);
      if (locationId && !knownLocationIds.has(locationId)) {
        return { ok: false, error: `Unknown day location: ${locationId}` };
      }
    }
  }
  return { ok: true };
}

export function withDerivedDestinationsFromScope(travelPlan) {
  const source = travelPlan && typeof travelPlan === "object" && !Array.isArray(travelPlan) ? travelPlan : {};
  const destinationScope = normalizeTravelPlanDestinationScope(source);
  return {
    ...source,
    destination_scope: destinationScope,
    destinations: destinationScopeDestinations(destinationScope)
  };
}

function normalizeCatalogRegion(rawRegion, index = 0) {
  const source = rawRegion && typeof rawRegion === "object" && !Array.isArray(rawRegion) ? rawRegion : {};
  const destination = normalizeDestinationCountryCode(source.destination);
  const name = normalizeOptionalText(source.name);
  const code = slugify(source.code || name);
  if (!destination || !name) return null;
  const id = normalizeOptionalText(source.id) || `region_${destination.toLowerCase()}_${code}`;
  return {
    id,
    destination,
    code: code || id,
    name,
    sort_order: Number.isInteger(Number(source.sort_order)) ? Number(source.sort_order) : index,
    is_active: source.is_active !== false,
    created_at: normalizeOptionalText(source.created_at) || null,
    updated_at: normalizeOptionalText(source.updated_at) || null
  };
}

function normalizeCatalogPlace(rawPlace, { regionById, destinationSet }, index = 0) {
  const source = rawPlace && typeof rawPlace === "object" && !Array.isArray(rawPlace) ? rawPlace : {};
  const regionId = normalizeOptionalText(source.region_id || source.area_id);
  const region = regionById.get(regionId);
  const destination = normalizeDestinationCountryCode(source.destination || source.country || source.country_code || region?.destination);
  const name = normalizeOptionalText(source.name);
  const code = slugify(source.code || name);
  if (!destination || !destinationSet.has(destination) || (regionId && !region) || !name) return null;
  const id = normalizeOptionalText(source.id) || `place_${(regionId || destination.toLowerCase()).replace(/^region_/, "")}_${code}`;
  return {
    id,
    destination,
    ...(regionId ? { region_id: regionId } : {}),
    code: code || id,
    name,
    ...(normalizeCoordinate(source.latitude, { min: -90, max: 90 }) !== null ? { latitude: normalizeCoordinate(source.latitude, { min: -90, max: 90 }) } : {}),
    ...(normalizeCoordinate(source.longitude, { min: -180, max: 180 }) !== null ? { longitude: normalizeCoordinate(source.longitude, { min: -180, max: 180 }) } : {}),
    ...(normalizeMapZoom(source.map_zoom) !== null ? { map_zoom: normalizeMapZoom(source.map_zoom) } : {}),
    sort_order: Number.isInteger(Number(source.sort_order)) ? Number(source.sort_order) : index,
    is_active: source.is_active !== false,
    created_at: normalizeOptionalText(source.created_at) || null,
    updated_at: normalizeOptionalText(source.updated_at) || null
  };
}

function normalizeCatalogDestination(rawDestination, index = 0) {
  const source = rawDestination && typeof rawDestination === "object" && !Array.isArray(rawDestination)
    ? rawDestination
    : {};
  const code = normalizeDestinationCountryCode(source.code || source.destination || rawDestination);
  if (!code) return null;
  return {
    code,
    label: normalizeOptionalText(source.label || source.name) || destinationLabel(code),
    sort_order: Number.isInteger(Number(source.sort_order)) ? Number(source.sort_order) : index,
    is_active: source.is_active !== false,
    created_at: normalizeOptionalText(source.created_at) || null,
    updated_at: normalizeOptionalText(source.updated_at) || null
  };
}

export function normalizeDestinationScopeCatalog(store) {
  const configuredDestinations = Array.isArray(store?.destination_scope_destinations)
    ? store.destination_scope_destinations
    : [];
  const destinationSource = configuredDestinations.length
    ? configuredDestinations
    : DEFAULT_DESTINATION_CATALOG;
  const destinationByCode = new Map();
  destinationSource
    .map((destination, index) => normalizeCatalogDestination(destination, index))
    .filter(Boolean)
    .forEach((destination) => {
      if (!destinationByCode.has(destination.code)) {
        destinationByCode.set(destination.code, destination);
      }
    });
  const destinations = Array.from(destinationByCode.values()).sort((left, right) => {
    const leftIndex = DESTINATION_COUNTRY_ORDER.indexOf(left.code);
    const rightIndex = DESTINATION_COUNTRY_ORDER.indexOf(right.code);
    const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.POSITIVE_INFINITY;
    const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.POSITIVE_INFINITY;
    if (normalizedLeftIndex !== normalizedRightIndex) return normalizedLeftIndex - normalizedRightIndex;
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
    return left.label.localeCompare(right.label, "en", { sensitivity: "base" });
  });
  const destinationSet = new Set(destinations.map((destination) => destination.code));
  const rawRegions = Array.isArray(store?.destination_regions)
    ? store.destination_regions
    : (Array.isArray(store?.destination_areas) ? store.destination_areas : []);
  const regions = rawRegions
    .map(normalizeCatalogRegion)
    .filter((region) => region && destinationSet.has(region.destination));
  const regionById = new Map(regions.map((region) => [region.id, region]));
  const places = (Array.isArray(store?.destination_places) ? store.destination_places : [])
    .map((place, index) => normalizeCatalogPlace(place, { regionById, destinationSet }, index))
    .filter(Boolean);
  return {
    destinations,
    regions: regions.sort((left, right) => {
      if (left.destination !== right.destination) {
        return sortDestinationCountryCodes([left.destination, right.destination]).indexOf(left.destination) === 0 ? -1 : 1;
      }
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    }),
    places: places.sort((left, right) => {
      if (left.destination !== right.destination) {
        return sortDestinationCountryCodes([left.destination, right.destination]).indexOf(left.destination) === 0 ? -1 : 1;
      }
      const leftRegion = left.region_id || "";
      const rightRegion = right.region_id || "";
      if (leftRegion !== rightRegion) return leftRegion.localeCompare(rightRegion);
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    })
  };
}

export function buildDestinationScopeCatalogResponse(store, { lang = "en" } = {}) {
  const catalog = normalizeDestinationScopeCatalog(store);
  return {
    destinations: catalog.destinations.map((destination) => ({
      ...destination,
      label: normalizeOptionalText(destination.label) || destinationLabel(destination.code)
    })),
    regions: catalog.regions.map((region) => ({
      ...region,
      label: region.name
    })),
    places: catalog.places.map((place) => ({
      ...place,
      label: place.name
    }))
  };
}

export function validateDestinationScopeAgainstCatalog(scope, store) {
  const normalizedScope = normalizeDestinationScope(scope);
  const catalog = normalizeDestinationScopeCatalog(store);
  const destinationByCode = new Map(catalog.destinations.map((destination) => [destination.code, destination]));
  const regionById = new Map(catalog.regions.map((region) => [region.id, region]));
  const placeById = new Map(catalog.places.map((place) => [place.id, place]));

  for (const entry of normalizedScope) {
    if (!destinationByCode.has(entry.destination)) {
      return { ok: false, error: `Unknown destination: ${entry.destination}` };
    }
    for (const placeSelection of entry.places) {
      const place = placeById.get(placeSelection.place_id);
      if (!place) {
        return { ok: false, error: `Unknown destination place: ${placeSelection.place_id}` };
      }
      if (place.destination !== entry.destination) {
        return { ok: false, error: `Place ${placeSelection.place_id} does not belong to destination ${entry.destination}.` };
      }
      if (place.region_id) {
        return { ok: false, error: `Place ${placeSelection.place_id} belongs to region ${place.region_id}.` };
      }
    }
    for (const regionSelection of entry.regions) {
      const region = regionById.get(regionSelection.region_id);
      if (!region) {
        return { ok: false, error: `Unknown destination region: ${regionSelection.region_id}` };
      }
      if (region.destination !== entry.destination) {
        return { ok: false, error: `Region ${regionSelection.region_id} does not belong to destination ${entry.destination}.` };
      }
      for (const placeSelection of regionSelection.places) {
        const place = placeById.get(placeSelection.place_id);
        if (!place) {
          return { ok: false, error: `Unknown destination place: ${placeSelection.place_id}` };
        }
        if (place.region_id !== region.id) {
          return { ok: false, error: `Place ${placeSelection.place_id} does not belong to region ${region.id}.` };
        }
      }
    }
  }

  return { ok: true, destination_scope: normalizedScope };
}

export function createDestinationCatalogDestinationRecord(payload, { nowIso }) {
  const now = nowIso();
  const code = normalizeDestinationCountryCode(payload?.code || payload?.destination);
  if (!code) return { ok: false, error: "destination is required" };
  return {
    ok: true,
    destination: {
      code,
      label: normalizeOptionalText(payload?.label || payload?.name) || destinationLabel(code),
      sort_order: Number.isInteger(Number(payload?.sort_order)) ? Number(payload.sort_order) : 100,
      is_active: payload?.is_active !== false,
      created_at: normalizeOptionalText(payload?.created_at) || now,
      updated_at: now
    }
  };
}

export function createDestinationRegionRecord(payload, { randomUUID, nowIso }) {
  const now = nowIso();
  const destination = normalizeDestinationCountryCode(payload?.destination);
  const name = normalizeOptionalText(payload?.name);
  if (!destination) return { ok: false, error: "destination is required" };
  if (!name) return { ok: false, error: "name is required" };
  const code = slugify(payload?.code || name);
  return {
    ok: true,
    region: {
      id: normalizeOptionalText(payload?.id) || `region_${randomUUID()}`,
      destination,
      code,
      name,
      sort_order: Number.isInteger(Number(payload?.sort_order)) ? Number(payload.sort_order) : 100,
      is_active: payload?.is_active !== false,
      created_at: normalizeOptionalText(payload?.created_at) || now,
      updated_at: now
    }
  };
}

export function createDestinationPlaceRecord(payload, store, { randomUUID, nowIso }) {
  const now = nowIso();
  const catalog = normalizeDestinationScopeCatalog(store);
  const regionId = normalizeOptionalText(payload?.region_id || payload?.area_id);
  const region = catalog.regions.find((item) => item.id === regionId);
  const destination = normalizeDestinationCountryCode(payload?.destination || region?.destination);
  const name = normalizeOptionalText(payload?.name);
  if (regionId && !region) return { ok: false, error: "region_id is invalid" };
  if (!destination) return { ok: false, error: "destination is required" };
  if (!name) return { ok: false, error: "name is required" };
  const code = slugify(payload?.code || name);
  return {
    ok: true,
    place: {
      id: normalizeOptionalText(payload?.id) || `place_${randomUUID()}`,
      destination,
      ...(region ? { region_id: region.id } : {}),
      code,
      name,
      ...(normalizeCoordinate(payload?.latitude, { min: -90, max: 90 }) !== null ? { latitude: normalizeCoordinate(payload.latitude, { min: -90, max: 90 }) } : {}),
      ...(normalizeCoordinate(payload?.longitude, { min: -180, max: 180 }) !== null ? { longitude: normalizeCoordinate(payload.longitude, { min: -180, max: 180 }) } : {}),
      ...(normalizeMapZoom(payload?.map_zoom) !== null ? { map_zoom: normalizeMapZoom(payload.map_zoom) } : {}),
      sort_order: Number.isInteger(Number(payload?.sort_order)) ? Number(payload.sort_order) : 100,
      is_active: payload?.is_active !== false,
      created_at: normalizeOptionalText(payload?.created_at) || now,
      updated_at: now
    }
  };
}

function stripDestinationCatalogI18n(store) {
  const next = cloneJson(store || {});
  for (const record of Array.isArray(next.destination_scope_destinations) ? next.destination_scope_destinations : []) {
    delete record.label_i18n;
    delete record.name_i18n;
  }
  for (const record of Array.isArray(next.destination_regions) ? next.destination_regions : []) {
    delete record.name_i18n;
  }
  for (const record of Array.isArray(next.destination_places) ? next.destination_places : []) {
    delete record.name_i18n;
  }
  return next;
}

export async function ensureDestinationScopeCatalogI18n(store) {
  return {
    store: stripDestinationCatalogI18n(store),
    translated: false,
    errors: []
  };
}

export function upsertDestinationCatalogDestination(store, destination) {
  const next = cloneJson(store || {});
  next.destination_scope_destinations = Array.isArray(next.destination_scope_destinations) && next.destination_scope_destinations.length
    ? next.destination_scope_destinations
    : cloneJson(DEFAULT_DESTINATION_CATALOG);
  const normalizedDestination = normalizeCatalogDestination(destination, next.destination_scope_destinations.length);
  if (!normalizedDestination) return { ok: false, error: "Destination is invalid." };
  const index = next.destination_scope_destinations.findIndex((item) => (
    normalizeDestinationCountryCode(item?.code || item?.destination || item) === normalizedDestination.code
  ));
  if (index >= 0) return { ok: false, error: "This destination already exists." };
  next.destination_scope_destinations.push(normalizedDestination);
  return { ok: true, store: next, destination: normalizedDestination };
}

export function upsertDestinationRegion(store, region) {
  const next = cloneJson(store || {});
  next.destination_regions = Array.isArray(next.destination_regions) ? next.destination_regions : [];
  const normalizedRegion = normalizeCatalogRegion(region, next.destination_regions.length);
  if (!normalizedRegion) return { ok: false, error: "Region is invalid." };
  const destinationSet = new Set(normalizeDestinationScopeCatalog(next).destinations.map((destination) => destination.code));
  if (!destinationSet.has(normalizedRegion.destination)) {
    return { ok: false, error: `Unknown destination: ${normalizedRegion.destination}` };
  }
  const duplicate = next.destination_regions.find((item) => (
    normalizeDestinationCountryCode(item?.destination) === normalizedRegion.destination
    && slugify(item?.code || item?.name) === normalizedRegion.code
    && normalizeOptionalText(item?.id) !== normalizedRegion.id
  ));
  if (duplicate) return { ok: false, error: "A region with this code already exists for this destination." };
  const index = next.destination_regions.findIndex((item) => normalizeOptionalText(item?.id) === normalizedRegion.id);
  if (index >= 0) next.destination_regions[index] = normalizedRegion;
  else next.destination_regions.push(normalizedRegion);
  return { ok: true, store: next, region: normalizedRegion };
}

export function upsertDestinationPlace(store, place) {
  const next = cloneJson(store || {});
  next.destination_places = Array.isArray(next.destination_places) ? next.destination_places : [];
  const catalog = normalizeDestinationScopeCatalog(next);
  const normalizedPlace = normalizeCatalogPlace(place, {
    regionById: new Map(catalog.regions.map((region) => [region.id, region])),
    destinationSet: new Set(catalog.destinations.map((destination) => destination.code))
  }, next.destination_places.length);
  if (!normalizedPlace) return { ok: false, error: "Place is invalid." };
  const duplicate = next.destination_places.find((item) => (
    normalizeDestinationCountryCode(item?.destination) === normalizedPlace.destination
    && normalizeOptionalText(item?.region_id || item?.area_id) === normalizeOptionalText(normalizedPlace.region_id)
    && slugify(item?.code || item?.name) === normalizedPlace.code
    && normalizeOptionalText(item?.id) !== normalizedPlace.id
  ));
  if (duplicate) return { ok: false, error: "A place with this code already exists for this country or region." };
  const index = next.destination_places.findIndex((item) => normalizeOptionalText(item?.id) === normalizedPlace.id);
  if (index >= 0) next.destination_places[index] = normalizedPlace;
  else next.destination_places.push(normalizedPlace);
  return { ok: true, store: next, place: normalizedPlace };
}

export function deleteDestinationCatalogDestination(store, destination) {
  const normalizedDestination = normalizeDestinationCountryCode(destination);
  if (!normalizedDestination) return { ok: false, error: "Destination is required." };
  const next = cloneJson(store || {});
  next.destination_scope_destinations = Array.isArray(next.destination_scope_destinations) && next.destination_scope_destinations.length
    ? next.destination_scope_destinations
    : cloneJson(DEFAULT_DESTINATION_CATALOG);
  next.destination_regions = Array.isArray(next.destination_regions) ? next.destination_regions : [];
  next.destination_places = Array.isArray(next.destination_places) ? next.destination_places : [];
  const existing = next.destination_scope_destinations.find((item) => (
    normalizeDestinationCountryCode(item?.code || item?.destination || item) === normalizedDestination
  ));
  if (!existing) return { ok: false, error: "Destination not found." };
  if (next.destination_regions.some((region) => normalizeDestinationCountryCode(region?.destination) === normalizedDestination)) {
    return { ok: false, error: "Destination still has regions." };
  }
  if (next.destination_places.some((place) => normalizeDestinationCountryCode(place?.destination) === normalizedDestination)) {
    return { ok: false, error: "Destination still has places." };
  }
  next.destination_scope_destinations = next.destination_scope_destinations.filter((item) => (
    normalizeDestinationCountryCode(item?.code || item?.destination || item) !== normalizedDestination
  ));
  return { ok: true, store: next, destination: existing };
}

export function deleteDestinationRegion(store, regionId) {
  const normalizedRegionId = normalizeOptionalText(regionId);
  if (!normalizedRegionId) return { ok: false, error: "Region is required." };
  const next = cloneJson(store || {});
  next.destination_regions = Array.isArray(next.destination_regions) ? next.destination_regions : [];
  next.destination_places = Array.isArray(next.destination_places) ? next.destination_places : [];
  const existing = next.destination_regions.find((region) => normalizeOptionalText(region?.id) === normalizedRegionId);
  if (!existing) return { ok: false, error: "Region not found." };
  if (next.destination_places.some((place) => normalizeOptionalText(place?.region_id || place?.area_id) === normalizedRegionId)) {
    return { ok: false, error: "Region still has places." };
  }
  next.destination_regions = next.destination_regions.filter((region) => normalizeOptionalText(region?.id) !== normalizedRegionId);
  return { ok: true, store: next, region: existing };
}

export function deleteDestinationPlace(store, placeId) {
  const normalizedPlaceId = normalizeOptionalText(placeId);
  if (!normalizedPlaceId) return { ok: false, error: "Place is required." };
  const next = cloneJson(store || {});
  next.destination_places = Array.isArray(next.destination_places) ? next.destination_places : [];
  const existing = next.destination_places.find((place) => normalizeOptionalText(place?.id) === normalizedPlaceId);
  if (!existing) return { ok: false, error: "Place not found." };
  next.destination_places = next.destination_places.filter((place) => normalizeOptionalText(place?.id) !== normalizedPlaceId);
  return { ok: true, store: next, place: existing };
}
