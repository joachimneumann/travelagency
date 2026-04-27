import { normalizeText } from "../lib/text.js";
import { enumOptionsFor, enumValueSetFor } from "../lib/generated_catalogs.js";
import {
  DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE,
  TOUR_DESTINATION_TO_COUNTRY_CODE
} from "../../../../shared/js/destination_country_codes.js";
import { normalizeTourDestinationCode } from "./tour_catalog_i18n.js";

const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");
const DESTINATION_COUNTRY_ORDER = Object.freeze(["VN", "TH", "KH", "LA"]);
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
  ["VN"].map((code) => Object.freeze({
    code,
    label: DESTINATION_COUNTRY_LABELS[code] || code,
    sort_order: 0,
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

function normalizeLocalizedTextMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizeText(lang).toLowerCase(), normalizeText(text)])
      .filter(([lang, text]) => Boolean(lang && text))
  );
}

function resolveLocalizedText(value, lang = "en", fallback = "") {
  const normalizedLang = normalizeText(lang).toLowerCase() || "en";
  if (typeof value === "string") return normalizeText(value) || fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return normalizeText(value[normalizedLang])
    || normalizeText(value.en)
    || normalizeText(Object.values(value).find((entry) => normalizeText(entry)))
    || fallback;
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

function normalizeDestinationScopeAreaSelection(rawArea) {
  const source = rawArea && typeof rawArea === "object" && !Array.isArray(rawArea) ? rawArea : {};
  const areaId = normalizeOptionalText(source.area_id || source.id);
  if (!areaId) return null;
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
    area_id: areaId,
    places
  };
}

