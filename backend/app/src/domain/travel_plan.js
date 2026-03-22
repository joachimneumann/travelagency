import { normalizeText } from "../lib/text.js";
import {
  TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_VALUES,
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_VALUES,
  TRAVEL_PLAN_ITEM_KIND_VALUES,
  TRAVEL_PLAN_TIMING_KIND_VALUES
} from "../lib/generated_catalogs.js";
import { normalizeTravelPlanTranslationMeta } from "./booking_translation.js";
import {
  normalizeBookingContentLang,
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "./booking_content_i18n.js";

const TRAVEL_PLAN_ITEM_KINDS = new Set(TRAVEL_PLAN_ITEM_KIND_VALUES);
const TRAVEL_PLAN_TIMING_KINDS = new Set(TRAVEL_PLAN_TIMING_KIND_VALUES);
const TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUSES = new Set(TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_VALUES);
const TRAVEL_PLAN_OFFER_COVERAGE_TYPES = new Set(TRAVEL_PLAN_OFFER_COVERAGE_TYPE_VALUES);

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

function normalizeTravelPlanItemImageSourceAttribution(rawAttribution) {
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

function normalizeTravelPlanItemImageFocalPoint(rawFocalPoint) {
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

function normalizeTravelPlanItemCopiedFrom(rawCopiedFrom) {
  const source = rawCopiedFrom && typeof rawCopiedFrom === "object" && !Array.isArray(rawCopiedFrom)
    ? rawCopiedFrom
    : {};
  const sourceBookingId = normalizeOptionalText(source.source_booking_id);
  const sourceItemId = normalizeOptionalText(source.source_item_id);
  if (!sourceBookingId || !sourceItemId) return null;
  return {
    source_type: "booking_travel_plan_item",
    source_booking_id: sourceBookingId,
    source_day_id: normalizeOptionalText(source.source_day_id),
    source_item_id: sourceItemId,
    copied_at: normalizeOptionalText(source.copied_at),
    copied_by_atp_staff_id: normalizeOptionalText(source.copied_by_atp_staff_id)
  };
}

function normalizeTravelPlanItemImages(images, dayIndex, itemIndex) {
  const sourceImages = Array.isArray(images) ? images : [];
  const normalized = sourceImages
    .map((image, imageIndex) => {
      const rawImage = image && typeof image === "object" && !Array.isArray(image) ? image : {};
      return {
        id: normalizeText(rawImage.id) || `travel_plan_item_image_${dayIndex + 1}_${itemIndex + 1}_${imageIndex + 1}`,
        storage_path: normalizeOptionalText(rawImage.storage_path),
        caption: normalizeOptionalText(rawImage.caption),
        alt_text: normalizeOptionalText(rawImage.alt_text),
        sort_order: normalizeNonNegativeInt(rawImage.sort_order, imageIndex),
        is_primary: normalizeOptionalBoolean(rawImage.is_primary, false) === true,
        is_customer_visible: normalizeOptionalBoolean(rawImage.is_customer_visible, true),
        width_px: normalizePositiveInt(rawImage.width_px, null),
        height_px: normalizePositiveInt(rawImage.height_px, null),
        source_attribution: normalizeTravelPlanItemImageSourceAttribution(rawImage.source_attribution),
        focal_point: normalizeTravelPlanItemImageFocalPoint(rawImage.focal_point),
        created_at: normalizeOptionalText(rawImage.created_at)
      };
    })
    .filter((image) => image.storage_path)
    .sort((left, right) => left.sort_order - right.sort_order);

  const primaryIndex = normalized.findIndex((image) => image.is_primary);
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : (normalized.length ? 0 : -1);

  return normalized.map((image, index) => ({
    ...image,
    sort_order: index,
    is_primary: index === resolvedPrimaryIndex
  }));
}

function normalizeItemKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_ITEM_KINDS.has(normalized) ? normalized : "other";
}

function normalizeTimingKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_TIMING_KINDS.has(normalized) ? normalized : "label";
}

function normalizeCoverageType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_OFFER_COVERAGE_TYPES.has(normalized) ? normalized : "full";
}

