import { createHash } from "node:crypto";
import { normalizeText } from "../lib/text.js";
import { promptLanguageName } from "../../../../shared/generated/language_catalog.js";
import {
  DEFAULT_BOOKING_CONTENT_LANG,
  normalizeBookingContentLang,
  normalizeStoredLocalizedTextField,
  normalizeStoredLocalizedTextMap,
  setLocalizedTextForLang
} from "./booking_content_i18n.js";

const TRANSLATION_ORIGINS = Object.freeze(new Set(["manual", "machine"]));

function cloneJson(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function normalizeOrigin(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRANSLATION_ORIGINS.has(normalized) ? normalized : "manual";
}

function normalizeTranslationKeys(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    )
  );
}

export function normalizeSectionTranslationMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  for (const [lang, entry] of Object.entries(value)) {
    const normalizedLang = normalizeBookingContentLang(lang);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    normalized[normalizedLang] = {
      source_lang: normalizeBookingContentLang(entry?.source_lang || DEFAULT_BOOKING_CONTENT_LANG),
      source_hash: normalizeText(entry?.source_hash),
      origin: normalizeOrigin(entry?.origin),
      updated_at: normalizeText(entry?.updated_at) || null,
      ...(normalizeTranslationKeys(entry?.manual_keys).length
        ? { manual_keys: normalizeTranslationKeys(entry?.manual_keys) }
        : {})
    };
  }
  return normalized;
}

function createFieldDescriptor({
  key,
  holder,
  mapField,
  plainField,
  sourceLang,
  targetLang,
  emptyValue = "",
  enabled = true
}) {
  if (!enabled || !holder) return null;
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const map = normalizeStoredLocalizedTextMap(holder?.[mapField], holder?.[plainField], normalizedSourceLang);
  const sourceText = normalizeText(map[normalizedSourceLang]);
  if (!sourceText) return null;
  return {
    key,
    sourceText,
    targetText() {
      const currentMap = normalizeStoredLocalizedTextMap(holder?.[mapField], holder?.[plainField], normalizedSourceLang);
      return normalizeText(currentMap[normalizedTargetLang]);
    },
    apply(nextText) {
      const updatedMap = setLocalizedTextForLang(
        normalizeStoredLocalizedTextMap(holder?.[mapField], holder?.[plainField], normalizedSourceLang),
        nextText,
        targetLang,
        { fallbackLang: normalizedSourceLang }
      );
      const normalizedField = normalizeStoredLocalizedTextField(updatedMap, "", {
        sourceLang: normalizedSourceLang
      });
      holder[mapField] = normalizedField.storedMap;
      holder[plainField] = normalizedField.sourceText || emptyValue;
    }
  };
}

