#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FRONTEND_LANGUAGE_CODES,
  promptLanguageName
} from "../shared/generated/language_catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const FRONTEND_I18N_DIR = path.join(ROOT, "frontend", "data", "i18n", "frontend");
const FRONTEND_I18N_META_DIR = path.join(ROOT, "frontend", "data", "i18n", "frontend_meta");
const FRONTEND_I18N_OVERRIDE_DIR = path.join(ROOT, "frontend", "data", "i18n", "frontend_overrides");

const DEFAULT_SOURCE_LANG = "en";
const DEFAULT_OPENAI_TRANSLATION_MODEL = "gpt-4o-mini";
const FRONTEND_TRANSLATION_CONTEXT = "AsiaTravelPlan public website for travelers planning Southeast Asia trips. Use natural, polished, customer-facing copy that feels trustworthy, clear, and concise.";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/sync_frontend_i18n.mjs check [--source en] [--target vi]",
      "  node scripts/sync_frontend_i18n.mjs translate [--source en] [--target vi] [--force-all]",
      "",
      "Notes:",
      "  - Without --target, all non-source frontend languages are processed.",
      "  - Repeat --target to limit the run to specific frontend languages."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const command = normalizeText(args.shift()).toLowerCase();
  const options = {
    sourceLang: DEFAULT_SOURCE_LANG,
    targetLangs: [],
    forceAll: false
  };

  while (args.length) {
    const token = args.shift();
    if (token === "--source") {
      options.sourceLang = normalizeText(args.shift()).toLowerCase() || DEFAULT_SOURCE_LANG;
      continue;
    }
    if (token === "--target") {
      const value = normalizeText(args.shift()).toLowerCase();
      options.targetLangs.push(...value.split(",").map((entry) => normalizeText(entry).toLowerCase()).filter(Boolean));
      continue;
    }
    if (token === "--force-all") {
      options.forceAll = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!command || !["check", "translate"].includes(command)) {
    throw new Error("Missing or unsupported command.");
  }

  return { command, options };
}

function resolveTargetLangs(sourceLang, requestedTargets) {
  const availableTargets = FRONTEND_LANGUAGE_CODES.filter((code) => code !== sourceLang);
  if (!requestedTargets.length) return availableTargets;

  const requested = unique(requestedTargets.map((value) => normalizeText(value).toLowerCase()));
  for (const targetLang of requested) {
    if (!FRONTEND_LANGUAGE_CODES.includes(targetLang)) {
      throw new Error(`Unsupported frontend language: ${targetLang}`);
    }
    if (targetLang === sourceLang) {
      throw new Error(`Source and target language must be different: ${targetLang}`);
    }
  }
  return requested;
}

function dictionaryPath(lang) {
  return path.join(FRONTEND_I18N_DIR, `${lang}.json`);
}

function metadataPath(lang) {
  return path.join(FRONTEND_I18N_META_DIR, `${lang}.json`);
}

function overridePath(lang) {
  return path.join(FRONTEND_I18N_OVERRIDE_DIR, `${lang}.json`);
}

