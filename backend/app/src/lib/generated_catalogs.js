import { SHARED_FIELD_DEFS } from "../../Generated/Models/generated_SchemaRuntime.js";

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

export const OFFER_PAYMENT_TERM_KIND_VALUES = enumValuesFor("OfferPaymentTermKind");
export const OFFER_PAYMENT_AMOUNT_MODE_VALUES = enumValuesFor("OfferPaymentAmountMode");
export const OFFER_PAYMENT_DUE_TYPE_VALUES = enumValuesFor("OfferPaymentDueType");
export const GENERATED_OFFER_BOOKING_CONFIRMATION_ROUTE_MODE_VALUES = enumValuesFor("GeneratedOfferBookingConfirmationRouteMode");
export const GENERATED_OFFER_BOOKING_CONFIRMATION_ROUTE_STATUS_VALUES = enumValuesFor("GeneratedOfferBookingConfirmationRouteStatus");
export const TOUR_STYLE_CODE_VALUES = enumValuesFor("TourStyleCode");
export const TRAVEL_PLAN_SERVICE_KIND_VALUES = enumValuesFor("TravelPlanServiceKind");
export const TRAVEL_PLAN_TIMING_KIND_VALUES = enumValuesFor("TravelPlanTimingKind");
export const TRAVEL_PLAN_OFFER_COVERAGE_TYPE_VALUES = enumValuesFor("TravelPlanOfferCoverageType");
export const TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_VALUES = enumValuesFor("TravelPlanFinancialCoverageStatus");
