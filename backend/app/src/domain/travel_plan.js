import { normalizeText } from "../lib/text.js";
import {
  TRAVEL_PLAN_SERVICE_KIND_VALUES,
  TRAVEL_PLAN_TIMING_KIND_VALUES
} from "../lib/generated_catalogs.js";
import { normalizeExperienceHighlightIds } from "./tour_metadata.js";
import { normalizeTravelPlanTranslationMeta } from "./booking_translation.js";
import {
  normalizeBookingContentLang,
  normalizeStoredLocalizedTextField
} from "./booking_content_i18n.js";

const TRAVEL_PLAN_SERVICE_KINDS = new Set(TRAVEL_PLAN_SERVICE_KIND_VALUES);
const TRAVEL_PLAN_TIMING_KINDS = new Set(TRAVEL_PLAN_TIMING_KIND_VALUES);
const ONE_PAGER_SMALL_IMAGE_LIMIT = 4;
const TRAVEL_PLAN_BOUNDARY_KINDS = new Set(["arrival", "departure"]);

function cloneJson(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function stripLocalizedStorageFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripLocalizedStorageFields(item));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.endsWith("_i18n") && key !== "translation_meta")
      .map(([key, item]) => [key, stripLocalizedStorageFields(item)])
  );
}

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeOptionalBoolean(value, fallback = null) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function normalizeTravelPlanServiceImageSourceAttribution(rawAttribution) {
  const source = rawAttribution && typeof rawAttribution === "object" && !Array.isArray(rawAttribution)
    ? rawAttribution
    : {};
  const normalized = {
    source_name: normalizeOptionalText(source.source_name),
    source_url: normalizeOptionalText(source.source_url),
    photographer: normalizeOptionalText(source.photographer),
    license: normalizeOptionalText(source.license)
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeTravelPlanServiceImageFocalPoint(rawFocalPoint) {
  const source = rawFocalPoint && typeof rawFocalPoint === "object" && !Array.isArray(rawFocalPoint)
    ? rawFocalPoint
    : {};
  const x = Number(source.x);
  const y = Number(source.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }
  return { x, y };
}

function resolveRawTravelPlanServiceImage(rawImageOrImages) {
  if (Array.isArray(rawImageOrImages)) {
    const normalized = rawImageOrImages
      .map((image, imageIndex) => {
        const rawImage = image && typeof image === "object" && !Array.isArray(image) ? image : {};
        return {
          rawImage,
          sort_order: normalizeNonNegativeInt(rawImage.sort_order, imageIndex),
          is_primary: normalizeOptionalBoolean(rawImage.is_primary, false) === true,
          is_customer_visible: normalizeOptionalBoolean(rawImage.is_customer_visible, true)
        };
      })
      .filter((entry) => normalizeOptionalText(entry.rawImage.storage_path))
      .sort((left, right) => left.sort_order - right.sort_order);
    return (
      normalized.find((entry) => entry.is_primary)?.rawImage
      || normalized.find((entry) => entry.is_customer_visible !== false)?.rawImage
      || normalized[0]?.rawImage
      || null
    );
  }
  return rawImageOrImages && typeof rawImageOrImages === "object" && !Array.isArray(rawImageOrImages)
    ? rawImageOrImages
    : null;
}

function normalizeTravelPlanServiceImage(image, dayIndex, itemIndex, options = {}) {
  const rawImage = resolveRawTravelPlanServiceImage(image);
  if (!rawImage) return null;
  const storagePath = normalizeOptionalText(rawImage.storage_path);
  if (!storagePath) return null;
  const captionField = normalizeTravelPlanLocalizedField(rawImage.caption_i18n, rawImage.caption, options);
  const altTextField = normalizeTravelPlanLocalizedField(rawImage.alt_text_i18n, rawImage.alt_text, options);
  return {
    id: normalizeText(rawImage.id) || `travel_plan_service_image_${dayIndex + 1}_${itemIndex + 1}_1`,
    storage_path: storagePath,
    caption: captionField.text || null,
    caption_i18n: captionField.map,
    alt_text: altTextField.text || null,
    alt_text_i18n: altTextField.map,
    sort_order: 0,
    is_primary: true,
    is_customer_visible: normalizeOptionalBoolean(rawImage.is_customer_visible, true),
    include_in_travel_tour_card: normalizeOptionalBoolean(rawImage.include_in_travel_tour_card, false),
    width_px: normalizePositiveInt(rawImage.width_px, null),
    height_px: normalizePositiveInt(rawImage.height_px, null),
    source_attribution: normalizeTravelPlanServiceImageSourceAttribution(rawImage.source_attribution),
    focal_point: normalizeTravelPlanServiceImageFocalPoint(rawImage.focal_point),
    created_at: normalizeOptionalText(rawImage.created_at)
  };
}

function normalizeTravelPlanAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment, index) => {
      const rawAttachment = attachment && typeof attachment === "object" && !Array.isArray(attachment) ? attachment : {};
      return {
        id: normalizeText(rawAttachment.id) || `travel_plan_attachment_${index + 1}`,
        filename: normalizeOptionalText(rawAttachment.filename),
        storage_path: normalizeOptionalText(rawAttachment.storage_path),
        page_count: normalizePositiveInt(rawAttachment.page_count, null),
        sort_order: normalizeNonNegativeInt(rawAttachment.sort_order, index),
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

function normalizeItemKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_SERVICE_KINDS.has(normalized) ? normalized : "other";
}

function normalizeTimingKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_TIMING_KINDS.has(normalized) ? normalized : "label";
}

function buildDefaultTravelPlan() {
  return {
    tour_card_image_ids: [],
    boundary_logistics: {},
    days: []
  };
}

function buildDefaultBookingTravelPlan() {
  return {
    ...buildDefaultTravelPlan(),
    attachments: []
  };
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
      time_label: null,
      time_point,
      start_time: null,
      end_time: null
    };
  }
  if (timing_kind === "range") {
    return {
      timing_kind,
      time_label: null,
      time_point: null,
      start_time,
      end_time
    };
  }
  if (timing_kind === "not_applicable") {
    return {
      timing_kind,
      time_label: null,
      time_point: null,
      start_time: null,
      end_time: null
    };
  }
  return {
    timing_kind,
    time_label,
    time_point: null,
    start_time: null,
    end_time: null
  };
}

