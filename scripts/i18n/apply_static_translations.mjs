#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  RUNTIME_PATHS,
  TRANSLATION_CLIENT,
  nowIso
} from "../../backend/app/src/config/runtime.js";
import { createStaticTranslationService } from "../../backend/app/src/domain/static_translations.js";
import { createTranslationMemoryStore } from "../../backend/app/src/lib/translation_memory_store.js";
import { normalizeText } from "../../backend/app/src/lib/text.js";

const HELP = `
Usage:
  node scripts/i18n/apply_static_translations.mjs [--domain <id>] [--target <lang>]

Translates missing, stale, legacy, or protected-term static translation
items using the same static translation service as the backend Translate
button. This updates content/translations and translation memory only.
It does not publish runtime i18n files or regenerate public homepage assets.

Options:
  --domain <id>    Limit to one or more comma-separated domains. Repeatable.
  --target <lang>  Limit to one or more comma-separated target languages. Repeatable.
  --help           Show this help.
`.trim();

function uniqueNormalized(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean))];
}

function parseArgs(argv) {
  const options = {
    domains: [],
    targetLangs: [],
    help: false
  };
  const args = Array.isArray(argv) ? [...argv] : [];
  while (args.length) {
    const token = args.shift();
    if (token === "--domain") {
      options.domains.push(normalizeText(args.shift()));
      continue;
    }
    if (token === "--target") {
      options.targetLangs.push(normalizeText(args.shift()));
      continue;
    }
    if (token === "-h" || token === "--help" || token === "help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  options.domains = uniqueNormalized(options.domains);
  options.targetLangs = uniqueNormalized(options.targetLangs);
  return options;
}

async function readJsonObject(filePath, fallback = {}) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function stripContentTourLocalizedFields(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripContentTourLocalizedFields(item));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.endsWith("_i18n") && key !== "translation_meta")
      .map(([key, item]) => [key, stripContentTourLocalizedFields(item)])
  );
}

async function readJsonFilesFromEntityDirs(rootDir, fileName, transform = (value) => value) {
  const items = [];
  const entries = await readdir(rootDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(rootDir, entry.name, fileName);
    try {
      const parsed = await readJsonObject(filePath, null);
      if (parsed && normalizeText(parsed.id)) items.push(transform(parsed));
    } catch {
      // Match backend storage reads: ignore unreadable entity folders.
    }
  }
  return items;
}

async function readDestinationStore() {
  const catalog = await readJsonObject(RUNTIME_PATHS.tourDestinationsPath, {});
  if (Object.keys(catalog).length) return normalizeDestinationStore(catalog);
  return normalizeDestinationStore(await readJsonObject(RUNTIME_PATHS.dataPath, {}));
}

function normalizeDestinationStore(store = {}) {
  const regions = Array.isArray(store.destination_regions)
    ? store.destination_regions
    : (Array.isArray(store.destination_areas) ? store.destination_areas : []);
  const regionById = new Map(
    regions
      .map((region) => [normalizeText(region?.id), region])
      .filter(([id]) => id)
  );
  const places = (Array.isArray(store.destination_places) ? store.destination_places : []).map((place) => {
    const regionId = normalizeText(place?.region_id || place?.area_id);
    const region = regionById.get(regionId);
    const destination = normalizeText(place?.destination || region?.destination).toUpperCase();
    const next = { ...place };
    delete next.area_id;
    if (regionId) next.region_id = regionId;
    if (destination) next.destination = destination;
    return next;
  });
  return {
    ...store,
    destination_scope_destinations: Array.isArray(store.destination_scope_destinations)
      ? store.destination_scope_destinations
      : [],
    destination_regions: regions,
    destination_places: places
  };
}

function languageHasTranslationIssues(entry) {
  return Number(entry?.translation_work_count || 0) > 0
    || Number(entry?.missing_count || 0) > 0
    || Number(entry?.stale_count || 0) > 0
    || Number(entry?.legacy_count || 0) > 0;
}

