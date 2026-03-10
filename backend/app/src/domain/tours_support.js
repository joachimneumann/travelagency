import path from "node:path";
import { normalizeText } from "../lib/text.js";
import { normalizeStringArray } from "../lib/collection_utils.js";

export function createTourHelpers({ toursDir, safeInt, safeFloat }) {
  function tourDestinations(tour) {
    return normalizeStringArray(tour?.destinations);
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
      short_description: normalizeText(tour?.short_description),
      destinations: tourDestinations(tour),
      styles: normalizeStringArray(tour?.styles),
      image: toTourImagePublicUrl(tour?.image),
      seasonality_start_month: normalizeText(tour?.seasonality_start_month),
      seasonality_end_month: normalizeText(tour?.seasonality_end_month),
      highlights: normalizeHighlights(tour?.highlights),
      priority: safeInt(tour?.priority) ?? 50,
      travel_duration_days: safeInt(tour?.travel_duration_days) ?? 0,
      budget_lower_usd: safeInt(tour?.budget_lower_usd) ?? 0,
      rating: safeFloat(tour?.rating) ?? 0
    };
  }

  function collectTourOptions(tours) {
    const items = Array.isArray(tours) ? tours : [];
    return {
      destinations: Array.from(new Set(items.flatMap((tour) => tourDestinations(tour)))).sort(),
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
    tourDestinations,
    normalizeHighlights,
    toTourImagePublicUrl,
    normalizeTourForRead,
    collectTourOptions,
    resolveTourImageDiskPath
  };
}
