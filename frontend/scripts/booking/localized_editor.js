import { bookingTranslateFieldsRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { logBrowserConsoleError } from "../shared/api.js";
import {
  bookingContentLang,
  bookingContentLanguageOption,
  bookingT,
  normalizeBookingContentLang
} from "./i18n.js";

const DEFAULT_CONTENT_LANG = "en";

function renderDataAttributes(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => ` data-${key}="${String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join("");
}

export function normalizeLocalizedEditorMap(value, fallbackLang = DEFAULT_CONTENT_LANG) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([lang, text]) => [normalizeBookingContentLang(lang), String(text || "").trim()])
        .filter(([, text]) => Boolean(text))
    );
  }
  const text = String(value || "").trim();
  return text ? { [normalizeBookingContentLang(fallbackLang)]: text } : {};
}

export function resolveLocalizedEditorText(value, lang = DEFAULT_CONTENT_LANG, fallback = "") {
  const normalizedLang = normalizeBookingContentLang(lang || DEFAULT_CONTENT_LANG);
  const normalized = normalizeLocalizedEditorMap(value, normalizedLang);
  if (normalized[normalizedLang]) return normalized[normalizedLang];
  if (normalized.en) return normalized.en;
  const first = Object.values(normalized).find(Boolean);
  return first || fallback;
}

export function resolveLocalizedEditorBranchText(value, lang = DEFAULT_CONTENT_LANG, fallback = "") {
  const normalizedLang = normalizeBookingContentLang(lang || DEFAULT_CONTENT_LANG);
  const normalized = normalizeLocalizedEditorMap(value, normalizedLang);
  return normalized[normalizedLang] || fallback;
}

export function setLocalizedEditorText(value, lang, text) {
  const normalized = normalizeLocalizedEditorMap(value, DEFAULT_CONTENT_LANG);
  const normalizedLang = normalizeBookingContentLang(lang || DEFAULT_CONTENT_LANG);
  const normalizedText = String(text || "").trim();
  if (normalizedText) normalized[normalizedLang] = normalizedText;
  else delete normalized[normalizedLang];
  return normalized;
}

export function buildDualLocalizedPayload(englishText, localizedText, targetLang = bookingContentLang()) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const rawMap = {
    en: String(englishText || "").trim()
  };
  if (normalizedTargetLang !== "en") {
    rawMap[normalizedTargetLang] = String(localizedText || "").trim();
  }
  const normalizedMap = normalizeLocalizedEditorMap(rawMap, "en");
  return {
    map: rawMap,
    text: resolveLocalizedEditorText(normalizedMap, "en", "")
  };
}

function renderLocalizedControl({
  escapeHtml,
  inputTag,
  id,
  value = "",
  data = "",
  attrs = "",
  rows = 3,
  placeholder = ""
}) {
  if (inputTag === "textarea") {
    return `<textarea class="booking-text-field booking-text-field--customer" id="${escapeHtml(id)}" rows="${escapeHtml(String(rows))}"${data}${attrs}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}>${escapeHtml(value)}</textarea>`;
  }
  return `<input class="booking-text-field booking-text-field--customer" id="${escapeHtml(id)}" type="text" value="${escapeHtml(value)}"${data}${attrs}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""} />`;
}

export function renderLocalizedSplitField({
  escapeHtml,
  idBase,
  label,
  labelId = "",
  type = "input",
  rows = 3,
  commonData = {},
  englishValue = "",
  localizedValue = "",
  englishPlaceholder = "",
  localizedPlaceholder = "",
  targetLang = bookingContentLang(),
  disabled = false,
  translatePayload = {},
  translateEnabled = true,
  localizedReadOnly = false
}) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const targetOption = bookingContentLanguageOption(normalizedTargetLang);
  const rightDisabled = disabled || normalizedTargetLang === "en" || localizedReadOnly;
  const showTranslateButton = normalizedTargetLang !== "en" && !localizedReadOnly;
  const inputTag = type === "textarea" ? "textarea" : "input";
  const englishId = `${idBase}_en`;
  const localizedId = `${idBase}_${targetOption.code}_target`;
  const englishData = renderDataAttributes({
    ...commonData,
    "localized-lang": "en",
    "localized-role": "source"
  });
  const localizedData = renderDataAttributes({
    ...commonData,
    "localized-lang": targetOption.code,
    "localized-role": "target"
  });
  const translateData = renderDataAttributes({
    "localized-translate": "true",
    ...translatePayload
  });
  const sharedAttrs = disabled ? " disabled" : "";
  const rightAttrs = rightDisabled ? " disabled" : "";
  const englishControl = renderLocalizedControl({
    escapeHtml,
    inputTag,
    id: englishId,
    value: englishValue,
    data: englishData,
    attrs: sharedAttrs,
    rows,
    placeholder: englishPlaceholder
  });
  const localizedControl = renderLocalizedControl({
    escapeHtml,
    inputTag,
    id: localizedId,
    value: localizedValue,
    data: localizedData,
    attrs: rightAttrs,
    rows,
    placeholder: localizedPlaceholder
  });

  return `
    <div class="localized-editor ${normalizedTargetLang === "en" ? "localized-editor--single-language" : ""}">
      <div class="localized-editor__header">
        <label class="localized-editor__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
      </div>
      <div class="localized-editor__grid">
        <div class="localized-editor__pane localized-editor__pane--source">
          <div class="localized-editor__pane-head">
            <span class="localized-editor__lang"><span class="lang-flag flag-en" aria-hidden="true"></span><span class="localized-editor__lang-code">EN</span></span>
          </div>
          ${englishControl}
        </div>
        <div class="localized-editor__pane localized-editor__pane--target ${normalizedTargetLang === "en" ? "is-disabled" : ""}">
          <div class="localized-editor__pane-head">
            <span class="localized-editor__lang"><span class="lang-flag ${escapeHtml(targetOption.flagClass)}" aria-hidden="true"></span><span class="localized-editor__lang-code">${escapeHtml(targetOption.shortLabel)}</span></span>
            ${showTranslateButton && translateEnabled ? `<button type="button" class="btn btn-ghost localized-editor__translate-btn"${translateData}>${escapeHtml(bookingT("booking.translation.translate_from_english", "Translate from English"))}</button>` : ""}
          </div>
          ${localizedControl}
          ${normalizedTargetLang === "en" ? `<p class="micro localized-editor__hint">${escapeHtml(bookingT("booking.translation.not_needed_for_english", "Customer language is English. No translation is needed."))}</p>` : ""}
        </div>
      </div>
    </div>
  `;
}

export function renderLocalizedStackedField({
  escapeHtml,
  idBase,
  label,
  labelId = "",
  type = "input",
  rows = 3,
  commonData = {},
  englishValue = "",
  localizedValue = "",
  englishPlaceholder = "",
  localizedPlaceholder = "",
  targetLang = bookingContentLang(),
  disabled = false,
  translatePayload = {},
  translateEnabled = true,
  localizedReadOnly = false
}) {
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const targetOption = bookingContentLanguageOption(normalizedTargetLang);
  const inputTag = type === "textarea" ? "textarea" : "input";
  const englishId = `${idBase}_en`;
  const localizedId = `${idBase}_${targetOption.code}_target`;
  const englishData = renderDataAttributes({
    ...commonData,
    "localized-lang": "en",
    "localized-role": "source"
  });
  const localizedData = renderDataAttributes({
    ...commonData,
    "localized-lang": targetOption.code,
    "localized-role": "target"
  });
  const translateDisabledReason = !translateEnabled
    ? bookingT("booking.translation.disabled.not_configured", "Translation is not configured on this server.")
    : disabled || localizedReadOnly
      ? bookingT("booking.translation.disabled.no_permission", "Disabled: you do not have permission to edit this booking.")
      : "";
  const englishAttrs = disabled ? " disabled" : "";
  const localizedAttrs = (disabled || localizedReadOnly || normalizedTargetLang === "en") ? " disabled" : "";
  const englishControl = renderLocalizedControl({
    escapeHtml,
    inputTag,
    id: englishId,
    value: englishValue,
    data: englishData,
    attrs: englishAttrs,
    rows,
    placeholder: englishPlaceholder
  });
  const localizedControl = renderLocalizedControl({
    escapeHtml,
    inputTag,
    id: localizedId,
    value: localizedValue,
    data: localizedData,
    attrs: localizedAttrs,
    rows,
    placeholder: localizedPlaceholder
  });

  if (normalizedTargetLang === "en") {
    return `
      <div class="localized-pair localized-pair--single-language">
        <div class="localized-pair__header">
          <label class="localized-pair__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
        </div>
        <div class="localized-pair__field localized-pair__field--single">
          ${englishControl}
        </div>
      </div>
    `;
  }

  const forwardTranslateData = renderDataAttributes({
    "localized-translate": "true",
    "localized-translate-direction": "source-to-target",
    ...translatePayload
  });
  const reverseTranslateData = renderDataAttributes({
    "localized-translate": "true",
    "localized-translate-direction": "target-to-source",
    ...translatePayload
  });
  const translateDisabledAttr = (!translateEnabled || disabled || localizedReadOnly) ? " disabled" : "";
  const translateTitleAttr = translateDisabledReason ? ` title="${escapeHtml(translateDisabledReason)}"` : "";
  const disabledHint = translateDisabledReason
    ? `<p class="micro localized-pair__hint">${escapeHtml(translateDisabledReason)}</p>`
    : "";

  return `
    <div class="localized-pair">
      <div class="localized-pair__header">
        <label class="localized-pair__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
      </div>
      <div class="localized-pair__row">
        <span class="localized-pair__code" aria-hidden="true">EN</span>
        <div class="localized-pair__field">
          ${englishControl}
        </div>
      </div>
      <div class="localized-pair__row localized-pair__row--target">
        <span class="localized-pair__code" aria-hidden="true">${escapeHtml(targetOption.shortLabel)}</span>
        <div class="localized-pair__field">
          ${localizedControl}
          <div class="localized-pair__actions">
            <button type="button" class="btn btn-ghost localized-pair__translate-btn"${forwardTranslateData}${translateDisabledAttr}${translateTitleAttr}>EN → ${escapeHtml(targetOption.shortLabel)}</button>
            <button type="button" class="btn btn-ghost localized-pair__translate-btn"${reverseTranslateData}${translateDisabledAttr}${translateTitleAttr}>${escapeHtml(targetOption.shortLabel)} → EN</button>
          </div>
          ${disabledHint}
        </div>
      </div>
    </div>
  `;
}

export async function requestBookingFieldTranslation({
  bookingId,
  entries,
  fetchBookingMutation,
  apiBase = "",
  actor = null,
  sourceLang = "en",
  targetLang = bookingContentLang()
}) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const payloadEntries = Object.fromEntries(
    Object.entries(entries || {})
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => Boolean(key && value))
  );
  if (!bookingId || !Object.keys(payloadEntries).length) return null;
  const resolvedApiBase = String(apiBase || window.ASIATRAVELPLAN_API_BASE || window.location.origin).replace(/\/$/, "");
  let request;
  try {
    request = bookingTranslateFieldsRequest({
      baseURL: resolvedApiBase,
      params: { booking_id: bookingId },
      body: {
        source_lang: normalizedSourceLang,
        target_lang: normalizedTargetLang,
        actor,
        entries: Object.entries(payloadEntries).map(([key, value]) => ({ key, value }))
      }
    });
  } catch (error) {
    logBrowserConsoleError("[translation] Failed to construct booking field translation request.", {
      booking_id: bookingId,
      api_base: resolvedApiBase,
      source_lang: normalizedSourceLang,
      target_lang: normalizedTargetLang,
      actor,
      entry_keys: Object.keys(payloadEntries),
      entry_values: payloadEntries
    }, error);
    throw error;
  }
  const response = await fetchBookingMutation(request.url, {
    method: request.method,
    body: request.body
  });
  if (!Array.isArray(response?.entries)) {
    logBrowserConsoleError("[translation] Booking field translation returned no translated entries.", {
      booking_id: bookingId,
      request_url: request.url,
      source_lang: normalizedSourceLang,
      target_lang: normalizedTargetLang,
      actor,
      entry_keys: Object.keys(payloadEntries),
      response_payload: response
    });
    return null;
  }
  return Object.fromEntries(
    response.entries
      .map((entry) => [String(entry?.key || "").trim(), String(entry?.value || "").trim()])
      .filter(([key, value]) => Boolean(key && value))
  );
}
