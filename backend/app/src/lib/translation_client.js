import { createHash } from "node:crypto";
import { normalizeText } from "./text.js";
import { normalizeLanguageCode, promptLanguageName } from "../../../../shared/generated/language_catalog.js";
import { resolveTranslationProfileOptions } from "./translation_profiles.js";
import { translationRulesForTargetLang } from "./translation_rules.js";

function nowMs() {
  return Date.now();
}

function durationMs(startMs) {
  return Math.max(0, nowMs() - Number(startMs || 0));
}

function waitMs(delayMs) {
  const normalizedDelayMs = Math.max(0, Number(delayMs || 0));
  if (!normalizedDelayMs) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, normalizedDelayMs));
}

async function mapWithConcurrency(items, concurrency, worker) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedConcurrency = Math.max(1, Math.min(normalizedItems.length || 1, Math.trunc(Number(concurrency) || 1)));
  const results = new Array(normalizedItems.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: normalizedConcurrency }, async () => {
    while (nextIndex < normalizedItems.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(normalizedItems[index], index);
    }
  }));
  return results;
}

function summarizeEntries(entries) {
  const normalizedEntries = Object.entries(entries || {})
    .map(([key, value]) => [normalizeText(key), normalizeText(value)])
    .filter(([key, value]) => Boolean(key && value));
  return {
    entryCount: normalizedEntries.length,
    totalChars: normalizedEntries.reduce((sum, [key, value]) => sum + key.length + value.length, 0)
  };
}

function logTranslationTiming(event, details = {}) {
  const payload = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );
  console.log(`[backend-translation] ${event}`, payload);
}

function parseJsonObject(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const withoutCodeFence = normalized
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(withoutCodeFence);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = withoutCodeFence.indexOf("{");
    const end = withoutCodeFence.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(withoutCodeFence.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function buildChunkJsonSchema(chunkPayload) {
  const keys = Object.keys(chunkPayload || {});
  return {
    type: "json_schema",
    name: "translation_chunk",
    strict: true,
    schema: {
      type: "object",
      properties: Object.fromEntries(keys.map((key) => [key, { type: "string" }])),
      required: keys,
      additionalProperties: false
    }
  };
}

function extractResponseOutputText(payload) {
  const direct = normalizeText(payload?.output_text);
  if (direct) return direct;

  const items = Array.isArray(payload?.output) ? payload.output : [];
  const parts = [];
  for (const item of items) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const entry of content) {
      const text = normalizeText(entry?.text || entry?.value);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n").trim();
}

function chunkEntries(entries, { maxEntries = 40, maxChars = 7000 } = {}) {
  const chunks = [];
  let current = [];
  let currentChars = 0;
  for (const entry of entries) {
    const entryChars = String(entry?.[0] || "").length + String(entry?.[1] || "").length;
    if (current.length && (current.length >= maxEntries || currentChars + entryChars > maxChars)) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(entry);
    currentChars += entryChars;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function googleTranslateLangCode(value, fallback = "en") {
  const normalized = normalizeLanguageCode(value, { fallback });
  if (normalized === "zh") return "zh-CN";
  return normalized;
}

function googleProviderMeta() {
  return Object.freeze({
    kind: "google",
    label: "Google Translate",
    model: "",
    display: "google"
  });
}

function openAiProviderMeta(model) {
  const normalizedModel = normalizeText(model);
  return Object.freeze({
    kind: "openai",
    label: normalizedModel ? `OpenAI (${normalizedModel})` : "OpenAI",
    model: normalizedModel,
    display: normalizedModel
  });
}

function extractGoogleTranslatedText(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  const parts = payload[0]
    .map((segment) => String(Array.isArray(segment) ? (segment[0] ?? "") : ""))
    .map((segment) => segment.trim())
    .filter(Boolean);

  let combined = "";
  for (const part of parts) {
    if (!combined) {
      combined = part;
      continue;
    }
    const needsSpace = !/\s$/.test(combined) && !/^\s/.test(part) && /[.!?;:)\]»”’]$/.test(combined);
    combined += needsSpace ? ` ${part}` : part;
  }
  return combined;
}

function stableEntriesObject(entries) {
  return Object.fromEntries(
    Object.entries(entries || {})
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => Boolean(key && value))
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, "en", { sensitivity: "base" }))
  );
}

