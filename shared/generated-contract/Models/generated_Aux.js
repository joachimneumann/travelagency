// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';

      export const TOUR_SCHEMA = {
        name: "Tour",
        domain: "aux",
        module: "entities",
        sourceType: "openapi.components.schemas.Tour",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"travel_duration_days","required":false,"wireName":"travel_duration_days"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"budget_lower_USD","required":false,"wireName":"budget_lower_USD"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"priority","required":false,"wireName":"priority"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"rating","required":false,"wireName":"rating"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"seasonality_start_month","required":false,"wireName":"seasonality_start_month"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"seasonality_end_month","required":false,"wireName":"seasonality_end_month"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"shortDescription","required":false,"wireName":"shortDescription"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"highlights","required":false,"wireName":"highlights"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"image","required":false,"wireName":"image"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"createdAt","required":false,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updatedAt","required":false,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateTour(value) {
        return validateShape(value, TOUR_SCHEMA);
      }

      export const WEBSITE_BOOKING_FORM_SCHEMA = {
        name: "WebsiteBookingForm",
        domain: "aux",
        module: "entities",
        sourceType: "openapi.components.schemas.WebsiteBookingForm",
        requireOneOf: [["email","phone_number"]],
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"preferred_currency","required":true,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_USD","required":false,"wireName":"budget_lower_USD"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"budget_upper_USD","required":false,"wireName":"budget_upper_USD"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"preferred_language","required":true,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateWebsiteBookingForm(value) {
        return validateShape(value, WEBSITE_BOOKING_FORM_SCHEMA);
      }

