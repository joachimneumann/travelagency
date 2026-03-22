import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeText } from "../lib/text.js";

export const TRAVELER_DETAILS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TRAVELER_DETAILS_TOKEN_SCOPE = "traveler_details_portal";

function parseIsoTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTravelerDetailsTokenPayload({ bookingId, personId, expiresAt }) {
  return {
    scope: TRAVELER_DETAILS_TOKEN_SCOPE,
    booking_id: String(bookingId || ""),
    person_id: String(personId || ""),
    expires_at: String(expiresAt || "")
  };
}

function signTravelerDetailsTokenPayload(payloadBase64, secret) {
  return createHmac("sha256", String(secret || "")).update(String(payloadBase64 || "")).digest("base64url");
}

export function resolveTravelerDetailsTokenExpiresAt({ now = null, ttlMs = TRAVELER_DETAILS_TOKEN_TTL_MS } = {}) {
  const timestamp = normalizeText(now) || new Date().toISOString();
  const nowMs = parseIsoTimestamp(timestamp) ?? Date.now();
  const normalizedTtlMs = Math.max(60 * 1000, Number(ttlMs || 0) || TRAVELER_DETAILS_TOKEN_TTL_MS);
  return new Date(nowMs + normalizedTtlMs).toISOString();
}

export function buildTravelerDetailsToken({ bookingId, personId, expiresAt, secret }) {
  const normalizedSecret = normalizeText(secret);
  if (!normalizedSecret) {
    throw new Error("Traveler details token secret is not configured.");
  }
  const payloadBase64 = Buffer.from(
    JSON.stringify(buildTravelerDetailsTokenPayload({ bookingId, personId, expiresAt })),
    "utf8"
  ).toString("base64url");
  const signature = signTravelerDetailsTokenPayload(payloadBase64, normalizedSecret);
  return `${payloadBase64}.${signature}`;
}

export function verifyTravelerDetailsToken(
  token,
  { bookingId, personId, secret, now = null } = {}
) {
  const normalizedSecret = normalizeText(secret);
  if (!normalizedSecret) {
    return {
      ok: false,
      code: "TOKEN_NOT_CONFIGURED",
      error: "Traveler details token verification is not configured."
    };
  }

  const rawToken = normalizeText(token);
  const separatorIndex = rawToken.indexOf(".");
  if (!rawToken || separatorIndex <= 0 || separatorIndex === rawToken.length - 1) {
    return { ok: false, code: "TOKEN_INVALID", error: "The traveler details token is invalid." };
  }

  const payloadBase64 = rawToken.slice(0, separatorIndex);
  const signature = rawToken.slice(separatorIndex + 1);
  const expectedSignature = signTravelerDetailsTokenPayload(payloadBase64, normalizedSecret);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return { ok: false, code: "TOKEN_INVALID", error: "The traveler details token is invalid." };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: "TOKEN_INVALID", error: "The traveler details token is invalid." };
  }

  if (String(payload?.scope || "") !== TRAVELER_DETAILS_TOKEN_SCOPE) {
    return { ok: false, code: "TOKEN_INVALID", error: "The traveler details token is invalid." };
  }
  if (String(payload?.booking_id || "") !== String(bookingId || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The traveler details token is invalid." };
  }
  if (String(payload?.person_id || "") !== String(personId || "")) {
    return { ok: false, code: "TOKEN_INVALID", error: "The traveler details token is invalid." };
  }

  const nowMs = Number.isFinite(Date.parse(String(now || ""))) ? Date.parse(String(now)) : Date.now();
  const expiresAtMs = Date.parse(String(payload?.expires_at || ""));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { ok: false, code: "TOKEN_EXPIRED", error: "The traveler details token has expired." };
  }

  return { ok: true, payload };
}
