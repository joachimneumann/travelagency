import { SHARED_FIELD_DEFS } from "../../../shared/generated-contract/Models/generated_SchemaRuntime.js";

const EMPTY_OPTIONS = Object.freeze([]);
const ENUM_OPTIONS_BY_TYPE = new Map(
  Object.values(SHARED_FIELD_DEFS)
    .filter((field) => field?.kind === "enum" && field?.typeName)
    .map((field) => [field.typeName, Object.freeze(Array.isArray(field.options) ? field.options : [])])
);
const ENUM_VALUES_BY_TYPE = new Map();
const ENUM_VALUE_SETS_BY_TYPE = new Map();

export function enumOptionsFor(typeName) {
  return ENUM_OPTIONS_BY_TYPE.get(typeName) || EMPTY_OPTIONS;
}

export function enumValuesFor(typeName) {
  if (ENUM_VALUES_BY_TYPE.has(typeName)) {
    return ENUM_VALUES_BY_TYPE.get(typeName);
  }
  const values = Object.freeze(enumOptionsFor(typeName).map((option) => option.value));
  ENUM_VALUES_BY_TYPE.set(typeName, values);
  return values;
}

export function enumValueSetFor(typeName) {
  if (ENUM_VALUE_SETS_BY_TYPE.has(typeName)) {
    return ENUM_VALUE_SETS_BY_TYPE.get(typeName);
  }
  const values = new Set(enumValuesFor(typeName));
  ENUM_VALUE_SETS_BY_TYPE.set(typeName, values);
  return values;
}

export function normalizeGeneratedEnumValue(typeName, value, fallback, options = {}) {
  const transform = typeof options.transform === "function"
    ? options.transform
    : (rawValue) => String(rawValue ?? "").trim();
  const normalized = transform(value);
  return enumValueSetFor(typeName).has(normalized) ? normalized : fallback;
}

export const COUNTRY_CODE_OPTIONS = enumOptionsFor("CountryCode");
export const COUNTRY_CODE_CATALOG = enumValuesFor("CountryCode");
export const MONTH_CODE_OPTIONS = enumOptionsFor("MonthCode");
export const MONTH_CODE_CATALOG = enumValuesFor("MonthCode");
export const TRAVEL_PLAN_TIMING_KIND_OPTIONS = enumOptionsFor("TravelPlanTimingKind");
export const TRAVEL_PLAN_TIMING_KIND_CATALOG = enumValuesFor("TravelPlanTimingKind");
export const TRAVEL_PLAN_SERVICE_KIND_OPTIONS = enumOptionsFor("TravelPlanServiceKind");
export const TRAVEL_PLAN_SERVICE_KIND_CATALOG = enumValuesFor("TravelPlanServiceKind");
export const TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS = enumOptionsFor("TravelPlanOfferCoverageType");
export const TRAVEL_PLAN_OFFER_COVERAGE_TYPE_CATALOG = enumValuesFor("TravelPlanOfferCoverageType");
export const TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_OPTIONS = enumOptionsFor("TravelPlanFinancialCoverageStatus");
export const TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_CATALOG = enumValuesFor("TravelPlanFinancialCoverageStatus");
export const OFFER_PAYMENT_TERM_KIND_OPTIONS = enumOptionsFor("OfferPaymentTermKind");
export const OFFER_PAYMENT_TERM_KIND_CATALOG = enumValuesFor("OfferPaymentTermKind");
export const OFFER_PAYMENT_AMOUNT_MODE_OPTIONS = enumOptionsFor("OfferPaymentAmountMode");
export const OFFER_PAYMENT_AMOUNT_MODE_CATALOG = enumValuesFor("OfferPaymentAmountMode");
export const OFFER_PAYMENT_DUE_TYPE_OPTIONS = enumOptionsFor("OfferPaymentDueType");
export const OFFER_PAYMENT_DUE_TYPE_CATALOG = enumValuesFor("OfferPaymentDueType");
export const GENERATED_OFFER_CUSTOMER_CONFIRMATION_FLOW_MODE_OPTIONS = enumOptionsFor("GeneratedOfferCustomerConfirmationFlowMode");
export const GENERATED_OFFER_CUSTOMER_CONFIRMATION_FLOW_MODE_CATALOG = enumValuesFor("GeneratedOfferCustomerConfirmationFlowMode");
export const GENERATED_OFFER_CUSTOMER_CONFIRMATION_FLOW_STATUS_OPTIONS = enumOptionsFor("GeneratedOfferCustomerConfirmationFlowStatus");
export const GENERATED_OFFER_CUSTOMER_CONFIRMATION_FLOW_STATUS_CATALOG = enumValuesFor("GeneratedOfferCustomerConfirmationFlowStatus");
export const TOUR_STYLE_CODE_OPTIONS = enumOptionsFor("TourStyleCode");
export const TOUR_STYLE_CODE_CATALOG = enumValuesFor("TourStyleCode");
