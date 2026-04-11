function normalizeText(value) {
  return String(value || "").trim();
}

function timeMs(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function paymentTermsLines(paymentTerms) {
  return Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
}

function findDepositPaymentTermLine(paymentTerms) {
  const lines = paymentTermsLines(paymentTerms);
  return lines.find((line) => normalizeText(line?.kind).toUpperCase() === "DEPOSIT") || lines[0] || null;
}

function resolvePaymentKind(payment, paymentTerms) {
  const depositLineId = normalizeText(findDepositPaymentTermLine(paymentTerms)?.id);
  const originPaymentTermLineId = normalizeText(payment?.origin_payment_term_line_id);
  if (depositLineId && originPaymentTermLineId && depositLineId === originPaymentTermLineId) {
    return "DEPOSIT";
  }
  if (normalizeText(payment?.label).toLowerCase().includes("deposit")) {
    return "DEPOSIT";
  }
  return "PAYMENT";
}

export function sortGeneratedOffersNewestFirst(items) {
  return [...(Array.isArray(items) ? items : [])].sort(
    (left, right) => timeMs(right?.created_at) - timeMs(left?.created_at)
  );
}

export function resolveLatestGeneratedOffer(booking) {
  return sortGeneratedOffersNewestFirst(booking?.generated_offers)[0] || null;
}

export function resolveGeneratedOfferById(booking, generatedOfferId) {
  const normalizedId = normalizeText(generatedOfferId);
  if (!normalizedId) return null;
  return (Array.isArray(booking?.generated_offers) ? booking.generated_offers : []).find(
    (item) => normalizeText(item?.id) === normalizedId
  ) || null;
}

export function resolveAcceptedOfferArtifact(booking) {
  const artifactRef = normalizeText(
    booking?.accepted_record?.offer_artifact_ref
    || booking?.accepted_offer_artifact_ref
    || booking?.confirmed_generated_offer_id
  );
  return resolveGeneratedOfferById(booking, artifactRef);
}

export function resolveDepositReceivedAt(booking) {
  return normalizeText(
    booking?.accepted_record?.deposit_received_at
    || booking?.deposit_received_at
    || booking?.milestones?.deposit_received_at
  );
}

export function resolveProposalSentAt(booking) {
  return normalizeText(booking?.proposal_sent_at);
}

export function proposalWasSent(booking) {
  return Boolean(
    resolveProposalSentAt(booking)
    || resolveDepositReceivedAt(booking)
    || resolveAcceptedOfferArtifact(booking)
  );
}

export function resolveProposalSentOffer(booking) {
  const explicit = resolveGeneratedOfferById(booking, booking?.proposal_sent_generated_offer_id);
  return explicit || resolveAcceptedOfferArtifact(booking);
}

export function latestProposalNeedsSending(booking) {
  const latestOffer = resolveLatestGeneratedOffer(booking);
  if (!latestOffer) return false;
  if (!proposalWasSent(booking)) return true;
  const sentOfferId = normalizeText(booking?.proposal_sent_generated_offer_id);
  if (!sentOfferId) return false;
  return normalizeText(latestOffer.id) !== sentOfferId;
}

export function resolvePaymentMilestones(pricing, paymentTerms) {
  return (Array.isArray(pricing?.payments) ? pricing.payments : []).map((payment, index) => {
    const kind = resolvePaymentKind(payment, paymentTerms);
    const status = normalizeText(payment?.status).toUpperCase() || "PENDING";
    return {
      id: normalizeText(payment?.id) || `payment_${index + 1}`,
      index,
      label: normalizeText(payment?.label) || (kind === "DEPOSIT" ? "Deposit" : `Payment ${index + 1}`),
      kind,
      isDeposit: kind === "DEPOSIT",
      status,
      dueDate: normalizeText(payment?.due_date),
      paidAt: normalizeText(payment?.paid_at),
      netAmountCents: Math.max(0, Math.round(Number(payment?.net_amount_cents || 0))),
      taxRateBasisPoints: Number.isFinite(Number(payment?.tax_rate_basis_points))
        ? Math.round(Number(payment.tax_rate_basis_points))
        : 0,
      notes: normalizeText(payment?.notes)
    };
  });
}

function buildTrackerState(currentKey, doneKeys = [], blockedKey = "") {
  return (key) => {
    if (blockedKey && blockedKey === key) return "blocked";
    if (key === currentKey) return "current";
    if (doneKeys.includes(key)) return "done";
    return "upcoming";
  };
}

export function derivePaymentFlowState({ booking, pricing, paymentTerms } = {}) {
  const latestOffer = resolveLatestGeneratedOffer(booking);
  const sentOffer = resolveProposalSentOffer(booking);
  const acceptedOffer = resolveAcceptedOfferArtifact(booking);
  const proposalSent = proposalWasSent(booking);
  const proposalSentAt = resolveProposalSentAt(booking);
  const depositReceivedAt = resolveDepositReceivedAt(booking);
  const milestones = resolvePaymentMilestones(pricing, paymentTerms);
  const remainingMilestones = milestones.filter((milestone) => !milestone.isDeposit);
  const openRemainingMilestones = remainingMilestones.filter((milestone) => milestone.status !== "PAID");
  const nextOpenMilestone = openRemainingMilestones[0] || null;
  const latestNeedsSending = latestProposalNeedsSending(booking);
  const allMilestonesPaid = milestones.length > 0 && milestones.every((milestone) => milestone.status === "PAID");
  const fullyPaid = Boolean(depositReceivedAt) && (allMilestonesPaid || remainingMilestones.length === 0);

  let currentKey = "proposal_in_progress";
  let blockedKey = "";
  if (!proposalSent) {
    currentKey = "proposal_in_progress";
    if (!latestOffer) blockedKey = "proposal_in_progress";
  } else if (!depositReceivedAt) {
    currentKey = "deposit_pending";
  } else if (!fullyPaid && nextOpenMilestone) {
    currentKey = "remaining_payments";
  } else if (fullyPaid) {
    currentKey = "fully_paid";
  } else {
    currentKey = "deposit_confirmed";
  }

  const doneKeys = [];
  if (proposalSent) {
    doneKeys.push("proposal_in_progress", "proposal_sent");
  }
  if (depositReceivedAt) {
    doneKeys.push("deposit_pending", "deposit_confirmed");
  }
  if (depositReceivedAt && !nextOpenMilestone && remainingMilestones.length > 0) {
    doneKeys.push("remaining_payments");
  }
  if (fullyPaid) {
    doneKeys.push("remaining_payments", "fully_paid");
  }

  const stateFor = buildTrackerState(currentKey, doneKeys, blockedKey);
  const tracker = [
    { key: "proposal_in_progress", label: "Proposal in progress", state: stateFor("proposal_in_progress") },
    { key: "proposal_sent", label: "Proposal sent", state: stateFor("proposal_sent") },
    { key: "deposit_pending", label: "Booking confirmation / Deposit pending", state: stateFor("deposit_pending") },
    { key: "deposit_confirmed", label: "Deposit confirmed", state: stateFor("deposit_confirmed") },
    { key: "remaining_payments", label: "Remaining payments", state: stateFor("remaining_payments") },
    { key: "fully_paid", label: "Fully paid", state: stateFor("fully_paid") }
  ];

  let nextStep = {
    key: "none",
    headline: "All payment milestones are complete",
    actionLabel: "No further payment action",
    reason: "",
    milestoneId: ""
  };
  if (!proposalSent) {
    nextStep = latestOffer
      ? {
          key: "mark_proposal_sent",
          headline: latestNeedsSending ? "A newer proposal draft is ready" : "Proposal is ready to send",
          actionLabel: latestNeedsSending ? "Mark latest proposal as sent" : "Mark proposal as sent",
          reason: latestNeedsSending ? "The newest generated proposal PDF is not marked as sent yet." : "",
          milestoneId: normalizeText(latestOffer?.id)
        }
      : {
          key: "generate_offer",
          headline: "Proposal is still in progress",
          actionLabel: "Generate offer PDF",
          reason: "Create a customer-facing proposal PDF before sending the proposal.",
          milestoneId: ""
        };
  } else if (!depositReceivedAt) {
    nextStep = {
      key: "record_deposit",
      headline: "Deposit is still pending",
      actionLabel: "Record deposit receipt",
      reason: "Booking confirmation happens when the deposit payment is recorded.",
      milestoneId: milestones.find((milestone) => milestone.isDeposit)?.id || ""
    };
  } else if (nextOpenMilestone) {
    nextStep = {
      key: "review_next_payment",
      headline: `${nextOpenMilestone.label} is the next open payment`,
      actionLabel: `Review ${nextOpenMilestone.label}`,
      reason: nextOpenMilestone.dueDate
        ? `Due on ${nextOpenMilestone.dueDate}.`
        : "Use the Payments section to prepare the next invoice or mark the payment as paid.",
      milestoneId: nextOpenMilestone.id
    };
  }

  return {
    proposalSent,
    proposalSentAt,
    depositReceivedAt,
    latestNeedsSending,
    latestOffer,
    sentOffer,
    acceptedOffer,
    milestones,
    nextOpenMilestone,
    fullyPaid,
    tracker,
    nextStep
  };
}
