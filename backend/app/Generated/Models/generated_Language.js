// Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.


export const GENERATED_LANGUAGE_CODES = Object.freeze([
  "English",
  "Vietnamese",
  "French",
  "German",
  "Spanish"
]);

export function normalizeLanguageCode(value) {
  const normalized = String(value || '').trim();
  return GENERATED_LANGUAGE_CODES.includes(normalized) ? normalized : null;
}

export function formatLanguageCodeLabel(code) {
  return normalizeLanguageCode(code) || String(code || '').trim();
}
