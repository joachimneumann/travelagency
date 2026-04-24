import {
  validateTravelPlanAttachmentDeleteRequest,
  validateTravelPlanAttachmentUploadRequest
} from "../../../Generated/API/generated_APIModels.js";
import {
  inspectPdfAttachmentBuffer,
  normalizePdfAttachmentBufferToA4,
  resolveTravelPlanAttachmentAbsolutePath
} from "../../lib/pdf_attachments.js";

const PDF_UPLOAD_BODY_MAX_BYTES = 40 * 1024 * 1024;

function normalizeAttachmentFilename(pathModule, normalizeText, rawFilename, fallbackId) {
  const basename = pathModule.basename(normalizeText(rawFilename) || `${fallbackId}.pdf`).trim();
  if (!basename) return `${fallbackId}.pdf`;
  return /\.pdf$/i.test(basename) ? basename : `${basename}.pdf`;
}

export function createBookingTravelPlanAttachmentHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    sendFileWithCache,
    readStore,
    getPrincipal,
    canAccessBooking,
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
    generatedOfferPdfPath,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
    writeFile,
    rm,
    mkdir
  } = deps;

  async function handleGetTravelPlanAttachmentPdf(req, res, [bookingId, attachmentId]) {
    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, { strictReferences: false });
    const attachment = (Array.isArray(normalizedTravelPlan.attachments) ? normalizedTravelPlan.attachments : [])
      .find((item) => item?.id === attachmentId);
    if (!attachment) {
      sendJson(res, 404, { error: "Travel-plan attachment not found" });
      return;
    }

    const absolutePath = resolveTravelPlanAttachmentAbsolutePath(
      BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
      attachment.storage_path
    );
    if (!absolutePath) {
      sendJson(res, 404, { error: "Travel-plan attachment file not found" });
      return;
    }

    await sendFileWithCache(req, res, absolutePath, "private, max-age=0, no-store", {
      "Content-Disposition": `inline; filename="${String(attachment.filename || "attachment.pdf").replace(/"/g, "")}"`
    });
  }

  async function invalidateGeneratedOfferPdfArtifacts(booking) {
    const generatedOffers = Array.isArray(booking?.generated_offers) ? booking.generated_offers : [];
    for (const generatedOffer of generatedOffers) {
      if (!generatedOffer || typeof generatedOffer !== "object") continue;
      const generatedOfferId = normalizeText(generatedOffer.id);
      const linkedToAcceptedRecord = normalizeText(booking?.accepted_offer_artifact_ref) === generatedOfferId;
      if (linkedToAcceptedRecord) continue;
      const pdfPath = generatedOfferPdfPath(generatedOfferId);
      delete generatedOffer.pdf_frozen_at;
      delete generatedOffer.pdf_sha256;
      if (pdfPath) {
        await rm(pdfPath, { force: true }).catch(() => {});
      }
    }
  }

  async function handleUploadTravelPlanAttachment(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req, { maxBytes: PDF_UPLOAD_BODY_MAX_BYTES });
      validateTravelPlanAttachmentUploadRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
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

    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }
    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 PDF payload" });
      return;
    }

    let pageCount = 0;
    let normalizedBuffer = sourceBuffer;
    try {
      ({ pageCount } = await inspectPdfAttachmentBuffer(sourceBuffer));
      ({ buffer: normalizedBuffer } = await normalizePdfAttachmentBufferToA4(sourceBuffer));
    } catch (error) {
      sendJson(res, 422, { error: String(error?.message || error || "Invalid PDF upload") });
      return;
    }

    const normalizedTravelPlan = normalizeBookingTravelPlan(booking.travel_plan, booking.offer, { strictReferences: false });
    const attachmentId = `travel_plan_attachment_${randomUUID()}`;
    const filename = normalizeAttachmentFilename(path, normalizeText, payload.filename, attachmentId);
    const outputRelativePath = `${bookingId}/${Date.now()}-${randomUUID()}.pdf`;
    const outputPath = path.join(BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR, outputRelativePath);

    try {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, normalizedBuffer);
    } catch (error) {
      sendJson(res, 500, { error: "Could not store travel-plan PDF attachment", detail: String(error?.message || error) });
      return;
    }

    const currentAttachments = Array.isArray(normalizedTravelPlan.attachments) ? normalizedTravelPlan.attachments : [];
    normalizedTravelPlan.attachments = [
      ...currentAttachments,
      {
        id: attachmentId,
        filename,
        storage_path: outputRelativePath,
        page_count: pageCount,
        sort_order: currentAttachments.length,
        created_at: nowIso()
      }
    ];

    const check = validateBookingTravelPlanInput(normalizedTravelPlan, booking.offer);
    if (!check.ok) {
      await rm(outputPath, { force: true }).catch(() => {});
      sendJson(res, 422, { error: check.error });
      return;
    }

    booking.travel_plan = check.travel_plan;
    await invalidateGeneratedOfferPdfArtifacts(booking);
    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Travel-plan PDF attachment uploaded: ${filename}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteTravelPlanAttachment(req, res, [bookingId, attachmentId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanAttachmentDeleteRequest(payload);
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
    const currentAttachments = Array.isArray(normalizedTravelPlan.attachments) ? normalizedTravelPlan.attachments : [];
    const removedAttachment = currentAttachments.find((attachment) => attachment.id === attachmentId);
    if (!removedAttachment) {
      sendJson(res, 404, { error: "Travel-plan attachment not found" });
      return;
    }
    normalizedTravelPlan.attachments = currentAttachments.filter((attachment) => attachment.id !== attachmentId);

    const check = validateBookingTravelPlanInput(normalizedTravelPlan, booking.offer);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    booking.travel_plan = check.travel_plan;
    await invalidateGeneratedOfferPdfArtifacts(booking);
    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Travel-plan PDF attachment removed: ${normalizeText(removedAttachment.filename) || attachmentId}`
    );
    await persistStore(store);

    const absolutePath = resolveTravelPlanAttachmentAbsolutePath(
      BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
      removedAttachment.storage_path
    );
    if (absolutePath) {
      await rm(absolutePath, { force: true }).catch(() => {});
    }

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment
  };
}
