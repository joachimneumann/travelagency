import { normalizeText } from "./text.js";
import { normalizeLanguageCode, promptLanguageName } from "../../../../shared/generated/language_catalog.js";

function nowMs() {
  return Date.now();
}

function durationMs(startMs) {
  return Math.max(0, nowMs() - Number(startMs || 0));
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
    model: ""
  });
}

function openAiProviderMeta(model) {
  const normalizedModel = normalizeText(model);
  return Object.freeze({
    kind: "openai",
    label: normalizedModel ? `OpenAI (${normalizedModel})` : "OpenAI",
    model: normalizedModel
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

export function createTranslationClient({
  apiKey,
  model = "gpt-4o-mini",
  organizationId = "",
  projectId = "",
  googleFallbackEnabled = true
} = {}) {
  const normalizedApiKey = normalizeText(apiKey);
  const normalizedModel = normalizeText(model) || "gpt-4o-mini";
  const normalizedOrganizationId = normalizeText(organizationId);
  const normalizedProjectId = normalizeText(projectId);
  const allowGoogleFallbackByDefault = googleFallbackEnabled !== false;

  async function translateEntriesWithGoogle(entries, targetLang, options = {}) {
    const sourceLangCode = googleTranslateLangCode(options?.sourceLangCode || "en", "en");
    const targetLangCode = googleTranslateLangCode(targetLang, "en");
    const traceId = normalizeText(options?.traceId);
    const totalStartMs = nowMs();
    const translated = {};
    const entryStats = summarizeEntries(entries);

    logTranslationTiming("Google translation started", {
      trace_id: traceId,
      source_lang: sourceLangCode,
      target_lang: targetLangCode,
      entry_count: entryStats.entryCount,
      total_chars: entryStats.totalChars
    });

    for (const [key, value] of Object.entries(entries || {})) {
      const sourceText = normalizeText(value);
      if (!sourceText) continue;
      const requestStartMs = nowMs();
      const params = new URLSearchParams({
        client: "gtx",
        sl: sourceLangCode,
        tl: targetLangCode,
        dt: "t",
        q: sourceText
      });
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
      if (!response.ok) {
        const error = new Error(`Google translation request failed with HTTP ${response.status}.`);
        error.code = "TRANSLATION_REQUEST_FAILED";
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
        duration_ms: durationMs(requestStartMs)
      });
    }

    logTranslationTiming("Google translation finished", {
      trace_id: traceId,
      source_lang: sourceLangCode,
      target_lang: targetLangCode,
      entry_count: Object.keys(translated).length,
      duration_ms: durationMs(totalStartMs)
    });

    return {
      entries: translated,
      provider: googleProviderMeta()
    };
  }

  async function translateEntriesWithMeta(entries, targetLang, options = {}) {
    const normalizedEntries = Object.entries(entries || {})
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => Boolean(key && value));

    if (!normalizedEntries.length) {
      return {
        entries: {},
        provider: null
      };
    }

    const allowGoogleFallback = Boolean(options?.allowGoogleFallback) && allowGoogleFallbackByDefault;

    if (!normalizedApiKey) {
      if (allowGoogleFallback) {
        return translateEntriesWithGoogle(Object.fromEntries(normalizedEntries), targetLang, options);
      }
      const error = new Error("Translation provider is not configured. Set OPENAI_API_KEY.");
      error.code = "TRANSLATION_NOT_CONFIGURED";
      throw error;
    }

    const sourceLang = normalizeText(options?.sourceLang)
      || promptLanguageName(options?.sourceLangCode, "English")
      || "English";
    const domainLabel = normalizeText(options?.domain || "travel planning") || "travel planning";
    const contextNote = normalizeText(options?.context);
    const targetLanguageName = promptLanguageName(targetLang, "English");
    const chunks = chunkEntries(normalizedEntries);
    const onChunkStart = typeof options?.onChunkStart === "function" ? options.onChunkStart : null;
    const traceId = normalizeText(options?.traceId);
    const totalStartMs = nowMs();
    const entryStats = summarizeEntries(Object.fromEntries(normalizedEntries));
    const translated = {};
    let translatedCount = 0;

    logTranslationTiming("OpenAI translation started", {
      trace_id: traceId,
      model: normalizedModel,
      source_lang: sourceLang,
      target_lang: targetLanguageName,
      domain: domainLabel,
      entry_count: entryStats.entryCount,
      total_chars: entryStats.totalChars,
      chunk_count: chunks.length
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
          totalEntries: normalizedEntries.length,
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
            "Return JSON only.",
            "Keep the exact same keys.",
            "Preserve line breaks and blank lines within each value exactly.",
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
            chunk_index: chunkIndex + 1,
            total_chunks: chunks.length,
            http_status: response.status,
            openai_duration_ms: responseDurationMs
          });
          return translateEntriesWithGoogle(Object.fromEntries(normalizedEntries), targetLang, options);
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
            chunk_index: chunkIndex + 1,
            total_chunks: chunks.length,
            openai_duration_ms: responseDurationMs,
            parse_duration_ms: parseDurationMs
          });
          return translateEntriesWithGoogle(Object.fromEntries(normalizedEntries), targetLang, options);
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
      source_lang: sourceLang,
      target_lang: targetLanguageName,
      translated_count: translatedCount,
      duration_ms: durationMs(totalStartMs)
    });

    return {
      entries: translated,
      provider: openAiProviderMeta(normalizedModel)
    };
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
