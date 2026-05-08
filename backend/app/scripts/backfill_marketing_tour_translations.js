import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CUSTOMER_CONTENT_LANGUAGE_CODES,
  LANGUAGE_ALIAS_TO_CODE
} from "../../../shared/generated/language_catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DEFAULT_REPO_ROOT = path.resolve(APP_ROOT, "../..");

const TRANSLATION_SNAPSHOT_SCHEMA = "translation-snapshot/v1";
const DOMAIN = "marketing-tour-memory";
const LABEL = "Marketing Tours";
const SECTION = "customers";
const SUBSECTION = "marketing-tours";
const AUDIENCE = "customer";
const SOURCE_LANG = "en";
const SUPPORTED_TARGET_LANGS = new Set(CUSTOMER_CONTENT_LANGUAGE_CODES.filter((lang) => lang !== SOURCE_LANG));

function usage() {
  return [
    "Usage:",
    "  node backend/app/scripts/backfill_marketing_tour_translations.js [--write] [--validate] [--overwrite]",
    "",
    "Options:",
    "  --repo-root <path>        Repo root. Defaults to the current travelagency checkout.",
    "  --tours-dir <path>        Marketing tour JSON root. Defaults to content/tours.",
    "  --translations-dir <path> Central translation root. Defaults to content/translations.",
    "  --lang <code>            Limit to a target language. Can be repeated or comma-separated.",
    "  --write                  Write/merge content/translations/customers/marketing-tours.<lang>.json.",
    "  --validate, --check      Fail if central snapshots do not cover embedded tour translations.",
    "  --overwrite              Replace central targets that differ from embedded tour translations.",
    "  --json                   Print the full report as JSON.",
    "",
    "Default behavior is a dry-run report."
  ].join("\n");
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sourceKey(sourceText) {
  return sha256(normalizeText(sourceText));
}

function targetHash(targetText) {
  return sha256(String(targetText ?? ""));
}

function normalizeTargetLang(value) {
  const raw = normalizeText(value).toLowerCase();
  const resolved = LANGUAGE_ALIAS_TO_CODE[raw] || raw;
  return SUPPORTED_TARGET_LANGS.has(resolved) ? resolved : "";
}

function parseLangList(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeTargetLang(item))
    .filter(Boolean);
}

function parseArgs(argv) {
  const options = {
    repoRoot: DEFAULT_REPO_ROOT,
    write: false,
    validate: false,
    overwrite: false,
    json: false,
    langs: new Set()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "");
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--validate" || arg === "--check") {
      options.validate = true;
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--repo-root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--repo-root requires a path");
      options.repoRoot = path.resolve(process.cwd(), String(value));
      index += 1;
      continue;
    }
    if (arg === "--tours-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--tours-dir requires a path");
      options.toursDir = path.resolve(process.cwd(), String(value));
      index += 1;
      continue;
    }
    if (arg === "--translations-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--translations-dir requires a path");
      options.translationsDir = path.resolve(process.cwd(), String(value));
      index += 1;
      continue;
    }
    if (arg === "--lang") {
      const value = argv[index + 1];
      if (!value) throw new Error("--lang requires a language code");
      for (const lang of parseLangList(value)) options.langs.add(lang);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  options.toursDir = options.toursDir || path.join(options.repoRoot, "content", "tours");
  options.translationsDir = options.translationsDir || path.join(options.repoRoot, "content", "translations");
  return options;
}

