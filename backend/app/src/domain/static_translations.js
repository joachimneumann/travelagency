import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BACKEND_UI_LANGUAGES,
  CUSTOMER_CONTENT_LANGUAGES,
  FRONTEND_LANGUAGES,
  FRONTEND_LANGUAGE_CODES
} from "../../../../shared/generated/language_catalog.js";
import { translationMemorySourceKey } from "../lib/translation_memory_store.js";
import { normalizeDestinationCountryCode } from "./destination_scope.js";

const FRONTEND_CONTEXT = "AsiaTravelPlan public website for travelers planning Southeast Asia trips. Use natural, polished, customer-facing copy that feels trustworthy, clear, and concise.";
const INDEX_CONTENT_MEMORY_CONTEXT = "Exact-source translation memory for index.html customer-facing text, excluding marketing tours.";
const MARKETING_TOUR_MEMORY_CONTEXT = "Shared exact-source translation memory for marketing tours. Manual overrides win over machine cache when staff translate marketing-tour content.";
const DESTINATION_SCOPE_CONTEXT = "AsiaTravelPlan public website destination taxonomy labels for country, region, and place filters. Translate labels naturally and concisely as proper travel destination names.";
const BACKEND_CONTEXT = "AsiaTravelPlan backend UI for ATP staff managing bookings, tours, invoices, travel plans, and internal notes. Use a clear, natural, friendly tone for internal staff UI copy.";
const TRANSLATION_SNAPSHOT_SCHEMA = "translation-snapshot/v1";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sourceHash(value) {
  return sha256(String(value ?? ""));
}

function sourceKey(value) {
  return translationMemorySourceKey(value);
}

function apiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function defaultReadJsonFile(filePath, fallback = {}) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${filePath} must contain a JSON object.`);
    }
    return { data: parsed, raw };
  } catch (error) {
    if (error?.code === "ENOENT") return { data: fallback, raw: "" };
    throw error;
  }
}

function sortOverridesBySource(source, overrides) {
  const ordered = {};
  for (const key of Object.keys(source || {})) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      ordered[key] = overrides[key];
    }
  }
  return ordered;
}

function sortObjectBySource(source, values) {
  const ordered = {};
  const remainingKeys = new Set(Object.keys(values || {}));
  for (const key of Object.keys(source || {})) {
    if (!remainingKeys.has(key)) continue;
    ordered[key] = values[key];
    remainingKeys.delete(key);
  }
  for (const key of Array.from(remainingKeys).sort()) {
    ordered[key] = values[key];
  }
  return ordered;
}

function buildDomainConfigs(repoRoot) {
  const frontendLangs = FRONTEND_LANGUAGES.filter((entry) => entry.code !== "en");
  const customerContentLangs = CUSTOMER_CONTENT_LANGUAGES.filter((entry) => entry.code !== "en");
  const backendLangs = BACKEND_UI_LANGUAGES.filter((entry) => entry.code !== "en" && entry.code === "vi");
  return {
    frontend: {
      id: "frontend",
      kind: "static",
      label: "Customer-facing UI (legacy key-based)",
      section: "customers",
      subsection: "frontend-static",
      audience: "customer",
      publishable: true,
      sourceLang: "en",
      sourcePath: () => path.join(repoRoot, "frontend", "data", "i18n", "frontend", "en.json"),
      targetPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend", `${lang}.json`),
      metaPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", `${lang}.json`),
      overridePath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_overrides", `${lang}.json`),
      targetLanguages: frontendLangs,
      context: FRONTEND_CONTEXT
    },
    "index-content-memory": {
      id: "index-content-memory",
      kind: "translation_memory",
      label: "Index.html texts",
      section: "customers",
      subsection: "index-content",
      audience: "customer",
      publishable: true,
      sourceLang: "en",
      targetLanguages: customerContentLangs,
      context: INDEX_CONTENT_MEMORY_CONTEXT
    },
    "marketing-tour-memory": {
      id: "marketing-tour-memory",
      kind: "translation_memory",
      label: "Marketing Tours",
      section: "customers",
      subsection: "marketing-tours",
      audience: "customer",
      publishable: true,
      sourceLang: "en",
      targetLanguages: customerContentLangs,
      context: MARKETING_TOUR_MEMORY_CONTEXT
    },
    "destination-scope-catalog": {
      id: "destination-scope-catalog",
      kind: "destination_scope_catalog",
      label: "Tour destinations",
      section: "customers",
      subsection: "tour-destinations",
      audience: "customer",
      publishable: true,
      sourceLang: "en",
      targetLanguages: customerContentLangs,
      context: DESTINATION_SCOPE_CONTEXT
    },
    backend: {
      id: "backend",
      kind: "static",
      label: "Backend terms for staff",
      section: "staff",
      subsection: "backend-ui",
      audience: "staff",
      publishable: true,
      sourceLang: "en",
      sourcePath: () => path.join(repoRoot, "frontend", "data", "i18n", "backend", "en.json"),
      targetPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend", `${lang}.json`),
      metaPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend", `${lang}.meta.json`),
      overridePath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend_overrides", `${lang}.json`),
      targetLanguages: backendLangs,
      context: BACKEND_CONTEXT
    }
  };
}

export function createStaticTranslationService({
  repoRoot,
  translationsSnapshotDir = path.join(repoRoot || "", "content", "translations"),
  readStore = null,
  persistStore = null,
  readTours = null,
  translationMemoryStore = null,
  translateEntriesWithMeta = null,
  readTranslationRules = null,
  nowIso = () => new Date().toISOString(),
  readJsonFile = defaultReadJsonFile,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
  renameFn = rename,
  writesEnabled = true
} = {}) {
  if (!repoRoot) {
    throw new Error("createStaticTranslationService requires repoRoot.");
  }

  const configs = buildDomainConfigs(repoRoot);

  function getDomainConfig(domain) {
    const normalized = normalizeText(domain).toLowerCase();
    const config = configs[normalized];
    if (!config) {
      throw apiError(404, "STATIC_TRANSLATION_DOMAIN_NOT_FOUND", `Unsupported translation domain: ${domain}`);
    }
    return config;
  }

  function getLanguageConfig(domain, targetLang) {
    const config = getDomainConfig(domain);
    const normalizedLang = normalizeText(targetLang).toLowerCase();
    const language = config.targetLanguages.find((entry) => entry.code === normalizedLang);
    if (!language) {
      throw apiError(404, "STATIC_TRANSLATION_LANGUAGE_NOT_FOUND", `Unsupported ${config.id} translation language: ${targetLang}`);
    }
    return { config, language, targetLang: normalizedLang };
  }

  function domainSummary(config) {
    return {
      id: config.id,
      kind: config.kind,
      label: config.label,
      ...translationScope(config),
      source_lang: config.sourceLang,
      target_languages: config.targetLanguages,
      context: config.context,
      writes_enabled: writesEnabled !== false
    };
  }

  function assertWritesEnabled() {
    if (writesEnabled === false) {
      throw apiError(
        403,
        "STATIC_TRANSLATION_WRITES_DISABLED",
        "Manual translation override editing is disabled in this environment."
      );
    }
  }

  function translationScope(config) {
    return {
      section: normalizeText(config.section),
      subsection: normalizeText(config.subsection),
      audience: normalizeText(config.audience),
      publishable: config.publishable !== false
    };
  }

  function sourceRef(config, key) {
    return `${config.id}:${normalizeText(key)}`;
  }

  function snapshotRelativeFile(config, targetLang) {
    const scope = translationScope(config);
    return path.posix.join(scope.section || "translations", `${scope.subsection || config.id}.${targetLang}.json`);
  }

  function translationStorePath(config, language) {
    return path.join(translationsSnapshotDir, snapshotRelativeFile(config, language.code));
  }

  function isManualStoreOrigin(origin) {
    return ["manual", "manual_override", "override"].includes(normalizeText(origin));
  }

  function storeItemManualOverride(item) {
    const explicit = normalizeText(item?.manual_override);
    if (explicit) return explicit;
    return isManualStoreOrigin(item?.origin) ? normalizeText(item?.target_text) : "";
  }

  function storeItemMachineText(item) {
    const explicit = normalizeText(item?.machine_text);
    if (explicit) return explicit;
    return isManualStoreOrigin(item?.origin) ? "" : normalizeText(item?.target_text);
  }

  function storeItemEffectiveTarget(item) {
    return storeItemManualOverride(item) || storeItemMachineText(item) || normalizeText(item?.target_text);
  }

  function rowTargetText(row) {
    return normalizeText(row?.override) || normalizeText(row?.cached);
  }

  function normalizeRowOrigin(row) {
    if (normalizeText(row?.override)) return "manual";
    const status = normalizeText(row?.status);
    if (status === "content_translation") return "content";
    const origin = normalizeText(row?.origin || row?.cache_meta?.origin);
    if (origin === "manual_override") return "manual";
    if (rowTargetText(row)) return origin || "machine";
    return "";
  }

  function deriveFreshnessState(row) {
    if (!normalizeText(row?.source)) return "extra";
    if (!rowTargetText(row)) return "missing";
    const cachedSourceHash = normalizeText(row?.cached_source_hash);
    const expectedSourceHash = normalizeText(row?.source_hash);
    if (!cachedSourceHash) return "legacy";
    if (expectedSourceHash && cachedSourceHash !== expectedSourceHash) return "stale";
    return "current";
  }

  function deriveReviewState(row, origin, freshnessState) {
    if (freshnessState === "missing") return "needs_translation";
    if (freshnessState === "stale" || freshnessState === "legacy") return "needs_update";
    if (origin === "manual") return "protected";
    if (!rowTargetText(row)) return "needs_translation";
    return "reviewed";
  }

  async function readPublishedIndex() {
    return { manifest: {}, rows: new Map() };
  }

  async function readTranslationStoreManifest() {
    return readJsonFile(path.join(translationsSnapshotDir, "manifest.json"), {});
  }

  function sectionMatches(config, language, section) {
    return normalizeText(section?.domain).toLowerCase() === config.id
      && normalizeText(section?.subsection).toLowerCase() === normalizeText(config.subsection)
      && normalizeText(section?.source_lang).toLowerCase() === configSourceLang(config)
      && normalizeText(section?.target_lang).toLowerCase() === language.code;
  }

  async function readTranslationStoreSection(config, language) {
    const { data: manifest } = await readTranslationStoreManifest();
    const section = (Array.isArray(manifest?.sections) ? manifest.sections : [])
      .find((entry) => sectionMatches(config, language, entry)) || null;
    const relativeFile = normalizeText(section?.file) || snapshotRelativeFile(config, language.code);
    const { data, raw } = await readJsonFile(path.join(translationsSnapshotDir, relativeFile), {});
    return {
      manifest,
      section,
      relativeFile,
      raw,
      items: Array.isArray(data?.items) ? data.items : []
    };
  }

  function sourceSetHashForItems(items) {
    return sha256(JSON.stringify(items.map((item) => ({
      source_ref: item.source_ref,
      source_hash: item.source_hash,
      target_lang: item.target_lang,
      target_hash: item.target_hash
    }))));
  }

  function storeSectionDescriptor(config, language, relativeFile, itemCount) {
    return {
      domain: config.id,
      label: config.label,
      section: config.section,
      subsection: config.subsection,
      audience: config.audience,
      source_lang: configSourceLang(config),
      target_lang: language.code,
      item_count: Number(itemCount || 0),
      file: relativeFile
    };
  }

  async function writeTranslationStoreSection(config, language, rows) {
    const timestamp = nowIso();
    const relativeFile = snapshotRelativeFile(config, language.code);
    const items = (Array.isArray(rows) ? rows : [])
      .filter((row) => normalizeText(row?.source) && normalizeText(row?.key))
      .map((row) => snapshotItem(config, language, row, timestamp));
    const sourceSetHash = sourceSetHashForItems(items);
    const sectionPath = translationStorePath(config, language);
    await writeJsonAtomic(sectionPath, {
      schema: TRANSLATION_SNAPSHOT_SCHEMA,
      schema_version: 1,
      generated_at: timestamp,
      source_set_hash: sourceSetHash,
      domain: config.id,
      label: config.label,
      section: config.section,
      subsection: config.subsection,
      audience: config.audience,
      source_lang: configSourceLang(config),
      target_lang: language.code,
      item_count: items.length,
      items
    });

    const { data: manifest } = await readTranslationStoreManifest();
    const sections = (Array.isArray(manifest?.sections) ? manifest.sections : [])
      .filter((section) => !sectionMatches(config, language, section));
    sections.push(storeSectionDescriptor(config, language, relativeFile, items.length));
    sections.sort((left, right) => (
      `${normalizeText(left.section)}|${normalizeText(left.subsection)}|${normalizeText(left.target_lang)}`
        .localeCompare(`${normalizeText(right.section)}|${normalizeText(right.subsection)}|${normalizeText(right.target_lang)}`, "en")
    ));
    const nextManifest = {
      schema: TRANSLATION_SNAPSHOT_SCHEMA,
      schema_version: 1,
      generated_at: timestamp,
      source_set_hash: sourceSetHashForItems(sections.map((section) => ({
        source_ref: `${section.domain}:${section.subsection}`,
        source_hash: "",
        target_lang: section.target_lang,
        target_hash: `${section.file}:${section.item_count}`
      }))),
      staff_languages: Array.from(new Set(sections.filter((section) => section.section === "staff").map((section) => section.target_lang))).sort(),
      customer_languages: Array.from(new Set(sections.filter((section) => section.section === "customers").map((section) => section.target_lang))).sort(),
      items_count: sections.reduce((total, section) => total + Number(section.item_count || 0), 0),
      total_items: sections.reduce((total, section) => total + Number(section.item_count || 0), 0),
      sections
    };
    await writeJsonAtomic(path.join(translationsSnapshotDir, "manifest.json"), nextManifest);
    return nextManifest;
  }

  function augmentRow(config, language, row, publishedIndex = null) {
    const scope = translationScope(config);
    const targetText = rowTargetText(row);
    const next = {
      ...row,
      source_ref: sourceRef(config, row.key),
      source_lang: configSourceLang(config),
      target_lang: language.code,
      section: scope.section,
      subsection: scope.subsection,
      audience: scope.audience,
      required: Boolean(normalizeText(row.source)) && row.status !== "extra",
      effective_target: targetText
    };
    next.cache_origin = normalizeText(row.origin || row.cache_meta?.origin);
    next.origin = normalizeRowOrigin(next);
    next.freshness_state = deriveFreshnessState(next);
    next.job_state = "idle";
    next.review_state = deriveReviewState(next, next.origin, next.freshness_state);

    if (!scope.publishable || !next.required) {
      next.publish_state = "not_publishable";
    } else if (!targetText) {
      next.publish_state = "untranslated";
    } else {
      next.publish_state = next.freshness_state === "current" ? "published" : "unpublished";
      next.published_at = "";
    }

    next.dirty = next.required && (
      next.freshness_state !== "current"
      || next.publish_state === "untranslated"
      || next.review_state === "needs_translation"
      || next.review_state === "needs_update"
    );
    return next;
  }

  async function augmentRows(config, language, rows, publishedIndex = null) {
    const resolvedPublishedIndex = publishedIndex || await readPublishedIndex();
    return rows.map((row) => augmentRow(config, language, row, resolvedPublishedIndex));
  }

  function countRows(rows) {
    return rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      for (const field of ["origin", "freshness_state", "publish_state", "job_state", "review_state"]) {
        const value = normalizeText(row?.[field]);
        if (value) acc[`${field}.${value}`] = (acc[`${field}.${value}`] || 0) + 1;
      }
      if (row.dirty) acc.dirty = (acc.dirty || 0) + 1;
      if (row.publish_state === "unpublished") {
        acc.translated_unpublished = (acc.translated_unpublished || 0) + 1;
      }
      return acc;
    }, {});
  }

  function rowFromStoreItem(config, language, sourceRow, item) {
    const source = sourceRow?.source ?? String(item?.source_text ?? "");
    const expectedSourceHash = sourceRow?.source_hash || sourceHash(source);
    const manualOverride = storeItemManualOverride(item);
    const machineText = storeItemMachineText(item);
    const origin = manualOverride
      ? "manual_override"
      : normalizeText(item?.origin || item?.cache_meta?.origin) || (machineText ? "machine" : "");
    const cachedSourceHash = normalizeText(item?.source_hash);
    return {
      key: normalizeText(sourceRow?.key || item?.key),
      source,
      cached: machineText,
      override: manualOverride,
      status: rowStatus({
        sourceValue: source,
        cachedValue: machineText,
        overrideValue: manualOverride,
        metaEntry: { source_hash: cachedSourceHash, origin },
        expectedSourceHash,
        isExtra: !sourceRow
      }),
      source_hash: expectedSourceHash,
      cached_source_hash: cachedSourceHash,
      origin,
      updated_at: normalizeText(item?.updated_at || item?.published_at || item?.generated_at),
      cache_meta: {
        ...(item?.cache_meta && typeof item.cache_meta === "object" && !Array.isArray(item.cache_meta) ? item.cache_meta : {}),
        source_hash: cachedSourceHash,
        target_hash: normalizeText(item?.target_hash),
        provider: item?.provider || item?.cache_meta?.provider || null
      }
    };
  }

  async function rowsFromTranslationStore(config, language, sourceRows, legacyRows = [], { publishedIndex = null } = {}) {
    const store = await readTranslationStoreSection(config, language);
    const storeItemsByKey = new Map();
    for (const item of store.items) {
      const key = normalizeText(item?.key);
      if (key && !storeItemsByKey.has(key)) storeItemsByKey.set(key, item);
    }
    const legacyRowsByKey = new Map((Array.isArray(legacyRows) ? legacyRows : [])
      .filter((row) => normalizeText(row?.key))
      .map((row) => [normalizeText(row.key), row]));
    const sourceRowsByKey = new Map((Array.isArray(sourceRows) ? sourceRows : [])
      .filter((row) => normalizeText(row?.key))
      .map((row) => [normalizeText(row.key), row]));

    const rows = [];
    for (const sourceRow of sourceRowsByKey.values()) {
      const key = normalizeText(sourceRow.key);
      const item = storeItemsByKey.get(key);
      if (item) {
        rows.push(rowFromStoreItem(config, language, sourceRow, item));
        continue;
      }
      const legacy = legacyRowsByKey.get(key);
      rows.push(legacy || {
        key,
        source: sourceRow.source,
        cached: "",
        override: "",
        status: "missing",
        source_hash: sourceRow.source_hash,
        cached_source_hash: "",
        origin: "",
        updated_at: "",
        cache_meta: {}
      });
    }

    for (const [key, item] of storeItemsByKey.entries()) {
      if (sourceRowsByKey.has(key)) continue;
      rows.push(rowFromStoreItem(config, language, null, item));
    }
    for (const [key, legacy] of legacyRowsByKey.entries()) {
      if (sourceRowsByKey.has(key) || storeItemsByKey.has(key)) continue;
      rows.push({ ...legacy, status: "extra" });
    }

    const augmentedRows = await augmentRows(config, language, rows, publishedIndex);
    const counts = countRows(augmentedRows);
    return {
      revision: sha256(store.raw || JSON.stringify(store.items || [])),
      rows: augmentedRows,
      counts
    };
  }

  function rowStatus({ sourceValue, cachedValue, overrideValue, metaEntry, expectedSourceHash, isExtra }) {
    if (isExtra) return "extra";
    if (normalizeText(overrideValue)) return "manual_override";
    if (!normalizeText(cachedValue)) return "missing";
    const actualSourceHash = normalizeText(metaEntry?.source_hash);
    if (actualSourceHash && actualSourceHash !== expectedSourceHash) return "stale";
    if (!actualSourceHash && normalizeText(sourceValue)) return "legacy";
    return normalizeText(metaEntry?.origin) || "machine";
  }

  function localizedSource(value, fallback = "") {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return normalizeText(value.en) || normalizeText(fallback);
    }
    return normalizeText(fallback || value);
  }

  function addSourceText(targetSet, value) {
    const normalized = normalizeText(value);
    if (normalized) targetSet.add(normalized);
  }

  function collectMarketingTourMemorySourcesFromPlan(targetSet, travelPlan) {
    const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
    for (const day of days) {
      addSourceText(targetSet, localizedSource(day?.title_i18n, day?.title));
      addSourceText(targetSet, localizedSource(day?.overnight_location_i18n, day?.overnight_location));
      addSourceText(targetSet, localizedSource(day?.notes_i18n, day?.notes));
      const services = Array.isArray(day?.services) ? day.services : [];
      for (const service of services) {
        addSourceText(targetSet, localizedSource(service?.time_label_i18n, service?.time_label));
        addSourceText(targetSet, localizedSource(service?.title_i18n, service?.title));
        addSourceText(targetSet, localizedSource(service?.details_i18n, service?.details));
        addSourceText(targetSet, localizedSource(service?.location_i18n, service?.location));
        addSourceText(targetSet, localizedSource(service?.image_subtitle_i18n, service?.image_subtitle));
        const images = [
          service?.image,
          ...(Array.isArray(service?.images) ? service.images : [])
        ].filter((image) => image && typeof image === "object" && !Array.isArray(image));
        for (const image of images) {
          addSourceText(targetSet, localizedSource(image?.caption_i18n, image?.caption));
          addSourceText(targetSet, localizedSource(image?.alt_text_i18n, image?.alt_text));
        }
      }
    }
  }

  function collectMarketingTourMemorySources(tours) {
    const sources = new Set();
    for (const tour of Array.isArray(tours) ? tours : []) {
      addSourceText(sources, localizedSource(tour?.title, tour?.id));
      addSourceText(sources, localizedSource(tour?.short_description, ""));
      collectMarketingTourMemorySourcesFromPlan(sources, tour?.travel_plan);
    }
    return Array.from(sources).sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
  }

  function cloneJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeLocalizedTextMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([lang, text]) => [normalizeText(lang).toLowerCase(), normalizeText(text)])
        .filter(([lang, text]) => Boolean(lang && text))
    );
  }

  function setLocalizedTextValue(record, mapField, lang, value) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    const normalizedLang = normalizeText(lang).toLowerCase();
    const normalizedValue = normalizeText(value);
    if (!normalizedLang || !normalizedValue) return false;
    const map = normalizeLocalizedTextMap(record[mapField]);
    if (normalizeText(map[normalizedLang]) === normalizedValue) return false;
    map[normalizedLang] = normalizedValue;
    record[mapField] = map;
    return true;
  }

  function deleteLocalizedTextValue(record, mapField, lang) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    const normalizedLang = normalizeText(lang).toLowerCase();
    if (!normalizedLang) return false;
    const map = normalizeLocalizedTextMap(record[mapField]);
    if (!Object.prototype.hasOwnProperty.call(map, normalizedLang)) return false;
    delete map[normalizedLang];
    record[mapField] = map;
    return true;
  }

  function destinationRecordSource(record, sourceField, fallback = "") {
    return normalizeText(record?.[sourceField]) || normalizeText(fallback);
  }

  function destinationScopeCatalogRecordEntries(store = {}) {
    const destinationEntries = (Array.isArray(store?.destination_scope_destinations) ? store.destination_scope_destinations : [])
      .map((record) => {
        const code = normalizeDestinationCountryCode(record?.code || record?.destination || record);
        return {
          record,
          kind: "destination",
          mapField: "label_i18n",
          sourceField: "label",
          sourceFallback: code || "",
          key: code ? `destination.${code}.label` : ""
        };
      });
    const areaEntries = (Array.isArray(store?.destination_areas) ? store.destination_areas : [])
      .map((record) => ({
        record,
        kind: "area",
        mapField: "name_i18n",
        sourceField: "name",
        sourceFallback: "",
        key: `area.${normalizeText(record?.id)}.name`
      }));
    const placeEntries = (Array.isArray(store?.destination_places) ? store.destination_places : [])
      .map((record) => ({
        record,
        kind: "place",
        mapField: "name_i18n",
        sourceField: "name",
        sourceFallback: "",
        key: `place.${normalizeText(record?.id)}.name`
      }));

    return [...destinationEntries, ...areaEntries, ...placeEntries]
      .filter((entry) => (
        entry.record
        && typeof entry.record === "object"
        && !Array.isArray(entry.record)
        && normalizeText(entry.key)
        && destinationRecordSource(entry.record, entry.sourceField, entry.sourceFallback)
      ));
  }

  function sortedSourceTexts(sources) {
    return Array.from(sources).sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
  }

  async function collectIndexContentMemorySources(config) {
    const sources = new Set();
    const { data: frontendSource } = await readJsonFile(configs.frontend.sourcePath(), {});
    for (const value of Object.values(frontendSource || {})) {
      addSourceText(sources, value);
    }
    return sortedSourceTexts(sources);
  }

  function configSourceLang(config) {
    return normalizeText(config?.sourceLang) || "en";
  }

  async function collectTranslationMemorySources(config) {
    if (config.id === "index-content-memory") {
      return collectIndexContentMemorySources(config);
    }
    if (config.id === "marketing-tour-memory") {
      if (typeof readTours !== "function") {
        throw apiError(500, "STATIC_TRANSLATION_MEMORY_UNAVAILABLE", "Marketing tour translation memory storage is not configured.");
      }
      return collectMarketingTourMemorySources(await readTours());
    }
    return [];
  }

  async function loadTranslationMemoryState(config, language, { publishedIndex = null } = {}) {
    const sourceTexts = await collectTranslationMemorySources(config);
    const sourceRows = sourceTexts.map((source) => ({
      key: sourceKey(source),
      source,
      source_hash: sourceKey(source)
    }));
    let memory = { items: {}, revision: "" };
    if (translationMemoryStore && typeof translationMemoryStore.readTranslationMemory === "function") {
      memory = await translationMemoryStore.readTranslationMemory();
    }
    const legacyRows = sourceRows
      .map(({ key, source }) => {
        const target = memory.items?.[key]?.targets?.[language.code] || {};
        const cached = normalizeText(target.machine);
        const override = normalizeText(target.manual_override);
        const status = override ? "manual_override" : (cached ? "machine" : "missing");
        return {
          key,
          source,
          cached,
          override,
          status,
          source_hash: key,
          cached_source_hash: key,
          origin: status === "manual_override" ? "manual_override" : (cached ? "machine" : ""),
          updated_at: normalizeText(target.manual_updated_at || target.machine_updated_at),
          cache_meta: {
            source_hash: key,
            machine_updated_at: normalizeText(target.machine_updated_at) || null,
            manual_updated_at: normalizeText(target.manual_updated_at) || null,
            provider: target.provider || null
          }
        };
      })
      .sort((left, right) => left.source.localeCompare(right.source, "en", { sensitivity: "base" }));
    const storeState = await rowsFromTranslationStore(config, language, sourceRows, legacyRows, { publishedIndex });
    return {
      domain: domainSummary(config),
      language,
      source_lang: config.sourceLang,
      target_lang: language.code,
      revision: storeState.revision || memory.revision,
      total: storeState.rows.length,
      counts: storeState.counts,
      rows: storeState.rows
    };
  }

  async function readDestinationScopeStore() {
    if (typeof readStore !== "function") {
      throw apiError(
        500,
        "STATIC_TRANSLATION_DESTINATION_CATALOG_UNAVAILABLE",
        "Destination-scope catalog storage is not configured."
      );
    }
    return readStore();
  }

  async function readTranslationMemoryOrEmpty() {
    if (!translationMemoryStore || typeof translationMemoryStore.readTranslationMemory !== "function") {
      return {
        items: {},
        revision: ""
      };
    }
    return translationMemoryStore.readTranslationMemory();
  }

  function destinationCatalogStateRevision(rows, memoryRevision) {
    return sha256(JSON.stringify({
      memoryRevision: normalizeText(memoryRevision),
      rows: (Array.isArray(rows) ? rows : []).map((row) => ({
        key: row.key,
        source: row.source,
        cached: row.cached,
        override: row.override,
        updated_at: row.updated_at
      }))
    }));
  }

  async function loadDestinationScopeCatalogState(config, language, { publishedIndex = null } = {}) {
    const [store, memory] = await Promise.all([
      readDestinationScopeStore(),
      readTranslationMemoryOrEmpty()
    ]);
    const legacyRows = destinationScopeCatalogRecordEntries(store)
      .map((entry) => {
        const source = destinationRecordSource(entry.record, entry.sourceField, entry.sourceFallback);
        const map = normalizeLocalizedTextMap(entry.record[entry.mapField]);
        const directTarget = normalizeText(map[language.code]);
        const target = memory.items?.[sourceKey(source)]?.targets?.[language.code] || {};
        const override = normalizeText(target.manual_override);
        const cached = override ? "" : directTarget;
        const expectedSourceHash = sourceHash(source);
        const status = override ? "manual_override" : (cached ? "content_translation" : "missing");
        return {
          key: entry.key,
          source,
          cached,
          override,
          status,
          source_hash: expectedSourceHash,
          cached_source_hash: (cached || override) ? expectedSourceHash : "",
          origin: override ? "manual_override" : (cached ? "content" : ""),
          updated_at: normalizeText(target.manual_updated_at || entry.record?.updated_at),
          cache_meta: {
            source_hash: expectedSourceHash,
            catalog_kind: entry.kind,
            map_field: entry.mapField,
            direct_target: directTarget || null,
            manual_updated_at: normalizeText(target.manual_updated_at) || null
          }
        };
      })
      .sort((left, right) => left.source.localeCompare(right.source, "en", { sensitivity: "base" }));

    const sourceRows = legacyRows.map((row) => ({
      key: row.key,
      source: row.source,
      source_hash: row.source_hash
    }));
    const storeState = await rowsFromTranslationStore(config, language, sourceRows, legacyRows, { publishedIndex });
    return {
      domain: domainSummary(config),
      language,
      source_lang: config.sourceLang,
      target_lang: language.code,
      revision: storeState.revision || destinationCatalogStateRevision(storeState.rows, memory.revision),
      total: storeState.rows.length,
      counts: storeState.counts,
      rows: storeState.rows
    };
  }

  async function loadState(domain, targetLang, { publishedIndex = null } = {}) {
    const { config, language } = getLanguageConfig(domain, targetLang);
    if (config.kind === "translation_memory") {
      return loadTranslationMemoryState(config, language, { publishedIndex });
    }
    if (config.kind === "destination_scope_catalog") {
      return loadDestinationScopeCatalogState(config, language, { publishedIndex });
    }

    const [{ data: source }, { data: target }, { data: meta }, { data: overrides, raw: overrideRaw }] = await Promise.all([
      readJsonFile(config.sourcePath(), {}),
      readJsonFile(config.targetPath(language.code), {}),
      readJsonFile(config.metaPath(language.code), {}),
      readJsonFile(config.overridePath(language.code), {})
    ]);

    const sourceKeys = Object.keys(source || {});
    const sourceRows = sourceKeys.map((key) => ({
      key,
      source: String(source[key] ?? ""),
      source_hash: sourceHash(String(source[key] ?? ""))
    }));
    const legacyRows = sourceKeys.map((key) => {
      const sourceValue = String(source[key] ?? "");
      const expectedSourceHash = sourceHash(sourceValue);
      const metaEntry = meta?.[key] && typeof meta[key] === "object" ? meta[key] : {};
      const cachedValue = String(target?.[key] ?? "");
      const overrideValue = String(overrides?.[key] ?? "");
      return {
        key,
        source: sourceValue,
        cached: cachedValue,
        override: overrideValue,
        status: rowStatus({
          sourceValue,
          cachedValue,
          overrideValue,
          metaEntry,
          expectedSourceHash,
          isExtra: false
        }),
        source_hash: expectedSourceHash,
        cached_source_hash: normalizeText(metaEntry?.source_hash),
        origin: normalizeText(metaEntry?.origin),
        updated_at: normalizeText(metaEntry?.updated_at),
        cache_meta: metaEntry
      };
    });

    const extraKeys = new Set([
      ...Object.keys(target || {}),
      ...Object.keys(meta || {}),
      ...Object.keys(overrides || {})
    ]);
    for (const key of sourceKeys) extraKeys.delete(key);
    for (const key of Array.from(extraKeys).sort()) {
      const metaEntry = meta?.[key] && typeof meta[key] === "object" ? meta[key] : {};
      legacyRows.push({
        key,
        source: "",
        cached: String(target?.[key] ?? ""),
        override: String(overrides?.[key] ?? ""),
        status: "extra",
        source_hash: "",
        cached_source_hash: normalizeText(metaEntry?.source_hash),
        origin: normalizeText(metaEntry?.origin),
        updated_at: normalizeText(metaEntry?.updated_at),
        cache_meta: metaEntry
      });
    }

    const storeState = await rowsFromTranslationStore(config, language, sourceRows, legacyRows, { publishedIndex });

    return {
      domain: domainSummary(config),
      language,
      source_lang: config.sourceLang,
      target_lang: language.code,
      revision: storeState.revision || sha256(overrideRaw),
      total: storeState.rows.length,
      counts: storeState.counts,
      rows: storeState.rows
    };
  }

  async function writeJsonAtomic(filePath, data) {
    await mkdirFn(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFileFn(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await renameFn(tempPath, filePath);
  }

  async function patchTranslationStoreOverrides(config, language, payload = {}) {
    const expectedRevision = normalizeText(payload?.expected_revision);
    const updates = payload?.overrides && typeof payload.overrides === "object" && !Array.isArray(payload.overrides)
      ? payload.overrides
      : null;
    if (!updates) {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_OVERRIDES", "overrides must be an object keyed by translation id.");
    }

    const currentState = await loadState(config.id, language.code);
    if (expectedRevision && expectedRevision !== currentState.revision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Translations changed. Refresh and retry.");
    }
    const rowsByKey = new Map(currentState.rows.map((row) => [row.key, { ...row }]));
    const unknownKeys = Object.keys(updates).filter((key) => !rowsByKey.has(key) || !rowsByKey.get(key)?.source);
    if (unknownKeys.length) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${unknownKeys[0]}`);
    }

    for (const [key, rawValue] of Object.entries(updates)) {
      const row = rowsByKey.get(key);
      const value = normalizeText(rawValue);
      row.override = value;
      row.origin = value ? "manual_override" : normalizeText(row.cache_origin || row.cache_meta?.origin || row.origin);
      row.updated_at = nowIso();
    }

    await writeTranslationStoreSection(config, language, Array.from(rowsByKey.values()));
    return loadState(config.id, language.code);
  }

  async function deleteTranslationStoreCache(config, language, key, payload = {}) {
    const currentState = await loadState(config.id, language.code);
    const expectedRevision = normalizeText(payload?.expected_revision);
    if (expectedRevision && expectedRevision !== currentState.revision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Translations changed. Refresh and retry.");
    }
    const rows = currentState.rows.map((row) => ({ ...row }));
    const row = rows.find((entry) => entry.key === key);
    if (!row || !row.source) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${key}`);
    }
    row.cached = "";
    row.origin = normalizeText(row.override) ? "manual_override" : "";
    row.updated_at = nowIso();
    row.cache_meta = {
      ...(row.cache_meta && typeof row.cache_meta === "object" && !Array.isArray(row.cache_meta) ? row.cache_meta : {}),
      provider: null
    };
    await writeTranslationStoreSection(config, language, rows);
    return loadState(config.id, language.code);
  }

  async function patchTranslationMemoryOverrides(config, language, payload = {}) {
    if (!translationMemoryStore || typeof translationMemoryStore.patchManualOverrides !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_MEMORY_UNAVAILABLE", "Translation memory storage is not configured.");
    }
    const expectedRevision = normalizeText(payload?.expected_revision);
    const updates = payload?.overrides && typeof payload.overrides === "object" && !Array.isArray(payload.overrides)
      ? payload.overrides
      : null;
    if (!updates) {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_OVERRIDES", "overrides must be an object keyed by translation id.");
    }

    const currentState = await loadTranslationMemoryState(config, language);
    const rowsByKey = new Map(currentState.rows.map((row) => [row.key, row]));
    const unknownKeys = Object.keys(updates).filter((key) => !rowsByKey.has(key));
    if (unknownKeys.length) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${unknownKeys[0]}`);
    }

    try {
      await translationMemoryStore.patchManualOverrides(
        language.code,
        Object.entries(updates).map(([key, value]) => ({
          source_text: rowsByKey.get(key)?.source,
          manual_override: value
        })),
        { expectedRevision }
      );
    } catch (error) {
      if (error?.status) throw error;
      throw apiError(500, "STATIC_TRANSLATION_MEMORY_SAVE_FAILED", String(error?.message || error || "Could not save translation memory."));
    }
    return loadTranslationMemoryState(config, language);
  }

  async function persistDestinationScopeCatalogTargets(targetLang, updatesByKey, { remove = false } = {}) {
    if (typeof persistStore !== "function") {
      throw apiError(
        500,
        "STATIC_TRANSLATION_DESTINATION_CATALOG_UNAVAILABLE",
        "Destination-scope catalog storage is not writable."
      );
    }
    const store = cloneJson(await readDestinationScopeStore());
    const recordsByKey = new Map(destinationScopeCatalogRecordEntries(store).map((entry) => [entry.key, entry]));
    let changed = false;
    for (const [key, value] of Object.entries(updatesByKey || {})) {
      const entry = recordsByKey.get(key);
      if (!entry) continue;
      const recordChanged = remove
        ? deleteLocalizedTextValue(entry.record, entry.mapField, targetLang)
        : setLocalizedTextValue(entry.record, entry.mapField, targetLang, value);
      if (recordChanged) {
        entry.record.updated_at = normalizeText(entry.record.updated_at) || nowIso();
      }
      changed = recordChanged || changed;
    }
    if (changed) await persistStore(store);
    return changed;
  }

  async function patchDestinationScopeCatalogOverrides(config, language, payload = {}) {
    const expectedRevision = normalizeText(payload?.expected_revision);
    const updates = payload?.overrides && typeof payload.overrides === "object" && !Array.isArray(payload.overrides)
      ? payload.overrides
      : null;
    if (!updates) {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_OVERRIDES", "overrides must be an object keyed by translation id.");
    }

    const currentState = await loadDestinationScopeCatalogState(config, language);
    if (expectedRevision && expectedRevision !== currentState.revision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Translation overrides changed. Refresh and retry.");
    }
    const rowsByKey = new Map(currentState.rows.map((row) => [row.key, row]));
    const unknownKeys = Object.keys(updates).filter((key) => !rowsByKey.has(key));
    if (unknownKeys.length) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${unknownKeys[0]}`);
    }

    if (!translationMemoryStore || typeof translationMemoryStore.patchManualOverrides !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_MEMORY_UNAVAILABLE", "Translation memory storage is not configured.");
    }

    const memoryUpdates = [];
    const catalogUpdates = {};
    for (const [key, rawValue] of Object.entries(updates)) {
      const row = rowsByKey.get(key);
      const value = normalizeText(rawValue);
      memoryUpdates.push({
        source_text: row.source,
        manual_override: value
      });
      if (value) catalogUpdates[key] = value;
    }

    await translationMemoryStore.patchManualOverrides(language.code, memoryUpdates);
    if (Object.keys(catalogUpdates).length) {
      await persistDestinationScopeCatalogTargets(language.code, catalogUpdates);
    }
    return loadDestinationScopeCatalogState(config, language);
  }

  async function deleteTranslationMemoryCache(config, language, key, payload = {}) {
    if (!translationMemoryStore || typeof translationMemoryStore.deleteMachineTranslations !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_MEMORY_UNAVAILABLE", "Translation memory storage is not configured.");
    }
    const currentState = await loadTranslationMemoryState(config, language);
    const expectedRevision = normalizeText(payload?.expected_revision);
    if (expectedRevision && expectedRevision !== currentState.revision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Translation memory changed. Refresh and retry.");
    }
    const row = currentState.rows.find((entry) => entry.key === key);
    if (!row) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${key}`);
    }
    if (row.cached) {
      await translationMemoryStore.deleteMachineTranslations(language.code, [row.source]);
    }
    return loadTranslationMemoryState(config, language);
  }

  async function deleteDestinationScopeCatalogCache(config, language, key, payload = {}) {
    const currentState = await loadDestinationScopeCatalogState(config, language);
    const expectedRevision = normalizeText(payload?.expected_revision);
    if (expectedRevision && expectedRevision !== currentState.revision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Translation memory changed. Refresh and retry.");
    }
    const row = currentState.rows.find((entry) => entry.key === key);
    if (!row) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${key}`);
    }
    if (row.cached) {
      await persistDestinationScopeCatalogTargets(language.code, { [row.key]: "" }, { remove: true });
    }
    return loadDestinationScopeCatalogState(config, language);
  }

  async function deleteStaticCache(config, language, key) {
    const [{ data: source }, { data: target }, { data: meta }] = await Promise.all([
      readJsonFile(config.sourcePath(), {}),
      readJsonFile(config.targetPath(language.code), {}),
      readJsonFile(config.metaPath(language.code), {})
    ]);
    if (
      !Object.prototype.hasOwnProperty.call(source || {}, key)
      && !Object.prototype.hasOwnProperty.call(target || {}, key)
      && !Object.prototype.hasOwnProperty.call(meta || {}, key)
    ) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${key}`);
    }

    const nextTarget = { ...(target || {}) };
    delete nextTarget[key];
    await writeJsonAtomic(config.targetPath(language.code), sortObjectBySource(source, nextTarget));
    return loadState(config.id, language.code);
  }

  async function deleteCache(domain, targetLang, key, payload = {}) {
    assertWritesEnabled();
    const { config, language } = getLanguageConfig(domain, targetLang);
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) {
      throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", "Translation key is required.");
    }
    return deleteTranslationStoreCache(config, language, normalizedKey, payload);
  }

  async function patchOverrides(domain, targetLang, payload = {}) {
    assertWritesEnabled();
    const { config, language } = getLanguageConfig(domain, targetLang);
    return patchTranslationStoreOverrides(config, language, payload);
  }

  function translationProfileForConfig(config) {
    if (config.id === "destination-scope-catalog") return "destination_scope_catalog";
    if (config.id === "backend") return "staff_backend_ui";
    return "marketing_trip_copy";
  }

  function rowsNeedingMachineTranslation(rows) {
    return (Array.isArray(rows) ? rows : []).filter((row) => (
      row?.required
      && row.origin !== "manual"
      && (
        row.freshness_state === "missing"
        || row.freshness_state === "stale"
        || row.freshness_state === "legacy"
        || row.publish_state === "untranslated"
        || row.review_state === "needs_translation"
        || row.review_state === "needs_update"
      )
    ));
  }

  async function loadTranslationRulesForApply(options = {}) {
    if (Array.isArray(options.translationRules)) return options.translationRules;
    if (typeof readTranslationRules !== "function") return [];
    const rules = await readTranslationRules();
    return Array.isArray(rules?.items) ? rules.items : [];
  }

  async function translateCentralRows(config, language, rows, options = {}) {
    const candidates = rowsNeedingMachineTranslation(rows);
    if (!candidates.length) {
      return {
        requested_count: 0,
        translated_count: 0
      };
    }

    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const onChunkStart = typeof options.onChunkStart === "function" ? options.onChunkStart : null;
    const reportProgress = (current) => {
      if (!onProgress) return;
      onProgress({
        domain: config.id,
        target_lang: language.code,
        current: Math.max(0, Math.min(candidates.length, Number(current) || 0)),
        total: candidates.length
      });
    };
    const translate = typeof options.translateEntriesWithMeta === "function"
      ? options.translateEntriesWithMeta
      : translateEntriesWithMeta;
    if (typeof translate !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_PROVIDER_UNAVAILABLE", "Static translation provider is not configured.");
    }

    const entries = Object.fromEntries(candidates.map((row) => [row.key, row.source]));
    reportProgress(0);
    const result = await translate(entries, language.code, {
      sourceLangCode: configSourceLang(config),
      domain: config.label,
      context: config.context,
      cacheNamespace: `static-translations:${config.id}`,
      translationProfile: translationProfileForConfig(config),
      translationRules: await loadTranslationRulesForApply(options),
      allowGoogleFallback: true,
      onEntryComplete(entry) {
        reportProgress(Number(entry?.completedEntries || 0));
      },
      onChunkStart(chunk) {
        reportProgress(Number(chunk?.startIndex || 0) + (Array.isArray(chunk?.keys) ? chunk.keys.length : 0));
        if (onChunkStart) {
          onChunkStart({
            ...chunk,
            domain: config.id,
            target_lang: language.code
          });
        }
      }
    });
    const translatedEntries = Object.fromEntries(
      Object.entries(result?.entries || {})
        .map(([key, value]) => [key, normalizeText(value)])
        .filter(([key, value]) => Boolean(key && value))
    );

    const nextRows = rows.map((row) => {
      if (!Object.prototype.hasOwnProperty.call(translatedEntries, row.key)) return row;
      return {
        ...row,
        cached: translatedEntries[row.key],
        origin: "machine",
        updated_at: nowIso(),
        cache_meta: {
          ...(row.cache_meta && typeof row.cache_meta === "object" && !Array.isArray(row.cache_meta) ? row.cache_meta : {}),
          source_hash: row.source_hash,
          provider: result?.provider || null
        }
      };
    });
    await writeTranslationStoreSection(config, language, nextRows);

    if (config.kind === "translation_memory") {
      if (!translationMemoryStore || typeof translationMemoryStore.writeMachineTranslations !== "function") {
        reportProgress(candidates.length);
        return {
          requested_count: candidates.length,
          translated_count: Object.keys(translatedEntries).length
        };
      }
      await translationMemoryStore.writeMachineTranslations(entries, translatedEntries, language.code, result?.provider || null);
    }

    reportProgress(candidates.length);
    return {
      requested_count: candidates.length,
      translated_count: Object.keys(translatedEntries).length
    };
  }

  async function translateDestinationScopeCatalogRows(config, language, rows, options = {}) {
    const candidates = rowsNeedingMachineTranslation(rows);
    if (!candidates.length) {
      return {
        requested_count: 0,
        translated_count: 0
      };
    }

    const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
    const onChunkStart = typeof options.onChunkStart === "function" ? options.onChunkStart : null;
    const reportProgress = (current) => {
      if (!onProgress) return;
      onProgress({
        domain: config.id,
        target_lang: language.code,
        current: Math.max(0, Math.min(candidates.length, Number(current) || 0)),
        total: candidates.length
      });
    };
    const translate = typeof options.translateEntriesWithMeta === "function"
      ? options.translateEntriesWithMeta
      : translateEntriesWithMeta;
    if (typeof translate !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_PROVIDER_UNAVAILABLE", "Static translation provider is not configured.");
    }

    const entries = Object.fromEntries(candidates.map((row) => [row.key, row.source]));
    reportProgress(0);
    const result = await translate(entries, language.code, {
      sourceLangCode: configSourceLang(config),
      domain: config.label,
      context: config.context,
      cacheNamespace: `static-translations:${config.id}`,
      translationProfile: translationProfileForConfig(config),
      translationRules: await loadTranslationRulesForApply(options),
      allowGoogleFallback: true,
      onEntryComplete(entry) {
        reportProgress(Number(entry?.completedEntries || 0));
      },
      onChunkStart(chunk) {
        reportProgress(Number(chunk?.startIndex || 0) + (Array.isArray(chunk?.keys) ? chunk.keys.length : 0));
        if (onChunkStart) {
          onChunkStart({
            ...chunk,
            domain: config.id,
            target_lang: language.code
          });
        }
      }
    });
    const translatedEntries = Object.fromEntries(
      Object.entries(result?.entries || {})
        .map(([key, value]) => [key, normalizeText(value)])
        .filter(([key, value]) => Boolean(key && value))
    );
    const nextRows = rows.map((row) => {
      if (!Object.prototype.hasOwnProperty.call(translatedEntries, row.key)) return row;
      return {
        ...row,
        cached: translatedEntries[row.key],
        origin: "machine",
        updated_at: nowIso(),
        cache_meta: {
          ...(row.cache_meta && typeof row.cache_meta === "object" && !Array.isArray(row.cache_meta) ? row.cache_meta : {}),
          source_hash: row.source_hash,
          provider: result?.provider || null
        }
      };
    });
    await writeTranslationStoreSection(config, language, nextRows);

    reportProgress(candidates.length);
    return {
      requested_count: candidates.length,
      translated_count: Object.keys(translatedEntries).length
    };
  }

  async function applyMissingTranslations(options = {}) {
    assertWritesEnabled();
    const applyOptions = {
      ...options,
      translationRules: await loadTranslationRulesForApply(options)
    };
    const summary = {
      requested_count: 0,
      translated_count: 0,
      domains: []
    };

    for (const config of normalizeTranslationDomains(options)) {
      for (const language of publishLanguagesForConfig(config, options)) {
        const state = await loadState(config.id, language.code);
        const result = config.kind === "destination_scope_catalog"
          ? await translateDestinationScopeCatalogRows(config, language, state.rows, applyOptions)
          : await translateCentralRows(config, language, state.rows, applyOptions);
        summary.requested_count += result.requested_count;
        summary.translated_count += result.translated_count;
        summary.domains.push({
          domain: config.id,
          target_lang: language.code,
          requested_count: result.requested_count,
          translated_count: result.translated_count
        });
      }
    }

    return summary;
  }

  async function clearTranslationMemoryCache(config, language) {
    const state = await loadState(config.id, language.code);
    const rows = (state.rows || []).map((row) => ({ ...row }));
    const sourceTexts = rows
      .filter((row) => row?.required && normalizeText(row.cached) && normalizeText(row.source))
      .map((row) => row.source);
    for (const row of rows) {
      if (!row?.required || !normalizeText(row.cached)) continue;
      row.cached = "";
      row.origin = normalizeText(row.override) ? "manual_override" : "";
      row.updated_at = nowIso();
    }
    if (sourceTexts.length) await writeTranslationStoreSection(config, language, rows);
    if (sourceTexts.length && translationMemoryStore && typeof translationMemoryStore.deleteMachineTranslations === "function") {
      await translationMemoryStore.deleteMachineTranslations(language.code, sourceTexts);
    }
    return {
      cleared_count: sourceTexts.length
    };
  }

  async function clearMachineTranslations(options = {}) {
    assertWritesEnabled();
    const summary = {
      cleared_count: 0,
      domains: []
    };

    for (const config of normalizeTranslationDomains(options)) {
      for (const language of publishLanguagesForConfig(config, options)) {
        const result = await clearTranslationMemoryCache(config, language);
        summary.cleared_count += result.cleared_count;
        summary.domains.push({
          domain: config.id,
          target_lang: language.code,
          cleared_count: result.cleared_count
        });
      }
    }

    return summary;
  }

  function normalizePublishDomains(options = {}) {
    const requested = Array.isArray(options?.domains)
      ? options.domains.map((value) => normalizeText(value).toLowerCase()).filter(Boolean)
      : [];
    const requestedSet = new Set(requested);
    return Object.values(configs).filter((config) => {
      if (config.publishable === false) return false;
      return requestedSet.size ? requestedSet.has(config.id) : true;
    });
  }

  function normalizeTranslationDomains(options = {}) {
    const requested = Array.isArray(options?.domains)
      ? options.domains.map((value) => normalizeText(value).toLowerCase()).filter(Boolean)
      : [];
    const requestedSet = new Set(requested);
    return Object.values(configs).filter((config) => {
      return requestedSet.size ? requestedSet.has(config.id) : true;
    });
  }

  function normalizeStatusDomains(options = {}) {
    const domains = new Map();
    for (const config of normalizePublishDomains(options)) {
      domains.set(config.id, config);
    }
    for (const config of normalizeTranslationDomains(options)) {
      domains.set(config.id, config);
    }
    return Array.from(domains.values());
  }

  function isStatusContentUnavailable(error) {
    const code = normalizeText(error?.code);
    return code === "STATIC_TRANSLATION_BOOKING_CONTENT_UNAVAILABLE"
      || code === "STATIC_TRANSLATION_DESTINATION_CATALOG_UNAVAILABLE";
  }

  function publishLanguagesForConfig(config, options = {}) {
    const byDomain = options?.target_langs_by_domain && typeof options.target_langs_by_domain === "object"
      ? options.target_langs_by_domain[config.id]
      : null;
    const requested = Array.isArray(byDomain)
      ? byDomain
      : (Array.isArray(options?.target_langs) ? options.target_langs : []);
    const requestedSet = new Set(requested.map((value) => normalizeText(value).toLowerCase()).filter(Boolean));
    return config.targetLanguages.filter((language) => !requestedSet.size || requestedSet.has(language.code));
  }

  function publishIssue(row) {
    if (!row.required || row.publish_state === "not_publishable") return "";
    if (row.freshness_state === "missing" || !rowTargetText(row)) return "missing_translation";
    if (row.freshness_state === "stale" || row.freshness_state === "legacy") return "stale_translation";
    if (row.freshness_state !== "current") return `invalid_freshness:${row.freshness_state}`;
    if (row.job_state && row.job_state !== "idle") return `job_${row.job_state}`;
    if (row.review_state === "needs_translation" || row.review_state === "needs_update") return row.review_state;
    return "";
  }

  function snapshotItem(config, language, row, publishedAt = "") {
    const targetText = rowTargetText(row);
    const manualOverride = normalizeText(row.override);
    const machineText = normalizeText(row.cached);
    return {
      source_ref: normalizeText(row.source_ref) || sourceRef(config, row.key),
      key: row.key,
      domain: config.id,
      section: row.section,
      subsection: row.subsection,
      audience: row.audience,
      required: row.required,
      source_lang: configSourceLang(config),
      target_lang: language.code,
      source_text: row.source,
      source_hash: row.source_hash,
      target_text: targetText,
      target_hash: sourceHash(targetText),
      machine_text: machineText,
      manual_override: manualOverride,
      origin: row.origin,
      freshness_state: row.freshness_state,
      job_state: row.job_state,
      publish_state: row.publish_state,
      review_state: row.review_state,
      generated_at: normalizeText(publishedAt),
      updated_at: normalizeText(row.updated_at),
      cache_meta: row.cache_meta || {}
    };
  }

  async function publishTranslations(options = {}) {
    assertWritesEnabled();
    const timestamp = nowIso();
    const sections = [];
    const allItems = [];
    const issues = [];

    for (const config of normalizePublishDomains(options)) {
      const languages = publishLanguagesForConfig(config, options);
      for (const language of languages) {
        const state = await loadState(config.id, language.code);
        const rows = state.rows.filter((row) => row.required && row.publish_state !== "not_publishable");
        for (const row of rows) {
          const issue = publishIssue(row);
          if (issue) {
            issues.push({
              domain: config.id,
              target_lang: language.code,
              key: row.key,
              source_ref: row.source_ref,
              issue
            });
          }
        }
        const items = rows.map((row) => snapshotItem(config, language, row, timestamp));
        allItems.push(...items);
        sections.push({
          config,
          language,
          domain: config.id,
          label: config.label,
          section: config.section,
          subsection: config.subsection,
          audience: config.audience,
          source_lang: configSourceLang(config),
          target_lang: language.code,
          item_count: items.length,
          file: snapshotRelativeFile(config, language.code),
          rows,
          items
        });
      }
    }

    if (issues.length) {
      const error = apiError(
        409,
        "STATIC_TRANSLATION_PUBLISH_BLOCKED",
        `Runtime generation blocked by ${issues.length} translation issue${issues.length === 1 ? "" : "s"}.`
      );
      error.details = issues.slice(0, 200);
      throw error;
    }

    let manifest = null;
    for (const section of sections) {
      manifest = await writeTranslationStoreSection(section.config, section.language, section.rows);
    }
    return manifest || {
      schema: TRANSLATION_SNAPSHOT_SCHEMA,
      schema_version: 1,
      generated_at: timestamp,
      source_set_hash: sourceSetHashForItems(allItems),
      staff_languages: Array.from(new Set(sections.filter((section) => section.section === "staff").map((section) => section.target_lang))).sort(),
      customer_languages: Array.from(new Set(sections.filter((section) => section.section === "customers").map((section) => section.target_lang))).sort(),
      items_count: allItems.length,
      total_items: allItems.length,
      sections: sections.map(({ config, language, rows, items, ...section }) => section)
    };
  }

  return {
    listDomains() {
      return Object.values(configs).map(domainSummary);
    },
    listLanguages(domain) {
      const config = getDomainConfig(domain);
      return domainSummary(config);
    },
    getLanguageState: loadState,
    async getStatusSummary() {
      const domains = normalizeStatusDomains();
      const publishedIndex = await readPublishedIndex();
      const languageStates = [];
      const unavailable = [];
      for (const config of domains) {
        const publishable = config.publishable !== false;
        for (const language of config.targetLanguages) {
          let state;
          try {
            state = await loadState(config.id, language.code, { publishedIndex });
          } catch (error) {
            if (isStatusContentUnavailable(error)) {
              unavailable.push({
                domain: config.id,
                target_lang: language.code,
                code: error.code
              });
              continue;
            }
            throw error;
          }
          const dirtyCount = Number(state.counts?.dirty || 0);
          languageStates.push({
            domain: config.id,
            target_lang: language.code,
            publishable,
            total: Number(state.total || 0),
            dirty_count: dirtyCount,
            missing_count: Number(state.counts?.["freshness_state.missing"] || state.counts?.missing || 0),
            stale_count: Number(state.counts?.["freshness_state.stale"] || state.counts?.stale || 0),
            legacy_count: Number(state.counts?.["freshness_state.legacy"] || 0),
            unpublished_count: publishable ? Number(state.counts?.["publish_state.unpublished"] || 0) : 0,
            untranslated_count: Number(state.counts?.["publish_state.untranslated"] || 0)
          });
        }
      }
      const totals = languageStates.reduce((acc, entry) => {
        acc.total += entry.total;
        acc.dirty_count += entry.dirty_count;
        acc.missing_count += entry.missing_count;
        acc.stale_count += entry.stale_count;
        acc.legacy_count += entry.legacy_count;
        acc.unpublished_count += entry.unpublished_count;
        acc.untranslated_count += entry.untranslated_count;
        return acc;
      }, {
        total: 0,
        dirty_count: 0,
        missing_count: 0,
        stale_count: 0,
        legacy_count: 0,
        unpublished_count: 0,
        untranslated_count: 0
      });
      return {
        dirty: totals.dirty_count > 0,
        ...totals,
        unavailable,
        languages: languageStates
      };
    },
    patchOverrides,
    deleteCache,
    applyMissingTranslations,
    clearMachineTranslations,
    publishTranslations,
    isSupportedFrontendLanguage(lang) {
      const normalized = normalizeText(lang).toLowerCase();
      return FRONTEND_LANGUAGE_CODES.includes(normalized) && normalized !== "en";
    }
  };
}
