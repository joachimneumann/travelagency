import { normalizeGeneratedEnumValue } from "./generated_catalogs.js";

export function normalizeGeneratedOfferBookingConfirmationRouteMode(value, fallback = "DEPOSIT_PAYMENT") {
  return normalizeGeneratedEnumValue("GeneratedOfferBookingConfirmationRouteMode", value, fallback, {
    transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
  });
}

export function normalizeGeneratedOfferBookingConfirmationRouteStatus(value, fallback = "OPEN") {
  return normalizeGeneratedEnumValue("GeneratedOfferBookingConfirmationRouteStatus", value, fallback, {
    transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
  });
}

export function generatedOfferRouteUsesDepositPayment(value) {
  return normalizeGeneratedOfferBookingConfirmationRouteMode(value) === "DEPOSIT_PAYMENT";
}

export function formatGeneratedOfferBookingConfirmationRouteLabel(value, labels = {}) {
  return generatedOfferRouteUsesDepositPayment(value)
    ? (labels.deposit ?? "Deposit payment")
    : (labels.deposit ?? "Deposit payment");
}
