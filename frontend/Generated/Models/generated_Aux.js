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


export const CUSTOMER_SCHEMA = {
  "name": "Customer",
  "domain": "aux",
  "module": "entities",
  "sourceType": "openapi.components.schemas.Customer",
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
      "name": "title",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "title"
    },
    {
      "name": "first_name",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "first_name"
    },
    {
      "name": "last_name",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "last_name"
    },
    {
      "name": "date_of_birth",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "date_of_birth"
    },
    {
      "name": "nationality",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "nationality"
    },
    {
      "name": "address_line_1",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "address_line_1"
    },
    {
      "name": "address_line_2",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "address_line_2"
    },
    {
      "name": "address_city",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "address_city"
    },
    {
      "name": "address_state_region",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "address_state_region"
    },
    {
      "name": "address_postal_code",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "address_postal_code"
    },
    {
      "name": "address_country_code",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "address_country_code"
    },
    {
      "name": "organization_name",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "organization_name"
    },
    {
      "name": "organization_address",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "organization_address"
    },
    {
      "name": "organization_phone_number",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "organization_phone_number"
    },
    {
      "name": "organization_webpage",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "organization_webpage"
    },
    {
      "name": "organization_email",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "organization_email"
    },
    {
      "name": "tax_id",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "tax_id"
    },
    {
      "name": "phone_number",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "phone_number"
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
      "name": "preferred_language",
      "kind": "enum",
      "typeName": "LanguageCode",
      "required": false,
      "isArray": false,
      "wireName": "preferred_language"
    },
    {
      "name": "preferred_currency",
      "kind": "enum",
      "typeName": "CurrencyCode",
      "required": false,
      "isArray": false,
      "wireName": "preferred_currency"
    },
    {
      "name": "timezone",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "timezone"
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
      "name": "created_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "created_at"
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "updated_at"
    },
    {
      "name": "archived_at",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "archived_at"
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
  "sourceType": "openapi.components.schemas.CustomerConsent",
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
      "name": "customer_id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "customer_id"
    },
    {
      "name": "consent_type",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "consent_type"
    },
    {
      "name": "status",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "status"
    },
    {
      "name": "captured_via",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "captured_via"
    },
    {
      "name": "captured_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "captured_at"
    },
    {
      "name": "evidence_ref",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "evidence_ref"
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "updated_at"
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
  "sourceType": "openapi.components.schemas.CustomerDocument",
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
      "name": "customer_id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "customer_id"
    },
    {
      "name": "document_type",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "document_type"
    },
    {
      "name": "document_number",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "document_number"
    },
    {
      "name": "document_picture_ref",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "document_picture_ref"
    },
    {
      "name": "issuing_country",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "issuing_country"
    },
    {
      "name": "expires_on",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "expires_on"
    },
    {
      "name": "created_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "created_at"
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "updated_at"
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
  "sourceType": "openapi.components.schemas.TravelGroup",
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
      "name": "booking_id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "booking_id"
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
      "name": "group_type",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "group_type"
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
      "name": "created_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "created_at"
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "updated_at"
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
  "sourceType": "openapi.components.schemas.TravelGroupMember",
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
      "name": "travel_group_id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "travel_group_id"
    },
    {
      "name": "customer_id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "customer_id"
    },
    {
      "name": "is_traveling",
      "kind": "scalar",
      "typeName": "bool",
      "required": false,
      "isArray": false,
      "wireName": "is_traveling"
    },
    {
      "name": "member_roles",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "member_roles"
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
      "name": "created_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "created_at"
    },
    {
      "name": "updated_at",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "updated_at"
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
  "sourceType": "openapi.components.schemas.Tour",
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
      "name": "title",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "title"
    },
    {
      "name": "destinationCountries",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "destinationCountries"
    },
    {
      "name": "styles",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": true,
      "wireName": "styles"
    },
    {
      "name": "durationDays",
      "kind": "scalar",
      "typeName": "int",
      "required": false,
      "isArray": false,
      "wireName": "durationDays"
    },
    {
      "name": "priceFrom",
      "kind": "entity",
      "typeName": "TourPriceFrom",
      "required": false,
      "isArray": false,
      "wireName": "priceFrom"
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
  "sourceType": "openapi.components.schemas.TourPriceFrom",
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
      "name": "minor",
      "kind": "scalar",
      "typeName": "int",
      "required": true,
      "isArray": false,
      "wireName": "minor"
    }
  ]
};

export function validateTourPriceFrom(value) {
  return __validateShape(value, TOUR_PRICE_FROM_SCHEMA);
}