function normalizeTravelPlanLocalizedField(mapValue, plainValue, options = {}) {
  const sourceLang = normalizeBookingContentLang(options?.sourceLang || "en");
  const flatLang = normalizeBookingContentLang(options?.flatLang || sourceLang);
  const contentLang = normalizeBookingContentLang(options?.contentLang || sourceLang);
  const flatMode = options?.flatMode === "localized" ? "localized" : "source";
  return normalizeStoredLocalizedTextField(options?.ignoreLocalizedFields === true ? {} : mapValue, plainValue, {
    sourceLang,
    flatLang,
    fallbackLang: contentLang,
    flatMode,
    hydrateSourceIntoMap: options?.hydrateSourceIntoLocalizedMaps === true
  });
}

function normalizeTravelPlanService(rawItem, {
  dayIndex = 0,
  itemIndex = 0,
  defaultId = "",
  contentLang = "en",
  flatLang = "en",
  sourceLang = "en",
  flatMode = "source",
  hydrateSourceIntoLocalizedMaps = false
} = {}) {
  const item = rawItem && typeof rawItem === "object" && !Array.isArray(rawItem) ? rawItem : {};
  const timing = normalizeItemTiming(item);
  const fieldOptions = {
    contentLang,
    flatLang,
    sourceLang,
    flatMode,
    hydrateSourceIntoLocalizedMaps
  };
  const timeLabelField = normalizeTravelPlanLocalizedField(item?.time_label_i18n, timing.time_label, fieldOptions);
  const titleField = normalizeTravelPlanLocalizedField(item?.title_i18n, item?.title, fieldOptions);
  const detailsField = normalizeTravelPlanLocalizedField(item?.details_i18n, item?.details, fieldOptions);
  const imageSubtitleField = normalizeTravelPlanLocalizedField(rawItem?.image_subtitle_i18n, rawItem?.image_subtitle, fieldOptions);
  return {
    id: normalizeText(item.id) || normalizeText(defaultId) || `travel_plan_service_${dayIndex + 1}_${itemIndex + 1}`,
    timing_kind: timing.timing_kind,
    time_label: timing.timing_kind === "label" ? (timeLabelField.text || null) : null,
    time_label_i18n: timeLabelField.map,
    time_point: timing.time_point,
    kind: normalizeItemKind(item.kind),
    title: titleField.text,
    title_i18n: titleField.map,
    details: detailsField.text || null,
    details_i18n: detailsField.map,
    image_subtitle: imageSubtitleField.text || null,
    image_subtitle_i18n: imageSubtitleField.map,
    start_time: timing.start_time,
    end_time: timing.end_time,
    image: normalizeTravelPlanServiceImage(item.image ?? item.images, dayIndex, itemIndex, fieldOptions)
  };
}

function normalizeBoundaryKind(value, fallback = "") {
  const normalized = normalizeText(value || fallback).toLowerCase();
  return TRAVEL_PLAN_BOUNDARY_KINDS.has(normalized) ? normalized : fallback;
}

