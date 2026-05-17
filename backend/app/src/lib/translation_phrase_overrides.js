import { normalizeText } from "./text.js";

export const TRANSLATION_PHRASE_OVERRIDES_SCHEMA = "translation-phrase-overrides/v1";

function sortOverrideItems(left, right) {
  return [
    normalizeText(left.target_lang).localeCompare(normalizeText(right.target_lang), "en"),
    normalizeText(left.source_phrase).localeCompare(normalizeText(right.source_phrase), "en", { sensitivity: "base" })
  ].find((value) => value !== 0) || 0;
}

function phraseOverrideSourceKey(scope = {}) {
  const targetLang = normalizeText(scope.target_lang || scope.targetLang).toLowerCase();
  const sourcePhrase = normalizeText(scope.source_phrase || scope.sourcePhrase || scope.source);
  return targetLang && sourcePhrase ? `${targetLang}\u0000${sourcePhrase}` : "";
}

export function normalizeTranslationPhraseOverrideItems(payload = {}) {
  const rawItems = Array.isArray(payload) ? payload : payload?.items;
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      const normalized = {
        source_phrase: normalizeText(source.source_phrase || source.sourcePhrase),
        target_lang: normalizeText(source.target_lang || source.targetLang).toLowerCase(),
        target_phrase: normalizeText(source.target_phrase || source.targetPhrase)
      };
      return phraseOverrideSourceKey(normalized) && normalized.target_phrase ? normalized : null;
    })
    .filter(Boolean)
    .sort(sortOverrideItems);
}

export function normalizeStoredTranslationPhraseOverrides(payload = {}) {
  return {
    schema: TRANSLATION_PHRASE_OVERRIDES_SCHEMA,
    schema_version: 1,
    items: normalizeTranslationPhraseOverrideItems(payload)
  };
}

export function createTranslationPhraseOverrideIndex(payload = {}) {
  const rawItems = Array.isArray(payload) ? normalizeTranslationPhraseOverrideItems(payload) : normalizeStoredTranslationPhraseOverrides(payload).items;
  const bySource = new Map();
  const byTargetLang = new Map();
  const items = [];
  const duplicates = [];
  for (const item of rawItems) {
    const key = phraseOverrideSourceKey(item);
    if (!key) continue;
    const existing = bySource.get(key);
    if (existing) {
      if (existing.target_phrase !== item.target_phrase) duplicates.push(key);
      continue;
    }
    bySource.set(key, item);
    items.push(item);
    const targetLang = normalizeText(item.target_lang).toLowerCase();
    if (!byTargetLang.has(targetLang)) byTargetLang.set(targetLang, []);
    byTargetLang.get(targetLang).push(item);
  }
  for (const targetItems of byTargetLang.values()) {
    targetItems.sort(sortOverrideItems);
  }
  return {
    items,
    bySource,
    byTargetLang,
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

export function validateTranslationPhraseOverride(item = {}, {
  sourceText = "",
  context = ""
} = {}) {
  const errors = [];
  const label = normalizeText(context) || "phrase override";
  const expectedSourceText = normalizeText(sourceText);
  const actualSourcePhrase = normalizeText(item.source_phrase);
  const targetPhrase = normalizeText(item.target_phrase);

  if (!actualSourcePhrase) {
    errors.push(`${label}: source_phrase is required.`);
  } else if (expectedSourceText && !expectedSourceText.includes(actualSourcePhrase)) {
    errors.push(`${label}: source_phrase does not occur in the selected source.`);
  }
  if (!normalizeText(item.target_lang)) {
    errors.push(`${label}: target_lang is required.`);
  }
  if (!targetPhrase) {
    errors.push(`${label}: target_phrase is required.`);
  }

  const tokenError = listMismatchError("template token", templateTokens(actualSourcePhrase), templateTokens(targetPhrase));
  if (tokenError) errors.push(`${label}: ${tokenError}.`);

  const htmlError = listMismatchError("HTML tag", htmlTagSequence(actualSourcePhrase), htmlTagSequence(targetPhrase));
  if (htmlError) errors.push(`${label}: ${htmlError}.`);

  return errors;
}

export function resolveTranslationPhraseOverride(index, scope = {}) {
  const bySource = index?.bySource instanceof Map ? index.bySource : new Map();
  return bySource.get(phraseOverrideSourceKey(scope)) || null;
}

export function translationPhraseOverridesForTargetLang(index, targetLang) {
  const byTargetLang = index?.byTargetLang instanceof Map ? index.byTargetLang : new Map();
  return [...(byTargetLang.get(normalizeText(targetLang).toLowerCase()) || [])];
}
