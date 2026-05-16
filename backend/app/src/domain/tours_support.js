import path from "node:path";
import { normalizeText } from "../lib/text.js";
import { normalizeStringArray } from "../lib/collection_utils.js";
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

const TOUR_WEB_PAGE_MIN_IMAGE_COUNT = 2;

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

function normalizeTourSeoSlug(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "");
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
  if (travelPlan && Object.prototype.hasOwnProperty.call(travelPlan, "one_pager_experience_highlight_ids")) {
    delete travelPlan.one_pager_experience_highlight_ids;
    changed = true;
  }
  if (travelPlan && Object.prototype.hasOwnProperty.call(travelPlan, "derived_experience_highlight_ids")) {
    delete travelPlan.derived_experience_highlight_ids;
    changed = true;
  }
  return changed;
}

export function createTourHelpers({ toursDir, safeInt, normalizeMarketingTourTravelPlan }) {
  function normalizeTourTravelPlan(value, options = {}) {
    if (typeof normalizeMarketingTourTravelPlan === "function") {
      return normalizeMarketingTourTravelPlan(value, options);
    }
    return {
      tour_card_image_ids: Array.isArray(value?.tour_card_image_ids)
        ? value.tour_card_image_ids.map((entry) => normalizeText(entry)).filter(Boolean)
        : [],
      tour_card_primary_image_id: normalizeText(value?.tour_card_primary_image_id) || null,
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

  function normalizeTranslationMap(value, { sourceLang = "en" } = {}) {
    const normalizedSourceLang = normalizeTourLang(sourceLang);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([lang, text]) => [normalizeTourLang(lang), normalizeText(text)])
        .filter(([lang, text]) => Boolean(lang && text && lang !== normalizedSourceLang))
    );
  }

  function localizedPairMap(plainValue, i18nValue, { sourceLang = "en" } = {}) {
    const normalizedSourceLang = normalizeTourLang(sourceLang);
    const sourceText = normalizeText(plainValue);
    return {
      ...(sourceText ? { [normalizedSourceLang]: sourceText } : {}),
      ...normalizeTranslationMap(i18nValue, { sourceLang: normalizedSourceLang })
    };
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

  function resolveLocalizedPair(holder, plainField, i18nField, lang = "en") {
    if (!holder || typeof holder !== "object" || Array.isArray(holder)) return "";
    const normalizedLang = normalizeTourLang(lang);
    if (normalizedLang === "en") return normalizeText(holder?.[plainField]);
    const translations = normalizeTranslationMap(holder?.[i18nField]);
    return normalizeText(translations[normalizedLang]) || normalizeText(holder?.[plainField]);
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
    return sortTourDestinationCodes(
      normalizeStringArray(tour?.destination_codes).map((value) => normalizeTourDestinationCode(value)).filter(Boolean)
    );
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

  function selectedTourWebPageImageCount(travelPlan) {
    return (Array.isArray(travelPlan?.tour_card_image_ids) ? travelPlan.tour_card_image_ids : [])
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .length;
  }

  function canPublishTourOnWebpage(tour) {
    const travelPlan = normalizeTourTravelPlan(tour?.travel_plan);
    return travelPlanHasDayLocation(travelPlan)
      && selectedTourWebPageImageCount(travelPlan) >= TOUR_WEB_PAGE_MIN_IMAGE_COUNT;
  }

  function travelPlanHasDayLocation(travelPlan) {
    return (Array.isArray(travelPlan?.days) ? travelPlan.days : []).some((day) => (
      normalizeText(day?.primary_location_id) || normalizeText(day?.secondary_location_id)
    ));
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

    next.title = normalizeText(next.title);
    delete next.title_i18n;
    next.short_description = normalizeText(
      hasLocalizedContent(next.short_description) ? next.short_description : legacyShortDescription
    );
    delete next.short_description_i18n;
    next.styles = tourStyleCodes(next);
    delete next.pictures;
    delete next.image;
    const video = normalizeTourVideo(next.video) || (hasExplicitVideo ? null : normalizeTourVideo(legacyTravelPlanVideo));
    if (video) next.video = video;
    else delete next.video;
    if (next.travel_plan !== undefined) {
      const normalizedTravelPlan = normalizeTourTravelPlan(next.travel_plan);
      const {
        destinations: _derivedDestinations,
        destination_scope: _destinationScope,
        ...travelPlanWithoutDerivedLocations
      } = normalizedTravelPlan;
      next.travel_plan = travelPlanWithoutDerivedLocations;
    }
    delete next.destinations;
    delete next.destination_codes;
    next.seasonality_start_month = normalizeText(next.seasonality_start_month);
    next.seasonality_end_month = normalizeText(next.seasonality_end_month);
    next.priority = safeInt(next.priority) ?? 50;
    next.published_on_webpage = next.published_on_webpage !== false;
    next.seo_slug = normalizeTourSeoSlug(next.seo_slug);
    if (!next.seo_slug) delete next.seo_slug;
    if (!canPublishTourOnWebpage(next)) next.published_on_webpage = false;
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
      title: resolveLocalizedPair(stored, "title", "title_i18n", normalizedLang),
      short_description: resolveLocalizedPair(stored, "short_description", "short_description_i18n", normalizedLang),
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
    normalizeTranslationMap,
    localizedPairMap,
    resolveLocalizedText,
    resolveLocalizedPair,
    setLocalizedTextForLang,
    normalizeTourTravelPlan,
    tourDestinations,
    tourDestinationCodes,
    tourStyles,
    tourStyleCodes,
    canPublishTourOnWebpage,
    normalizeTourForStorage,
    normalizeTourForRead,
    collectTourOptions,
    resolveTourImageDiskPath
  };
}
