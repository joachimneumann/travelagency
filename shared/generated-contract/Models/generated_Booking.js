// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from './generated_SchemaRuntime.js';
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

      export const BOOKING_PERSON_ADDRESS_SCHEMA = {
        name: "BookingPersonAddress",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPersonAddress",
        requireOneOf: [],
        fields: [
    schemaField({"name":"line_1","required":false,"wireName":"line_1"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_2","required":false,"wireName":"line_2"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"city","required":false,"wireName":"city"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"state_region","required":false,"wireName":"state_region"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"postal_code","required":false,"wireName":"postal_code"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"country_code","required":false,"wireName":"country_code"}, SHARED_FIELD_DEFS.FIELD_2)
        ]
      };

      export function validateBookingPersonAddress(value) {
        return validateShape(value, BOOKING_PERSON_ADDRESS_SCHEMA);
      }

      export const BOOKING_PERSON_CONSENT_SCHEMA = {
        name: "BookingPersonConsent",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPersonConsent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"consent_type","required":true,"wireName":"consent_type"}, SHARED_FIELD_DEFS.FIELD_3),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"captured_via","required":false,"wireName":"captured_via"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"captured_at","required":true,"wireName":"captured_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"evidence_ref","required":false,"wireName":"evidence_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingPersonConsent(value) {
        return validateShape(value, BOOKING_PERSON_CONSENT_SCHEMA);
      }

      export const BOOKING_PERSON_DOCUMENT_SCHEMA = {
        name: "BookingPersonDocument",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPersonDocument",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_type","required":true,"wireName":"document_type"}, SHARED_FIELD_DEFS.FIELD_6),
    schemaField({"name":"holder_name","required":false,"wireName":"holder_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_number","required":false,"wireName":"document_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_picture_refs","required":false,"wireName":"document_picture_refs"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"issuing_country","required":false,"wireName":"issuing_country"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"issued_on","required":false,"wireName":"issued_on"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"no_expiration_date","required":false,"wireName":"no_expiration_date"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"expires_on","required":false,"wireName":"expires_on"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingPersonDocument(value) {
        return validateShape(value, BOOKING_PERSON_DOCUMENT_SCHEMA);
      }

      export const BOOKING_PERSON_SCHEMA = {
        name: "BookingPerson",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPerson",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photo_ref","required":false,"wireName":"photo_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"emails","required":false,"wireName":"emails"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"phone_numbers","required":false,"wireName":"phone_numbers"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"food_preferences","required":false,"wireName":"food_preferences"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"allergies","required":false,"wireName":"allergies"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"hotel_room_smoker","required":false,"wireName":"hotel_room_smoker"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"hotel_room_sharing_ok","required":false,"wireName":"hotel_room_sharing_ok"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"date_of_birth","required":false,"wireName":"date_of_birth"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"gender","required":false,"wireName":"gender"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"nationality","required":false,"wireName":"nationality"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"address","required":false,"wireName":"address"}, SHARED_FIELD_DEFS.FIELD_13),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"consents","required":false,"wireName":"consents"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"documents","required":false,"wireName":"documents"}, SHARED_FIELD_DEFS.FIELD_16),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPerson(value) {
        return validateShape(value, BOOKING_PERSON_SCHEMA);
      }

      export const BOOKING_WEB_FORM_SUBMISSION_SCHEMA = {
        name: "BookingWebFormSubmission",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingWebFormSubmission",
        requireOneOf: [],
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"booking_name","required":false,"wireName":"booking_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tour_id","required":false,"wireName":"tour_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"page_url","required":false,"wireName":"page_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"ip_address","required":false,"wireName":"ip_address"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"ip_country_guess","required":false,"wireName":"ip_country_guess"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referrer","required":false,"wireName":"referrer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_source","required":false,"wireName":"utm_source"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_medium","required":false,"wireName":"utm_medium"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_campaign","required":false,"wireName":"utm_campaign"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"budget_upper_usd","required":false,"wireName":"budget_upper_usd"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"submitted_at","required":false,"wireName":"submitted_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingWebFormSubmission(value) {
        return validateShape(value, BOOKING_WEB_FORM_SUBMISSION_SCHEMA);
      }

      export const BOOKING_ACTIVITY_SCHEMA = {
        name: "BookingActivity",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingActivity",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_id","required":true,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"actor","required":true,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"detail","required":true,"wireName":"detail"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingActivity(value) {
        return validateShape(value, BOOKING_ACTIVITY_SCHEMA);
      }

      export const PRICING_ADJUSTMENT_SCHEMA = {
        name: "PricingAdjustment",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.PricingAdjustment",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"note","required":false,"wireName":"note"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validatePricingAdjustment(value) {
        return validateShape(value, PRICING_ADJUSTMENT_SCHEMA);
      }

      export const BOOKING_OFFER_CATEGORY_RULE_SCHEMA = {
        name: "BookingOfferCategoryRule",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingOfferCategoryRule",
        requireOneOf: [],
        fields: [
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingOfferCategoryRule(value) {
        return validateShape(value, BOOKING_OFFER_CATEGORY_RULE_SCHEMA);
      }

      export const BOOKING_OFFER_TOTALS_SCHEMA = {
        name: "BookingOfferTotals",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingOfferTotals",
        requireOneOf: [],
        fields: [
    schemaField({"name":"net_amount_cents","required":true,"wireName":"net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"tax_amount_cents","required":true,"wireName":"tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"gross_amount_cents","required":true,"wireName":"gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"items_count","required":true,"wireName":"items_count"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"status","required":false,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"offer_detail_level_internal","required":true,"wireName":"offer_detail_level_internal"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"offer_detail_level_visible","required":true,"wireName":"offer_detail_level_visible"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"category_rules","required":false,"wireName":"category_rules"}, SHARED_FIELD_DEFS.FIELD_26),
    schemaField({"name":"trip_price_internal","required":false,"wireName":"trip_price_internal"}, SHARED_FIELD_DEFS.FIELD_27),
    schemaField({"name":"days_internal","required":false,"wireName":"days_internal"}, SHARED_FIELD_DEFS.FIELD_28),
    schemaField({"name":"additional_items","required":false,"wireName":"additional_items"}, SHARED_FIELD_DEFS.FIELD_29),
    schemaField({"name":"discount","required":false,"wireName":"discount"}, SHARED_FIELD_DEFS.FIELD_30),
    schemaField({"name":"totals","required":true,"wireName":"totals"}, SHARED_FIELD_DEFS.FIELD_31),
    schemaField({"name":"quotation_summary","required":false,"wireName":"quotation_summary"}, SHARED_FIELD_DEFS.FIELD_32),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image","required":false,"wireName":"image"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"assigned_keycloak_user_id","required":false,"wireName":"assigned_keycloak_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_channel","required":false,"wireName":"source_channel"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"referral_kind","required":false,"wireName":"referral_kind"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"referral_label","required":false,"wireName":"referral_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referral_staff_user_id","required":false,"wireName":"referral_staff_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"assigned_keycloak_user_label","required":false,"wireName":"assigned_keycloak_user_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"core_revision","required":false,"wireName":"core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"notes_revision","required":false,"wireName":"notes_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"persons_revision","required":false,"wireName":"persons_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_plan_revision","required":false,"wireName":"travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"offer_revision","required":false,"wireName":"offer_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"payment_documents_revision","required":false,"wireName":"payment_documents_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_styles","required":false,"wireName":"travel_styles"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"travel_start_day","required":false,"wireName":"travel_start_day"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"travel_end_day","required":false,"wireName":"travel_end_day"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"customer_language","required":false,"wireName":"customer_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"persons","required":false,"wireName":"persons"}, SHARED_FIELD_DEFS.FIELD_36),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_37),
    schemaField({"name":"web_form_submission","required":false,"wireName":"web_form_submission"}, SHARED_FIELD_DEFS.FIELD_38),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"generated_offers","required":false,"wireName":"generated_offers"}, SHARED_FIELD_DEFS.FIELD_40),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBooking(value) {
        return validateShape(value, BOOKING_SCHEMA);
      }

