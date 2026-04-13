import { normalizePdfLang } from "../../lib/pdf_i18n.js";
import {
  buildGeneratedOfferBookingConfirmationPublicSummary,
  buildPublicGeneratedOfferCustomerConfirmationFlowView,
  readGeneratedOfferBookingConfirmationTokenState,
  verifyBookingConfirmationToken,
  synchronizeGeneratedOfferCustomerConfirmationFlowStatus
} from "../../domain/booking_confirmation.js";

export function createBookingConfirmationHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    nowIso,
    bookingConfirmationTokenConfig,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
    sendFileWithCache
  } = deps;

  const bookingConfirmationTokenSecret = normalizeText(bookingConfirmationTokenConfig?.secret);

  function buildPublicGeneratedOfferAccessResponse({ booking, generatedOffer, bookingConfirmationToken }) {
    const normalizedGeneratedOffer = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const bookingConfirmationTokenState = readGeneratedOfferBookingConfirmationTokenState(generatedOffer);
    const bookingName = normalizeText(booking?.name || booking?.web_form_submission?.booking_name);
    const comment = normalizeText(generatedOffer?.comment);
    const customerConfirmationFlow = buildPublicGeneratedOfferCustomerConfirmationFlowView(generatedOffer, { now: nowIso() });
    const bookingConfirmationSummary = buildGeneratedOfferBookingConfirmationPublicSummary(generatedOffer?.booking_confirmation);
    return {
      booking_id: booking.id,
      generated_offer_id: generatedOffer.id,
      ...(bookingName ? { booking_name: bookingName } : {}),
      lang: normalizePdfLang(normalizedGeneratedOffer.lang || booking?.customer_language || "en"),
      currency: normalizedGeneratedOffer.currency,
      total_price_cents: Number(normalizedGeneratedOffer.total_price_cents || 0),
      ...(comment ? { comment } : {}),
      created_at: normalizeText(generatedOffer.created_at) || nowIso(),
      pdf_url: `/public/v1/bookings/${encodeURIComponent(booking.id)}/generated-offers/${encodeURIComponent(generatedOffer.id)}/pdf?token=${encodeURIComponent(bookingConfirmationToken)}`,
      ...(normalizedGeneratedOffer.payment_terms ? { payment_terms: normalizedGeneratedOffer.payment_terms } : {}),
      ...(customerConfirmationFlow ? { customer_confirmation_flow: customerConfirmationFlow } : {}),
      ...(bookingConfirmationTokenState.expiresAt ? { public_booking_confirmation_expires_at: bookingConfirmationTokenState.expiresAt } : {}),
      confirmed: Boolean(generatedOffer?.booking_confirmation),
      ...(bookingConfirmationSummary ? { booking_confirmation: bookingConfirmationSummary } : {})
    };
  }

  function resolveBookingConfirmationTokenFromRequest(req) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeText(requestUrl.searchParams.get("token"));
    } catch {
      return "";
    }
  }

  function verifyPublicGeneratedOfferToken({ req, bookingId, generatedOfferId, generatedOffer }) {
    const bookingConfirmationTokenState = readGeneratedOfferBookingConfirmationTokenState(generatedOffer);
    if (bookingConfirmationTokenState.revokedAt) {
      return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
    }
    return verifyBookingConfirmationToken(resolveBookingConfirmationTokenFromRequest(req), {
      bookingId,
      generatedOfferId,
      nonce: bookingConfirmationTokenState.nonce,
      expiresAt: bookingConfirmationTokenState.expiresAt,
      secret: bookingConfirmationTokenSecret,
      now: nowIso()
    });
  }

  async function handleGetPublicGeneratedOfferAccess(req, res, [bookingId, generatedOfferId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    const generatedOffer = (Array.isArray(booking.generated_offers) ? booking.generated_offers : []).find(
      (item) => item.id === generatedOfferId
    );
    if (!generatedOffer) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }
    if (synchronizeGeneratedOfferCustomerConfirmationFlowStatus(generatedOffer, { now: nowIso() })) {
      await persistStore(store);
    }

    const tokenVerification = verifyPublicGeneratedOfferToken({ req, bookingId, generatedOfferId, generatedOffer });
    if (!tokenVerification.ok) {
      const status = tokenVerification.code === "TOKEN_NOT_CONFIGURED"
        ? 503
        : tokenVerification.code === "TOKEN_EXPIRED"
          ? 410
          : 403;
      sendJson(res, status, { error: tokenVerification.error || "The booking confirmation token is invalid." });
      return;
    }

    sendJson(res, 200, buildPublicGeneratedOfferAccessResponse({
      booking,
      generatedOffer,
      bookingConfirmationToken: resolveBookingConfirmationTokenFromRequest(req)
    }));
  }

  async function handleGetPublicGeneratedOfferPdf(req, res, [bookingId, generatedOfferId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    const generatedOffer = (Array.isArray(booking.generated_offers) ? booking.generated_offers : []).find(
      (item) => item.id === generatedOfferId
    );
    if (!generatedOffer) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }
    if (synchronizeGeneratedOfferCustomerConfirmationFlowStatus(generatedOffer, { now: nowIso() })) {
      await persistStore(store);
    }

    const tokenVerification = verifyPublicGeneratedOfferToken({ req, bookingId, generatedOfferId, generatedOffer });
    if (!tokenVerification.ok) {
      const status = tokenVerification.code === "TOKEN_NOT_CONFIGURED"
        ? 503
        : tokenVerification.code === "TOKEN_EXPIRED"
          ? 410
          : 403;
      sendJson(res, status, { error: tokenVerification.error || "The booking confirmation token is invalid." });
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

  return {
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf
  };
}