async function readJsonObject(filePath, fallback = {}) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function listTourJsonFiles(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === "tour.json") {
      files.push(entryPath);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const tourPath = path.join(entryPath, "tour.json");
    try {
      await readFile(tourPath, "utf8");
      files.push(tourPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function sourceTextFromI18nPair(holder, i18nField) {
  const i18nValue = holder?.[i18nField];
  const plainField = i18nField.slice(0, -"_i18n".length);
  if (isPlainObject(i18nValue)) {
    const sourceFromMap = normalizeText(i18nValue[SOURCE_LANG]);
    if (sourceFromMap) return sourceFromMap;
  }
  const plainValue = holder?.[plainField];
  if (isPlainObject(plainValue)) return normalizeText(plainValue[SOURCE_LANG]);
  return normalizeText(plainValue);
}

function addOccurrence(groupedByLang, occurrence, issues) {
  const lang = occurrence.target_lang;
  const key = sourceKey(occurrence.source_text);
  if (!groupedByLang.has(lang)) groupedByLang.set(lang, new Map());
  const bySource = groupedByLang.get(lang);
  const existing = bySource.get(key);
  if (!existing) {
    bySource.set(key, {
      key,
      source_text: occurrence.source_text,
      target_text: occurrence.target_text,
      occurrences: [occurrence]
    });
    return;
  }

  existing.occurrences.push(occurrence);
  if (existing.source_text !== occurrence.source_text) {
    issues.push({
      type: "source_hash_collision",
      lang,
      source_hash: key,
      source_text: occurrence.source_text,
      existing_source_text: existing.source_text,
      path: occurrence.path,
      tour_id: occurrence.tour_id
    });
    return;
  }
  if (existing.target_text !== occurrence.target_text) {
    issues.push({
      type: "embedded_target_conflict",
      lang,
      source_hash: key,
      source_text: occurrence.source_text,
      target_text: occurrence.target_text,
      existing_target_text: existing.target_text,
      path: occurrence.path,
      tour_id: occurrence.tour_id
    });
  }
}

function collectI18nEntriesFromValue(value, context, groupedByLang, issues, langs) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectI18nEntriesFromValue(item, {
        ...context,
        path: `${context.path}[${index}]`
      }, groupedByLang, issues, langs);
    });
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [field, fieldValue] of Object.entries(value)) {
    const fieldPath = context.path ? `${context.path}.${field}` : field;
    if (field.endsWith("_i18n") && isPlainObject(fieldValue)) {
      const sourceText = sourceTextFromI18nPair(value, field);
      for (const [rawLang, rawTargetText] of Object.entries(fieldValue)) {
        const normalizedRawLang = LANGUAGE_ALIAS_TO_CODE[normalizeText(rawLang).toLowerCase()]
          || normalizeText(rawLang).toLowerCase();
        const lang = normalizeTargetLang(rawLang);
        const targetText = normalizeText(rawTargetText);
        if (!targetText || normalizedRawLang === SOURCE_LANG) continue;
        if (!lang) {
          issues.push({
            type: "unsupported_language",
            lang: normalizeText(rawLang),
            path: `${fieldPath}.${rawLang}`,
            tour_id: context.tour_id,
            tour_file: context.tour_file
          });
          continue;
        }
        if (langs.size && !langs.has(lang)) continue;
        if (!sourceText) {
          issues.push({
            type: "missing_source_text",
            lang,
            target_text: targetText,
            path: `${fieldPath}.${rawLang}`,
            tour_id: context.tour_id,
            tour_file: context.tour_file
          });
          continue;
        }
        addOccurrence(groupedByLang, {
          target_lang: lang,
          source_text: sourceText,
          target_text: targetText,
          field,
          path: `${fieldPath}.${rawLang}`,
          tour_id: context.tour_id,
          tour_file: context.tour_file
        }, issues);
      }
    }
    collectI18nEntriesFromValue(fieldValue, {
      ...context,
      path: fieldPath
    }, groupedByLang, issues, langs);
  }
}

export async function collectMarketingTourEmbeddedTranslations(options = {}) {
  const toursDir = options.toursDir || path.join(options.repoRoot || DEFAULT_REPO_ROOT, "content", "tours");
  const langs = new Set((Array.isArray(options.langs) ? options.langs : [])
    .map((lang) => normalizeTargetLang(lang))
    .filter(Boolean));
  const groupedByLang = new Map();
  const issues = [];
  const files = await listTourJsonFiles(toursDir);

  for (const tourFile of files) {
    let tour;
    try {
      tour = JSON.parse(await readFile(tourFile, "utf8"));
    } catch (error) {
      issues.push({
        type: "invalid_tour_json",
        tour_file: tourFile,
        error: String(error?.message || error)
      });
      continue;
    }
    collectI18nEntriesFromValue(tour, {
      path: "$",
      tour_id: normalizeText(tour?.id) || path.basename(path.dirname(tourFile)),
      tour_file: tourFile
    }, groupedByLang, issues, langs);
  }

  const byLang = Object.fromEntries(Array.from(groupedByLang.entries())
    .map(([lang, entries]) => [lang, Array.from(entries.values()).sort((left, right) => (
      left.source_text.localeCompare(right.source_text, "en", { sensitivity: "base" })
    ))]));
  const occurrenceCount = Object.values(byLang)
    .flatMap((entries) => entries)
    .reduce((total, entry) => total + entry.occurrences.length, 0);

  return {
    toursDir,
    files,
    byLang,
    issues,
    summary: {
      tour_files: files.length,
      languages: Object.keys(byLang).sort(),
      unique_entries: Object.values(byLang).reduce((total, entries) => total + entries.length, 0),
      occurrences: occurrenceCount,
      issues: issues.length
    }
  };
}

