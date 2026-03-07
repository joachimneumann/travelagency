import path from "node:path";
import { normalizeText } from "../../../../shared/js/text.js";
import { normalizeStringArray } from "../lib/collection_utils.js";

export function createTourHelpers({ toursDir, safeInt, safeFloat }) {
  function tourDestinationCountries(tour) {
    return normalizeStringArray(tour?.destinationCountries);
  }

  function normalizeHighlights(value) {
    if (Array.isArray(value)) return value.map((entry) => normalizeText(entry)).filter(Boolean);
    const normalized = normalizeText(value);
    return normalized
      ? normalized
          .split(/\r?\n|,/)
          .map((entry) => normalizeText(entry))
          .filter(Boolean)
      : [];
  }

  function toTourImagePublicUrl(value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    if (normalized.startsWith("/public/v1/tour-images/")) return normalized;
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `/public/v1/tour-images/${normalized.replace(/^\/+/, "")}`;
  }

  function normalizeTourForRead(tour) {
    return {
      ...tour,
      title: normalizeText(tour?.title),
      shortDescription: normalizeText(tour?.shortDescription),
      destinationCountries: tourDestinationCountries(tour),
      styles: normalizeStringArray(tour?.styles),
      image: toTourImagePublicUrl(tour?.image),
      seasonality: normalizeText(tour?.seasonality),
      highlights: normalizeHighlights(tour?.highlights),
      priority: safeInt(tour?.priority) ?? 50,
      durationDays: safeInt(tour?.durationDays) ?? 0,
      priceFrom: safeInt(tour?.priceFrom) ?? 0,
      rating: safeFloat(tour?.rating) ?? 0
    };
  }

  function collectTourOptions(tours) {
    const items = Array.isArray(tours) ? tours : [];
    return {
      destinations: Array.from(new Set(items.flatMap((tour) => tourDestinationCountries(tour)))).sort(),
      styles: Array.from(new Set(items.flatMap((tour) => normalizeStringArray(tour?.styles)))).sort()
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
    tourDestinationCountries,
    normalizeHighlights,
    toTourImagePublicUrl,
    normalizeTourForRead,
    collectTourOptions,
    resolveTourImageDiskPath
  };
}
