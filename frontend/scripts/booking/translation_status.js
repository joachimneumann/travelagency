import {
  bookingEditingLang,
  bookingContentLanguageLabel,
  bookingT
} from "./i18n.js";

function normalizedLangCode(lang) {
  return String(lang || "").trim().toLowerCase() || "en";
}

function normalizeLocalizedMapForStatus(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { en: text } : {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizedLangCode(lang), String(text || "").trim()])
      .filter(([, text]) => Boolean(text))
  );
}

function languageLabel(lang) {
  return bookingContentLanguageLabel(normalizedLangCode(lang));
}

export function translationStatusLabel(status) {
  switch (String(status?.status || "").trim().toLowerCase()) {
    case "source":
      return bookingT("booking.translation.status.source", "Source");
    case "empty":
      return bookingT("booking.translation.status.empty", "No source");
    case "partial":
      return bookingT("booking.translation.status.partial", "Partial");
    case "machine_translated":
      return bookingT("booking.translation.status.machine_translated", "Machine translated");
    case "reviewed":
      return bookingT("booking.translation.status.reviewed", "Ready");
    case "stale":
      return bookingT("booking.translation.status.stale", "Stale");
    case "missing":
    default:
      return bookingT("booking.translation.status.missing", "Missing");
  }
}

export function buildFallbackTranslationStatus({ lang = "en", fieldMaps = [] } = {}) {
  const normalizedLang = normalizedLangCode(lang);
  const sourceLang = normalizedLangCode(bookingEditingLang("en"));
  const maps = (Array.isArray(fieldMaps) ? fieldMaps : [])
    .map((value) => normalizeLocalizedMapForStatus(value))
    .filter((map) => Object.keys(map).length > 0);

  const sourceMaps = maps.filter((map) => Boolean(map[sourceLang]));
  const totalFields = sourceMaps.length;
  const translatedFields = sourceMaps.reduce((count, map) => {
    if (normalizedLang === sourceLang) return count + 1;
    return count + (map[normalizedLang] ? 1 : 0);
  }, 0);
  const missingFields = Math.max(0, totalFields - translatedFields);

  let status = "missing";
  if (normalizedLang === sourceLang) {
    status = "source";
  } else if (!totalFields) {
    status = "empty";
  } else if (!translatedFields) {
    status = "missing";
  } else if (missingFields > 0) {
    status = "partial";
  } else {
    status = "reviewed";
  }

  return {
    lang: normalizedLang,
    source_lang: sourceLang,
    status,
    origin: null,
    updated_at: null,
    stale: false,
    total_fields: totalFields,
    translated_fields: translatedFields,
    missing_fields: missingFields,
    has_source_content: totalFields > 0,
    has_target_content: translatedFields > 0
  };
}

function disabledReasonText(normalizedStatus, sectionLabel, explicitReason = "") {
  if (explicitReason) return explicitReason;
  const sourceLang = normalizedLangCode(normalizedStatus.source_lang || bookingEditingLang("en"));
  const sourceLabel = languageLabel(sourceLang);
  if (normalizedStatus.lang === sourceLang) {
    return bookingT("booking.translation.disabled.source_language", "Disabled: {language} is the editing language.", {
      language: sourceLabel
    });
  }
  if (!normalizedStatus.has_source_content) {
    return bookingT("booking.translation.disabled.no_source", "Disabled: add {language} {section} content first.", {
      language: sourceLabel,
      section: sectionLabel
    });
  }
  return "";
}

