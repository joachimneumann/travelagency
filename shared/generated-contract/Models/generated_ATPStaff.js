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
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"preferredUsername","required":true,"wireName":"preferredUsername"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"displayName","required":false,"wireName":"displayName"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_3),
    schemaField({"name":"atpStaffId","required":false,"wireName":"atpStaffId"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateATPStaff(value) {
        return validateShape(value, ATPSTAFF_SCHEMA);
      }

