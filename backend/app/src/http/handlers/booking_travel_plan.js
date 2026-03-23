import {
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
    sendFileWithCache,
    translateEntries,
    path,
    randomUUID,
    generatedOfferPdfPath,
    TEMP_UPLOAD_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
    writeFile,
    rm,
    processBookingImageToWebp,
    mkdir
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
        const existingItemsById = new Map(
          (Array.isArray(existingDay?.items) ? existingDay.items : []).map((item) => [item.id, item])
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
          items: (Array.isArray(day?.items) ? day.items : []).map((item) => {
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

    let requestedLang = "";
    try {
      requestedLang = String(new URL(req.url, "http://localhost").searchParams.get("lang") || "").trim();
    } catch {
      requestedLang = "";
    }
    const contentLang = normalizeBookingContentLang(
      requestedLang
      || booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
    const travelPlanSnapshot = buildBookingTravelPlanReadModel(booking.travel_plan, booking.offer, {
      lang: contentLang,
      contentLang,
      flatLang: contentLang
    });

    let pdfPath = "";
    try {
      ({ outputPath: pdfPath } = await writeTravelPlanPdf(booking, travelPlanSnapshot, { lang: contentLang }));
    } catch (error) {
      sendJson(res, 500, { error: "Could not render travel plan PDF", detail: String(error?.message || error) });
      return;
    }

    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store", {
      "Content-Disposition": `inline; filename="ATP travel plan ${String(booking.id || "booking").replace(/"/g, "")}.pdf"`
    });
  }

  const { handleSearchTravelPlanItems, handleImportTravelPlanItem } = createBookingTravelPlanImportHandlers({
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
    handleUploadTravelPlanItemImage,
    handleDeleteTravelPlanItemImage,
    handleReorderTravelPlanItemImages
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
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment
  } = createBookingTravelPlanAttachmentHandlers({
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
    generatedOfferPdfPath,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
    writeFile,
    rm,
    mkdir
  });

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
    handleSearchTravelPlanItems,
    handleImportTravelPlanItem,
    handleUploadTravelPlanItemImage,
    handleDeleteTravelPlanItemImage,
    handleReorderTravelPlanItemImages,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment,
    handlePatchBookingTravelPlan,
    handleGetBookingTravelPlanPdf,
    handleTranslateBookingTravelPlanFromEnglish
  };
}
