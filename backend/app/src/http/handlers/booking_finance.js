import { validateBookingOfferTranslateRequest, validatePublicGeneratedOfferAcceptRequest } from "../../../Generated/API/generated_APIModels.js";
import { readFile } from "node:fs/promises";
import { createGmailDraftsClient } from "../../lib/gmail_drafts.js";
import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import {
  buildOfferAcceptanceToken,
  buildGeneratedOfferSnapshotHash,
  buildOfferAcceptanceStatement,
  buildOfferAcceptanceTermsSnapshot,
  createOfferAcceptanceTokenNonce,
  createOfferAcceptanceOtpCode,
  maskOtpRecipient,
  OFFER_ACCEPTANCE_OTP_MAX_ATTEMPTS,
  OFFER_ACCEPTANCE_OTP_MAX_SENDS_PER_WINDOW,
  OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS,
  OFFER_ACCEPTANCE_OTP_SEND_WINDOW_MS,
  OFFER_ACCEPTANCE_OTP_TTL_MS,
  verifyOfferAcceptanceToken,
  OFFER_ACCEPTANCE_TERMS_VERSION,
  sha256Hex
} from "../../domain/offer_acceptance.js";
import {
  mergeEditableLocalizedTextField,
  mergeLocalizedTextField,
  normalizeBookingContentLang
} from "../../domain/booking_content_i18n.js";
import {
  markOfferTranslationManual,
  translateOfferFromEnglish
} from "../../domain/booking_translation.js";

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
    buildBookingOfferReadModel,
    buildBookingTravelPlanReadModel,
    formatMoney,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    randomUUID,
    writeGeneratedOfferPdf,
    generatedOfferPdfPath,
    gmailDraftsConfig,
    offerAcceptanceTokenConfig,
    getBookingContactProfile,
    getRequestIpAddress,
    rm,
    canAccessBooking,
    sendFileWithCache,
    translateEntries
  } = deps;

  let gmailDraftsClient = null;
  const offerAcceptanceTokenSecret = normalizeText(offerAcceptanceTokenConfig?.secret);
  const offerAcceptanceTokenTtlMs = Math.max(60 * 1000, Number(offerAcceptanceTokenConfig?.ttlMs || 0) || (7 * 24 * 60 * 60 * 1000));

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
      ...publicGeneratedOfferFields(normalizedGeneratedOffer),
      pdf_url: `/api/v1/bookings/${encodeURIComponent(booking.id)}/generated-offers/${encodeURIComponent(generatedOffer.id)}/pdf`
    };
  }

  function publicGeneratedOfferFields(generatedOffer) {
    if (!generatedOffer || typeof generatedOffer !== "object") return {};
    const {
      pdf_frozen_at: _pdfFrozenAt,
      pdf_sha256: _pdfSha256,
      public_acceptance_token_nonce: _acceptanceTokenNonce,
      public_acceptance_token_created_at: _acceptanceTokenCreatedAt,
      public_acceptance_token_expires_at: _acceptanceTokenExpiresAt,
      public_acceptance_token_revoked_at: _acceptanceTokenRevokedAt,
      ...publicFields
    } = generatedOffer;
    const acceptanceNonce = normalizeText(generatedOffer?.public_acceptance_token_nonce);
    const acceptanceExpiresAt = normalizeText(generatedOffer?.public_acceptance_token_expires_at);
    if (!offerAcceptanceTokenSecret || !acceptanceNonce || !acceptanceExpiresAt) {
      return publicFields;
    }
    try {
      return {
        ...publicFields,
        public_acceptance_token: buildOfferAcceptanceToken({
          bookingId: generatedOffer?.booking_id,
          generatedOfferId: generatedOffer?.id,
          nonce: acceptanceNonce,
          expiresAt: acceptanceExpiresAt,
          secret: offerAcceptanceTokenSecret
        }),
        public_acceptance_expires_at: acceptanceExpiresAt
      };
    } catch {
      return publicFields;
    }
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

  function normalizeGeneratedOfferSnapshot(generatedOffer, booking) {
    const snapshotLang = normalizePdfLang(
      generatedOffer?.lang
      || booking?.customer_language
      || (Array.isArray(booking?.persons)
        ? booking.persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact"))?.preferred_language
        : null)
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
    const snapshotCurrency = normalizeText(
      generatedOffer?.currency
      || generatedOffer?.offer?.currency
      || booking?.offer?.currency
      || booking?.preferred_currency
      || BASE_CURRENCY
    ) || BASE_CURRENCY;
    const offerSnapshot = normalizeBookingOffer(generatedOffer?.offer, snapshotCurrency, {
      contentLang: snapshotLang,
      flatLang: snapshotLang
    });
    return {
      ...generatedOffer,
      lang: snapshotLang,
      currency: offerSnapshot.currency || snapshotCurrency,
      total_price_cents: Number(generatedOffer?.total_price_cents || offerSnapshot.total_price_cents || 0),
      offer: offerSnapshot,
      travel_plan: normalizeBookingTravelPlan(generatedOffer?.travel_plan, offerSnapshot, {
        lang: snapshotLang,
        strictReferences: false
      })
    };
  }

  async function ensureFrozenGeneratedOfferPdf(generatedOffer, booking, options = {}) {
    const { store = null, persistMetadata = true } = options;
    const pdfPath = generatedOfferPdfPath(generatedOffer.id);
    const storedFrozenAt = normalizeText(generatedOffer?.pdf_frozen_at);

    try {
      const pdfBuffer = await readFile(pdfPath);
      const sha256 = sha256Hex(pdfBuffer);
      let metadataChanged = false;
      if (!storedFrozenAt) {
        generatedOffer.pdf_frozen_at = normalizeText(generatedOffer?.created_at) || nowIso();
        metadataChanged = true;
      }
      if (normalizeText(generatedOffer?.pdf_sha256) !== sha256) {
        generatedOffer.pdf_sha256 = sha256;
        metadataChanged = true;
      }
      if (metadataChanged && store && persistMetadata) {
        await persistStore(store);
      }
      return { pdfPath, sha256, existed: true };
    } catch (error) {
      if (storedFrozenAt) {
        throw new Error("Frozen generated offer PDF artifact is missing.");
      }
    }

    const snapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const artifact = await writeGeneratedOfferPdf(snapshot, booking);
    generatedOffer.pdf_frozen_at = nowIso();
    generatedOffer.pdf_sha256 = artifact?.sha256 || null;
    if (store && persistMetadata) {
      await persistStore(store);
    }
    return {
      pdfPath: artifact?.outputPath || pdfPath,
      sha256: artifact?.sha256 || null,
      existed: false
    };
  }

  function requestContentLang(req, payload = null) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingContentLang(payload?.lang || requestUrl.searchParams.get("lang") || "en");
    } catch {
      return normalizeBookingContentLang(payload?.lang || "en");
    }
  }

  function requestUserAgent(req) {
    const raw = req?.headers?.["user-agent"];
    return normalizeText(Array.isArray(raw) ? raw[0] : raw);
  }

  function ensureGeneratedOfferAcceptanceTokenState(generatedOffer) {
    if (!generatedOffer || typeof generatedOffer !== "object") return false;
    let changed = false;
    const createdAt = normalizeText(generatedOffer?.public_acceptance_token_created_at || generatedOffer?.created_at || nowIso());
    const createdAtMs = parseIsoTimestamp(createdAt) ?? Date.now();
    const expiresAt = new Date(createdAtMs + offerAcceptanceTokenTtlMs).toISOString();

    if (!normalizeText(generatedOffer.public_acceptance_token_nonce)) {
      generatedOffer.public_acceptance_token_nonce = createOfferAcceptanceTokenNonce();
      changed = true;
    }
    if (!normalizeText(generatedOffer.public_acceptance_token_created_at)) {
      generatedOffer.public_acceptance_token_created_at = createdAt;
      changed = true;
    }
    if (!normalizeText(generatedOffer.public_acceptance_token_expires_at)) {
      generatedOffer.public_acceptance_token_expires_at = expiresAt;
      changed = true;
    }
    return changed;
  }

  function getOfferAcceptanceChallenges(store) {
    if (!Array.isArray(store.offer_acceptance_challenges)) {
      store.offer_acceptance_challenges = [];
    }
    return store.offer_acceptance_challenges;
  }

  function findOfferAcceptanceChallenge(store, bookingId, generatedOfferId, channel) {
    return getOfferAcceptanceChallenges(store).find((challenge) =>
      normalizeText(challenge?.booking_id) === bookingId
      && normalizeText(challenge?.generated_offer_id) === generatedOfferId
      && normalizeText(challenge?.channel).toUpperCase() === normalizeText(channel).toUpperCase()
    ) || null;
  }

  function upsertOfferAcceptanceChallenge(store, nextChallenge) {
    const remaining = getOfferAcceptanceChallenges(store).filter((challenge) =>
      !(
        normalizeText(challenge?.booking_id) === normalizeText(nextChallenge?.booking_id)
        && normalizeText(challenge?.generated_offer_id) === normalizeText(nextChallenge?.generated_offer_id)
        && normalizeText(challenge?.channel).toUpperCase() === normalizeText(nextChallenge?.channel).toUpperCase()
      )
    );
    remaining.push(nextChallenge);
    store.offer_acceptance_challenges = remaining;
    return nextChallenge;
  }

  function removeOfferAcceptanceChallenges(store, bookingId, generatedOfferId, channel = null) {
    const normalizedChannel = normalizeText(channel).toUpperCase();
    store.offer_acceptance_challenges = getOfferAcceptanceChallenges(store).filter((challenge) => {
      if (normalizeText(challenge?.booking_id) !== normalizeText(bookingId)) return true;
      if (normalizeText(challenge?.generated_offer_id) !== normalizeText(generatedOfferId)) return true;
      if (normalizedChannel && normalizeText(challenge?.channel).toUpperCase() !== normalizedChannel) return true;
      return false;
    });
  }

  function parseIsoTimestamp(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildOfferAcceptanceOtpThrottle(existingChallenge, issuedAt) {
    const nowMs = parseIsoTimestamp(issuedAt) ?? Date.now();
    const lastSentAtMs = parseIsoTimestamp(existingChallenge?.last_sent_at || existingChallenge?.issued_at);
    const resendAvailableAtMs = parseIsoTimestamp(existingChallenge?.resend_available_at);
    const storedWindowStartedAtMs = parseIsoTimestamp(existingChallenge?.send_window_started_at);
    const sendWindowStartedAtMs = storedWindowStartedAtMs ?? lastSentAtMs ?? nowMs;
    const sendCount = Number(existingChallenge?.send_count || 0);

    const isWindowExpired = (nowMs - sendWindowStartedAtMs) >= OFFER_ACCEPTANCE_OTP_SEND_WINDOW_MS;
    const normalizedWindowStartedAtMs = isWindowExpired ? nowMs : sendWindowStartedAtMs;
    const normalizedSendCount = isWindowExpired ? 0 : sendCount;

    if (
      resendAvailableAtMs
      && resendAvailableAtMs > nowMs
      && lastSentAtMs
    ) {
      return {
        allowed: false,
        status: 429,
        error: "Wait before requesting another acceptance verification code.",
        retryAfterSeconds: Math.max(1, Math.ceil((resendAvailableAtMs - nowMs) / 1000))
      };
    }

    if (normalizedSendCount >= OFFER_ACCEPTANCE_OTP_MAX_SENDS_PER_WINDOW) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((normalizedWindowStartedAtMs + OFFER_ACCEPTANCE_OTP_SEND_WINDOW_MS) - nowMs) / 1000)
      );
      return {
        allowed: false,
        status: 429,
        error: "Too many acceptance verification code requests. Try again later.",
        retryAfterSeconds
      };
    }

    const resendAvailableAt = new Date(nowMs + OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS).toISOString();
    return {
      allowed: true,
      sendCount: normalizedSendCount + 1,
      sendWindowStartedAt: new Date(normalizedWindowStartedAtMs).toISOString(),
      lastSentAt: new Date(nowMs).toISOString(),
      resendAvailableAt
    };
  }

  function resolveAcceptanceContact(booking, payload = {}) {
    const requestedPersonId = normalizeText(payload?.accepted_by_person_id);
    const matchedPerson = requestedPersonId
      ? (Array.isArray(booking?.persons) ? booking.persons : []).find((person) => normalizeText(person?.id) === requestedPersonId) || null
      : null;
    if (requestedPersonId && !matchedPerson) {
      return { ok: false, error: "accepted_by_person_id does not match a booking contact." };
    }

    const contact = getBookingContactProfile(booking);
    const resolvedName = normalizeText(payload?.accepted_by_name || matchedPerson?.name);
    const resolvedEmail = normalizeText(payload?.accepted_by_email || matchedPerson?.emails?.[0] || contact?.email);
    const resolvedPhone = normalizeText(payload?.accepted_by_phone || matchedPerson?.phone_numbers?.[0] || contact?.phone_number);

    if (!resolvedName) {
      return { ok: false, error: "accepted_by_name is required." };
    }

    return {
      ok: true,
      acceptedByName: resolvedName,
      acceptedByEmail: resolvedEmail || null,
      acceptedByPhone: resolvedPhone || null,
      acceptedByPersonId: requestedPersonId || null
    };
  }

  function buildPublicGeneratedOfferAccessResponse({ booking, generatedOffer, acceptanceToken }) {
    const normalizedGeneratedOffer = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    return {
      booking_id: booking.id,
      generated_offer_id: generatedOffer.id,
      booking_name: normalizeText(booking?.name || booking?.web_form_submission?.booking_name) || null,
      lang: normalizePdfLang(normalizedGeneratedOffer.lang || booking?.customer_language || "en"),
      currency: normalizedGeneratedOffer.currency,
      total_price_cents: Number(normalizedGeneratedOffer.total_price_cents || 0),
      comment: generatedOffer.comment ?? null,
      created_at: normalizeText(generatedOffer.created_at) || nowIso(),
      pdf_url: `/public/v1/bookings/${encodeURIComponent(booking.id)}/generated-offers/${encodeURIComponent(generatedOffer.id)}/pdf?token=${encodeURIComponent(acceptanceToken)}`,
      public_acceptance_expires_at: normalizeText(generatedOffer.public_acceptance_token_expires_at) || null,
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
    return verifyOfferAcceptanceToken(resolveAcceptanceTokenFromRequest(req), {
      bookingId,
      generatedOfferId,
      nonce: normalizeText(generatedOffer?.public_acceptance_token_nonce),
      expiresAt: normalizeText(generatedOffer?.public_acceptance_token_expires_at),
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
    incrementBookingRevision(booking, "offer_revision");
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

  function mergeOfferForLang(existingOffer, nextOffer, lang, preferredCurrency) {
    const normalizedLang = normalizeBookingContentLang(lang);
    const existingNormalized = normalizeBookingOffer(existingOffer, preferredCurrency, {
      contentLang: normalizedLang,
      flatLang: normalizedLang
    });
    const nextNormalized = normalizeBookingOffer(nextOffer, preferredCurrency, {
      contentLang: normalizedLang,
      flatLang: normalizedLang
    });
    const existingById = new Map(
      (Array.isArray(existingNormalized?.components) ? existingNormalized.components : []).map((component) => [component.id, component])
    );

    return {
      ...nextNormalized,
      components: (Array.isArray(nextNormalized.components) ? nextNormalized.components : []).map((component) => {
        const existingComponent = existingById.get(component.id);
        const labelField = mergeLocalizedTextField(
          existingComponent?.label_i18n ?? existingComponent?.label,
          component.label,
          normalizedLang,
          { fallbackLang: normalizedLang }
        );
        const detailsField = mergeEditableLocalizedTextField(
          existingComponent?.details_i18n ?? existingComponent?.details,
          component.details,
          component.details_i18n,
          normalizedLang,
          { pruneExtraTranslationsOnEnglishChange: true }
        );
        const notesField = mergeLocalizedTextField(
          existingComponent?.notes_i18n ?? existingComponent?.notes,
          component.notes,
          normalizedLang,
          { fallbackLang: normalizedLang }
        );
        return {
          ...component,
          label: labelField.text,
          label_i18n: labelField.map,
          details: detailsField.text,
          details_i18n: detailsField.map,
          notes: notesField.text,
          notes_i18n: notesField.map
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_pricing_revision", "pricing_revision", res))) return;

    const check = validateBookingPricingInput(payload.pricing);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const nextPricingBase = await convertBookingPricingToBaseCurrency(check.pricing);
    const nextPricingJson = JSON.stringify(nextPricingBase);
    const currentPricingJson = JSON.stringify(normalizeBookingPricing(booking.pricing));
    if (nextPricingJson === currentPricingJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
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

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
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
    const mergedOffer = mergeOfferForLang(
      booking.offer,
      check.offer,
      contentLang,
      booking.preferred_currency || booking.pricing?.currency || BASE_CURRENCY
    );
    if (contentLang !== "en") {
      markOfferTranslationManual(mergedOffer, contentLang, nowIso());
    }
    const nextOfferBase = await convertBookingOfferToBaseCurrency(mergedOffer);
    const nextOfferJson = JSON.stringify(nextOfferBase);
    const currentOfferJson = JSON.stringify(
      normalizeBookingOffer(booking.offer, booking.preferred_currency || booking.pricing?.currency || BASE_CURRENCY)
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

  async function handleTranslateBookingOfferFromEnglish(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingOfferTranslateRequest(payload);
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const contentLang = requestContentLang(req, payload);
    try {
      const translatedOffer = await translateOfferFromEnglish(
        booking.offer,
        contentLang,
        translateEntries,
        nowIso()
      );
      const nextOfferBase = await convertBookingOfferToBaseCurrency(translatedOffer);
      if (JSON.stringify(nextOfferBase) === JSON.stringify(booking.offer || null)) {
        sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
        return;
      }

      booking.offer = nextOfferBase;
      incrementBookingRevision(booking, "offer_revision");
      booking.updated_at = nowIso();
      addActivity(
        store,
        booking.id,
        "OFFER_TRANSLATED",
        actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
        `Offer translated from English to ${contentLang}`
      );
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(booking, req));
    } catch (error) {
      sendTranslationError(res, error);
    }
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
    const offerSnapshot = await buildBookingOfferReadModel(
      booking.offer,
      booking.offer?.currency || booking.preferred_currency || BASE_CURRENCY,
      { lang: documentLang }
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
    ensureGeneratedOfferAcceptanceTokenState(generatedOffer);

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

    const tokenVerification = verifyOfferAcceptanceToken(payload?.acceptance_token, {
      bookingId,
      generatedOfferId,
      nonce: normalizeText(generatedOffer?.public_acceptance_token_nonce),
      expiresAt: normalizeText(generatedOffer?.public_acceptance_token_expires_at),
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

      if (Date.parse(existingChallenge.expires_at || "") <= Date.now()) {
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

    const nextComment = normalizeText(payload?.comment) || null;
    if ((generatedOffers[index].comment || null) === nextComment) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
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
    if (normalizeText(booking?.accepted_generated_offer_id) === generatedOfferId) {
      sendJson(res, 409, { error: "Accepted generated offers cannot be deleted." });
      return;
    }

    const [removed] = generatedOffers.splice(index, 1);
    booking.generated_offers = generatedOffers;
    removeOfferAcceptanceChallenges(store, booking.id, generatedOfferId);
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
    handlePatchBookingPricing,
    handlePatchBookingOffer,
    handleTranslateBookingOfferFromEnglish,
    handlePostOfferExchangeRates,
    handleGenerateBookingOffer,
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf,
    handleGetGeneratedOfferPdf,
    handleCreateGeneratedOfferGmailDraft,
    handlePublicAcceptGeneratedOffer,
    handlePatchGeneratedBookingOffer,
    handleDeleteGeneratedBookingOffer
  };
}
