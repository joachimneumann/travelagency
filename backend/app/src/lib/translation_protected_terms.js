import { normalizeText } from "./text.js";

export const DEFAULT_TRANSLATION_PROTECTED_TERMS = Object.freeze([
  "Asia Travel Plan",
  "AsiaTravelPlan",
  "ATP",
  "backend"
]);

function compareProtectedTerms(left, right) {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  if (rightText.length !== leftText.length) {
    return rightText.length - leftText.length;
  }
  return leftText.localeCompare(rightText, "en", { sensitivity: "base" });
}

export function normalizeTranslationProtectedTerms(items) {
  const seen = new Set();
  const values = [];
  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeText(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(normalized);
  }
  return values.sort(compareProtectedTerms);
}

export function normalizeStoredTranslationProtectedTerms(payload) {
  const rawItems = Array.isArray(payload) ? payload : payload?.items;
  const updatedAt = Array.isArray(payload) ? null : (normalizeText(payload?.updated_at) || null);
  return {
    items: normalizeTranslationProtectedTerms(rawItems),
    updated_at: updatedAt
  };
}
