import { normalizeText } from "./text.js";

export const TRANSLATION_MANUAL_OVERRIDES_SCHEMA = "translation-manual-overrides/v2";

function sortOverrideItems(left, right) {
  return [
    normalizeText(left.target_lang).localeCompare(normalizeText(right.target_lang), "en"),
    normalizeText(left.source_text).localeCompare(normalizeText(right.source_text), "en", { sensitivity: "base" })
  ].find((value) => value !== 0) || 0;
}

function manualOverrideSourceKey(scope = {}) {
  const targetLang = normalizeText(scope.target_lang || scope.targetLang).toLowerCase();
  const sourceText = normalizeText(scope.source_text || scope.sourceText || scope.source);
  return targetLang && sourceText ? `${targetLang}\u0000${sourceText}` : "";
}

export function normalizeTranslationManualOverrideItems(payload = {}) {
  const rawItems = Array.isArray(payload) ? payload : payload?.items;
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      const normalized = {
        source_text: normalizeText(source.source_text),
        target_lang: normalizeText(source.target_lang || source.targetLang).toLowerCase(),
        manual_override: normalizeText(source.manual_override)
      };
      return manualOverrideSourceKey(normalized) && normalized.manual_override ? normalized : null;
    })
    .filter(Boolean)
    .sort(sortOverrideItems);
}

export function normalizeStoredTranslationManualOverrides(payload = {}) {
  return {
    schema: TRANSLATION_MANUAL_OVERRIDES_SCHEMA,
    schema_version: 2,
    items: normalizeTranslationManualOverrideItems(payload)
  };
}

export function createTranslationManualOverrideIndex(payload = {}) {
  const rawItems = Array.isArray(payload) ? normalizeTranslationManualOverrideItems(payload) : normalizeStoredTranslationManualOverrides(payload).items;
  const bySource = new Map();
  const items = [];
  const duplicates = [];
  for (const item of rawItems) {
    const key = manualOverrideSourceKey(item);
    if (!key) continue;
    const existing = bySource.get(key);
    if (existing) {
      if (existing.manual_override !== item.manual_override) duplicates.push(key);
      continue;
    }
    bySource.set(key, item);
    items.push(item);
  }
  return {
    items,
    bySource,
    duplicates
  };
}

function countOccurrences(values) {
  return values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }, new Map());
}

function describeMissingCounts(expected, actual) {
  const expectedCounts = countOccurrences(expected);
  const actualCounts = countOccurrences(actual);
  const missing = [];
  const extra = [];
  for (const [value, count] of expectedCounts.entries()) {
    const actualCount = actualCounts.get(value) || 0;
    for (let index = actualCount; index < count; index += 1) missing.push(value);
  }
  for (const [value, count] of actualCounts.entries()) {
    const expectedCount = expectedCounts.get(value) || 0;
    for (let index = expectedCount; index < count; index += 1) extra.push(value);
  }
  return { missing, extra };
}

function templateTokens(value) {
  return String(value ?? "").match(/\{[^{}]+\}/g) || [];
}

function htmlTagSequence(value) {
  const tags = [];
  const re = /<\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)\b[^>]*>/g;
  let match;
  while ((match = re.exec(String(value ?? "")))) {
    const raw = match[0];
    const direction = raw.startsWith("</") ? "/" : "";
    const selfClosing = /\/\s*>$/.test(raw) ? "/" : "";
    tags.push(`${direction}${normalizeText(match[1]).toLowerCase()}${selfClosing}`);
  }
  return tags;
}

function listMismatchError(kind, expected, actual) {
  const { missing, extra } = describeMissingCounts(expected, actual);
  const parts = [];
  if (missing.length) parts.push(`missing ${missing.join(", ")}`);
  if (extra.length) parts.push(`extra ${extra.join(", ")}`);
  return parts.length ? `${kind} mismatch (${parts.join("; ")})` : "";
}

export function validateTranslationManualOverride(item = {}, {
  sourceText = "",
  context = ""
} = {}) {
  const errors = [];
  const label = normalizeText(context) || "manual override";
  const expectedSourceText = normalizeText(sourceText);
  const actualSourceText = normalizeText(item.source_text);
  const override = normalizeText(item.manual_override);

  if (!actualSourceText) {
    errors.push(`${label}: source_text is required.`);
  } else if (expectedSourceText && actualSourceText !== expectedSourceText) {
    errors.push(`${label}: source_text does not match the selected source.`);
  }
  if (!normalizeText(item.target_lang)) {
    errors.push(`${label}: target_lang is required.`);
  }
  if (!override) {
    errors.push(`${label}: manual_override is required.`);
  }

  const tokenError = listMismatchError("template token", templateTokens(expectedSourceText || actualSourceText), templateTokens(override));
  if (tokenError) errors.push(`${label}: ${tokenError}.`);

  const htmlError = listMismatchError("HTML tag", htmlTagSequence(expectedSourceText || actualSourceText), htmlTagSequence(override));
  if (htmlError) errors.push(`${label}: ${htmlError}.`);

  return errors;
}

export function resolveTranslationManualOverride(index, scope = {}) {
  const bySource = index?.bySource instanceof Map ? index.bySource : new Map();
  return bySource.get(manualOverrideSourceKey(scope)) || null;
}
