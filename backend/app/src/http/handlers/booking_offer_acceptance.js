import { createGmailDraftsClient } from "../../lib/gmail_drafts.js";
import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import { validatePublicGeneratedOfferAcceptRequest } from "../../../Generated/API/generated_APIModels.js";
import {
  buildGeneratedOfferSnapshotHash,
  buildOfferAcceptanceStatement,
  buildOfferAcceptanceTermsSnapshot,
  createOfferAcceptanceOtpCode,
  maskOtpRecipient,
  OFFER_ACCEPTANCE_OTP_MAX_ATTEMPTS,
  OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS,
  OFFER_ACCEPTANCE_OTP_TTL_MS,
  OFFER_ACCEPTANCE_TERMS_VERSION,
  readGeneratedOfferAcceptanceTokenState,
  sha256Hex,
  verifyOfferAcceptanceToken,
  findOfferAcceptanceChallenge,
  upsertOfferAcceptanceChallenge,
  removeOfferAcceptanceChallenges,
  buildOfferAcceptanceOtpThrottle
} from "../../domain/offer_acceptance.js";

export function createBookingOfferAcceptanceHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    nowIso,
    addActivity,
    formatMoney,
    randomUUID,
    gmailDraftsConfig,
    offerAcceptanceTokenConfig,
    getBookingContactProfile,
    getRequestIpAddress,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
    sendFileWithCache
  } = deps;

  let gmailDraftsClient = null;
  const offerAcceptanceTokenSecret = normalizeText(offerAcceptanceTokenConfig?.secret);

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

  function requestUserAgent(req) {
    const raw = req?.headers?.["user-agent"];
    return normalizeText(Array.isArray(raw) ? raw[0] : raw);
  }

  function buildGeneratedOfferOtpEmailCopy(booking, generatedOfferSnapshot, acceptedByName, code) {
    const lang = normalizePdfLang(generatedOfferSnapshot?.lang || booking?.customer_language || "en");
    const bookingTitle = normalizeText(booking?.name || booking?.web_form_submission?.booking_name);
    const normalizedCode = normalizeText(code);
    return {
      subject: pdfT(lang, "email.offer_acceptance_otp_subject", "Your Asia Travel Plan acceptance code"),
      greeting: acceptedByName
        ? pdfT(lang, "email.greeting_named", "Hello {name},", { name: acceptedByName })
        : pdfT(lang, "email.greeting_generic", "Hello,"),
      intro: bookingTitle
        ? pdfT(
          lang,
          "email.offer_acceptance_otp_intro_named",
          "Use this one-time code to accept the Asia Travel Plan offer for {trip}: {code}.",
          { trip: bookingTitle, code: normalizedCode }
        )
        : pdfT(
          lang,
          "email.offer_acceptance_otp_intro_generic",
          "Use this one-time code to accept your Asia Travel Plan offer: {code}.",
          { code: normalizedCode }
        ),
      footer: `${pdfT(lang, "email.offer_acceptance_otp_expiry", "The code expires in 10 minutes.")}\n\n${pdfT(lang, "offer.closing_team", "The Asia Travel Plan Team")}`
    };
  }

  function resolveAcceptanceContact(booking, payload = {}) {
    const contactProfile = getBookingContactProfile(booking);
    const acceptedByName = normalizeText(payload?.accepted_by_name || contactProfile?.name);
    const acceptedByEmail = normalizeText(payload?.accepted_by_email || contactProfile?.email);
    const acceptedByPhone = normalizeText(payload?.accepted_by_phone || contactProfile?.phone_number);
    const acceptedByPersonId = normalizeText(payload?.accepted_by_person_id);

    if (!acceptedByName) {
      return { ok: false, error: "accepted_by_name is required." };
    }

    return {
      ok: true,
      acceptedByName,
      acceptedByEmail: acceptedByEmail || null,
      acceptedByPhone: acceptedByPhone || null,
      acceptedByPersonId: acceptedByPersonId || null
    };
  }

  function buildPublicGeneratedOfferAccessResponse({ booking, generatedOffer, acceptanceToken }) {
    const normalizedGeneratedOffer = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const acceptanceTokenState = readGeneratedOfferAcceptanceTokenState(generatedOffer);
    const bookingName = normalizeText(booking?.name || booking?.web_form_submission?.booking_name);
    const comment = normalizeText(generatedOffer?.comment);
    return {
      booking_id: booking.id,
      generated_offer_id: generatedOffer.id,
      ...(bookingName ? { booking_name: bookingName } : {}),
      lang: normalizePdfLang(normalizedGeneratedOffer.lang || booking?.customer_language || "en"),
      currency: normalizedGeneratedOffer.currency,
      total_price_cents: Number(normalizedGeneratedOffer.total_price_cents || 0),
      ...(comment ? { comment } : {}),
      created_at: normalizeText(generatedOffer.created_at) || nowIso(),
      pdf_url: `/public/v1/bookings/${encodeURIComponent(booking.id)}/generated-offers/${encodeURIComponent(generatedOffer.id)}/pdf?token=${encodeURIComponent(acceptanceToken)}`,
      ...(acceptanceTokenState.expiresAt ? { public_acceptance_expires_at: acceptanceTokenState.expiresAt } : {}),
      accepted: Boolean(generatedOffer?.acceptance),
      ...(generatedOffer?.acceptance ? { acceptance: generatedOffer.acceptance } : {})
    };
  }

  function buildPublicGeneratedOfferAcceptResponse({
    bookingId,
    generatedOfferId,
    acceptance = null,
    otpChannel = null,
    otpSentTo = "",
    otpExpiresAt = "",
    retryAfterSeconds = null
  }) {
    return {
      booking_id: bookingId,
      generated_offer_id: generatedOfferId,
      accepted: Boolean(acceptance),
      status: acceptance ? "ACCEPTED" : "OTP_REQUIRED",
      ...(acceptance ? { acceptance } : {}),
      ...(otpChannel ? { otp_channel: otpChannel } : {}),
      ...(otpSentTo ? { otp_sent_to: otpSentTo } : {}),
      ...(otpExpiresAt ? { otp_expires_at: otpExpiresAt } : {}),
      ...(Number.isFinite(Number(retryAfterSeconds)) ? { retry_after_seconds: Math.max(0, Number(retryAfterSeconds)) } : {})
    };
  }

  function resolveAcceptanceTokenFromRequest(req) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeText(requestUrl.searchParams.get("token"));
    } catch {
      return "";
    }
  }

  function verifyPublicGeneratedOfferToken({ req, bookingId, generatedOfferId, generatedOffer }) {
    const acceptanceTokenState = readGeneratedOfferAcceptanceTokenState(generatedOffer);
    if (acceptanceTokenState.revokedAt) {
      return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
    }
    return verifyOfferAcceptanceToken(resolveAcceptanceTokenFromRequest(req), {
      bookingId,
      generatedOfferId,
      nonce: acceptanceTokenState.nonce,
      expiresAt: acceptanceTokenState.expiresAt,
      secret: offerAcceptanceTokenSecret,
      now: nowIso()
    });
  }

  async function finalizeGeneratedOfferAcceptance({
    req,
    store,
    booking,
    generatedOffer,
    acceptedByName,
    acceptedByEmail = null,
    acceptedByPhone = null,
    acceptedByPersonId = null,
    language,
    method,
    otpChannel = null,
    otpVerifiedAt = null
  }) {
    if (normalizeText(booking?.accepted_generated_offer_id) && normalizeText(booking.accepted_generated_offer_id) !== generatedOffer.id) {
      return { ok: false, status: 409, error: "Another generated offer has already been accepted for this booking." };
    }

    if (generatedOffer?.acceptance && typeof generatedOffer.acceptance === "object") {
      if (!normalizeText(booking?.accepted_generated_offer_id)) {
        booking.accepted_generated_offer_id = generatedOffer.id;
        await persistStore(store);
      }
      removeOfferAcceptanceChallenges(store, booking.id, generatedOffer.id);
      return { ok: true, acceptance: generatedOffer.acceptance, unchanged: true };
    }

    const normalizedSnapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const frozenPdf = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, { store });
    const acceptance = {
      id: `offer_acceptance_${randomUUID()}`,
      accepted_at: nowIso(),
      accepted_by_name: acceptedByName,
      ...(acceptedByEmail ? { accepted_by_email: acceptedByEmail } : {}),
      ...(acceptedByPhone ? { accepted_by_phone: acceptedByPhone } : {}),
      ...(acceptedByPersonId ? { accepted_by_person_id: acceptedByPersonId } : {}),
      language: normalizePdfLang(language || normalizedSnapshot.lang || booking?.customer_language || "en"),
      method,
      statement_snapshot: buildOfferAcceptanceStatement({
        bookingName: normalizeText(booking?.name || booking?.web_form_submission?.booking_name),
        formattedTotal: formatMoney(normalizedSnapshot.total_price_cents, normalizedSnapshot.currency)
      }),
      terms_version: OFFER_ACCEPTANCE_TERMS_VERSION,
      terms_snapshot: buildOfferAcceptanceTermsSnapshot(),
      offer_currency: normalizedSnapshot.currency,
      offer_total_price_cents: Number(normalizedSnapshot.total_price_cents || 0),
      offer_pdf_sha256: normalizeText(generatedOffer?.pdf_sha256 || frozenPdf?.sha256),
      offer_snapshot_sha256: buildGeneratedOfferSnapshotHash(normalizedSnapshot),
      ip_address: normalizeText(getRequestIpAddress(req)),
      user_agent: requestUserAgent(req),
      ...(otpChannel ? { otp_channel: otpChannel, otp_verified_at: otpVerifiedAt || nowIso() } : {})
    };

    generatedOffer.acceptance = acceptance;
    booking.accepted_generated_offer_id = generatedOffer.id;
    removeOfferAcceptanceChallenges(store, booking.id, generatedOffer.id);
    booking.offer_revision = (Number.isInteger(Number(booking.offer_revision)) ? Number(booking.offer_revision) : 0) + 1;
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_ACCEPTED",
      "public_api",
      `Generated offer accepted (${formatMoney(acceptance.offer_total_price_cents, acceptance.offer_currency)})`
    );
    await persistStore(store);
    return { ok: true, acceptance, unchanged: false };
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

    const tokenVerification = verifyPublicGeneratedOfferToken({ req, bookingId, generatedOfferId, generatedOffer });
    if (!tokenVerification.ok) {
      const status = tokenVerification.code === "TOKEN_NOT_CONFIGURED"
        ? 503
        : tokenVerification.code === "TOKEN_EXPIRED"
          ? 410
          : 403;
      sendJson(res, status, { error: tokenVerification.error || "The offer acceptance token is invalid." });
      return;
    }

    sendJson(res, 200, buildPublicGeneratedOfferAccessResponse({
      booking,
      generatedOffer,
      acceptanceToken: resolveAcceptanceTokenFromRequest(req)
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

    const tokenVerification = verifyPublicGeneratedOfferToken({ req, bookingId, generatedOfferId, generatedOffer });
    if (!tokenVerification.ok) {
      const status = tokenVerification.code === "TOKEN_NOT_CONFIGURED"
        ? 503
        : tokenVerification.code === "TOKEN_EXPIRED"
          ? 410
          : 403;
      sendJson(res, status, { error: tokenVerification.error || "The offer acceptance token is invalid." });
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

  async function handlePublicAcceptGeneratedOffer(req, res, [bookingId, generatedOfferId]) {
    let payload = {};
    try {
      payload = await readBodyJson(req);
      validatePublicGeneratedOfferAcceptRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

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

    const acceptanceTokenState = readGeneratedOfferAcceptanceTokenState(generatedOffer);
    if (acceptanceTokenState.revokedAt) {
      sendJson(res, 403, { error: "The offer acceptance token is invalid." });
      return;
    }

    const tokenVerification = verifyOfferAcceptanceToken(payload?.acceptance_token, {
      bookingId,
      generatedOfferId,
      nonce: acceptanceTokenState.nonce,
      expiresAt: acceptanceTokenState.expiresAt,
      secret: offerAcceptanceTokenSecret,
      now: nowIso()
    });
    if (!tokenVerification.ok) {
      const status = tokenVerification.code === "TOKEN_NOT_CONFIGURED"
        ? 503
        : tokenVerification.code === "TOKEN_EXPIRED"
          ? 410
          : 403;
      sendJson(res, status, { error: tokenVerification.error || "The offer acceptance token is invalid." });
      return;
    }

    if (generatedOffer?.acceptance && typeof generatedOffer.acceptance === "object") {
      if (!normalizeText(booking?.accepted_generated_offer_id)) {
        booking.accepted_generated_offer_id = generatedOffer.id;
        await persistStore(store);
      }
      sendJson(res, 200, buildPublicGeneratedOfferAcceptResponse({
        bookingId,
        generatedOfferId,
        acceptance: generatedOffer.acceptance
      }));
      return;
    }

    if (normalizeText(booking?.accepted_generated_offer_id) && normalizeText(booking.accepted_generated_offer_id) !== generatedOffer.id) {
      sendJson(res, 409, { error: "Another generated offer has already been accepted for this booking." });
      return;
    }

    const otpChannel = normalizeText(payload?.otp_channel).toUpperCase();
    if (!otpChannel && normalizeText(payload?.otp_code)) {
      sendJson(res, 422, { error: "otp_channel is required when otp_code is provided." });
      return;
    }

    if (otpChannel) {
      if (otpChannel !== "EMAIL") {
        sendJson(res, 422, { error: "Only EMAIL OTP verification is supported right now." });
        return;
      }

      const existingChallenge = findOfferAcceptanceChallenge(store, bookingId, generatedOfferId, otpChannel);
      if (!normalizeText(payload?.otp_code)) {
        const contact = resolveAcceptanceContact(booking, payload);
        if (!contact.ok) {
          sendJson(res, 422, { error: contact.error });
          return;
        }
        if (!normalizeText(contact.acceptedByEmail)) {
          sendJson(res, 422, { error: "accepted_by_email is required for EMAIL OTP verification." });
          return;
        }

        const challengeCode = createOfferAcceptanceOtpCode();
        const issuedAt = nowIso();
        const throttle = buildOfferAcceptanceOtpThrottle(existingChallenge, issuedAt);
        if (!throttle.allowed) {
          sendJson(res, throttle.status, {
            error: throttle.error,
            retry_after_seconds: throttle.retryAfterSeconds
          });
          return;
        }

        const expiresAt = new Date(Date.parse(issuedAt) + OFFER_ACCEPTANCE_OTP_TTL_MS).toISOString();
        const challenge = {
          id: normalizeText(existingChallenge?.id) || `offer_acceptance_challenge_${randomUUID()}`,
          booking_id: bookingId,
          generated_offer_id: generatedOfferId,
          channel: otpChannel,
          recipient: contact.acceptedByEmail,
          code_sha256: sha256Hex(challengeCode),
          issued_at: issuedAt,
          last_sent_at: throttle.lastSentAt,
          resend_available_at: throttle.resendAvailableAt,
          send_window_started_at: throttle.sendWindowStartedAt,
          send_count: throttle.sendCount,
          expires_at: expiresAt,
          attempts: 0,
          accepted_by_name: contact.acceptedByName,
          accepted_by_email: contact.acceptedByEmail,
          accepted_by_phone: contact.acceptedByPhone,
          accepted_by_person_id: contact.acceptedByPersonId,
          language: normalizePdfLang(payload?.language || generatedOffer?.lang || booking?.customer_language || "en")
        };

        upsertOfferAcceptanceChallenge(store, challenge);
        await persistStore(store);

        try {
          const generatedOfferSnapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
          const otpCopy = buildGeneratedOfferOtpEmailCopy(
            booking,
            generatedOfferSnapshot,
            contact.acceptedByName,
            challengeCode
          );
          await getGmailDraftsClient().sendMessage({
            to: contact.acceptedByEmail,
            subject: otpCopy.subject,
            greeting: otpCopy.greeting,
            intro: otpCopy.intro,
            footer: otpCopy.footer,
            fromName: "Asia Travel Plan"
          });
        } catch (error) {
          removeOfferAcceptanceChallenges(store, bookingId, generatedOfferId, otpChannel);
          await persistStore(store).catch(() => {});
          const detail = String(error?.message || error);
          const status = /not configured/i.test(detail) ? 503 : 502;
          sendJson(res, status, {
            error: "Could not send acceptance verification code",
            detail
          });
          return;
        }

        addActivity(
          store,
          booking.id,
          "OFFER_ACCEPTANCE_OTP_SENT",
          "public_api",
          `Acceptance OTP sent to ${maskOtpRecipient(otpChannel, contact.acceptedByEmail)}`
        );
        await persistStore(store);

        sendJson(res, 202, buildPublicGeneratedOfferAcceptResponse({
          bookingId,
          generatedOfferId,
          otpChannel,
          otpSentTo: maskOtpRecipient(otpChannel, contact.acceptedByEmail),
          otpExpiresAt: expiresAt,
          retryAfterSeconds: throttle.retryAfterSeconds ?? Math.max(1, Math.ceil(OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS / 1000))
        }));
        return;
      }

      if (!existingChallenge) {
        sendJson(res, 422, { error: "No pending acceptance verification challenge was found." });
        return;
      }

      const nowMs = Date.parse(nowIso());
      if (Date.parse(existingChallenge.expires_at || "") <= (Number.isFinite(nowMs) ? nowMs : Date.now())) {
        removeOfferAcceptanceChallenges(store, bookingId, generatedOfferId, otpChannel);
        await persistStore(store);
        sendJson(res, 422, { error: "The acceptance verification code has expired. Request a new code." });
        return;
      }

      const nextAttempts = Number(existingChallenge.attempts || 0) + 1;
      if (normalizeText(existingChallenge.code_sha256) !== sha256Hex(payload.otp_code)) {
        if (nextAttempts >= OFFER_ACCEPTANCE_OTP_MAX_ATTEMPTS) {
          removeOfferAcceptanceChallenges(store, bookingId, generatedOfferId, otpChannel);
        } else {
          existingChallenge.attempts = nextAttempts;
          upsertOfferAcceptanceChallenge(store, existingChallenge);
        }
        await persistStore(store);
        sendJson(res, 422, { error: "The acceptance verification code is invalid." });
        return;
      }

      const finalized = await finalizeGeneratedOfferAcceptance({
        req,
        store,
        booking,
        generatedOffer,
        acceptedByName: normalizeText(existingChallenge.accepted_by_name),
        acceptedByEmail: normalizeText(existingChallenge.accepted_by_email),
        acceptedByPhone: normalizeText(existingChallenge.accepted_by_phone),
        acceptedByPersonId: normalizeText(existingChallenge.accepted_by_person_id),
        language: normalizePdfLang(existingChallenge.language || payload?.language || generatedOffer?.lang || "en"),
        method: "PORTAL_CLICK_OTP",
        otpChannel,
        otpVerifiedAt: nowIso()
      });
      if (!finalized.ok) {
        sendJson(res, finalized.status || 422, { error: finalized.error || "Could not finalize offer acceptance." });
        return;
      }
      sendJson(res, 200, buildPublicGeneratedOfferAcceptResponse({
        bookingId,
        generatedOfferId,
        acceptance: finalized.acceptance
      }));
      return;
    }

    const contact = resolveAcceptanceContact(booking, payload);
    if (!contact.ok) {
      sendJson(res, 422, { error: contact.error });
      return;
    }

    const finalized = await finalizeGeneratedOfferAcceptance({
      req,
      store,
      booking,
      generatedOffer,
      acceptedByName: contact.acceptedByName,
      acceptedByEmail: contact.acceptedByEmail,
      acceptedByPhone: contact.acceptedByPhone,
      acceptedByPersonId: contact.acceptedByPersonId,
      language: normalizePdfLang(payload?.language || generatedOffer?.lang || booking?.customer_language || "en"),
      method: "PORTAL_CLICK"
    });
    if (!finalized.ok) {
      sendJson(res, finalized.status || 422, { error: finalized.error || "Could not finalize offer acceptance." });
      return;
    }
    sendJson(res, 200, buildPublicGeneratedOfferAcceptResponse({
      bookingId,
      generatedOfferId,
      acceptance: finalized.acceptance
    }));
  }

  return {
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf,
    handlePublicAcceptGeneratedOffer
  };
}
