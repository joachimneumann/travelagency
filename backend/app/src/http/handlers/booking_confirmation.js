import { createGmailDraftsClient } from "../../lib/gmail_drafts.js";
import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import { validatePublicGeneratedOfferAcceptRequest } from "../../../Generated/API/generated_APIModels.js";
import {
  buildGeneratedOfferBookingConfirmationPublicSummary,
  buildPublicGeneratedOfferBookingConfirmationRouteView,
  buildGeneratedOfferSnapshotHash,
  buildBookingConfirmationStatement,
  buildBookingConfirmationTermsSnapshot,
  createBookingConfirmationOtpCode,
  maskOtpRecipient,
  BOOKING_CONFIRMATION_OTP_MAX_ATTEMPTS,
  BOOKING_CONFIRMATION_OTP_RESEND_COOLDOWN_MS,
  BOOKING_CONFIRMATION_OTP_TTL_MS,
  BOOKING_CONFIRMATION_TERMS_VERSION,
  readGeneratedOfferBookingConfirmationTokenState,
  sha256Hex,
  verifyBookingConfirmationToken,
  findBookingConfirmationChallenge,
  upsertBookingConfirmationChallenge,
    removeBookingConfirmationChallenges,
    buildBookingConfirmationOtpThrottle,
    synchronizeGeneratedOfferBookingConfirmationRouteStatus
  } from "../../domain/booking_confirmation.js";

