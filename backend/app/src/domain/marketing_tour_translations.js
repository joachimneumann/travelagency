import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "../lib/text.js";
import { translationMemorySourceKey } from "../lib/translation_memory_store.js";
import { normalizeTourLang } from "./tour_catalog_i18n.js";

async function readJsonObject(filePath, fallback = {}) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function loadPublishedMarketingTourTranslations(translationsSnapshotDir, languages) {
  const mapsByLang = new Map();
  const root = normalizeText(translationsSnapshotDir);
  const uniqueLanguages = Array.from(new Set(
    (Array.isArray(languages) ? languages : [])
      .map((lang) => normalizeTourLang(lang))
      .filter((lang) => lang && lang !== "en")
  ));
  await Promise.all(uniqueLanguages.map(async (lang) => {
    const entries = new Map();
    if (root) {
      const snapshotPath = path.join(root, "customers", `marketing-tours.${lang}.json`);
      const payload = await readJsonObject(snapshotPath, { items: [] });
      for (const item of Array.isArray(payload?.items) ? payload.items : []) {
        const sourceText = normalizeText(item?.source_text);
        const targetText = normalizeText(item?.target_text);
        if (!sourceText || !targetText) continue;
        entries.set(translationMemorySourceKey(sourceText), targetText);
      }
    }
    mapsByLang.set(lang, entries);
  }));
  return mapsByLang;
}

function cloneJson(value) {
  return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));
}

function sourceTextFromPlainValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? normalizeText(value.en)
    : normalizeText(value);
}

function translationForSource(translations, sourceText) {
  const normalizedSource = normalizeText(sourceText);
  if (!normalizedSource || !(translations instanceof Map)) return "";
  return normalizeText(translations.get(translationMemorySourceKey(normalizedSource)));
}

function removeOwnField(holder, fieldName) {
  if (!holder || typeof holder !== "object" || Array.isArray(holder) || !Object.hasOwn(holder, fieldName)) return false;
  delete holder[fieldName];
  return true;
}

function stripI18nFields(value) {
  if (Array.isArray(value)) {
    return value.reduce((changed, item) => stripI18nFields(item) || changed, false);
  }
  if (!value || typeof value !== "object") return false;
  let changed = false;
  for (const key of Object.keys(value)) {
    if (key.endsWith("_i18n")) {
      delete value[key];
      changed = true;
      continue;
    }
    changed = stripI18nFields(value[key]) || changed;
  }
  return changed;
}

function stripMarketingTourEmbeddedTranslations(tour) {
  if (!tour || typeof tour !== "object" || Array.isArray(tour)) return false;
  let changed = false;
  changed = removeOwnField(tour, "title_i18n") || changed;
  changed = removeOwnField(tour, "short_description_i18n") || changed;
  changed = stripI18nFields(tour.travel_plan) || changed;
  return changed;
}

function applyTranslationToLocalizedPair(holder, plainField, i18nField, lang, translations) {
  if (!holder || typeof holder !== "object" || Array.isArray(holder)) return false;
  const normalizedLang = normalizeTourLang(lang);
  if (!normalizedLang || normalizedLang === "en") return false;
  const sourceText = sourceTextFromPlainValue(holder[plainField]);
  if (!sourceText) return false;
  const targetText = translationForSource(translations, sourceText);
  if (!targetText) return false;
  holder[i18nField] = {
    [normalizedLang]: targetText
  };
  return true;
}

function applyTranslationsToTravelPlanImage(image, lang, translations) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return false;
  let changed = false;
  changed = applyTranslationToLocalizedPair(image, "caption", "caption_i18n", lang, translations) || changed;
  changed = applyTranslationToLocalizedPair(image, "alt_text", "alt_text_i18n", lang, translations) || changed;
  return changed;
}

function applyTranslationsToTravelPlan(travelPlan, lang, translations) {
  if (!travelPlan || typeof travelPlan !== "object" || Array.isArray(travelPlan)) return false;
  let changed = false;
  for (const day of Array.isArray(travelPlan.days) ? travelPlan.days : []) {
    if (!day || typeof day !== "object" || Array.isArray(day)) continue;
    changed = applyTranslationToLocalizedPair(day, "title", "title_i18n", lang, translations) || changed;
    changed = applyTranslationToLocalizedPair(day, "overnight_location", "overnight_location_i18n", lang, translations) || changed;
    changed = applyTranslationToLocalizedPair(day, "notes", "notes_i18n", lang, translations) || changed;
    for (const service of Array.isArray(day.services) ? day.services : []) {
      if (!service || typeof service !== "object" || Array.isArray(service)) continue;
      changed = applyTranslationToLocalizedPair(service, "time_label", "time_label_i18n", lang, translations) || changed;
      changed = applyTranslationToLocalizedPair(service, "title", "title_i18n", lang, translations) || changed;
      changed = applyTranslationToLocalizedPair(service, "details", "details_i18n", lang, translations) || changed;
      changed = applyTranslationToLocalizedPair(service, "location", "location_i18n", lang, translations) || changed;
      changed = applyTranslationToLocalizedPair(service, "image_subtitle", "image_subtitle_i18n", lang, translations) || changed;
      changed = applyTranslationsToTravelPlanImage(service.image, lang, translations) || changed;
      for (const image of Array.isArray(service.images) ? service.images : []) {
        changed = applyTranslationsToTravelPlanImage(image, lang, translations) || changed;
      }
    }
  }
  return changed;
}

export function applyMarketingTourTranslations(tour, lang, translations) {
  const normalizedLang = normalizeTourLang(lang);
  if (!tour || typeof tour !== "object" || Array.isArray(tour)) return tour;
  const next = cloneJson(tour);
  let changed = stripMarketingTourEmbeddedTranslations(next);
  if (normalizedLang !== "en" && translations instanceof Map && translations.size > 0) {
    changed = applyTranslationToLocalizedPair(next, "title", "title_i18n", normalizedLang, translations) || changed;
    changed = applyTranslationToLocalizedPair(next, "short_description", "short_description_i18n", normalizedLang, translations) || changed;
    changed = applyTranslationsToTravelPlan(next.travel_plan, normalizedLang, translations) || changed;
  }
  return changed ? next : tour;
}
