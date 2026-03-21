import { bookingT } from "./i18n.js";

export function validateTravelPlanDraft(plan, {
  getOfferComponentsForLinks,
  validTimingKinds,
  validSegmentKinds,
  validCoverageTypes,
  splitDateTimeValue,
  isValidIsoCalendarDate
}) {
  const normalizedPlan = plan && typeof plan === "object" ? plan : {};
  const dayIds = new Set();
  const segmentIds = new Set();
  const linkIds = new Set();
  const offerComponentIds = new Set(getOfferComponentsForLinks().map((component) => String(component?.id || "").trim()).filter(Boolean));

  for (const day of Array.isArray(normalizedPlan.days) ? normalizedPlan.days : []) {
    const dayId = String(day?.id || "").trim();
    if (!dayId) {
      return { ok: false, error: bookingT("booking.travel_plan.validation.day_id", "Every travel-plan day needs an id.") };
    }
    if (dayIds.has(dayId)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.day_id_duplicate",
          "Travel-plan day id {id} is duplicated.",
          { id: dayId }
        )
      };
    }
    dayIds.add(dayId);

    const dayNumber = Number(day?.day_number) || Array.from(dayIds).length;
    const dayTitle = String(day?.title || "").trim();
    if (!dayTitle) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.day_title_required",
          "Day {day} title is required.",
          { day: dayNumber }
        )
      };
    }

    if (String(day?.date || "").trim() && !isValidIsoCalendarDate(day.date)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.day_date_invalid",
          "Day {day}: Date must use YYYY-MM-DD.",
          { day: dayNumber }
        )
      };
    }

    for (const [segmentIndex, segment] of (Array.isArray(day?.segments) ? day.segments : []).entries()) {
      const segmentNumber = segmentIndex + 1;
      const segmentId = String(segment?.id || "").trim();
      if (!segmentId) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_id_missing",
            "Day {day}, Segment {segment}: Segment id is missing.",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }
      if (segmentIds.has(segmentId)) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_id_duplicate",
            "Day {day}, Segment {segment}: Segment id is duplicated.",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }
      segmentIds.add(segmentId);

      const timingKind = String(segment?.timing_kind || "").trim();
      if (!validTimingKinds.has(timingKind)) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_timing_invalid",
            "Day {day}, Segment {segment}: Time information is invalid.",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }

      const segmentKind = String(segment?.kind || "").trim();
      if (!validSegmentKinds.has(segmentKind)) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_kind_invalid",
            "Day {day}, Segment {segment}: Kind is invalid.",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }

      const segmentTitle = String(segment?.title || "").trim();
      if (!segmentTitle) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_title_required",
            "Day {day}, Segment {segment}: Segment Title is required",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }

      if (timingKind === "point" && !String(segment?.time_point || "").trim()) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_time_point_required",
            "Day {day}, Segment {segment}: Time point is required.",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }

      if (timingKind === "point" && String(segment?.time_point || "").trim()) {
        const pointParts = splitDateTimeValue(day?.date, segment.time_point);
        if (!isValidIsoCalendarDate(pointParts.date)) {
          return {
            ok: false,
            error: bookingT(
              "booking.travel_plan.validation.segment_time_point_date_invalid",
              "Day {day}, Segment {segment}: Date must use YYYY-MM-DD.",
              { day: dayNumber, segment: segmentNumber }
            )
          };
        }
      }

      if (timingKind === "range" && (!String(segment?.start_time || "").trim() || !String(segment?.end_time || "").trim())) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.segment_time_range_required",
            "Day {day}, Segment {segment}: Start and end time are required.",
            { day: dayNumber, segment: segmentNumber }
          )
        };
      }

      if (timingKind === "range") {
        const startParts = splitDateTimeValue(day?.date, segment.start_time);
        const endParts = splitDateTimeValue(day?.date, segment.end_time);
        if (!isValidIsoCalendarDate(startParts.date) || !isValidIsoCalendarDate(endParts.date)) {
          return {
            ok: false,
            error: bookingT(
              "booking.travel_plan.validation.segment_time_range_date_invalid",
              "Day {day}, Segment {segment}: Dates must use YYYY-MM-DD.",
              { day: dayNumber, segment: segmentNumber }
            )
          };
        }
      }
    }
  }

  for (const link of Array.isArray(normalizedPlan.offer_component_links) ? normalizedPlan.offer_component_links : []) {
    const linkId = String(link?.id || "").trim();
    if (!linkId) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.link_id_missing", "Every travel-plan offer link needs an id.")
      };
    }
    if (linkIds.has(linkId)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.link_id_duplicate",
          "Travel-plan offer link id {id} is duplicated.",
          { id: linkId }
        )
      };
    }
    linkIds.add(linkId);

    const segmentId = String(link?.travel_plan_segment_id || "").trim();
    if (!segmentIds.has(segmentId)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.link_segment_unknown",
          "Travel-plan offer link {id} references unknown segment {segment}.",
          { id: linkId, segment: segmentId }
        )
      };
    }

    const componentId = String(link?.offer_component_id || "").trim();
    if (!offerComponentIds.has(componentId)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.link_offer_unknown",
          "Travel-plan offer link {id} references unknown offer component {component}.",
          { id: linkId, component: componentId }
        )
      };
    }

    const coverageType = String(link?.coverage_type || "").trim();
    if (!validCoverageTypes.has(coverageType)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.link_coverage_invalid",
          "Travel-plan offer link {id} has an invalid coverage type.",
          { id: linkId }
        )
      };
    }
  }

  return { ok: true };
}
