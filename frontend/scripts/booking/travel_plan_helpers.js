import {
  TRAVEL_PLAN_SERVICE_KIND_OPTIONS,
  TRAVEL_PLAN_TIMING_KIND_OPTIONS as GENERATED_TRAVEL_PLAN_TIMING_KIND_OPTIONS
} from "../shared/generated_catalogs.js";
import {
  bookingSourceLang,
  bookingT,
  normalizeBookingContentLang,
  normalizeBookingSourceLang
} from "./i18n.js";
import {
  mergeDualLocalizedPayload,
  resolveLocalizedEditorBranchText,
  resolveLocalizedEditorText
} from "./localized_editor.js";
import {
  destinationScopeDestinations,
  normalizeDestinationScope
} from "../shared/destination_scope_editor.js";

const ONE_PAGER_SMALL_IMAGE_LIMIT = 4;
const ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT = 4;

export const TRAVEL_PLAN_TIMING_KIND_OPTIONS = Object.freeze(
  GENERATED_TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => ({
    ...option,
    label: bookingT(
      `booking.travel_plan.timing_kind.${option.value}`,
      option.value === "label"
        ? "Human readable"
        : option.value === "not_applicable"
          ? "Not applicable"
        : option.value === "point"
          ? "Point of time"
          : option.value === "range"
            ? "Time range"
            : option.label
    )
  }))
);

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

function normalizeDraftLocalizedPayload(source, field, sourceLang, targetLang) {
  const rawSource = source && typeof source === "object" ? source : {};
  const mapValue = rawSource[`${field}_i18n`];
  const hasPlainValue = hasOwnProperty(rawSource, field);
  const plainValue = hasPlainValue ? normalizeOptionalText(rawSource[field]) : "";
  const existingValue = mapValue ?? (hasPlainValue ? plainValue : "");
  const sourceValue = hasPlainValue
    ? plainValue
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

function normalizeTimingKind(value) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  return TRAVEL_PLAN_TIMING_KIND_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "label";
}

function normalizeItemTiming(rawItem) {
  const timing_kind = normalizeTimingKind(rawItem?.timing_kind);
  const time_label = normalizeOptionalText(rawItem?.time_label);
  const time_point = normalizeOptionalText(rawItem?.time_point);
  const start_time = normalizeOptionalText(rawItem?.start_time);
  const end_time = normalizeOptionalText(rawItem?.end_time);

  if (timing_kind === "point") {
    return {
      timing_kind,
      time_label: "",
      time_point,
      start_time: "",
      end_time: ""
    };
  }
  if (timing_kind === "range") {
    return {
      timing_kind,
      time_label: "",
      time_point: "",
      start_time,
      end_time
    };
  }
  if (timing_kind === "not_applicable") {
    return {
      timing_kind,
      time_label: "",
      time_point: "",
      start_time: "",
      end_time: ""
    };
  }
  return {
    timing_kind,
    time_label,
    time_point: "",
    start_time: "",
    end_time: ""
  };
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
    timing_kind: "label",
    time_label: "",
    time_label_i18n: {},
    time_point: "",
    kind: "other",
    title: "",
    title_i18n: {},
    details: "",
    details_i18n: {},
    image_subtitle: "",
    image_subtitle_i18n: {},
    location: "",
    location_i18n: {},
    start_time: "",
    end_time: "",
    image: null
  };
}

export function createEmptyTravelPlanDay(index = 0) {
  return {
    id: travelPlanId("travel_plan_day"),
    day_number: Math.max(1, Number(index) + 1),
    date: "",
    date_string: "",
    title: "",
    title_i18n: {},
    overnight_location: "",
    overnight_location_i18n: {},
    services: [],
    notes: "",
    notes_i18n: {}
  };
}

