#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "config", "language_catalog.json");
const SHARED_GENERATED_DIR = path.join(ROOT, "shared", "generated");
const SHARED_ESM_PATH = path.join(SHARED_GENERATED_DIR, "language_catalog.js");
const SHARED_GLOBAL_PATH = path.join(SHARED_GENERATED_DIR, "language_catalog.global.js");
const MODEL_ENUM_PATH = path.join(ROOT, "model", "enums", "language.cue");

const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function lowerText(value) {
  return String(value || "").trim().toLowerCase();
}

function uniquePreserveOrder(values) {
  const seen = new Set();
  const next = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
  }
  return next;
}

const normalized = source.map((entry) => {
  const code = lowerText(entry.code);
  const apiValue = String(entry.apiValue || "").trim();
  assert(code, "Every language needs a code.");
  assert(apiValue, `Language ${code} is missing apiValue.`);

  const aliases = uniquePreserveOrder([
    code,
    apiValue,
    entry.promptName,
    entry.nativeLabel,
    ...(Array.isArray(entry.aliases) ? entry.aliases : [])
  ].map(lowerText));

  return {
    code,
    apiValue,
    promptName: String(entry.promptName || apiValue).trim(),
    nativeLabel: String(entry.nativeLabel || apiValue).trim(),
    shortLabel: String(entry.shortLabel || code.toUpperCase()).trim(),
    flagClass: String(entry.flagClass || `flag-${code}`).trim(),
    pdfLocale: String(entry.pdfLocale || "en-GB").trim(),
    frontendNameKey: String(entry.frontendNameKey || "").trim(),
    publicSupported: Boolean(entry.publicSupported),
    backendUiSupported: Boolean(entry.backendUiSupported),
    customerContentSupported: Boolean(entry.customerContentSupported),
    aliases
  };
});

const codes = normalized.map((entry) => entry.code);
const apiValues = normalized.map((entry) => entry.apiValue);
assert(new Set(codes).size === codes.length, "Language codes must be unique.");
assert(new Set(apiValues).size === apiValues.length, "Language apiValue entries must be unique.");

const aliasToCode = Object.fromEntries(
  normalized.flatMap((entry) => entry.aliases.map((alias) => [alias, entry.code]))
);
const byCode = Object.fromEntries(normalized.map((entry) => [entry.code, entry]));
const byApiValue = Object.fromEntries(normalized.map((entry) => [entry.apiValue, entry]));
const frontendLanguages = normalized.filter((entry) => entry.publicSupported);
const backendUiLanguages = normalized.filter((entry) => entry.backendUiSupported);
const customerContentLanguages = normalized.filter((entry) => entry.customerContentSupported);

const sharedCatalogLiteral = JSON.stringify({
  languages: normalized,
  aliasToCode,
  frontendLanguages,
  backendUiLanguages,
  customerContentLanguages,
  byCode,
  byApiValue
}, null, 2);

const sharedEsm = `// Generated from config/language_catalog.json.\n// Do not edit by hand.\n\nconst CATALOG = Object.freeze(${sharedCatalogLiteral});\n\nexport const LANGUAGE_CATALOG = CATALOG.languages;\nexport const LANGUAGE_ALIAS_TO_CODE = Object.freeze(CATALOG.aliasToCode);\nexport const LANGUAGE_BY_CODE = Object.freeze(CATALOG.byCode);\nexport const LANGUAGE_BY_API_VALUE = Object.freeze(CATALOG.byApiValue);\nexport const FRONTEND_LANGUAGES = Object.freeze(CATALOG.frontendLanguages);\nexport const BACKEND_UI_LANGUAGES = Object.freeze(CATALOG.backendUiLanguages);\nexport const CUSTOMER_CONTENT_LANGUAGES = Object.freeze(CATALOG.customerContentLanguages);\nexport const FRONTEND_LANGUAGE_CODES = Object.freeze(FRONTEND_LANGUAGES.map((entry) => entry.code));\nexport const BACKEND_UI_LANGUAGE_CODES = Object.freeze(BACKEND_UI_LANGUAGES.map((entry) => entry.code));\nexport const CUSTOMER_CONTENT_LANGUAGE_CODES = Object.freeze(CUSTOMER_CONTENT_LANGUAGES.map((entry) => entry.code));\nexport const LANGUAGE_API_VALUES = Object.freeze(LANGUAGE_CATALOG.map((entry) => entry.apiValue));\n\nexport function languageByCode(code) {\n  const normalized = String(code || \"\").trim().toLowerCase();\n  return LANGUAGE_BY_CODE[normalized] || null;\n}\n\nexport function languageByApiValue(value) {\n  const normalized = String(value || \"\").trim();\n  return LANGUAGE_BY_API_VALUE[normalized] || null;\n}\n\nexport function normalizeLanguageCode(value, { allowedCodes = CUSTOMER_CONTENT_LANGUAGE_CODES, fallback = \"en\" } = {}) {\n  const normalized = String(value || \"\").trim().toLowerCase();\n  const resolved = LANGUAGE_ALIAS_TO_CODE[normalized] || null;\n  const allowed = Array.isArray(allowedCodes) ? allowedCodes : CUSTOMER_CONTENT_LANGUAGE_CODES;\n  if (resolved && allowed.includes(resolved)) return resolved;\n  if (allowed.includes(normalized)) return normalized;\n  return allowed.includes(fallback) ? fallback : (allowed[0] || \"en\");\n}\n\nexport function apiValueFromLanguageCode(code, fallback = \"English\") {\n  return languageByCode(code)?.apiValue || fallback;\n}\n\nexport function promptLanguageName(code, fallback = \"English\") {\n  return languageByCode(code)?.promptName || fallback;\n}\n\nexport function pdfLocaleForLanguage(code, fallback = \"en-GB\") {\n  return languageByCode(code)?.pdfLocale || fallback;\n}\n`;

const sharedGlobal = `// Generated from config/language_catalog.json.\n// Do not edit by hand.\n(function mountLanguageCatalog(globalScope) {\n  const catalog = ${sharedCatalogLiteral};\n  globalScope.ASIATRAVELPLAN_LANGUAGE_CATALOG = Object.freeze({\n    ...catalog,\n    frontendLanguageCodes: Object.freeze(catalog.frontendLanguages.map((entry) => entry.code)),\n    backendUiLanguageCodes: Object.freeze(catalog.backendUiLanguages.map((entry) => entry.code)),\n    customerContentLanguageCodes: Object.freeze(catalog.customerContentLanguages.map((entry) => entry.code))\n  });\n})(typeof window !== \"undefined\" ? window : globalThis);\n`;

const modelCue = `package enums\n\nLanguageCatalog: [\n${normalized.map((entry) => `\t\"${entry.code}\",`).join("\n")}\n]\n\n#LanguageCode: or(LanguageCatalog)\n`;

mkdirSync(SHARED_GENERATED_DIR, { recursive: true });
writeFileSync(SHARED_ESM_PATH, sharedEsm, "utf8");
writeFileSync(SHARED_GLOBAL_PATH, sharedGlobal, "utf8");
writeFileSync(MODEL_ENUM_PATH, modelCue, "utf8");

console.log(`Generated language catalog for ${normalized.length} languages.`);
