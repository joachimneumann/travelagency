// Generated from api/generated/openapi.yaml.
// Do not edit by hand.

export const GENERATED_CURRENCIES = {
  "USD": {
    "code": "USD",
    "symbol": "$",
    "decimalPlaces": 2
  },
  "EURO": {
    "code": "EURO",
    "symbol": "€",
    "decimalPlaces": 2
  },
  "VND": {
    "code": "VND",
    "symbol": "₫",
    "decimalPlaces": 0
  },
  "THB": {
    "code": "THB",
    "symbol": "฿",
    "decimalPlaces": 0
  },
  "AUD": {
    "code": "AUD",
    "symbol": "A$",
    "decimalPlaces": 2
  },
  "GBP": {
    "code": "GBP",
    "symbol": "£",
    "decimalPlaces": 2
  },
  "NZD": {
    "code": "NZD",
    "symbol": "NZ$",
    "decimalPlaces": 2
  },
  "ZAR": {
    "code": "ZAR",
    "symbol": "R",
    "decimalPlaces": 2
  }
};
export const GENERATED_CURRENCY_CODES = Object.freeze(Object.keys(GENERATED_CURRENCIES));

export function normalizeCurrencyCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'EUR') return 'EURO';
  return GENERATED_CURRENCY_CODES.includes(normalized) ? normalized : null;
}

export function currencyDefinition(code) {
  const normalized = normalizeCurrencyCode(code);
  return normalized ? GENERATED_CURRENCIES[normalized] : null;
}

export function currencyDecimalPlaces(code) {
  return currencyDefinition(code)?.decimalPlaces ?? 2;
}

export function formatMoneyFromMinorUnits(amountMinorUnits, code) {
  const definition = currencyDefinition(code);
  if (!definition) return String(amountMinorUnits ?? '');
  const numeric = Number(amountMinorUnits || 0);
  const scale = 10 ** definition.decimalPlaces;
  const major = definition.decimalPlaces === 0 ? numeric : numeric / scale;
return new Intl.NumberFormat('en-US', {
  minimumFractionDigits: definition.decimalPlaces,
  maximumFractionDigits: definition.decimalPlaces,
  useGrouping: true
}).format(major);
}
