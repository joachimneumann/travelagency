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

export const GENERATED_BOOKING_STAGES = Object.freeze([
  "NEW",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "INVOICE_SENT",
  "PAYMENT_RECEIVED",
  "WON",
  "LOST",
  "POST_TRIP"
]);
export const GENERATED_PAYMENT_STATUSES = Object.freeze([
  "PENDING",
  "PAID",
  "VOID"
]);
export const GENERATED_PRICING_ADJUSTMENT_TYPES = Object.freeze([
  "DISCOUNT",
  "CREDIT",
  "SURCHARGE"
]);
export const GENERATED_OFFER_CATEGORIES = Object.freeze([
  "ACCOMMODATION",
  "TRANSPORTATION",
  "TOURS_ACTIVITIES",
  "GUIDE_SUPPORT_SERVICES",
  "MEALS",
  "FEES_TAXES",
  "DISCOUNTS_CREDITS",
  "OTHER"
]);

export const SOURCE_ATTRIBUTION_SCHEMA = {
  "name": "SourceAttribution",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.SourceAttribution",
  "fields": [

  ]
};

export function validateSourceAttribution(value) {
  return __validateShape(value, SOURCE_ATTRIBUTION_SCHEMA);
}

export const BOOKING_ACTIVITY_SCHEMA = {
  "name": "BookingActivity",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingActivity",
  "fields": [
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "id",
      "required": true,
      "wireName": "id"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "bookingId",
      "required": true,
      "wireName": "bookingId"
    },
    {
      "kind": "enum",
      "typeName": "BookingActivityType",
      "isArray": false,
      "enumValues": [
        "BOOKING_CREATED",
        "STAGE_CHANGED",
        "ASSIGNMENT_CHANGED",
        "NOTE_UPDATED",
        "PRICING_UPDATED",
        "OFFER_UPDATED",
        "INVOICE_CREATED",
        "INVOICE_UPDATED",
        "PAYMENT_UPDATED"
      ],
      "options": [
        {
          "value": "BOOKING_CREATED",
          "label": "BOOKING_CREATED"
        },
        {
          "value": "STAGE_CHANGED",
          "label": "STAGE_CHANGED"
        },
        {
          "value": "ASSIGNMENT_CHANGED",
          "label": "ASSIGNMENT_CHANGED"
        },
        {
          "value": "NOTE_UPDATED",
          "label": "NOTE_UPDATED"
        },
        {
          "value": "PRICING_UPDATED",
          "label": "PRICING_UPDATED"
        },
        {
          "value": "OFFER_UPDATED",
          "label": "OFFER_UPDATED"
        },
        {
          "value": "INVOICE_CREATED",
          "label": "INVOICE_CREATED"
        },
        {
          "value": "INVOICE_UPDATED",
          "label": "INVOICE_UPDATED"
        },
        {
          "value": "PAYMENT_UPDATED",
          "label": "PAYMENT_UPDATED"
        }
      ],
      "name": "type",
      "required": true,
      "wireName": "type"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "actor",
      "required": true,
      "wireName": "actor"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "detail",
      "required": true,
      "wireName": "detail"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "createdAt",
      "required": true,
      "wireName": "createdAt"
    }
  ]
};

export function validateBookingActivity(value) {
  return __validateShape(value, BOOKING_ACTIVITY_SCHEMA);
}

export const BOOKING_INVOICE_SCHEMA = {
  "name": "BookingInvoice",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingInvoice",
  "fields": [

  ]
};

export function validateBookingInvoice(value) {
  return __validateShape(value, BOOKING_INVOICE_SCHEMA);
}

export const BOOKING_PRICING_SCHEMA = {
  "name": "BookingPricing",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingPricing",
  "fields": [

  ]
};

export function validateBookingPricing(value) {
  return __validateShape(value, BOOKING_PRICING_SCHEMA);
}

export const BOOKING_OFFER_CATEGORY_RULE_SCHEMA = {
  "name": "BookingOfferCategoryRule",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingOfferCategoryRule",
  "fields": [
    {
      "kind": "enum",
      "typeName": "OfferCategory",
      "isArray": false,
      "enumValues": [
        "ACCOMMODATION",
        "TRANSPORTATION",
        "TOURS_ACTIVITIES",
        "GUIDE_SUPPORT_SERVICES",
        "MEALS",
        "FEES_TAXES",
        "DISCOUNTS_CREDITS",
        "OTHER"
      ],
      "options": [
        {
          "value": "ACCOMMODATION",
          "label": "ACCOMMODATION"
        },
        {
          "value": "TRANSPORTATION",
          "label": "TRANSPORTATION"
        },
        {
          "value": "TOURS_ACTIVITIES",
          "label": "TOURS_ACTIVITIES"
        },
        {
          "value": "GUIDE_SUPPORT_SERVICES",
          "label": "GUIDE_SUPPORT_SERVICES"
        },
        {
          "value": "MEALS",
          "label": "MEALS"
        },
        {
          "value": "FEES_TAXES",
          "label": "FEES_TAXES"
        },
        {
          "value": "DISCOUNTS_CREDITS",
          "label": "DISCOUNTS_CREDITS"
        },
        {
          "value": "OTHER",
          "label": "OTHER"
        }
      ],
      "name": "category",
      "required": true,
      "wireName": "category"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "taxRateBasisPoints",
      "required": true,
      "wireName": "taxRateBasisPoints"
    }
  ]
};

