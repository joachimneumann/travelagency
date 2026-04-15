import { createHash } from "node:crypto";

export const BOOKING_CONFIRMATION_TERMS_VERSION = "ATP_BOOKING_CONFIRMATION_V1";

function normalizeBookingConfirmationText(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
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

function migratePersistedGeneratedOfferBookingConfirmationState(generatedOffer) {
  if (!generatedOffer || typeof generatedOffer !== "object") return false;
  let changed = false;

  if (generatedOffer?.acceptance && generatedOffer?.booking_confirmation == null) {
    generatedOffer.booking_confirmation = generatedOffer.acceptance;
    changed = true;
  }
  if ("acceptance" in generatedOffer) {
    delete generatedOffer.acceptance;
    changed = true;
  }

  const obsoleteFields = [
    "acceptance_route",
    "customer_confirmation_flow",
    "booking_confirmation_token_nonce",
    "booking_confirmation_token_created_at",
    "booking_confirmation_token_expires_at",
    "booking_confirmation_token_revoked_at",
    "acceptance_token_nonce",
    "acceptance_token_created_at",
    "acceptance_token_expires_at",
    "acceptance_token_revoked_at",
    "public_acceptance_token_nonce",
    "public_acceptance_token_created_at",
    "public_acceptance_token_expires_at",
    "public_acceptance_token_revoked_at",
    "public_booking_confirmation_token_nonce",
    "public_booking_confirmation_token_created_at",
    "public_booking_confirmation_token_expires_at",
    "public_booking_confirmation_token_revoked_at"
  ];
  for (const obsoleteField of obsoleteFields) {
    if (!(obsoleteField in generatedOffer)) continue;
    delete generatedOffer[obsoleteField];
    changed = true;
  }

  return changed;
}

export function sha256Hex(value) {
  const buffer = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? Buffer.from(value)
    : Buffer.from(String(value ?? ""), "utf8");
  return createHash("sha256").update(buffer).digest("hex");
}

export function backfillGeneratedOfferBookingConfirmationState(store) {
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
      if (migratePersistedGeneratedOfferBookingConfirmationState(generatedOffer)) {
        changed = true;
      }
    }
  }
  return changed;
}

export function pruneLegacyGeneratedOfferConfirmationState(_store) {
  return {
    changed: false,
    removedGeneratedOfferIds: []
  };
}

export function buildGeneratedOfferTransportFields(generatedOffer) {
  if (!generatedOffer || typeof generatedOffer !== "object") return {};
  const {
    pdf_frozen_at: _pdfFrozenAt,
    pdf_sha256: _pdfSha256,
    customer_confirmation_flow: _customerConfirmationFlow,
    booking_confirmation_token_nonce: _bookingConfirmationTokenNonce,
    booking_confirmation_token_created_at: _bookingConfirmationTokenCreatedAt,
    booking_confirmation_token_expires_at: _bookingConfirmationTokenExpiresAt,
    booking_confirmation_token_revoked_at: _bookingConfirmationTokenRevokedAt,
    acceptance: _legacyAcceptance,
    acceptance_route: _legacyAcceptanceRoute,
    acceptance_token_nonce: _legacyAcceptanceTokenNonce,
    acceptance_token_created_at: _legacyAcceptanceTokenCreatedAt,
    acceptance_token_expires_at: _legacyAcceptanceTokenExpiresAt,
    acceptance_token_revoked_at: _legacyAcceptanceTokenRevokedAt,
    public_acceptance_token_nonce: _legacyPublicAcceptanceTokenNonce,
    public_acceptance_token_created_at: _legacyPublicAcceptanceTokenCreatedAt,
    public_acceptance_token_expires_at: _legacyPublicAcceptanceTokenExpiresAt,
    public_acceptance_token_revoked_at: _legacyPublicAcceptanceTokenRevokedAt,
    public_booking_confirmation_token_nonce: _legacyPublicBookingConfirmationTokenNonce,
    public_booking_confirmation_token_created_at: _legacyPublicBookingConfirmationTokenCreatedAt,
    public_booking_confirmation_token_expires_at: _legacyPublicBookingConfirmationTokenExpiresAt,
    public_booking_confirmation_token_revoked_at: _legacyPublicBookingConfirmationTokenRevokedAt,
    ...publicFields
  } = generatedOffer;

  const normalizedComment = normalizeBookingConfirmationText(publicFields.comment);
  if (normalizedComment) {
    publicFields.comment = normalizedComment;
  } else {
    delete publicFields.comment;
  }

  return publicFields;
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
    management_approver_atp_staff_id: generatedOffer.management_approver_atp_staff_id || null,
    management_approver_label: generatedOffer.management_approver_label || null,
    offer: generatedOffer.offer || null,
    travel_plan: generatedOffer.travel_plan || null
  };
  return sha256Hex(stableSerialize(snapshot));
}
