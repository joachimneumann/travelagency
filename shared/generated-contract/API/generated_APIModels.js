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
    schemaField({"name":"app","required":true,"wireName":"app"}, SHARED_FIELD_DEFS.FIELD_44),
    schemaField({"name":"api","required":true,"wireName":"api"}, SHARED_FIELD_DEFS.FIELD_45),
    schemaField({"name":"features","required":true,"wireName":"features"}, SHARED_FIELD_DEFS.FIELD_46)
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
    schemaField({"name":"authenticated","required":true,"wireName":"authenticated"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"user","required":false,"wireName":"user"}, SHARED_FIELD_DEFS.FIELD_47)
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"preferred_currency","required":true,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"budget_upper_usd","required":false,"wireName":"budget_upper_usd"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"preferred_language","required":true,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_11),
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
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_48),
    schemaField({"name":"unchanged","required":false,"wireName":"unchanged"}, SHARED_FIELD_DEFS.FIELD_8)
        ]
      };

      export function validateBookingDetail(value) {
        return validateShape(value, BOOKING_DETAIL_SCHEMA);
      }

      export const PUBLIC_GENERATED_OFFER_ACCESS_RESPONSE_SCHEMA = {
        name: "PublicGeneratedOfferAccessResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PublicGeneratedOfferAccessResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_id","required":true,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"generated_offer_id","required":true,"wireName":"generated_offer_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_name","required":false,"wireName":"booking_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"pdf_url","required":false,"wireName":"pdf_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"acceptance_route","required":false,"wireName":"acceptance_route"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"public_acceptance_expires_at","required":false,"wireName":"public_acceptance_expires_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"accepted","required":true,"wireName":"accepted"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"acceptance","required":false,"wireName":"acceptance"}, SHARED_FIELD_DEFS.FIELD_51)
        ]
      };

      export function validatePublicGeneratedOfferAccessResponse(value) {
        return validateShape(value, PUBLIC_GENERATED_OFFER_ACCESS_RESPONSE_SCHEMA);
      }

      export const PUBLIC_GENERATED_OFFER_ACCEPT_REQUEST_SCHEMA = {
        name: "PublicGeneratedOfferAcceptRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PublicGeneratedOfferAcceptRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"acceptance_token","required":true,"wireName":"acceptance_token"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_by_name","required":false,"wireName":"accepted_by_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_by_email","required":false,"wireName":"accepted_by_email"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"accepted_by_phone","required":false,"wireName":"accepted_by_phone"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_by_person_id","required":false,"wireName":"accepted_by_person_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"language","required":false,"wireName":"language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"otp_channel","required":false,"wireName":"otp_channel"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"otp_code","required":false,"wireName":"otp_code"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validatePublicGeneratedOfferAcceptRequest(value) {
        return validateShape(value, PUBLIC_GENERATED_OFFER_ACCEPT_REQUEST_SCHEMA);
      }

      export const PUBLIC_GENERATED_OFFER_ACCEPT_RESPONSE_SCHEMA = {
        name: "PublicGeneratedOfferAcceptResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PublicGeneratedOfferAcceptResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_id","required":true,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"generated_offer_id","required":true,"wireName":"generated_offer_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted","required":true,"wireName":"accepted"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"acceptance_route","required":false,"wireName":"acceptance_route"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"acceptance","required":false,"wireName":"acceptance"}, SHARED_FIELD_DEFS.FIELD_51),
    schemaField({"name":"otp_channel","required":false,"wireName":"otp_channel"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"otp_sent_to","required":false,"wireName":"otp_sent_to"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"otp_expires_at","required":false,"wireName":"otp_expires_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"retry_after_seconds","required":false,"wireName":"retry_after_seconds"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validatePublicGeneratedOfferAcceptResponse(value) {
        return validateShape(value, PUBLIC_GENERATED_OFFER_ACCEPT_RESPONSE_SCHEMA);
      }

      export const TOUR_LIST_SCHEMA = {
        name: "TourList",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourList",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_53),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_54),
    schemaField({"name":"filters","required":false,"wireName":"filters"}, SHARED_FIELD_DEFS.FIELD_55),
    schemaField({"name":"sort","required":false,"wireName":"sort"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"available_destinations","required":false,"wireName":"available_destinations"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"available_styles","required":false,"wireName":"available_styles"}, SHARED_FIELD_DEFS.FIELD_10)
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_56),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_54),
    schemaField({"name":"filters","required":false,"wireName":"filters"}, SHARED_FIELD_DEFS.FIELD_57),
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"deleted","required":true,"wireName":"deleted"}, SHARED_FIELD_DEFS.FIELD_8),
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_58),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"conversations","required":false,"wireName":"conversations"}, SHARED_FIELD_DEFS.FIELD_59),
    schemaField({"name":"conversation_total","required":true,"wireName":"conversation_total"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingNameUpdateRequest(value) {
        return validateShape(value, BOOKING_NAME_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_CUSTOMER_LANGUAGE_UPDATE_REQUEST_SCHEMA = {
        name: "BookingCustomerLanguageUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingCustomerLanguageUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"customer_language","required":true,"wireName":"customer_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingCustomerLanguageUpdateRequest(value) {
        return validateShape(value, BOOKING_CUSTOMER_LANGUAGE_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_IMAGE_UPLOAD_REQUEST_SCHEMA = {
        name: "BookingImageUploadRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingImageUploadRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingImageUploadRequest(value) {
        return validateShape(value, BOOKING_IMAGE_UPLOAD_REQUEST_SCHEMA);
      }

      export const BOOKING_STAGE_UPDATE_REQUEST_SCHEMA = {
        name: "BookingStageUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingStageUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"stage","required":true,"wireName":"stage"}, SHARED_FIELD_DEFS.FIELD_35),
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"assigned_keycloak_user_id","required":false,"wireName":"assigned_keycloak_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOwnerUpdateRequest(value) {
        return validateShape(value, BOOKING_OWNER_UPDATE_REQUEST_SCHEMA);
      }

      export const TRANSLATION_ENTRIES_REQUEST_SCHEMA = {
        name: "TranslationEntriesRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TranslationEntriesRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_lang","required":true,"wireName":"source_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"target_lang","required":true,"wireName":"target_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"entries","required":false,"wireName":"entries"}, SHARED_FIELD_DEFS.FIELD_60)
        ]
      };

      export function validateTranslationEntriesRequest(value) {
        return validateShape(value, TRANSLATION_ENTRIES_REQUEST_SCHEMA);
      }

      export const TRANSLATION_ENTRIES_RESPONSE_SCHEMA = {
        name: "TranslationEntriesResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TranslationEntriesResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_lang","required":true,"wireName":"source_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"target_lang","required":true,"wireName":"target_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"entries","required":false,"wireName":"entries"}, SHARED_FIELD_DEFS.FIELD_60)
        ]
      };

      export function validateTranslationEntriesResponse(value) {
        return validateShape(value, TRANSLATION_ENTRIES_RESPONSE_SCHEMA);
      }

      export const BOOKING_PERSON_CREATE_REQUEST_SCHEMA = {
        name: "BookingPersonCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPersonCreateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_persons_revision","required":false,"wireName":"expected_persons_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"person","required":true,"wireName":"person"}, SHARED_FIELD_DEFS.FIELD_61),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPersonCreateRequest(value) {
        return validateShape(value, BOOKING_PERSON_CREATE_REQUEST_SCHEMA);
      }

      export const BOOKING_PERSON_UPDATE_REQUEST_SCHEMA = {
        name: "BookingPersonUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPersonUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_persons_revision","required":false,"wireName":"expected_persons_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"person","required":true,"wireName":"person"}, SHARED_FIELD_DEFS.FIELD_61),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPersonUpdateRequest(value) {
        return validateShape(value, BOOKING_PERSON_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_PERSON_DELETE_REQUEST_SCHEMA = {
        name: "BookingPersonDeleteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPersonDeleteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_persons_revision","required":false,"wireName":"expected_persons_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPersonDeleteRequest(value) {
        return validateShape(value, BOOKING_PERSON_DELETE_REQUEST_SCHEMA);
      }

      export const BOOKING_NOTES_UPDATE_REQUEST_SCHEMA = {
        name: "BookingNotesUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingNotesUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_notes_revision","required":false,"wireName":"expected_notes_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingNotesUpdateRequest(value) {
        return validateShape(value, BOOKING_NOTES_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_UPDATE_REQUEST_SCHEMA = {
        name: "BookingTravelPlanUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_plan","required":true,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_62),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanUpdateRequest(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_TRANSLATE_REQUEST_SCHEMA = {
        name: "BookingTravelPlanTranslateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanTranslateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanTranslateRequest(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_TRANSLATE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_ITEM_SEARCH_RESPONSE_SCHEMA = {
        name: "TravelPlanItemSearchResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanItemSearchResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_63),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateTravelPlanItemSearchResponse(value) {
        return validateShape(value, TRAVEL_PLAN_ITEM_SEARCH_RESPONSE_SCHEMA);
      }

      export const TRAVEL_PLAN_ITEM_IMPORT_REQUEST_SCHEMA = {
        name: "TravelPlanItemImportRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanItemImportRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"source_booking_id","required":true,"wireName":"source_booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_item_id","required":true,"wireName":"source_item_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"insert_after_item_id","required":false,"wireName":"insert_after_item_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"include_images","required":true,"wireName":"include_images"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"include_customer_visible_images_only","required":true,"wireName":"include_customer_visible_images_only"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"include_notes","required":true,"wireName":"include_notes"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"include_translations","required":true,"wireName":"include_translations"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"include_offer_links","required":true,"wireName":"include_offer_links"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanItemImportRequest(value) {
        return validateShape(value, TRAVEL_PLAN_ITEM_IMPORT_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_ITEM_IMAGE_UPLOAD_REQUEST_SCHEMA = {
        name: "TravelPlanItemImageUploadRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanItemImageUploadRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanItemImageUploadRequest(value) {
        return validateShape(value, TRAVEL_PLAN_ITEM_IMAGE_UPLOAD_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_ITEM_IMAGE_DELETE_REQUEST_SCHEMA = {
        name: "TravelPlanItemImageDeleteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanItemImageDeleteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanItemImageDeleteRequest(value) {
        return validateShape(value, TRAVEL_PLAN_ITEM_IMAGE_DELETE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_ITEM_IMAGE_REORDER_REQUEST_SCHEMA = {
        name: "TravelPlanItemImageReorderRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanItemImageReorderRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"image_ids","required":false,"wireName":"image_ids"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanItemImageReorderRequest(value) {
        return validateShape(value, TRAVEL_PLAN_ITEM_IMAGE_REORDER_REQUEST_SCHEMA);
      }

      export const BOOKING_PRICING_UPDATE_REQUEST_SCHEMA = {
        name: "BookingPricingUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPricingUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_pricing_revision","required":false,"wireName":"expected_pricing_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_64),
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
    schemaField({"name":"expected_offer_revision","required":false,"wireName":"expected_offer_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_65),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferUpdateRequest(value) {
        return validateShape(value, BOOKING_OFFER_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_OFFER_TRANSLATE_REQUEST_SCHEMA = {
        name: "BookingOfferTranslateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferTranslateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_offer_revision","required":false,"wireName":"expected_offer_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferTranslateRequest(value) {
        return validateShape(value, BOOKING_OFFER_TRANSLATE_REQUEST_SCHEMA);
      }

      export const BOOKING_GENERATE_OFFER_REQUEST_SCHEMA = {
        name: "BookingGenerateOfferRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingGenerateOfferRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_offer_revision","required":false,"wireName":"expected_offer_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"acceptance_route","required":false,"wireName":"acceptance_route"}, SHARED_FIELD_DEFS.FIELD_66)
        ]
      };

      export function validateBookingGenerateOfferRequest(value) {
        return validateShape(value, BOOKING_GENERATE_OFFER_REQUEST_SCHEMA);
      }

      export const OFFER_EXCHANGE_RATES_REQUEST_SCHEMA = {
        name: "OfferExchangeRatesRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.OfferExchangeRatesRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"from_currency","required":true,"wireName":"from_currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"to_currency","required":true,"wireName":"to_currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_67)
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
    schemaField({"name":"exchange_rate","required":true,"wireName":"exchange_rate"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"converted_components","required":false,"wireName":"converted_components"}, SHARED_FIELD_DEFS.FIELD_68),
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_69),
    schemaField({"name":"activities","required":false,"wireName":"activities"}, SHARED_FIELD_DEFS.FIELD_69),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_20),
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
    schemaField({"name":"activity","required":true,"wireName":"activity"}, SHARED_FIELD_DEFS.FIELD_70),
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_48)
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_71),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"expected_invoices_revision","required":false,"wireName":"expected_invoices_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"invoice_number","required":false,"wireName":"invoice_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":false,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"issue_date","required":false,"wireName":"issue_date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"due_date","required":false,"wireName":"due_date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_72),
    schemaField({"name":"due_amount_cents","required":false,"wireName":"due_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"sent_to_recipient","required":false,"wireName":"sent_to_recipient"}, SHARED_FIELD_DEFS.FIELD_8)
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
    schemaField({"name":"invoice","required":true,"wireName":"invoice"}, SHARED_FIELD_DEFS.FIELD_74),
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_48),
    schemaField({"name":"unchanged","required":false,"wireName":"unchanged"}, SHARED_FIELD_DEFS.FIELD_8)
        ]
      };

      export function validateBookingInvoiceResponse(value) {
        return validateShape(value, BOOKING_INVOICE_RESPONSE_SCHEMA);
      }

      export const BOOKING_INVOICE_TRANSLATE_REQUEST_SCHEMA = {
        name: "BookingInvoiceTranslateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingInvoiceTranslateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_invoices_revision","required":false,"wireName":"expected_invoices_revision"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingInvoiceTranslateRequest(value) {
        return validateShape(value, BOOKING_INVOICE_TRANSLATE_REQUEST_SCHEMA);
      }

      export const KEYCLOAK_USER_LIST_RESPONSE_SCHEMA = {
        name: "KeycloakUserListResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.KeycloakUserListResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_75),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateKeycloakUserListResponse(value) {
        return validateShape(value, KEYCLOAK_USER_LIST_RESPONSE_SCHEMA);
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"travel_duration_days","required":false,"wireName":"travel_duration_days"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"priority","required":false,"wireName":"priority"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"rating","required":false,"wireName":"rating"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"seasonality_start_month","required":false,"wireName":"seasonality_start_month"}, SHARED_FIELD_DEFS.FIELD_43),
    schemaField({"name":"seasonality_end_month","required":false,"wireName":"seasonality_end_month"}, SHARED_FIELD_DEFS.FIELD_43),
    schemaField({"name":"short_description","required":false,"wireName":"short_description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"highlights","required":false,"wireName":"highlights"}, SHARED_FIELD_DEFS.FIELD_10),
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
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_76)
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
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_76),
    schemaField({"name":"options","required":true,"wireName":"options"}, SHARED_FIELD_DEFS.FIELD_77)
        ]
      };

      export function validateTourDetail(value) {
        return validateShape(value, TOUR_DETAIL_SCHEMA);
      }

      export const TOUR_TRANSLATE_FIELDS_REQUEST_SCHEMA = {
        name: "TourTranslateFieldsRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourTranslateFieldsRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_lang","required":true,"wireName":"source_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"target_lang","required":true,"wireName":"target_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"entries","required":false,"wireName":"entries"}, SHARED_FIELD_DEFS.FIELD_60)
        ]
      };

      export function validateTourTranslateFieldsRequest(value) {
        return validateShape(value, TOUR_TRANSLATE_FIELDS_REQUEST_SCHEMA);
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

      export const MOBILE_APP_VERSION_GATE_SCHEMA = {
        name: "MobileAppVersionGate",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.MobileAppVersionGate",
        requireOneOf: [],
        fields: [
    schemaField({"name":"min_supported_version","required":true,"wireName":"min_supported_version"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"latest_version","required":true,"wireName":"latest_version"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"force_update","required":true,"wireName":"force_update"}, SHARED_FIELD_DEFS.FIELD_8)
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
    schemaField({"name":"bookings","required":true,"wireName":"bookings"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"tours","required":true,"wireName":"tours"}, SHARED_FIELD_DEFS.FIELD_8)
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
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"given_name","required":false,"wireName":"given_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"family_name","required":false,"wireName":"family_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"preferred_username","required":false,"wireName":"preferred_username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_10)
        ]
      };

      export function validateAuthenticatedUser(value) {
        return validateShape(value, AUTHENTICATED_USER_SCHEMA);
      }

      export const BOOKING_READ_MODEL_SCHEMA = {
        name: "BookingReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingReadModel",
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
    schemaField({"name":"persons","required":false,"wireName":"persons"}, SHARED_FIELD_DEFS.FIELD_78),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_62),
    schemaField({"name":"web_form_submission","required":false,"wireName":"web_form_submission"}, SHARED_FIELD_DEFS.FIELD_79),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_64),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_80),
    schemaField({"name":"generated_offers","required":false,"wireName":"generated_offers"}, SHARED_FIELD_DEFS.FIELD_81),
    schemaField({"name":"travel_plan_translation_status","required":true,"wireName":"travel_plan_translation_status"}, SHARED_FIELD_DEFS.FIELD_82),
    schemaField({"name":"offer_translation_status","required":true,"wireName":"offer_translation_status"}, SHARED_FIELD_DEFS.FIELD_82),
    schemaField({"name":"generated_offer_email_enabled","required":true,"wireName":"generated_offer_email_enabled"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"translation_enabled","required":true,"wireName":"translation_enabled"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingReadModel(value) {
        return validateShape(value, BOOKING_READ_MODEL_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_TERMS_READ_MODEL_SCHEMA = {
        name: "BookingOfferPaymentTermsReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentTermsReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"lines","required":false,"wireName":"lines"}, SHARED_FIELD_DEFS.FIELD_83),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"basis_total_amount_cents","required":true,"wireName":"basis_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"scheduled_total_amount_cents","required":true,"wireName":"scheduled_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateBookingOfferPaymentTermsReadModel(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERMS_READ_MODEL_SCHEMA);
      }

      export const PUBLIC_GENERATED_OFFER_ACCEPTANCE_ROUTE_VIEW_SCHEMA = {
        name: "PublicGeneratedOfferAcceptanceRouteView",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PublicGeneratedOfferAcceptanceRouteView",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":true,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_84),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_85),
    schemaField({"name":"expires_at","required":false,"wireName":"expires_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"customer_message_snapshot","required":false,"wireName":"customer_message_snapshot"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"deposit_rule","required":false,"wireName":"deposit_rule"}, SHARED_FIELD_DEFS.FIELD_86)
        ]
      };

      export function validatePublicGeneratedOfferAcceptanceRouteView(value) {
        return validateShape(value, PUBLIC_GENERATED_OFFER_ACCEPTANCE_ROUTE_VIEW_SCHEMA);
      }

      export const GENERATED_OFFER_ACCEPTANCE_PUBLIC_SUMMARY_SCHEMA = {
        name: "GeneratedOfferAcceptancePublicSummary",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.GeneratedOfferAcceptancePublicSummary",
        requireOneOf: [],
        fields: [
    schemaField({"name":"accepted_at","required":true,"wireName":"accepted_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"method","required":true,"wireName":"method"}, SHARED_FIELD_DEFS.FIELD_87),
    schemaField({"name":"accepted_amount_cents","required":false,"wireName":"accepted_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"accepted_currency","required":false,"wireName":"accepted_currency"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateGeneratedOfferAcceptancePublicSummary(value) {
        return validateShape(value, GENERATED_OFFER_ACCEPTANCE_PUBLIC_SUMMARY_SCHEMA);
      }

      export const PAGINATION_SCHEMA = {
        name: "Pagination",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.Pagination",
        requireOneOf: [],
        fields: [
    schemaField({"name":"page","required":true,"wireName":"page"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"page_size","required":true,"wireName":"page_size"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"total_items","required":true,"wireName":"total_items"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"total_pages","required":true,"wireName":"total_pages"}, SHARED_FIELD_DEFS.FIELD_17)
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
    schemaField({"name":"assigned_keycloak_user_id","required":false,"wireName":"assigned_keycloak_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
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

      export const TRANSLATION_ENTRY_SCHEMA = {
        name: "TranslationEntry",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TranslationEntry",
        requireOneOf: [],
        fields: [
    schemaField({"name":"key","required":true,"wireName":"key"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"value","required":true,"wireName":"value"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTranslationEntry(value) {
        return validateShape(value, TRANSLATION_ENTRY_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_SCHEMA = {
        name: "BookingTravelPlan",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlan",
        requireOneOf: [],
        fields: [
    schemaField({"name":"days","required":false,"wireName":"days"}, SHARED_FIELD_DEFS.FIELD_88),
    schemaField({"name":"offer_component_links","required":false,"wireName":"offer_component_links"}, SHARED_FIELD_DEFS.FIELD_89)
        ]
      };

      export function validateBookingTravelPlan(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SCHEMA);
      }

      export const TRAVEL_PLAN_ITEM_SEARCH_RESULT_SCHEMA = {
        name: "TravelPlanItemSearchResult",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanItemSearchResult",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_booking_id","required":true,"wireName":"source_booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_booking_name","required":false,"wireName":"source_booking_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_booking_code","required":false,"wireName":"source_booking_code"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":false,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"item_id","required":true,"wireName":"item_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"item_kind","required":false,"wireName":"item_kind"}, SHARED_FIELD_DEFS.FIELD_90),
    schemaField({"name":"title","required":true,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"location","required":false,"wireName":"location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"overnight_location","required":false,"wireName":"overnight_location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"thumbnail_url","required":false,"wireName":"thumbnail_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image_count","required":false,"wireName":"image_count"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"supplier_name","required":false,"wireName":"supplier_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateTravelPlanItemSearchResult(value) {
        return validateShape(value, TRAVEL_PLAN_ITEM_SEARCH_RESULT_SCHEMA);
      }

      export const BOOKING_GENERATE_OFFER_ACCEPTANCE_ROUTE_REQUEST_SCHEMA = {
        name: "BookingGenerateOfferAcceptanceRouteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingGenerateOfferAcceptanceRouteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":true,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_84),
    schemaField({"name":"expires_at","required":false,"wireName":"expires_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"customer_message_snapshot","required":false,"wireName":"customer_message_snapshot"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"deposit_rule","required":false,"wireName":"deposit_rule"}, SHARED_FIELD_DEFS.FIELD_91)
        ]
      };

      export function validateBookingGenerateOfferAcceptanceRouteRequest(value) {
        return validateShape(value, BOOKING_GENERATE_OFFER_ACCEPTANCE_ROUTE_REQUEST_SCHEMA);
      }

      export const OFFER_EXCHANGE_RATE_COMPONENT_SCHEMA = {
        name: "OfferExchangeRateComponent",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.OfferExchangeRateComponent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_28),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"tax_rate_basis_points","required":false,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_17)
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

      export const KEYCLOAK_USER_DIRECTORY_ENTRY_SCHEMA = {
        name: "KeycloakUserDirectoryEntry",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.KeycloakUserDirectoryEntry",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"username","required":false,"wireName":"username"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateKeycloakUserDirectoryEntry(value) {
        return validateShape(value, KEYCLOAK_USER_DIRECTORY_ENTRY_SCHEMA);
      }

      export const TOUR_OPTIONS_SCHEMA = {
        name: "TourOptions",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourOptions",
        requireOneOf: [],
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_10)
        ]
      };

      export function validateTourOptions(value) {
        return validateShape(value, TOUR_OPTIONS_SCHEMA);
      }

      export const BOOKING_OFFER_READ_MODEL_SCHEMA = {
        name: "BookingOfferReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"status","required":false,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"category_rules","required":false,"wireName":"category_rules"}, SHARED_FIELD_DEFS.FIELD_92),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_68),
    schemaField({"name":"discount","required":false,"wireName":"discount"}, SHARED_FIELD_DEFS.FIELD_93),
    schemaField({"name":"totals","required":true,"wireName":"totals"}, SHARED_FIELD_DEFS.FIELD_94),
    schemaField({"name":"quotation_summary","required":false,"wireName":"quotation_summary"}, SHARED_FIELD_DEFS.FIELD_95),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateBookingOfferReadModel(value) {
        return validateShape(value, BOOKING_OFFER_READ_MODEL_SCHEMA);
      }

      export const GENERATED_BOOKING_OFFER_READ_MODEL_SCHEMA = {
        name: "GeneratedBookingOfferReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.GeneratedBookingOfferReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_id","required":true,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"version","required":true,"wireName":"version"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"created_by","required":false,"wireName":"created_by"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_80),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_62),
    schemaField({"name":"pdf_url","required":true,"wireName":"pdf_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"acceptance_route","required":false,"wireName":"acceptance_route"}, SHARED_FIELD_DEFS.FIELD_96),
    schemaField({"name":"public_acceptance_token","required":false,"wireName":"public_acceptance_token"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"public_acceptance_expires_at","required":false,"wireName":"public_acceptance_expires_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"acceptance","required":false,"wireName":"acceptance"}, SHARED_FIELD_DEFS.FIELD_97)
        ]
      };

      export function validateGeneratedBookingOfferReadModel(value) {
        return validateShape(value, GENERATED_BOOKING_OFFER_READ_MODEL_SCHEMA);
      }

      export const TRANSLATION_STATUS_SUMMARY_SCHEMA = {
        name: "TranslationStatusSummary",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TranslationStatusSummary",
        requireOneOf: [],
        fields: [
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"source_lang","required":true,"wireName":"source_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"origin","required":false,"wireName":"origin"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"stale","required":true,"wireName":"stale"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"total_fields","required":true,"wireName":"total_fields"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"translated_fields","required":true,"wireName":"translated_fields"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"missing_fields","required":true,"wireName":"missing_fields"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"has_source_content","required":true,"wireName":"has_source_content"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"has_target_content","required":true,"wireName":"has_target_content"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"source_hash","required":false,"wireName":"source_hash"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTranslationStatusSummary(value) {
        return validateShape(value, TRANSLATION_STATUS_SUMMARY_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_TERM_LINE_READ_MODEL_SCHEMA = {
        name: "BookingOfferPaymentTermLineReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentTermLineReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_98),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sequence","required":true,"wireName":"sequence"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"amount_spec","required":true,"wireName":"amount_spec"}, SHARED_FIELD_DEFS.FIELD_99),
    schemaField({"name":"due_rule","required":true,"wireName":"due_rule"}, SHARED_FIELD_DEFS.FIELD_100),
    schemaField({"name":"description","required":false,"wireName":"description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"resolved_amount_cents","required":true,"wireName":"resolved_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateBookingOfferPaymentTermLineReadModel(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERM_LINE_READ_MODEL_SCHEMA);
      }

      export const PUBLIC_GENERATED_OFFER_DEPOSIT_ACCEPTANCE_RULE_VIEW_SCHEMA = {
        name: "PublicGeneratedOfferDepositAcceptanceRuleView",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PublicGeneratedOfferDepositAcceptanceRuleView",
        requireOneOf: [],
        fields: [
    schemaField({"name":"payment_term_label","required":true,"wireName":"payment_term_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"required_amount_cents","required":true,"wireName":"required_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validatePublicGeneratedOfferDepositAcceptanceRuleView(value) {
        return validateShape(value, PUBLIC_GENERATED_OFFER_DEPOSIT_ACCEPTANCE_RULE_VIEW_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_DAY_SCHEMA = {
        name: "BookingTravelPlanDay",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanDay",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":true,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"date","required":false,"wireName":"date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"title","required":true,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"overnight_location","required":false,"wireName":"overnight_location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_101),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanDay(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_DAY_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_OFFER_COMPONENT_LINK_SCHEMA = {
        name: "BookingTravelPlanOfferComponentLink",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanOfferComponentLink",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_plan_item_id","required":true,"wireName":"travel_plan_item_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"offer_component_id","required":true,"wireName":"offer_component_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"coverage_type","required":true,"wireName":"coverage_type"}, SHARED_FIELD_DEFS.FIELD_102)
        ]
      };

      export function validateBookingTravelPlanOfferComponentLink(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_OFFER_COMPONENT_LINK_SCHEMA);
      }

      export const BOOKING_OFFER_DISCOUNT_SCHEMA = {
        name: "BookingOfferDiscount",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferDiscount",
        requireOneOf: [],
        fields: [
    schemaField({"name":"reason","required":true,"wireName":"reason"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"line_net_amount_cents","required":false,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"line_tax_amount_cents","required":false,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"line_gross_amount_cents","required":false,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73)
        ]
      };

      export function validateBookingOfferDiscount(value) {
        return validateShape(value, BOOKING_OFFER_DISCOUNT_SCHEMA);
      }

      export const BOOKING_OFFER_QUOTATION_SUMMARY_SCHEMA = {
        name: "BookingOfferQuotationSummary",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferQuotationSummary",
        requireOneOf: [],
        fields: [
    schemaField({"name":"tax_included","required":true,"wireName":"tax_included"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"subtotal_net_amount_cents","required":true,"wireName":"subtotal_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"total_tax_amount_cents","required":true,"wireName":"total_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"grand_total_amount_cents","required":true,"wireName":"grand_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"tax_breakdown","required":false,"wireName":"tax_breakdown"}, SHARED_FIELD_DEFS.FIELD_103)
        ]
      };

      export function validateBookingOfferQuotationSummary(value) {
        return validateShape(value, BOOKING_OFFER_QUOTATION_SUMMARY_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_TERMS_SCHEMA = {
        name: "BookingOfferPaymentTerms",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentTerms",
        requireOneOf: [],
        fields: [
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"lines","required":false,"wireName":"lines"}, SHARED_FIELD_DEFS.FIELD_104),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferPaymentTerms(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERMS_SCHEMA);
      }

      export const BOOKING_GENERATE_OFFER_DEPOSIT_ACCEPTANCE_RULE_REQUEST_SCHEMA = {
        name: "BookingGenerateOfferDepositAcceptanceRuleRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingGenerateOfferDepositAcceptanceRuleRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"payment_term_line_id","required":true,"wireName":"payment_term_line_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingGenerateOfferDepositAcceptanceRuleRequest(value) {
        return validateShape(value, BOOKING_GENERATE_OFFER_DEPOSIT_ACCEPTANCE_RULE_REQUEST_SCHEMA);
      }

      export const GENERATED_OFFER_ACCEPTANCE_ROUTE_SCHEMA = {
        name: "GeneratedOfferAcceptanceRoute",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.GeneratedOfferAcceptanceRoute",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":true,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_84),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_85),
    schemaField({"name":"selected_at","required":true,"wireName":"selected_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"selected_by_atp_staff_id","required":true,"wireName":"selected_by_atp_staff_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"expires_at","required":false,"wireName":"expires_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"customer_message_snapshot","required":false,"wireName":"customer_message_snapshot"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"deposit_rule","required":false,"wireName":"deposit_rule"}, SHARED_FIELD_DEFS.FIELD_105)
        ]
      };

      export function validateGeneratedOfferAcceptanceRoute(value) {
        return validateShape(value, GENERATED_OFFER_ACCEPTANCE_ROUTE_SCHEMA);
      }

      export const GENERATED_OFFER_ACCEPTANCE_SCHEMA = {
        name: "GeneratedOfferAcceptance",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.GeneratedOfferAcceptance",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_at","required":true,"wireName":"accepted_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"accepted_by_name","required":false,"wireName":"accepted_by_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_by_email","required":false,"wireName":"accepted_by_email"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"accepted_by_phone","required":false,"wireName":"accepted_by_phone"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_by_person_id","required":false,"wireName":"accepted_by_person_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"language","required":true,"wireName":"language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"method","required":true,"wireName":"method"}, SHARED_FIELD_DEFS.FIELD_87),
    schemaField({"name":"statement_snapshot","required":true,"wireName":"statement_snapshot"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"terms_version","required":false,"wireName":"terms_version"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"terms_snapshot","required":true,"wireName":"terms_snapshot"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"offer_currency","required":true,"wireName":"offer_currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"offer_total_price_cents","required":true,"wireName":"offer_total_price_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"offer_pdf_sha256","required":true,"wireName":"offer_pdf_sha256"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"offer_snapshot_sha256","required":true,"wireName":"offer_snapshot_sha256"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"ip_address","required":false,"wireName":"ip_address"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"user_agent","required":false,"wireName":"user_agent"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"otp_channel","required":false,"wireName":"otp_channel"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"otp_verified_at","required":false,"wireName":"otp_verified_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"deposit_payment_id","required":false,"wireName":"deposit_payment_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_payment_term_line_id","required":false,"wireName":"accepted_payment_term_line_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"accepted_payment_ids","required":false,"wireName":"accepted_payment_ids"}, SHARED_FIELD_DEFS.FIELD_10),
    schemaField({"name":"accepted_amount_cents","required":false,"wireName":"accepted_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"accepted_currency","required":false,"wireName":"accepted_currency"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateGeneratedOfferAcceptance(value) {
        return validateShape(value, GENERATED_OFFER_ACCEPTANCE_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_AMOUNT_SPEC_SCHEMA = {
        name: "BookingOfferPaymentAmountSpec",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentAmountSpec",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":true,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_106),
    schemaField({"name":"fixed_amount_cents","required":false,"wireName":"fixed_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"percentage_basis_points","required":false,"wireName":"percentage_basis_points"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateBookingOfferPaymentAmountSpec(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_AMOUNT_SPEC_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_DUE_RULE_SCHEMA = {
        name: "BookingOfferPaymentDueRule",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentDueRule",
        requireOneOf: [],
        fields: [
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_107),
    schemaField({"name":"fixed_date","required":false,"wireName":"fixed_date"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"days","required":false,"wireName":"days"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateBookingOfferPaymentDueRule(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_DUE_RULE_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_ITEM_SCHEMA = {
        name: "BookingTravelPlanItem",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanItem",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"timing_kind","required":true,"wireName":"timing_kind"}, SHARED_FIELD_DEFS.FIELD_108),
    schemaField({"name":"time_label","required":false,"wireName":"time_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"time_point","required":false,"wireName":"time_point"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_90),
    schemaField({"name":"title","required":true,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"location","required":false,"wireName":"location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"supplier_id","required":false,"wireName":"supplier_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"start_time","required":false,"wireName":"start_time"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"end_time","required":false,"wireName":"end_time"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"financial_coverage_status","required":true,"wireName":"financial_coverage_status"}, SHARED_FIELD_DEFS.FIELD_109),
    schemaField({"name":"financial_note","required":false,"wireName":"financial_note"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"images","required":false,"wireName":"images"}, SHARED_FIELD_DEFS.FIELD_110),
    schemaField({"name":"copied_from","required":false,"wireName":"copied_from"}, SHARED_FIELD_DEFS.FIELD_111)
        ]
      };

      export function validateBookingTravelPlanItem(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_ITEM_SCHEMA);
      }

      export const BOOKING_OFFER_TAX_BUCKET_SCHEMA = {
        name: "BookingOfferTaxBucket",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferTaxBucket",
        requireOneOf: [],
        fields: [
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"net_amount_cents","required":true,"wireName":"net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"tax_amount_cents","required":true,"wireName":"tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"gross_amount_cents","required":true,"wireName":"gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"items_count","required":true,"wireName":"items_count"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateBookingOfferTaxBucket(value) {
        return validateShape(value, BOOKING_OFFER_TAX_BUCKET_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_TERM_LINE_SCHEMA = {
        name: "BookingOfferPaymentTermLine",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentTermLine",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_98),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sequence","required":true,"wireName":"sequence"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"amount_spec","required":true,"wireName":"amount_spec"}, SHARED_FIELD_DEFS.FIELD_99),
    schemaField({"name":"due_rule","required":true,"wireName":"due_rule"}, SHARED_FIELD_DEFS.FIELD_100),
    schemaField({"name":"description","required":false,"wireName":"description"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferPaymentTermLine(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERM_LINE_SCHEMA);
      }

      export const GENERATED_OFFER_DEPOSIT_ACCEPTANCE_RULE_SCHEMA = {
        name: "GeneratedOfferDepositAcceptanceRule",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.GeneratedOfferDepositAcceptanceRule",
        requireOneOf: [],
        fields: [
    schemaField({"name":"payment_term_line_id","required":true,"wireName":"payment_term_line_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_term_label","required":true,"wireName":"payment_term_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"required_amount_cents","required":true,"wireName":"required_amount_cents"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"aggregation_mode","required":true,"wireName":"aggregation_mode"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateGeneratedOfferDepositAcceptanceRule(value) {
        return validateShape(value, GENERATED_OFFER_DEPOSIT_ACCEPTANCE_RULE_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_ITEM_IMAGE_SCHEMA = {
        name: "BookingTravelPlanItemImage",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanItemImage",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"storage_path","required":true,"wireName":"storage_path"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"caption","required":false,"wireName":"caption"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"alt_text","required":false,"wireName":"alt_text"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sort_order","required":true,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"is_primary","required":false,"wireName":"is_primary"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"is_customer_visible","required":false,"wireName":"is_customer_visible"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"width_px","required":false,"wireName":"width_px"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"height_px","required":false,"wireName":"height_px"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"source_attribution","required":false,"wireName":"source_attribution"}, SHARED_FIELD_DEFS.FIELD_112),
    schemaField({"name":"focal_point","required":false,"wireName":"focal_point"}, SHARED_FIELD_DEFS.FIELD_113),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingTravelPlanItemImage(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_ITEM_IMAGE_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_ITEM_COPIED_FROM_SCHEMA = {
        name: "BookingTravelPlanItemCopiedFrom",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanItemCopiedFrom",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_type","required":true,"wireName":"source_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_booking_id","required":true,"wireName":"source_booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_day_id","required":false,"wireName":"source_day_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_item_id","required":true,"wireName":"source_item_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"copied_at","required":true,"wireName":"copied_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"copied_by_atp_staff_id","required":false,"wireName":"copied_by_atp_staff_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanItemCopiedFrom(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_ITEM_COPIED_FROM_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_ITEM_IMAGE_SOURCE_ATTRIBUTION_SCHEMA = {
        name: "BookingTravelPlanItemImageSourceAttribution",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanItemImageSourceAttribution",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_name","required":false,"wireName":"source_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_url","required":false,"wireName":"source_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photographer","required":false,"wireName":"photographer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"license","required":false,"wireName":"license"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanItemImageSourceAttribution(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_ITEM_IMAGE_SOURCE_ATTRIBUTION_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_ITEM_IMAGE_FOCAL_POINT_SCHEMA = {
        name: "BookingTravelPlanItemImageFocalPoint",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanItemImageFocalPoint",
        requireOneOf: [],
        fields: [
    schemaField({"name":"x","required":true,"wireName":"x"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"y","required":true,"wireName":"y"}, SHARED_FIELD_DEFS.FIELD_42)
        ]
      };

      export function validateBookingTravelPlanItemImageFocalPoint(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_ITEM_IMAGE_FOCAL_POINT_SCHEMA);
      }

