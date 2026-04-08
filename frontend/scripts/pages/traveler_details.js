import {
  escapeHtml,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { GENERATED_LANGUAGE_CODES } from "../../Generated/Models/generated_Language.js";
import {
  FRONTEND_LANGUAGE_CODES,
  languageByApiValue,
  languageByCode,
  languageDirection
} from "../../../shared/generated/language_catalog.js";
import { COUNTRY_CODE_OPTIONS } from "../shared/generated_catalogs.js";

const query = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_COUNTRY_CODE = "VN";
const BOOKING_PERSON_GENDER_OPTIONS = Object.freeze([
  "male",
  "female",
  "other",
  "prefer_not_to_say"
]);
const PERSON_CONSENT_TYPES = Object.freeze([
  "privacy_policy",
  "profiling",
  "marketing_email",
  "marketing_whatsapp"
]);
const REQUIRED_PERSON_CONSENT_TYPES = Object.freeze([
  "privacy_policy",
  "profiling"
]);
const PERSON_CONSENT_STATUSES = Object.freeze([
  "granted",
  "withdrawn"
]);
const FRONTEND_I18N_BASE_PATH = "/frontend/data/i18n/frontend";
const DEFAULT_FRONTEND_LANGUAGE = "en";
const TRAVELER_DETAILS_TRANSLATIONS = Object.freeze({
  en: Object.freeze({
    gender: "Gender",
    gender_placeholder: "Select gender"
  }),
  vi: Object.freeze({
    gender: "Giới tính",
    gender_placeholder: "Chọn giới tính"
  })
});

const state = {
  bookingId: normalizeText(query.get("booking_id")),
  personId: normalizeText(query.get("person_id")),
  token: normalizeText(query.get("token")),
  access: null,
  traveler: null,
  i18nLang: DEFAULT_FRONTEND_LANGUAGE,
  dict: {},
  saving: false
};

const els = {
  kicker: document.getElementById("traveler_details_kicker"),
  title: document.getElementById("traveler_details_title"),
  intro: document.getElementById("traveler_details_intro"),
  error: document.getElementById("traveler_details_error"),
  loading: document.getElementById("traveler_details_loading"),
  content: document.getElementById("traveler_details_content"),
  form: document.getElementById("traveler_details_form"),
  list: document.getElementById("traveler_details_list"),
  actions: document.getElementById("traveler_details_actions"),
  saveBtn: document.getElementById("traveler_details_save_btn"),
  status: document.getElementById("traveler_details_status"),
  metaDescription: document.getElementById("traveler_details_meta_description")
};

function travelerDetailsLang() {
  return normalizeTravelerDetailsFrontendLang(
    query.get("lang")
    || state.access?.customer_language
    || document.documentElement.lang
    || DEFAULT_FRONTEND_LANGUAGE
  );
}

function normalizeTravelerDetailsFrontendLang(value) {
  const normalized = normalizeText(value).toLowerCase();
  return FRONTEND_LANGUAGE_CODES.includes(normalized) ? normalized : DEFAULT_FRONTEND_LANGUAGE;
}

async function loadTravelerDetailsDictionary(lang) {
  const normalizedLang = normalizeTravelerDetailsFrontendLang(lang);
  try {
    const response = await fetch(`${FRONTEND_I18N_BASE_PATH}/${encodeURIComponent(normalizedLang)}.json`);
    if (response.ok) {
      const payload = await response.json();
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload;
      }
    }
  } catch {
    // Fall through to default language below.
  }

  if (normalizedLang !== DEFAULT_FRONTEND_LANGUAGE) {
    try {
      const response = await fetch(`${FRONTEND_I18N_BASE_PATH}/${DEFAULT_FRONTEND_LANGUAGE}.json`);
      if (response.ok) {
        const payload = await response.json();
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          return payload;
        }
      }
    } catch {
      // Ignore and return empty dictionary below.
    }
  }

  return {};
}

async function ensureTravelerDetailsLanguage(lang) {
  const normalizedLang = normalizeTravelerDetailsFrontendLang(lang);
  if (state.i18nLang === normalizedLang && state.dict && Object.keys(state.dict).length) {
    applyTravelerDetailsLanguagePresentation(normalizedLang);
    return normalizedLang;
  }
  state.dict = await loadTravelerDetailsDictionary(normalizedLang);
  state.i18nLang = normalizedLang;
  applyTravelerDetailsLanguagePresentation(normalizedLang);
  return normalizedLang;
}

function applyTravelerDetailsLanguagePresentation(lang) {
  const normalizedLang = normalizeTravelerDetailsFrontendLang(lang);
  const direction = languageDirection(normalizedLang, "ltr");
  document.documentElement.lang = normalizedLang;
  document.documentElement.dir = direction;
  document.documentElement.dataset.languageDirection = direction;
  document.documentElement.dataset.languageCode = normalizedLang;
  document.body?.classList.toggle("frontend-language-rtl", direction === "rtl");
}

function travelerDetailsT(key, fallback) {
  const replacements = arguments[2] || {};
  const inlineFallback = TRAVELER_DETAILS_TRANSLATIONS[state.i18nLang]?.[key];
  const template = state.dict?.[`traveler_details.${key}`] || inlineFallback || fallback;
  return String(template || "").replace(/\{(\w+)\}/g, (_, token) => String(replacements?.[token] ?? ""));
}

function normalizeTravelerLanguageCode(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const byCode = languageByCode(raw);
  if (byCode && GENERATED_LANGUAGE_CODES.includes(byCode.code)) return byCode.code;
  const byApiValue = languageByApiValue(raw);
  if (byApiValue && GENERATED_LANGUAGE_CODES.includes(byApiValue.code)) return byApiValue.code;
  return "";
}

