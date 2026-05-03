#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BACKEND_UI_LANGUAGE_CODES,
  FRONTEND_LANGUAGE_CODES
} from "../../shared/generated/language_catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_SOURCE_LANG = "en";
const TRANSLATION_SNAPSHOT_SCHEMA = "translation-snapshot/v1";

const RUNTIME_DOMAINS = Object.freeze({
  frontend: {
    id: "frontend",
    label: "Frontend",
    domain: "frontend",
    section: "customers",
    subsection: "frontend-static",
    supportedLanguages: FRONTEND_LANGUAGE_CODES.filter((code) => code !== DEFAULT_SOURCE_LANG),
    sourcePath: (repoRoot) => path.join(repoRoot, "frontend", "data", "i18n", "frontend", "en.json"),
    targetPath: (repoRoot, lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend", `${lang}.json`),
    metaPath: (repoRoot, lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", `${lang}.json`),
    cleanupPatterns: [
      {
        dir: (repoRoot) => path.join(repoRoot, "frontend", "data", "i18n", "frontend"),
        languageFromFile: (name) => name.match(/^([a-z][a-z0-9-]*)\.json$/)?.[1] || ""
      },
      {
        dir: (repoRoot) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta"),
        languageFromFile: (name) => name.match(/^([a-z][a-z0-9-]*)\.json$/)?.[1] || ""
      }
    ]
  },
  backend: {
    id: "backend",
    label: "Backend",
    domain: "backend",
    section: "staff",
    subsection: "backend-ui",
    supportedLanguages: BACKEND_UI_LANGUAGE_CODES.filter((code) => code !== DEFAULT_SOURCE_LANG),
    sourcePath: (repoRoot) => path.join(repoRoot, "frontend", "data", "i18n", "backend", "en.json"),
    targetPath: (repoRoot, lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend", `${lang}.json`),
    metaPath: (repoRoot, lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend", `${lang}.meta.json`),
    cleanupPatterns: [
      {
        dir: (repoRoot) => path.join(repoRoot, "frontend", "data", "i18n", "backend"),
        languageFromFile: (name) => name.match(/^([a-z][a-z0-9-]*)\.json$/)?.[1] || ""
      },
      {
        dir: (repoRoot) => path.join(repoRoot, "frontend", "data", "i18n", "backend"),
        languageFromFile: (name) => name.match(/^([a-z][a-z0-9-]*)\.meta\.json$/)?.[1] || ""
      }
    ]
  }
});

function normalizeText(value) {
  return String(value ?? "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean))];
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sourceHash(value) {
  return sha256(String(value ?? ""));
}

function usage() {
  console.error([
    "Usage:",
    "  node scripts/i18n/build_runtime_i18n.mjs [--check] [--strict] [--target vi] [--domain frontend|backend]",
    "",
    "Options:",
    "  --check               Validate content/translations without writing runtime files.",
    "  --strict              Fail on missing, stale, duplicate, or extra snapshot keys. Default.",
    "  --no-strict           Ignore extra snapshot keys that are no longer in the source dictionary.",
    "  --target <lang>       Limit to one or more comma-separated target languages. Repeatable.",
    "  --domain <domain>     Limit to frontend and/or backend. Repeatable.",
    "  --snapshot-dir <path> Override content/translations.",
    "  --repo-root <path>    Override repository root.",
    "  --quiet               Suppress success output."
  ].join("\n"));
}

function parseArgs(argv) {
  const options = {
    repoRoot: DEFAULT_REPO_ROOT,
    snapshotDir: "",
    check: false,
    strict: true,
    quiet: false,
    domains: [],
    targetLangs: []
  };

  const args = Array.isArray(argv) ? [...argv] : [];
  while (args.length) {
    const token = args.shift();
    if (token === "--check") {
      options.check = true;
      continue;
    }
    if (token === "--strict") {
      options.strict = true;
      continue;
    }
    if (token === "--no-strict") {
      options.strict = false;
      continue;
    }
    if (token === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (token === "--repo-root") {
      options.repoRoot = path.resolve(normalizeText(args.shift()));
      continue;
    }
    if (token === "--snapshot-dir") {
      options.snapshotDir = path.resolve(normalizeText(args.shift()));
      continue;
    }
    if (token === "--target") {
      options.targetLangs.push(...normalizeText(args.shift()).split(","));
      continue;
    }
    if (token === "--domain") {
      options.domains.push(...normalizeText(args.shift()).split(","));
      continue;
    }
    if (token === "-h" || token === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  options.repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  options.snapshotDir = options.snapshotDir
    ? path.resolve(options.snapshotDir)
    : path.join(options.repoRoot, "content", "translations");
  options.domains = unique(options.domains);
  options.targetLangs = unique(options.targetLangs);

  for (const domain of options.domains) {
    if (!RUNTIME_DOMAINS[domain]) {
      throw new Error(`Unsupported runtime i18n domain: ${domain}`);
    }
  }

  return options;
}

async function readJsonObject(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object.`);
  }
  return parsed;
}

function resolveSnapshotFile(snapshotDir, relativeFile) {
  const normalizedRelativeFile = normalizeText(relativeFile);
  if (!normalizedRelativeFile) {
    throw new Error("Translation snapshot section is missing its file path.");
  }
  const resolved = path.resolve(snapshotDir, normalizedRelativeFile);
  const relative = path.relative(snapshotDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Translation snapshot file escapes the snapshot directory: ${relativeFile}`);
  }
  return resolved;
}

function summarize(values, limit = 8) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) return "";
  const head = list.slice(0, limit).join(", ");
  return list.length > limit ? `${head}, ...` : head;
}

function metadataFromSnapshotItem(item, snapshot, manifest, expectedHash) {
  return {
    source_hash: expectedHash,
    origin: normalizeText(item?.origin || item?.cache_meta?.origin) || "content_translations",
    updated_at: normalizeText(
      item?.updated_at
      || item?.published_at
      || snapshot?.published_at
      || snapshot?.generated_at
      || manifest?.published_at
      || manifest?.generated_at
    )
  };
}

function itemTargetText(item) {
  return String(
    normalizeText(item?.manual_override)
      || normalizeText(item?.machine_text)
      || item?.target_text
      || ""
  );
}

function validateSnapshotItems({ config, lang, source, snapshot, manifest, strict }) {
  const errors = [];
  const items = Array.isArray(snapshot?.items) ? snapshot.items : null;
  if (!items) {
    errors.push(`${config.id}/${lang}: snapshot items must be an array.`);
    return { target: {}, meta: {}, errors };
  }

  if (strict && normalizeText(snapshot.schema) && normalizeText(snapshot.schema) !== TRANSLATION_SNAPSHOT_SCHEMA) {
    errors.push(`${config.id}/${lang}: unsupported snapshot schema ${snapshot.schema}.`);
  }
  if (strict && Number(snapshot.item_count) !== items.length) {
    errors.push(`${config.id}/${lang}: item_count ${snapshot.item_count} does not match ${items.length} items.`);
  }

  const fieldChecks = [
    ["domain", config.domain],
    ["section", config.section],
    ["subsection", config.subsection],
    ["source_lang", DEFAULT_SOURCE_LANG],
    ["target_lang", lang]
  ];
  for (const [field, expected] of fieldChecks) {
    const actual = normalizeText(snapshot?.[field]).toLowerCase();
    if (actual && actual !== expected) {
      errors.push(`${config.id}/${lang}: snapshot ${field} is ${actual}, expected ${expected}.`);
    }
  }

  const sourceKeys = Object.keys(source || {});
  const sourceKeySet = new Set(sourceKeys);
  const byKey = new Map();
  const duplicateKeys = [];
  const extraKeys = [];

  for (const item of items) {
    const key = normalizeText(item?.key);
    if (!key) {
      errors.push(`${config.id}/${lang}: snapshot item is missing key.`);
      continue;
    }
    if (byKey.has(key)) {
      duplicateKeys.push(key);
      continue;
    }
    byKey.set(key, item);
    if (!sourceKeySet.has(key)) {
      extraKeys.push(key);
    }
  }

  if (duplicateKeys.length) {
    errors.push(`${config.id}/${lang}: duplicate keys (${duplicateKeys.length}): ${summarize(duplicateKeys)}`);
  }
  if (strict && extraKeys.length) {
    errors.push(`${config.id}/${lang}: extra keys not in source (${extraKeys.length}): ${summarize(extraKeys)}`);
  }

  const target = {};
  const meta = {};
  const missingKeys = [];

  for (const key of sourceKeys) {
    const sourceValue = String(source[key] ?? "");
    const expectedHash = sourceHash(sourceValue);
    const item = byKey.get(key);
    if (!item) {
      missingKeys.push(key);
      continue;
    }

    const itemSourceText = String(item.source_text ?? "");
    const itemSourceHash = normalizeText(item.source_hash);
    const targetText = itemTargetText(item);

    if (itemSourceText !== sourceValue) {
      errors.push(`${config.id}/${lang}: ${key} has stale source_text.`);
    }
    if (!itemSourceHash) {
      errors.push(`${config.id}/${lang}: ${key} is missing source_hash.`);
    } else if (itemSourceHash !== expectedHash) {
      errors.push(`${config.id}/${lang}: ${key} has stale source_hash.`);
    }
    if (!normalizeText(targetText)) {
      errors.push(`${config.id}/${lang}: ${key} is missing target_text.`);
    }

    target[key] = targetText;
    meta[key] = metadataFromSnapshotItem(item, snapshot, manifest, expectedHash);
  }

  if (missingKeys.length) {
    errors.push(`${config.id}/${lang}: missing source keys (${missingKeys.length}): ${summarize(missingKeys)}`);
  }

  return { target, meta, errors };
}

function selectSections({ manifest, config, targetLangs }) {
  const requestedTargets = new Set(targetLangs);
  const sections = (Array.isArray(manifest?.sections) ? manifest.sections : [])
    .filter((section) => normalizeText(section?.domain).toLowerCase() === config.domain)
    .filter((section) => normalizeText(section?.subsection).toLowerCase() === config.subsection)
    .filter((section) => normalizeText(section?.source_lang).toLowerCase() === DEFAULT_SOURCE_LANG)
    .filter((section) => {
      const targetLang = normalizeText(section?.target_lang).toLowerCase();
      return !requestedTargets.size || requestedTargets.has(targetLang);
    });

  const unsupportedRequested = targetLangs.filter((lang) => !config.supportedLanguages.includes(lang));
  if (unsupportedRequested.length) {
    throw new Error(`${config.id}: unsupported target language(s): ${unsupportedRequested.join(", ")}`);
  }

  if (requestedTargets.size) {
    const available = new Set(sections.map((section) => normalizeText(section?.target_lang).toLowerCase()));
    const missing = targetLangs.filter((lang) => config.supportedLanguages.includes(lang) && !available.has(lang));
    if (missing.length) {
      throw new Error(`${config.id}: no content/translations section for ${missing.join(", ")}`);
    }
  }

  const byLang = new Map();
  const duplicates = [];
  for (const section of sections) {
    const lang = normalizeText(section?.target_lang).toLowerCase();
    if (!lang) continue;
    if (!config.supportedLanguages.includes(lang)) {
      throw new Error(`${config.id}: content/translations uses unsupported target language ${lang}.`);
    }
    if (byLang.has(lang)) {
      duplicates.push(lang);
      continue;
    }
    byLang.set(lang, section);
  }
  if (duplicates.length) {
    throw new Error(`${config.id}: duplicate content/translations sections for ${duplicates.join(", ")}`);
  }

  return [...byLang.entries()].map(([lang, section]) => ({ lang, section }));
}

async function loadRuntimeBuildPlan({ repoRoot, snapshotDir, domains, targetLangs, strict }) {
  const manifestPath = path.join(snapshotDir, "manifest.json");
  const manifest = await readJsonObject(manifestPath);
  if (strict && normalizeText(manifest.schema) && normalizeText(manifest.schema) !== TRANSLATION_SNAPSHOT_SCHEMA) {
    throw new Error(`Unsupported translation manifest schema: ${manifest.schema}`);
  }

  const selectedDomains = domains.length ? domains : Object.keys(RUNTIME_DOMAINS);
  const builds = [];
  const errors = [];

  for (const domain of selectedDomains) {
    const config = RUNTIME_DOMAINS[domain];
    const source = await readJsonObject(config.sourcePath(repoRoot));
    const sections = selectSections({ manifest, config, targetLangs });
    if (!sections.length) {
      throw new Error(`${config.id}: no published ${config.subsection} snapshots found in ${manifestPath}`);
    }

    for (const { lang, section } of sections) {
      const snapshotPath = resolveSnapshotFile(snapshotDir, section.file);
      const snapshot = await readJsonObject(snapshotPath);
      const build = validateSnapshotItems({
        config,
        lang,
        source,
        snapshot,
        manifest,
        strict
      });
      if (build.errors.length) {
        errors.push(...build.errors);
        continue;
      }
      builds.push({
        config,
        lang,
        target: build.target,
        meta: build.meta,
        itemCount: Object.keys(build.target).length,
        snapshotPath
      });
    }
  }

  if (errors.length) {
    const error = new Error(`Runtime i18n snapshot validation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:\n- ${errors.slice(0, 40).join("\n- ")}`);
    error.details = errors;
    throw error;
  }

  return { manifest, builds };
}

async function cleanupGeneratedRuntimeFiles({ repoRoot, configs, targetLangs }) {
  const targetSet = new Set(targetLangs || []);
  const seen = new Set();
  for (const config of configs) {
    for (const pattern of config.cleanupPatterns) {
      const dir = pattern.dir(repoRoot);
      let entries = [];
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const lang = pattern.languageFromFile(entry.name);
        if (!lang || lang === DEFAULT_SOURCE_LANG) continue;
        if (targetSet.size && !targetSet.has(lang)) continue;
        const filePath = path.join(dir, entry.name);
        if (seen.has(filePath)) continue;
        seen.add(filePath);
        await rm(filePath, { force: true });
      }
    }
  }
}

async function writeJsonFile(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function summarizeBuilds(builds) {
  const byDomain = new Map();
  for (const build of builds) {
    const entry = byDomain.get(build.config.id) || { label: build.config.label, languages: 0, items: 0 };
    entry.languages += 1;
    entry.items += build.itemCount;
    byDomain.set(build.config.id, entry);
  }
  return [...byDomain.values()].map((entry) => (
    `- ${entry.label}: ${entry.languages} language${entry.languages === 1 ? "" : "s"}, ${entry.items} item${entry.items === 1 ? "" : "s"}`
  ));
}

export async function generateRuntimeI18nFromSnapshots(rawOptions = {}) {
  const options = {
    repoRoot: path.resolve(rawOptions.repoRoot || DEFAULT_REPO_ROOT),
    snapshotDir: rawOptions.snapshotDir
      ? path.resolve(rawOptions.snapshotDir)
      : path.join(path.resolve(rawOptions.repoRoot || DEFAULT_REPO_ROOT), "content", "translations"),
    domains: unique(rawOptions.domains || []),
    targetLangs: unique(rawOptions.targetLangs || []),
    check: Boolean(rawOptions.check),
    strict: rawOptions.strict !== false,
    quiet: Boolean(rawOptions.quiet)
  };

  for (const domain of options.domains) {
    if (!RUNTIME_DOMAINS[domain]) {
      throw new Error(`Unsupported runtime i18n domain: ${domain}`);
    }
  }

  const plan = await loadRuntimeBuildPlan(options);
  if (!options.check) {
    const configs = [...new Map(plan.builds.map((build) => [build.config.id, build.config])).values()];
    const cleanupTargets = options.targetLangs.length
      ? options.targetLangs
      : [];
    await cleanupGeneratedRuntimeFiles({
      repoRoot: options.repoRoot,
      configs,
      targetLangs: cleanupTargets
    });
    for (const build of plan.builds) {
      await writeJsonFile(build.config.targetPath(options.repoRoot, build.lang), build.target);
      await writeJsonFile(build.config.metaPath(options.repoRoot, build.lang), build.meta);
    }
  }

  const summary = {
    check: options.check,
    built: plan.builds.map((build) => ({
      domain: build.config.id,
      target_lang: build.lang,
      item_count: build.itemCount,
      snapshot_path: build.snapshotPath,
      target_path: build.config.targetPath(options.repoRoot, build.lang),
      meta_path: build.config.metaPath(options.repoRoot, build.lang)
    }))
  };

  if (!options.quiet) {
    const action = options.check ? "Validated" : "Generated";
    console.log(`${action} runtime i18n from ${path.relative(options.repoRoot, options.snapshotDir) || options.snapshotDir}.`);
    console.log(summarizeBuilds(plan.builds).join("\n"));
  }

  return summary;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    console.error(normalizeText(error?.message) || "Could not parse arguments.");
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    usage();
    return;
  }

  try {
    await generateRuntimeI18nFromSnapshots(options);
  } catch (error) {
    console.error(normalizeText(error?.message) || error);
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] || "") === __filename) {
  await main();
}
