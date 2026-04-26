// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

import {
  GENERATED_API_ENDPOINTS as GENERATED_API_ENDPOINT_LIST,
  buildPath,
  buildURL
} from './generated_APIRuntime.js';

export const GENERATED_CONTRACT_VERSION = "2026-03-02.1";
export const GENERATED_API_ENDPOINTS = Object.freeze(
  Object.fromEntries(GENERATED_API_ENDPOINT_LIST.map((entry) => [entry.key, entry]))
);

export function mobileBootstrapPath(params = {}) {
  return buildPath("/public/v1/mobile/bootstrap", params);
}

export function mobileBootstrapRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = mobileBootstrapPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "mobile_bootstrap",
    method: "GET",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function authMePath(params = {}) {
  return buildPath("/auth/me", params);
}

export function authMeRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = authMePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "auth_me",
    method: "GET",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicBookingsPath(params = {}) {
  return buildPath("/public/v1/bookings", params);
}

export function publicBookingsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicBookingsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_bookings",
    method: "POST",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicTravelerDetailsAccessPath(params = {}) {
  return buildPath("/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details/access", params);
}

export function publicTravelerDetailsAccessRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicTravelerDetailsAccessPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_traveler_details_access",
    method: "GET",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicTravelerDetailsUpdatePath(params = {}) {
  return buildPath("/public/v1/bookings/{booking_id}/persons/{person_id}/traveler-details", params);
}

export function publicTravelerDetailsUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicTravelerDetailsUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_traveler_details_update",
    method: "PATCH",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicTravelerDocumentPictureUploadPath(params = {}) {
  return buildPath("/public/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture", params);
}

export function publicTravelerDocumentPictureUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicTravelerDocumentPictureUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_traveler_document_picture_upload",
    method: "POST",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function bookingPersonTravelerDetailsLinkPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/persons/{person_id}/traveler-details-link", params);
}

export function bookingPersonTravelerDetailsLinkRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPersonTravelerDetailsLinkPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_person_traveler_details_link",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function publicToursPath(params = {}) {
  return buildPath("/public/v1/tours", params);
}

export function publicToursRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicToursPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_tours",
    method: "GET",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicAtpStaffTeamPath(params = {}) {
  return buildPath("/public/v1/team", params);
}

export function publicAtpStaffTeamRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicAtpStaffTeamPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_atp_staff_team",
    method: "GET",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function bookingsPath(params = {}) {
  return buildPath("/api/v1/bookings", params);
}

export function bookingsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "bookings",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingCreatePath(params = {}) {
  return buildPath("/api/v1/bookings", params);
}

export function bookingCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingDetailPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}", params);
}

export function bookingDetailRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingDetailPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_detail",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingDeletePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}", params);
}

export function bookingDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingClonePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/clone", params);
}

export function bookingCloneRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingClonePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_clone",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingChatPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/chat", params);
}

export function bookingChatRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingChatPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_chat",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingNamePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/name", params);
}

export function bookingNameRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingNamePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_name",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingCustomerLanguagePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/customer-language", params);
}

export function bookingCustomerLanguageRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingCustomerLanguagePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_customer_language",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingSourcePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/source", params);
}

export function bookingSourceRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingSourcePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_source",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingImagePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/image", params);
}

export function bookingImageRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingImagePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_image",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingOwnerPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/owner", params);
}

export function bookingOwnerRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingOwnerPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_owner",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTranslateFieldsPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/translate-fields", params);
}

export function bookingTranslateFieldsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTranslateFieldsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_translate_fields",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPersonCreatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/persons", params);
}

export function bookingPersonCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPersonCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_person_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPersonUpdatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/persons/{person_id}", params);
}

export function bookingPersonUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPersonUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_person_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPersonDeletePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/persons/{person_id}", params);
}

export function bookingPersonDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPersonDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_person_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPersonPhotoPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/persons/{person_id}/photo", params);
}

export function bookingPersonPhotoRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPersonPhotoPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_person_photo",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPersonDocumentPicturePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/persons/{person_id}/documents/{document_type}/picture", params);
}

export function bookingPersonDocumentPictureRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPersonDocumentPicturePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_person_document_picture",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingNotesPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/notes", params);
}

export function bookingNotesRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingNotesPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_notes",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan", params);
}

export function bookingTravelPlanRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanPdfPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/pdf", params);
}

export function bookingTravelPlanPdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanPdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_pdf",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanAttachmentPdfPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}/pdf", params);
}

export function bookingTravelPlanAttachmentPdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanAttachmentPdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_attachment_pdf",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanTranslatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/translate", params);
}

export function bookingTravelPlanTranslateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanTranslatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_translate",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelPlanDaySearchPath(params = {}) {
  return buildPath("/api/v1/travel-plan-days/search", params);
}

export function travelPlanDaySearchRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelPlanDaySearchPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_plan_day_search",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelPlanSearchPath(params = {}) {
  return buildPath("/api/v1/travel-plan/plans", params);
}

export function travelPlanSearchRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelPlanSearchPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_plan_search",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelPlanServiceSearchPath(params = {}) {
  return buildPath("/api/v1/travel-plan-services/search", params);
}

export function travelPlanServiceSearchRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelPlanServiceSearchPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_plan_service_search",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanDayImportPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/import", params);
}

export function bookingTravelPlanDayImportRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanDayImportPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_day_import",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanImportPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/import", params);
}

export function bookingTravelPlanImportRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanImportPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_import",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function standardToursPath(params = {}) {
  return buildPath("/api/v1/standard-tours", params);
}

export function standardToursRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = standardToursPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "standard_tours",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function standardTourCreatePath(params = {}) {
  return buildPath("/api/v1/standard-tours", params);
}

export function standardTourCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = standardTourCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "standard_tour_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function standardTourDetailPath(params = {}) {
  return buildPath("/api/v1/standard-tours/{standard_tour_id}", params);
}

export function standardTourDetailRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = standardTourDetailPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "standard_tour_detail",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function standardTourUpdatePath(params = {}) {
  return buildPath("/api/v1/standard-tours/{standard_tour_id}", params);
}

export function standardTourUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = standardTourUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "standard_tour_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function standardTourDeletePath(params = {}) {
  return buildPath("/api/v1/standard-tours/{standard_tour_id}", params);
}

export function standardTourDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = standardTourDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "standard_tour_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingStandardTourApplyPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/standard-tours/{standard_tour_id}/apply", params);
}

export function bookingStandardTourApplyRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingStandardTourApplyPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_standard_tour_apply",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTourApplyPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/tours/{tour_id}/apply", params);
}

export function bookingTourApplyRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTourApplyPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_tour_apply",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanServiceImportPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/import", params);
}

export function bookingTravelPlanServiceImportRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanServiceImportPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_service_import",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanServiceImageUploadPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image", params);
}

export function bookingTravelPlanServiceImageUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanServiceImageUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_service_image_upload",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanServiceImageDeletePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/image", params);
}

export function bookingTravelPlanServiceImageDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanServiceImageDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_service_image_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanAttachmentUploadPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/attachments", params);
}

export function bookingTravelPlanAttachmentUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanAttachmentUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_attachment_upload",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanAttachmentDeletePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}", params);
}

export function bookingTravelPlanAttachmentDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanAttachmentDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_attachment_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanPdfCreatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/pdfs", params);
}

export function bookingTravelPlanPdfCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanPdfCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_pdf_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanPdfArtifactPdfPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}/pdf", params);
}

export function bookingTravelPlanPdfArtifactPdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanPdfArtifactPdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_pdf_artifact_pdf",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanPdfUpdatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}", params);
}

export function bookingTravelPlanPdfUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanPdfUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_pdf_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingTravelPlanPdfDeletePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}", params);
}

export function bookingTravelPlanPdfDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanPdfDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_pdf_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingOfferPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/offer", params);
}

export function bookingOfferRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingOfferPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_offer",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingGenerateOfferPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/generated-offers", params);
}

export function bookingGenerateOfferRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingGenerateOfferPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_generate_offer",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingGeneratedOfferUpdatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}", params);
}

export function bookingGeneratedOfferUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingGeneratedOfferUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_generated_offer_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingGeneratedOfferDeletePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}", params);
}

export function bookingGeneratedOfferDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingGeneratedOfferDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_generated_offer_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingGeneratedOfferPdfPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf", params);
}

export function bookingGeneratedOfferPdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingGeneratedOfferPdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_generated_offer_pdf",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingGeneratedOfferGmailDraftPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft", params);
}

export function bookingGeneratedOfferGmailDraftRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingGeneratedOfferGmailDraftPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_generated_offer_gmail_draft",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function offerExchangeRatesPath(params = {}) {
  return buildPath("/api/v1/offers/exchange-rates", params);
}

export function offerExchangeRatesRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = offerExchangeRatesPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "offer_exchange_rates",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function countryReferenceInfoPath(params = {}) {
  return buildPath("/api/v1/country-reference-info", params);
}

export function countryReferenceInfoRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = countryReferenceInfoPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "country_reference_info",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function countryReferenceInfoUpdatePath(params = {}) {
  return buildPath("/api/v1/country-reference-info", params);
}

