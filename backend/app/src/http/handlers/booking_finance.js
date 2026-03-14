import { readFile } from "node:fs/promises";
import { createGmailDraftsClient } from "../../lib/gmail_drafts.js";

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
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    normalizeBookingPricing,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    formatMoney,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    randomUUID,
    writeGeneratedOfferPdf,
    generatedOfferPdfPath,
    gmailDraftsConfig,
    getBookingContactProfile,
    rm,
    canAccessBooking,
    sendFileWithCache
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

  function buildGeneratedOfferReadModel(booking, generatedOffer) {
    const normalizedGeneratedOffer = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    return {
      ...normalizedGeneratedOffer,
      pdf_url: `/api/v1/bookings/${encodeURIComponent(booking.id)}/generated-offers/${encodeURIComponent(generatedOffer.id)}/pdf`
    };
  }

  function normalizeGeneratedOfferSnapshot(generatedOffer, booking) {
    const snapshotCurrency = normalizeText(
      generatedOffer?.currency
      || generatedOffer?.offer?.currency
      || booking?.offer?.currency
      || booking?.preferred_currency
      || BASE_CURRENCY
    ) || BASE_CURRENCY;
    const offerSnapshot = normalizeBookingOffer(generatedOffer?.offer, snapshotCurrency);
    return {
      ...generatedOffer,
      currency: offerSnapshot.currency || snapshotCurrency,
      total_price_cents: Number(generatedOffer?.total_price_cents || offerSnapshot.total_price_cents || 0),
      offer: offerSnapshot,
      travel_plan: normalizeBookingTravelPlan(generatedOffer?.travel_plan, offerSnapshot, {
        strictReferences: false
      })
    };
  }

  async function handlePatchBookingPricing(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(payload, booking, "expected_pricing_revision", "pricing_revision", res))) return;

    const check = validateBookingPricingInput(payload.pricing);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const nextPricingBase = await convertBookingPricingToBaseCurrency(check.pricing);
    const nextPricingJson = JSON.stringify(nextPricingBase);
    const currentPricingJson = JSON.stringify(normalizeBookingPricing(booking.pricing));
    if (nextPricingJson === currentPricingJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
      return;
    }

    booking.pricing = nextPricingBase;
    incrementBookingRevision(booking, "pricing_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "PRICING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Booking commercials updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking));
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
    if (!(await assertExpectedRevision(payload, booking, "expected_offer_revision", "offer_revision", res))) return;

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

    const nextOfferBase = await convertBookingOfferToBaseCurrency(check.offer);
    const nextOfferJson = JSON.stringify(nextOfferBase);
    const currentOfferJson = JSON.stringify(
      normalizeBookingOffer(booking.offer, booking.preferred_currency || booking.pricing?.currency || BASE_CURRENCY)
    );
    if (nextOfferJson === currentOfferJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
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

    const { fromCurrency, toCurrency, components } = check;
    if (!Array.isArray(components) || components.length === 0) {
      sendJson(res, 200, {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        exchange_rate: 1,
        total_price_cents: 0,
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

    const convertedComponents = components.map((component) =>
      convertOfferLineAmountForCurrency(component, { sourceToBaseRate, baseToTargetRate }, fromCurrency, toCurrency)
    );
    const combinedRate = sourceToBaseRate * baseToTargetRate;

    const responsePayload = {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      exchange_rate: combinedRate,
      total_price_cents: convertedComponents.reduce(
        (sum, component) =>
          sum + (Number.isFinite(component.line_total_amount_cents) ? Number(component.line_total_amount_cents) : 0),
        0
      ),
      converted_components: convertedComponents,
      ...(warnings.size > 0 ? { warning: [...warnings].join(" ") } : {})
    };
    sendJson(res, 200, responsePayload);
  }

  async function handleGenerateBookingOffer(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const offerSnapshot = normalizeBookingOffer(
      booking.offer,
      booking.offer?.currency || booking.preferred_currency || BASE_CURRENCY
    );
    const travelPlanSnapshot = normalizeBookingTravelPlan(booking.travel_plan, offerSnapshot, {
      strictReferences: false
    });
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
      comment: normalizeText(payload?.comment) || null,
      created_at: now,
      created_by: actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      currency: offerSnapshot.currency,
      total_price_cents: Number(offerSnapshot.total_price_cents || 0),
      offer: offerSnapshot,
      travel_plan: travelPlanSnapshot
    };

    await writeGeneratedOfferPdf(normalizeGeneratedOfferSnapshot(generatedOffer, booking), booking);
    booking.generated_offers = [...existingGeneratedOffers, generatedOffer];
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

    sendJson(res, 201, await buildBookingDetailResponse(booking));
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
    const pdfPath = generatedOfferPdfPath(generatedOffer.id);
    await writeGeneratedOfferPdf(normalizeGeneratedOfferSnapshot(generatedOffer, booking), booking);
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

    const bookingTitle = normalizeText(booking?.name || booking?.web_form_submission?.booking_name || "your trip");
    const greeting = normalizeText(contact?.name) ? `Hello ${normalizeText(contact.name)},` : "Hello,";
    const intro = bookingTitle
      ? `Please find attached the current Asia Travel Plan offer for ${bookingTitle}.`
      : "Please find attached your current Asia Travel Plan offer.";

    try {
      await writeGeneratedOfferPdf(normalizeGeneratedOfferSnapshot(generatedOffer, booking), booking);
      const pdfPath = generatedOfferPdfPath(generatedOffer.id);
      const pdfBuffer = await readFile(pdfPath);
      const draft = await getGmailDraftsClient().createDraft({
        to: recipientEmail,
        subject: "Your Asia Travel Plan offer",
        greeting,
        intro,
        footer: "Best regards,\nThe Asia Travel Plan Team",
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
    if (!(await assertExpectedRevision(payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const index = generatedOffers.findIndex((item) => item.id === generatedOfferId);
    if (index < 0) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }

    const nextComment = normalizeText(payload?.comment) || null;
    if ((generatedOffers[index].comment || null) === nextComment) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
      return;
    }

    generatedOffers[index] = {
      ...generatedOffers[index],
      comment: nextComment
    };
    booking.generated_offers = generatedOffers;
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
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
    if (!(await assertExpectedRevision(payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const index = generatedOffers.findIndex((item) => item.id === generatedOfferId);
    if (index < 0) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }

    const [removed] = generatedOffers.splice(index, 1);
    booking.generated_offers = generatedOffers;
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  return {
    handlePatchBookingPricing,
    handlePatchBookingOffer,
    handlePostOfferExchangeRates,
    handleGenerateBookingOffer,
    handleGetGeneratedOfferPdf,
    handleCreateGeneratedOfferGmailDraft,
    handlePatchGeneratedBookingOffer,
    handleDeleteGeneratedBookingOffer
  };
}
