import { SHARED_FIELD_DEFS } from "../../../shared/generated-contract/Models/generated_SchemaRuntime.js?v=2c526d5d72ed";

function findEnumOptions(typeName) {
  return Object.freeze(
    Object.values(SHARED_FIELD_DEFS).find((field) => field?.kind === "enum" && field?.typeName === typeName)?.options || []
  );
}

export const COUNTRY_CODE_OPTIONS = findEnumOptions("CountryCode");
