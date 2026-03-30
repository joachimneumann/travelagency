import { normalizeText } from "../lib/text.js";
import {
  TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_VALUES,
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_VALUES,
  TRAVEL_PLAN_SERVICE_KIND_VALUES,
  TRAVEL_PLAN_TIMING_KIND_VALUES
} from "../lib/generated_catalogs.js";
import { normalizeTravelPlanTranslationMeta } from "./booking_translation.js";
import {
  normalizeBookingContentLang,
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "./booking_content_i18n.js";

const TRAVEL_PLAN_SERVICE_KINDS = new Set(TRAVEL_PLAN_SERVICE_KIND_VALUES);
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

function normalizeTravelPlanServiceCopiedFrom(rawCopiedFrom) {
  const source = rawCopiedFrom && typeof rawCopiedFrom === "object" && !Array.isArray(rawCopiedFrom)
    ? rawCopiedFrom
    : {};
  const sourceBookingId = normalizeOptionalText(source.source_booking_id);
  const sourceServiceId = normalizeOptionalText(source.source_service_id) || normalizeOptionalText(source.source_item_id);
  if (!sourceBookingId || !sourceServiceId) return null;
  return {
    source_type: normalizeOptionalText(source.source_type) || "booking_travel_plan_service",
    source_booking_id: sourceBookingId,
    source_day_id: normalizeOptionalText(source.source_day_id),
    source_service_id: sourceServiceId,
    copied_at: normalizeOptionalText(source.copied_at),
    copied_by_atp_staff_id: normalizeOptionalText(source.copied_by_atp_staff_id)
  };
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

function normalizeTravelPlanServiceImage(image, dayIndex, itemIndex) {
  const rawImage = resolveRawTravelPlanServiceImage(image);
  if (!rawImage) return null;
  const storagePath = normalizeOptionalText(rawImage.storage_path);
  if (!storagePath) return null;
  return {
    id: normalizeText(rawImage.id) || `travel_plan_service_image_${dayIndex + 1}_${itemIndex + 1}_1`,
    storage_path: storagePath,
    caption: normalizeOptionalText(rawImage.caption),
    alt_text: normalizeOptionalText(rawImage.alt_text),
    sort_order: 0,
    is_primary: true,
    is_customer_visible: normalizeOptionalBoolean(rawImage.is_customer_visible, true),
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

function normalizeCoverageType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_OFFER_COVERAGE_TYPES.has(normalized) ? normalized : "full";
}

function normalizeDurationDays(value) {
  const raw = normalizeText(value);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return parsed >= 1 && parsed <= 100 ? parsed : null;
}

function resolveDurationDays(rawItem) {
  if (rawItem?.duration_days !== undefined && rawItem?.duration_days !== null) {
    return normalizeDurationDays(rawItem.duration_days);
  }
  if (rawItem?.accommodation_days !== undefined && rawItem?.accommodation_days !== null) {
    return normalizeDurationDays(rawItem.accommodation_days);
  }
  return 1;
}

function normalizeFinancialCoverageStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUSES.has(normalized) ? normalized : null;
}

function normalizeFinancialCoverageNeeded(value) {
  return value !== false;
}

function buildDefaultTravelPlan() {
  return {
    days: [],
    offer_component_links: [],
    attachments: []
  };
}

function buildDerivedCoverageStatus(kind, links, financialCoverageNeeded = true) {
  if (!Array.isArray(links) || links.length === 0) {
    if (financialCoverageNeeded === false) {
      return "not_applicable";
    }
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
  const sourceLang = normalizeBookingContentLang(options?.sourceLang || contentLang);
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
      ).map((item, itemIndex) => {
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
          id: normalizeText(rawItem.id) || `travel_plan_service_${dayIndex + 1}_${itemIndex + 1}`,
          timing_kind: timing.timing_kind,
          time_label: timing.timing_kind === "label" ? (resolveLocalizedText(time_label_i18n, flatLang, "", { sourceLang }) || null) : null,
          time_label_i18n,
          time_point: timing.time_point,
          kind: normalizeItemKind(rawItem.kind),
          duration_days: resolveDurationDays(rawItem),
          title: resolveLocalizedText(title_i18n, flatLang, "", { sourceLang }),
          title_i18n,
          details: resolveLocalizedText(details_i18n, flatLang, "", { sourceLang }) || null,
          details_i18n,
          location: resolveLocalizedText(location_i18n, flatLang, "", { sourceLang }) || null,
          location_i18n,
          supplier_id: normalizeOptionalText(rawItem.supplier_id),
          start_time: timing.start_time,
          end_time: timing.end_time,
          financial_coverage_needed: normalizeFinancialCoverageNeeded(rawItem.financial_coverage_needed),
          financial_coverage_status: normalizeFinancialCoverageStatus(rawItem.financial_coverage_status),
          financial_note: resolveLocalizedText(financial_note_i18n, flatLang, "", { sourceLang }) || null,
          financial_note_i18n,
          image: normalizeTravelPlanServiceImage(rawItem.image ?? rawItem.images, dayIndex, itemIndex),
          copied_from: normalizeTravelPlanServiceCopiedFrom(rawItem.copied_from)
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
        title: resolveLocalizedText(title_i18n, flatLang, "", { sourceLang }),
        title_i18n,
        overnight_location: resolveLocalizedText(overnight_location_i18n, flatLang, "", { sourceLang }) || null,
        overnight_location_i18n,
        services,
        notes: resolveLocalizedText(notes_i18n, flatLang, "", { sourceLang }) || null,
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
      travel_plan_service_id: normalizeText(rawLink.travel_plan_service_id) || normalizeText(rawLink.travel_plan_item_id),
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
    const itemIdSet = new Set(days.flatMap((day) => day.services.map((item) => item.id)));
    const offerComponentIdSet = new Set(
      (Array.isArray(offer?.components) ? offer.components : [])
        .map((component) => normalizeText(component?.id))
        .filter(Boolean)
    );

    const validLinks = links.filter((link) => {
      const hasItem = itemIdSet.has(link.travel_plan_service_id);
      const hasOfferComponent = offerComponentIdSet.has(link.offer_component_id);
      return hasItem && hasOfferComponent;
    });
    const returnedLinks = strictReferences ? links : validLinks;

    const linksByItemId = new Map();
    for (const link of validLinks) {
      const current = linksByItemId.get(link.travel_plan_service_id) || [];
      current.push(link);
      linksByItemId.set(link.travel_plan_service_id, current);
    }

    const normalizedDays = days.map((day) => ({
      ...day,
      services: day.services.map((item) => {
        const itemLinks = linksByItemId.get(item.id) || [];
        const financialCoverageNeeded = itemLinks.length > 0
          ? true
          : item.financial_coverage_needed;
        return {
          ...item,
          financial_coverage_needed: financialCoverageNeeded !== false,
          financial_coverage_status: buildDerivedCoverageStatus(item.kind, itemLinks, financialCoverageNeeded)
        };
      })
    }));

    return normalizeTravelPlanTranslationMeta({
      days: normalizedDays,
      offer_component_links: returnedLinks,
      attachments: normalizeTravelPlanAttachments(source.attachments)
    });
  }

  function validateBookingTravelPlanInput(rawTravelPlan, offer = null, options = {}) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, offer, { strictReferences: true });
    const dayIds = new Set();
    const itemIds = new Set();
    const linkIds = new Set();
    const imageIds = new Set();
    const attachmentIds = new Set();
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
        if (
          !(Number.isInteger(item.duration_days) && item.duration_days >= 1 && item.duration_days <= 100)
        ) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Duration days must be between 1 and 100.` };
        }
        if (normalizeText(item.supplier_id) && !supplierIds.has(item.supplier_id)) {
          return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Unknown supplier ${item.supplier_id}.` };
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
        if (item.copied_from) {
          if (!normalizeText(item.copied_from.source_booking_id) || !normalizeText(item.copied_from.source_service_id)) {
            return { ok: false, error: `Day ${day.day_number}, Service ${itemNumber}: Copied-from metadata is incomplete.` };
          }
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

    for (const link of normalized.offer_component_links) {
      if (!normalizeText(link.id)) {
        return { ok: false, error: "Every travel-plan offer link needs an id." };
      }
      if (linkIds.has(link.id)) {
        return { ok: false, error: `Travel-plan offer link id ${link.id} is duplicated.` };
      }
      linkIds.add(link.id);
      if (!itemIds.has(link.travel_plan_service_id)) {
        return {
          ok: false,
          error: `Travel-plan offer link ${link.id} references unknown service ${link.travel_plan_service_id}.`
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
