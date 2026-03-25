import { normalizeText } from "../lib/text.js";

function cloneJson(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function hasMeaningfulTravelPlan(travelPlan) {
  if (!travelPlan || typeof travelPlan !== "object") return false;
  const days = Array.isArray(travelPlan.days) ? travelPlan.days : [];
  const links = Array.isArray(travelPlan.offer_component_links) ? travelPlan.offer_component_links : [];
  const attachments = Array.isArray(travelPlan.attachments) ? travelPlan.attachments : [];
  return days.length > 0 || links.length > 0 || attachments.length > 0;
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

export async function freezeAcceptedCommercialRecord(booking, deps = {}) {
  const {
    now = new Date().toISOString(),
    depositReceivedAt = "",
    depositConfirmedByAtpStaffId = "",
    depositReference = "",
    baseCurrency = "USD",
    normalizeGeneratedOfferSnapshot,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
    listBookingTravelPlanPdfs,
    computeServiceLevelAgreementDueAt
  } = deps;

  const resolvedDepositReceivedAt = normalizeText(
    depositReceivedAt
    || booking?.deposit_received_at
    || booking?.milestones?.deposit_received_at
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
  const offerSnapshot = normalizedConfirmedGeneratedOffer?.offer
    ? cloneJson(normalizedConfirmedGeneratedOffer.offer)
    : (typeof normalizeBookingOffer === "function"
      ? normalizeBookingOffer(booking?.offer, fallbackCurrency)
      : cloneJson(booking?.offer));
  if (!offerSnapshot || typeof offerSnapshot !== "object") {
    throw new Error("Deposit receipt requires an offer before it can be recorded.");
  }

  const paymentTermsSnapshot = offerSnapshot?.payment_terms && typeof offerSnapshot.payment_terms === "object"
    ? cloneJson(offerSnapshot.payment_terms)
    : null;
  if (!paymentTermsSnapshot) {
    throw new Error("Deposit receipt requires payment terms before it can be recorded.");
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

  const normalizedTravelPlan = normalizedConfirmedGeneratedOffer?.travel_plan
    ? cloneJson(normalizedConfirmedGeneratedOffer.travel_plan)
    : (typeof normalizeBookingTravelPlan === "function"
      ? normalizeBookingTravelPlan(booking?.travel_plan, offerSnapshot, { strictReferences: false })
      : cloneJson(booking?.travel_plan));
  const acceptedTravelPlanSnapshot = hasMeaningfulTravelPlan(normalizedTravelPlan) ? cloneJson(normalizedTravelPlan) : null;
  const travelPlanArtifacts = typeof listBookingTravelPlanPdfs === "function"
    ? await listBookingTravelPlanPdfs(booking?.id).catch(() => [])
    : [];
  const latestTravelPlanArtifact = selectLatestTravelPlanArtifact(travelPlanArtifacts);

  let changed = false;
  let acceptedRecordCreated = false;

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

  const nextMilestones = {
    ...(booking?.milestones && typeof booking.milestones === "object" ? booking.milestones : {}),
    deposit_received_at: resolvedDepositReceivedAt
  };
  if (JSON.stringify(nextMilestones) !== JSON.stringify(booking?.milestones || {})) {
    booking.milestones = nextMilestones;
    changed = true;
  }

  if (normalizeText(booking?.last_action) !== "DEPOSIT_RECEIVED") {
    booking.last_action = "DEPOSIT_RECEIVED";
    changed = true;
  }
  if (normalizeText(booking?.last_action_at) !== resolvedDepositReceivedAt) {
    booking.last_action_at = resolvedDepositReceivedAt;
    changed = true;
  }
  if (normalizeText(booking?.stage) !== "IN_PROGRESS") {
    booking.stage = "IN_PROGRESS";
    changed = true;
  }
  if (typeof computeServiceLevelAgreementDueAt === "function") {
    const nextServiceLevelAgreementDueAt = computeServiceLevelAgreementDueAt("IN_PROGRESS", new Date(resolvedDepositReceivedAt));
    if (normalizeText(booking?.service_level_agreement_due_at) !== normalizeText(nextServiceLevelAgreementDueAt)) {
      booking.service_level_agreement_due_at = nextServiceLevelAgreementDueAt;
      changed = true;
    }
  }

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
  if (!booking?.accepted_travel_plan_snapshot && acceptedTravelPlanSnapshot) {
    booking.accepted_travel_plan_snapshot = acceptedTravelPlanSnapshot;
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
    acceptedRecordCreated,
    timestamp: resolvedDepositReceivedAt,
    detail: acceptedRecordCreated
      ? "Deposit received and accepted customer record frozen"
      : "Deposit receipt updated"
  };
}
