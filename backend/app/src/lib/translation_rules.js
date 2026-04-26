import { enumValueSetFor } from "./generated_catalogs.js";
import { normalizeText } from "./text.js";

const LANGUAGE_CODE_SET = enumValueSetFor("LanguageCode");

function normalizeRuleTargetLang(value) {
  const normalized = normalizeText(value).toLowerCase();
  return LANGUAGE_CODE_SET.has(normalized) ? normalized : "";
}

function compareTranslationRules(left, right) {
  const leftSource = normalizeText(left?.source);
  const rightSource = normalizeText(right?.source);
  if (rightSource.length !== leftSource.length) {
    return rightSource.length - leftSource.length;
  }
  const langCompare = normalizeText(left?.target_lang).localeCompare(normalizeText(right?.target_lang), "en", {
    sensitivity: "base"
  });
  if (langCompare !== 0) return langCompare;
  return leftSource.localeCompare(rightSource, "en", { sensitivity: "base" });
}

function translationRuleTargetEntries(item) {
  const entries = [];
  if (Array.isArray(item?.targets)) {
    for (const target of item.targets) {
      entries.push({
        target_lang: target?.target_lang,
        target: target?.target
      });
    }
  } else if (item?.targets && typeof item.targets === "object") {
    for (const [target_lang, target] of Object.entries(item.targets)) {
      entries.push({
        target_lang,
        target
      });
    }
  }

  if (Object.hasOwn(item || {}, "target_lang") || Object.hasOwn(item || {}, "target")) {
    entries.push({
      target_lang: item?.target_lang,
      target: item?.target
    });
  }
  return entries;
}

export function normalizeTranslationRule(item) {
  const source = normalizeText(item?.source);
  const [targetEntry] = translationRuleTargetEntries(item);
  const target_lang = normalizeRuleTargetLang(targetEntry?.target_lang);
  const target = normalizeText(targetEntry?.target);
  if (!source || !target_lang || !target) return null;
  return {
    source,
    target_lang,
    target
  };
}

export function normalizeTranslationRules(items) {
  const deduped = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const source = normalizeText(item?.source);
    if (!source) continue;
    for (const targetEntry of translationRuleTargetEntries(item)) {
      const normalized = normalizeTranslationRule({
        source,
        target_lang: targetEntry?.target_lang,
        target: targetEntry?.target
      });
      if (!normalized) continue;
      deduped.set(`${normalized.target_lang}\u0000${normalized.source}`, normalized);
    }
  }
  return Array.from(deduped.values()).sort(compareTranslationRules);
}

export function translationRulesForTargetLang(items, targetLang) {
  const normalizedTargetLang = normalizeRuleTargetLang(targetLang);
  if (!normalizedTargetLang) return [];
  return normalizeTranslationRules(items)
    .filter((item) => item.target_lang === normalizedTargetLang)
    .sort(compareTranslationRules);
}
