import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text.js";
import { normalizeTranslationRules } from "./translation_rules.js";

function normalizeStoredTranslationRules(payload) {
  const updatedAt = normalizeText(payload?.updated_at) || null;
  return {
    items: normalizeTranslationRules(payload?.items),
    updated_at: updatedAt
  };
}

export function createTranslationRulesStore({ dataPath, writeQueueRef, nowIso }) {
  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    try {
      await readFile(dataPath, "utf8");
    } catch {
      await writeFile(dataPath, `${JSON.stringify({
        items: [],
        updated_at: null
      }, null, 2)}\n`, "utf8");
    }
  }

  async function readTranslationRules() {
    const raw = await readFile(dataPath, "utf8");
    return normalizeStoredTranslationRules(JSON.parse(raw));
  }

  async function persistTranslationRules(payload) {
    const normalized = normalizeStoredTranslationRules({
      ...payload,
      updated_at: normalizeText(payload?.updated_at) || nowIso()
    });
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await writeFile(dataPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
    return normalized;
  }

  return {
    ensureStorage,
    readTranslationRules,
    persistTranslationRules
  };
}
