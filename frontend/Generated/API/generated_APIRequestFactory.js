// Generated from the normalized model IR exported from model/ir.
// Do not edit by hand.

export const GENERATED_CONTRACT_VERSION = "0.1.0";
export const GENERATED_API_ENDPOINTS = {
  "mobile_bootstrap": {
    "key": "mobile_bootstrap",
    "path": "/public/v1/mobile/bootstrap",
    "method": "GET",
    "authenticated": false,
    "responseType": "MobileBootstrap"
  },
  "auth_me": {
    "key": "auth_me",
    "path": "/auth/me",
    "method": "GET",
    "authenticated": true,
    "responseType": "AuthMeResponse"
  },
  "public_bookings": {
    "key": "public_bookings",
    "path": "/public/v1/bookings",
    "method": "POST",
    "authenticated": false,
    "requestType": "PublicBookingCreateRequest",
    "responseType": "BookingDetail"
  },
  "public_tours": {
    "key": "public_tours",
    "path": "/public/v1/tours",
    "method": "GET",
    "authenticated": false,
    "responseType": "TourList"
  },
  "bookings": {
    "key": "bookings",
    "path": "/api/v1/bookings",
    "method": "GET",
    "authenticated": true,
    "responseType": "BookingList"
  },
  "booking_detail": {
    "key": "booking_detail",
    "path": "/api/v1/bookings/{bookingId}",
    "method": "GET",
    "authenticated": true,
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
  "booking_stage": {
    "key": "booking_stage",
    "path": "/api/v1/bookings/{bookingId}/stage",
    "method": "PATCH",
    "authenticated": true,
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
  "booking_activities": {
    "key": "booking_activities",
    "path": "/api/v1/bookings/{bookingId}/activities",
    "method": "GET",
    "authenticated": true,
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
  "staff": {
    "key": "staff",
    "path": "/api/v1/staff",
    "method": "GET",
    "authenticated": true,
    "responseType": "StaffListResponse"
  },
  "customers": {
    "key": "customers",
    "path": "/api/v1/customers",
    "method": "GET",
    "authenticated": true,
    "responseType": "CustomerList"
  },
  "customer_detail": {
    "key": "customer_detail",
    "path": "/api/v1/customers/{customerId}",
    "method": "GET",
    "authenticated": true,
    "responseType": "CustomerDetail",
    "parameters": [
      {
        "name": "customerId",
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
    "responseType": "TourList"
  },
  "tour_detail": {
    "key": "tour_detail",
    "path": "/api/v1/tours/{tourId}",
    "method": "GET",
    "authenticated": true,
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
  return template.replace(/{(w+)}/g, (_, key) => {
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

export function staffPath(params = {}) {
  return buildPath("/api/v1/staff", params);
}

export function staffRequest({ baseURL = '', params = {}, query = {}, body, headers = {} } = {}) {
  const path = staffPath(params);
  const url = buildURL(baseURL, path, query);
  return {
    key: "staff",
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
  return buildPath("/api/v1/customers/{customerId}", params);
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

