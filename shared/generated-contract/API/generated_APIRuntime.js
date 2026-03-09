    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

        export const SHARED_API_PARAMETER_DEFS = Object.freeze({
  PARAM_1: {
  "name": "bookingId",
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
        key: "tours",
        path: "/api/v1/tours",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TourList",
        parameters: [

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
