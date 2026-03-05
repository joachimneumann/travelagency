// Generated from the normalized model IR exported from model/ir.
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
    "responseType": "MobileBootstrap"
  },
  {
    "key": "auth_me",
    "path": "/auth/me",
    "method": "GET",
    "authenticated": true,
    "responseType": "AuthMeResponse"
  },
  {
    "key": "public_bookings",
    "path": "/public/v1/bookings",
    "method": "POST",
    "authenticated": false,
    "requestType": "PublicBookingCreateRequest",
    "responseType": "BookingDetail"
  },
  {
    "key": "public_tours",
    "path": "/public/v1/tours",
    "method": "GET",
    "authenticated": false,
    "responseType": "TourList"
  },
  {
    "key": "bookings",
    "path": "/api/v1/bookings",
    "method": "GET",
    "authenticated": true,
    "responseType": "BookingList"
  },
  {
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
  {
    "key": "booking_chat",
    "path": "/api/v1/bookings/{bookingId}/chat",
    "method": "GET",
    "authenticated": true,
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
    "responseType": "AtpStaffListResponse"
  },
  {
    "key": "customers",
    "path": "/api/v1/customers",
    "method": "GET",
    "authenticated": true,
    "responseType": "CustomerList"
  },
  {
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
  {
    "key": "tours",
    "path": "/api/v1/tours",
    "method": "GET",
    "authenticated": true,
    "responseType": "TourList"
  },
  {
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
  {
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
];

export const BOOKING_LIST_SCHEMA = {
  "name": "BookingList",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#BookingList",
  "fields": [
    {
      "name": "items",
      "kind": "entity",
      "typeName": "Booking",
      "required": true,
      "isArray": true
    },
    {
      "name": "pagination",
      "kind": "transport",
      "typeName": "Pagination",
      "required": true
    }
  ]
};

export function validateBookingList(value) {
  return __validateShape(value, BOOKING_LIST_SCHEMA);
}

export const CUSTOMER_LIST_SCHEMA = {
  "name": "CustomerList",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#CustomerList",
  "fields": [
    {
      "name": "items",
      "kind": "entity",
      "typeName": "Customer",
      "required": true,
      "isArray": true
    },
    {
      "name": "pagination",
      "kind": "transport",
      "typeName": "Pagination",
      "required": true
    }
  ]
};

export function validateCustomerList(value) {
  return __validateShape(value, CUSTOMER_LIST_SCHEMA);
}

export const TOUR_LIST_SCHEMA = {
  "name": "TourList",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#TourList",
  "fields": [
    {
      "name": "items",
      "kind": "entity",
      "typeName": "Tour",
      "required": true,
      "isArray": true
    },
    {
      "name": "pagination",
      "kind": "transport",
      "typeName": "Pagination",
      "required": true
    }
  ]
};

export function validateTourList(value) {
  return __validateShape(value, TOUR_LIST_SCHEMA);
}

export const BOOKING_DETAIL_SCHEMA = {
  "name": "BookingDetail",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#BookingDetail",
  "fields": [
    {
      "name": "booking",
      "kind": "entity",
      "typeName": "Booking",
      "required": true
    },
    {
      "name": "customer",
      "kind": "entity",
      "typeName": "Customer",
      "required": false
    }
  ]
};

export function validateBookingDetail(value) {
  return __validateShape(value, BOOKING_DETAIL_SCHEMA);
}

export const CUSTOMER_DETAIL_SCHEMA = {
  "name": "CustomerDetail",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#CustomerDetail",
  "fields": [
    {
      "name": "customer",
      "kind": "entity",
      "typeName": "Customer",
      "required": true
    },
    {
      "name": "bookings",
      "kind": "entity",
      "typeName": "Booking",
      "required": true,
      "isArray": true
    },
    {
      "name": "consents",
      "kind": "entity",
      "typeName": "CustomerConsent",
      "required": true,
      "isArray": true
    },
    {
      "name": "documents",
      "kind": "entity",
      "typeName": "CustomerDocument",
      "required": true,
      "isArray": true
    },
    {
      "name": "travelGroups",
      "kind": "entity",
      "typeName": "TravelGroup",
      "required": true,
      "isArray": true
    },
    {
      "name": "travelGroupMembers",
      "kind": "entity",
      "typeName": "TravelGroupMember",
      "required": true,
      "isArray": true
    }
  ]
};

export function validateCustomerDetail(value) {
  return __validateShape(value, CUSTOMER_DETAIL_SCHEMA);
}

export const TOUR_OPTIONS_SCHEMA = {
  "name": "TourOptions",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#TourOptions",
  "fields": [
    {
      "name": "destinations",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true
    },
    {
      "name": "styles",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true
    }
  ]
};

export function validateTourOptions(value) {
  return __validateShape(value, TOUR_OPTIONS_SCHEMA);
}

export const TOUR_DETAIL_SCHEMA = {
  "name": "TourDetail",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#TourDetail",
  "fields": [
    {
      "name": "tour",
      "kind": "entity",
      "typeName": "Tour",
      "required": true
    },
    {
      "name": "options",
      "kind": "transport",
      "typeName": "TourOptions",
      "required": true
    }
  ]
};

export function validateTourDetail(value) {
  return __validateShape(value, TOUR_DETAIL_SCHEMA);
}

export const ATP_STAFF_DIRECTORY_ENTRY_SCHEMA = {
  "name": "AtpStaffDirectoryEntry",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#AtpStaffDirectoryEntry",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "name",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "active",
      "kind": "scalar",
      "typeName": "bool",
      "required": false
    },
    {
      "name": "usernames",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true
    },
    {
      "name": "destinations",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true
    },
    {
      "name": "languages",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true
    }
  ]
};

export function validateAtpStaffDirectoryEntry(value) {
  return __validateShape(value, ATP_STAFF_DIRECTORY_ENTRY_SCHEMA);
}

export const ATP_STAFF_LIST_RESPONSE_SCHEMA = {
  "name": "AtpStaffListResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#AtpStaffListResponse",
  "fields": [
    {
      "name": "items",
      "kind": "transport",
      "typeName": "AtpStaffDirectoryEntry",
      "required": true,
      "isArray": true
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validateAtpStaffListResponse(value) {
  return __validateShape(value, ATP_STAFF_LIST_RESPONSE_SCHEMA);
}

export const BOOKING_ACTIVITIES_RESPONSE_SCHEMA = {
  "name": "BookingActivitiesResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#BookingActivitiesResponse",
  "fields": [
    {
      "name": "items",
      "kind": "valueObject",
      "typeName": "BookingActivity",
      "required": true,
      "isArray": true
    },
    {
      "name": "activities",
      "kind": "valueObject",
      "typeName": "BookingActivity",
      "required": true,
      "isArray": true
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true
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
  "sourceType": "api.#BookingInvoicesResponse",
  "fields": [
    {
      "name": "items",
      "kind": "valueObject",
      "typeName": "BookingInvoice",
      "required": true,
      "isArray": true
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validateBookingInvoicesResponse(value) {
  return __validateShape(value, BOOKING_INVOICES_RESPONSE_SCHEMA);
}

export const BOOKING_CHAT_EVENT_SCHEMA = {
  "name": "BookingChatEvent",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#BookingChatEvent",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "channel",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "direction",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "eventType",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "externalStatus",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "textPreview",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "senderDisplay",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "senderContact",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "sentAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": false
    },
    {
      "name": "receivedAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": false
    },
    {
      "name": "conversationId",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "openUrl",
      "kind": "scalar",
      "typeName": "string",
      "required": false
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
  "sourceType": "api.#BookingChatConversation",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "channel",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "externalContactId",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "customerId",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": false
    },
    {
      "name": "bookingId",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": false
    },
    {
      "name": "lastEventAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": false
    },
    {
      "name": "latestPreview",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "openUrl",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    }
  ]
};

export function validateBookingChatConversation(value) {
  return __validateShape(value, BOOKING_CHAT_CONVERSATION_SCHEMA);
}

export const BOOKING_CHAT_RESPONSE_SCHEMA = {
  "name": "BookingChatResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#BookingChatResponse",
  "fields": [
    {
      "name": "mode",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "items",
      "kind": "transport",
      "typeName": "BookingChatEvent",
      "required": true,
      "isArray": true
    },
    {
      "name": "total",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "conversations",
      "kind": "transport",
      "typeName": "BookingChatConversation",
      "required": true,
      "isArray": true
    },
    {
      "name": "conversationTotal",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validateBookingChatResponse(value) {
  return __validateShape(value, BOOKING_CHAT_RESPONSE_SCHEMA);
}

export const MOBILE_BOOTSTRAP_SCHEMA = {
  "name": "MobileBootstrap",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#MobileBootstrap",
  "fields": [
    {
      "name": "app",
      "kind": "transport",
      "typeName": "MobileAppVersionGate",
      "required": true
    },
    {
      "name": "api",
      "kind": "transport",
      "typeName": "APIContractVersion",
      "required": true
    },
    {
      "name": "features",
      "kind": "transport",
      "typeName": "FeatureFlags",
      "required": true
    }
  ]
};

export function validateMobileBootstrap(value) {
  return __validateShape(value, MOBILE_BOOTSTRAP_SCHEMA);
}

export const FEATURE_FLAGS_SCHEMA = {
  "name": "FeatureFlags",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#FeatureFlags",
  "fields": [
    {
      "name": "bookings",
      "kind": "scalar",
      "typeName": "bool",
      "required": true
    },
    {
      "name": "customers",
      "kind": "scalar",
      "typeName": "bool",
      "required": true
    },
    {
      "name": "tours",
      "kind": "scalar",
      "typeName": "bool",
      "required": true
    }
  ]
};

export function validateFeatureFlags(value) {
  return __validateShape(value, FEATURE_FLAGS_SCHEMA);
}

export const MOBILE_APP_VERSION_GATE_SCHEMA = {
  "name": "MobileAppVersionGate",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#MobileAppVersionGate",
  "fields": [
    {
      "name": "minSupportedVersion",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "latestVersion",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "forceUpdate",
      "kind": "scalar",
      "typeName": "bool",
      "required": true
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
  "sourceType": "api.#APIContractVersion",
  "fields": [
    {
      "name": "contractVersion",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    }
  ]
};

export function validateAPIContractVersion(value) {
  return __validateShape(value, APICONTRACT_VERSION_SCHEMA);
}

export const PAGINATION_SCHEMA = {
  "name": "Pagination",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#Pagination",
  "fields": [
    {
      "name": "page",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "pageSize",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "totalItems",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validatePagination(value) {
  return __validateShape(value, PAGINATION_SCHEMA);
}

export const PAGINATED_REQUEST_SCHEMA = {
  "name": "PaginatedRequest",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#PaginatedRequest",
  "fields": [
    {
      "name": "page",
      "kind": "scalar",
      "typeName": "int",
      "required": false
    },
    {
      "name": "pageSize",
      "kind": "scalar",
      "typeName": "int",
      "required": false
    },
    {
      "name": "sort",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "query",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    }
  ]
};

export function validatePaginatedRequest(value) {
  return __validateShape(value, PAGINATED_REQUEST_SCHEMA);
}

export const AUTH_ME_RESPONSE_SCHEMA = {
  "name": "AuthMeResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#AuthMeResponse",
  "fields": [
    {
      "name": "authenticated",
      "kind": "scalar",
      "typeName": "bool",
      "required": true
    },
    {
      "name": "principal",
      "kind": "entity",
      "typeName": "ATPStaff",
      "required": false
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
  "sourceType": "api.#PublicBookingCreateRequest",
  "fields": [
    {
      "name": "destination",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "style",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "travelMonth",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "travelers",
      "kind": "scalar",
      "typeName": "int",
      "required": false
    },
    {
      "name": "duration",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "budget",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "preferredCurrency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": false
    },
    {
      "name": "name",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "email",
      "kind": "scalar",
      "typeName": "Email",
      "required": false
    },
    {
      "name": "phone",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "language",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "pageUrl",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "referrer",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "utmSource",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "utmMedium",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "utmCampaign",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "idempotencyKey",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    }
  ]
};

export function validatePublicBookingCreateRequest(value) {
  return __validateShape(value, PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA);
}

export const BOOKING_PRICING_UPDATE_REQUEST_SCHEMA = {
  "name": "BookingPricingUpdateRequest",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#BookingPricingUpdateRequest",
  "fields": [
    {
      "name": "bookingHash",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "pricing",
      "kind": "valueObject",
      "typeName": "BookingPricing",
      "required": true
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
  "sourceType": "api.#BookingOfferUpdateRequest",
  "fields": [
    {
      "name": "bookingHash",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "offer",
      "kind": "valueObject",
      "typeName": "BookingOffer",
      "required": true
    }
  ]
};

export function validateBookingOfferUpdateRequest(value) {
  return __validateShape(value, BOOKING_OFFER_UPDATE_REQUEST_SCHEMA);
}

export const ERROR_RESPONSE_SCHEMA = {
  "name": "ErrorResponse",
  "domain": "api",
  "module": "api",
  "sourceType": "api.#ErrorResponse",
  "fields": [
    {
      "name": "error",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "detail",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "code",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    }
  ]
};

export function validateErrorResponse(value) {
  return __validateShape(value, ERROR_RESPONSE_SCHEMA);
}

