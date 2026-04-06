import {
  validateBookingTravelPlanTemplateApplyRequest,
  validateTravelPlanTemplateUpsertRequest
} from "../../../Generated/API/generated_APIModels.js";
import {
  extractTravelPlanPdfPersonalization,
  normalizeBookingPdfPersonalization,
  replaceTravelPlanPdfPersonalization
} from "../../lib/booking_pdf_personalization.js";

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
    normalizeTourStyleCode,
    nowIso,
    randomUUID,
    buildTravelPlanTemplateReadModel,
    normalizeTravelPlanTemplateForStorage,
    normalizeTravelPlanTemplateStatus,
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
      template: buildTravelPlanTemplateReadModel(template, options)
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

  function filterTemplates(items, query, { bookingById }) {
    const normalizedQuery = normalizeText(query.get("q")).toLowerCase();
    const status = normalizeTravelPlanTemplateStatus(query.get("status"));
    const hasStatus = normalizeText(query.get("status"));
    const destination = normalizeTourDestinationCode(query.get("destination"));
    const style = normalizeTourStyleCode(query.get("style"));

    return items.filter((template) => {
      const stored = normalizeTravelPlanTemplateForStorage(template);
      if (hasStatus && stored.status !== status) return false;
      if (destination && !stored.destinations.includes(destination)) return false;
      if (style && !stored.travel_styles.includes(style)) return false;
      if (!normalizedQuery) return true;
      const sourceBookingName = normalizeText(bookingById.get(stored.source_booking_id)?.name);
      const haystack = [
        stored.title,
        stored.description,
        stored.source_booking_id,
        sourceBookingName
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

  async function handleListTravelPlanTemplates(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTravelPlanTemplates(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const [templates, store] = await Promise.all([readTravelPlanTemplates(), readStore()]);
    const requestUrl = new URL(req.url, "http://localhost");
    const page = parsePositiveInt(requestUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(100, parsePositiveInt(requestUrl.searchParams.get("page_size"), 20));
    const bookingById = new Map((Array.isArray(store?.bookings) ? store.bookings : []).map((booking) => [booking.id, booking]));
    const filtered = filterTemplates(templates, requestUrl.searchParams, { bookingById })
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize).map((template) => {
      const stored = normalizeTravelPlanTemplateForStorage(template);
      const sourceBooking = bookingById.get(stored.source_booking_id);
      const sourceBookingName = sourceBooking && canAccessBooking(principal, sourceBooking)
        ? normalizeText(sourceBooking.name)
        : "";
      return buildTravelPlanTemplateReadModel(stored, { sourceBookingName });
    });
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
    const [templates, store] = await Promise.all([readTravelPlanTemplates(), readStore()]);
    const stored = templates.map((template) => normalizeTravelPlanTemplateForStorage(template))
      .find((template) => template.id === templateId);
    if (!stored) {
      sendJson(res, 404, { error: "Travel plan template not found" });
      return;
    }
    const sourceBooking = (Array.isArray(store?.bookings) ? store.bookings : []).find((booking) => booking.id === stored.source_booking_id);
    const sourceBookingName = sourceBooking && canAccessBooking(principal, sourceBooking)
      ? normalizeText(sourceBooking.name)
      : "";
    sendJson(res, 200, buildTemplateResponse(stored, { sourceBookingName }));
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

    const store = await readStore();
    const title = normalizeText(payload?.title);
    if (!title) {
      sendJson(res, 422, { error: "title is required" });
      return;
    }

    let nextTravelPlan = null;
    let nextPdfPersonalization = {};
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
      nextPdfPersonalization = extractTravelPlanPdfPersonalization(sourceContext.booking?.pdf_personalization);
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
      description: payload?.description,
      status: payload?.status,
      destinations: payload?.destinations,
      travel_styles: payload?.travel_styles,
      source_booking_id: sourceBookingId || null,
      created_by_atp_staff_id: normalizeText(principal?.sub),
      travel_plan: nextTravelPlan,
      pdf_personalization: nextPdfPersonalization,
      created_at: nowIso(),
      updated_at: nowIso()
    });
    await persistTravelPlanTemplate(template);
    sendJson(res, 201, buildTemplateResponse(template, {
      sourceBookingName: normalizeText((Array.isArray(store?.bookings) ? store.bookings : []).find((booking) => booking.id === template.source_booking_id)?.name)
    }));
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

    let nextTravelPlan = existing.travel_plan;
    let nextSourceBookingId = existing.source_booking_id;
    let nextPdfPersonalization = existing.pdf_personalization;
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
      nextSourceBookingId = requestedSourceBookingId;
      nextPdfPersonalization = extractTravelPlanPdfPersonalization(sourceContext.booking?.pdf_personalization);
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
      title: payload?.title !== undefined ? payload.title : existing.title,
      description: payload?.description !== undefined ? payload.description : existing.description,
      status: payload?.status !== undefined ? payload.status : existing.status,
      destinations: payload?.destinations !== undefined ? payload.destinations : existing.destinations,
      travel_styles: payload?.travel_styles !== undefined ? payload.travel_styles : existing.travel_styles,
      source_booking_id: nextSourceBookingId,
      travel_plan: nextTravelPlan,
      pdf_personalization: nextPdfPersonalization,
      updated_at: nowIso()
    });
    await persistTravelPlanTemplate(updated);
    const sourceBooking = (Array.isArray(store?.bookings) ? store.bookings : []).find((booking) => booking.id === updated.source_booking_id);
    sendJson(res, 200, buildTemplateResponse(updated, {
      sourceBookingName: sourceBooking && canAccessBooking(principal, sourceBooking) ? normalizeText(sourceBooking.name) : ""
    }));
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
    if (template.status !== "published") {
      sendJson(res, 422, { error: "Only published travel plan templates can be applied." });
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

    const currentPdfPersonalization = normalizeBookingPdfPersonalization(booking?.pdf_personalization);
    const nextPdfPersonalization = replaceTravelPlanPdfPersonalization(
      booking?.pdf_personalization,
      template?.pdf_personalization
    );
    const pdfPersonalizationChanged = JSON.stringify(nextPdfPersonalization) !== JSON.stringify(currentPdfPersonalization);

    booking.travel_plan = check.travel_plan;
    incrementBookingRevision(booking, "travel_plan_revision");
    booking.pdf_personalization = nextPdfPersonalization;
    if (pdfPersonalizationChanged) {
      incrementBookingRevision(booking, "core_revision");
    }
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