function normalizeAccommodationDays(value, kind) {
  if (normalizeItemKind(kind) !== "accommodation") return null;
  const raw = normalizeText(value);
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) return null;
  return parsed >= 1 && parsed <= 100 ? parsed : null;
}

function normalizeFinancialCoverageStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUSES.has(normalized) ? normalized : null;
}

function buildDefaultTravelPlan() {
  return {
    days: [],
    offer_component_links: []
  };
}

function buildDerivedCoverageStatus(kind, links) {
  if (!Array.isArray(links) || links.length === 0) {
    return kind === "free_time" ? "not_applicable" : "not_covered";
  }
  if (links.some((link) => link.coverage_type === "full")) {
    return "covered";
  }
  if (links.some((link) => link.coverage_type === "partial")) {
    return "partially_covered";
  }
  return kind === "free_time" ? "not_applicable" : "not_covered";
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
  return {
    timing_kind,
    time_label,
    time_point: null,
    start_time: null,
    end_time: null
  };
}

function normalizeTravelPlanDays(days, options = {}) {
  const sourceDays = Array.isArray(days) ? days : [];
  const contentLang = normalizeBookingContentLang(options?.contentLang || options?.lang || "en");
  const flatLang = normalizeBookingContentLang(options?.flatLang || options?.lang || "en");
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
      const items = (Array.isArray(day?.items) ? day.items : []).map((item, itemIndex) => {
        const rawItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
        const timing = normalizeItemTiming(rawItem);
        const time_label_i18n = normalizeLocalizedTextMap(rawItem?.time_label_i18n ?? timing.time_label, contentLang);
        const title_i18n = normalizeLocalizedTextMap(rawItem?.title_i18n ?? rawItem?.title, contentLang);
        const details_i18n = normalizeLocalizedTextMap(rawItem?.details_i18n ?? rawItem?.details, contentLang);
        const location_i18n = normalizeLocalizedTextMap(rawItem?.location_i18n ?? rawItem?.location, contentLang);
        const financial_note_i18n = normalizeLocalizedTextMap(
          rawItem?.financial_note_i18n ?? rawItem?.financial_note,
          contentLang
        );
        return {
          id: normalizeText(rawItem.id) || `travel_plan_item_${dayIndex + 1}_${itemIndex + 1}`,
          timing_kind: timing.timing_kind,
          time_label: timing.timing_kind === "label" ? (resolveLocalizedText(time_label_i18n, flatLang) || null) : null,
          time_label_i18n,
          time_point: timing.time_point,
          kind: normalizeItemKind(rawItem.kind),
          accommodation_days: normalizeAccommodationDays(rawItem.accommodation_days, rawItem.kind),
          title: resolveLocalizedText(title_i18n, flatLang),
          title_i18n,
          details: resolveLocalizedText(details_i18n, flatLang) || null,
          details_i18n,
          location: resolveLocalizedText(location_i18n, flatLang) || null,
          location_i18n,
          supplier_id: normalizeOptionalText(rawItem.supplier_id),
          start_time: timing.start_time,
          end_time: timing.end_time,
          financial_coverage_status: normalizeFinancialCoverageStatus(rawItem.financial_coverage_status),
          financial_note: resolveLocalizedText(financial_note_i18n, flatLang) || null,
          financial_note_i18n,
          images: normalizeTravelPlanItemImages(rawItem.images, dayIndex, itemIndex),
          copied_from: normalizeTravelPlanItemCopiedFrom(rawItem.copied_from)
        };
      });

      const title_i18n = normalizeLocalizedTextMap(day?.title_i18n ?? day?.title, contentLang);
      const overnight_location_i18n = normalizeLocalizedTextMap(
        day?.overnight_location_i18n ?? day?.overnight_location,
        contentLang
      );
      const notes_i18n = normalizeLocalizedTextMap(day?.notes_i18n ?? day?.notes, contentLang);

      return {
        id: normalizeText(day.id) || `travel_plan_day_${dayIndex + 1}`,
        day_number: dayIndex + 1,
        date: normalizeOptionalText(day.date),
        title: resolveLocalizedText(title_i18n, flatLang),
        title_i18n,
        overnight_location: resolveLocalizedText(overnight_location_i18n, flatLang) || null,
        overnight_location_i18n,
        items,
        notes: resolveLocalizedText(notes_i18n, flatLang) || null,
        notes_i18n
      };
    });
}

