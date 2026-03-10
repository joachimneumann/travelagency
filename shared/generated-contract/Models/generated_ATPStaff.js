// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';
export const GENERATED_ATP_STAFF_ROLES = Object.freeze([
  "atp_admin",
  "atp_manager",
  "atp_accountant",
  "atp_staff"
]);

      export const ATPSTAFF_SCHEMA = {
        name: "ATPStaff",
        domain: "atp_staff",
        module: "entities",
        sourceType: "openapi.components.schemas.ATPStaff",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"preferred_username","required":true,"wireName":"preferred_username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"display_name","required":false,"wireName":"display_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_3),
    schemaField({"name":"staff_id","required":false,"wireName":"staff_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateATPStaff(value) {
        return validateShape(value, ATPSTAFF_SCHEMA);
      }