function snapshotPathForLang(translationsDir, lang) {
  return path.join(translationsDir, SECTION, `${SUBSECTION}.${lang}.json`);
}

function publishedTargetText(item) {
  return normalizeText(item?.target_text);
}

function existingSnapshotIndex(snapshot) {
  const bySourceKey = new Map();
  for (const item of Array.isArray(snapshot?.items) ? snapshot.items : []) {
    const sourceText = normalizeText(item?.source_text);
    if (!sourceText) continue;
    bySourceKey.set(sourceKey(sourceText), item);
  }
  return bySourceKey;
}

function createSnapshotItem(lang, entry, timestamp, existing = null) {
  const key = sourceKey(entry.source_text);
  const targetText = normalizeText(entry.target_text);
  const existingCacheMeta = isPlainObject(existing?.cache_meta) ? existing.cache_meta : {};
  return {
    source_ref: normalizeText(existing?.source_ref) || `${DOMAIN}:${key}`,
    key,
    domain: DOMAIN,
    section: SECTION,
    subsection: SUBSECTION,
    audience: AUDIENCE,
    required: existing?.required === false ? false : true,
    source_lang: SOURCE_LANG,
    target_lang: lang,
    source_text: entry.source_text,
    source_hash: key,
    target_text: targetText,
    target_hash: targetHash(targetText),
    machine_text: normalizeText(existing?.machine_text),
    manual_override: normalizeText(existing?.manual_override) || targetText,
    origin: normalizeText(existing?.origin) || "manual_override",
    freshness_state: normalizeText(existing?.freshness_state) || "current",
    job_state: normalizeText(existing?.job_state),
    publish_state: normalizeText(existing?.publish_state) || "published",
    review_state: normalizeText(existing?.review_state) || "approved",
    generated_at: normalizeText(existing?.generated_at) || timestamp,
    updated_at: normalizeText(existing?.updated_at) || timestamp,
    cache_meta: {
      ...existingCacheMeta,
      source_hash: key,
      origin: normalizeText(existingCacheMeta.origin) || "embedded_i18n_backfill",
      occurrence_count: entry.occurrences.length,
      sample_paths: entry.occurrences.slice(0, 8).map((occurrence) => ({
        tour_id: occurrence.tour_id,
        path: occurrence.path
      }))
    }
  };
}

function createSnapshot(lang, items, timestamp) {
  return {
    schema: TRANSLATION_SNAPSHOT_SCHEMA,
    schema_version: 1,
    generated_at: timestamp,
    source_set_hash: sha256(JSON.stringify(items.map((item) => ({
      source_ref: item.source_ref,
      source_hash: item.source_hash,
      target_lang: item.target_lang,
      target_hash: item.target_hash
    })))),
    domain: DOMAIN,
    label: LABEL,
    section: SECTION,
    subsection: SUBSECTION,
    audience: AUDIENCE,
    source_lang: SOURCE_LANG,
    target_lang: lang,
    item_count: items.length,
    items
  };
}

