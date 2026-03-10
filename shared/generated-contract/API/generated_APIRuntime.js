    // Generated from api/generated/openapi.yaml.
// Do not edit by hand.

        export const SHARED_API_PARAMETER_DEFS = Object.freeze({
  PARAM_1: {
  "name": "booking_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_2: {
  "name": "person_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_3: {
  "name": "invoice_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_4: {
  "name": "tour_id",
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
        path: "/api/v1/bookings/{booking_id}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_delete",
        path: "/api/v1/bookings/{booking_id}",
        method: "DELETE",
        authenticated: true,
        requestType: "BookingDeleteRequest",
        responseType: "BookingDeleteResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_chat",
        path: "/api/v1/bookings/{booking_id}/chat",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingChatResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_name",
        path: "/api/v1/bookings/{booking_id}/name",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingNameUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_stage",
        path: "/api/v1/bookings/{booking_id}/stage",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingStageUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_owner",
        path: "/api/v1/bookings/{booking_id}/owner",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingOwnerUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_persons",
        path: "/api/v1/bookings/{booking_id}/persons",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingPersonsUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_person_photo",
        path: "/api/v1/bookings/{booking_id}/persons/{person_id}/photo",
        method: "POST",
        authenticated: true,
        requestType: "EvidenceUpload",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "booking_notes",
        path: "/api/v1/bookings/{booking_id}/notes",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingNotesUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_pricing",
        path: "/api/v1/bookings/{booking_id}/pricing",
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
        path: "/api/v1/bookings/{booking_id}/offer",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingOfferUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "offer_exchange_rates",
        path: "/api/v1/offers/exchange-rates",
        method: "POST",
        authenticated: true,
        requestType: "OfferExchangeRatesRequest",
        responseType: "OfferExchangeRatesResponse",
        parameters: [

        ]
      },
      {
        key: "booking_activities",
        path: "/api/v1/bookings/{booking_id}/activities",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingActivitiesResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_activity_create",
        path: "/api/v1/bookings/{booking_id}/activities",
        method: "POST",
        authenticated: true,
        requestType: "BookingActivityCreateRequest",
        responseType: "BookingActivityResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_invoices",
        path: "/api/v1/bookings/{booking_id}/invoices",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingInvoicesResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_invoice_create",
        path: "/api/v1/bookings/{booking_id}/invoices",
        method: "POST",
        authenticated: true,
        requestType: "BookingInvoiceUpsertRequest",
        responseType: "BookingInvoiceResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_invoice_update",
        path: "/api/v1/bookings/{booking_id}/invoices/{invoice_id}",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingInvoiceUpsertRequest",
        responseType: "BookingInvoiceResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_3)
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
        key: "atp_staff_create",
        path: "/api/v1/atp_staff",
        method: "POST",
        authenticated: true,
        requestType: "AtpStaffCreateRequest",
        responseType: "AtpStaffResponse",
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
      },
      {
        key: "tour_create",
        path: "/api/v1/tours",
        method: "POST",
        authenticated: true,
        requestType: "TourUpsertRequest",
        responseType: "TourResponse",
        parameters: [

        ]
      },
      {
        key: "tour_detail",
        path: "/api/v1/tours/{tour_id}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TourDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_4)
        ]
      },
      {
        key: "tour_update",
        path: "/api/v1/tours/{tour_id}",
        method: "PATCH",
        authenticated: true,
        requestType: "TourUpsertRequest",
        responseType: "TourResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_4)
        ]
      },
      {
        key: "tour_image",
        path: "/api/v1/tours/{tour_id}/image",
        method: "POST",
        authenticated: true,
        requestType: "EvidenceUpload",
        responseType: "TourResponse",
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
