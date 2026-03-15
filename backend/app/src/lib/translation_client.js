import { normalizeText } from "./text.js";
import { normalizeLanguageCode, promptLanguageName } from "../../../../shared/generated/language_catalog.js";

function parseJsonObject(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  try {
    const parsed = JSON.parse(normalized);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(normalized.slice(start, end + 1));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
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

function extractGoogleTranslatedText(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  return payload[0]
    .map((segment) => normalizeText(Array.isArray(segment) ? segment[0] : ""))
    .filter(Boolean)
    .join("");
}

export function createTranslationClient({
  apiKey,
  model = "gpt-4o-mini",
  googleFallbackEnabled = true
} = {}) {
  const normalizedApiKey = normalizeText(apiKey);
  const normalizedModel = normalizeText(model) || "gpt-4o-mini";
  const allowGoogleFallbackByDefault = googleFallbackEnabled !== false;

  async function translateEntriesWithGoogle(entries, targetLang, options = {}) {
    const sourceLangCode = googleTranslateLangCode(options?.sourceLangCode || "en", "en");
    const targetLangCode = googleTranslateLangCode(targetLang, "en");
    const translated = {};

    for (const [key, value] of Object.entries(entries || {})) {
      const sourceText = normalizeText(value);
      if (!sourceText) continue;
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
    }

    return translated;
  }

  async function translateEntries(entries, targetLang, options = {}) {
    const normalizedEntries = Object.entries(entries || {})
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => Boolean(key && value));

    if (!normalizedEntries.length) return {};

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
    const targetLanguageName = promptLanguageName(targetLang, "English");
    const chunks = chunkEntries(normalizedEntries);
    const translated = {};

    for (const chunk of chunks) {
      const chunkPayload = Object.fromEntries(chunk);
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${normalizedApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: normalizedModel,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    `You translate ${domainLabel} copy from ${sourceLang} into ${targetLanguageName}.`,
                    "Return JSON only.",
                    "Keep the exact same keys.",
                    "Preserve proper nouns, brand names, phone numbers, ISO codes, URLs, and currency codes unless a natural translation requires otherwise.",
                    "Do not add explanations."
                  ].join(" ")
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(chunkPayload)
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = normalizeText(payload?.error?.message || payload?.message || payload?.detail);
        } catch {
          // Ignore unreadable error bodies.
        }
        if (allowGoogleFallback) {
          return translateEntriesWithGoogle(Object.fromEntries(normalizedEntries), targetLang, options);
        }
        const error = new Error(detail || `Translation request failed with HTTP ${response.status}.`);
        error.code = "TRANSLATION_REQUEST_FAILED";
        throw error;
      }

      const payload = await response.json();
      const parsed = parseJsonObject(payload?.output_text);
      if (!parsed) {
        if (allowGoogleFallback) {
          return translateEntriesWithGoogle(Object.fromEntries(normalizedEntries), targetLang, options);
        }
        const error = new Error("Translation provider returned an invalid JSON response.");
        error.code = "TRANSLATION_INVALID_RESPONSE";
        throw error;
      }

      for (const [key] of chunk) {
        translated[key] = normalizeText(parsed[key]);
      }
    }

    return translated;
  }

  return {
    translateEntries
  };
}
