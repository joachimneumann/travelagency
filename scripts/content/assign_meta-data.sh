#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

node --input-type=module - "$REPO_ROOT" "$@" <<'NODE'
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , repoRootArg, ...argv] = process.argv;

const DEFAULT_TOURS_DIR = "content/tours";
const DEFAULT_CATALOG_PATH = "content/tours/destinations.json";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "around",
  "arrive",
  "arrival",
  "at",
  "beach",
  "begin",
  "bridge",
  "by",
  "classic",
  "coast",
  "day",
  "departure",
  "evening",
  "explore",
  "farewell",
  "from",
  "in",
  "into",
  "markets",
  "meet",
  "morning",
  "night",
  "of",
  "on",
  "pickup",
  "private",
  "return",
  "route",
  "see",
  "start",
  "streets",
  "the",
  "through",
  "to",
  "transfer",
  "vietnam",
  "visit",
  "wander",
  "with"
]);

const SINGLE_WORD_LOCATION_CANDIDATES = new Set([
  "dalat",
  "danang",
  "hanoi",
  "hue",
  "sapa",
  "saigon"
]);

const ALIAS_OVERRIDES = new Map([
  ["bana hill", "Ba Na Hills"],
  ["bana hills", "Ba Na Hills"],
  ["da lat", "Dalat"],
  ["da nang", "Danang"],
  ["dang nang", "Danang"],
  ["ha long", "Halong Bay"],
  ["ha long bay", "Halong Bay"],
  ["ha noi", "Hanoi"],
  ["ho chi minh", "Ho Chi Minh City"],
  ["ho chi minh city", "Ho Chi Minh City"],
  ["hoi an ancient town", "Hoi An"],
  ["imperial hue", "Hue"],
  ["saigon", "Ho Chi Minh City"]
]);

function printUsage() {
  console.log(`Usage: scripts/content/assign_meta-data.sh [options]

Assigns missing travel_plan.days[].primary_location_id values from existing destinations.json locations.

Options:
  --write                 Update tour.json files. Default is dry-run.
  --dry-run               Preview only.
  --overwrite             Replace existing primary_location_id values too.
  --tours-dir <path>      Tours directory. Default: ${DEFAULT_TOURS_DIR}
  --catalog <path>        Destination catalog. Default: ${DEFAULT_CATALOG_PATH}
  --json                  Print full report as JSON.
  --help                  Show this help.
`);
}

