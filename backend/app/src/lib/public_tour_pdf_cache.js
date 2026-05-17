import { createHash } from "node:crypto";
import path from "node:path";
import { normalizeTourLang } from "../domain/tour_catalog_i18n.js";

export const PUBLIC_ONE_PAGER_CACHE_VERSION = "public-one-pager-v1";
export const PUBLIC_TRAVEL_PLAN_CACHE_VERSION = "public-travel-plan-v1";

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function publicTourOnePagerPdfCacheKey({ lang, tour }) {
  return sha256Json({
    version: PUBLIC_ONE_PAGER_CACHE_VERSION,
    lang: normalizeTourLang(lang),
    tour
  }).slice(0, 40);
}

export function publicTourTravelPlanPdfCacheKey({ lang, booking, travelPlan }) {
  return sha256Json({
    version: PUBLIC_TRAVEL_PLAN_CACHE_VERSION,
    lang: normalizeTourLang(lang),
    booking,
    travel_plan: travelPlan,
    options: {
      includeMarketingTourBackground: true,
      includeGuideSection: false,
      includeEndingSection: false
    }
  }).slice(0, 40);
}

export function publicTourOnePagerPdfCacheDir(publicTourPdfCacheDir) {
  return path.join(publicTourPdfCacheDir, "one-pagers");
}

export function publicTourTravelPlanPdfCacheDir(publicTourPdfCacheDir) {
  return path.join(publicTourPdfCacheDir, "travel-plans");
}

export function publicTourPdfCachePath(cacheDir, cacheKey) {
  return path.join(cacheDir, `${cacheKey}.pdf`);
}
