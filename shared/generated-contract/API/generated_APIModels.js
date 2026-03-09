// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import { SHARED_FIELD_DEFS, schemaField, validateShape } from '../Models/generated_SchemaRuntime.js';
import { GENERATED_API_ENDPOINTS } from './generated_APIRuntime.js';

      export const MOBILE_BOOTSTRAP_SCHEMA = {
        name: "MobileBootstrap",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.MobileBootstrap",
        fields: [
    schemaField({"name":"app","required":true,"wireName":"app"}, SHARED_FIELD_DEFS.FIELD_29),
    schemaField({"name":"api","required":true,"wireName":"api"}, SHARED_FIELD_DEFS.FIELD_30),
    schemaField({"name":"features","required":true,"wireName":"features"}, SHARED_FIELD_DEFS.FIELD_31)
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
        fields: [
    schemaField({"name":"authenticated","required":true,"wireName":"authenticated"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"principal","required":false,"wireName":"principal"}, SHARED_FIELD_DEFS.FIELD_32)
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
        fields: [
    schemaField({"name":"destination","required":false,"wireName":"destination"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"style","required":false,"wireName":"style"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"web_form_travel_month","required":false,"wireName":"web_form_travel_month"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_start_day","required":false,"wireName":"travel_start_day"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"travel_end_day","required":false,"wireName":"travel_end_day"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"web_form_travel_duration","required":false,"wireName":"web_form_travel_duration"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"web_form_travel_duration_days_min","required":false,"wireName":"web_form_travel_duration_days_min"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"web_form_travel_duration_days_max","required":false,"wireName":"web_form_travel_duration_days_max"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"preferredCurrency","required":false,"wireName":"preferredCurrency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pageUrl","required":false,"wireName":"pageUrl"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"referrer","required":false,"wireName":"referrer"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utmSource","required":false,"wireName":"utmSource"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utmMedium","required":false,"wireName":"utmMedium"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"utmCampaign","required":false,"wireName":"utmCampaign"}, SHARED_FIELD_DEFS.FIELD_1)
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
        fields: [
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"client","required":false,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":false,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"travelGroup","required":false,"wireName":"travelGroup"}, SHARED_FIELD_DEFS.FIELD_36)
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
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_37),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_38)
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
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_38)
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
        fields: [
    schemaField({"name":"mode","required":false,"wireName":"mode"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_40),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"conversations","required":false,"wireName":"conversations"}, SHARED_FIELD_DEFS.FIELD_41),
    schemaField({"name":"conversationTotal","required":true,"wireName":"conversationTotal"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateBookingChatResponse(value) {
        return validateShape(value, BOOKING_CHAT_RESPONSE_SCHEMA);
      }

      export const BOOKING_CLIENT_UPDATE_REQUEST_SCHEMA = {
        name: "BookingClientUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingClientUpdateRequest",
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"customer_client_id","required":false,"wireName":"customer_client_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_group_id","required":false,"wireName":"travel_group_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingClientUpdateRequest(value) {
        return validateShape(value, BOOKING_CLIENT_UPDATE_REQUEST_SCHEMA);
      }

      export const BOOKING_CLIENT_UPDATE_RESPONSE_SCHEMA = {
        name: "BookingClientUpdateResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingClientUpdateResponse",
        fields: [
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"client","required":false,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":false,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"travelGroup","required":false,"wireName":"travelGroup"}, SHARED_FIELD_DEFS.FIELD_36),
    schemaField({"name":"members","required":false,"wireName":"members"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"memberCustomers","required":false,"wireName":"memberCustomers"}, SHARED_FIELD_DEFS.FIELD_43)
        ]
      };

      export function validateBookingClientUpdateResponse(value) {
        return validateShape(value, BOOKING_CLIENT_UPDATE_RESPONSE_SCHEMA);
      }

      export const BOOKING_CLIENT_CREATE_CUSTOMER_REQUEST_SCHEMA = {
        name: "BookingClientCreateCustomerRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingClientCreateCustomerRequest",
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingClientCreateCustomerRequest(value) {
        return validateShape(value, BOOKING_CLIENT_CREATE_CUSTOMER_REQUEST_SCHEMA);
      }

      export const BOOKING_CLIENT_CREATE_GROUP_REQUEST_SCHEMA = {
        name: "BookingClientCreateGroupRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingClientCreateGroupRequest",
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"group_name","required":true,"wireName":"group_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"customer_client_id","required":false,"wireName":"customer_client_id"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingClientCreateGroupRequest(value) {
        return validateShape(value, BOOKING_CLIENT_CREATE_GROUP_REQUEST_SCHEMA);
      }

      export const BOOKING_GROUP_MEMBER_CREATE_REQUEST_SCHEMA = {
        name: "BookingGroupMemberCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingGroupMemberCreateRequest",
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"member_roles","required":false,"wireName":"member_roles"}, SHARED_FIELD_DEFS.FIELD_26),
    schemaField({"name":"is_traveling","required":false,"wireName":"is_traveling"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"member_notes","required":false,"wireName":"member_notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateBookingGroupMemberCreateRequest(value) {
        return validateShape(value, BOOKING_GROUP_MEMBER_CREATE_REQUEST_SCHEMA);
      }

      export const BOOKING_GROUP_MEMBER_CREATE_RESPONSE_SCHEMA = {
        name: "BookingGroupMemberCreateResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingGroupMemberCreateResponse",
        fields: [
    schemaField({"name":"booking","required":true,"wireName":"booking"}, SHARED_FIELD_DEFS.FIELD_33),
    schemaField({"name":"client","required":false,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":false,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"travelGroup","required":false,"wireName":"travelGroup"}, SHARED_FIELD_DEFS.FIELD_36),
    schemaField({"name":"members","required":false,"wireName":"members"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"memberCustomers","required":false,"wireName":"memberCustomers"}, SHARED_FIELD_DEFS.FIELD_43)
        ]
      };

      export function validateBookingGroupMemberCreateResponse(value) {
        return validateShape(value, BOOKING_GROUP_MEMBER_CREATE_RESPONSE_SCHEMA);
      }

      export const BOOKING_PRICING_UPDATE_REQUEST_SCHEMA = {
        name: "BookingPricingUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.BookingPricingUpdateRequest",
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"pricing","required":true,"wireName":"pricing"}, SHARED_FIELD_DEFS.FIELD_44)
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
        fields: [
    schemaField({"name":"booking_hash","required":false,"wireName":"booking_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"offer","required":true,"wireName":"offer"}, SHARED_FIELD_DEFS.FIELD_45)
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
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_46),
    schemaField({"name":"activities","required":false,"wireName":"activities"}, SHARED_FIELD_DEFS.FIELD_46),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_7)
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
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_47),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_7)
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
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_48),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateAtpStaffListResponse(value) {
        return validateShape(value, ATP_STAFF_LIST_RESPONSE_SCHEMA);
      }

      export const CUSTOMER_LIST_SCHEMA = {
        name: "CustomerList",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerList",
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_43),
    schemaField({"name":"pagination","required":true,"wireName":"pagination"}, SHARED_FIELD_DEFS.FIELD_38)
        ]
      };

      export function validateCustomerList(value) {
        return validateShape(value, CUSTOMER_LIST_SCHEMA);
      }

      export const CUSTOMER_DETAIL_SCHEMA = {
        name: "CustomerDetail",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerDetail",
        fields: [
    schemaField({"name":"client","required":true,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":true,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"bookings","required":false,"wireName":"bookings"}, SHARED_FIELD_DEFS.FIELD_39),
    schemaField({"name":"consents","required":false,"wireName":"consents"}, SHARED_FIELD_DEFS.FIELD_49),
    schemaField({"name":"documents","required":false,"wireName":"documents"}, SHARED_FIELD_DEFS.FIELD_50),
    schemaField({"name":"travelGroups","required":false,"wireName":"travelGroups"}, SHARED_FIELD_DEFS.FIELD_51),
    schemaField({"name":"travelGroupMembers","required":false,"wireName":"travelGroupMembers"}, SHARED_FIELD_DEFS.FIELD_42)
        ]
      };

      export function validateCustomerDetail(value) {
        return validateShape(value, CUSTOMER_DETAIL_SCHEMA);
      }

      export const CUSTOMER_UPDATE_REQUEST_SCHEMA = {
        name: "CustomerUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerUpdateRequest",
        fields: [
    schemaField({"name":"customer_hash","required":false,"wireName":"customer_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":false,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photo_ref","required":false,"wireName":"photo_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"title","required":false,"wireName":"title"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"first_name","required":false,"wireName":"first_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"last_name","required":false,"wireName":"last_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"date_of_birth","required":false,"wireName":"date_of_birth"}, SHARED_FIELD_DEFS.FIELD_15),
    schemaField({"name":"nationality","required":false,"wireName":"nationality"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"address_line_1","required":false,"wireName":"address_line_1"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_line_2","required":false,"wireName":"address_line_2"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_city","required":false,"wireName":"address_city"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_state_region","required":false,"wireName":"address_state_region"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_postal_code","required":false,"wireName":"address_postal_code"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"address_country_code","required":false,"wireName":"address_country_code"}, SHARED_FIELD_DEFS.FIELD_19),
    schemaField({"name":"organization_name","required":false,"wireName":"organization_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_address","required":false,"wireName":"organization_address"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_phone_number","required":false,"wireName":"organization_phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_webpage","required":false,"wireName":"organization_webpage"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"organization_email","required":false,"wireName":"organization_email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"tax_id","required":false,"wireName":"tax_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"phone_number","required":false,"wireName":"phone_number"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"email","required":false,"wireName":"email"}, SHARED_FIELD_DEFS.FIELD_2),
    schemaField({"name":"preferred_language","required":false,"wireName":"preferred_language"}, SHARED_FIELD_DEFS.FIELD_20),
    schemaField({"name":"preferred_currency","required":false,"wireName":"preferred_currency"}, SHARED_FIELD_DEFS.FIELD_8),
    schemaField({"name":"timezone","required":false,"wireName":"timezone"}, SHARED_FIELD_DEFS.FIELD_21),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateCustomerUpdateRequest(value) {
        return validateShape(value, CUSTOMER_UPDATE_REQUEST_SCHEMA);
      }

      export const CUSTOMER_UPDATE_RESPONSE_SCHEMA = {
        name: "CustomerUpdateResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerUpdateResponse",
        fields: [
    schemaField({"name":"client","required":true,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":true,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35)
        ]
      };

      export function validateCustomerUpdateResponse(value) {
        return validateShape(value, CUSTOMER_UPDATE_RESPONSE_SCHEMA);
      }

      export const CUSTOMER_PHOTO_UPLOAD_REQUEST_SCHEMA = {
        name: "CustomerPhotoUploadRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerPhotoUploadRequest",
        fields: [
    schemaField({"name":"customer_hash","required":false,"wireName":"customer_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"photo_upload","required":false,"wireName":"photo_upload"}, SHARED_FIELD_DEFS.FIELD_52),
    schemaField({"name":"photo","required":false,"wireName":"photo"}, SHARED_FIELD_DEFS.FIELD_52)
        ]
      };

      export function validateCustomerPhotoUploadRequest(value) {
        return validateShape(value, CUSTOMER_PHOTO_UPLOAD_REQUEST_SCHEMA);
      }

      export const CUSTOMER_PHOTO_UPLOAD_RESPONSE_SCHEMA = {
        name: "CustomerPhotoUploadResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerPhotoUploadResponse",
        fields: [
    schemaField({"name":"client","required":true,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":true,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35)
        ]
      };

      export function validateCustomerPhotoUploadResponse(value) {
        return validateShape(value, CUSTOMER_PHOTO_UPLOAD_RESPONSE_SCHEMA);
      }

      export const CUSTOMER_CONSENT_CREATE_REQUEST_SCHEMA = {
        name: "CustomerConsentCreateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerConsentCreateRequest",
        fields: [
    schemaField({"name":"customer_hash","required":false,"wireName":"customer_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"consent_type","required":true,"wireName":"consent_type"}, SHARED_FIELD_DEFS.FIELD_22),
    schemaField({"name":"status","required":true,"wireName":"status"}, SHARED_FIELD_DEFS.FIELD_23),
    schemaField({"name":"captured_via","required":false,"wireName":"captured_via"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"captured_at","required":false,"wireName":"captured_at"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"evidence_ref","required":false,"wireName":"evidence_ref"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"evidence_upload","required":false,"wireName":"evidence_upload"}, SHARED_FIELD_DEFS.FIELD_52)
        ]
      };

      export function validateCustomerConsentCreateRequest(value) {
        return validateShape(value, CUSTOMER_CONSENT_CREATE_REQUEST_SCHEMA);
      }

      export const CUSTOMER_CONSENT_CREATE_RESPONSE_SCHEMA = {
        name: "CustomerConsentCreateResponse",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.CustomerConsentCreateResponse",
        fields: [
    schemaField({"name":"client","required":true,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"customer","required":true,"wireName":"customer"}, SHARED_FIELD_DEFS.FIELD_35),
    schemaField({"name":"consent","required":true,"wireName":"consent"}, SHARED_FIELD_DEFS.FIELD_53)
        ]
      };

      export function validateCustomerConsentCreateResponse(value) {
        return validateShape(value, CUSTOMER_CONSENT_CREATE_RESPONSE_SCHEMA);
      }

      export const TRAVEL_GROUP_LIST_SCHEMA = {
        name: "TravelGroupList",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelGroupList",
        fields: [
    schemaField({"name":"items","required":false,"wireName":"items"}, SHARED_FIELD_DEFS.FIELD_51),
    schemaField({"name":"total","required":true,"wireName":"total"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"page","required":true,"wireName":"page"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"page_size","required":true,"wireName":"page_size"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"total_pages","required":true,"wireName":"total_pages"}, SHARED_FIELD_DEFS.FIELD_7)
        ]
      };

      export function validateTravelGroupList(value) {
        return validateShape(value, TRAVEL_GROUP_LIST_SCHEMA);
      }

      export const TRAVEL_GROUP_DETAIL_SCHEMA = {
        name: "TravelGroupDetail",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelGroupDetail",
        fields: [
    schemaField({"name":"client","required":true,"wireName":"client"}, SHARED_FIELD_DEFS.FIELD_34),
    schemaField({"name":"travel_group","required":true,"wireName":"travel_group"}, SHARED_FIELD_DEFS.FIELD_36),
    schemaField({"name":"members","required":false,"wireName":"members"}, SHARED_FIELD_DEFS.FIELD_42),
    schemaField({"name":"memberCustomers","required":false,"wireName":"memberCustomers"}, SHARED_FIELD_DEFS.FIELD_43)
        ]
      };

      export function validateTravelGroupDetail(value) {
        return validateShape(value, TRAVEL_GROUP_DETAIL_SCHEMA);
      }

      export const TRAVEL_GROUP_UPDATE_REQUEST_SCHEMA = {
        name: "TravelGroupUpdateRequest",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TravelGroupUpdateRequest",
        fields: [
    schemaField({"name":"travel_group_hash","required":false,"wireName":"travel_group_hash"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"group_name","required":false,"wireName":"group_name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"group_contact_customer_id","required":false,"wireName":"group_contact_customer_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"traveler_customer_ids","required":false,"wireName":"traveler_customer_ids"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"number_of_travelers","required":false,"wireName":"number_of_travelers"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"notes","required":false,"wireName":"notes"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateTravelGroupUpdateRequest(value) {
        return validateShape(value, TRAVEL_GROUP_UPDATE_REQUEST_SCHEMA);
      }

      export const TOUR_DETAIL_SCHEMA = {
        name: "TourDetail",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourDetail",
        fields: [
    schemaField({"name":"tour","required":true,"wireName":"tour"}, SHARED_FIELD_DEFS.FIELD_54),
    schemaField({"name":"options","required":true,"wireName":"options"}, SHARED_FIELD_DEFS.FIELD_55)
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
        fields: [
    schemaField({"name":"minSupportedVersion","required":true,"wireName":"minSupportedVersion"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"latestVersion","required":true,"wireName":"latestVersion"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"forceUpdate","required":true,"wireName":"forceUpdate"}, SHARED_FIELD_DEFS.FIELD_25)
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
        fields: [
    schemaField({"name":"bookings","required":true,"wireName":"bookings"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"customers","required":true,"wireName":"customers"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"tours","required":true,"wireName":"tours"}, SHARED_FIELD_DEFS.FIELD_25)
        ]
      };

      export function validateFeatureFlags(value) {
        return validateShape(value, FEATURE_FLAGS_SCHEMA);
      }

      export const CLIENT_SCHEMA = {
        name: "Client",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.Client",
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_type","required":true,"wireName":"client_type"}, SHARED_FIELD_DEFS.FIELD_12),
    schemaField({"name":"customer_id","required":false,"wireName":"customer_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"travel_group_id","required":false,"wireName":"travel_group_id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"client_hash","required":true,"wireName":"client_hash"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateClient(value) {
        return validateShape(value, CLIENT_SCHEMA);
      }

      export const PAGINATION_SCHEMA = {
        name: "Pagination",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.Pagination",
        fields: [
    schemaField({"name":"page","required":true,"wireName":"page"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"pageSize","required":true,"wireName":"pageSize"}, SHARED_FIELD_DEFS.FIELD_7),
    schemaField({"name":"totalItems","required":true,"wireName":"totalItems"}, SHARED_FIELD_DEFS.FIELD_7)
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
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"channel","required":true,"wireName":"channel"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"direction","required":true,"wireName":"direction"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"eventType","required":true,"wireName":"eventType"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"externalStatus","required":false,"wireName":"externalStatus"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"textPreview","required":true,"wireName":"textPreview"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"senderDisplay","required":false,"wireName":"senderDisplay"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"senderContact","required":false,"wireName":"senderContact"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"sentAt","required":false,"wireName":"sentAt"}, SHARED_FIELD_DEFS.FIELD_5),
    schemaField({"name":"receivedAt","required":false,"wireName":"receivedAt"}, SHARED_FIELD_DEFS.FIELD_5),
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
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"channel","required":true,"wireName":"channel"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"externalContactId","required":false,"wireName":"externalContactId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"clientId","required":false,"wireName":"clientId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"bookingId","required":false,"wireName":"bookingId"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"lastEventAt","required":false,"wireName":"lastEventAt"}, SHARED_FIELD_DEFS.FIELD_5),
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
        fields: [
    schemaField({"name":"id","required":true,"wireName":"id"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"name","required":true,"wireName":"name"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"active","required":false,"wireName":"active"}, SHARED_FIELD_DEFS.FIELD_25),
    schemaField({"name":"usernames","required":false,"wireName":"usernames"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"languages","required":false,"wireName":"languages"}, SHARED_FIELD_DEFS.FIELD_14)
        ]
      };

      export function validateAtpStaffDirectoryEntry(value) {
        return validateShape(value, ATP_STAFF_DIRECTORY_ENTRY_SCHEMA);
      }

      export const EVIDENCE_UPLOAD_SCHEMA = {
        name: "EvidenceUpload",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.EvidenceUpload",
        fields: [
    schemaField({"name":"filename","required":true,"wireName":"filename"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"mime_type","required":false,"wireName":"mime_type"}, SHARED_FIELD_DEFS.FIELD_1),
    schemaField({"name":"data_base64","required":true,"wireName":"data_base64"}, SHARED_FIELD_DEFS.FIELD_1)
        ]
      };

      export function validateEvidenceUpload(value) {
        return validateShape(value, EVIDENCE_UPLOAD_SCHEMA);
      }

      export const TOUR_OPTIONS_SCHEMA = {
        name: "TourOptions",
        domain: "api",
        module: "api",
        sourceType: "openapi.components.schemas.TourOptions",
        fields: [
    schemaField({"name":"destinations","required":false,"wireName":"destinations"}, SHARED_FIELD_DEFS.FIELD_14),
    schemaField({"name":"styles","required":false,"wireName":"styles"}, SHARED_FIELD_DEFS.FIELD_14)
        ]
      };

      export function validateTourOptions(value) {
        return validateShape(value, TOUR_OPTIONS_SCHEMA);
      }

