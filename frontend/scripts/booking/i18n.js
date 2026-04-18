import {
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

const DEFAULT_BOOKING_CONTENT_LANG = "en";
const DEFAULT_BOOKING_SOURCE_LANG = "en";

export const BOOKING_SOURCE_LANGUAGE_OPTIONS = Object.freeze(
  sortLanguageOptions(CUSTOMER_CONTENT_LANGUAGES
    .filter((entry) => entry.code === DEFAULT_BOOKING_SOURCE_LANG)
    .map((entry) => ({
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

export function normalizeBookingSourceLang(value) {
  return normalizeLanguageCode(value, {
    allowedCodes: BOOKING_SOURCE_LANGUAGE_OPTIONS.map((option) => option.code),
    fallback: DEFAULT_BOOKING_SOURCE_LANG
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

export function bookingSourceLanguageOption(value) {
  const normalized = value === undefined
    ? bookingSourceLang(DEFAULT_BOOKING_SOURCE_LANG)
    : normalizeBookingSourceLang(value || DEFAULT_BOOKING_SOURCE_LANG);
  return BOOKING_SOURCE_LANGUAGE_OPTIONS.find((option) => option.code === normalized) || {
    code: normalized,
    label: normalized,
    shortLabel: normalized.toUpperCase(),
    flagClass: `flag-${normalized}`,
    apiValue: apiValueFromLanguageCode(normalized, "English")
  };
}

export function bookingSourceLanguageLabel(value) {
  return bookingSourceLanguageOption(value).label;
}

export function bookingContentLang(fallback = DEFAULT_BOOKING_CONTENT_LANG) {
  const runtimeCandidate = String(window.__BOOKING_CONTENT_LANG || "").trim();
  if (runtimeCandidate) return normalizeBookingContentLang(runtimeCandidate);
  return normalizeBookingContentLang(fallback || DEFAULT_BOOKING_CONTENT_LANG);
}

export function bookingSourceLang(fallback = DEFAULT_BOOKING_SOURCE_LANG) {
  return normalizeBookingSourceLang(fallback || DEFAULT_BOOKING_SOURCE_LANG);
}

export function shouldShowBookingCustomerSourceCue({
  contentLang = bookingContentLang(),
  sourceLang = bookingSourceLang(),
  backendLang = bookingLang()
} = {}) {
  const normalizedContentLang = normalizeBookingContentLang(contentLang || DEFAULT_BOOKING_CONTENT_LANG);
  const normalizedSourceLang = normalizeBookingSourceLang(sourceLang || DEFAULT_BOOKING_SOURCE_LANG);
  const normalizedBackendLang = normalizeLanguageCode(backendLang || bookingLang(), { fallback: "en" });
  return !(normalizedBackendLang === "en" && normalizedContentLang === "en" && normalizedSourceLang === "en");
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

export function bookingLanguageQuery({
  contentLang = bookingContentLang(),
  sourceLang = bookingSourceLang()
} = {}) {
  return {
    content_lang: normalizeBookingContentLang(contentLang || DEFAULT_BOOKING_CONTENT_LANG),
    source_lang: normalizeBookingSourceLang(sourceLang || DEFAULT_BOOKING_SOURCE_LANG)
  };
}

export function formatLocalizedDate(value, locale, options = {}, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale || bookingLang(), options).format(date);
}
