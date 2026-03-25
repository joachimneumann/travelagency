import {
  validateTravelPlanPdfArtifactCreateRequest,
  validateTravelPlanPdfArtifactDeleteRequest,
  validateTravelPlanPdfArtifactUpdateRequest,
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
import { createBookingTravelPlanAttachmentHandlers } from "./booking_travel_plan_attachments.js";
import { createBookingTravelPlanImportHandlers } from "./booking_travel_plan_import.js";
import { createBookingTravelPlanImageHandlers } from "./booking_travel_plan_images.js";

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
    buildBookingTravelPlanReadModel,
    writeTravelPlanPdf,
    listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact,
    sendFileWithCache,
    translateEntries,
    path,
    randomUUID,
    generatedOfferPdfPath,
    TEMP_UPLOAD_DIR,
    TRAVEL_PLAN_PDF_PREVIEW_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
    writeFile,
    rm,
    processBookingImageToWebp,
    mkdir
  } = deps;

  function buildTravelPlanDownloadFilename(nowValue = nowIso(), rawSuffix = "") {
    const normalizedDate = String(nowValue || "").trim().slice(0, 10);
    const datePart = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)
      ? normalizedDate
      : new Date().toISOString().slice(0, 10);
    const normalizedSuffix = normalizeText(rawSuffix).replace(/^-+/, "").replace(/[^A-Za-z0-9-]+/g, "");
    return `Asia Travel Plan ${datePart}${normalizedSuffix ? `-${normalizedSuffix}` : ""}.pdf`;
  }

  function requestContentLang(req, payload = null) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingContentLang(payload?.lang || requestUrl.searchParams.get("lang") || "en");
    } catch {
      return normalizeBookingContentLang(payload?.lang || "en");
    }
  }

  function travelPlanPdfTempOutputPath(bookingId, prefix = "travel-plan-preview") {
    const tempRoot = String(TRAVEL_PLAN_PDF_PREVIEW_DIR || TEMP_UPLOAD_DIR || "").trim();
    return path.join(tempRoot, `${prefix}-${bookingId}-${randomUUID()}.pdf`);
  }

  function buildTravelPlanPdfArtifactResponse(bookingId, artifact) {
    const artifactId = String(artifact?.id || "").trim();
    if (!artifactId) return null;
    return {
      id: artifactId,
      filename: String(artifact?.filename || buildTravelPlanDownloadFilename(artifact?.created_at || nowIso())).trim(),
      page_count: Math.max(1, Number(artifact?.page_count) || 1),
      created_at: String(artifact?.created_at || nowIso()).trim(),
      sent_to_customer: artifact?.sent_to_customer === true,
      pdf_url: `/api/v1/bookings/${encodeURIComponent(bookingId)}/travel-plan/pdfs/${encodeURIComponent(artifactId)}/pdf`
    };
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
        const existingItemsById = new Map(
          (Array.isArray(existingDay?.services) ? existingDay.services : (Array.isArray(existingDay?.items) ? existingDay.items : []))
            .map((item) => [item.id, item])
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
          services: (Array.isArray(day?.services) ? day.services : []).map((item) => {
            const existingItem = existingItemsById.get(item.id);
            const timeLabelField = mergeEditableLocalizedTextField(
              existingItem?.time_label_i18n ?? existingItem?.time_label,
              item.time_label,
              item.time_label_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const titleItemField = mergeEditableLocalizedTextField(
              existingItem?.title_i18n ?? existingItem?.title,
              item.title,
              item.title_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const detailsField = mergeEditableLocalizedTextField(
              existingItem?.details_i18n ?? existingItem?.details,
              item.details,
              item.details_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const locationField = mergeEditableLocalizedTextField(
              existingItem?.location_i18n ?? existingItem?.location,
              item.location,
              item.location_i18n,
              normalizedLang,
              { pruneExtraTranslationsOnEnglishChange: true }
            );
            const financialNoteField = mergeLocalizedTextField(
              existingItem?.financial_note_i18n ?? existingItem?.financial_note,
              item.financial_note,
              normalizedLang,
              { fallbackLang: normalizedLang }
            );

            return {
              ...item,
              time_label: item.timing_kind === "label" ? (timeLabelField.text || null) : null,
              time_label_i18n: timeLabelField.map,
              title: titleItemField.text,
              title_i18n: titleItemField.map,
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

  async function handleGetBookingTravelPlanPdfArtifact(req, res, [bookingId, artifactId]) {
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

    const existingArtifact = typeof resolveBookingTravelPlanPdfArtifact === "function"
      ? await resolveBookingTravelPlanPdfArtifact(booking.id, artifactId).catch(() => null)
      : null;
    if (!existingArtifact?.storage_path) {
      sendJson(res, 404, { error: "Travel plan PDF artifact not found" });
      return;
    }

    await sendFileWithCache(req, res, existingArtifact.storage_path, "private, max-age=0, no-store", {
      "Content-Disposition": `inline; filename="${String(existingArtifact.filename || buildTravelPlanDownloadFilename(existingArtifact.created_at)).replace(/"/g, "")}"`
    });
  }

  async function handleGetBookingTravelPlanPdf(req, res, [bookingId]) {
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

    let artifactId = "";
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      artifactId = String(requestUrl.searchParams.get("artifact_id") || "").trim();
    } catch {
      artifactId = "";
    }
    if (artifactId) {
      await handleGetBookingTravelPlanPdfArtifact(req, res, [bookingId, artifactId]);
      return;
    }

    const contentLang = requestContentLang(req, null);
    const travelPlanSnapshot = buildBookingTravelPlanReadModel(booking.travel_plan, booking.offer, {
      lang: contentLang,
      contentLang,
      flatLang: contentLang
    });

    const previewPath = travelPlanPdfTempOutputPath(booking.id, "travel-plan-preview");
    let renderedPath = previewPath;
    try {
      await mkdir(path.dirname(previewPath), { recursive: true });
      const result = await writeTravelPlanPdf(booking, travelPlanSnapshot, {
        lang: contentLang,
        outputPath: previewPath
      });
      renderedPath = String(result?.outputPath || previewPath).trim() || previewPath;
      await sendFileWithCache(req, res, renderedPath, "private, max-age=0, no-store", {
        "Content-Disposition": `inline; filename="${buildTravelPlanDownloadFilename(nowIso()).replace(/"/g, "")}"`
      });
    } catch (error) {
      sendJson(res, 500, { error: "Could not render travel plan PDF", detail: String(error?.message || error) });
    } finally {
      await rm(renderedPath, { force: true }).catch(() => {});
      if (renderedPath !== previewPath) {
        await rm(previewPath, { force: true }).catch(() => {});
      }
    }
  }

  async function handlePostBookingTravelPlanPdf(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanPdfArtifactCreateRequest(payload);
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
    if (!canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const contentLang = requestContentLang(req, payload);
    const travelPlanSnapshot = buildBookingTravelPlanReadModel(booking.travel_plan, booking.offer, {
      lang: contentLang,
      contentLang,
      flatLang: contentLang
    });

    const tempPdfPath = travelPlanPdfTempOutputPath(booking.id, "travel-plan-artifact");
    let renderedPath = tempPdfPath;
    try {
      await mkdir(path.dirname(tempPdfPath), { recursive: true });
      const result = await writeTravelPlanPdf(booking, travelPlanSnapshot, {
        lang: contentLang,
        outputPath: tempPdfPath
      });
      renderedPath = String(result?.outputPath || tempPdfPath).trim() || tempPdfPath;
      if (typeof persistBookingTravelPlanPdfArtifact !== "function") {
        throw new Error("Travel-plan PDF artifact storage is not configured.");
      }
      const artifact = await persistBookingTravelPlanPdfArtifact(booking.id, renderedPath, {
        createdAt: nowIso(),
        suffix: payload?.filename_suffix,
        customerLanguage: contentLang,
        travelPlanRevision: Number(booking?.travel_plan_revision)
      });
      const responseArtifact = buildTravelPlanPdfArtifactResponse(booking.id, artifact);
      if (!responseArtifact) {
        throw new Error("Travel-plan PDF artifact was not created.");
      }
      sendJson(res, 201, { artifact: responseArtifact });
    } catch (error) {
      sendJson(res, 500, { error: "Could not create travel plan PDF", detail: String(error?.message || error) });
    } finally {
      await rm(renderedPath, { force: true }).catch(() => {});
      if (renderedPath !== tempPdfPath) {
        await rm(tempPdfPath, { force: true }).catch(() => {});
      }
    }
  }

  const { handleSearchTravelPlanServices, handleImportTravelPlanService } = createBookingTravelPlanImportHandlers({
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
  });

  const {
    handleUploadTravelPlanServiceImage,
    handleDeleteTravelPlanServiceImage,
    handleReorderTravelPlanServiceImages
  } = createBookingTravelPlanImageHandlers({
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
  });

  const {
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment
  } = createBookingTravelPlanAttachmentHandlers({
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
  });

  async function handlePatchBookingTravelPlanPdfArtifact(req, res, [bookingId, artifactId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanPdfArtifactUpdateRequest(payload);
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

    const updatedArtifact = typeof updateBookingTravelPlanPdfArtifact === "function"
      ? await updateBookingTravelPlanPdfArtifact(booking.id, artifactId, { sent_to_customer: payload.sent_to_customer === true }).catch(() => null)
      : null;
    if (!updatedArtifact) {
      sendJson(res, 404, { error: "Travel plan PDF not found" });
      return;
    }

    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      payload.sent_to_customer === true
        ? `Travel-plan PDF marked as sent to customer: ${normalizeText(updatedArtifact.filename) || artifactId}`
        : `Travel-plan PDF marked as not sent to customer: ${normalizeText(updatedArtifact.filename) || artifactId}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteBookingTravelPlanPdfArtifact(req, res, [bookingId, artifactId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanPdfArtifactDeleteRequest(payload);
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

    const existingArtifact = typeof resolveBookingTravelPlanPdfArtifact === "function"
      ? await resolveBookingTravelPlanPdfArtifact(booking.id, artifactId).catch(() => null)
      : null;
    if (!existingArtifact) {
      sendJson(res, 404, { error: "Travel plan PDF not found" });
      return;
    }
    if (existingArtifact.sent_to_customer === true) {
      sendJson(res, 422, { error: "Travel plan PDFs marked as sent to customer cannot be deleted." });
      return;
    }

    const deletedArtifact = typeof deleteBookingTravelPlanPdfArtifact === "function"
      ? await deleteBookingTravelPlanPdfArtifact(booking.id, artifactId).catch(() => null)
      : null;
    if (!deletedArtifact) {
      sendJson(res, 404, { error: "Travel plan PDF not found" });
      return;
    }

    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Travel-plan PDF deleted: ${normalizeText(deletedArtifact.filename) || artifactId}`
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
    handleSearchTravelPlanServices,
    handleImportTravelPlanService,
    handleUploadTravelPlanServiceImage,
    handleDeleteTravelPlanServiceImage,
    handleReorderTravelPlanServiceImages,
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment,
    handlePostBookingTravelPlanPdf,
    handleGetBookingTravelPlanPdfArtifact,
    handlePatchBookingTravelPlanPdfArtifact,
    handleDeleteBookingTravelPlanPdfArtifact,
    handlePatchBookingTravelPlan,
    handleGetBookingTravelPlanPdf,
    handleTranslateBookingTravelPlanFromEnglish
  };
}
