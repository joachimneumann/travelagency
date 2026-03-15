import {
  TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS,
  TRAVEL_PLAN_SEGMENT_KIND_OPTIONS,
  TRAVEL_PLAN_TIMING_KIND_OPTIONS as GENERATED_TRAVEL_PLAN_TIMING_KIND_OPTIONS
} from "../shared/generated_catalogs.js?v=f09b901159f7";
import { bookingT } from "./i18n.js?v=f09b901159f7";
import {
  buildDualLocalizedPayload,
  normalizeLocalizedEditorMap,
  resolveLocalizedEditorBranchText,
  resolveLocalizedEditorText
} from "./localized_editor.js?v=f09b901159f7";

export const TRAVEL_PLAN_TIMING_KIND_OPTIONS = Object.freeze(
  GENERATED_TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => ({
    ...option,
    label: bookingT(
      `booking.travel_plan.timing_kind.${option.value}`,
      option.value === "label"
        ? "Human readable"
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

function normalizeSegmentKind(value) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  return TRAVEL_PLAN_SEGMENT_KIND_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "other";
}

function normalizeTimingKind(value) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  return TRAVEL_PLAN_TIMING_KIND_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "label";
}

function normalizeCoverageType(value) {
  const normalized = normalizeOptionalText(value).toLowerCase();
  return TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "full";
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
  return {
    timing_kind,
    time_label,
    time_point: "",
    start_time: "",
    end_time: ""
  };
}

export function createEmptyTravelPlanSegment() {
  return {
    id: travelPlanId("travel_plan_segment"),
    timing_kind: "label",
    time_label: "",
    time_label_i18n: {},
    time_point: "",
    kind: "other",
    title: "",
    title_i18n: {},
    details: "",
    details_i18n: {},
    location: "",
    location_i18n: {},
    supplier_id: "",
    start_time: "",
    end_time: "",
    financial_coverage_status: "not_covered",
    financial_note: "",
    financial_note_i18n: {}
  };
}

export function createEmptyTravelPlanDay(index = 0) {
  return {
    id: travelPlanId("travel_plan_day"),
    day_number: Math.max(1, Number(index) + 1),
    date: "",
    title: "",
    title_i18n: {},
    overnight_location: "",
    overnight_location_i18n: {},
    segments: [],
    notes: "",
    notes_i18n: {}
  };
}

export function createEmptyTravelPlanOfferComponentLink(segmentId = "") {
  return {
    id: travelPlanId("travel_plan_offer_link"),
    travel_plan_segment_id: String(segmentId || "").trim(),
    offer_component_id: "",
    coverage_type: "full"
  };
}

export function createEmptyTravelPlan() {
  return {
    days: [],
    offer_component_links: []
  };
}

export function getTravelPlanSegmentKindLabel(kind) {
  const option = TRAVEL_PLAN_SEGMENT_KIND_OPTIONS.find((entry) => entry.value === kind);
  return bookingT(`booking.travel_plan.kind.${kind}`, option?.label || "Other");
}

export function getTravelPlanCoverageTypeLabel(coverageType) {
  const option = TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS.find((entry) => entry.value === coverageType);
  return bookingT(`booking.travel_plan.coverage_type.${coverageType}`, option?.label || "Full");
}

export function getTravelPlanSegmentCoverageStatus(kind, links = []) {
  if (!Array.isArray(links) || links.length === 0) {
    return normalizeSegmentKind(kind) === "free_time" ? "not_applicable" : "not_covered";
  }
  if (links.some((link) => normalizeCoverageType(link?.coverage_type) === "full")) {
    return "covered";
  }
  if (links.some((link) => normalizeCoverageType(link?.coverage_type) === "partial")) {
    return "partially_covered";
  }
  return normalizeSegmentKind(kind) === "free_time" ? "not_applicable" : "not_covered";
}

export function normalizeTravelPlanDraft(plan, offerComponents = []) {
  const source = plan && typeof plan === "object" ? plan : {};
  const targetLang = String(window.__BOOKING_CONTENT_LANG || "en").trim() || "en";
  const linkableOfferComponentIds = new Set(
    (Array.isArray(offerComponents) ? offerComponents : [])
      .map((component) => String(component?.id || "").trim())
      .filter(Boolean)
  );

  const days = (Array.isArray(source.days) ? source.days : [])
    .map((day, dayIndex) => {
      const rawDay = day && typeof day === "object" ? day : {};
      return {
        id: String(rawDay.id || travelPlanId("travel_plan_day")),
        day_number: dayIndex + 1,
        date: normalizeOptionalText(rawDay.date),
        title: resolveLocalizedEditorText(rawDay.title_i18n ?? rawDay.title, "en", ""),
        title_i18n: buildDualLocalizedPayload(
          resolveLocalizedEditorText(rawDay.title_i18n ?? rawDay.title, "en", ""),
          resolveLocalizedEditorBranchText(rawDay.title_i18n ?? rawDay.title, targetLang, ""),
          targetLang
        ).map,
        overnight_location: resolveLocalizedEditorText(rawDay.overnight_location_i18n ?? rawDay.overnight_location, "en", ""),
        overnight_location_i18n: buildDualLocalizedPayload(
          resolveLocalizedEditorText(rawDay.overnight_location_i18n ?? rawDay.overnight_location, "en", ""),
          resolveLocalizedEditorBranchText(rawDay.overnight_location_i18n ?? rawDay.overnight_location, targetLang, ""),
          targetLang
        ).map,
        segments: (Array.isArray(rawDay.segments) ? rawDay.segments : []).map((segment) => {
          const rawSegment = segment && typeof segment === "object" ? segment : {};
          const timing = normalizeSegmentTiming(rawSegment);
          const timeLabelMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawSegment.time_label_i18n ?? timing.time_label, "en", ""),
            resolveLocalizedEditorBranchText(rawSegment.time_label_i18n ?? timing.time_label, targetLang, ""),
            targetLang
          ).map;
          const titleMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawSegment.title_i18n ?? rawSegment.title, "en", ""),
            resolveLocalizedEditorBranchText(rawSegment.title_i18n ?? rawSegment.title, targetLang, ""),
            targetLang
          ).map;
          const detailsMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawSegment.details_i18n ?? rawSegment.details, "en", ""),
            resolveLocalizedEditorBranchText(rawSegment.details_i18n ?? rawSegment.details, targetLang, ""),
            targetLang
          ).map;
          const locationMap = buildDualLocalizedPayload(
            resolveLocalizedEditorText(rawSegment.location_i18n ?? rawSegment.location, "en", ""),
            resolveLocalizedEditorBranchText(rawSegment.location_i18n ?? rawSegment.location, targetLang, ""),
            targetLang
          ).map;
          const financialNoteMap = normalizeLocalizedEditorMap(rawSegment.financial_note_i18n ?? rawSegment.financial_note, "en");
          return {
            id: String(rawSegment.id || travelPlanId("travel_plan_segment")),
            timing_kind: timing.timing_kind,
            time_label: resolveLocalizedEditorText(timeLabelMap, "en", ""),
            time_label_i18n: timeLabelMap,
            time_point: timing.time_point,
            kind: normalizeSegmentKind(rawSegment.kind),
            title: resolveLocalizedEditorText(titleMap, "en", ""),
            title_i18n: titleMap,
            details: resolveLocalizedEditorText(detailsMap, "en", ""),
            details_i18n: detailsMap,
            location: resolveLocalizedEditorText(locationMap, "en", ""),
            location_i18n: locationMap,
            supplier_id: normalizeOptionalText(rawSegment.supplier_id),
            start_time: timing.start_time,
            end_time: timing.end_time,
            financial_note: resolveLocalizedEditorText(financialNoteMap, targetLang, ""),
            financial_note_i18n: financialNoteMap,
            financial_coverage_status: "not_covered"
          };
        }),
        notes: resolveLocalizedEditorText(rawDay.notes_i18n ?? rawDay.notes, "en", ""),
        notes_i18n: buildDualLocalizedPayload(
          resolveLocalizedEditorText(rawDay.notes_i18n ?? rawDay.notes, "en", ""),
          resolveLocalizedEditorBranchText(rawDay.notes_i18n ?? rawDay.notes, targetLang, ""),
          targetLang
        ).map
      };
    });

  const segmentIdSet = new Set(days.flatMap((day) => day.segments.map((segment) => segment.id)));
  const offer_component_links = (Array.isArray(source.offer_component_links) ? source.offer_component_links : [])
    .map((link) => {
      const rawLink = link && typeof link === "object" ? link : {};
      return {
        id: String(rawLink.id || travelPlanId("travel_plan_offer_link")),
        travel_plan_segment_id: String(rawLink.travel_plan_segment_id || "").trim(),
        offer_component_id: String(rawLink.offer_component_id || "").trim(),
        coverage_type: normalizeCoverageType(rawLink.coverage_type)
      };
    })
    .filter((link) => {
      if (!segmentIdSet.has(link.travel_plan_segment_id)) return false;
      if (!link.offer_component_id) return true;
      return linkableOfferComponentIds.has(link.offer_component_id);
    });

  const linksBySegmentId = new Map();
  for (const link of offer_component_links) {
    if (!link.offer_component_id) continue;
    const list = linksBySegmentId.get(link.travel_plan_segment_id) || [];
    list.push(link);
    linksBySegmentId.set(link.travel_plan_segment_id, list);
  }

  return {
    days: days.map((day) => ({
      ...day,
      segments: day.segments.map((segment) => ({
        ...segment,
        financial_coverage_status: getTravelPlanSegmentCoverageStatus(
          segment.kind,
          linksBySegmentId.get(segment.id) || []
        )
      }))
    })),
    offer_component_links
  };
}

export function countTravelPlanSegments(plan) {
  return (Array.isArray(plan?.days) ? plan.days : []).reduce(
    (sum, day) => sum + (Array.isArray(day?.segments) ? day.segments.length : 0),
    0
  );
}

export function countUncoveredTravelPlanSegments(plan) {
  return (Array.isArray(plan?.days) ? plan.days : []).reduce(
    (sum, day) =>
      sum + (Array.isArray(day?.segments) ? day.segments.filter((segment) => segment?.financial_coverage_status === "not_covered").length : 0),
    0
  );
}

export function getLinkableOfferComponents(offerComponents = []) {
  return (Array.isArray(offerComponents) ? offerComponents : []).filter((component) => String(component?.id || "").trim());
}