export function countryReferenceInfoUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = countryReferenceInfoUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "country_reference_info_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingActivitiesPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/activities", params);
}

export function bookingActivitiesRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingActivitiesPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_activities",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingActivityCreatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/activities", params);
}

export function bookingActivityCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingActivityCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_activity_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPaymentDocumentsPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/payment-documents", params);
}

export function bookingPaymentDocumentsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPaymentDocumentsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_payment_documents",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPaymentDocumentCreatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/payment-documents", params);
}

export function bookingPaymentDocumentCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPaymentDocumentCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_payment_document_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function paymentDocumentPdfPath(params = {}) {
  return buildPath("/api/v1/payment-documents/{document_id}/pdf", params);
}

export function paymentDocumentPdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = paymentDocumentPdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "payment_document_pdf",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function keycloakUsersPath(params = {}) {
  return buildPath("/api/v1/keycloak_users", params);
}

export function keycloakUsersRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = keycloakUsersPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "keycloak_users",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function settingsObservabilityPath(params = {}) {
  return buildPath("/api/v1/settings/observability", params);
}

export function settingsObservabilityRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = settingsObservabilityPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "settings_observability",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function settingsTranslationRulesPath(params = {}) {
  return buildPath("/api/v1/settings/translation-rules", params);
}

export function settingsTranslationRulesRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = settingsTranslationRulesPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "settings_translation_rules",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function settingsTranslationRulesUpdatePath(params = {}) {
  return buildPath("/api/v1/settings/translation-rules", params);
}

export function settingsTranslationRulesUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = settingsTranslationRulesUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "settings_translation_rules_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function staffProfilesPath(params = {}) {
  return buildPath("/api/v1/staff-profiles", params);
}

export function staffProfilesRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = staffProfilesPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "staff_profiles",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function keycloakUserStaffProfileUpdatePath(params = {}) {
  return buildPath("/api/v1/keycloak_users/{username}/staff-profile", params);
}

export function keycloakUserStaffProfileUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = keycloakUserStaffProfileUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "keycloak_user_staff_profile_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function keycloakUserStaffProfileTranslateFieldsPath(params = {}) {
  return buildPath("/api/v1/keycloak_users/{username}/staff-profile/translate-fields", params);
}

export function keycloakUserStaffProfileTranslateFieldsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = keycloakUserStaffProfileTranslateFieldsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "keycloak_user_staff_profile_translate_fields",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function keycloakUserStaffProfilePictureUploadPath(params = {}) {
  return buildPath("/api/v1/keycloak_users/{username}/staff-profile/picture", params);
}

export function keycloakUserStaffProfilePictureUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = keycloakUserStaffProfilePictureUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "keycloak_user_staff_profile_picture_upload",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function keycloakUserStaffProfilePictureDeletePath(params = {}) {
  return buildPath("/api/v1/keycloak_users/{username}/staff-profile/picture", params);
}

export function keycloakUserStaffProfilePictureDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = keycloakUserStaffProfilePictureDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "keycloak_user_staff_profile_picture_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function toursPath(params = {}) {
  return buildPath("/api/v1/tours", params);
}

export function toursRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = toursPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tours",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourCreatePath(params = {}) {
  return buildPath("/api/v1/tours", params);
}

export function tourCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourDetailPath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}", params);
}

export function tourDetailRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourDetailPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_detail",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourUpdatePath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}", params);
}

export function tourUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourDeletePath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}", params);
}

export function tourDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourTranslateFieldsPath(params = {}) {
  return buildPath("/api/v1/tours/translate-fields", params);
}

export function tourTranslateFieldsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourTranslateFieldsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_translate_fields",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourTravelPlanUpdatePath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}/travel-plan", params);
}

export function tourTravelPlanUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourTravelPlanUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_travel_plan_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourTravelPlanServiceImageUploadPath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/{service_id}/image", params);
}

export function tourTravelPlanServiceImageUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourTravelPlanServiceImageUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_travel_plan_service_image_upload",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourTravelPlanServiceImageDeletePath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}/travel-plan/days/{day_id}/services/{service_id}/image", params);
}

export function tourTravelPlanServiceImageDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourTravelPlanServiceImageDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_travel_plan_service_image_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourPictureUploadPath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}/pictures", params);
}

export function tourPictureUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourPictureUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_picture_upload",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function tourPictureDeletePath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}/pictures/{picture_name}", params);
}

export function tourPictureDeleteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourPictureDeletePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_picture_delete",
    method: "DELETE",
    authenticated: true,
    url,
    headers,
    body
  };
}

