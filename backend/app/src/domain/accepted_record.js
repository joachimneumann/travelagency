import { normalizeText } from "../lib/text.js";

function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function hasMeaningfulTravelPlan(travelPlan) {
  if (!travelPlan || typeof travelPlan !== "object") return false;
  const days = Array.isArray(travelPlan.days) ? travelPlan.days : [];
  const attachments = Array.isArray(travelPlan.attachments) ? travelPlan.attachments : [];
  return days.length > 0 || attachments.length > 0;
}

function findConfirmedGeneratedOffer(booking) {
  const confirmedGeneratedOfferId = normalizeText(booking?.confirmed_generated_offer_id);
  if (!confirmedGeneratedOfferId) return null;
  const generatedOffers = Array.isArray(booking?.generated_offers) ? booking.generated_offers : [];
  return generatedOffers.find((generatedOffer) => normalizeText(generatedOffer?.id) === confirmedGeneratedOfferId) || null;
}

function findAcceptedDepositLine(lines) {
  const normalizedLines = Array.isArray(lines) ? lines : [];
  return normalizedLines.find((line) => normalizeText(line?.kind).toUpperCase() === "DEPOSIT") || normalizedLines[0] || null;
}

function selectLatestTravelPlanArtifact(artifacts) {
  const normalizedArtifacts = Array.isArray(artifacts) ? artifacts : [];
  const sorted = [...normalizedArtifacts].sort(
    (left, right) => String(right?.created_at || "").localeCompare(String(left?.created_at || ""))
  );
  return sorted.find((artifact) => artifact?.sent_to_customer === true) || sorted[0] || null;
}

async function resolveAcceptedCommercialSnapshot(booking, deps = {}, options = {}) {
  const {
    baseCurrency = "USD",
    normalizeGeneratedOfferSnapshot,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
    listBookingTravelPlanPdfs
  } = deps;
  const {
    allowDraftSource = false
  } = options;

  const acceptedOfferSnapshot = booking?.accepted_offer_snapshot && typeof booking.accepted_offer_snapshot === "object"
    ? cloneJson(booking.accepted_offer_snapshot)
    : null;
  const acceptedPaymentTermsSnapshot = booking?.accepted_payment_terms_snapshot && typeof booking.accepted_payment_terms_snapshot === "object"
    ? cloneJson(booking.accepted_payment_terms_snapshot)
    : null;
  const acceptedTravelPlanSnapshot = booking?.accepted_travel_plan_snapshot && typeof booking.accepted_travel_plan_snapshot === "object"
    ? cloneJson(booking.accepted_travel_plan_snapshot)
    : null;

  const confirmedGeneratedOffer = findConfirmedGeneratedOffer(booking);
  const normalizedConfirmedGeneratedOffer = confirmedGeneratedOffer && typeof normalizeGeneratedOfferSnapshot === "function"
    ? normalizeGeneratedOfferSnapshot(confirmedGeneratedOffer, booking)
    : null;

  const fallbackCurrency = normalizeText(
    booking?.offer?.currency
    || booking?.preferred_currency
    || booking?.pricing?.currency
    || baseCurrency
  ).toUpperCase() || baseCurrency;
  const offerSnapshot = acceptedOfferSnapshot
    || (normalizedConfirmedGeneratedOffer?.offer
      ? cloneJson(normalizedConfirmedGeneratedOffer.offer)
      : null)
    || (allowDraftSource
      ? (typeof normalizeBookingOffer === "function"
        ? normalizeBookingOffer(booking?.offer, fallbackCurrency)
        : cloneJson(booking?.offer))
      : null);
  if (!offerSnapshot || typeof offerSnapshot !== "object") {
    throw new Error("Payment receipt requires an accepted commercial snapshot. Create the first payment request or confirmation before recording the receipt.");
  }

  const paymentTermsSnapshot = acceptedPaymentTermsSnapshot
    || (offerSnapshot?.payment_terms && typeof offerSnapshot.payment_terms === "object"
      ? cloneJson(offerSnapshot.payment_terms)
      : null);
  if (!paymentTermsSnapshot) {
    throw new Error("Payment receipt requires accepted payment terms. Create the first payment request or confirmation before recording the receipt.");
  }

  const paymentTermsReadModel = typeof buildBookingOfferPaymentTermsReadModel === "function"
    ? buildBookingOfferPaymentTermsReadModel(
      paymentTermsSnapshot,
      normalizeText(offerSnapshot?.currency || paymentTermsSnapshot?.currency || fallbackCurrency).toUpperCase() || fallbackCurrency,
      Number(offerSnapshot?.total_price_cents || offerSnapshot?.totals?.total_price_cents || 0)
    )
    : null;
  const acceptedDepositLine = findAcceptedDepositLine(paymentTermsReadModel?.lines);
  if (!acceptedDepositLine) {
    throw new Error("Deposit receipt requires at least one payment term.");
  }

  const normalizedTravelPlan = acceptedTravelPlanSnapshot
    || (normalizedConfirmedGeneratedOffer?.travel_plan
      ? cloneJson(normalizedConfirmedGeneratedOffer.travel_plan)
      : null)
    || (allowDraftSource
      ? (typeof normalizeBookingTravelPlan === "function"
        ? normalizeBookingTravelPlan(booking?.travel_plan, offerSnapshot, { strictReferences: false })
        : cloneJson(booking?.travel_plan))
      : null);
  const resolvedAcceptedTravelPlanSnapshot = hasMeaningfulTravelPlan(normalizedTravelPlan) ? cloneJson(normalizedTravelPlan) : null;
  const travelPlanArtifacts = typeof listBookingTravelPlanPdfs === "function"
    ? await listBookingTravelPlanPdfs(booking?.id).catch(() => [])
    : [];
  const latestTravelPlanArtifact = selectLatestTravelPlanArtifact(travelPlanArtifacts);

  let changed = false;
  let acceptedRecordCreated = false;

  if (!booking?.accepted_offer_snapshot) {
    booking.accepted_offer_snapshot = cloneJson(offerSnapshot);
    changed = true;
    acceptedRecordCreated = true;
  }
  if (!booking?.accepted_payment_terms_snapshot) {
    booking.accepted_payment_terms_snapshot = cloneJson(paymentTermsSnapshot);
    changed = true;
    acceptedRecordCreated = true;
  }
  if (!booking?.accepted_travel_plan_snapshot && resolvedAcceptedTravelPlanSnapshot) {
    booking.accepted_travel_plan_snapshot = resolvedAcceptedTravelPlanSnapshot;
    changed = true;
    acceptedRecordCreated = true;
  }
  if (!Number.isFinite(Number(booking?.accepted_deposit_amount_cents))) {
    booking.accepted_deposit_amount_cents = Math.max(0, Math.round(Number(acceptedDepositLine?.resolved_amount_cents || 0)));
    changed = true;
    acceptedRecordCreated = true;
  }
  if (!normalizeText(booking?.accepted_deposit_currency)) {
    booking.accepted_deposit_currency = normalizeText(
      paymentTermsReadModel?.currency
      || paymentTermsSnapshot?.currency
      || offerSnapshot?.currency
      || baseCurrency
    ).toUpperCase() || baseCurrency;
    changed = true;
    acceptedRecordCreated = true;
  }
  if (!normalizeText(booking?.accepted_offer_artifact_ref) && confirmedGeneratedOffer?.id) {
    booking.accepted_offer_artifact_ref = normalizeText(confirmedGeneratedOffer.id);
    changed = true;
    acceptedRecordCreated = true;
  }
  if (!normalizeText(booking?.accepted_travel_plan_artifact_ref) && latestTravelPlanArtifact?.id) {
    booking.accepted_travel_plan_artifact_ref = normalizeText(latestTravelPlanArtifact.id);
    changed = true;
    acceptedRecordCreated = true;
  }

  return {
    changed,
    acceptedRecordCreated
  };
}

