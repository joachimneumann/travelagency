import { bookingT } from "./i18n.js";

export function validateTravelPlanDraft(plan, {
  getOfferComponentsForLinks,
  validTimingKinds,
  validItemKinds,
  validCoverageTypes,
  splitDateTimeValue,
  isValidIsoCalendarDate
}) {
  const normalizedPlan = plan && typeof plan === "object" ? plan : {};
  const dayIds = new Set();
  const itemIds = new Set();
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
        code: "day_title_required",
        dayId,
        dayNumber,
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

      const accommodationDays = Number(item?.accommodation_days);
      if (
        itemKind === "accommodation"
        && !(Number.isInteger(accommodationDays) && accommodationDays >= 1 && accommodationDays <= 100)
      ) {
        return {
          ok: false,
          code: "accommodation_days_invalid",
          dayId,
          itemId,
          dayNumber,
          itemNumber,
          error: bookingT(
            "booking.travel_plan.validation.accommodation_days_invalid",
            "Day {day}, service {item}: Accommodation days must be between 1 and 100.",
            { day: dayNumber, item: itemNumber }
          )
        };
      }

      const itemTitle = String(item?.title || "").trim();
      if (!itemTitle) {
        return {
          ok: false,
          code: "item_title_required",
          dayId,
          itemId,
          dayNumber,
          itemNumber,
          error: bookingT(
            "booking.travel_plan.validation.item_title_required",
            "Day {day}, service {item}: Service title is required.",
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

    const itemId = String(link?.travel_plan_service_id || "").trim();
    if (!itemIds.has(itemId)) {
      return {
        ok: false,
        error: bookingT(
          "booking.travel_plan.validation.link_item_unknown",
          "Travel-plan offer link {id} references unknown service {item}.",
          { id: linkId, item: itemId }
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