function selectedIssueEntries(status, options) {
  const domainFilter = new Set(options.domains);
  const targetFilter = new Set(options.targetLangs);
  return (Array.isArray(status?.languages) ? status.languages : [])
    .filter(languageHasTranslationIssues)
    .filter((entry) => {
      const domain = normalizeText(entry?.domain).toLowerCase();
      const targetLang = normalizeText(entry?.target_lang).toLowerCase();
      return (!domainFilter.size || domainFilter.has(domain))
        && (!targetFilter.size || targetFilter.has(targetLang));
    });
}

function applyOptionsFromIssueEntries(entries) {
  const targetLangsByDomain = {};
  for (const entry of entries) {
    const domain = normalizeText(entry?.domain).toLowerCase();
    const targetLang = normalizeText(entry?.target_lang).toLowerCase();
    if (!domain || !targetLang) continue;
    targetLangsByDomain[domain] = uniqueNormalized([...(targetLangsByDomain[domain] || []), targetLang]);
  }
  return {
    domains: Object.keys(targetLangsByDomain),
    target_langs_by_domain: targetLangsByDomain
  };
}

function formatIssueEntry(entry) {
  const parts = [
    `${entry.domain}/${entry.target_lang}`,
    `work=${Number(entry.translation_work_count || 0)}`,
    `missing=${Number(entry.missing_count || 0)}`,
    `stale=${Number(entry.stale_count || 0)}`,
    `legacy=${Number(entry.legacy_count || 0)}`
  ];
  return parts.join(" ");
}

function progressLogger() {
  const seen = new Map();
  return (progress = {}) => {
    const domain = normalizeText(progress.domain);
    const targetLang = normalizeText(progress.target_lang).toLowerCase();
    const total = Number(progress.total || 0);
    const current = Number(progress.current || 0);
    if (!domain || !targetLang || !total) return;
    const key = `${domain}|${targetLang}`;
    const previous = seen.get(key) || -1;
    if (current !== total && current - previous < 25) return;
    seen.set(key, current);
    console.log(`Translating ${domain}/${targetLang}: ${Math.min(current, total)}/${total}`);
  };
}

async function createService() {
  const writeQueueRef = { current: Promise.resolve() };
  const translationMemoryStore = createTranslationMemoryStore({
    dataPath: RUNTIME_PATHS.translationMemoryPath,
    writeQueueRef,
    nowIso
  });
  await translationMemoryStore.ensureStorage();

  return createStaticTranslationService({
    repoRoot: RUNTIME_PATHS.repoRoot,
    translationsSnapshotDir: RUNTIME_PATHS.translationsSnapshotDir,
    protectedTermsPath: RUNTIME_PATHS.translationProtectedTermsPath,
    phraseOverridesPath: RUNTIME_PATHS.translationPhraseOverridesPath,
    readStore: readDestinationStore,
    readTours: () => readJsonFilesFromEntityDirs(
      RUNTIME_PATHS.toursDir,
      "tour.json",
      stripContentTourLocalizedFields
    ),
    readTourVariants: () => readJsonFilesFromEntityDirs(
      RUNTIME_PATHS.tourVariantsDir,
      "tour_variant.json"
    ),
    translationMemoryStore,
    translateEntriesWithMeta: TRANSLATION_CLIENT.translateEntriesWithMeta,
    nowIso,
    writesEnabled: true,
    snapshotPublishEnabled: false
  });
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(HELP);
    console.error(error?.message || error);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  try {
    const service = await createService();
    const status = await service.getStatusSummary();
    const issueEntries = selectedIssueEntries(status, options);
    if (!issueEntries.length) {
      console.log("No static translation work was found.");
      return;
    }

    console.log("Static translation work:");
    for (const entry of issueEntries) {
      console.log(`- ${formatIssueEntry(entry)}`);
    }

    const summary = await service.applyMissingTranslations({
      ...applyOptionsFromIssueEntries(issueEntries),
      onProgress: progressLogger()
    });

    console.log(
      [
        "Static translations applied.",
        `- Requested items: ${summary.requested_count || 0}`,
        `- Translated items: ${summary.translated_count || 0}`,
        `- Domain/language pairs: ${summary.domains?.length || 0}`
      ].join("\n")
    );
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}

await main();
