import {
  validateTravelPlanItemImageDeleteRequest,
  validateTravelPlanItemImageReorderRequest,
  validateTravelPlanItemImageUploadRequest
} from "../../../Generated/API/generated_APIModels.js";
import {
  findTravelPlanDayAndItem,
  normalizeItemImageRefs,
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

  async function handleUploadTravelPlanItemImage(req, res, [bookingId, dayId, itemId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanItemImageUploadRequest(payload);
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
    const { dayIndex, itemIndex, item } = findTravelPlanDayAndItem(normalizedTravelPlan, dayId, itemId);
    if (dayIndex < 0 || itemIndex < 0 || !item) {
      sendJson(res, 404, { error: "Travel plan item not found" });
      return;
    }

    const filename = normalizeText(payload.filename) || `${itemId}.upload`;
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

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${itemId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${itemId}-${Date.now()}-${randomUUID()}.webp`;
    const outputRelativePath = `${bookingId}/travel-plan-items/${outputName}`;
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

    const currentImages = Array.isArray(item.images) ? item.images : [];
    const nextImages = normalizeItemImageRefs([
      ...currentImages,
      {
        id: `travel_plan_item_image_${randomUUID()}`,
        storage_path: publicBookingImagePath(normalizeText, outputRelativePath),
        sort_order: currentImages.length,
        is_primary: currentImages.length === 0,
        is_customer_visible: true,
        created_at: nowIso()
      }
    ]);

    normalizedTravelPlan.days[dayIndex].items[itemIndex] = {
      ...item,
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
      "Travel plan item image uploaded"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteTravelPlanItemImage(req, res, [bookingId, dayId, itemId, imageId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanItemImageDeleteRequest(payload);
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
    const { dayIndex, itemIndex, item } = findTravelPlanDayAndItem(normalizedTravelPlan, dayId, itemId);
    if (dayIndex < 0 || itemIndex < 0 || !item) {
      sendJson(res, 404, { error: "Travel plan item not found" });
      return;
    }

    const currentImages = Array.isArray(item.images) ? item.images : [];
    const nextImages = currentImages.filter((image) => image.id !== imageId);
    if (nextImages.length === currentImages.length) {
      sendJson(res, 404, { error: "Item image not found" });
      return;
    }

    normalizedTravelPlan.days[dayIndex].items[itemIndex] = {
      ...item,
      images: normalizeItemImageRefs(nextImages)
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
      "Travel plan item image removed"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleReorderTravelPlanItemImages(req, res, [bookingId, dayId, itemId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanItemImageReorderRequest(payload);
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
    const { dayIndex, itemIndex, item } = findTravelPlanDayAndItem(normalizedTravelPlan, dayId, itemId);
    if (dayIndex < 0 || itemIndex < 0 || !item) {
      sendJson(res, 404, { error: "Travel plan item not found" });
      return;
    }

    const currentImages = Array.isArray(item.images) ? item.images : [];
    const requestedOrder = Array.isArray(payload.image_ids) ? payload.image_ids.map((id) => normalizeText(id)).filter(Boolean) : [];
    if (requestedOrder.length !== currentImages.length) {
      sendJson(res, 422, { error: "image_ids must contain all item image ids exactly once." });
      return;
    }
    const currentImageMap = new Map(currentImages.map((image) => [image.id, image]));
    const uniqueRequestedOrder = new Set(requestedOrder);
    if (uniqueRequestedOrder.size !== currentImages.length || requestedOrder.some((id) => !currentImageMap.has(id))) {
      sendJson(res, 422, { error: "image_ids must contain all item image ids exactly once." });
      return;
    }

    normalizedTravelPlan.days[dayIndex].items[itemIndex] = {
      ...item,
      images: normalizeItemImageRefs(requestedOrder.map((id) => currentImageMap.get(id)))
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
      "Travel plan item images reordered"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handleUploadTravelPlanItemImage,
    handleDeleteTravelPlanItemImage,
    handleReorderTravelPlanItemImages
  };
}