function normalizeTravelPlanLinks(links) {
  const sourceLinks = Array.isArray(links) ? links : [];
  return sourceLinks.map((link, index) => {
    const rawLink = link && typeof link === "object" && !Array.isArray(link) ? link : {};
    return {
      id: normalizeText(rawLink.id) || `travel_plan_offer_link_${index + 1}`,
      travel_plan_item_id: normalizeText(rawLink.travel_plan_item_id),
      offer_component_id: normalizeText(rawLink.offer_component_id),
      coverage_type: normalizeCoverageType(rawLink.coverage_type)
    };
  });
}

export function createTravelPlanHelpers() {
  function defaultBookingTravelPlan() {
    return buildDefaultTravelPlan();
  }

  function normalizeBookingTravelPlan(rawTravelPlan, offer = null, options = {}) {
    const strictReferences = options?.strictReferences === true;
    const source = rawTravelPlan && typeof rawTravelPlan === "object" && !Array.isArray(rawTravelPlan)
      ? rawTravelPlan
      : {};
    const days = normalizeTravelPlanDays(source.days, options);
    const links = normalizeTravelPlanLinks(source.offer_component_links);
    const itemIdSet = new Set(days.flatMap((day) => day.items.map((item) => item.id)));
    const offerComponentIdSet = new Set(
      (Array.isArray(offer?.components) ? offer.components : [])
        .map((component) => normalizeText(component?.id))
        .filter(Boolean)
    );

    const validLinks = links.filter((link) => {
      const hasItem = itemIdSet.has(link.travel_plan_item_id);
      const hasOfferComponent = offerComponentIdSet.has(link.offer_component_id);
      return hasItem && hasOfferComponent;
    });
    const returnedLinks = strictReferences ? links : validLinks;

    const linksByItemId = new Map();
    for (const link of validLinks) {
      const current = linksByItemId.get(link.travel_plan_item_id) || [];
      current.push(link);
      linksByItemId.set(link.travel_plan_item_id, current);
    }

    const normalizedDays = days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        const itemLinks = linksByItemId.get(item.id) || [];
        return {
          ...item,
          financial_coverage_status: buildDerivedCoverageStatus(item.kind, itemLinks)
        };
      })
    }));

    return normalizeTravelPlanTranslationMeta({
      days: normalizedDays,
      offer_component_links: returnedLinks
    });
  }

  function validateBookingTravelPlanInput(rawTravelPlan, offer = null, options = {}) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, offer, { strictReferences: true });
    const dayIds = new Set();
    const itemIds = new Set();
    const linkIds = new Set();
    const imageIds = new Set();
    const supplierIds = new Set(
      (Array.isArray(options?.supplierIds) ? options.supplierIds : [])
        .map((supplierId) => normalizeText(supplierId))
        .filter(Boolean)
    );
    const offerComponentIds = new Set(
      (Array.isArray(offer?.components) ? offer.components : [])
        .map((component) => normalizeText(component?.id))
        .filter(Boolean)
    );

    for (const day of normalized.days) {
      if (!normalizeText(day.id)) {
        return { ok: false, error: "Every travel-plan day needs an id." };
      }
      if (dayIds.has(day.id)) {
        return { ok: false, error: `Travel-plan day id ${day.id} is duplicated.` };
      }
      dayIds.add(day.id);
      if (!normalizeText(day.title)) {
        return { ok: false, error: `Day ${day.day_number} title is required.` };
      }

      for (const [itemIndex, item] of day.items.entries()) {
        const itemNumber = itemIndex + 1;
        if (!normalizeText(item.id)) {
          return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Item id is missing.` };
        }
      if (itemIds.has(item.id)) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Item id is duplicated.` };
      }
      itemIds.add(item.id);
      if (!TRAVEL_PLAN_TIMING_KINDS.has(item.timing_kind)) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Time information is invalid.` };
      }
      if (!TRAVEL_PLAN_ITEM_KINDS.has(item.kind)) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Kind is invalid.` };
      }
      if (
        item.kind === "accommodation"
        && !(Number.isInteger(item.accommodation_days) && item.accommodation_days >= 1 && item.accommodation_days <= 100)
      ) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Accommodation days must be between 1 and 100.` };
      }
      if (!normalizeText(item.title)) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Item Title is required` };
      }
      if (normalizeText(item.supplier_id) && !supplierIds.has(item.supplier_id)) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Unknown supplier ${item.supplier_id}.` };
      }
      if (item.timing_kind === "point" && !normalizeText(item.time_point)) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Time point is required.` };
      }
      if (item.timing_kind === "range" && (!normalizeText(item.start_time) || !normalizeText(item.end_time))) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Start and end time are required.` };
      }
      let primaryImageCount = 0;
      for (const image of Array.isArray(item.images) ? item.images : []) {
        if (!normalizeText(image.id)) {
          return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Item image id is missing.` };
        }
        if (imageIds.has(image.id)) {
          return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Item image id is duplicated.` };
        }
        imageIds.add(image.id);
        if (!normalizeText(image.storage_path)) {
          return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Item image storage path is required.` };
        }
        if (image.is_primary) primaryImageCount += 1;
      }
      if (primaryImageCount > 1) {
        return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Only one primary image is allowed.` };
      }
      if (item.copied_from) {
        if (!normalizeText(item.copied_from.source_booking_id) || !normalizeText(item.copied_from.source_item_id)) {
          return { ok: false, error: `Day ${day.day_number}, Item ${itemNumber}: Copied-from metadata is incomplete.` };
        }
      }
    }
  }

    for (const link of normalized.offer_component_links) {
      if (!normalizeText(link.id)) {
        return { ok: false, error: "Every travel-plan offer link needs an id." };
      }
      if (linkIds.has(link.id)) {
        return { ok: false, error: `Travel-plan offer link id ${link.id} is duplicated.` };
      }
      linkIds.add(link.id);
      if (!itemIds.has(link.travel_plan_item_id)) {
        return {
          ok: false,
          error: `Travel-plan offer link ${link.id} references unknown item ${link.travel_plan_item_id}.`
        };
      }
      if (!offerComponentIds.has(link.offer_component_id)) {
        return {
          ok: false,
          error: `Travel-plan offer link ${link.id} references unknown offer component ${link.offer_component_id}.`
        };
      }
      if (!TRAVEL_PLAN_OFFER_COVERAGE_TYPES.has(link.coverage_type)) {
        return { ok: false, error: `Travel-plan offer link ${link.id} has an invalid coverage type.` };
      }
    }

    return { ok: true, travel_plan: normalized };
  }

  function buildBookingTravelPlanReadModel(rawTravelPlan, offer = null, options = {}) {
    return normalizeBookingTravelPlan(rawTravelPlan, offer, { ...options, strictReferences: false });
  }

  return {
    defaultBookingTravelPlan,
    normalizeBookingTravelPlan,
    validateBookingTravelPlanInput,
    buildBookingTravelPlanReadModel
  };
}