function collectTravelPlanFieldDescriptors(travelPlan, options = {}) {
  const normalizedSourceLang = normalizeBookingContentLang(options?.sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(options?.targetLang || options?.lang || DEFAULT_BOOKING_CONTENT_LANG);
  const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
  return days.flatMap((day, dayIndex) => {
    const dayId = normalizeText(day?.id) || `day_${dayIndex + 1}`;
    const dayDescriptors = [
      createFieldDescriptor({
        key: `travel_plan.${dayId}.title`,
        holder: day,
        mapField: "title_i18n",
        plainField: "title",
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        emptyValue: ""
      }),
      createFieldDescriptor({
        key: `travel_plan.${dayId}.overnight_location`,
        holder: day,
        mapField: "overnight_location_i18n",
        plainField: "overnight_location",
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        emptyValue: null
      }),
      createFieldDescriptor({
        key: `travel_plan.${dayId}.notes`,
        holder: day,
        mapField: "notes_i18n",
        plainField: "notes",
        sourceLang: normalizedSourceLang,
        targetLang: normalizedTargetLang,
        emptyValue: null
      })
    ].filter(Boolean);

    const services = Array.isArray(day?.services)
      ? day.services
      : (Array.isArray(day?.items) ? day.items : []);
    const itemDescriptors = services.flatMap((item, itemIndex) => {
      const itemId = normalizeText(item?.id) || `item_${dayIndex + 1}_${itemIndex + 1}`;
      return [
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.time_label`,
          holder: item,
          mapField: "time_label_i18n",
          plainField: "time_label",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: null,
          enabled: String(item?.timing_kind || "label") === "label"
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.title`,
          holder: item,
          mapField: "title_i18n",
          plainField: "title",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: ""
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.details`,
          holder: item,
          mapField: "details_i18n",
          plainField: "details",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: null
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.location`,
          holder: item,
          mapField: "location_i18n",
          plainField: "location",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: null
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.image_subtitle`,
          holder: item,
          mapField: "image_subtitle_i18n",
          plainField: "image_subtitle",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: null
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.image.caption`,
          holder: item?.image,
          mapField: "caption_i18n",
          plainField: "caption",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: null
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.image.alt_text`,
          holder: item?.image,
          mapField: "alt_text_i18n",
          plainField: "alt_text",
          sourceLang: normalizedSourceLang,
          targetLang: normalizedTargetLang,
          emptyValue: null
        })
      ].filter(Boolean);
    });

    return [...dayDescriptors, ...itemDescriptors];
  });
}

function computeSourceHash(descriptors, options = {}) {
  const excludedKeys = new Set(normalizeTranslationKeys(options?.excludedKeys));
  const payload = descriptors
    .filter((descriptor) => !excludedKeys.has(descriptor.key))
    .map((descriptor) => [descriptor.key, descriptor.sourceText]);
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function collectTranslationFieldValues(section, collectDescriptors, sourceLang, targetLang) {
  const descriptors = collectDescriptors(section, { sourceLang, targetLang });
  return new Map(
    descriptors.map((descriptor) => [descriptor.key, descriptor.targetText()])
  );
}

function collectChangedTranslationKeys(currentSection, nextSection, collectDescriptors, sourceLang = DEFAULT_BOOKING_CONTENT_LANG, targetLang) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const currentValues = collectTranslationFieldValues(
    currentSection,
    collectDescriptors,
    normalizedSourceLang,
    normalizedTargetLang
  );
  const nextValues = collectTranslationFieldValues(
    nextSection,
    collectDescriptors,
    normalizedSourceLang,
    normalizedTargetLang
  );
  const keys = new Set([...currentValues.keys(), ...nextValues.keys()]);
  return Array.from(keys).filter((key) => currentValues.get(key) !== nextValues.get(key));
}

function buildTranslationSummary(section, targetLang, collectDescriptors, sourceLang = DEFAULT_BOOKING_CONTENT_LANG) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const descriptors = collectDescriptors(section, {
    sourceLang: normalizedSourceLang,
    targetLang: normalizedTargetLang
  });
  const totalFields = descriptors.length;
  const translatedFields = descriptors.reduce((count, descriptor) => count + (descriptor.targetText() ? 1 : 0), 0);
  const missingFields = Math.max(0, totalFields - translatedFields);
  const metaByLang = normalizeSectionTranslationMeta(section?.translation_meta);
  const meta = metaByLang[normalizedTargetLang] || null;
  const manualKeys = normalizeTranslationKeys(meta?.manual_keys);
  const sourceHash = computeSourceHash(descriptors, { excludedKeys: manualKeys });
  const stale = normalizedTargetLang !== normalizedSourceLang
    && Boolean(meta?.source_hash)
    && (
      normalizeBookingContentLang(meta?.source_lang || normalizedSourceLang) !== normalizedSourceLang
      || meta.source_hash !== sourceHash
    );

  let status = "missing";
  if (normalizedTargetLang === normalizedSourceLang) {
    status = "source";
  } else if (!totalFields) {
    status = "empty";
  } else if (!translatedFields) {
    status = "missing";
  } else if (stale) {
    status = "stale";
  } else if (missingFields > 0) {
    status = "partial";
  } else if ((meta?.origin || "manual") === "machine") {
    status = "machine_translated";
  } else {
    status = "reviewed";
  }

  return {
    lang: normalizedTargetLang,
    source_lang: normalizedSourceLang,
    status,
    ...(meta?.origin ? { origin: meta.origin } : {}),
    ...(meta?.updated_at ? { updated_at: meta.updated_at } : {}),
    stale,
    total_fields: totalFields,
    translated_fields: translatedFields,
    missing_fields: missingFields,
    has_source_content: totalFields > 0,
    has_target_content: translatedFields > 0,
    ...(sourceHash ? { source_hash: sourceHash } : {})
  };
}

function touchSectionTranslationMeta(section, targetLang, origin, timestamp, collectDescriptors, sourceLang = DEFAULT_BOOKING_CONTENT_LANG, options = {}) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  if (normalizedTargetLang === normalizedSourceLang) return section;
  const descriptors = collectDescriptors(section, {
    sourceLang: normalizedSourceLang,
    targetLang: normalizedTargetLang
  });
  const metaByLang = normalizeSectionTranslationMeta(section?.translation_meta);
  const existingMeta = metaByLang[normalizedTargetLang] || null;
  const manualKeys = normalizeTranslationKeys(options?.manualKeys ?? existingMeta?.manual_keys);
  if (!descriptors.length) {
    delete metaByLang[normalizedTargetLang];
    section.translation_meta = metaByLang;
    return section;
  }
  metaByLang[normalizedTargetLang] = {
    source_lang: normalizedSourceLang,
    source_hash: computeSourceHash(descriptors, { excludedKeys: manualKeys }),
    origin: manualKeys.length ? "manual" : normalizeOrigin(origin),
    updated_at: normalizeText(timestamp) || null,
    ...(manualKeys.length ? { manual_keys: manualKeys } : {})
  };
  section.translation_meta = metaByLang;
  return section;
}

async function translateSection(section, targetLang, translateEntries, timestamp, collectDescriptors, sourceLang = DEFAULT_BOOKING_CONTENT_LANG) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_BOOKING_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  if (normalizedTargetLang === normalizedSourceLang) {
    const error = new Error(`${promptLanguageName(normalizedSourceLang)} is the source language and cannot be auto-translated.`);
    error.code = "TRANSLATION_SOURCE_LANGUAGE";
    throw error;
  }
  const nextSection = cloneJson(section);
  const descriptors = collectDescriptors(nextSection, {
    sourceLang: normalizedSourceLang,
    targetLang: normalizedTargetLang
  });
  const metaByLang = normalizeSectionTranslationMeta(nextSection?.translation_meta);
  const manualKeys = normalizeTranslationKeys(metaByLang[normalizedTargetLang]?.manual_keys);
  const entries = Object.fromEntries(descriptors.map((descriptor) => [descriptor.key, descriptor.sourceText]));
  const translatedEntries = await translateEntries(entries, normalizedTargetLang, {
    sourceLang: promptLanguageName(normalizedSourceLang),
    domain: "travel planning",
    allowGoogleFallback: true
  });
  descriptors.forEach((descriptor) => {
    if (manualKeys.includes(descriptor.key)) return;
    const translatedText = normalizeText(translatedEntries[descriptor.key]);
    if (!translatedText) return;
    descriptor.apply(translatedText);
  });
  return touchSectionTranslationMeta(
    nextSection,
    normalizedTargetLang,
    "machine",
    timestamp,
    collectDescriptors,
    normalizedSourceLang,
    { manualKeys }
  );
}

export function normalizeTravelPlanTranslationMeta(travelPlan) {
  const normalizedTravelPlan = travelPlan && typeof travelPlan === "object" ? travelPlan : {};
  normalizedTravelPlan.translation_meta = normalizeSectionTranslationMeta(normalizedTravelPlan.translation_meta);
  return normalizedTravelPlan;
}

export function buildTravelPlanTranslationStatus(travelPlan, targetLang, sourceLang = DEFAULT_BOOKING_CONTENT_LANG) {
  return buildTranslationSummary(travelPlan, targetLang, collectTravelPlanFieldDescriptors, sourceLang);
}

export function markTravelPlanTranslationManual(travelPlan, targetLang, timestamp, sourceLang = DEFAULT_BOOKING_CONTENT_LANG) {
  return touchSectionTranslationMeta(travelPlan, targetLang, "manual", timestamp, collectTravelPlanFieldDescriptors, sourceLang);
}

export function markTravelPlanTranslationFieldsManual(travelPlan, targetLang, timestamp, keys, sourceLang = DEFAULT_BOOKING_CONTENT_LANG) {
  const metaByLang = normalizeSectionTranslationMeta(travelPlan?.translation_meta);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const existingKeys = metaByLang[normalizedTargetLang]?.manual_keys;
  return touchSectionTranslationMeta(travelPlan, targetLang, "manual", timestamp, collectTravelPlanFieldDescriptors, sourceLang, {
    manualKeys: [...normalizeTranslationKeys(existingKeys), ...normalizeTranslationKeys(keys)]
  });
}

export function collectTravelPlanTranslationFieldChanges(currentTravelPlan, nextTravelPlan, targetLang, sourceLang = DEFAULT_BOOKING_CONTENT_LANG) {
  return collectChangedTranslationKeys(currentTravelPlan, nextTravelPlan, collectTravelPlanFieldDescriptors, sourceLang, targetLang);
}

export async function translateTravelPlanFromSourceLanguage(travelPlan, sourceLang, targetLang, translateEntries, timestamp) {
  return translateSection(travelPlan, targetLang, translateEntries, timestamp, collectTravelPlanFieldDescriptors, sourceLang);
}

export async function translateTravelPlanFromEnglish(travelPlan, targetLang, translateEntries, timestamp) {
  return translateTravelPlanFromSourceLanguage(travelPlan, DEFAULT_BOOKING_CONTENT_LANG, targetLang, translateEntries, timestamp);
}