function cloneTranslationResult(result) {
  return {
    entries: { ...(result?.entries || {}) },
    provider: result?.provider
      ? {
          kind: normalizeText(result.provider.kind),
          label: normalizeText(result.provider.label),
          model: normalizeText(result.provider.model),
          display: normalizeText(result.provider.display)
        }
      : null
  };
}

function buildTranslationRulePrompt(rule) {
  return `${JSON.stringify(normalizeText(rule?.source))} => ${JSON.stringify(normalizeText(rule?.target))}`;
}

function prepareEntriesWithTranslationRules(entries, targetLang, translationRules) {
  const applicableRules = translationRulesForTargetLang(translationRules, targetLang);
  const exactEntries = {};
  const providerEntries = {};
  const replacementsByKey = {};
  const exactOverrideBySource = new Map(applicableRules.map((rule) => [rule.source, rule.target]));
  let placeholderCounter = 0;

  for (const [key, value] of Object.entries(entries || {})) {
    const sourceText = normalizeText(value);
    if (!sourceText) continue;
    const exactOverride = exactOverrideBySource.get(sourceText);
    if (exactOverride) {
      exactEntries[key] = exactOverride;
      continue;
    }

    let maskedSourceText = sourceText;
    const replacements = [];
    for (const rule of applicableRules) {
      if (!rule.source || !maskedSourceText.includes(rule.source)) continue;
      const placeholder = `[[ATP_TRANSLATION_RULE_${placeholderCounter}]]`;
      placeholderCounter += 1;
      maskedSourceText = maskedSourceText.split(rule.source).join(placeholder);
      replacements.push({
        placeholder,
        target: rule.target
      });
    }

    providerEntries[key] = maskedSourceText;
    replacementsByKey[key] = replacements;
  }

  return {
    applicableRules,
    exactEntries,
    providerEntries,
    replacementsByKey
  };
}

function restoreMaskedTranslationValue(value, replacements) {
  let restored = normalizeText(value);
  for (const replacement of Array.isArray(replacements) ? replacements : []) {
    const placeholder = normalizeText(replacement?.placeholder);
    const target = normalizeText(replacement?.target);
    if (!placeholder || !target) continue;
    restored = restored.split(placeholder).join(target);
  }
  return restored;
}

function finalizePreparedTranslation(preparedTranslation, translatedEntries = {}) {
  const finalized = { ...(preparedTranslation?.exactEntries || {}) };
  for (const [key] of Object.entries(preparedTranslation?.providerEntries || {})) {
    const translatedValue = restoreMaskedTranslationValue(
      translatedEntries[key],
      preparedTranslation?.replacementsByKey?.[key]
    );
    if (!translatedValue) continue;
    finalized[key] = translatedValue;
  }
  return stableEntriesObject(finalized);
}

