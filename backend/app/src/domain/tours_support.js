import path from "node:path";
import { normalizeText } from "../lib/text.js";
import { normalizeStringArray } from "../lib/collection_utils.js";
import {
  destinationScopeDestinations,
  normalizeDestinationScope,
  destinationScopeTourDestinations
} from "./destination_scope.js";
import {
  TOUR_STYLE_CODE_CATALOG,
  buildTourDestinationOption,
  buildTourStyleOption,
  getTourDestinationLabel,
  getTourStyleLabel,
  normalizeTourDestinationCode,
  normalizeTourLang,
  normalizeTourStyleCode,
  sortTourDestinationCodes,
  sortTourStyleCodes
} from "./tour_catalog_i18n.js";

function hasLocalizedContent(value) {
  if (typeof value === "string") return Boolean(normalizeText(value));
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).some((entry) => {
    if (Array.isArray(entry)) return entry.some((item) => Boolean(normalizeText(item)));
    return Boolean(normalizeText(entry));
  });
}

function normalizeTourVideo(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  const normalized = {
    storage_path: normalizeText(source.storage_path),
    title: normalizeText(source.title)
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

export function migratePersistedTourState(tour) {
  if (!tour || typeof tour !== "object") return false;
  let changed = false;
  if ("highlights" in tour) {
    delete tour.highlights;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(tour, "pictures")) {
    delete tour.pictures;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(tour, "image")) {
    delete tour.image;
    changed = true;
  }
  const travelPlan = tour.travel_plan && typeof tour.travel_plan === "object" && !Array.isArray(tour.travel_plan)
    ? tour.travel_plan
    : null;
  if (travelPlan && Object.prototype.hasOwnProperty.call(travelPlan, "video")) {
    const legacyVideo = normalizeTourVideo(travelPlan.video);
    if (legacyVideo && !normalizeTourVideo(tour.video)) {
      tour.video = legacyVideo;
    }
    delete travelPlan.video;
    changed = true;
  }
  return changed;
}

export function createTourHelpers({ toursDir, safeInt, normalizeMarketingTourTravelPlan }) {
  function normalizeTourTravelPlan(value, options = {}) {
    if (typeof normalizeMarketingTourTravelPlan === "function") {
      return normalizeMarketingTourTravelPlan(value, options);
    }
    const destinationScope = normalizeDestinationScope(value?.destination_scope);
    return {
      destination_scope: destinationScope,
      destinations: destinationScopeDestinations(destinationScope),
      days: Array.isArray(value?.days) ? value.days : []
    };
  }

  function normalizeLocalizedTextMap(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value)
        .map(([lang, text]) => [normalizeTourLang(lang), normalizeText(text)])
        .filter(([, text]) => Boolean(text));
      return Object.fromEntries(entries);
    }
    const normalized = normalizeText(value);
    return normalized ? { en: normalized } : {};
  }

  function resolveLocalizedText(value, lang = "en") {
    if (typeof value === "string") return normalizeText(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const normalizedLang = normalizeTourLang(lang);
    const candidates = [normalizedLang, "en", ...Object.keys(value)];
    for (const candidate of candidates) {
      const text = normalizeText(value[candidate]);
      if (text) return text;
    }
    return "";
  }

  function setLocalizedTextForLang(existingValue, inputValue, lang = "en") {
    const next = normalizeLocalizedTextMap(existingValue);
    const normalizedLang = normalizeTourLang(lang);
    const normalizedText = normalizeText(inputValue);
    if (normalizedText) next[normalizedLang] = normalizedText;
    else delete next[normalizedLang];
    return next;
  }

  function tourDestinationCodes(tour) {
    return sortTourDestinationCodes(destinationScopeTourDestinations(tour?.travel_plan?.destination_scope));
  }

  function tourStyleCodes(tour) {
    return sortTourStyleCodes(
      normalizeStringArray(tour?.styles).map((value) => normalizeTourStyleCode(value)).filter(Boolean)
    );
  }

  function tourDestinations(tour, lang = "en") {
    return tourDestinationCodes(tour).map((code) => getTourDestinationLabel(code, lang));
  }

  function tourStyles(tour, lang = "en") {
    return tourStyleCodes(tour).map((code) => getTourStyleLabel(code, lang));
  }

  function normalizeTourForStorage(tour) {
    const next = {
      ...(tour && typeof tour === "object" ? tour : {})
    };
    const hasExplicitVideo = Object.prototype.hasOwnProperty.call(next, "video");
    const legacyTravelPlanVideo = next.travel_plan && typeof next.travel_plan === "object" && !Array.isArray(next.travel_plan)
      ? next.travel_plan.video
      : null;
    const legacyShortDescription = next.shortDescription;
    delete next.shortDescription;
    delete next.budget_lower_USD;

    next.title = normalizeLocalizedTextMap(next.title);
    next.short_description = normalizeLocalizedTextMap(
      hasLocalizedContent(next.short_description) ? next.short_description : legacyShortDescription
    );
    next.styles = tourStyleCodes(next);
    delete next.pictures;
    delete next.image;
    const video = normalizeTourVideo(next.video) || (hasExplicitVideo ? null : normalizeTourVideo(legacyTravelPlanVideo));
    if (video) next.video = video;
    else delete next.video;
    if (next.travel_plan !== undefined) {
      const normalizedTravelPlan = normalizeTourTravelPlan(next.travel_plan);
      const { destinations: _derivedDestinations, ...travelPlanWithoutDerivedDestinations } = normalizedTravelPlan;
      next.travel_plan = travelPlanWithoutDerivedDestinations;
    }
    delete next.destinations;
    next.seasonality_start_month = normalizeText(next.seasonality_start_month);
    next.seasonality_end_month = normalizeText(next.seasonality_end_month);
    next.priority = safeInt(next.priority) ?? 50;
    delete next.travel_duration_days;
    delete next.budget_lower_usd;
    delete next.rating;

    return next;
  }

  function normalizeTourForRead(tour, { lang = "en" } = {}) {
    const stored = normalizeTourForStorage(tour);
    const normalizedLang = normalizeTourLang(lang);
    const destinationCodes = tourDestinationCodes(stored);
    const styleCodes = tourStyleCodes(stored);
    const travelPlan = normalizeTourTravelPlan(stored.travel_plan);
    return {
      ...stored,
      title: resolveLocalizedText(stored.title, normalizedLang),
      short_description: resolveLocalizedText(stored.short_description, normalizedLang),
      destinations: destinationCodes.map((code) => getTourDestinationLabel(code, normalizedLang)),
      destination_codes: destinationCodes,
      styles: styleCodes.map((code) => getTourStyleLabel(code, normalizedLang)),
      style_codes: styleCodes,
      travel_plan: travelPlan,
      priority: safeInt(stored.priority) ?? 50
    };
  }

  function collectTourOptions(tours, { lang = "en", includeAllStyleCatalogEntries = false } = {}) {
    const items = Array.isArray(tours) ? tours.map((tour) => normalizeTourForStorage(tour)) : [];
    const destinationCodes = sortTourDestinationCodes(items.flatMap((tour) => tourDestinationCodes(tour)));
    const styleCodes = sortTourStyleCodes([
      ...items.flatMap((tour) => tourStyleCodes(tour)),
      ...(includeAllStyleCatalogEntries ? TOUR_STYLE_CODE_CATALOG : [])
    ]);
    const normalizedLang = normalizeTourLang(lang);
    return {
      destinations: destinationCodes.map((code) => buildTourDestinationOption(code, normalizedLang)),
      styles: styleCodes.map((code) => buildTourStyleOption(code, normalizedLang))
    };
  }

  function resolveTourImageDiskPath(rawRelativePath) {
    const normalizedPath = String(rawRelativePath || "")
      .split("/")
      .filter(Boolean)
      .filter((segment) => segment !== "." && segment !== "..")
      .join("/");
    if (!normalizedPath) return null;
    if (!normalizedPath.includes("/")) {
      const legacyTourId = path.parse(normalizedPath).name;
      if (legacyTourId.startsWith("tour_")) {
        return path.join(toursDir, legacyTourId, normalizedPath);
      }
    }
    return path.join(toursDir, normalizedPath);
  }

  return {
    normalizeLocalizedTextMap,
    resolveLocalizedText,
    setLocalizedTextForLang,
    normalizeTourTravelPlan,
    tourDestinations,
    tourDestinationCodes,
    tourStyles,
    tourStyleCodes,
    normalizeTourForStorage,
    normalizeTourForRead,
    collectTourOptions,
    resolveTourImageDiskPath
  };
}