export function createEmptyTravelPlan() {
  return {
    destination_scope: [],
    destinations: [],
    tour_card_primary_image_id: null,
    tour_card_image_ids: [],
    one_pager_hero_image_id: null,
    one_pager_image_ids: [],
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
  if (hasExplicitImageIds) return selectedIds;
  const selectedImageId = normalizeOptionalText(source?.tour_card_primary_image_id);
  const selectedIndex = selectedImageId ? legacyIncludedIds.indexOf(selectedImageId) : -1;
  if (selectedIndex > 0) {
    const [selectedId] = legacyIncludedIds.splice(selectedIndex, 1);
    legacyIncludedIds.unshift(selectedId);
  }
  return legacyIncludedIds;
}

function normalizeAvailableImageIdList(values, days) {
  const availableIds = new Set(collectTourCardAvailableImageIds(days));
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeOptionalText(value))
    .filter((value, index, list) => value && list.indexOf(value) === index && availableIds.has(value));
}

function normalizeOnePagerExperienceHighlightIds(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .slice(0, ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT)
    .map((value) => {
      const id = normalizeOptionalText(value);
      if (!id || seen.has(id)) return "";
      seen.add(id);
      return id;
    });
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
      const overnightLocationField = normalizeDraftLocalizedPayload(rawDay, "overnight_location", sourceLang, targetLang);
      const notesField = normalizeDraftLocalizedPayload(rawDay, "notes", sourceLang, targetLang);
      return {
        id: String(rawDay.id || travelPlanId("travel_plan_day")),
        day_number: dayIndex + 1,
        date: normalizedDate,
        date_string: normalizedDate ? "" : normalizeOptionalText(rawDay.date_string),
        title: titleField.text,
        title_i18n: titleField.map,
        overnight_location: overnightLocationField.text,
        overnight_location_i18n: overnightLocationField.map,
        services: (
          Array.isArray(rawDay.services)
            ? rawDay.services
            : (Array.isArray(rawDay.items) ? rawDay.items : [])
        ).map((item) => {
          const rawItem = item && typeof item === "object" ? item : {};
          const timing = normalizeItemTiming(rawItem);
          const timeLabelField = normalizeDraftLocalizedPayload(rawItem, "time_label", sourceLang, targetLang);
          const titleField = normalizeDraftLocalizedPayload(rawItem, "title", sourceLang, targetLang);
          const detailsField = normalizeDraftLocalizedPayload(rawItem, "details", sourceLang, targetLang);
          const locationField = normalizeDraftLocalizedPayload(rawItem, "location", sourceLang, targetLang);
          const imageSubtitleField = normalizeDraftLocalizedPayload(rawItem, "image_subtitle", sourceLang, targetLang);
          return {
            id: String(rawItem.id || travelPlanId("travel_plan_service")),
            timing_kind: timing.timing_kind,
            time_label: timeLabelField.text,
            time_label_i18n: timeLabelField.map,
            time_point: timing.time_point,
            kind: normalizeItemKind(rawItem.kind),
            title: titleField.text,
            title_i18n: titleField.map,
            details: detailsField.text,
            details_i18n: detailsField.map,
            image_subtitle: imageSubtitleField.text,
            image_subtitle_i18n: imageSubtitleField.map,
            location: locationField.text,
            location_i18n: locationField.map,
            start_time: timing.start_time,
            end_time: timing.end_time,
            image: normalizeItemImage(rawItem.image ?? rawItem.images, sourceLang, targetLang)
          };
        }),
        notes: notesField.text,
        notes_i18n: notesField.map
      };
    });

  const destination_scope = normalizeDestinationScope(source.destination_scope);
  const tour_card_image_ids = normalizeTourCardImageIds(source, days);
  const one_pager_hero_image_id = normalizeOnePagerHeroImageId(source, days);
  const one_pager_image_ids = normalizeAvailableImageIdList(source.one_pager_image_ids, days)
    .filter((imageId) => imageId !== one_pager_hero_image_id)
    .slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
  const one_pager_experience_highlight_ids = normalizeOnePagerExperienceHighlightIds(source.one_pager_experience_highlight_ids);
  const normalized = {
    destination_scope,
    destinations: destinationScopeDestinations(destination_scope),
    tour_card_primary_image_id: tour_card_image_ids[0] || null,
    tour_card_image_ids,
    one_pager_hero_image_id: one_pager_hero_image_id || null,
    one_pager_image_ids,
    one_pager_experience_highlight_ids,
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
