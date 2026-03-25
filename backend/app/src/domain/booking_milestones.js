import { normalizeText } from "../lib/text.js";

export const BOOKING_MILESTONE_ACTIONS = Object.freeze({
  NEW_BOOKING: "NEW_BOOKING",
  TRAVEL_PLAN_SENT: "TRAVEL_PLAN_SENT",
  OFFER_SENT: "OFFER_SENT",
  NEGOTIATION_STARTED: "NEGOTIATION_STARTED",
  DEPOSIT_REQUEST_SENT: "DEPOSIT_REQUEST_SENT",
  IN_PROGRESS: "IN_PROGRESS",
  DEPOSIT_RECEIVED: "DEPOSIT_RECEIVED",
  BOOKING_LOST: "BOOKING_LOST",
  TRIP_COMPLETED: "TRIP_COMPLETED"
});

export const BOOKING_MILESTONE_ACTION_ORDER = Object.freeze([
  BOOKING_MILESTONE_ACTIONS.NEW_BOOKING,
  BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT,
  BOOKING_MILESTONE_ACTIONS.OFFER_SENT,
  BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED,
  BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT,
  BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED,
  BOOKING_MILESTONE_ACTIONS.BOOKING_LOST,
  BOOKING_MILESTONE_ACTIONS.TRIP_COMPLETED
]);

const ACTION_META = Object.freeze({
  [BOOKING_MILESTONE_ACTIONS.NEW_BOOKING]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.NEW_BOOKING,
    field: "new_booking_at",
    stage: "NEW_BOOKING",
    detail: "Booking marked as new"
  }),
  [BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT,
    field: "travel_plan_sent_at",
    stage: "TRAVEL_PLAN_SENT",
    detail: "Travel plan sent to customer"
  }),
  [BOOKING_MILESTONE_ACTIONS.OFFER_SENT]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.OFFER_SENT,
    field: "offer_sent_at",
    stage: "OFFER_SENT",
    detail: "Offer sent to customer"
  }),
  [BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED,
    field: "negotiation_started_at",
    stage: "NEGOTIATION_STARTED",
    detail: "Negotiation started"
  }),
  [BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT,
    field: "deposit_request_sent_at",
    stage: "DEPOSIT_REQUEST_SENT",
    detail: "Deposit request sent to customer"
  }),
  [BOOKING_MILESTONE_ACTIONS.IN_PROGRESS]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.IN_PROGRESS,
    field: null,
    stage: "IN_PROGRESS",
    detail: "Booking marked as in progress"
  }),
  [BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED,
    field: "deposit_received_at",
    stage: "IN_PROGRESS",
    detail: "Deposit received"
  }),
  [BOOKING_MILESTONE_ACTIONS.BOOKING_LOST]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.BOOKING_LOST,
    field: "booking_lost_at",
    stage: "LOST",
    detail: "Booking marked as lost"
  }),
  [BOOKING_MILESTONE_ACTIONS.TRIP_COMPLETED]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.TRIP_COMPLETED,
    field: "trip_completed_at",
    stage: "TRIP_COMPLETED",
    detail: "Trip completed"
  })
});

const MILESTONE_FIELDS = Object.freeze(
  BOOKING_MILESTONE_ACTION_ORDER.map((action) => ACTION_META[action].field)
    .filter(Boolean)
);

