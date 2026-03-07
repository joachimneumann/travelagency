// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

export const GENERATED_CONTRACT_VERSION = "2026-03-02.1";
export const GENERATED_API_ENDPOINTS = {
  "mobile_bootstrap": {
    "key": "mobile_bootstrap",
    "path": "/public/v1/mobile/bootstrap",
    "method": "GET",
    "authenticated": false,
    "requestType": null,
    "responseType": "MobileBootstrap",
    "parameters": [

    ]
  },
  "auth_me": {
    "key": "auth_me",
    "path": "/auth/me",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "AuthMeResponse",
    "parameters": [

    ]
  },
  "public_bookings": {
    "key": "public_bookings",
    "path": "/public/v1/bookings",
    "method": "POST",
    "authenticated": false,
    "requestType": "PublicBookingCreateRequest",
    "responseType": "BookingDetail",
    "parameters": [

    ]
  },
  "public_tours": {
    "key": "public_tours",
    "path": "/public/v1/tours",
    "method": "GET",
    "authenticated": false,
    "requestType": null,
    "responseType": "TourList",
    "parameters": [

    ]
  },
  "bookings": {
    "key": "bookings",
    "path": "/api/v1/bookings",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingList",
    "parameters": [

    ]
  },
  "booking_detail": {
    "key": "booking_detail",
    "path": "/api/v1/bookings/{bookingId}",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingDetail",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_chat": {
    "key": "booking_chat",
    "path": "/api/v1/bookings/{bookingId}/chat",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingChatResponse",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_stage": {
    "key": "booking_stage",
    "path": "/api/v1/bookings/{bookingId}/stage",
    "method": "PATCH",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingDetail",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_assignment": {
    "key": "booking_assignment",
    "path": "/api/v1/bookings/{bookingId}/owner",
    "method": "PATCH",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingDetail",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_note": {
    "key": "booking_note",
    "path": "/api/v1/bookings/{bookingId}/notes",
    "method": "PATCH",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingDetail",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_client": {
    "key": "booking_client",
    "path": "/api/v1/bookings/{bookingId}/client",
    "method": "PATCH",
    "authenticated": true,
    "requestType": "BookingClientUpdateRequest",
    "responseType": "BookingClientUpdateResponse",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_group_members": {
    "key": "booking_group_members",
    "path": "/api/v1/bookings/{bookingId}/client/members",
    "method": "POST",
    "authenticated": true,
    "requestType": "BookingGroupMemberCreateRequest",
    "responseType": "BookingGroupMemberCreateResponse",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_pricing": {
    "key": "booking_pricing",
    "path": "/api/v1/bookings/{bookingId}/pricing",
    "method": "PATCH",
    "authenticated": true,
    "requestType": "BookingPricingUpdateRequest",
    "responseType": "BookingDetail",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_offer": {
    "key": "booking_offer",
    "path": "/api/v1/bookings/{bookingId}/offer",
    "method": "PATCH",
    "authenticated": true,
    "requestType": "BookingOfferUpdateRequest",
    "responseType": "BookingDetail",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_activities": {
    "key": "booking_activities",
    "path": "/api/v1/bookings/{bookingId}/activities",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingActivitiesResponse",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "booking_invoices": {
    "key": "booking_invoices",
    "path": "/api/v1/bookings/{bookingId}/invoices",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingInvoicesResponse",
    "parameters": [
      {
        "name": "bookingId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "atp_staff": {
    "key": "atp_staff",
    "path": "/api/v1/atp_staff",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "AtpStaffListResponse",
    "parameters": [

    ]
  },
  "customers": {
    "key": "customers",
    "path": "/api/v1/customers",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "CustomerList",
    "parameters": [

    ]
  },
  "customer_detail": {
    "key": "customer_detail",
    "path": "/api/v1/customers/{customerClientId}",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "CustomerDetail",
    "parameters": [
      {
        "name": "customerClientId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "customer_update": {
    "key": "customer_update",
    "path": "/api/v1/customers/{customerClientId}",
    "method": "PATCH",
    "authenticated": true,
    "requestType": "CustomerUpdateRequest",
    "responseType": "CustomerUpdateResponse",
    "parameters": [
      {
        "name": "customerClientId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "customer_photo_upload": {
    "key": "customer_photo_upload",
    "path": "/api/v1/customers/{customerClientId}/photo",
    "method": "POST",
    "authenticated": true,
    "requestType": "CustomerPhotoUploadRequest",
    "responseType": "CustomerPhotoUploadResponse",
    "parameters": [
      {
        "name": "customerClientId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "customer_consent_create": {
    "key": "customer_consent_create",
    "path": "/api/v1/customers/{customerClientId}/consents",
    "method": "POST",
    "authenticated": true,
    "requestType": "CustomerConsentCreateRequest",
    "responseType": "CustomerConsentCreateResponse",
    "parameters": [
      {
        "name": "customerClientId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "travel_groups": {
    "key": "travel_groups",
    "path": "/api/v1/travel_groups",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "TravelGroupList",
    "parameters": [

    ]
  },
  "travel_group_create": {
    "key": "travel_group_create",
    "path": "/api/v1/travel_groups",
    "method": "POST",
    "authenticated": true,
    "requestType": "TravelGroupCreateRequest",
    "responseType": "TravelGroupDetail",
    "parameters": [

    ]
  },
  "travel_group_detail": {
    "key": "travel_group_detail",
    "path": "/api/v1/travel_groups/{travelGroupId}",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "TravelGroupDetail",
    "parameters": [
      {
        "name": "travelGroupId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "travel_group_update": {
    "key": "travel_group_update",
    "path": "/api/v1/travel_groups/{travelGroupId}",
    "method": "PATCH",
    "authenticated": true,
    "requestType": "TravelGroupUpdateRequest",
    "responseType": "TravelGroupDetail",
    "parameters": [
      {
        "name": "travelGroupId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "tours": {
    "key": "tours",
    "path": "/api/v1/tours",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "TourList",
    "parameters": [

    ]
  },
  "tour_detail": {
    "key": "tour_detail",
    "path": "/api/v1/tours/{tourId}",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "TourDetail",
    "parameters": [
      {
        "name": "tourId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  },
  "tour_image": {
    "key": "tour_image",
    "path": "/api/v1/tours/{tourId}/image",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": null,
    "parameters": [
      {
        "name": "tourId",
        "location": "path",
        "required": true,
        "typeName": "Identifier"
      }
    ]
  }
};

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

