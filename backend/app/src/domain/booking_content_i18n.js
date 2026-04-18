import { normalizeText } from "../lib/text.js";
import {
  CUSTOMER_CONTENT_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../../../shared/generated/language_catalog.js";

export const BOOKING_CONTENT_LANGUAGES = CUSTOMER_CONTENT_LANGUAGE_CODES;
export const DEFAULT_BOOKING_CONTENT_LANG = "en";
export const DEFAULT_BOOKING_SOURCE_LANG = "en";
export const BOOKING_SOURCE_LANGUAGE_CODES = Object.freeze([DEFAULT_BOOKING_SOURCE_LANG]);

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

export function normalizeBookingContentLang(value) {
  return normalizeLanguageCode(normalizeText(value), { fallback: DEFAULT_BOOKING_CONTENT_LANG });
}

export function normalizeBookingSourceLang(value) {
  return normalizeLanguageCode(normalizeText(value), {
    allowedCodes: BOOKING_SOURCE_LANGUAGE_CODES,
    fallback: DEFAULT_BOOKING_SOURCE_LANG
  });
}

export function normalizeLocalizedTextMap(value, fallbackLang = DEFAULT_BOOKING_CONTENT_LANG) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value)
      .map(([lang, text]) => [normalizeBookingContentLang(lang), normalizeText(text)])
      .filter(([, text]) => Boolean(text));
    return Object.fromEntries(entries);
  }
  const normalized = normalizeText(value);
  return normalized
    ? { [normalizeBookingContentLang(fallbackLang)]: normalized }
    : {};
}

export function normalizeStoredLocalizedTextMap(
  mapValue,
  plainValue = "",
  sourceLang = DEFAULT_BOOKING_SOURCE_LANG,
  options = {}
) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_BOOKING_SOURCE_LANG);
  const fallbackLang = normalizeBookingContentLang(options?.fallbackLang || normalizedSourceLang);
  const next = normalizeLocalizedTextMap(mapValue, fallbackLang);
  const normalizedPlainText = normalizeText(plainValue);
  if (normalizedPlainText) next[normalizedSourceLang] = normalizedPlainText;
  return next;
}

export function stripSourceLangFromLocalizedTextMap(value, sourceLang = DEFAULT_BOOKING_SOURCE_LANG) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_BOOKING_SOURCE_LANG);
  const next = normalizeLocalizedTextMap(value, normalizedSourceLang);
  delete next[normalizedSourceLang];
  return next;
}

export function normalizeStoredLocalizedTextField(mapValue, plainValue = "", options = {}) {
  const normalizedSourceLang = normalizeBookingContentLang(options?.sourceLang || DEFAULT_BOOKING_SOURCE_LANG);
  const fallbackLang = normalizeBookingContentLang(options?.fallbackLang || normalizedSourceLang);
  const flatLang = normalizeBookingContentLang(options?.flatLang || normalizedSourceLang);
  const flatMode = options?.flatMode === "localized" ? "localized" : "source";
  const fullMap = normalizeStoredLocalizedTextMap(mapValue, plainValue, normalizedSourceLang, { fallbackLang });
  const sourceText = normalizeText(fullMap[normalizedSourceLang]);
  const storedMap = stripSourceLangFromLocalizedTextMap(fullMap, normalizedSourceLang);
  return {
    fullMap,
    sourceText: sourceText || "",
    text: flatMode === "localized"
      ? resolveLocalizedText(fullMap, flatLang, "", { sourceLang: normalizedSourceLang })
      : (sourceText || ""),
    map: options?.hydrateSourceIntoMap === true ? fullMap : storedMap,
    storedMap
  };
}

export function resolveLocalizedText(value, lang = DEFAULT_BOOKING_CONTENT_LANG, fallback = "", options = {}) {
  if (typeof value === "string") return normalizeText(value) || fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const preferredFallbacks = Array.isArray(options?.fallbackLangs)
    ? options.fallbackLangs.map((candidate) => normalizeBookingContentLang(candidate))
    : [];
  const sourceLang = options?.sourceLang ? normalizeBookingContentLang(options.sourceLang) : "";
  const candidates = unique([
    normalizeBookingContentLang(lang),
    sourceLang,
    ...preferredFallbacks,
    DEFAULT_BOOKING_CONTENT_LANG,
    ...Object.keys(value).map((candidate) => normalizeBookingContentLang(candidate))
  ]);
  for (const candidate of candidates) {
    const text = normalizeText(value[candidate]);
    if (text) return text;
  }
  return fallback;
}

