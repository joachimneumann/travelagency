import { validateTravelPlanSegmentImportRequest } from "../../../Generated/API/generated_APIModels.js";
import {
  cloneTravelPlanLocalizedMap,
  parseTravelPlanQueryInt
} from "./booking_travel_plan_shared.js";

function copySegmentForImport(sourceSegment, options = {}) {
  const includeTranslations = options.includeTranslations !== false;
  const includeNotes = options.includeNotes !== false;
  const includeImages = options.includeImages !== false;
  const includeCustomerVisibleImagesOnly = options.includeCustomerVisibleImagesOnly === true;
  const importedAt = options.normalizeText(options.importedAt) || options.nowIso();

  const sourceImages = Array.isArray(sourceSegment?.images) ? sourceSegment.images : [];
  const importedImages = includeImages
    ? sourceImages
      .filter((image) => !includeCustomerVisibleImagesOnly || image?.is_customer_visible !== false)
      .map((image, index) => ({
        ...image,
        id: `travel_plan_segment_image_${options.randomUUID()}`,
        sort_order: index,
        is_primary: index === 0,
        created_at: importedAt
      }))
    : [];

  return {
    id: `travel_plan_segment_${options.randomUUID()}`,
    timing_kind: sourceSegment?.timing_kind || "label",
    time_label: options.normalizeText(sourceSegment?.time_label),
    time_label_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceSegment?.time_label_i18n) : undefined,
    time_point: options.normalizeText(sourceSegment?.time_point),
    kind: options.normalizeText(sourceSegment?.kind) || "other",
    title: options.normalizeText(sourceSegment?.title),
    title_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceSegment?.title_i18n) : undefined,
    details: options.normalizeText(sourceSegment?.details),
    details_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceSegment?.details_i18n) : undefined,
    location: options.normalizeText(sourceSegment?.location),
    location_i18n: includeTranslations ? cloneTravelPlanLocalizedMap(sourceSegment?.location_i18n) : undefined,
    supplier_id: options.normalizeText(sourceSegment?.supplier_id),
    start_time: options.normalizeText(sourceSegment?.start_time),
    end_time: options.normalizeText(sourceSegment?.end_time),
    financial_coverage_status: options.normalizeText(sourceSegment?.financial_coverage_status) || "not_covered",
    financial_note: includeNotes ? options.normalizeText(sourceSegment?.financial_note) : null,
    financial_note_i18n: includeNotes && includeTranslations ? cloneTravelPlanLocalizedMap(sourceSegment?.financial_note_i18n) : undefined,
    images: importedImages,
    copied_from: {
      source_type: "booking_segment",
      source_booking_id: options.normalizeText(options.sourceBookingId),
      source_day_id: options.normalizeText(options.sourceDayId),
      source_segment_id: options.normalizeText(sourceSegment?.id),
      copied_at: importedAt,
      copied_by_atp_staff_id: options.normalizeText(options.copiedByAtpStaffId)
    }
  };
}

function buildSearchResult({ booking, day, segment, supplierName = "", normalizeText }) {
  const images = Array.isArray(segment?.images) ? segment.images : [];
  const primaryImage = images.find((image) => image?.is_primary) || images.find((image) => image?.is_customer_visible !== false) || images[0] || null;
  return {
    source_booking_id: booking.id,
    source_booking_name: normalizeText(booking.name),
    source_booking_code: booking.id,
    day_number: day?.day_number || null,
    segment_id: segment.id,
    segment_kind: normalizeText(segment.kind) || null,
    title: normalizeText(segment.title),
    details: normalizeText(segment.details),
    location: normalizeText(segment.location),
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

  async function handleSearchTravelPlanSegments(req, res) {
    const principal = getPrincipal(req);
    const store = await readStore();
    const requestUrl = new URL(req.url, "http://localhost");
    const query = normalizeText(requestUrl.searchParams.get("q")).toLowerCase();
    const destination = normalizeText(requestUrl.searchParams.get("destination")).toLowerCase();
    const country = normalizeText(requestUrl.searchParams.get("country")).toUpperCase();
    const style = normalizeText(requestUrl.searchParams.get("style")).toLowerCase();
    const segmentKind = normalizeText(requestUrl.searchParams.get("segment_kind")).toLowerCase();
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
        const bookingStyles = (Array.isArray(booking?.travel_styles) ? booking.travel_styles : []).map((value) => normalizeText(value).toLowerCase()).filter(Boolean);
        if (!bookingStyles.some((value) => value.includes(style))) continue;
      }

      const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, {
        contentLang,
        flatLang: contentLang,
        strictReferences: false
      });

      for (const day of Array.isArray(normalizedTravelPlan?.days) ? normalizedTravelPlan.days : []) {
        for (const segment of Array.isArray(day?.segments) ? day.segments : []) {
          if (segmentKind && normalizeText(segment?.kind).toLowerCase() !== segmentKind) continue;
          const haystack = [
            booking.name,
            day?.title,
            day?.overnight_location,
            segment?.title,
            segment?.details,
            segment?.location
          ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
          if (query && !haystack.includes(query)) continue;
          items.push(buildSearchResult({
            booking,
            day,
            segment,
            supplierName: supplierById.get(normalizeText(segment?.supplier_id)) || "",
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

  async function handleImportTravelPlanSegment(req, res, [bookingId, dayId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanSegmentImportRequest(payload);
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
    const sourceSegmentId = normalizeText(payload.source_segment_id);
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
    const sourceDay = sourceDays.find((day) => Array.isArray(day?.segments) && day.segments.some((segment) => segment.id === sourceSegmentId));
    const sourceSegment = (Array.isArray(sourceDay?.segments) ? sourceDay.segments : []).find((segment) => segment.id === sourceSegmentId);
    if (!sourceDay || !sourceSegment) {
      sendJson(res, 404, { error: "Source segment not found" });
      return;
    }

    const targetDays = Array.isArray(targetTravelPlan?.days) ? targetTravelPlan.days : [];
    const targetDayIndex = targetDays.findIndex((day) => day.id === dayId);
    if (targetDayIndex < 0) {
      sendJson(res, 404, { error: "Target day not found" });
      return;
    }

    const importedSegment = copySegmentForImport(sourceSegment, {
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
    const targetSegments = Array.isArray(targetDay?.segments) ? [...targetDay.segments] : [];
    const insertAfterSegmentId = normalizeText(payload.insert_after_segment_id);
    if (insertAfterSegmentId) {
      const insertAfterIndex = targetSegments.findIndex((segment) => segment.id === insertAfterSegmentId);
      if (insertAfterIndex < 0) {
        sendJson(res, 422, { error: `Target segment ${insertAfterSegmentId} was not found in the target day.` });
        return;
      }
      targetSegments.splice(insertAfterIndex + 1, 0, importedSegment);
    } else {
      targetSegments.push(importedSegment);
    }

    const sourceLinks = (Array.isArray(sourceTravelPlan?.offer_component_links) ? sourceTravelPlan.offer_component_links : [])
      .filter((link) => link.travel_plan_segment_id === sourceSegmentId);
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
          travel_plan_segment_id: importedSegment.id,
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
            segments: targetSegments
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
      `Travel plan segment imported from booking ${sourceBookingId}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(targetBooking, req));
  }

  return {
    handleSearchTravelPlanSegments,
    handleImportTravelPlanSegment
  };
}
