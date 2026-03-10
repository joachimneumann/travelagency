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

export function bookingStagePath(params = {}) {
  return buildPath("/api/v1/bookings/{booking_id}/stage", params);
}

export function bookingStageRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingStagePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_stage",
    method: "PATCH",
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

export function atpStaffPath(params = {}) {
  return buildPath("/api/v1/atp_staff", params);
}

export function atpStaffRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = atpStaffPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "atp_staff",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function atpStaffCreatePath(params = {}) {
  return buildPath("/api/v1/atp_staff", params);
}

export function atpStaffCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = atpStaffCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "atp_staff_create",
    method: "POST",
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

