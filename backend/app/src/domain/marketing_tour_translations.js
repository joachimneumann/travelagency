import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "../lib/text.js";
import {
  createTranslationPhraseOverrideIndex,
  resolveTranslationPhraseOverride
} from "../lib/translation_phrase_overrides.js";
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

async function readTranslationPhraseOverrideIndex(phraseOverridesPath) {
  const normalizedPath = normalizeText(phraseOverridesPath);
  if (!normalizedPath) return createTranslationPhraseOverrideIndex({ items: [] });
  const payload = await readJsonObject(normalizedPath, { items: [] });
  const index = createTranslationPhraseOverrideIndex(payload);
  if (index.duplicates.length) {
    throw new Error(`Duplicate phrase translation override: ${index.duplicates[0]}`);
  }
  return index;
}

function overlayPhraseMarketingTourTranslations(entries, phraseOverrideIndex, lang) {
  if (!(entries instanceof Map)) return entries;
  const items = Array.isArray(phraseOverrideIndex?.items) ? phraseOverrideIndex.items : [];
  for (const item of items) {
    if (normalizeTourLang(item?.target_lang) !== lang) continue;
    const sourceText = normalizeText(item?.source_phrase);
    const phraseOverride = resolveTranslationPhraseOverride(phraseOverrideIndex, {
      target_lang: lang,
      source_phrase: sourceText
    });
    const targetText = normalizeText(phraseOverride?.target_phrase);
    if (!sourceText || !targetText) continue;
    entries.set(translationMemorySourceKey(sourceText), targetText);
  }
  return entries;
}

export async function loadPublishedMarketingTourTranslations(translationsSnapshotDir, languages, options = {}) {
  const mapsByLang = new Map();
  const root = normalizeText(translationsSnapshotDir);
  const phraseOverridesPath = typeof options === "string" ? options : options?.phraseOverridesPath;
  const phraseOverrideIndex = await readTranslationPhraseOverrideIndex(phraseOverridesPath);
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
    overlayPhraseMarketingTourTranslations(entries, phraseOverrideIndex, lang);
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
  holder[plainField] = targetText;
  removeOwnField(holder, i18nField);
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
  const boundaryLogistics = travelPlan.boundary_logistics && typeof travelPlan.boundary_logistics === "object" && !Array.isArray(travelPlan.boundary_logistics)
    ? travelPlan.boundary_logistics
    : {};
  for (const boundaryKind of ["arrival", "departure"]) {
    const service = boundaryLogistics[boundaryKind];
    if (!service || typeof service !== "object" || Array.isArray(service)) continue;
    changed = applyTranslationToLocalizedPair(service, "time", "time_i18n", lang, translations) || changed;
    changed = applyTranslationToLocalizedPair(service, "title", "title_i18n", lang, translations) || changed;
    changed = applyTranslationToLocalizedPair(service, "details", "details_i18n", lang, translations) || changed;
  }
  for (const day of Array.isArray(travelPlan.days) ? travelPlan.days : []) {
    if (!day || typeof day !== "object" || Array.isArray(day)) continue;
    changed = applyTranslationToLocalizedPair(day, "title", "title_i18n", lang, translations) || changed;
    changed = applyTranslationToLocalizedPair(day, "notes", "notes_i18n", lang, translations) || changed;
    for (const service of Array.isArray(day.services) ? day.services : []) {
      if (!service || typeof service !== "object" || Array.isArray(service)) continue;
      changed = applyTranslationToLocalizedPair(service, "time", "time_i18n", lang, translations) || changed;
      changed = applyTranslationToLocalizedPair(service, "title", "title_i18n", lang, translations) || changed;
      changed = applyTranslationToLocalizedPair(service, "details", "details_i18n", lang, translations) || changed;
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

function localizedTextMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizeTourLang(lang), normalizeText(text)])
      .filter(([lang, text]) => Boolean(lang && text))
  );
}

function addTourTranslationDescriptor(descriptors, { holder, mapField, plainField = "", key }) {
  if (!holder || !mapField || !key) return;
  const map = localizedTextMap(holder?.[mapField]);
  const sourceText = normalizeText(map.en || (plainField ? sourceTextFromPlainValue(holder?.[plainField]) : ""));
  if (!sourceText) return;
  descriptors.push({
    key,
    sourceText,
    targetText(targetLang) {
      return normalizeText(map[normalizeTourLang(targetLang)]);
    }
  });
}