function parseArgs(args) {
  const options = {
    write: false,
    overwrite: false,
    toursDir: DEFAULT_TOURS_DIR,
    catalogPath: DEFAULT_CATALOG_PATH,
    json: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const readValue = () => {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--write") options.write = true;
    else if (arg === "--dry-run") options.write = false;
    else if (arg === "--overwrite") options.overwrite = true;
    else if (arg === "--tours-dir") options.toursDir = readValue();
    else if (arg === "--catalog") options.catalogPath = readValue();
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function resolveFromRoot(repoRoot, value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function displayText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function collectText(value, output = []) {
  if (typeof value === "string") {
    const text = displayText(value);
    if (text) output.push(text);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, output);
    return output;
  }
  for (const item of Object.values(value)) collectText(item, output);
  return output;
}

function addAlias(aliasMap, alias, record) {
  const normalized = normalizeText(alias);
  if (!normalized || normalized.length < 2) return;
  const existing = aliasMap.get(normalized);
  if (!existing || record.priority > existing.priority || displayText(record.name).length > displayText(existing.name).length) {
    aliasMap.set(normalized, record);
  }
}

function buildCatalogIndex(catalog) {
  const aliasMap = new Map();
  const records = [];
  const destinationCodes = new Set();

  for (const destination of Array.isArray(catalog.destination_scope_destinations) ? catalog.destination_scope_destinations : []) {
    const code = displayText(destination.code || destination.destination).toUpperCase();
    const name = displayText(destination.label || destination.name || code);
    if (!code || destinationCodes.has(code)) continue;
    destinationCodes.add(code);
    const record = { id: code, type: "destination", name, priority: 1 };
    records.push(record);
    addAlias(aliasMap, code, record);
    addAlias(aliasMap, name, record);
  }

  for (const region of Array.isArray(catalog.destination_regions) ? catalog.destination_regions : []) {
    const id = displayText(region.id);
    const name = displayText(region.name || region.label || region.code);
    if (!id || !name) continue;
    const record = { id, type: "region", name, priority: 2 };
    records.push(record);
    addAlias(aliasMap, id, record);
    addAlias(aliasMap, region.code, record);
    addAlias(aliasMap, name, record);
  }

  for (const place of Array.isArray(catalog.destination_places) ? catalog.destination_places : []) {
    const id = displayText(place.id);
    const name = displayText(place.name || place.label || place.code);
    if (!id || !name) continue;
    const record = { id, type: "place", name, priority: 3 };
    records.push(record);
    addAlias(aliasMap, id, record);
    addAlias(aliasMap, place.code, record);
    addAlias(aliasMap, name, record);
  }

  for (const [alias, canonical] of ALIAS_OVERRIDES.entries()) {
    const record = aliasMap.get(normalizeText(canonical));
    if (record) addAlias(aliasMap, alias, record);
  }

  const aliases = [...aliasMap.entries()]
    .filter(([alias]) => alias.length >= 3)
    .sort((left, right) => right[0].length - left[0].length);

  return { aliasMap, aliases, records };
}

async function readTourFiles(toursDir) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(toursDir, entry.name, "tour.json");
    try {
      const tour = await readJson(filePath);
      files.push({ id: entry.name, filePath, tour });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return files.sort((left, right) => left.id.localeCompare(right.id));
}

function dayReference(tourFile, day) {
  const number = displayText(day?.day_number) || displayText(day?.id) || "?";
  return `${tourFile.id} day ${number}`;
}

function dayTextFields(day) {
  const fields = [];
  const push = (field, weight, value) => {
    const texts = collectText(value);
    for (const text of texts) fields.push({ field, weight, text });
  };

  push("day.title", 100, day?.title);
  push("day.description", 80, day?.description);
  push("day.notes", 80, day?.notes);

  for (const [index, service] of (Array.isArray(day?.services) ? day.services : []).entries()) {
    push(`service[${index}].title`, 75, service?.title);
    push(`service[${index}].description`, 55, service?.description);
    push(`service[${index}].details`, 55, service?.details);
  }

  return fields;
}

function contextualAliasesForTour(tour, catalogIndex) {
  const tourTitleText = normalizeText(collectText(tour?.title).join(" "));
  const aliases = [];
  if (tourTitleText.includes("phu quoc")) {
    const phuQuoc = catalogIndex.aliasMap.get("phu quoc");
    if (phuQuoc) aliases.push(["bun quay", phuQuoc]);
  }
  return aliases;
}

function findCatalogMatches(day, catalogIndex, contextualAliases = []) {
  const matches = [];
  const aliases = [
    ...catalogIndex.aliases,
    ...contextualAliases.filter(([alias]) => normalizeText(alias).length >= 3)
  ].sort((left, right) => right[0].length - left[0].length);
  for (const field of dayTextFields(day)) {
    const normalizedText = ` ${normalizeText(field.text)} `;
    if (!normalizedText.trim()) continue;
    for (const [rawAlias, record] of aliases) {
      const alias = normalizeText(rawAlias);
      const position = normalizedText.indexOf(` ${alias} `);
      if (position === -1) continue;
      matches.push({
        ...record,
        alias,
        field: field.field,
        source_text: field.text,
        score: field.weight + record.priority * 10 + Math.min(alias.length, 40) / 100,
        position
      });
    }
  }

  const byId = new Map();
  for (const match of matches) {
    const existing = byId.get(match.id);
    if (!existing || match.score > existing.score || (match.score === existing.score && match.position < existing.position)) {
      byId.set(match.id, match);
    }
  }

  return [...byId.values()].sort((left, right) => right.score - left.score || left.position - right.position);
}

function cleanCandidate(value) {
  const raw = displayText(value);
  if (!/[A-ZÀ-ỴĐ]/.test(raw)) return "";

  let parts = raw
    .replace(/[()]/g, " ")
    .replace(/[’']s\b/gi, "")
    .replace(/[’']/g, "")
    .replace(/\b\d+\b/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (parts.length && STOP_WORDS.has(normalizeText(parts[0]))) parts = parts.slice(1);
  while (parts.length && STOP_WORDS.has(normalizeText(parts.at(-1)))) parts = parts.slice(0, -1);
  if (!parts.length || parts.length > 5) return "";

  const candidate = parts.join(" ");
  const normalized = normalizeText(candidate);
  if (!normalized || normalized.length < 3 || STOP_WORDS.has(normalized)) return "";
  if (parts.length === 1 && !SINGLE_WORD_LOCATION_CANDIDATES.has(normalized)) return "";
  return candidate;
}

function extractCandidateNames(day) {
  const candidates = new Map();
  const push = (value, field) => {
    const cleaned = cleanCandidate(value);
    const normalized = normalizeText(cleaned);
    if (!normalized) return;
    if (!candidates.has(normalized)) candidates.set(normalized, { label: cleaned, field });
  };

  for (const field of dayTextFields(day).filter((item) => !/_i18n$/.test(item.field))) {
    const text = field.text;
    const isDescriptionField = /(?:notes|description|details)$/.test(field.field);
    if (!isDescriptionField) {
      for (const part of text.split(/\s+-\s+|\s*-\s*|,|:|\/|\s+(?:to|and|with|through|via|from|into|around|in)\s+/i)) {
        push(part, field.field);
      }
    }
    const capitalized = text.match(/\b[A-ZÀ-ỴĐ][A-Za-zÀ-ỹĐđ'’]*(?:\s+[A-ZÀ-ỴĐ][A-Za-zÀ-ỹĐđ'’]*){0,4}/g) || [];
    for (const phrase of capitalized) push(phrase, field.field);
  }

  return [...candidates.values()];
}

function unmatchedCandidates(day, catalogIndex, matches, selectedMatch = null) {
  const matchedNames = new Set(matches.flatMap((match) => [normalizeText(match.name), normalizeText(match.alias)]));
  const selectedField = displayText(selectedMatch?.field);
  const selectedFromDayField = selectedField.startsWith("day.");
  const selectedFromDayTitle = selectedField === "day.title";
  return extractCandidateNames(day)
    .filter((candidate) => {
      if (selectedField && displayText(candidate.field) === selectedField) return false;
      if (selectedFromDayTitle) return false;
      if (selectedFromDayField && displayText(candidate.field).startsWith("service[")) return false;
      const normalized = normalizeText(candidate.label);
      if (matchedNames.has(normalized)) return false;
      for (const matchedName of matchedNames) {
        if (matchedName.includes(normalized) || normalized.includes(matchedName)) return false;
      }
      if (catalogIndex.aliasMap.has(normalized)) return false;
      return true;
    })
    .slice(0, 8);
}

function fixedMissingLocationPrefix(value) {
  const chars = Array.from(displayText(value) || "UNKNOWN");
  return chars.slice(0, 25).join("").padEnd(25, " ");
}

async function main() {
  const options = parseArgs(argv);
  if (options.help) {
    printUsage();
    return;
  }

  const repoRoot = path.resolve(repoRootArg);
  const toursDir = resolveFromRoot(repoRoot, options.toursDir);
  const catalogPath = resolveFromRoot(repoRoot, options.catalogPath);
  const catalog = await readJson(catalogPath);
  const catalogIndex = buildCatalogIndex(catalog);
  const tourFiles = await readTourFiles(toursDir);

  const report = {
    mode: options.write ? "write" : "dry-run",
    tours_scanned: tourFiles.length,
    days_scanned: 0,
    days_skipped_existing_primary: 0,
    days_assigned: 0,
    days_unresolved: 0,
    warnings: [],
    assignments: []
  };
  const dirtyFiles = new Set();

  for (const tourFile of tourFiles) {
    const days = Array.isArray(tourFile.tour?.travel_plan?.days) ? tourFile.tour.travel_plan.days : [];
    const contextualAliases = contextualAliasesForTour(tourFile.tour, catalogIndex);
    for (const day of days) {
      report.days_scanned += 1;
      const existing = displayText(day?.primary_location_id);
      if (existing && !options.overwrite) {
        report.days_skipped_existing_primary += 1;
        continue;
      }

      const matches = findCatalogMatches(day, catalogIndex, contextualAliases);
      const match = matches[0];
      const missing = unmatchedCandidates(day, catalogIndex, matches, match);
      if (missing.length) {
        report.warnings.push({
          day: dayReference(tourFile, day),
          title: displayText(day?.title),
          warning: "",
          candidates: missing
        });
      }

      if (!match) {
        report.days_unresolved += 1;
        if (!missing.length) {
          report.warnings.push({
            day: dayReference(tourFile, day),
            title: displayText(day?.title),
            warning: "Could not infer a location from the day text",
            candidates: []
          });
        }
        continue;
      }

      report.days_assigned += 1;
      report.assignments.push({
        day: dayReference(tourFile, day),
        title: displayText(day?.title),
        primary_location_id: match.id,
        primary_location_name: match.name,
        location_type: match.type,
        matched_alias: match.alias,
        matched_field: match.field
      });

      if (options.write) {
        day.primary_location_id = match.id;
        dirtyFiles.add(tourFile.filePath);
      }
    }
  }

  if (options.write) {
    for (const tourFile of tourFiles) {
      if (dirtyFiles.has(tourFile.filePath)) await writeJson(tourFile.filePath, tourFile.tour);
    }
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Tour day primary location assignment ${report.mode} report`);
  console.log(`Tours scanned: ${report.tours_scanned}`);
  console.log(`Days scanned: ${report.days_scanned}`);
  console.log(`Days skipped with existing primary: ${report.days_skipped_existing_primary}`);
  console.log(`Days assigned: ${report.days_assigned}`);
  console.log(`Days unresolved: ${report.days_unresolved}`);
  console.log(`Missing locations: ${report.warnings.length}`);

  if (report.assignments.length) {
    console.log("\nAssignments:");
    for (const item of report.assignments.slice(0, 50)) {
      console.log(`- ${item.day}: ${item.title} -> ${item.primary_location_name} (${item.primary_location_id}, ${item.matched_field})`);
    }
    if (report.assignments.length > 50) console.log(`- ... ${report.assignments.length - 50} more`);
  }

  if (report.warnings.length) {
    console.warn("\nMissing locations:");
    let printedWarnings = 0;
    for (const item of report.warnings) {
      if (printedWarnings >= 80) break;
      const candidates = Array.isArray(item.candidates) && item.candidates.length
        ? item.candidates
        : [{ label: "UNKNOWN", field: "" }];
      for (const candidate of candidates) {
        if (printedWarnings >= 80) break;
        const prefix = fixedMissingLocationPrefix(candidate.label);
        const field = candidate.field ? ` [${candidate.field}]` : "";
        const warning = displayText(item.warning);
        console.warn(`${prefix} ${item.day}${warning ? `: ${warning}` : ""}${item.title ? `; title="${item.title}"` : ""}${field}`);
        printedWarnings += 1;
      }
    }
    const warningLineCount = report.warnings.reduce((total, item) => (
      total + Math.max(1, Array.isArray(item.candidates) ? item.candidates.length : 0)
    ), 0);
    if (warningLineCount > 80) console.warn(`${fixedMissingLocationPrefix("...")} ${warningLineCount - 80} more`);
  }

  if (!options.write) {
    console.log("\nDry-run only. Pass --write to update tour.json files.");
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
NODE