export function translationToolbarHtml({ status, sectionLabel, disabled = false, disabledReason = "", escapeHtml }) {
  const normalizedStatus = status && typeof status === "object" ? status : {};
  const targetLanguage = languageLabel(normalizedStatus.lang || "en");
  const sourceLanguage = languageLabel(normalizedStatus.source_lang || bookingEditingLang("en"));
  const progressText = bookingT("booking.translation.progress", "{translated} of {total} fields ready in {language}.", {
    translated: Number(normalizedStatus.translated_fields || 0),
    total: Number(normalizedStatus.total_fields || 0),
    language: targetLanguage
  });
  let description = "";
  switch (String(normalizedStatus.status || "").trim().toLowerCase()) {
    case "source":
      description = bookingT("booking.translation.source_description", "{language} is the editing language for {section}.", {
        language: sourceLanguage,
        section: sectionLabel
      });
      break;
    case "empty":
      description = bookingT("booking.translation.no_source_description", "Add {language} content first, then update this section.", {
        language: sourceLanguage
      });
      break;
    case "missing":
      description = bookingT("booking.translation.missing_description", "No translated {section} content exists yet.", { section: sectionLabel });
      break;
    case "partial":
      description = bookingT("booking.translation.partial_description", "{progress} Some {sourceLanguage} fields are still missing in this language.", {
        progress: progressText,
        sourceLanguage
      });
      break;
    case "machine_translated":
      description = bookingT("booking.translation.machine_description", "{progress} This section was translated automatically from {sourceLanguage}.", {
        progress: progressText,
        sourceLanguage
      });
      break;
    case "reviewed":
      description = bookingT("booking.translation.reviewed_description", "{progress} This section is ready for customer-facing output.", { progress: progressText });
      break;
    case "stale":
      description = bookingT("booking.translation.stale_description", "{sourceLanguage} changed after the last translation. {progress}", {
        sourceLanguage,
        progress: progressText
      });
      break;
    default:
      description = progressText;
      break;
  }

  const actionLabel = normalizedStatus.has_target_content
    ? bookingT("booking.translation.retranslate_language", "Update {language}", { language: targetLanguage })
    : bookingT("booking.translation.translate_language", "Create {language}", { language: targetLanguage });
  const buttonDisabled = disabled || normalizedStatus.lang === normalizedLangCode(normalizedStatus.source_lang || bookingEditingLang("en")) || !normalizedStatus.has_source_content;
  const reasonText = buttonDisabled ? disabledReasonText(normalizedStatus, sectionLabel, disabledReason) : "";
  const statusClass = `booking-translation-toolbar__badge booking-translation-toolbar__badge--${escapeHtml(String(normalizedStatus.status || "missing").replace(/_/g, "-"))}`;

  return `
    <div class="booking-translation-toolbar__summary">
      <span class="${statusClass}">${escapeHtml(translationStatusLabel(normalizedStatus))}</span>
      <p class="micro">${escapeHtml(description)}</p>
    </div>
    <div class="booking-translation-toolbar__controls">
      <button
        class="btn btn-ghost booking-translation-toolbar__action"
        type="button"
        ${buttonDisabled ? "disabled" : ""}
        ${reasonText ? `title="${escapeHtml(reasonText)}"` : ""}
      >
        ${escapeHtml(actionLabel)}
      </button>
      ${reasonText ? `<p class="micro booking-translation-toolbar__disabled-reason">${escapeHtml(reasonText)}</p>` : ""}
    </div>
  `;
}

export function retranslateConfirmText(status, sectionLabel) {
  return bookingT(
    "booking.translation.overwrite_confirm",
    "Replace the current {language} translation for {section} with a fresh machine translation from {sourceLanguage}?",
    {
      language: languageLabel(status?.lang || "en"),
      sourceLanguage: languageLabel(status?.source_lang || bookingEditingLang("en")),
      section: sectionLabel
    }
  );
}

export function translationBusyText(sectionLabel, sourceLang = bookingEditingLang("en")) {
  return bookingT("booking.translation.translating", "Translating {section} from {language}...", {
    section: sectionLabel,
    language: languageLabel(sourceLang)
  });
}

export function translationSuccessText(sectionLabel, sourceLang = bookingEditingLang("en")) {
  return bookingT("booking.translation.translated", "{section} translated from {language}.", {
    section: sectionLabel,
    language: languageLabel(sourceLang)
  });
}
