import { normalizeGeneratedEnumValue } from "./generated_catalogs.js";

export function normalizeGeneratedOfferCustomerConfirmationFlowMode(value, fallback = "DEPOSIT_PAYMENT") {
  return normalizeGeneratedEnumValue("GeneratedOfferCustomerConfirmationFlowMode", value, fallback, {
    transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
  });
}

export function normalizeGeneratedOfferCustomerConfirmationFlowStatus(value, fallback = "OPEN") {
  return normalizeGeneratedEnumValue("GeneratedOfferCustomerConfirmationFlowStatus", value, fallback, {
    transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
  });
}

export function generatedOfferCustomerConfirmationFlowUsesDepositPayment(value) {
  return normalizeGeneratedOfferCustomerConfirmationFlowMode(value) === "DEPOSIT_PAYMENT";
}

export function formatGeneratedOfferCustomerConfirmationFlowLabel(value, labels = {}) {
  return generatedOfferCustomerConfirmationFlowUsesDepositPayment(value)
    ? (labels.deposit ?? "Deposit payment")
    : (labels.deposit ?? "Deposit payment");
}
