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
  }),
  booking_confirmation: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  }),
  payment_request_installment: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  }),
  payment_confirmation_installment: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  }),
  payment_request_final: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  }),
  payment_confirmation_final: Object.freeze({
    subtitle: Object.freeze({ defaultChecked: false, enableWhenTextPresent: true }),
    welcome: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true }),
    closing: Object.freeze({ defaultChecked: true, enableWhenTextPresent: true })
  })
});

const PDF_PERSONALIZATION_SCOPES = Object.freeze(Object.keys(PDF_TEXT_FIELD_CONFIG));

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

function normalizePdfPersonalizationBranch(rawBranch, scope, { flatLang = "en", sourceLang = "en" } = {}) {
  const branch = rawBranch && typeof rawBranch === "object" && !Array.isArray(rawBranch) ? rawBranch : {};
  const fieldConfigs = PDF_TEXT_FIELD_CONFIG?.[scope] || {};
  const normalizedBranch = {};
  for (const field of Object.keys(fieldConfigs)) {
    const normalizedField = normalizePdfTextField(branch?.[field], branch?.[`${field}_i18n`], { flatLang, sourceLang });
    if (normalizedField) {
      normalizedBranch[field] = normalizedField.text;
      normalizedBranch[`${field}_i18n`] = normalizedField.i18n;
    }
    normalizedBranch[`include_${field}`] = resolvePdfTextFieldEnabled(branch, scope, field, normalizedField);
  }
  if (scope === "travel_plan") {
    normalizedBranch.include_who_is_traveling = branch.include_who_is_traveling === true;
  }
  if (scope === "offer") {
    const offerIncludeCancellationPolicy = branch.include_cancellation_policy !== false;
    const offerIncludeWhoIsTraveling = branch.include_who_is_traveling !== false;
    Object.assign(normalizedBranch, {
      include_cancellation_policy: offerIncludeCancellationPolicy,
      include_who_is_traveling: offerIncludeWhoIsTraveling
    });
  }
  return compactObject(normalizedBranch);
}

export function normalizeBookingPdfPersonalization(value, { flatLang = "en", sourceLang = "en" } = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return compactObject(
    Object.fromEntries(
      PDF_PERSONALIZATION_SCOPES
        .map((scope) => [scope, normalizePdfPersonalizationBranch(raw?.[scope], scope, { flatLang, sourceLang })])
        .filter(([, branch]) => Boolean(branch))
    )
  ) || {};
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
  const nextValue = Object.fromEntries(
    Object.entries(normalizedTarget || {})
      .filter(([scope]) => scope !== "travel_plan")
      .map(([scope, branch]) => [scope, cloneJson(branch)])
  );
  if (nextTravelPlan?.travel_plan) {
    nextValue.travel_plan = cloneJson(nextTravelPlan.travel_plan);
  }
  return compactObject(nextValue) || {};
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
