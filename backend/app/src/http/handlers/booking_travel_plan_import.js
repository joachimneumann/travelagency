import {
  validateTravelPlanDayImportRequest,
  validateTravelPlanServiceImportRequest
} from "../../../Generated/API/generated_APIModels.js";
import { normalizeTourStyleCode } from "../../domain/tour_catalog_i18n.js";
import {
  cloneTravelPlanLocalizedMap,
  parseTravelPlanQueryInt
} from "./booking_travel_plan_shared.js";

function copyItemForImport(sourceItem, options = {}) {
  const includeTranslations = options.includeTranslations !== false;
  const includeNotes = options.includeNotes !== false;
  const includeImages = options.includeImages !== false;
  const includeCustomerVisibleImagesOnly = options.includeCustomerVisibleImagesOnly === true;
  const importedAt = options.normalizeText(options.importedAt) || options.nowIso();

  const sourceImage = sourceItem?.image && typeof sourceItem.image === "object" && !Array.isArray(sourceItem.image)
    ? sourceItem.image
    : (
      Array.isArray(sourceItem?.images)
        ? sourceItem.images.find((image) => image?.is_primary) || sourceItem.images[0] || null
        : null
    );
  const importedImage = includeImages && sourceImage && (!includeCustomerVisibleImagesOnly || sourceImage?.is_customer_visible !== false)
    ? {
      ...sourceImage,
      id: `travel_plan_service_image_${options.randomUUID()}`,
      sort_order: 0,
      is_primary: true,
      created_at: importedAt
    }
    : null;

  return {
    id: `travel_plan_service_${options.randomUUID()}`,
    timing_kind: sourceItem?.timing_kind || "label",
    time_label: options.normalizeText(sourceItem?.time_label),
    time_label_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceItem?.time_label_i18n) : undefined,
    time_point: options.normalizeText(sourceItem?.time_point),
    kind: options.normalizeText(sourceItem?.kind) || "other",
    title: options.normalizeText(sourceItem?.title),
    title_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceItem?.title_i18n) : undefined,
    details: options.normalizeText(sourceItem?.details),
    details_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceItem?.details_i18n) : undefined,
    location: options.normalizeText(sourceItem?.location),
    location_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceItem?.location_i18n) : undefined,
    supplier_id: options.normalizeText(sourceItem?.supplier_id),
    start_time: options.normalizeText(sourceItem?.start_time),
    end_time: options.normalizeText(sourceItem?.end_time),
    financial_coverage_needed: sourceItem?.financial_coverage_needed !== false,
    financial_coverage_status: options.normalizeText(sourceItem?.financial_coverage_status) || "not_covered",
    financial_note: includeNotes ? options.normalizeText(sourceItem?.financial_note) : null,
    financial_note_i18n: includeNotes && includeTranslations ? cloneTravelPlanLocalizedMap(sourceItem?.financial_note_i18n) : undefined,
    image: importedImage,
    copied_from: {
      source_type: "booking_travel_plan_service",
      source_booking_id: options.normalizeText(options.sourceBookingId),
      source_day_id: options.normalizeText(options.sourceDayId),
      source_service_id: options.normalizeText(sourceItem?.id),
      copied_at: importedAt,
      copied_by_atp_staff_id: options.normalizeText(options.copiedByAtpStaffId)
    }
  };
}

function normalizeDateOnly(value, normalizeText) {
  const normalized = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function nextIsoDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return "";
  }
  candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString().slice(0, 10);
}

