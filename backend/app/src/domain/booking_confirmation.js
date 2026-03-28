import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeGeneratedEnumValue } from "../lib/generated_catalogs.js";

export const BOOKING_CONFIRMATION_TERMS_VERSION = "ATP_BOOKING_CONFIRMATION_V1";
export const BOOKING_CONFIRMATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BOOKING_CONFIRMATION_TOKEN_SCOPE = "generated_booking_confirmation";

function normalizeBookingConfirmationText(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function parseIsoTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function readGeneratedOfferBookingConfirmationTokenState(generatedOffer) {
  return {
    nonce: normalizeBookingConfirmationText(
      generatedOffer?.booking_confirmation_token_nonce
      || generatedOffer?.public_booking_confirmation_token_nonce
      || generatedOffer?.acceptance_token_nonce
      || generatedOffer?.public_acceptance_token_nonce
    ),
    createdAt: normalizeBookingConfirmationText(
      generatedOffer?.booking_confirmation_token_created_at
      || generatedOffer?.public_booking_confirmation_token_created_at
      || generatedOffer?.acceptance_token_created_at
      || generatedOffer?.public_acceptance_token_created_at
    ),
    expiresAt: normalizeBookingConfirmationText(
      generatedOffer?.booking_confirmation_token_expires_at
      || generatedOffer?.public_booking_confirmation_token_expires_at
      || generatedOffer?.acceptance_token_expires_at
      || generatedOffer?.public_acceptance_token_expires_at
    ),
    revokedAt: normalizeBookingConfirmationText(
      generatedOffer?.booking_confirmation_token_revoked_at
      || generatedOffer?.public_booking_confirmation_token_revoked_at
      || generatedOffer?.acceptance_token_revoked_at
      || generatedOffer?.public_acceptance_token_revoked_at
    )
  };
}

export function normalizeGeneratedOfferBookingConfirmationRouteMode(value) {
  return normalizeGeneratedEnumValue("GeneratedOfferBookingConfirmationRouteMode", value, "DEPOSIT_PAYMENT", {
    transform: (rawValue) => normalizeBookingConfirmationText(rawValue).toUpperCase()
  });
}

export function normalizeGeneratedOfferBookingConfirmationRouteStatus(value, mode = "DEPOSIT_PAYMENT") {
  const normalizedMode = normalizeGeneratedOfferBookingConfirmationRouteMode(mode);
  const normalized = normalizeGeneratedEnumValue("GeneratedOfferBookingConfirmationRouteStatus", value, "", {
    transform: (rawValue) => normalizeBookingConfirmationText(rawValue).toUpperCase()
  });
  if (normalized) return normalized;
  return normalizedMode === "DEPOSIT_PAYMENT" ? "AWAITING_PAYMENT" : "OPEN";
}

export function synchronizeGeneratedOfferBookingConfirmationRouteStatus(generatedOffer, { now = null } = {}) {
  const route = generatedOffer?.booking_confirmation_route;
  if (!route || typeof route !== "object") return false;
  const mode = normalizeGeneratedOfferBookingConfirmationRouteMode(route.mode);
  const expiresAt = normalizeBookingConfirmationText(route.expires_at);
  const nowMs = parseIsoTimestamp(now) ?? Date.now();
  const expiresAtMs = parseIsoTimestamp(expiresAt);
  let nextStatus = normalizeGeneratedOfferBookingConfirmationRouteStatus(route.status, mode);
  if (generatedOffer?.booking_confirmation && typeof generatedOffer.booking_confirmation === "object") {
    nextStatus = "CONFIRMED";
  } else if (nextStatus !== "REVOKED" && expiresAt && Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
    nextStatus = "EXPIRED";
  }

  let changed = false;
  if (normalizeBookingConfirmationText(route.mode) !== mode) {
    route.mode = mode;
    changed = true;
  }
  if (normalizeBookingConfirmationText(route.status).toUpperCase() !== nextStatus) {
    route.status = nextStatus;
    changed = true;
  }
  return changed;
}

function migrateLegacyGeneratedOfferBookingConfirmationState(generatedOffer) {
  if (!generatedOffer || typeof generatedOffer !== "object") return false;
  let changed = false;
  const legacyObjectFieldMap = [
    ["acceptance", "booking_confirmation"],
    ["acceptance_route", "booking_confirmation_route"]
  ];
  for (const [legacyField, currentField] of legacyObjectFieldMap) {
    if (generatedOffer?.[legacyField] && generatedOffer?.[currentField] == null) {
      generatedOffer[currentField] = generatedOffer[legacyField];
      changed = true;
    }
    if (legacyField in generatedOffer) {
      delete generatedOffer[legacyField];
      changed = true;
    }
  }
  const legacyFieldMap = [
    ["acceptance_token_nonce", "booking_confirmation_token_nonce"],
    ["acceptance_token_created_at", "booking_confirmation_token_created_at"],
    ["acceptance_token_expires_at", "booking_confirmation_token_expires_at"],
    ["acceptance_token_revoked_at", "booking_confirmation_token_revoked_at"],
    ["public_acceptance_token_nonce", "booking_confirmation_token_nonce"],
    ["public_acceptance_token_created_at", "booking_confirmation_token_created_at"],
    ["public_acceptance_token_expires_at", "booking_confirmation_token_expires_at"],
    ["public_acceptance_token_revoked_at", "booking_confirmation_token_revoked_at"],
    ["public_booking_confirmation_token_nonce", "booking_confirmation_token_nonce"],
    ["public_booking_confirmation_token_created_at", "booking_confirmation_token_created_at"],
    ["public_booking_confirmation_token_expires_at", "booking_confirmation_token_expires_at"],
    ["public_booking_confirmation_token_revoked_at", "booking_confirmation_token_revoked_at"]
  ];

  for (const [legacyField, currentField] of legacyFieldMap) {
    const legacyValue = normalizeBookingConfirmationText(generatedOffer?.[legacyField]);
    if (legacyValue && !normalizeBookingConfirmationText(generatedOffer?.[currentField])) {
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

export function createBookingConfirmationTokenNonce() {
  return randomBytes(24).toString("base64url");
}

function buildBookingConfirmationTokenPayload({ bookingId, generatedOfferId, nonce, expiresAt }) {
  return {
    scope: BOOKING_CONFIRMATION_TOKEN_SCOPE,
    booking_id: String(bookingId || ""),
    generated_offer_id: String(generatedOfferId || ""),
    nonce: String(nonce || ""),
    expires_at: String(expiresAt || "")
  };
}

function signBookingConfirmationTokenPayload(payloadBase64, secret) {
  return createHmac("sha256", String(secret || "")).update(String(payloadBase64 || "")).digest("base64url");
}

export function buildBookingConfirmationToken({ bookingId, generatedOfferId, nonce, expiresAt, secret }) {
  const normalizedSecret = normalizeBookingConfirmationText(secret);
  if (!normalizedSecret) {
    throw new Error("Booking confirmation token secret is not configured.");
  }
  const payloadBase64 = Buffer.from(
    JSON.stringify(buildBookingConfirmationTokenPayload({ bookingId, generatedOfferId, nonce, expiresAt })),
    "utf8"
  ).toString("base64url");
  const signature = signBookingConfirmationTokenPayload(payloadBase64, normalizedSecret);
  return `${payloadBase64}.${signature}`;
}

export function verifyBookingConfirmationToken(token, { bookingId, generatedOfferId, nonce, expiresAt, secret, now = null } = {}) {
  const normalizedSecret = normalizeBookingConfirmationText(secret);
  if (!normalizedSecret) {
    return { ok: false, code: "TOKEN_NOT_CONFIGURED", error: "Booking confirmation token verification is not configured." };
  }

  const rawToken = normalizeBookingConfirmationText(token);
  const separatorIndex = rawToken.indexOf(".");
  if (!rawToken || separatorIndex <= 0 || separatorIndex === rawToken.length - 1) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }

  const payloadBase64 = rawToken.slice(0, separatorIndex);
  const signature = rawToken.slice(separatorIndex + 1);
  const expectedSignature = signBookingConfirmationTokenPayload(payloadBase64, normalizedSecret);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }

  if (String(payload?.scope || "") !== BOOKING_CONFIRMATION_TOKEN_SCOPE) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }
  if (String(payload?.booking_id || "") !== String(bookingId || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }
  if (String(payload?.generated_offer_id || "") !== String(generatedOfferId || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }
  if (String(payload?.nonce || "") !== String(nonce || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }
  if (String(payload?.expires_at || "") !== String(expiresAt || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The booking confirmation token is invalid." };
  }

  const nowMs = Number.isFinite(Date.parse(String(now || ""))) ? Date.parse(String(now)) : Date.now();
  const expiresAtMs = Date.parse(String(payload?.expires_at || ""));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { ok: false, code: "TOKEN_EXPIRED", error: "The booking confirmation token has expired." };
  }

  return { ok: true, payload };
}

export function ensureGeneratedOfferBookingConfirmationTokenState(generatedOffer, { now = null, ttlMs = BOOKING_CONFIRMATION_TOKEN_TTL_MS } = {}) {
  if (!generatedOffer || typeof generatedOffer !== "object") return false;
  let changed = migrateLegacyGeneratedOfferBookingConfirmationState(generatedOffer);
  const timestamp = normalizeBookingConfirmationText(now) || new Date().toISOString();
  const existingTokenState = readGeneratedOfferBookingConfirmationTokenState(generatedOffer);
  const createdAt = normalizeBookingConfirmationText(
    existingTokenState.createdAt
    || generatedOffer?.created_at
    || timestamp
  ) || timestamp;
  const createdAtMs = parseIsoTimestamp(createdAt) ?? Date.now();
  const normalizedTtlMs = Math.max(60 * 1000, Number(ttlMs || 0) || BOOKING_CONFIRMATION_TOKEN_TTL_MS);
  const expiresAt = new Date(createdAtMs + normalizedTtlMs).toISOString();

  if (!normalizeBookingConfirmationText(generatedOffer.booking_confirmation_token_nonce)) {
    generatedOffer.booking_confirmation_token_nonce = createBookingConfirmationTokenNonce();
    changed = true;
  }
  if (!normalizeBookingConfirmationText(generatedOffer.booking_confirmation_token_created_at)) {
    generatedOffer.booking_confirmation_token_created_at = createdAt;
    changed = true;
  }
  if (!normalizeBookingConfirmationText(generatedOffer.booking_confirmation_token_expires_at)) {
    generatedOffer.booking_confirmation_token_expires_at = expiresAt;
    changed = true;
  }
  return changed;
}

export function backfillGeneratedOfferBookingConfirmationTokenState(store, { now = null, ttlMs = BOOKING_CONFIRMATION_TOKEN_TTL_MS } = {}) {
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  let changed = false;
  for (const booking of bookings) {
    if (booking?.confirmed_generated_offer_id == null && booking?.accepted_generated_offer_id != null) {
      booking.confirmed_generated_offer_id = booking.accepted_generated_offer_id;
      delete booking.accepted_generated_offer_id;
      changed = true;
    }
    const generatedOffers = Array.isArray(booking?.generated_offers) ? booking.generated_offers : [];
    for (const generatedOffer of generatedOffers) {
      if (ensureGeneratedOfferBookingConfirmationTokenState(generatedOffer, { now, ttlMs })) {
        changed = true;
      }
      if (synchronizeGeneratedOfferBookingConfirmationRouteStatus(generatedOffer, { now })) {
        changed = true;
      }
    }
  }
  return changed;
}

export function buildGeneratedOfferTransportFields(generatedOffer, { secret = "", includeBookingConfirmationToken = false } = {}) {
  if (!generatedOffer || typeof generatedOffer !== "object") return {};
  const {
    pdf_frozen_at: _pdfFrozenAt,
    pdf_sha256: _pdfSha256,
    booking_confirmation_token_nonce: _acceptanceTokenNonce,
    booking_confirmation_token_created_at: _acceptanceTokenCreatedAt,
    booking_confirmation_token_expires_at: _acceptanceTokenExpiresAt,
    booking_confirmation_token_revoked_at: _acceptanceTokenRevokedAt,
    acceptance_token_nonce: _legacyAcceptanceTokenNonceOld,
    acceptance_token_created_at: _legacyAcceptanceTokenCreatedAtOld,
    acceptance_token_expires_at: _legacyAcceptanceTokenExpiresAtOld,
    acceptance_token_revoked_at: _legacyAcceptanceTokenRevokedAtOld,
    public_acceptance_token_nonce: _legacyPublicAcceptanceTokenNonceOld,
    public_acceptance_token_created_at: _legacyPublicAcceptanceTokenCreatedAtOld,
    public_acceptance_token_expires_at: _legacyPublicAcceptanceTokenExpiresAtOld,
    public_acceptance_token_revoked_at: _legacyPublicAcceptanceTokenRevokedAtOld,
    public_booking_confirmation_token_nonce: _legacyAcceptanceTokenNonce,
    public_booking_confirmation_token_created_at: _legacyAcceptanceTokenCreatedAt,
    public_booking_confirmation_token_expires_at: _legacyAcceptanceTokenExpiresAt,
    public_booking_confirmation_token_revoked_at: _legacyAcceptanceTokenRevokedAt,
    ...publicFields
  } = generatedOffer;
  const normalizedComment = normalizeBookingConfirmationText(publicFields.comment);
  if (normalizedComment) {
    publicFields.comment = normalizedComment;
  } else {
    delete publicFields.comment;
  }

  const normalizedBookingConfirmationRoute = buildGeneratedOfferBookingConfirmationRouteReadModel(generatedOffer, { now: new Date().toISOString() });
  if (normalizedBookingConfirmationRoute) {
    publicFields.booking_confirmation_route = normalizedBookingConfirmationRoute;
  } else {
    delete publicFields.booking_confirmation_route;
  }

  if (!includeBookingConfirmationToken) return publicFields;

  const normalizedSecret = normalizeBookingConfirmationText(secret);
  const bookingConfirmationTokenState = readGeneratedOfferBookingConfirmationTokenState(generatedOffer);
  if (
    !normalizedSecret
    || !bookingConfirmationTokenState.nonce
    || !bookingConfirmationTokenState.expiresAt
    || bookingConfirmationTokenState.revokedAt
  ) {
    return publicFields;
  }

  try {
    return {
      ...publicFields,
      public_booking_confirmation_token: buildBookingConfirmationToken({
        bookingId: generatedOffer?.booking_id,
        generatedOfferId: generatedOffer?.id,
        nonce: bookingConfirmationTokenState.nonce,
        expiresAt: bookingConfirmationTokenState.expiresAt,
        secret: normalizedSecret
      }),
      public_booking_confirmation_expires_at: bookingConfirmationTokenState.expiresAt
    };
  } catch {
    return publicFields;
  }
}

export function buildGeneratedOfferBookingConfirmationRouteReadModel(generatedOffer, { now = null } = {}) {
  const route = generatedOffer?.booking_confirmation_route;
  if (!route || typeof route !== "object") return null;
  const mode = normalizeGeneratedOfferBookingConfirmationRouteMode(route.mode);
  const expiresAt = normalizeBookingConfirmationText(route.expires_at);
  const status = normalizeGeneratedOfferBookingConfirmationRouteStatus(route.status, mode);

  const selectedAt = normalizeBookingConfirmationText(route.selected_at);
  const selectedByStaffId = normalizeBookingConfirmationText(route.selected_by_atp_staff_id);
  const customerMessageSnapshot = normalizeBookingConfirmationText(route.customer_message_snapshot);
  const depositRule = mode === "DEPOSIT_PAYMENT" && route.deposit_rule && typeof route.deposit_rule === "object"
    ? {
        payment_term_line_id: normalizeBookingConfirmationText(route.deposit_rule.payment_term_line_id),
        payment_term_label: normalizeBookingConfirmationText(route.deposit_rule.payment_term_label),
        required_amount_cents: Math.max(0, Math.round(Number(route.deposit_rule.required_amount_cents || 0))),
        currency: normalizeBookingConfirmationText(route.deposit_rule.currency || generatedOffer?.currency || generatedOffer?.offer?.currency || "USD").toUpperCase() || "USD",
        aggregation_mode: normalizeBookingConfirmationText(route.deposit_rule.aggregation_mode) || "SUM_LINKED_PAID_PAYMENTS"
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

export function buildPublicGeneratedOfferBookingConfirmationRouteView(generatedOffer, { now = null } = {}) {
  const route = buildGeneratedOfferBookingConfirmationRouteReadModel(generatedOffer, { now });
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

export function buildGeneratedOfferBookingConfirmationPublicSummary(bookingConfirmation) {
  if (!bookingConfirmation || typeof bookingConfirmation !== "object") return null;
  return {
    accepted_at: normalizeBookingConfirmationText(bookingConfirmation.accepted_at) || new Date().toISOString(),
    method: normalizeBookingConfirmationText(bookingConfirmation.method).toUpperCase() || "PORTAL_CLICK",
    ...(Number.isFinite(Number(bookingConfirmation.accepted_amount_cents))
      ? { accepted_amount_cents: Math.max(0, Math.round(Number(bookingConfirmation.accepted_amount_cents))) }
      : {}),
    ...(normalizeBookingConfirmationText(bookingConfirmation.accepted_currency)
      ? { accepted_currency: normalizeBookingConfirmationText(bookingConfirmation.accepted_currency).toUpperCase() }
      : {})
  };
}

export function buildBookingConfirmationTermsSnapshot() {
  return "By confirming this booking, the client confirms the quoted services, pricing, currency, and included taxes exactly as shown in the frozen offer PDF and generated offer snapshot.";
}

export function buildBookingConfirmationStatement({ bookingName = "", formattedTotal = "" } = {}) {
  const normalizedBookingName = String(bookingName || "").trim();
  const normalizedFormattedTotal = String(formattedTotal || "").trim();
  if (normalizedBookingName && normalizedFormattedTotal) {
    return `I confirm the Asia Travel Plan booking for ${normalizedBookingName} with a total price of ${normalizedFormattedTotal}.`;
  }
  if (normalizedFormattedTotal) {
    return `I confirm the Asia Travel Plan booking with a total price of ${normalizedFormattedTotal}.`;
  }
  if (normalizedBookingName) {
    return `I confirm the Asia Travel Plan booking for ${normalizedBookingName}.`;
  }
  return "I confirm the Asia Travel Plan booking.";
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
    booking_confirmation_route: buildGeneratedOfferBookingConfirmationRouteReadModel(generatedOffer) || null,
    offer: generatedOffer.offer || null,
    travel_plan: generatedOffer.travel_plan || null
  };
  return sha256Hex(stableSerialize(snapshot));
}
