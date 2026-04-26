import { normalizeText } from "./text.js";

const TRANSLATION_PROFILE_CONFIG = Object.freeze({
  marketing_trip_copy: Object.freeze({
    domain: "customer-facing travel marketing copy",
    context: "These strings appear on a travel agency website and describe tours, trip highlights, itinerary items, and short sales copy for travelers. Keep the tone polished, natural, and concise. Prefer clear travel language over literal or mechanical phrasing."
  }),
  customer_travel_plan: Object.freeze({
    domain: "customer-facing travel itinerary copy",
    context: "These strings belong to a travel plan, PDF, or booking document that will be read by travelers. Keep schedule labels, locations, and service descriptions precise and natural. Prefer clarity and accuracy over promotional wording."
  }),
  staff_backend_ui: Object.freeze({
    domain: "internal staff backend UI copy",
    context: "These strings are staff-facing labels, hints, statuses, and workflow text inside a travel agency backend. Keep them short, explicit, and operational. Prefer consistent terminology over elegance. Do not make labels longer than necessary."
  }),
  staff_profile: Object.freeze({
    domain: "public-facing staff profile copy",
    context: "These strings describe staff roles, biographies, and short bios that may be shown to customers. Keep the tone professional and warm. Preserve names, places, company names, and factual details exactly."
  })
});

function uniqueNormalizedStrings(items) {
  const seen = new Set();
  const values = [];
  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(normalized);
  }
  return values;
}

export function normalizeTranslationProfile(value, fallback = "") {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized && Object.prototype.hasOwnProperty.call(TRANSLATION_PROFILE_CONFIG, normalized)) {
    return normalized;
  }
  const normalizedFallback = normalizeText(fallback)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return Object.prototype.hasOwnProperty.call(TRANSLATION_PROFILE_CONFIG, normalizedFallback)
    ? normalizedFallback
    : "";
}

export function resolveTranslationProfileOptions(options = {}) {
  const profile = normalizeTranslationProfile(options?.translationProfile);
  const profileConfig = profile ? TRANSLATION_PROFILE_CONFIG[profile] : null;
  const extraGlossaryTerms = uniqueNormalizedStrings(options?.glossaryTerms);
  const extraProtectedTerms = uniqueNormalizedStrings(options?.protectedTerms);
  const contextParts = [
    normalizeText(profileConfig?.context),
    normalizeText(options?.context)
  ].filter(Boolean);

  return {
    profile,
    domain: normalizeText(options?.domain || profileConfig?.domain || "travel planning") || "travel planning",
    context: contextParts.join(" "),
    glossaryTerms: uniqueNormalizedStrings([
      ...extraGlossaryTerms
    ]),
    protectedTerms: uniqueNormalizedStrings([
      ...extraProtectedTerms
    ])
  };
}
