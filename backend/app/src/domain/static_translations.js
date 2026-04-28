import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BACKEND_UI_LANGUAGES,
  FRONTEND_LANGUAGES,
  FRONTEND_LANGUAGE_CODES
} from "../../../../shared/generated/language_catalog.js";

const FRONTEND_CONTEXT = "AsiaTravelPlan public website for travelers planning Southeast Asia trips. Use natural, polished, customer-facing copy that feels trustworthy, clear, and concise.";
const HOMEPAGE_CONTENT_CONTEXT = "AsiaTravelPlan generated public homepage content from tours and destination filters. These strings are content translations, not static UI labels; Apply regenerates the public homepage assets after saving.";
const BACKEND_CONTEXT = "AsiaTravelPlan backend UI for ATP staff managing bookings, tours, invoices, travel plans, and internal notes. Use a clear, natural, friendly tone for internal staff UI copy.";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sourceHash(value) {
  return sha256(String(value ?? ""));
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

function buildDomainConfigs(repoRoot) {
  const frontendLangs = FRONTEND_LANGUAGES.filter((entry) => entry.code !== "en");
  const backendLangs = BACKEND_UI_LANGUAGES.filter((entry) => entry.code !== "en" && entry.code === "vi");
  return {
    frontend: {
      id: "frontend",
      kind: "static",
      label: "Customer-facing UI",
      sourceLang: "en",
      sourcePath: () => path.join(repoRoot, "frontend", "data", "i18n", "frontend", "en.json"),
      targetPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend", `${lang}.json`),
      metaPath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", `${lang}.json`),
      overridePath: (lang) => path.join(repoRoot, "frontend", "data", "i18n", "frontend_overrides", `${lang}.json`),
      targetLanguages: frontendLangs,
      context: FRONTEND_CONTEXT
    },
    "homepage-content": {
      id: "homepage-content",
      kind: "homepage_content",
      label: "Customer-facing content",
      sourceLang: "en",
      targetLanguages: frontendLangs,
      context: HOMEPAGE_CONTENT_CONTEXT
    },
    backend: {
      id: "backend",
      kind: "static",
      label: "Backend UI",
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
  readStore = null,
  persistStore = null,
  readTours = null,
  persistTour = null,
  nowIso = () => new Date().toISOString(),
  readJsonFile = defaultReadJsonFile,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
  renameFn = rename
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
      label: config.label,
      source_lang: config.sourceLang,
      target_languages: config.targetLanguages,
      context: config.context
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

  function contentRowStatus(targetValue) {
    return normalizeText(targetValue) ? "content_translation" : "missing";
  }

  function localizedSource(value, fallback = "") {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return normalizeText(value.en) || normalizeText(fallback);
    }
    return normalizeText(fallback || value);
  }

  function localizedTarget(value, targetLang) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    return String(value[targetLang] ?? "");
  }

  function contentRow({ key, source, target, updatedAt = "", meta = {} }) {
    return {
      key,
      source,
      cached: target,
      override: target,
      status: contentRowStatus(target),
      source_hash: sourceHash(source),
      cached_source_hash: "",
      origin: "content",
      updated_at: normalizeText(updatedAt),
      cache_meta: {
        ...meta,
        source_hash: sourceHash(source)
      }
    };
  }

  function contentRowsFromStore(store, targetLang) {
    const rows = [];
    const destinations = Array.isArray(store?.destination_scope_destinations) ? store.destination_scope_destinations : [];
    for (const destination of destinations) {
      const code = normalizeText(destination?.code).toUpperCase();
      if (!code) continue;
      rows.push(contentRow({
        key: `destination.${code}.label`,
        source: localizedSource(destination?.label_i18n, destination?.label || code),
        target: localizedTarget(destination?.label_i18n, targetLang),
        updatedAt: destination?.updated_at,
        meta: { content_type: "destination", id: code, field: "label_i18n" }
      }));
    }

    const areas = Array.isArray(store?.destination_areas) ? store.destination_areas : [];
    for (const area of areas) {
      const id = normalizeText(area?.id);
      if (!id) continue;
      rows.push(contentRow({
        key: `area.${id}.name`,
        source: localizedSource(area?.name_i18n, area?.name || area?.code || id),
        target: localizedTarget(area?.name_i18n, targetLang),
        updatedAt: area?.updated_at,
        meta: { content_type: "area", id, field: "name_i18n", code: normalizeText(area?.code), destination: normalizeText(area?.destination) }
      }));
    }

    const places = Array.isArray(store?.destination_places) ? store.destination_places : [];
    for (const place of places) {
      const id = normalizeText(place?.id);
      if (!id) continue;
      rows.push(contentRow({
        key: `place.${id}.name`,
        source: localizedSource(place?.name_i18n, place?.name || place?.code || id),
        target: localizedTarget(place?.name_i18n, targetLang),
        updatedAt: place?.updated_at,
        meta: { content_type: "place", id, field: "name_i18n", code: normalizeText(place?.code), area_id: normalizeText(place?.area_id) }
      }));
    }
    return rows;
  }

  function contentRowsFromTours(tours, targetLang) {
    const rows = [];
    const sortedTours = [...(Array.isArray(tours) ? tours : [])].sort((left, right) => {
      const leftTitle = localizedSource(left?.title, left?.id);
      const rightTitle = localizedSource(right?.title, right?.id);
      return leftTitle.localeCompare(rightTitle, "en", { sensitivity: "base" });
    });
    for (const tour of sortedTours) {
      const id = normalizeText(tour?.id);
      if (!id) continue;
      rows.push(contentRow({
        key: `tour.${id}.title`,
        source: localizedSource(tour?.title, id),
        target: localizedTarget(tour?.title, targetLang),
        updatedAt: tour?.updated_at,
        meta: { content_type: "tour", id, field: "title" }
      }));
      rows.push(contentRow({
        key: `tour.${id}.short_description`,
        source: localizedSource(tour?.short_description, ""),
        target: localizedTarget(tour?.short_description, targetLang),
        updatedAt: tour?.updated_at,
        meta: { content_type: "tour", id, field: "short_description" }
      }));
    }
    return rows;
  }

  function contentRevision(rows) {
    return sha256(JSON.stringify(rows.map((row) => ({
      key: row.key,
      source: row.source,
      target: row.override,
      updated_at: row.updated_at
    }))));
  }

  async function loadHomepageContentState(config, language) {
    if (typeof readStore !== "function" || typeof readTours !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_CONTENT_UNAVAILABLE", "Homepage content translation storage is not configured.");
    }
    const [store, tours] = await Promise.all([readStore(), readTours()]);
    const rows = [
      ...contentRowsFromStore(store, language.code),
      ...contentRowsFromTours(tours, language.code)
    ];
    const counts = rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    return {
      domain: domainSummary(config),
      language,
      source_lang: config.sourceLang,
      target_lang: language.code,
      revision: contentRevision(rows),
      total: rows.length,
      counts,
      rows
    };
  }

  async function loadState(domain, targetLang) {
    const { config, language } = getLanguageConfig(domain, targetLang);
    if (config.kind === "homepage_content") {
      return loadHomepageContentState(config, language);
    }

    const [{ data: source }, { data: target }, { data: meta }, { data: overrides, raw: overrideRaw }] = await Promise.all([
      readJsonFile(config.sourcePath(), {}),
      readJsonFile(config.targetPath(language.code), {}),
      readJsonFile(config.metaPath(language.code), {}),
      readJsonFile(config.overridePath(language.code), {})
    ]);

    const sourceKeys = Object.keys(source || {});
    const sourceKeySet = new Set(sourceKeys);
    const rows = sourceKeys.map((key) => {
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
      rows.push({
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

    const counts = rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    return {
      domain: domainSummary(config),
      language,
      source_lang: config.sourceLang,
      target_lang: language.code,
      revision: sha256(overrideRaw),
      total: rows.length,
      counts,
      rows
    };
  }

  function setLocalizedTarget(item, field, targetLang, rawValue, timestamp) {
    const value = normalizeText(rawValue);
    const nextMap = item[field] && typeof item[field] === "object" && !Array.isArray(item[field])
      ? { ...item[field] }
      : {};
    if (value) {
      nextMap[targetLang] = value;
    } else {
      delete nextMap[targetLang];
    }
    item[field] = nextMap;
    item.updated_at = timestamp;
  }

  async function patchHomepageContentTranslations(config, language, payload = {}) {
    if (
      typeof readStore !== "function"
      || typeof persistStore !== "function"
      || typeof readTours !== "function"
      || typeof persistTour !== "function"
    ) {
      throw apiError(500, "STATIC_TRANSLATION_CONTENT_UNAVAILABLE", "Homepage content translation storage is not configured.");
    }

    const expectedRevision = normalizeText(payload?.expected_revision);
    const updates = payload?.overrides && typeof payload.overrides === "object" && !Array.isArray(payload.overrides)
      ? payload.overrides
      : null;
    if (!updates) {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_OVERRIDES", "overrides must be an object keyed by translation id.");
    }

    const currentState = await loadHomepageContentState(config, language);
    if (expectedRevision && expectedRevision !== currentState.revision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Homepage content translations changed. Refresh and retry.");
    }
    const rowKeys = new Set(currentState.rows.map((row) => row.key));
    for (const key of Object.keys(updates)) {
      if (!rowKeys.has(key)) {
        throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${key}`);
      }
    }

    const timestamp = nowIso();
    const store = await readStore();
    let storeChanged = false;
    const toursById = new Map((await readTours()).map((tour) => [normalizeText(tour?.id), tour]));
    const changedTourIds = new Set();

    for (const [key, rawValue] of Object.entries(updates)) {
      let match = key.match(/^destination\.([A-Z]{2})\.label$/);
      if (match) {
        const destination = (Array.isArray(store.destination_scope_destinations) ? store.destination_scope_destinations : [])
          .find((item) => normalizeText(item?.code).toUpperCase() === match[1]);
        if (destination) {
          setLocalizedTarget(destination, "label_i18n", language.code, rawValue, timestamp);
          storeChanged = true;
        }
        continue;
      }

      match = key.match(/^area\.([^/]+)\.name$/);
      if (match) {
        const area = (Array.isArray(store.destination_areas) ? store.destination_areas : [])
          .find((item) => normalizeText(item?.id) === match[1]);
        if (area) {
          setLocalizedTarget(area, "name_i18n", language.code, rawValue, timestamp);
          storeChanged = true;
        }
        continue;
      }

      match = key.match(/^place\.([^/]+)\.name$/);
      if (match) {
        const place = (Array.isArray(store.destination_places) ? store.destination_places : [])
          .find((item) => normalizeText(item?.id) === match[1]);
        if (place) {
          setLocalizedTarget(place, "name_i18n", language.code, rawValue, timestamp);
          storeChanged = true;
        }
        continue;
      }

      match = key.match(/^tour\.([^/]+)\.(title|short_description)$/);
      if (match) {
        const tour = toursById.get(match[1]);
        if (tour) {
          setLocalizedTarget(tour, match[2], language.code, rawValue, timestamp);
          changedTourIds.add(match[1]);
        }
      }
    }

    if (storeChanged) {
      await persistStore(store);
    }
    for (const tourId of changedTourIds) {
      await persistTour(toursById.get(tourId));
    }
    return loadHomepageContentState(config, language);
  }

  async function patchOverrides(domain, targetLang, payload = {}) {
    const { config, language } = getLanguageConfig(domain, targetLang);
    if (config.kind === "homepage_content") {
      return patchHomepageContentTranslations(config, language, payload);
    }

    const expectedRevision = normalizeText(payload?.expected_revision);
    const updates = payload?.overrides && typeof payload.overrides === "object" && !Array.isArray(payload.overrides)
      ? payload.overrides
      : null;
    if (!updates) {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_OVERRIDES", "overrides must be an object keyed by translation id.");
    }

    const [{ data: source }, { data: currentOverrides, raw: currentRaw }] = await Promise.all([
      readJsonFile(config.sourcePath(), {}),
      readJsonFile(config.overridePath(language.code), {})
    ]);
    const currentRevision = sha256(currentRaw);
    if (expectedRevision && expectedRevision !== currentRevision) {
      throw apiError(409, "STATIC_TRANSLATION_REVISION_MISMATCH", "Translation overrides changed. Refresh and retry.");
    }

    const nextOverrides = { ...(currentOverrides || {}) };
    for (const [key, rawValue] of Object.entries(updates)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        throw apiError(400, "STATIC_TRANSLATION_UNKNOWN_KEY", `Unknown translation key: ${key}`);
      }
      const value = normalizeText(rawValue);
      if (value) {
        nextOverrides[key] = value;
      } else {
        delete nextOverrides[key];
      }
    }

    const ordered = sortOverridesBySource(source, nextOverrides);
    const overridePath = config.overridePath(language.code);
    await mkdirFn(path.dirname(overridePath), { recursive: true });
    const tempPath = `${overridePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFileFn(tempPath, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");
    await renameFn(tempPath, overridePath);
    return loadState(config.id, language.code);
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
    patchOverrides,
    isSupportedFrontendLanguage(lang) {
      const normalized = normalizeText(lang).toLowerCase();
      return FRONTEND_LANGUAGE_CODES.includes(normalized) && normalized !== "en";
    }
  };
}
