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
    schemaField({"name":"pageUrl","required":false,"wireName":"pageUrl"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"ipAddress","required":false,"wireName":"ipAddress"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"ipCountryGuess","required":false,"wireName":"ipCountryGuess"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referrer","required":false,"wireName":"referrer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utmSource","required":false,"wireName":"utmSource"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utmMedium","required":false,"wireName":"utmMedium"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utmCampaign","required":false,"wireName":"utmCampaign"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateSourceAttribution(value) {
        return validateShape(value, SOURCE_ATTRIBUTION_SCHEMA);
      }

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
    schemaField({"name":"country_code","required":false,"wireName":"country_code"}, SHARED_FIELD_DEFS.FIELD_4)
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
    schemaField({"name":"consent_type","required":true,"wireName":"consent_type"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_6),
    schemaField({"name":"captured_via","required":false,"wireName":"captured_via"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"captured_at","required":true,"wireName":"captured_at"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"evidence_ref","required":false,"wireName":"evidence_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"document_type","required":true,"wireName":"document_type"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"document_number","required":false,"wireName":"document_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_picture_ref","required":false,"wireName":"document_picture_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"issuing_country","required":false,"wireName":"issuing_country"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"expires_on","required":false,"wireName":"expires_on"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"phone_numbers","required":false,"wireName":"phone_numbers"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"date_of_birth","required":false,"wireName":"date_of_birth"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"nationality","required":false,"wireName":"nationality"}, SHARED_FIELD_DEFS.FIELD_4),
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
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_USD","required":false,"wireName":"budget_lower_USD"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"budget_upper_USD","required":false,"wireName":"budget_upper_USD"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"submittedAt","required":false,"wireName":"submittedAt"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"bookingId","required":true,"wireName":"bookingId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"actor","required":true,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"detail","required":true,"wireName":"detail"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"createdAt","required":true,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"description","required":false,"wireName":"description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"unitNet","required":true,"wireName":"unitNet"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"taxRate","required":true,"wireName":"taxRate"}, SHARED_FIELD_DEFS.FIELD_22)
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
    schemaField({"name":"invoiceNumber","required":false,"wireName":"invoiceNumber"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"issueDate","required":false,"wireName":"issueDate"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"dueDate","required":false,"wireName":"dueDate"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sentToRecipient","required":false,"wireName":"sentToRecipient"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"createdAt","required":false,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"updatedAt","required":false,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"netAmount","required":true,"wireName":"netAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"createdAt","required":false,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"updatedAt","required":false,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_26),
    schemaField({"name":"netAmount","required":true,"wireName":"netAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"taxRate","required":true,"wireName":"taxRate"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"dueDate","required":false,"wireName":"dueDate"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"paidAt","required":false,"wireName":"paidAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"createdAt","required":false,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"updatedAt","required":false,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"agreedNetAmount","required":true,"wireName":"agreedNetAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"adjustedNetAmount","required":true,"wireName":"adjustedNetAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"scheduledNetAmount","required":true,"wireName":"scheduledNetAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"unscheduledNetAmount","required":true,"wireName":"unscheduledNetAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"scheduledTaxAmount","required":true,"wireName":"scheduledTaxAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"scheduledGrossAmount","required":true,"wireName":"scheduledGrossAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"paidGrossAmount","required":true,"wireName":"paidGrossAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"outstandingGrossAmount","required":true,"wireName":"outstandingGrossAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"isScheduleBalanced","required":true,"wireName":"isScheduleBalanced"}, SHARED_FIELD_DEFS.FIELD_24)
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
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"agreedNetAmount","required":true,"wireName":"agreedNetAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"adjustments","required":false,"wireName":"adjustments"}, SHARED_FIELD_DEFS.FIELD_27),
    schemaField({"name":"payments","required":false,"wireName":"payments"}, SHARED_FIELD_DEFS.FIELD_28),
    schemaField({"name":"summary","required":true,"wireName":"summary"}, SHARED_FIELD_DEFS.FIELD_29)
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
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_30),
    schemaField({"name":"taxRate","required":true,"wireName":"taxRate"}, SHARED_FIELD_DEFS.FIELD_22)
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
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_30),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"unitNet","required":true,"wireName":"unitNet"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"taxRate","required":true,"wireName":"taxRate"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"lineTotalAmountCents","required":false,"wireName":"lineTotalAmountCents"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sortOrder","required":false,"wireName":"sortOrder"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"createdAt","required":false,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"updatedAt","required":false,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"netAmount","required":true,"wireName":"netAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"taxAmount","required":true,"wireName":"taxAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"grossAmount","required":true,"wireName":"grossAmount"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"componentsCount","required":true,"wireName":"componentsCount"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"categoryRules","required":false,"wireName":"categoryRules"}, SHARED_FIELD_DEFS.FIELD_31),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_32),
    schemaField({"name":"totals","required":true,"wireName":"totals"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"totalPriceCents","required":true,"wireName":"totalPriceCents"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"stage","required":true,"wireName":"stage"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"atp_staff","required":false,"wireName":"atp_staff"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"serviceLevelAgreementDueAt","required":false,"wireName":"serviceLevelAgreementDueAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_styles","required":false,"wireName":"travel_styles"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"travel_start_day","required":false,"wireName":"travel_start_day"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"travel_end_day","required":false,"wireName":"travel_end_day"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferredCurrency","required":false,"wireName":"preferredCurrency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"persons","required":false,"wireName":"persons"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"web_form_submission","required":false,"wireName":"web_form_submission"}, SHARED_FIELD_DEFS.FIELD_36),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_37),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_38),
    schemaField({"name":"source","required":false,"wireName":"source"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"createdAt","required":true,"wireName":"createdAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"updatedAt","required":true,"wireName":"updatedAt"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateBooking(value) {
        return validateShape(value, BOOKING_SCHEMA);
      }

