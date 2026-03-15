import {
  CUSTOMER_CONTENT_LANGUAGES,
  apiValueFromLanguageCode,
  normalizeLanguageCode
} from "../../../shared/generated/language_catalog.js?v=693624dd6d2c";

export const BOOKING_CONTENT_LANGUAGE_OPTIONS = Object.freeze(
  CUSTOMER_CONTENT_LANGUAGES.map((entry) => ({
    code: entry.code,
    label: entry.nativeLabel,
    shortLabel: entry.shortLabel,
    flagClass: entry.flagClass,
    apiValue: entry.apiValue
  }))
);

const DEFAULT_BOOKING_CONTENT_LANG = "en";

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

export function bookingContentLang(fallback = DEFAULT_BOOKING_CONTENT_LANG) {
  const runtimeCandidate = String(window.__BOOKING_CONTENT_LANG || "").trim();
  if (runtimeCandidate) return normalizeBookingContentLang(runtimeCandidate);
  return normalizeBookingContentLang(fallback || DEFAULT_BOOKING_CONTENT_LANG);
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

export function formatLocalizedDate(value, locale, options = {}, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale || bookingLang(), options).format(date);
}
