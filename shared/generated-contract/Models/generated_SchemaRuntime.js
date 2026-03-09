// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

    export const SHARED_FIELD_DEFS = Object.freeze({
  FIELD_1: {
  "kind": "scalar",
  "typeName": "string",
  "isArray": false
},
  FIELD_2: {
  "kind": "scalar",
  "typeName": "string",
  "isArray": false,
  "format": "email"
},
  FIELD_3: {
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
  ]
},
  FIELD_4: {
  "kind": "enum",
  "typeName": "BookingActivityType",
  "isArray": false,
  "enumValues": [
    "BOOKING_CREATED",
    "STAGE_CHANGED",
    "ASSIGNMENT_CHANGED",
    "NOTE_UPDATED",
    "PRICING_UPDATED",
    "OFFER_UPDATED",
    "INVOICE_CREATED",
    "INVOICE_UPDATED",
    "PAYMENT_UPDATED"
  ],
  "options": [
    {
      "value": "BOOKING_CREATED",
      "label": "BOOKING_CREATED"
    },
    {
      "value": "STAGE_CHANGED",
      "label": "STAGE_CHANGED"
    },
    {
      "value": "ASSIGNMENT_CHANGED",
      "label": "ASSIGNMENT_CHANGED"
    },
    {
      "value": "NOTE_UPDATED",
      "label": "NOTE_UPDATED"
    },
    {
      "value": "PRICING_UPDATED",
      "label": "PRICING_UPDATED"
    },
    {
      "value": "OFFER_UPDATED",
      "label": "OFFER_UPDATED"
    },
    {
      "value": "INVOICE_CREATED",
      "label": "INVOICE_CREATED"
    },
    {
      "value": "INVOICE_UPDATED",
      "label": "INVOICE_UPDATED"
    },
    {
      "value": "PAYMENT_UPDATED",
      "label": "PAYMENT_UPDATED"
    }
  ]
},
  FIELD_5: {
  "kind": "scalar",
  "typeName": "string",
  "isArray": false,
  "format": "date-time"
},
  FIELD_6: {
  "kind": "enum",
  "typeName": "OfferCategory",
  "isArray": false,
  "enumValues": [
    "ACCOMMODATION",
    "TRANSPORTATION",
    "TOURS_ACTIVITIES",
    "GUIDE_SUPPORT_SERVICES",
    "MEALS",
    "FEES_TAXES",
    "DISCOUNTS_CREDITS",
    "OTHER"
  ],
  "options": [
    {
      "value": "ACCOMMODATION",
      "label": "ACCOMMODATION"
    },
    {
      "value": "TRANSPORTATION",
      "label": "TRANSPORTATION"
    },
    {
      "value": "TOURS_ACTIVITIES",
      "label": "TOURS_ACTIVITIES"
    },
    {
      "value": "GUIDE_SUPPORT_SERVICES",
      "label": "GUIDE_SUPPORT_SERVICES"
    },
    {
      "value": "MEALS",
      "label": "MEALS"
    },
    {
      "value": "FEES_TAXES",
      "label": "FEES_TAXES"
    },
    {
      "value": "DISCOUNTS_CREDITS",
      "label": "DISCOUNTS_CREDITS"
    },
    {
      "value": "OTHER",
      "label": "OTHER"
    }
  ]
},
  FIELD_7: {
  "kind": "scalar",
  "typeName": "int",
  "isArray": false
},
  FIELD_8: {
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
  ]
},
  FIELD_9: {
  "kind": "entity",
  "typeName": "BookingOfferCategoryRule",
  "isArray": true
},
  FIELD_10: {
  "kind": "entity",
  "typeName": "BookingOfferComponent",
  "isArray": true
},
  FIELD_11: {
  "kind": "entity",
  "typeName": "BookingOfferTotals",
  "isArray": false
},
  FIELD_12: {
  "kind": "enum",
  "typeName": "BookingStage",
  "isArray": false,
  "enumValues": [
    "NEW",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
    "INVOICE_SENT",
    "PAYMENT_RECEIVED",
    "WON",
    "LOST",
    "POST_TRIP"
  ],
  "options": [
    {
      "value": "NEW",
      "label": "NEW"
    },
    {
      "value": "QUALIFIED",
      "label": "QUALIFIED"
    },
    {
      "value": "PROPOSAL_SENT",
      "label": "PROPOSAL_SENT"
    },
    {
      "value": "NEGOTIATION",
      "label": "NEGOTIATION"
    },
    {
      "value": "INVOICE_SENT",
      "label": "INVOICE_SENT"
    },
    {
      "value": "PAYMENT_RECEIVED",
      "label": "PAYMENT_RECEIVED"
    },
    {
      "value": "WON",
      "label": "WON"
    },
    {
      "value": "LOST",
      "label": "LOST"
    },
    {
      "value": "POST_TRIP",
      "label": "POST_TRIP"
    }
  ]
},
  FIELD_13: {
  "kind": "enum",
  "typeName": "CountryCode",
  "isArray": true,
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
  ]
},
  FIELD_14: {
  "kind": "scalar",
  "typeName": "string",
  "isArray": true
},
  FIELD_15: {
  "kind": "scalar",
  "typeName": "string",
  "isArray": false,
  "format": "date"
},
  FIELD_16: {
  "kind": "entity",
  "typeName": "BookingPerson",
  "isArray": true
},
  FIELD_17: {
  "kind": "entity",
  "typeName": "BookingWebFormSubmission",
  "isArray": false
},
  FIELD_18: {
  "kind": "entity",
  "typeName": "BookingPricing",
  "isArray": false
},
  FIELD_19: {
  "kind": "entity",
  "typeName": "BookingOffer",
  "isArray": false
},
  FIELD_20: {
  "kind": "entity",
  "typeName": "SourceAttribution",
  "isArray": false
},
  FIELD_21: {
  "kind": "scalar",
  "typeName": "float",
  "isArray": false
},
  FIELD_22: {
  "kind": "enum",
  "typeName": "MonthCode",
  "isArray": false,
  "enumValues": [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ],
  "options": [
    {
      "value": "jan",
      "label": "jan"
    },
    {
      "value": "feb",
      "label": "feb"
    },
    {
      "value": "mar",
      "label": "mar"
    },
    {
      "value": "apr",
      "label": "apr"
    },
    {
      "value": "may",
      "label": "may"
    },
    {
      "value": "jun",
      "label": "jun"
    },
    {
      "value": "jul",
      "label": "jul"
    },
    {
      "value": "aug",
      "label": "aug"
    },
    {
      "value": "sep",
      "label": "sep"
    },
    {
      "value": "oct",
      "label": "oct"
    },
    {
      "value": "nov",
      "label": "nov"
    },
    {
      "value": "dec",
      "label": "dec"
    }
  ]
},
  FIELD_23: {
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
  ]
},
  FIELD_24: {
  "kind": "transport",
  "typeName": "MobileAppVersionGate",
  "isArray": false
},
  FIELD_25: {
  "kind": "transport",
  "typeName": "APIContractVersion",
  "isArray": false
},
  FIELD_26: {
  "kind": "transport",
  "typeName": "FeatureFlags",
  "isArray": false
},
  FIELD_27: {
  "kind": "scalar",
  "typeName": "bool",
  "isArray": false
},
  FIELD_28: {
  "kind": "transport",
  "typeName": "ATPStaff",
  "isArray": false
},
  FIELD_29: {
  "kind": "transport",
  "typeName": "Booking",
  "isArray": false
},
  FIELD_30: {
  "kind": "transport",
  "typeName": "Tour",
  "isArray": true
},
  FIELD_31: {
  "kind": "transport",
  "typeName": "Pagination",
  "isArray": false
},
  FIELD_32: {
  "kind": "transport",
  "typeName": "Booking",
  "isArray": true
},
  FIELD_33: {
  "kind": "transport",
  "typeName": "BookingChatEvent",
  "isArray": true
},
  FIELD_34: {
  "kind": "transport",
  "typeName": "BookingChatConversation",
  "isArray": true
},
  FIELD_35: {
  "kind": "transport",
  "typeName": "BookingPricing",
  "isArray": false
},
  FIELD_36: {
  "kind": "transport",
  "typeName": "BookingOffer",
  "isArray": false
},
  FIELD_37: {
  "kind": "transport",
  "typeName": "BookingActivity",
  "isArray": true
},
  FIELD_38: {
  "kind": "transport",
  "typeName": "BookingInvoice",
  "isArray": true
},
  FIELD_39: {
  "kind": "transport",
  "typeName": "AtpStaffDirectoryEntry",
  "isArray": true
},
  FIELD_40: {
  "kind": "scalar",
  "typeName": "string",
  "isArray": true,
  "format": "email"
},
  FIELD_41: {
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
  ]
}
    });


export function schemaField(base, shared = {}) {
  return { ...shared, ...base };
}

export function assertObject(value, schemaName) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${schemaName} must be an object`);
  }
}

export function isPresentValue(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

export function validateShape(value, schema) {
  assertObject(value, schema.name);
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
  for (const group of Array.isArray(schema.requireOneOf) ? schema.requireOneOf : []) {
    if (!Array.isArray(group) || !group.length) continue;
    if (!group.some((fieldName) => isPresentValue(value[fieldName]))) {
      throw new TypeError(`${schema.name} requires at least one of: ${group.join(', ')}`);
    }
  }
  return value;
}
