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

export const BOOKING_SCHEMA = {
  "name": "Booking",
  "domain": "booking",
  "module": "entities",
  "sourceType": "entities.#Booking",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "bookingHash",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "customerId",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "stage",
      "kind": "enum",
      "typeName": "BookingStage",
      "required": true
    },
    {
      "name": "atp_staff",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": false
    },
    {
      "name": "atpStaffName",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
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
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "pricing",
      "kind": "valueObject",
      "typeName": "BookingPricing",
      "required": true
    },
    {
      "name": "offer",
      "kind": "valueObject",
      "typeName": "BookingOffer",
      "required": true
    },
    {
      "name": "source",
      "kind": "valueObject",
      "typeName": "SourceAttribution",
      "required": false
    },
    {
      "name": "createdAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "updatedAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    }
  ]
};

export function validateBooking(value) {
  return __validateShape(value, BOOKING_SCHEMA);
}

export const BOOKING_OFFER_CATEGORY_RULE_SCHEMA = {
  "name": "BookingOfferCategoryRule",
  "domain": "booking",
  "module": "entities",
  "sourceType": "entities.#BookingOfferCategoryRule",
  "fields": [
    {
      "name": "category",
      "kind": "enum",
      "typeName": "OfferCategory",
      "required": true
    },
    {
      "name": "taxRateBasisPoints",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validateBookingOfferCategoryRule(value) {
  return __validateShape(value, BOOKING_OFFER_CATEGORY_RULE_SCHEMA);
}

export const BOOKING_OFFER_ITEM_SCHEMA = {
  "name": "BookingOfferItem",
  "domain": "booking",
  "module": "entities",
  "sourceType": "entities.#BookingOfferItem",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "category",
      "kind": "enum",
      "typeName": "OfferCategory",
      "required": true
    },
    {
      "name": "label",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "details",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "quantity",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "unitAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "taxRateBasisPoints",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "lineTotalAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": false
    },
    {
      "name": "currency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": true
    },
    {
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "sortOrder",
      "kind": "scalar",
      "typeName": "int",
      "required": false
    },
    {
      "name": "createdAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": false
    },
    {
      "name": "updatedAt",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": false
    }
  ]
};

export function validateBookingOfferItem(value) {
  return __validateShape(value, BOOKING_OFFER_ITEM_SCHEMA);
}

export const BOOKING_OFFER_TOTALS_SCHEMA = {
  "name": "BookingOfferTotals",
  "domain": "booking",
  "module": "entities",
  "sourceType": "entities.#BookingOfferTotals",
  "fields": [
    {
      "name": "netAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "taxAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "grossAmountCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    },
    {
      "name": "itemsCount",
      "kind": "scalar",
      "typeName": "int",
      "required": true
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
  "sourceType": "entities.#BookingOffer",
  "fields": [
    {
      "name": "currency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": true
    },
    {
      "name": "categoryRules",
      "kind": "valueObject",
      "typeName": "BookingOfferCategoryRule",
      "required": true,
      "isArray": true
    },
    {
      "name": "items",
      "kind": "valueObject",
      "typeName": "BookingOfferItem",
      "required": true,
      "isArray": true
    },
    {
      "name": "totals",
      "kind": "valueObject",
      "typeName": "BookingOfferTotals",
      "required": true
    },
    {
      "name": "totalPriceCents",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validateBookingOffer(value) {
  return __validateShape(value, BOOKING_OFFER_SCHEMA);
}

