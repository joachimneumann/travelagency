import {
  validateBookingStandardTourApplyRequest,
  validateStandardTourUpsertRequest
} from "../../../Generated/API/generated_APIModels.js";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createStandardTourHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    readStandardTours,
    persistStandardTour,
    deleteStandardTour,
    getPrincipal,
    canReadStandardTours,
    canEditStandardTours,
    canEditBooking,
    normalizeText,
    normalizeTourDestinationCode,
    nowIso,
    randomUUID,
    buildStandardTourReadModel,
    normalizeStandardTourForStorage,
    cloneStandardTourTravelPlanForBooking,
    normalizeStandardTourTravelPlan,
    validateBookingTravelPlanInput,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    persistStore,
    addActivity,
    actorLabel
  } = deps;

  function buildStandardTourResponse(standardTour) {
    return {
      standard_tour: buildStandardTourReadModel(standardTour)
    };
  }

  function filterStandardTours(items, query) {
    const normalizedQuery = normalizeText(query.get("q")).toLowerCase();
    const destination = normalizeTourDestinationCode(query.get("destination"));

    return items.filter((standardTour) => {
      const stored = normalizeStandardTourForStorage(standardTour);
      if (destination && !stored.destinations.includes(destination)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        stored.title,
        ...stored.destinations
      ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
      return haystack.includes(normalizedQuery);
    });
  }

  function validateStandardTourTravelPlan(rawTravelPlan) {
    const normalized = normalizeStandardTourTravelPlan(rawTravelPlan);
    const check = validateBookingTravelPlanInput(normalized, null);
    if (!check.ok) return check;
    return {
      ok: true,
      travel_plan: {
        ...check.travel_plan,
        attachments: []
      }
    };
  }

  function normalizeStandardTourTitleKey(value) {
    return normalizeText(value).toLowerCase();
  }

  function findStandardTourByTitle(standardTours, title, excludedStandardTourId = "") {
    const titleKey = normalizeStandardTourTitleKey(title);
    const excludedId = normalizeText(excludedStandardTourId);
    if (!titleKey) return null;
    return (Array.isArray(standardTours) ? standardTours : [])
      .map((standardTour) => normalizeStandardTourForStorage(standardTour))
      .find((standardTour) => (
        standardTour.id !== excludedId
        && normalizeStandardTourTitleKey(standardTour.title) === titleKey
      )) || null;
  }

  async function handleListStandardTours(req, res) {
    const principal = getPrincipal(req);
    if (!canReadStandardTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const standardTours = await readStandardTours();
    const requestUrl = new URL(req.url, "http://localhost");
    const page = parsePositiveInt(requestUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(100, parsePositiveInt(requestUrl.searchParams.get("page_size"), 20));
    const filtered = filterStandardTours(standardTours, requestUrl.searchParams)
      .sort((left, right) => String(left.title || "").localeCompare(String(right.title || "")));
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize).map((standardTour) => buildStandardTourReadModel(standardTour));
    sendJson(res, 200, {
      items,
      total: filtered.length
    });
  }

  async function handleGetStandardTour(req, res, [standardTourId]) {
    const principal = getPrincipal(req);
    if (!canReadStandardTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const standardTours = await readStandardTours();
    const stored = standardTours.map((standardTour) => normalizeStandardTourForStorage(standardTour))
      .find((standardTour) => standardTour.id === standardTourId);
    if (!stored) {
      sendJson(res, 404, { error: "Standard tour not found" });
      return;
    }
    sendJson(res, 200, buildStandardTourResponse(stored));
  }

  async function handleCreateStandardTour(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateStandardTourUpsertRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditStandardTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const standardTours = await readStandardTours();
    const title = normalizeText(payload?.title);
    if (!title) {
      sendJson(res, 422, { error: "title is required" });
      return;
    }
    if (findStandardTourByTitle(standardTours, title)) {
      sendJson(res, 409, { error: "A standard tour with this title already exists." });
      return;
    }

    let nextTravelPlan = null;
    if (payload?.travel_plan) {
      const check = validateStandardTourTravelPlan(payload.travel_plan);
      if (!check.ok) {
        sendJson(res, 422, { error: check.error });
        return;
      }
      nextTravelPlan = check.travel_plan;
    } else {
      sendJson(res, 422, { error: "travel_plan is required" });
      return;
    }

    const standardTour = normalizeStandardTourForStorage({
      id: `standard_tour_${randomUUID()}`,
      title,
      destinations: payload?.destinations,
      travel_plan: nextTravelPlan
    });
    await persistStandardTour(standardTour);
    sendJson(res, 201, buildStandardTourResponse(standardTour));
  }

  async function handlePatchStandardTour(req, res, [standardTourId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateStandardTourUpsertRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditStandardTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const standardTours = await readStandardTours();
    const existing = standardTours.map((standardTour) => normalizeStandardTourForStorage(standardTour))
      .find((standardTour) => standardTour.id === standardTourId);
    if (!existing) {
      sendJson(res, 404, { error: "Standard tour not found" });
      return;
    }
    const nextTitle = payload?.title !== undefined ? normalizeText(payload.title) : normalizeText(existing.title);
    if (!nextTitle) {
      sendJson(res, 422, { error: "title is required" });
      return;
    }
    if (findStandardTourByTitle(standardTours, nextTitle, standardTourId)) {
      sendJson(res, 409, { error: "A standard tour with this title already exists." });
      return;
    }

    let nextTravelPlan = existing.travel_plan;
    if (payload?.travel_plan) {
      const check = validateStandardTourTravelPlan(payload.travel_plan);
      if (!check.ok) {
        sendJson(res, 422, { error: check.error });
        return;
      }
      nextTravelPlan = check.travel_plan;
    }

    const updated = normalizeStandardTourForStorage({
      ...existing,
      title: nextTitle,
      destinations: payload?.destinations !== undefined ? payload.destinations : existing?.travel_plan?.destinations,
      travel_plan: nextTravelPlan
    });
    await persistStandardTour(updated);
    sendJson(res, 200, buildStandardTourResponse(updated));
  }

  async function handleDeleteStandardTour(req, res, [standardTourId]) {
    const principal = getPrincipal(req);
    if (!canEditStandardTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const standardTours = await readStandardTours();
    const existing = standardTours.find((standardTour) => normalizeText(standardTour?.id) === normalizeText(standardTourId));
    if (!existing) {
      sendJson(res, 404, { error: "Standard tour not found" });
      return;
    }
    await deleteStandardTour(standardTourId);
    sendJson(res, 200, {
      deleted: true,
      standard_tour_id: normalizeText(standardTourId)
    });
  }

  async function handleApplyStandardTour(req, res, [bookingId, standardTourId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingStandardTourApplyRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const [store, standardTours] = await Promise.all([readStore(), readStandardTours()]);
    const booking = (Array.isArray(store?.bookings) ? store.bookings : []).find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const standardTour = standardTours.map((item) => normalizeStandardTourForStorage(item))
      .find((item) => item.id === standardTourId);
    if (!standardTour) {
      sendJson(res, 404, { error: "Standard tour not found" });
      return;
    }

    const nextTravelPlan = cloneStandardTourTravelPlanForBooking(standardTour.travel_plan);
    const check = validateBookingTravelPlanInput(nextTravelPlan, booking.offer);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    booking.travel_plan = check.travel_plan;
    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Travel plan replaced from standard tour ${standardTour.title}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handleListStandardTours,
    handleGetStandardTour,
    handleCreateStandardTour,
    handlePatchStandardTour,
    handleDeleteStandardTour,
    handleApplyStandardTour
  };
}
