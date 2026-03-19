import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const OFFER_ACCEPTANCE_TERMS_VERSION = "ATP_OFFER_ACCEPTANCE_V1";
export const OFFER_ACCEPTANCE_OTP_TTL_MS = 10 * 60 * 1000;
export const OFFER_ACCEPTANCE_OTP_MAX_ATTEMPTS = 5;
export const OFFER_ACCEPTANCE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OFFER_ACCEPTANCE_OTP_MAX_SENDS_PER_WINDOW = 5;
export const OFFER_ACCEPTANCE_OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const OFFER_ACCEPTANCE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OFFER_ACCEPTANCE_TOKEN_SCOPE = "generated_offer_acceptance";

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
  const normalizedSecret = String(secret || "").trim();
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
  const normalizedSecret = String(secret || "").trim();
  if (!normalizedSecret) {
    return { ok: false, code: "TOKEN_NOT_CONFIGURED", error: "Offer acceptance token verification is not configured." };
  }

  const rawToken = String(token || "").trim();
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
    offer: generatedOffer.offer || null,
    travel_plan: generatedOffer.travel_plan || null
  };
  return sha256Hex(stableSerialize(snapshot));
}

export function maskOtpRecipient(channel, recipient) {
  const normalizedChannel = String(channel || "").trim().toUpperCase();
  const normalizedRecipient = String(recipient || "").trim();
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
