import {
  destinationScopeDestinations,
  normalizeDestinationScope
} from "../../domain/destination_scope.js";

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertOptionalNonNegativeInteger(value, fieldName) {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
}

function mergeDestinationScopes(leftScope, rightScope) {
  const merged = normalizeDestinationScope([
    ...normalizeDestinationScope(leftScope),
    ...normalizeDestinationScope(rightScope)
  ]);
  return {
    destination_scope: merged,
    destinations: destinationScopeDestinations(merged)
  };
}

function assertRequiredIdentifier(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
}

function assertOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null) return;
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }
}

function assertOptionalString(value, fieldName) {
  if (value === undefined || value === null) return;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
}

function assertOptionalPlainObject(value, fieldName) {
  if (value === undefined || value === null) return;
  assertPlainObject(value, fieldName);
}

function validateTravelPlanDayImportPayload(value) {
  assertPlainObject(value, "Travel plan day import payload");
  assertOptionalNonNegativeInteger(value.expected_travel_plan_revision, "expected_travel_plan_revision");
  assertRequiredIdentifier(value.source_tour_id, "source_tour_id");
  assertRequiredIdentifier(value.source_day_id, "source_day_id");
  assertOptionalPlainObject(value.target_travel_plan, "target_travel_plan");
  assertOptionalBoolean(value.include_images, "include_images");
  assertOptionalBoolean(value.include_customer_visible_images_only, "include_customer_visible_images_only");
  assertOptionalBoolean(value.include_notes, "include_notes");
  assertOptionalBoolean(value.include_translations, "include_translations");
  assertOptionalString(value.actor, "actor");
}

function validateTravelPlanServiceImportPayload(value) {
  assertPlainObject(value, "Travel plan service import payload");
  assertOptionalNonNegativeInteger(value.expected_travel_plan_revision, "expected_travel_plan_revision");
  assertRequiredIdentifier(value.source_tour_id, "source_tour_id");
  assertRequiredIdentifier(value.source_service_id, "source_service_id");
  assertOptionalString(value.insert_after_service_id, "insert_after_service_id");
  assertOptionalPlainObject(value.target_travel_plan, "target_travel_plan");
  assertOptionalBoolean(value.include_images, "include_images");
  assertOptionalBoolean(value.include_customer_visible_images_only, "include_customer_visible_images_only");
  assertOptionalBoolean(value.include_notes, "include_notes");
  assertOptionalBoolean(value.include_translations, "include_translations");
  assertOptionalString(value.actor, "actor");
}

export function createBookingTravelPlanImportHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    readTours,
    getPrincipal,
    canEditBooking,
    normalizeTourForStorage,
    normalizeMarketingTourTravelPlan,
    normalizeText,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    validateBookingTravelPlanInput,
    normalizeBookingTravelPlan,
    requestContentLang,
    marketingTourBookingTravelPlanCloner
  } = deps;

  async function findMarketingTourImportSource(sourceTourId, contentLang) {
    if (!sourceTourId || typeof readTours !== "function" || typeof normalizeMarketingTourTravelPlan !== "function") {
      return null;
    }
    const tours = (await readTours()).map((tour) => (
      typeof normalizeTourForStorage === "function" ? normalizeTourForStorage(tour) : tour
    ));
    const sourceTour = tours.find((item) => normalizeText(item?.id) === sourceTourId);
    if (!sourceTour) return null;
    return {
      sourceTour,
      sourceTravelPlan: normalizeMarketingTourTravelPlan(sourceTour.travel_plan, {
        contentLang,
        flatLang: contentLang,
        strictReferences: false
      })
    };
  }

  function resolveTargetBookingTravelPlan(targetBooking, payload, contentLang) {
    const rawTargetTravelPlan = payload?.target_travel_plan && typeof payload.target_travel_plan === "object" && !Array.isArray(payload.target_travel_plan)
      ? payload.target_travel_plan
      : targetBooking?.travel_plan;
    return normalizeBookingTravelPlan(rawTargetTravelPlan, targetBooking.offer, {
      contentLang,
      flatLang: contentLang,
      strictReferences: false
    });
  }

  async function handleImportTravelPlanService(req, res, [bookingId, dayId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanServiceImportPayload(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const targetBooking = store.bookings.find((item) => item.id === bookingId);
    if (!targetBooking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, targetBooking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, targetBooking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const contentLang = requestContentLang(req, payload);
    const sourceTourId = normalizeText(payload.source_tour_id);
    if (sourceTourId) {
      if (!marketingTourBookingTravelPlanCloner?.cloneMarketingTourServiceForBooking) {
        sendJson(res, 500, { error: "Marketing tour import is not configured" });
        return;
      }
      const source = await findMarketingTourImportSource(sourceTourId, contentLang);
      if (!source?.sourceTour) {
        sendJson(res, 404, { error: "Source tour not found" });
        return;
      }
      const sourceItemId = normalizeText(payload.source_service_id) || normalizeText(payload.source_item_id);
      const sourceDays = Array.isArray(source.sourceTravelPlan?.days) ? source.sourceTravelPlan.days : [];
      const sourceDay = sourceDays.find((day) => Array.isArray(day?.services) && day.services.some((item) => item.id === sourceItemId));
      const sourceItem = (Array.isArray(sourceDay?.services) ? sourceDay.services : []).find((item) => item.id === sourceItemId);
      if (!sourceDay || !sourceItem) {
        sendJson(res, 404, { error: "Source service not found" });
        return;
      }

      const targetTravelPlan = resolveTargetBookingTravelPlan(targetBooking, payload, contentLang);
      const targetDays = Array.isArray(targetTravelPlan?.days) ? targetTravelPlan.days : [];
      const targetDayIndex = targetDays.findIndex((day) => day.id === dayId);
      if (targetDayIndex < 0) {
        sendJson(res, 404, { error: "Target day not found" });
        return;
      }
      const importedItem = await marketingTourBookingTravelPlanCloner.cloneMarketingTourServiceForBooking(sourceItem, {
        tourId: source.sourceTour.id,
        bookingId: targetBooking.id,
        createdAt: nowIso()
      });
      const targetDay = targetDays[targetDayIndex];
      const targetItems = Array.isArray(targetDay?.services) ? [...targetDay.services] : [];
      const insertAfterItemId = normalizeText(payload.insert_after_service_id) || normalizeText(payload.insert_after_item_id);
      if (insertAfterItemId) {
        const insertAfterIndex = targetItems.findIndex((item) => item.id === insertAfterItemId);
        if (insertAfterIndex < 0) {
          sendJson(res, 422, { error: `Target service ${insertAfterItemId} was not found in the target day.` });
          return;
        }
        targetItems.splice(insertAfterIndex + 1, 0, importedItem);
      } else {
        targetItems.push(importedItem);
      }

      const mergedScope = mergeDestinationScopes(targetTravelPlan.destination_scope, source.sourceTravelPlan.destination_scope);
      const nextTravelPlan = {
        ...targetTravelPlan,
        ...mergedScope,
        days: targetDays.map((day, index) => (
          index === targetDayIndex
            ? {
              ...day,
              services: targetItems
            }
            : day
        ))
      };
      const check = validateBookingTravelPlanInput(nextTravelPlan, targetBooking.offer);
      if (!check.ok) {
        sendJson(res, 422, { error: check.error });
        return;
      }
      targetBooking.travel_plan = check.travel_plan;
      incrementBookingRevision(targetBooking, "travel_plan_revision");
      targetBooking.updated_at = nowIso();
      addActivity(
        store,
        targetBooking.id,
        "TRAVEL_PLAN_UPDATED",
        actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
        `Service imported from marketing tour ${sourceTourId}`
      );
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(targetBooking, req));
      return;
    }

  }

  async function handleImportTravelPlanDay(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanDayImportPayload(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const targetBooking = store.bookings.find((item) => item.id === bookingId);
    if (!targetBooking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, targetBooking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, targetBooking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const contentLang = requestContentLang(req, payload);
    const sourceTourId = normalizeText(payload.source_tour_id);
    if (sourceTourId) {
      if (!marketingTourBookingTravelPlanCloner?.cloneMarketingTourDayForBooking) {
        sendJson(res, 500, { error: "Marketing tour import is not configured" });
        return;
      }
      const source = await findMarketingTourImportSource(sourceTourId, contentLang);
      if (!source?.sourceTour) {
        sendJson(res, 404, { error: "Source tour not found" });
        return;
      }
      const sourceDay = (Array.isArray(source.sourceTravelPlan?.days) ? source.sourceTravelPlan.days : [])
        .find((day) => day.id === normalizeText(payload.source_day_id));
      if (!sourceDay) {
        sendJson(res, 404, { error: "Source day not found" });
        return;
      }

      const targetTravelPlan = resolveTargetBookingTravelPlan(targetBooking, payload, contentLang);
      const targetDays = Array.isArray(targetTravelPlan?.days) ? [...targetTravelPlan.days] : [];
      const importedDay = await marketingTourBookingTravelPlanCloner.cloneMarketingTourDayForBooking(sourceDay, {
        dayIndex: targetDays.length,
        tourId: source.sourceTour.id,
        bookingId: targetBooking.id,
        createdAt: nowIso()
      });
      const mergedScope = mergeDestinationScopes(targetTravelPlan.destination_scope, source.sourceTravelPlan.destination_scope);
      const nextTravelPlan = {
        ...targetTravelPlan,
        ...mergedScope,
        days: [...targetDays, importedDay]
      };
      const check = validateBookingTravelPlanInput(nextTravelPlan, targetBooking.offer);
      if (!check.ok) {
        sendJson(res, 422, { error: check.error });
        return;
      }
      targetBooking.travel_plan = check.travel_plan;
      incrementBookingRevision(targetBooking, "travel_plan_revision");
      targetBooking.updated_at = nowIso();
      addActivity(
        store,
        targetBooking.id,
        "TRAVEL_PLAN_UPDATED",
        actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
        `Day imported from marketing tour ${sourceTourId}`
      );
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(targetBooking, req));
      return;
    }

  }

  return {
    handleImportTravelPlanDay,
    handleImportTravelPlanService
  };
}
