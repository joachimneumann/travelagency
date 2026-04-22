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
  "name": "token",
  "location": "query",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_4: {
  "name": "document_type",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_5: {
  "name": "lang",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_6: {
  "name": "attachment_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_7: {
  "name": "q",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_8: {
  "name": "destination",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_9: {
  "name": "country",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_10: {
  "name": "style",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_11: {
  "name": "limit",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_12: {
  "name": "offset",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_13: {
  "name": "service_kind",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_14: {
  "name": "page",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_15: {
  "name": "page_size",
  "location": "query",
  "required": false,
  "typeName": "Identifier"
},
  PARAM_16: {
  "name": "standard_tour_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_17: {
  "name": "day_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_18: {
  "name": "service_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_19: {
  "name": "artifact_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_20: {
  "name": "generated_offer_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_21: {
  "name": "document_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_22: {
  "name": "username",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_23: {
  "name": "tour_id",
  "location": "path",
  "required": true,
  "typeName": "Identifier"
},
  PARAM_24: {
  "name": "picture_name",
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
        key: "public_traveler_details_access",
        path: "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details/access",
        method: "GET",
        authenticated: false,
        requestType: null,
        responseType: "PublicTravelerDetailsAccessResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_3)
        ]
      },
      {
        key: "public_traveler_details_update",
        path: "/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details",
        method: "PATCH",
        authenticated: false,
        requestType: "PublicTravelerDetailsUpdateRequest",
        responseType: "PublicTravelerDetailsUpdateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_3)
        ]
      },
      {
        key: "public_traveler_document_picture_upload",
        path: "/public/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture",
        method: "POST",
        authenticated: false,
        requestType: "EvidenceUpload",
        responseType: "PublicTravelerDetailsUpdateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_4),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_3)
        ]
      },
      {
        key: "booking_person_traveler_details_link",
        path: "/api/v1/bookings/{booking_id}/persons/{person_id}/traveler-details-link",
        method: "POST",
        authenticated: true,
        requestType: null,
        responseType: "BookingPersonTravelerDetailsLinkResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
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
        key: "public_atp_staff_team",
        path: "/public/v1/team",
        method: "GET",
        authenticated: false,
        requestType: null,
        responseType: "PublicAtpStaffTeamResponse",
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
        key: "booking_create",
        path: "/api/v1/bookings",
        method: "POST",
        authenticated: true,
        requestType: "BookingCreateRequest",
        responseType: "BookingDetail",
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
        key: "booking_clone",
        path: "/api/v1/bookings/{booking_id}/clone",
        method: "POST",
        authenticated: true,
        requestType: "BookingCloneRequest",
        responseType: "BookingDetail",
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
        key: "booking_customer_language",
        path: "/api/v1/bookings/{booking_id}/customer-language",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingCustomerLanguageUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_source",
        path: "/api/v1/bookings/{booking_id}/source",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingSourceUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_image",
        path: "/api/v1/bookings/{booking_id}/image",
        method: "POST",
        authenticated: true,
        requestType: "BookingImageUploadRequest",
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
        key: "booking_translate_fields",
        path: "/api/v1/bookings/{booking_id}/translate-fields",
        method: "POST",
        authenticated: true,
        requestType: "TranslationEntriesRequest",
        responseType: "TranslationEntriesResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_person_create",
        path: "/api/v1/bookings/{booking_id}/persons",
        method: "POST",
        authenticated: true,
        requestType: "BookingPersonCreateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_person_update",
        path: "/api/v1/bookings/{booking_id}/persons/{person_id}",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingPersonUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "booking_person_delete",
        path: "/api/v1/bookings/{booking_id}/persons/{person_id}",
        method: "DELETE",
        authenticated: true,
        requestType: "BookingPersonDeleteRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "booking_person_photo",
        path: "/api/v1/bookings/{booking_id}/persons/{person_id}/photo",
        method: "POST",
        authenticated: true,
        requestType: "BookingPersonPhotoUploadRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2)
        ]
      },
      {
        key: "booking_person_document_picture",
        path: "/api/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture",
        method: "POST",
        authenticated: true,
        requestType: "BookingPersonPhotoUploadRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_2),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_4)
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
        key: "booking_travel_plan",
        path: "/api/v1/bookings/{booking_id}/travel-plan",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingTravelPlanUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_travel_plan_pdf",
        path: "/api/v1/bookings/{booking_id}/travel-plan/pdf",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_5)
        ]
      },
      {
        key: "booking_travel_plan_attachment_pdf",
        path: "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}/pdf",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_6)
        ]
      },
      {
        key: "booking_travel_plan_translate",
        path: "/api/v1/bookings/{booking_id}/travel-plan/translate",
        method: "POST",
        authenticated: true,
        requestType: "BookingTravelPlanTranslateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "travel_plan_day_search",
        path: "/api/v1/travel-plan-days/search",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TravelPlanDaySearchResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_7),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_8),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_9),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_10),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_11),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_12)
        ]
      },
      {
        key: "travel_plan_search",
        path: "/api/v1/travel-plan/plans",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TravelPlanSearchResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_7),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_8),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_9),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_10),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_11),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_12)
        ]
      },
      {
        key: "travel_plan_service_search",
        path: "/api/v1/travel-plan-services/search",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "TravelPlanServiceSearchResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_7),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_8),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_9),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_10),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_13),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_11),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_12)
        ]
      },
      {
        key: "booking_travel_plan_day_import",
        path: "/api/v1/bookings/{booking_id}/travel-plan/days/import",
        method: "POST",
        authenticated: true,
        requestType: "TravelPlanDayImportRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_travel_plan_import",
        path: "/api/v1/bookings/{booking_id}/travel-plan/import",
        method: "POST",
        authenticated: true,
        requestType: "TravelPlanImportRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "standard_tours",
        path: "/api/v1/standard-tours",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "StandardTourListResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_7),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_8),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_14),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_15)
        ]
      },
      {
        key: "standard_tour_create",
        path: "/api/v1/standard-tours",
        method: "POST",
        authenticated: true,
        requestType: "StandardTourUpsertRequest",
        responseType: "StandardTourResponse",
        parameters: [

        ]
      },
      {
        key: "standard_tour_detail",
        path: "/api/v1/standard-tours/{standard_tour_id}",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "StandardTourResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_16)
        ]
      },
      {
        key: "standard_tour_update",
        path: "/api/v1/standard-tours/{standard_tour_id}",
        method: "PATCH",
        authenticated: true,
        requestType: "StandardTourUpsertRequest",
        responseType: "StandardTourResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_16)
        ]
      },
      {
        key: "standard_tour_delete",
        path: "/api/v1/standard-tours/{standard_tour_id}",
        method: "DELETE",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_16)
        ]
      },
      {
        key: "booking_standard_tour_apply",
        path: "/api/v1/bookings/{booking_id}/travel-plan/standard-tours/{standard_tour_id}/apply",
        method: "POST",
        authenticated: true,
        requestType: "BookingStandardTourApplyRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_16)
        ]
      },
      {
        key: "booking_travel_plan_service_import",
        path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/import",
        method: "POST",
        authenticated: true,
        requestType: "TravelPlanServiceImportRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_17)
        ]
      },
      {
        key: "booking_travel_plan_service_image_upload",
        path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image",
        method: "POST",
        authenticated: true,
        requestType: "TravelPlanServiceImageUploadRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_17),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_18)
        ]
      },
      {
        key: "booking_travel_plan_service_image_delete",
        path: "/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image",
        method: "DELETE",
        authenticated: true,
        requestType: "TravelPlanServiceImageDeleteRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_17),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_18)
        ]
      },
      {
        key: "booking_travel_plan_attachment_upload",
        path: "/api/v1/bookings/{booking_id}/travel-plan/attachments",
        method: "POST",
        authenticated: true,
        requestType: "TravelPlanAttachmentUploadRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_travel_plan_attachment_delete",
        path: "/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}",
        method: "DELETE",
        authenticated: true,
        requestType: "TravelPlanAttachmentDeleteRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_6)
        ]
      },
      {
        key: "booking_travel_plan_pdf_create",
        path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs",
        method: "POST",
        authenticated: true,
        requestType: "TravelPlanPdfArtifactCreateRequest",
        responseType: "TravelPlanPdfArtifactCreateResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_travel_plan_pdf_artifact_pdf",
        path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}/pdf",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_19)
        ]
      },
      {
        key: "booking_travel_plan_pdf_update",
        path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}",
        method: "PATCH",
        authenticated: true,
        requestType: "TravelPlanPdfArtifactUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_19)
        ]
      },
      {
        key: "booking_travel_plan_pdf_delete",
        path: "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}",
        method: "DELETE",
        authenticated: true,
        requestType: "TravelPlanPdfArtifactDeleteRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_19)
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
        key: "booking_generate_offer",
        path: "/api/v1/bookings/{booking_id}/generated-offers",
        method: "POST",
        authenticated: true,
        requestType: "BookingGenerateOfferRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_generated_offer_update",
        path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}",
        method: "PATCH",
        authenticated: true,
        requestType: "BookingGeneratedOfferUpdateRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_20)
        ]
      },
      {
        key: "booking_generated_offer_delete",
        path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}",
        method: "DELETE",
        authenticated: true,
        requestType: "BookingGeneratedOfferDeleteRequest",
        responseType: "BookingDetail",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_20)
        ]
      },
      {
        key: "booking_generated_offer_pdf",
        path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_20)
        ]
      },
      {
        key: "booking_generated_offer_gmail_draft",
        path: "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft",
        method: "POST",
        authenticated: true,
        requestType: "BookingGeneratedOfferGmailDraftRequest",
        responseType: "BookingGeneratedOfferGmailDraftResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_20)
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
        key: "country_reference_info",
        path: "/api/v1/country-reference-info",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "CountryPracticalInfoListResponse",
        parameters: [

        ]
      },
      {
        key: "country_reference_info_update",
        path: "/api/v1/country-reference-info",
        method: "PATCH",
        authenticated: true,
        requestType: "CountryPracticalInfoUpdateRequest",
        responseType: "CountryPracticalInfoListResponse",
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
        key: "booking_payment_documents",
        path: "/api/v1/bookings/{booking_id}/payment-documents",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "BookingPaymentDocumentsResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "booking_payment_document_create",
        path: "/api/v1/bookings/{booking_id}/payment-documents",
        method: "POST",
        authenticated: true,
        requestType: "BookingPaymentDocumentCreateRequest",
        responseType: "BookingPaymentDocumentResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_1)
        ]
      },
      {
        key: "payment_document_pdf",
        path: "/api/v1/payment-documents/{document_id}/pdf",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: null,
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_21)
        ]
      },
      {
        key: "keycloak_users",
        path: "/api/v1/keycloak_users",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "KeycloakUserListResponse",
        parameters: [

        ]
      },
      {
        key: "settings_observability",
        path: "/api/v1/settings/observability",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "SettingsObservabilityResponse",
        parameters: [

        ]
      },
      {
        key: "staff_profiles",
        path: "/api/v1/staff-profiles",
        method: "GET",
        authenticated: true,
        requestType: null,
        responseType: "KeycloakUserStaffProfileListResponse",
        parameters: [

        ]
      },
      {
        key: "keycloak_user_staff_profile_update",
        path: "/api/v1/keycloak_users/{username}/staff-profile",
        method: "PATCH",
        authenticated: true,
        requestType: "AtpStaffProfileUpdateRequest",
        responseType: "KeycloakUserStaffProfileEntryResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_22)
        ]
      },
      {
        key: "keycloak_user_staff_profile_translate_fields",
        path: "/api/v1/keycloak_users/{username}/staff-profile/translate-fields",
        method: "POST",
        authenticated: true,
        requestType: "TranslationEntriesRequest",
        responseType: "TranslationEntriesResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_22)
        ]
      },
      {
        key: "keycloak_user_staff_profile_picture_upload",
        path: "/api/v1/keycloak_users/{username}/staff-profile/picture",
        method: "POST",
        authenticated: true,
        requestType: "AtpStaffPhotoUploadRequest",
        responseType: "KeycloakUserStaffProfileEntryResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_22)
        ]
      },
      {
        key: "keycloak_user_staff_profile_picture_delete",
        path: "/api/v1/keycloak_users/{username}/staff-profile/picture",
        method: "DELETE",
        authenticated: true,
        requestType: null,
        responseType: "KeycloakUserStaffProfileEntryResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_22)
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
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_23)
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
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_23)
        ]
      },
      {
        key: "tour_delete",
        path: "/api/v1/tours/{tour_id}",
        method: "DELETE",
        authenticated: true,
        requestType: null,
        responseType: "TourDeleteResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_23)
        ]
      },
      {
        key: "tour_translate_fields",
        path: "/api/v1/tours/translate-fields",
        method: "POST",
        authenticated: true,
        requestType: "TourTranslateFieldsRequest",
        responseType: "TranslationEntriesResponse",
        parameters: [

        ]
      },
      {
        key: "tour_picture_upload",
        path: "/api/v1/tours/{tour_id}/pictures",
        method: "POST",
        authenticated: true,
        requestType: "EvidenceUpload",
        responseType: "TourResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_23)
        ]
      },
      {
        key: "tour_picture_delete",
        path: "/api/v1/tours/{tour_id}/pictures/{picture_name}",
        method: "DELETE",
        authenticated: true,
        requestType: null,
        responseType: "TourResponse",
        parameters: [
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_23),
      apiParameter(SHARED_API_PARAMETER_DEFS.PARAM_24)
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