export function createTranslationClient({
  apiKey,
  model = "gpt-4o-mini",
  organizationId = "",
  projectId = "",
  googleFallbackEnabled = true,
  googleRetryMaxAttempts = 3,
  googleRetryBaseDelayMs = 250,
  googleConcurrency = 4
} = {}) {
  const normalizedApiKey = normalizeText(apiKey);
  const normalizedModel = normalizeText(model) || "gpt-4o-mini";
  const normalizedOrganizationId = normalizeText(organizationId);
  const normalizedProjectId = normalizeText(projectId);
  const allowGoogleFallbackByDefault = googleFallbackEnabled !== false;
  const googleRetryAttempts = Math.max(1, Math.trunc(Number(googleRetryMaxAttempts) || 0) || 3);
  const googleRetryDelayBaseMs = Math.max(0, Number(googleRetryBaseDelayMs || 0));
  const googleMaxConcurrency = Math.max(1, Math.min(12, Math.trunc(Number(googleConcurrency) || 0) || 4));
  const translationCache = new Map();
  const MAX_TRANSLATION_CACHE_ENTRIES = 2500;

  function googleRetryDelayMs(attempt) {
    return googleRetryDelayBaseMs * (2 ** Math.max(0, Number(attempt || 1) - 1));
  }

  function shouldRetryGoogleTranslationError(error) {
    const errorCode = normalizeText(error?.code);
    const httpStatus = Number(error?.httpStatus || error?.status || 0);
    if (httpStatus === 429 || httpStatus >= 500) return true;
    return !httpStatus && (
      errorCode === "TRANSLATION_REQUEST_FAILED"
      || errorCode === "TRANSLATION_INVALID_RESPONSE"
      || !errorCode
    );
  }

  function translationCacheContext(targetLang, options = {}, applicableRules = []) {
    const namespace = normalizeText(options?.cacheNamespace);
    if (!namespace) return null;
    const sourceLangCode = googleTranslateLangCode(options?.sourceLangCode || "en", "en");
    const targetLangCode = googleTranslateLangCode(targetLang, "en");
    const profileOptions = resolveTranslationProfileOptions(options);
    const promptFingerprint = createHash("sha256")
      .update(JSON.stringify({
        profile: profileOptions.profile,
        domain: profileOptions.domain,
        context: profileOptions.context,
        glossary_terms: profileOptions.glossaryTerms,
        protected_terms: profileOptions.protectedTerms,
        translation_rules: applicableRules
      }))
      .digest("hex");
    return {
      namespace,
      sourceLangCode,
      targetLangCode,
      profile: profileOptions.profile || "default",
      promptFingerprint
    };
  }

  function translationCacheKey(entries, targetLang, options = {}, applicableRules = []) {
    const context = translationCacheContext(targetLang, options, applicableRules);
    if (!context) return "";
    const sourceHash = createHash("sha256")
      .update(JSON.stringify(stableEntriesObject(entries)))
      .digest("hex");
    return `${context.namespace}:request:${context.sourceLangCode}:${context.targetLangCode}:${context.profile}:${context.promptFingerprint}:${sourceHash}`;
  }

  function translationEntryCacheKey(sourceText, cacheContext) {
    const normalizedSourceText = normalizeText(sourceText);
    if (!cacheContext || !normalizedSourceText) return "";
    const sourceHash = createHash("sha256").update(normalizedSourceText).digest("hex");
    return `${cacheContext.namespace}:entry:${cacheContext.sourceLangCode}:${cacheContext.targetLangCode}:${cacheContext.profile}:${cacheContext.promptFingerprint}:${sourceHash}`;
  }

  function readCachedTranslation(cacheKey) {
    if (!cacheKey) return null;
    const cached = translationCache.get(cacheKey);
    if (!cached) return null;
    translationCache.delete(cacheKey);
    translationCache.set(cacheKey, cached);
    return cloneTranslationResult(cached);
  }

  function writeCachedTranslation(cacheKey, result) {
    if (!cacheKey) return cloneTranslationResult(result);
    const cachedResult = cloneTranslationResult(result);
    if (translationCache.has(cacheKey)) {
      translationCache.delete(cacheKey);
    }
    translationCache.set(cacheKey, cachedResult);
    while (translationCache.size > MAX_TRANSLATION_CACHE_ENTRIES) {
      const oldestKey = translationCache.keys().next().value;
      if (!oldestKey) break;
      translationCache.delete(oldestKey);
    }
    return cloneTranslationResult(cachedResult);
  }

  function readCachedTranslationEntry(cacheKey) {
    if (!cacheKey) return "";
    const cached = translationCache.get(cacheKey);
    const normalized = normalizeText(cached);
    if (!normalized) return "";
    translationCache.delete(cacheKey);
    translationCache.set(cacheKey, normalized);
    return normalized;
  }

  function writeCachedTranslationEntry(cacheKey, value) {
    const normalized = normalizeText(value);
    if (!cacheKey || !normalized) return;
    if (translationCache.has(cacheKey)) {
      translationCache.delete(cacheKey);
    }
    translationCache.set(cacheKey, normalized);
    while (translationCache.size > MAX_TRANSLATION_CACHE_ENTRIES) {
      const oldestKey = translationCache.keys().next().value;
      if (!oldestKey) break;
      translationCache.delete(oldestKey);
    }
  }

  function splitPreparedTranslationByEntryCache(preparedTranslation, sourceEntries, cacheContext) {
    const providerEntries = stableEntriesObject(preparedTranslation?.providerEntries || {});
    const cachedEntries = {};
    const missingProviderEntries = {};
    let hitCount = 0;
    for (const [key, providerSourceText] of Object.entries(providerEntries)) {
      const sourceText = normalizeText(sourceEntries?.[key]) || providerSourceText;
      const cachedText = readCachedTranslationEntry(translationEntryCacheKey(sourceText, cacheContext));
      if (cachedText) {
        cachedEntries[key] = cachedText;
        hitCount += 1;
      } else {
        missingProviderEntries[key] = providerSourceText;
      }
    }
    return {
      cachedEntries,
      missingProviderEntries,
      hitCount
    };
  }

  function writeCachedTranslationEntries(entries, sourceEntries, cacheContext) {
    if (!cacheContext) return;
    for (const [key, translatedText] of Object.entries(entries || {})) {
      const sourceText = normalizeText(sourceEntries?.[key]);
      writeCachedTranslationEntry(translationEntryCacheKey(sourceText, cacheContext), translatedText);
    }
  }

  async function translateEntriesWithGoogle(preparedTranslation, targetLang, options = {}) {
    const sourceLangCode = googleTranslateLangCode(options?.sourceLangCode || "en", "en");
    const targetLangCode = googleTranslateLangCode(targetLang, "en");
    const traceId = normalizeText(options?.traceId);
    const totalStartMs = nowMs();
    const entries = stableEntriesObject(preparedTranslation?.providerEntries || {});
    const exactEntryCount = Object.keys(preparedTranslation?.exactEntries || {}).length;
    if (!Object.keys(entries).length) {
      return {
        entries: finalizePreparedTranslation(preparedTranslation, {}),
        provider: null
      };
    }
    const translated = {};
    const entryStats = summarizeEntries(entries);

    logTranslationTiming("Google translation started", {
      trace_id: traceId,
      source_lang: sourceLangCode,
      target_lang: targetLangCode,
      entry_count: entryStats.entryCount,
      total_chars: entryStats.totalChars,
      exact_override_count: exactEntryCount
    });

    await mapWithConcurrency(Object.entries(entries || {}), googleMaxConcurrency, async ([key, value]) => {
      const sourceText = normalizeText(value);
      if (!sourceText) return;
      const params = new URLSearchParams({
        client: "gtx",
        sl: sourceLangCode,
        tl: targetLangCode,
        dt: "t",
        q: sourceText
      });
      const requestUrl = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
      for (let attempt = 1; attempt <= googleRetryAttempts; attempt += 1) {
        const requestStartMs = nowMs();
        try {
          const response = await fetch(requestUrl);
          if (!response.ok) {
            const error = new Error(`Google translation request failed with HTTP ${response.status}.`);
            error.code = "TRANSLATION_REQUEST_FAILED";
            error.httpStatus = response.status;
            throw error;
          }
          const payload = await response.json();
          const translatedText = extractGoogleTranslatedText(payload);
          if (!translatedText) {
            const error = new Error("Google translation provider returned an invalid response.");
            error.code = "TRANSLATION_INVALID_RESPONSE";
            throw error;
          }
          translated[key] = translatedText;
          logTranslationTiming("Google translation entry finished", {
            trace_id: traceId,
            source_lang: sourceLangCode,
            target_lang: targetLangCode,
            key,
            chars: sourceText.length,
            attempt,
            duration_ms: durationMs(requestStartMs)
          });
          break;
        } catch (error) {
          const shouldRetry = attempt < googleRetryAttempts && shouldRetryGoogleTranslationError(error);
          const retryDelayMs = shouldRetry ? googleRetryDelayMs(attempt) : undefined;
          logTranslationTiming(
            shouldRetry ? "Google translation entry failed, retrying" : "Google translation entry failed",
            {
              trace_id: traceId,
              source_lang: sourceLangCode,
              target_lang: targetLangCode,
              key,
              chars: sourceText.length,
              attempt,
              max_attempts: googleRetryAttempts,
              http_status: Number(error?.httpStatus || error?.status || 0) || undefined,
              error_code: normalizeText(error?.code),
              error: String(error?.message || error || "Translation failed."),
              duration_ms: durationMs(requestStartMs),
              retry_delay_ms: retryDelayMs
            }
          );
          if (!shouldRetry) throw error;
          await waitMs(retryDelayMs);
        }
      }
    });

    logTranslationTiming("Google translation finished", {
      trace_id: traceId,
      source_lang: sourceLangCode,
      target_lang: targetLangCode,
      entry_count: Object.keys(translated).length,
      exact_override_count: exactEntryCount,
      duration_ms: durationMs(totalStartMs)
    });

    return {
      entries: finalizePreparedTranslation(preparedTranslation, translated),
      provider: googleProviderMeta()
    };
  }

  async function translateEntriesWithMeta(entries, targetLang, options = {}) {
    const normalizedEntries = Object.entries(stableEntriesObject(entries));

    if (!normalizedEntries.length) {
      return {
        entries: {},
        provider: null
      };
    }

    const normalizedEntriesObject = Object.fromEntries(normalizedEntries);
    const allowGoogleFallback = Boolean(options?.allowGoogleFallback) && allowGoogleFallbackByDefault;
    const forceGoogleProvider = normalizeText(options?.provider).toLowerCase() === "google";
    const profileOptions = resolveTranslationProfileOptions(options);
    const preparedTranslation = prepareEntriesWithTranslationRules(
      normalizedEntriesObject,
      targetLang,
      options?.translationRules
    );
    const cacheKey = translationCacheKey(
      normalizedEntriesObject,
      targetLang,
      options,
      preparedTranslation.applicableRules
    );
    const cacheContext = translationCacheContext(targetLang, options, preparedTranslation.applicableRules);
    const cachedResult = readCachedTranslation(cacheKey);
    if (cachedResult) {
      logTranslationTiming("Translation cache hit", {
        trace_id: normalizeText(options?.traceId),
        cache_namespace: normalizeText(options?.cacheNamespace),
        translation_profile: profileOptions.profile || "",
        source_lang: googleTranslateLangCode(options?.sourceLangCode || "en", "en"),
        target_lang: googleTranslateLangCode(targetLang, "en"),
        translation_rule_count: preparedTranslation.applicableRules.length
      });
      return cachedResult;
    }

    const entryCacheSplit = splitPreparedTranslationByEntryCache(
      preparedTranslation,
      normalizedEntriesObject,
      cacheContext
    );
    if (entryCacheSplit.hitCount) {
      logTranslationTiming("Translation entry cache hits", {
        trace_id: normalizeText(options?.traceId),
        cache_namespace: normalizeText(options?.cacheNamespace),
        translation_profile: profileOptions.profile || "",
        source_lang: googleTranslateLangCode(options?.sourceLangCode || "en", "en"),
        target_lang: googleTranslateLangCode(targetLang, "en"),
        hit_count: entryCacheSplit.hitCount,
        miss_count: Object.keys(entryCacheSplit.missingProviderEntries).length
      });
    }

    const providerPreparedTranslation = {
      ...preparedTranslation,
      exactEntries: {},
      providerEntries: entryCacheSplit.missingProviderEntries
    };

    const completeTranslationResult = (providerResult) => {
      const providerEntries = stableEntriesObject(providerResult?.entries || {});
      writeCachedTranslationEntries(providerEntries, normalizedEntriesObject, cacheContext);
      return writeCachedTranslation(cacheKey, {
        entries: stableEntriesObject({
          ...preparedTranslation.exactEntries,
          ...entryCacheSplit.cachedEntries,
          ...providerEntries
        }),
        provider: providerResult?.provider || null
      });
    };

    const translateWithGoogleAndCache = async () => (
      completeTranslationResult(await translateEntriesWithGoogle(providerPreparedTranslation, targetLang, options))
    );

    if (forceGoogleProvider) {
      return translateWithGoogleAndCache();
    }

    if (!normalizedApiKey) {
      if (allowGoogleFallback) {
        return translateWithGoogleAndCache();
      }
      const error = new Error("Translation provider is not configured. Set OPENAI_API_KEY.");
      error.code = "TRANSLATION_NOT_CONFIGURED";
      throw error;
    }

    const sourceLang = normalizeText(options?.sourceLang)
      || promptLanguageName(options?.sourceLangCode, "English")
      || "English";
    const domainLabel = profileOptions.domain;
    const contextNote = profileOptions.context;
    const targetLanguageName = promptLanguageName(targetLang, "English");
    const glossaryTerms = profileOptions.glossaryTerms;
    const protectedTerms = profileOptions.protectedTerms;
    const translationRulePrompts = preparedTranslation.applicableRules.map(buildTranslationRulePrompt);
    const entriesToTranslate = Object.entries(stableEntriesObject(providerPreparedTranslation.providerEntries || {}));
    if (!entriesToTranslate.length) {
      return completeTranslationResult({
        entries: {},
        provider: null
      });
    }
    const chunks = chunkEntries(entriesToTranslate);
    const onChunkStart = typeof options?.onChunkStart === "function" ? options.onChunkStart : null;
    const traceId = normalizeText(options?.traceId);
    const totalStartMs = nowMs();
    const entryStats = summarizeEntries(Object.fromEntries(entriesToTranslate));
    const translated = {};
    let translatedCount = 0;

    logTranslationTiming("OpenAI translation started", {
      trace_id: traceId,
      model: normalizedModel,
      translation_profile: profileOptions.profile || "",
      source_lang: sourceLang,
      target_lang: targetLanguageName,
      domain: domainLabel,
      entry_count: entryStats.entryCount,
      total_chars: entryStats.totalChars,
      chunk_count: chunks.length,
      exact_override_count: Object.keys(preparedTranslation.exactEntries).length,
      translation_rule_count: preparedTranslation.applicableRules.length
    });

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      const chunkPayload = Object.fromEntries(chunk);
      const chunkStartMs = nowMs();
      if (onChunkStart) {
        onChunkStart({
          chunkIndex,
          totalChunks: chunks.length,
          startIndex: translatedCount,
          totalEntries: entriesToTranslate.length,
          keys: chunk.map(([key]) => key)
        });
      }
      logTranslationTiming("OpenAI translation chunk started", {
        trace_id: traceId,
        model: normalizedModel,
        chunk_index: chunkIndex + 1,
        total_chunks: chunks.length,
        entry_count: chunk.length,
        keys: chunk.map(([key]) => key)
      });
      const responseStartMs = nowMs();
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${normalizedApiKey}`,
          "Content-Type": "application/json",
          ...(normalizedOrganizationId ? { "OpenAI-Organization": normalizedOrganizationId } : {}),
          ...(normalizedProjectId ? { "OpenAI-Project": normalizedProjectId } : {})
        },
        body: JSON.stringify({
          model: normalizedModel,
          instructions: [
            `You translate ${domainLabel} copy from ${sourceLang} into ${targetLanguageName}.`,
            contextNote ? `Context: ${contextNote}` : "",
            glossaryTerms.length
              ? `Glossary and term guidance:\n- ${glossaryTerms.join("\n- ")}`
              : "",
            protectedTerms.length
              ? `Do not translate or rewrite these names and terms when they appear in the source unless the source already localizes them: ${protectedTerms.join(", ")}.`
              : "",
            translationRulePrompts.length
              ? `Apply these translation overrides exactly when they match the source text or appear inside it:\n- ${translationRulePrompts.join("\n- ")}`
              : "",
            "Return JSON only.",
            "Keep the exact same keys.",
            "Preserve line breaks and blank lines within each value exactly.",
            "Preserve placeholder tokens such as [[ATP_TRANSLATION_RULE_0]] exactly when they appear.",
            "Preserve proper nouns, brand names, phone numbers, ISO codes, URLs, and currency codes unless a natural translation requires otherwise.",
            "Do not add explanations."
          ].filter(Boolean).join(" "),
          input: JSON.stringify(chunkPayload),
          text: {
            format: buildChunkJsonSchema(chunkPayload)
          }
        })
      });
      const responseDurationMs = durationMs(responseStartMs);

      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = normalizeText(payload?.error?.message || payload?.message || payload?.detail);
        } catch {
          // Ignore unreadable error bodies.
        }
        if (allowGoogleFallback) {
          logTranslationTiming("OpenAI translation chunk failed, falling back to Google", {
            trace_id: traceId,
            model: normalizedModel,
            translation_profile: profileOptions.profile || "",
            chunk_index: chunkIndex + 1,
            total_chunks: chunks.length,
            http_status: response.status,
            openai_duration_ms: responseDurationMs
          });
          return translateWithGoogleAndCache();
        }
        const error = new Error(detail || `Translation request failed with HTTP ${response.status}.`);
        error.code = "TRANSLATION_REQUEST_FAILED";
        throw error;
      }

      const parseStartMs = nowMs();
      const payload = await response.json();
      const parsed = parseJsonObject(extractResponseOutputText(payload));
      const parseDurationMs = durationMs(parseStartMs);
      if (!parsed) {
        if (allowGoogleFallback) {
          logTranslationTiming("OpenAI translation chunk returned invalid JSON, falling back to Google", {
            trace_id: traceId,
            model: normalizedModel,
            translation_profile: profileOptions.profile || "",
            chunk_index: chunkIndex + 1,
            total_chunks: chunks.length,
            openai_duration_ms: responseDurationMs,
            parse_duration_ms: parseDurationMs
          });
          return translateWithGoogleAndCache();
        }
        const error = new Error("Translation provider returned an invalid JSON response.");
        error.code = "TRANSLATION_INVALID_RESPONSE";
        throw error;
      }

      for (const [key] of chunk) {
        translated[key] = normalizeText(parsed[key]);
      }
      translatedCount += chunk.length;
      logTranslationTiming("OpenAI translation chunk finished", {
        trace_id: traceId,
        model: normalizedModel,
        translation_profile: profileOptions.profile || "",
        chunk_index: chunkIndex + 1,
        total_chunks: chunks.length,
        entry_count: chunk.length,
        http_duration_ms: responseDurationMs,
        parse_duration_ms: parseDurationMs,
        chunk_duration_ms: durationMs(chunkStartMs)
      });
    }

    logTranslationTiming("OpenAI translation finished", {
      trace_id: traceId,
      model: normalizedModel,
      translation_profile: profileOptions.profile || "",
      source_lang: sourceLang,
      target_lang: targetLanguageName,
      translated_count: translatedCount,
      exact_override_count: Object.keys(preparedTranslation.exactEntries).length,
      translation_rule_count: preparedTranslation.applicableRules.length,
      duration_ms: durationMs(totalStartMs)
    });

    return completeTranslationResult({
      entries: finalizePreparedTranslation(providerPreparedTranslation, translated),
      provider: openAiProviderMeta(normalizedModel)
    });
  }

  async function translateEntries(entries, targetLang, options = {}) {
    const result = await translateEntriesWithMeta(entries, targetLang, options);
    return result.entries;
  }

  return {
    translateEntries,
    translateEntriesWithMeta
  };
}
