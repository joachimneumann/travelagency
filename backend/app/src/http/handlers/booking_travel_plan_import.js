import { validateTravelPlanServiceImportRequest } from "../../../Generated/API/generated_APIModels.js";
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

  const sourceImages = Array.isArray(sourceItem?.images) ? sourceItem.images : [];
  const importedImages = includeImages
    ? sourceImages
      .filter((image) => !includeCustomerVisibleImagesOnly || image?.is_customer_visible !== false)
      .map((image, index) => ({
        ...image,
        id: `travel_plan_service_image_${options.randomUUID()}`,
        sort_order: index,
        is_primary: index === 0,
        created_at: importedAt
      }))
    : [];

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
    financial_coverage_status: options.normalizeText(sourceItem?.financial_coverage_status) || "not_covered",
    financial_note: includeNotes ? options.normalizeText(sourceItem?.financial_note) : null,
    financial_note_i18n: includeNotes && includeTranslations ? cloneTravelPlanLocalizedMap(sourceItem?.financial_note_i18n) : undefined,
    images: importedImages,
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

function buildSearchResult({ booking, day, item, supplierName = "", normalizeText }) {
  const images = Array.isArray(item?.images) ? item.images : [];
  const primaryImage = images.find((image) => image?.is_primary) || images.find((image) => image?.is_customer_visible !== false) || images[0] || null;
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
    image_count: images.length,
    supplier_name: normalizeText(supplierName),
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

  return {
    handleSearchTravelPlanServices,
    handleImportTravelPlanService
  };
}
