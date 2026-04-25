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
    schemaField({"name":"authenticated","required":true,"wireName":"authenticated"}, SHARED_FIELD_DEFS.FIELD_9),
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_currency","required":true,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_usd","required":false,"wireName":"budget_lower_usd"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"budget_upper_usd","required":false,"wireName":"budget_upper_usd"}, SHARED_FIELD_DEFS.FIELD_18),
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
    schemaField({"name":"unchanged","required":false,"wireName":"unchanged"}, SHARED_FIELD_DEFS.FIELD_9)
        ]
      };

      export function validateBookingDetail(value) {
        return validateShape(value, BOOKING_DETAIL_SCHEMA);
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

      export const TOUR_LIST_SCHEMA = {
        name: "TourList",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourList",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"filters","required":false,"wireName":"filters"}, SHARED_FIELD_DEFS.FIELD_51),
    schemaField({"name":"sort","required":false,"wireName":"sort"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"available_destinations","required":false,"wireName":"available_destinations"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"available_styles","required":false,"wireName":"available_styles"}, SHARED_FIELD_DEFS.FIELD_52)
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_53),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"filters","required":false,"wireName":"filters"}, SHARED_FIELD_DEFS.FIELD_54),
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"deleted","required":true,"wireName":"deleted"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"booking_id","required":true,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingDeleteResponse(value) {
        return validateShape(value, BOOKING_DELETE_RESPONSE_SCHEMA);
      }

      export const BOOKING_CLONE_REQUEST_SCHEMA = {
        name: "BookingCloneRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingCloneRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"include_travelers","required":false,"wireName":"include_travelers"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingCloneRequest(value) {
        return validateShape(value, BOOKING_CLONE_REQUEST_SCHEMA);
      }

      export const BOOKING_CHAT_RESPONSE_SCHEMA = {
        name: "BookingChatResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingChatResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":false,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_55),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"conversations","required":false,"wireName":"conversations"}, SHARED_FIELD_DEFS.FIELD_56),
    schemaField({"name":"conversation_total","required":true,"wireName":"conversation_total"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"customer_language","required":true,"wireName":"customer_language"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingCustomerLanguageUpdateRequest(value) {
        return validateShape(value, BOOKING_CUSTOMER_LANGUAGE_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_SOURCE_UPDATE_REQUEST_SCHEMA = {
        name: "BookingSourceUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingSourceUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"source_channel","required":true,"wireName":"source_channel"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"referral_kind","required":true,"wireName":"referral_kind"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"referral_label","required":false,"wireName":"referral_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referral_staff_user_id","required":false,"wireName":"referral_staff_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingSourceUpdateRequest(value) {
        return validateShape(value, BOOKING_SOURCE_UPDATE_REQUEST_SCHEMA);
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingImageUploadRequest(value) {
        return validateShape(value, BOOKING_IMAGE_UPLOAD_REQUEST_SCHEMA);
      }

      export const BOOKING_OWNER_UPDATE_REQUEST_SCHEMA = {
        name: "BookingOwnerUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOwnerUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
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
    schemaField({"name":"entries","required":false,"wireName":"entries"}, SHARED_FIELD_DEFS.FIELD_57)
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
    schemaField({"name":"entries","required":false,"wireName":"entries"}, SHARED_FIELD_DEFS.FIELD_57)
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
    schemaField({"name":"expected_persons_revision","required":false,"wireName":"expected_persons_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"person","required":true,"wireName":"person"}, SHARED_FIELD_DEFS.FIELD_58),
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
    schemaField({"name":"expected_persons_revision","required":false,"wireName":"expected_persons_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"person","required":true,"wireName":"person"}, SHARED_FIELD_DEFS.FIELD_58),
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
    schemaField({"name":"expected_persons_revision","required":false,"wireName":"expected_persons_revision"}, SHARED_FIELD_DEFS.FIELD_18),
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
    schemaField({"name":"expected_notes_revision","required":false,"wireName":"expected_notes_revision"}, SHARED_FIELD_DEFS.FIELD_18),
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
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_plan","required":true,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_59),
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
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"source_lang","required":true,"wireName":"source_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"target_lang","required":true,"wireName":"target_lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanTranslateRequest(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_TRANSLATE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_SEARCH_RESPONSE_SCHEMA = {
        name: "TravelPlanServiceSearchResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceSearchResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_60),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateTravelPlanServiceSearchResponse(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_SEARCH_RESPONSE_SCHEMA);
      }

      export const STANDARD_TOUR_LIST_RESPONSE_SCHEMA = {
        name: "StandardTourListResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.StandardTourListResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_61),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateStandardTourListResponse(value) {
        return validateShape(value, STANDARD_TOUR_LIST_RESPONSE_SCHEMA);
      }

      export const STANDARD_TOUR_UPSERT_REQUEST_SCHEMA = {
        name: "StandardTourUpsertRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.StandardTourUpsertRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_59),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateStandardTourUpsertRequest(value) {
        return validateShape(value, STANDARD_TOUR_UPSERT_REQUEST_SCHEMA);
      }

      export const STANDARD_TOUR_RESPONSE_SCHEMA = {
        name: "StandardTourResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.StandardTourResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"standard_tour","required":true,"wireName":"standard_tour"}, SHARED_FIELD_DEFS.FIELD_62)
        ]
      };

      export function validateStandardTourResponse(value) {
        return validateShape(value, STANDARD_TOUR_RESPONSE_SCHEMA);
      }

      export const BOOKING_STANDARD_TOUR_APPLY_REQUEST_SCHEMA = {
        name: "BookingStandardTourApplyRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingStandardTourApplyRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingStandardTourApplyRequest(value) {
        return validateShape(value, BOOKING_STANDARD_TOUR_APPLY_REQUEST_SCHEMA);
      }

      export const BOOKING_TOUR_APPLY_REQUEST_SCHEMA = {
        name: "BookingTourApplyRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTourApplyRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTourApplyRequest(value) {
        return validateShape(value, BOOKING_TOUR_APPLY_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_IMPORT_REQUEST_SCHEMA = {
        name: "TravelPlanServiceImportRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceImportRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"source_booking_id","required":true,"wireName":"source_booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_service_id","required":true,"wireName":"source_service_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"insert_after_service_id","required":false,"wireName":"insert_after_service_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"include_images","required":true,"wireName":"include_images"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"include_customer_visible_images_only","required":true,"wireName":"include_customer_visible_images_only"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"include_notes","required":true,"wireName":"include_notes"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"include_translations","required":true,"wireName":"include_translations"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanServiceImportRequest(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_IMPORT_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_IMAGE_UPLOAD_REQUEST_SCHEMA = {
        name: "TravelPlanServiceImageUploadRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceImageUploadRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanServiceImageUploadRequest(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_IMAGE_UPLOAD_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_IMAGE_DELETE_REQUEST_SCHEMA = {
        name: "TravelPlanServiceImageDeleteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceImageDeleteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanServiceImageDeleteRequest(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_IMAGE_DELETE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_ATTACHMENT_UPLOAD_REQUEST_SCHEMA = {
        name: "TravelPlanAttachmentUploadRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanAttachmentUploadRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanAttachmentUploadRequest(value) {
        return validateShape(value, TRAVEL_PLAN_ATTACHMENT_UPLOAD_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_ATTACHMENT_DELETE_REQUEST_SCHEMA = {
        name: "TravelPlanAttachmentDeleteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanAttachmentDeleteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanAttachmentDeleteRequest(value) {
        return validateShape(value, TRAVEL_PLAN_ATTACHMENT_DELETE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_PDF_ARTIFACT_CREATE_REQUEST_SCHEMA = {
        name: "TravelPlanPdfArtifactCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanPdfArtifactCreateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"lang","required":false,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"filename_suffix","required":false,"wireName":"filename_suffix"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanPdfArtifactCreateRequest(value) {
        return validateShape(value, TRAVEL_PLAN_PDF_ARTIFACT_CREATE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_PDF_ARTIFACT_CREATE_RESPONSE_SCHEMA = {
        name: "TravelPlanPdfArtifactCreateResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanPdfArtifactCreateResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"artifact","required":true,"wireName":"artifact"}, SHARED_FIELD_DEFS.FIELD_63)
        ]
      };

      export function validateTravelPlanPdfArtifactCreateResponse(value) {
        return validateShape(value, TRAVEL_PLAN_PDF_ARTIFACT_CREATE_RESPONSE_SCHEMA);
      }

      export const TRAVEL_PLAN_PDF_ARTIFACT_UPDATE_REQUEST_SCHEMA = {
        name: "TravelPlanPdfArtifactUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanPdfArtifactUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"sent_to_customer","required":false,"wireName":"sent_to_customer"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanPdfArtifactUpdateRequest(value) {
        return validateShape(value, TRAVEL_PLAN_PDF_ARTIFACT_UPDATE_REQUEST_SCHEMA);
      }

      export const TRAVEL_PLAN_PDF_ARTIFACT_DELETE_REQUEST_SCHEMA = {
        name: "TravelPlanPdfArtifactDeleteRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanPdfArtifactDeleteRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_travel_plan_revision","required":false,"wireName":"expected_travel_plan_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanPdfArtifactDeleteRequest(value) {
        return validateShape(value, TRAVEL_PLAN_PDF_ARTIFACT_DELETE_REQUEST_SCHEMA);
      }

      export const BOOKING_OFFER_UPDATE_REQUEST_SCHEMA = {
        name: "BookingOfferUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_offer_revision","required":false,"wireName":"expected_offer_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_64),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferUpdateRequest(value) {
        return validateShape(value, BOOKING_OFFER_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_GENERATE_OFFER_REQUEST_SCHEMA = {
        name: "BookingGenerateOfferRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingGenerateOfferRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_offer_revision","required":false,"wireName":"expected_offer_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
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
    schemaField({"name":"from_currency","required":true,"wireName":"from_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"to_currency","required":true,"wireName":"to_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"lines","required":false,"wireName":"lines"}, SHARED_FIELD_DEFS.FIELD_65)
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
    schemaField({"name":"exchange_rate","required":true,"wireName":"exchange_rate"}, SHARED_FIELD_DEFS.FIELD_66),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"converted_lines","required":false,"wireName":"converted_lines"}, SHARED_FIELD_DEFS.FIELD_67),
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_68),
    schemaField({"name":"activities","required":false,"wireName":"activities"}, SHARED_FIELD_DEFS.FIELD_68),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"expected_core_revision","required":false,"wireName":"expected_core_revision"}, SHARED_FIELD_DEFS.FIELD_18),
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
    schemaField({"name":"activity","required":true,"wireName":"activity"}, SHARED_FIELD_DEFS.FIELD_69),
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_48)
        ]
      };

      export function validateBookingActivityResponse(value) {
        return validateShape(value, BOOKING_ACTIVITY_RESPONSE_SCHEMA);
      }

      export const BOOKING_PAYMENT_DOCUMENTS_RESPONSE_SCHEMA = {
        name: "BookingPaymentDocumentsResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPaymentDocumentsResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_70),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingPaymentDocumentsResponse(value) {
        return validateShape(value, BOOKING_PAYMENT_DOCUMENTS_RESPONSE_SCHEMA);
      }

      export const BOOKING_PAYMENT_DOCUMENT_CREATE_REQUEST_SCHEMA = {
        name: "BookingPaymentDocumentCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPaymentDocumentCreateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"expected_payment_documents_revision","required":false,"wireName":"expected_payment_documents_revision"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"document_kind","required":false,"wireName":"document_kind"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_id","required":false,"wireName":"payment_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_received_at","required":false,"wireName":"payment_received_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"payment_confirmed_by_atp_staff_id","required":false,"wireName":"payment_confirmed_by_atp_staff_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_reference","required":false,"wireName":"payment_reference"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_confirmed_by_label","required":false,"wireName":"payment_confirmed_by_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pdf_personalization","required":false,"wireName":"pdf_personalization"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPaymentDocumentCreateRequest(value) {
        return validateShape(value, BOOKING_PAYMENT_DOCUMENT_CREATE_REQUEST_SCHEMA);
      }

      export const BOOKING_PAYMENT_DOCUMENT_RESPONSE_SCHEMA = {
        name: "BookingPaymentDocumentResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPaymentDocumentResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"document","required":true,"wireName":"document"}, SHARED_FIELD_DEFS.FIELD_71),
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_48),
    schemaField({"name":"unchanged","required":false,"wireName":"unchanged"}, SHARED_FIELD_DEFS.FIELD_9)
        ]
      };

      export function validateBookingPaymentDocumentResponse(value) {
        return validateShape(value, BOOKING_PAYMENT_DOCUMENT_RESPONSE_SCHEMA);
      }

      export const KEYCLOAK_USER_LIST_RESPONSE_SCHEMA = {
        name: "KeycloakUserListResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.KeycloakUserListResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_72),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateKeycloakUserListResponse(value) {
        return validateShape(value, KEYCLOAK_USER_LIST_RESPONSE_SCHEMA);
      }

      export const SETTINGS_OBSERVABILITY_RESPONSE_SCHEMA = {
        name: "SettingsObservabilityResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.SettingsObservabilityResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"logged_in_users","required":false,"wireName":"logged_in_users"}, SHARED_FIELD_DEFS.FIELD_73),
    schemaField({"name":"session_count","required":true,"wireName":"session_count"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"user_count","required":true,"wireName":"user_count"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"latest_changed_booking","required":false,"wireName":"latest_changed_booking"}, SHARED_FIELD_DEFS.FIELD_74)
        ]
      };

      export function validateSettingsObservabilityResponse(value) {
        return validateShape(value, SETTINGS_OBSERVABILITY_RESPONSE_SCHEMA);
      }

      export const ATP_STAFF_PROFILE_UPDATE_REQUEST_SCHEMA = {
        name: "AtpStaffProfileUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffProfileUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"languages","required":false,"wireName":"languages"}, SHARED_FIELD_DEFS.FIELD_75),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"friendly_short_name","required":false,"wireName":"friendly_short_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"team_order","required":false,"wireName":"team_order"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateAtpStaffProfileUpdateRequest(value) {
        return validateShape(value, ATP_STAFF_PROFILE_UPDATE_REQUEST_SCHEMA);
      }

      export const ATP_STAFF_PHOTO_UPLOAD_REQUEST_SCHEMA = {
        name: "AtpStaffPhotoUploadRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffPhotoUploadRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateAtpStaffPhotoUploadRequest(value) {
        return validateShape(value, ATP_STAFF_PHOTO_UPLOAD_REQUEST_SCHEMA);
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_76),
    schemaField({"name":"priority","required":false,"wireName":"priority"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"seasonality_start_month","required":false,"wireName":"seasonality_start_month"}, SHARED_FIELD_DEFS.FIELD_41),
    schemaField({"name":"seasonality_end_month","required":false,"wireName":"seasonality_end_month"}, SHARED_FIELD_DEFS.FIELD_41),
    schemaField({"name":"short_description","required":false,"wireName":"short_description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pictures","required":false,"wireName":"pictures"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"image","required":false,"wireName":"image"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_77)
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
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_78)
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
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_78),
    schemaField({"name":"options","required":true,"wireName":"options"}, SHARED_FIELD_DEFS.FIELD_79)
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
    schemaField({"name":"entries","required":false,"wireName":"entries"}, SHARED_FIELD_DEFS.FIELD_57)
        ]
      };

      export function validateTourTranslateFieldsRequest(value) {
        return validateShape(value, TOUR_TRANSLATE_FIELDS_REQUEST_SCHEMA);
      }

      export const TOUR_TRAVEL_PLAN_UPDATE_REQUEST_SCHEMA = {
        name: "TourTravelPlanUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourTravelPlanUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"travel_plan","required":true,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_77),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTourTravelPlanUpdateRequest(value) {
        return validateShape(value, TOUR_TRAVEL_PLAN_UPDATE_REQUEST_SCHEMA);
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
    schemaField({"name":"force_update","required":true,"wireName":"force_update"}, SHARED_FIELD_DEFS.FIELD_9)
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
    schemaField({"name":"bookings","required":true,"wireName":"bookings"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"tours","required":true,"wireName":"tours"}, SHARED_FIELD_DEFS.FIELD_9)
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
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"preferred_username","required":false,"wireName":"preferred_username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_7)
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
    schemaField({"name":"assigned_keycloak_user_id","required":false,"wireName":"assigned_keycloak_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_channel","required":false,"wireName":"source_channel"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"referral_kind","required":false,"wireName":"referral_kind"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"referral_label","required":false,"wireName":"referral_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referral_staff_user_id","required":false,"wireName":"referral_staff_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"assigned_keycloak_user_label","required":false,"wireName":"assigned_keycloak_user_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"assigned_atp_staff","required":false,"wireName":"assigned_atp_staff"}, SHARED_FIELD_DEFS.FIELD_80),
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
    schemaField({"name":"persons","required":false,"wireName":"persons"}, SHARED_FIELD_DEFS.FIELD_81),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_59),
    schemaField({"name":"web_form_submission","required":false,"wireName":"web_form_submission"}, SHARED_FIELD_DEFS.FIELD_82),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_83),
    schemaField({"name":"travel_plan_pdfs","required":false,"wireName":"travel_plan_pdfs"}, SHARED_FIELD_DEFS.FIELD_84),
    schemaField({"name":"generated_offers","required":false,"wireName":"generated_offers"}, SHARED_FIELD_DEFS.FIELD_85),
    schemaField({"name":"travel_plan_translation_status","required":true,"wireName":"travel_plan_translation_status"}, SHARED_FIELD_DEFS.FIELD_86),
    schemaField({"name":"generated_offer_email_enabled","required":true,"wireName":"generated_offer_email_enabled"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"translation_enabled","required":true,"wireName":"translation_enabled"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":true,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingReadModel(value) {
        return validateShape(value, BOOKING_READ_MODEL_SCHEMA);
      }

      export const PAGINATION_SCHEMA = {
        name: "Pagination",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.Pagination",
        requireOneOf: [],
        fields: [
    schemaField({"name":"page","required":true,"wireName":"page"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"page_size","required":true,"wireName":"page_size"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"total_items","required":true,"wireName":"total_items"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"total_pages","required":true,"wireName":"total_pages"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"destination","required":false,"wireName":"destination"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"style","required":false,"wireName":"style"}, SHARED_FIELD_DEFS.FIELD_87),
    schemaField({"name":"search","required":false,"wireName":"search"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTourListFilters(value) {
        return validateShape(value, TOUR_LIST_FILTERS_SCHEMA);
      }

      export const CATALOG_OPTION_SCHEMA = {
        name: "CatalogOption",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CatalogOption",
        requireOneOf: [],
        fields: [
    schemaField({"name":"code","required":true,"wireName":"code"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateCatalogOption(value) {
        return validateShape(value, CATALOG_OPTION_SCHEMA);
      }

      export const BOOKING_LIST_FILTERS_SCHEMA = {
        name: "BookingListFilters",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingListFilters",
        requireOneOf: [],
        fields: [
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"days","required":false,"wireName":"days"}, SHARED_FIELD_DEFS.FIELD_88),
    schemaField({"name":"attachments","required":false,"wireName":"attachments"}, SHARED_FIELD_DEFS.FIELD_89)
        ]
      };

      export function validateBookingTravelPlan(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_SEARCH_RESULT_SCHEMA = {
        name: "TravelPlanServiceSearchResult",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceSearchResult",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_booking_id","required":true,"wireName":"source_booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_booking_name","required":false,"wireName":"source_booking_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_booking_code","required":false,"wireName":"source_booking_code"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":false,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"service_id","required":true,"wireName":"service_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"service_kind","required":false,"wireName":"service_kind"}, SHARED_FIELD_DEFS.FIELD_90),
    schemaField({"name":"title","required":true,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"location","required":false,"wireName":"location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"overnight_location","required":false,"wireName":"overnight_location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"thumbnail_url","required":false,"wireName":"thumbnail_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image_count","required":false,"wireName":"image_count"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateTravelPlanServiceSearchResult(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_SEARCH_RESULT_SCHEMA);
      }

      export const STANDARD_TOUR_READ_MODEL_SCHEMA = {
        name: "StandardTourReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.StandardTourReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":true,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17),
    schemaField({"name":"travel_plan","required":true,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_59)
        ]
      };

      export function validateStandardTourReadModel(value) {
        return validateShape(value, STANDARD_TOUR_READ_MODEL_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_PDF_READ_MODEL_SCHEMA = {
        name: "BookingTravelPlanPdfReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanPdfReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"page_count","required":true,"wireName":"page_count"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"sent_to_customer","required":true,"wireName":"sent_to_customer"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pdf_url","required":true,"wireName":"pdf_url"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanPdfReadModel(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_PDF_READ_MODEL_SCHEMA);
      }

      export const OFFER_EXCHANGE_RATE_LINE_SCHEMA = {
        name: "OfferExchangeRateLine",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.OfferExchangeRateLine",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"category","required":true,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"tax_rate_basis_points","required":false,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateOfferExchangeRateLine(value) {
        return validateShape(value, OFFER_EXCHANGE_RATE_LINE_SCHEMA);
      }

      export const BOOKING_OFFER_ADDITIONAL_ITEM_SCHEMA = {
        name: "BookingOfferAdditionalItem",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferAdditionalItem",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":false,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"unit_tax_amount_cents","required":false,"wireName":"unit_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"unit_total_amount_cents","required":false,"wireName":"unit_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"category","required":false,"wireName":"category"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"line_net_amount_cents","required":false,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_tax_amount_cents","required":false,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_gross_amount_cents","required":false,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_total_amount_cents","required":false,"wireName":"line_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sort_order","required":false,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingOfferAdditionalItem(value) {
        return validateShape(value, BOOKING_OFFER_ADDITIONAL_ITEM_SCHEMA);
      }

      export const BOOKING_PAYMENT_DOCUMENT_SCHEMA = {
        name: "BookingPaymentDocument",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPaymentDocument",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"booking_id","required":false,"wireName":"booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_number","required":false,"wireName":"document_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"version","required":false,"wireName":"version"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"status","required":false,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"document_kind","required":false,"wireName":"document_kind"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_id","required":false,"wireName":"payment_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_term_line_id","required":false,"wireName":"payment_term_line_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_kind","required":false,"wireName":"payment_kind"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_label","required":false,"wireName":"payment_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"issue_date","required":false,"wireName":"issue_date"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"subtitle","required":false,"wireName":"subtitle"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"intro","required":false,"wireName":"intro"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"components","required":false,"wireName":"components"}, SHARED_FIELD_DEFS.FIELD_92),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"closing","required":false,"wireName":"closing"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_received_at","required":false,"wireName":"payment_received_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"payment_confirmed_by_atp_staff_id","required":false,"wireName":"payment_confirmed_by_atp_staff_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_confirmed_by_label","required":false,"wireName":"payment_confirmed_by_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"payment_reference","required":false,"wireName":"payment_reference"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"total_amount_cents","required":false,"wireName":"total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"due_amount_cents","required":false,"wireName":"due_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"pdf_url","required":false,"wireName":"pdf_url"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingPaymentDocument(value) {
        return validateShape(value, BOOKING_PAYMENT_DOCUMENT_SCHEMA);
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
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"username","required":false,"wireName":"username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"realm_roles","required":false,"wireName":"realm_roles"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"client_roles","required":false,"wireName":"client_roles"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"staff_profile","required":false,"wireName":"staff_profile"}, SHARED_FIELD_DEFS.FIELD_80)
        ]
      };

      export function validateKeycloakUserDirectoryEntry(value) {
        return validateShape(value, KEYCLOAK_USER_DIRECTORY_ENTRY_SCHEMA);
      }

      export const SETTINGS_OBSERVABILITY_LOGGED_IN_USER_SCHEMA = {
        name: "SettingsObservabilityLoggedInUser",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.SettingsObservabilityLoggedInUser",
        requireOneOf: [],
        fields: [
    schemaField({"name":"sub","required":false,"wireName":"sub"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"preferred_username","required":false,"wireName":"preferred_username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"roles","required":false,"wireName":"roles"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"session_count","required":true,"wireName":"session_count"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"latest_login_at","required":false,"wireName":"latest_login_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"latest_expires_at","required":false,"wireName":"latest_expires_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateSettingsObservabilityLoggedInUser(value) {
        return validateShape(value, SETTINGS_OBSERVABILITY_LOGGED_IN_USER_SCHEMA);
      }

      export const SETTINGS_OBSERVABILITY_LATEST_CHANGED_BOOKING_SCHEMA = {
        name: "SettingsObservabilityLatestChangedBooking",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.SettingsObservabilityLatestChangedBooking",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"updated_at","required":false,"wireName":"updated_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"assigned_keycloak_user_id","required":false,"wireName":"assigned_keycloak_user_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"last_activity","required":false,"wireName":"last_activity"}, SHARED_FIELD_DEFS.FIELD_93)
        ]
      };

      export function validateSettingsObservabilityLatestChangedBooking(value) {
        return validateShape(value, SETTINGS_OBSERVABILITY_LATEST_CHANGED_BOOKING_SCHEMA);
      }

      export const TRAVEL_PLAN_SCHEMA = {
        name: "TravelPlan",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlan",
        requireOneOf: [],
        fields: [
    schemaField({"name":"days","required":false,"wireName":"days"}, SHARED_FIELD_DEFS.FIELD_94)
        ]
      };

      export function validateTravelPlan(value) {
        return validateShape(value, TRAVEL_PLAN_SCHEMA);
      }

      export const TOUR_OPTIONS_SCHEMA = {
        name: "TourOptions",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourOptions",
        requireOneOf: [],
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_52)
        ]
      };

      export function validateTourOptions(value) {
        return validateShape(value, TOUR_OPTIONS_SCHEMA);
      }

      export const ATP_STAFF_PROFILE_SCHEMA = {
        name: "AtpStaffProfile",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffProfile",
        requireOneOf: [],
        fields: [
    schemaField({"name":"username","required":true,"wireName":"username"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"friendly_short_name","required":false,"wireName":"friendly_short_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"team_order","required":false,"wireName":"team_order"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"picture_ref","required":false,"wireName":"picture_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"languages","required":false,"wireName":"languages"}, SHARED_FIELD_DEFS.FIELD_75),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_17)
        ]
      };

      export function validateAtpStaffProfile(value) {
        return validateShape(value, ATP_STAFF_PROFILE_SCHEMA);
      }

      export const BOOKING_OFFER_READ_MODEL_SCHEMA = {
        name: "BookingOfferReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"status","required":false,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"offer_detail_level_internal","required":true,"wireName":"offer_detail_level_internal"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"offer_detail_level_visible","required":true,"wireName":"offer_detail_level_visible"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"category_rules","required":false,"wireName":"category_rules"}, SHARED_FIELD_DEFS.FIELD_95),
    schemaField({"name":"trip_price_internal","required":false,"wireName":"trip_price_internal"}, SHARED_FIELD_DEFS.FIELD_96),
    schemaField({"name":"days_internal","required":false,"wireName":"days_internal"}, SHARED_FIELD_DEFS.FIELD_97),
    schemaField({"name":"additional_items","required":false,"wireName":"additional_items"}, SHARED_FIELD_DEFS.FIELD_67),
    schemaField({"name":"discount","required":false,"wireName":"discount"}, SHARED_FIELD_DEFS.FIELD_98),
    schemaField({"name":"totals","required":true,"wireName":"totals"}, SHARED_FIELD_DEFS.FIELD_99),
    schemaField({"name":"quotation_summary","required":false,"wireName":"quotation_summary"}, SHARED_FIELD_DEFS.FIELD_100),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_101),
    schemaField({"name":"visible_pricing","required":true,"wireName":"visible_pricing"}, SHARED_FIELD_DEFS.FIELD_102),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"version","required":true,"wireName":"version"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"lang","required":true,"wireName":"lang"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"comment","required":false,"wireName":"comment"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":true,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"created_by","required":false,"wireName":"created_by"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"total_price_cents","required":true,"wireName":"total_price_cents"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"payment_terms","required":false,"wireName":"payment_terms"}, SHARED_FIELD_DEFS.FIELD_101),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_83),
    schemaField({"name":"travel_plan","required":false,"wireName":"travel_plan"}, SHARED_FIELD_DEFS.FIELD_59),
    schemaField({"name":"pdf_url","required":true,"wireName":"pdf_url"}, SHARED_FIELD_DEFS.FIELD_1)
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
    schemaField({"name":"stale","required":true,"wireName":"stale"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"total_fields","required":true,"wireName":"total_fields"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"translated_fields","required":true,"wireName":"translated_fields"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"missing_fields","required":true,"wireName":"missing_fields"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"has_source_content","required":true,"wireName":"has_source_content"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"has_target_content","required":true,"wireName":"has_target_content"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"source_hash","required":false,"wireName":"source_hash"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTranslationStatusSummary(value) {
        return validateShape(value, TRANSLATION_STATUS_SUMMARY_SCHEMA);
      }

      export const TOUR_VIDEO_SCHEMA = {
        name: "TourVideo",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourVideo",
        requireOneOf: [],
        fields: [
    schemaField({"name":"storage_path","required":false,"wireName":"storage_path"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTourVideo(value) {
        return validateShape(value, TOUR_VIDEO_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_DAY_SCHEMA = {
        name: "BookingTravelPlanDay",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanDay",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":true,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"date","required":false,"wireName":"date"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"date_string","required":false,"wireName":"date_string"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"overnight_location","required":false,"wireName":"overnight_location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"services","required":false,"wireName":"services"}, SHARED_FIELD_DEFS.FIELD_103),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanDay(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_DAY_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_ATTACHMENT_SCHEMA = {
        name: "BookingTravelPlanAttachment",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanAttachment",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"storage_path","required":true,"wireName":"storage_path"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"page_count","required":true,"wireName":"page_count"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"sort_order","required":true,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingTravelPlanAttachment(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_ATTACHMENT_SCHEMA);
      }

      export const BOOKING_OFFER_TRIP_PRICE_INTERNAL_SCHEMA = {
        name: "BookingOfferTripPriceInternal",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferTripPriceInternal",
        requireOneOf: [],
        fields: [
    schemaField({"name":"label","required":false,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_net_amount_cents","required":false,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_tax_amount_cents","required":false,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_gross_amount_cents","required":false,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_total_amount_cents","required":false,"wireName":"line_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingOfferTripPriceInternal(value) {
        return validateShape(value, BOOKING_OFFER_TRIP_PRICE_INTERNAL_SCHEMA);
      }

      export const BOOKING_OFFER_DAY_PRICE_INTERNAL_SCHEMA = {
        name: "BookingOfferDayPriceInternal",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferDayPriceInternal",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":true,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"label","required":false,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sort_order","required":false,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"line_net_amount_cents","required":false,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_tax_amount_cents","required":false,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_gross_amount_cents","required":false,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_total_amount_cents","required":false,"wireName":"line_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingOfferDayPriceInternal(value) {
        return validateShape(value, BOOKING_OFFER_DAY_PRICE_INTERNAL_SCHEMA);
      }

      export const BOOKING_OFFER_DISCOUNT_SCHEMA = {
        name: "BookingOfferDiscount",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferDiscount",
        requireOneOf: [],
        fields: [
    schemaField({"name":"reason","required":true,"wireName":"reason"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"line_net_amount_cents","required":false,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"line_tax_amount_cents","required":false,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"line_gross_amount_cents","required":false,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91)
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
    schemaField({"name":"tax_included","required":true,"wireName":"tax_included"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"subtotal_net_amount_cents","required":true,"wireName":"subtotal_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"total_tax_amount_cents","required":true,"wireName":"total_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"grand_total_amount_cents","required":true,"wireName":"grand_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"tax_breakdown","required":false,"wireName":"tax_breakdown"}, SHARED_FIELD_DEFS.FIELD_104)
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
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"lines","required":false,"wireName":"lines"}, SHARED_FIELD_DEFS.FIELD_105)
        ]
      };

      export function validateBookingOfferPaymentTerms(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERMS_SCHEMA);
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

      export const PAYMENT_DOCUMENT_COMPONENT_SCHEMA = {
        name: "PaymentDocumentComponent",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.PaymentDocumentComponent",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":false,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"description","required":true,"wireName":"description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"quantity","required":true,"wireName":"quantity"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"unit_amount_cents","required":true,"wireName":"unit_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"total_amount_cents","required":false,"wireName":"total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91)
        ]
      };

      export function validatePaymentDocumentComponent(value) {
        return validateShape(value, PAYMENT_DOCUMENT_COMPONENT_SCHEMA);
      }

      export const SETTINGS_OBSERVABILITY_BOOKING_ACTIVITY_SCHEMA = {
        name: "SettingsObservabilityBookingActivity",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.SettingsObservabilityBookingActivity",
        requireOneOf: [],
        fields: [
    schemaField({"name":"type","required":false,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"actor","required":false,"wireName":"actor"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"detail","required":false,"wireName":"detail"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateSettingsObservabilityBookingActivity(value) {
        return validateShape(value, SETTINGS_OBSERVABILITY_BOOKING_ACTIVITY_SCHEMA);
      }

      export const TRAVEL_PLAN_DAY_SCHEMA = {
        name: "TravelPlanDay",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanDay",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"day_number","required":true,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"overnight_location","required":false,"wireName":"overnight_location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"services","required":false,"wireName":"services"}, SHARED_FIELD_DEFS.FIELD_106),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanDay(value) {
        return validateShape(value, TRAVEL_PLAN_DAY_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_TERMS_READ_MODEL_SCHEMA = {
        name: "BookingOfferPaymentTermsReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentTermsReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"lines","required":false,"wireName":"lines"}, SHARED_FIELD_DEFS.FIELD_107),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"basis_total_amount_cents","required":true,"wireName":"basis_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"scheduled_total_amount_cents","required":true,"wireName":"scheduled_total_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingOfferPaymentTermsReadModel(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERMS_READ_MODEL_SCHEMA);
      }

      export const BOOKING_OFFER_VISIBLE_PRICING_READ_MODEL_SCHEMA = {
        name: "BookingOfferVisiblePricingReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferVisiblePricingReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"detail_level","required":true,"wireName":"detail_level"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"derivable","required":true,"wireName":"derivable"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"trip_price","required":false,"wireName":"trip_price"}, SHARED_FIELD_DEFS.FIELD_108),
    schemaField({"name":"days","required":false,"wireName":"days"}, SHARED_FIELD_DEFS.FIELD_109),
    schemaField({"name":"additional_items","required":false,"wireName":"additional_items"}, SHARED_FIELD_DEFS.FIELD_67)
        ]
      };

      export function validateBookingOfferVisiblePricingReadModel(value) {
        return validateShape(value, BOOKING_OFFER_VISIBLE_PRICING_READ_MODEL_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_SERVICE_SCHEMA = {
        name: "BookingTravelPlanService",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanService",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"timing_kind","required":true,"wireName":"timing_kind"}, SHARED_FIELD_DEFS.FIELD_110),
    schemaField({"name":"time_label","required":false,"wireName":"time_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"time_point","required":false,"wireName":"time_point"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_90),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"details","required":false,"wireName":"details"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image_subtitle","required":false,"wireName":"image_subtitle"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image_subtitle_i18n","required":false,"wireName":"image_subtitle_i18n"}, SHARED_FIELD_DEFS.FIELD_111),
    schemaField({"name":"location","required":false,"wireName":"location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"start_time","required":false,"wireName":"start_time"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"end_time","required":false,"wireName":"end_time"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image","required":false,"wireName":"image"}, SHARED_FIELD_DEFS.FIELD_112),
    schemaField({"name":"copied_from","required":false,"wireName":"copied_from"}, SHARED_FIELD_DEFS.FIELD_113)
        ]
      };

      export function validateBookingTravelPlanService(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SERVICE_SCHEMA);
      }

      export const BOOKING_OFFER_TAX_BUCKET_SCHEMA = {
        name: "BookingOfferTaxBucket",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferTaxBucket",
        requireOneOf: [],
        fields: [
    schemaField({"name":"tax_rate_basis_points","required":true,"wireName":"tax_rate_basis_points"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"net_amount_cents","required":true,"wireName":"net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"tax_amount_cents","required":true,"wireName":"tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"gross_amount_cents","required":true,"wireName":"gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_91),
    schemaField({"name":"items_count","required":true,"wireName":"items_count"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_114),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sequence","required":true,"wireName":"sequence"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"amount_spec","required":true,"wireName":"amount_spec"}, SHARED_FIELD_DEFS.FIELD_115),
    schemaField({"name":"due_rule","required":true,"wireName":"due_rule"}, SHARED_FIELD_DEFS.FIELD_116)
        ]
      };

      export function validateBookingOfferPaymentTermLine(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERM_LINE_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_SCHEMA = {
        name: "TravelPlanService",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanService",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"timing_kind","required":true,"wireName":"timing_kind"}, SHARED_FIELD_DEFS.FIELD_110),
    schemaField({"name":"time_label","required":false,"wireName":"time_label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"time_point","required":false,"wireName":"time_point"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_90),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image_subtitle","required":false,"wireName":"image_subtitle"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image_subtitle_i18n","required":false,"wireName":"image_subtitle_i18n"}, SHARED_FIELD_DEFS.FIELD_111),
    schemaField({"name":"location","required":false,"wireName":"location"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"start_time","required":false,"wireName":"start_time"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"end_time","required":false,"wireName":"end_time"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"image","required":false,"wireName":"image"}, SHARED_FIELD_DEFS.FIELD_117)
        ]
      };

      export function validateTravelPlanService(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_TERM_LINE_READ_MODEL_SCHEMA = {
        name: "BookingOfferPaymentTermLineReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentTermLineReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"kind","required":true,"wireName":"kind"}, SHARED_FIELD_DEFS.FIELD_114),
    schemaField({"name":"label","required":true,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sequence","required":true,"wireName":"sequence"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"amount_spec","required":true,"wireName":"amount_spec"}, SHARED_FIELD_DEFS.FIELD_115),
    schemaField({"name":"due_rule","required":true,"wireName":"due_rule"}, SHARED_FIELD_DEFS.FIELD_116),
    schemaField({"name":"description","required":false,"wireName":"description"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"resolved_amount_cents","required":true,"wireName":"resolved_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingOfferPaymentTermLineReadModel(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_TERM_LINE_READ_MODEL_SCHEMA);
      }

      export const BOOKING_OFFER_VISIBLE_TRIP_PRICE_READ_MODEL_SCHEMA = {
        name: "BookingOfferVisibleTripPriceReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferVisibleTripPriceReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"label","required":false,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"line_net_amount_cents","required":true,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_tax_amount_cents","required":true,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_gross_amount_cents","required":true,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferVisibleTripPriceReadModel(value) {
        return validateShape(value, BOOKING_OFFER_VISIBLE_TRIP_PRICE_READ_MODEL_SCHEMA);
      }

      export const BOOKING_OFFER_VISIBLE_DAY_PRICE_READ_MODEL_SCHEMA = {
        name: "BookingOfferVisibleDayPriceReadModel",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferVisibleDayPriceReadModel",
        requireOneOf: [],
        fields: [
    schemaField({"name":"day_number","required":false,"wireName":"day_number"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"label","required":false,"wireName":"label"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"amount_cents","required":true,"wireName":"amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"currency","required":true,"wireName":"currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"line_net_amount_cents","required":true,"wireName":"line_net_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_tax_amount_cents","required":true,"wireName":"line_tax_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"line_gross_amount_cents","required":true,"wireName":"line_gross_amount_cents"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingOfferVisibleDayPriceReadModel(value) {
        return validateShape(value, BOOKING_OFFER_VISIBLE_DAY_PRICE_READ_MODEL_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_SERVICE_IMAGE_SCHEMA = {
        name: "BookingTravelPlanServiceImage",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanServiceImage",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"storage_path","required":true,"wireName":"storage_path"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"caption","required":false,"wireName":"caption"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"caption_i18n","required":false,"wireName":"caption_i18n"}, SHARED_FIELD_DEFS.FIELD_111),
    schemaField({"name":"alt_text","required":false,"wireName":"alt_text"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"alt_text_i18n","required":false,"wireName":"alt_text_i18n"}, SHARED_FIELD_DEFS.FIELD_111),
    schemaField({"name":"sort_order","required":true,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"is_primary","required":false,"wireName":"is_primary"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"is_customer_visible","required":false,"wireName":"is_customer_visible"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"width_px","required":false,"wireName":"width_px"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"height_px","required":false,"wireName":"height_px"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"source_attribution","required":false,"wireName":"source_attribution"}, SHARED_FIELD_DEFS.FIELD_118),
    schemaField({"name":"focal_point","required":false,"wireName":"focal_point"}, SHARED_FIELD_DEFS.FIELD_119),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateBookingTravelPlanServiceImage(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SERVICE_IMAGE_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_SERVICE_COPIED_FROM_SCHEMA = {
        name: "BookingTravelPlanServiceCopiedFrom",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanServiceCopiedFrom",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_type","required":true,"wireName":"source_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_booking_id","required":true,"wireName":"source_booking_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_day_id","required":false,"wireName":"source_day_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_service_id","required":true,"wireName":"source_service_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"copied_at","required":true,"wireName":"copied_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"copied_by_atp_staff_id","required":false,"wireName":"copied_by_atp_staff_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanServiceCopiedFrom(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SERVICE_COPIED_FROM_SCHEMA);
      }

      export const BOOKING_OFFER_PAYMENT_AMOUNT_SPEC_SCHEMA = {
        name: "BookingOfferPaymentAmountSpec",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingOfferPaymentAmountSpec",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":true,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_120),
    schemaField({"name":"fixed_amount_cents","required":false,"wireName":"fixed_amount_cents"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"percentage_basis_points","required":false,"wireName":"percentage_basis_points"}, SHARED_FIELD_DEFS.FIELD_18)
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
    schemaField({"name":"type","required":true,"wireName":"type"}, SHARED_FIELD_DEFS.FIELD_121),
    schemaField({"name":"fixed_date","required":false,"wireName":"fixed_date"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"days","required":false,"wireName":"days"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingOfferPaymentDueRule(value) {
        return validateShape(value, BOOKING_OFFER_PAYMENT_DUE_RULE_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_IMAGE_SCHEMA = {
        name: "TravelPlanServiceImage",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceImage",
        requireOneOf: [],
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"storage_path","required":true,"wireName":"storage_path"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"caption","required":false,"wireName":"caption"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"caption_i18n","required":false,"wireName":"caption_i18n"}, SHARED_FIELD_DEFS.FIELD_111),
    schemaField({"name":"alt_text","required":false,"wireName":"alt_text"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"alt_text_i18n","required":false,"wireName":"alt_text_i18n"}, SHARED_FIELD_DEFS.FIELD_111),
    schemaField({"name":"sort_order","required":true,"wireName":"sort_order"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"is_primary","required":false,"wireName":"is_primary"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"is_customer_visible","required":false,"wireName":"is_customer_visible"}, SHARED_FIELD_DEFS.FIELD_9),
    schemaField({"name":"width_px","required":false,"wireName":"width_px"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"height_px","required":false,"wireName":"height_px"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"source_attribution","required":false,"wireName":"source_attribution"}, SHARED_FIELD_DEFS.FIELD_122),
    schemaField({"name":"focal_point","required":false,"wireName":"focal_point"}, SHARED_FIELD_DEFS.FIELD_123),
    schemaField({"name":"created_at","required":false,"wireName":"created_at"}, SHARED_FIELD_DEFS.FIELD_5)
        ]
      };

      export function validateTravelPlanServiceImage(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_IMAGE_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_SERVICE_IMAGE_SOURCE_ATTRIBUTION_SCHEMA = {
        name: "BookingTravelPlanServiceImageSourceAttribution",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanServiceImageSourceAttribution",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_name","required":false,"wireName":"source_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_url","required":false,"wireName":"source_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photographer","required":false,"wireName":"photographer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"license","required":false,"wireName":"license"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingTravelPlanServiceImageSourceAttribution(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SERVICE_IMAGE_SOURCE_ATTRIBUTION_SCHEMA);
      }

      export const BOOKING_TRAVEL_PLAN_SERVICE_IMAGE_FOCAL_POINT_SCHEMA = {
        name: "BookingTravelPlanServiceImageFocalPoint",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingTravelPlanServiceImageFocalPoint",
        requireOneOf: [],
        fields: [
    schemaField({"name":"x","required":true,"wireName":"x"}, SHARED_FIELD_DEFS.FIELD_66),
    schemaField({"name":"y","required":true,"wireName":"y"}, SHARED_FIELD_DEFS.FIELD_66)
        ]
      };

      export function validateBookingTravelPlanServiceImageFocalPoint(value) {
        return validateShape(value, BOOKING_TRAVEL_PLAN_SERVICE_IMAGE_FOCAL_POINT_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_IMAGE_SOURCE_ATTRIBUTION_SCHEMA = {
        name: "TravelPlanServiceImageSourceAttribution",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceImageSourceAttribution",
        requireOneOf: [],
        fields: [
    schemaField({"name":"source_name","required":false,"wireName":"source_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"source_url","required":false,"wireName":"source_url"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photographer","required":false,"wireName":"photographer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"license","required":false,"wireName":"license"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelPlanServiceImageSourceAttribution(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_IMAGE_SOURCE_ATTRIBUTION_SCHEMA);
      }

      export const TRAVEL_PLAN_SERVICE_IMAGE_FOCAL_POINT_SCHEMA = {
        name: "TravelPlanServiceImageFocalPoint",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelPlanServiceImageFocalPoint",
        requireOneOf: [],
        fields: [
    schemaField({"name":"x","required":true,"wireName":"x"}, SHARED_FIELD_DEFS.FIELD_66),
    schemaField({"name":"y","required":true,"wireName":"y"}, SHARED_FIELD_DEFS.FIELD_66)
        ]
      };

      export function validateTravelPlanServiceImageFocalPoint(value) {
        return validateShape(value, TRAVEL_PLAN_SERVICE_IMAGE_FOCAL_POINT_SCHEMA);
      }