export function setLocalizedTextForLang(existingValue, inputValue, lang = DEFAULT_BOOKING_CONTENT_LANG, options = {}) {
  const fallbackLang = options?.fallbackLang || lang || DEFAULT_BOOKING_CONTENT_LANG;
  const next = normalizeLocalizedTextMap(existingValue, fallbackLang);
  const normalizedLang = normalizeBookingContentLang(lang);
  const normalizedText = normalizeText(inputValue);
  if (normalizedText) next[normalizedLang] = normalizedText;
  else delete next[normalizedLang];
  return next;
}

export function mergeLocalizedTextField(existingValue, nextValue, lang = DEFAULT_BOOKING_CONTENT_LANG, options = {}) {
  const preserveWhenUndefined = options?.preserveWhenUndefined === true;
  const defaultLang = normalizeBookingContentLang(options?.defaultLang || DEFAULT_BOOKING_CONTENT_LANG);
  const fallbackLang = normalizeBookingContentLang(options?.fallbackLang || lang || DEFAULT_BOOKING_CONTENT_LANG);
  const sourceLang = normalizeBookingContentLang(options?.sourceLang || defaultLang);
  const existingMap = normalizeStoredLocalizedTextMap(existingValue, options?.existingText, sourceLang, { fallbackLang });
  const mergedMap = nextValue === undefined && preserveWhenUndefined
    ? existingMap
    : setLocalizedTextForLang(existingMap, nextValue, lang, { fallbackLang });
  const normalizedField = normalizeStoredLocalizedTextField(mergedMap, "", {
    sourceLang,
    fallbackLang: defaultLang
  });

  return {
    map: normalizedField.storedMap,
    text: normalizedField.sourceText
  };
}

export function mergeEditableLocalizedTextField(existingValue, payloadValue, payloadMap, targetLang = DEFAULT_BOOKING_CONTENT_LANG, options = {}) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_BOOKING_CONTENT_LANG);
  const sourceLang = normalizeBookingContentLang(options?.sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const defaultLang = normalizeBookingContentLang(options?.defaultLang || sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const existingMap = normalizeStoredLocalizedTextMap(existingValue, options?.existingText, sourceLang, {
    fallbackLang: defaultLang
  });
  let nextMap = existingMap;
  const rawPayloadMap = payloadMap && typeof payloadMap === "object" && !Array.isArray(payloadMap) ? payloadMap : null;
  const pruneExtraTranslationsOnSourceChange = options?.pruneExtraTranslationsOnSourceChange === true
    || options?.pruneExtraTranslationsOnEnglishChange === true;

  if (!rawPayloadMap) {
    return mergeLocalizedTextField(nextMap, payloadValue, normalizedTargetLang, {
      fallbackLang: normalizedTargetLang,
      defaultLang
    });
  }

  const applyPayloadForLang = (lang) => {
    if (!Object.prototype.hasOwnProperty.call(rawPayloadMap, lang)) return;
    nextMap = setLocalizedTextForLang(nextMap, rawPayloadMap[lang], lang, { fallbackLang: defaultLang });
  };

  const sourcePayloadProvided = Object.prototype.hasOwnProperty.call(rawPayloadMap, sourceLang);
  const sourceChanged = pruneExtraTranslationsOnSourceChange
    && sourcePayloadProvided
    && normalizeText(rawPayloadMap[sourceLang]) !== normalizeText(existingMap[sourceLang]);

  if (sourceChanged) {
    nextMap = {};
    if (normalizedTargetLang !== sourceLang) {
      const preservedTargetText = normalizeText(existingMap[normalizedTargetLang]);
      if (preservedTargetText) {
        nextMap[normalizedTargetLang] = preservedTargetText;
      }
    }
  }

  applyPayloadForLang(sourceLang);
  if (normalizedTargetLang !== sourceLang) {
    applyPayloadForLang(normalizedTargetLang);
    if (!sourceChanged && !Object.prototype.hasOwnProperty.call(rawPayloadMap, normalizedTargetLang) && payloadValue !== undefined) {
      nextMap = setLocalizedTextForLang(nextMap, payloadValue, normalizedTargetLang, { fallbackLang: defaultLang });
    }
  } else if (!sourceChanged && !Object.prototype.hasOwnProperty.call(rawPayloadMap, sourceLang) && payloadValue !== undefined) {
    nextMap = setLocalizedTextForLang(nextMap, payloadValue, sourceLang, { fallbackLang: defaultLang });
  }

  const normalizedField = normalizeStoredLocalizedTextField(nextMap, "", {
    sourceLang,
    fallbackLang: defaultLang
  });
  return {
    map: normalizedField.storedMap,
    text: normalizedField.sourceText
  };
}