function destinationEntryFromCode(destination) {
  const countryCode = normalizeDestinationCountryCode(destination);
  return countryCode ? { destination: countryCode, areas: [] } : null;
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
    const current = byDestination.get(destination) || { destination, areas: [] };
    const areaIds = new Set(current.areas.map((area) => area.area_id));
    for (const area of (Array.isArray(entry.areas) ? entry.areas : []).map(normalizeDestinationScopeAreaSelection).filter(Boolean)) {
      const existing = current.areas.find((item) => item.area_id === area.area_id);
      if (existing) {
        const placeIds = new Set(existing.places.map((place) => place.place_id));
        for (const place of area.places) {
          if (!placeIds.has(place.place_id)) {
            existing.places.push(place);
            placeIds.add(place.place_id);
          }
        }
        continue;
      }
      if (!areaIds.has(area.area_id)) {
        current.areas.push(area);
        areaIds.add(area.area_id);
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

export function withDerivedDestinationsFromScope(travelPlan) {
  const source = travelPlan && typeof travelPlan === "object" && !Array.isArray(travelPlan) ? travelPlan : {};
  const destinationScope = normalizeTravelPlanDestinationScope(source);
  return {
    ...source,
    destination_scope: destinationScope,
    destinations: destinationScopeDestinations(destinationScope)
  };
}

function normalizeCatalogArea(rawArea, index = 0) {
  const source = rawArea && typeof rawArea === "object" && !Array.isArray(rawArea) ? rawArea : {};
  const destination = normalizeDestinationCountryCode(source.destination);
  const name = normalizeOptionalText(source.name);
  const code = slugify(source.code || name);
  if (!destination || !name) return null;
  const id = normalizeOptionalText(source.id) || `area_${destination.toLowerCase()}_${code}`;
  return {
    id,
    destination,
    code: code || id,
    name,
    name_i18n: normalizeLocalizedTextMap(source.name_i18n),
    sort_order: Number.isInteger(Number(source.sort_order)) ? Number(source.sort_order) : index,
    is_active: source.is_active !== false,
    created_at: normalizeOptionalText(source.created_at) || null,
    updated_at: normalizeOptionalText(source.updated_at) || null
  };
}

function normalizeCatalogPlace(rawPlace, areaIdSet, index = 0) {
  const source = rawPlace && typeof rawPlace === "object" && !Array.isArray(rawPlace) ? rawPlace : {};
  const areaId = normalizeOptionalText(source.area_id);
  const name = normalizeOptionalText(source.name);
  const code = slugify(source.code || name);
  if (!areaId || !areaIdSet.has(areaId) || !name) return null;
  const id = normalizeOptionalText(source.id) || `place_${areaId.replace(/^area_/, "")}_${code}`;
  return {
    id,
    area_id: areaId,
    code: code || id,
    name,
    name_i18n: normalizeLocalizedTextMap(source.name_i18n),
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
  const areas = (Array.isArray(store?.destination_areas) ? store.destination_areas : [])
    .map(normalizeCatalogArea)
    .filter((area) => area && destinationSet.has(area.destination));
  const areaIdSet = new Set(areas.map((area) => area.id));
  const places = (Array.isArray(store?.destination_places) ? store.destination_places : [])
    .map((place, index) => normalizeCatalogPlace(place, areaIdSet, index))
    .filter(Boolean);
  return {
    destinations,
    areas: areas.sort((left, right) => {
      if (left.destination !== right.destination) {
        return sortDestinationCountryCodes([left.destination, right.destination]).indexOf(left.destination) === 0 ? -1 : 1;
      }
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    }),
    places: places.sort((left, right) => {
      if (left.area_id !== right.area_id) return left.area_id.localeCompare(right.area_id);
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
    areas: catalog.areas.map((area) => ({
      ...area,
      label: resolveLocalizedText(area.name_i18n, lang, area.name)
    })),
    places: catalog.places.map((place) => ({
      ...place,
      label: resolveLocalizedText(place.name_i18n, lang, place.name)
    }))
  };
}

export function validateDestinationScopeAgainstCatalog(scope, store) {
  const normalizedScope = normalizeDestinationScope(scope);
  const catalog = normalizeDestinationScopeCatalog(store);
  const destinationByCode = new Map(catalog.destinations.map((destination) => [destination.code, destination]));
  const areaById = new Map(catalog.areas.map((area) => [area.id, area]));
  const placeById = new Map(catalog.places.map((place) => [place.id, place]));

  for (const entry of normalizedScope) {
    if (!destinationByCode.has(entry.destination)) {
      return { ok: false, error: `Unknown destination: ${entry.destination}` };
    }
    for (const areaSelection of entry.areas) {
      const area = areaById.get(areaSelection.area_id);
      if (!area) {
        return { ok: false, error: `Unknown destination area: ${areaSelection.area_id}` };
      }
      if (area.destination !== entry.destination) {
        return { ok: false, error: `Area ${areaSelection.area_id} does not belong to destination ${entry.destination}.` };
      }
      for (const placeSelection of areaSelection.places) {
        const place = placeById.get(placeSelection.place_id);
        if (!place) {
          return { ok: false, error: `Unknown destination place: ${placeSelection.place_id}` };
        }
        if (place.area_id !== area.id) {
          return { ok: false, error: `Place ${placeSelection.place_id} does not belong to area ${area.id}.` };
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
      created_at: now,
      updated_at: now
    }
  };
}

export function createDestinationAreaRecord(payload, { randomUUID, nowIso }) {
  const now = nowIso();
  const destination = normalizeDestinationCountryCode(payload?.destination);
  const name = normalizeOptionalText(payload?.name);
  if (!destination) return { ok: false, error: "destination is required" };
  if (!name) return { ok: false, error: "name is required" };
  const code = slugify(payload?.code || name);
  return {
    ok: true,
    area: {
      id: normalizeOptionalText(payload?.id) || `area_${randomUUID()}`,
      destination,
      code,
      name,
      name_i18n: normalizeLocalizedTextMap(payload?.name_i18n),
      sort_order: Number.isInteger(Number(payload?.sort_order)) ? Number(payload.sort_order) : 100,
      is_active: payload?.is_active !== false,
      created_at: now,
      updated_at: now
    }
  };
}

export function createDestinationPlaceRecord(payload, store, { randomUUID, nowIso }) {
  const now = nowIso();
  const catalog = normalizeDestinationScopeCatalog(store);
  const areaId = normalizeOptionalText(payload?.area_id);
  const area = catalog.areas.find((item) => item.id === areaId);
  const name = normalizeOptionalText(payload?.name);
  if (!area) return { ok: false, error: "area_id is required" };
  if (!name) return { ok: false, error: "name is required" };
  const code = slugify(payload?.code || name);
  return {
    ok: true,
    place: {
      id: normalizeOptionalText(payload?.id) || `place_${randomUUID()}`,
      area_id: area.id,
      code,
      name,
      name_i18n: normalizeLocalizedTextMap(payload?.name_i18n),
      sort_order: Number.isInteger(Number(payload?.sort_order)) ? Number(payload.sort_order) : 100,
      is_active: payload?.is_active !== false,
      created_at: now,
      updated_at: now
    }
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

export function upsertDestinationArea(store, area) {
  const next = cloneJson(store || {});
  next.destination_areas = Array.isArray(next.destination_areas) ? next.destination_areas : [];
  const normalizedArea = normalizeCatalogArea(area, next.destination_areas.length);
  if (!normalizedArea) return { ok: false, error: "Area is invalid." };
  const destinationSet = new Set(normalizeDestinationScopeCatalog(next).destinations.map((destination) => destination.code));
  if (!destinationSet.has(normalizedArea.destination)) {
    return { ok: false, error: `Unknown destination: ${normalizedArea.destination}` };
  }
  const duplicate = next.destination_areas.find((item) => (
    normalizeDestinationCountryCode(item?.destination) === normalizedArea.destination
    && slugify(item?.code || item?.name) === normalizedArea.code
    && normalizeOptionalText(item?.id) !== normalizedArea.id
  ));
  if (duplicate) return { ok: false, error: "An area with this code already exists for this destination." };
  const index = next.destination_areas.findIndex((item) => normalizeOptionalText(item?.id) === normalizedArea.id);
  if (index >= 0) next.destination_areas[index] = normalizedArea;
  else next.destination_areas.push(normalizedArea);
  return { ok: true, store: next, area: normalizedArea };
}

export function upsertDestinationPlace(store, place) {
  const next = cloneJson(store || {});
  next.destination_places = Array.isArray(next.destination_places) ? next.destination_places : [];
  const catalog = normalizeDestinationScopeCatalog(next);
  const normalizedPlace = normalizeCatalogPlace(place, new Set(catalog.areas.map((area) => area.id)), next.destination_places.length);
  if (!normalizedPlace) return { ok: false, error: "Place is invalid." };
  const duplicate = next.destination_places.find((item) => (
    normalizeOptionalText(item?.area_id) === normalizedPlace.area_id
    && slugify(item?.code || item?.name) === normalizedPlace.code
    && normalizeOptionalText(item?.id) !== normalizedPlace.id
  ));
  if (duplicate) return { ok: false, error: "A place with this code already exists for this area." };
  const index = next.destination_places.findIndex((item) => normalizeOptionalText(item?.id) === normalizedPlace.id);
  if (index >= 0) next.destination_places[index] = normalizedPlace;
  else next.destination_places.push(normalizedPlace);
  return { ok: true, store: next, place: normalizedPlace };
}
