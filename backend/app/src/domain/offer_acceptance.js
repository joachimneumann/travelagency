import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const OFFER_ACCEPTANCE_TERMS_VERSION = "ATP_OFFER_ACCEPTANCE_V1";
export const OFFER_ACCEPTANCE_OTP_TTL_MS = 10 * 60 * 1000;
export const OFFER_ACCEPTANCE_OTP_MAX_ATTEMPTS = 5;
export const OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OFFER_ACCEPTANCE_OTP_MAX_SENDS_PER_WINDOW = 5;
export const OFFER_ACCEPTANCE_OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const OFFER_ACCEPTANCE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OFFER_ACCEPTANCE_TOKEN_SCOPE = "generated_offer_acceptance";
const GENERATED_OFFER_ACCEPTANCE_ROUTE_MODES = new Set(["DEPOSIT_PAYMENT", "OTP"]);
const GENERATED_OFFER_ACCEPTANCE_ROUTE_STATUSES = new Set(["OPEN", "AWAITING_PAYMENT", "ACCEPTED", "EXPIRED", "REVOKED"]);

function normalizeAcceptanceText(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function parseIsoTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function readGeneratedOfferAcceptanceTokenState(generatedOffer) {
  return {
    nonce: normalizeAcceptanceText(
      generatedOffer?.acceptance_token_nonce
      || generatedOffer?.public_acceptance_token_nonce
    ),
    createdAt: normalizeAcceptanceText(
      generatedOffer?.acceptance_token_created_at
      || generatedOffer?.public_acceptance_token_created_at
    ),
    expiresAt: normalizeAcceptanceText(
      generatedOffer?.acceptance_token_expires_at
      || generatedOffer?.public_acceptance_token_expires_at
    ),
    revokedAt: normalizeAcceptanceText(
      generatedOffer?.acceptance_token_revoked_at
      || generatedOffer?.public_acceptance_token_revoked_at
    )
  };
}

export function normalizeGeneratedOfferAcceptanceRouteMode(value) {
  const normalized = normalizeAcceptanceText(value).toUpperCase();
  return GENERATED_OFFER_ACCEPTANCE_ROUTE_MODES.has(normalized) ? normalized : "OTP";
}

export function normalizeGeneratedOfferAcceptanceRouteStatus(value, mode = "OTP") {
  const normalizedMode = normalizeGeneratedOfferAcceptanceRouteMode(mode);
  const normalized = normalizeAcceptanceText(value).toUpperCase();
  if (GENERATED_OFFER_ACCEPTANCE_ROUTE_STATUSES.has(normalized)) return normalized;
  return normalizedMode === "DEPOSIT_PAYMENT" ? "AWAITING_PAYMENT" : "OPEN";
}

function migrateLegacyGeneratedOfferAcceptanceTokenState(generatedOffer) {
  if (!generatedOffer || typeof generatedOffer !== "object") return false;
  let changed = false;
  const legacyFieldMap = [
    ["public_acceptance_token_nonce", "acceptance_token_nonce"],
    ["public_acceptance_token_created_at", "acceptance_token_created_at"],
    ["public_acceptance_token_expires_at", "acceptance_token_expires_at"],
    ["public_acceptance_token_revoked_at", "acceptance_token_revoked_at"]
  ];

  for (const [legacyField, currentField] of legacyFieldMap) {
    const legacyValue = normalizeAcceptanceText(generatedOffer?.[legacyField]);
    if (legacyValue && !normalizeAcceptanceText(generatedOffer?.[currentField])) {
      generatedOffer[currentField] = legacyValue;
      changed = true;
    }
    if (legacyField in generatedOffer) {
      delete generatedOffer[legacyField];
      changed = true;
    }
  }
  return changed;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => String(left).localeCompare(String(right)));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function sha256Hex(value) {
  const buffer = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? Buffer.from(value)
    : Buffer.from(String(value ?? ""), "utf8");
  return createHash("sha256").update(buffer).digest("hex");
}

export function createOfferAcceptanceOtpCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function createOfferAcceptanceTokenNonce() {
  return randomBytes(24).toString("base64url");
}

function buildOfferAcceptanceTokenPayload({ bookingId, generatedOfferId, nonce, expiresAt }) {
  return {
    scope: OFFER_ACCEPTANCE_TOKEN_SCOPE,
    booking_id: String(bookingId || ""),
    generated_offer_id: String(generatedOfferId || ""),
    nonce: String(nonce || ""),
    expires_at: String(expiresAt || "")
  };
}

function signOfferAcceptanceTokenPayload(payloadBase64, secret) {
  return createHmac("sha256", String(secret || "")).update(String(payloadBase64 || "")).digest("base64url");
}

export function buildOfferAcceptanceToken({ bookingId, generatedOfferId, nonce, expiresAt, secret }) {
  const normalizedSecret = normalizeAcceptanceText(secret);
  if (!normalizedSecret) {
    throw new Error("Offer acceptance token secret is not configured.");
  }
  const payloadBase64 = Buffer.from(
    JSON.stringify(buildOfferAcceptanceTokenPayload({ bookingId, generatedOfferId, nonce, expiresAt })),
    "utf8"
  ).toString("base64url");
  const signature = signOfferAcceptanceTokenPayload(payloadBase64, normalizedSecret);
  return `${payloadBase64}.${signature}`;
}

export function verifyOfferAcceptanceToken(token, { bookingId, generatedOfferId, nonce, expiresAt, secret, now = null } = {}) {
  const normalizedSecret = normalizeAcceptanceText(secret);
  if (!normalizedSecret) {
    return { ok: false, code: "TOKEN_NOT_CONFIGURED", error: "Offer acceptance token verification is not configured." };
  }

  const rawToken = normalizeAcceptanceText(token);
  const separatorIndex = rawToken.indexOf(".");
  if (!rawToken || separatorIndex <= 0 || separatorIndex === rawToken.length - 1) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }

  const payloadBase64 = rawToken.slice(0, separatorIndex);
  const signature = rawToken.slice(separatorIndex + 1);
  const expectedSignature = signOfferAcceptanceTokenPayload(payloadBase64, normalizedSecret);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }

  if (String(payload?.scope || "") !== OFFER_ACCEPTANCE_TOKEN_SCOPE) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }
  if (String(payload?.booking_id || "") !== String(bookingId || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }
  if (String(payload?.generated_offer_id || "") !== String(generatedOfferId || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }
  if (String(payload?.nonce || "") !== String(nonce || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }
  if (String(payload?.expires_at || "") !== String(expiresAt || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The offer acceptance token is invalid." };
  }

  const nowMs = Number.isFinite(Date.parse(String(now || ""))) ? Date.parse(String(now)) : Date.now();
  const expiresAtMs = Date.parse(String(payload?.expires_at || ""));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { ok: false, code: "TOKEN_EXPIRED", error: "The offer acceptance token has expired." };
  }

  return { ok: true, payload };
}

export function ensureGeneratedOfferAcceptanceTokenState(generatedOffer, { now = null, ttlMs = OFFER_ACCEPTANCE_TOKEN_TTL_MS } = {}) {
  if (!generatedOffer || typeof generatedOffer !== "object") return false;
  let changed = migrateLegacyGeneratedOfferAcceptanceTokenState(generatedOffer);
  const timestamp = normalizeAcceptanceText(now) || new Date().toISOString();
  const existingTokenState = readGeneratedOfferAcceptanceTokenState(generatedOffer);
  const createdAt = normalizeAcceptanceText(
    existingTokenState.createdAt
    || generatedOffer?.created_at
    || timestamp
  ) || timestamp;
  const createdAtMs = parseIsoTimestamp(createdAt) ?? Date.now();
  const normalizedTtlMs = Math.max(60 * 1000, Number(ttlMs || 0) || OFFER_ACCEPTANCE_TOKEN_TTL_MS);
  const expiresAt = new Date(createdAtMs + normalizedTtlMs).toISOString();

  if (!normalizeAcceptanceText(generatedOffer.acceptance_token_nonce)) {
    generatedOffer.acceptance_token_nonce = createOfferAcceptanceTokenNonce();
    changed = true;
  }
  if (!normalizeAcceptanceText(generatedOffer.acceptance_token_created_at)) {
    generatedOffer.acceptance_token_created_at = createdAt;
    changed = true;
  }
  if (!normalizeAcceptanceText(generatedOffer.acceptance_token_expires_at)) {
    generatedOffer.acceptance_token_expires_at = expiresAt;
    changed = true;
  }
  return changed;
}

export function backfillGeneratedOfferAcceptanceTokenState(store, { now = null, ttlMs = OFFER_ACCEPTANCE_TOKEN_TTL_MS } = {}) {
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  let changed = false;
  for (const booking of bookings) {
    const generatedOffers = Array.isArray(booking?.generated_offers) ? booking.generated_offers : [];
    for (const generatedOffer of generatedOffers) {
      if (ensureGeneratedOfferAcceptanceTokenState(generatedOffer, { now, ttlMs })) {
        changed = true;
      }
    }
  }
  return changed;
}

export function buildGeneratedOfferTransportFields(generatedOffer, { secret = "", includeAcceptanceToken = false } = {}) {
  if (!generatedOffer || typeof generatedOffer !== "object") return {};
  const {
    pdf_frozen_at: _pdfFrozenAt,
    pdf_sha256: _pdfSha256,
    acceptance_token_nonce: _acceptanceTokenNonce,
    acceptance_token_created_at: _acceptanceTokenCreatedAt,
    acceptance_token_expires_at: _acceptanceTokenExpiresAt,
    acceptance_token_revoked_at: _acceptanceTokenRevokedAt,
    public_acceptance_token_nonce: _legacyAcceptanceTokenNonce,
    public_acceptance_token_created_at: _legacyAcceptanceTokenCreatedAt,
    public_acceptance_token_expires_at: _legacyAcceptanceTokenExpiresAt,
    public_acceptance_token_revoked_at: _legacyAcceptanceTokenRevokedAt,
    ...publicFields
  } = generatedOffer;
  const normalizedComment = normalizeAcceptanceText(publicFields.comment);
  if (normalizedComment) {
    publicFields.comment = normalizedComment;
  } else {
    delete publicFields.comment;
  }

  const normalizedAcceptanceRoute = buildGeneratedOfferAcceptanceRouteReadModel(generatedOffer, { now: new Date().toISOString() });
  if (normalizedAcceptanceRoute) {
    publicFields.acceptance_route = normalizedAcceptanceRoute;
  } else {
    delete publicFields.acceptance_route;
  }

  if (!includeAcceptanceToken) return publicFields;

  const normalizedSecret = normalizeAcceptanceText(secret);
  const acceptanceTokenState = readGeneratedOfferAcceptanceTokenState(generatedOffer);
  if (
    !normalizedSecret
    || !acceptanceTokenState.nonce
    || !acceptanceTokenState.expiresAt
    || acceptanceTokenState.revokedAt
  ) {
    return publicFields;
  }

  try {
    return {
      ...publicFields,
      public_acceptance_token: buildOfferAcceptanceToken({
        bookingId: generatedOffer?.booking_id,
        generatedOfferId: generatedOffer?.id,
        nonce: acceptanceTokenState.nonce,
        expiresAt: acceptanceTokenState.expiresAt,
        secret: normalizedSecret
      }),
      public_acceptance_expires_at: acceptanceTokenState.expiresAt
    };
  } catch {
    return publicFields;
  }
}

export function buildGeneratedOfferAcceptanceRouteReadModel(generatedOffer, { now = null } = {}) {
  const route = generatedOffer?.acceptance_route;
  if (!route || typeof route !== "object") return null;
  const mode = normalizeGeneratedOfferAcceptanceRouteMode(route.mode);
  const expiresAt = normalizeAcceptanceText(route.expires_at);
  const nowMs = Number.isFinite(Date.parse(String(now || ""))) ? Date.parse(String(now)) : Date.now();
  const expiresAtMs = Date.parse(expiresAt);
  let status = normalizeGeneratedOfferAcceptanceRouteStatus(route.status, mode);
  if (generatedOffer?.acceptance && typeof generatedOffer.acceptance === "object") {
    status = "ACCEPTED";
  } else if (expiresAt && Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs && status !== "REVOKED") {
    status = "EXPIRED";
  }

  const selectedAt = normalizeAcceptanceText(route.selected_at);
  const selectedByStaffId = normalizeAcceptanceText(route.selected_by_atp_staff_id);
  const customerMessageSnapshot = normalizeAcceptanceText(route.customer_message_snapshot);
  const depositRule = mode === "DEPOSIT_PAYMENT" && route.deposit_rule && typeof route.deposit_rule === "object"
    ? {
        payment_term_line_id: normalizeAcceptanceText(route.deposit_rule.payment_term_line_id),
        payment_term_label: normalizeAcceptanceText(route.deposit_rule.payment_term_label),
        required_amount_cents: Math.max(0, Math.round(Number(route.deposit_rule.required_amount_cents || 0))),
        currency: normalizeAcceptanceText(route.deposit_rule.currency || generatedOffer?.currency || generatedOffer?.offer?.currency || "USD").toUpperCase() || "USD",
        aggregation_mode: normalizeAcceptanceText(route.deposit_rule.aggregation_mode) || "SUM_LINKED_PAID_PAYMENTS"
      }
    : null;

  return {
    mode,
    status,
    ...(selectedAt ? { selected_at: selectedAt } : {}),
    ...(selectedByStaffId ? { selected_by_atp_staff_id: selectedByStaffId } : {}),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
    ...(customerMessageSnapshot ? { customer_message_snapshot: customerMessageSnapshot } : {}),
    ...(depositRule ? { deposit_rule: depositRule } : {})
  };
}

export function buildPublicGeneratedOfferAcceptanceRouteView(generatedOffer, { now = null } = {}) {
  const route = buildGeneratedOfferAcceptanceRouteReadModel(generatedOffer, { now });
  if (!route) return null;
  return {
    mode: route.mode,
    status: route.status,
    ...(route.expires_at ? { expires_at: route.expires_at } : {}),
    ...(route.customer_message_snapshot ? { customer_message_snapshot: route.customer_message_snapshot } : {}),
    ...(route.deposit_rule
      ? {
          deposit_rule: {
            payment_term_label: route.deposit_rule.payment_term_label,
            required_amount_cents: route.deposit_rule.required_amount_cents,
            currency: route.deposit_rule.currency
          }
        }
      : {})
  };
}

export function buildGeneratedOfferAcceptancePublicSummary(acceptance) {
  if (!acceptance || typeof acceptance !== "object") return null;
  return {
    accepted_at: normalizeAcceptanceText(acceptance.accepted_at) || new Date().toISOString(),
    method: normalizeAcceptanceText(acceptance.method).toUpperCase() || "PORTAL_CLICK",
    ...(Number.isFinite(Number(acceptance.accepted_amount_cents))
      ? { accepted_amount_cents: Math.max(0, Math.round(Number(acceptance.accepted_amount_cents))) }
      : {}),
    ...(normalizeAcceptanceText(acceptance.accepted_currency)
      ? { accepted_currency: normalizeAcceptanceText(acceptance.accepted_currency).toUpperCase() }
      : {})
  };
}

export function buildOfferAcceptanceTermsSnapshot() {
  return "By accepting this offer, the client confirms acceptance of the quoted services, pricing, currency, and included taxes exactly as shown in the frozen offer PDF and generated offer snapshot.";
}

export function buildOfferAcceptanceStatement({ bookingName = "", formattedTotal = "" } = {}) {
  const normalizedBookingName = String(bookingName || "").trim();
  const normalizedFormattedTotal = String(formattedTotal || "").trim();
  if (normalizedBookingName && normalizedFormattedTotal) {
    return `I accept the Asia Travel Plan offer for ${normalizedBookingName} with a total price of ${normalizedFormattedTotal}.`;
  }
  if (normalizedFormattedTotal) {
    return `I accept the Asia Travel Plan offer with a total price of ${normalizedFormattedTotal}.`;
  }
  if (normalizedBookingName) {
    return `I accept the Asia Travel Plan offer for ${normalizedBookingName}.`;
  }
  return "I accept the Asia Travel Plan offer.";
}

export function buildGeneratedOfferSnapshotHash(generatedOffer) {
  if (!generatedOffer || typeof generatedOffer !== "object") {
    return sha256Hex("{}");
  }
  const snapshot = {
    id: generatedOffer.id || null,
    booking_id: generatedOffer.booking_id || null,
    version: Number.isFinite(Number(generatedOffer.version)) ? Number(generatedOffer.version) : null,
    filename: generatedOffer.filename || null,
    comment: generatedOffer.comment ?? null,
    created_at: generatedOffer.created_at || null,
    created_by: generatedOffer.created_by || null,
    lang: generatedOffer.lang || null,
    currency: generatedOffer.currency || null,
    total_price_cents: Number.isFinite(Number(generatedOffer.total_price_cents)) ? Number(generatedOffer.total_price_cents) : null,
    payment_terms: generatedOffer.payment_terms || null,
    acceptance_route: buildGeneratedOfferAcceptanceRouteReadModel(generatedOffer) || null,
    offer: generatedOffer.offer || null,
    travel_plan: generatedOffer.travel_plan || null
  };
  return sha256Hex(stableSerialize(snapshot));
}

export function maskOtpRecipient(channel, recipient) {
  const normalizedChannel = normalizeAcceptanceText(channel).toUpperCase();
  const normalizedRecipient = normalizeAcceptanceText(recipient);
  if (!normalizedRecipient) return "";
  if (normalizedChannel === "EMAIL") {
    const [localPart, domainPart] = normalizedRecipient.split("@");
    if (!localPart || !domainPart) return normalizedRecipient;
    const prefix = localPart.slice(0, 2);
    return `${prefix}${"*".repeat(Math.max(1, localPart.length - prefix.length))}@${domainPart}`;
  }
  const digits = normalizedRecipient.replace(/\D+/g, "");
  if (digits.length >= 4) {
    return `${"*".repeat(Math.max(2, digits.length - 4))}${digits.slice(-4)}`;
  }
  return normalizedRecipient;
}

export function getOfferAcceptanceChallenges(store) {
  if (!Array.isArray(store.offer_acceptance_challenges)) {
    store.offer_acceptance_challenges = [];
  }
  return store.offer_acceptance_challenges;
}

export function findOfferAcceptanceChallenge(store, bookingId, generatedOfferId, channel) {
  return getOfferAcceptanceChallenges(store).find((challenge) =>
    normalizeAcceptanceText(challenge?.booking_id) === normalizeAcceptanceText(bookingId)
    && normalizeAcceptanceText(challenge?.generated_offer_id) === normalizeAcceptanceText(generatedOfferId)
    && normalizeAcceptanceText(challenge?.channel).toUpperCase() === normalizeAcceptanceText(channel).toUpperCase()
  ) || null;
}

export function upsertOfferAcceptanceChallenge(store, nextChallenge) {
  const remaining = getOfferAcceptanceChallenges(store).filter((challenge) =>
    !(
      normalizeAcceptanceText(challenge?.booking_id) === normalizeAcceptanceText(nextChallenge?.booking_id)
      && normalizeAcceptanceText(challenge?.generated_offer_id) === normalizeAcceptanceText(nextChallenge?.generated_offer_id)
      && normalizeAcceptanceText(challenge?.channel).toUpperCase() === normalizeAcceptanceText(nextChallenge?.channel).toUpperCase()
    )
  );
  remaining.push(nextChallenge);
  store.offer_acceptance_challenges = remaining;
  return nextChallenge;
}

export function removeOfferAcceptanceChallenges(store, bookingId, generatedOfferId, channel = null) {
  const normalizedChannel = normalizeAcceptanceText(channel).toUpperCase();
  store.offer_acceptance_challenges = getOfferAcceptanceChallenges(store).filter((challenge) => {
    if (normalizeAcceptanceText(challenge?.booking_id) !== normalizeAcceptanceText(bookingId)) return true;
    if (normalizeAcceptanceText(challenge?.generated_offer_id) !== normalizeAcceptanceText(generatedOfferId)) return true;
    if (normalizedChannel && normalizeAcceptanceText(challenge?.channel).toUpperCase() !== normalizedChannel) return true;
    return false;
  });
}

export function buildOfferAcceptanceOtpThrottle(existingChallenge, issuedAt) {
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
    return {
      allowed: false,
      status: 429,
      error: "Too many acceptance verification code requests. Try again later.",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(((normalizedWindowStartedAtMs + OFFER_ACCEPTANCE_OTP_SEND_WINDOW_MS) - nowMs) / 1000)
      )
    };
  }

  return {
    allowed: true,
    sendCount: normalizedSendCount + 1,
    sendWindowStartedAt: new Date(normalizedWindowStartedAtMs).toISOString(),
    lastSentAt: new Date(nowMs).toISOString(),
    resendAvailableAt: new Date(nowMs + OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS).toISOString()
  };
}