export function collectMarketingTourTranslationDescriptors(tour) {
  const descriptors = [];
  addTourTranslationDescriptor(descriptors, {
    holder: tour,
    mapField: "title_i18n",
    plainField: "title",
    key: "website.title"
  });
  addTourTranslationDescriptor(descriptors, {
    holder: tour,
    mapField: "short_description_i18n",
    plainField: "short_description",
    key: "website.short_description"
  });
  const days = Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : [];
  const boundaryLogistics = tour?.travel_plan?.boundary_logistics && typeof tour.travel_plan.boundary_logistics === "object" && !Array.isArray(tour.travel_plan.boundary_logistics)
    ? tour.travel_plan.boundary_logistics
    : {};
  ["arrival", "departure"].forEach((boundaryKind) => {
    const service = boundaryLogistics[boundaryKind];
    if (!service || typeof service !== "object" || Array.isArray(service)) return;
    addTourTranslationDescriptor(descriptors, {
      holder: service,
      mapField: "time_i18n",
      plainField: "time",
      key: `travel_plan.boundary.${boundaryKind}.time`
    });
    addTourTranslationDescriptor(descriptors, {
      holder: service,
      mapField: "title_i18n",
      plainField: "title",
      key: `travel_plan.boundary.${boundaryKind}.title`
    });
    addTourTranslationDescriptor(descriptors, {
      holder: service,
      mapField: "details_i18n",
      plainField: "details",
      key: `travel_plan.boundary.${boundaryKind}.details`
    });
  });
  days.forEach((day, dayIndex) => {
    const dayId = normalizeText(day?.id) || `day_${dayIndex + 1}`;
    addTourTranslationDescriptor(descriptors, {
      holder: day,
      mapField: "title_i18n",
      plainField: "title",
      key: `travel_plan.${dayId}.title`
    });
    addTourTranslationDescriptor(descriptors, {
      holder: day,
      mapField: "notes_i18n",
      plainField: "notes",
      key: `travel_plan.${dayId}.notes`
    });
    const services = Array.isArray(day?.services) ? day.services : [];
    services.forEach((service, serviceIndex) => {
      const serviceId = normalizeText(service?.id) || `service_${dayIndex + 1}_${serviceIndex + 1}`;
      addTourTranslationDescriptor(descriptors, {
        holder: service,
        mapField: "time_i18n",
        plainField: "time",
        key: `travel_plan.${dayId}.${serviceId}.time`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: service,
        mapField: "title_i18n",
        plainField: "title",
        key: `travel_plan.${dayId}.${serviceId}.title`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: service,
        mapField: "details_i18n",
        plainField: "details",
        key: `travel_plan.${dayId}.${serviceId}.details`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: service,
        mapField: "image_subtitle_i18n",
        plainField: "image_subtitle",
        key: `travel_plan.${dayId}.${serviceId}.image_subtitle`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: service?.image,
        mapField: "caption_i18n",
        plainField: "caption",
        key: `travel_plan.${dayId}.${serviceId}.image.caption`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: service?.image,
        mapField: "alt_text_i18n",
        plainField: "alt_text",
        key: `travel_plan.${dayId}.${serviceId}.image.alt_text`
      });
    });
  });
  return descriptors;
}

async function syncTourManualTranslationsToMemory(tour, translationMemoryStore) {
  if (!translationMemoryStore || typeof translationMemoryStore.patchManualOverrides !== "function") return;
  const meta = tour?.travel_plan?.translation_meta && typeof tour.travel_plan.translation_meta === "object" && !Array.isArray(tour.travel_plan.translation_meta)
    ? tour.travel_plan.translation_meta
    : {};
  const descriptors = collectMarketingTourTranslationDescriptors(tour);
  const descriptorsByKey = new Map(descriptors.map((descriptor) => [descriptor.key, descriptor]));
  for (const [lang, entry] of Object.entries(meta)) {
    const targetLang = normalizeTourLang(lang);
    const manualKeys = Array.isArray(entry?.manual_keys)
      ? entry.manual_keys.map((key) => normalizeText(key)).filter(Boolean)
      : [];
    const updates = manualKeys
      .map((key) => {
        const descriptor = descriptorsByKey.get(key);
        const manualOverride = descriptor?.targetText(targetLang);
        if (!descriptor?.sourceText || !manualOverride) return null;
        return {
          source_text: descriptor.sourceText,
          manual_override: manualOverride
        };
      })
      .filter(Boolean);
    if (updates.length) {
      await translationMemoryStore.patchManualOverrides(targetLang, updates);
    }
  }
}

export async function syncMarketingTourTranslationsForPublish(tours, translationMemoryStore) {
  for (const tour of Array.isArray(tours) ? tours : []) {
    await syncTourManualTranslationsToMemory(tour, translationMemoryStore);
  }
}
