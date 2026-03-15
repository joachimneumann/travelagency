import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

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

function normalizeLanguageCatalog(source) {
  return source.map((entry) => {
    const code = lowerText(entry.code);
    const apiValue = String(entry.apiValue || "").trim();
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
      aliases: uniquePreserveOrder([
        code,
        apiValue,
        entry.promptName,
        entry.nativeLabel,
        ...(Array.isArray(entry.aliases) ? entry.aliases : [])
      ].map(lowerText))
    };
  });
}

function placeholdersByKey(entries) {
  return Object.fromEntries(
    Object.entries(entries || {}).map(([key, value]) => [
      key,
      Array.from(String(value || "").matchAll(/\{([^}]+)\}/g)).map((match) => match[1])
    ])
  );
}

async function extractPdfDictionary() {
  const filePath = path.join(repoRoot, "backend", "app", "src", "lib", "pdf_i18n.js");
  const source = await readFile(filePath, "utf8");
  const marker = "const DICTIONARY = Object.freeze(";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "pdf_i18n.js must define DICTIONARY");
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  let braceEnd = -1;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        braceEnd = index;
        break;
      }
    }
  }
  assert.notEqual(braceEnd, -1, "pdf_i18n.js DICTIONARY must be parseable");
  const sandbox = { Object };
  vm.createContext(sandbox);
  vm.runInContext(`result = ${source.slice(braceStart, braceEnd + 1)}`, sandbox);
  return sandbox.result;
}

test("generated language catalog stays in sync with config and language.cue", async () => {
  const sourceConfig = JSON.parse(
    await readFile(path.join(repoRoot, "config", "language_catalog.json"), "utf8")
  );
  const expectedCatalog = normalizeLanguageCatalog(sourceConfig);
  const generatedCatalog = await import(
    pathToFileURL(path.join(repoRoot, "shared", "generated", "language_catalog.js")).href
  );

  assert.deepEqual(generatedCatalog.LANGUAGE_CATALOG, expectedCatalog);
  assert.deepEqual(
    generatedCatalog.FRONTEND_LANGUAGE_CODES,
    expectedCatalog.filter((entry) => entry.publicSupported).map((entry) => entry.code)
  );
  assert.deepEqual(
    generatedCatalog.BACKEND_UI_LANGUAGE_CODES,
    expectedCatalog.filter((entry) => entry.backendUiSupported).map((entry) => entry.code)
  );
  assert.deepEqual(
    generatedCatalog.CUSTOMER_CONTENT_LANGUAGE_CODES,
    expectedCatalog.filter((entry) => entry.customerContentSupported).map((entry) => entry.code)
  );

  const expectedCue = `package enums\n\nLanguageCatalog: [\n${expectedCatalog.map((entry) => `\t"${entry.apiValue}",`).join("\n")}\n]\n\n#LanguageCode: or(LanguageCatalog)\n`;
  const actualCue = await readFile(path.join(repoRoot, "model", "enums", "language.cue"), "utf8");
  assert.equal(actualCue, expectedCue);
});

test("frontend dictionaries keep the same placeholder keys as English", async () => {
  const dir = path.join(repoRoot, "frontend", "data", "i18n", "frontend");
  const files = await readdir(dir);
  const dictionaries = Object.fromEntries(
    await Promise.all(
      files.filter((name) => name.endsWith(".json")).map(async (name) => [
        name.replace(/\.json$/, ""),
        JSON.parse(await readFile(path.join(dir, name), "utf8"))
      ])
    )
  );
  const englishPlaceholders = placeholdersByKey(dictionaries.en);
  const mismatches = [];

  for (const [lang, dict] of Object.entries(dictionaries)) {
    if (lang === "en") continue;
    const candidatePlaceholders = placeholdersByKey(dict);
    for (const [key, expected] of Object.entries(englishPlaceholders)) {
      const actual = candidatePlaceholders[key] || [];
      if (expected.join("|") !== actual.join("|")) {
        mismatches.push(`${lang}:${key}:${expected.join(",")}!=${actual.join(",")}`);
      }
    }
  }

  assert.deepEqual(mismatches, []);
});

test("PDF dictionary keeps the same placeholder keys as English and defines email copy for every language", async () => {
  const dictionary = await extractPdfDictionary();
  const englishPlaceholders = placeholdersByKey(dictionary.en);
  const mismatches = [];
  const requiredEmailKeys = [
    "email.offer_subject",
    "email.greeting_named",
    "email.greeting_generic",
    "email.offer_intro_named",
    "email.offer_intro_generic"
  ];

  for (const [lang, entries] of Object.entries(dictionary)) {
    for (const key of requiredEmailKeys) {
      assert.ok(String(entries?.[key] || "").trim(), `Missing ${key} for ${lang}`);
    }
    if (lang === "en") continue;
    const candidatePlaceholders = placeholdersByKey(entries);
    for (const [key, expected] of Object.entries(englishPlaceholders)) {
      const actual = candidatePlaceholders[key] || [];
      if (expected.join("|") !== actual.join("|")) {
        mismatches.push(`${lang}:${key}:${expected.join(",")}!=${actual.join(",")}`);
      }
    }
  }

  assert.deepEqual(mismatches, []);
});

test("booking customer language updates preserve submitted-language provenance", async () => {
  const source = await readFile(
    path.join(repoRoot, "backend", "app", "src", "http", "handlers", "booking_core.js"),
    "utf8"
  );
  assert.match(source, /booking\.customer_language = nextCustomerLanguage;/);
  assert.doesNotMatch(source, /web_form_submission\.preferred_language = nextCustomerLanguage/);
});

test("generated-offer Gmail drafts localize from the PDF dictionary", async () => {
  const source = await readFile(
    path.join(repoRoot, "backend", "app", "src", "http", "handlers", "booking_finance.js"),
    "utf8"
  );
  assert.match(source, /pdfT\(lang, "email\.offer_subject"/);
  assert.match(source, /pdfT\(lang, "email\.greeting_named"/);
  assert.match(source, /pdfT\(lang, "email\.offer_intro_named"/);
  assert.doesNotMatch(source, /subject:\s*"Your Asia Travel Plan offer"/);
});

test("browser pages load the generated language catalog before the i18n bootstrap", async () => {
  const pageChecks = [
    ["frontend/pages/index.html", /language_catalog\.global\.js/, /frontend_i18n\.js/],
    ["frontend/pages/backend.html", /language_catalog\.global\.js/, /backend_i18n\.js/],
    ["frontend/pages/booking.html", /language_catalog\.global\.js/, /backend_i18n\.js/],
    ["frontend/pages/persons.html", /language_catalog\.global\.js/, /backend_i18n\.js/],
    ["frontend/pages/tour.html", /language_catalog\.global\.js/, /backend_i18n\.js/]
  ];

  for (const [relativePath, catalogPattern, bootstrapPattern] of pageChecks) {
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    const catalogIndex = source.search(catalogPattern);
    const bootstrapIndex = source.search(bootstrapPattern);
    assert.ok(catalogIndex >= 0, `${relativePath} must load the generated language catalog`);
    assert.ok(bootstrapIndex >= 0, `${relativePath} must load the i18n bootstrap`);
    assert.ok(catalogIndex < bootstrapIndex, `${relativePath} must load the catalog before the i18n bootstrap`);
  }
});