export function validateBookingOfferCategoryRule(value) {
  return __validateShape(value, BOOKING_OFFER_CATEGORY_RULE_SCHEMA);
}

export const BOOKING_OFFER_COMPONENT_SCHEMA = {
  "name": "BookingOfferComponent",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingOfferComponent",
  "fields": [
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "id",
      "required": true,
      "wireName": "id"
    },
    {
      "kind": "enum",
      "typeName": "OfferCategory",
      "isArray": false,
      "enumValues": [
        "ACCOMMODATION",
        "TRANSPORTATION",
        "TOURS_ACTIVITIES",
        "GUIDE_SUPPORT_SERVICES",
        "MEALS",
        "FEES_TAXES",
        "DISCOUNTS_CREDITS",
        "OTHER"
      ],
      "options": [
        {
          "value": "ACCOMMODATION",
          "label": "ACCOMMODATION"
        },
        {
          "value": "TRANSPORTATION",
          "label": "TRANSPORTATION"
        },
        {
          "value": "TOURS_ACTIVITIES",
          "label": "TOURS_ACTIVITIES"
        },
        {
          "value": "GUIDE_SUPPORT_SERVICES",
          "label": "GUIDE_SUPPORT_SERVICES"
        },
        {
          "value": "MEALS",
          "label": "MEALS"
        },
        {
          "value": "FEES_TAXES",
          "label": "FEES_TAXES"
        },
        {
          "value": "DISCOUNTS_CREDITS",
          "label": "DISCOUNTS_CREDITS"
        },
        {
          "value": "OTHER",
          "label": "OTHER"
        }
      ],
      "name": "category",
      "required": true,
      "wireName": "category"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "label",
      "required": true,
      "wireName": "label"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "details",
      "required": false,
      "wireName": "details"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "quantity",
      "required": true,
      "wireName": "quantity"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "unitAmountCents",
      "required": true,
      "wireName": "unitAmountCents"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "taxRateBasisPoints",
      "required": true,
      "wireName": "taxRateBasisPoints"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "lineTotalAmountCents",
      "required": false,
      "wireName": "lineTotalAmountCents"
    },
    {
      "kind": "enum",
      "typeName": "CurrencyCode",
      "isArray": false,
      "enumValues": [
        "USD",
        "EURO",
        "VND",
        "THB"
      ],
      "options": [
        {
          "value": "USD",
          "label": "USD"
        },
        {
          "value": "EURO",
          "label": "EURO"
        },
        {
          "value": "VND",
          "label": "VND"
        },
        {
          "value": "THB",
          "label": "THB"
        }
      ],
      "name": "currency",
      "required": true,
      "wireName": "currency"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "notes",
      "required": false,
      "wireName": "notes"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "sortOrder",
      "required": false,
      "wireName": "sortOrder"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "createdAt",
      "required": false,
      "wireName": "createdAt"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updatedAt",
      "required": false,
      "wireName": "updatedAt"
    }
  ]
};

export function validateBookingOfferComponent(value) {
  return __validateShape(value, BOOKING_OFFER_COMPONENT_SCHEMA);
}

export const BOOKING_OFFER_TOTALS_SCHEMA = {
  "name": "BookingOfferTotals",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingOfferTotals",
  "fields": [
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "netAmountCents",
      "required": true,
      "wireName": "netAmountCents"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "taxAmountCents",
      "required": true,
      "wireName": "taxAmountCents"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "grossAmountCents",
      "required": true,
      "wireName": "grossAmountCents"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "componentsCount",
      "required": true,
      "wireName": "componentsCount"
    }
  ]
};

export function validateBookingOfferTotals(value) {
  return __validateShape(value, BOOKING_OFFER_TOTALS_SCHEMA);
}

export const BOOKING_OFFER_SCHEMA = {
  "name": "BookingOffer",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.BookingOffer",
  "fields": [
    {
      "kind": "enum",
      "typeName": "CurrencyCode",
      "isArray": false,
      "enumValues": [
        "USD",
        "EURO",
        "VND",
        "THB"
      ],
      "options": [
        {
          "value": "USD",
          "label": "USD"
        },
        {
          "value": "EURO",
          "label": "EURO"
        },
        {
          "value": "VND",
          "label": "VND"
        },
        {
          "value": "THB",
          "label": "THB"
        }
      ],
      "name": "currency",
      "required": true,
      "wireName": "currency"
    },
    {
      "kind": "entity",
      "typeName": "BookingOfferCategoryRule",
      "isArray": true,
      "name": "categoryRules",
      "required": false,
      "wireName": "categoryRules"
    },
    {
      "kind": "entity",
      "typeName": "BookingOfferComponent",
      "isArray": true,
      "name": "components",
      "required": false,
      "wireName": "components"
    },
    {
      "kind": "entity",
      "typeName": "BookingOfferTotals",
      "isArray": false,
      "name": "totals",
      "required": true,
      "wireName": "totals"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "totalPriceCents",
      "required": true,
      "wireName": "totalPriceCents"
    }
  ]
};

