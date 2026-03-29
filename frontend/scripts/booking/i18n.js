import {
  BACKEND_UI_LANGUAGES,
  CUSTOMER_CONTENT_LANGUAGES,
  apiValueFromLanguageCode,
  normalizeLanguageCode
} from "../../../shared/generated/language_catalog.js";

function languagePriority(code) {
  const normalized = normalizeLanguageCode(code, { fallback: "" });
  if (normalized === "en") return 0;
  if (normalized === "vi") return 1;
  return 2;
}

function sortLanguageOptions(entries) {
  return [...entries].sort((left, right) => {
    const priorityDifference = languagePriority(left?.code) - languagePriority(right?.code);
    if (priorityDifference !== 0) return priorityDifference;
    return String(left?.apiValue || left?.label || left?.code || "")
      .localeCompare(String(right?.apiValue || right?.label || right?.code || ""), "en", { sensitivity: "base" });
  });
}

export const BOOKING_EDITING_LANGUAGE_OPTIONS = Object.freeze(
  sortLanguageOptions(BACKEND_UI_LANGUAGES.map((entry) => ({
    code: entry.code,
    label: entry.nativeLabel,
    shortLabel: entry.shortLabel,
    flagClass: entry.flagClass,
    apiValue: entry.apiValue
  })))
);

export const BOOKING_CONTENT_LANGUAGE_OPTIONS = Object.freeze(
  sortLanguageOptions(CUSTOMER_CONTENT_LANGUAGES.map((entry) => ({
    code: entry.code,
    label: entry.nativeLabel,
    shortLabel: entry.shortLabel,
    flagClass: entry.flagClass,
    apiValue: entry.apiValue
  })))
);

const DEFAULT_BOOKING_CONTENT_LANG = "en";
const DEFAULT_BOOKING_EDITING_LANG = "en";
const BOOKING_EDITING_LANGUAGE_STORAGE_PREFIX = "travelagency.booking.editing_language.";

export function bookingT(id, fallback, vars) {
  if (typeof window.backendT === "function") {
    return window.backendT(id, fallback, vars);
  }
  const template = String(fallback ?? id);
  if (!vars || typeof vars !== "object") return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey in vars ? String(vars[normalizedKey]) : match;
  });
}

export function bookingLang() {
  if (typeof window.backendI18n?.getLang === "function") {
    return window.backendI18n.getLang() || "en";
  }
  return document.documentElement.lang || "en";
}

export function normalizeBookingContentLang(value) {
  return normalizeLanguageCode(value, { fallback: DEFAULT_BOOKING_CONTENT_LANG });
}

export function normalizeBookingEditingLang(value) {
  return normalizeLanguageCode(value, {
    allowedCodes: BOOKING_EDITING_LANGUAGE_OPTIONS.map((option) => option.code),
    fallback: DEFAULT_BOOKING_EDITING_LANG
  });
}

export function bookingContentLanguageOption(value) {
  const normalized = normalizeBookingContentLang(value || DEFAULT_BOOKING_CONTENT_LANG);
  return BOOKING_CONTENT_LANGUAGE_OPTIONS.find((option) => option.code === normalized) || {
    code: normalized,
    label: normalized,
    shortLabel: normalized.toUpperCase(),
    flagClass: `flag-${normalized}`,
    apiValue: apiValueFromLanguageCode(normalized, "English")
  };
}

export function bookingContentLanguageLabel(value) {
  return bookingContentLanguageOption(value).label;
}

export function bookingEditingLanguageOption(value) {
  const normalized = normalizeBookingEditingLang(value || DEFAULT_BOOKING_EDITING_LANG);
  return BOOKING_EDITING_LANGUAGE_OPTIONS.find((option) => option.code === normalized) || {
    code: normalized,
    label: normalized,
    shortLabel: normalized.toUpperCase(),
    flagClass: `flag-${normalized}`,
    apiValue: apiValueFromLanguageCode(normalized, "English")
  };
}

export function bookingEditingLanguageLabel(value) {
  return bookingEditingLanguageOption(value).label;
}

export function bookingContentLang(fallback = DEFAULT_BOOKING_CONTENT_LANG) {
  const runtimeCandidate = String(window.__BOOKING_CONTENT_LANG || "").trim();
  if (runtimeCandidate) return normalizeBookingContentLang(runtimeCandidate);
  return normalizeBookingContentLang(fallback || DEFAULT_BOOKING_CONTENT_LANG);
}

export function bookingEditingLang(fallback = DEFAULT_BOOKING_EDITING_LANG) {
  const runtimeCandidate = String(window.__BOOKING_EDITING_LANG || "").trim();
  if (runtimeCandidate) return normalizeBookingEditingLang(runtimeCandidate);
  return normalizeBookingEditingLang(fallback || DEFAULT_BOOKING_EDITING_LANG);
}

function bookingEditingLanguageStorageKey(bookingId) {
  const normalizedBookingId = String(bookingId || "").trim();
  if (!normalizedBookingId) return "";
  return `${BOOKING_EDITING_LANGUAGE_STORAGE_PREFIX}${normalizedBookingId}`;
}

export function readStoredBookingEditingLanguage(bookingId, fallback = DEFAULT_BOOKING_EDITING_LANG) {
  const storageKey = bookingEditingLanguageStorageKey(bookingId);
  if (!storageKey) return normalizeBookingEditingLang(fallback || DEFAULT_BOOKING_EDITING_LANG);
  try {
    const stored = String(globalThis.localStorage?.getItem(storageKey) || "").trim();
    if (stored) return normalizeBookingEditingLang(stored);
  } catch {}
  return normalizeBookingEditingLang(fallback || DEFAULT_BOOKING_EDITING_LANG);
}

export function writeStoredBookingEditingLanguage(bookingId, value) {
  const normalized = normalizeBookingEditingLang(value || DEFAULT_BOOKING_EDITING_LANG);
  const storageKey = bookingEditingLanguageStorageKey(bookingId);
  if (!storageKey) return normalized;
  try {
    globalThis.localStorage?.setItem(storageKey, normalized);
  } catch {}
  return normalized;
}

export function setBookingContentLang(value) {
  const normalized = normalizeBookingContentLang(value || DEFAULT_BOOKING_CONTENT_LANG);
  window.__BOOKING_CONTENT_LANG = normalized;
  document.documentElement.dataset.bookingContentLang = normalized;
  window.dispatchEvent(new CustomEvent("booking-content-langchange", {
    detail: { lang: normalized }
  }));
  return normalized;
}

export function setBookingEditingLang(value) {
  const normalized = normalizeBookingEditingLang(value || DEFAULT_BOOKING_EDITING_LANG);
  window.__BOOKING_EDITING_LANG = normalized;
  document.documentElement.dataset.bookingEditingLang = normalized;
  window.dispatchEvent(new CustomEvent("booking-editing-langchange", {
    detail: { lang: normalized }
  }));
  return normalized;
}

export function formatLocalizedDate(value, locale, options = {}, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale || bookingLang(), options).format(date);
}
