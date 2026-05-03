import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_TRANSLATION_PROTECTED_TERMS,
  normalizeStoredTranslationProtectedTerms,
  normalizeTranslationProtectedTerms
} from "./translation_protected_terms.js";
import { normalizeText } from "./text.js";

export function createTranslationProtectedTermsStore({
  dataPath,
  writeQueueRef,
  nowIso,
  initialItems = DEFAULT_TRANSLATION_PROTECTED_TERMS
}) {
  const normalizedInitialItems = normalizeTranslationProtectedTerms(initialItems);

  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    try {
      await readFile(dataPath, "utf8");
    } catch {
      await writeFile(dataPath, `${JSON.stringify({
        items: normalizedInitialItems,
        updated_at: null
      }, null, 2)}\n`, "utf8");
    }
  }

  async function readTranslationProtectedTerms() {
    const raw = await readFile(dataPath, "utf8");
    return normalizeStoredTranslationProtectedTerms(JSON.parse(raw));
  }

  async function persistTranslationProtectedTerms(payload) {
    const normalized = normalizeStoredTranslationProtectedTerms({
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
    readTranslationProtectedTerms,
    persistTranslationProtectedTerms
  };
}
