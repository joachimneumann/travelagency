import {
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../domain/booking_content_i18n.js";
import { normalizeTourStyleLabels } from "../domain/tour_catalog_i18n.js";
import { getBookingTravelPlanDestinations } from "./booking_persons.js";
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

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const PDF_TEXT_FIELD_CONFIG = Object.freeze({
  travel_plan: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    children_policy: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    whats_not_included: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  }),
  offer: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    children_policy: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    whats_not_included: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  })
});

function hasNormalizedPdfTextContent(fieldValue) {
  if (!fieldValue || typeof fieldValue !== "object") return false;
  if (normalizeText(fieldValue.text)) return true;
  return Object.keys(fieldValue.i18n || {}).length > 0;
}

function resolvePdfTextFieldEnabled(branch, scope, field, normalizedField) {
  const includeField = `include_${field}`;
  const explicitValue = branch?.[includeField];
  if (typeof explicitValue === "boolean") return explicitValue;
  const config = PDF_TEXT_FIELD_CONFIG?.[scope]?.[field] || {};
  if (config.enableWhenTextPresent && hasNormalizedPdfTextContent(normalizedField)) return true;
  return config.defaultChecked === true;
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
  const travelPlanSubtitle = normalizePdfTextField(travelPlan.subtitle, travelPlan.subtitle_i18n, { flatLang, sourceLang });
  const travelPlanWelcome = normalizePdfTextField(travelPlan.welcome, travelPlan.welcome_i18n, { flatLang, sourceLang });
  const travelPlanChildrenPolicy = normalizePdfTextField(travelPlan.children_policy, travelPlan.children_policy_i18n, { flatLang, sourceLang });
  const travelPlanWhatsNotIncluded = normalizePdfTextField(travelPlan.whats_not_included, travelPlan.whats_not_included_i18n, { flatLang, sourceLang });
  const travelPlanClosing = normalizePdfTextField(travelPlan.closing, travelPlan.closing_i18n, { flatLang, sourceLang });
  const travelPlanIncludeWhoIsTraveling = travelPlan.include_who_is_traveling === true;
  const offerSubtitle = normalizePdfTextField(offer.subtitle, offer.subtitle_i18n, { flatLang, sourceLang });
  const offerWelcome = normalizePdfTextField(offer.welcome, offer.welcome_i18n, { flatLang, sourceLang });
  const offerIncludeCancellationPolicy = offer.include_cancellation_policy !== false;
  const offerIncludeWhoIsTraveling = offer.include_who_is_traveling !== false;
  const offerChildrenPolicy = normalizePdfTextField(offer.children_policy, offer.children_policy_i18n, { flatLang, sourceLang });
  const offerWhatsNotIncluded = normalizePdfTextField(offer.whats_not_included, offer.whats_not_included_i18n, { flatLang, sourceLang });
  const offerClosing = normalizePdfTextField(offer.closing, offer.closing_i18n, { flatLang, sourceLang });

  return compactObject({
    travel_plan: compactObject({
      ...(travelPlanSubtitle
        ? {
            subtitle: travelPlanSubtitle.text,
            subtitle_i18n: travelPlanSubtitle.i18n
          }
        : {}),
      include_subtitle: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "subtitle", travelPlanSubtitle),
      ...(travelPlanWelcome
        ? {
            welcome: travelPlanWelcome.text,
            welcome_i18n: travelPlanWelcome.i18n
          }
        : {}),
      include_welcome: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "welcome", travelPlanWelcome),
      ...(travelPlanChildrenPolicy
        ? {
            children_policy: travelPlanChildrenPolicy.text,
            children_policy_i18n: travelPlanChildrenPolicy.i18n
          }
        : {}),
      include_children_policy: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "children_policy", travelPlanChildrenPolicy),
      ...(travelPlanWhatsNotIncluded
        ? {
            whats_not_included: travelPlanWhatsNotIncluded.text,
            whats_not_included_i18n: travelPlanWhatsNotIncluded.i18n
          }
        : {}),
      include_whats_not_included: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "whats_not_included", travelPlanWhatsNotIncluded),
      ...(travelPlanClosing
        ? {
            closing: travelPlanClosing.text,
            closing_i18n: travelPlanClosing.i18n
          }
        : {}),
      include_closing: resolvePdfTextFieldEnabled(travelPlan, "travel_plan", "closing", travelPlanClosing),
      include_who_is_traveling: travelPlanIncludeWhoIsTraveling
    }),
    offer: compactObject({
      ...(offerSubtitle
        ? {
            subtitle: offerSubtitle.text,
            subtitle_i18n: offerSubtitle.i18n
          }
        : {}),
      include_subtitle: resolvePdfTextFieldEnabled(offer, "offer", "subtitle", offerSubtitle),
      ...(offerWelcome
        ? {
            welcome: offerWelcome.text,
            welcome_i18n: offerWelcome.i18n
          }
        : {}),
      include_welcome: resolvePdfTextFieldEnabled(offer, "offer", "welcome", offerWelcome),
      ...(offerChildrenPolicy
        ? {
            children_policy: offerChildrenPolicy.text,
            children_policy_i18n: offerChildrenPolicy.i18n
          }
        : {}),
      include_children_policy: resolvePdfTextFieldEnabled(offer, "offer", "children_policy", offerChildrenPolicy),
      ...(offerWhatsNotIncluded
        ? {
            whats_not_included: offerWhatsNotIncluded.text,
            whats_not_included_i18n: offerWhatsNotIncluded.i18n
          }
        : {}),
      include_whats_not_included: resolvePdfTextFieldEnabled(offer, "offer", "whats_not_included", offerWhatsNotIncluded),
      ...(offerClosing
        ? {
            closing: offerClosing.text,
            closing_i18n: offerClosing.i18n
          }
        : {}),
      include_closing: resolvePdfTextFieldEnabled(offer, "offer", "closing", offerClosing),
      include_cancellation_policy: offerIncludeCancellationPolicy,
      include_who_is_traveling: offerIncludeWhoIsTraveling
    })
  }) || {};
}

