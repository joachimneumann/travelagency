// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from '../Models/generated_SchemaRuntime.js';
import { GENERATED_API_ENDPOINTS } from './generated_APIRuntime.js';

      export const MOBILE_BOOTSTRAP_SCHEMA = {
        name: "MobileBootstrap",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.MobileBootstrap",
        requireOneOf: [],
        fields: [
    schemaField({"name":"app","required":true,"wireName":"app"}, SHARED_FIELD_DEFS.FIELD_40),
    schemaField({"name":"api","required":true,"wireName":"api"}, SHARED_FIELD_DEFS.FIELD_41),
    schemaField({"name":"features","required":true,"wireName":"features"}, SHARED_FIELD_DEFS.FIELD_42)
        ]
      };

      export function validateMobileBootstrap(value) {
        return validateShape(value, MOBILE_BOOTSTRAP_SCHEMA);
      }

      export const AUTH_ME_RESPONSE_SCHEMA = {
        name: "AuthMeResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AuthMeResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"authenticated","required":true,"wireName":"authenticated"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"user","required":false,"wireName":"user"}, SHARED_FIELD_DEFS.FIELD_43)
        ]
      };

      export function validateAuthMeResponse(value) {
        return validateShape(value, AUTH_ME_RESPONSE_SCHEMA);
      }

      export const PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA = {
        name: "PublicBookingCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PublicBookingCreateRequest",
        requireOneOf: [["email","phone_number"]],
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"preferred_currency","required":true,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"budget_upper_usd","required":false,"wireName":"budget_upper_usd"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"preferred_language","required":true,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_13),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_name","required":false,"wireName":"booking_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tour_id","required":false,"wireName":"tour_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"page_url","required":false,"wireName":"page_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referrer","required":false,"wireName":"referrer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_source","required":false,"wireName":"utm_source"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_medium","required":false,"wireName":"utm_medium"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_campaign","required":false,"wireName":"utm_campaign"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"idempotency_key","required":false,"wireName":"idempotency_key"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validatePublicBookingCreateRequest(value) {
        return validateShape(value, PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA);
      }

      export const BOOKING_DETAIL_SCHEMA = {
        name: "BookingDetail",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingDetail",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_44)
        ]
      };

      export function validateBookingDetail(value) {
        return validateShape(value, BOOKING_DETAIL_SCHEMA);
      }

      export const TOUR_LIST_SCHEMA = {
        name: "TourList",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourList",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_45),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_46),
    schemaField({"name":"filters","required":false,"wireName":"filters"}, SHARED_FIELD_DEFS.FIELD_47),
    schemaField({"name":"sort","required":false,"wireName":"sort"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"available_destinations","required":false,"wireName":"available_destinations"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"available_styles","required":false,"wireName":"available_styles"}, SHARED_FIELD_DEFS.FIELD_12)
        ]
      };

      export function validateTourList(value) {
        return validateShape(value, TOUR_LIST_SCHEMA);
      }

      export const BOOKING_LIST_SCHEMA = {
        name: "BookingList",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingList",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_48),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_46),
    schemaField({"name":"filters","required":false,"wireName":"filters"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"sort","required":false,"wireName":"sort"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingList(value) {
        return validateShape(value, BOOKING_LIST_SCHEMA);
      }

      export const BOOKING_DELETE_REQUEST_SCHEMA = {
        name: "BookingDeleteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingDeleteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingDeleteRequest(value) {
        return validateShape(value, BOOKING_DELETE_REQUEST_SCHEMA);
      }

      export const BOOKING_DELETE_RESPONSE_SCHEMA = {
        name: "BookingDeleteResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingDeleteResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"deleted","required":true,"wireName":"deleted"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"booking_id","required":true,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingDeleteResponse(value) {
        return validateShape(value, BOOKING_DELETE_RESPONSE_SCHEMA);
      }

      export const BOOKING_CHAT_RESPONSE_SCHEMA = {
        name: "BookingChatResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingChatResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":false,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"conversations","required":false,"wireName":"conversations"}, SHARED_FIELD_DEFS.FIELD_51),
    schemaField({"name":"conversation_total","required":true,"wireName":"conversation_total"}, SHARED_FIELD_DEFS.FIELD_19)
        ]
      };

      export function validateBookingChatResponse(value) {
        return validateShape(value, BOOKING_CHAT_RESPONSE_SCHEMA);
      }

      export const BOOKING_NAME_UPDATE_REQUEST_SCHEMA = {
        name: "BookingNameUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingNameUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingNameUpdateRequest(value) {
        return validateShape(value, BOOKING_NAME_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_STAGE_UPDATE_REQUEST_SCHEMA = {
        name: "BookingStageUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingStageUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"stage","required":true,"wireName":"stage"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingStageUpdateRequest(value) {
        return validateShape(value, BOOKING_STAGE_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_OWNER_UPDATE_REQUEST_SCHEMA = {
        name: "BookingOwnerUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOwnerUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"atp_staff","required":false,"wireName":"atp_staff"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOwnerUpdateRequest(value) {
        return validateShape(value, BOOKING_OWNER_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_PERSONS_UPDATE_REQUEST_SCHEMA = {
        name: "BookingPersonsUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPersonsUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"persons","required":false,"wireName":"persons"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPersonsUpdateRequest(value) {
        return validateShape(value, BOOKING_PERSONS_UPDATE_REQUEST_SCHEMA);
      }

      export const EVIDENCE_UPLOAD_SCHEMA = {
        name: "EvidenceUpload",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.EvidenceUpload",
        requireOneOf: [],
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateEvidenceUpload(value) {
        return validateShape(value, EVIDENCE_UPLOAD_SCHEMA);
      }

      export const BOOKING_NOTES_UPDATE_REQUEST_SCHEMA = {
        name: "BookingNotesUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingNotesUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingNotesUpdateRequest(value) {
        return validateShape(value, BOOKING_NOTES_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_PRICING_UPDATE_REQUEST_SCHEMA = {
        name: "BookingPricingUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPricingUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_53),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPricingUpdateRequest(value) {
        return validateShape(value, BOOKING_PRICING_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_OFFER_UPDATE_REQUEST_SCHEMA = {
        name: "BookingOfferUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_54),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferUpdateRequest(value) {
        return validateShape(value, BOOKING_OFFER_UPDATE_REQUEST_SCHEMA);
      }

      export const OFFER_EXCHANGE_RATES_REQUEST_SCHEMA = {
        name: "OfferExchangeRatesRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.OfferExchangeRatesRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"from_currency","required":true,"wireName":"from_currency"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"to_currency","required":true,"wireName":"to_currency"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_55)
        ]
      };

      export function validateOfferExchangeRatesRequest(value) {
        return validateShape(value, OFFER_EXCHANGE_RATES_REQUEST_SCHEMA);
      }

      export const OFFER_EXCHANGE_RATES_RESPONSE_SCHEMA = {
        name: "OfferExchangeRatesResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.OfferExchangeRatesResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"from_currency","required":true,"wireName":"from_currency"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"to_currency","required":true,"wireName":"to_currency"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"exchange_rate","required":true,"wireName":"exchange_rate"}, SHARED_FIELD_DEFS.FIELD_38),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"converted_components","required":false,"wireName":"converted_components"}, SHARED_FIELD_DEFS.FIELD_56),
    schemaField({"name":"warning","required":false,"wireName":"warning"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateOfferExchangeRatesResponse(value) {
        return validateShape(value, OFFER_EXCHANGE_RATES_RESPONSE_SCHEMA);
      }

      export const BOOKING_ACTIVITIES_RESPONSE_SCHEMA = {
        name: "BookingActivitiesResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingActivitiesResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_57),
    schemaField({"name":"activities","required":false,"wireName":"activities"}, SHARED_FIELD_DEFS.FIELD_57),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_19)
        ]
      };

      export function validateBookingActivitiesResponse(value) {
        return validateShape(value, BOOKING_ACTIVITIES_RESPONSE_SCHEMA);
      }

      export const BOOKING_ACTIVITY_CREATE_REQUEST_SCHEMA = {
        name: "BookingActivityCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingActivityCreateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"detail","required":false,"wireName":"detail"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingActivityCreateRequest(value) {
        return validateShape(value, BOOKING_ACTIVITY_CREATE_REQUEST_SCHEMA);
      }

      export const BOOKING_ACTIVITY_RESPONSE_SCHEMA = {
        name: "BookingActivityResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingActivityResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"activity","required":true,"wireName":"activity"}, SHARED_FIELD_DEFS.FIELD_58),
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_44)
        ]
      };

      export function validateBookingActivityResponse(value) {
        return validateShape(value, BOOKING_ACTIVITY_RESPONSE_SCHEMA);
      }

      export const BOOKING_INVOICES_RESPONSE_SCHEMA = {
        name: "BookingInvoicesResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingInvoicesResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_59),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_19)
        ]
      };

      export function validateBookingInvoicesResponse(value) {
        return validateShape(value, BOOKING_INVOICES_RESPONSE_SCHEMA);
      }

      export const BOOKING_INVOICE_UPSERT_REQUEST_SCHEMA = {
        name: "BookingInvoiceUpsertRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingInvoiceUpsertRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"invoice_number","required":false,"wireName":"invoice_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":false,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"issue_date","required":false,"wireName":"issue_date"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"due_date","required":false,"wireName":"due_date"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_60),
    schemaField({"name":"due_amount_cents","required":false,"wireName":"due_amount_cents"}, SHARED_FIELD_DEFS.FIELD_61),
    schemaField({"name":"sent_to_recipient","required":false,"wireName":"sent_to_recipient"}, SHARED_FIELD_DEFS.FIELD_4)
        ]
      };

      export function validateBookingInvoiceUpsertRequest(value) {
        return validateShape(value, BOOKING_INVOICE_UPSERT_REQUEST_SCHEMA);
      }

      export const BOOKING_INVOICE_RESPONSE_SCHEMA = {
        name: "BookingInvoiceResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingInvoiceResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"invoice","required":true,"wireName":"invoice"}, SHARED_FIELD_DEFS.FIELD_62),
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_44)
        ]
      };

      export function validateBookingInvoiceResponse(value) {
        return validateShape(value, BOOKING_INVOICE_RESPONSE_SCHEMA);
      }

      export const ATP_STAFF_LIST_RESPONSE_SCHEMA = {
        name: "AtpStaffListResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffListResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_63),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_19)
        ]
      };

      export function validateAtpStaffListResponse(value) {
        return validateShape(value, ATP_STAFF_LIST_RESPONSE_SCHEMA);
      }

      export const ATP_STAFF_CREATE_REQUEST_SCHEMA = {
        name: "AtpStaffCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffCreateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"usernames","required":false,"wireName":"usernames"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"languages","required":false,"wireName":"languages"}, SHARED_FIELD_DEFS.FIELD_12)
        ]
      };

      export function validateAtpStaffCreateRequest(value) {
        return validateShape(value, ATP_STAFF_CREATE_REQUEST_SCHEMA);
      }

      export const ATP_STAFF_RESPONSE_SCHEMA = {
        name: "AtpStaffResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"atp_staff","required":true,"wireName":"atp_staff"}, SHARED_FIELD_DEFS.FIELD_64)
        ]
      };

      export function validateAtpStaffResponse(value) {
        return validateShape(value, ATP_STAFF_RESPONSE_SCHEMA);
      }

      export const TOUR_UPSERT_REQUEST_SCHEMA = {
        name: "TourUpsertRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourUpsertRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"travel_duration_days","required":false,"wireName":"travel_duration_days"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"priority","required":false,"wireName":"priority"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"rating","required":false,"wireName":"rating"}, SHARED_FIELD_DEFS.FIELD_38),
    schemaField({"name":"seasonality_start_month","required":false,"wireName":"seasonality_start_month"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"seasonality_end_month","required":false,"wireName":"seasonality_end_month"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"short_description","required":false,"wireName":"short_description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"highlights","required":false,"wireName":"highlights"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"image","required":false,"wireName":"image"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTourUpsertRequest(value) {
        return validateShape(value, TOUR_UPSERT_REQUEST_SCHEMA);
      }

      export const TOUR_RESPONSE_SCHEMA = {
        name: "TourResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_65)
        ]
      };

      export function validateTourResponse(value) {
        return validateShape(value, TOUR_RESPONSE_SCHEMA);
      }

      export const TOUR_DETAIL_SCHEMA = {
        name: "TourDetail",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourDetail",
        requireOneOf: [],
        fields: [
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_65),
    schemaField({"name":"options","required":true,"wireName":"options"}, SHARED_FIELD_DEFS.FIELD_66)
        ]
      };

      export function validateTourDetail(value) {
        return validateShape(value, TOUR_DETAIL_SCHEMA);
      }

      export const MOBILE_APP_VERSION_GATE_SCHEMA = {
        name: "MobileAppVersionGate",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.MobileAppVersionGate",
        requireOneOf: [],
        fields: [
    schemaField({"name":"min_supported_version","required":true,"wireName":"min_supported_version"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"latest_version","required":true,"wireName":"latest_version"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"force_update","required":true,"wireName":"force_update"}, SHARED_FIELD_DEFS.FIELD_4)
        ]
      };

      export function validateMobileAppVersionGate(value) {
        return validateShape(value, MOBILE_APP_VERSION_GATE_SCHEMA);
      }

      export const APICONTRACT_VERSION_SCHEMA = {
        name: "APIContractVersion",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.APIContractVersion",
        requireOneOf: [],
        fields: [
    schemaField({"name":"contract_version","required":true,"wireName":"contract_version"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateAPIContractVersion(value) {
        return validateShape(value, APICONTRACT_VERSION_SCHEMA);
      }

      export const FEATURE_FLAGS_SCHEMA = {
        name: "FeatureFlags",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.FeatureFlags",
        requireOneOf: [],
        fields: [
    schemaField({"name":"bookings","required":true,"wireName":"bookings"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"tours","required":true,"wireName":"tours"}, SHARED_FIELD_DEFS.FIELD_4)
        ]
      };

      export function validateFeatureFlags(value) {
        return validateShape(value, FEATURE_FLAGS_SCHEMA);
      }

      export const AUTHENTICATED_USER_SCHEMA = {
        name: "AuthenticatedUser",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AuthenticatedUser",
        requireOneOf: [],
        fields: [
    schemaField({"name":"sub","required":false,"wireName":"sub"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"preferred_username","required":false,"wireName":"preferred_username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_12)
        ]
      };

      export function validateAuthenticatedUser(value) {
        return validateShape(value, AUTHENTICATED_USER_SCHEMA);
      }

      export const PAGINATION_SCHEMA = {
        name: "Pagination",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.Pagination",
        requireOneOf: [],
        fields: [
    schemaField({"name":"page","required":true,"wireName":"page"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"page_size","required":true,"wireName":"page_size"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"total_items","required":true,"wireName":"total_items"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"total_pages","required":true,"wireName":"total_pages"}, SHARED_FIELD_DEFS.FIELD_19)
        ]
      };

      export function validatePagination(value) {
        return validateShape(value, PAGINATION_SCHEMA);
      }

      export const TOUR_LIST_FILTERS_SCHEMA = {
        name: "TourListFilters",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourListFilters",
        requireOneOf: [],
        fields: [
    schemaField({"name":"destination","required":false,"wireName":"destination"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"style","required":false,"wireName":"style"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"search","required":false,"wireName":"search"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTourListFilters(value) {
        return validateShape(value, TOUR_LIST_FILTERS_SCHEMA);
      }

      export const BOOKING_LIST_FILTERS_SCHEMA = {
        name: "BookingListFilters",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingListFilters",
        requireOneOf: [],
        fields: [
    schemaField({"name":"stage","required":false,"wireName":"stage"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"atp_staff","required":false,"wireName":"atp_staff"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"search","required":false,"wireName":"search"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingListFilters(value) {
        return validateShape(value, BOOKING_LIST_FILTERS_SCHEMA);
      }

      export const BOOKING_CHAT_EVENT_SCHEMA = {
        name: "BookingChatEvent",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingChatEvent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"channel","required":true,"wireName":"channel"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"direction","required":true,"wireName":"direction"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"event_type","required":true,"wireName":"event_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"external_status","required":false,"wireName":"external_status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"text_preview","required":true,"wireName":"text_preview"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sender_display","required":false,"wireName":"sender_display"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sender_contact","required":false,"wireName":"sender_contact"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sent_at","required":false,"wireName":"sent_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"received_at","required":false,"wireName":"received_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"conversation_id","required":true,"wireName":"conversation_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"open_url","required":false,"wireName":"open_url"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingChatEvent(value) {
        return validateShape(value, BOOKING_CHAT_EVENT_SCHEMA);
      }

      export const BOOKING_CHAT_CONVERSATION_SCHEMA = {
        name: "BookingChatConversation",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingChatConversation",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"channel","required":true,"wireName":"channel"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"external_contact_id","required":false,"wireName":"external_contact_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_id","required":false,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"last_event_at","required":false,"wireName":"last_event_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"latest_preview","required":false,"wireName":"latest_preview"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"open_url","required":false,"wireName":"open_url"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingChatConversation(value) {
        return validateShape(value, BOOKING_CHAT_CONVERSATION_SCHEMA);
      }

      export const OFFER_EXCHANGE_RATE_COMPONENT_SCHEMA = {
        name: "OfferExchangeRateComponent",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.OfferExchangeRateComponent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_29),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_61),
    schemaField({"name":"tax_rate_basis_points","required":false,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_19)
        ]
      };

      export function validateOfferExchangeRateComponent(value) {
        return validateShape(value, OFFER_EXCHANGE_RATE_COMPONENT_SCHEMA);
      }

      export const MONEY_AMOUNT_SCHEMA = {
        name: "MoneyAmount",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.MoneyAmount",
        requireOneOf: [],
        fields: [

        ]
      };

      export function validateMoneyAmount(value) {
        return validateShape(value, MONEY_AMOUNT_SCHEMA);
      }

      export const ATP_STAFF_DIRECTORY_ENTRY_SCHEMA = {
        name: "AtpStaffDirectoryEntry",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffDirectoryEntry",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_4),
    schemaField({"name":"usernames","required":false,"wireName":"usernames"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"languages","required":false,"wireName":"languages"}, SHARED_FIELD_DEFS.FIELD_12)
        ]
      };

      export function validateAtpStaffDirectoryEntry(value) {
        return validateShape(value, ATP_STAFF_DIRECTORY_ENTRY_SCHEMA);
      }

      export const TOUR_OPTIONS_SCHEMA = {
        name: "TourOptions",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourOptions",
        requireOneOf: [],
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_12)
        ]
      };

      export function validateTourOptions(value) {
        return validateShape(value, TOUR_OPTIONS_SCHEMA);
      }

