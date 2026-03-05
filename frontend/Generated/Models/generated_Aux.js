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
      "name": "display_name",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "first_name",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "last_name",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "date_of_birth",
      "kind": "scalar",
      "typeName": "DateOnly",
      "required": false
    },
    {
      "name": "nationality",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "organization_name",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "organization_address",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "organization_phone_number",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "organization_webpage",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "organization_email",
      "kind": "scalar",
      "typeName": "Email",
      "required": false
    },
    {
      "name": "tax_id",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "phone_number",
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
      "name": "address_line_1",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "address_line_2",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "address_city",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "address_state_region",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "address_postal_code",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "address_country_code",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "preferred_language",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "preferred_currency",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "timezone",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "tags",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true
    },
    {
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "can_receive_marketing",
      "kind": "scalar",
      "typeName": "bool",
      "required": true
    },
    {
      "name": "created_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "archived_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": false
    }
  ]
};

export function validateCustomer(value) {
  return __validateShape(value, CUSTOMER_SCHEMA);
}

export const CUSTOMER_CONSENT_SCHEMA = {
  "name": "CustomerConsent",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#CustomerConsent",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "customer_id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "consent_type",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "status",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "captured_via",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "captured_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "evidence_ref",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    }
  ]
};

export function validateCustomerConsent(value) {
  return __validateShape(value, CUSTOMER_CONSENT_SCHEMA);
}

export const CUSTOMER_DOCUMENT_SCHEMA = {
  "name": "CustomerDocument",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#CustomerDocument",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "customer_id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "document_type",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "document_number",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "document_picture_ref",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "issuing_country",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "expires_on",
      "kind": "scalar",
      "typeName": "DateOnly",
      "required": false
    },
    {
      "name": "created_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    }
  ]
};

export function validateCustomerDocument(value) {
  return __validateShape(value, CUSTOMER_DOCUMENT_SCHEMA);
}

export const TRAVEL_GROUP_SCHEMA = {
  "name": "TravelGroup",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#TravelGroup",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "booking_id",
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
      "name": "group_type",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "created_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    }
  ]
};

export function validateTravelGroup(value) {
  return __validateShape(value, TRAVEL_GROUP_SCHEMA);
}

export const TRAVEL_GROUP_MEMBER_SCHEMA = {
  "name": "TravelGroupMember",
  "domain": "aux",
  "module": "entities",
  "sourceType": "entities.#TravelGroupMember",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "travel_group_id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "customer_id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "is_traveling",
      "kind": "scalar",
      "typeName": "bool",
      "required": false
    },
    {
      "name": "member_roles",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": true
    },
    {
      "name": "notes",
      "kind": "scalar",
      "typeName": "string",
      "required": false
    },
    {
      "name": "created_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "Timestamp",
      "required": true
    }
  ]
};

export function validateTravelGroupMember(value) {
  return __validateShape(value, TRAVEL_GROUP_MEMBER_SCHEMA);
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

