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
    schemaField({"name":"document_picture_ref","required":false,"wireName":"document_picture_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"issuing_country","required":false,"wireName":"issuing_country"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"issued_on","required":false,"wireName":"issued_on"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"no_expiration_date","required":false,"wireName":"no_expiration_date"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"expires_on","required":false,"wireName":"expires_on"}, SHARED_FIELD_DEFS.FIELD_7),
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
    schemaField({"name":"emails","required":false,"wireName":"emails"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"phone_numbers","required":false,"wireName":"phone_numbers"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"date_of_birth","required":false,"wireName":"date_of_birth"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"nationality","required":false,"wireName":"nationality"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"address","required":false,"wireName":"address"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_13),
    schemaField({"name":"consents","required":false,"wireName":"consents"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"documents","required":false,"wireName":"documents"}, SHARED_FIELD_DEFS.FIELD_15),
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_16),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_10),
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
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"budget_upper_usd","required":false,"wireName":"budget_upper_usd"}, SHARED_FIELD_DEFS.FIELD_17),
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
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"actor","required":true,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"detail","required":true,"wireName":"detail"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingActivity(value) {
        return validateShape(value, BOOKING_ACTIVITY_SCHEMA);
      }

      export const INVOICE_COMPONENT_SCHEMA = {
        name: "InvoiceComponent",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.InvoiceComponent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"description","required":true,"wireName":"description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"total_amount_cents","required":false,"wireName":"total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21)
        ]
      };

      export function validateInvoiceComponent(value) {
        return validateShape(value, INVOICE_COMPONENT_SCHEMA);
      }

      export const BOOKING_INVOICE_SCHEMA = {
        name: "BookingInvoice",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingInvoice",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_id","required":false,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"invoice_number","required":false,"wireName":"invoice_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"version","required":false,"wireName":"version"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"status","required":false,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"issue_date","required":false,"wireName":"issue_date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"due_date","required":false,"wireName":"due_date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sent_to_recipient","required":false,"wireName":"sent_to_recipient"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"sent_to_recipient_at","required":false,"wireName":"sent_to_recipient_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"total_amount_cents","required":false,"wireName":"total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"due_amount_cents","required":false,"wireName":"due_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"pdf_url","required":false,"wireName":"pdf_url"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingInvoice(value) {
        return validateShape(value, BOOKING_INVOICE_SCHEMA);
      }

      export const PRICING_ADJUSTMENT_SCHEMA = {
        name: "PricingAdjustment",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.PricingAdjustment",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"note","required":false,"wireName":"note"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validatePricingAdjustment(value) {
        return validateShape(value, PRICING_ADJUSTMENT_SCHEMA);
      }

      export const BOOKING_PAYMENT_SCHEMA = {
        name: "BookingPayment",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPayment",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"net_amount_cents","required":true,"wireName":"net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"due_date","required":false,"wireName":"due_date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"paid_at","required":false,"wireName":"paid_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tax_amount_cents","required":false,"wireName":"tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"gross_amount_cents","required":false,"wireName":"gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"origin_generated_offer_id","required":false,"wireName":"origin_generated_offer_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"origin_payment_term_line_id","required":false,"wireName":"origin_payment_term_line_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingPayment(value) {
        return validateShape(value, BOOKING_PAYMENT_SCHEMA);
      }

      export const BOOKING_PRICING_SUMMARY_SCHEMA = {
        name: "BookingPricingSummary",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPricingSummary",
        requireOneOf: [],
        fields: [
    schemaField({"name":"agreed_net_amount_cents","required":true,"wireName":"agreed_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"adjustments_delta_cents","required":true,"wireName":"adjustments_delta_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"adjusted_net_amount_cents","required":true,"wireName":"adjusted_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"scheduled_net_amount_cents","required":true,"wireName":"scheduled_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"unscheduled_net_amount_cents","required":true,"wireName":"unscheduled_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"scheduled_tax_amount_cents","required":true,"wireName":"scheduled_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"scheduled_gross_amount_cents","required":true,"wireName":"scheduled_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"paid_gross_amount_cents","required":true,"wireName":"paid_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"outstanding_gross_amount_cents","required":true,"wireName":"outstanding_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"is_schedule_balanced","required":true,"wireName":"is_schedule_balanced"}, SHARED_FIELD_DEFS.FIELD_8)
        ]
      };

      export function validateBookingPricingSummary(value) {
        return validateShape(value, BOOKING_PRICING_SUMMARY_SCHEMA);
      }

      export const BOOKING_PRICING_SCHEMA = {
        name: "BookingPricing",
        domain: "booking",
        module: "entities",
        sourceType: "openapi.components.schemas.BookingPricing",
        requireOneOf: [],
        fields: [
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"agreed_net_amount_cents","required":true,"wireName":"agreed_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"adjustments","required":false,"wireName":"adjustments"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"payments","required":false,"wireName":"payments"}, SHARED_FIELD_DEFS.FIELD_26),
    schemaField({"name":"summary","required":true,"wireName":"summary"}, SHARED_FIELD_DEFS.FIELD_27)
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
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_28),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_28),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"unit_tax_amount_cents","required":false,"wireName":"unit_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"unit_total_amount_cents","required":false,"wireName":"unit_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"line_net_amount_cents","required":false,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"line_tax_amount_cents","required":false,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"line_gross_amount_cents","required":false,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"line_total_amount_cents","required":false,"wireName":"line_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sort_order","required":false,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
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
    schemaField({"name":"net_amount_cents","required":true,"wireName":"net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"tax_amount_cents","required":true,"wireName":"tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"gross_amount_cents","required":true,"wireName":"gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"items_count","required":true,"wireName":"items_count"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"category_rules","required":false,"wireName":"category_rules"}, SHARED_FIELD_DEFS.FIELD_29),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_30),
    schemaField({"name":"discount","required":false,"wireName":"discount"}, SHARED_FIELD_DEFS.FIELD_31),
    schemaField({"name":"totals","required":true,"wireName":"totals"}, SHARED_FIELD_DEFS.FIELD_32),
    schemaField({"name":"quotation_summary","required":false,"wireName":"quotation_summary"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"stage","required":true,"wireName":"stage"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"assigned_keycloak_user_id","required":false,"wireName":"assigned_keycloak_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"core_revision","required":false,"wireName":"core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"notes_revision","required":false,"wireName":"notes_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"persons_revision","required":false,"wireName":"persons_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_plan_revision","required":false,"wireName":"travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"pricing_revision","required":false,"wireName":"pricing_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"offer_revision","required":false,"wireName":"offer_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"invoices_revision","required":false,"wireName":"invoices_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"service_level_agreement_due_at","required":false,"wireName":"service_level_agreement_due_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_16),
    schemaField({"name":"travel_styles","required":false,"wireName":"travel_styles"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"travel_start_day","required":false,"wireName":"travel_start_day"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"travel_end_day","required":false,"wireName":"travel_end_day"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"customer_language","required":false,"wireName":"customer_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"accepted_generated_offer_id","required":false,"wireName":"accepted_generated_offer_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"persons","required":false,"wireName":"persons"}, SHARED_FIELD_DEFS.FIELD_36),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_37),
    schemaField({"name":"web_form_submission","required":false,"wireName":"web_form_submission"}, SHARED_FIELD_DEFS.FIELD_38),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_40),
    schemaField({"name":"generated_offers","required":false,"wireName":"generated_offers"}, SHARED_FIELD_DEFS.FIELD_41),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBooking(value) {
        return validateShape(value, BOOKING_SCHEMA);
      }
