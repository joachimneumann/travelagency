// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';

      export const CUSTOMER_SCHEMA = {
        name: "Customer",
        domain: "customer",
        module: "entities",
        sourceType: "openapi.components.schemas.Customer",
        fields: [
    schemaField({"name":"client_id","required":true,"wireName":"client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"customer_hash","required":false,"wireName":"customer_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photo_ref","required":false,"wireName":"photo_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"first_name","required":false,"wireName":"first_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"last_name","required":false,"wireName":"last_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"date_of_birth","required":false,"wireName":"date_of_birth"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"nationality","required":false,"wireName":"nationality"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"address_line_1","required":false,"wireName":"address_line_1"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_line_2","required":false,"wireName":"address_line_2"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_city","required":false,"wireName":"address_city"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_state_region","required":false,"wireName":"address_state_region"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_postal_code","required":false,"wireName":"address_postal_code"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_country_code","required":false,"wireName":"address_country_code"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"organization_name","required":false,"wireName":"organization_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_address","required":false,"wireName":"organization_address"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_phone_number","required":false,"wireName":"organization_phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_webpage","required":false,"wireName":"organization_webpage"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_email","required":false,"wireName":"organization_email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"tax_id","required":false,"wireName":"tax_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"timezone","required":false,"wireName":"timezone"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"archived_at","required":false,"wireName":"archived_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateCustomer(value) {
        return validateShape(value, CUSTOMER_SCHEMA);
      }

      export const CUSTOMER_CONSENT_SCHEMA = {
        name: "CustomerConsent",
        domain: "customer",
        module: "entities",
        sourceType: "openapi.components.schemas.CustomerConsent",
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"customer_client_id","required":true,"wireName":"customer_client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"consent_type","required":true,"wireName":"consent_type"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"captured_via","required":false,"wireName":"captured_via"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"captured_at","required":true,"wireName":"captured_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"evidence_ref","required":false,"wireName":"evidence_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateCustomerConsent(value) {
        return validateShape(value, CUSTOMER_CONSENT_SCHEMA);
      }

      export const CUSTOMER_DOCUMENT_SCHEMA = {
        name: "CustomerDocument",
        domain: "customer",
        module: "entities",
        sourceType: "openapi.components.schemas.CustomerDocument",
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"customer_client_id","required":true,"wireName":"customer_client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_type","required":true,"wireName":"document_type"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"document_number","required":false,"wireName":"document_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_picture_ref","required":false,"wireName":"document_picture_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"issuing_country","required":false,"wireName":"issuing_country"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"expires_on","required":false,"wireName":"expires_on"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateCustomerDocument(value) {
        return validateShape(value, CUSTOMER_DOCUMENT_SCHEMA);
      }

