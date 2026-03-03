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
  "sourceType": "entities.#ATPStaff",
  "fields": [
    {
      "name": "id",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": true
    },
    {
      "name": "preferredUsername",
      "kind": "scalar",
      "typeName": "string",
      "required": true
    },
    {
      "name": "displayName",
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
      "name": "roles",
      "kind": "enum",
      "typeName": "ATPStaffRole",
      "required": true,
      "isArray": true
    },
    {
      "name": "staffId",
      "kind": "scalar",
      "typeName": "Identifier",
      "required": false
    }
  ]
};

export function validateATPStaff(value) {
  return __validateShape(value, ATPSTAFF_SCHEMA);
}

