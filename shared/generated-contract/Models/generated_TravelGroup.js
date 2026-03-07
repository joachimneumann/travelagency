// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';

      export const TRAVEL_GROUP_SCHEMA = {
        name: "TravelGroup",
        domain: "travel_group",
        module: "entities",
        sourceType: "openapi.components.schemas.TravelGroup",
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_id","required":true,"wireName":"client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_group_hash","required":false,"wireName":"travel_group_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"group_name","required":true,"wireName":"group_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"timezone","required":false,"wireName":"timezone"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"archived_at","required":false,"wireName":"archived_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateTravelGroup(value) {
        return validateShape(value, TRAVEL_GROUP_SCHEMA);
      }

      export const TRAVEL_GROUP_MEMBER_SCHEMA = {
        name: "TravelGroupMember",
        domain: "travel_group",
        module: "entities",
        sourceType: "openapi.components.schemas.TravelGroupMember",
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_group_id","required":true,"wireName":"travel_group_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"customer_client_id","required":true,"wireName":"customer_client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"is_traveling","required":false,"wireName":"is_traveling"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"member_roles","required":false,"wireName":"member_roles"}, SHARED_FIELD_DEFS.FIELD_26),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateTravelGroupMember(value) {
        return validateShape(value, TRAVEL_GROUP_MEMBER_SCHEMA);
      }

