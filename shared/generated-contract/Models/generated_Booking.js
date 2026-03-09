// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';
export const GENERATED_BOOKING_STAGES = Object.freeze([
  "NEW",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "INVOICE_SENT",
  "PAYMENT_RECEIVED",
  "WON",
  "LOST",
  "POST_TRIP"
]);
export const GENERATED_PAYMENT_STATUSES = Object.freeze([
  "PENDING",
  "PAID",
  "VOID"
]);
export const GENERATED_PRICING_ADJUSTMENT_TYPES = Object.freeze([
  "DISCOUNT",
  "CREDIT",
  "SURCHARGE"
]);
export const GENERATED_OFFER_CATEGORIES = Object.freeze([
  "ACCOMMODATION",
  "TRANSPORTATION",
  "TOURS_ACTIVITIES",
  "GUIDE_SUPPORT_SERVICES",
  "MEALS",
  "FEES_TAXES",
  "DISCOUNTS_CREDITS",
  "OTHER"
]);

      export const SOURCE_ATTRIBUTION_SCHEMA = {
        name: "SourceAttribution",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.SourceAttribution",
        requireOneOf: [],
        fields: [

        ]
      };

      export function validateSourceAttribution(value) {
        return validateShape(value, SOURCE_ATTRIBUTION_SCHEMA);
      }

      export const BOOKING_ACTIVITY_SCHEMA = {
        name: "BookingActivity",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingActivity",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"bookingId","required":true,"wireName":"bookingId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"actor","required":true,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"detail","required":true,"wireName":"detail"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"createdAt","required":true,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingActivity(value) {
        return validateShape(value, BOOKING_ACTIVITY_SCHEMA);
      }

      export const BOOKING_INVOICE_SCHEMA = {
        name: "BookingInvoice",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingInvoice",
        requireOneOf: [],
        fields: [

        ]
      };

      export function validateBookingInvoice(value) {
        return validateShape(value, BOOKING_INVOICE_SCHEMA);
      }

      export const BOOKING_PRICING_SCHEMA = {
        name: "BookingPricing",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPricing",
        requireOneOf: [],
        fields: [

        ]
      };

      export function validateBookingPricing(value) {
        return validateShape(value, BOOKING_PRICING_SCHEMA);
      }

      export const BOOKING_OFFER_CATEGORY_RULE_SCHEMA = {
        name: "BookingOfferCategoryRule",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingOfferCategoryRule",
        requireOneOf: [],
        fields: [
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_6),
    schemaField({"name":"taxRateBasisPoints","required":true,"wireName":"taxRateBasisPoints"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateBookingOfferCategoryRule(value) {
        return validateShape(value, BOOKING_OFFER_CATEGORY_RULE_SCHEMA);
      }

      export const BOOKING_OFFER_COMPONENT_SCHEMA = {
        name: "BookingOfferComponent",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingOfferComponent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_6),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"unitAmountCents","required":true,"wireName":"unitAmountCents"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"taxRateBasisPoints","required":true,"wireName":"taxRateBasisPoints"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"lineTotalAmountCents","required":false,"wireName":"lineTotalAmountCents"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sortOrder","required":false,"wireName":"sortOrder"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"createdAt","required":false,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updatedAt","required":false,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingOfferComponent(value) {
        return validateShape(value, BOOKING_OFFER_COMPONENT_SCHEMA);
      }

      export const BOOKING_OFFER_TOTALS_SCHEMA = {
        name: "BookingOfferTotals",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingOfferTotals",
        requireOneOf: [],
        fields: [
    schemaField({"name":"netAmountCents","required":true,"wireName":"netAmountCents"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"taxAmountCents","required":true,"wireName":"taxAmountCents"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"grossAmountCents","required":true,"wireName":"grossAmountCents"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"componentsCount","required":true,"wireName":"componentsCount"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateBookingOfferTotals(value) {
        return validateShape(value, BOOKING_OFFER_TOTALS_SCHEMA);
      }

      export const BOOKING_OFFER_SCHEMA = {
        name: "BookingOffer",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingOffer",
        requireOneOf: [],
        fields: [
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"categoryRules","required":false,"wireName":"categoryRules"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"totals","required":true,"wireName":"totals"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"totalPriceCents","required":true,"wireName":"totalPriceCents"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateBookingOffer(value) {
        return validateShape(value, BOOKING_OFFER_SCHEMA);
      }

      export const BOOKING_SCHEMA = {
        name: "Booking",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.Booking",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_id","required":false,"wireName":"client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_type","required":false,"wireName":"client_type"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"client_display_name","required":false,"wireName":"client_display_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_primary_phone_number","required":false,"wireName":"client_primary_phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_primary_email","required":false,"wireName":"client_primary_email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"stage","required":true,"wireName":"stage"}, SHARED_FIELD_DEFS.FIELD_13),
    schemaField({"name":"atp_staff","required":false,"wireName":"atp_staff"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"atp_staff_name","required":false,"wireName":"atp_staff_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"destination","required":false,"wireName":"destination"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"style","required":false,"wireName":"style"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"web_form_travel_month","required":false,"wireName":"web_form_travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_start_day","required":false,"wireName":"travel_start_day"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"travel_end_day","required":false,"wireName":"travel_end_day"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"preferredCurrency","required":false,"wireName":"preferredCurrency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"web_form_submission","required":false,"wireName":"web_form_submission"}, SHARED_FIELD_DEFS.FIELD_16),
    schemaField({"name":"service_level_agreement_due_at","required":false,"wireName":"service_level_agreement_due_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"source","required":false,"wireName":"source"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"createdAt","required":true,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updatedAt","required":true,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBooking(value) {
        return validateShape(value, BOOKING_SCHEMA);
      }

