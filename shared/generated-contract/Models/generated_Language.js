// Generated from api/generated/openapi.yaml.
// Do not edit by hand.


export const GENERATED_LANGUAGE_CODES = Object.freeze([
  "English",
  "French",
  "Mandarin",
  "Japanese",
  "Korean",
  "Vietnamese",
  "German",
  "Spanish",
  "Italian",
  "Russian",
  "Dutch",
  "Polish",
  "Danish",
  "Swedish",
  "Norwegian"
]);

export function normalizeLanguageCode(value) {
  const normalized = String(value || '').trim();
  return GENERATED_LANGUAGE_CODES.includes(normalized) ? normalized : null;
}

export function formatLanguageCodeLabel(code) {
  return normalizeLanguageCode(code) || String(code || '').trim();
}
