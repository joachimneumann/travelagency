import {
  validateTravelPlanSegmentImageDeleteRequest,
  validateTravelPlanSegmentImageReorderRequest,
  validateTravelPlanSegmentImageUploadRequest
} from "../../../Generated/API/generated_APIModels.js";
import {
  findTravelPlanDayAndSegment,
  normalizeSegmentImageRefs,
  publicBookingImagePath
} from "./booking_travel_plan_shared.js";

export function createBookingTravelPlanImageHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
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
    path,
    randomUUID,
    TEMP_UPLOAD_DIR,
    BOOKING_IMAGES_DIR,
    writeFile,
    rm,
    processBookingImageToWebp
  } = deps;

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
    const { dayIndex, segmentIndex, segment } = findTravelPlanDayAndSegment(normalizedTravelPlan, dayId, segmentId);
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
        storage_path: publicBookingImagePath(normalizeText, outputRelativePath),
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
    const { dayIndex, segmentIndex, segment } = findTravelPlanDayAndSegment(normalizedTravelPlan, dayId, segmentId);
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
    const { dayIndex, segmentIndex, segment } = findTravelPlanDayAndSegment(normalizedTravelPlan, dayId, segmentId);
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

  return {
    handleUploadTravelPlanSegmentImage,
    handleDeleteTravelPlanSegmentImage,
    handleReorderTravelPlanSegmentImages
  };
}
