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

export const GENERATED_ATP_STAFF_ROLES = Object.freeze([
  "atp_admin",
  "atp_manager",
  "atp_accountant",
  "atp_staff"
]);

export const ATPSTAFF_SCHEMA = {
  "name": "ATPStaff",
  "domain": "atp_staff",
  "module": "entities",
  "sourceType": "openapi.components.schemas.ATPStaff",
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
      "name": "preferredUsername",
      "required": true,
      "wireName": "preferredUsername"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "displayName",
      "required": false,
      "wireName": "displayName"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "email",
      "name": "email",
      "required": false,
      "wireName": "email"
    },
    {
      "kind": "enum",
      "typeName": "ATPStaffRole",
      "isArray": true,
      "enumValues": [
        "atp_admin",
        "atp_manager",
        "atp_accountant",
        "atp_staff"
      ],
      "options": [
        {
          "value": "atp_admin",
          "label": "atp_admin"
        },
        {
          "value": "atp_manager",
          "label": "atp_manager"
        },
        {
          "value": "atp_accountant",
          "label": "atp_accountant"
        },
        {
          "value": "atp_staff",
          "label": "atp_staff"
        }
      ],
      "name": "roles",
      "required": false,
      "wireName": "roles"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "atpStaffId",
      "required": false,
      "wireName": "atpStaffId"
    }
  ]
};

export function validateATPStaff(value) {
  return __validateShape(value, ATPSTAFF_SCHEMA);
}