export async function buildMarketingTourTranslationSnapshots(options = {}) {
  const translationsDir = options.translationsDir || path.join(options.repoRoot || DEFAULT_REPO_ROOT, "content", "translations");
  const extracted = options.extracted || await collectMarketingTourEmbeddedTranslations(options);
  const timestamp = normalizeText(options.timestamp) || new Date().toISOString();
  const changes = [];
  const snapshots = {};

  for (const [lang, entries] of Object.entries(extracted.byLang || {})) {
    const snapshotPath = snapshotPathForLang(translationsDir, lang);
    const existingSnapshot = await readJsonObject(snapshotPath, { items: [] });
    const existingBySource = existingSnapshotIndex(existingSnapshot);
    const nextBySource = new Map(existingBySource);
    const langChanges = {
      lang,
      path: snapshotPath,
      added: 0,
      updated: 0,
      unchanged: 0,
      conflicts: []
    };

    for (const entry of entries) {
      const key = sourceKey(entry.source_text);
      const existing = existingBySource.get(key);
      if (!existing) {
        nextBySource.set(key, createSnapshotItem(lang, entry, timestamp));
        langChanges.added += 1;
        continue;
      }
      const existingTarget = publishedTargetText(existing);
      if (existingTarget === entry.target_text) {
        langChanges.unchanged += 1;
        continue;
      }
      const conflict = {
        type: "central_target_mismatch",
        lang,
        source_hash: key,
        source_text: entry.source_text,
        central_target_text: existingTarget,
        embedded_target_text: entry.target_text,
        occurrences: entry.occurrences.slice(0, 8)
      };
      langChanges.conflicts.push(conflict);
      if (options.overwrite) {
        nextBySource.set(key, createSnapshotItem(lang, entry, timestamp, existing));
        langChanges.updated += 1;
      } else {
        langChanges.unchanged += 1;
      }
    }

    const items = Array.from(nextBySource.values())
      .filter((item) => normalizeText(item?.source_text) && publishedTargetText(item))
      .sort((left, right) => normalizeText(left.source_text).localeCompare(
        normalizeText(right.source_text),
        "en",
        { sensitivity: "base" }
      ));
    snapshots[lang] = createSnapshot(lang, items, timestamp);
    changes.push(langChanges);
  }

  return {
    translationsDir,
    extracted,
    snapshots,
    changes
  };
}

export function validateMarketingTourTranslationSnapshots(build) {
  const issues = [];
  for (const issue of build?.extracted?.issues || []) {
    issues.push(issue);
  }
  for (const [lang, entries] of Object.entries(build?.extracted?.byLang || {})) {
    const snapshot = build?.snapshots?.[lang] || { items: [] };
    const bySource = existingSnapshotIndex(snapshot);
    for (const entry of entries) {
      const key = sourceKey(entry.source_text);
      const item = bySource.get(key);
      if (!item) {
        issues.push({
          type: "missing_central_translation",
          lang,
          source_hash: key,
          source_text: entry.source_text,
          occurrences: entry.occurrences.slice(0, 8)
        });
        continue;
      }
      const targetText = publishedTargetText(item);
      if (!targetText) {
        issues.push({
          type: "empty_central_translation",
          lang,
          source_hash: key,
          source_text: entry.source_text,
          occurrences: entry.occurrences.slice(0, 8)
        });
        continue;
      }
      if (targetText !== entry.target_text) {
        issues.push({
          type: "central_target_mismatch",
          lang,
          source_hash: key,
          source_text: entry.source_text,
          central_target_text: targetText,
          embedded_target_text: entry.target_text,
          occurrences: entry.occurrences.slice(0, 8)
        });
      }
    }
  }
  return {
    ok: issues.length === 0,
    issues,
    issue_count: issues.length
  };
}

function manifestSection(lang, snapshot) {
  return {
    domain: DOMAIN,
    label: LABEL,
    section: SECTION,
    subsection: SUBSECTION,
    audience: AUDIENCE,
    source_lang: SOURCE_LANG,
    target_lang: lang,
    item_count: Number(snapshot?.items?.length || 0),
    file: path.posix.join(SECTION, `${SUBSECTION}.${lang}.json`)
  };
}

function sectionMatchesMarketingTour(section, lang) {
  return normalizeText(section?.domain) === DOMAIN
    && normalizeText(section?.section) === SECTION
    && normalizeText(section?.subsection) === SUBSECTION
    && normalizeText(section?.target_lang) === lang;
}

