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
    authenticated: true,
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

export function publicGeneratedOfferAccessPath(params = {}) {
  return buildPath("/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/access", params);
}

export function publicGeneratedOfferAccessRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicGeneratedOfferAccessPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_generated_offer_access",
    method: "GET",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicGeneratedBookingConfirmationPath(params = {}) {
  return buildPath("/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/accept", params);
}

export function publicGeneratedBookingConfirmationRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicGeneratedBookingConfirmationPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_generated_booking_confirmation",
    method: "POST",
    authenticated: false,
    url,
    headers,
    body
  };
}

export function publicGeneratedOfferPdfPath(params = {}) {
  return buildPath("/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf", params);
}

export function publicGeneratedOfferPdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = publicGeneratedOfferPdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "public_generated_offer_pdf",
    method: "GET",
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

export function bookingMilestoneActionPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/milestone-actions", params);
}

export function bookingMilestoneActionRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingMilestoneActionPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_milestone_action",
    method: "POST",
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
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/images", params);
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
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/images/{image_id}", params);
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

export function bookingTravelPlanServiceImageReorderPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/travel-plan/days/{day_id}/services/{service_id}/images/order", params);
}

export function bookingTravelPlanServiceImageReorderRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingTravelPlanServiceImageReorderPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_travel_plan_service_image_reorder",
    method: "PATCH",
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

export function bookingPricingPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/pricing", params);
}

export function bookingPricingRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingPricingPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_pricing",
    method: "PATCH",
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

export function bookingOfferTranslatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/offer/translate", params);
}

export function bookingOfferTranslateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingOfferTranslatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_offer_translate",
    method: "POST",
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

export function suppliersPath(params = {}) {
  return buildPath("/api/v1/suppliers", params);
}

export function suppliersRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = suppliersPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "suppliers",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function supplierCreatePath(params = {}) {
  return buildPath("/api/v1/suppliers", params);
}

export function supplierCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = supplierCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "supplier_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function supplierDetailPath(params = {}) {
  return buildPath("/api/v1/suppliers/{supplier_id}", params);
}

export function supplierDetailRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = supplierDetailPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "supplier_detail",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function supplierUpdatePath(params = {}) {
  return buildPath("/api/v1/suppliers/{supplier_id}", params);
}

export function supplierUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = supplierUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "supplier_update",
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

export function bookingInvoicesPath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/invoices", params);
}

export function bookingInvoicesRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingInvoicesPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_invoices",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingInvoiceCreatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/invoices", params);
}

export function bookingInvoiceCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingInvoiceCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_invoice_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingInvoiceUpdatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/invoices/{invoice_id}", params);
}

export function bookingInvoiceUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingInvoiceUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_invoice_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingInvoiceTranslatePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/invoices/{invoice_id}/translate", params);
}

export function bookingInvoiceTranslateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingInvoiceTranslatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_invoice_translate",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function invoicePdfPath(params = {}) {
  return buildPath("/api/v1/invoices/{invoice_id}/pdf", params);
}

export function invoicePdfRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = invoicePdfPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "invoice_pdf",
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

export function tourImagePath(params = {}) {
  return buildPath("/api/v1/tours/{tour_id}/image", params);
}

export function tourImageRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourImagePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_image",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

