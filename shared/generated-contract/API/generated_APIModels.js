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
    schemaField({"name":"app","required":true,"wireName":"app"}, SHARED_FIELD_DEFS.FIELD_41),
    schemaField({"name":"api","required":true,"wireName":"api"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"features","required":true,"wireName":"features"}, SHARED_FIELD_DEFS.FIELD_43)
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
    schemaField({"name":"authenticated","required":true,"wireName":"authenticated"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"principal","required":false,"wireName":"principal"}, SHARED_FIELD_DEFS.FIELD_44)
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"travel_style","required":false,"wireName":"travel_style"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"travel_month","required":false,"wireName":"travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_currency","required":true,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"travel_duration_days_min","required":false,"wireName":"travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"travel_duration_days_max","required":false,"wireName":"travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"budget_lower_USD","required":false,"wireName":"budget_lower_USD"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"budget_upper_USD","required":false,"wireName":"budget_upper_USD"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"preferred_language","required":true,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pageUrl","required":false,"wireName":"pageUrl"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referrer","required":false,"wireName":"referrer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_source","required":false,"wireName":"utm_source"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_medium","required":false,"wireName":"utm_medium"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utm_campaign","required":false,"wireName":"utm_campaign"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"idempotencyKey","required":false,"wireName":"idempotencyKey"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tourId","required":false,"wireName":"tourId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"tourTitle","required":false,"wireName":"tourTitle"}, SHARED_FIELD_DEFS.FIELD_1)
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
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_45)
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
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_46),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_47)
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
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_47)
        ]
      };

      export function validateBookingList(value) {
        return validateShape(value, BOOKING_LIST_SCHEMA);
      }

      export const BOOKING_CHAT_RESPONSE_SCHEMA = {
        name: "BookingChatResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingChatResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"mode","required":false,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"conversations","required":false,"wireName":"conversations"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"conversationTotal","required":true,"wireName":"conversationTotal"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingChatResponse(value) {
        return validateShape(value, BOOKING_CHAT_RESPONSE_SCHEMA);
      }

      export const BOOKING_PRICING_UPDATE_REQUEST_SCHEMA = {
        name: "BookingPricingUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPricingUpdateRequest",
        requireOneOf: [],
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_51)
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
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_52)
        ]
      };

      export function validateBookingOfferUpdateRequest(value) {
        return validateShape(value, BOOKING_OFFER_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_ACTIVITIES_RESPONSE_SCHEMA = {
        name: "BookingActivitiesResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingActivitiesResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_53),
    schemaField({"name":"activities","required":false,"wireName":"activities"}, SHARED_FIELD_DEFS.FIELD_53),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingActivitiesResponse(value) {
        return validateShape(value, BOOKING_ACTIVITIES_RESPONSE_SCHEMA);
      }

      export const BOOKING_INVOICES_RESPONSE_SCHEMA = {
        name: "BookingInvoicesResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingInvoicesResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_54),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateBookingInvoicesResponse(value) {
        return validateShape(value, BOOKING_INVOICES_RESPONSE_SCHEMA);
      }

      export const ATP_STAFF_LIST_RESPONSE_SCHEMA = {
        name: "AtpStaffListResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.AtpStaffListResponse",
        requireOneOf: [],
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_55),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validateAtpStaffListResponse(value) {
        return validateShape(value, ATP_STAFF_LIST_RESPONSE_SCHEMA);
      }

      export const TOUR_DETAIL_SCHEMA = {
        name: "TourDetail",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourDetail",
        requireOneOf: [],
        fields: [
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_56),
    schemaField({"name":"options","required":true,"wireName":"options"}, SHARED_FIELD_DEFS.FIELD_57)
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
    schemaField({"name":"minSupportedVersion","required":true,"wireName":"minSupportedVersion"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"latestVersion","required":true,"wireName":"latestVersion"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"forceUpdate","required":true,"wireName":"forceUpdate"}, SHARED_FIELD_DEFS.FIELD_24)
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
    schemaField({"name":"contractVersion","required":true,"wireName":"contractVersion"}, SHARED_FIELD_DEFS.FIELD_1)
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
    schemaField({"name":"bookings","required":true,"wireName":"bookings"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"tours","required":true,"wireName":"tours"}, SHARED_FIELD_DEFS.FIELD_24)
        ]
      };

      export function validateFeatureFlags(value) {
        return validateShape(value, FEATURE_FLAGS_SCHEMA);
      }

      export const PAGINATION_SCHEMA = {
        name: "Pagination",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.Pagination",
        requireOneOf: [],
        fields: [
    schemaField({"name":"page","required":true,"wireName":"page"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"pageSize","required":true,"wireName":"pageSize"}, SHARED_FIELD_DEFS.FIELD_18),
    schemaField({"name":"totalItems","required":true,"wireName":"totalItems"}, SHARED_FIELD_DEFS.FIELD_18)
        ]
      };

      export function validatePagination(value) {
        return validateShape(value, PAGINATION_SCHEMA);
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
    schemaField({"name":"eventType","required":true,"wireName":"eventType"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"externalStatus","required":false,"wireName":"externalStatus"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"textPreview","required":true,"wireName":"textPreview"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"senderDisplay","required":false,"wireName":"senderDisplay"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"senderContact","required":false,"wireName":"senderContact"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sentAt","required":false,"wireName":"sentAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"receivedAt","required":false,"wireName":"receivedAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"conversationId","required":true,"wireName":"conversationId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"openUrl","required":false,"wireName":"openUrl"}, SHARED_FIELD_DEFS.FIELD_1)
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
    schemaField({"name":"externalContactId","required":false,"wireName":"externalContactId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"bookingId","required":false,"wireName":"bookingId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"lastEventAt","required":false,"wireName":"lastEventAt"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"latestPreview","required":false,"wireName":"latestPreview"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"openUrl","required":false,"wireName":"openUrl"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingChatConversation(value) {
        return validateShape(value, BOOKING_CHAT_CONVERSATION_SCHEMA);
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
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_24),
    schemaField({"name":"usernames","required":false,"wireName":"usernames"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"languages","required":false,"wireName":"languages"}, SHARED_FIELD_DEFS.FIELD_11)
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
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_11),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_11)
        ]
      };

      export function validateTourOptions(value) {
        return validateShape(value, TOUR_OPTIONS_SCHEMA);
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

