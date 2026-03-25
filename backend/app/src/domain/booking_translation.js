import { createHash } from "node:crypto";
import { normalizeText } from "../lib/text.js";
import {
  DEFAULT_BOOKING_CONTENT_LANG,
  normalizeBookingContentLang,
  normalizeLocalizedTextMap,
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
      updated_at: normalizeText(entry?.updated_at) || null
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
  const map = normalizeLocalizedTextMap(holder?.[mapField] ?? holder?.[plainField], sourceLang);
  const sourceText = normalizeText(map[normalizedSourceLang]);
  if (!sourceText) return null;
  return {
    key,
    sourceText,
    targetText() {
      const currentMap = normalizeLocalizedTextMap(holder?.[mapField] ?? holder?.[plainField], sourceLang);
      return normalizeText(currentMap[normalizedTargetLang]);
    },
    apply(nextText) {
      const updatedMap = setLocalizedTextForLang(
        normalizeLocalizedTextMap(holder?.[mapField] ?? holder?.[plainField], sourceLang),
        nextText,
        targetLang,
        { fallbackLang: sourceLang }
      );
      holder[mapField] = updatedMap;
      const resolved = normalizeText(updatedMap[normalizedTargetLang]);
      holder[plainField] = resolved || emptyValue;
    }
  };
}

function collectOfferFieldDescriptors(offer, targetLang) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const components = Array.isArray(offer?.components) ? offer.components : [];
  return components.flatMap((component, index) => {
    const componentId = normalizeText(component?.id) || `component_${index + 1}`;
    const details = createFieldDescriptor({
      key: `offer.${componentId}.details`,
      holder: component,
      mapField: "details_i18n",
      plainField: "details",
      sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
      targetLang: normalizedTargetLang,
      emptyValue: ""
    });
    return details ? [details] : [];
  });
}

function collectTravelPlanFieldDescriptors(travelPlan, targetLang) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
  return days.flatMap((day, dayIndex) => {
    const dayId = normalizeText(day?.id) || `day_${dayIndex + 1}`;
    const dayDescriptors = [
      createFieldDescriptor({
        key: `travel_plan.${dayId}.title`,
        holder: day,
        mapField: "title_i18n",
        plainField: "title",
        sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
        targetLang: normalizedTargetLang,
        emptyValue: ""
      }),
      createFieldDescriptor({
        key: `travel_plan.${dayId}.overnight_location`,
        holder: day,
        mapField: "overnight_location_i18n",
        plainField: "overnight_location",
        sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
        targetLang: normalizedTargetLang,
        emptyValue: null
      }),
      createFieldDescriptor({
        key: `travel_plan.${dayId}.notes`,
        holder: day,
        mapField: "notes_i18n",
        plainField: "notes",
        sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
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
          sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
          targetLang: normalizedTargetLang,
          emptyValue: null,
          enabled: String(item?.timing_kind || "label") === "label"
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.title`,
          holder: item,
          mapField: "title_i18n",
          plainField: "title",
          sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
          targetLang: normalizedTargetLang,
          emptyValue: ""
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.details`,
          holder: item,
          mapField: "details_i18n",
          plainField: "details",
          sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
          targetLang: normalizedTargetLang,
          emptyValue: null
        }),
        createFieldDescriptor({
          key: `travel_plan.${dayId}.${itemId}.location`,
          holder: item,
          mapField: "location_i18n",
          plainField: "location",
          sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
          targetLang: normalizedTargetLang,
          emptyValue: null
        })
      ].filter(Boolean);
    });

    return [...dayDescriptors, ...itemDescriptors];
  });
}

function collectInvoiceFieldDescriptors(invoice, targetLang) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const descriptors = [
    createFieldDescriptor({
      key: "invoice.title",
      holder: invoice,
      mapField: "title_i18n",
      plainField: "title",
      sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
      targetLang: normalizedTargetLang,
      emptyValue: ""
    }),
    createFieldDescriptor({
      key: "invoice.notes",
      holder: invoice,
      mapField: "notes_i18n",
      plainField: "notes",
      sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
      targetLang: normalizedTargetLang,
      emptyValue: null
    })
  ].filter(Boolean);

  const components = Array.isArray(invoice?.components) ? invoice.components : [];
  const componentDescriptors = components.flatMap((component, index) => {
    const componentId = normalizeText(component?.id) || `component_${index + 1}`;
    const descriptionDescriptor = createFieldDescriptor({
      key: `invoice.${componentId}.description`,
      holder: component,
      mapField: "description_i18n",
      plainField: "description",
      sourceLang: DEFAULT_BOOKING_CONTENT_LANG,
      targetLang: normalizedTargetLang,
      emptyValue: ""
    });
    return descriptionDescriptor ? [descriptionDescriptor] : [];
  });

  return [...descriptors, ...componentDescriptors];
}

