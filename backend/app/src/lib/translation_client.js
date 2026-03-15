import { normalizeText } from "./text.js";
import { promptLanguageName } from "../../../../shared/generated/language_catalog.js";

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

export function createTranslationClient({
  apiKey,
  model = "gpt-4o-mini"
} = {}) {
  const normalizedApiKey = normalizeText(apiKey);
  const normalizedModel = normalizeText(model) || "gpt-4o-mini";

  async function translateEntries(entries, targetLang, options = {}) {
    const normalizedEntries = Object.entries(entries || {})
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => Boolean(key && value));

    if (!normalizedEntries.length) return {};

    if (!normalizedApiKey) {
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
        const error = new Error(detail || `Translation request failed with HTTP ${response.status}.`);
        error.code = "TRANSLATION_REQUEST_FAILED";
        throw error;
      }

      const payload = await response.json();
      const parsed = parseJsonObject(payload?.output_text);
      if (!parsed) {
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