function defaultBoundaryAttachTo(boundaryKind) {
  return boundaryKind === "departure" ? "last_day" : "first_day";
}

function defaultBoundaryPosition(boundaryKind) {
  return boundaryKind === "departure" ? "end" : "start";
}

function normalizeBoundaryAttachTo(value, boundaryKind) {
  const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
  const normalized = normalizeText(value).toLowerCase();
  if (normalizedBoundaryKind === "departure") {
    return normalized === "after_last_day" ? "after_last_day" : "last_day";
  }
  return normalized === "before_first_day" ? "before_first_day" : "first_day";
}

function normalizeTravelPlanBoundaryPresentation(value, boundaryKind) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalizedBoundaryKind = normalizeBoundaryKind(boundaryKind);
  const attachTo = normalizeText(source.attach_to);
  const position = normalizeText(source.position);
  return {
    attach_to: attachTo ? normalizeBoundaryAttachTo(attachTo, normalizedBoundaryKind) : defaultBoundaryAttachTo(normalizedBoundaryKind),
    position: position === "end" || position === "start" ? position : defaultBoundaryPosition(normalizedBoundaryKind)
  };
}

function normalizeBoundaryTimeValue(value) {
  const raw = normalizeOptionalText(value);
  const dateTimeMatch = raw.match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2})/);
  return dateTimeMatch ? dateTimeMatch[1] : raw;
}

function normalizeTravelPlanBoundaryService(rawService, boundaryKind, options = {}) {
  const source = rawService && typeof rawService === "object" && !Array.isArray(rawService)
    ? rawService
    : null;
  const normalizedBoundaryKind = normalizeBoundaryKind(source?.boundary_kind, boundaryKind);
  if (!source || !normalizedBoundaryKind) return null;
  const service = normalizeTravelPlanService({
    ...source,
    kind: normalizeText(source.kind) || "transport"
  }, {
    ...options,
    dayIndex: 0,
    itemIndex: normalizedBoundaryKind === "departure" ? 1 : 0,
    defaultId: `travel_plan_boundary_${normalizedBoundaryKind}`
  });
  return {
    ...service,
    boundary_kind: normalizedBoundaryKind,
    enabled: source.enabled === false ? false : true,
    time_point: service.timing_kind === "point" ? normalizeBoundaryTimeValue(service.time_point) : null,
    start_time: service.timing_kind === "range" ? normalizeBoundaryTimeValue(service.start_time) : null,
    end_time: service.timing_kind === "range" ? normalizeBoundaryTimeValue(service.end_time) : null,
    kind: normalizeItemKind(source.kind || "transport"),
    airport_code: normalizeOptionalText(source.airport_code),
    from_label: normalizeOptionalText(source.from_label),
    to_label: normalizeOptionalText(source.to_label),
    presentation: normalizeTravelPlanBoundaryPresentation(source.presentation, normalizedBoundaryKind)
  };
}

function normalizeTravelPlanBoundaryLogistics(value, options = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const arrival = normalizeTravelPlanBoundaryService(source.arrival, "arrival", options);
  const departure = normalizeTravelPlanBoundaryService(source.departure, "departure", options);
  return {
    ...(arrival ? { arrival } : {}),
    ...(departure ? { departure } : {})
  };
}

function normalizeTravelPlanDays(days, options = {}) {
  const sourceDays = Array.isArray(days) ? days : [];
  const contentLang = normalizeBookingContentLang(options?.contentLang || options?.lang || "en");
  const flatLang = normalizeBookingContentLang(options?.flatLang || options?.lang || "en");
  const sourceLang = normalizeBookingContentLang(options?.sourceLang || contentLang);
  const flatMode = options?.flatMode === "localized" ? "localized" : "source";
  return [...sourceDays]
    .map((day, index) => ({
      raw: day && typeof day === "object" && !Array.isArray(day) ? day : {},
      sort_day_number: normalizePositiveInt(day?.day_number, index + 1),
      sort_index: index
    }))
    .sort((left, right) => {
      if (left.sort_day_number !== right.sort_day_number) return left.sort_day_number - right.sort_day_number;
      return left.sort_index - right.sort_index;
    })
    .map((entry, dayIndex) => {
      const day = entry.raw;
      const services = (
        Array.isArray(day?.services)
          ? day.services
          : (Array.isArray(day?.items) ? day.items : [])
      ).map((item, itemIndex) => (
        normalizeTravelPlanService(item, {
          dayIndex,
          itemIndex,
          contentLang,
          flatLang,
          sourceLang,
          flatMode,
          hydrateSourceIntoLocalizedMaps: options?.hydrateSourceIntoLocalizedMaps === true
        })
      ));

      const titleField = normalizeTravelPlanLocalizedField(day?.title_i18n, day?.title, {
        contentLang,
        flatLang,
        sourceLang,
        flatMode,
        hydrateSourceIntoLocalizedMaps: options?.hydrateSourceIntoLocalizedMaps === true
      });
      const notesField = normalizeTravelPlanLocalizedField(day?.notes_i18n, day?.notes, {
        contentLang,
        flatLang,
        sourceLang,
        flatMode,
        hydrateSourceIntoLocalizedMaps: options?.hydrateSourceIntoLocalizedMaps === true
      });
      const normalizedDate = normalizeOptionalText(day.date);

      return {
        id: normalizeText(day.id) || `travel_plan_day_${dayIndex + 1}`,
        day_number: dayIndex + 1,
        date: normalizedDate,
        date_string: normalizedDate ? null : normalizeOptionalText(day?.date_string),
        title: titleField.text,
        title_i18n: titleField.map,
        primary_location_id: normalizeOptionalText(day?.primary_location_id) || null,
        secondary_location_id: normalizeOptionalText(day?.secondary_location_id) || null,
        experience_highlight_ids: normalizeExperienceHighlightIds(day?.experience_highlight_ids, { limit: 1 }),
        services,
        notes: notesField.text || null,
        notes_i18n: notesField.map
      };
    });
}