async function writeManifest(translationsDir, snapshots, timestamp) {
  const manifestPath = path.join(translationsDir, "manifest.json");
  const existing = await readJsonObject(manifestPath, { sections: [] });
  const langs = Object.keys(snapshots).sort();
  const sections = (Array.isArray(existing?.sections) ? existing.sections : [])
    .filter((section) => !langs.some((lang) => sectionMatchesMarketingTour(section, lang)));
  for (const lang of langs) {
    sections.push(manifestSection(lang, snapshots[lang]));
  }
  sections.sort((left, right) => (
    `${normalizeText(left.section)}|${normalizeText(left.subsection)}|${normalizeText(left.target_lang)}`
      .localeCompare(`${normalizeText(right.section)}|${normalizeText(right.subsection)}|${normalizeText(right.target_lang)}`, "en")
  ));
  const next = {
    schema: TRANSLATION_SNAPSHOT_SCHEMA,
    schema_version: 1,
    generated_at: timestamp,
    source_set_hash: sha256(JSON.stringify(sections.map((section) => ({
      source_ref: `${section.domain}:${section.subsection}`,
      source_hash: "",
      target_lang: section.target_lang,
      target_hash: `${section.file}:${section.item_count}`
    })))),
    staff_languages: Array.from(new Set(sections.filter((section) => normalizeText(section.section) === "staff").map((section) => normalizeText(section.target_lang)).filter(Boolean))).sort(),
    customer_languages: Array.from(new Set(sections.filter((section) => normalizeText(section.section) === "customers").map((section) => normalizeText(section.target_lang)).filter(Boolean))).sort(),
    items_count: sections.reduce((total, section) => total + Number(section.item_count || 0), 0),
    total_items: sections.reduce((total, section) => total + Number(section.item_count || 0), 0),
    sections
  };
  await writeJson(manifestPath, next);
  return next;
}

export async function runMarketingTourTranslationBackfill(options = {}) {
  const timestamp = normalizeText(options.timestamp) || new Date().toISOString();
  const extracted = await collectMarketingTourEmbeddedTranslations(options);
  const build = await buildMarketingTourTranslationSnapshots({
    ...options,
    extracted,
    timestamp
  });
  let manifest = null;
  if (options.write) {
    for (const [lang, snapshot] of Object.entries(build.snapshots)) {
      await writeJson(snapshotPathForLang(build.translationsDir, lang), snapshot);
    }
    manifest = await writeManifest(build.translationsDir, build.snapshots, timestamp);
  }
  const validation = validateMarketingTourTranslationSnapshots(build);
  return {
    write: Boolean(options.write),
    validate: Boolean(options.validate),
    overwrite: Boolean(options.overwrite),
    toursDir: extracted.toursDir,
    translationsDir: build.translationsDir,
    summary: {
      ...extracted.summary,
      added: build.changes.reduce((total, change) => total + change.added, 0),
      updated: build.changes.reduce((total, change) => total + change.updated, 0),
      unchanged: build.changes.reduce((total, change) => total + change.unchanged, 0),
      embedded_conflicts: extracted.issues.filter((issue) => issue.type === "embedded_target_conflict").length,
      central_conflicts: build.changes.reduce((total, change) => total + change.conflicts.length, 0),
      validation_issues: validation.issue_count
    },
    changes: build.changes,
    validation,
    manifest
  };
}

function printTextReport(report) {
  const lines = [
    `Marketing tour translation backfill ${report.write ? "wrote" : "dry-run"} report`,
    `Tours scanned: ${report.summary.tour_files}`,
    `Languages: ${report.summary.languages.join(", ") || "(none)"}`,
    `Embedded occurrences: ${report.summary.occurrences}`,
    `Unique source/lang entries: ${report.summary.unique_entries}`,
    `Added: ${report.summary.added}`,
    `Updated: ${report.summary.updated}`,
    `Unchanged: ${report.summary.unchanged}`,
    `Embedded conflicts: ${report.summary.embedded_conflicts}`,
    `Central conflicts: ${report.summary.central_conflicts}`,
    `Validation issues: ${report.summary.validation_issues}`
  ];
  for (const change of report.changes) {
    lines.push(`- ${change.lang}: +${change.added}, updated ${change.updated}, unchanged ${change.unchanged}, conflicts ${change.conflicts.length}`);
  }
  if (!report.write) {
    lines.push("Dry-run only. Pass --write to update content/translations.");
  }
  if (report.validation.issues.length) {
    lines.push("First validation issues:");
    for (const issue of report.validation.issues.slice(0, 20)) {
      lines.push(`- ${issue.type} ${issue.lang || ""} ${issue.source_text || issue.path || issue.tour_file || ""}`.trim());
    }
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const report = await runMarketingTourTranslationBackfill({
    repoRoot: options.repoRoot,
    toursDir: options.toursDir,
    translationsDir: options.translationsDir,
    langs: Array.from(options.langs),
    write: options.write,
    validate: options.validate,
    overwrite: options.overwrite
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(printTextReport(report));
  }
  if (options.validate && !report.validation.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