export async function ensureAcceptedCommercialSnapshot(booking, deps = {}, options = {}) {
  return resolveAcceptedCommercialSnapshot(booking, deps, options);
}

export async function freezeAcceptedCommercialRecord(booking, deps = {}) {
  const {
    depositReceivedAt = "",
    depositConfirmedByAtpStaffId = "",
    depositReference = ""
  } = deps;

  const resolvedDepositReceivedAt = normalizeText(
    depositReceivedAt
    || booking?.deposit_received_at
  );
  if (!resolvedDepositReceivedAt) {
    throw new Error("Deposit receipt requires deposit_received_at.");
  }

  const resolvedConfirmedById = normalizeText(
    depositConfirmedByAtpStaffId
    || booking?.deposit_confirmed_by_atp_staff_id
  );
  if (!resolvedConfirmedById) {
    throw new Error("Deposit receipt requires deposit_confirmed_by_atp_staff_id.");
  }

  const snapshotUpdate = await resolveAcceptedCommercialSnapshot(booking, deps, { allowDraftSource: false });
  let changed = snapshotUpdate.changed;
  const acceptedRecordCreated = snapshotUpdate.acceptedRecordCreated;

  if (normalizeText(booking?.deposit_received_at) !== resolvedDepositReceivedAt) {
    booking.deposit_received_at = resolvedDepositReceivedAt;
    changed = true;
  }
  if (normalizeText(booking?.deposit_confirmed_by_atp_staff_id) !== resolvedConfirmedById) {
    booking.deposit_confirmed_by_atp_staff_id = resolvedConfirmedById;
    changed = true;
  }

  const normalizedReference = normalizeText(depositReference);
  if (!normalizeText(booking?.accepted_deposit_reference) && normalizedReference) {
    booking.accepted_deposit_reference = normalizedReference;
    changed = true;
  }

  return {
    changed,
    acceptedRecordCreated,
    timestamp: resolvedDepositReceivedAt,
    detail: acceptedRecordCreated
      ? "Deposit received and accepted customer record frozen"
      : "Deposit receipt updated"
  };
}
