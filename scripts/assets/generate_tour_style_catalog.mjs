#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_PATH = path.join(ROOT, "config", "tour_style_catalog.json");
const SHARED_GENERATED_DIR = path.join(ROOT, "shared", "generated");
const SHARED_ESM_PATH = path.join(SHARED_GENERATED_DIR, "tour_style_catalog.js");
const MODEL_ENUM_PATH = path.join(ROOT, "model", "enums", "tour_style.cue");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function lowerText(value) {
  return String(value || "").trim().toLowerCase();
}

function trimText(value) {
  return String(value || "").trim();
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

function humanizeCode(code) {
  return String(code || "")
    .trim()
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));
assert(Array.isArray(source), "Tour style catalog must be an array.");

const normalized = source.map((entry, index) => {
  const code = lowerText(entry?.code);
  assert(code, `Tour style at index ${index} is missing code.`);

  const labels = Object.fromEntries(
    Object.entries(entry?.labels || {})
      .map(([lang, label]) => [lowerText(lang), trimText(label)])
      .filter(([lang, label]) => Boolean(lang && label))
  );

  if (!labels.en) {
    labels.en = humanizeCode(code);
  }

  const aliases = uniquePreserveOrder(
    [code, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])]
      .map(lowerText)
  );

  return {
    code,
    labels,
    aliases
  };
});

const codes = normalized.map((entry) => entry.code);
assert(new Set(codes).size === codes.length, "Tour style codes must be unique.");

const aliasToCode = Object.fromEntries(
  normalized.flatMap((entry) => entry.aliases.map((alias) => [alias, entry.code]))
);
const byCode = Object.fromEntries(normalized.map((entry) => [entry.code, entry]));

const sharedCatalogLiteral = JSON.stringify({
  styles: normalized,
  aliasToCode,
  byCode
}, null, 2);

const sharedEsm = `// Generated from config/tour_style_catalog.json.\n// Do not edit by hand.\n\nconst CATALOG = Object.freeze(${sharedCatalogLiteral});\n\nexport const TOUR_STYLE_CATALOG = Object.freeze(CATALOG.styles);\nexport const TOUR_STYLE_ALIAS_TO_CODE = Object.freeze(CATALOG.aliasToCode);\nexport const TOUR_STYLE_BY_CODE = Object.freeze(CATALOG.byCode);\nexport const TOUR_STYLE_CODES = Object.freeze(TOUR_STYLE_CATALOG.map((entry) => entry.code));\n\nexport function tourStyleByCode(code) {\n  const normalized = String(code || \"\").trim().toLowerCase();\n  return TOUR_STYLE_BY_CODE[normalized] || null;\n}\n`;

const modelCue = `package enums\n\nTourStyleCatalog: [\n${normalized.map((entry) => `\t\"${entry.code}\",`).join("\n")}\n]\n\nTourStyleNameCatalog: {\n${normalized.map((entry) => `\t\"${entry.code}\": ${JSON.stringify(entry.labels.en)}`).join("\n")}\n}\n\n#TourStyleCode: or(TourStyleCatalog)\n`;

mkdirSync(SHARED_GENERATED_DIR, { recursive: true });
writeFileSync(SHARED_ESM_PATH, sharedEsm, "utf8");
writeFileSync(MODEL_ENUM_PATH, modelCue, "utf8");

console.log(`Generated tour style catalog for ${normalized.length} travel styles.`);
