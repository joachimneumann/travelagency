import {
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
  const maps = (Array.isArray(fieldMaps) ? fieldMaps : [])
    .map((value) => normalizeLocalizedMapForStatus(value))
    .filter((map) => Object.keys(map).length > 0);

  const sourceMaps = maps.filter((map) => Boolean(map.en));
  const totalFields = sourceMaps.length;
  const translatedFields = sourceMaps.reduce((count, map) => {
    if (normalizedLang === "en") return count + 1;
    return count + (map[normalizedLang] ? 1 : 0);
  }, 0);
  const missingFields = Math.max(0, totalFields - translatedFields);

  let status = "missing";
  if (normalizedLang === "en") {
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
    source_lang: "en",
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
  if (normalizedStatus.lang === "en") {
    return bookingT("booking.translation.disabled.source_language", "Disabled: English is the source language.");
  }
  if (!normalizedStatus.has_source_content) {
    return bookingT("booking.translation.disabled.no_source", "Disabled: add English {section} content first.", {
      section: sectionLabel
    });
  }
  return "";
}

export function translationToolbarHtml({ status, sectionLabel, disabled = false, disabledReason = "", escapeHtml }) {
  const normalizedStatus = status && typeof status === "object" ? status : {};
  const targetLanguage = languageLabel(normalizedStatus.lang || "en");
  const progressText = bookingT("booking.translation.progress", "{translated} of {total} fields ready in {language}.", {
    translated: Number(normalizedStatus.translated_fields || 0),
    total: Number(normalizedStatus.total_fields || 0),
    language: targetLanguage
  });
  let description = "";
  switch (String(normalizedStatus.status || "").trim().toLowerCase()) {
    case "source":
      description = bookingT("booking.translation.source_description", "English is the source language for {section}.", { section: sectionLabel });
      break;
    case "empty":
      description = bookingT("booking.translation.no_source_description", "Add English content first, then translate this section.");
      break;
    case "missing":
      description = bookingT("booking.translation.missing_description", "No translated {section} content exists yet.", { section: sectionLabel });
      break;
    case "partial":
      description = bookingT("booking.translation.partial_description", "{progress} Some English fields are still missing in this language.", { progress: progressText });
      break;
    case "machine_translated":
      description = bookingT("booking.translation.machine_description", "{progress} This section was translated automatically from English.", { progress: progressText });
      break;
    case "reviewed":
      description = bookingT("booking.translation.reviewed_description", "{progress} This section is ready for customer-facing output.", { progress: progressText });
      break;
    case "stale":
      description = bookingT("booking.translation.stale_description", "English changed after the last translation. {progress}", { progress: progressText });
      break;
    default:
      description = progressText;
      break;
  }

  const actionLabel = normalizedStatus.has_target_content
    ? bookingT("booking.translation.retranslate_from_english", "Re-translate from English")
    : bookingT("booking.translation.translate_from_english", "Translate from English");
  const buttonDisabled = disabled || normalizedStatus.lang === "en" || !normalizedStatus.has_source_content;
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
    "Replace the current {language} translation for {section} with a fresh machine translation from English?",
    {
      language: languageLabel(status?.lang || "en"),
      section: sectionLabel
    }
  );
}

export function translationBusyText(sectionLabel) {
  return bookingT("booking.translation.translating", "Translating {section} from English...", { section: sectionLabel });
}

export function translationSuccessText(sectionLabel) {
  return bookingT("booking.translation.translated", "{section} translated from English.", { section: sectionLabel });
}
