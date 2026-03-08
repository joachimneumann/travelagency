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
  return buildPath("/api/v1/bookings/{bookingId}", params);
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

export function bookingChatPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/chat", params);
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

export function bookingStagePath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/stage", params);
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

export function bookingAssignmentPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/owner", params);
}

export function bookingAssignmentRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingAssignmentPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_assignment",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingNotePath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/notes", params);
}

export function bookingNoteRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingNotePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_note",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingClientPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/client", params);
}

export function bookingClientRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingClientPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_client",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingClientCreateCustomerPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/client/create-customer", params);
}

export function bookingClientCreateCustomerRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingClientCreateCustomerPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_client_create_customer",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingClientCreateGroupPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/client/create-group", params);
}

export function bookingClientCreateGroupRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingClientCreateGroupPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_client_create_group",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingGroupMembersPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/client/members", params);
}

export function bookingGroupMembersRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = bookingGroupMembersPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "booking_group_members",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function bookingPricingPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/pricing", params);
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
  return buildPath("/api/v1/bookings/{bookingId}/offer", params);
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

export function bookingActivitiesPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/activities", params);
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

export function bookingInvoicesPath(params = {}) {
  return buildPath("/api/v1/bookings/{bookingId}/invoices", params);
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

export function customersPath(params = {}) {
  return buildPath("/api/v1/customers", params);
}

export function customersRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = customersPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "customers",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function customerDetailPath(params = {}) {
  return buildPath("/api/v1/customers/{customerClientId}", params);
}

export function customerDetailRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = customerDetailPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "customer_detail",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function customerUpdatePath(params = {}) {
  return buildPath("/api/v1/customers/{customerClientId}", params);
}

export function customerUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = customerUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "customer_update",
    method: "PATCH",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function customerPhotoUploadPath(params = {}) {
  return buildPath("/api/v1/customers/{customerClientId}/photo", params);
}

export function customerPhotoUploadRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = customerPhotoUploadPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "customer_photo_upload",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function customerConsentCreatePath(params = {}) {
  return buildPath("/api/v1/customers/{customerClientId}/consents", params);
}

export function customerConsentCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = customerConsentCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "customer_consent_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelGroupsPath(params = {}) {
  return buildPath("/api/v1/travel_groups", params);
}

export function travelGroupsRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelGroupsPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_groups",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelGroupCreatePath(params = {}) {
  return buildPath("/api/v1/travel_groups", params);
}

export function travelGroupCreateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelGroupCreatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_group_create",
    method: "POST",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelGroupDetailPath(params = {}) {
  return buildPath("/api/v1/travel_groups/{travelGroupId}", params);
}

export function travelGroupDetailRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelGroupDetailPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_group_detail",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

export function travelGroupUpdatePath(params = {}) {
  return buildPath("/api/v1/travel_groups/{travelGroupId}", params);
}

export function travelGroupUpdateRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = travelGroupUpdatePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "travel_group_update",
    method: "PATCH",
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

export function tourDetailPath(params = {}) {
  return buildPath("/api/v1/tours/{tourId}", params);
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

export function tourImagePath(params = {}) {
  return buildPath("/api/v1/tours/{tourId}/image", params);
}

export function tourImageRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = tourImagePath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "tour_image",
    method: "GET",
    authenticated: true,
    url,
    headers,
    body
  };
}

