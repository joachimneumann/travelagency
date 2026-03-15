import { normalizeText } from "../lib/text.js";
import {
  CUSTOMER_CONTENT_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../../../shared/generated/language_catalog.js";

export const TOUR_TEXT_LANGUAGES = CUSTOMER_CONTENT_LANGUAGE_CODES;
const DEFAULT_TOUR_LANG = "en";

const DESTINATION_LABELS = Object.freeze({
  cambodia: Object.freeze({ en: "Cambodia", fr: "Cambodge", zh: "柬埔寨", ja: "カンボジア", ko: "캄보디아", vi: "Campuchia", de: "Kambodscha", es: "Camboya", it: "Cambogia", ru: "Камбоджа", nl: "Cambodja", pl: "Kambodża", da: "Cambodja", sv: "Kambodja", no: "Kambodsja" }),
  laos: Object.freeze({ en: "Laos", fr: "Laos", zh: "老挝", ja: "ラオス", ko: "라오스", vi: "Lao", de: "Laos", es: "Laos", it: "Laos", ru: "Лаос", nl: "Laos", pl: "Laos", da: "Laos", sv: "Laos", no: "Laos" }),
  thailand: Object.freeze({ en: "Thailand", fr: "Thailande", zh: "泰国", ja: "タイ", ko: "태국", vi: "Thai Lan", de: "Thailand", es: "Tailandia", it: "Thailandia", ru: "Таиланд", nl: "Thailand", pl: "Tajlandia", da: "Thailand", sv: "Thailand", no: "Thailand" }),
  vietnam: Object.freeze({ en: "Vietnam", fr: "Vietnam", zh: "越南", ja: "ベトナム", ko: "베트남", vi: "Viet Nam", de: "Vietnam", es: "Vietnam", it: "Vietnam", ru: "Вьетнам", nl: "Vietnam", pl: "Wietnam", da: "Vietnam", sv: "Vietnam", no: "Vietnam" })
});

const STYLE_LABELS = Object.freeze({
  adventure: Object.freeze({ en: "Adventure", fr: "Aventure", zh: "探险", ja: "アドベンチャー", ko: "어드벤처", vi: "Phiêu lưu", de: "Abenteuer", es: "Aventura", it: "Avventura", ru: "Приключения", nl: "Avontuur", pl: "Przygoda", da: "Eventyr", sv: "Äventyr", no: "Eventyr" }),
  beach: Object.freeze({ en: "Beach", fr: "Plage", zh: "海滩", ja: "ビーチ", ko: "해변", vi: "Bai bien", de: "Strand", es: "Playa", it: "Spiaggia", ru: "Пляж", nl: "Strand", pl: "Plaża", da: "Strand", sv: "Strand", no: "Strand" }),
  budget: Object.freeze({ en: "Budget", fr: "Budget", zh: "经济型", ja: "お手頃", ko: "가성비", vi: "Tiet kiem", de: "Budget", es: "Económico", it: "Economico", ru: "Эконом", nl: "Budget", pl: "Budżetowy", da: "Budget", sv: "Budget", no: "Budsjett" }),
  culture: Object.freeze({ en: "Culture", fr: "Culture", zh: "文化", ja: "文化", ko: "문화", vi: "Van hoa", de: "Kultur", es: "Cultura", it: "Cultura", ru: "Культура", nl: "Cultuur", pl: "Kultura", da: "Kultur", sv: "Kultur", no: "Kultur" }),
  family: Object.freeze({ en: "Family", fr: "Famille", zh: "家庭", ja: "家族", ko: "가족", vi: "Gia dinh", de: "Familie", es: "Familiar", it: "Famiglia", ru: "Семья", nl: "Familie", pl: "Rodzina", da: "Familie", sv: "Familj", no: "Familie" }),
  food: Object.freeze({ en: "Food", fr: "Gastronomie", zh: "美食", ja: "食", ko: "미식", vi: "Am thuc", de: "Kulinarik", es: "Gastronomía", it: "Gastronomia", ru: "Гастрономия", nl: "Culinair", pl: "Kuchnia", da: "Mad", sv: "Mat", no: "Mat" }),
  luxury: Object.freeze({ en: "Luxury", fr: "Luxe", zh: "奢华", ja: "ラグジュアリー", ko: "럭셔리", vi: "Cao cap", de: "Luxus", es: "Lujo", it: "Lusso", ru: "Люкс", nl: "Luxe", pl: "Luksus", da: "Luksus", sv: "Lyx", no: "Luksus" })
});

const DESTINATION_ORDER = Object.freeze(["vietnam", "thailand", "cambodia", "laos"]);
const STYLE_ORDER = Object.freeze(["adventure", "beach", "budget", "culture", "family", "food", "luxury"]);

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
    return getCatalogLabel({ ...DESTINATION_LABELS, ...STYLE_LABELS }, a, "en").localeCompare(
      getCatalogLabel({ ...DESTINATION_LABELS, ...STYLE_LABELS }, b, "en")
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
  return catalogCodeFromValue(value, STYLE_LABELS);
}

export function getTourDestinationLabel(code, lang = DEFAULT_TOUR_LANG) {
  return getCatalogLabel(DESTINATION_LABELS, code, lang);
}

export function getTourStyleLabel(code, lang = DEFAULT_TOUR_LANG) {
  return getCatalogLabel(STYLE_LABELS, code, lang);
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
  const normalizedCode = normalizeText(code).toLowerCase();
  return {
    code: normalizedCode,
    label: getTourStyleLabel(normalizedCode, lang)
  };
}
