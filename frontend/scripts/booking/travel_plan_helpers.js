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
  buildDualLocalizedPayload,
  resolveLocalizedEditorBranchText,
  resolveLocalizedEditorText
} from "./localized_editor.js";

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

function normalizeItemImage(rawImageOrImages) {
  const rawImage = resolveRawItemImage(rawImageOrImages);
  if (!rawImage) return null;
  const storagePath = normalizeOptionalText(rawImage.storage_path);
  if (!storagePath) return null;
  return {
    id: String(rawImage.id || travelPlanId("travel_plan_service_image")),
    storage_path: storagePath,
    caption: normalizeOptionalText(rawImage.caption),
    alt_text: normalizeOptionalText(rawImage.alt_text),
    sort_order: 0,
    is_primary: true,
    is_customer_visible: rawImage.is_customer_visible !== false,
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

function normalizeCopiedFrom(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  if (!source) return null;
  const sourceBookingId = normalizeOptionalText(source.source_booking_id);
  const sourceItemId = normalizeOptionalText(source.source_service_id) || normalizeOptionalText(source.source_item_id);
  if (!sourceBookingId || !sourceItemId) return null;
  return {
    source_type: normalizeOptionalText(source.source_type) || "booking_travel_plan_service",
    source_booking_id: sourceBookingId,
    source_day_id: normalizeOptionalText(source.source_day_id),
    source_service_id: sourceItemId,
    copied_at: normalizeOptionalText(source.copied_at),
    copied_by_atp_staff_id: normalizeOptionalText(source.copied_by_atp_staff_id),
    import_batch_id: normalizeOptionalText(source.import_batch_id)
  };
}

function normalizeCopiedDayFrom(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : null;
  if (!source) return null;
  const sourceBookingId = normalizeOptionalText(source.source_booking_id);
  const sourceDayId = normalizeOptionalText(source.source_day_id);
  if (!sourceBookingId || !sourceDayId) return null;
  return {
    source_type: normalizeOptionalText(source.source_type) || "booking_travel_plan_day",
    source_booking_id: sourceBookingId,
    source_day_id: sourceDayId,
    copied_at: normalizeOptionalText(source.copied_at),
    copied_by_atp_staff_id: normalizeOptionalText(source.copied_by_atp_staff_id),
    import_batch_id: normalizeOptionalText(source.import_batch_id)
  };
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
    location: "",
    location_i18n: {},
    supplier_id: "",
    start_time: "",
    end_time: "",
    image: null,
    copied_from: null
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
    notes_i18n: {},
    copied_from: null
  };
}

export function createEmptyTravelPlan() {
  return {
    days: [],
    attachments: []
  };
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
      return {
        id: String(rawDay.id || travelPlanId("travel_plan_day")),
        day_number: dayIndex + 1,
        date: normalizedDate,
        date_string: normalizedDate ? "" : normalizeOptionalText(rawDay.date_string),
        title: resolveLocalizedEditorText(rawDay.title_i18n ?? rawDay.title, sourceLang, ""),
        title_i18n: buildDualLocalizedPayload(
          resolveLocalizedEditorText(rawDay.title_i18n ?? rawDay.title, sourceLang, ""),
          resolveLocalizedEditorBranchText(rawDay.title_i18n ?? rawDay.title, targetLang, ""),
          targetLang,
          sourceLang
        ).map,
        overnight_location: resolveLocalizedEditorText(rawDay.overnight_location_i18n ?? rawDay.overnight_location, sourceLang, ""),
        overnight_location_i18n: buildDualLocalizedPayload(
          resolveLocalizedEditorText(rawDay.overnight_location_i18n ?? rawDay.overnight_location, sourceLang, ""),
          resolveLocalizedEditorBranchText(rawDay.overnight_location_i18n ?? rawDay.overnight_location, targetLang, ""),
          targetLang,
          sourceLang
        ).map,
        services: (
          Array.isArray(rawDay.services)
            ? rawDay.services
            : (Array.isArray(rawDay.items) ? rawDay.items : [])
        ).map((item) => {
          const rawItem = item && typeof item === "object" ? item : {};
          const timing = normalizeItemTiming(rawItem);
          const timeLabelMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawItem.time_label_i18n ?? timing.time_label, sourceLang, ""),
            resolveLocalizedEditorBranchText(rawItem.time_label_i18n ?? timing.time_label, targetLang, ""),
            targetLang,
            sourceLang
          ).map;
          const titleMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawItem.title_i18n ?? rawItem.title, sourceLang, ""),
            resolveLocalizedEditorBranchText(rawItem.title_i18n ?? rawItem.title, targetLang, ""),
            targetLang,
            sourceLang
          ).map;
          const detailsMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawItem.details_i18n ?? rawItem.details, sourceLang, ""),
            resolveLocalizedEditorBranchText(rawItem.details_i18n ?? rawItem.details, targetLang, ""),
            targetLang,
            sourceLang
          ).map;
          const locationMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawItem.location_i18n ?? rawItem.location, sourceLang, ""),
            resolveLocalizedEditorBranchText(rawItem.location_i18n ?? rawItem.location, targetLang, ""),
            targetLang,
            sourceLang
          ).map;
          return {
            id: String(rawItem.id || travelPlanId("travel_plan_service")),
            timing_kind: timing.timing_kind,
            time_label: resolveLocalizedEditorText(timeLabelMap, sourceLang, ""),
            time_label_i18n: timeLabelMap,
            time_point: timing.time_point,
            kind: normalizeItemKind(rawItem.kind),
            title: resolveLocalizedEditorText(titleMap, sourceLang, ""),
            title_i18n: titleMap,
            details: resolveLocalizedEditorText(detailsMap, sourceLang, ""),
            details_i18n: detailsMap,
            image_subtitle: normalizeOptionalText(rawItem.image_subtitle),
            location: resolveLocalizedEditorText(locationMap, sourceLang, ""),
            location_i18n: locationMap,
            supplier_id: normalizeOptionalText(rawItem.supplier_id),
            start_time: timing.start_time,
            end_time: timing.end_time,
            image: normalizeItemImage(rawItem.image ?? rawItem.images),
            copied_from: normalizeCopiedFrom(rawItem.copied_from)
          };
        }),
        notes: resolveLocalizedEditorText(rawDay.notes_i18n ?? rawDay.notes, sourceLang, ""),
        notes_i18n: buildDualLocalizedPayload(
          resolveLocalizedEditorText(rawDay.notes_i18n ?? rawDay.notes, sourceLang, ""),
          resolveLocalizedEditorBranchText(rawDay.notes_i18n ?? rawDay.notes, targetLang, ""),
          targetLang,
          sourceLang
        ).map,
        copied_from: normalizeCopiedDayFrom(rawDay.copied_from)
      };
    });

  return {
    days,
    attachments: normalizeTravelPlanAttachments(source.attachments)
  };
}

export function countTravelPlanServices(plan) {
  return (Array.isArray(plan?.days) ? plan.days : []).reduce(
    (sum, day) => sum + (Array.isArray(day?.services) ? day.services.length : 0),
    0
  );
}