function formatTravelerLanguageLabel(value) {
  const entry = languageByCode(normalizeTravelerLanguageCode(value));
  return entry?.nativeLabel || entry?.apiValue || String(value || "");
}

function renderTravelerLanguageOptions(currentValue = "") {
  const current = normalizeTravelerLanguageCode(currentValue);
  return [
    `<option value="">${escapeHtml(travelerDetailsT("preferred_language_placeholder", "Select language"))}</option>`,
    ...GENERATED_LANGUAGE_CODES.map((language) => (
      `<option value="${escapeHtml(language)}"${language === current ? " selected" : ""}>${escapeHtml(formatTravelerLanguageLabel(language))}</option>`
    ))
  ].join("");
}

function renderCountryOptions(currentValue = "", placeholderLabel = "Select nationality") {
  const current = normalizeText(currentValue).toUpperCase();
  const hasCurrentOption = COUNTRY_CODE_OPTIONS.some((option) => option.value === current);
  const options = [
    `<option value="">${escapeHtml(placeholderLabel)}</option>`,
    ...COUNTRY_CODE_OPTIONS.map((option) => (
      `<option value="${escapeHtml(option.value)}"${option.value === current ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    ))
  ];
  if (current && !hasCurrentOption) {
    options.splice(1, 0, `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>`);
  }
  return options.join("");
}

function normalizeTravelerGender(value) {
  const normalized = normalizeText(value).toLowerCase();
  return BOOKING_PERSON_GENDER_OPTIONS.includes(normalized) ? normalized : "";
}

function formatTravelerGenderLabel(value) {
  const normalized = normalizeTravelerGender(value);
  if (normalized === "male") return travelerDetailsT("gender_male", "Male");
  if (normalized === "female") return travelerDetailsT("gender_female", "Female");
  if (normalized === "other") return travelerDetailsT("gender_other", "Other");
  if (normalized === "prefer_not_to_say") return travelerDetailsT("gender_prefer_not_to_say", "Prefer not to say");
  return "";
}

function renderTravelerGenderOptions(currentValue = "") {
  const current = normalizeTravelerGender(currentValue);
  return [
    `<option value="">${escapeHtml(travelerDetailsT("gender_placeholder", "Select gender"))}</option>`,
    ...BOOKING_PERSON_GENDER_OPTIONS.map((gender) => (
      `<option value="${escapeHtml(gender)}"${gender === current ? " selected" : ""}>${escapeHtml(formatTravelerGenderLabel(gender))}</option>`
    ))
  ].join("");
}

function normalizeTravelerConsentType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return PERSON_CONSENT_TYPES.includes(normalized) ? normalized : "";
}

function normalizeTravelerConsentStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return PERSON_CONSENT_STATUSES.includes(normalized) ? normalized : "granted";
}

function formatTravelerConsentLabel(value) {
  const normalized = normalizeTravelerConsentType(value);
  if (normalized === "privacy_policy") return travelerDetailsT("consent_privacy_policy", "Privacy policy");
  if (normalized === "profiling") return travelerDetailsT("consent_profiling", "Personalization");
  if (normalized === "marketing_email") return travelerDetailsT("consent_marketing_email", "Marketing email");
  if (normalized === "marketing_whatsapp") return travelerDetailsT("consent_marketing_whatsapp", "Marketing WhatsApp");
  return "";
}

function formatTravelerConsentHint(value) {
  const normalized = normalizeTravelerConsentType(value);
  if (normalized === "privacy_policy") return travelerDetailsT("consent_privacy_policy_hint", "Agreement to store and use traveler data for trip operations.");
  if (normalized === "profiling") return travelerDetailsT("consent_profiling_hint", "Permission to personalize offers based on traveler preferences.");
  if (normalized === "marketing_email") return travelerDetailsT("consent_marketing_email_hint", "Permission to send future offers and updates by email.");
  if (normalized === "marketing_whatsapp") return travelerDetailsT("consent_marketing_whatsapp_hint", "Permission to send future offers and updates via WhatsApp.");
  return "";
}

function formatTravelerConsentStatusLabel(value) {
  const normalized = normalizeTravelerConsentStatus(value);
  if (normalized === "withdrawn") return travelerDetailsT("consent_status_withdrawn", "Consent not given");
  return travelerDetailsT("consent_status_granted", "Consent given");
}

function isRequiredTravelerConsentType(value) {
  return REQUIRED_PERSON_CONSENT_TYPES.includes(normalizeTravelerConsentType(value));
}

function requiredTravelerConsentsAccepted(traveler) {
  return REQUIRED_PERSON_CONSENT_TYPES.every((consentType) => (
    getTravelerConsentStatus(traveler, consentType) === "granted"
  ));
}

function normalizeTravelerConsentRecord(consent, personId, fallbackType = "", index = 0) {
  if (!consent || typeof consent !== "object" || Array.isArray(consent)) return null;
  const consentType = normalizeTravelerConsentType(consent.consent_type || fallbackType);
  if (!consentType) return null;
  const timestamp = new Date().toISOString();
  return {
    id: normalizeText(consent.id) || `${normalizeText(personId) || "traveler"}_${consentType}_consent_${index + 1}`,
    consent_type: consentType,
    status: normalizeTravelerConsentStatus(consent.status),
    captured_via: normalizeText(consent.captured_via),
    captured_at: normalizeText(consent.captured_at) || timestamp,
    evidence_ref: normalizeText(consent.evidence_ref),
    updated_at: normalizeText(consent.updated_at) || normalizeText(consent.captured_at) || timestamp
  };
}

function normalizeTravelerConsentDrafts(consents, personId = "") {
  const normalizedConsents = (Array.isArray(consents) ? consents : [])
    .map((consent, index) => normalizeTravelerConsentRecord(consent, personId, consent?.consent_type, index))
    .filter(Boolean)
    .sort((left, right) => PERSON_CONSENT_TYPES.indexOf(left.consent_type) - PERSON_CONSENT_TYPES.indexOf(right.consent_type));
  const byType = new Map(normalizedConsents.map((consent) => [consent.consent_type, consent]));
  return PERSON_CONSENT_TYPES.map((consentType, index) => (
    byType.get(consentType) || normalizeTravelerConsentRecord({
      consent_type: consentType,
      status: "granted",
      captured_via: "traveler_details_portal_default"
    }, personId, consentType, index)
  )).filter(Boolean);
}

function getTravelerConsent(traveler, consentType) {
  const normalizedType = normalizeTravelerConsentType(consentType);
  if (!normalizedType) return null;
  return (Array.isArray(traveler?.consents) ? traveler.consents : []).find(
    (consent) => normalizeTravelerConsentType(consent?.consent_type) === normalizedType
  ) || null;
}

function getTravelerConsentStatus(traveler, consentType) {
  return normalizeTravelerConsentStatus(getTravelerConsent(traveler, consentType)?.status);
}

function setTravelerConsentStatus(traveler, consentType, status, capturedVia = "traveler_details_portal") {
  if (!traveler || typeof traveler !== "object") return;
  const normalizedType = normalizeTravelerConsentType(consentType);
  const normalizedStatus = normalizeTravelerConsentStatus(status);
  if (!normalizedType) return;
  traveler.consents = normalizeTravelerConsentDrafts(traveler.consents, traveler.id);
  const consentIndex = traveler.consents.findIndex((consent) => normalizeTravelerConsentType(consent?.consent_type) === normalizedType);
  if (normalizedStatus === "unknown" && consentIndex < 0) {
    return;
  }
  const timestamp = new Date().toISOString();
  const existing = consentIndex >= 0 ? traveler.consents[consentIndex] : null;
  const nextRecord = normalizeTravelerConsentRecord({
    ...existing,
    consent_type: normalizedType,
    status: normalizedStatus,
    captured_via: capturedVia,
    captured_at: normalizeText(existing?.captured_at) || timestamp,
    updated_at: timestamp
  }, traveler.id, normalizedType, consentIndex >= 0 ? consentIndex : traveler.consents.length);
  if (!nextRecord) return;
  if (consentIndex >= 0) {
    traveler.consents[consentIndex] = nextRecord;
  } else {
    traveler.consents.push(nextRecord);
  }
  traveler.consents = normalizeTravelerConsentDrafts(traveler.consents, traveler.id);
}

function renderTravelerConsentStatusOptions(currentValue = "") {
  const current = normalizeTravelerConsentStatus(currentValue);
  return PERSON_CONSENT_STATUSES.map((status) => (
    `<option value="${escapeHtml(status)}"${status === current ? " selected" : ""}>${escapeHtml(formatTravelerConsentStatusLabel(status))}</option>`
  )).join("");
}

function parseDateOnly(value) {
  const normalized = normalizeText(value);
  if (!normalized || !DATE_ONLY_PATTERN.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function setError(message) {
  els.error.textContent = message || "";
  els.error.hidden = !message;
  if (message) {
    els.loading.hidden = true;
    els.content.hidden = true;
  }
}

function setStatus(message, tone = "") {
  els.status.textContent = message || "";
  els.status.classList.toggle("is-error", tone === "error");
  els.status.classList.toggle("is-success", tone === "success");
}

function buildEndpointPath(pathname) {
  return `/public/v1/bookings/${encodeURIComponent(state.bookingId)}/persons/${encodeURIComponent(state.personId)}${pathname}`;
}

async function requestJson(pathname, { method = "GET", body } = {}) {
  const url = new URL(resolveApiUrl(apiOrigin, buildEndpointPath(pathname)));
  url.searchParams.set("token", state.token);
  const response = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

function travelerSupportsNationalId(traveler) {
  return normalizeText(traveler?.nationality).toUpperCase() === VIETNAM_COUNTRY_CODE;
}

function normalizeSelectedDocumentType(traveler, requestedType = "") {
  const normalizedType = normalizeText(requestedType).toLowerCase() === "national_id" ? "national_id" : "passport";
  return travelerSupportsNationalId(traveler) ? normalizedType : "passport";
}

function emptyDocumentDraft(type = "passport") {
  return {
    document_type: type,
    holder_name: "",
    document_number: "",
    issuing_country: "",
    issued_on: "",
    expires_on: "",
    no_expiration_date: false,
    document_picture_ref: ""
  };
}

function normalizeDocumentDraft(document, type = "passport") {
  return {
    id: normalizeText(document?.id),
    document_type: normalizeText(document?.document_type) || type,
    holder_name: normalizeText(document?.holder_name),
    document_number: normalizeText(document?.document_number),
    issuing_country: normalizeText(document?.issuing_country).toUpperCase(),
    issued_on: normalizeText(document?.issued_on),
    expires_on: normalizeText(document?.expires_on),
    no_expiration_date: type === "national_id" && document?.no_expiration_date === true,
    document_picture_ref: normalizeText(document?.document_picture_ref)
  };
}

function pickPreferredDocument(traveler) {
  const documents = Array.isArray(traveler?.documents) ? traveler.documents : [];
  const passport = documents.find((document) => normalizeText(document?.document_type) === "passport");
  const nationalId = documents.find((document) => normalizeText(document?.document_type) === "national_id");
  return passport || nationalId || null;
}

function createTravelerDraft(traveler = {}) {
  const preferredDocument = pickPreferredDocument(traveler);
  const draft = {
    id: normalizeText(traveler.id) || state.personId || "traveler",
    name: normalizeText(traveler.name),
    email: normalizeText(Array.isArray(traveler.emails) ? traveler.emails[0] : ""),
    phone: normalizeText(Array.isArray(traveler.phone_numbers) ? traveler.phone_numbers[0] : ""),
    preferred_language: normalizeTravelerLanguageCode(traveler.preferred_language),
    food_preferences: normalizePreferenceList(traveler.food_preferences),
    allergies: normalizePreferenceList(traveler.allergies),
    hotel_room_smoker: traveler?.hotel_room_smoker === true,
    hotel_room_sharing_ok: traveler?.hotel_room_sharing_ok !== false,
    date_of_birth: normalizeText(traveler.date_of_birth),
    gender: normalizeTravelerGender(traveler.gender),
    nationality: normalizeText(traveler.nationality).toUpperCase(),
    address: {
      line_1: normalizeText(traveler.address?.line_1),
      line_2: normalizeText(traveler.address?.line_2),
      city: normalizeText(traveler.address?.city),
      state_region: normalizeText(traveler.address?.state_region),
      postal_code: normalizeText(traveler.address?.postal_code),
      country_code: normalizeText(traveler.address?.country_code).toUpperCase()
    },
    consents: normalizeTravelerConsentDrafts(traveler.consents, normalizeText(traveler.id) || state.personId || "traveler"),
    documents: {
      passport: normalizeDocumentDraft(
        (Array.isArray(traveler.documents) ? traveler.documents : []).find((document) => normalizeText(document?.document_type) === "passport"),
        "passport"
      ),
      national_id: normalizeDocumentDraft(
        (Array.isArray(traveler.documents) ? traveler.documents : []).find((document) => normalizeText(document?.document_type) === "national_id"),
        "national_id"
      )
    }
  };
  draft.selected_document_type = normalizeSelectedDocumentType(
    draft,
    normalizeText(preferredDocument?.document_type) || "passport"
  );
  return draft;
}

function activeDocumentForDraft(traveler) {
  return traveler?.documents?.[traveler.selected_document_type] || emptyDocumentDraft(traveler?.selected_document_type || "passport");
}

function documentHasInput(document) {
  return [
    document?.holder_name,
    document?.document_number,
    document?.issuing_country,
    document?.issued_on,
    document?.expires_on,
    document?.no_expiration_date ? "true" : ""
  ].some((value) => normalizeText(value));
}

function addressHasInput(address) {
  return [
    address?.line_1,
    address?.line_2,
    address?.city,
    address?.state_region,
    address?.postal_code,
    address?.country_code
  ].some((value) => normalizeText(value));
}

function normalizePreferenceList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
  }
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return Array.from(new Set(
    normalized
      .split(",")
      .map((entry) => normalizeText(entry))
      .filter(Boolean)
  ));
}

function buildTravelerPayload(traveler) {
  const document = activeDocumentForDraft(traveler);
  const hasDocument = documentHasInput(document);
  const hasAddress = addressHasInput(traveler.address);
  return {
    id: traveler.id,
    name: normalizeText(traveler.name),
    emails: normalizeText(traveler.email) ? [normalizeText(traveler.email)] : [],
    phone_numbers: normalizeText(traveler.phone) ? [normalizeText(traveler.phone)] : [],
    preferred_language: normalizeTravelerLanguageCode(traveler.preferred_language),
    food_preferences: normalizePreferenceList(traveler.food_preferences),
    allergies: normalizePreferenceList(traveler.allergies),
    hotel_room_smoker: traveler.hotel_room_smoker === true,
    hotel_room_sharing_ok: traveler.hotel_room_sharing_ok !== false,
    date_of_birth: normalizeText(traveler.date_of_birth),
    gender: normalizeTravelerGender(traveler.gender),
    nationality: normalizeText(traveler.nationality).toUpperCase(),
    ...(hasAddress ? {
      address: {
        line_1: normalizeText(traveler.address?.line_1),
        line_2: normalizeText(traveler.address?.line_2),
        city: normalizeText(traveler.address?.city),
        state_region: normalizeText(traveler.address?.state_region),
        postal_code: normalizeText(traveler.address?.postal_code),
        country_code: normalizeText(traveler.address?.country_code).toUpperCase()
      }
    } : {}),
    consents: normalizeTravelerConsentDrafts(traveler.consents, traveler.id),
    documents: hasDocument
      ? [{
          ...document,
          issuing_country: normalizeText(document.issuing_country).toUpperCase(),
          issued_on: normalizeText(document.issued_on),
          expires_on: document.no_expiration_date ? "" : normalizeText(document.expires_on)
        }]
      : []
  };
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function documentTypeLabel(documentType = "passport") {
  return documentType === "national_id"
    ? travelerDetailsT("id_card", "ID card")
    : travelerDetailsT("passport", "Passport");
}

function applyTravelerDetailsChromeCopy() {
  const defaultTitle = travelerDetailsT("page_title_default", "Traveler Details");
  if (els.kicker) els.kicker.textContent = travelerDetailsT("kicker", "Traveler details");
  if (els.title && !state.access) els.title.textContent = travelerDetailsT("title_default", "Tell us about your travelers");
  if (els.intro) {
    els.intro.textContent = travelerDetailsT(
      "intro",
      "This information helps us prepare your journey smoothly. If you prefer, you can also provide it later, at the beginning of your trip. The link to this page expires in 24 hours to protect your privacy."
    );
  }
  if (els.loading) els.loading.textContent = travelerDetailsT("loading", "Loading traveler details...");
  if (els.saveBtn) els.saveBtn.textContent = travelerDetailsT("submit", "Send traveler details to Asia Travel Plan");
  if (els.metaDescription instanceof HTMLMetaElement) {
    els.metaDescription.content = travelerDetailsT("page_meta_description", "Fill in your traveler details for AsiaTravelPlan.");
  }
  if (!state.access) {
    document.title = `${defaultTitle} | AsiaTravelPlan`;
  }
}

function travelerCardMarkup(traveler) {
  const document = activeDocumentForDraft(traveler);
  const supportsNationalId = travelerSupportsNationalId(traveler);
  const documentType = normalizeSelectedDocumentType(traveler, traveler.selected_document_type);
  const documentLabel = documentTypeLabel(documentType);
  const supportsNoExpirationDate = documentType === "national_id";
  const documentSectionLabel = supportsNationalId ? "Travel document" : "Passport";
  const uploadLabel = documentType === "national_id"
    ? travelerDetailsT("upload_id_card_image", "Upload ID card image")
    : travelerDetailsT("upload_passport_image", "Upload passport image");
  const imagePreviewMarkup = document.document_picture_ref
    ? `<img src="${escapeHtml(document.document_picture_ref)}" alt="${escapeHtml(travelerDetailsT("document_image_preview", "{label} image preview", { label: documentLabel }))}" />`
    : `<span class="micro traveler-details-document__picture-empty">${escapeHtml(travelerDetailsT("no_document_image_uploaded", "No document image uploaded."))}</span>`;
  return `
    <div class="traveler-details-card__grid">
      <div class="field">
        <label for="traveler_name">${escapeHtml(travelerDetailsT("full_name", "Full name"))}</label>
        <input id="traveler_name" data-field="name" type="text" value="${escapeHtml(traveler.name)}" autocomplete="name" />
      </div>
      <div class="field">
        <label for="traveler_date_of_birth">${escapeHtml(travelerDetailsT("date_of_birth", "Date of birth"))}</label>
        <input id="traveler_date_of_birth" data-field="date_of_birth" type="date" value="${escapeHtml(traveler.date_of_birth)}" />
      </div>
      <div class="field">
        <label for="traveler_email">${escapeHtml(travelerDetailsT("email", "Email"))}</label>
        <input id="traveler_email" data-field="email" type="email" value="${escapeHtml(traveler.email)}" autocomplete="email" />
      </div>
      <div class="field">
        <label for="traveler_phone">${escapeHtml(travelerDetailsT("phone_number", "Phone number"))}</label>
        <input id="traveler_phone" data-field="phone" type="tel" value="${escapeHtml(traveler.phone)}" autocomplete="tel" />
      </div>
      <div class="field">
        <label for="traveler_preferred_language">${escapeHtml(travelerDetailsT("preferred_language", "Preferred language"))}</label>
        <select id="traveler_preferred_language" data-field="preferred_language">
          ${renderTravelerLanguageOptions(traveler.preferred_language)}
        </select>
      </div>
          <div class="field">
            <label for="traveler_nationality">${escapeHtml(travelerDetailsT("nationality", "Nationality"))}</label>
            <select id="traveler_nationality" data-field="nationality">
              ${renderCountryOptions(traveler.nationality, "Select nationality")}
            </select>
          </div>
      <div class="field">
        <label for="traveler_gender">${escapeHtml(travelerDetailsT("gender", "Gender"))}</label>
        <select id="traveler_gender" data-field="gender">
          ${renderTravelerGenderOptions(traveler.gender)}
        </select>
      </div>
      <div class="field">
        <label for="traveler_food_preferences">${escapeHtml(travelerDetailsT("food_preferences", "Food preferences"))}</label>
        <input id="traveler_food_preferences" data-field="food_preferences" type="text" value="${escapeHtml(traveler.food_preferences.join(", "))}" placeholder="${escapeHtml(travelerDetailsT("food_preferences_placeholder", "Vegetarian, vegan, halal..."))}" />
      </div>
      <div class="field">
        <label for="traveler_allergies">${escapeHtml(travelerDetailsT("allergies", "Allergies"))}</label>
        <input id="traveler_allergies" data-field="allergies" type="text" value="${escapeHtml(traveler.allergies.join(", "))}" placeholder="${escapeHtml(travelerDetailsT("allergies_placeholder", "Peanuts, shellfish..."))}" />
      </div>
      <div class="field">
        <label for="traveler_hotel_room_smoker">${escapeHtml(travelerDetailsT("hotel_room_smoking_preference", "Hotel room smoking preference"))}</label>
        <select id="traveler_hotel_room_smoker" data-field="hotel_room_smoker">
          <option value="false"${traveler.hotel_room_smoker === true ? "" : " selected"}>${escapeHtml(travelerDetailsT("non_smoker", "Non-smoker"))}</option>
          <option value="true"${traveler.hotel_room_smoker === true ? " selected" : ""}>${escapeHtml(travelerDetailsT("smoker", "Smoker"))}</option>
        </select>
      </div>
      <div class="field">
        <label for="traveler_hotel_room_preference">${escapeHtml(travelerDetailsT("hotel_room_preference", "Hotel room preference"))}</label>
        <select id="traveler_hotel_room_preference" data-field="hotel_room_sharing_ok">
          <option value="true"${traveler.hotel_room_sharing_ok !== false ? " selected" : ""}>${escapeHtml(travelerDetailsT("sharing_room_ok", "Sharing room ok"))}</option>
          <option value="false"${traveler.hotel_room_sharing_ok === false ? " selected" : ""}>${escapeHtml(travelerDetailsT("single_room", "Single room"))}</option>
        </select>
      </div>
    </div>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title">${escapeHtml(travelerDetailsT("consents", "Consents"))}</h3>
    </div>
    <div class="traveler-details-consent-list">
      ${PERSON_CONSENT_TYPES.map((consentType) => `
        <div class="traveler-details-consent-row">
          <div class="traveler-details-consent-row__copy">
            <span class="traveler-details-consent-row__label-line">
              <strong>${escapeHtml(formatTravelerConsentLabel(consentType))}</strong>
              ${isRequiredTravelerConsentType(consentType)
    ? `<span class="traveler-details-consent-row__required">${escapeHtml(travelerDetailsT("consent_required", "Required"))}</span>`
    : ""}
            </span>
            <span class="micro traveler-details-consent-row__hint">${escapeHtml(formatTravelerConsentHint(consentType))}</span>
          </div>
          <div class="field">
            <select data-consent-type="${escapeHtml(consentType)}">
              ${renderTravelerConsentStatusOptions(getTravelerConsentStatus(traveler, consentType))}
            </select>
          </div>
        </div>
      `).join("")}
    </div>
    <p class="micro traveler-details-consent-list__notice">${escapeHtml(travelerDetailsT("consent_required_notice", "Privacy policy and Personalization are required to continue."))}</p>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title" aria-hidden="true"></h3>
    </div>
    <div class="traveler-details-card__grid traveler-details-card__grid--document traveler-details-card__grid--address">
      <div class="field traveler-details-card__field--full">
        <label for="traveler_address_line_1">${escapeHtml(travelerDetailsT("address_line_1", "Address line 1"))}</label>
        <input id="traveler_address_line_1" data-address-field="line_1" type="text" value="${escapeHtml(traveler.address.line_1)}" autocomplete="address-line1" />
      </div>
      <div class="field traveler-details-card__field--full">
        <label for="traveler_address_line_2">${escapeHtml(travelerDetailsT("address_line_2", "Address line 2"))}</label>
        <input id="traveler_address_line_2" data-address-field="line_2" type="text" value="${escapeHtml(traveler.address.line_2)}" autocomplete="address-line2" />
      </div>
      <div class="field traveler-details-card__field--narrow">
        <label for="traveler_postal_code">${escapeHtml(travelerDetailsT("postal_code", "Postal code"))}</label>
        <input id="traveler_postal_code" data-address-field="postal_code" type="text" value="${escapeHtml(traveler.address.postal_code)}" autocomplete="postal-code" />
      </div>
      <div class="field traveler-details-card__field--wide">
        <label for="traveler_city">${escapeHtml(travelerDetailsT("city", "City"))}</label>
        <input id="traveler_city" data-address-field="city" type="text" value="${escapeHtml(traveler.address.city)}" autocomplete="address-level2" />
      </div>
      <div class="field traveler-details-card__field--narrow">
        <label for="traveler_country_code">${escapeHtml(travelerDetailsT("country_of_residence", "Country of residence"))}</label>
        <select id="traveler_country_code" data-address-field="country_code">
          ${renderCountryOptions(traveler.address.country_code, "Select country")}
        </select>
      </div>
      <div class="field traveler-details-card__field--wide">
        <label for="traveler_state_region">${escapeHtml(travelerDetailsT("state_region_optional", "State / region (optional)"))}</label>
        <input id="traveler_state_region" data-address-field="state_region" type="text" value="${escapeHtml(traveler.address.state_region)}" autocomplete="address-level1" />
      </div>
    </div>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title" aria-hidden="true"></h3>
    </div>
    <div class="traveler-details-document__section">
      ${supportsNationalId ? `
      <div class="traveler-details-card__grid traveler-details-card__grid--document">
        <div class="field traveler-details-card__field--full">
          <label>${escapeHtml(documentSectionLabel)}</label>
          <div class="booking-person-modal__document-switch traveler-details-document__switch" role="tablist" aria-label="${escapeHtml(travelerDetailsT("document_type_aria", "{label} type", { label: documentSectionLabel }))}">
            <button
              class="booking-person-modal__document-switch-btn${documentType === "passport" ? " is-active" : ""}"
              type="button"
              data-document-switch="passport"
              aria-selected="${documentType === "passport" ? "true" : "false"}"
            >${escapeHtml(travelerDetailsT("passport", "Passport"))}</button>
            <button
              class="booking-person-modal__document-switch-btn${documentType === "national_id" ? " is-active" : ""}"
              type="button"
              data-document-switch="national_id"
              aria-selected="${documentType === "national_id" ? "true" : "false"}"
            >${escapeHtml(travelerDetailsT("id_card", "ID card"))}</button>
          </div>
        </div>
      </div>
      ` : ""}
      <div class="traveler-details-card__grid traveler-details-card__grid--document traveler-details-card__grid--document-two-up">
        <div class="field">
          <label for="traveler_document_number">${escapeHtml(travelerDetailsT("document_number", "{label} number", { label: documentLabel }))}</label>
          <input id="traveler_document_number" data-document-field="document_number" type="text" value="${escapeHtml(document.document_number)}" />
        </div>
        <div class="field">
          <label for="traveler_document_holder_name">${escapeHtml(travelerDetailsT("holder_name", "Holder name"))}</label>
          <input id="traveler_document_holder_name" data-document-field="holder_name" type="text" value="${escapeHtml(document.holder_name)}" />
        </div>
      </div>
      <div class="traveler-details-card__grid traveler-details-card__grid--document traveler-details-card__grid--document-fields">
        <div class="field">
          <label for="traveler_issuing_country">${escapeHtml(travelerDetailsT("issuing_country", "Issuing country"))}</label>
          <select id="traveler_issuing_country" data-document-field="issuing_country">
            ${renderCountryOptions(document.issuing_country, "Select issuing country")}
          </select>
        </div>
        <div class="field">
          <label for="traveler_issued_on">${escapeHtml(travelerDetailsT("issued_on", "Issued on"))}</label>
          <input id="traveler_issued_on" data-document-field="issued_on" type="date" value="${escapeHtml(document.issued_on)}" />
        </div>
            <div class="field">
              <label for="traveler_expires_on">Expires on</label>
              <input id="traveler_expires_on" data-document-field="expires_on" type="date" value="${escapeHtml(document.expires_on)}"${supportsNoExpirationDate && document.no_expiration_date ? " disabled" : ""} />
              <div class="traveler-details-document__checkbox-wrap">
              ${supportsNoExpirationDate ? `
                <label class="traveler-details-document__checkbox">
                  <input type="checkbox" data-document-field="no_expiration_date"${document.no_expiration_date ? " checked" : ""} />
              ${escapeHtml(travelerDetailsT("no_expiration_date", "No expiration date"))}
            </label>
          ` : `
            <span class="traveler-details-document__checkbox traveler-details-document__checkbox--placeholder" aria-hidden="true">${escapeHtml(travelerDetailsT("no_expiration_date", "No expiration date"))}</span>
          `}
          </div>
        </div>
      </div>
      <div class="traveler-details-card__grid traveler-details-card__grid--document">
        <div class="field traveler-details-document__picture-field traveler-details-card__field--full">
          <label for="traveler_document_picture_input">${escapeHtml(travelerDetailsT("document_image", "{label} image", { label: documentLabel }))}</label>
          <button class="btn btn-secondary" id="traveler_document_picture_upload_btn" type="button" data-document-picture-upload="${escapeHtml(documentType)}">${escapeHtml(uploadLabel)}</button>
          <input id="traveler_document_picture_input" type="file" accept="image/*" hidden />
          <div class="traveler-details-document__picture-preview">
            ${imagePreviewMarkup}
          </div>
          <span id="traveler_document_picture_status" class="micro traveler-details-document__picture-status"></span>
        </div>
      </div>
    </div>
  `;
}

function renderTravelerCard() {
  els.list.innerHTML = state.traveler ? travelerCardMarkup(state.traveler) : "";
}

function render() {
  const access = state.access;
  const bookingName = normalizeText(access?.booking_name);
  const travelerNumber = Number(access?.traveler_number);
  applyTravelerDetailsLanguagePresentation(state.i18nLang || travelerDetailsLang());
  applyTravelerDetailsChromeCopy();
  if (bookingName && Number.isInteger(travelerNumber) && travelerNumber >= 1) {
    const heading = `Traveler ${travelerNumber}: ${bookingName}`;
    els.title.textContent = heading;
    document.title = `${heading} | AsiaTravelPlan`;
  } else if (bookingName) {
    els.title.textContent = bookingName;
    document.title = `${bookingName} | AsiaTravelPlan`;
  }
  els.loading.hidden = Boolean(access);
  els.content.hidden = !access;
  const canSubmit = requiredTravelerConsentsAccepted(state.traveler);
  els.saveBtn.disabled = state.saving || !canSubmit;
  els.saveBtn.title = !canSubmit
    ? travelerDetailsT("consent_required_notice", "Privacy policy and Personalization are required to continue.")
    : "";
  renderTravelerCard();
}

function handleTravelerFormInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
  if (!state.traveler) return;

  if (target.hasAttribute("data-field")) {
    const field = normalizeText(target.dataset.field);
    if (field === "nationality") {
      state.traveler[field] = normalizeText(target.value).toUpperCase();
      state.traveler.selected_document_type = normalizeSelectedDocumentType(state.traveler, state.traveler.selected_document_type);
      if (state.traveler.selected_document_type === "passport") {
        const passportDocument = state.traveler.documents.passport || emptyDocumentDraft("passport");
        passportDocument.no_expiration_date = false;
        state.traveler.documents.passport = passportDocument;
      }
      renderTravelerCard();
    } else if (field === "gender") {
      state.traveler[field] = normalizeTravelerGender(target.value);
    } else if (field === "food_preferences" || field === "allergies") {
      state.traveler[field] = normalizePreferenceList(target.value);
    } else if (field === "hotel_room_smoker") {
      state.traveler[field] = normalizeText(target.value) === "true";
    } else if (field === "hotel_room_sharing_ok") {
      state.traveler[field] = normalizeText(target.value) !== "false";
    } else {
      state.traveler[field] = normalizeText(target.value);
    }
    return;
  }

  if (target.hasAttribute("data-address-field")) {
    const field = normalizeText(target.dataset.addressField);
    state.traveler.address[field] = field === "country_code"
      ? normalizeText(target.value).toUpperCase()
      : normalizeText(target.value);
    return;
  }

  if (target.hasAttribute("data-consent-type")) {
    setTravelerConsentStatus(state.traveler, target.dataset.consentType, target.value);
    if (target instanceof HTMLSelectElement) {
      target.value = getTravelerConsentStatus(state.traveler, target.dataset.consentType);
    }
    return;
  }

  if (target.hasAttribute("data-document-field")) {
    const field = normalizeText(target.dataset.documentField);
    const document = activeDocumentForDraft(state.traveler);
    if (field === "no_expiration_date" && target instanceof HTMLInputElement) {
      document.no_expiration_date = target.checked;
      if (document.no_expiration_date) document.expires_on = "";
      renderTravelerCard();
    } else {
      document[field] = field === "issuing_country"
        ? normalizeText(target.value).toUpperCase()
        : normalizeText(target.value);
    }
    state.traveler.documents[state.traveler.selected_document_type] = document;
  }
}

function handleTravelerFormChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (normalizeText(target.dataset.field) !== "selected_document_type" || !state.traveler) return;
  state.traveler.selected_document_type = normalizeSelectedDocumentType(state.traveler, target.value);
  if (state.traveler.selected_document_type === "passport") {
    const passportDocument = state.traveler.documents.passport || emptyDocumentDraft("passport");
    passportDocument.no_expiration_date = false;
    state.traveler.documents.passport = passportDocument;
  }
  renderTravelerCard();
}

function handleTravelerFormClick(event) {
  const pictureUploadButton = event.target instanceof Element
    ? event.target.closest("[data-document-picture-upload]")
    : null;
  if (pictureUploadButton instanceof HTMLButtonElement) {
    event.preventDefault();
    const input = document.getElementById("traveler_document_picture_input");
    if (input instanceof HTMLInputElement) input.click();
    return;
  }

  const switchButton = event.target instanceof Element
    ? event.target.closest("[data-document-switch]")
    : null;
  if (!(switchButton instanceof HTMLButtonElement) || !state.traveler) return;
  event.preventDefault();
  state.traveler.selected_document_type = normalizeSelectedDocumentType(
    state.traveler,
    switchButton.getAttribute("data-document-switch")
  );
  if (state.traveler.selected_document_type === "passport") {
    const passportDocument = state.traveler.documents.passport || emptyDocumentDraft("passport");
    passportDocument.no_expiration_date = false;
    state.traveler.documents.passport = passportDocument;
  }
  renderTravelerCard();
}

function validateTravelerDraft() {
  const traveler = state.traveler;
  if (!traveler) return travelerDetailsT("traveler_details_not_loaded", "Traveler details could not be loaded.");
  if (!normalizeText(traveler.name)) {
    return travelerDetailsT("traveler_name_required", "Traveler needs a full name.");
  }
  if (!requiredTravelerConsentsAccepted(traveler)) {
    return travelerDetailsT("consent_required_notice", "Privacy policy and Personalization are required to continue.");
  }
  if (normalizeText(traveler.date_of_birth) && !parseDateOnly(traveler.date_of_birth)) {
    return travelerDetailsT("traveler_date_of_birth_invalid", "Traveler date of birth must use YYYY-MM-DD.");
  }
  const document = activeDocumentForDraft(traveler);
  if (normalizeText(document.issued_on) && !parseDateOnly(document.issued_on)) {
    return travelerDetailsT("traveler_document_issued_on_invalid", "Traveler travel document issue date must use YYYY-MM-DD.");
  }
  if (!document.no_expiration_date && normalizeText(document.expires_on) && !parseDateOnly(document.expires_on)) {
    return travelerDetailsT("traveler_document_expires_on_invalid", "Traveler travel document expiry date must use YYYY-MM-DD.");
  }
  return "";
}

async function uploadActiveDocumentPicture(input) {
  if (!(input instanceof HTMLInputElement) || !state.traveler) return;
  const file = input.files?.[0] || null;
  if (!file) return;

  const documentType = normalizeSelectedDocumentType(state.traveler, state.traveler.selected_document_type);
  setStatus(travelerDetailsT("document_image_uploading", "Uploading {label} image...", {
    label: documentTypeLabel(documentType)
  }));
  try {
    const result = await requestJson(`/documents/${encodeURIComponent(documentType)}/picture`, {
      method: "POST",
      body: {
        filename: file.name,
        data_base64: await fileToBase64(file)
      }
    });
    if (!result.ok || !result.payload) {
      const message = normalizeText(result.payload?.error) || travelerDetailsT("could_not_upload_document_image", "Could not upload the document image.");
      setStatus(message, "error");
      return;
    }
    state.access = result.payload;
    state.traveler = createTravelerDraft(result.payload.person);
    render();
    setStatus(travelerDetailsT("document_image_uploaded", "{label} image uploaded.", {
      label: documentTypeLabel(documentType)
    }), "success");
  } catch {
    setStatus(travelerDetailsT("could_not_upload_document_image", "Could not upload the document image."), "error");
  } finally {
    input.value = "";
  }
}

async function saveTravelerDetails() {
  const validationError = validateTravelerDraft();
  if (validationError) {
    setStatus(validationError, "error");
    return;
  }

  state.saving = true;
  render();
  setStatus(travelerDetailsT("saving_traveler_details", "Saving traveler details..."));
  try {
    const result = await requestJson("/traveler-details", {
      method: "PATCH",
      body: {
        person: buildTravelerPayload(state.traveler)
      }
    });
    if (!result.ok || !result.payload) {
      const message = normalizeText(result.payload?.error)
        || (result.status === 410
          ? travelerDetailsT("traveler_details_expired", "This traveler details link has expired.")
          : travelerDetailsT("traveler_details_save_failed", "Could not save traveler details."));
      setStatus(message, "error");
      return;
    }
    state.access = result.payload;
    await ensureTravelerDetailsLanguage(travelerDetailsLang());
    state.traveler = createTravelerDraft(result.payload.person);
    setStatus(travelerDetailsT("traveler_details_saved", "Your details have been transmitted to Asia Travel Plan."), "success");
    render();
  } catch {
    setStatus(travelerDetailsT("traveler_details_save_failed", "Could not save traveler details."), "error");
  } finally {
    state.saving = false;
    render();
  }
}

async function loadTravelerDetails() {
  if (!state.bookingId || !state.personId || !state.token) {
    setError(travelerDetailsT("traveler_details_invalid_link", "This traveler details link is invalid."));
    return;
  }
  const result = await requestJson("/traveler-details/access");
  if (!result.ok || !result.payload) {
    const message = normalizeText(result.payload?.error)
      || (result.status === 410
        ? travelerDetailsT("traveler_details_expired", "This traveler details link has expired.")
        : travelerDetailsT("traveler_details_load_failed", "Could not load traveler details."));
    setError(message);
    return;
  }
  state.access = result.payload;
  await ensureTravelerDetailsLanguage(travelerDetailsLang());
  state.traveler = createTravelerDraft(result.payload.person);
  setStatus("");
  render();
}

els.form?.addEventListener("input", handleTravelerFormInput);
els.form?.addEventListener("change", handleTravelerFormChange);
els.form?.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.id === "traveler_document_picture_input") {
    void uploadActiveDocumentPicture(target);
  }
});
els.form?.addEventListener("click", handleTravelerFormClick);
els.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveTravelerDetails();
});

async function initTravelerDetailsPage() {
  await ensureTravelerDetailsLanguage(travelerDetailsLang());
  applyTravelerDetailsChromeCopy();
  await loadTravelerDetails();
}

void initTravelerDetailsPage();
