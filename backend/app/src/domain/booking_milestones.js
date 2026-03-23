import { normalizeText } from "../lib/text.js";

export const BOOKING_MILESTONE_ACTIONS = Object.freeze({
  NEW_BOOKING: "NEW_BOOKING",
  TRAVEL_PLAN_SENT: "TRAVEL_PLAN_SENT",
  OFFER_SENT: "OFFER_SENT",
  NEGOTIATION_STARTED: "NEGOTIATION_STARTED",
  DEPOSIT_REQUEST_SENT: "DEPOSIT_REQUEST_SENT",
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
    stage: "NEW",
    detail: "Booking marked as new"
  }),
  [BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT,
    field: "travel_plan_sent_at",
    stage: "QUALIFIED",
    detail: "Travel plan sent to customer"
  }),
  [BOOKING_MILESTONE_ACTIONS.OFFER_SENT]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.OFFER_SENT,
    field: "offer_sent_at",
    stage: "PROPOSAL_SENT",
    detail: "Offer sent to customer"
  }),
  [BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED,
    field: "negotiation_started_at",
    stage: "NEGOTIATION",
    detail: "Negotiation started"
  }),
  [BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT,
    field: "deposit_request_sent_at",
    stage: "INVOICE_SENT",
    detail: "Deposit request sent to customer"
  }),
  [BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED]: Object.freeze({
    action: BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED,
    field: "deposit_received_at",
    stage: "PAYMENT_RECEIVED",
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
    stage: "POST_TRIP",
    detail: "Trip completed"
  })
});

const ACTION_ALIASES = Object.freeze({
  NEW: BOOKING_MILESTONE_ACTIONS.NEW_BOOKING,
  QUALIFIED: BOOKING_MILESTONE_ACTIONS.TRAVEL_PLAN_SENT,
  PROPOSAL_SENT: BOOKING_MILESTONE_ACTIONS.OFFER_SENT,
  NEGOTIATION: BOOKING_MILESTONE_ACTIONS.NEGOTIATION_STARTED,
  INVOICE_SENT: BOOKING_MILESTONE_ACTIONS.DEPOSIT_REQUEST_SENT,
  PAYMENT_RECEIVED: BOOKING_MILESTONE_ACTIONS.DEPOSIT_RECEIVED,
  LOST: BOOKING_MILESTONE_ACTIONS.BOOKING_LOST,
  POST_TRIP: BOOKING_MILESTONE_ACTIONS.TRIP_COMPLETED
});

const MILESTONE_FIELDS = Object.freeze(
  BOOKING_MILESTONE_ACTION_ORDER.map((action) => ACTION_META[action].field)
);

function optionalTimestamp(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeMilestoneActionKey(action) {
  const normalized = normalizeText(action)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ACTION_ALIASES[normalized] || normalized;
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

export function resolveBookingMilestoneState(input = {}, fallbackStage = "") {
  const normalizedMilestones = normalizeBookingMilestones(input?.milestones || input?.lifecycle);
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
    : normalizeText(fallbackStage).toUpperCase() || "NEW";

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
  const milestones = {
    ...(current.milestones || {}),
    [meta.field]: timestamp
  };
  booking.milestones = normalizeBookingMilestones(milestones);
  booking.last_action = meta.action;
  booking.last_action_at = timestamp;
  booking.stage = meta.stage;
  delete booking.lifecycle;
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
