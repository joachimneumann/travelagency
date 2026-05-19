import { TRAVEL_PLAN_SERVICE_KIND_OPTIONS } from "../shared/generated_catalogs.js";
import {
  bookingSourceLang,
  bookingT,
  normalizeBookingContentLang,
  normalizeBookingSourceLang
} from "./i18n.js";
import {
  mergeDualLocalizedPayload,
  normalizeLocalizedEditorMap,
  resolveLocalizedEditorBranchText,
  resolveLocalizedEditorText
} from "./localized_editor.js";

const ONE_PAGER_SMALL_IMAGE_LIMIT = 4;

function travelPlanId(prefix) {
  const safePrefix = String(prefix || "travel_plan").replace(/[^a-z0-9_]+/gi, "_").toLowerCase();
  if (globalThis.crypto?.randomUUID) {
    return `${safePrefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${safePrefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeOptionalText(value) {
  return String(value || "").trim();
}

const TRAVEL_PLAN_TRANSLATION_ORIGINS = Object.freeze(new Set(["manual", "machine"]));

function normalizeTranslationMetaOrigin(value) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  return TRAVEL_PLAN_TRANSLATION_ORIGINS.has(normalized) ? normalized : "manual";
}

function normalizeTranslationMetaKeys(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => normalizeOptionalText(entry))
        .filter(Boolean)
    )
  );
}

function normalizeTravelPlanTranslationMeta(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  for (const [lang, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const normalizedLang = normalizeBookingContentLang(lang);
    const manualKeys = normalizeTranslationMetaKeys(entry?.manual_keys);
    normalized[normalizedLang] = {
      source_lang: normalizeBookingContentLang(entry?.source_lang || "en"),
      source_hash: normalizeOptionalText(entry?.source_hash),
      origin: normalizeTranslationMetaOrigin(entry?.origin),
      updated_at: normalizeOptionalText(entry?.updated_at) || null,
      ...(manualKeys.length ? { manual_keys: manualKeys } : {})
    };
  }
  return normalized;
}

function hasOwnProperty(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeOptionalTextField(source, key) {
  const value = normalizeOptionalText(source?.[key]);
  return value ? { [key]: value } : {};
}

function normalizeOptionalBooleanField(source, key) {
  return hasOwnProperty(source, key) ? { [key]: source?.[key] !== false } : {};
}

function normalizeDraftLocalizedPayload(source, field, sourceLang, targetLang) {
  const rawSource = source && typeof source === "object" ? source : {};
  const mapValue = rawSource[`${field}_i18n`];
  const hasPlainValue = hasOwnProperty(rawSource, field);
  const plainValue = hasPlainValue ? normalizeOptionalText(rawSource[field]) : "";
  const existingValue = mapValue ?? (hasPlainValue ? plainValue : "");
  const normalizedMap = normalizeLocalizedEditorMap(mapValue, sourceLang);
  const sourceBranchValue = resolveLocalizedEditorBranchText(normalizedMap, sourceLang, "");
  const targetBranchValue = targetLang === sourceLang
    ? ""
    : resolveLocalizedEditorBranchText(normalizedMap, targetLang, "");
  const plainValueIsLocalizedReadModelText = targetLang !== sourceLang
    && !sourceBranchValue
    && Boolean(plainValue)
    && plainValue === targetBranchValue;
  const sourceValue = hasPlainValue
    ? (sourceBranchValue || (plainValueIsLocalizedReadModelText ? "" : plainValue))
    : resolveLocalizedEditorText(existingValue, sourceLang, "");
  const localizedValue = targetLang === sourceLang
    ? sourceValue
    : resolveLocalizedEditorBranchText(existingValue, targetLang, "");
  const merged = mergeDualLocalizedPayload(existingValue, sourceValue, localizedValue, targetLang, sourceLang);
  return {
    text: sourceValue,
    map: merged.map
  };
}

function normalizeItemKind(value) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  return TRAVEL_PLAN_SERVICE_KIND_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "other";
}

function resolveRawItemImage(rawImageOrImages) {
  if (rawImageOrImages && typeof rawImageOrImages === "object" && !Array.isArray(rawImageOrImages)) {
    return rawImageOrImages;
  }
  if (!Array.isArray(rawImageOrImages)) return null;
  const candidates = rawImageOrImages
    .map((image, index) => {
      const rawImage = image && typeof image === "object" ? image : {};
      return {
        rawImage,
        sort_order: Number.isInteger(rawImage.sort_order) ? rawImage.sort_order : index,
        is_primary: rawImage.is_primary === true,
        is_customer_visible: rawImage.is_customer_visible !== false
      };
    })
    .filter((entry) => normalizeOptionalText(entry.rawImage.storage_path))
    .sort((left, right) => left.sort_order - right.sort_order);
  return (
    candidates.find((entry) => entry.is_primary)?.rawImage
    || candidates.find((entry) => entry.is_customer_visible !== false)?.rawImage
    || candidates[0]?.rawImage
    || null
  );
}

function normalizeItemImage(rawImageOrImages, sourceLang, targetLang) {
  const rawImage = resolveRawItemImage(rawImageOrImages);
  if (!rawImage) return null;
  const storagePath = normalizeOptionalText(rawImage.storage_path);
  if (!storagePath) return null;
  const captionField = normalizeDraftLocalizedPayload(rawImage, "caption", sourceLang, targetLang);
  const altTextField = normalizeDraftLocalizedPayload(rawImage, "alt_text", sourceLang, targetLang);
  return {
    id: String(rawImage.id || travelPlanId("travel_plan_service_image")),
    storage_path: storagePath,
    caption: captionField.text,
    caption_i18n: captionField.map,
    alt_text: altTextField.text,
    alt_text_i18n: altTextField.map,
    sort_order: 0,
    is_primary: true,
    is_customer_visible: rawImage.is_customer_visible !== false,
    include_in_travel_tour_card: rawImage.include_in_travel_tour_card === true,
    width_px: Number.isInteger(rawImage.width_px) && rawImage.width_px > 0 ? rawImage.width_px : null,
    height_px: Number.isInteger(rawImage.height_px) && rawImage.height_px > 0 ? rawImage.height_px : null,
    source_attribution: rawImage.source_attribution && typeof rawImage.source_attribution === "object" && !Array.isArray(rawImage.source_attribution)
      ? {
        source_name: normalizeOptionalText(rawImage.source_attribution.source_name),
        source_url: normalizeOptionalText(rawImage.source_attribution.source_url),
        photographer: normalizeOptionalText(rawImage.source_attribution.photographer),
        license: normalizeOptionalText(rawImage.source_attribution.license)
      }
      : null,
    focal_point: rawImage.focal_point && typeof rawImage.focal_point === "object" && !Array.isArray(rawImage.focal_point)
      ? {
        x: Number.isFinite(Number(rawImage.focal_point.x)) ? Number(rawImage.focal_point.x) : null,
        y: Number.isFinite(Number(rawImage.focal_point.y)) ? Number(rawImage.focal_point.y) : null
      }
      : null,
    created_at: normalizeOptionalText(rawImage.created_at)
  };
}

function normalizeTravelPlanAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment, index) => {
      const rawAttachment = attachment && typeof attachment === "object" ? attachment : {};
      return {
        id: String(rawAttachment.id || travelPlanId("travel_plan_attachment")),
        filename: normalizeOptionalText(rawAttachment.filename),
        storage_path: normalizeOptionalText(rawAttachment.storage_path),
        page_count: Number.isInteger(rawAttachment.page_count) && rawAttachment.page_count > 0 ? rawAttachment.page_count : null,
        sort_order: Number.isInteger(rawAttachment.sort_order) ? rawAttachment.sort_order : index,
        created_at: normalizeOptionalText(rawAttachment.created_at)
      };
    })
    .filter((attachment) => attachment.filename && attachment.storage_path && attachment.page_count)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((attachment, index) => ({
      ...attachment,
      sort_order: index
    }));
}

export function createEmptyTravelPlanService() {
  return {
    id: travelPlanId("travel_plan_service"),
    time: "",
    time_i18n: {},
    kind: "other",
    title: "",
    title_i18n: {},
    details: "",
    details_i18n: {},
    image_subtitle: "",
    image_subtitle_i18n: {},
    image: null
  };
}

export function createEmptyTravelPlanBoundaryService(boundaryKind = "arrival") {
  const normalizedBoundaryKind = boundaryKind === "departure" ? "departure" : "arrival";
  return {
    ...createEmptyTravelPlanService(),
    id: travelPlanId(`travel_plan_boundary_${normalizedBoundaryKind}`),
    boundary_kind: normalizedBoundaryKind,
    enabled: false,
    kind: "transport",
    airport_code: "",
    from_label: "",
    to_label: "",
    presentation: {
      attach_to: normalizedBoundaryKind === "departure" ? "last_day" : "first_day",
      position: normalizedBoundaryKind === "departure" ? "end" : "start"
    }
  };
}

export function createEmptyTravelPlanDay(index = 0) {
  return {
    id: travelPlanId("travel_plan_day"),
    day_number: Math.max(1, Number(index) + 1),
    date: "",
    title: "",
    title_i18n: {},
    primary_location_id: "",
    secondary_location_id: "",
    experience_highlight_ids: [],
    services: [],
    notes: "",
    notes_i18n: {}
  };
}

export function createEmptyTravelPlan() {
  return {
    tour_card_image_ids: [],
    one_pager_hero_image_id: null,
    one_pager_image_ids: [],
    boundary_logistics: {},
    days: [],
    attachments: []
  };
}

function collectTourCardAvailableImageIds(days) {
  const imageIds = [];
  for (const day of Array.isArray(days) ? days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      const imageId = normalizeOptionalText(image?.id);
      if (imageId && image?.is_customer_visible !== false && normalizeOptionalText(image.storage_path)) {
        imageIds.push(imageId);
      }
    }
  }
  return imageIds;
}

function normalizeTourCardImageIds(source, days) {
  const availableIds = new Set(collectTourCardAvailableImageIds(days));
  const hasExplicitImageIds = hasOwnProperty(source, "tour_card_image_ids");
  const requestedIds = Array.isArray(source?.tour_card_image_ids) ? source.tour_card_image_ids : [];
  const selectedIds = requestedIds
    .map((value) => normalizeOptionalText(value))
    .filter((value, index, list) => value && list.indexOf(value) === index && availableIds.has(value));

  const legacyIncludedIds = [];
  for (const day of Array.isArray(days) ? days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      const imageId = normalizeOptionalText(image?.id);
      if (
        imageId
        && image.include_in_travel_tour_card === true
        && image.is_customer_visible !== false
        && normalizeOptionalText(image.storage_path)
      ) {
        legacyIncludedIds.push(imageId);
      }
    }
  }
  return hasExplicitImageIds ? selectedIds : legacyIncludedIds;
}

function normalizeAvailableImageIdList(values, days) {
  const availableIds = new Set(collectTourCardAvailableImageIds(days));
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeOptionalText(value))
    .filter((value, index, list) => value && list.indexOf(value) === index && availableIds.has(value));
}

function normalizeTravelPlanExperienceHighlightIds(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeOptionalText(value))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 1);
}

function normalizeBoundaryKind(value, fallback = "arrival") {
  const normalized = normalizeOptionalText(value || fallback).toLowerCase();
  return normalized === "departure" ? "departure" : "arrival";
}

function defaultBoundaryAttachTo(boundaryKind) {
  return boundaryKind === "departure" ? "last_day" : "first_day";
}

function defaultBoundaryPosition(boundaryKind) {
  return boundaryKind === "departure" ? "end" : "start";
}

function normalizeBoundaryAttachTo(value, boundaryKind) {
  const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
  const normalized = normalizeOptionalText(value).toLowerCase();
  if (normalizedBoundaryKind === "departure") {
    return normalized === "after_last_day" ? "after_last_day" : "last_day";
  }
  return normalized === "before_first_day" ? "before_first_day" : "first_day";
}

function normalizeBoundaryPresentation(value, boundaryKind) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
  const attachTo = normalizeOptionalText(source.attach_to);
  const position = normalizeOptionalText(source.position);
  return {
    attach_to: attachTo ? normalizeBoundaryAttachTo(attachTo, normalizedBoundaryKind) : defaultBoundaryAttachTo(normalizedBoundaryKind),
    position: position === "end" || position === "start"
      ? position
      : defaultBoundaryPosition(normalizedBoundaryKind)
  };
}

function normalizeTravelPlanServiceDraft(rawItem, sourceLang, targetLang, {
  fallbackIdPrefix = "travel_plan_service",
  fallbackKind = "other"
} = {}) {
  const rawItemSource = rawItem && typeof rawItem === "object" ? rawItem : {};
  const timeField = normalizeDraftLocalizedPayload(rawItemSource, "time", sourceLang, targetLang);
  const titleField = normalizeDraftLocalizedPayload(rawItemSource, "title", sourceLang, targetLang);
  const detailsField = normalizeDraftLocalizedPayload(rawItemSource, "details", sourceLang, targetLang);
  const imageSubtitleField = normalizeDraftLocalizedPayload(rawItem, "image_subtitle", sourceLang, targetLang);
  return {
    id: String(rawItemSource.id || travelPlanId(fallbackIdPrefix)),
    time: timeField.text,
    time_i18n: timeField.map,
    kind: normalizeItemKind(rawItemSource.kind || fallbackKind),
    title: titleField.text,
    title_i18n: titleField.map,
    details: detailsField.text,
    details_i18n: detailsField.map,
    image_subtitle: imageSubtitleField.text,
    image_subtitle_i18n: imageSubtitleField.map,
    image: normalizeItemImage(rawItemSource.image ?? rawItemSource.images, sourceLang, targetLang)
  };
}

function normalizeBoundaryService(rawService, boundaryKind, sourceLang, targetLang) {
  const source = rawService && typeof rawService === "object" && !Array.isArray(rawService)
    ? rawService
    : null;
  if (!source) return null;
  const normalizedBoundaryKind = normalizeBoundaryKind(source.boundary_kind, boundaryKind);
  const service = normalizeTravelPlanServiceDraft({
    ...source,
    kind: normalizeOptionalText(source.kind) || "transport"
  }, sourceLang, targetLang, {
    fallbackIdPrefix: `travel_plan_boundary_${normalizedBoundaryKind}`,
    fallbackKind: "transport"
  });
  return {
    ...service,
    boundary_kind: normalizedBoundaryKind,
    enabled: source.enabled === true,
    kind: normalizeItemKind(source.kind || "transport"),
    airport_code: normalizeOptionalText(source.airport_code),
    from_label: normalizeOptionalText(source.from_label),
    to_label: normalizeOptionalText(source.to_label),
    presentation: normalizeBoundaryPresentation(source.presentation, normalizedBoundaryKind)
  };
}

function normalizeBoundaryLogistics(source, sourceLang, targetLang) {
  const boundaryLogistics = source?.boundary_logistics && typeof source.boundary_logistics === "object" && !Array.isArray(source.boundary_logistics)
    ? source.boundary_logistics
    : {};
  const arrival = normalizeBoundaryService(boundaryLogistics.arrival, "arrival", sourceLang, targetLang);
  const departure = normalizeBoundaryService(boundaryLogistics.departure, "departure", sourceLang, targetLang);
  return {
    ...(arrival ? { arrival } : {}),
    ...(departure ? { departure } : {})
  };
}

function normalizeOnePagerHeroImageId(source, days) {
  const heroImageId = normalizeOptionalText(source?.one_pager_hero_image_id);
  if (!heroImageId) return "";
  return collectTourCardAvailableImageIds(days).includes(heroImageId) ? heroImageId : "";
}

function applyTourCardImageSelection(days, selectedIds) {
  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return (Array.isArray(days) ? days : []).map((day) => ({
    ...day,
    services: (Array.isArray(day?.services) ? day.services : []).map((service) => {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      if (!image) return service;
      return {
        ...service,
        image: {
          ...image,
          include_in_travel_tour_card: selectedSet.has(normalizeOptionalText(image.id))
        }
      };
    })
  }));
}

export function getTravelPlanServiceKindLabel(kind) {
  const option = TRAVEL_PLAN_SERVICE_KIND_OPTIONS.find((entry) => entry.value === kind);
  return bookingT(`booking.travel_plan.kind.${kind}`, option?.label || "Other");
}

export function normalizeTravelPlanDraft(plan, options = {}) {
  const source = plan && typeof plan === "object" ? plan : {};
  const normalizedOptions = options && typeof options === "object" ? options : {};
  const targetLang = normalizeBookingContentLang(
    normalizedOptions?.targetLang
    || normalizedOptions?.contentLang
    || String(window.__BOOKING_CONTENT_LANG || "en").trim()
    || "en"
  );
  const sourceLang = normalizeBookingSourceLang(
    normalizedOptions?.sourceLang
    || normalizedOptions?.editingLang
    || bookingSourceLang("en")
    || "en"
  );
  const days = (Array.isArray(source.days) ? source.days : [])
    .map((day, dayIndex) => {
      const rawDay = day && typeof day === "object" ? day : {};
      const normalizedDate = normalizeOptionalText(rawDay.date);
      const titleField = normalizeDraftLocalizedPayload(rawDay, "title", sourceLang, targetLang);
      const notesField = normalizeDraftLocalizedPayload(rawDay, "notes", sourceLang, targetLang);
      return {
        id: String(rawDay.id || travelPlanId("travel_plan_day")),
        day_number: dayIndex + 1,
        ...normalizeOptionalTextField(rawDay, "source_tour_id"),
        ...normalizeOptionalTextField(rawDay, "source_day_id"),
        ...normalizeOptionalTextField(rawDay, "source_tour_title"),
        ...normalizeOptionalTextField(rawDay, "source_day_title"),
        ...normalizeOptionalBooleanField(rawDay, "source_day_exists"),
        ...normalizeOptionalBooleanField(rawDay, "source_tour_published_on_webpage"),
        date: normalizedDate,
        title: titleField.text,
        title_i18n: titleField.map,
        primary_location_id: normalizeOptionalText(rawDay.primary_location_id),
        secondary_location_id: normalizeOptionalText(rawDay.secondary_location_id),
        experience_highlight_ids: normalizeTravelPlanExperienceHighlightIds(rawDay.experience_highlight_ids),
        services: (
          Array.isArray(rawDay.services)
            ? rawDay.services
            : (Array.isArray(rawDay.items) ? rawDay.items : [])
        ).map((item) => {
          return normalizeTravelPlanServiceDraft(item, sourceLang, targetLang);
        }),
        notes: notesField.text,
        notes_i18n: notesField.map
      };
    });

  const tour_card_image_ids = normalizeTourCardImageIds(source, days);
  const one_pager_hero_image_id = normalizeOnePagerHeroImageId(source, days);
  const one_pager_image_ids = normalizeAvailableImageIdList(source.one_pager_image_ids, days)
    .filter((imageId) => imageId !== one_pager_hero_image_id)
    .slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
  const normalized = {
    tour_card_image_ids,
    one_pager_hero_image_id: one_pager_hero_image_id || null,
    one_pager_image_ids,
    boundary_logistics: normalizeBoundaryLogistics(source, sourceLang, targetLang),
    days: applyTourCardImageSelection(days, tour_card_image_ids),
    attachments: normalizeTravelPlanAttachments(source.attachments)
  };
  if (hasOwnProperty(source, "translation_meta")) {
    normalized.translation_meta = normalizeTravelPlanTranslationMeta(source.translation_meta);
  }
  return normalized;
}

export function countTravelPlanServices(plan) {
  return (Array.isArray(plan?.days) ? plan.days : []).reduce(
    (sum, day) => sum + (Array.isArray(day?.services) ? day.services.length : 0),
    0
  );
}
