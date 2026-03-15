import { SHARED_FIELD_DEFS } from "../../../shared/generated-contract/Models/generated_SchemaRuntime.js?v=b7baca7c60a0";

function findEnumOptions(typeName) {
  return Object.freeze(
    Object.values(SHARED_FIELD_DEFS).find((field) => field?.kind === "enum" && field?.typeName === typeName)?.options || []
  );
}

export const COUNTRY_CODE_OPTIONS = findEnumOptions("CountryCode");
export const MONTH_CODE_OPTIONS = findEnumOptions("MonthCode");
export const MONTH_CODE_CATALOG = Object.freeze(
  MONTH_CODE_OPTIONS.map((option) => option.value)
);
export const TRAVEL_PLAN_TIMING_KIND_OPTIONS = findEnumOptions("TravelPlanTimingKind");
export const TRAVEL_PLAN_SEGMENT_KIND_OPTIONS = findEnumOptions("TravelPlanSegmentKind");
export const TRAVEL_PLAN_OFFER_COVERAGE_TYPE_OPTIONS = findEnumOptions("TravelPlanOfferCoverageType");
export const TRAVEL_PLAN_FINANCIAL_COVERAGE_STATUS_OPTIONS = findEnumOptions("TravelPlanFinancialCoverageStatus");
