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
      "name": "id",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "id"
    },
    {
      "name": "preferredUsername",
      "kind": "scalar",
      "typeName": "string",
      "required": true,
      "isArray": false,
      "wireName": "preferredUsername"
    },
    {
      "name": "displayName",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "displayName"
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
      "name": "roles",
      "kind": "enum",
      "typeName": "ATPStaffRole",
      "required": false,
      "isArray": true,
      "wireName": "roles"
    },
    {
      "name": "atpStaffId",
      "kind": "scalar",
      "typeName": "string",
      "required": false,
      "isArray": false,
      "wireName": "atpStaffId"
    }
  ]
};

export function validateATPStaff(value) {
  return __validateShape(value, ATPSTAFF_SCHEMA);
}