function computeSourceHash(descriptors) {
  const payload = descriptors.map((descriptor) => [descriptor.key, descriptor.sourceText]);
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function buildTranslationSummary(section, targetLang, collectDescriptors) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  const descriptors = collectDescriptors(section, normalizedTargetLang);
  const totalFields = descriptors.length;
  const translatedFields = descriptors.reduce((count, descriptor) => count + (descriptor.targetText() ? 1 : 0), 0);
  const missingFields = Math.max(0, totalFields - translatedFields);
  const metaByLang = normalizeSectionTranslationMeta(section?.translation_meta);
  const meta = metaByLang[normalizedTargetLang] || null;
  const sourceHash = computeSourceHash(descriptors);
  const stale = normalizedTargetLang !== DEFAULT_BOOKING_CONTENT_LANG
    && Boolean(meta?.source_hash)
    && meta.source_hash !== sourceHash;

  let status = "missing";
  if (normalizedTargetLang === DEFAULT_BOOKING_CONTENT_LANG) {
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
    source_lang: DEFAULT_BOOKING_CONTENT_LANG,
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

function touchSectionTranslationMeta(section, targetLang, origin, timestamp, collectDescriptors) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  if (normalizedTargetLang === DEFAULT_BOOKING_CONTENT_LANG) return section;
  const descriptors = collectDescriptors(section, normalizedTargetLang);
  const metaByLang = normalizeSectionTranslationMeta(section?.translation_meta);
  if (!descriptors.length) {
    delete metaByLang[normalizedTargetLang];
    section.translation_meta = metaByLang;
    return section;
  }
  metaByLang[normalizedTargetLang] = {
    source_lang: DEFAULT_BOOKING_CONTENT_LANG,
    source_hash: computeSourceHash(descriptors),
    origin: normalizeOrigin(origin),
    updated_at: normalizeText(timestamp) || null
  };
  section.translation_meta = metaByLang;
  return section;
}

async function translateSection(section, targetLang, translateEntries, timestamp, collectDescriptors) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang);
  if (normalizedTargetLang === DEFAULT_BOOKING_CONTENT_LANG) {
    const error = new Error("English is the source language and cannot be auto-translated.");
    error.code = "TRANSLATION_SOURCE_LANGUAGE";
    throw error;
  }
  const nextSection = cloneJson(section);
  const descriptors = collectDescriptors(nextSection, normalizedTargetLang);
  const entries = Object.fromEntries(descriptors.map((descriptor) => [descriptor.key, descriptor.sourceText]));
  const translatedEntries = await translateEntries(entries, normalizedTargetLang, {
    sourceLang: "English",
    domain: "travel planning"
  });
  descriptors.forEach((descriptor) => {
    const translatedText = normalizeText(translatedEntries[descriptor.key]);
    if (!translatedText) return;
    descriptor.apply(translatedText);
  });
  return touchSectionTranslationMeta(nextSection, normalizedTargetLang, "machine", timestamp, collectDescriptors);
}

export function normalizeOfferTranslationMeta(offer) {
  const normalizedOffer = offer && typeof offer === "object" ? offer : {};
  normalizedOffer.translation_meta = normalizeSectionTranslationMeta(normalizedOffer.translation_meta);
  return normalizedOffer;
}

export function normalizeTravelPlanTranslationMeta(travelPlan) {
  const normalizedTravelPlan = travelPlan && typeof travelPlan === "object" ? travelPlan : {};
  normalizedTravelPlan.translation_meta = normalizeSectionTranslationMeta(normalizedTravelPlan.translation_meta);
  return normalizedTravelPlan;
}

export function normalizeInvoiceTranslationMeta(invoice) {
  const normalizedInvoice = invoice && typeof invoice === "object" ? invoice : {};
  normalizedInvoice.translation_meta = normalizeSectionTranslationMeta(normalizedInvoice.translation_meta);
  return normalizedInvoice;
}

export function buildOfferTranslationStatus(offer, targetLang) {
  return buildTranslationSummary(offer, targetLang, collectOfferFieldDescriptors);
}

export function buildTravelPlanTranslationStatus(travelPlan, targetLang) {
  return buildTranslationSummary(travelPlan, targetLang, collectTravelPlanFieldDescriptors);
}

export function buildInvoiceTranslationStatus(invoice, targetLang) {
  return buildTranslationSummary(invoice, targetLang, collectInvoiceFieldDescriptors);
}

export function markOfferTranslationManual(offer, targetLang, timestamp) {
  return touchSectionTranslationMeta(offer, targetLang, "manual", timestamp, collectOfferFieldDescriptors);
}

export function markTravelPlanTranslationManual(travelPlan, targetLang, timestamp) {
  return touchSectionTranslationMeta(travelPlan, targetLang, "manual", timestamp, collectTravelPlanFieldDescriptors);
}

export function markInvoiceTranslationManual(invoice, targetLang, timestamp) {
  return touchSectionTranslationMeta(invoice, targetLang, "manual", timestamp, collectInvoiceFieldDescriptors);
}

export async function translateOfferFromEnglish(offer, targetLang, translateEntries, timestamp) {
  return translateSection(offer, targetLang, translateEntries, timestamp, collectOfferFieldDescriptors);
}

export async function translateTravelPlanFromEnglish(travelPlan, targetLang, translateEntries, timestamp) {
  return translateSection(travelPlan, targetLang, translateEntries, timestamp, collectTravelPlanFieldDescriptors);
}

export async function translateInvoiceFromEnglish(invoice, targetLang, translateEntries, timestamp) {
  return translateSection(invoice, targetLang, translateEntries, timestamp, collectInvoiceFieldDescriptors);
}