function optionalTimestamp(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeMilestoneActionKey(action) {
  return normalizeText(action)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function bookingMilestoneMeta(action) {
  const normalized = normalizeMilestoneActionKey(action);
  return ACTION_META[normalized] || null;
}

export function normalizeBookingMilestones(milestones) {
  if (!milestones || typeof milestones !== "object" || Array.isArray(milestones)) return null;
  const normalized = Object.fromEntries(
    MILESTONE_FIELDS
      .map((field) => [field, optionalTimestamp(milestones[field])])
      .filter(([, value]) => Boolean(value))
  );
  return Object.keys(normalized).length ? normalized : null;
}

function inferLastActionFromMilestones(milestones) {
  const normalizedMilestones = normalizeBookingMilestones(milestones);
  let lastAction = null;
  let lastActionAt = "";

  for (const action of BOOKING_MILESTONE_ACTION_ORDER) {
    const field = ACTION_META[action].field;
    if (!field) continue;
    const timestamp = optionalTimestamp(normalizedMilestones?.[field]);
    if (!timestamp) continue;
    if (!lastActionAt || timestamp.localeCompare(lastActionAt) > 0) {
      lastAction = action;
      lastActionAt = timestamp;
    }
  }

  return {
    lastAction,
    lastActionAt: lastActionAt || null
  };
}

const PRE_DEPOSIT_STAGE_ACTIONS = Object.freeze(new Set([
  BOOKING_MILESTONE_ACTIONS.NEW_BOOKING,
  BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT,
  BOOKING_MILESTONE_ACTIONS.OFFER_SENT,
  BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED,
  BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT
]));

const POST_DEPOSIT_STAGE_ACTIONS = Object.freeze(new Set([
  BOOKING_MILESTONE_ACTIONS.IN_PROGRESS,
  BOOKING_MILESTONE_ACTIONS.TRIP_COMPLETED
]));

function bookingHasRecordedDeposit(booking) {
  const state = resolveBookingMilestoneState(booking, booking?.stage);
  return Boolean(optionalTimestamp(booking?.deposit_received_at) || optionalTimestamp(state?.milestones?.deposit_received_at));
}

function normalizePaymentRowStatus(value) {
  return normalizeText(value).toUpperCase();
}

function paymentAmountCents(payment) {
  const gross = Number(payment?.gross_amount_cents);
  if (Number.isFinite(gross)) return Math.max(0, Math.round(gross));
  const net = Number(payment?.net_amount_cents);
  return Number.isFinite(net) ? Math.max(0, Math.round(net)) : 0;
}

function collectDepositPaymentHints(booking) {
  const paymentTermsCandidates = [
    booking?.accepted_payment_terms_snapshot,
    booking?.offer?.payment_terms
  ];
  const depositLineIds = new Set();
  const depositLabels = new Set();
  for (const paymentTerms of paymentTermsCandidates) {
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    for (const line of lines) {
      if (normalizeText(line?.kind).toUpperCase() !== "DEPOSIT") continue;
      const lineId = normalizeText(line?.id);
      if (lineId) depositLineIds.add(lineId);
      const label = normalizeText(line?.label).toLowerCase();
      if (label) depositLabels.add(label);
    }
  }
  return {
    depositLineIds,
    depositLabels
  };
}

function isDepositPaymentRow(payment, depositHints) {
  const paymentLineId = normalizeText(payment?.origin_payment_term_line_id);
  if (paymentLineId && depositHints.depositLineIds.has(paymentLineId)) return true;
  const label = normalizeText(payment?.label).toLowerCase();
  if (label && (depositHints.depositLabels.has(label) || label.includes("deposit"))) return true;
  return false;
}

function hasAllRemainingPaymentsPaid(booking) {
  const payments = Array.isArray(booking?.pricing?.payments) ? booking.pricing.payments : [];
  if (!payments.length) return true;
  const depositHints = collectDepositPaymentHints(booking);
  return payments.every((payment) => {
    if (paymentAmountCents(payment) <= 0) return true;
    if (normalizePaymentRowStatus(payment?.status) === "PAID") return true;
    return bookingHasRecordedDeposit(booking) && isDepositPaymentRow(payment, depositHints);
  });
}

export function validateBookingMilestoneAction(booking, action) {
  const meta = bookingMilestoneMeta(action);
  if (!meta) {
    return { ok: false, status: 422, error: "Invalid milestone action" };
  }
  if (meta.action === BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED) {
    return {
      ok: false,
      status: 422,
      error: "Deposit receipt must be recorded in the payments section, not via the milestone stage controls."
    };
  }
  if (meta.action === BOOKING_MILESTONE_ACTIONS.BOOKING_LOST) {
    return { ok: true };
  }

  const hasRecordedDeposit = bookingHasRecordedDeposit(booking);
  if (!hasRecordedDeposit) {
    if (POST_DEPOSIT_STAGE_ACTIONS.has(meta.action)) {
      return {
        ok: false,
        status: 409,
        error: "This booking cannot move to post-deposit stages before the deposit receipt is recorded."
      };
    }
    return { ok: true };
  }

  if (PRE_DEPOSIT_STAGE_ACTIONS.has(meta.action)) {
    return {
      ok: false,
      status: 409,
      error: "This booking already has a recorded deposit receipt. Normal stage changes can only use post-deposit stages."
    };
  }
  if (meta.action === BOOKING_MILESTONE_ACTIONS.TRIP_COMPLETED && !hasAllRemainingPaymentsPaid(booking)) {
    return {
      ok: false,
      status: 409,
      error: "This booking cannot be marked as trip completed until all remaining payments are paid."
    };
  }
  return { ok: true };
}

export function resolveBookingMilestoneState(input = {}, fallbackStage = "") {
  const normalizedMilestones = normalizeBookingMilestones(input?.milestones);
  const explicitActionMeta = bookingMilestoneMeta(input?.last_action || input?.lastAction);
  const explicitLastAction = explicitActionMeta?.action || null;
  let explicitLastActionAt = optionalTimestamp(input?.last_action_at || input?.lastActionAt);

  if (explicitLastAction && !explicitLastActionAt) {
    explicitLastActionAt = optionalTimestamp(normalizedMilestones?.[explicitActionMeta.field]);
  }

  const inferred = inferLastActionFromMilestones(normalizedMilestones);
  const lastAction = explicitLastAction || inferred.lastAction || null;
  const lastActionAt = explicitLastActionAt || inferred.lastActionAt || null;
  const stage = lastAction
    ? ACTION_META[lastAction].stage
    : normalizeText(fallbackStage).toUpperCase() || "NEW_BOOKING";

  return {
    milestones: normalizedMilestones,
    lastAction,
    lastActionAt,
    stage
  };
}

export function applyBookingMilestoneAction(booking, action, deps = {}) {
  const meta = bookingMilestoneMeta(action);
  if (!meta) return null;
  const timestamp = optionalTimestamp(deps.now) || new Date().toISOString();
  const current = resolveBookingMilestoneState(booking, booking?.stage);
  if (meta.field) {
    const milestones = {
      ...(current.milestones || {}),
      [meta.field]: timestamp
    };
    booking.milestones = normalizeBookingMilestones(milestones);
  } else {
    booking.milestones = current.milestones || null;
  }
  booking.last_action = meta.action;
  booking.last_action_at = timestamp;
  booking.stage = meta.stage;
  if (typeof deps.computeServiceLevelAgreementDueAt === "function") {
    booking.service_level_agreement_due_at = deps.computeServiceLevelAgreementDueAt(
      booking.stage,
      new Date(timestamp)
    );
  }
  return {
    action: meta.action,
    timestamp,
    stage: booking.stage,
    detail: meta.detail
  };
}
