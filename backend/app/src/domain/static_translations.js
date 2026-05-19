import { spawn } from "node:child_process";
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
import {
  createTranslationPhraseOverrideIndex,
  normalizeStoredTranslationPhraseOverrides,
  resolveTranslationPhraseOverride,
  validateTranslationPhraseOverride
} from "../lib/translation_phrase_overrides.js";
import { normalizeStoredTranslationProtectedTerms } from "../lib/translation_protected_terms.js";
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

function trimCommandOutput(value, maxLength = 12000) {
  const normalized = String(value ?? "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}\n... output truncated ...`;
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
      sourcePath: () => path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json"),
      targetPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend", `${lang}.json`),
      metaPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", `${lang}.json`),
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
      sourcePath: () => path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "backend", "en.json"),
      targetPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend", `${lang}.json`),
      metaPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "backend", `${lang}.meta.json`),
      targetLanguages: backendLangs,
      context: BACKEND_CONTEXT
    }
  };
}

export function createStaticTranslationService({
  repoRoot,
  translationsSnapshotDir = path.join(repoRoot || "", "content", "translations"),
  protectedTermsPath = path.join(repoRoot || "", "config", "i18n", "translation_protected_terms.json"),
  phraseOverridesPath = path.join(repoRoot || "", "config", "i18n", "translation_phrase_overrides.json"),
  readStore = null,
  readTours = null,
  readTourVariants = null,
  translationMemoryStore = null,
  translateEntriesWithMeta = null,
  nowIso = () => new Date().toISOString(),
  readJsonFile = defaultReadJsonFile,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
  renameFn = rename,
  writesEnabled = true,
  snapshotPublishEnabled = writesEnabled
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
      writes_enabled: writesEnabled !== false,
      snapshot_publish_enabled: snapshotPublishEnabled !== false,
      phrase_overrides_writable: false
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

  function assertSnapshotPublishEnabled() {
    if (snapshotPublishEnabled === false) {
      throw apiError(
        403,
        "STATIC_TRANSLATION_SNAPSHOT_PUBLISH_DISABLED",
        "Publishing runtime translation snapshots is disabled in this environment."
      );
    }
  }

  function assertPhraseOverrideWritesManagedInConfig() {
    throw apiError(
      403,
      "STATIC_TRANSLATION_PHRASE_OVERRIDES_READ_ONLY",
      "Phrase translation overrides are managed in config/i18n/translation_phrase_overrides.json."
    );
  }

  function assertTranslationPolicyWritesEnabled() {
    if (writesEnabled === false) {
      throw apiError(
        403,
        "STATIC_TRANSLATION_POLICY_WRITES_DISABLED",
        "Translation policy editing is disabled in this environment."
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
    return "";
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

  function protectedTermSet(items) {
    return new Set((Array.isArray(items) ? items : []).map((item) => normalizeText(item)).filter(Boolean));
  }

  function normalizeProtectedToken(value) {
    return normalizeText(value).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
  }

  function findProtectedTermOccurrences(sourceValue, protectedTerms) {
    const source = normalizeText(sourceValue);
    if (!source || !protectedTerms?.size) return [];
    const sourceLower = source.toLowerCase();
    const matches = [];
    const seen = new Set();
    const terms = [...protectedTerms]
      .map((term) => normalizeText(term))
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    for (const term of terms) {
      const termLower = term.toLowerCase();
      let index = sourceLower.indexOf(termLower);
      while (index >= 0) {
        const occurrence = source.slice(index, index + term.length);
        const key = occurrence.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          matches.push(occurrence);
        }
        index = sourceLower.indexOf(termLower, index + Math.max(1, termLower.length));
      }
    }

    return matches;
  }

  function shouldPreserveProtectedSource(sourceValue, protectedTerms) {
    const source = normalizeText(sourceValue);
    if (!source || !protectedTerms?.size) return false;
    if (protectedTerms.has(source)) return true;

    const protectedTokens = new Set(
      [...protectedTerms]
        .map((term) => normalizeProtectedToken(term))
        .filter((term) => term && !term.includes(" "))
    );
    const sourceTokens = source.split(/\s+/).map((token) => normalizeProtectedToken(token)).filter(Boolean);
    return Boolean(sourceTokens.length) && sourceTokens.every((token) => protectedTokens.has(token));
  }

  function protectedTermsForSourceEntries(entries, protectedTerms) {
    return [
      ...new Set(
        Object.values(entries || {})
          .flatMap((value) => findProtectedTermOccurrences(value, protectedTerms))
          .filter(Boolean)
      )
    ];
  }

  function violatesProtectedTermUsage(row, protectedTerms) {
    const source = normalizeText(row?.source);
    const target = rowTargetText(row);
    if (!source || !target) return false;
    if (shouldPreserveProtectedSource(source, protectedTerms)) return target !== source;
    const expectedTerms = findProtectedTermOccurrences(source, protectedTerms);
    return expectedTerms.length ? expectedTerms.some((term) => !target.includes(term)) : false;
  }

  function normalizeRowOrigin(row) {
    const origin = normalizeText(row?.origin || row?.cache_meta?.origin);
    if (normalizeText(row?.override)) return origin === "phrase_override" ? "phrase_override" : "manual";
    const status = normalizeText(row?.status);
    if (status === "content_translation") return "content";
    if (origin === "manual_override") return "manual";
    if (rowTargetText(row)) return origin || "machine";
    return "";
  }

  function deriveFreshnessState(row) {
    if (!normalizeText(row?.source)) return "extra";
    if (!rowTargetText(row)) return "missing";
    if (normalizeText(row?.override)) {
      return "current";
    }
    const cachedSourceHash = normalizeText(row?.cached_source_hash);
    const expectedSourceHash = normalizeText(row?.source_hash);
    if (!cachedSourceHash) return "legacy";
    if (expectedSourceHash && cachedSourceHash !== expectedSourceHash) return "stale";
    return "current";
  }

  function deriveReviewState(row, origin, freshnessState) {
    if (origin === "english_fallback") return "needs_translation";
    if (freshnessState === "missing") return "needs_translation";
    if (freshnessState === "stale" || freshnessState === "legacy") return "needs_update";
    if (origin === "manual" || origin === "phrase_override") return "protected";
    if (!rowTargetText(row)) return "needs_translation";
    return "reviewed";
  }

  function publishedIndexKey(domain, targetLang, sourceRefValue) {
    const domainValue = normalizeText(domain).toLowerCase();
    const targetLangValue = normalizeText(targetLang).toLowerCase();
    const sourceRefText = normalizeText(sourceRefValue);
    return domainValue && targetLangValue && sourceRefText
      ? `${domainValue}|${targetLangValue}|${sourceRefText}`
      : "";
  }

  async function readPublishedIndex() {
    const { data: manifest } = await readTranslationStoreManifest();
    const rows = new Map();
    for (const section of Array.isArray(manifest?.sections) ? manifest.sections : []) {
      const relativeFile = normalizeText(section?.file);
      if (!relativeFile) continue;
      const { data } = await readJsonFile(path.join(translationsSnapshotDir, relativeFile), {});
      for (const item of Array.isArray(data?.items) ? data.items : []) {
        const key = publishedIndexKey(
          item?.domain || section?.domain,
          item?.target_lang || section?.target_lang,
          item?.source_ref
        );
        if (key && !rows.has(key)) rows.set(key, item);
      }
    }
    return { manifest, rows };
  }

  async function readTranslationStoreManifest() {
    return readJsonFile(path.join(translationsSnapshotDir, "manifest.json"), {});
  }

  async function readPhraseOverrideIndex() {
    const { data } = await readJsonFile(phraseOverridesPath, {});
    const normalized = normalizeStoredTranslationPhraseOverrides(data);
    const index = createTranslationPhraseOverrideIndex(normalized);
    if (index.duplicates.length) {
      throw apiError(
        500,
        "STATIC_TRANSLATION_PHRASE_OVERRIDE_DUPLICATE",
        `Duplicate phrase translation override: ${index.duplicates[0]}`
      );
    }
    return index;
  }

  function relativeRepoPath(filePath) {
    const relative = path.relative(repoRoot, filePath);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
      ? relative.split(path.sep).join("/")
      : filePath;
  }

  function revisionForPolicyPayload(data) {
    return sha256(JSON.stringify(data || {}));
  }

  function rawPhraseOverrideItems(payload) {
    return Array.isArray(payload) ? payload : payload?.items;
  }

  function validatePhraseOverrideConfigPayload(payload) {
    const items = rawPhraseOverrideItems(payload);
    if (!Array.isArray(items)) {
      throw apiError(
        400,
        "STATIC_TRANSLATION_PHRASE_OVERRIDES_INVALID",
        "translation_phrase_overrides.json must contain an items array."
      );
    }

    const errors = [];
    const seen = new Set();
    items.forEach((item, index) => {
      const label = `phrase override item ${index + 1}`;
      const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      const normalized = {
        source_phrase: normalizeText(source.source_phrase || source.sourcePhrase),
        target_lang: normalizeText(source.target_lang || source.targetLang).toLowerCase(),
        target_phrase: normalizeText(source.target_phrase || source.targetPhrase)
      };
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push(`${label}: item must be an object.`);
        return;
      }
      errors.push(...validateTranslationPhraseOverride(normalized, { context: label }));
      const duplicateKey = `${normalized.target_lang}\u0000${normalized.source_phrase}`;
      if (normalized.target_lang && normalized.source_phrase) {
        if (seen.has(duplicateKey)) errors.push(`${label}: duplicate target_lang/source_phrase pair.`);
        seen.add(duplicateKey);
      }
    });

    if (errors.length) {
      const error = apiError(
        400,
        "STATIC_TRANSLATION_PHRASE_OVERRIDES_INVALID",
        errors[0]
      );
      error.details = errors;
      throw error;
    }

    return normalizeStoredTranslationPhraseOverrides(payload);
  }

  function validateProtectedTermsConfigPayload(payload) {
    const rawItems = Array.isArray(payload) ? payload : payload?.items;
    if (!Array.isArray(rawItems)) {
      throw apiError(
        400,
        "STATIC_TRANSLATION_PROTECTED_TERMS_INVALID",
        "translation_protected_terms.json must contain an items array."
      );
    }

    const errors = [];
    const seen = new Set();
    rawItems.forEach((item, index) => {
      const label = `protected term item ${index + 1}`;
      if (typeof item !== "string") {
        errors.push(`${label}: item must be text.`);
        return;
      }
      const normalized = normalizeText(item);
      if (!normalized) {
        errors.push(`${label}: item cannot be blank.`);
        return;
      }
      const duplicateKey = normalized.toLowerCase();
      if (seen.has(duplicateKey)) errors.push(`${label}: duplicate protected term.`);
      seen.add(duplicateKey);
    });

    if (errors.length) {
      const error = apiError(
        400,
        "STATIC_TRANSLATION_PROTECTED_TERMS_INVALID",
        errors[0]
      );
      error.details = errors;
      throw error;
    }

    return {
      ...normalizeStoredTranslationProtectedTerms(payload),
      updated_at: nowIso()
    };
  }

  async function getTranslationPolicyConfig() {
    const [
      { data: phraseOverridesData },
      { data: protectedTermsData }
    ] = await Promise.all([
      readJsonFile(phraseOverridesPath, {}),
      readJsonFile(protectedTermsPath, {})
    ]);
    const phraseOverrides = normalizeStoredTranslationPhraseOverrides(phraseOverridesData);
    const protectedTerms = normalizeStoredTranslationProtectedTerms(protectedTermsData);
    return {
      permissions: {
        can_write: writesEnabled !== false
      },
      phrase_overrides: {
        path: relativeRepoPath(phraseOverridesPath),
        revision: revisionForPolicyPayload(phraseOverrides),
        item_count: phraseOverrides.items.length,
        data: phraseOverrides
      },
      protected_terms: {
        path: relativeRepoPath(protectedTermsPath),
        revision: revisionForPolicyPayload(protectedTerms),
        item_count: protectedTerms.items.length,
        data: protectedTerms
      }
    };
  }

  async function saveTranslationPolicyConfig(payload = {}) {
    assertTranslationPolicyWritesEnabled();
    const phraseOverridePayload = payload?.phrase_overrides;
    const protectedTermsPayload = payload?.protected_terms;
    if (!phraseOverridePayload && !protectedTermsPayload) {
      throw apiError(
        400,
        "STATIC_TRANSLATION_POLICY_EMPTY",
        "Provide phrase_overrides or protected_terms."
      );
    }

    const current = await getTranslationPolicyConfig();
    const nextPhraseOverrides = phraseOverridePayload
      ? validatePhraseOverrideConfigPayload(phraseOverridePayload.data || phraseOverridePayload)
      : null;
    const nextProtectedTerms = protectedTermsPayload
      ? validateProtectedTermsConfigPayload(protectedTermsPayload.data || protectedTermsPayload)
      : null;

    if (
      phraseOverridePayload
      && normalizeText(phraseOverridePayload.expected_revision || payload.expected_phrase_overrides_revision)
      && normalizeText(phraseOverridePayload.expected_revision || payload.expected_phrase_overrides_revision) !== current.phrase_overrides.revision
    ) {
      throw apiError(409, "STATIC_TRANSLATION_PHRASE_OVERRIDES_REVISION_MISMATCH", "Phrase translation overrides changed. Refresh and retry.");
    }

    if (
      protectedTermsPayload
      && normalizeText(protectedTermsPayload.expected_revision || payload.expected_protected_terms_revision)
      && normalizeText(protectedTermsPayload.expected_revision || payload.expected_protected_terms_revision) !== current.protected_terms.revision
    ) {
      throw apiError(409, "STATIC_TRANSLATION_PROTECTED_TERMS_REVISION_MISMATCH", "Translation protected terms changed. Refresh and retry.");
    }

    if (nextPhraseOverrides) {
      await writeJsonAtomic(phraseOverridesPath, nextPhraseOverrides);
    }
    if (nextProtectedTerms) {
      await writeJsonAtomic(protectedTermsPath, nextProtectedTerms);
    }
    return getTranslationPolicyConfig();
  }

  function applyPhraseOverridePolicy(config, language, row, phraseOverrideIndex) {
    if (!row?.source) return row;
    const item = resolveTranslationPhraseOverride(phraseOverrideIndex, {
      target_lang: language.code,
      source_phrase: row.source
    });
    if (!item) return row;

    const errors = validateTranslationPhraseOverride(item, {
      sourceText: row.source,
      context: `${config.id}/${language.code}:${row.key}`
    });
    const cacheMeta = {
      ...(row.cache_meta && typeof row.cache_meta === "object" && !Array.isArray(row.cache_meta) ? row.cache_meta : {}),
      phrase_override_source_phrase: item.source_phrase
    };
    if (errors.length) {
      return {
        ...row,
        phrase_override_error: errors[0],
        cache_meta: cacheMeta
      };
    }
    return {
      ...row,
      override: item.target_phrase,
      origin: "phrase_override",
      status: "manual_override",
      phrase_override_source_phrase: item.source_phrase,
      cache_meta: cacheMeta
    };
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
      .filter((row) => normalizeText(row?.source) && normalizeText(row?.key) && row?.status !== "extra")
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
      const publishedKey = publishedIndexKey(config.id, language.code, next.source_ref);
      const publishedItem = publishedIndex?.rows?.get(publishedKey) || null;
      const publishedSourceHash = normalizeText(publishedItem?.source_hash);
      const publishedTargetHash = normalizeText(publishedItem?.target_hash);
      const matchesPublishedSnapshot = Boolean(
        publishedItem
        && publishedSourceHash === next.source_hash
        && publishedTargetHash === sourceHash(targetText)
      );
      next.publish_state = next.freshness_state === "current" && matchesPublishedSnapshot ? "published" : "unpublished";
      next.published_at = matchesPublishedSnapshot
        ? normalizeText(publishedItem?.published_at || publishedItem?.generated_at)
        : "";
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
    const storedOrigin = normalizeText(item?.origin || item?.cache_meta?.origin);
    const origin = manualOverride
      ? "manual_override"
      : (machineText ? (isManualStoreOrigin(storedOrigin) ? "machine" : (storedOrigin || "machine")) : "");
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
    const phraseOverrideIndex = await readPhraseOverrideIndex();
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

    const policyRows = rows.map((row) => applyPhraseOverridePolicy(config, language, row, phraseOverrideIndex));
    const augmentedRows = await augmentRows(config, language, policyRows, publishedIndex);
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

  function sourceTextForMemory(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const localized = normalizeText(value.en)
        || Object.values(value).map((entry) => normalizeText(entry)).find(Boolean)
        || "";
      return localized;
    }
    return normalizeText(value);
  }

  function addSourceText(targetSet, value) {
    const normalized = sourceTextForMemory(value);
    if (normalized) targetSet.add(normalized);
  }

  function collectMarketingTourMemorySourcesFromPlan(targetSet, travelPlan) {
    const boundaryLogistics = travelPlan?.boundary_logistics && typeof travelPlan.boundary_logistics === "object" && !Array.isArray(travelPlan.boundary_logistics)
      ? travelPlan.boundary_logistics
      : {};
    for (const service of [boundaryLogistics.arrival, boundaryLogistics.departure]) {
      if (!service || typeof service !== "object" || Array.isArray(service)) continue;
      addSourceText(targetSet, service?.time);
      addSourceText(targetSet, service?.title);
      addSourceText(targetSet, service?.details);
      addSourceText(targetSet, service?.image_subtitle);
    }
    const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
    for (const day of days) {
      addSourceText(targetSet, day?.title);
      addSourceText(targetSet, day?.notes);
      const services = Array.isArray(day?.services) ? day.services : [];
      for (const service of services) {
        addSourceText(targetSet, service?.time);
        addSourceText(targetSet, service?.title);
        addSourceText(targetSet, service?.details);
        addSourceText(targetSet, service?.image_subtitle);
        const images = [
          service?.image,
          ...(Array.isArray(service?.images) ? service.images : [])
        ].filter((image) => image && typeof image === "object" && !Array.isArray(image));
        for (const image of images) {
          addSourceText(targetSet, image?.caption);
          addSourceText(targetSet, image?.alt_text);
        }
      }
    }
  }

  function collectMarketingTourMemorySources(tours) {
    const sources = new Set();
    for (const tour of Array.isArray(tours) ? tours : []) {
      addSourceText(sources, tour?.title || tour?.id);
      addSourceText(sources, tour?.short_description);
      collectMarketingTourMemorySourcesFromPlan(sources, tour?.travel_plan);
    }
    return Array.from(sources).sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
  }

  function tourVariantAsTranslationTour(tourVariant) {
    if (!tourVariant || typeof tourVariant !== "object" || Array.isArray(tourVariant)) return null;
    return {
      title: tourVariant.title,
      title_i18n: tourVariant.title_i18n,
      short_description: tourVariant.short_description,
      short_description_i18n: tourVariant.short_description_i18n,
      travel_plan: {
        boundary_logistics: tourVariant.boundary_logistics,
        days: []
      }
    };
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
          legacyMapField: "label_i18n",
          sourceField: "label",
          sourceFallback: code || "",
          key: code ? `destination.${code}.label` : ""
        };
      });
    const regionEntries = (Array.isArray(store?.destination_regions) ? store.destination_regions : [])
      .map((record) => ({
        record,
        kind: "region",
        legacyMapField: "name_i18n",
        sourceField: "name",
        sourceFallback: "",
        key: `region.${normalizeText(record?.id)}.name`
      }));
    const placeEntries = (Array.isArray(store?.destination_places) ? store.destination_places : [])
      .map((record) => ({
        record,
        kind: "place",
        legacyMapField: "name_i18n",
        sourceField: "name",
        sourceFallback: "",
        key: `place.${normalizeText(record?.id)}.name`
      }));

    return [...destinationEntries, ...regionEntries, ...placeEntries]
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

  async function collectIndexContentMemorySources() {
    return sortedSourceTexts(new Set());
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
      const sources = new Set(collectMarketingTourMemorySources(await readTours()));
      const tourVariants = typeof readTourVariants === "function"
        ? (await readTourVariants()).map(tourVariantAsTranslationTour).filter(Boolean)
        : [];
      for (const source of collectMarketingTourMemorySources(tourVariants)) {
        sources.add(source);
      }
      return sortedSourceTexts(sources);
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
        const override = "";
        const status = cached ? "machine" : "missing";
        return {
          key,
          source,
          cached,
          override,
          status,
          source_hash: key,
          cached_source_hash: key,
          origin: cached ? "machine" : "",
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

  async function loadDestinationScopeCatalogState(config, language, { publishedIndex = null } = {}) {
    const store = await readDestinationScopeStore();
    const legacyRows = destinationScopeCatalogRecordEntries(store)
      .map((entry) => {
        const source = destinationRecordSource(entry.record, entry.sourceField, entry.sourceFallback);
        const map = normalizeLocalizedTextMap(entry.record[entry.legacyMapField]);
        const directTarget = normalizeText(map[language.code]);
        const expectedSourceHash = sourceHash(source);
        const status = directTarget ? "content_translation" : "missing";
        return {
          key: entry.key,
          source,
          cached: directTarget,
          override: "",
          status,
          source_hash: expectedSourceHash,
          cached_source_hash: directTarget ? expectedSourceHash : "",
          origin: directTarget ? "content" : "",
          updated_at: normalizeText(entry.record?.updated_at),
          cache_meta: {
            source_hash: expectedSourceHash,
            catalog_kind: entry.kind,
            legacy_map_field: entry.legacyMapField,
            direct_target: directTarget || null,
            legacy_inline_target: Boolean(directTarget)
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
      revision: storeState.revision,
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

    const [{ data: source }, { data: target }, { data: meta }] = await Promise.all([
      readJsonFile(config.sourcePath(), {}),
      readJsonFile(config.targetPath(language.code), {}),
      readJsonFile(config.metaPath(language.code), {})
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
      const overrideValue = "";
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
      ...Object.keys(meta || {})
    ]);
    for (const key of sourceKeys) extraKeys.delete(key);
    for (const key of Array.from(extraKeys).sort()) {
      const metaEntry = meta?.[key] && typeof meta[key] === "object" ? meta[key] : {};
      legacyRows.push({
        key,
        source: "",
        cached: String(target?.[key] ?? ""),
        override: "",
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
      revision: storeState.revision,
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

  async function patchDestinationScopeCatalogOverrides(config, language, payload = {}) {
    return patchTranslationStoreOverrides(config, language, payload);
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
    return deleteTranslationStoreCache(config, language, key, payload);
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
    getLanguageConfig(domain, targetLang);
    assertPhraseOverrideWritesManagedInConfig();
  }

  function translationProfileForConfig(config) {
    if (config.id === "destination-scope-catalog") return "destination_scope_catalog";
    if (config.id === "backend") return "staff_backend_ui";
    return "marketing_trip_copy";
  }

  async function loadProtectedTermsForApply(options = {}) {
    if (Array.isArray(options.protectedTerms)) return options.protectedTerms;
    const { data } = await readJsonFile(protectedTermsPath, {});
    return normalizeStoredTranslationProtectedTerms(data).items;
  }

  function rowsNeedingMachineTranslation(rows, protectedTerms = new Set(), options = {}) {
    const protectedTermsOnly = options.protectedTermsOnly === true;
    return (Array.isArray(rows) ? rows : []).filter((row) => (
      row?.required
      && row.origin !== "manual"
      && (protectedTermsOnly
        ? violatesProtectedTermUsage(row, protectedTerms)
        : (
          violatesProtectedTermUsage(row, protectedTerms)
          || row.freshness_state === "missing"
          || row.freshness_state === "stale"
          || row.freshness_state === "legacy"
          || row.publish_state === "untranslated"
          || row.review_state === "needs_translation"
          || row.review_state === "needs_update"
        ))
    ));
  }

  async function translateCentralRows(config, language, rows, options = {}) {
    const protectedTerms = protectedTermSet(await loadProtectedTermsForApply(options));
    const candidates = rowsNeedingMachineTranslation(rows, protectedTerms, options);
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
    const sourceProtectedTerms = protectedTermsForSourceEntries(entries, protectedTerms);
    reportProgress(0);
    const result = await translate(entries, language.code, {
      sourceLangCode: configSourceLang(config),
      domain: config.label,
      context: config.context,
      cacheNamespace: `static-translations:${config.id}`,
      translationProfile: translationProfileForConfig(config),
      protectedTerms: sourceProtectedTerms,
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
    for (const row of candidates) {
      if (shouldPreserveProtectedSource(row?.source, protectedTerms)) {
        translatedEntries[row.key] = normalizeText(row.source);
      }
    }

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
    const protectedTerms = protectedTermSet(await loadProtectedTermsForApply(options));
    const candidates = rowsNeedingMachineTranslation(rows, protectedTerms, options);
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
    const sourceProtectedTerms = protectedTermsForSourceEntries(entries, protectedTerms);
    reportProgress(0);
    const result = await translate(entries, language.code, {
      sourceLangCode: configSourceLang(config),
      domain: config.label,
      context: config.context,
      cacheNamespace: `static-translations:${config.id}`,
      translationProfile: translationProfileForConfig(config),
      protectedTerms: sourceProtectedTerms,
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
    for (const row of candidates) {
      if (shouldPreserveProtectedSource(row?.source, protectedTerms)) {
        translatedEntries[row.key] = normalizeText(row.source);
      }
    }
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
    const applyOptions = { ...options };
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

  async function pruneExtraTranslations(options = {}) {
    assertWritesEnabled();
    const summary = {
      pruned_count: 0,
      domains: []
    };

    for (const config of normalizeTranslationDomains(options)) {
      for (const language of publishLanguagesForConfig(config, options)) {
        const state = await loadState(config.id, language.code);
        const extraCount = (state.rows || []).filter((row) => row?.status === "extra").length;
        if (extraCount > 0) {
          await writeTranslationStoreSection(config, language, state.rows);
        }
        summary.pruned_count += extraCount;
        summary.domains.push({
          domain: config.id,
          target_lang: language.code,
          pruned_count: extraCount
        });
      }
    }

    return summary;
  }

  async function applyProtectedTerms(options = {}) {
    assertWritesEnabled();
    const applyOptions = {
      ...options,
      protectedTermsOnly: true
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

  function checkRuntimeI18nGenerator() {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ["scripts/i18n/build_runtime_i18n.mjs", "--check", "--strict"], {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        resolve({
          status: "blocked",
          blocked: true,
          error: normalizeText(error?.message) || "Runtime i18n generator could not be started.",
          output: ""
        });
      });
      child.on("close", (code) => {
        const output = trimCommandOutput([stdout, stderr].filter(Boolean).join("\n"));
        if (code === 0) {
          resolve({
            status: "ok",
            blocked: false,
            error: "",
            output
          });
          return;
        }
        resolve({
          status: "blocked",
          blocked: true,
          error: output || `Runtime i18n generator check failed with exit code ${code}.`,
          output
        });
      });
    });
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
    const fallbackReason = normalizeText(row.publish_fallback_reason || row.fallback_reason);
    const usesEnglishFallback = Boolean(fallbackReason);
    const targetText = usesEnglishFallback ? normalizeText(row.source) : rowTargetText(row);
    const manualOverride = usesEnglishFallback ? "" : normalizeText(row.override);
    const machineText = usesEnglishFallback ? "" : normalizeText(row.cached);
    const rowOrigin = normalizeText(row.origin);
    const origin = usesEnglishFallback
      ? "english_fallback"
      : (manualOverride ? (rowOrigin === "phrase_override" ? "phrase_override" : "manual") : (rowOrigin || (machineText ? "machine" : "")));
    const freshnessState = targetText ? "current" : "missing";
    const reviewState = usesEnglishFallback
      ? "needs_translation"
      : deriveReviewState({ ...row, override: manualOverride, cached: machineText }, origin, freshnessState);
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
      origin,
      freshness_state: freshnessState,
      job_state: row.job_state,
      publish_state: targetText ? "published" : "untranslated",
      review_state: reviewState,
      generated_at: normalizeText(publishedAt),
      updated_at: normalizeText(row.updated_at),
      cache_meta: row.cache_meta || {},
      ...(usesEnglishFallback ? {
        fallback: true,
        fallback_reason: fallbackReason
      } : {})
    };
  }

  function rowForPublishSnapshot(row) {
    const issue = publishIssue(row);
    if (!issue) return { row, issue: "" };
    return {
      issue,
      row: {
        ...row,
        publish_fallback_reason: issue
      }
    };
  }

  async function getPublishReadiness(options = {}) {
    const issues = [];
    let itemCount = 0;
    for (const config of normalizePublishDomains(options)) {
      const languages = publishLanguagesForConfig(config, options);
      for (const language of languages) {
        const state = await loadState(config.id, language.code);
        const rows = state.rows.filter((row) => row.required && row.publish_state !== "not_publishable");
        itemCount += rows.length;
        for (const row of rows) {
          const issue = publishIssue(row);
          if (!issue) continue;
          issues.push({
            domain: config.id,
            target_lang: language.code,
            key: row.key,
            source_ref: row.source_ref,
            issue
          });
        }
      }
    }
    return {
      ready: true,
      item_count: itemCount,
      fallback_count: issues.length,
      issue_count: issues.length,
      issues: issues.slice(0, 200),
      warnings: issues.length
        ? [{
            code: "english_fallback",
            count: issues.length,
            message: `${issues.length} translation item${issues.length === 1 ? "" : "s"} will use English fallback.`
          }]
        : []
    };
  }

  async function publishTranslations(options = {}) {
    assertSnapshotPublishEnabled();
    const timestamp = nowIso();
    const sections = [];
    const allItems = [];
    const issues = [];

    for (const config of normalizePublishDomains(options)) {
      const languages = publishLanguagesForConfig(config, options);
      for (const language of languages) {
        const state = await loadState(config.id, language.code);
        const rows = state.rows.filter((row) => row.required && row.publish_state !== "not_publishable");
        const publishRows = rows.map((row) => {
          const result = rowForPublishSnapshot(row);
          if (result.issue) {
            issues.push({
              domain: config.id,
              target_lang: language.code,
              key: row.key,
              source_ref: row.source_ref,
              issue: result.issue
            });
          }
          return result.row;
        });
        const items = publishRows.map((row) => snapshotItem(config, language, row, timestamp));
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
          rows: publishRows,
          items
        });
      }
    }

    let manifest = null;
    for (const section of sections) {
      manifest = await writeTranslationStoreSection(section.config, section.language, section.rows);
    }
    const fallbackSummary = {
      fallback_count: issues.length,
      warnings: issues.length
        ? [{
            code: "english_fallback",
            count: issues.length,
            message: `${issues.length} translation item${issues.length === 1 ? "" : "s"} used English fallback.`
          }]
        : []
    };
    return manifest
      ? { ...manifest, ...fallbackSummary }
      : {
          schema: TRANSLATION_SNAPSHOT_SCHEMA,
          schema_version: 1,
          generated_at: timestamp,
          source_set_hash: sourceSetHashForItems(allItems),
          staff_languages: Array.from(new Set(sections.filter((section) => section.section === "staff").map((section) => section.target_lang))).sort(),
          customer_languages: Array.from(new Set(sections.filter((section) => section.section === "customers").map((section) => section.target_lang))).sort(),
          items_count: allItems.length,
          total_items: allItems.length,
          sections: sections.map(({ config, language, rows, items, ...section }) => section),
          ...fallbackSummary
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
    getPublishReadiness,
    async getStatusSummary(options = {}) {
      const domains = normalizeStatusDomains(options);
      const publishedIndex = await readPublishedIndex();
      const protectedTerms = protectedTermSet(await loadProtectedTermsForApply(options));
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
          const translationWorkCount = rowsNeedingMachineTranslation(state.rows, protectedTerms).length;
          const protectedTermCount = rowsNeedingMachineTranslation(state.rows, protectedTerms, { protectedTermsOnly: true }).length;
          languageStates.push({
            domain: config.id,
            target_lang: language.code,
            publishable,
            total: Number(state.total || 0),
            dirty_count: dirtyCount,
            translation_work_count: translationWorkCount,
            protected_term_count: protectedTermCount,
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
        acc.translation_work_count += entry.translation_work_count;
        acc.protected_term_count += entry.protected_term_count;
        acc.missing_count += entry.missing_count;
        acc.stale_count += entry.stale_count;
        acc.legacy_count += entry.legacy_count;
        acc.unpublished_count += entry.unpublished_count;
        acc.untranslated_count += entry.untranslated_count;
        return acc;
      }, {
        total: 0,
        dirty_count: 0,
        translation_work_count: 0,
        protected_term_count: 0,
        missing_count: 0,
        stale_count: 0,
        legacy_count: 0,
        unpublished_count: 0,
        untranslated_count: 0
      });
      const runtimeI18n = await checkRuntimeI18nGenerator();
      return {
        dirty: totals.dirty_count > 0 || totals.translation_work_count > 0 || totals.unpublished_count > 0,
        ...totals,
        unavailable,
        runtime_i18n: runtimeI18n,
        languages: languageStates
      };
    },
    getTranslationPolicyConfig,
    saveTranslationPolicyConfig,
    patchOverrides,
    deleteCache,
    applyMissingTranslations,
    pruneExtraTranslations,
    applyProtectedTerms,
    clearMachineTranslations,
    publishTranslations,
    isSupportedFrontendLanguage(lang) {
      const normalized = normalizeText(lang).toLowerCase();
      return FRONTEND_LANGUAGE_CODES.includes(normalized) && normalized !== "en";
    }
  };
}
