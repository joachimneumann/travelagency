import { bookingT } from "./i18n.js";

function travelPlanBoundaryLabel(boundaryKind) {
  return boundaryKind === "departure"
    ? bookingT("booking.travel_plan.departure", "Departure")
    : bookingT("booking.travel_plan.arrival", "Arrival");
}

export function validateTravelPlanDraft(plan, {
  validTimingKinds,
  validItemKinds,
  splitDateTimeValue,
  isValidIsoCalendarDate
}) {
  const normalizedPlan = plan && typeof plan === "object" ? plan : {};
  const dayIds = new Set();
  const itemIds = new Set();

  for (const [boundaryKind, service] of Object.entries(normalizedPlan.boundary_logistics || {})) {
    if (!["arrival", "departure"].includes(boundaryKind)) {
      return { ok: false, error: bookingT("booking.travel_plan.validation.boundary_invalid", "Arrival/departure information is invalid.") };
    }
    if (!service || service.enabled === false) continue;
    const boundaryLabel = travelPlanBoundaryLabel(boundaryKind);
    const itemId = String(service?.id || "").trim();
    if (!itemId) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.boundary_id_missing", "{kind}: Service id is missing.", { kind: boundaryLabel })
      };
    }
    if (itemIds.has(itemId)) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.boundary_id_duplicate", "{kind}: Service id is duplicated.", { kind: boundaryLabel })
      };
    }
    itemIds.add(itemId);
    const timingKind = String(service?.timing_kind || "").trim();
    if (!validTimingKinds.has(timingKind)) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.boundary_timing_invalid", "{kind}: Time information is invalid.", { kind: boundaryLabel })
      };
    }
    const itemKind = String(service?.kind || "").trim();
    if (!validItemKinds.has(itemKind)) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.boundary_kind_invalid", "{kind}: Kind is invalid.", { kind: boundaryLabel })
      };
    }
    if (timingKind === "point" && !String(service?.time_point || "").trim()) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.boundary_time_point_required", "{kind}: Time point is required.", { kind: boundaryLabel })
      };
    }
    if (timingKind === "range" && (!String(service?.start_time || "").trim() || !String(service?.end_time || "").trim())) {
      return {
        ok: false,
        error: bookingT("booking.travel_plan.validation.boundary_time_range_required", "{kind}: Start and end time are required.", { kind: boundaryLabel })
      };
    }
  }

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

    const services = Array.isArray(day?.services)
      ? day.services
      : (Array.isArray(day?.items) ? day.items : []);
    for (const [itemIndex, item] of services.entries()) {
      const itemNumber = itemIndex + 1;
      const itemId = String(item?.id || "").trim();
      if (!itemId) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.service_id_missing",
            "Day {day}, service {item}: Service id is missing.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }
      if (itemIds.has(itemId)) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.service_id_duplicate",
            "Day {day}, service {item}: Service id is duplicated.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }
      itemIds.add(itemId);

      const timingKind = String(item?.timing_kind || "").trim();
      if (!validTimingKinds.has(timingKind)) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.item_timing_invalid",
            "Day {day}, service {item}: Time information is invalid.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }

      const itemKind = String(item?.kind || "").trim();
      if (!validItemKinds.has(itemKind)) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.service_kind_invalid",
            "Day {day}, service {item}: Kind is invalid.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }

      if (timingKind === "point" && !String(item?.time_point || "").trim()) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.item_time_point_required",
            "Day {day}, service {item}: Time point is required.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }

      if (timingKind === "point" && String(item?.time_point || "").trim()) {
        const pointParts = splitDateTimeValue(day?.date, item.time_point);
        if (!isValidIsoCalendarDate(pointParts.date)) {
          return {
            ok: false,
            error: bookingT(
              "booking.travel_plan.validation.item_time_point_date_invalid",
              "Day {day}, service {item}: Date must use YYYY-MM-DD.",
              { day: dayNumber, item: itemNumber }
            )
          };
        }
      }

      if (timingKind === "range" && (!String(item?.start_time || "").trim() || !String(item?.end_time || "").trim())) {
        return {
          ok: false,
          error: bookingT(
            "booking.travel_plan.validation.item_time_range_required",
            "Day {day}, service {item}: Start and end time are required.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }

      if (timingKind === "range") {
        const startParts = splitDateTimeValue(day?.date, item.start_time);
        const endParts = splitDateTimeValue(day?.date, item.end_time);
        if (!isValidIsoCalendarDate(startParts.date) || !isValidIsoCalendarDate(endParts.date)) {
          return {
            ok: false,
            error: bookingT(
              "booking.travel_plan.validation.item_time_range_date_invalid",
              "Day {day}, service {item}: Dates must use YYYY-MM-DD.",
              { day: dayNumber, item: itemNumber }
            )
          };
        }
      }
    }
  }

  return { ok: true };
}
