import { normalizeText } from "../lib/text.js";
import { normalizeTravelPlanTranslationMeta } from "./booking_translation.js";
import {
  normalizeBookingContentLang,
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "./booking_content_i18n.js";

const TRAVEL_PLAN_SEGMENT_KINDS = Object.freeze(new Set([
  "transport",
  "accommodation",
  "activity",
  "meal",
  "guide",
  "free_time",
  "border_crossing",
  "other"
]));

const TRAVEL_PLAN_TIMING_KINDS = Object.freeze(new Set([
  "label",
  "point",
  "range"
]));

const TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUSES = Object.freeze(new Set([
  "not_applicable",
  "not_covered",
  "partially_covered",
  "covered"
]));

const TRAVEL_PLAN_OFFER_COVERAGE_TYPES = Object.freeze(new Set([
  "full",
  "partial"
]));

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeSegmentKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_SEGMENT_KINDS.has(normalized) ? normalized : "other";
}

function normalizeTimingKind(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_TIMING_KINDS.has(normalized) ? normalized : "label";
}

function normalizeCoverageType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return TRAVEL_PLAN_OFFER_COVERAGE_TYPES.has(normalized) ? normalized : "full";
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

function normalizeSegmentTiming(rawSegment) {
  const timing_kind = normalizeTimingKind(rawSegment?.timing_kind);
  const time_label = normalizeOptionalText(rawSegment?.time_label);
  const time_point = normalizeOptionalText(rawSegment?.time_point);
  const start_time = normalizeOptionalText(rawSegment?.start_time);
  const end_time = normalizeOptionalText(rawSegment?.end_time);

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
      const segments = (Array.isArray(day?.segments) ? day.segments : []).map((segment, segmentIndex) => {
        const rawSegment = segment && typeof segment === "object" && !Array.isArray(segment) ? segment : {};
        const timing = normalizeSegmentTiming(rawSegment);
        const time_label_i18n = normalizeLocalizedTextMap(rawSegment?.time_label_i18n ?? timing.time_label, contentLang);
        const title_i18n = normalizeLocalizedTextMap(rawSegment?.title_i18n ?? rawSegment?.title, contentLang);
        const details_i18n = normalizeLocalizedTextMap(rawSegment?.details_i18n ?? rawSegment?.details, contentLang);
        const location_i18n = normalizeLocalizedTextMap(rawSegment?.location_i18n ?? rawSegment?.location, contentLang);
        const financial_note_i18n = normalizeLocalizedTextMap(
          rawSegment?.financial_note_i18n ?? rawSegment?.financial_note,
          contentLang
        );
        return {
          id: normalizeText(rawSegment.id) || `travel_plan_segment_${dayIndex + 1}_${segmentIndex + 1}`,
          timing_kind: timing.timing_kind,
          time_label: timing.timing_kind === "label" ? (resolveLocalizedText(time_label_i18n, flatLang) || null) : null,
          time_label_i18n,
          time_point: timing.time_point,
          kind: normalizeSegmentKind(rawSegment.kind),
          title: resolveLocalizedText(title_i18n, flatLang),
          title_i18n,
          details: resolveLocalizedText(details_i18n, flatLang) || null,
          details_i18n,
          location: resolveLocalizedText(location_i18n, flatLang) || null,
          location_i18n,
          supplier_id: normalizeOptionalText(rawSegment.supplier_id),
          start_time: timing.start_time,
          end_time: timing.end_time,
          financial_coverage_status: normalizeFinancialCoverageStatus(rawSegment.financial_coverage_status),
          financial_note: resolveLocalizedText(financial_note_i18n, flatLang) || null,
          financial_note_i18n
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
        segments,
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
      travel_plan_segment_id: normalizeText(rawLink.travel_plan_segment_id),
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
    const segmentIdSet = new Set(days.flatMap((day) => day.segments.map((segment) => segment.id)));
    const offerComponentIdSet = new Set(
      (Array.isArray(offer?.components) ? offer.components : [])
        .map((component) => normalizeText(component?.id))
        .filter(Boolean)
    );

    const validLinks = links.filter((link) => {
      const hasSegment = segmentIdSet.has(link.travel_plan_segment_id);
      const hasOfferComponent = offerComponentIdSet.has(link.offer_component_id);
      return hasSegment && hasOfferComponent;
    });
    const returnedLinks = strictReferences ? links : validLinks;

    const linksBySegmentId = new Map();
    for (const link of validLinks) {
      const current = linksBySegmentId.get(link.travel_plan_segment_id) || [];
      current.push(link);
      linksBySegmentId.set(link.travel_plan_segment_id, current);
    }

    const normalizedDays = days.map((day) => ({
      ...day,
      segments: day.segments.map((segment) => {
        const segmentLinks = linksBySegmentId.get(segment.id) || [];
        return {
          ...segment,
          financial_coverage_status: buildDerivedCoverageStatus(segment.kind, segmentLinks)
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
    const segmentIds = new Set();
    const linkIds = new Set();
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

      for (const segment of day.segments) {
        if (!normalizeText(segment.id)) {
          return { ok: false, error: `Day ${day.day_number} contains a segment without an id.` };
        }
      if (segmentIds.has(segment.id)) {
        return { ok: false, error: `Travel-plan segment id ${segment.id} is duplicated.` };
      }
      segmentIds.add(segment.id);
      if (!TRAVEL_PLAN_TIMING_KINDS.has(segment.timing_kind)) {
        return { ok: false, error: `Segment ${segment.id} has an invalid timing kind.` };
      }
      if (!TRAVEL_PLAN_SEGMENT_KINDS.has(segment.kind)) {
        return { ok: false, error: `Segment ${segment.id} has an invalid kind.` };
      }
      if (!normalizeText(segment.title)) {
        return { ok: false, error: `Segment ${segment.id} title is required.` };
      }
      if (normalizeText(segment.supplier_id) && !supplierIds.has(segment.supplier_id)) {
        return { ok: false, error: `Segment ${segment.id} references unknown supplier ${segment.supplier_id}.` };
      }
      if (segment.timing_kind === "point" && !normalizeText(segment.time_point)) {
        return { ok: false, error: `Segment ${segment.id} requires a time point.` };
      }
      if (segment.timing_kind === "range" && (!normalizeText(segment.start_time) || !normalizeText(segment.end_time))) {
        return { ok: false, error: `Segment ${segment.id} requires both start and end time.` };
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
      if (!segmentIds.has(link.travel_plan_segment_id)) {
        return {
          ok: false,
          error: `Travel-plan offer link ${link.id} references unknown segment ${link.travel_plan_segment_id}.`
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