export function createBookingConfirmationHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    normalizeBookingPricing,
    nowIso,
    addActivity,
    formatMoney,
    incrementBookingRevision,
    convertBookingPricingToBaseCurrency,
    randomUUID,
    gmailDraftsConfig,
    bookingConfirmationTokenConfig,
    getBookingContactProfile,
    getRequestIpAddress,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
    sendFileWithCache
  } = deps;

  let gmailDraftsClient = null;
  const bookingConfirmationTokenSecret = normalizeText(bookingConfirmationTokenConfig?.secret);

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
      subject: pdfT(lang, "email.booking_confirmation_otp_subject", "Your Asia Travel Plan booking confirmation code"),
      greeting: acceptedByName
        ? pdfT(lang, "email.greeting_named", "Hello {name},", { name: acceptedByName })
        : pdfT(lang, "email.greeting_generic", "Hello,"),
      intro: bookingTitle
        ? pdfT(
          lang,
          "email.booking_confirmation_otp_intro_named",
          "Use this one-time code to confirm the Asia Travel Plan booking for {trip}: {code}.",
          { trip: bookingTitle, code: normalizedCode }
        )
        : pdfT(
          lang,
          "email.booking_confirmation_otp_intro_generic",
          "Use this one-time code to confirm your Asia Travel Plan booking: {code}.",
          { code: normalizedCode }
        ),
      footer: `${pdfT(lang, "email.booking_confirmation_otp_expiry", "The code expires in 10 minutes.")}\n\n${pdfT(lang, "offer.closing_team", "The Asia Travel Plan Team")}`
    };
  }

  function resolveBookingConfirmationContact(booking, payload = {}) {
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

  function normalizedEmailForComparison(value) {
    return normalizeText(value).toLowerCase();
  }

  function resolveOtpBookingConfirmationContact(booking, payload = {}) {
    const contactProfile = getBookingContactProfile(booking);
    const acceptedByName = normalizeText(payload?.accepted_by_name || contactProfile?.name);
    const acceptedByEmail = normalizeText(contactProfile?.email);
    const acceptedByPhone = normalizeText(contactProfile?.phone_number);
    const requestedEmail = normalizeText(payload?.accepted_by_email);

    if (!acceptedByName) {
      return { ok: false, error: "accepted_by_name is required." };
    }
    if (!acceptedByEmail) {
      return { ok: false, error: "OTP verification requires a booking contact email." };
    }
    if (requestedEmail && normalizedEmailForComparison(requestedEmail) !== normalizedEmailForComparison(acceptedByEmail)) {
      return { ok: false, error: "OTP verification can only be sent to the booking contact email." };
    }

    return {
      ok: true,
      acceptedByName,
      acceptedByEmail,
      acceptedByPhone: acceptedByPhone || null,
      acceptedByPersonId: null
    };
  }

  function buildPublicGeneratedOfferAccessResponse({ booking, generatedOffer, bookingConfirmationToken }) {
    const normalizedGeneratedOffer = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const bookingConfirmationTokenState = readGeneratedOfferBookingConfirmationTokenState(generatedOffer);
    const bookingName = normalizeText(booking?.name || booking?.web_form_submission?.booking_name);
    const comment = normalizeText(generatedOffer?.comment);
    const bookingConfirmationRoute = buildPublicGeneratedOfferBookingConfirmationRouteView(generatedOffer, { now: nowIso() });
    const bookingConfirmationSummary = buildGeneratedOfferBookingConfirmationPublicSummary(generatedOffer?.booking_confirmation);
    const otpRecipientHint = normalizeText(
      bookingConfirmationRoute?.mode === "OTP"
        ? maskOtpRecipient(getBookingContactProfile(booking)?.email)
        : ""
    );
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
      ...(bookingConfirmationRoute ? { booking_confirmation_route: bookingConfirmationRoute } : {}),
      ...(otpRecipientHint ? { otp_recipient_hint: otpRecipientHint } : {}),
      ...(bookingConfirmationTokenState.expiresAt ? { public_booking_confirmation_expires_at: bookingConfirmationTokenState.expiresAt } : {}),
      confirmed: Boolean(generatedOffer?.booking_confirmation),
      ...(bookingConfirmationSummary ? { booking_confirmation: bookingConfirmationSummary } : {})
    };
  }

  function buildPublicGeneratedOfferAcceptResponse({
    bookingId,
    generatedOfferId,
    generatedOffer = null,
    bookingConfirmation = null,
    otpChannel = null,
    otpSentTo = "",
    otpExpiresAt = "",
    retryAfterSeconds = null
  }) {
    return {
      booking_id: bookingId,
      generated_offer_id: generatedOfferId,
      confirmed: Boolean(bookingConfirmation),
      status: bookingConfirmation ? "CONFIRMED" : "OTP_REQUIRED",
      ...(generatedOffer ? { booking_confirmation_route: buildPublicGeneratedOfferBookingConfirmationRouteView(generatedOffer, { now: nowIso() }) } : {}),
      ...(bookingConfirmation ? { booking_confirmation: buildGeneratedOfferBookingConfirmationPublicSummary(bookingConfirmation) } : {}),
      ...(otpChannel ? { otp_channel: otpChannel } : {}),
      ...(otpSentTo ? { otp_sent_to: otpSentTo } : {}),
      ...(otpExpiresAt ? { otp_expires_at: otpExpiresAt } : {}),
      ...(Number.isFinite(Number(retryAfterSeconds)) ? { retry_after_seconds: Math.max(0, Number(retryAfterSeconds)) } : {})
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

  function toDateOnly(value) {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) return directMatch[1];
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function shiftDateOnly(value, days) {
    const baseDate = toDateOnly(value);
    if (!baseDate) return null;
    const parsed = new Date(`${baseDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setUTCDate(parsed.getUTCDate() + (Number.isFinite(Number(days)) ? Math.round(Number(days)) : 0));
    return parsed.toISOString().slice(0, 10);
  }

  function resolveAcceptedOfferPaymentDueDate(line, booking, acceptedAt) {
    const dueRule = line?.due_rule && typeof line.due_rule === "object" ? line.due_rule : {};
    const dueType = normalizeText(dueRule.type).toUpperCase();
    const days = Number.isFinite(Number(dueRule.days)) ? Number(dueRule.days) : 0;

    if (dueType === "FIXED_DATE") {
      return toDateOnly(dueRule.fixed_date);
    }
    if (dueType === "DAYS_AFTER_ACCEPTANCE") {
      return shiftDateOnly(acceptedAt, days);
    }
    if (dueType === "DAYS_BEFORE_TRIP_START") {
      return shiftDateOnly(booking?.travel_start_day, -days);
    }
    if (dueType === "DAYS_AFTER_TRIP_START") {
      return shiftDateOnly(booking?.travel_start_day, days);
    }
    if (dueType === "DAYS_AFTER_TRIP_END") {
      return shiftDateOnly(booking?.travel_end_day, days);
    }
    return toDateOnly(acceptedAt);
  }

  function buildAcceptedOfferSeedPricing({ booking, normalizedSnapshot, acceptedAt }) {
    const paymentTerms = normalizedSnapshot?.payment_terms;
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    if (!lines.length) return null;

    return {
      currency: normalizeText(paymentTerms?.currency || normalizedSnapshot?.currency) || "USD",
      agreed_net_amount_cents: Math.max(0, Math.round(Number(normalizedSnapshot?.total_price_cents || 0))),
      adjustments: [],
      payments: lines.map((line, index) => {
        const label = normalizeText(line?.label) || `Payment ${index + 1}`;
        const dueDate = resolveAcceptedOfferPaymentDueDate(line, booking, acceptedAt);
        const notes = normalizeText(line?.description);
        return {
          id: `pricing_payment_${randomUUID()}`,
          label,
          ...(dueDate ? { due_date: dueDate } : {}),
          net_amount_cents: Math.max(0, Math.round(Number(line?.resolved_amount_cents || 0))),
          tax_rate_basis_points: 0,
          status: "PENDING",
          paid_at: null,
          ...(notes ? { notes } : {})
        };
      })
    };
  }

  async function seedAcceptedOfferPricing({ booking, normalizedSnapshot, acceptedAt }) {
    const seedPricing = buildAcceptedOfferSeedPricing({ booking, normalizedSnapshot, acceptedAt });
    if (!seedPricing) return false;

    const currentPricing = await convertBookingPricingToBaseCurrency(booking?.pricing || {});
    if (Array.isArray(currentPricing?.payments) && currentPricing.payments.length > 0) {
      return false;
    }

    const convertedSeedPricing = await convertBookingPricingToBaseCurrency(seedPricing);
    const nextPricing = normalizeBookingPricing({
      ...currentPricing,
      currency: convertedSeedPricing.currency,
      agreed_net_amount_cents: Number(currentPricing?.agreed_net_amount_cents || 0) > 0
        ? currentPricing.agreed_net_amount_cents
        : convertedSeedPricing.agreed_net_amount_cents,
      payments: convertedSeedPricing.payments
    });

    if (JSON.stringify(nextPricing) === JSON.stringify(currentPricing)) {
      return false;
    }

    booking.pricing = nextPricing;
    incrementBookingRevision(booking, "pricing_revision");
    return true;
  }

  async function finalizeGeneratedOfferBookingConfirmation({
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
    if (normalizeText(booking?.confirmed_generated_offer_id) && normalizeText(booking.confirmed_generated_offer_id) !== generatedOffer.id) {
      return { ok: false, status: 409, error: "Another generated offer has already been confirmed for this booking." };
    }

    if (generatedOffer?.booking_confirmation && typeof generatedOffer.booking_confirmation === "object") {
      if (!normalizeText(booking?.confirmed_generated_offer_id)) {
        booking.confirmed_generated_offer_id = generatedOffer.id;
      }
      if (generatedOffer?.booking_confirmation_route && typeof generatedOffer.booking_confirmation_route === "object") {
        generatedOffer.booking_confirmation_route.status = "CONFIRMED";
      }
      if (!normalizeText(booking?.confirmed_generated_offer_id) || generatedOffer?.booking_confirmation_route?.status === "CONFIRMED") {
        await persistStore(store);
      }
      removeBookingConfirmationChallenges(store, booking.id, generatedOffer.id);
      return { ok: true, booking_confirmation: generatedOffer.booking_confirmation, unchanged: true };
    }

    const normalizedSnapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const frozenPdf = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, { store });
    const bookingConfirmation = {
      id: `booking_confirmation_${randomUUID()}`,
      accepted_at: nowIso(),
      accepted_by_name: acceptedByName,
      ...(acceptedByEmail ? { accepted_by_email: acceptedByEmail } : {}),
      ...(acceptedByPhone ? { accepted_by_phone: acceptedByPhone } : {}),
      ...(acceptedByPersonId ? { accepted_by_person_id: acceptedByPersonId } : {}),
      language: normalizePdfLang(language || normalizedSnapshot.lang || booking?.customer_language || "en"),
      method,
      statement_snapshot: buildBookingConfirmationStatement({
        bookingName: normalizeText(booking?.name || booking?.web_form_submission?.booking_name),
        formattedTotal: formatMoney(normalizedSnapshot.total_price_cents, normalizedSnapshot.currency)
      }),
      terms_version: BOOKING_CONFIRMATION_TERMS_VERSION,
      terms_snapshot: buildBookingConfirmationTermsSnapshot(),
      offer_currency: normalizedSnapshot.currency,
      offer_total_price_cents: Number(normalizedSnapshot.total_price_cents || 0),
      offer_pdf_sha256: normalizeText(generatedOffer?.pdf_sha256 || frozenPdf?.sha256),
      offer_snapshot_sha256: buildGeneratedOfferSnapshotHash(normalizedSnapshot),
      ip_address: normalizeText(getRequestIpAddress(req)),
      user_agent: requestUserAgent(req),
      ...(otpChannel ? { otp_channel: otpChannel, otp_verified_at: otpVerifiedAt || nowIso() } : {})
    };

    generatedOffer.booking_confirmation = bookingConfirmation;
    if (generatedOffer?.booking_confirmation_route && typeof generatedOffer.booking_confirmation_route === "object") {
      generatedOffer.booking_confirmation_route.status = "CONFIRMED";
    }
    booking.confirmed_generated_offer_id = generatedOffer.id;
    await seedAcceptedOfferPricing({
      booking,
      normalizedSnapshot,
      acceptedAt: bookingConfirmation.accepted_at
    });
    removeBookingConfirmationChallenges(store, booking.id, generatedOffer.id);
    booking.offer_revision = (Number.isInteger(Number(booking.offer_revision)) ? Number(booking.offer_revision) : 0) + 1;
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_CONFIRMED",
      "public_api",
      `Generated booking confirmed (${formatMoney(bookingConfirmation.offer_total_price_cents, bookingConfirmation.offer_currency)})`
    );
    await persistStore(store);
    return { ok: true, booking_confirmation: bookingConfirmation, unchanged: false };
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
    if (synchronizeGeneratedOfferBookingConfirmationRouteStatus(generatedOffer, { now: nowIso() })) {
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
    if (synchronizeGeneratedOfferBookingConfirmationRouteStatus(generatedOffer, { now: nowIso() })) {
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
    if (synchronizeGeneratedOfferBookingConfirmationRouteStatus(generatedOffer, { now: nowIso() })) {
      await persistStore(store);
    }

    const bookingConfirmationTokenState = readGeneratedOfferBookingConfirmationTokenState(generatedOffer);
    if (bookingConfirmationTokenState.revokedAt) {
      sendJson(res, 403, { error: "The booking confirmation token is invalid." });
      return;
    }

    const tokenVerification = verifyBookingConfirmationToken(payload?.booking_confirmation_token, {
      bookingId,
      generatedOfferId,
      nonce: bookingConfirmationTokenState.nonce,
      expiresAt: bookingConfirmationTokenState.expiresAt,
      secret: bookingConfirmationTokenSecret,
      now: nowIso()
    });
    if (!tokenVerification.ok) {
      const status = tokenVerification.code === "TOKEN_NOT_CONFIGURED"
        ? 503
        : tokenVerification.code === "TOKEN_EXPIRED"
          ? 410
          : 403;
      sendJson(res, status, { error: tokenVerification.error || "The booking confirmation token is invalid." });
      return;
    }

    if (generatedOffer?.booking_confirmation && typeof generatedOffer.booking_confirmation === "object") {
      if (!normalizeText(booking?.confirmed_generated_offer_id)) {
        booking.confirmed_generated_offer_id = generatedOffer.id;
        await persistStore(store);
      }
      sendJson(res, 200, buildPublicGeneratedOfferAcceptResponse({
        bookingId,
        generatedOfferId,
        generatedOffer,
        bookingConfirmation: generatedOffer.booking_confirmation
      }));
      return;
    }

    if (normalizeText(generatedOffer?.booking_confirmation_route?.mode).toUpperCase() === "DEPOSIT_PAYMENT") {
      sendJson(res, 409, { error: "This offer is confirmed by the required deposit payment, not by OTP booking confirmation." });
      return;
    }

    if (normalizeText(booking?.confirmed_generated_offer_id) && normalizeText(booking.confirmed_generated_offer_id) !== generatedOffer.id) {
      sendJson(res, 409, { error: "Another generated offer has already been confirmed for this booking." });
      return;
    }

    const otpChannel = normalizeText(payload?.otp_channel).toUpperCase();
    const explicitOtpRoute = normalizeText(generatedOffer?.booking_confirmation_route?.mode).toUpperCase() === "OTP";
    if (!otpChannel && normalizeText(payload?.otp_code)) {
      sendJson(res, 422, { error: "otp_channel is required when otp_code is provided." });
      return;
    }
    if (explicitOtpRoute && !otpChannel) {
      sendJson(res, 422, { error: "This offer requires OTP verification before it can be confirmed." });
      return;
    }

    if (otpChannel) {
      if (otpChannel !== "EMAIL") {
        sendJson(res, 422, { error: "Only EMAIL OTP verification is supported right now." });
        return;
      }

      const existingChallenge = findBookingConfirmationChallenge(store, bookingId, generatedOfferId, otpChannel);
      if (!normalizeText(payload?.otp_code)) {
        const contact = resolveOtpBookingConfirmationContact(booking, payload);
        if (!contact.ok) {
          sendJson(res, 422, { error: contact.error });
          return;
        }

        const challengeCode = createBookingConfirmationOtpCode();
        const issuedAt = nowIso();
        const throttle = buildBookingConfirmationOtpThrottle(existingChallenge, issuedAt);
        if (!throttle.allowed) {
          sendJson(res, throttle.status, {
            error: throttle.error,
            retry_after_seconds: throttle.retryAfterSeconds
          });
          return;
        }

        const expiresAt = new Date(Date.parse(issuedAt) + BOOKING_CONFIRMATION_OTP_TTL_MS).toISOString();
        const challenge = {
          id: normalizeText(existingChallenge?.id) || `booking_confirmation_challenge_${randomUUID()}`,
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

        upsertBookingConfirmationChallenge(store, challenge);
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
          removeBookingConfirmationChallenges(store, bookingId, generatedOfferId, otpChannel);
          await persistStore(store).catch(() => {});
          const detail = String(error?.message || error);
          const status = /not configured/i.test(detail) ? 503 : 502;
          sendJson(res, status, {
            error: "Could not send booking confirmation code",
            detail
          });
          return;
        }

        addActivity(
          store,
          booking.id,
          "BOOKING_CONFIRMATION_OTP_SENT",
          "public_api",
          `Booking confirmation OTP sent to ${maskOtpRecipient(otpChannel, contact.acceptedByEmail)}`
        );
        await persistStore(store);

        sendJson(res, 202, buildPublicGeneratedOfferAcceptResponse({
          bookingId,
          generatedOfferId,
          generatedOffer,
          otpChannel,
          otpSentTo: maskOtpRecipient(otpChannel, contact.acceptedByEmail),
          otpExpiresAt: expiresAt,
          retryAfterSeconds: throttle.retryAfterSeconds ?? Math.max(1, Math.ceil(BOOKING_CONFIRMATION_OTP_RESEND_COOLDOWN_MS / 1000))
        }));
        return;
      }

      if (!existingChallenge) {
        sendJson(res, 422, { error: "No pending booking confirmation challenge was found." });
        return;
      }

      const nowMs = Date.parse(nowIso());
      if (Date.parse(existingChallenge.expires_at || "") <= (Number.isFinite(nowMs) ? nowMs : Date.now())) {
        removeBookingConfirmationChallenges(store, bookingId, generatedOfferId, otpChannel);
        await persistStore(store);
        sendJson(res, 422, { error: "The booking confirmation code has expired. Request a new code." });
        return;
      }

      const nextAttempts = Number(existingChallenge.attempts || 0) + 1;
      if (normalizeText(existingChallenge.code_sha256) !== sha256Hex(payload.otp_code)) {
        if (nextAttempts >= BOOKING_CONFIRMATION_OTP_MAX_ATTEMPTS) {
          removeBookingConfirmationChallenges(store, bookingId, generatedOfferId, otpChannel);
        } else {
          existingChallenge.attempts = nextAttempts;
          upsertBookingConfirmationChallenge(store, existingChallenge);
        }
        await persistStore(store);
        sendJson(res, 422, { error: "The booking confirmation code is invalid." });
        return;
      }

      const finalized = await finalizeGeneratedOfferBookingConfirmation({
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
        sendJson(res, finalized.status || 422, { error: finalized.error || "Could not finalize booking confirmation." });
        return;
      }
      sendJson(res, 200, buildPublicGeneratedOfferAcceptResponse({
        bookingId,
        generatedOfferId,
        generatedOffer,
        bookingConfirmation: finalized.booking_confirmation
      }));
      return;
    }

    const contact = resolveBookingConfirmationContact(booking, payload);
    if (!contact.ok) {
      sendJson(res, 422, { error: contact.error });
      return;
    }

    const finalized = await finalizeGeneratedOfferBookingConfirmation({
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
      sendJson(res, finalized.status || 422, { error: finalized.error || "Could not finalize booking confirmation." });
      return;
    }
    sendJson(res, 200, buildPublicGeneratedOfferAcceptResponse({
      bookingId,
      generatedOfferId,
      generatedOffer,
        bookingConfirmation: finalized.booking_confirmation
      }));
  }

  return {
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf,
    handlePublicAcceptGeneratedOffer
  };
}
