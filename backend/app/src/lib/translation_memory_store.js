import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text.js";

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

export function translationMemorySourceKey(sourceText) {
  return sha256(normalizeText(sourceText));
}

function normalizeProvider(provider) {
  const source = provider && typeof provider === "object" && !Array.isArray(provider) ? provider : {};
  const normalized = {
    kind: normalizeText(source.kind),
    label: normalizeText(source.label),
    model: normalizeText(source.model),
    display: normalizeText(source.display)
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeTargetEntry(entry) {
  const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
  const normalized = {
    machine: normalizeText(source.machine),
    manual_override: normalizeText(source.manual_override),
    machine_updated_at: normalizeText(source.machine_updated_at) || null,
    manual_updated_at: normalizeText(source.manual_updated_at) || null,
    provider: normalizeProvider(source.provider)
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeMemoryItem(item, key = "") {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const sourceText = normalizeText(source.source_text);
  if (!sourceText) return null;
  const itemKey = normalizeText(key) || translationMemorySourceKey(sourceText);
  const targets = {};
  const rawTargets = source.targets && typeof source.targets === "object" && !Array.isArray(source.targets)
    ? source.targets
    : {};
  for (const [lang, targetEntry] of Object.entries(rawTargets)) {
    const normalizedLang = normalizeText(lang).toLowerCase();
    const normalizedTarget = normalizeTargetEntry(targetEntry);
    if (normalizedLang && normalizedTarget) targets[normalizedLang] = normalizedTarget;
  }
  return {
    key: itemKey,
    value: {
      source_text: sourceText,
      targets,
      created_at: normalizeText(source.created_at) || null,
      updated_at: normalizeText(source.updated_at) || null
    }
  };
}

function normalizeTranslationMemoryDocument(payload = {}) {
  const items = {};
  const rawItems = payload?.items && typeof payload.items === "object" && !Array.isArray(payload.items)
    ? payload.items
    : {};
  for (const [key, item] of Object.entries(rawItems)) {
    const normalized = normalizeMemoryItem(item, key);
    if (normalized) items[normalized.key] = normalized.value;
  }
  return {
    items,
    updated_at: normalizeText(payload?.updated_at) || null
  };
}

function emptyDocument() {
  return {
    items: {},
    updated_at: null
  };
}

function stableDocument(document) {
  const normalized = normalizeTranslationMemoryDocument(document);
  const orderedItems = {};
  for (const [key, item] of Object.entries(normalized.items).sort(([, left], [, right]) => (
    normalizeText(left.source_text).localeCompare(normalizeText(right.source_text), "en", { sensitivity: "base" })
  ))) {
    const orderedTargets = {};
    for (const [lang, target] of Object.entries(item.targets || {}).sort(([leftLang], [rightLang]) => leftLang.localeCompare(rightLang))) {
      orderedTargets[lang] = target;
    }
    orderedItems[key] = {
      ...item,
      targets: orderedTargets
    };
  }
  return {
    items: orderedItems,
    updated_at: normalized.updated_at
  };
}

export function createTranslationMemoryStore({ dataPath, writeQueueRef, nowIso }) {
  if (!dataPath) throw new Error("createTranslationMemoryStore requires dataPath.");
  const queueRef = writeQueueRef || { current: Promise.resolve() };
  const timestamp = typeof nowIso === "function" ? nowIso : () => new Date().toISOString();

  async function readRawDocument() {
    try {
      const raw = await readFile(dataPath, "utf8");
      return {
        document: normalizeTranslationMemoryDocument(JSON.parse(raw)),
        raw
      };
    } catch (error) {
      if (error?.code === "ENOENT") {
        return {
          document: emptyDocument(),
          raw: ""
        };
      }
      throw error;
    }
  }

  async function writeDocument(document) {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await writeFile(dataPath, `${JSON.stringify(stableDocument(document), null, 2)}\n`, "utf8");
  }

  async function mutateDocument(mutator) {
    const operation = queueRef.current.catch(() => {}).then(async () => {
      const { document, raw } = await readRawDocument();
      const revision = sha256(raw);
      const result = await mutator(document, revision);
      if (result?.document) {
        await writeDocument(result.document);
      }
      return result?.value;
    });
    queueRef.current = operation.catch(() => {});
    return operation;
  }

  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    try {
      await readFile(dataPath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await writeDocument(emptyDocument());
    }
  }

  async function readTranslationMemory() {
    const { document, raw } = await readRawDocument();
    return {
      ...document,
      revision: sha256(raw)
    };
  }

  async function resolveEntries(entries, targetLang) {
    const memory = await readTranslationMemory();
    const normalizedTargetLang = normalizeText(targetLang).toLowerCase();
    const resolved = {};
    const origins = {};
    for (const [entryKey, sourceValue] of Object.entries(entries || {})) {
      const sourceText = normalizeText(sourceValue);
      if (!entryKey || !sourceText || !normalizedTargetLang) continue;
      const target = memory.items?.[translationMemorySourceKey(sourceText)]?.targets?.[normalizedTargetLang] || {};
      const manual = normalizeText(target.manual_override);
      const machine = normalizeText(target.machine);
      if (manual) {
        resolved[entryKey] = manual;
        origins[entryKey] = "manual_override";
      } else if (machine) {
        resolved[entryKey] = machine;
        origins[entryKey] = "machine";
      }
    }
    return { entries: resolved, origins };
  }

  async function writeMachineTranslations(entries, translatedEntries, targetLang, provider = null) {
    const normalizedTargetLang = normalizeText(targetLang).toLowerCase();
    const normalizedProvider = normalizeProvider(provider);
    if (!normalizedTargetLang) return readTranslationMemory();
    return mutateDocument(async (document) => {
      const now = timestamp();
      const next = normalizeTranslationMemoryDocument(document);
      for (const [entryKey, translatedValue] of Object.entries(translatedEntries || {})) {
        const sourceText = normalizeText(entries?.[entryKey]);
        const machine = normalizeText(translatedValue);
        if (!sourceText || !machine) continue;
        const itemKey = translationMemorySourceKey(sourceText);
        const item = next.items[itemKey] || {
          source_text: sourceText,
          targets: {},
          created_at: now,
          updated_at: null
        };
        const target = item.targets[normalizedTargetLang] || {};
        item.targets[normalizedTargetLang] = {
          ...target,
          machine,
          machine_updated_at: now,
          provider: normalizedProvider
        };
        item.updated_at = now;
        next.items[itemKey] = item;
      }
      next.updated_at = now;
      return {
        document: next,
        value: stableDocument(next)
      };
    });
  }

  async function patchManualOverrides(targetLang, updates, { expectedRevision = "" } = {}) {
    const normalizedTargetLang = normalizeText(targetLang).toLowerCase();
    if (!normalizedTargetLang) return readTranslationMemory();
    return mutateDocument(async (document, revision) => {
      if (expectedRevision && expectedRevision !== revision) {
        const error = new Error("Translation memory changed. Refresh and retry.");
        error.status = 409;
        error.code = "TRANSLATION_MEMORY_REVISION_MISMATCH";
        throw error;
      }
      const now = timestamp();
      const next = normalizeTranslationMemoryDocument(document);
      for (const update of Array.isArray(updates) ? updates : []) {
        const sourceText = normalizeText(update?.source_text);
        if (!sourceText) continue;
        const itemKey = translationMemorySourceKey(sourceText);
        const item = next.items[itemKey] || {
          source_text: sourceText,
          targets: {},
          created_at: now,
          updated_at: null
        };
        const target = item.targets[normalizedTargetLang] || {};
        const manual = normalizeText(update?.manual_override);
        if (manual) {
          item.targets[normalizedTargetLang] = {
            ...target,
            manual_override: manual,
            manual_updated_at: now
          };
        } else {
          const nextTarget = { ...target };
          delete nextTarget.manual_override;
          delete nextTarget.manual_updated_at;
          const normalizedTarget = normalizeTargetEntry(nextTarget);
          if (normalizedTarget) item.targets[normalizedTargetLang] = normalizedTarget;
          else delete item.targets[normalizedTargetLang];
        }
        item.updated_at = now;
        next.items[itemKey] = item;
      }
      next.updated_at = now;
      return {
        document: next,
        value: stableDocument(next)
      };
    });
  }

  return {
    ensureStorage,
    readTranslationMemory,
    resolveEntries,
    writeMachineTranslations,
    patchManualOverrides
  };
}
