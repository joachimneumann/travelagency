import { normalizeGeneratedEnumValue } from "./generated_catalogs.js";

export function normalizeGeneratedOfferAcceptanceRouteMode(value, fallback = "OTP") {
  return normalizeGeneratedEnumValue("GeneratedOfferAcceptanceRouteMode", value, fallback, {
    transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
  });
}

export function normalizeGeneratedOfferAcceptanceRouteStatus(value, fallback = "OPEN") {
  return normalizeGeneratedEnumValue("GeneratedOfferAcceptanceRouteStatus", value, fallback, {
    transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
  });
}

export function generatedOfferRouteUsesDepositPayment(value) {
  return normalizeGeneratedOfferAcceptanceRouteMode(value) === "DEPOSIT_PAYMENT";
}

export function formatGeneratedOfferAcceptanceRouteLabel(value, labels = {}) {
  return generatedOfferRouteUsesDepositPayment(value)
    ? (labels.deposit ?? "Deposit payment")
    : (labels.otp ?? "OTP confirmation");
}
