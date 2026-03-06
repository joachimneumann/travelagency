// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

function __assertObject(value, schemaName) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${schemaName} must be an object`);
  }
}

function __validateShape(value, schema) {
  __assertObject(value, schema.name);
  for (const field of schema.fields) {
    const fieldValue = value[field.name];
    if (field.required && (fieldValue === undefined || fieldValue === null)) {
      throw new TypeError(`${schema.name}.${field.name} is required`);
    }
    if (fieldValue === undefined || fieldValue === null) continue;
    if (field.isArray && !Array.isArray(fieldValue)) {
      throw new TypeError(`${schema.name}.${field.name} must be an array`);
    }
  }
  return value;
}

export const GENERATED_API_ENDPOINTS = [
  {
    "key": "mobile_bootstrap",
    "path": "/public/v1/mobile/bootstrap",
    "method": "GET",
    "authenticated": false,
    "requestType": null,
    "responseType": "MobileBootstrap",
    "parameters": [

    ]
  },
  {
    "key": "auth_me",
    "path": "/auth/me",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "AuthMeResponse",
    "parameters": [

    ]
  },
  {
    "key": "public_bookings",
    "path": "/public/v1/bookings",
    "method": "POST",
    "authenticated": false,
    "requestType": "PublicBookingCreateRequest",
    "responseType": "BookingDetail",
    "parameters": [

    ]
  },
  {
    "key": "public_tours",
    "path": "/public/v1/tours",
    "method": "GET",
    "authenticated": false,
    "requestType": null,
    "responseType": "TourList",
    "parameters": [

    ]
  },
  {
    "key": "bookings",
    "path": "/api/v1/bookings",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "BookingList",
    "parameters": [

    ]
  },
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
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
  {
    "key": "atp_staff",
    "path": "/api/v1/atp_staff",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "AtpStaffListResponse",
    "parameters": [

    ]
  },
  {
    "key": "customers",
    "path": "/api/v1/customers",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "CustomerList",
    "parameters": [

    ]
  },
  {
    "key": "customer_detail",
    "path": "/api/v1/customers/{customerId}",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
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
  {
    "key": "tours",
    "path": "/api/v1/tours",
    "method": "GET",
    "authenticated": true,
    "requestType": null,
    "responseType": "TourList",
    "parameters": [

    ]
  },
  {
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
  {
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
];

export const MOBILE_BOOTSTRAP_SCHEMA = {
  "name": "MobileBootstrap",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.MobileBootstrap",
  "fields": [
    {
      "name": "app",
      "kind": "transport",
      "typeName": "MobileAppVersionGate",
      "required": true,
      "isArray": false,
      "wireName": "app"
    },
    {
      "name": "api",
      "kind": "transport",
      "typeName": "APIContractVersion",
      "required": true,
      "isArray": false,
      "wireName": "api"
    },
    {
      "name": "features",
      "kind": "transport",
      "typeName": "FeatureFlags",
      "required": true,
      "isArray": false,
      "wireName": "features"
    }
  ]
};

export function validateMobileBootstrap(value) {
  return __validateShape(value, MOBILE_BOOTSTRAP_SCHEMA);
}

export const AUTH_ME_RESPONSE_SCHEMA = {
  "name": "AuthMeResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.AuthMeResponse",
  "fields": [
    {
      "name": "authenticated",
      "kind": "scalar",
      "typeName": "bool",
      "required": true,
      "isArray": false,
      "wireName": "authenticated"
    },
    {
      "name": "principal",
      "kind": "transport",
      "typeName": "ATPStaff",
      "required": false,
      "isArray": false,
      "wireName": "principal"
    }
  ]
};

export function validateAuthMeResponse(value) {
  return __validateShape(value, AUTH_ME_RESPONSE_SCHEMA);
}

export const PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA = {
  "name": "PublicBookingCreateRequest",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.PublicBookingCreateRequest",
  "fields": [
    {
      "name": "destination",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "destination"
    },
    {
      "name": "style",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "style"
    },
    {
      "name": "travelMonth",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "travelMonth"
    },
    {
      "name": "travelers",
      "kind": "scalar",
      "typeName": "int",
      "required": false,
      "isArray": false,
      "wireName": "travelers"
    },
    {
      "name": "duration",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "duration"
    },
    {
      "name": "budget",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "budget"
    },
    {
      "name": "preferredCurrency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": false,
      "isArray": false,
      "wireName": "preferredCurrency"
    },
    {
      "name": "name",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "name"
    },
    {
      "name": "email",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "email"
    },
    {
      "name": "phone",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "phone"
    },
    {
      "name": "language",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "language"
    },
    {
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "notes"
    },
    {
      "name": "pageUrl",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "pageUrl"
    },
    {
      "name": "referrer",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "referrer"
    },
    {
      "name": "utmSource",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "utmSource"
    },
    {
      "name": "utmMedium",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "utmMedium"
    },
    {
      "name": "utmCampaign",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "utmCampaign"
    },
    {
      "name": "idempotencyKey",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "idempotencyKey"
    }
  ]
};

export function validatePublicBookingCreateRequest(value) {
  return __validateShape(value, PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA);
}

export const BOOKING_DETAIL_SCHEMA = {
  "name": "BookingDetail",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingDetail",
  "fields": [
    {
      "name": "booking",
      "kind": "transport",
      "typeName": "Booking",
      "required": true,
      "isArray": false,
      "wireName": "booking"
    },
    {
      "name": "customer",
      "kind": "transport",
      "typeName": "Customer",
      "required": false,
      "isArray": false,
      "wireName": "customer"
    }
  ]
};

export function validateBookingDetail(value) {
  return __validateShape(value, BOOKING_DETAIL_SCHEMA);
}

export const TOUR_LIST_SCHEMA = {
  "name": "TourList",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.TourList",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "Tour",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "pagination",
      "kind": "transport",
      "typeName": "Pagination",
      "required": true,
      "isArray": false,
      "wireName": "pagination"
    }
  ]
};

export function validateTourList(value) {
  return __validateShape(value, TOUR_LIST_SCHEMA);
}

export const BOOKING_LIST_SCHEMA = {
  "name": "BookingList",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingList",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "Booking",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "pagination",
      "kind": "transport",
      "typeName": "Pagination",
      "required": true,
      "isArray": false,
      "wireName": "pagination"
    }
  ]
};

export function validateBookingList(value) {
  return __validateShape(value, BOOKING_LIST_SCHEMA);
}

export const BOOKING_CHAT_RESPONSE_SCHEMA = {
  "name": "BookingChatResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingChatResponse",
  "fields": [
    {
      "name": "mode",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "mode"
    },
    {
      "name": "items",
      "kind": "transport",
      "typeName": "BookingChatEvent",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "total"
    },
    {
      "name": "conversations",
      "kind": "transport",
      "typeName": "BookingChatConversation",
      "required": false,
      "isArray": true,
      "wireName": "conversations"
    },
    {
      "name": "conversationTotal",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "conversationTotal"
    }
  ]
};

export function validateBookingChatResponse(value) {
  return __validateShape(value, BOOKING_CHAT_RESPONSE_SCHEMA);
}

export const BOOKING_PRICING_UPDATE_REQUEST_SCHEMA = {
  "name": "BookingPricingUpdateRequest",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingPricingUpdateRequest",
  "fields": [
    {
      "name": "bookingHash",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "bookingHash"
    },
    {
      "name": "pricing",
      "kind": "transport",
      "typeName": "BookingPricing",
      "required": true,
      "isArray": false,
      "wireName": "pricing"
    }
  ]
};

export function validateBookingPricingUpdateRequest(value) {
  return __validateShape(value, BOOKING_PRICING_UPDATE_REQUEST_SCHEMA);
}

export const BOOKING_OFFER_UPDATE_REQUEST_SCHEMA = {
  "name": "BookingOfferUpdateRequest",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingOfferUpdateRequest",
  "fields": [
    {
      "name": "bookingHash",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "bookingHash"
    },
    {
      "name": "offer",
      "kind": "transport",
      "typeName": "BookingOffer",
      "required": true,
      "isArray": false,
      "wireName": "offer"
    }
  ]
};

export function validateBookingOfferUpdateRequest(value) {
  return __validateShape(value, BOOKING_OFFER_UPDATE_REQUEST_SCHEMA);
}

export const BOOKING_ACTIVITIES_RESPONSE_SCHEMA = {
  "name": "BookingActivitiesResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingActivitiesResponse",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "BookingActivity",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "activities",
      "kind": "transport",
      "typeName": "BookingActivity",
      "required": false,
      "isArray": true,
      "wireName": "activities"
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "total"
    }
  ]
};

export function validateBookingActivitiesResponse(value) {
  return __validateShape(value, BOOKING_ACTIVITIES_RESPONSE_SCHEMA);
}

export const BOOKING_INVOICES_RESPONSE_SCHEMA = {
  "name": "BookingInvoicesResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingInvoicesResponse",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "BookingInvoice",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "total"
    }
  ]
};

export function validateBookingInvoicesResponse(value) {
  return __validateShape(value, BOOKING_INVOICES_RESPONSE_SCHEMA);
}

export const ATP_STAFF_LIST_RESPONSE_SCHEMA = {
  "name": "AtpStaffListResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.AtpStaffListResponse",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "AtpStaffDirectoryEntry",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "total"
    }
  ]
};

export function validateAtpStaffListResponse(value) {
  return __validateShape(value, ATP_STAFF_LIST_RESPONSE_SCHEMA);
}

export const CUSTOMER_LIST_SCHEMA = {
  "name": "CustomerList",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.CustomerList",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "Customer",
      "required": false,
      "isArray": true,
      "wireName": "items"
    },
    {
      "name": "pagination",
      "kind": "transport",
      "typeName": "Pagination",
      "required": true,
      "isArray": false,
      "wireName": "pagination"
    }
  ]
};

export function validateCustomerList(value) {
  return __validateShape(value, CUSTOMER_LIST_SCHEMA);
}

export const CUSTOMER_DETAIL_SCHEMA = {
  "name": "CustomerDetail",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.CustomerDetail",
  "fields": [
    {
      "name": "customer",
      "kind": "transport",
      "typeName": "Customer",
      "required": true,
      "isArray": false,
      "wireName": "customer"
    },
    {
      "name": "bookings",
      "kind": "transport",
      "typeName": "Booking",
      "required": false,
      "isArray": true,
      "wireName": "bookings"
    },
    {
      "name": "consents",
      "kind": "transport",
      "typeName": "CustomerConsent",
      "required": false,
      "isArray": true,
      "wireName": "consents"
    },
    {
      "name": "documents",
      "kind": "transport",
      "typeName": "CustomerDocument",
      "required": false,
      "isArray": true,
      "wireName": "documents"
    },
    {
      "name": "travelGroups",
      "kind": "transport",
      "typeName": "TravelGroup",
      "required": false,
      "isArray": true,
      "wireName": "travelGroups"
    },
    {
      "name": "travelGroupMembers",
      "kind": "transport",
      "typeName": "TravelGroupMember",
      "required": false,
      "isArray": true,
      "wireName": "travelGroupMembers"
    }
  ]
};

export function validateCustomerDetail(value) {
  return __validateShape(value, CUSTOMER_DETAIL_SCHEMA);
}

export const TOUR_DETAIL_SCHEMA = {
  "name": "TourDetail",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.TourDetail",
  "fields": [
    {
      "name": "tour",
      "kind": "transport",
      "typeName": "Tour",
      "required": true,
      "isArray": false,
      "wireName": "tour"
    },
    {
      "name": "options",
      "kind": "transport",
      "typeName": "TourOptions",
      "required": true,
      "isArray": false,
      "wireName": "options"
    }
  ]
};

export function validateTourDetail(value) {
  return __validateShape(value, TOUR_DETAIL_SCHEMA);
}

export const MOBILE_APP_VERSION_GATE_SCHEMA = {
  "name": "MobileAppVersionGate",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.MobileAppVersionGate",
  "fields": [
    {
      "name": "minSupportedVersion",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "minSupportedVersion"
    },
    {
      "name": "latestVersion",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "latestVersion"
    },
    {
      "name": "forceUpdate",
      "kind": "scalar",
      "typeName": "bool",
      "required": true,
      "isArray": false,
      "wireName": "forceUpdate"
    }
  ]
};

export function validateMobileAppVersionGate(value) {
  return __validateShape(value, MOBILE_APP_VERSION_GATE_SCHEMA);
}

export const APICONTRACT_VERSION_SCHEMA = {
  "name": "APIContractVersion",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.APIContractVersion",
  "fields": [
    {
      "name": "contractVersion",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "contractVersion"
    }
  ]
};

export function validateAPIContractVersion(value) {
  return __validateShape(value, APICONTRACT_VERSION_SCHEMA);
}

export const FEATURE_FLAGS_SCHEMA = {
  "name": "FeatureFlags",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.FeatureFlags",
  "fields": [
    {
      "name": "bookings",
      "kind": "scalar",
      "typeName": "bool",
      "required": true,
      "isArray": false,
      "wireName": "bookings"
    },
    {
      "name": "customers",
      "kind": "scalar",
      "typeName": "bool",
      "required": true,
      "isArray": false,
      "wireName": "customers"
    },
    {
      "name": "tours",
      "kind": "scalar",
      "typeName": "bool",
      "required": true,
      "isArray": false,
      "wireName": "tours"
    }
  ]
};

export function validateFeatureFlags(value) {
  return __validateShape(value, FEATURE_FLAGS_SCHEMA);
}

export const PAGINATION_SCHEMA = {
  "name": "Pagination",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.Pagination",
  "fields": [
    {
      "name": "page",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "page"
    },
    {
      "name": "pageSize",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "pageSize"
    },
    {
      "name": "totalItems",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "totalItems"
    }
  ]
};

export function validatePagination(value) {
  return __validateShape(value, PAGINATION_SCHEMA);
}

export const BOOKING_CHAT_EVENT_SCHEMA = {
  "name": "BookingChatEvent",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingChatEvent",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "id"
    },
    {
      "name": "channel",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "channel"
    },
    {
      "name": "direction",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "direction"
    },
    {
      "name": "eventType",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "eventType"
    },
    {
      "name": "externalStatus",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "externalStatus"
    },
    {
      "name": "textPreview",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "textPreview"
    },
    {
      "name": "senderDisplay",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "senderDisplay"
    },
    {
      "name": "senderContact",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "senderContact"
    },
    {
      "name": "sentAt",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "sentAt"
    },
    {
      "name": "receivedAt",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "receivedAt"
    },
    {
      "name": "conversationId",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "conversationId"
    },
    {
      "name": "openUrl",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "openUrl"
    }
  ]
};

export function validateBookingChatEvent(value) {
  return __validateShape(value, BOOKING_CHAT_EVENT_SCHEMA);
}

export const BOOKING_CHAT_CONVERSATION_SCHEMA = {
  "name": "BookingChatConversation",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.BookingChatConversation",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "id"
    },
    {
      "name": "channel",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "channel"
    },
    {
      "name": "externalContactId",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "externalContactId"
    },
    {
      "name": "customerId",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "customerId"
    },
    {
      "name": "bookingId",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "bookingId"
    },
    {
      "name": "lastEventAt",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "lastEventAt"
    },
    {
      "name": "latestPreview",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "latestPreview"
    },
    {
      "name": "openUrl",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "openUrl"
    }
  ]
};

export function validateBookingChatConversation(value) {
  return __validateShape(value, BOOKING_CHAT_CONVERSATION_SCHEMA);
}

export const ATP_STAFF_DIRECTORY_ENTRY_SCHEMA = {
  "name": "AtpStaffDirectoryEntry",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.AtpStaffDirectoryEntry",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "id"
    },
    {
      "name": "name",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "name"
    },
    {
      "name": "active",
      "kind": "scalar",
      "typeName": "bool",
      "required": false,
      "isArray": false,
      "wireName": "active"
    },
    {
      "name": "usernames",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "usernames"
    },
    {
      "name": "destinations",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "destinations"
    },
    {
      "name": "languages",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "languages"
    }
  ]
};

export function validateAtpStaffDirectoryEntry(value) {
  return __validateShape(value, ATP_STAFF_DIRECTORY_ENTRY_SCHEMA);
}

export const TOUR_OPTIONS_SCHEMA = {
  "name": "TourOptions",
  "domain": "api",
  "module": "api",
  "sourceType": "openapi.components.schemas.TourOptions",
  "fields": [
    {
      "name": "destinations",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "destinations"
    },
    {
      "name": "styles",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "styles"
    }
  ]
};

export function validateTourOptions(value) {
  return __validateShape(value, TOUR_OPTIONS_SCHEMA);
}

