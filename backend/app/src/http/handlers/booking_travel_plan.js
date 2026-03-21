import {
  validateTravelPlanSegmentImageDeleteRequest,
  validateTravelPlanSegmentImageReorderRequest,
  validateTravelPlanSegmentImageUploadRequest,
  validateTravelPlanSegmentImportRequest,
  validateBookingTravelPlanTranslateRequest,
  validateBookingTravelPlanUpdateRequest
} from "../../../Generated/API/generated_APIModels.js";
import {
  mergeEditableLocalizedTextField,
  mergeLocalizedTextField,
  normalizeBookingContentLang
} from "../../domain/booking_content_i18n.js";
import {
  markTravelPlanTranslationManual,
  translateTravelPlanFromEnglish
} from "../../domain/booking_translation.js";

export function createBookingTravelPlanHandlers(deps) {
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
    translateEntries,
    path,
    randomUUID,
    TEMP_UPLOAD_DIR,
    BOOKING_IMAGES_DIR,
    writeFile,
    rm,
    processBookingImageToWebp
  } = deps;

  function requestContentLang(req, payload = null) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingContentLang(payload?.lang || requestUrl.searchParams.get("lang") || "en");
    } catch {
      return normalizeBookingContentLang(payload?.lang || "en");
    }
  }

  function mergeTravelPlanForLang(existingTravelPlan, nextTravelPlan, offer, lang) {
    const normalizedLang = normalizeBookingContentLang(lang);
    const existingNormalized = normalizeBookingTravelPlan(existingTravelPlan, offer, {
      contentLang: normalizedLang,
      flatLang: normalizedLang,
      strictReferences: false
    });
    const nextNormalized = normalizeBookingTravelPlan(nextTravelPlan, offer, {
      contentLang: normalizedLang,
      flatLang: normalizedLang,
      strictReferences: false
    });
    const existingDaysById = new Map(
      (Array.isArray(existingNormalized?.days) ? existingNormalized.days : []).map((day) => [day.id, day])
    );

    return {
      ...nextNormalized,
      days: (Array.isArray(nextNormalized?.days) ? nextNormalized.days : []).map((day) => {
        const existingDay = existingDaysById.get(day.id);
        const existingSegmentsById = new Map(
          (Array.isArray(existingDay?.segments) ? existingDay.segments : []).map((segment) => [segment.id, segment])
        );
            const nextTitleField = mergeEditableLocalizedTextField(
              existingDay?.title_i18n ?? existingDay?.title,
              day.title,
              day.title_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const nextOvernightField = mergeEditableLocalizedTextField(
              existingDay?.overnight_location_i18n ?? existingDay?.overnight_location,
              day.overnight_location,
              day.overnight_location_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const nextNotesField = mergeEditableLocalizedTextField(
              existingDay?.notes_i18n ?? existingDay?.notes,
              day.notes,
              day.notes_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );

        return {
          ...day,
          title: nextTitleField.text,
          title_i18n: nextTitleField.map,
          overnight_location: nextOvernightField.text || null,
          overnight_location_i18n: nextOvernightField.map,
          notes: nextNotesField.text || null,
          notes_i18n: nextNotesField.map,
          segments: (Array.isArray(day?.segments) ? day.segments : []).map((segment) => {
            const existingSegment = existingSegmentsById.get(segment.id);
            const timeLabelField = mergeEditableLocalizedTextField(
              existingSegment?.time_label_i18n ?? existingSegment?.time_label,
              segment.time_label,
              segment.time_label_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const titleSegmentField = mergeEditableLocalizedTextField(
              existingSegment?.title_i18n ?? existingSegment?.title,
              segment.title,
              segment.title_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const detailsField = mergeEditableLocalizedTextField(
              existingSegment?.details_i18n ?? existingSegment?.details,
              segment.details,
              segment.details_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const locationField = mergeEditableLocalizedTextField(
              existingSegment?.location_i18n ?? existingSegment?.location,
              segment.location,
              segment.location_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const financialNoteField = mergeLocalizedTextField(
              existingSegment?.financial_note_i18n ?? existingSegment?.financial_note,
              segment.financial_note,
              normalizedLang,
              { fallbackLang: normalizedLang }
            );

            return {
              ...segment,
              time_label: segment.timing_kind === "label" ? (timeLabelField.text || null) : null,
              time_label_i18n: timeLabelField.map,
              title: titleSegmentField.text,
              title_i18n: titleSegmentField.map,
              details: detailsField.text || null,
              details_i18n: detailsField.map,
              location: locationField.text || null,
              location_i18n: locationField.map,
              financial_note: financialNoteField.text || null,
              financial_note_i18n: financialNoteField.map
            };
          })
        };
      })
    };
  }

  function sendTranslationError(res, error) {
    if (error?.code === "TRANSLATION_NOT_CONFIGURED") {
      sendJson(res, 503, { error: String(error.message || "Translation provider is not configured.") });
      return;
    }
    if (error?.code === "TRANSLATION_SOURCE_LANGUAGE") {
      sendJson(res, 422, { error: String(error.message || "English cannot be auto-translated.") });
      return;
    }
    if (error?.code === "TRANSLATION_INVALID_RESPONSE" || error?.code === "TRANSLATION_REQUEST_FAILED") {
      sendJson(res, 502, { error: String(error.message || "Translation request failed.") });
      return;
    }
    sendJson(res, 500, { error: String(error?.message || error || "Translation failed.") });
  }

  function parseQueryInt(value, fallback, { min = 0, max = 100 } = {}) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    if (!Number.isInteger(parsed)) return fallback;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
  }

  function publicBookingImagePath(relativePath) {
    const normalized = normalizeText(relativePath).replace(/^\/+/, "");
    return normalized ? `/public/v1/booking-images/${normalized}` : "";
  }

  function normalizeSegmentImageRefs(images = []) {
    const items = Array.isArray(images) ? images : [];
    return items.map((image, index) => ({
      ...image,
      sort_order: index,
      is_primary: index === 0
    }));
  }

  function cloneLocalizedMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entryValue]) => [String(key), typeof entryValue === "string" ? entryValue : String(entryValue || "")])
        .filter(([, entryValue]) => entryValue)
    );
  }

  function findDayAndSegment(travelPlan, dayId, segmentId) {
    const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
    const dayIndex = days.findIndex((day) => day.id === dayId);
    if (dayIndex < 0) return { dayIndex: -1, segmentIndex: -1, day: null, segment: null };
    const day = days[dayIndex];
    const segments = Array.isArray(day?.segments) ? day.segments : [];
    const segmentIndex = segments.findIndex((segment) => segment.id === segmentId);
    if (segmentIndex < 0) return { dayIndex, segmentIndex: -1, day, segment: null };
    return { dayIndex, segmentIndex, day, segment: segments[segmentIndex] };
  }

  function copySegmentForImport(sourceSegment, options = {}) {
    const includeTranslations = options.includeTranslations !== false;
    const includeNotes = options.includeNotes !== false;
    const includeImages = options.includeImages !== false;
    const includeCustomerVisibleImagesOnly = options.includeCustomerVisibleImagesOnly === true;
    const importedAt = normalizeText(options.importedAt) || nowIso();

    const sourceImages = Array.isArray(sourceSegment?.images) ? sourceSegment.images : [];
    const importedImages = includeImages
      ? sourceImages
        .filter((image) => !includeCustomerVisibleImagesOnly || image?.is_customer_visible !== false)
        .map((image, index) => ({
          ...image,
          id: `travel_plan_segment_image_${randomUUID()}`,
          sort_order: index,
          is_primary: index === 0,
          created_at: importedAt
        }))
      : [];

    return {
      id: `travel_plan_segment_${randomUUID()}`,
      timing_kind: sourceSegment?.timing_kind || "label",
      time_label: normalizeText(sourceSegment?.time_label),
      time_label_i18n: includeTranslations ? cloneLocalizedMap(sourceSegment?.time_label_i18n) : undefined,
      time_point: normalizeText(sourceSegment?.time_point),
      kind: normalizeText(sourceSegment?.kind) || "other",
      title: normalizeText(sourceSegment?.title),
      title_i18n: includeTranslations ? cloneLocalizedMap(sourceSegment?.title_i18n) : undefined,
      details: normalizeText(sourceSegment?.details),
      details_i18n: includeTranslations ? cloneLocalizedMap(sourceSegment?.details_i18n) : undefined,
      location: normalizeText(sourceSegment?.location),
      location_i18n: includeTranslations ? cloneLocalizedMap(sourceSegment?.location_i18n) : undefined,
      supplier_id: normalizeText(sourceSegment?.supplier_id),
      start_time: normalizeText(sourceSegment?.start_time),
      end_time: normalizeText(sourceSegment?.end_time),
      financial_coverage_status: normalizeText(sourceSegment?.financial_coverage_status) || "not_covered",
      financial_note: includeNotes ? normalizeText(sourceSegment?.financial_note) : null,
      financial_note_i18n: includeNotes && includeTranslations ? cloneLocalizedMap(sourceSegment?.financial_note_i18n) : undefined,
      images: importedImages,
      copied_from: {
        source_type: "booking_segment",
        source_booking_id: normalizeText(options.sourceBookingId),
        source_day_id: normalizeText(options.sourceDayId),
        source_segment_id: normalizeText(sourceSegment?.id),
        copied_at: importedAt,
        copied_by_atp_staff_id: normalizeText(options.copiedByAtpStaffId)
      }
    };
  }

  function buildSearchResult({ booking, day, segment, supplierName = "" }) {
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

  async function handleSearchTravelPlanSegments(req, res) {
    const principal = getPrincipal(req);
    const store = await readStore();
    const requestUrl = new URL(req.url, "http://localhost");
    const query = normalizeText(requestUrl.searchParams.get("q")).toLowerCase();
    const destination = normalizeText(requestUrl.searchParams.get("destination")).toLowerCase();
    const country = normalizeText(requestUrl.searchParams.get("country")).toUpperCase();
    const style = normalizeText(requestUrl.searchParams.get("style")).toLowerCase();
    const segmentKind = normalizeText(requestUrl.searchParams.get("segment_kind")).toLowerCase();
    const limit = parseQueryInt(requestUrl.searchParams.get("limit"), 20, { min: 1, max: 50 });
    const offset = parseQueryInt(requestUrl.searchParams.get("offset"), 0, { min: 0, max: 5000 });
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
            supplierName: supplierById.get(normalizeText(segment?.supplier_id)) || ""
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
      importedAt: nowIso()
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

  async function handleUploadTravelPlanSegmentImage(req, res, [bookingId, dayId, segmentId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanSegmentImageUploadRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, { strictReferences: false });
    const { dayIndex, segmentIndex, segment } = findDayAndSegment(normalizedTravelPlan, dayId, segmentId);
    if (dayIndex < 0 || segmentIndex < 0 || !segment) {
      sendJson(res, 404, { error: "Travel plan segment not found" });
      return;
    }

    const filename = normalizeText(payload.filename) || `${segmentId}.upload`;
    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }
    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${segmentId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${segmentId}-${Date.now()}-${randomUUID()}.webp`;
    const outputRelativePath = `${bookingId}/travel-plan-segments/${outputName}`;
    const outputPath = path.join(BOOKING_IMAGES_DIR, outputRelativePath);
    try {
      await writeFile(tempInputPath, sourceBuffer);
      await processBookingImageToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    const currentImages = Array.isArray(segment.images) ? segment.images : [];
    const nextImages = normalizeSegmentImageRefs([
      ...currentImages,
      {
        id: `travel_plan_segment_image_${randomUUID()}`,
        storage_path: publicBookingImagePath(outputRelativePath),
        sort_order: currentImages.length,
        is_primary: currentImages.length === 0,
        is_customer_visible: true,
        created_at: nowIso()
      }
    ]);

    normalizedTravelPlan.days[dayIndex].segments[segmentIndex] = {
      ...segment,
      images: nextImages
    };

    const check = validateBookingTravelPlanInput(
      normalizedTravelPlan,
      booking.offer,
      {
        supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
      }
    );
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
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Travel plan segment image uploaded"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteTravelPlanSegmentImage(req, res, [bookingId, dayId, segmentId, imageId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanSegmentImageDeleteRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, { strictReferences: false });
    const { dayIndex, segmentIndex, segment } = findDayAndSegment(normalizedTravelPlan, dayId, segmentId);
    if (dayIndex < 0 || segmentIndex < 0 || !segment) {
      sendJson(res, 404, { error: "Travel plan segment not found" });
      return;
    }

    const currentImages = Array.isArray(segment.images) ? segment.images : [];
    const nextImages = currentImages.filter((image) => image.id !== imageId);
    if (nextImages.length === currentImages.length) {
      sendJson(res, 404, { error: "Segment image not found" });
      return;
    }

    normalizedTravelPlan.days[dayIndex].segments[segmentIndex] = {
      ...segment,
      images: normalizeSegmentImageRefs(nextImages)
    };

    const check = validateBookingTravelPlanInput(
      normalizedTravelPlan,
      booking.offer,
      {
        supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
      }
    );
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
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Travel plan segment image removed"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleReorderTravelPlanSegmentImages(req, res, [bookingId, dayId, segmentId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanSegmentImageReorderRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, { strictReferences: false });
    const { dayIndex, segmentIndex, segment } = findDayAndSegment(normalizedTravelPlan, dayId, segmentId);
    if (dayIndex < 0 || segmentIndex < 0 || !segment) {
      sendJson(res, 404, { error: "Travel plan segment not found" });
      return;
    }

    const currentImages = Array.isArray(segment.images) ? segment.images : [];
    const requestedOrder = Array.isArray(payload.image_ids) ? payload.image_ids.map((id) => normalizeText(id)).filter(Boolean) : [];
    if (requestedOrder.length !== currentImages.length) {
      sendJson(res, 422, { error: "image_ids must contain all segment image ids exactly once." });
      return;
    }
    const currentImageMap = new Map(currentImages.map((image) => [image.id, image]));
    const uniqueRequestedOrder = new Set(requestedOrder);
    if (uniqueRequestedOrder.size !== currentImages.length || requestedOrder.some((id) => !currentImageMap.has(id))) {
      sendJson(res, 422, { error: "image_ids must contain all segment image ids exactly once." });
      return;
    }

    normalizedTravelPlan.days[dayIndex].segments[segmentIndex] = {
      ...segment,
      images: normalizeSegmentImageRefs(requestedOrder.map((id) => currentImageMap.get(id)))
    };

    const check = validateBookingTravelPlanInput(
      normalizedTravelPlan,
      booking.offer,
      {
        supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
      }
    );
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
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Travel plan segment images reordered"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePatchBookingTravelPlan(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingTravelPlanUpdateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const check = validateBookingTravelPlanInput(
      payload.travel_plan,
      booking.offer,
      {
        supplierIds: Array.isArray(store.suppliers) ? store.suppliers.map((supplier) => supplier?.id) : []
      }
    );
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const contentLang = requestContentLang(req, payload);
    const mergedTravelPlan = mergeTravelPlanForLang(booking.travel_plan, check.travel_plan, booking.offer, contentLang);
    if (contentLang !== "en") {
      markTravelPlanTranslationManual(mergedTravelPlan, contentLang, nowIso());
    }
    const nextTravelPlanJson = JSON.stringify(mergedTravelPlan);
    const currentTravelPlanJson = JSON.stringify(booking.travel_plan || null);
    if (nextTravelPlanJson === currentTravelPlanJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.travel_plan = mergedTravelPlan;
    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Travel plan updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleTranslateBookingTravelPlanFromEnglish(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingTravelPlanTranslateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const contentLang = requestContentLang(req, payload);
    try {
      const translatedTravelPlan = await translateTravelPlanFromEnglish(
        booking.travel_plan,
        contentLang,
        translateEntries,
        nowIso()
      );
      const nextTravelPlanJson = JSON.stringify(translatedTravelPlan);
      const currentTravelPlanJson = JSON.stringify(booking.travel_plan || null);
      if (nextTravelPlanJson === currentTravelPlanJson) {
        sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
        return;
      }

      booking.travel_plan = translatedTravelPlan;
      incrementBookingRevision(booking, "travel_plan_revision");
      booking.updated_at = nowIso();
      addActivity(
        store,
        booking.id,
        "TRAVEL_PLAN_TRANSLATED",
        actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
        `Travel plan translated from English to ${contentLang}`
      );
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(booking, req));
    } catch (error) {
      sendTranslationError(res, error);
    }
  }

  return {
    handleSearchTravelPlanSegments,
    handleImportTravelPlanSegment,
    handleUploadTravelPlanSegmentImage,
    handleDeleteTravelPlanSegmentImage,
    handleReorderTravelPlanSegmentImages,
    handlePatchBookingTravelPlan,
    handleTranslateBookingTravelPlanFromEnglish
  };
}
