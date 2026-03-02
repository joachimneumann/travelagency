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
      "name": "staff",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": false
    },
    {
      "name": "staffName",
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

