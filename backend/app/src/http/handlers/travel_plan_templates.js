import {
  validateBookingTravelPlanTemplateApplyRequest,
  validateTravelPlanTemplateUpsertRequest
} from "../../../Generated/API/generated_APIModels.js";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createTravelPlanTemplateHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    readTravelPlanTemplates,
    persistTravelPlanTemplate,
    deleteTravelPlanTemplate,
    getPrincipal,
    canReadTravelPlanTemplates,
    canEditTravelPlanTemplates,
    canAccessBooking,
    canEditBooking,
    normalizeText,
    normalizeTourDestinationCode,
    nowIso,
    randomUUID,
    buildTravelPlanTemplateReadModel,
    normalizeTravelPlanTemplateForStorage,
    cloneBookingTravelPlanAsTemplate,
    cloneTemplateTravelPlanForBooking,
    normalizeTemplateTravelPlan,
    validateBookingTravelPlanInput,
    normalizeBookingTravelPlan,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    persistStore,
    addActivity,
    actorLabel
  } = deps;

  function buildTemplateResponse(template, options = {}) {
    return {
      template: buildTravelPlanTemplateReadModel(template)
    };
  }

  function findSourceBookingContext(store, principal, sourceBookingId) {
    const booking = (Array.isArray(store?.bookings) ? store.bookings : []).find((item) => item.id === sourceBookingId) || null;
    if (!booking) return { booking: null, accessible: false };
    return {
      booking,
      accessible: canAccessBooking(principal, booking)
    };
  }

  function filterTemplates(items, query) {
    const normalizedQuery = normalizeText(query.get("q")).toLowerCase();
    const destination = normalizeTourDestinationCode(query.get("destination"));

    return items.filter((template) => {
      const stored = normalizeTravelPlanTemplateForStorage(template);
      if (destination && !stored.destinations.includes(destination)) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        stored.title,
        ...stored.destinations
      ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
      return haystack.includes(normalizedQuery);
    });
  }

  function validateTemplateTravelPlan(rawTravelPlan, store) {
    const normalized = normalizeTemplateTravelPlan(rawTravelPlan);
    const check = validateBookingTravelPlanInput(normalized, null, {
      supplierIds: Array.isArray(store?.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
    });
    if (!check.ok) return check;
    return {
      ok: true,
      travel_plan: {
        ...check.travel_plan,
        attachments: []
      }
    };
  }

  function normalizeTemplateTitleKey(value) {
    return normalizeText(value).toLowerCase();
  }

  function findTemplateByTitle(templates, title, excludedTemplateId = "") {
    const titleKey = normalizeTemplateTitleKey(title);
    const excludedId = normalizeText(excludedTemplateId);
    if (!titleKey) return null;
    return (Array.isArray(templates) ? templates : [])
      .map((template) => normalizeTravelPlanTemplateForStorage(template))
      .find((template) => (
        template.id !== excludedId
        && normalizeTemplateTitleKey(template.title) === titleKey
      )) || null;
  }

  async function handleListTravelPlanTemplates(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTravelPlanTemplates(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const templates = await readTravelPlanTemplates();
    const requestUrl = new URL(req.url, "http://localhost");
    const page = parsePositiveInt(requestUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(100, parsePositiveInt(requestUrl.searchParams.get("page_size"), 20));
    const filtered = filterTemplates(templates, requestUrl.searchParams)
      .sort((left, right) => String(left.title || "").localeCompare(String(right.title || "")));
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize).map((template) => buildTravelPlanTemplateReadModel(template));
    sendJson(res, 200, {
      items,
      total: filtered.length
    });
  }

  async function handleGetTravelPlanTemplate(req, res, [templateId]) {
    const principal = getPrincipal(req);
    if (!canReadTravelPlanTemplates(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const templates = await readTravelPlanTemplates();
    const stored = templates.map((template) => normalizeTravelPlanTemplateForStorage(template))
      .find((template) => template.id === templateId);
    if (!stored) {
      sendJson(res, 404, { error: "Travel plan template not found" });
      return;
    }
    sendJson(res, 200, buildTemplateResponse(stored));
  }

  async function handleCreateTravelPlanTemplate(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanTemplateUpsertRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditTravelPlanTemplates(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const [store, templates] = await Promise.all([readStore(), readTravelPlanTemplates()]);
    const title = normalizeText(payload?.title);
    if (!title) {
      sendJson(res, 422, { error: "title is required" });
      return;
    }
    if (findTemplateByTitle(templates, title)) {
      sendJson(res, 409, { error: "A standard tour with this title already exists." });
      return;
    }

    let nextTravelPlan = null;
    const sourceBookingId = normalizeText(payload?.source_booking_id);
    if (sourceBookingId) {
      const sourceContext = findSourceBookingContext(store, principal, sourceBookingId);
      if (!sourceContext.booking || !sourceContext.accessible) {
        sendJson(res, 404, { error: "Source booking not found" });
        return;
      }
      const sourcePlan = normalizeBookingTravelPlan(sourceContext.booking.travel_plan, sourceContext.booking.offer, {
        strictReferences: false
      });
      if (!Array.isArray(sourcePlan?.days) || !sourcePlan.days.length) {
        sendJson(res, 422, { error: "Source booking does not have a travel plan yet." });
        return;
      }
      nextTravelPlan = cloneBookingTravelPlanAsTemplate(sourcePlan);
    } else if (payload?.travel_plan) {
      const check = validateTemplateTravelPlan(payload.travel_plan, store);
      if (!check.ok) {
        sendJson(res, 422, { error: check.error });
        return;
      }
      nextTravelPlan = check.travel_plan;
    } else {
      sendJson(res, 422, { error: "source_booking_id or travel_plan is required" });
      return;
    }

    const template = normalizeTravelPlanTemplateForStorage({
      id: `travel_plan_template_${randomUUID()}`,
      title,
      destinations: payload?.destinations,
      travel_plan: nextTravelPlan
    });
    await persistTravelPlanTemplate(template);
    sendJson(res, 201, buildTemplateResponse(template));
  }

  async function handlePatchTravelPlanTemplate(req, res, [templateId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanTemplateUpsertRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditTravelPlanTemplates(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const [templates, store] = await Promise.all([readTravelPlanTemplates(), readStore()]);
    const existing = templates.map((template) => normalizeTravelPlanTemplateForStorage(template))
      .find((template) => template.id === templateId);
    if (!existing) {
      sendJson(res, 404, { error: "Travel plan template not found" });
      return;
    }
    const nextTitle = payload?.title !== undefined ? normalizeText(payload.title) : normalizeText(existing.title);
    if (!nextTitle) {
      sendJson(res, 422, { error: "title is required" });
      return;
    }
    if (findTemplateByTitle(templates, nextTitle, templateId)) {
      sendJson(res, 409, { error: "A standard tour with this title already exists." });
      return;
    }

    let nextTravelPlan = existing.travel_plan;
    const requestedSourceBookingId = normalizeText(payload?.source_booking_id);
    if (requestedSourceBookingId) {
      const sourceContext = findSourceBookingContext(store, principal, requestedSourceBookingId);
      if (!sourceContext.booking || !sourceContext.accessible) {
        sendJson(res, 404, { error: "Source booking not found" });
        return;
      }
      const sourcePlan = normalizeBookingTravelPlan(sourceContext.booking.travel_plan, sourceContext.booking.offer, {
        strictReferences: false
      });
      if (!Array.isArray(sourcePlan?.days) || !sourcePlan.days.length) {
        sendJson(res, 422, { error: "Source booking does not have a travel plan yet." });
        return;
      }
      nextTravelPlan = cloneBookingTravelPlanAsTemplate(sourcePlan);
    } else if (payload?.travel_plan) {
      const check = validateTemplateTravelPlan(payload.travel_plan, store);
      if (!check.ok) {
        sendJson(res, 422, { error: check.error });
        return;
      }
      nextTravelPlan = check.travel_plan;
    }

    const updated = normalizeTravelPlanTemplateForStorage({
      ...existing,
      title: nextTitle,
      destinations: payload?.destinations !== undefined ? payload.destinations : existing?.travel_plan?.destinations,
      travel_plan: nextTravelPlan
    });
    await persistTravelPlanTemplate(updated);
    sendJson(res, 200, buildTemplateResponse(updated));
  }

  async function handleDeleteTravelPlanTemplate(req, res, [templateId]) {
    const principal = getPrincipal(req);
    if (!canEditTravelPlanTemplates(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const templates = await readTravelPlanTemplates();
    const existing = templates.find((template) => normalizeText(template?.id) === normalizeText(templateId));
    if (!existing) {
      sendJson(res, 404, { error: "Travel plan template not found" });
      return;
    }
    await deleteTravelPlanTemplate(templateId);
    sendJson(res, 200, {
      deleted: true,
      template_id: normalizeText(templateId)
    });
  }

  async function handleApplyTravelPlanTemplate(req, res, [bookingId, templateId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingTravelPlanTemplateApplyRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const [store, templates] = await Promise.all([readStore(), readTravelPlanTemplates()]);
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

    const template = templates.map((item) => normalizeTravelPlanTemplateForStorage(item))
      .find((item) => item.id === templateId);
    if (!template) {
      sendJson(res, 404, { error: "Travel plan template not found" });
      return;
    }

    const nextTravelPlan = cloneTemplateTravelPlanForBooking(template.travel_plan);
    const check = validateBookingTravelPlanInput(nextTravelPlan, booking.offer, {
      supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
    });
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
      `Travel plan replaced from template ${template.title}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handleListTravelPlanTemplates,
    handleGetTravelPlanTemplate,
    handleCreateTravelPlanTemplate,
    handlePatchTravelPlanTemplate,
    handleDeleteTravelPlanTemplate,
    handleApplyTravelPlanTemplate
  };
}
