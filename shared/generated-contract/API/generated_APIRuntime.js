    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

        export const SHARED_API_PARAMETER_DEFS = Object.freeze({
  PARAM_1: {
  "name": "bookingId",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_2: {
  "name": "customerClientId",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_3: {
  "name": "travelGroupId",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_4: {
  "name": "tourId",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
}
    });


    export const GENERATED_CONTRACT_VERSION = "2026-03-02.1";

    export function apiParameter(parameter) {
      return parameter;
    }

    export const GENERATED_API_ENDPOINTS = [
      {
        key: "mobile_bootstrap",
        path: "/public/v1/mobile/bootstrap",
        method: "GET",
        authenticated: false,
        requestType: null,
        responseType: "MobileBootstrap",
        parameters: [

        ]
      },
      {
        key: "auth_me",
        path: "/auth/me",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "AuthMeResponse",
        parameters: [

        ]
      },
      {
        key: "public_bookings",
        path: "/public/v1/bookings",
        method: "POST",
        authenticated: false,
        requestType: "PublicBookingCreateRequest",
        responseType: "BookingDetail",
        parameters: [

        ]
      },
      {
        key: "public_tours",
        path: "/public/v1/tours",
        method: "GET",
        authenticated: false,
        requestType: null,
        responseType: "TourList",
        parameters: [

        ]
      },
      {
        key: "bookings",
        path: "/api/v1/bookings",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingList",
        parameters: [

        ]
      },
      {
        key: "booking_detail",
        path: "/api/v1/bookings/{bookingId}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_chat",
        path: "/api/v1/bookings/{bookingId}/chat",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingChatResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_stage",
        path: "/api/v1/bookings/{bookingId}/stage",
        method: "PATCH",
        authenticated: true,
        requestType: null,
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_assignment",
        path: "/api/v1/bookings/{bookingId}/owner",
        method: "PATCH",
        authenticated: true,
        requestType: null,
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_note",
        path: "/api/v1/bookings/{bookingId}/notes",
        method: "PATCH",
        authenticated: true,
        requestType: null,
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_client",
        path: "/api/v1/bookings/{bookingId}/client",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingClientUpdateRequest",
        responseType: "BookingClientUpdateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_client_create_customer",
        path: "/api/v1/bookings/{bookingId}/client/create-customer",
        method: "POST",
        authenticated: true,
        requestType: "BookingClientCreateCustomerRequest",
        responseType: "BookingClientCreateCustomerResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_client_create_group",
        path: "/api/v1/bookings/{bookingId}/client/create-group",
        method: "POST",
        authenticated: true,
        requestType: "BookingClientCreateGroupRequest",
        responseType: "BookingClientCreateCustomerResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_group_members",
        path: "/api/v1/bookings/{bookingId}/client/members",
        method: "POST",
        authenticated: true,
        requestType: "BookingGroupMemberCreateRequest",
        responseType: "BookingGroupMemberCreateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_pricing",
        path: "/api/v1/bookings/{bookingId}/pricing",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingPricingUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_offer",
        path: "/api/v1/bookings/{bookingId}/offer",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingOfferUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_activities",
        path: "/api/v1/bookings/{bookingId}/activities",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingActivitiesResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_invoices",
        path: "/api/v1/bookings/{bookingId}/invoices",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingInvoicesResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "atp_staff",
        path: "/api/v1/atp_staff",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "AtpStaffListResponse",
        parameters: [

        ]
      },
      {
        key: "customers",
        path: "/api/v1/customers",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "CustomerList",
        parameters: [

        ]
      },
      {
        key: "customer_detail",
        path: "/api/v1/customers/{customerClientId}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "CustomerDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "customer_update",
        path: "/api/v1/customers/{customerClientId}",
        method: "PATCH",
        authenticated: true,
        requestType: "CustomerUpdateRequest",
        responseType: "CustomerUpdateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "customer_photo_upload",
        path: "/api/v1/customers/{customerClientId}/photo",
        method: "POST",
        authenticated: true,
        requestType: "CustomerPhotoUploadRequest",
        responseType: "CustomerPhotoUploadResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "customer_consent_create",
        path: "/api/v1/customers/{customerClientId}/consents",
        method: "POST",
        authenticated: true,
        requestType: "CustomerConsentCreateRequest",
        responseType: "CustomerConsentCreateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "travel_groups",
        path: "/api/v1/travel_groups",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TravelGroupList",
        parameters: [

        ]
      },
      {
        key: "travel_group_create",
        path: "/api/v1/travel_groups",
        method: "POST",
        authenticated: true,
        requestType: "TravelGroupCreateRequest",
        responseType: "TravelGroupDetail",
        parameters: [

        ]
      },
      {
        key: "travel_group_detail",
        path: "/api/v1/travel_groups/{travelGroupId}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TravelGroupDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_3)
        ]
      },
      {
        key: "travel_group_update",
        path: "/api/v1/travel_groups/{travelGroupId}",
        method: "PATCH",
        authenticated: true,
        requestType: "TravelGroupUpdateRequest",
        responseType: "TravelGroupDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_3)
        ]
      },
      {
        key: "tours",
        path: "/api/v1/tours",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TourList",
        parameters: [

        ]
      },
      {
        key: "tour_detail",
        path: "/api/v1/tours/{tourId}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TourDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_4)
        ]
      },
      {
        key: "tour_image",
        path: "/api/v1/tours/{tourId}/image",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_4)
        ]
      }
    ];

    export function buildPath(template, params = {}) {
      return template.replace(/{(\w+)}/g, (_, key) => {
        if (!(key in params)) throw new Error(`Missing path parameter ${key}`);
        return encodeURIComponent(String(params[key]));
      });
    }

    export function buildURL(baseURL, path, query = {}) {
      const url = new URL(path, baseURL);
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
      return url;
    }