export function extractTravelPlanPdfPersonalization(value, options = {}) {
  const normalized = normalizeBookingPdfPersonalization(value, options);
  const travelPlan = normalized?.travel_plan && typeof normalized.travel_plan === "object" && !Array.isArray(normalized.travel_plan)
    ? cloneJson(normalized.travel_plan)
    : null;
  return compactObject({
    ...(travelPlan ? { travel_plan: travelPlan } : {})
  }) || {};
}

export function replaceTravelPlanPdfPersonalization(targetValue, sourceValue, options = {}) {
  const normalizedTarget = normalizeBookingPdfPersonalization(targetValue, options);
  const nextTravelPlan = extractTravelPlanPdfPersonalization(sourceValue, options);
  const offer = normalizedTarget?.offer && typeof normalizedTarget.offer === "object" && !Array.isArray(normalizedTarget.offer)
    ? cloneJson(normalizedTarget.offer)
    : null;
  return compactObject({
    ...(offer ? { offer } : {}),
    ...(nextTravelPlan?.travel_plan ? { travel_plan: cloneJson(nextTravelPlan.travel_plan) } : {})
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

export function resolveBookingPdfPersonalizationFlag(personalization, scope, field, options = {}) {
  const normalized = normalizeBookingPdfPersonalization(personalization, {
    flatLang: options?.flatLang || "en",
    sourceLang: options?.sourceLang || "en"
  });
  const branch = normalized?.[scope] && typeof normalized[scope] === "object" ? normalized[scope] : null;
  return typeof branch?.[field] === "boolean" ? branch[field] : false;
}

export function resolveBookingPdfCountryLabels(booking) {
  return unique(
    getBookingTravelPlanDestinations(booking)
      .map((value) => normalizeText(value).toUpperCase())
      .filter(Boolean)
      .map((code) => COUNTRY_LABEL_BY_CODE.get(code) || code)
  );
}

export function resolveBookingPdfTravelStyleLabels(booking, lang = "en") {
  return unique(normalizeTourStyleLabels(booking?.travel_styles, lang));
}
