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

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function hasLocalizedContent(value) {
  if (typeof value === "string") return Boolean(normalizeText(value));
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).some((entry) => {
    if (Array.isArray(entry)) return entry.some((item) => Boolean(normalizeText(item)));
    return Boolean(normalizeText(entry));
  });
}

export function migratePersistedTourState(tour) {
  if (!tour || typeof tour !== "object") return false;
  let changed = false;
  if ("highlights" in tour) {
    delete tour.highlights;
    changed = true;
  }
  if (!Array.isArray(tour.pictures) || !tour.pictures.length) {
    const legacyImage = normalizeText(tour.image);
    if (legacyImage) {
      tour.pictures = [legacyImage];
      changed = true;
    }
  }
  return changed;
}

export function createTourHelpers({ toursDir, safeInt }) {
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
    return sortTourDestinationCodes(
      normalizeStringArray(tour?.destinations).map((value) => normalizeTourDestinationCode(value)).filter(Boolean)
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

  function toTourImagePublicUrl(value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    if (normalized.startsWith("/public/v1/tour-images/")) return normalized;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `/public/v1/tour-images/${normalized.replace(/^\/+/, "")}`;
  }

  function normalizeTourPictureList(values, fallbackValue = "") {
    const items = Array.isArray(values)
      ? values
      : (values === undefined || values === null || values === "" ? [] : [values]);
    const normalizedPictures = items
      .map((value) => toTourImagePublicUrl(value))
      .filter(Boolean);
    if (normalizedPictures.length) {
      return Array.from(new Set(normalizedPictures));
    }
    const fallbackPicture = toTourImagePublicUrl(fallbackValue);
    return fallbackPicture ? [fallbackPicture] : [];
  }

  function withAssetVersion(value, version) {
    const normalizedValue = normalizeText(value);
    const normalizedVersion = normalizeText(version);
    if (!normalizedValue || !normalizedVersion) return normalizedValue;
    const absolute = /^https?:\/\//i.test(normalizedValue);
    const url = new URL(normalizedValue, "http://localhost");
    url.searchParams.set("v", normalizedVersion);
    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  }

  function normalizeTourForStorage(tour) {
    const next = {
      ...(tour && typeof tour === "object" ? tour : {})
    };
    const legacyShortDescription = next.shortDescription;
    delete next.shortDescription;
    delete next.budget_lower_USD;

    next.title = normalizeLocalizedTextMap(next.title);
    next.short_description = normalizeLocalizedTextMap(
      hasLocalizedContent(next.short_description) ? next.short_description : legacyShortDescription
    );
    next.destinations = tourDestinationCodes(next);
    next.styles = tourStyleCodes(next);
    next.pictures = normalizeTourPictureList(next.pictures, next.image);
    next.image = next.pictures[0] || "";
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
    const version = normalizeText(stored.updated_at || stored.created_at);
    const pictures = stored.pictures.map((picture) => withAssetVersion(toTourImagePublicUrl(picture), version));
    return {
      ...stored,
      title: resolveLocalizedText(stored.title, normalizedLang),
      short_description: resolveLocalizedText(stored.short_description, normalizedLang),
      destinations: destinationCodes.map((code) => getTourDestinationLabel(code, normalizedLang)),
      destination_codes: destinationCodes,
      styles: styleCodes.map((code) => getTourStyleLabel(code, normalizedLang)),
      style_codes: styleCodes,
      pictures,
      image: pictures[0] || "",
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
    return path.join(toursDir, normalizedPath);
  }

  return {
    normalizeLocalizedTextMap,
    resolveLocalizedText,
    setLocalizedTextForLang,
    tourDestinations,
    tourDestinationCodes,
    tourStyles,
    tourStyleCodes,
    toTourImagePublicUrl,
    normalizeTourForStorage,
    normalizeTourForRead,
    collectTourOptions,
    resolveTourImageDiskPath
  };
}
