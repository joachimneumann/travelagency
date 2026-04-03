import {
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../domain/booking_content_i18n.js";
import { normalizeTourStyleLabels } from "../domain/tour_catalog_i18n.js";
import { enumOptionsFor } from "./generated_catalogs.js";
import { normalizeText } from "./text.js";

const COUNTRY_LABEL_BY_CODE = new Map(
  enumOptionsFor("CountryCode").map((option) => {
    const value = normalizeText(option?.value).toUpperCase();
    const label = normalizeText(option?.label).replace(/^[A-Z]{2}\s+/, "");
    return [value, label || value];
  })
);

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function compactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next = Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined) return false;
      if (typeof entryValue === "boolean") return true;
      if (Array.isArray(entryValue)) return entryValue.length > 0;
      if (typeof entryValue === "object") return Object.keys(entryValue).length > 0;
      return Boolean(entryValue);
    })
  );
  return Object.keys(next).length ? next : null;
}

function normalizePdfTextField(value, mapValue, { flatLang = "en", sourceLang = "en" } = {}) {
  const map = normalizeLocalizedTextMap(mapValue ?? value, sourceLang);
  const text = resolveLocalizedText(map, flatLang, "", { sourceLang }) || null;
  return compactObject({
    text,
    i18n: map
  });
}

export function normalizeBookingPdfPersonalization(value, { flatLang = "en", sourceLang = "en" } = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const travelPlan = raw.travel_plan && typeof raw.travel_plan === "object" && !Array.isArray(raw.travel_plan) ? raw.travel_plan : {};
  const offer = raw.offer && typeof raw.offer === "object" && !Array.isArray(raw.offer) ? raw.offer : {};
  const travelPlanIncludeWhoIsTraveling = travelPlan.include_who_is_traveling === true;
  const offerIncludeWhoIsTraveling = offer.include_who_is_traveling !== false;

  return compactObject({
    travel_plan: compactObject({
      ...(normalizePdfTextField(travelPlan.subtitle, travelPlan.subtitle_i18n, { flatLang, sourceLang })
        ? {
            subtitle: normalizePdfTextField(travelPlan.subtitle, travelPlan.subtitle_i18n, { flatLang, sourceLang }).text,
            subtitle_i18n: normalizePdfTextField(travelPlan.subtitle, travelPlan.subtitle_i18n, { flatLang, sourceLang }).i18n
          }
        : {}),
      ...(normalizePdfTextField(travelPlan.welcome, travelPlan.welcome_i18n, { flatLang, sourceLang })
        ? {
            welcome: normalizePdfTextField(travelPlan.welcome, travelPlan.welcome_i18n, { flatLang, sourceLang }).text,
            welcome_i18n: normalizePdfTextField(travelPlan.welcome, travelPlan.welcome_i18n, { flatLang, sourceLang }).i18n
          }
        : {}),
      ...(normalizePdfTextField(travelPlan.closing, travelPlan.closing_i18n, { flatLang, sourceLang })
        ? {
            closing: normalizePdfTextField(travelPlan.closing, travelPlan.closing_i18n, { flatLang, sourceLang }).text,
            closing_i18n: normalizePdfTextField(travelPlan.closing, travelPlan.closing_i18n, { flatLang, sourceLang }).i18n
          }
        : {}),
      include_who_is_traveling: travelPlanIncludeWhoIsTraveling
    }),
    offer: compactObject({
      ...(normalizePdfTextField(offer.subtitle, offer.subtitle_i18n, { flatLang, sourceLang })
        ? {
            subtitle: normalizePdfTextField(offer.subtitle, offer.subtitle_i18n, { flatLang, sourceLang }).text,
            subtitle_i18n: normalizePdfTextField(offer.subtitle, offer.subtitle_i18n, { flatLang, sourceLang }).i18n
          }
        : {}),
      ...(normalizePdfTextField(offer.welcome, offer.welcome_i18n, { flatLang, sourceLang })
        ? {
            welcome: normalizePdfTextField(offer.welcome, offer.welcome_i18n, { flatLang, sourceLang }).text,
            welcome_i18n: normalizePdfTextField(offer.welcome, offer.welcome_i18n, { flatLang, sourceLang }).i18n
          }
        : {}),
      ...(normalizePdfTextField(offer.closing, offer.closing_i18n, { flatLang, sourceLang })
        ? {
            closing: normalizePdfTextField(offer.closing, offer.closing_i18n, { flatLang, sourceLang }).text,
            closing_i18n: normalizePdfTextField(offer.closing, offer.closing_i18n, { flatLang, sourceLang }).i18n
          }
        : {}),
      include_who_is_traveling: offerIncludeWhoIsTraveling
    })
  }) || {};
}

export function resolveBookingPdfPersonalizationText(personalization, scope, field, lang = "en", options = {}) {
  const normalized = normalizeBookingPdfPersonalization(personalization, {
    flatLang: lang,
    sourceLang: options?.sourceLang || "en"
  });
  const branch = normalized?.[scope] && typeof normalized[scope] === "object" ? normalized[scope] : null;
  if (!branch) return "";
  return resolveLocalizedText(branch?.[`${field}_i18n`] ?? branch?.[field], lang, "", {
    sourceLang: options?.sourceLang || "en"
  });
}

export function resolveBookingPdfCountryLabels(booking) {
  return unique(
    (Array.isArray(booking?.destinations) ? booking.destinations : [])
      .map((value) => normalizeText(value).toUpperCase())
      .filter(Boolean)
      .map((code) => COUNTRY_LABEL_BY_CODE.get(code) || code)
  );
}

export function resolveBookingPdfTravelStyleLabels(booking, lang = "en") {
  return unique(normalizeTourStyleLabels(booking?.travel_styles, lang));
}
