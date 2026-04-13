import { normalizeText } from "../lib/text.js";
import {
  CUSTOMER_CONTENT_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../../../shared/generated/language_catalog.js";
import {
  TOUR_STYLE_ALIAS_TO_CODE,
  TOUR_STYLE_BY_CODE,
  TOUR_STYLE_CODES
} from "../../../../shared/generated/tour_style_catalog.js";

export const TOUR_TEXT_LANGUAGES = CUSTOMER_CONTENT_LANGUAGE_CODES;
const DEFAULT_TOUR_LANG = "en";

const DESTINATION_LABELS = Object.freeze({
  cambodia: Object.freeze({ en: "Cambodia", ar: "كمبوديا", fr: "Cambodge", zh: "柬埔寨", ja: "カンボジア", ko: "캄보디아", vi: "Campuchia", ms: "Kemboja", de: "Kambodscha", es: "Camboya", it: "Cambogia", ru: "Камбоджа", nl: "Cambodja", pl: "Kambodża", da: "Cambodja", sv: "Kambodja", no: "Kambodsja" }),
  laos: Object.freeze({ en: "Laos", ar: "لاوس", fr: "Laos", zh: "老挝", ja: "ラオス", ko: "라오스", vi: "Lào", ms: "Laos", de: "Laos", es: "Laos", it: "Laos", ru: "Лаос", nl: "Laos", pl: "Laos", da: "Laos", sv: "Laos", no: "Laos" }),
  thailand: Object.freeze({ en: "Thailand", ar: "تايلاند", fr: "Thailande", zh: "泰国", ja: "タイ", ko: "태국", vi: "Thái Lan", ms: "Thailand", de: "Thailand", es: "Tailandia", it: "Thailandia", ru: "Таиланд", nl: "Thailand", pl: "Tajlandia", da: "Thailand", sv: "Thailand", no: "Thailand" }),
  vietnam: Object.freeze({ en: "Vietnam", ar: "فيتنام", fr: "Vietnam", zh: "越南", ja: "ベトナム", ko: "베트남", vi: "Việt Nam", ms: "Vietnam", de: "Vietnam", es: "Vietnam", it: "Vietnam", ru: "Вьетнам", nl: "Vietnam", pl: "Wietnam", da: "Vietnam", sv: "Vietnam", no: "Vietnam" })
});

const STYLE_LABELS = Object.freeze(
  Object.fromEntries(
    TOUR_STYLE_CODES.map((code) => [code, Object.freeze({ ...(TOUR_STYLE_BY_CODE[code]?.labels || {}) })])
  )
);

const DESTINATION_ORDER = Object.freeze(["vietnam", "thailand", "cambodia", "laos"]);
const STYLE_ORDER = Object.freeze([...TOUR_STYLE_CODES]);
const STYLE_CODE_ALIASES = Object.freeze({ ...TOUR_STYLE_ALIAS_TO_CODE });
const TOUR_LABELS = Object.freeze({ ...DESTINATION_LABELS, ...STYLE_LABELS });

export const TOUR_STYLE_CODE_CATALOG = STYLE_ORDER;

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function humanizeCode(code) {
  return normalizeText(code)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCatalogLang(value) {
  return normalizeLanguageCode(normalizeText(value), { fallback: DEFAULT_TOUR_LANG });
}

function catalogCodeFromValue(value, catalog) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  if (catalog[normalized]) return normalized;
  const slug = slugify(normalized);
  if (slug && catalog[slug]) return slug;

  for (const [code, labels] of Object.entries(catalog)) {
    if (normalized === code || slug === code) return code;
    for (const label of Object.values(labels || {})) {
      const normalizedLabel = normalizeText(label).toLowerCase();
      if (!normalizedLabel) continue;
      if (normalized === normalizedLabel || slug === slugify(normalizedLabel)) return code;
    }
  }

  return slug;
}

function getCatalogLabel(catalog, code, lang) {
  const normalizedCode = normalizeText(code).toLowerCase();
  if (!normalizedCode) return "";
  const entry = catalog[normalizedCode];
  if (!entry) return humanizeCode(normalizedCode);
  const normalizedLang = normalizeCatalogLang(lang);
  return normalizeText(entry[normalizedLang]) || normalizeText(entry.en) || humanizeCode(normalizedCode);
}

function sortCodes(codes, orderedCodes) {
  const orderLookup = new Map(orderedCodes.map((code, index) => [code, index]));
  return Array.from(new Set((Array.isArray(codes) ? codes : []).map((code) => normalizeText(code).toLowerCase()).filter(Boolean))).sort((a, b) => {
    const leftIndex = orderLookup.has(a) ? orderLookup.get(a) : Number.POSITIVE_INFINITY;
    const rightIndex = orderLookup.has(b) ? orderLookup.get(b) : Number.POSITIVE_INFINITY;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return getCatalogLabel(TOUR_LABELS, a, "en").localeCompare(
      getCatalogLabel(TOUR_LABELS, b, "en")
    );
  });
}

export function normalizeTourLang(value) {
  return normalizeCatalogLang(value);
}

export function normalizeTourDestinationCode(value) {
  return catalogCodeFromValue(value, DESTINATION_LABELS);
}

export function normalizeTourStyleCode(value) {
  const normalizedValue = normalizeText(value).toLowerCase();
  const normalizedCode = catalogCodeFromValue(value, STYLE_LABELS);
  if (STYLE_CODE_ALIASES[normalizedValue]) return STYLE_CODE_ALIASES[normalizedValue];
  if (STYLE_CODE_ALIASES[normalizedCode]) return STYLE_CODE_ALIASES[normalizedCode];
  return normalizedCode;
}

export function getTourDestinationLabel(code, lang = DEFAULT_TOUR_LANG) {
  return getCatalogLabel(DESTINATION_LABELS, code, lang);
}

export function getTourStyleLabel(code, lang = DEFAULT_TOUR_LANG) {
  return getCatalogLabel(STYLE_LABELS, normalizeTourStyleCode(code), lang);
}

export function sortTourDestinationCodes(codes) {
  return sortCodes(codes, DESTINATION_ORDER);
}

export function sortTourStyleCodes(codes) {
  return sortCodes(codes, STYLE_ORDER);
}

export function buildTourDestinationOption(code, lang = DEFAULT_TOUR_LANG) {
  const normalizedCode = normalizeText(code).toLowerCase();
  return {
    code: normalizedCode,
    label: getTourDestinationLabel(normalizedCode, lang)
  };
}

export function buildTourStyleOption(code, lang = DEFAULT_TOUR_LANG) {
  const normalizedCode = normalizeTourStyleCode(code);
  return {
    code: normalizedCode,
    label: getTourStyleLabel(normalizedCode, lang)
  };
}

export function normalizeTourStyleLabels(values, lang = DEFAULT_TOUR_LANG) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => normalizeTourStyleCode(value))
      .filter(Boolean)
      .map((code) => getTourStyleLabel(code, lang))
      .filter(Boolean)
  ));
}