export function validateBookingOffer(value) {
  return __validateShape(value, BOOKING_OFFER_SCHEMA);
}

export const BOOKING_SCHEMA = {
  "name": "Booking",
  "domain": "booking",
  "module": "entities",
  "sourceType": "openapi.components.schemas.Booking",
  "fields": [
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "id",
      "required": true,
      "wireName": "id"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "booking_hash",
      "required": false,
      "wireName": "booking_hash"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "client_id",
      "required": true,
      "wireName": "client_id"
    },
    {
      "kind": "enum",
      "typeName": "ClientType",
      "isArray": false,
      "enumValues": [
        "customer",
        "travel_group"
      ],
      "options": [
        {
          "value": "customer",
          "label": "customer"
        },
        {
          "value": "travel_group",
          "label": "travel_group"
        }
      ],
      "name": "client_type",
      "required": false,
      "wireName": "client_type"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "client_display_name",
      "required": false,
      "wireName": "client_display_name"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "client_primary_phone_number",
      "required": false,
      "wireName": "client_primary_phone_number"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "email",
      "name": "client_primary_email",
      "required": false,
      "wireName": "client_primary_email"
    },
    {
      "kind": "enum",
      "typeName": "BookingStage",
      "isArray": false,
      "enumValues": [
        "NEW",
        "QUALIFIED",
        "PROPOSAL_SENT",
        "NEGOTIATION",
        "INVOICE_SENT",
        "PAYMENT_RECEIVED",
        "WON",
        "LOST",
        "POST_TRIP"
      ],
      "options": [
        {
          "value": "NEW",
          "label": "NEW"
        },
        {
          "value": "QUALIFIED",
          "label": "QUALIFIED"
        },
        {
          "value": "PROPOSAL_SENT",
          "label": "PROPOSAL_SENT"
        },
        {
          "value": "NEGOTIATION",
          "label": "NEGOTIATION"
        },
        {
          "value": "INVOICE_SENT",
          "label": "INVOICE_SENT"
        },
        {
          "value": "PAYMENT_RECEIVED",
          "label": "PAYMENT_RECEIVED"
        },
        {
          "value": "WON",
          "label": "WON"
        },
        {
          "value": "LOST",
          "label": "LOST"
        },
        {
          "value": "POST_TRIP",
          "label": "POST_TRIP"
        }
      ],
      "name": "stage",
      "required": true,
      "wireName": "stage"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "atp_staff",
      "required": false,
      "wireName": "atp_staff"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "atpStaffName",
      "required": false,
      "wireName": "atpStaffName"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": true,
      "name": "destination",
      "required": false,
      "wireName": "destination"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": true,
      "name": "style",
      "required": false,
      "wireName": "style"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "travelMonth",
      "required": false,
      "wireName": "travelMonth"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "travelers",
      "required": false,
      "wireName": "travelers"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "duration",
      "required": false,
      "wireName": "duration"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "budget",
      "required": false,
      "wireName": "budget"
    },
    {
      "kind": "enum",
      "typeName": "CurrencyCode",
      "isArray": false,
      "enumValues": [
        "USD",
        "EURO",
        "VND",
        "THB"
      ],
      "options": [
        {
          "value": "USD",
          "label": "USD"
        },
        {
          "value": "EURO",
          "label": "EURO"
        },
        {
          "value": "VND",
          "label": "VND"
        },
        {
          "value": "THB",
          "label": "THB"
        }
      ],
      "name": "preferredCurrency",
      "required": false,
      "wireName": "preferredCurrency"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "notes",
      "required": false,
      "wireName": "notes"
    },
    {
      "kind": "entity",
      "typeName": "BookingPricing",
      "isArray": false,
      "name": "pricing",
      "required": true,
      "wireName": "pricing"
    },
    {
      "kind": "entity",
      "typeName": "BookingOffer",
      "isArray": false,
      "name": "offer",
      "required": true,
      "wireName": "offer"
    },
    {
      "kind": "entity",
      "typeName": "SourceAttribution",
      "isArray": false,
      "name": "source",
      "required": false,
      "wireName": "source"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "createdAt",
      "required": true,
      "wireName": "createdAt"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updatedAt",
      "required": true,
      "wireName": "updatedAt"
    }
  ]
};

export function validateBooking(value) {
  return __validateShape(value, BOOKING_SCHEMA);
}

