import { bookingTranslateFieldsRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { logBrowserConsoleError } from "../shared/api.js";
import {
  bookingContentLang,
  bookingContentLanguageOption,
  bookingSourceLang,
  bookingSourceLanguageOption,
  bookingT,
  normalizeBookingContentLang,
  shouldShowBookingCustomerSourceCue
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

export function buildDualLocalizedPayload(sourceText, localizedText, targetLang = bookingContentLang(), sourceLang = bookingSourceLang()) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const rawMap = {
    [normalizedSourceLang]: String(sourceText || "").trim()
  };
  if (normalizedTargetLang !== normalizedSourceLang) {
    rawMap[normalizedTargetLang] = String(localizedText || "").trim();
  }
  const normalizedMap = normalizeLocalizedEditorMap(rawMap, normalizedSourceLang);
  return {
    map: normalizedMap,
    text: resolveLocalizedEditorText(normalizedMap, normalizedSourceLang, "")
  };
}

export function mergeDualLocalizedPayload(
  existingValue,
  sourceText,
  localizedText,
  targetLang = bookingContentLang(),
  sourceLang = bookingSourceLang()
) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  let nextMap = normalizeLocalizedEditorMap(existingValue, normalizedSourceLang);
  nextMap = setLocalizedEditorText(nextMap, normalizedSourceLang, sourceText);
  if (normalizedTargetLang !== normalizedSourceLang) {
    nextMap = setLocalizedEditorText(nextMap, normalizedTargetLang, localizedText);
  }
  return {
    map: nextMap,
    text: resolveLocalizedEditorText(nextMap, normalizedSourceLang, "")
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

function translationDirectionLabel(sourceOption, targetOption) {
  const sourceLabel = String(sourceOption?.shortLabel || DEFAULT_CONTENT_LANG).trim().toUpperCase();
  const targetLabel = String(targetOption?.shortLabel || DEFAULT_CONTENT_LANG).trim().toUpperCase();
  return `${sourceLabel}→${targetLabel}`;
}

function renderTranslationTrigger({
  escapeHtml,
  sourceOption,
  targetOption,
  translateData = "",
  disabledAttr = "",
  titleAttr = ""
}) {
  return `<button type="button" class="btn btn-ghost localized-pair__lang-button"${translateData}${disabledAttr}${titleAttr}>${escapeHtml(translationDirectionLabel(sourceOption, targetOption))}</button>`;
}

function renderSplitTranslationTrigger({
  escapeHtml,
  sourceOption,
  targetOption,
  translateData = "",
  disabledAttr = "",
  titleAttr = ""
}) {
  return `<button type="button" class="btn btn-ghost localized-editor__translate-btn localized-editor__translate-btn--direction"${translateData}${disabledAttr}${titleAttr}>${escapeHtml(translationDirectionLabel(sourceOption, targetOption))}</button>`;
}

function renderSourceCode(sourceOption, escapeHtml) {
  return `<span class="localized-editor__source-code" aria-hidden="true">${escapeHtml(String(sourceOption?.shortLabel || DEFAULT_CONTENT_LANG).trim().toUpperCase())}</span>`;
}

function renderStackedSourceCode(sourceOption, escapeHtml) {
  return `<span class="localized-pair__code" aria-hidden="true">${escapeHtml(String(sourceOption?.shortLabel || DEFAULT_CONTENT_LANG).trim().toUpperCase())}</span>`;
}

function renderSingleLanguageStackedField({
  escapeHtml,
  showLabel,
  label,
  labelId = "",
  englishId,
  sourceOption,
  sourceControl,
  showSourceCode = true
}) {
  return `
    <div class="localized-pair localized-pair--single-language">
      ${showLabel ? `<div class="localized-pair__header">
        <label class="localized-pair__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
      </div>` : ""}
      <div class="localized-pair__row localized-pair__row--single${showSourceCode ? "" : " localized-pair__row--source-only"}">
        ${showSourceCode ? renderStackedSourceCode(sourceOption, escapeHtml) : ""}
        <div class="localized-pair__field localized-pair__field--single">
          ${sourceControl}
        </div>
      </div>
    </div>
  `;
}

function renderSingleLanguageSplitField({
  escapeHtml,
  label,
  labelId = "",
  englishId,
  sourceOption,
  sourceControl,
  showSourceCode = true
}) {
  return `
    <div class="localized-editor localized-editor--single-language">
      <div class="localized-editor__header">
        <label class="localized-editor__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
      </div>
      <div class="localized-editor__grid localized-editor__grid--single">
        <div class="localized-editor__pane localized-editor__pane--source">
          ${showSourceCode ? `<div class="localized-editor__pane-head">
            ${renderSourceCode(sourceOption, escapeHtml)}
          </div>` : ""}
          ${sourceControl}
        </div>
      </div>
    </div>
  `;
}

export function renderLocalizedSplitField({
  escapeHtml,
  idBase,
  label,
  labelId = "",
  type = "input",
  rows = 3,
  commonData = {},
  sourceLang = bookingSourceLang(),
  sourceValue = "",
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
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const sourceOption = bookingSourceLanguageOption(normalizedSourceLang);
  const targetOption = bookingContentLanguageOption(normalizedTargetLang);
  const resolvedSourceValue = sourceValue !== undefined ? sourceValue : englishValue;
  const sameLanguage = normalizedTargetLang === normalizedSourceLang;
  const showSourceCode = shouldShowBookingCustomerSourceCue({
    contentLang: normalizedTargetLang,
    sourceLang: normalizedSourceLang
  });
  const rightDisabled = disabled || sameLanguage || localizedReadOnly;
  const showTranslateButton = !sameLanguage && !localizedReadOnly;
  const inputTag = type === "textarea" ? "textarea" : "input";
  const englishId = `${idBase}_${sourceOption.code}`;
  const localizedId = `${idBase}_${targetOption.code}_target`;
  const sourceData = renderDataAttributes({
    ...commonData,
    "localized-lang": sourceOption.code,
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
  const translateDisabledReason = !translateEnabled
    ? bookingT("booking.translation.disabled.not_configured", "Translation is not configured on this server.")
    : rightDisabled
      ? bookingT("booking.translation.disabled.no_permission", "Disabled: you do not have permission to edit this booking.")
      : "";
  const translateDisabledAttr = (!translateEnabled || rightDisabled) ? " disabled" : "";
  const translateTitleAttr = translateDisabledReason ? ` title="${escapeHtml(translateDisabledReason)}"` : "";
  const disabledHint = translateDisabledReason
    ? `<p class="micro localized-editor__hint">${escapeHtml(translateDisabledReason)}</p>`
    : "";
  const sourceControl = renderLocalizedControl({
    escapeHtml,
    inputTag,
    id: englishId,
    value: resolvedSourceValue,
    data: sourceData,
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

  if (sameLanguage) {
    return renderSingleLanguageSplitField({
      escapeHtml,
      label,
      labelId,
      englishId,
      sourceOption,
      sourceControl,
      showSourceCode
    });
  }

  return `
    <div class="localized-editor">
      <div class="localized-editor__header">
        <label class="localized-editor__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
      </div>
      <div class="localized-editor__grid">
        <div class="localized-editor__pane localized-editor__pane--source">
          ${showSourceCode ? `<div class="localized-editor__pane-head">
            ${renderSourceCode(sourceOption, escapeHtml)}
          </div>` : ""}
          ${sourceControl}
        </div>
        <div class="localized-editor__pane localized-editor__pane--target">
          <div class="localized-editor__pane-head">
            ${showTranslateButton ? renderSplitTranslationTrigger({
              escapeHtml,
              sourceOption,
              targetOption,
              translateData,
              disabledAttr: translateDisabledAttr,
              titleAttr: translateTitleAttr
            }) : ""}
          </div>
          ${localizedControl}
          ${disabledHint}
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
  showLabel = true,
  type = "input",
  rows = 3,
  commonData = {},
  sourceLang = bookingSourceLang(),
  sourceValue = "",
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
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const sourceOption = bookingSourceLanguageOption(normalizedSourceLang);
  const targetOption = bookingContentLanguageOption(normalizedTargetLang);
  const resolvedSourceValue = sourceValue !== undefined ? sourceValue : englishValue;
  const sameLanguage = normalizedTargetLang === normalizedSourceLang;
  const showSourceCode = shouldShowBookingCustomerSourceCue({
    contentLang: normalizedTargetLang,
    sourceLang: normalizedSourceLang
  });
  const inputTag = type === "textarea" ? "textarea" : "input";
  const englishId = `${idBase}_${sourceOption.code}`;
  const localizedId = `${idBase}_${targetOption.code}_target`;
  const sourceData = renderDataAttributes({
    ...commonData,
    "localized-lang": sourceOption.code,
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
  const localizedAttrs = (disabled || localizedReadOnly || sameLanguage) ? " disabled" : "";
  const sourceControl = renderLocalizedControl({
    escapeHtml,
    inputTag,
    id: englishId,
    value: resolvedSourceValue,
    data: sourceData,
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

  if (sameLanguage) {
    return renderSingleLanguageStackedField({
      escapeHtml,
      showLabel,
      label,
      labelId,
      englishId,
      sourceOption,
      sourceControl,
      showSourceCode
    });
  }

  const forwardTranslateData = renderDataAttributes({
    "localized-translate": "true",
    "localized-translate-direction": "source-to-target",
    ...translatePayload
  });
  const translateDisabledAttr = (!translateEnabled || disabled || localizedReadOnly) ? " disabled" : "";
  const translateTitleAttr = translateDisabledReason ? ` title="${escapeHtml(translateDisabledReason)}"` : "";
  const disabledHint = translateDisabledReason
    ? `<p class="micro localized-pair__hint">${escapeHtml(translateDisabledReason)}</p>`
    : "";

  return `
    <div class="localized-pair">
      ${showLabel ? `<div class="localized-pair__header">
        <label class="localized-pair__label" for="${escapeHtml(englishId)}"${labelId ? ` id="${escapeHtml(labelId)}"` : ""}>${escapeHtml(label)}</label>
      </div>` : ""}
      <div class="localized-pair__row${showSourceCode ? "" : " localized-pair__row--source-only"}">
        ${showSourceCode ? renderStackedSourceCode(sourceOption, escapeHtml) : ""}
        <div class="localized-pair__field">
          ${sourceControl}
        </div>
      </div>
      <div class="localized-pair__row localized-pair__row--target localized-pair__row--target-action">
        ${renderTranslationTrigger({
          escapeHtml,
          sourceOption,
          targetOption,
          translateData: forwardTranslateData,
          disabledAttr: translateDisabledAttr,
          titleAttr: translateTitleAttr
        })}
        <div class="localized-pair__field">
          ${localizedControl}
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
  sourceLang = bookingSourceLang(),
  targetLang = bookingContentLang(),
  translationProfile = "customer_travel_plan",
  includeMeta = false
}) {
  const normalizedSourceLang = normalizeBookingContentLang(sourceLang || DEFAULT_CONTENT_LANG);
  const normalizedTargetLang = normalizeBookingContentLang(targetLang || DEFAULT_CONTENT_LANG);
  const normalizedTranslationProfile = String(translationProfile || "").trim() || "customer_travel_plan";
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
        translation_profile: normalizedTranslationProfile,
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
      translation_profile: normalizedTranslationProfile,
      actor,
      entry_keys: Object.keys(payloadEntries),
      entry_values: payloadEntries
    }, error);
    throw error;
  }
  const response = await fetchBookingMutation(request.url, {
    method: request.method,
    body: request.body,
    includeResponseMeta: includeMeta
  });
  const payload = includeMeta ? response?.payload : response;
  if (!Array.isArray(payload?.entries)) {
    logBrowserConsoleError("[translation] Booking field translation returned no translated entries.", {
      booking_id: bookingId,
      request_url: request.url,
      source_lang: normalizedSourceLang,
      target_lang: normalizedTargetLang,
      translation_profile: normalizedTranslationProfile,
      actor,
      entry_keys: Object.keys(payloadEntries),
      response_payload: payload
    });
    return null;
  }
  const translatedEntries = Object.fromEntries(
    payload.entries
      .map((entry) => [String(entry?.key || "").trim(), String(entry?.value || "").trim()])
      .filter(([key, value]) => Boolean(key && value))
  );
  return includeMeta
    ? {
        entries: translatedEntries,
        translationProvider: response?.responseMeta?.translationProvider || null
      }
    : translatedEntries;
}