function copyDayForImport(sourceDay, options = {}) {
  const includeTranslations = options.includeTranslations !== false;
  const includeNotes = options.includeNotes !== false;
  const includeImages = options.includeImages !== false;
  const includeCustomerVisibleImagesOnly = options.includeCustomerVisibleImagesOnly === true;
  const importedAt = options.normalizeText(options.importedAt) || options.nowIso();
  const services = (Array.isArray(sourceDay?.services) ? sourceDay.services : []).map((sourceItem) => {
    const importedItem = copyItemForImport(sourceItem, {
      ...options,
      includeTranslations,
      includeNotes,
      includeImages,
      includeCustomerVisibleImagesOnly,
      importedAt
    });
    return {
      ...importedItem,
      timing_kind: importedItem.timing_kind === "point" || importedItem.timing_kind === "range"
        ? "label"
        : importedItem.timing_kind,
      time_point: null,
      start_time: null,
      end_time: null,
      financial_coverage_needed: false,
      financial_note: null,
      financial_note_i18n: includeTranslations ? {} : undefined
    };
  });

  return {
    id: `travel_plan_day_${options.randomUUID()}`,
    day_number: 1,
    date: options.normalizeText(options.targetDate) || null,
    title: options.normalizeText(sourceDay?.title),
    title_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceDay?.title_i18n) : undefined,
    overnight_location: options.normalizeText(sourceDay?.overnight_location),
    overnight_location_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceDay?.overnight_location_i18n) : undefined,
    notes: includeNotes ? options.normalizeText(sourceDay?.notes) : null,
    notes_i18n: includeNotes && includeTranslations ? cloneTravelPlanLocalizedMap(sourceDay?.notes_i18n) : undefined,
    services
  };
}

function buildSearchResult({ booking, day, item, supplierName = "", normalizeText }) {
  const primaryImage = item?.image && typeof item.image === "object" && !Array.isArray(item.image)
    ? item.image
    : (
      Array.isArray(item?.images)
        ? item.images.find((image) => image?.is_primary) || item.images.find((image) => image?.is_customer_visible !== false) || item.images[0] || null
        : null
    );
  return {
    source_booking_id: booking.id,
    source_booking_name: normalizeText(booking.name),
    source_booking_code: booking.id,
    day_number: day?.day_number || null,
    service_id: item.id,
    service_kind: normalizeText(item.kind) || null,
    title: normalizeText(item.title),
    details: normalizeText(item.details),
    location: normalizeText(item.location),
    overnight_location: normalizeText(day?.overnight_location),
    thumbnail_url: normalizeText(primaryImage?.storage_path),
    image_count: primaryImage ? 1 : 0,
    supplier_name: normalizeText(supplierName),
    updated_at: normalizeText(booking.updated_at || booking.created_at)
  };
}

function buildDaySearchResult({ booking, day, normalizeText }) {
  const services = Array.isArray(day?.services) ? day.services : [];
  const primaryItem = services[0] || null;
  const primaryImage = primaryItem?.image && typeof primaryItem.image === "object" && !Array.isArray(primaryItem.image)
    ? primaryItem.image
    : (
      Array.isArray(primaryItem?.images)
        ? primaryItem.images.find((image) => image?.is_primary) || primaryItem.images.find((image) => image?.is_customer_visible !== false) || primaryItem.images[0] || null
        : null
    );
  return {
    source_booking_id: booking.id,
    source_booking_name: normalizeText(booking.name),
    source_booking_code: booking.id,
    day_id: normalizeText(day?.id),
    day_number: day?.day_number || null,
    title: normalizeText(day?.title),
    overnight_location: normalizeText(day?.overnight_location),
    notes: normalizeText(day?.notes),
    thumbnail_url: normalizeText(primaryImage?.storage_path),
    service_count: services.length,
    image_count: primaryImage ? 1 : 0,
    updated_at: normalizeText(booking.updated_at || booking.created_at)
  };
}

export function createBookingTravelPlanImportHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    canAccessBooking,
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
    randomUUID
  } = deps;

  async function handleSearchTravelPlanServices(req, res) {
    const principal = getPrincipal(req);
    const store = await readStore();
    const requestUrl = new URL(req.url, "http://localhost");
    const query = normalizeText(requestUrl.searchParams.get("q")).toLowerCase();
    const destination = normalizeText(requestUrl.searchParams.get("destination")).toLowerCase();
    const country = normalizeText(requestUrl.searchParams.get("country")).toUpperCase();
    const style = normalizeTourStyleCode(requestUrl.searchParams.get("style"));
    const serviceKind = normalizeText(requestUrl.searchParams.get("service_kind")).toLowerCase();
    const limit = parseTravelPlanQueryInt(requestUrl.searchParams.get("limit"), 20, { min: 1, max: 50 });
    const offset = parseTravelPlanQueryInt(requestUrl.searchParams.get("offset"), 0, { min: 0, max: 5000 });
    const contentLang = requestContentLang(req);
    const supplierById = new Map(
      (Array.isArray(store.suppliers) ? store.suppliers : [])
        .map((supplier) => [normalizeText(supplier?.id), normalizeText(supplier?.name)])
        .filter(([id]) => id)
    );

    const items = [];
    for (const booking of Array.isArray(store.bookings) ? store.bookings : []) {
      if (!canAccessBooking(principal, booking)) continue;
      if (country) {
        const bookingCountries = new Set((Array.isArray(booking?.destinations) ? booking.destinations : []).map((code) => normalizeText(code).toUpperCase()).filter(Boolean));
        if (!bookingCountries.has(country)) continue;
      }
      if (destination) {
        const bookingDestinations = [
          ...(Array.isArray(booking?.destinations) ? booking.destinations : []),
          ...(Array.isArray(booking?.web_form_submission?.destinations) ? booking.web_form_submission.destinations : [])
        ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean);
        if (!bookingDestinations.some((value) => value.includes(destination))) continue;
      }
      if (style) {
        const bookingStyles = (Array.isArray(booking?.travel_styles) ? booking.travel_styles : [])
          .map((value) => normalizeTourStyleCode(value))
          .filter(Boolean);
        if (!bookingStyles.includes(style)) continue;
      }

      const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, {
        contentLang,
        flatLang: contentLang,
        strictReferences: false
      });

      for (const day of Array.isArray(normalizedTravelPlan?.days) ? normalizedTravelPlan.days : []) {
        for (const item of Array.isArray(day?.services) ? day.services : []) {
          if (serviceKind && normalizeText(item?.kind).toLowerCase() !== serviceKind) continue;
          const haystack = [
            booking.name,
            day?.title,
            day?.overnight_location,
            item?.title,
            item?.details,
            item?.location
          ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
          if (query && !haystack.includes(query)) continue;
          items.push(buildSearchResult({
            booking,
            day,
            item,
            supplierName: supplierById.get(normalizeText(item?.supplier_id)) || "",
            normalizeText
          }));
        }
      }
    }

    items.sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
    sendJson(res, 200, {
      items: items.slice(offset, offset + limit),
      total: items.length
    });
  }

  async function handleSearchTravelPlanDays(req, res) {
    const principal = getPrincipal(req);
    const store = await readStore();
    const requestUrl = new URL(req.url, "http://localhost");
    const query = normalizeText(requestUrl.searchParams.get("q")).toLowerCase();
    const destination = normalizeText(requestUrl.searchParams.get("destination")).toLowerCase();
    const country = normalizeText(requestUrl.searchParams.get("country")).toUpperCase();
    const style = normalizeTourStyleCode(requestUrl.searchParams.get("style"));
    const limit = parseTravelPlanQueryInt(requestUrl.searchParams.get("limit"), 20, { min: 1, max: 50 });
    const offset = parseTravelPlanQueryInt(requestUrl.searchParams.get("offset"), 0, { min: 0, max: 5000 });
    const contentLang = requestContentLang(req);

    const items = [];
    for (const booking of Array.isArray(store.bookings) ? store.bookings : []) {
      if (!canAccessBooking(principal, booking)) continue;
      if (country) {
        const bookingCountries = new Set((Array.isArray(booking?.destinations) ? booking.destinations : []).map((code) => normalizeText(code).toUpperCase()).filter(Boolean));
        if (!bookingCountries.has(country)) continue;
      }
      if (destination) {
        const bookingDestinations = [
          ...(Array.isArray(booking?.destinations) ? booking.destinations : []),
          ...(Array.isArray(booking?.web_form_submission?.destinations) ? booking.web_form_submission.destinations : [])
        ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean);
        if (!bookingDestinations.some((value) => value.includes(destination))) continue;
      }
      if (style) {
        const bookingStyles = (Array.isArray(booking?.travel_styles) ? booking.travel_styles : [])
          .map((value) => normalizeTourStyleCode(value))
          .filter(Boolean);
        if (!bookingStyles.includes(style)) continue;
      }

      const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, {
        contentLang,
        flatLang: contentLang,
        strictReferences: false
      });

      for (const day of Array.isArray(normalizedTravelPlan?.days) ? normalizedTravelPlan.days : []) {
        const services = Array.isArray(day?.services) ? day.services : [];
        if (!services.length) continue;
        const haystack = [
          booking.name,
          day?.title,
          day?.overnight_location,
          day?.notes,
          ...services.flatMap((item) => [item?.title, item?.details, item?.location])
        ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
        if (query && !haystack.includes(query)) continue;
        items.push(buildDaySearchResult({ booking, day, normalizeText }));
      }
    }

    items.sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
    sendJson(res, 200, {
      items: items.slice(offset, offset + limit),
      total: items.length
    });
  }

  async function handleImportTravelPlanService(req, res, [bookingId, dayId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanServiceImportRequest(payload);
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

    const sourceBookingId = normalizeText(payload.source_booking_id);
    const sourceItemId = normalizeText(payload.source_service_id) || normalizeText(payload.source_item_id);
    const sourceBooking = store.bookings.find((item) => item.id === sourceBookingId);
    if (!sourceBooking || !canAccessBooking(principal, sourceBooking)) {
      sendJson(res, 404, { error: "Source booking not found" });
      return;
    }

    const contentLang = requestContentLang(req, payload);
    const sourceTravelPlan = normalizeBookingTravelPlan(sourceBooking.travel_plan, sourceBooking.offer, {
      contentLang,
      flatLang: contentLang,
      strictReferences: false
    });
    const targetTravelPlan = normalizeBookingTravelPlan(targetBooking.travel_plan, targetBooking.offer, {
      contentLang,
      flatLang: contentLang,
      strictReferences: false
    });

    const sourceDays = Array.isArray(sourceTravelPlan?.days) ? sourceTravelPlan.days : [];
    const sourceDay = sourceDays.find((day) => Array.isArray(day?.services) && day.services.some((item) => item.id === sourceItemId));
    const sourceItem = (Array.isArray(sourceDay?.services) ? sourceDay.services : []).find((item) => item.id === sourceItemId);
    if (!sourceDay || !sourceItem) {
      sendJson(res, 404, { error: "Source service not found" });
      return;
    }

    const targetDays = Array.isArray(targetTravelPlan?.days) ? targetTravelPlan.days : [];
    const targetDayIndex = targetDays.findIndex((day) => day.id === dayId);
    if (targetDayIndex < 0) {
      sendJson(res, 404, { error: "Target day not found" });
      return;
    }

    const importedItem = copyItemForImport(sourceItem, {
      includeTranslations: payload.include_translations !== false,
      includeNotes: payload.include_notes !== false,
      includeImages: payload.include_images !== false,
      includeCustomerVisibleImagesOnly: payload.include_customer_visible_images_only === true,
      sourceBookingId,
      sourceDayId: sourceDay.id,
      copiedByAtpStaffId: normalizeText(principal?.sub),
      importedAt: nowIso(),
      normalizeText,
      nowIso,
      randomUUID
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

    const sourceLinks = (Array.isArray(sourceTravelPlan?.offer_component_links) ? sourceTravelPlan.offer_component_links : [])
      .filter((link) => link.travel_plan_service_id === sourceItemId);
    const targetOfferComponentIds = new Set(
      (Array.isArray(targetBooking?.offer?.components) ? targetBooking.offer.components : [])
        .map((component) => normalizeText(component?.id))
        .filter(Boolean)
    );
    const importedLinks = payload.include_offer_links === true
      ? sourceLinks
        .filter((link) => targetOfferComponentIds.has(normalizeText(link.offer_component_id)))
        .map((link) => ({
          id: `travel_plan_offer_link_${randomUUID()}`,
          travel_plan_service_id: importedItem.id,
          offer_component_id: normalizeText(link.offer_component_id),
          coverage_type: normalizeText(link.coverage_type) || "full"
        }))
      : [];

    const nextTravelPlan = {
      ...targetTravelPlan,
      days: targetDays.map((day, index) => (
        index === targetDayIndex
          ? {
            ...day,
            services: targetItems
          }
          : day
      )),
      offer_component_links: [
        ...(Array.isArray(targetTravelPlan?.offer_component_links) ? targetTravelPlan.offer_component_links : []),
        ...importedLinks
      ]
    };

    const check = validateBookingTravelPlanInput(
      nextTravelPlan,
      targetBooking.offer,
      {
        supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
      }
    );
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
      `Service imported from booking ${sourceBookingId}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(targetBooking, req));
  }

  async function handleImportTravelPlanDay(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanDayImportRequest(payload);
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

    const sourceBookingId = normalizeText(payload.source_booking_id);
    const sourceDayId = normalizeText(payload.source_day_id);
    const sourceBooking = store.bookings.find((item) => item.id === sourceBookingId);
    if (!sourceBooking || !canAccessBooking(principal, sourceBooking)) {
      sendJson(res, 404, { error: "Source booking not found" });
      return;
    }

    const contentLang = requestContentLang(req, payload);
    const sourceTravelPlan = normalizeBookingTravelPlan(sourceBooking.travel_plan, sourceBooking.offer, {
      contentLang,
      flatLang: contentLang,
      strictReferences: false
    });
    const targetTravelPlan = normalizeBookingTravelPlan(targetBooking.travel_plan, targetBooking.offer, {
      contentLang,
      flatLang: contentLang,
      strictReferences: false
    });

    const sourceDay = (Array.isArray(sourceTravelPlan?.days) ? sourceTravelPlan.days : []).find((day) => day.id === sourceDayId);
    if (!sourceDay) {
      sendJson(res, 404, { error: "Source day not found" });
      return;
    }

    const targetDays = Array.isArray(targetTravelPlan?.days) ? [...targetTravelPlan.days] : [];
    const lastTargetDay = targetDays[targetDays.length - 1] || null;
    const lastTargetDate = normalizeDateOnly(lastTargetDay?.date, normalizeText);
    const copiedDayDate = lastTargetDate ? nextIsoDate(lastTargetDate) : "";
    const importedDay = copyDayForImport(sourceDay, {
      includeTranslations: payload.include_translations !== false,
      includeNotes: payload.include_notes !== false,
      includeImages: payload.include_images !== false,
      includeCustomerVisibleImagesOnly: payload.include_customer_visible_images_only === true,
      sourceBookingId,
      sourceDayId: sourceDay.id,
      copiedByAtpStaffId: normalizeText(principal?.sub),
      importedAt: nowIso(),
      targetDate: copiedDayDate,
      normalizeText,
      nowIso,
      randomUUID
    });

    const nextTravelPlan = {
      ...targetTravelPlan,
      days: [...targetDays, importedDay],
      offer_component_links: Array.isArray(targetTravelPlan?.offer_component_links) ? targetTravelPlan.offer_component_links : []
    };

    const check = validateBookingTravelPlanInput(
      nextTravelPlan,
      targetBooking.offer,
      {
        supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
      }
    );
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
      `Day imported from booking ${sourceBookingId}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(targetBooking, req));
  }

  return {
    handleSearchTravelPlanDays,
    handleSearchTravelPlanServices,
    handleImportTravelPlanDay,
    handleImportTravelPlanService
  };
}