function collectTravelPlanTourCardImageIds(days) {
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

function normalizeTravelPlanTourCardImageIds(source, days) {
  const availableIds = new Set(collectTravelPlanTourCardImageIds(days));
  const hasExplicitImageIds = Object.prototype.hasOwnProperty.call(source || {}, "tour_card_image_ids");
  const requestedIds = Array.isArray(source?.tour_card_image_ids)
    ? source.tour_card_image_ids
    : [];
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

function normalizeTravelPlanImageIdList(values, days) {
  const availableIds = new Set(collectTravelPlanTourCardImageIds(days));
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeOptionalText(value))
    .filter((value, index, list) => value && list.indexOf(value) === index && availableIds.has(value));
}

function normalizeTravelPlanOnePagerHeroImageId(source, days) {
  const heroImageId = normalizeOptionalText(source?.one_pager_hero_image_id);
  if (!heroImageId) return "";
  return collectTravelPlanTourCardImageIds(days).includes(heroImageId) ? heroImageId : "";
}

function applyTravelPlanTourCardImageSelection(days, selectedIds) {
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

function boundaryServiceHasPresentationContent(service) {
  if (!service || typeof service !== "object" || Array.isArray(service)) return false;
  return [
    service.time_label,
    service.time_point,
    service.start_time,
    service.end_time,
    service.title,
    service.details,
    service.image_subtitle,
    service.airport_code,
    service.from_label,
    service.to_label
  ].some((value) => Boolean(normalizeText(value)))
    || Object.values(service.title_i18n || {}).some((value) => Boolean(normalizeText(value)))
    || Object.values(service.details_i18n || {}).some((value) => Boolean(normalizeText(value)))
    || Object.values(service.time_label_i18n || {}).some((value) => Boolean(normalizeText(value)))
    || Boolean(service.image && typeof service.image === "object" && normalizeText(service.image.storage_path));
}

function boundaryServiceTargetAlreadyContains(day, boundaryService, boundaryKind) {
  const boundaryId = normalizeText(boundaryService?.id);
  const services = Array.isArray(day?.services) ? day.services : [];
  return services.some((service) => {
    if (!service || typeof service !== "object" || Array.isArray(service)) return false;
    return normalizeText(service.boundary_kind) === boundaryKind
      || (boundaryId && normalizeText(service.copied_from_boundary_id) === boundaryId)
      || (boundaryId && normalizeText(service.id) === boundaryId);
  });
}

function boundaryAlreadyComposedIntoDays(days, boundaryService, boundaryKind) {
  return (Array.isArray(days) ? days : []).some((day) => (
    boundaryServiceTargetAlreadyContains(day, boundaryService, boundaryKind)
  ));
}

function presentationBoundaryService(service, boundaryKind) {
  const source = service && typeof service === "object" && !Array.isArray(service) ? service : {};
  const sourceId = normalizeText(source.id) || `travel_plan_boundary_${boundaryKind}`;
  return {
    ...cloneJson(source, {}),
    id: sourceId,
    kind: normalizeItemKind(source.kind || "transport"),
    boundary_kind: boundaryKind,
    copied_from_boundary_id: sourceId,
    _presentation_source: "boundary_logistics"
  };
}

function isIsoCalendarDate(value) {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function shiftIsoCalendarDate(value, dayOffset) {
  if (!isIsoCalendarDate(value)) return "";
  const [year, month, day] = normalizeText(value).split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
  return [
    String(candidate.getUTCFullYear()).padStart(4, "0"),
    String(candidate.getUTCMonth() + 1).padStart(2, "0"),
    String(candidate.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function normalizedDayDateFields(day) {
  const date = normalizeOptionalText(day?.date);
  return {
    date,
    date_string: date ? null : normalizeOptionalText(day?.date_string)
  };
}

function deriveBoundaryPresentationDateFields(boundaryKind, attachTo, days) {
  const itineraryDays = Array.isArray(days) ? days : [];
  const adjacentDay = boundaryKind === "departure"
    ? itineraryDays[itineraryDays.length - 1]
    : itineraryDays[0];
  if (!adjacentDay) return {};

  const sameDay = boundaryKind === "departure"
    ? attachTo !== "after_last_day"
    : attachTo !== "before_first_day";
  if (sameDay) return normalizedDayDateFields(adjacentDay);

  const adjacentDate = normalizeOptionalText(adjacentDay.date);
  const shiftedDate = boundaryKind === "departure"
    ? shiftIsoCalendarDate(adjacentDate, 1)
    : shiftIsoCalendarDate(adjacentDate, -1);
  return shiftedDate
    ? { date: shiftedDate, date_string: null }
    : {
        date: null,
        date_string: boundaryKind === "departure" ? "after_trip" : "before_trip"
      };
}

function presentationBoundaryDay(boundaryService, boundaryKind, dayNumber, options = {}) {
  const source = boundaryService && typeof boundaryService === "object" && !Array.isArray(boundaryService)
    ? boundaryService
    : {};
  const fallbackTitle = boundaryKind === "departure" ? "Departure" : "Arrival";
  const outsideDayNumbering = options?.outsideDayNumbering === true;
  const boundaryDateFields = options?.dateFields && typeof options.dateFields === "object" && !Array.isArray(options.dateFields)
    ? normalizedDayDateFields(options.dateFields)
    : {};
  return {
    id: `travel_plan_boundary_${boundaryKind}_day`,
    day_number: outsideDayNumbering ? null : dayNumber,
    boundary_kind: boundaryKind,
    ...boundaryDateFields,
    title: outsideDayNumbering ? null : (normalizeOptionalText(source.title) || fallbackTitle),
    title_i18n: source.title_i18n && typeof source.title_i18n === "object" && !Array.isArray(source.title_i18n)
      ? { ...source.title_i18n }
      : {},
    services: [presentationBoundaryService(boundaryService, boundaryKind)],
    notes: null,
    notes_i18n: {},
    ...(outsideDayNumbering ? { _presentation_boundary_day: true } : {}),
    _presentation_source: "boundary_logistics"
  };
}

function renumberPresentationDays(days) {
  return (Array.isArray(days) ? days : []).map((day, index) => ({
    ...day,
    day_number: index + 1
  }));
}

function composeBoundaryIntoDays(days, boundaryService, boundaryKind) {
  if (!Array.isArray(days)) return days;
  if (!boundaryService || boundaryService.enabled === false || !boundaryServiceHasPresentationContent(boundaryService)) {
    return days;
  }
  if (boundaryAlreadyComposedIntoDays(days, boundaryService, boundaryKind)) return renumberPresentationDays(days);
  const attachTo = normalizeTravelPlanBoundaryPresentation(boundaryService.presentation, boundaryKind).attach_to;
  if (boundaryKind === "arrival" && attachTo === "before_first_day") {
    return renumberPresentationDays([
      presentationBoundaryDay(boundaryService, boundaryKind, 1, {
        dateFields: deriveBoundaryPresentationDateFields(boundaryKind, attachTo, days)
      }),
      ...days
    ]);
  }
  if (boundaryKind === "departure" && attachTo === "after_last_day") {
    return renumberPresentationDays([
      ...days,
      presentationBoundaryDay(boundaryService, boundaryKind, days.length + 1, {
        dateFields: deriveBoundaryPresentationDateFields(boundaryKind, attachTo, days)
      })
    ]);
  }
  if (!days.length) return days;
  const targetIndex = boundaryKind === "departure" ? days.length - 1 : 0;
  const targetDay = days[targetIndex];
  if (boundaryServiceTargetAlreadyContains(targetDay, boundaryService, boundaryKind)) return days;
  const presentationService = presentationBoundaryService(boundaryService, boundaryKind);
  return days.map((day, index) => {
    if (index !== targetIndex) return day;
    const services = Array.isArray(day?.services) ? day.services : [];
    return {
      ...day,
      services: boundaryKind === "departure"
        ? [...services, presentationService]
        : [presentationService, ...services]
    };
  });
}

function removeBoundaryFromDays(days, boundaryService, boundaryKind) {
  if (!Array.isArray(days)) return [];
  return days.map((day) => {
    const services = Array.isArray(day?.services) ? day.services : [];
    return {
      ...day,
      services: services.filter((service) => !boundaryServiceTargetAlreadyContains({ services: [service] }, boundaryService, boundaryKind))
    };
  });
}

function composeBoundaryOutsideDays(days, boundaries) {
  let itineraryDays = Array.isArray(days) ? days : [];
  const arrival = boundaries?.arrival;
  const departure = boundaries?.departure;
  const hasArrival = arrival && arrival.enabled !== false && boundaryServiceHasPresentationContent(arrival);
  const hasDeparture = departure && departure.enabled !== false && boundaryServiceHasPresentationContent(departure);
  if (hasArrival) {
    itineraryDays = removeBoundaryFromDays(itineraryDays, arrival, "arrival");
  }
  if (hasDeparture) {
    itineraryDays = removeBoundaryFromDays(itineraryDays, departure, "departure");
  }
  const arrivalAttachTo = normalizeTravelPlanBoundaryPresentation(arrival?.presentation, "arrival").attach_to;
  const departureAttachTo = normalizeTravelPlanBoundaryPresentation(departure?.presentation, "departure").attach_to;
  return [
    ...(hasArrival ? [presentationBoundaryDay(arrival, "arrival", null, {
      outsideDayNumbering: true,
      dateFields: deriveBoundaryPresentationDateFields("arrival", arrivalAttachTo, itineraryDays)
    })] : []),
    ...itineraryDays,
    ...(hasDeparture ? [presentationBoundaryDay(departure, "departure", null, {
      outsideDayNumbering: true,
      dateFields: deriveBoundaryPresentationDateFields("departure", departureAttachTo, itineraryDays)
    })] : [])
  ];
}

function composeTravelPlanForPresentation(rawTravelPlan, options = {}) {
  if (options?.includeBoundaryLogistics === false) {
    return cloneJson(rawTravelPlan, { days: [] });
  }
  const source = rawTravelPlan && typeof rawTravelPlan === "object" && !Array.isArray(rawTravelPlan)
    ? rawTravelPlan
    : { days: [] };
  let days = (Array.isArray(source.days) ? source.days : []).map((day) => ({
    ...cloneJson(day, {}),
    services: (Array.isArray(day?.services) ? day.services : (Array.isArray(day?.items) ? day.items : []))
      .map((service) => cloneJson(service, {}))
  }));
  const boundaries = source.boundary_logistics && typeof source.boundary_logistics === "object" && !Array.isArray(source.boundary_logistics)
    ? source.boundary_logistics
    : {};
  if (options?.boundaryLogisticsPlacement === "outside_days") {
    days = composeBoundaryOutsideDays(days, boundaries);
  } else {
    days = composeBoundaryIntoDays(days, boundaries.arrival, "arrival");
    days = composeBoundaryIntoDays(days, boundaries.departure, "departure");
  }
  return {
    ...cloneJson(source, {}),
    days
  };
}

export function createTravelPlanHelpers() {
  function defaultBookingTravelPlan() {
    return buildDefaultBookingTravelPlan();
  }

  function stripBookingOnlyFieldsFromTravelPlanDay(day) {
    const source = day && typeof day === "object" && !Array.isArray(day) ? day : {};
    const { date, date_string, ...baseDay } = source;
    delete baseDay.copied_from;
    return {
      ...baseDay,
      services: (Array.isArray(source.services) ? source.services : []).map((service) => {
        const serviceSource = service && typeof service === "object" && !Array.isArray(service) ? service : {};
        const { ...baseService } = serviceSource;
        delete baseService.copied_from;
        return baseService;
      })
    };
  }

  function normalizeTravelPlan(rawTravelPlan, options = {}) {
    const rawSource = rawTravelPlan && typeof rawTravelPlan === "object" && !Array.isArray(rawTravelPlan)
      ? rawTravelPlan
      : {};
    const source = options?.ignoreLocalizedFields === true
      ? stripLocalizedStorageFields(rawSource)
      : rawSource;
    const flatMode = options?.flatMode === "localized" ? "localized" : "source";
    const boundary_logistics = normalizeTravelPlanBoundaryLogistics(source.boundary_logistics, {
      ...options,
      flatMode
    });
    const days = normalizeTravelPlanDays(source.days, {
      ...options,
      flatMode
    }).map((day) => stripBookingOnlyFieldsFromTravelPlanDay(day));
    const tour_card_image_ids = normalizeTravelPlanTourCardImageIds(source, days);
    const hasExplicitOnePagerImageIds = Object.prototype.hasOwnProperty.call(source || {}, "one_pager_image_ids");
    const one_pager_hero_image_id = normalizeTravelPlanOnePagerHeroImageId(source, days);
    const one_pager_image_ids = normalizeTravelPlanImageIdList(source.one_pager_image_ids, days)
      .filter((imageId) => imageId !== one_pager_hero_image_id)
      .slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
    const normalizedDays = applyTravelPlanTourCardImageSelection(days, tour_card_image_ids);
    return normalizeTravelPlanTranslationMeta({
      ...(tour_card_image_ids.length ? { tour_card_image_ids } : {}),
      ...(one_pager_hero_image_id ? { one_pager_hero_image_id } : {}),
      ...(hasExplicitOnePagerImageIds ? { one_pager_image_ids } : {}),
      ...(Object.keys(boundary_logistics).length ? { boundary_logistics } : {}),
      days: normalizedDays,
      translation_meta: source.translation_meta
    });
  }

  function normalizeMarketingTourTravelPlan(rawTravelPlan, options = {}) {
    const normalized = normalizeTravelPlan(rawTravelPlan, {
      ...options,
      ignoreLocalizedFields: true
    });
    return stripLocalizedStorageFields(normalized);
  }

  function normalizeBookingTravelPlan(rawTravelPlan, offer = null, options = {}) {
    const source = rawTravelPlan && typeof rawTravelPlan === "object" && !Array.isArray(rawTravelPlan)
      ? rawTravelPlan
      : {};
    const flatMode = options?.flatMode === "localized" ? "localized" : "source";
    const days = normalizeTravelPlanDays(source.days, {
      ...options,
      flatMode
    });
    const boundary_logistics = normalizeTravelPlanBoundaryLogistics(source.boundary_logistics, {
      ...options,
      flatMode
    });

    const tour_card_image_ids = normalizeTravelPlanTourCardImageIds(source, days);
    const hasExplicitOnePagerImageIds = Object.prototype.hasOwnProperty.call(source || {}, "one_pager_image_ids");
    const one_pager_hero_image_id = normalizeTravelPlanOnePagerHeroImageId(source, days);
    const one_pager_image_ids = normalizeTravelPlanImageIdList(source.one_pager_image_ids, days)
      .filter((imageId) => imageId !== one_pager_hero_image_id)
      .slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
    const normalizedDays = applyTravelPlanTourCardImageSelection(days, tour_card_image_ids);
    return normalizeTravelPlanTranslationMeta({
      ...(tour_card_image_ids.length ? { tour_card_image_ids } : {}),
      ...(one_pager_hero_image_id ? { one_pager_hero_image_id } : {}),
      ...(hasExplicitOnePagerImageIds ? { one_pager_image_ids } : {}),
      ...(Object.keys(boundary_logistics).length ? { boundary_logistics } : {}),
      days: normalizedDays,
      attachments: normalizeTravelPlanAttachments(source.attachments),
      translation_meta: source.translation_meta
    });
  }

  function validateBookingTravelPlanInput(rawTravelPlan, offer = null, options = {}) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, offer, { strictReferences: true });
    const dayIds = new Set();
    const itemIds = new Set();
    const imageIds = new Set();
    const attachmentIds = new Set();
    for (const day of normalized.days) {
      if (!normalizeText(day.id)) {
        return { ok: false, error: "Every travel-plan day needs an id." };
      }
      if (dayIds.has(day.id)) {
        return { ok: false, error: `Travel-plan day id ${day.id} is duplicated.` };
      }
      dayIds.add(day.id);
      for (const [itemIndex, item] of day.services.entries()) {
        const itemNumber = itemIndex + 1;
        if (!normalizeText(item.id)) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Service id is missing.` };
        }
        if (itemIds.has(item.id)) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Service id is duplicated.` };
        }
        itemIds.add(item.id);
        if (!TRAVEL_PLAN_TIMING_KINDS.has(item.timing_kind)) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Time information is invalid.` };
        }
        if (!TRAVEL_PLAN_SERVICE_KINDS.has(item.kind)) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Kind is invalid.` };
        }
        if (item.timing_kind === "point" && !normalizeText(item.time_point)) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Time point is required.` };
        }
        if (item.timing_kind === "range" && (!normalizeText(item.start_time) || !normalizeText(item.end_time))) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Start and end time are required.` };
        }
        const image = item.image && typeof item.image === "object" && !Array.isArray(item.image)
          ? item.image
          : null;
        if (image) {
          if (!normalizeText(image.id)) {
            return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Service image id is missing.` };
          }
          if (imageIds.has(image.id)) {
            return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Service image id is duplicated.` };
          }
          imageIds.add(image.id);
          if (!normalizeText(image.storage_path)) {
            return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Service image storage path is required.` };
          }
          if (image.is_primary === false) {
            return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: The service image must be primary.` };
          }
        }
      }
    }

    for (const [boundaryKind, boundaryService] of Object.entries(normalized.boundary_logistics || {})) {
      if (!TRAVEL_PLAN_BOUNDARY_KINDS.has(boundaryKind)) {
        return { ok: false, error: `Travel-plan boundary ${boundaryKind} is invalid.` };
      }
      if (!boundaryService || boundaryService.enabled === false) continue;
      if (!normalizeText(boundaryService.id)) {
        return { ok: false, error: `Travel-plan ${boundaryKind} service id is missing.` };
      }
      if (itemIds.has(boundaryService.id)) {
        return { ok: false, error: `Travel-plan ${boundaryKind} service id ${boundaryService.id} is duplicated.` };
      }
      itemIds.add(boundaryService.id);
      if (!TRAVEL_PLAN_TIMING_KINDS.has(boundaryService.timing_kind)) {
        return { ok: false, error: `Travel-plan ${boundaryKind} time information is invalid.` };
      }
      if (!TRAVEL_PLAN_SERVICE_KINDS.has(boundaryService.kind)) {
        return { ok: false, error: `Travel-plan ${boundaryKind} kind is invalid.` };
      }
      if (boundaryService.timing_kind === "point" && !normalizeText(boundaryService.time_point)) {
        return { ok: false, error: `Travel-plan ${boundaryKind}: Time point is required.` };
      }
      if (boundaryService.timing_kind === "range" && (!normalizeText(boundaryService.start_time) || !normalizeText(boundaryService.end_time))) {
        return { ok: false, error: `Travel-plan ${boundaryKind}: Start and end time are required.` };
      }
      const image = boundaryService.image && typeof boundaryService.image === "object" && !Array.isArray(boundaryService.image)
        ? boundaryService.image
        : null;
      if (image) {
        if (!normalizeText(image.id)) {
          return { ok: false, error: `Travel-plan ${boundaryKind}: Service image id is missing.` };
        }
        if (imageIds.has(image.id)) {
          return { ok: false, error: `Travel-plan ${boundaryKind}: Service image id is duplicated.` };
        }
        imageIds.add(image.id);
        if (!normalizeText(image.storage_path)) {
          return { ok: false, error: `Travel-plan ${boundaryKind}: Service image storage path is required.` };
        }
        if (image.is_primary === false) {
          return { ok: false, error: `Travel-plan ${boundaryKind}: The service image must be primary.` };
        }
      }
    }

    for (const attachment of Array.isArray(normalized.attachments) ? normalized.attachments : []) {
      if (!normalizeText(attachment.id)) {
        return { ok: false, error: "Every travel-plan attachment needs an id." };
      }
      if (attachmentIds.has(attachment.id)) {
        return { ok: false, error: `Travel-plan attachment id ${attachment.id} is duplicated.` };
      }
      attachmentIds.add(attachment.id);
      if (!normalizeText(attachment.filename)) {
        return { ok: false, error: `Travel-plan attachment ${attachment.id} is missing a filename.` };
      }
      if (!normalizeText(attachment.storage_path)) {
        return { ok: false, error: `Travel-plan attachment ${attachment.id} is missing a storage path.` };
      }
      if (!(Number.isInteger(attachment.page_count) && attachment.page_count > 0)) {
        return { ok: false, error: `Travel-plan attachment ${attachment.id} has an invalid page count.` };
      }
    }

    return { ok: true, travel_plan: normalized };
  }

  function validateMarketingTourTravelPlanInput(rawTravelPlan, options = {}) {
    const normalized = normalizeMarketingTourTravelPlan(rawTravelPlan, options);
    const check = validateBookingTravelPlanInput({
      ...normalized,
      attachments: []
    }, null, options);
    if (!check.ok) return check;
    return {
      ok: true,
      travel_plan: normalized
    };
  }

  function buildBookingTravelPlanReadModel(rawTravelPlan, offer = null, options = {}) {
    return normalizeBookingTravelPlan(rawTravelPlan, offer, {
      ...options,
      strictReferences: false,
      flatMode: "localized",
      hydrateSourceIntoLocalizedMaps: true
    });
  }

  return {
    defaultBookingTravelPlan,
    normalizeTravelPlan,
    normalizeMarketingTourTravelPlan,
    normalizeBookingTravelPlan,
    composeTravelPlanForPresentation,
    validateMarketingTourTravelPlanInput,
    validateBookingTravelPlanInput,
    buildBookingTravelPlanReadModel
  };
}
