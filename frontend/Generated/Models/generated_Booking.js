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
      "name": "category",
      "kind": "enum",
      "typeName": "OfferCategory",
      "required": true,
      "isArray": false,
      "wireName": "category"
    },
    {
      "name": "taxRateBasisPoints",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
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
      "name": "id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "id"
    },
    {
      "name": "category",
      "kind": "enum",
      "typeName": "OfferCategory",
      "required": true,
      "isArray": false,
      "wireName": "category"
    },
    {
      "name": "label",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "label"
    },
    {
      "name": "details",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "details"
    },
    {
      "name": "quantity",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "quantity"
    },
    {
      "name": "unitAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "unitAmountCents"
    },
    {
      "name": "taxRateBasisPoints",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "taxRateBasisPoints"
    },
    {
      "name": "lineTotalAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": false,
      "isArray": false,
      "wireName": "lineTotalAmountCents"
    },
    {
      "name": "currency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": true,
      "isArray": false,
      "wireName": "currency"
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
      "name": "sortOrder",
      "kind": "scalar",
      "typeName": "int",
      "required": false,
      "isArray": false,
      "wireName": "sortOrder"
    },
    {
      "name": "createdAt",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "createdAt"
    },
    {
      "name": "updatedAt",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
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
      "name": "netAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "netAmountCents"
    },
    {
      "name": "taxAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "taxAmountCents"
    },
    {
      "name": "grossAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "grossAmountCents"
    },
    {
      "name": "componentsCount",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
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
      "name": "currency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": true,
      "isArray": false,
      "wireName": "currency"
    },
    {
      "name": "categoryRules",
      "kind": "entity",
      "typeName": "BookingOfferCategoryRule",
      "required": false,
      "isArray": true,
      "wireName": "categoryRules"
    },
    {
      "name": "components",
      "kind": "entity",
      "typeName": "BookingOfferComponent",
      "required": false,
      "isArray": true,
      "wireName": "components"
    },
    {
      "name": "totals",
      "kind": "entity",
      "typeName": "BookingOfferTotals",
      "required": true,
      "isArray": false,
      "wireName": "totals"
    },
    {
      "name": "totalPriceCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
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
      "name": "id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "id"
    },
    {
      "name": "bookingHash",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "bookingHash"
    },
    {
      "name": "customerId",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "customerId"
    },
    {
      "name": "stage",
      "kind": "enum",
      "typeName": "BookingStage",
      "required": true,
      "isArray": false,
      "wireName": "stage"
    },
    {
      "name": "atp_staff",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "atp_staff"
    },
    {
      "name": "atpStaffName",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "atpStaffName"
    },
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
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "notes"
    },
    {
      "name": "pricing",
      "kind": "entity",
      "typeName": "BookingPricing",
      "required": true,
      "isArray": false,
      "wireName": "pricing"
    },
    {
      "name": "offer",
      "kind": "entity",
      "typeName": "BookingOffer",
      "required": true,
      "isArray": false,
      "wireName": "offer"
    },
    {
      "name": "source",
      "kind": "entity",
      "typeName": "SourceAttribution",
      "required": false,
      "isArray": false,
      "wireName": "source"
    },
    {
      "name": "createdAt",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "createdAt"
    },
    {
      "name": "updatedAt",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "updatedAt"
    }
  ]
};

export function validateBooking(value) {
  return __validateShape(value, BOOKING_SCHEMA);
}

