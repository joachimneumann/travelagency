// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';

      export const TOUR_SCHEMA = {
        name: "Tour",
        domain: "aux",
        module: "entities",
        sourceType: "openapi.components.schemas.Tour",
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"destinationCountries","required":false,"wireName":"destinationCountries"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"durationDays","required":false,"wireName":"durationDays"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"priceFrom","required":false,"wireName":"priceFrom"}, SHARED_FIELD_DEFS.FIELD_27)
        ]
      };

      export function validateTour(value) {
        return validateShape(value, TOUR_SCHEMA);
      }

      export const TOUR_PRICE_FROM_SCHEMA = {
        name: "TourPriceFrom",
        domain: "aux",
        module: "entities",
        sourceType: "openapi.components.schemas.TourPriceFrom",
        fields: [
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"minor","required":true,"wireName":"minor"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateTourPriceFrom(value) {
        return validateShape(value, TOUR_PRICE_FROM_SCHEMA);
      }