async function readJsonFile(filePath, fallback = {}) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${filePath} must contain a JSON object.`);
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function sourceHash(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function maskTemplateTokens(text) {
  const replacements = [];
  const masked = String(text ?? "").replace(/\{[^{}]+\}/g, (match) => {
    const token = `__ATP_TEMPLATE_TOKEN_${replacements.length}__`;
    replacements.push([token, match]);
    return token;
  });
  return { masked, replacements };
}

function unmaskTemplateTokens(text, replacements) {
  let next = String(text ?? "");
  for (const [token, original] of Array.isArray(replacements) ? replacements : []) {
    next = next.split(token).join(original);
  }
  return next;
}

function orderedObjectFromSourceKeys(source, values) {
  const ordered = {};
  for (const key of Object.keys(source || {})) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      ordered[key] = values[key];
    }
  }
  return ordered;
}

function summarizeKeys(keys, limit = 8) {
  if (!keys.length) return "";
  const head = keys.slice(0, limit).join(", ");
  return keys.length > limit ? `${head}, ...` : head;
}

function normalizeOverrideEntries(source, overrides) {
  return orderedObjectFromSourceKeys(
    source,
    Object.fromEntries(
      Object.entries(overrides || {})
        .map(([key, value]) => [key, normalizeText(value)])
        .filter(([key, value]) => Boolean(key && value))
    )
  );
}

function applyManualOverrides(source, target, meta, overrides, timestamp = "") {
  const normalizedOverrides = normalizeOverrideEntries(source, overrides);
  const nextTarget = { ...(target || {}) };
  const nextMeta = { ...(meta || {}) };
  const effectiveTimestamp = normalizeText(timestamp) || new Date().toISOString();

  for (const [key, value] of Object.entries(normalizedOverrides)) {
    nextTarget[key] = value;
    nextMeta[key] = {
      source_hash: sourceHash(source[key]),
      origin: "manual_override",
      updated_at: normalizeText(nextMeta[key]?.updated_at) || effectiveTimestamp
    };
  }

  return {
    target: nextTarget,
    meta: nextMeta,
    overrideKeys: Object.keys(normalizedOverrides)
  };
}

function collectSyncState(source, target, meta) {
  const sourceKeys = Object.keys(source || {});
  const targetKeys = Object.keys(target || {});
  const metaKeys = Object.keys(meta || {});

  const missingTranslations = [];
  const staleTranslations = [];
  const missingMetadata = [];
  const extraTranslations = targetKeys.filter((key) => !Object.prototype.hasOwnProperty.call(source, key));
  const extraMetadata = metaKeys.filter((key) => !Object.prototype.hasOwnProperty.call(source, key));

  for (const key of sourceKeys) {
    const sourceValue = String(source[key] ?? "");
    const targetValue = normalizeText(target[key]);
    const metaEntry = meta[key] && typeof meta[key] === "object" && !Array.isArray(meta[key]) ? meta[key] : null;
    const expectedHash = sourceHash(sourceValue);

    if (!targetValue) {
      missingTranslations.push(key);
      continue;
    }

    if (!normalizeText(metaEntry?.source_hash)) {
      missingMetadata.push(key);
      continue;
    }

    if (normalizeText(metaEntry.source_hash) !== expectedHash) {
      staleTranslations.push(key);
    }
  }

  return {
    sourceKeys,
    missingTranslations,
    staleTranslations,
    missingMetadata,
    extraTranslations,
    extraMetadata,
    ok: !missingTranslations.length
      && !staleTranslations.length
      && !missingMetadata.length
      && !extraTranslations.length
      && !extraMetadata.length
  };
}

function printCheckSummary(targetLang, state) {
  if (state.ok) {
    console.log(`Frontend i18n is in sync for ${targetLang}.`);
    return;
  }

  console.error(`Frontend i18n sync failed for ${targetLang}.`);
  if (state.missingTranslations.length) {
    console.error(
      `- Missing translations (${state.missingTranslations.length}): ${summarizeKeys(state.missingTranslations)}`
    );
  }
  if (state.staleTranslations.length) {
    console.error(
      `- Stale translations (${state.staleTranslations.length}): ${summarizeKeys(state.staleTranslations)}`
    );
  }
  if (state.missingMetadata.length) {
    console.error(
      `- Missing metadata (${state.missingMetadata.length}): ${summarizeKeys(state.missingMetadata)}`
    );
  }
  if (state.extraTranslations.length) {
    console.error(
      `- Extra translations (${state.extraTranslations.length}): ${summarizeKeys(state.extraTranslations)}`
    );
  }
  if (state.extraMetadata.length) {
    console.error(
      `- Extra metadata entries (${state.extraMetadata.length}): ${summarizeKeys(state.extraMetadata)}`
    );
  }
  console.error(`Run: node scripts/sync_frontend_i18n.mjs translate --target ${targetLang}`);
}

async function translateEntries(sourceEntries, targetLang, sourceLang, translatorSession) {
  if (!Object.keys(sourceEntries).length) return {};

  const maskedEntries = {};
  const masksByKey = {};
  for (const [key, value] of Object.entries(sourceEntries)) {
    const mask = maskTemplateTokens(value);
    maskedEntries[key] = mask.masked;
    masksByKey[key] = mask.replacements;
  }

  const translatedMaskedEntries = await translatorSession.client.translateEntries(maskedEntries, targetLang, {
    sourceLang: promptLanguageName(sourceLang, "English"),
    sourceLangCode: sourceLang,
    domain: "ATP public website",
    context: FRONTEND_TRANSLATION_CONTEXT,
    allowGoogleFallback: translatorSession.allowGoogleFallback,
    onChunkStart({ startIndex, totalEntries, keys }) {
      keys.forEach((key, offset) => {
        console.log(`Translating [${targetLang} ${startIndex + offset + 1}/${totalEntries}] ${key}`);
      });
    }
  });

  const translated = {};
  for (const [key, value] of Object.entries(translatedMaskedEntries || {})) {
    translated[key] = unmaskTemplateTokens(value, masksByKey[key]);
  }
  return translated;
}

async function resolveTranslatorSession(targetLang, sourceLang) {
  const { createTranslationClient } = await import("../backend/app/src/lib/translation_client.js");
  const normalizedApiKey = normalizeText(process.env.OPENAI_API_KEY);
  const model = normalizeText(process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL) || DEFAULT_OPENAI_TRANSLATION_MODEL;
  const organizationId = normalizeText(process.env.OPENAI_ORGANIZATION_ID);
  const projectId = normalizeText(process.env.OPENAI_PROJECT_ID);
  const probeEntries = { __probe: "Public AsiaTravelPlan website translation check." };
  const probeOptions = {
    sourceLang: promptLanguageName(sourceLang, "English"),
    sourceLangCode: sourceLang,
    domain: "ATP public website",
    context: FRONTEND_TRANSLATION_CONTEXT
  };

  if (normalizedApiKey) {
    const openAiClient = createTranslationClient({
      apiKey: normalizedApiKey,
      model,
      organizationId,
      projectId,
      googleFallbackEnabled: false
    });
    try {
      await openAiClient.translateEntries(probeEntries, targetLang, {
        ...probeOptions,
        allowGoogleFallback: false
      });
      console.log(`Translation provider: OpenAI (${model})`);
      return {
        client: openAiClient,
        allowGoogleFallback: false
      };
    } catch (error) {
      console.warn(`OpenAI translator probe failed: ${normalizeText(error?.message) || "unknown error"}`);
      console.warn("Falling back to Google Translate.");
    }
  }

  const googleClient = createTranslationClient({
    apiKey: "",
    model,
    googleFallbackEnabled: true
  });
  await googleClient.translateEntries(probeEntries, targetLang, {
    ...probeOptions,
    allowGoogleFallback: true
  });
  console.log("Translation provider: Google Translate");
  return {
    client: googleClient,
    allowGoogleFallback: true
  };
}

async function writeJsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function runCheck(options) {
  const source = await readJsonFile(dictionaryPath(options.sourceLang));
  const targetLangs = resolveTargetLangs(options.sourceLang, options.targetLangs);
  let exitCode = 0;

  for (const targetLang of targetLangs) {
    const target = await readJsonFile(dictionaryPath(targetLang));
    const meta = await readJsonFile(metadataPath(targetLang));
    const overrides = await readJsonFile(overridePath(targetLang));
    const effective = applyManualOverrides(source, target, meta, overrides);
    const state = collectSyncState(source, effective.target, effective.meta);
    printCheckSummary(targetLang, state);
    if (!state.ok) exitCode = 1;
  }

  return exitCode;
}

async function runTranslate(options) {
  const source = await readJsonFile(dictionaryPath(options.sourceLang));
  const targetLangs = resolveTargetLangs(options.sourceLang, options.targetLangs);

  await mkdir(FRONTEND_I18N_META_DIR, { recursive: true });

  let translatorSession = null;
  let totalTranslatedKeys = 0;
  let translatedTargets = 0;
  let totalOverrideKeys = 0;

  for (const targetLang of targetLangs) {
    const target = await readJsonFile(dictionaryPath(targetLang));
    const meta = await readJsonFile(metadataPath(targetLang));
    const overrides = await readJsonFile(overridePath(targetLang));
    const effective = applyManualOverrides(source, target, meta, overrides);
    totalOverrideKeys += effective.overrideKeys.length;
    const overrideKeySet = new Set(effective.overrideKeys);
    const state = collectSyncState(source, effective.target, effective.meta);
    const translationKeys = options.forceAll
      ? Object.keys(source).filter((key) => !overrideKeySet.has(key))
      : [...new Set([...state.missingTranslations, ...state.staleTranslations])]
        .filter((key) => !overrideKeySet.has(key));
    const translationSourceEntries = Object.fromEntries(
      translationKeys.map((key) => [key, source[key]])
    );
    const translatedEntries = translationKeys.length
      ? await (async () => {
        if (!translatorSession) {
          translatorSession = await resolveTranslatorSession(targetLang, options.sourceLang);
        }
        translatedTargets += 1;
        return translateEntries(
          translationSourceEntries,
          targetLang,
          options.sourceLang,
          translatorSession
        );
      })()
      : {};
    const timestamp = new Date().toISOString();
    const nextTarget = {};
    const nextMeta = {};

    for (const key of Object.keys(source)) {
      const sourceValue = String(source[key] ?? "");
      const expectedHash = sourceHash(sourceValue);

      if (Object.prototype.hasOwnProperty.call(translatedEntries, key)) {
        nextTarget[key] = translatedEntries[key];
        nextMeta[key] = {
          source_hash: expectedHash,
          origin: "machine",
          updated_at: timestamp
        };
        continue;
      }

      const existingTargetValue = normalizeText(target[key]);
      if (!existingTargetValue) {
        throw new Error(`Translation result is missing required key for ${targetLang}: ${key}`);
      }

      const existingMeta = meta[key] && typeof meta[key] === "object" && !Array.isArray(meta[key]) ? meta[key] : {};
      nextTarget[key] = target[key];
      nextMeta[key] = {
        source_hash: expectedHash,
        origin: normalizeText(existingMeta.origin) || "legacy",
        updated_at: normalizeText(existingMeta.updated_at) || timestamp
      };
    }

    const withOverrides = applyManualOverrides(source, nextTarget, nextMeta, overrides, timestamp);
    await writeJsonFile(dictionaryPath(targetLang), orderedObjectFromSourceKeys(source, withOverrides.target));
    await writeJsonFile(metadataPath(targetLang), orderedObjectFromSourceKeys(source, withOverrides.meta));

    const nextState = collectSyncState(source, withOverrides.target, withOverrides.meta);
    if (!nextState.ok) {
      printCheckSummary(targetLang, nextState);
      return 1;
    }

    totalTranslatedKeys += translationKeys.length;
  }

  console.log(
    [
      targetLangs.length === 1
        ? `Frontend i18n synchronized for ${targetLangs[0]}.`
        : "Frontend i18n synchronized.",
      `- Targets processed: ${targetLangs.length}`,
      `- Mode: ${options.forceAll ? "full refresh" : "incremental"}`,
      `- Targets translated: ${translatedTargets}`,
      `- Translated keys: ${totalTranslatedKeys}`,
      `- Manual override keys: ${totalOverrideKeys}`,
      `- Metadata refreshed: ${Object.keys(source).length * targetLangs.length}`
    ].join("\n")
  );
  return 0;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    console.error(normalizeText(error?.message) || "Could not parse arguments.");
    process.exitCode = 2;
    return;
  }

  try {
    process.exitCode = parsed.command === "check"
      ? await runCheck(parsed.options)
      : await runTranslate(parsed.options);
  } catch (error) {
    console.error(normalizeText(error?.message) || error);
    process.exitCode = 2;
  }
}

await main();
