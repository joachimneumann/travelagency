import {
  validateBookingGenerateOfferRequest
} from "../../../Generated/API/generated_APIModels.js";
import { readFile } from "node:fs/promises";
import { createGmailDraftsClient } from "../../lib/gmail_drafts.js";
import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import {
  mergeEditableLocalizedTextField,
  mergeLocalizedTextField,
  normalizeBookingContentLang,
  normalizeBookingSourceLang
} from "../../domain/booking_content_i18n.js";

export function createBookingFinanceHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    normalizeText,
    nowIso,
    BASE_CURRENCY,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
    buildBookingTravelPlanReadModel,
    formatMoney,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    randomUUID,
    generatedOfferPdfPath,
    gmailDraftsConfig,
    getBookingContactProfile,
    listBookingTravelPlanPdfs,
    rm,
    canAccessBooking,
    sendFileWithCache,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
  } = deps;

  let gmailDraftsClient = null;

  function getGmailDraftsClient() {
    const serviceAccountJsonPath = normalizeText(gmailDraftsConfig?.serviceAccountJsonPath);
    const impersonatedEmail = normalizeText(gmailDraftsConfig?.impersonatedEmail);
    if (!serviceAccountJsonPath || !impersonatedEmail) {
      throw new Error("Gmail draft creation is not configured.");
    }
    if (!gmailDraftsClient) {
      gmailDraftsClient = createGmailDraftsClient({
        serviceAccountJsonPath,
        impersonatedEmail
      });
    }
    return gmailDraftsClient;
  }

  function buildGeneratedOfferEmailDraftCopy(booking, generatedOfferSnapshot, contact) {
    const lang = normalizePdfLang(generatedOfferSnapshot?.lang || booking?.customer_language || "en");
    const contactName = normalizeText(contact?.name);
    const bookingTitle = normalizeText(booking?.name || booking?.web_form_submission?.booking_name);
    return {
      lang,
      subject: pdfT(lang, "email.offer_subject", "Your Asia Travel Plan offer"),
      greeting: contactName
        ? pdfT(lang, "email.greeting_named", "Hello {name},", { name: contactName })
        : pdfT(lang, "email.greeting_generic", "Hello,"),
      intro: bookingTitle
        ? pdfT(lang, "email.offer_intro_named", "Please find attached the current Asia Travel Plan offer for {trip}.", { trip: bookingTitle })
        : pdfT(lang, "email.offer_intro_generic", "Please find attached your current Asia Travel Plan offer."),
      footer: `${pdfT(lang, "offer.closing_regards", "Warm regards,")}\n${pdfT(lang, "offer.closing_team", "The Asia Travel Plan Team")}`
    };
  }

  function requestContentLang(req, payload = null) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingContentLang(
        payload?.content_lang
        || payload?.lang
        || requestUrl.searchParams.get("content_lang")
        || requestUrl.searchParams.get("lang")
        || "en"
      );
    } catch {
      return normalizeBookingContentLang(payload?.content_lang || payload?.lang || "en");
    }
  }

  function requestSourceLang(req, payload = null, fallback = "en") {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingSourceLang(
        payload?.source_lang
        || requestUrl.searchParams.get("source_lang")
        || fallback
        || "en"
      );
    } catch {
      return normalizeBookingSourceLang(payload?.source_lang || fallback || "en");
    }
  }

  function mergeOfferForLang(existingOffer, nextOffer, lang, preferredCurrency, sourceLang = "en") {
    const normalizedLang = normalizeBookingContentLang(lang);
    const normalizedSourceLang = normalizeBookingSourceLang(sourceLang);
    const nextNormalized = normalizeBookingOffer(nextOffer, preferredCurrency, {
      contentLang: normalizedLang,
      flatLang: normalizedLang,
      sourceLang: normalizedSourceLang
    });
    return nextNormalized;
  }

  function bookingPaymentTerms(booking) {
    if (booking?.accepted_payment_terms_snapshot && typeof booking.accepted_payment_terms_snapshot === "object") {
      return booking.accepted_payment_terms_snapshot;
    }
    if (booking?.offer?.payment_terms && typeof booking.offer.payment_terms === "object") {
      return booking.offer.payment_terms;
    }
    return null;
  }

  async function handlePatchBookingOffer(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const check = validateBookingOfferInput(payload.offer, booking);
    if (!check.ok) {
      sendJson(res, check.conflict ? 409 : 422, { error: check.error });
      return;
    }

    // Temporary offer debug logging kept commented for quick re-enable during pricing investigations.
    // try {
    //   console.log("[offer-debug backend] request", JSON.stringify({
    //     booking_id: bookingId,
    //     expected_offer_revision: payload?.expected_offer_revision,
    //     incoming_offer: payload?.offer,
    //     normalized_offer: check.offer
    //   }));
    // } catch {
    //   // ignore debug serialization issues
    // }

    const contentLang = requestContentLang(req, payload);
    const sourceLang = requestSourceLang(req, payload);
    const mergedOffer = mergeOfferForLang(
      booking.offer,
      check.offer,
      contentLang,
      booking.preferred_currency || BASE_CURRENCY,
      sourceLang
    );
    const nextOfferBase = await convertBookingOfferToBaseCurrency(mergedOffer);
    const nextOfferJson = JSON.stringify(nextOfferBase);
    const currentOfferJson = JSON.stringify(
      normalizeBookingOffer(booking.offer, booking.preferred_currency || BASE_CURRENCY)
    );
    if (nextOfferJson === currentOfferJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.offer = nextOfferBase;
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Booking offer updated"
    );
    await persistStore(store);

    // Temporary offer debug logging kept commented for quick re-enable during pricing investigations.
    // try {
    //   console.log("[offer-debug backend] response", JSON.stringify({
    //     booking_id: bookingId,
    //     stored_offer: booking.offer,
    //     offer_revision: booking.offer_revision
    //   }));
    // } catch {
    //   // ignore debug serialization issues
    // }

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePostOfferExchangeRates(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    if (!principal) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const check = validateOfferExchangeRequest(payload);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const { fromCurrency, toCurrency, lines } = check;
    if (!Array.isArray(lines) || lines.length === 0) {
      sendJson(res, 200, {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        exchange_rate: 1,
        total_price_cents: 0,
        converted_lines: [],
        converted_components: []
      });
      return;
    }

    let sourceToBaseRate = 1;
    let baseToTargetRate = 1;
    const warnings = new Set();

    if (fromCurrency !== BASE_CURRENCY) {
      try {
        const resolved = await resolveExchangeRateWithFallback(fromCurrency, BASE_CURRENCY);
        sourceToBaseRate = resolved.rate;
        if (resolved.warning) warnings.add(resolved.warning);
      } catch (error) {
        sendJson(res, 502, { error: "Unable to fetch exchange rate", detail: String(error?.message || error) });
        return;
      }
    }
    if (toCurrency !== BASE_CURRENCY) {
      try {
        const resolved = await resolveExchangeRateWithFallback(BASE_CURRENCY, toCurrency);
        baseToTargetRate = resolved.rate;
        if (resolved.warning) warnings.add(resolved.warning);
      } catch (error) {
        sendJson(res, 502, { error: "Unable to fetch exchange rate", detail: String(error?.message || error) });
        return;
      }
    }

    const convertedLines = lines.map((line) =>
      convertOfferLineAmountForCurrency(line, { sourceToBaseRate, baseToTargetRate }, fromCurrency, toCurrency)
    );
    const combinedRate = sourceToBaseRate * baseToTargetRate;

    const responsePayload = {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      exchange_rate: combinedRate,
      total_price_cents: convertedLines.reduce(
        (sum, line) =>
          sum + (Number.isFinite(line.line_total_amount_cents) ? Number(line.line_total_amount_cents) : 0),
        0
      ),
      converted_lines: convertedLines,
      converted_components: convertedLines,
      ...(warnings.size > 0 ? { warning: [...warnings].join(" ") } : {})
    };
    sendJson(res, 200, responsePayload);
  }

  async function handleGenerateBookingOffer(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingGenerateOfferRequest(payload || {});
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const documentLang = normalizePdfLang(
      payload?.lang
      || booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || (Array.isArray(booking?.persons)
        ? booking.persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact"))?.preferred_language
        : null)
      || "en"
    );
    const offerSnapshot = normalizeBookingOffer(
      booking.offer,
      booking.offer?.currency || booking.preferred_currency || BASE_CURRENCY,
      { contentLang: documentLang, flatLang: documentLang }
    );
    const travelPlanSnapshot = buildBookingTravelPlanReadModel(booking.travel_plan, offerSnapshot, { lang: documentLang });
    const now = nowIso();
    const existingGeneratedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const version = existingGeneratedOffers.reduce((maxVersion, item) => {
      const candidate = Number(item?.version || 0);
      return Number.isInteger(candidate) && candidate > maxVersion ? candidate : maxVersion;
    }, 0) + 1;
    const generatedOffer = {
      id: `generated_offer_${randomUUID()}`,
      booking_id: booking.id,
      version,
      filename: `ATP offer ${now.slice(0, 10)}.pdf`,
      lang: documentLang,
      comment: normalizeText(payload?.comment) || null,
      created_at: now,
      created_by: actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      currency: offerSnapshot.currency,
      total_price_cents: Number(offerSnapshot.total_price_cents || 0),
      offer: offerSnapshot,
      travel_plan: travelPlanSnapshot
    };
    booking.generated_offers = [...existingGeneratedOffers, generatedOffer];
    await ensureFrozenGeneratedOfferPdf(generatedOffer, booking);
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = now;
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Offer PDF generated (${formatMoney(generatedOffer.total_price_cents, generatedOffer.currency)})`
    );
    await persistStore(store);

    sendJson(res, 201, await buildBookingDetailResponse(booking, req));
  }

  async function handleGetGeneratedOfferPdf(req, res, [bookingId, generatedOfferId]) {
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
    const generatedOffer = (Array.isArray(booking.generated_offers) ? booking.generated_offers : []).find(
      (item) => item.id === generatedOfferId
    );
    if (!generatedOffer) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }
    let pdfPath;
    try {
      ({ pdfPath } = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, { store }));
    } catch (error) {
      sendJson(res, 500, { error: "Generated offer PDF artifact is missing", detail: String(error?.message || error) });
      return;
    }
    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store", {
      "Content-Disposition": `inline; filename="${String(generatedOffer.filename || `${generatedOffer.id}.pdf`).replace(/"/g, "")}"`
    });
  }

  async function handleCreateGeneratedOfferGmailDraft(req, res, [bookingId, generatedOfferId]) {
    let payload = {};
    try {
      payload = await readBodyJson(req);
    } catch {
      payload = {};
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

    const generatedOffer = (Array.isArray(booking.generated_offers) ? booking.generated_offers : []).find(
      (item) => item.id === generatedOfferId
    );
    if (!generatedOffer) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }

    const contact = getBookingContactProfile(booking);
    const recipientEmail = normalizeText(contact?.email || booking?.web_form_submission?.email);
    if (!recipientEmail) {
      sendJson(res, 422, { error: "Booking has no recipient email address for draft creation." });
      return;
    }

    const generatedOfferSnapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const draftCopy = buildGeneratedOfferEmailDraftCopy(booking, generatedOfferSnapshot, contact);

    try {
      const { pdfPath } = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, {
        store,
        persistMetadata: false
      });
      const pdfBuffer = await readFile(pdfPath);
      const draft = await getGmailDraftsClient().createDraft({
        to: recipientEmail,
        subject: draftCopy.subject,
        greeting: draftCopy.greeting,
        intro: draftCopy.intro,
        footer: draftCopy.footer,
        fromName: "Asia Travel Plan",
        attachments: [{
          filename: normalizeText(generatedOffer.filename) || `${generatedOffer.id}.pdf`,
          contentType: "application/pdf",
          content: pdfBuffer
        }]
      });

      let activityLogged = true;
      let warning = "";
      try {
        addActivity(
          store,
          booking.id,
          "OFFER_EMAIL_DRAFT_CREATED",
          actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
          `Gmail draft created for ${normalizeText(generatedOffer.filename) || generatedOffer.id}`
        );
        await persistStore(store);
      } catch (activityError) {
        activityLogged = false;
        warning = "Draft created, but booking activity could not be recorded.";
        console.error("Failed to persist Gmail draft booking activity", activityError);
      }

      sendJson(res, 200, {
        draft_id: draft.draftId,
        gmail_draft_url: draft.gmailDraftUrl,
        recipient_email: recipientEmail,
        generated_offer_id: generatedOffer.id,
        activity_logged: activityLogged,
        ...(warning ? { warning } : {})
      });
    } catch (error) {
      const detail = String(error?.message || error);
      const status = /not configured/i.test(detail) ? 503 : 502;
      sendJson(res, status, {
        error: "Could not create Gmail draft",
        detail
      });
    }
  }

  async function handlePatchGeneratedBookingOffer(req, res, [bookingId, generatedOfferId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const index = generatedOffers.findIndex((item) => item.id === generatedOfferId);
    if (index < 0) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }

    const currentGeneratedOffer = generatedOffers[index];
    const nextComment = normalizeText(payload?.comment) || null;
    const commentChanged = (currentGeneratedOffer.comment || null) !== nextComment;
    if (!commentChanged) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    if (commentChanged) {
      generatedOffers[index] = {
        ...currentGeneratedOffer,
        comment: nextComment
      };
      booking.generated_offers = generatedOffers;
    }

    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      "Generated offer comment updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteGeneratedBookingOffer(req, res, [bookingId, generatedOfferId]) {
    let payload = {};
    try {
      payload = await readBodyJson(req);
    } catch {
      payload = {};
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const index = generatedOffers.findIndex((item) => item.id === generatedOfferId);
    if (index < 0) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }
    const [removed] = generatedOffers.splice(index, 1);
    booking.generated_offers = generatedOffers;
    if (normalizeText(booking?.accepted_offer_artifact_ref) === normalizeText(removed?.id)) {
      delete booking.accepted_offer_artifact_ref;
      delete booking.accepted_offer_snapshot;
      delete booking.accepted_payment_terms_snapshot;
      delete booking.accepted_travel_plan_snapshot;
      delete booking.accepted_deposit_amount_cents;
      delete booking.accepted_deposit_currency;
      delete booking.accepted_deposit_reference;
      delete booking.deposit_received_at;
      delete booking.deposit_confirmed_by_atp_staff_id;
      delete booking.accepted_travel_plan_artifact_ref;
      incrementBookingRevision(booking, "core_revision");
    }
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      "Generated offer deleted"
    );
    await persistStore(store);

    const pdfPath = generatedOfferPdfPath(removed.id);
    await rm(pdfPath, { force: true }).catch(() => {});

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handlePatchBookingOffer,
    handlePostOfferExchangeRates,
    handleGenerateBookingOffer,
    handleGetGeneratedOfferPdf,
    handleCreateGeneratedOfferGmailDraft,
    handlePatchGeneratedBookingOffer,
    handleDeleteGeneratedBookingOffer
  };
}
