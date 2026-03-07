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
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "client_id",
      "required": true,
      "wireName": "client_id"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "customer_hash",
      "required": false,
      "wireName": "customer_hash"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "name",
      "required": true,
      "wireName": "name"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "photo_ref",
      "required": false,
      "wireName": "photo_ref"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "title",
      "required": false,
      "wireName": "title"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "first_name",
      "required": false,
      "wireName": "first_name"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "last_name",
      "required": false,
      "wireName": "last_name"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date",
      "name": "date_of_birth",
      "required": false,
      "wireName": "date_of_birth"
    },
    {
      "kind": "enum",
      "typeName": "CountryCode",
      "isArray": false,
      "enumValues": [
        "AD",
        "AE",
        "AF",
        "AG",
        "AI",
        "AL",
        "AM",
        "AO",
        "AQ",
        "AR",
        "AS",
        "AT",
        "AU",
        "AW",
        "AX",
        "AZ",
        "BA",
        "BB",
        "BD",
        "BE",
        "BF",
        "BG",
        "BH",
        "BI",
        "BJ",
        "BL",
        "BM",
        "BN",
        "BO",
        "BQ",
        "BR",
        "BS",
        "BT",
        "BV",
        "BW",
        "BY",
        "BZ",
        "CA",
        "CC",
        "CD",
        "CF",
        "CG",
        "CH",
        "CI",
        "CK",
        "CL",
        "CM",
        "CN",
        "CO",
        "CR",
        "CU",
        "CV",
        "CW",
        "CX",
        "CY",
        "CZ",
        "DE",
        "DJ",
        "DK",
        "DM",
        "DO",
        "DZ",
        "EC",
        "EE",
        "EG",
        "EH",
        "ER",
        "ES",
        "ET",
        "FI",
        "FJ",
        "FK",
        "FM",
        "FO",
        "FR",
        "GA",
        "GB",
        "GD",
        "GE",
        "GF",
        "GG",
        "GH",
        "GI",
        "GL",
        "GM",
        "GN",
        "GP",
        "GQ",
        "GR",
        "GS",
        "GT",
        "GU",
        "GW",
        "GY",
        "HK",
        "HM",
        "HN",
        "HR",
        "HT",
        "HU",
        "ID",
        "IE",
        "IL",
        "IM",
        "IN",
        "IO",
        "IQ",
        "IR",
        "IS",
        "IT",
        "JE",
        "JM",
        "JO",
        "JP",
        "KE",
        "KG",
        "KH",
        "KI",
        "KM",
        "KN",
        "KP",
        "KR",
        "KW",
        "KY",
        "KZ",
        "LA",
        "LB",
        "LC",
        "LI",
        "LK",
        "LR",
        "LS",
        "LT",
        "LU",
        "LV",
        "LY",
        "MA",
        "MC",
        "MD",
        "ME",
        "MF",
        "MG",
        "MH",
        "MK",
        "ML",
        "MM",
        "MN",
        "MO",
        "MP",
        "MQ",
        "MR",
        "MS",
        "MT",
        "MU",
        "MV",
        "MW",
        "MX",
        "MY",
        "MZ",
        "NA",
        "NC",
        "NE",
        "NF",
        "NG",
        "NI",
        "NL",
        "NO",
        "NP",
        "NR",
        "NU",
        "NZ",
        "OM",
        "PA",
        "PE",
        "PF",
        "PG",
        "PH",
        "PK",
        "PL",
        "PM",
        "PN",
        "PR",
        "PS",
        "PT",
        "PW",
        "PY",
        "QA",
        "RE",
        "RO",
        "RS",
        "RU",
        "RW",
        "SA",
        "SB",
        "SC",
        "SD",
        "SE",
        "SG",
        "SH",
        "SI",
        "SJ",
        "SK",
        "SL",
        "SM",
        "SN",
        "SO",
        "SR",
        "SS",
        "ST",
        "SV",
        "SX",
        "SY",
        "SZ",
        "TC",
        "TD",
        "TF",
        "TG",
        "TH",
        "TJ",
        "TK",
        "TL",
        "TM",
        "TN",
        "TO",
        "TR",
        "TT",
        "TV",
        "TW",
        "TZ",
        "UA",
        "UG",
        "UM",
        "US",
        "UY",
        "UZ",
        "VA",
        "VC",
        "VE",
        "VG",
        "VI",
        "VN",
        "VU",
        "WF",
        "WS",
        "YE",
        "YT",
        "ZA",
        "ZM",
        "ZW"
      ],
      "options": [
        {
          "value": "AD",
          "label": "AD"
        },
        {
          "value": "AE",
          "label": "AE"
        },
        {
          "value": "AF",
          "label": "AF"
        },
        {
          "value": "AG",
          "label": "AG"
        },
        {
          "value": "AI",
          "label": "AI"
        },
        {
          "value": "AL",
          "label": "AL"
        },
        {
          "value": "AM",
          "label": "AM"
        },
        {
          "value": "AO",
          "label": "AO"
        },
        {
          "value": "AQ",
          "label": "AQ"
        },
        {
          "value": "AR",
          "label": "AR"
        },
        {
          "value": "AS",
          "label": "AS"
        },
        {
          "value": "AT",
          "label": "AT"
        },
        {
          "value": "AU",
          "label": "AU"
        },
        {
          "value": "AW",
          "label": "AW"
        },
        {
          "value": "AX",
          "label": "AX"
        },
        {
          "value": "AZ",
          "label": "AZ"
        },
        {
          "value": "BA",
          "label": "BA"
        },
        {
          "value": "BB",
          "label": "BB"
        },
        {
          "value": "BD",
          "label": "BD"
        },
        {
          "value": "BE",
          "label": "BE"
        },
        {
          "value": "BF",
          "label": "BF"
        },
        {
          "value": "BG",
          "label": "BG"
        },
        {
          "value": "BH",
          "label": "BH"
        },
        {
          "value": "BI",
          "label": "BI"
        },
        {
          "value": "BJ",
          "label": "BJ"
        },
        {
          "value": "BL",
          "label": "BL"
        },
        {
          "value": "BM",
          "label": "BM"
        },
        {
          "value": "BN",
          "label": "BN"
        },
        {
          "value": "BO",
          "label": "BO"
        },
        {
          "value": "BQ",
          "label": "BQ"
        },
        {
          "value": "BR",
          "label": "BR"
        },
        {
          "value": "BS",
          "label": "BS"
        },
        {
          "value": "BT",
          "label": "BT"
        },
        {
          "value": "BV",
          "label": "BV"
        },
        {
          "value": "BW",
          "label": "BW"
        },
        {
          "value": "BY",
          "label": "BY"
        },
        {
          "value": "BZ",
          "label": "BZ"
        },
        {
          "value": "CA",
          "label": "CA"
        },
        {
          "value": "CC",
          "label": "CC"
        },
        {
          "value": "CD",
          "label": "CD"
        },
        {
          "value": "CF",
          "label": "CF"
        },
        {
          "value": "CG",
          "label": "CG"
        },
        {
          "value": "CH",
          "label": "CH"
        },
        {
          "value": "CI",
          "label": "CI"
        },
        {
          "value": "CK",
          "label": "CK"
        },
        {
          "value": "CL",
          "label": "CL"
        },
        {
          "value": "CM",
          "label": "CM"
        },
        {
          "value": "CN",
          "label": "CN"
        },
        {
          "value": "CO",
          "label": "CO"
        },
        {
          "value": "CR",
          "label": "CR"
        },
        {
          "value": "CU",
          "label": "CU"
        },
        {
          "value": "CV",
          "label": "CV"
        },
        {
          "value": "CW",
          "label": "CW"
        },
        {
          "value": "CX",
          "label": "CX"
        },
        {
          "value": "CY",
          "label": "CY"
        },
        {
          "value": "CZ",
          "label": "CZ"
        },
        {
          "value": "DE",
          "label": "DE"
        },
        {
          "value": "DJ",
          "label": "DJ"
        },
        {
          "value": "DK",
          "label": "DK"
        },
        {
          "value": "DM",
          "label": "DM"
        },
        {
          "value": "DO",
          "label": "DO"
        },
        {
          "value": "DZ",
          "label": "DZ"
        },
        {
          "value": "EC",
          "label": "EC"
        },
        {
          "value": "EE",
          "label": "EE"
        },
        {
          "value": "EG",
          "label": "EG"
        },
        {
          "value": "EH",
          "label": "EH"
        },
        {
          "value": "ER",
          "label": "ER"
        },
        {
          "value": "ES",
          "label": "ES"
        },
        {
          "value": "ET",
          "label": "ET"
        },
        {
          "value": "FI",
          "label": "FI"
        },
        {
          "value": "FJ",
          "label": "FJ"
        },
        {
          "value": "FK",
          "label": "FK"
        },
        {
          "value": "FM",
          "label": "FM"
        },
        {
          "value": "FO",
          "label": "FO"
        },
        {
          "value": "FR",
          "label": "FR"
        },
        {
          "value": "GA",
          "label": "GA"
        },
        {
          "value": "GB",
          "label": "GB"
        },
        {
          "value": "GD",
          "label": "GD"
        },
        {
          "value": "GE",
          "label": "GE"
        },
        {
          "value": "GF",
          "label": "GF"
        },
        {
          "value": "GG",
          "label": "GG"
        },
        {
          "value": "GH",
          "label": "GH"
        },
        {
          "value": "GI",
          "label": "GI"
        },
        {
          "value": "GL",
          "label": "GL"
        },
        {
          "value": "GM",
          "label": "GM"
        },
        {
          "value": "GN",
          "label": "GN"
        },
        {
          "value": "GP",
          "label": "GP"
        },
        {
          "value": "GQ",
          "label": "GQ"
        },
        {
          "value": "GR",
          "label": "GR"
        },
        {
          "value": "GS",
          "label": "GS"
        },
        {
          "value": "GT",
          "label": "GT"
        },
        {
          "value": "GU",
          "label": "GU"
        },
        {
          "value": "GW",
          "label": "GW"
        },
        {
          "value": "GY",
          "label": "GY"
        },
        {
          "value": "HK",
          "label": "HK"
        },
        {
          "value": "HM",
          "label": "HM"
        },
        {
          "value": "HN",
          "label": "HN"
        },
        {
          "value": "HR",
          "label": "HR"
        },
        {
          "value": "HT",
          "label": "HT"
        },
        {
          "value": "HU",
          "label": "HU"
        },
        {
          "value": "ID",
          "label": "ID"
        },
        {
          "value": "IE",
          "label": "IE"
        },
        {
          "value": "IL",
          "label": "IL"
        },
        {
          "value": "IM",
          "label": "IM"
        },
        {
          "value": "IN",
          "label": "IN"
        },
        {
          "value": "IO",
          "label": "IO"
        },
        {
          "value": "IQ",
          "label": "IQ"
        },
        {
          "value": "IR",
          "label": "IR"
        },
        {
          "value": "IS",
          "label": "IS"
        },
        {
          "value": "IT",
          "label": "IT"
        },
        {
          "value": "JE",
          "label": "JE"
        },
        {
          "value": "JM",
          "label": "JM"
        },
        {
          "value": "JO",
          "label": "JO"
        },
        {
          "value": "JP",
          "label": "JP"
        },
        {
          "value": "KE",
          "label": "KE"
        },
        {
          "value": "KG",
          "label": "KG"
        },
        {
          "value": "KH",
          "label": "KH"
        },
        {
          "value": "KI",
          "label": "KI"
        },
        {
          "value": "KM",
          "label": "KM"
        },
        {
          "value": "KN",
          "label": "KN"
        },
        {
          "value": "KP",
          "label": "KP"
        },
        {
          "value": "KR",
          "label": "KR"
        },
        {
          "value": "KW",
          "label": "KW"
        },
        {
          "value": "KY",
          "label": "KY"
        },
        {
          "value": "KZ",
          "label": "KZ"
        },
        {
          "value": "LA",
          "label": "LA"
        },
        {
          "value": "LB",
          "label": "LB"
        },
        {
          "value": "LC",
          "label": "LC"
        },
        {
          "value": "LI",
          "label": "LI"
        },
        {
          "value": "LK",
          "label": "LK"
        },
        {
          "value": "LR",
          "label": "LR"
        },
        {
          "value": "LS",
          "label": "LS"
        },
        {
          "value": "LT",
          "label": "LT"
        },
        {
          "value": "LU",
          "label": "LU"
        },
        {
          "value": "LV",
          "label": "LV"
        },
        {
          "value": "LY",
          "label": "LY"
        },
        {
          "value": "MA",
          "label": "MA"
        },
        {
          "value": "MC",
          "label": "MC"
        },
        {
          "value": "MD",
          "label": "MD"
        },
        {
          "value": "ME",
          "label": "ME"
        },
        {
          "value": "MF",
          "label": "MF"
        },
        {
          "value": "MG",
          "label": "MG"
        },
        {
          "value": "MH",
          "label": "MH"
        },
        {
          "value": "MK",
          "label": "MK"
        },
        {
          "value": "ML",
          "label": "ML"
        },
        {
          "value": "MM",
          "label": "MM"
        },
        {
          "value": "MN",
          "label": "MN"
        },
        {
          "value": "MO",
          "label": "MO"
        },
        {
          "value": "MP",
          "label": "MP"
        },
        {
          "value": "MQ",
          "label": "MQ"
        },
        {
          "value": "MR",
          "label": "MR"
        },
        {
          "value": "MS",
          "label": "MS"
        },
        {
          "value": "MT",
          "label": "MT"
        },
        {
          "value": "MU",
          "label": "MU"
        },
        {
          "value": "MV",
          "label": "MV"
        },
        {
          "value": "MW",
          "label": "MW"
        },
        {
          "value": "MX",
          "label": "MX"
        },
        {
          "value": "MY",
          "label": "MY"
        },
        {
          "value": "MZ",
          "label": "MZ"
        },
        {
          "value": "NA",
          "label": "NA"
        },
        {
          "value": "NC",
          "label": "NC"
        },
        {
          "value": "NE",
          "label": "NE"
        },
        {
          "value": "NF",
          "label": "NF"
        },
        {
          "value": "NG",
          "label": "NG"
        },
        {
          "value": "NI",
          "label": "NI"
        },
        {
          "value": "NL",
          "label": "NL"
        },
        {
          "value": "NO",
          "label": "NO"
        },
        {
          "value": "NP",
          "label": "NP"
        },
        {
          "value": "NR",
          "label": "NR"
        },
        {
          "value": "NU",
          "label": "NU"
        },
        {
          "value": "NZ",
          "label": "NZ"
        },
        {
          "value": "OM",
          "label": "OM"
        },
        {
          "value": "PA",
          "label": "PA"
        },
        {
          "value": "PE",
          "label": "PE"
        },
        {
          "value": "PF",
          "label": "PF"
        },
        {
          "value": "PG",
          "label": "PG"
        },
        {
          "value": "PH",
          "label": "PH"
        },
        {
          "value": "PK",
          "label": "PK"
        },
        {
          "value": "PL",
          "label": "PL"
        },
        {
          "value": "PM",
          "label": "PM"
        },
        {
          "value": "PN",
          "label": "PN"
        },
        {
          "value": "PR",
          "label": "PR"
        },
        {
          "value": "PS",
          "label": "PS"
        },
        {
          "value": "PT",
          "label": "PT"
        },
        {
          "value": "PW",
          "label": "PW"
        },
        {
          "value": "PY",
          "label": "PY"
        },
        {
          "value": "QA",
          "label": "QA"
        },
        {
          "value": "RE",
          "label": "RE"
        },
        {
          "value": "RO",
          "label": "RO"
        },
        {
          "value": "RS",
          "label": "RS"
        },
        {
          "value": "RU",
          "label": "RU"
        },
        {
          "value": "RW",
          "label": "RW"
        },
        {
          "value": "SA",
          "label": "SA"
        },
        {
          "value": "SB",
          "label": "SB"
        },
        {
          "value": "SC",
          "label": "SC"
        },
        {
          "value": "SD",
          "label": "SD"
        },
        {
          "value": "SE",
          "label": "SE"
        },
        {
          "value": "SG",
          "label": "SG"
        },
        {
          "value": "SH",
          "label": "SH"
        },
        {
          "value": "SI",
          "label": "SI"
        },
        {
          "value": "SJ",
          "label": "SJ"
        },
        {
          "value": "SK",
          "label": "SK"
        },
        {
          "value": "SL",
          "label": "SL"
        },
        {
          "value": "SM",
          "label": "SM"
        },
        {
          "value": "SN",
          "label": "SN"
        },
        {
          "value": "SO",
          "label": "SO"
        },
        {
          "value": "SR",
          "label": "SR"
        },
        {
          "value": "SS",
          "label": "SS"
        },
        {
          "value": "ST",
          "label": "ST"
        },
        {
          "value": "SV",
          "label": "SV"
        },
        {
          "value": "SX",
          "label": "SX"
        },
        {
          "value": "SY",
          "label": "SY"
        },
        {
          "value": "SZ",
          "label": "SZ"
        },
        {
          "value": "TC",
          "label": "TC"
        },
        {
          "value": "TD",
          "label": "TD"
        },
        {
          "value": "TF",
          "label": "TF"
        },
        {
          "value": "TG",
          "label": "TG"
        },
        {
          "value": "TH",
          "label": "TH"
        },
        {
          "value": "TJ",
          "label": "TJ"
        },
        {
          "value": "TK",
          "label": "TK"
        },
        {
          "value": "TL",
          "label": "TL"
        },
        {
          "value": "TM",
          "label": "TM"
        },
        {
          "value": "TN",
          "label": "TN"
        },
        {
          "value": "TO",
          "label": "TO"
        },
        {
          "value": "TR",
          "label": "TR"
        },
        {
          "value": "TT",
          "label": "TT"
        },
        {
          "value": "TV",
          "label": "TV"
        },
        {
          "value": "TW",
          "label": "TW"
        },
        {
          "value": "TZ",
          "label": "TZ"
        },
        {
          "value": "UA",
          "label": "UA"
        },
        {
          "value": "UG",
          "label": "UG"
        },
        {
          "value": "UM",
          "label": "UM"
        },
        {
          "value": "US",
          "label": "US"
        },
        {
          "value": "UY",
          "label": "UY"
        },
        {
          "value": "UZ",
          "label": "UZ"
        },
        {
          "value": "VA",
          "label": "VA"
        },
        {
          "value": "VC",
          "label": "VC"
        },
        {
          "value": "VE",
          "label": "VE"
        },
        {
          "value": "VG",
          "label": "VG"
        },
        {
          "value": "VI",
          "label": "VI"
        },
        {
          "value": "VN",
          "label": "VN"
        },
        {
          "value": "VU",
          "label": "VU"
        },
        {
          "value": "WF",
          "label": "WF"
        },
        {
          "value": "WS",
          "label": "WS"
        },
        {
          "value": "YE",
          "label": "YE"
        },
        {
          "value": "YT",
          "label": "YT"
        },
        {
          "value": "ZA",
          "label": "ZA"
        },
        {
          "value": "ZM",
          "label": "ZM"
        },
        {
          "value": "ZW",
          "label": "ZW"
        }
      ],
      "name": "nationality",
      "required": false,
      "wireName": "nationality"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "address_line_1",
      "required": false,
      "wireName": "address_line_1"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "address_line_2",
      "required": false,
      "wireName": "address_line_2"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "address_city",
      "required": false,
      "wireName": "address_city"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "address_state_region",
      "required": false,
      "wireName": "address_state_region"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "address_postal_code",
      "required": false,
      "wireName": "address_postal_code"
    },
    {
      "kind": "enum",
      "typeName": "CountryCode",
      "isArray": false,
      "enumValues": [
        "AD",
        "AE",
        "AF",
        "AG",
        "AI",
        "AL",
        "AM",
        "AO",
        "AQ",
        "AR",
        "AS",
        "AT",
        "AU",
        "AW",
        "AX",
        "AZ",
        "BA",
        "BB",
        "BD",
        "BE",
        "BF",
        "BG",
        "BH",
        "BI",
        "BJ",
        "BL",
        "BM",
        "BN",
        "BO",
        "BQ",
        "BR",
        "BS",
        "BT",
        "BV",
        "BW",
        "BY",
        "BZ",
        "CA",
        "CC",
        "CD",
        "CF",
        "CG",
        "CH",
        "CI",
        "CK",
        "CL",
        "CM",
        "CN",
        "CO",
        "CR",
        "CU",
        "CV",
        "CW",
        "CX",
        "CY",
        "CZ",
        "DE",
        "DJ",
        "DK",
        "DM",
        "DO",
        "DZ",
        "EC",
        "EE",
        "EG",
        "EH",
        "ER",
        "ES",
        "ET",
        "FI",
        "FJ",
        "FK",
        "FM",
        "FO",
        "FR",
        "GA",
        "GB",
        "GD",
        "GE",
        "GF",
        "GG",
        "GH",
        "GI",
        "GL",
        "GM",
        "GN",
        "GP",
        "GQ",
        "GR",
        "GS",
        "GT",
        "GU",
        "GW",
        "GY",
        "HK",
        "HM",
        "HN",
        "HR",
        "HT",
        "HU",
        "ID",
        "IE",
        "IL",
        "IM",
        "IN",
        "IO",
        "IQ",
        "IR",
        "IS",
        "IT",
        "JE",
        "JM",
        "JO",
        "JP",
        "KE",
        "KG",
        "KH",
        "KI",
        "KM",
        "KN",
        "KP",
        "KR",
        "KW",
        "KY",
        "KZ",
        "LA",
        "LB",
        "LC",
        "LI",
        "LK",
        "LR",
        "LS",
        "LT",
        "LU",
        "LV",
        "LY",
        "MA",
        "MC",
        "MD",
        "ME",
        "MF",
        "MG",
        "MH",
        "MK",
        "ML",
        "MM",
        "MN",
        "MO",
        "MP",
        "MQ",
        "MR",
        "MS",
        "MT",
        "MU",
        "MV",
        "MW",
        "MX",
        "MY",
        "MZ",
        "NA",
        "NC",
        "NE",
        "NF",
        "NG",
        "NI",
        "NL",
        "NO",
        "NP",
        "NR",
        "NU",
        "NZ",
        "OM",
        "PA",
        "PE",
        "PF",
        "PG",
        "PH",
        "PK",
        "PL",
        "PM",
        "PN",
        "PR",
        "PS",
        "PT",
        "PW",
        "PY",
        "QA",
        "RE",
        "RO",
        "RS",
        "RU",
        "RW",
        "SA",
        "SB",
        "SC",
        "SD",
        "SE",
        "SG",
        "SH",
        "SI",
        "SJ",
        "SK",
        "SL",
        "SM",
        "SN",
        "SO",
        "SR",
        "SS",
        "ST",
        "SV",
        "SX",
        "SY",
        "SZ",
        "TC",
        "TD",
        "TF",
        "TG",
        "TH",
        "TJ",
        "TK",
        "TL",
        "TM",
        "TN",
        "TO",
        "TR",
        "TT",
        "TV",
        "TW",
        "TZ",
        "UA",
        "UG",
        "UM",
        "US",
        "UY",
        "UZ",
        "VA",
        "VC",
        "VE",
        "VG",
        "VI",
        "VN",
        "VU",
        "WF",
        "WS",
        "YE",
        "YT",
        "ZA",
        "ZM",
        "ZW"
      ],
      "options": [
        {
          "value": "AD",
          "label": "AD"
        },
        {
          "value": "AE",
          "label": "AE"
        },
        {
          "value": "AF",
          "label": "AF"
        },
        {
          "value": "AG",
          "label": "AG"
        },
        {
          "value": "AI",
          "label": "AI"
        },
        {
          "value": "AL",
          "label": "AL"
        },
        {
          "value": "AM",
          "label": "AM"
        },
        {
          "value": "AO",
          "label": "AO"
        },
        {
          "value": "AQ",
          "label": "AQ"
        },
        {
          "value": "AR",
          "label": "AR"
        },
        {
          "value": "AS",
          "label": "AS"
        },
        {
          "value": "AT",
          "label": "AT"
        },
        {
          "value": "AU",
          "label": "AU"
        },
        {
          "value": "AW",
          "label": "AW"
        },
        {
          "value": "AX",
          "label": "AX"
        },
        {
          "value": "AZ",
          "label": "AZ"
        },
        {
          "value": "BA",
          "label": "BA"
        },
        {
          "value": "BB",
          "label": "BB"
        },
        {
          "value": "BD",
          "label": "BD"
        },
        {
          "value": "BE",
          "label": "BE"
        },
        {
          "value": "BF",
          "label": "BF"
        },
        {
          "value": "BG",
          "label": "BG"
        },
        {
          "value": "BH",
          "label": "BH"
        },
        {
          "value": "BI",
          "label": "BI"
        },
        {
          "value": "BJ",
          "label": "BJ"
        },
        {
          "value": "BL",
          "label": "BL"
        },
        {
          "value": "BM",
          "label": "BM"
        },
        {
          "value": "BN",
          "label": "BN"
        },
        {
          "value": "BO",
          "label": "BO"
        },
        {
          "value": "BQ",
          "label": "BQ"
        },
        {
          "value": "BR",
          "label": "BR"
        },
        {
          "value": "BS",
          "label": "BS"
        },
        {
          "value": "BT",
          "label": "BT"
        },
        {
          "value": "BV",
          "label": "BV"
        },
        {
          "value": "BW",
          "label": "BW"
        },
        {
          "value": "BY",
          "label": "BY"
        },
        {
          "value": "BZ",
          "label": "BZ"
        },
        {
          "value": "CA",
          "label": "CA"
        },
        {
          "value": "CC",
          "label": "CC"
        },
        {
          "value": "CD",
          "label": "CD"
        },
        {
          "value": "CF",
          "label": "CF"
        },
        {
          "value": "CG",
          "label": "CG"
        },
        {
          "value": "CH",
          "label": "CH"
        },
        {
          "value": "CI",
          "label": "CI"
        },
        {
          "value": "CK",
          "label": "CK"
        },
        {
          "value": "CL",
          "label": "CL"
        },
        {
          "value": "CM",
          "label": "CM"
        },
        {
          "value": "CN",
          "label": "CN"
        },
        {
          "value": "CO",
          "label": "CO"
        },
        {
          "value": "CR",
          "label": "CR"
        },
        {
          "value": "CU",
          "label": "CU"
        },
        {
          "value": "CV",
          "label": "CV"
        },
        {
          "value": "CW",
          "label": "CW"
        },
        {
          "value": "CX",
          "label": "CX"
        },
        {
          "value": "CY",
          "label": "CY"
        },
        {
          "value": "CZ",
          "label": "CZ"
        },
        {
          "value": "DE",
          "label": "DE"
        },
        {
          "value": "DJ",
          "label": "DJ"
        },
        {
          "value": "DK",
          "label": "DK"
        },
        {
          "value": "DM",
          "label": "DM"
        },
        {
          "value": "DO",
          "label": "DO"
        },
        {
          "value": "DZ",
          "label": "DZ"
        },
        {
          "value": "EC",
          "label": "EC"
        },
        {
          "value": "EE",
          "label": "EE"
        },
        {
          "value": "EG",
          "label": "EG"
        },
        {
          "value": "EH",
          "label": "EH"
        },
        {
          "value": "ER",
          "label": "ER"
        },
        {
          "value": "ES",
          "label": "ES"
        },
        {
          "value": "ET",
          "label": "ET"
        },
        {
          "value": "FI",
          "label": "FI"
        },
        {
          "value": "FJ",
          "label": "FJ"
        },
        {
          "value": "FK",
          "label": "FK"
        },
        {
          "value": "FM",
          "label": "FM"
        },
        {
          "value": "FO",
          "label": "FO"
        },
        {
          "value": "FR",
          "label": "FR"
        },
        {
          "value": "GA",
          "label": "GA"
        },
        {
          "value": "GB",
          "label": "GB"
        },
        {
          "value": "GD",
          "label": "GD"
        },
        {
          "value": "GE",
          "label": "GE"
        },
        {
          "value": "GF",
          "label": "GF"
        },
        {
          "value": "GG",
          "label": "GG"
        },
        {
          "value": "GH",
          "label": "GH"
        },
        {
          "value": "GI",
          "label": "GI"
        },
        {
          "value": "GL",
          "label": "GL"
        },
        {
          "value": "GM",
          "label": "GM"
        },
        {
          "value": "GN",
          "label": "GN"
        },
        {
          "value": "GP",
          "label": "GP"
        },
        {
          "value": "GQ",
          "label": "GQ"
        },
        {
          "value": "GR",
          "label": "GR"
        },
        {
          "value": "GS",
          "label": "GS"
        },
        {
          "value": "GT",
          "label": "GT"
        },
        {
          "value": "GU",
          "label": "GU"
        },
        {
          "value": "GW",
          "label": "GW"
        },
        {
          "value": "GY",
          "label": "GY"
        },
        {
          "value": "HK",
          "label": "HK"
        },
        {
          "value": "HM",
          "label": "HM"
        },
        {
          "value": "HN",
          "label": "HN"
        },
        {
          "value": "HR",
          "label": "HR"
        },
        {
          "value": "HT",
          "label": "HT"
        },
        {
          "value": "HU",
          "label": "HU"
        },
        {
          "value": "ID",
          "label": "ID"
        },
        {
          "value": "IE",
          "label": "IE"
        },
        {
          "value": "IL",
          "label": "IL"
        },
        {
          "value": "IM",
          "label": "IM"
        },
        {
          "value": "IN",
          "label": "IN"
        },
        {
          "value": "IO",
          "label": "IO"
        },
        {
          "value": "IQ",
          "label": "IQ"
        },
        {
          "value": "IR",
          "label": "IR"
        },
        {
          "value": "IS",
          "label": "IS"
        },
        {
          "value": "IT",
          "label": "IT"
        },
        {
          "value": "JE",
          "label": "JE"
        },
        {
          "value": "JM",
          "label": "JM"
        },
        {
          "value": "JO",
          "label": "JO"
        },
        {
          "value": "JP",
          "label": "JP"
        },
        {
          "value": "KE",
          "label": "KE"
        },
        {
          "value": "KG",
          "label": "KG"
        },
        {
          "value": "KH",
          "label": "KH"
        },
        {
          "value": "KI",
          "label": "KI"
        },
        {
          "value": "KM",
          "label": "KM"
        },
        {
          "value": "KN",
          "label": "KN"
        },
        {
          "value": "KP",
          "label": "KP"
        },
        {
          "value": "KR",
          "label": "KR"
        },
        {
          "value": "KW",
          "label": "KW"
        },
        {
          "value": "KY",
          "label": "KY"
        },
        {
          "value": "KZ",
          "label": "KZ"
        },
        {
          "value": "LA",
          "label": "LA"
        },
        {
          "value": "LB",
          "label": "LB"
        },
        {
          "value": "LC",
          "label": "LC"
        },
        {
          "value": "LI",
          "label": "LI"
        },
        {
          "value": "LK",
          "label": "LK"
        },
        {
          "value": "LR",
          "label": "LR"
        },
        {
          "value": "LS",
          "label": "LS"
        },
        {
          "value": "LT",
          "label": "LT"
        },
        {
          "value": "LU",
          "label": "LU"
        },
        {
          "value": "LV",
          "label": "LV"
        },
        {
          "value": "LY",
          "label": "LY"
        },
        {
          "value": "MA",
          "label": "MA"
        },
        {
          "value": "MC",
          "label": "MC"
        },
        {
          "value": "MD",
          "label": "MD"
        },
        {
          "value": "ME",
          "label": "ME"
        },
        {
          "value": "MF",
          "label": "MF"
        },
        {
          "value": "MG",
          "label": "MG"
        },
        {
          "value": "MH",
          "label": "MH"
        },
        {
          "value": "MK",
          "label": "MK"
        },
        {
          "value": "ML",
          "label": "ML"
        },
        {
          "value": "MM",
          "label": "MM"
        },
        {
          "value": "MN",
          "label": "MN"
        },
        {
          "value": "MO",
          "label": "MO"
        },
        {
          "value": "MP",
          "label": "MP"
        },
        {
          "value": "MQ",
          "label": "MQ"
        },
        {
          "value": "MR",
          "label": "MR"
        },
        {
          "value": "MS",
          "label": "MS"
        },
        {
          "value": "MT",
          "label": "MT"
        },
        {
          "value": "MU",
          "label": "MU"
        },
        {
          "value": "MV",
          "label": "MV"
        },
        {
          "value": "MW",
          "label": "MW"
        },
        {
          "value": "MX",
          "label": "MX"
        },
        {
          "value": "MY",
          "label": "MY"
        },
        {
          "value": "MZ",
          "label": "MZ"
        },
        {
          "value": "NA",
          "label": "NA"
        },
        {
          "value": "NC",
          "label": "NC"
        },
        {
          "value": "NE",
          "label": "NE"
        },
        {
          "value": "NF",
          "label": "NF"
        },
        {
          "value": "NG",
          "label": "NG"
        },
        {
          "value": "NI",
          "label": "NI"
        },
        {
          "value": "NL",
          "label": "NL"
        },
        {
          "value": "NO",
          "label": "NO"
        },
        {
          "value": "NP",
          "label": "NP"
        },
        {
          "value": "NR",
          "label": "NR"
        },
        {
          "value": "NU",
          "label": "NU"
        },
        {
          "value": "NZ",
          "label": "NZ"
        },
        {
          "value": "OM",
          "label": "OM"
        },
        {
          "value": "PA",
          "label": "PA"
        },
        {
          "value": "PE",
          "label": "PE"
        },
        {
          "value": "PF",
          "label": "PF"
        },
        {
          "value": "PG",
          "label": "PG"
        },
        {
          "value": "PH",
          "label": "PH"
        },
        {
          "value": "PK",
          "label": "PK"
        },
        {
          "value": "PL",
          "label": "PL"
        },
        {
          "value": "PM",
          "label": "PM"
        },
        {
          "value": "PN",
          "label": "PN"
        },
        {
          "value": "PR",
          "label": "PR"
        },
        {
          "value": "PS",
          "label": "PS"
        },
        {
          "value": "PT",
          "label": "PT"
        },
        {
          "value": "PW",
          "label": "PW"
        },
        {
          "value": "PY",
          "label": "PY"
        },
        {
          "value": "QA",
          "label": "QA"
        },
        {
          "value": "RE",
          "label": "RE"
        },
        {
          "value": "RO",
          "label": "RO"
        },
        {
          "value": "RS",
          "label": "RS"
        },
        {
          "value": "RU",
          "label": "RU"
        },
        {
          "value": "RW",
          "label": "RW"
        },
        {
          "value": "SA",
          "label": "SA"
        },
        {
          "value": "SB",
          "label": "SB"
        },
        {
          "value": "SC",
          "label": "SC"
        },
        {
          "value": "SD",
          "label": "SD"
        },
        {
          "value": "SE",
          "label": "SE"
        },
        {
          "value": "SG",
          "label": "SG"
        },
        {
          "value": "SH",
          "label": "SH"
        },
        {
          "value": "SI",
          "label": "SI"
        },
        {
          "value": "SJ",
          "label": "SJ"
        },
        {
          "value": "SK",
          "label": "SK"
        },
        {
          "value": "SL",
          "label": "SL"
        },
        {
          "value": "SM",
          "label": "SM"
        },
        {
          "value": "SN",
          "label": "SN"
        },
        {
          "value": "SO",
          "label": "SO"
        },
        {
          "value": "SR",
          "label": "SR"
        },
        {
          "value": "SS",
          "label": "SS"
        },
        {
          "value": "ST",
          "label": "ST"
        },
        {
          "value": "SV",
          "label": "SV"
        },
        {
          "value": "SX",
          "label": "SX"
        },
        {
          "value": "SY",
          "label": "SY"
        },
        {
          "value": "SZ",
          "label": "SZ"
        },
        {
          "value": "TC",
          "label": "TC"
        },
        {
          "value": "TD",
          "label": "TD"
        },
        {
          "value": "TF",
          "label": "TF"
        },
        {
          "value": "TG",
          "label": "TG"
        },
        {
          "value": "TH",
          "label": "TH"
        },
        {
          "value": "TJ",
          "label": "TJ"
        },
        {
          "value": "TK",
          "label": "TK"
        },
        {
          "value": "TL",
          "label": "TL"
        },
        {
          "value": "TM",
          "label": "TM"
        },
        {
          "value": "TN",
          "label": "TN"
        },
        {
          "value": "TO",
          "label": "TO"
        },
        {
          "value": "TR",
          "label": "TR"
        },
        {
          "value": "TT",
          "label": "TT"
        },
        {
          "value": "TV",
          "label": "TV"
        },
        {
          "value": "TW",
          "label": "TW"
        },
        {
          "value": "TZ",
          "label": "TZ"
        },
        {
          "value": "UA",
          "label": "UA"
        },
        {
          "value": "UG",
          "label": "UG"
        },
        {
          "value": "UM",
          "label": "UM"
        },
        {
          "value": "US",
          "label": "US"
        },
        {
          "value": "UY",
          "label": "UY"
        },
        {
          "value": "UZ",
          "label": "UZ"
        },
        {
          "value": "VA",
          "label": "VA"
        },
        {
          "value": "VC",
          "label": "VC"
        },
        {
          "value": "VE",
          "label": "VE"
        },
        {
          "value": "VG",
          "label": "VG"
        },
        {
          "value": "VI",
          "label": "VI"
        },
        {
          "value": "VN",
          "label": "VN"
        },
        {
          "value": "VU",
          "label": "VU"
        },
        {
          "value": "WF",
          "label": "WF"
        },
        {
          "value": "WS",
          "label": "WS"
        },
        {
          "value": "YE",
          "label": "YE"
        },
        {
          "value": "YT",
          "label": "YT"
        },
        {
          "value": "ZA",
          "label": "ZA"
        },
        {
          "value": "ZM",
          "label": "ZM"
        },
        {
          "value": "ZW",
          "label": "ZW"
        }
      ],
      "name": "address_country_code",
      "required": false,
      "wireName": "address_country_code"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "organization_name",
      "required": false,
      "wireName": "organization_name"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "organization_address",
      "required": false,
      "wireName": "organization_address"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "organization_phone_number",
      "required": false,
      "wireName": "organization_phone_number"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "organization_webpage",
      "required": false,
      "wireName": "organization_webpage"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "email",
      "name": "organization_email",
      "required": false,
      "wireName": "organization_email"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "tax_id",
      "required": false,
      "wireName": "tax_id"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "phone_number",
      "required": false,
      "wireName": "phone_number"
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
      "typeName": "LanguageCode",
      "isArray": false,
      "enumValues": [
        "English",
        "Vietnamese",
        "French",
        "German",
        "Spanish"
      ],
      "options": [
        {
          "value": "English",
          "label": "English"
        },
        {
          "value": "Vietnamese",
          "label": "Vietnamese"
        },
        {
          "value": "French",
          "label": "French"
        },
        {
          "value": "German",
          "label": "German"
        },
        {
          "value": "Spanish",
          "label": "Spanish"
        }
      ],
      "name": "preferred_language",
      "required": false,
      "wireName": "preferred_language"
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
      "name": "preferred_currency",
      "required": false,
      "wireName": "preferred_currency"
    },
    {
      "kind": "enum",
      "typeName": "TimezoneCode",
      "isArray": false,
      "enumValues": [
        "Africa/Abidjan",
        "Africa/Accra",
        "Africa/Addis_Ababa",
        "Africa/Algiers",
        "Africa/Asmera",
        "Africa/Bamako",
        "Africa/Bangui",
        "Africa/Banjul",
        "Africa/Bissau",
        "Africa/Blantyre",
        "Africa/Brazzaville",
        "Africa/Bujumbura",
        "Africa/Cairo",
        "Africa/Casablanca",
        "Africa/Ceuta",
        "Africa/Conakry",
        "Africa/Dakar",
        "Africa/Dar_es_Salaam",
        "Africa/Djibouti",
        "Africa/Douala",
        "Africa/El_Aaiun",
        "Africa/Freetown",
        "Africa/Gaborone",
        "Africa/Harare",
        "Africa/Johannesburg",
        "Africa/Juba",
        "Africa/Kampala",
        "Africa/Khartoum",
        "Africa/Kigali",
        "Africa/Kinshasa",
        "Africa/Lagos",
        "Africa/Libreville",
        "Africa/Lome",
        "Africa/Luanda",
        "Africa/Lubumbashi",
        "Africa/Lusaka",
        "Africa/Malabo",
        "Africa/Maputo",
        "Africa/Maseru",
        "Africa/Mbabane",
        "Africa/Mogadishu",
        "Africa/Monrovia",
        "Africa/Nairobi",
        "Africa/Ndjamena",
        "Africa/Niamey",
        "Africa/Nouakchott",
        "Africa/Ouagadougou",
        "Africa/Porto-Novo",
        "Africa/Sao_Tome",
        "Africa/Tripoli",
        "Africa/Tunis",
        "Africa/Windhoek",
        "America/Adak",
        "America/Anchorage",
        "America/Anguilla",
        "America/Antigua",
        "America/Araguaina",
        "America/Argentina/La_Rioja",
        "America/Argentina/Rio_Gallegos",
        "America/Argentina/Salta",
        "America/Argentina/San_Juan",
        "America/Argentina/San_Luis",
        "America/Argentina/Tucuman",
        "America/Argentina/Ushuaia",
        "America/Aruba",
        "America/Asuncion",
        "America/Bahia",
        "America/Bahia_Banderas",
        "America/Barbados",
        "America/Belem",
        "America/Belize",
        "America/Blanc-Sablon",
        "America/Boa_Vista",
        "America/Bogota",
        "America/Boise",
        "America/Buenos_Aires",
        "America/Cambridge_Bay",
        "America/Campo_Grande",
        "America/Cancun",
        "America/Caracas",
        "America/Catamarca",
        "America/Cayenne",
        "America/Cayman",
        "America/Chicago",
        "America/Chihuahua",
        "America/Ciudad_Juarez",
        "America/Coral_Harbour",
        "America/Cordoba",
        "America/Costa_Rica",
        "America/Creston",
        "America/Cuiaba",
        "America/Curacao",
        "America/Danmarkshavn",
        "America/Dawson",
        "America/Dawson_Creek",
        "America/Denver",
        "America/Detroit",
        "America/Dominica",
        "America/Edmonton",
        "America/Eirunepe",
        "America/El_Salvador",
        "America/Fort_Nelson",
        "America/Fortaleza",
        "America/Glace_Bay",
        "America/Godthab",
        "America/Goose_Bay",
        "America/Grand_Turk",
        "America/Grenada",
        "America/Guadeloupe",
        "America/Guatemala",
        "America/Guayaquil",
        "America/Guyana",
        "America/Halifax",
        "America/Havana",
        "America/Hermosillo",
        "America/Indiana/Knox",
        "America/Indiana/Marengo",
        "America/Indiana/Petersburg",
        "America/Indiana/Tell_City",
        "America/Indiana/Vevay",
        "America/Indiana/Vincennes",
        "America/Indiana/Winamac",
        "America/Indianapolis",
        "America/Inuvik",
        "America/Iqaluit",
        "America/Jamaica",
        "America/Jujuy",
        "America/Juneau",
        "America/Kentucky/Monticello",
        "America/Kralendijk",
        "America/La_Paz",
        "America/Lima",
        "America/Los_Angeles",
        "America/Louisville",
        "America/Lower_Princes",
        "America/Maceio",
        "America/Managua",
        "America/Manaus",
        "America/Marigot",
        "America/Martinique",
        "America/Matamoros",
        "America/Mazatlan",
        "America/Mendoza",
        "America/Menominee",
        "America/Merida",
        "America/Metlakatla",
        "America/Mexico_City",
        "America/Miquelon",
        "America/Moncton",
        "America/Monterrey",
        "America/Montevideo",
        "America/Montserrat",
        "America/Nassau",
        "America/New_York",
        "America/Nome",
        "America/Noronha",
        "America/North_Dakota/Beulah",
        "America/North_Dakota/Center",
        "America/North_Dakota/New_Salem",
        "America/Ojinaga",
        "America/Panama",
        "America/Paramaribo",
        "America/Phoenix",
        "America/Port-au-Prince",
        "America/Port_of_Spain",
        "America/Porto_Velho",
        "America/Puerto_Rico",
        "America/Punta_Arenas",
        "America/Rankin_Inlet",
        "America/Recife",
        "America/Regina",
        "America/Resolute",
        "America/Rio_Branco",
        "America/Santarem",
        "America/Santiago",
        "America/Santo_Domingo",
        "America/Sao_Paulo",
        "America/Scoresbysund",
        "America/Sitka",
        "America/St_Barthelemy",
        "America/St_Johns",
        "America/St_Kitts",
        "America/St_Lucia",
        "America/St_Thomas",
        "America/St_Vincent",
        "America/Swift_Current",
        "America/Tegucigalpa",
        "America/Thule",
        "America/Tijuana",
        "America/Toronto",
        "America/Tortola",
        "America/Vancouver",
        "America/Whitehorse",
        "America/Winnipeg",
        "America/Yakutat",
        "Antarctica/Casey",
        "Antarctica/Davis",
        "Antarctica/DumontDUrville",
        "Antarctica/Macquarie",
        "Antarctica/Mawson",
        "Antarctica/McMurdo",
        "Antarctica/Palmer",
        "Antarctica/Rothera",
        "Antarctica/Syowa",
        "Antarctica/Troll",
        "Antarctica/Vostok",
        "Arctic/Longyearbyen",
        "Asia/Aden",
        "Asia/Almaty",
        "Asia/Amman",
        "Asia/Anadyr",
        "Asia/Aqtau",
        "Asia/Aqtobe",
        "Asia/Ashgabat",
        "Asia/Atyrau",
        "Asia/Baghdad",
        "Asia/Bahrain",
        "Asia/Baku",
        "Asia/Bangkok",
        "Asia/Barnaul",
        "Asia/Beirut",
        "Asia/Bishkek",
        "Asia/Brunei",
        "Asia/Calcutta",
        "Asia/Chita",
        "Asia/Colombo",
        "Asia/Damascus",
        "Asia/Dhaka",
        "Asia/Dili",
        "Asia/Dubai",
        "Asia/Dushanbe",
        "Asia/Famagusta",
        "Asia/Gaza",
        "Asia/Hebron",
        "Asia/Hong_Kong",
        "Asia/Hovd",
        "Asia/Irkutsk",
        "Asia/Jakarta",
        "Asia/Jayapura",
        "Asia/Jerusalem",
        "Asia/Kabul",
        "Asia/Kamchatka",
        "Asia/Karachi",
        "Asia/Katmandu",
        "Asia/Khandyga",
        "Asia/Krasnoyarsk",
        "Asia/Kuala_Lumpur",
        "Asia/Kuching",
        "Asia/Kuwait",
        "Asia/Macau",
        "Asia/Magadan",
        "Asia/Makassar",
        "Asia/Manila",
        "Asia/Muscat",
        "Asia/Nicosia",
        "Asia/Novokuznetsk",
        "Asia/Novosibirsk",
        "Asia/Omsk",
        "Asia/Oral",
        "Asia/Phnom_Penh",
        "Asia/Pontianak",
        "Asia/Pyongyang",
        "Asia/Qatar",
        "Asia/Qostanay",
        "Asia/Qyzylorda",
        "Asia/Rangoon",
        "Asia/Riyadh",
        "Asia/Saigon",
        "Asia/Sakhalin",
        "Asia/Samarkand",
        "Asia/Seoul",
        "Asia/Shanghai",
        "Asia/Singapore",
        "Asia/Srednekolymsk",
        "Asia/Taipei",
        "Asia/Tashkent",
        "Asia/Tbilisi",
        "Asia/Tehran",
        "Asia/Thimphu",
        "Asia/Tokyo",
        "Asia/Tomsk",
        "Asia/Ulaanbaatar",
        "Asia/Urumqi",
        "Asia/Ust-Nera",
        "Asia/Vientiane",
        "Asia/Vladivostok",
        "Asia/Yakutsk",
        "Asia/Yekaterinburg",
        "Asia/Yerevan",
        "Atlantic/Azores",
        "Atlantic/Bermuda",
        "Atlantic/Canary",
        "Atlantic/Cape_Verde",
        "Atlantic/Faeroe",
        "Atlantic/Madeira",
        "Atlantic/Reykjavik",
        "Atlantic/South_Georgia",
        "Atlantic/St_Helena",
        "Atlantic/Stanley",
        "Australia/Adelaide",
        "Australia/Brisbane",
        "Australia/Broken_Hill",
        "Australia/Darwin",
        "Australia/Eucla",
        "Australia/Hobart",
        "Australia/Lindeman",
        "Australia/Lord_Howe",
        "Australia/Melbourne",
        "Australia/Perth",
        "Australia/Sydney",
        "Europe/Amsterdam",
        "Europe/Andorra",
        "Europe/Astrakhan",
        "Europe/Athens",
        "Europe/Belgrade",
        "Europe/Berlin",
        "Europe/Bratislava",
        "Europe/Brussels",
        "Europe/Bucharest",
        "Europe/Budapest",
        "Europe/Busingen",
        "Europe/Chisinau",
        "Europe/Copenhagen",
        "Europe/Dublin",
        "Europe/Gibraltar",
        "Europe/Guernsey",
        "Europe/Helsinki",
        "Europe/Isle_of_Man",
        "Europe/Istanbul",
        "Europe/Jersey",
        "Europe/Kaliningrad",
        "Europe/Kiev",
        "Europe/Kirov",
        "Europe/Lisbon",
        "Europe/Ljubljana",
        "Europe/London",
        "Europe/Luxembourg",
        "Europe/Madrid",
        "Europe/Malta",
        "Europe/Mariehamn",
        "Europe/Minsk",
        "Europe/Monaco",
        "Europe/Moscow",
        "Europe/Oslo",
        "Europe/Paris",
        "Europe/Podgorica",
        "Europe/Prague",
        "Europe/Riga",
        "Europe/Rome",
        "Europe/Samara",
        "Europe/San_Marino",
        "Europe/Sarajevo",
        "Europe/Saratov",
        "Europe/Simferopol",
        "Europe/Skopje",
        "Europe/Sofia",
        "Europe/Stockholm",
        "Europe/Tallinn",
        "Europe/Tirane",
        "Europe/Ulyanovsk",
        "Europe/Vaduz",
        "Europe/Vatican",
        "Europe/Vienna",
        "Europe/Vilnius",
        "Europe/Volgograd",
        "Europe/Warsaw",
        "Europe/Zagreb",
        "Europe/Zurich",
        "Indian/Antananarivo",
        "Indian/Chagos",
        "Indian/Christmas",
        "Indian/Cocos",
        "Indian/Comoro",
        "Indian/Kerguelen",
        "Indian/Mahe",
        "Indian/Maldives",
        "Indian/Mauritius",
        "Indian/Mayotte",
        "Indian/Reunion",
        "Pacific/Apia",
        "Pacific/Auckland",
        "Pacific/Bougainville",
        "Pacific/Chatham",
        "Pacific/Easter",
        "Pacific/Efate",
        "Pacific/Enderbury",
        "Pacific/Fakaofo",
        "Pacific/Fiji",
        "Pacific/Funafuti",
        "Pacific/Galapagos",
        "Pacific/Gambier",
        "Pacific/Guadalcanal",
        "Pacific/Guam",
        "Pacific/Honolulu",
        "Pacific/Kiritimati",
        "Pacific/Kosrae",
        "Pacific/Kwajalein",
        "Pacific/Majuro",
        "Pacific/Marquesas",
        "Pacific/Midway",
        "Pacific/Nauru",
        "Pacific/Niue",
        "Pacific/Norfolk",
        "Pacific/Noumea",
        "Pacific/Pago_Pago",
        "Pacific/Palau",
        "Pacific/Pitcairn",
        "Pacific/Ponape",
        "Pacific/Port_Moresby",
        "Pacific/Rarotonga",
        "Pacific/Saipan",
        "Pacific/Tahiti",
        "Pacific/Tarawa",
        "Pacific/Tongatapu",
        "Pacific/Truk",
        "Pacific/Wake",
        "Pacific/Wallis"
      ],
      "options": [
        {
          "value": "Africa/Abidjan",
          "label": "Africa/Abidjan"
        },
        {
          "value": "Africa/Accra",
          "label": "Africa/Accra"
        },
        {
          "value": "Africa/Addis_Ababa",
          "label": "Africa/Addis_Ababa"
        },
        {
          "value": "Africa/Algiers",
          "label": "Africa/Algiers"
        },
        {
          "value": "Africa/Asmera",
          "label": "Africa/Asmera"
        },
        {
          "value": "Africa/Bamako",
          "label": "Africa/Bamako"
        },
        {
          "value": "Africa/Bangui",
          "label": "Africa/Bangui"
        },
        {
          "value": "Africa/Banjul",
          "label": "Africa/Banjul"
        },
        {
          "value": "Africa/Bissau",
          "label": "Africa/Bissau"
        },
        {
          "value": "Africa/Blantyre",
          "label": "Africa/Blantyre"
        },
        {
          "value": "Africa/Brazzaville",
          "label": "Africa/Brazzaville"
        },
        {
          "value": "Africa/Bujumbura",
          "label": "Africa/Bujumbura"
        },
        {
          "value": "Africa/Cairo",
          "label": "Africa/Cairo"
        },
        {
          "value": "Africa/Casablanca",
          "label": "Africa/Casablanca"
        },
        {
          "value": "Africa/Ceuta",
          "label": "Africa/Ceuta"
        },
        {
          "value": "Africa/Conakry",
          "label": "Africa/Conakry"
        },
        {
          "value": "Africa/Dakar",
          "label": "Africa/Dakar"
        },
        {
          "value": "Africa/Dar_es_Salaam",
          "label": "Africa/Dar_es_Salaam"
        },
        {
          "value": "Africa/Djibouti",
          "label": "Africa/Djibouti"
        },
        {
          "value": "Africa/Douala",
          "label": "Africa/Douala"
        },
        {
          "value": "Africa/El_Aaiun",
          "label": "Africa/El_Aaiun"
        },
        {
          "value": "Africa/Freetown",
          "label": "Africa/Freetown"
        },
        {
          "value": "Africa/Gaborone",
          "label": "Africa/Gaborone"
        },
        {
          "value": "Africa/Harare",
          "label": "Africa/Harare"
        },
        {
          "value": "Africa/Johannesburg",
          "label": "Africa/Johannesburg"
        },
        {
          "value": "Africa/Juba",
          "label": "Africa/Juba"
        },
        {
          "value": "Africa/Kampala",
          "label": "Africa/Kampala"
        },
        {
          "value": "Africa/Khartoum",
          "label": "Africa/Khartoum"
        },
        {
          "value": "Africa/Kigali",
          "label": "Africa/Kigali"
        },
        {
          "value": "Africa/Kinshasa",
          "label": "Africa/Kinshasa"
        },
        {
          "value": "Africa/Lagos",
          "label": "Africa/Lagos"
        },
        {
          "value": "Africa/Libreville",
          "label": "Africa/Libreville"
        },
        {
          "value": "Africa/Lome",
          "label": "Africa/Lome"
        },
        {
          "value": "Africa/Luanda",
          "label": "Africa/Luanda"
        },
        {
          "value": "Africa/Lubumbashi",
          "label": "Africa/Lubumbashi"
        },
        {
          "value": "Africa/Lusaka",
          "label": "Africa/Lusaka"
        },
        {
          "value": "Africa/Malabo",
          "label": "Africa/Malabo"
        },
        {
          "value": "Africa/Maputo",
          "label": "Africa/Maputo"
        },
        {
          "value": "Africa/Maseru",
          "label": "Africa/Maseru"
        },
        {
          "value": "Africa/Mbabane",
          "label": "Africa/Mbabane"
        },
        {
          "value": "Africa/Mogadishu",
          "label": "Africa/Mogadishu"
        },
        {
          "value": "Africa/Monrovia",
          "label": "Africa/Monrovia"
        },
        {
          "value": "Africa/Nairobi",
          "label": "Africa/Nairobi"
        },
        {
          "value": "Africa/Ndjamena",
          "label": "Africa/Ndjamena"
        },
        {
          "value": "Africa/Niamey",
          "label": "Africa/Niamey"
        },
        {
          "value": "Africa/Nouakchott",
          "label": "Africa/Nouakchott"
        },
        {
          "value": "Africa/Ouagadougou",
          "label": "Africa/Ouagadougou"
        },
        {
          "value": "Africa/Porto-Novo",
          "label": "Africa/Porto-Novo"
        },
        {
          "value": "Africa/Sao_Tome",
          "label": "Africa/Sao_Tome"
        },
        {
          "value": "Africa/Tripoli",
          "label": "Africa/Tripoli"
        },
        {
          "value": "Africa/Tunis",
          "label": "Africa/Tunis"
        },
        {
          "value": "Africa/Windhoek",
          "label": "Africa/Windhoek"
        },
        {
          "value": "America/Adak",
          "label": "America/Adak"
        },
        {
          "value": "America/Anchorage",
          "label": "America/Anchorage"
        },
        {
          "value": "America/Anguilla",
          "label": "America/Anguilla"
        },
        {
          "value": "America/Antigua",
          "label": "America/Antigua"
        },
        {
          "value": "America/Araguaina",
          "label": "America/Araguaina"
        },
        {
          "value": "America/Argentina/La_Rioja",
          "label": "America/Argentina/La_Rioja"
        },
        {
          "value": "America/Argentina/Rio_Gallegos",
          "label": "America/Argentina/Rio_Gallegos"
        },
        {
          "value": "America/Argentina/Salta",
          "label": "America/Argentina/Salta"
        },
        {
          "value": "America/Argentina/San_Juan",
          "label": "America/Argentina/San_Juan"
        },
        {
          "value": "America/Argentina/San_Luis",
          "label": "America/Argentina/San_Luis"
        },
        {
          "value": "America/Argentina/Tucuman",
          "label": "America/Argentina/Tucuman"
        },
        {
          "value": "America/Argentina/Ushuaia",
          "label": "America/Argentina/Ushuaia"
        },
        {
          "value": "America/Aruba",
          "label": "America/Aruba"
        },
        {
          "value": "America/Asuncion",
          "label": "America/Asuncion"
        },
        {
          "value": "America/Bahia",
          "label": "America/Bahia"
        },
        {
          "value": "America/Bahia_Banderas",
          "label": "America/Bahia_Banderas"
        },
        {
          "value": "America/Barbados",
          "label": "America/Barbados"
        },
        {
          "value": "America/Belem",
          "label": "America/Belem"
        },
        {
          "value": "America/Belize",
          "label": "America/Belize"
        },
        {
          "value": "America/Blanc-Sablon",
          "label": "America/Blanc-Sablon"
        },
        {
          "value": "America/Boa_Vista",
          "label": "America/Boa_Vista"
        },
        {
          "value": "America/Bogota",
          "label": "America/Bogota"
        },
        {
          "value": "America/Boise",
          "label": "America/Boise"
        },
        {
          "value": "America/Buenos_Aires",
          "label": "America/Buenos_Aires"
        },
        {
          "value": "America/Cambridge_Bay",
          "label": "America/Cambridge_Bay"
        },
        {
          "value": "America/Campo_Grande",
          "label": "America/Campo_Grande"
        },
        {
          "value": "America/Cancun",
          "label": "America/Cancun"
        },
        {
          "value": "America/Caracas",
          "label": "America/Caracas"
        },
        {
          "value": "America/Catamarca",
          "label": "America/Catamarca"
        },
        {
          "value": "America/Cayenne",
          "label": "America/Cayenne"
        },
        {
          "value": "America/Cayman",
          "label": "America/Cayman"
        },
        {
          "value": "America/Chicago",
          "label": "America/Chicago"
        },
        {
          "value": "America/Chihuahua",
          "label": "America/Chihuahua"
        },
        {
          "value": "America/Ciudad_Juarez",
          "label": "America/Ciudad_Juarez"
        },
        {
          "value": "America/Coral_Harbour",
          "label": "America/Coral_Harbour"
        },
        {
          "value": "America/Cordoba",
          "label": "America/Cordoba"
        },
        {
          "value": "America/Costa_Rica",
          "label": "America/Costa_Rica"
        },
        {
          "value": "America/Creston",
          "label": "America/Creston"
        },
        {
          "value": "America/Cuiaba",
          "label": "America/Cuiaba"
        },
        {
          "value": "America/Curacao",
          "label": "America/Curacao"
        },
        {
          "value": "America/Danmarkshavn",
          "label": "America/Danmarkshavn"
        },
        {
          "value": "America/Dawson",
          "label": "America/Dawson"
        },
        {
          "value": "America/Dawson_Creek",
          "label": "America/Dawson_Creek"
        },
        {
          "value": "America/Denver",
          "label": "America/Denver"
        },
        {
          "value": "America/Detroit",
          "label": "America/Detroit"
        },
        {
          "value": "America/Dominica",
          "label": "America/Dominica"
        },
        {
          "value": "America/Edmonton",
          "label": "America/Edmonton"
        },
        {
          "value": "America/Eirunepe",
          "label": "America/Eirunepe"
        },
        {
          "value": "America/El_Salvador",
          "label": "America/El_Salvador"
        },
        {
          "value": "America/Fort_Nelson",
          "label": "America/Fort_Nelson"
        },
        {
          "value": "America/Fortaleza",
          "label": "America/Fortaleza"
        },
        {
          "value": "America/Glace_Bay",
          "label": "America/Glace_Bay"
        },
        {
          "value": "America/Godthab",
          "label": "America/Godthab"
        },
        {
          "value": "America/Goose_Bay",
          "label": "America/Goose_Bay"
        },
        {
          "value": "America/Grand_Turk",
          "label": "America/Grand_Turk"
        },
        {
          "value": "America/Grenada",
          "label": "America/Grenada"
        },
        {
          "value": "America/Guadeloupe",
          "label": "America/Guadeloupe"
        },
        {
          "value": "America/Guatemala",
          "label": "America/Guatemala"
        },
        {
          "value": "America/Guayaquil",
          "label": "America/Guayaquil"
        },
        {
          "value": "America/Guyana",
          "label": "America/Guyana"
        },
        {
          "value": "America/Halifax",
          "label": "America/Halifax"
        },
        {
          "value": "America/Havana",
          "label": "America/Havana"
        },
        {
          "value": "America/Hermosillo",
          "label": "America/Hermosillo"
        },
        {
          "value": "America/Indiana/Knox",
          "label": "America/Indiana/Knox"
        },
        {
          "value": "America/Indiana/Marengo",
          "label": "America/Indiana/Marengo"
        },
        {
          "value": "America/Indiana/Petersburg",
          "label": "America/Indiana/Petersburg"
        },
        {
          "value": "America/Indiana/Tell_City",
          "label": "America/Indiana/Tell_City"
        },
        {
          "value": "America/Indiana/Vevay",
          "label": "America/Indiana/Vevay"
        },
        {
          "value": "America/Indiana/Vincennes",
          "label": "America/Indiana/Vincennes"
        },
        {
          "value": "America/Indiana/Winamac",
          "label": "America/Indiana/Winamac"
        },
        {
          "value": "America/Indianapolis",
          "label": "America/Indianapolis"
        },
        {
          "value": "America/Inuvik",
          "label": "America/Inuvik"
        },
        {
          "value": "America/Iqaluit",
          "label": "America/Iqaluit"
        },
        {
          "value": "America/Jamaica",
          "label": "America/Jamaica"
        },
        {
          "value": "America/Jujuy",
          "label": "America/Jujuy"
        },
        {
          "value": "America/Juneau",
          "label": "America/Juneau"
        },
        {
          "value": "America/Kentucky/Monticello",
          "label": "America/Kentucky/Monticello"
        },
        {
          "value": "America/Kralendijk",
          "label": "America/Kralendijk"
        },
        {
          "value": "America/La_Paz",
          "label": "America/La_Paz"
        },
        {
          "value": "America/Lima",
          "label": "America/Lima"
        },
        {
          "value": "America/Los_Angeles",
          "label": "America/Los_Angeles"
        },
        {
          "value": "America/Louisville",
          "label": "America/Louisville"
        },
        {
          "value": "America/Lower_Princes",
          "label": "America/Lower_Princes"
        },
        {
          "value": "America/Maceio",
          "label": "America/Maceio"
        },
        {
          "value": "America/Managua",
          "label": "America/Managua"
        },
        {
          "value": "America/Manaus",
          "label": "America/Manaus"
        },
        {
          "value": "America/Marigot",
          "label": "America/Marigot"
        },
        {
          "value": "America/Martinique",
          "label": "America/Martinique"
        },
        {
          "value": "America/Matamoros",
          "label": "America/Matamoros"
        },
        {
          "value": "America/Mazatlan",
          "label": "America/Mazatlan"
        },
        {
          "value": "America/Mendoza",
          "label": "America/Mendoza"
        },
        {
          "value": "America/Menominee",
          "label": "America/Menominee"
        },
        {
          "value": "America/Merida",
          "label": "America/Merida"
        },
        {
          "value": "America/Metlakatla",
          "label": "America/Metlakatla"
        },
        {
          "value": "America/Mexico_City",
          "label": "America/Mexico_City"
        },
        {
          "value": "America/Miquelon",
          "label": "America/Miquelon"
        },
        {
          "value": "America/Moncton",
          "label": "America/Moncton"
        },
        {
          "value": "America/Monterrey",
          "label": "America/Monterrey"
        },
        {
          "value": "America/Montevideo",
          "label": "America/Montevideo"
        },
        {
          "value": "America/Montserrat",
          "label": "America/Montserrat"
        },
        {
          "value": "America/Nassau",
          "label": "America/Nassau"
        },
        {
          "value": "America/New_York",
          "label": "America/New_York"
        },
        {
          "value": "America/Nome",
          "label": "America/Nome"
        },
        {
          "value": "America/Noronha",
          "label": "America/Noronha"
        },
        {
          "value": "America/North_Dakota/Beulah",
          "label": "America/North_Dakota/Beulah"
        },
        {
          "value": "America/North_Dakota/Center",
          "label": "America/North_Dakota/Center"
        },
        {
          "value": "America/North_Dakota/New_Salem",
          "label": "America/North_Dakota/New_Salem"
        },
        {
          "value": "America/Ojinaga",
          "label": "America/Ojinaga"
        },
        {
          "value": "America/Panama",
          "label": "America/Panama"
        },
        {
          "value": "America/Paramaribo",
          "label": "America/Paramaribo"
        },
        {
          "value": "America/Phoenix",
          "label": "America/Phoenix"
        },
        {
          "value": "America/Port-au-Prince",
          "label": "America/Port-au-Prince"
        },
        {
          "value": "America/Port_of_Spain",
          "label": "America/Port_of_Spain"
        },
        {
          "value": "America/Porto_Velho",
          "label": "America/Porto_Velho"
        },
        {
          "value": "America/Puerto_Rico",
          "label": "America/Puerto_Rico"
        },
        {
          "value": "America/Punta_Arenas",
          "label": "America/Punta_Arenas"
        },
        {
          "value": "America/Rankin_Inlet",
          "label": "America/Rankin_Inlet"
        },
        {
          "value": "America/Recife",
          "label": "America/Recife"
        },
        {
          "value": "America/Regina",
          "label": "America/Regina"
        },
        {
          "value": "America/Resolute",
          "label": "America/Resolute"
        },
        {
          "value": "America/Rio_Branco",
          "label": "America/Rio_Branco"
        },
        {
          "value": "America/Santarem",
          "label": "America/Santarem"
        },
        {
          "value": "America/Santiago",
          "label": "America/Santiago"
        },
        {
          "value": "America/Santo_Domingo",
          "label": "America/Santo_Domingo"
        },
        {
          "value": "America/Sao_Paulo",
          "label": "America/Sao_Paulo"
        },
        {
          "value": "America/Scoresbysund",
          "label": "America/Scoresbysund"
        },
        {
          "value": "America/Sitka",
          "label": "America/Sitka"
        },
        {
          "value": "America/St_Barthelemy",
          "label": "America/St_Barthelemy"
        },
        {
          "value": "America/St_Johns",
          "label": "America/St_Johns"
        },
        {
          "value": "America/St_Kitts",
          "label": "America/St_Kitts"
        },
        {
          "value": "America/St_Lucia",
          "label": "America/St_Lucia"
        },
        {
          "value": "America/St_Thomas",
          "label": "America/St_Thomas"
        },
        {
          "value": "America/St_Vincent",
          "label": "America/St_Vincent"
        },
        {
          "value": "America/Swift_Current",
          "label": "America/Swift_Current"
        },
        {
          "value": "America/Tegucigalpa",
          "label": "America/Tegucigalpa"
        },
        {
          "value": "America/Thule",
          "label": "America/Thule"
        },
        {
          "value": "America/Tijuana",
          "label": "America/Tijuana"
        },
        {
          "value": "America/Toronto",
          "label": "America/Toronto"
        },
        {
          "value": "America/Tortola",
          "label": "America/Tortola"
        },
        {
          "value": "America/Vancouver",
          "label": "America/Vancouver"
        },
        {
          "value": "America/Whitehorse",
          "label": "America/Whitehorse"
        },
        {
          "value": "America/Winnipeg",
          "label": "America/Winnipeg"
        },
        {
          "value": "America/Yakutat",
          "label": "America/Yakutat"
        },
        {
          "value": "Antarctica/Casey",
          "label": "Antarctica/Casey"
        },
        {
          "value": "Antarctica/Davis",
          "label": "Antarctica/Davis"
        },
        {
          "value": "Antarctica/DumontDUrville",
          "label": "Antarctica/DumontDUrville"
        },
        {
          "value": "Antarctica/Macquarie",
          "label": "Antarctica/Macquarie"
        },
        {
          "value": "Antarctica/Mawson",
          "label": "Antarctica/Mawson"
        },
        {
          "value": "Antarctica/McMurdo",
          "label": "Antarctica/McMurdo"
        },
        {
          "value": "Antarctica/Palmer",
          "label": "Antarctica/Palmer"
        },
        {
          "value": "Antarctica/Rothera",
          "label": "Antarctica/Rothera"
        },
        {
          "value": "Antarctica/Syowa",
          "label": "Antarctica/Syowa"
        },
        {
          "value": "Antarctica/Troll",
          "label": "Antarctica/Troll"
        },
        {
          "value": "Antarctica/Vostok",
          "label": "Antarctica/Vostok"
        },
        {
          "value": "Arctic/Longyearbyen",
          "label": "Arctic/Longyearbyen"
        },
        {
          "value": "Asia/Aden",
          "label": "Asia/Aden"
        },
        {
          "value": "Asia/Almaty",
          "label": "Asia/Almaty"
        },
        {
          "value": "Asia/Amman",
          "label": "Asia/Amman"
        },
        {
          "value": "Asia/Anadyr",
          "label": "Asia/Anadyr"
        },
        {
          "value": "Asia/Aqtau",
          "label": "Asia/Aqtau"
        },
        {
          "value": "Asia/Aqtobe",
          "label": "Asia/Aqtobe"
        },
        {
          "value": "Asia/Ashgabat",
          "label": "Asia/Ashgabat"
        },
        {
          "value": "Asia/Atyrau",
          "label": "Asia/Atyrau"
        },
        {
          "value": "Asia/Baghdad",
          "label": "Asia/Baghdad"
        },
        {
          "value": "Asia/Bahrain",
          "label": "Asia/Bahrain"
        },
        {
          "value": "Asia/Baku",
          "label": "Asia/Baku"
        },
        {
          "value": "Asia/Bangkok",
          "label": "Asia/Bangkok"
        },
        {
          "value": "Asia/Barnaul",
          "label": "Asia/Barnaul"
        },
        {
          "value": "Asia/Beirut",
          "label": "Asia/Beirut"
        },
        {
          "value": "Asia/Bishkek",
          "label": "Asia/Bishkek"
        },
        {
          "value": "Asia/Brunei",
          "label": "Asia/Brunei"
        },
        {
          "value": "Asia/Calcutta",
          "label": "Asia/Calcutta"
        },
        {
          "value": "Asia/Chita",
          "label": "Asia/Chita"
        },
        {
          "value": "Asia/Colombo",
          "label": "Asia/Colombo"
        },
        {
          "value": "Asia/Damascus",
          "label": "Asia/Damascus"
        },
        {
          "value": "Asia/Dhaka",
          "label": "Asia/Dhaka"
        },
        {
          "value": "Asia/Dili",
          "label": "Asia/Dili"
        },
        {
          "value": "Asia/Dubai",
          "label": "Asia/Dubai"
        },
        {
          "value": "Asia/Dushanbe",
          "label": "Asia/Dushanbe"
        },
        {
          "value": "Asia/Famagusta",
          "label": "Asia/Famagusta"
        },
        {
          "value": "Asia/Gaza",
          "label": "Asia/Gaza"
        },
        {
          "value": "Asia/Hebron",
          "label": "Asia/Hebron"
        },
        {
          "value": "Asia/Hong_Kong",
          "label": "Asia/Hong_Kong"
        },
        {
          "value": "Asia/Hovd",
          "label": "Asia/Hovd"
        },
        {
          "value": "Asia/Irkutsk",
          "label": "Asia/Irkutsk"
        },
        {
          "value": "Asia/Jakarta",
          "label": "Asia/Jakarta"
        },
        {
          "value": "Asia/Jayapura",
          "label": "Asia/Jayapura"
        },
        {
          "value": "Asia/Jerusalem",
          "label": "Asia/Jerusalem"
        },
        {
          "value": "Asia/Kabul",
          "label": "Asia/Kabul"
        },
        {
          "value": "Asia/Kamchatka",
          "label": "Asia/Kamchatka"
        },
        {
          "value": "Asia/Karachi",
          "label": "Asia/Karachi"
        },
        {
          "value": "Asia/Katmandu",
          "label": "Asia/Katmandu"
        },
        {
          "value": "Asia/Khandyga",
          "label": "Asia/Khandyga"
        },
        {
          "value": "Asia/Krasnoyarsk",
          "label": "Asia/Krasnoyarsk"
        },
        {
          "value": "Asia/Kuala_Lumpur",
          "label": "Asia/Kuala_Lumpur"
        },
        {
          "value": "Asia/Kuching",
          "label": "Asia/Kuching"
        },
        {
          "value": "Asia/Kuwait",
          "label": "Asia/Kuwait"
        },
        {
          "value": "Asia/Macau",
          "label": "Asia/Macau"
        },
        {
          "value": "Asia/Magadan",
          "label": "Asia/Magadan"
        },
        {
          "value": "Asia/Makassar",
          "label": "Asia/Makassar"
        },
        {
          "value": "Asia/Manila",
          "label": "Asia/Manila"
        },
        {
          "value": "Asia/Muscat",
          "label": "Asia/Muscat"
        },
        {
          "value": "Asia/Nicosia",
          "label": "Asia/Nicosia"
        },
        {
          "value": "Asia/Novokuznetsk",
          "label": "Asia/Novokuznetsk"
        },
        {
          "value": "Asia/Novosibirsk",
          "label": "Asia/Novosibirsk"
        },
        {
          "value": "Asia/Omsk",
          "label": "Asia/Omsk"
        },
        {
          "value": "Asia/Oral",
          "label": "Asia/Oral"
        },
        {
          "value": "Asia/Phnom_Penh",
          "label": "Asia/Phnom_Penh"
        },
        {
          "value": "Asia/Pontianak",
          "label": "Asia/Pontianak"
        },
        {
          "value": "Asia/Pyongyang",
          "label": "Asia/Pyongyang"
        },
        {
          "value": "Asia/Qatar",
          "label": "Asia/Qatar"
        },
        {
          "value": "Asia/Qostanay",
          "label": "Asia/Qostanay"
        },
        {
          "value": "Asia/Qyzylorda",
          "label": "Asia/Qyzylorda"
        },
        {
          "value": "Asia/Rangoon",
          "label": "Asia/Rangoon"
        },
        {
          "value": "Asia/Riyadh",
          "label": "Asia/Riyadh"
        },
        {
          "value": "Asia/Saigon",
          "label": "Asia/Saigon"
        },
        {
          "value": "Asia/Sakhalin",
          "label": "Asia/Sakhalin"
        },
        {
          "value": "Asia/Samarkand",
          "label": "Asia/Samarkand"
        },
        {
          "value": "Asia/Seoul",
          "label": "Asia/Seoul"
        },
        {
          "value": "Asia/Shanghai",
          "label": "Asia/Shanghai"
        },
        {
          "value": "Asia/Singapore",
          "label": "Asia/Singapore"
        },
        {
          "value": "Asia/Srednekolymsk",
          "label": "Asia/Srednekolymsk"
        },
        {
          "value": "Asia/Taipei",
          "label": "Asia/Taipei"
        },
        {
          "value": "Asia/Tashkent",
          "label": "Asia/Tashkent"
        },
        {
          "value": "Asia/Tbilisi",
          "label": "Asia/Tbilisi"
        },
        {
          "value": "Asia/Tehran",
          "label": "Asia/Tehran"
        },
        {
          "value": "Asia/Thimphu",
          "label": "Asia/Thimphu"
        },
        {
          "value": "Asia/Tokyo",
          "label": "Asia/Tokyo"
        },
        {
          "value": "Asia/Tomsk",
          "label": "Asia/Tomsk"
        },
        {
          "value": "Asia/Ulaanbaatar",
          "label": "Asia/Ulaanbaatar"
        },
        {
          "value": "Asia/Urumqi",
          "label": "Asia/Urumqi"
        },
        {
          "value": "Asia/Ust-Nera",
          "label": "Asia/Ust-Nera"
        },
        {
          "value": "Asia/Vientiane",
          "label": "Asia/Vientiane"
        },
        {
          "value": "Asia/Vladivostok",
          "label": "Asia/Vladivostok"
        },
        {
          "value": "Asia/Yakutsk",
          "label": "Asia/Yakutsk"
        },
        {
          "value": "Asia/Yekaterinburg",
          "label": "Asia/Yekaterinburg"
        },
        {
          "value": "Asia/Yerevan",
          "label": "Asia/Yerevan"
        },
        {
          "value": "Atlantic/Azores",
          "label": "Atlantic/Azores"
        },
        {
          "value": "Atlantic/Bermuda",
          "label": "Atlantic/Bermuda"
        },
        {
          "value": "Atlantic/Canary",
          "label": "Atlantic/Canary"
        },
        {
          "value": "Atlantic/Cape_Verde",
          "label": "Atlantic/Cape_Verde"
        },
        {
          "value": "Atlantic/Faeroe",
          "label": "Atlantic/Faeroe"
        },
        {
          "value": "Atlantic/Madeira",
          "label": "Atlantic/Madeira"
        },
        {
          "value": "Atlantic/Reykjavik",
          "label": "Atlantic/Reykjavik"
        },
        {
          "value": "Atlantic/South_Georgia",
          "label": "Atlantic/South_Georgia"
        },
        {
          "value": "Atlantic/St_Helena",
          "label": "Atlantic/St_Helena"
        },
        {
          "value": "Atlantic/Stanley",
          "label": "Atlantic/Stanley"
        },
        {
          "value": "Australia/Adelaide",
          "label": "Australia/Adelaide"
        },
        {
          "value": "Australia/Brisbane",
          "label": "Australia/Brisbane"
        },
        {
          "value": "Australia/Broken_Hill",
          "label": "Australia/Broken_Hill"
        },
        {
          "value": "Australia/Darwin",
          "label": "Australia/Darwin"
        },
        {
          "value": "Australia/Eucla",
          "label": "Australia/Eucla"
        },
        {
          "value": "Australia/Hobart",
          "label": "Australia/Hobart"
        },
        {
          "value": "Australia/Lindeman",
          "label": "Australia/Lindeman"
        },
        {
          "value": "Australia/Lord_Howe",
          "label": "Australia/Lord_Howe"
        },
        {
          "value": "Australia/Melbourne",
          "label": "Australia/Melbourne"
        },
        {
          "value": "Australia/Perth",
          "label": "Australia/Perth"
        },
        {
          "value": "Australia/Sydney",
          "label": "Australia/Sydney"
        },
        {
          "value": "Europe/Amsterdam",
          "label": "Europe/Amsterdam"
        },
        {
          "value": "Europe/Andorra",
          "label": "Europe/Andorra"
        },
        {
          "value": "Europe/Astrakhan",
          "label": "Europe/Astrakhan"
        },
        {
          "value": "Europe/Athens",
          "label": "Europe/Athens"
        },
        {
          "value": "Europe/Belgrade",
          "label": "Europe/Belgrade"
        },
        {
          "value": "Europe/Berlin",
          "label": "Europe/Berlin"
        },
        {
          "value": "Europe/Bratislava",
          "label": "Europe/Bratislava"
        },
        {
          "value": "Europe/Brussels",
          "label": "Europe/Brussels"
        },
        {
          "value": "Europe/Bucharest",
          "label": "Europe/Bucharest"
        },
        {
          "value": "Europe/Budapest",
          "label": "Europe/Budapest"
        },
        {
          "value": "Europe/Busingen",
          "label": "Europe/Busingen"
        },
        {
          "value": "Europe/Chisinau",
          "label": "Europe/Chisinau"
        },
        {
          "value": "Europe/Copenhagen",
          "label": "Europe/Copenhagen"
        },
        {
          "value": "Europe/Dublin",
          "label": "Europe/Dublin"
        },
        {
          "value": "Europe/Gibraltar",
          "label": "Europe/Gibraltar"
        },
        {
          "value": "Europe/Guernsey",
          "label": "Europe/Guernsey"
        },
        {
          "value": "Europe/Helsinki",
          "label": "Europe/Helsinki"
        },
        {
          "value": "Europe/Isle_of_Man",
          "label": "Europe/Isle_of_Man"
        },
        {
          "value": "Europe/Istanbul",
          "label": "Europe/Istanbul"
        },
        {
          "value": "Europe/Jersey",
          "label": "Europe/Jersey"
        },
        {
          "value": "Europe/Kaliningrad",
          "label": "Europe/Kaliningrad"
        },
        {
          "value": "Europe/Kiev",
          "label": "Europe/Kiev"
        },
        {
          "value": "Europe/Kirov",
          "label": "Europe/Kirov"
        },
        {
          "value": "Europe/Lisbon",
          "label": "Europe/Lisbon"
        },
        {
          "value": "Europe/Ljubljana",
          "label": "Europe/Ljubljana"
        },
        {
          "value": "Europe/London",
          "label": "Europe/London"
        },
        {
          "value": "Europe/Luxembourg",
          "label": "Europe/Luxembourg"
        },
        {
          "value": "Europe/Madrid",
          "label": "Europe/Madrid"
        },
        {
          "value": "Europe/Malta",
          "label": "Europe/Malta"
        },
        {
          "value": "Europe/Mariehamn",
          "label": "Europe/Mariehamn"
        },
        {
          "value": "Europe/Minsk",
          "label": "Europe/Minsk"
        },
        {
          "value": "Europe/Monaco",
          "label": "Europe/Monaco"
        },
        {
          "value": "Europe/Moscow",
          "label": "Europe/Moscow"
        },
        {
          "value": "Europe/Oslo",
          "label": "Europe/Oslo"
        },
        {
          "value": "Europe/Paris",
          "label": "Europe/Paris"
        },
        {
          "value": "Europe/Podgorica",
          "label": "Europe/Podgorica"
        },
        {
          "value": "Europe/Prague",
          "label": "Europe/Prague"
        },
        {
          "value": "Europe/Riga",
          "label": "Europe/Riga"
        },
        {
          "value": "Europe/Rome",
          "label": "Europe/Rome"
        },
        {
          "value": "Europe/Samara",
          "label": "Europe/Samara"
        },
        {
          "value": "Europe/San_Marino",
          "label": "Europe/San_Marino"
        },
        {
          "value": "Europe/Sarajevo",
          "label": "Europe/Sarajevo"
        },
        {
          "value": "Europe/Saratov",
          "label": "Europe/Saratov"
        },
        {
          "value": "Europe/Simferopol",
          "label": "Europe/Simferopol"
        },
        {
          "value": "Europe/Skopje",
          "label": "Europe/Skopje"
        },
        {
          "value": "Europe/Sofia",
          "label": "Europe/Sofia"
        },
        {
          "value": "Europe/Stockholm",
          "label": "Europe/Stockholm"
        },
        {
          "value": "Europe/Tallinn",
          "label": "Europe/Tallinn"
        },
        {
          "value": "Europe/Tirane",
          "label": "Europe/Tirane"
        },
        {
          "value": "Europe/Ulyanovsk",
          "label": "Europe/Ulyanovsk"
        },
        {
          "value": "Europe/Vaduz",
          "label": "Europe/Vaduz"
        },
        {
          "value": "Europe/Vatican",
          "label": "Europe/Vatican"
        },
        {
          "value": "Europe/Vienna",
          "label": "Europe/Vienna"
        },
        {
          "value": "Europe/Vilnius",
          "label": "Europe/Vilnius"
        },
        {
          "value": "Europe/Volgograd",
          "label": "Europe/Volgograd"
        },
        {
          "value": "Europe/Warsaw",
          "label": "Europe/Warsaw"
        },
        {
          "value": "Europe/Zagreb",
          "label": "Europe/Zagreb"
        },
        {
          "value": "Europe/Zurich",
          "label": "Europe/Zurich"
        },
        {
          "value": "Indian/Antananarivo",
          "label": "Indian/Antananarivo"
        },
        {
          "value": "Indian/Chagos",
          "label": "Indian/Chagos"
        },
        {
          "value": "Indian/Christmas",
          "label": "Indian/Christmas"
        },
        {
          "value": "Indian/Cocos",
          "label": "Indian/Cocos"
        },
        {
          "value": "Indian/Comoro",
          "label": "Indian/Comoro"
        },
        {
          "value": "Indian/Kerguelen",
          "label": "Indian/Kerguelen"
        },
        {
          "value": "Indian/Mahe",
          "label": "Indian/Mahe"
        },
        {
          "value": "Indian/Maldives",
          "label": "Indian/Maldives"
        },
        {
          "value": "Indian/Mauritius",
          "label": "Indian/Mauritius"
        },
        {
          "value": "Indian/Mayotte",
          "label": "Indian/Mayotte"
        },
        {
          "value": "Indian/Reunion",
          "label": "Indian/Reunion"
        },
        {
          "value": "Pacific/Apia",
          "label": "Pacific/Apia"
        },
        {
          "value": "Pacific/Auckland",
          "label": "Pacific/Auckland"
        },
        {
          "value": "Pacific/Bougainville",
          "label": "Pacific/Bougainville"
        },
        {
          "value": "Pacific/Chatham",
          "label": "Pacific/Chatham"
        },
        {
          "value": "Pacific/Easter",
          "label": "Pacific/Easter"
        },
        {
          "value": "Pacific/Efate",
          "label": "Pacific/Efate"
        },
        {
          "value": "Pacific/Enderbury",
          "label": "Pacific/Enderbury"
        },
        {
          "value": "Pacific/Fakaofo",
          "label": "Pacific/Fakaofo"
        },
        {
          "value": "Pacific/Fiji",
          "label": "Pacific/Fiji"
        },
        {
          "value": "Pacific/Funafuti",
          "label": "Pacific/Funafuti"
        },
        {
          "value": "Pacific/Galapagos",
          "label": "Pacific/Galapagos"
        },
        {
          "value": "Pacific/Gambier",
          "label": "Pacific/Gambier"
        },
        {
          "value": "Pacific/Guadalcanal",
          "label": "Pacific/Guadalcanal"
        },
        {
          "value": "Pacific/Guam",
          "label": "Pacific/Guam"
        },
        {
          "value": "Pacific/Honolulu",
          "label": "Pacific/Honolulu"
        },
        {
          "value": "Pacific/Kiritimati",
          "label": "Pacific/Kiritimati"
        },
        {
          "value": "Pacific/Kosrae",
          "label": "Pacific/Kosrae"
        },
        {
          "value": "Pacific/Kwajalein",
          "label": "Pacific/Kwajalein"
        },
        {
          "value": "Pacific/Majuro",
          "label": "Pacific/Majuro"
        },
        {
          "value": "Pacific/Marquesas",
          "label": "Pacific/Marquesas"
        },
        {
          "value": "Pacific/Midway",
          "label": "Pacific/Midway"
        },
        {
          "value": "Pacific/Nauru",
          "label": "Pacific/Nauru"
        },
        {
          "value": "Pacific/Niue",
          "label": "Pacific/Niue"
        },
        {
          "value": "Pacific/Norfolk",
          "label": "Pacific/Norfolk"
        },
        {
          "value": "Pacific/Noumea",
          "label": "Pacific/Noumea"
        },
        {
          "value": "Pacific/Pago_Pago",
          "label": "Pacific/Pago_Pago"
        },
        {
          "value": "Pacific/Palau",
          "label": "Pacific/Palau"
        },
        {
          "value": "Pacific/Pitcairn",
          "label": "Pacific/Pitcairn"
        },
        {
          "value": "Pacific/Ponape",
          "label": "Pacific/Ponape"
        },
        {
          "value": "Pacific/Port_Moresby",
          "label": "Pacific/Port_Moresby"
        },
        {
          "value": "Pacific/Rarotonga",
          "label": "Pacific/Rarotonga"
        },
        {
          "value": "Pacific/Saipan",
          "label": "Pacific/Saipan"
        },
        {
          "value": "Pacific/Tahiti",
          "label": "Pacific/Tahiti"
        },
        {
          "value": "Pacific/Tarawa",
          "label": "Pacific/Tarawa"
        },
        {
          "value": "Pacific/Tongatapu",
          "label": "Pacific/Tongatapu"
        },
        {
          "value": "Pacific/Truk",
          "label": "Pacific/Truk"
        },
        {
          "value": "Pacific/Wake",
          "label": "Pacific/Wake"
        },
        {
          "value": "Pacific/Wallis",
          "label": "Pacific/Wallis"
        }
      ],
      "name": "timezone",
      "required": false,
      "wireName": "timezone"
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
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "created_at",
      "required": true,
      "wireName": "created_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updated_at",
      "required": true,
      "wireName": "updated_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "archived_at",
      "required": false,
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
      "name": "customer_client_id",
      "required": true,
      "wireName": "customer_client_id"
    },
    {
      "kind": "enum",
      "typeName": "CustomerConsentType",
      "isArray": false,
      "enumValues": [
        "privacy_policy",
        "marketing_email",
        "marketing_whatsapp",
        "profiling"
      ],
      "options": [
        {
          "value": "privacy_policy",
          "label": "privacy_policy"
        },
        {
          "value": "marketing_email",
          "label": "marketing_email"
        },
        {
          "value": "marketing_whatsapp",
          "label": "marketing_whatsapp"
        },
        {
          "value": "profiling",
          "label": "profiling"
        }
      ],
      "name": "consent_type",
      "required": true,
      "wireName": "consent_type"
    },
    {
      "kind": "enum",
      "typeName": "CustomerConsentStatus",
      "isArray": false,
      "enumValues": [
        "granted",
        "withdrawn",
        "unknown"
      ],
      "options": [
        {
          "value": "granted",
          "label": "granted"
        },
        {
          "value": "withdrawn",
          "label": "withdrawn"
        },
        {
          "value": "unknown",
          "label": "unknown"
        }
      ],
      "name": "status",
      "required": true,
      "wireName": "status"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "captured_via",
      "required": false,
      "wireName": "captured_via"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "captured_at",
      "required": true,
      "wireName": "captured_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "evidence_ref",
      "required": false,
      "wireName": "evidence_ref"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updated_at",
      "required": true,
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
      "name": "customer_client_id",
      "required": true,
      "wireName": "customer_client_id"
    },
    {
      "kind": "enum",
      "typeName": "CustomerDocumentType",
      "isArray": false,
      "enumValues": [
        "passport",
        "national_id",
        "visa",
        "other"
      ],
      "options": [
        {
          "value": "passport",
          "label": "passport"
        },
        {
          "value": "national_id",
          "label": "national_id"
        },
        {
          "value": "visa",
          "label": "visa"
        },
        {
          "value": "other",
          "label": "other"
        }
      ],
      "name": "document_type",
      "required": true,
      "wireName": "document_type"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "document_number",
      "required": false,
      "wireName": "document_number"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "document_picture_ref",
      "required": false,
      "wireName": "document_picture_ref"
    },
    {
      "kind": "enum",
      "typeName": "CountryCode",
      "isArray": false,
      "enumValues": [
        "AD",
        "AE",
        "AF",
        "AG",
        "AI",
        "AL",
        "AM",
        "AO",
        "AQ",
        "AR",
        "AS",
        "AT",
        "AU",
        "AW",
        "AX",
        "AZ",
        "BA",
        "BB",
        "BD",
        "BE",
        "BF",
        "BG",
        "BH",
        "BI",
        "BJ",
        "BL",
        "BM",
        "BN",
        "BO",
        "BQ",
        "BR",
        "BS",
        "BT",
        "BV",
        "BW",
        "BY",
        "BZ",
        "CA",
        "CC",
        "CD",
        "CF",
        "CG",
        "CH",
        "CI",
        "CK",
        "CL",
        "CM",
        "CN",
        "CO",
        "CR",
        "CU",
        "CV",
        "CW",
        "CX",
        "CY",
        "CZ",
        "DE",
        "DJ",
        "DK",
        "DM",
        "DO",
        "DZ",
        "EC",
        "EE",
        "EG",
        "EH",
        "ER",
        "ES",
        "ET",
        "FI",
        "FJ",
        "FK",
        "FM",
        "FO",
        "FR",
        "GA",
        "GB",
        "GD",
        "GE",
        "GF",
        "GG",
        "GH",
        "GI",
        "GL",
        "GM",
        "GN",
        "GP",
        "GQ",
        "GR",
        "GS",
        "GT",
        "GU",
        "GW",
        "GY",
        "HK",
        "HM",
        "HN",
        "HR",
        "HT",
        "HU",
        "ID",
        "IE",
        "IL",
        "IM",
        "IN",
        "IO",
        "IQ",
        "IR",
        "IS",
        "IT",
        "JE",
        "JM",
        "JO",
        "JP",
        "KE",
        "KG",
        "KH",
        "KI",
        "KM",
        "KN",
        "KP",
        "KR",
        "KW",
        "KY",
        "KZ",
        "LA",
        "LB",
        "LC",
        "LI",
        "LK",
        "LR",
        "LS",
        "LT",
        "LU",
        "LV",
        "LY",
        "MA",
        "MC",
        "MD",
        "ME",
        "MF",
        "MG",
        "MH",
        "MK",
        "ML",
        "MM",
        "MN",
        "MO",
        "MP",
        "MQ",
        "MR",
        "MS",
        "MT",
        "MU",
        "MV",
        "MW",
        "MX",
        "MY",
        "MZ",
        "NA",
        "NC",
        "NE",
        "NF",
        "NG",
        "NI",
        "NL",
        "NO",
        "NP",
        "NR",
        "NU",
        "NZ",
        "OM",
        "PA",
        "PE",
        "PF",
        "PG",
        "PH",
        "PK",
        "PL",
        "PM",
        "PN",
        "PR",
        "PS",
        "PT",
        "PW",
        "PY",
        "QA",
        "RE",
        "RO",
        "RS",
        "RU",
        "RW",
        "SA",
        "SB",
        "SC",
        "SD",
        "SE",
        "SG",
        "SH",
        "SI",
        "SJ",
        "SK",
        "SL",
        "SM",
        "SN",
        "SO",
        "SR",
        "SS",
        "ST",
        "SV",
        "SX",
        "SY",
        "SZ",
        "TC",
        "TD",
        "TF",
        "TG",
        "TH",
        "TJ",
        "TK",
        "TL",
        "TM",
        "TN",
        "TO",
        "TR",
        "TT",
        "TV",
        "TW",
        "TZ",
        "UA",
        "UG",
        "UM",
        "US",
        "UY",
        "UZ",
        "VA",
        "VC",
        "VE",
        "VG",
        "VI",
        "VN",
        "VU",
        "WF",
        "WS",
        "YE",
        "YT",
        "ZA",
        "ZM",
        "ZW"
      ],
      "options": [
        {
          "value": "AD",
          "label": "AD"
        },
        {
          "value": "AE",
          "label": "AE"
        },
        {
          "value": "AF",
          "label": "AF"
        },
        {
          "value": "AG",
          "label": "AG"
        },
        {
          "value": "AI",
          "label": "AI"
        },
        {
          "value": "AL",
          "label": "AL"
        },
        {
          "value": "AM",
          "label": "AM"
        },
        {
          "value": "AO",
          "label": "AO"
        },
        {
          "value": "AQ",
          "label": "AQ"
        },
        {
          "value": "AR",
          "label": "AR"
        },
        {
          "value": "AS",
          "label": "AS"
        },
        {
          "value": "AT",
          "label": "AT"
        },
        {
          "value": "AU",
          "label": "AU"
        },
        {
          "value": "AW",
          "label": "AW"
        },
        {
          "value": "AX",
          "label": "AX"
        },
        {
          "value": "AZ",
          "label": "AZ"
        },
        {
          "value": "BA",
          "label": "BA"
        },
        {
          "value": "BB",
          "label": "BB"
        },
        {
          "value": "BD",
          "label": "BD"
        },
        {
          "value": "BE",
          "label": "BE"
        },
        {
          "value": "BF",
          "label": "BF"
        },
        {
          "value": "BG",
          "label": "BG"
        },
        {
          "value": "BH",
          "label": "BH"
        },
        {
          "value": "BI",
          "label": "BI"
        },
        {
          "value": "BJ",
          "label": "BJ"
        },
        {
          "value": "BL",
          "label": "BL"
        },
        {
          "value": "BM",
          "label": "BM"
        },
        {
          "value": "BN",
          "label": "BN"
        },
        {
          "value": "BO",
          "label": "BO"
        },
        {
          "value": "BQ",
          "label": "BQ"
        },
        {
          "value": "BR",
          "label": "BR"
        },
        {
          "value": "BS",
          "label": "BS"
        },
        {
          "value": "BT",
          "label": "BT"
        },
        {
          "value": "BV",
          "label": "BV"
        },
        {
          "value": "BW",
          "label": "BW"
        },
        {
          "value": "BY",
          "label": "BY"
        },
        {
          "value": "BZ",
          "label": "BZ"
        },
        {
          "value": "CA",
          "label": "CA"
        },
        {
          "value": "CC",
          "label": "CC"
        },
        {
          "value": "CD",
          "label": "CD"
        },
        {
          "value": "CF",
          "label": "CF"
        },
        {
          "value": "CG",
          "label": "CG"
        },
        {
          "value": "CH",
          "label": "CH"
        },
        {
          "value": "CI",
          "label": "CI"
        },
        {
          "value": "CK",
          "label": "CK"
        },
        {
          "value": "CL",
          "label": "CL"
        },
        {
          "value": "CM",
          "label": "CM"
        },
        {
          "value": "CN",
          "label": "CN"
        },
        {
          "value": "CO",
          "label": "CO"
        },
        {
          "value": "CR",
          "label": "CR"
        },
        {
          "value": "CU",
          "label": "CU"
        },
        {
          "value": "CV",
          "label": "CV"
        },
        {
          "value": "CW",
          "label": "CW"
        },
        {
          "value": "CX",
          "label": "CX"
        },
        {
          "value": "CY",
          "label": "CY"
        },
        {
          "value": "CZ",
          "label": "CZ"
        },
        {
          "value": "DE",
          "label": "DE"
        },
        {
          "value": "DJ",
          "label": "DJ"
        },
        {
          "value": "DK",
          "label": "DK"
        },
        {
          "value": "DM",
          "label": "DM"
        },
        {
          "value": "DO",
          "label": "DO"
        },
        {
          "value": "DZ",
          "label": "DZ"
        },
        {
          "value": "EC",
          "label": "EC"
        },
        {
          "value": "EE",
          "label": "EE"
        },
        {
          "value": "EG",
          "label": "EG"
        },
        {
          "value": "EH",
          "label": "EH"
        },
        {
          "value": "ER",
          "label": "ER"
        },
        {
          "value": "ES",
          "label": "ES"
        },
        {
          "value": "ET",
          "label": "ET"
        },
        {
          "value": "FI",
          "label": "FI"
        },
        {
          "value": "FJ",
          "label": "FJ"
        },
        {
          "value": "FK",
          "label": "FK"
        },
        {
          "value": "FM",
          "label": "FM"
        },
        {
          "value": "FO",
          "label": "FO"
        },
        {
          "value": "FR",
          "label": "FR"
        },
        {
          "value": "GA",
          "label": "GA"
        },
        {
          "value": "GB",
          "label": "GB"
        },
        {
          "value": "GD",
          "label": "GD"
        },
        {
          "value": "GE",
          "label": "GE"
        },
        {
          "value": "GF",
          "label": "GF"
        },
        {
          "value": "GG",
          "label": "GG"
        },
        {
          "value": "GH",
          "label": "GH"
        },
        {
          "value": "GI",
          "label": "GI"
        },
        {
          "value": "GL",
          "label": "GL"
        },
        {
          "value": "GM",
          "label": "GM"
        },
        {
          "value": "GN",
          "label": "GN"
        },
        {
          "value": "GP",
          "label": "GP"
        },
        {
          "value": "GQ",
          "label": "GQ"
        },
        {
          "value": "GR",
          "label": "GR"
        },
        {
          "value": "GS",
          "label": "GS"
        },
        {
          "value": "GT",
          "label": "GT"
        },
        {
          "value": "GU",
          "label": "GU"
        },
        {
          "value": "GW",
          "label": "GW"
        },
        {
          "value": "GY",
          "label": "GY"
        },
        {
          "value": "HK",
          "label": "HK"
        },
        {
          "value": "HM",
          "label": "HM"
        },
        {
          "value": "HN",
          "label": "HN"
        },
        {
          "value": "HR",
          "label": "HR"
        },
        {
          "value": "HT",
          "label": "HT"
        },
        {
          "value": "HU",
          "label": "HU"
        },
        {
          "value": "ID",
          "label": "ID"
        },
        {
          "value": "IE",
          "label": "IE"
        },
        {
          "value": "IL",
          "label": "IL"
        },
        {
          "value": "IM",
          "label": "IM"
        },
        {
          "value": "IN",
          "label": "IN"
        },
        {
          "value": "IO",
          "label": "IO"
        },
        {
          "value": "IQ",
          "label": "IQ"
        },
        {
          "value": "IR",
          "label": "IR"
        },
        {
          "value": "IS",
          "label": "IS"
        },
        {
          "value": "IT",
          "label": "IT"
        },
        {
          "value": "JE",
          "label": "JE"
        },
        {
          "value": "JM",
          "label": "JM"
        },
        {
          "value": "JO",
          "label": "JO"
        },
        {
          "value": "JP",
          "label": "JP"
        },
        {
          "value": "KE",
          "label": "KE"
        },
        {
          "value": "KG",
          "label": "KG"
        },
        {
          "value": "KH",
          "label": "KH"
        },
        {
          "value": "KI",
          "label": "KI"
        },
        {
          "value": "KM",
          "label": "KM"
        },
        {
          "value": "KN",
          "label": "KN"
        },
        {
          "value": "KP",
          "label": "KP"
        },
        {
          "value": "KR",
          "label": "KR"
        },
        {
          "value": "KW",
          "label": "KW"
        },
        {
          "value": "KY",
          "label": "KY"
        },
        {
          "value": "KZ",
          "label": "KZ"
        },
        {
          "value": "LA",
          "label": "LA"
        },
        {
          "value": "LB",
          "label": "LB"
        },
        {
          "value": "LC",
          "label": "LC"
        },
        {
          "value": "LI",
          "label": "LI"
        },
        {
          "value": "LK",
          "label": "LK"
        },
        {
          "value": "LR",
          "label": "LR"
        },
        {
          "value": "LS",
          "label": "LS"
        },
        {
          "value": "LT",
          "label": "LT"
        },
        {
          "value": "LU",
          "label": "LU"
        },
        {
          "value": "LV",
          "label": "LV"
        },
        {
          "value": "LY",
          "label": "LY"
        },
        {
          "value": "MA",
          "label": "MA"
        },
        {
          "value": "MC",
          "label": "MC"
        },
        {
          "value": "MD",
          "label": "MD"
        },
        {
          "value": "ME",
          "label": "ME"
        },
        {
          "value": "MF",
          "label": "MF"
        },
        {
          "value": "MG",
          "label": "MG"
        },
        {
          "value": "MH",
          "label": "MH"
        },
        {
          "value": "MK",
          "label": "MK"
        },
        {
          "value": "ML",
          "label": "ML"
        },
        {
          "value": "MM",
          "label": "MM"
        },
        {
          "value": "MN",
          "label": "MN"
        },
        {
          "value": "MO",
          "label": "MO"
        },
        {
          "value": "MP",
          "label": "MP"
        },
        {
          "value": "MQ",
          "label": "MQ"
        },
        {
          "value": "MR",
          "label": "MR"
        },
        {
          "value": "MS",
          "label": "MS"
        },
        {
          "value": "MT",
          "label": "MT"
        },
        {
          "value": "MU",
          "label": "MU"
        },
        {
          "value": "MV",
          "label": "MV"
        },
        {
          "value": "MW",
          "label": "MW"
        },
        {
          "value": "MX",
          "label": "MX"
        },
        {
          "value": "MY",
          "label": "MY"
        },
        {
          "value": "MZ",
          "label": "MZ"
        },
        {
          "value": "NA",
          "label": "NA"
        },
        {
          "value": "NC",
          "label": "NC"
        },
        {
          "value": "NE",
          "label": "NE"
        },
        {
          "value": "NF",
          "label": "NF"
        },
        {
          "value": "NG",
          "label": "NG"
        },
        {
          "value": "NI",
          "label": "NI"
        },
        {
          "value": "NL",
          "label": "NL"
        },
        {
          "value": "NO",
          "label": "NO"
        },
        {
          "value": "NP",
          "label": "NP"
        },
        {
          "value": "NR",
          "label": "NR"
        },
        {
          "value": "NU",
          "label": "NU"
        },
        {
          "value": "NZ",
          "label": "NZ"
        },
        {
          "value": "OM",
          "label": "OM"
        },
        {
          "value": "PA",
          "label": "PA"
        },
        {
          "value": "PE",
          "label": "PE"
        },
        {
          "value": "PF",
          "label": "PF"
        },
        {
          "value": "PG",
          "label": "PG"
        },
        {
          "value": "PH",
          "label": "PH"
        },
        {
          "value": "PK",
          "label": "PK"
        },
        {
          "value": "PL",
          "label": "PL"
        },
        {
          "value": "PM",
          "label": "PM"
        },
        {
          "value": "PN",
          "label": "PN"
        },
        {
          "value": "PR",
          "label": "PR"
        },
        {
          "value": "PS",
          "label": "PS"
        },
        {
          "value": "PT",
          "label": "PT"
        },
        {
          "value": "PW",
          "label": "PW"
        },
        {
          "value": "PY",
          "label": "PY"
        },
        {
          "value": "QA",
          "label": "QA"
        },
        {
          "value": "RE",
          "label": "RE"
        },
        {
          "value": "RO",
          "label": "RO"
        },
        {
          "value": "RS",
          "label": "RS"
        },
        {
          "value": "RU",
          "label": "RU"
        },
        {
          "value": "RW",
          "label": "RW"
        },
        {
          "value": "SA",
          "label": "SA"
        },
        {
          "value": "SB",
          "label": "SB"
        },
        {
          "value": "SC",
          "label": "SC"
        },
        {
          "value": "SD",
          "label": "SD"
        },
        {
          "value": "SE",
          "label": "SE"
        },
        {
          "value": "SG",
          "label": "SG"
        },
        {
          "value": "SH",
          "label": "SH"
        },
        {
          "value": "SI",
          "label": "SI"
        },
        {
          "value": "SJ",
          "label": "SJ"
        },
        {
          "value": "SK",
          "label": "SK"
        },
        {
          "value": "SL",
          "label": "SL"
        },
        {
          "value": "SM",
          "label": "SM"
        },
        {
          "value": "SN",
          "label": "SN"
        },
        {
          "value": "SO",
          "label": "SO"
        },
        {
          "value": "SR",
          "label": "SR"
        },
        {
          "value": "SS",
          "label": "SS"
        },
        {
          "value": "ST",
          "label": "ST"
        },
        {
          "value": "SV",
          "label": "SV"
        },
        {
          "value": "SX",
          "label": "SX"
        },
        {
          "value": "SY",
          "label": "SY"
        },
        {
          "value": "SZ",
          "label": "SZ"
        },
        {
          "value": "TC",
          "label": "TC"
        },
        {
          "value": "TD",
          "label": "TD"
        },
        {
          "value": "TF",
          "label": "TF"
        },
        {
          "value": "TG",
          "label": "TG"
        },
        {
          "value": "TH",
          "label": "TH"
        },
        {
          "value": "TJ",
          "label": "TJ"
        },
        {
          "value": "TK",
          "label": "TK"
        },
        {
          "value": "TL",
          "label": "TL"
        },
        {
          "value": "TM",
          "label": "TM"
        },
        {
          "value": "TN",
          "label": "TN"
        },
        {
          "value": "TO",
          "label": "TO"
        },
        {
          "value": "TR",
          "label": "TR"
        },
        {
          "value": "TT",
          "label": "TT"
        },
        {
          "value": "TV",
          "label": "TV"
        },
        {
          "value": "TW",
          "label": "TW"
        },
        {
          "value": "TZ",
          "label": "TZ"
        },
        {
          "value": "UA",
          "label": "UA"
        },
        {
          "value": "UG",
          "label": "UG"
        },
        {
          "value": "UM",
          "label": "UM"
        },
        {
          "value": "US",
          "label": "US"
        },
        {
          "value": "UY",
          "label": "UY"
        },
        {
          "value": "UZ",
          "label": "UZ"
        },
        {
          "value": "VA",
          "label": "VA"
        },
        {
          "value": "VC",
          "label": "VC"
        },
        {
          "value": "VE",
          "label": "VE"
        },
        {
          "value": "VG",
          "label": "VG"
        },
        {
          "value": "VI",
          "label": "VI"
        },
        {
          "value": "VN",
          "label": "VN"
        },
        {
          "value": "VU",
          "label": "VU"
        },
        {
          "value": "WF",
          "label": "WF"
        },
        {
          "value": "WS",
          "label": "WS"
        },
        {
          "value": "YE",
          "label": "YE"
        },
        {
          "value": "YT",
          "label": "YT"
        },
        {
          "value": "ZA",
          "label": "ZA"
        },
        {
          "value": "ZM",
          "label": "ZM"
        },
        {
          "value": "ZW",
          "label": "ZW"
        }
      ],
      "name": "issuing_country",
      "required": false,
      "wireName": "issuing_country"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date",
      "name": "expires_on",
      "required": false,
      "wireName": "expires_on"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "created_at",
      "required": true,
      "wireName": "created_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updated_at",
      "required": true,
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
      "name": "client_id",
      "required": true,
      "wireName": "client_id"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "travel_group_hash",
      "required": false,
      "wireName": "travel_group_hash"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "group_name",
      "required": true,
      "wireName": "group_name"
    },
    {
      "kind": "enum",
      "typeName": "LanguageCode",
      "isArray": false,
      "enumValues": [
        "English",
        "Vietnamese",
        "French",
        "German",
        "Spanish"
      ],
      "options": [
        {
          "value": "English",
          "label": "English"
        },
        {
          "value": "Vietnamese",
          "label": "Vietnamese"
        },
        {
          "value": "French",
          "label": "French"
        },
        {
          "value": "German",
          "label": "German"
        },
        {
          "value": "Spanish",
          "label": "Spanish"
        }
      ],
      "name": "preferred_language",
      "required": false,
      "wireName": "preferred_language"
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
      "name": "preferred_currency",
      "required": false,
      "wireName": "preferred_currency"
    },
    {
      "kind": "enum",
      "typeName": "TimezoneCode",
      "isArray": false,
      "enumValues": [
        "Africa/Abidjan",
        "Africa/Accra",
        "Africa/Addis_Ababa",
        "Africa/Algiers",
        "Africa/Asmera",
        "Africa/Bamako",
        "Africa/Bangui",
        "Africa/Banjul",
        "Africa/Bissau",
        "Africa/Blantyre",
        "Africa/Brazzaville",
        "Africa/Bujumbura",
        "Africa/Cairo",
        "Africa/Casablanca",
        "Africa/Ceuta",
        "Africa/Conakry",
        "Africa/Dakar",
        "Africa/Dar_es_Salaam",
        "Africa/Djibouti",
        "Africa/Douala",
        "Africa/El_Aaiun",
        "Africa/Freetown",
        "Africa/Gaborone",
        "Africa/Harare",
        "Africa/Johannesburg",
        "Africa/Juba",
        "Africa/Kampala",
        "Africa/Khartoum",
        "Africa/Kigali",
        "Africa/Kinshasa",
        "Africa/Lagos",
        "Africa/Libreville",
        "Africa/Lome",
        "Africa/Luanda",
        "Africa/Lubumbashi",
        "Africa/Lusaka",
        "Africa/Malabo",
        "Africa/Maputo",
        "Africa/Maseru",
        "Africa/Mbabane",
        "Africa/Mogadishu",
        "Africa/Monrovia",
        "Africa/Nairobi",
        "Africa/Ndjamena",
        "Africa/Niamey",
        "Africa/Nouakchott",
        "Africa/Ouagadougou",
        "Africa/Porto-Novo",
        "Africa/Sao_Tome",
        "Africa/Tripoli",
        "Africa/Tunis",
        "Africa/Windhoek",
        "America/Adak",
        "America/Anchorage",
        "America/Anguilla",
        "America/Antigua",
        "America/Araguaina",
        "America/Argentina/La_Rioja",
        "America/Argentina/Rio_Gallegos",
        "America/Argentina/Salta",
        "America/Argentina/San_Juan",
        "America/Argentina/San_Luis",
        "America/Argentina/Tucuman",
        "America/Argentina/Ushuaia",
        "America/Aruba",
        "America/Asuncion",
        "America/Bahia",
        "America/Bahia_Banderas",
        "America/Barbados",
        "America/Belem",
        "America/Belize",
        "America/Blanc-Sablon",
        "America/Boa_Vista",
        "America/Bogota",
        "America/Boise",
        "America/Buenos_Aires",
        "America/Cambridge_Bay",
        "America/Campo_Grande",
        "America/Cancun",
        "America/Caracas",
        "America/Catamarca",
        "America/Cayenne",
        "America/Cayman",
        "America/Chicago",
        "America/Chihuahua",
        "America/Ciudad_Juarez",
        "America/Coral_Harbour",
        "America/Cordoba",
        "America/Costa_Rica",
        "America/Creston",
        "America/Cuiaba",
        "America/Curacao",
        "America/Danmarkshavn",
        "America/Dawson",
        "America/Dawson_Creek",
        "America/Denver",
        "America/Detroit",
        "America/Dominica",
        "America/Edmonton",
        "America/Eirunepe",
        "America/El_Salvador",
        "America/Fort_Nelson",
        "America/Fortaleza",
        "America/Glace_Bay",
        "America/Godthab",
        "America/Goose_Bay",
        "America/Grand_Turk",
        "America/Grenada",
        "America/Guadeloupe",
        "America/Guatemala",
        "America/Guayaquil",
        "America/Guyana",
        "America/Halifax",
        "America/Havana",
        "America/Hermosillo",
        "America/Indiana/Knox",
        "America/Indiana/Marengo",
        "America/Indiana/Petersburg",
        "America/Indiana/Tell_City",
        "America/Indiana/Vevay",
        "America/Indiana/Vincennes",
        "America/Indiana/Winamac",
        "America/Indianapolis",
        "America/Inuvik",
        "America/Iqaluit",
        "America/Jamaica",
        "America/Jujuy",
        "America/Juneau",
        "America/Kentucky/Monticello",
        "America/Kralendijk",
        "America/La_Paz",
        "America/Lima",
        "America/Los_Angeles",
        "America/Louisville",
        "America/Lower_Princes",
        "America/Maceio",
        "America/Managua",
        "America/Manaus",
        "America/Marigot",
        "America/Martinique",
        "America/Matamoros",
        "America/Mazatlan",
        "America/Mendoza",
        "America/Menominee",
        "America/Merida",
        "America/Metlakatla",
        "America/Mexico_City",
        "America/Miquelon",
        "America/Moncton",
        "America/Monterrey",
        "America/Montevideo",
        "America/Montserrat",
        "America/Nassau",
        "America/New_York",
        "America/Nome",
        "America/Noronha",
        "America/North_Dakota/Beulah",
        "America/North_Dakota/Center",
        "America/North_Dakota/New_Salem",
        "America/Ojinaga",
        "America/Panama",
        "America/Paramaribo",
        "America/Phoenix",
        "America/Port-au-Prince",
        "America/Port_of_Spain",
        "America/Porto_Velho",
        "America/Puerto_Rico",
        "America/Punta_Arenas",
        "America/Rankin_Inlet",
        "America/Recife",
        "America/Regina",
        "America/Resolute",
        "America/Rio_Branco",
        "America/Santarem",
        "America/Santiago",
        "America/Santo_Domingo",
        "America/Sao_Paulo",
        "America/Scoresbysund",
        "America/Sitka",
        "America/St_Barthelemy",
        "America/St_Johns",
        "America/St_Kitts",
        "America/St_Lucia",
        "America/St_Thomas",
        "America/St_Vincent",
        "America/Swift_Current",
        "America/Tegucigalpa",
        "America/Thule",
        "America/Tijuana",
        "America/Toronto",
        "America/Tortola",
        "America/Vancouver",
        "America/Whitehorse",
        "America/Winnipeg",
        "America/Yakutat",
        "Antarctica/Casey",
        "Antarctica/Davis",
        "Antarctica/DumontDUrville",
        "Antarctica/Macquarie",
        "Antarctica/Mawson",
        "Antarctica/McMurdo",
        "Antarctica/Palmer",
        "Antarctica/Rothera",
        "Antarctica/Syowa",
        "Antarctica/Troll",
        "Antarctica/Vostok",
        "Arctic/Longyearbyen",
        "Asia/Aden",
        "Asia/Almaty",
        "Asia/Amman",
        "Asia/Anadyr",
        "Asia/Aqtau",
        "Asia/Aqtobe",
        "Asia/Ashgabat",
        "Asia/Atyrau",
        "Asia/Baghdad",
        "Asia/Bahrain",
        "Asia/Baku",
        "Asia/Bangkok",
        "Asia/Barnaul",
        "Asia/Beirut",
        "Asia/Bishkek",
        "Asia/Brunei",
        "Asia/Calcutta",
        "Asia/Chita",
        "Asia/Colombo",
        "Asia/Damascus",
        "Asia/Dhaka",
        "Asia/Dili",
        "Asia/Dubai",
        "Asia/Dushanbe",
        "Asia/Famagusta",
        "Asia/Gaza",
        "Asia/Hebron",
        "Asia/Hong_Kong",
        "Asia/Hovd",
        "Asia/Irkutsk",
        "Asia/Jakarta",
        "Asia/Jayapura",
        "Asia/Jerusalem",
        "Asia/Kabul",
        "Asia/Kamchatka",
        "Asia/Karachi",
        "Asia/Katmandu",
        "Asia/Khandyga",
        "Asia/Krasnoyarsk",
        "Asia/Kuala_Lumpur",
        "Asia/Kuching",
        "Asia/Kuwait",
        "Asia/Macau",
        "Asia/Magadan",
        "Asia/Makassar",
        "Asia/Manila",
        "Asia/Muscat",
        "Asia/Nicosia",
        "Asia/Novokuznetsk",
        "Asia/Novosibirsk",
        "Asia/Omsk",
        "Asia/Oral",
        "Asia/Phnom_Penh",
        "Asia/Pontianak",
        "Asia/Pyongyang",
        "Asia/Qatar",
        "Asia/Qostanay",
        "Asia/Qyzylorda",
        "Asia/Rangoon",
        "Asia/Riyadh",
        "Asia/Saigon",
        "Asia/Sakhalin",
        "Asia/Samarkand",
        "Asia/Seoul",
        "Asia/Shanghai",
        "Asia/Singapore",
        "Asia/Srednekolymsk",
        "Asia/Taipei",
        "Asia/Tashkent",
        "Asia/Tbilisi",
        "Asia/Tehran",
        "Asia/Thimphu",
        "Asia/Tokyo",
        "Asia/Tomsk",
        "Asia/Ulaanbaatar",
        "Asia/Urumqi",
        "Asia/Ust-Nera",
        "Asia/Vientiane",
        "Asia/Vladivostok",
        "Asia/Yakutsk",
        "Asia/Yekaterinburg",
        "Asia/Yerevan",
        "Atlantic/Azores",
        "Atlantic/Bermuda",
        "Atlantic/Canary",
        "Atlantic/Cape_Verde",
        "Atlantic/Faeroe",
        "Atlantic/Madeira",
        "Atlantic/Reykjavik",
        "Atlantic/South_Georgia",
        "Atlantic/St_Helena",
        "Atlantic/Stanley",
        "Australia/Adelaide",
        "Australia/Brisbane",
        "Australia/Broken_Hill",
        "Australia/Darwin",
        "Australia/Eucla",
        "Australia/Hobart",
        "Australia/Lindeman",
        "Australia/Lord_Howe",
        "Australia/Melbourne",
        "Australia/Perth",
        "Australia/Sydney",
        "Europe/Amsterdam",
        "Europe/Andorra",
        "Europe/Astrakhan",
        "Europe/Athens",
        "Europe/Belgrade",
        "Europe/Berlin",
        "Europe/Bratislava",
        "Europe/Brussels",
        "Europe/Bucharest",
        "Europe/Budapest",
        "Europe/Busingen",
        "Europe/Chisinau",
        "Europe/Copenhagen",
        "Europe/Dublin",
        "Europe/Gibraltar",
        "Europe/Guernsey",
        "Europe/Helsinki",
        "Europe/Isle_of_Man",
        "Europe/Istanbul",
        "Europe/Jersey",
        "Europe/Kaliningrad",
        "Europe/Kiev",
        "Europe/Kirov",
        "Europe/Lisbon",
        "Europe/Ljubljana",
        "Europe/London",
        "Europe/Luxembourg",
        "Europe/Madrid",
        "Europe/Malta",
        "Europe/Mariehamn",
        "Europe/Minsk",
        "Europe/Monaco",
        "Europe/Moscow",
        "Europe/Oslo",
        "Europe/Paris",
        "Europe/Podgorica",
        "Europe/Prague",
        "Europe/Riga",
        "Europe/Rome",
        "Europe/Samara",
        "Europe/San_Marino",
        "Europe/Sarajevo",
        "Europe/Saratov",
        "Europe/Simferopol",
        "Europe/Skopje",
        "Europe/Sofia",
        "Europe/Stockholm",
        "Europe/Tallinn",
        "Europe/Tirane",
        "Europe/Ulyanovsk",
        "Europe/Vaduz",
        "Europe/Vatican",
        "Europe/Vienna",
        "Europe/Vilnius",
        "Europe/Volgograd",
        "Europe/Warsaw",
        "Europe/Zagreb",
        "Europe/Zurich",
        "Indian/Antananarivo",
        "Indian/Chagos",
        "Indian/Christmas",
        "Indian/Cocos",
        "Indian/Comoro",
        "Indian/Kerguelen",
        "Indian/Mahe",
        "Indian/Maldives",
        "Indian/Mauritius",
        "Indian/Mayotte",
        "Indian/Reunion",
        "Pacific/Apia",
        "Pacific/Auckland",
        "Pacific/Bougainville",
        "Pacific/Chatham",
        "Pacific/Easter",
        "Pacific/Efate",
        "Pacific/Enderbury",
        "Pacific/Fakaofo",
        "Pacific/Fiji",
        "Pacific/Funafuti",
        "Pacific/Galapagos",
        "Pacific/Gambier",
        "Pacific/Guadalcanal",
        "Pacific/Guam",
        "Pacific/Honolulu",
        "Pacific/Kiritimati",
        "Pacific/Kosrae",
        "Pacific/Kwajalein",
        "Pacific/Majuro",
        "Pacific/Marquesas",
        "Pacific/Midway",
        "Pacific/Nauru",
        "Pacific/Niue",
        "Pacific/Norfolk",
        "Pacific/Noumea",
        "Pacific/Pago_Pago",
        "Pacific/Palau",
        "Pacific/Pitcairn",
        "Pacific/Ponape",
        "Pacific/Port_Moresby",
        "Pacific/Rarotonga",
        "Pacific/Saipan",
        "Pacific/Tahiti",
        "Pacific/Tarawa",
        "Pacific/Tongatapu",
        "Pacific/Truk",
        "Pacific/Wake",
        "Pacific/Wallis"
      ],
      "options": [
        {
          "value": "Africa/Abidjan",
          "label": "Africa/Abidjan"
        },
        {
          "value": "Africa/Accra",
          "label": "Africa/Accra"
        },
        {
          "value": "Africa/Addis_Ababa",
          "label": "Africa/Addis_Ababa"
        },
        {
          "value": "Africa/Algiers",
          "label": "Africa/Algiers"
        },
        {
          "value": "Africa/Asmera",
          "label": "Africa/Asmera"
        },
        {
          "value": "Africa/Bamako",
          "label": "Africa/Bamako"
        },
        {
          "value": "Africa/Bangui",
          "label": "Africa/Bangui"
        },
        {
          "value": "Africa/Banjul",
          "label": "Africa/Banjul"
        },
        {
          "value": "Africa/Bissau",
          "label": "Africa/Bissau"
        },
        {
          "value": "Africa/Blantyre",
          "label": "Africa/Blantyre"
        },
        {
          "value": "Africa/Brazzaville",
          "label": "Africa/Brazzaville"
        },
        {
          "value": "Africa/Bujumbura",
          "label": "Africa/Bujumbura"
        },
        {
          "value": "Africa/Cairo",
          "label": "Africa/Cairo"
        },
        {
          "value": "Africa/Casablanca",
          "label": "Africa/Casablanca"
        },
        {
          "value": "Africa/Ceuta",
          "label": "Africa/Ceuta"
        },
        {
          "value": "Africa/Conakry",
          "label": "Africa/Conakry"
        },
        {
          "value": "Africa/Dakar",
          "label": "Africa/Dakar"
        },
        {
          "value": "Africa/Dar_es_Salaam",
          "label": "Africa/Dar_es_Salaam"
        },
        {
          "value": "Africa/Djibouti",
          "label": "Africa/Djibouti"
        },
        {
          "value": "Africa/Douala",
          "label": "Africa/Douala"
        },
        {
          "value": "Africa/El_Aaiun",
          "label": "Africa/El_Aaiun"
        },
        {
          "value": "Africa/Freetown",
          "label": "Africa/Freetown"
        },
        {
          "value": "Africa/Gaborone",
          "label": "Africa/Gaborone"
        },
        {
          "value": "Africa/Harare",
          "label": "Africa/Harare"
        },
        {
          "value": "Africa/Johannesburg",
          "label": "Africa/Johannesburg"
        },
        {
          "value": "Africa/Juba",
          "label": "Africa/Juba"
        },
        {
          "value": "Africa/Kampala",
          "label": "Africa/Kampala"
        },
        {
          "value": "Africa/Khartoum",
          "label": "Africa/Khartoum"
        },
        {
          "value": "Africa/Kigali",
          "label": "Africa/Kigali"
        },
        {
          "value": "Africa/Kinshasa",
          "label": "Africa/Kinshasa"
        },
        {
          "value": "Africa/Lagos",
          "label": "Africa/Lagos"
        },
        {
          "value": "Africa/Libreville",
          "label": "Africa/Libreville"
        },
        {
          "value": "Africa/Lome",
          "label": "Africa/Lome"
        },
        {
          "value": "Africa/Luanda",
          "label": "Africa/Luanda"
        },
        {
          "value": "Africa/Lubumbashi",
          "label": "Africa/Lubumbashi"
        },
        {
          "value": "Africa/Lusaka",
          "label": "Africa/Lusaka"
        },
        {
          "value": "Africa/Malabo",
          "label": "Africa/Malabo"
        },
        {
          "value": "Africa/Maputo",
          "label": "Africa/Maputo"
        },
        {
          "value": "Africa/Maseru",
          "label": "Africa/Maseru"
        },
        {
          "value": "Africa/Mbabane",
          "label": "Africa/Mbabane"
        },
        {
          "value": "Africa/Mogadishu",
          "label": "Africa/Mogadishu"
        },
        {
          "value": "Africa/Monrovia",
          "label": "Africa/Monrovia"
        },
        {
          "value": "Africa/Nairobi",
          "label": "Africa/Nairobi"
        },
        {
          "value": "Africa/Ndjamena",
          "label": "Africa/Ndjamena"
        },
        {
          "value": "Africa/Niamey",
          "label": "Africa/Niamey"
        },
        {
          "value": "Africa/Nouakchott",
          "label": "Africa/Nouakchott"
        },
        {
          "value": "Africa/Ouagadougou",
          "label": "Africa/Ouagadougou"
        },
        {
          "value": "Africa/Porto-Novo",
          "label": "Africa/Porto-Novo"
        },
        {
          "value": "Africa/Sao_Tome",
          "label": "Africa/Sao_Tome"
        },
        {
          "value": "Africa/Tripoli",
          "label": "Africa/Tripoli"
        },
        {
          "value": "Africa/Tunis",
          "label": "Africa/Tunis"
        },
        {
          "value": "Africa/Windhoek",
          "label": "Africa/Windhoek"
        },
        {
          "value": "America/Adak",
          "label": "America/Adak"
        },
        {
          "value": "America/Anchorage",
          "label": "America/Anchorage"
        },
        {
          "value": "America/Anguilla",
          "label": "America/Anguilla"
        },
        {
          "value": "America/Antigua",
          "label": "America/Antigua"
        },
        {
          "value": "America/Araguaina",
          "label": "America/Araguaina"
        },
        {
          "value": "America/Argentina/La_Rioja",
          "label": "America/Argentina/La_Rioja"
        },
        {
          "value": "America/Argentina/Rio_Gallegos",
          "label": "America/Argentina/Rio_Gallegos"
        },
        {
          "value": "America/Argentina/Salta",
          "label": "America/Argentina/Salta"
        },
        {
          "value": "America/Argentina/San_Juan",
          "label": "America/Argentina/San_Juan"
        },
        {
          "value": "America/Argentina/San_Luis",
          "label": "America/Argentina/San_Luis"
        },
        {
          "value": "America/Argentina/Tucuman",
          "label": "America/Argentina/Tucuman"
        },
        {
          "value": "America/Argentina/Ushuaia",
          "label": "America/Argentina/Ushuaia"
        },
        {
          "value": "America/Aruba",
          "label": "America/Aruba"
        },
        {
          "value": "America/Asuncion",
          "label": "America/Asuncion"
        },
        {
          "value": "America/Bahia",
          "label": "America/Bahia"
        },
        {
          "value": "America/Bahia_Banderas",
          "label": "America/Bahia_Banderas"
        },
        {
          "value": "America/Barbados",
          "label": "America/Barbados"
        },
        {
          "value": "America/Belem",
          "label": "America/Belem"
        },
        {
          "value": "America/Belize",
          "label": "America/Belize"
        },
        {
          "value": "America/Blanc-Sablon",
          "label": "America/Blanc-Sablon"
        },
        {
          "value": "America/Boa_Vista",
          "label": "America/Boa_Vista"
        },
        {
          "value": "America/Bogota",
          "label": "America/Bogota"
        },
        {
          "value": "America/Boise",
          "label": "America/Boise"
        },
        {
          "value": "America/Buenos_Aires",
          "label": "America/Buenos_Aires"
        },
        {
          "value": "America/Cambridge_Bay",
          "label": "America/Cambridge_Bay"
        },
        {
          "value": "America/Campo_Grande",
          "label": "America/Campo_Grande"
        },
        {
          "value": "America/Cancun",
          "label": "America/Cancun"
        },
        {
          "value": "America/Caracas",
          "label": "America/Caracas"
        },
        {
          "value": "America/Catamarca",
          "label": "America/Catamarca"
        },
        {
          "value": "America/Cayenne",
          "label": "America/Cayenne"
        },
        {
          "value": "America/Cayman",
          "label": "America/Cayman"
        },
        {
          "value": "America/Chicago",
          "label": "America/Chicago"
        },
        {
          "value": "America/Chihuahua",
          "label": "America/Chihuahua"
        },
        {
          "value": "America/Ciudad_Juarez",
          "label": "America/Ciudad_Juarez"
        },
        {
          "value": "America/Coral_Harbour",
          "label": "America/Coral_Harbour"
        },
        {
          "value": "America/Cordoba",
          "label": "America/Cordoba"
        },
        {
          "value": "America/Costa_Rica",
          "label": "America/Costa_Rica"
        },
        {
          "value": "America/Creston",
          "label": "America/Creston"
        },
        {
          "value": "America/Cuiaba",
          "label": "America/Cuiaba"
        },
        {
          "value": "America/Curacao",
          "label": "America/Curacao"
        },
        {
          "value": "America/Danmarkshavn",
          "label": "America/Danmarkshavn"
        },
        {
          "value": "America/Dawson",
          "label": "America/Dawson"
        },
        {
          "value": "America/Dawson_Creek",
          "label": "America/Dawson_Creek"
        },
        {
          "value": "America/Denver",
          "label": "America/Denver"
        },
        {
          "value": "America/Detroit",
          "label": "America/Detroit"
        },
        {
          "value": "America/Dominica",
          "label": "America/Dominica"
        },
        {
          "value": "America/Edmonton",
          "label": "America/Edmonton"
        },
        {
          "value": "America/Eirunepe",
          "label": "America/Eirunepe"
        },
        {
          "value": "America/El_Salvador",
          "label": "America/El_Salvador"
        },
        {
          "value": "America/Fort_Nelson",
          "label": "America/Fort_Nelson"
        },
        {
          "value": "America/Fortaleza",
          "label": "America/Fortaleza"
        },
        {
          "value": "America/Glace_Bay",
          "label": "America/Glace_Bay"
        },
        {
          "value": "America/Godthab",
          "label": "America/Godthab"
        },
        {
          "value": "America/Goose_Bay",
          "label": "America/Goose_Bay"
        },
        {
          "value": "America/Grand_Turk",
          "label": "America/Grand_Turk"
        },
        {
          "value": "America/Grenada",
          "label": "America/Grenada"
        },
        {
          "value": "America/Guadeloupe",
          "label": "America/Guadeloupe"
        },
        {
          "value": "America/Guatemala",
          "label": "America/Guatemala"
        },
        {
          "value": "America/Guayaquil",
          "label": "America/Guayaquil"
        },
        {
          "value": "America/Guyana",
          "label": "America/Guyana"
        },
        {
          "value": "America/Halifax",
          "label": "America/Halifax"
        },
        {
          "value": "America/Havana",
          "label": "America/Havana"
        },
        {
          "value": "America/Hermosillo",
          "label": "America/Hermosillo"
        },
        {
          "value": "America/Indiana/Knox",
          "label": "America/Indiana/Knox"
        },
        {
          "value": "America/Indiana/Marengo",
          "label": "America/Indiana/Marengo"
        },
        {
          "value": "America/Indiana/Petersburg",
          "label": "America/Indiana/Petersburg"
        },
        {
          "value": "America/Indiana/Tell_City",
          "label": "America/Indiana/Tell_City"
        },
        {
          "value": "America/Indiana/Vevay",
          "label": "America/Indiana/Vevay"
        },
        {
          "value": "America/Indiana/Vincennes",
          "label": "America/Indiana/Vincennes"
        },
        {
          "value": "America/Indiana/Winamac",
          "label": "America/Indiana/Winamac"
        },
        {
          "value": "America/Indianapolis",
          "label": "America/Indianapolis"
        },
        {
          "value": "America/Inuvik",
          "label": "America/Inuvik"
        },
        {
          "value": "America/Iqaluit",
          "label": "America/Iqaluit"
        },
        {
          "value": "America/Jamaica",
          "label": "America/Jamaica"
        },
        {
          "value": "America/Jujuy",
          "label": "America/Jujuy"
        },
        {
          "value": "America/Juneau",
          "label": "America/Juneau"
        },
        {
          "value": "America/Kentucky/Monticello",
          "label": "America/Kentucky/Monticello"
        },
        {
          "value": "America/Kralendijk",
          "label": "America/Kralendijk"
        },
        {
          "value": "America/La_Paz",
          "label": "America/La_Paz"
        },
        {
          "value": "America/Lima",
          "label": "America/Lima"
        },
        {
          "value": "America/Los_Angeles",
          "label": "America/Los_Angeles"
        },
        {
          "value": "America/Louisville",
          "label": "America/Louisville"
        },
        {
          "value": "America/Lower_Princes",
          "label": "America/Lower_Princes"
        },
        {
          "value": "America/Maceio",
          "label": "America/Maceio"
        },
        {
          "value": "America/Managua",
          "label": "America/Managua"
        },
        {
          "value": "America/Manaus",
          "label": "America/Manaus"
        },
        {
          "value": "America/Marigot",
          "label": "America/Marigot"
        },
        {
          "value": "America/Martinique",
          "label": "America/Martinique"
        },
        {
          "value": "America/Matamoros",
          "label": "America/Matamoros"
        },
        {
          "value": "America/Mazatlan",
          "label": "America/Mazatlan"
        },
        {
          "value": "America/Mendoza",
          "label": "America/Mendoza"
        },
        {
          "value": "America/Menominee",
          "label": "America/Menominee"
        },
        {
          "value": "America/Merida",
          "label": "America/Merida"
        },
        {
          "value": "America/Metlakatla",
          "label": "America/Metlakatla"
        },
        {
          "value": "America/Mexico_City",
          "label": "America/Mexico_City"
        },
        {
          "value": "America/Miquelon",
          "label": "America/Miquelon"
        },
        {
          "value": "America/Moncton",
          "label": "America/Moncton"
        },
        {
          "value": "America/Monterrey",
          "label": "America/Monterrey"
        },
        {
          "value": "America/Montevideo",
          "label": "America/Montevideo"
        },
        {
          "value": "America/Montserrat",
          "label": "America/Montserrat"
        },
        {
          "value": "America/Nassau",
          "label": "America/Nassau"
        },
        {
          "value": "America/New_York",
          "label": "America/New_York"
        },
        {
          "value": "America/Nome",
          "label": "America/Nome"
        },
        {
          "value": "America/Noronha",
          "label": "America/Noronha"
        },
        {
          "value": "America/North_Dakota/Beulah",
          "label": "America/North_Dakota/Beulah"
        },
        {
          "value": "America/North_Dakota/Center",
          "label": "America/North_Dakota/Center"
        },
        {
          "value": "America/North_Dakota/New_Salem",
          "label": "America/North_Dakota/New_Salem"
        },
        {
          "value": "America/Ojinaga",
          "label": "America/Ojinaga"
        },
        {
          "value": "America/Panama",
          "label": "America/Panama"
        },
        {
          "value": "America/Paramaribo",
          "label": "America/Paramaribo"
        },
        {
          "value": "America/Phoenix",
          "label": "America/Phoenix"
        },
        {
          "value": "America/Port-au-Prince",
          "label": "America/Port-au-Prince"
        },
        {
          "value": "America/Port_of_Spain",
          "label": "America/Port_of_Spain"
        },
        {
          "value": "America/Porto_Velho",
          "label": "America/Porto_Velho"
        },
        {
          "value": "America/Puerto_Rico",
          "label": "America/Puerto_Rico"
        },
        {
          "value": "America/Punta_Arenas",
          "label": "America/Punta_Arenas"
        },
        {
          "value": "America/Rankin_Inlet",
          "label": "America/Rankin_Inlet"
        },
        {
          "value": "America/Recife",
          "label": "America/Recife"
        },
        {
          "value": "America/Regina",
          "label": "America/Regina"
        },
        {
          "value": "America/Resolute",
          "label": "America/Resolute"
        },
        {
          "value": "America/Rio_Branco",
          "label": "America/Rio_Branco"
        },
        {
          "value": "America/Santarem",
          "label": "America/Santarem"
        },
        {
          "value": "America/Santiago",
          "label": "America/Santiago"
        },
        {
          "value": "America/Santo_Domingo",
          "label": "America/Santo_Domingo"
        },
        {
          "value": "America/Sao_Paulo",
          "label": "America/Sao_Paulo"
        },
        {
          "value": "America/Scoresbysund",
          "label": "America/Scoresbysund"
        },
        {
          "value": "America/Sitka",
          "label": "America/Sitka"
        },
        {
          "value": "America/St_Barthelemy",
          "label": "America/St_Barthelemy"
        },
        {
          "value": "America/St_Johns",
          "label": "America/St_Johns"
        },
        {
          "value": "America/St_Kitts",
          "label": "America/St_Kitts"
        },
        {
          "value": "America/St_Lucia",
          "label": "America/St_Lucia"
        },
        {
          "value": "America/St_Thomas",
          "label": "America/St_Thomas"
        },
        {
          "value": "America/St_Vincent",
          "label": "America/St_Vincent"
        },
        {
          "value": "America/Swift_Current",
          "label": "America/Swift_Current"
        },
        {
          "value": "America/Tegucigalpa",
          "label": "America/Tegucigalpa"
        },
        {
          "value": "America/Thule",
          "label": "America/Thule"
        },
        {
          "value": "America/Tijuana",
          "label": "America/Tijuana"
        },
        {
          "value": "America/Toronto",
          "label": "America/Toronto"
        },
        {
          "value": "America/Tortola",
          "label": "America/Tortola"
        },
        {
          "value": "America/Vancouver",
          "label": "America/Vancouver"
        },
        {
          "value": "America/Whitehorse",
          "label": "America/Whitehorse"
        },
        {
          "value": "America/Winnipeg",
          "label": "America/Winnipeg"
        },
        {
          "value": "America/Yakutat",
          "label": "America/Yakutat"
        },
        {
          "value": "Antarctica/Casey",
          "label": "Antarctica/Casey"
        },
        {
          "value": "Antarctica/Davis",
          "label": "Antarctica/Davis"
        },
        {
          "value": "Antarctica/DumontDUrville",
          "label": "Antarctica/DumontDUrville"
        },
        {
          "value": "Antarctica/Macquarie",
          "label": "Antarctica/Macquarie"
        },
        {
          "value": "Antarctica/Mawson",
          "label": "Antarctica/Mawson"
        },
        {
          "value": "Antarctica/McMurdo",
          "label": "Antarctica/McMurdo"
        },
        {
          "value": "Antarctica/Palmer",
          "label": "Antarctica/Palmer"
        },
        {
          "value": "Antarctica/Rothera",
          "label": "Antarctica/Rothera"
        },
        {
          "value": "Antarctica/Syowa",
          "label": "Antarctica/Syowa"
        },
        {
          "value": "Antarctica/Troll",
          "label": "Antarctica/Troll"
        },
        {
          "value": "Antarctica/Vostok",
          "label": "Antarctica/Vostok"
        },
        {
          "value": "Arctic/Longyearbyen",
          "label": "Arctic/Longyearbyen"
        },
        {
          "value": "Asia/Aden",
          "label": "Asia/Aden"
        },
        {
          "value": "Asia/Almaty",
          "label": "Asia/Almaty"
        },
        {
          "value": "Asia/Amman",
          "label": "Asia/Amman"
        },
        {
          "value": "Asia/Anadyr",
          "label": "Asia/Anadyr"
        },
        {
          "value": "Asia/Aqtau",
          "label": "Asia/Aqtau"
        },
        {
          "value": "Asia/Aqtobe",
          "label": "Asia/Aqtobe"
        },
        {
          "value": "Asia/Ashgabat",
          "label": "Asia/Ashgabat"
        },
        {
          "value": "Asia/Atyrau",
          "label": "Asia/Atyrau"
        },
        {
          "value": "Asia/Baghdad",
          "label": "Asia/Baghdad"
        },
        {
          "value": "Asia/Bahrain",
          "label": "Asia/Bahrain"
        },
        {
          "value": "Asia/Baku",
          "label": "Asia/Baku"
        },
        {
          "value": "Asia/Bangkok",
          "label": "Asia/Bangkok"
        },
        {
          "value": "Asia/Barnaul",
          "label": "Asia/Barnaul"
        },
        {
          "value": "Asia/Beirut",
          "label": "Asia/Beirut"
        },
        {
          "value": "Asia/Bishkek",
          "label": "Asia/Bishkek"
        },
        {
          "value": "Asia/Brunei",
          "label": "Asia/Brunei"
        },
        {
          "value": "Asia/Calcutta",
          "label": "Asia/Calcutta"
        },
        {
          "value": "Asia/Chita",
          "label": "Asia/Chita"
        },
        {
          "value": "Asia/Colombo",
          "label": "Asia/Colombo"
        },
        {
          "value": "Asia/Damascus",
          "label": "Asia/Damascus"
        },
        {
          "value": "Asia/Dhaka",
          "label": "Asia/Dhaka"
        },
        {
          "value": "Asia/Dili",
          "label": "Asia/Dili"
        },
        {
          "value": "Asia/Dubai",
          "label": "Asia/Dubai"
        },
        {
          "value": "Asia/Dushanbe",
          "label": "Asia/Dushanbe"
        },
        {
          "value": "Asia/Famagusta",
          "label": "Asia/Famagusta"
        },
        {
          "value": "Asia/Gaza",
          "label": "Asia/Gaza"
        },
        {
          "value": "Asia/Hebron",
          "label": "Asia/Hebron"
        },
        {
          "value": "Asia/Hong_Kong",
          "label": "Asia/Hong_Kong"
        },
        {
          "value": "Asia/Hovd",
          "label": "Asia/Hovd"
        },
        {
          "value": "Asia/Irkutsk",
          "label": "Asia/Irkutsk"
        },
        {
          "value": "Asia/Jakarta",
          "label": "Asia/Jakarta"
        },
        {
          "value": "Asia/Jayapura",
          "label": "Asia/Jayapura"
        },
        {
          "value": "Asia/Jerusalem",
          "label": "Asia/Jerusalem"
        },
        {
          "value": "Asia/Kabul",
          "label": "Asia/Kabul"
        },
        {
          "value": "Asia/Kamchatka",
          "label": "Asia/Kamchatka"
        },
        {
          "value": "Asia/Karachi",
          "label": "Asia/Karachi"
        },
        {
          "value": "Asia/Katmandu",
          "label": "Asia/Katmandu"
        },
        {
          "value": "Asia/Khandyga",
          "label": "Asia/Khandyga"
        },
        {
          "value": "Asia/Krasnoyarsk",
          "label": "Asia/Krasnoyarsk"
        },
        {
          "value": "Asia/Kuala_Lumpur",
          "label": "Asia/Kuala_Lumpur"
        },
        {
          "value": "Asia/Kuching",
          "label": "Asia/Kuching"
        },
        {
          "value": "Asia/Kuwait",
          "label": "Asia/Kuwait"
        },
        {
          "value": "Asia/Macau",
          "label": "Asia/Macau"
        },
        {
          "value": "Asia/Magadan",
          "label": "Asia/Magadan"
        },
        {
          "value": "Asia/Makassar",
          "label": "Asia/Makassar"
        },
        {
          "value": "Asia/Manila",
          "label": "Asia/Manila"
        },
        {
          "value": "Asia/Muscat",
          "label": "Asia/Muscat"
        },
        {
          "value": "Asia/Nicosia",
          "label": "Asia/Nicosia"
        },
        {
          "value": "Asia/Novokuznetsk",
          "label": "Asia/Novokuznetsk"
        },
        {
          "value": "Asia/Novosibirsk",
          "label": "Asia/Novosibirsk"
        },
        {
          "value": "Asia/Omsk",
          "label": "Asia/Omsk"
        },
        {
          "value": "Asia/Oral",
          "label": "Asia/Oral"
        },
        {
          "value": "Asia/Phnom_Penh",
          "label": "Asia/Phnom_Penh"
        },
        {
          "value": "Asia/Pontianak",
          "label": "Asia/Pontianak"
        },
        {
          "value": "Asia/Pyongyang",
          "label": "Asia/Pyongyang"
        },
        {
          "value": "Asia/Qatar",
          "label": "Asia/Qatar"
        },
        {
          "value": "Asia/Qostanay",
          "label": "Asia/Qostanay"
        },
        {
          "value": "Asia/Qyzylorda",
          "label": "Asia/Qyzylorda"
        },
        {
          "value": "Asia/Rangoon",
          "label": "Asia/Rangoon"
        },
        {
          "value": "Asia/Riyadh",
          "label": "Asia/Riyadh"
        },
        {
          "value": "Asia/Saigon",
          "label": "Asia/Saigon"
        },
        {
          "value": "Asia/Sakhalin",
          "label": "Asia/Sakhalin"
        },
        {
          "value": "Asia/Samarkand",
          "label": "Asia/Samarkand"
        },
        {
          "value": "Asia/Seoul",
          "label": "Asia/Seoul"
        },
        {
          "value": "Asia/Shanghai",
          "label": "Asia/Shanghai"
        },
        {
          "value": "Asia/Singapore",
          "label": "Asia/Singapore"
        },
        {
          "value": "Asia/Srednekolymsk",
          "label": "Asia/Srednekolymsk"
        },
        {
          "value": "Asia/Taipei",
          "label": "Asia/Taipei"
        },
        {
          "value": "Asia/Tashkent",
          "label": "Asia/Tashkent"
        },
        {
          "value": "Asia/Tbilisi",
          "label": "Asia/Tbilisi"
        },
        {
          "value": "Asia/Tehran",
          "label": "Asia/Tehran"
        },
        {
          "value": "Asia/Thimphu",
          "label": "Asia/Thimphu"
        },
        {
          "value": "Asia/Tokyo",
          "label": "Asia/Tokyo"
        },
        {
          "value": "Asia/Tomsk",
          "label": "Asia/Tomsk"
        },
        {
          "value": "Asia/Ulaanbaatar",
          "label": "Asia/Ulaanbaatar"
        },
        {
          "value": "Asia/Urumqi",
          "label": "Asia/Urumqi"
        },
        {
          "value": "Asia/Ust-Nera",
          "label": "Asia/Ust-Nera"
        },
        {
          "value": "Asia/Vientiane",
          "label": "Asia/Vientiane"
        },
        {
          "value": "Asia/Vladivostok",
          "label": "Asia/Vladivostok"
        },
        {
          "value": "Asia/Yakutsk",
          "label": "Asia/Yakutsk"
        },
        {
          "value": "Asia/Yekaterinburg",
          "label": "Asia/Yekaterinburg"
        },
        {
          "value": "Asia/Yerevan",
          "label": "Asia/Yerevan"
        },
        {
          "value": "Atlantic/Azores",
          "label": "Atlantic/Azores"
        },
        {
          "value": "Atlantic/Bermuda",
          "label": "Atlantic/Bermuda"
        },
        {
          "value": "Atlantic/Canary",
          "label": "Atlantic/Canary"
        },
        {
          "value": "Atlantic/Cape_Verde",
          "label": "Atlantic/Cape_Verde"
        },
        {
          "value": "Atlantic/Faeroe",
          "label": "Atlantic/Faeroe"
        },
        {
          "value": "Atlantic/Madeira",
          "label": "Atlantic/Madeira"
        },
        {
          "value": "Atlantic/Reykjavik",
          "label": "Atlantic/Reykjavik"
        },
        {
          "value": "Atlantic/South_Georgia",
          "label": "Atlantic/South_Georgia"
        },
        {
          "value": "Atlantic/St_Helena",
          "label": "Atlantic/St_Helena"
        },
        {
          "value": "Atlantic/Stanley",
          "label": "Atlantic/Stanley"
        },
        {
          "value": "Australia/Adelaide",
          "label": "Australia/Adelaide"
        },
        {
          "value": "Australia/Brisbane",
          "label": "Australia/Brisbane"
        },
        {
          "value": "Australia/Broken_Hill",
          "label": "Australia/Broken_Hill"
        },
        {
          "value": "Australia/Darwin",
          "label": "Australia/Darwin"
        },
        {
          "value": "Australia/Eucla",
          "label": "Australia/Eucla"
        },
        {
          "value": "Australia/Hobart",
          "label": "Australia/Hobart"
        },
        {
          "value": "Australia/Lindeman",
          "label": "Australia/Lindeman"
        },
        {
          "value": "Australia/Lord_Howe",
          "label": "Australia/Lord_Howe"
        },
        {
          "value": "Australia/Melbourne",
          "label": "Australia/Melbourne"
        },
        {
          "value": "Australia/Perth",
          "label": "Australia/Perth"
        },
        {
          "value": "Australia/Sydney",
          "label": "Australia/Sydney"
        },
        {
          "value": "Europe/Amsterdam",
          "label": "Europe/Amsterdam"
        },
        {
          "value": "Europe/Andorra",
          "label": "Europe/Andorra"
        },
        {
          "value": "Europe/Astrakhan",
          "label": "Europe/Astrakhan"
        },
        {
          "value": "Europe/Athens",
          "label": "Europe/Athens"
        },
        {
          "value": "Europe/Belgrade",
          "label": "Europe/Belgrade"
        },
        {
          "value": "Europe/Berlin",
          "label": "Europe/Berlin"
        },
        {
          "value": "Europe/Bratislava",
          "label": "Europe/Bratislava"
        },
        {
          "value": "Europe/Brussels",
          "label": "Europe/Brussels"
        },
        {
          "value": "Europe/Bucharest",
          "label": "Europe/Bucharest"
        },
        {
          "value": "Europe/Budapest",
          "label": "Europe/Budapest"
        },
        {
          "value": "Europe/Busingen",
          "label": "Europe/Busingen"
        },
        {
          "value": "Europe/Chisinau",
          "label": "Europe/Chisinau"
        },
        {
          "value": "Europe/Copenhagen",
          "label": "Europe/Copenhagen"
        },
        {
          "value": "Europe/Dublin",
          "label": "Europe/Dublin"
        },
        {
          "value": "Europe/Gibraltar",
          "label": "Europe/Gibraltar"
        },
        {
          "value": "Europe/Guernsey",
          "label": "Europe/Guernsey"
        },
        {
          "value": "Europe/Helsinki",
          "label": "Europe/Helsinki"
        },
        {
          "value": "Europe/Isle_of_Man",
          "label": "Europe/Isle_of_Man"
        },
        {
          "value": "Europe/Istanbul",
          "label": "Europe/Istanbul"
        },
        {
          "value": "Europe/Jersey",
          "label": "Europe/Jersey"
        },
        {
          "value": "Europe/Kaliningrad",
          "label": "Europe/Kaliningrad"
        },
        {
          "value": "Europe/Kiev",
          "label": "Europe/Kiev"
        },
        {
          "value": "Europe/Kirov",
          "label": "Europe/Kirov"
        },
        {
          "value": "Europe/Lisbon",
          "label": "Europe/Lisbon"
        },
        {
          "value": "Europe/Ljubljana",
          "label": "Europe/Ljubljana"
        },
        {
          "value": "Europe/London",
          "label": "Europe/London"
        },
        {
          "value": "Europe/Luxembourg",
          "label": "Europe/Luxembourg"
        },
        {
          "value": "Europe/Madrid",
          "label": "Europe/Madrid"
        },
        {
          "value": "Europe/Malta",
          "label": "Europe/Malta"
        },
        {
          "value": "Europe/Mariehamn",
          "label": "Europe/Mariehamn"
        },
        {
          "value": "Europe/Minsk",
          "label": "Europe/Minsk"
        },
        {
          "value": "Europe/Monaco",
          "label": "Europe/Monaco"
        },
        {
          "value": "Europe/Moscow",
          "label": "Europe/Moscow"
        },
        {
          "value": "Europe/Oslo",
          "label": "Europe/Oslo"
        },
        {
          "value": "Europe/Paris",
          "label": "Europe/Paris"
        },
        {
          "value": "Europe/Podgorica",
          "label": "Europe/Podgorica"
        },
        {
          "value": "Europe/Prague",
          "label": "Europe/Prague"
        },
        {
          "value": "Europe/Riga",
          "label": "Europe/Riga"
        },
        {
          "value": "Europe/Rome",
          "label": "Europe/Rome"
        },
        {
          "value": "Europe/Samara",
          "label": "Europe/Samara"
        },
        {
          "value": "Europe/San_Marino",
          "label": "Europe/San_Marino"
        },
        {
          "value": "Europe/Sarajevo",
          "label": "Europe/Sarajevo"
        },
        {
          "value": "Europe/Saratov",
          "label": "Europe/Saratov"
        },
        {
          "value": "Europe/Simferopol",
          "label": "Europe/Simferopol"
        },
        {
          "value": "Europe/Skopje",
          "label": "Europe/Skopje"
        },
        {
          "value": "Europe/Sofia",
          "label": "Europe/Sofia"
        },
        {
          "value": "Europe/Stockholm",
          "label": "Europe/Stockholm"
        },
        {
          "value": "Europe/Tallinn",
          "label": "Europe/Tallinn"
        },
        {
          "value": "Europe/Tirane",
          "label": "Europe/Tirane"
        },
        {
          "value": "Europe/Ulyanovsk",
          "label": "Europe/Ulyanovsk"
        },
        {
          "value": "Europe/Vaduz",
          "label": "Europe/Vaduz"
        },
        {
          "value": "Europe/Vatican",
          "label": "Europe/Vatican"
        },
        {
          "value": "Europe/Vienna",
          "label": "Europe/Vienna"
        },
        {
          "value": "Europe/Vilnius",
          "label": "Europe/Vilnius"
        },
        {
          "value": "Europe/Volgograd",
          "label": "Europe/Volgograd"
        },
        {
          "value": "Europe/Warsaw",
          "label": "Europe/Warsaw"
        },
        {
          "value": "Europe/Zagreb",
          "label": "Europe/Zagreb"
        },
        {
          "value": "Europe/Zurich",
          "label": "Europe/Zurich"
        },
        {
          "value": "Indian/Antananarivo",
          "label": "Indian/Antananarivo"
        },
        {
          "value": "Indian/Chagos",
          "label": "Indian/Chagos"
        },
        {
          "value": "Indian/Christmas",
          "label": "Indian/Christmas"
        },
        {
          "value": "Indian/Cocos",
          "label": "Indian/Cocos"
        },
        {
          "value": "Indian/Comoro",
          "label": "Indian/Comoro"
        },
        {
          "value": "Indian/Kerguelen",
          "label": "Indian/Kerguelen"
        },
        {
          "value": "Indian/Mahe",
          "label": "Indian/Mahe"
        },
        {
          "value": "Indian/Maldives",
          "label": "Indian/Maldives"
        },
        {
          "value": "Indian/Mauritius",
          "label": "Indian/Mauritius"
        },
        {
          "value": "Indian/Mayotte",
          "label": "Indian/Mayotte"
        },
        {
          "value": "Indian/Reunion",
          "label": "Indian/Reunion"
        },
        {
          "value": "Pacific/Apia",
          "label": "Pacific/Apia"
        },
        {
          "value": "Pacific/Auckland",
          "label": "Pacific/Auckland"
        },
        {
          "value": "Pacific/Bougainville",
          "label": "Pacific/Bougainville"
        },
        {
          "value": "Pacific/Chatham",
          "label": "Pacific/Chatham"
        },
        {
          "value": "Pacific/Easter",
          "label": "Pacific/Easter"
        },
        {
          "value": "Pacific/Efate",
          "label": "Pacific/Efate"
        },
        {
          "value": "Pacific/Enderbury",
          "label": "Pacific/Enderbury"
        },
        {
          "value": "Pacific/Fakaofo",
          "label": "Pacific/Fakaofo"
        },
        {
          "value": "Pacific/Fiji",
          "label": "Pacific/Fiji"
        },
        {
          "value": "Pacific/Funafuti",
          "label": "Pacific/Funafuti"
        },
        {
          "value": "Pacific/Galapagos",
          "label": "Pacific/Galapagos"
        },
        {
          "value": "Pacific/Gambier",
          "label": "Pacific/Gambier"
        },
        {
          "value": "Pacific/Guadalcanal",
          "label": "Pacific/Guadalcanal"
        },
        {
          "value": "Pacific/Guam",
          "label": "Pacific/Guam"
        },
        {
          "value": "Pacific/Honolulu",
          "label": "Pacific/Honolulu"
        },
        {
          "value": "Pacific/Kiritimati",
          "label": "Pacific/Kiritimati"
        },
        {
          "value": "Pacific/Kosrae",
          "label": "Pacific/Kosrae"
        },
        {
          "value": "Pacific/Kwajalein",
          "label": "Pacific/Kwajalein"
        },
        {
          "value": "Pacific/Majuro",
          "label": "Pacific/Majuro"
        },
        {
          "value": "Pacific/Marquesas",
          "label": "Pacific/Marquesas"
        },
        {
          "value": "Pacific/Midway",
          "label": "Pacific/Midway"
        },
        {
          "value": "Pacific/Nauru",
          "label": "Pacific/Nauru"
        },
        {
          "value": "Pacific/Niue",
          "label": "Pacific/Niue"
        },
        {
          "value": "Pacific/Norfolk",
          "label": "Pacific/Norfolk"
        },
        {
          "value": "Pacific/Noumea",
          "label": "Pacific/Noumea"
        },
        {
          "value": "Pacific/Pago_Pago",
          "label": "Pacific/Pago_Pago"
        },
        {
          "value": "Pacific/Palau",
          "label": "Pacific/Palau"
        },
        {
          "value": "Pacific/Pitcairn",
          "label": "Pacific/Pitcairn"
        },
        {
          "value": "Pacific/Ponape",
          "label": "Pacific/Ponape"
        },
        {
          "value": "Pacific/Port_Moresby",
          "label": "Pacific/Port_Moresby"
        },
        {
          "value": "Pacific/Rarotonga",
          "label": "Pacific/Rarotonga"
        },
        {
          "value": "Pacific/Saipan",
          "label": "Pacific/Saipan"
        },
        {
          "value": "Pacific/Tahiti",
          "label": "Pacific/Tahiti"
        },
        {
          "value": "Pacific/Tarawa",
          "label": "Pacific/Tarawa"
        },
        {
          "value": "Pacific/Tongatapu",
          "label": "Pacific/Tongatapu"
        },
        {
          "value": "Pacific/Truk",
          "label": "Pacific/Truk"
        },
        {
          "value": "Pacific/Wake",
          "label": "Pacific/Wake"
        },
        {
          "value": "Pacific/Wallis",
          "label": "Pacific/Wallis"
        }
      ],
      "name": "timezone",
      "required": false,
      "wireName": "timezone"
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
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "created_at",
      "required": true,
      "wireName": "created_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updated_at",
      "required": true,
      "wireName": "updated_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "archived_at",
      "required": false,
      "wireName": "archived_at"
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
      "name": "travel_group_id",
      "required": true,
      "wireName": "travel_group_id"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "name": "customer_client_id",
      "required": true,
      "wireName": "customer_client_id"
    },
    {
      "kind": "scalar",
      "typeName": "bool",
      "isArray": false,
      "name": "is_traveling",
      "required": false,
      "wireName": "is_traveling"
    },
    {
      "kind": "enum",
      "typeName": "TravelGroupMemberRole",
      "isArray": true,
      "enumValues": [
        "TravelGroupContact",
        "decision_maker",
        "payer",
        "assistant",
        "other"
      ],
      "options": [
        {
          "value": "TravelGroupContact",
          "label": "TravelGroupContact"
        },
        {
          "value": "decision_maker",
          "label": "decision_maker"
        },
        {
          "value": "payer",
          "label": "payer"
        },
        {
          "value": "assistant",
          "label": "assistant"
        },
        {
          "value": "other",
          "label": "other"
        }
      ],
      "name": "member_roles",
      "required": false,
      "wireName": "member_roles"
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
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "created_at",
      "required": true,
      "wireName": "created_at"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": false,
      "format": "date-time",
      "name": "updated_at",
      "required": true,
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
      "name": "title",
      "required": false,
      "wireName": "title"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": true,
      "name": "destinationCountries",
      "required": false,
      "wireName": "destinationCountries"
    },
    {
      "kind": "scalar",
      "typeName": "string",
      "isArray": true,
      "name": "styles",
      "required": false,
      "wireName": "styles"
    },
    {
      "kind": "scalar",
      "typeName": "int",
      "isArray": false,
      "name": "durationDays",
      "required": false,
      "wireName": "durationDays"
    },
    {
      "kind": "entity",
      "typeName": "TourPriceFrom",
      "isArray": false,
      "name": "priceFrom",
      "required": false,
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
      "typeName": "int",
      "isArray": false,
      "name": "minor",
      "required": true,
      "wireName": "minor"
    }
  ]
};

export function validateTourPriceFrom(value) {
  return __validateShape(value, TOUR_PRICE_FROM_SCHEMA);
}

