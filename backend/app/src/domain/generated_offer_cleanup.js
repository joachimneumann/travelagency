function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function hasMeaningfulTravelPlan(travelPlan) {
  if (!travelPlan || typeof travelPlan !== "object") return false;
  const days = Array.isArray(travelPlan.days) ? travelPlan.days : [];
  const attachments = Array.isArray(travelPlan.attachments) ? travelPlan.attachments : [];
  return days.length > 0 || attachments.length > 0;
}

function firstAcceptedPaymentLine(paymentTerms) {
  const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
  return lines.find((line) => normalizeText(line?.kind).toUpperCase() === "DEPOSIT") || lines[0] || null;
}

function resolveAcceptedAmountCents(paymentTerms, totalPriceCents) {
  const line = firstAcceptedPaymentLine(paymentTerms);
  if (!line) return null;
  const amountMode = normalizeText(line?.amount_spec?.mode).toUpperCase();
  if (amountMode === "FIXED_AMOUNT") {
    return Math.max(0, Math.round(Number(line?.amount_spec?.fixed_amount_cents || 0)));
  }
  if (amountMode === "PERCENTAGE_OF_OFFER_TOTAL") {
    const basisPoints = Math.max(0, Math.round(Number(line?.amount_spec?.percentage_basis_points || 0)));
    return Math.round((Math.max(0, Math.round(Number(totalPriceCents || 0))) * basisPoints) / 10000);
  }
  if (amountMode === "REMAINING_BALANCE") {
    return Math.max(0, Math.round(Number(totalPriceCents || 0)));
  }
  return null;
}

function cleanupGeneratedOffer(generatedOffer) {
  if (!generatedOffer || typeof generatedOffer !== "object") return false;
  let changed = false;
  const removableFields = [
    "booking_confirmation",
    "management_approver_atp_staff_id",
    "management_approver_label",
    "acceptance",
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
    "public_booking_confirmation_token_revoked_at",
    "public_booking_confirmation_token",
    "public_booking_confirmation_expires_at"
  ];
  for (const field of removableFields) {
    if (!(field in generatedOffer)) continue;
    delete generatedOffer[field];
    changed = true;
  }
  return changed;
}

export function pruneLegacyGeneratedOfferState(store) {
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  let changed = false;

  for (const booking of bookings) {
    if (!booking || typeof booking !== "object") continue;
    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const legacyConfirmedOfferId = normalizeText(
      booking?.confirmed_generated_offer_id
      || booking?.accepted_generated_offer_id
    );
    const legacyConfirmedOffer = legacyConfirmedOfferId
      ? generatedOffers.find((generatedOffer) => normalizeText(generatedOffer?.id) === legacyConfirmedOfferId) || null
      : null;

    if (legacyConfirmedOffer) {
      if (!booking.accepted_offer_snapshot && legacyConfirmedOffer.offer && typeof legacyConfirmedOffer.offer === "object") {
        booking.accepted_offer_snapshot = cloneJson(legacyConfirmedOffer.offer);
        changed = true;
      }
      if (!booking.accepted_payment_terms_snapshot && legacyConfirmedOffer.offer?.payment_terms && typeof legacyConfirmedOffer.offer.payment_terms === "object") {
        booking.accepted_payment_terms_snapshot = cloneJson(legacyConfirmedOffer.offer.payment_terms);
        changed = true;
      }
      if (!booking.accepted_travel_plan_snapshot && hasMeaningfulTravelPlan(legacyConfirmedOffer.travel_plan)) {
        booking.accepted_travel_plan_snapshot = cloneJson(legacyConfirmedOffer.travel_plan);
        changed = true;
      }
      if (!normalizeText(booking.accepted_offer_artifact_ref)) {
        booking.accepted_offer_artifact_ref = legacyConfirmedOffer.id;
        changed = true;
      }
      if (!normalizeText(booking.accepted_deposit_currency)) {
        const acceptedCurrency = normalizeText(
          legacyConfirmedOffer.offer?.payment_terms?.currency
          || legacyConfirmedOffer.offer?.currency
          || legacyConfirmedOffer.currency
        ).toUpperCase();
        if (acceptedCurrency) {
          booking.accepted_deposit_currency = acceptedCurrency;
          changed = true;
        }
      }
      if (!Number.isFinite(Number(booking.accepted_deposit_amount_cents))) {
        const acceptedAmount = resolveAcceptedAmountCents(
          legacyConfirmedOffer.offer?.payment_terms,
          legacyConfirmedOffer.total_price_cents ?? legacyConfirmedOffer.offer?.total_price_cents
        );
        if (Number.isFinite(Number(acceptedAmount))) {
          booking.accepted_deposit_amount_cents = Math.max(0, Math.round(Number(acceptedAmount)));
          changed = true;
        }
      }
    }

    if ("confirmed_generated_offer_id" in booking) {
      delete booking.confirmed_generated_offer_id;
      changed = true;
    }
    if ("accepted_generated_offer_id" in booking) {
      delete booking.accepted_generated_offer_id;
      changed = true;
    }

    for (const generatedOffer of generatedOffers) {
      if (cleanupGeneratedOffer(generatedOffer)) {
        changed = true;
      }
    }
  }

  return changed;
}
