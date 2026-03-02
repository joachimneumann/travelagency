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


export const CUSTOMER_SCHEMA = {
  "name": "Customer",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#Customer",
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
    }
  ]
};

export function validateCustomer(value) {
  return __validateShape(value, CUSTOMER_SCHEMA);
}

export const TOUR_SCHEMA = {
  "name": "Tour",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#Tour",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "title",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "destinationCountries",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": true
    },
    {
      "name": "styles",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": true
    },
    {
      "name": "durationDays",
      "kind": "scalar",
      "typeName": "int",
      "required": false
    },
    {
      "name": "priceFrom",
      "kind": "valueObject",
      "typeName": "TourPriceFrom",
      "required": false
    }
  ]
};

export function validateTour(value) {
  return __validateShape(value, TOUR_SCHEMA);
}

export const TOUR_PRICE_FROM_SCHEMA = {
  "name": "TourPriceFrom",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#TourPriceFrom",
  "fields": [
    {
      "name": "currency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": true
    },
    {
      "name": "minor",
      "kind": "scalar",
      "typeName": "int",
      "required": true
    }
  ]
};

export function validateTourPriceFrom(value) {
  return __validateShape(value, TOUR_PRICE_FROM_SCHEMA);
}

