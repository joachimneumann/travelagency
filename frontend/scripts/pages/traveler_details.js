import {
  escapeHtml,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { GENERATED_LANGUAGE_CODES } from "../../Generated/Models/generated_Language.js";
import {
  languageByApiValue,
  languageByCode
} from "../../../shared/generated/language_catalog.js";
import { COUNTRY_CODE_OPTIONS } from "../shared/generated_catalogs.js";

const query = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const state = {
  bookingId: normalizeText(query.get("booking_id")),
  personId: normalizeText(query.get("person_id")),
  token: normalizeText(query.get("token")),
  access: null,
  traveler: null,
  saving: false
};

const els = {
  title: document.getElementById("traveler_details_title"),
  intro: document.getElementById("traveler_details_intro"),
  privacyNotice: document.getElementById("traveler_details_privacy_notice"),
  error: document.getElementById("traveler_details_error"),
  loading: document.getElementById("traveler_details_loading"),
  content: document.getElementById("traveler_details_content"),
  summary: document.getElementById("traveler_details_summary"),
  form: document.getElementById("traveler_details_form"),
  list: document.getElementById("traveler_details_list"),
  saveBtn: document.getElementById("traveler_details_save_btn"),
  status: document.getElementById("traveler_details_status")
};

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
    `<option value="">Select language</option>`,
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

function parseDateOnly(value) {
  const normalized = normalizeText(value);
  if (!normalized || !DATE_ONLY_PATTERN.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(document.documentElement.lang || "en", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

function emptyDocumentDraft(type = "passport") {
  return {
    document_type: type,
    holder_name: "",
    document_number: "",
    issuing_country: "",
    issued_on: "",
    expires_on: "",
    no_expiration_date: false
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
    no_expiration_date: type === "national_id" && document?.no_expiration_date === true
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
  const selectedDocumentType = normalizeText(preferredDocument?.document_type) || "passport";
  return {
    id: normalizeText(traveler.id) || state.personId || "traveler",
    name: normalizeText(traveler.name),
    email: normalizeText(Array.isArray(traveler.emails) ? traveler.emails[0] : ""),
    phone: normalizeText(Array.isArray(traveler.phone_numbers) ? traveler.phone_numbers[0] : ""),
    preferred_language: normalizeTravelerLanguageCode(traveler.preferred_language),
    date_of_birth: normalizeText(traveler.date_of_birth),
    nationality: normalizeText(traveler.nationality).toUpperCase(),
    address: {
      line_1: normalizeText(traveler.address?.line_1),
      line_2: normalizeText(traveler.address?.line_2),
      city: normalizeText(traveler.address?.city),
      state_region: normalizeText(traveler.address?.state_region),
      postal_code: normalizeText(traveler.address?.postal_code),
      country_code: normalizeText(traveler.address?.country_code).toUpperCase()
    },
    selected_document_type: selectedDocumentType,
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
    date_of_birth: normalizeText(traveler.date_of_birth),
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

function summaryRows() {
  const access = state.access;
  if (!access || !state.traveler) return [];
  return [
    ["Booking", access.booking_name || access.booking_id],
    ["Traveler", state.traveler.name || access.person_id],
    ["Link expires", formatDateTime(access.public_traveler_details_expires_at)]
  ];
}

function travelerCardMarkup(traveler) {
  const document = activeDocumentForDraft(traveler);
  const documentType = normalizeText(traveler.selected_document_type) || "passport";
  const documentTitle = "Travel Document";
  const documentLabel = documentType === "national_id" ? "ID card" : "Passport";
  const supportsNoExpirationDate = documentType === "national_id";
  return `
    <div class="traveler-details-card__grid">
      <div class="field">
        <label for="traveler_name">Full name</label>
        <input id="traveler_name" data-field="name" type="text" value="${escapeHtml(traveler.name)}" autocomplete="name" />
      </div>
      <div class="field">
        <label for="traveler_date_of_birth">Date of birth</label>
        <input id="traveler_date_of_birth" data-field="date_of_birth" type="date" value="${escapeHtml(traveler.date_of_birth)}" />
      </div>
      <div class="field">
        <label for="traveler_email">Email</label>
        <input id="traveler_email" data-field="email" type="email" value="${escapeHtml(traveler.email)}" autocomplete="email" />
      </div>
      <div class="field">
        <label for="traveler_phone">Phone number</label>
        <input id="traveler_phone" data-field="phone" type="tel" value="${escapeHtml(traveler.phone)}" autocomplete="tel" />
      </div>
      <div class="field">
        <label for="traveler_preferred_language">Preferred language</label>
        <select id="traveler_preferred_language" data-field="preferred_language">
          ${renderTravelerLanguageOptions(traveler.preferred_language)}
        </select>
      </div>
      <div class="field">
        <label for="traveler_nationality">Nationality</label>
        <select id="traveler_nationality" data-field="nationality">
          ${renderCountryOptions(traveler.nationality, "Select nationality")}
        </select>
      </div>
    </div>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title">Address</h3>
    </div>
    <div class="traveler-details-card__grid traveler-details-card__grid--document">
      <div class="field">
        <label for="traveler_address_line_1">Address line 1</label>
        <input id="traveler_address_line_1" data-address-field="line_1" type="text" value="${escapeHtml(traveler.address.line_1)}" autocomplete="address-line1" />
      </div>
      <div class="field">
        <label for="traveler_address_line_2">Address line 2</label>
        <input id="traveler_address_line_2" data-address-field="line_2" type="text" value="${escapeHtml(traveler.address.line_2)}" autocomplete="address-line2" />
      </div>
      <div class="field">
        <label for="traveler_city">City</label>
        <input id="traveler_city" data-address-field="city" type="text" value="${escapeHtml(traveler.address.city)}" autocomplete="address-level2" />
      </div>
      <div class="field">
        <label for="traveler_state_region">State / region</label>
        <input id="traveler_state_region" data-address-field="state_region" type="text" value="${escapeHtml(traveler.address.state_region)}" autocomplete="address-level1" />
      </div>
      <div class="field">
        <label for="traveler_postal_code">Postal code</label>
        <input id="traveler_postal_code" data-address-field="postal_code" type="text" value="${escapeHtml(traveler.address.postal_code)}" autocomplete="postal-code" />
      </div>
      <div class="field">
        <label for="traveler_country_code">Country code</label>
        <input id="traveler_country_code" data-address-field="country_code" type="text" maxlength="2" value="${escapeHtml(traveler.address.country_code)}" autocomplete="country" />
      </div>
    </div>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title">${escapeHtml(documentTitle)}</h3>
    </div>
    <div class="traveler-details-card__grid traveler-details-card__grid--document">
      <div class="field">
        <label for="traveler_document_type">Travel document</label>
        <select id="traveler_document_type" data-field="selected_document_type">
          <option value="passport"${documentType === "passport" ? " selected" : ""}>Passport</option>
          <option value="national_id"${documentType === "national_id" ? " selected" : ""}>ID card</option>
        </select>
      </div>
      <div class="field">
        <label for="traveler_document_holder_name">Holder name</label>
        <input id="traveler_document_holder_name" data-document-field="holder_name" type="text" value="${escapeHtml(document.holder_name)}" />
      </div>
      <div class="field">
        <label for="traveler_document_number">${escapeHtml(documentLabel)} number</label>
        <input id="traveler_document_number" data-document-field="document_number" type="text" value="${escapeHtml(document.document_number)}" />
      </div>
      <div class="field">
        <label for="traveler_issuing_country">Issuing country</label>
        <select id="traveler_issuing_country" data-document-field="issuing_country">
          ${renderCountryOptions(document.issuing_country, "Select issuing country")}
        </select>
      </div>
      <div class="field">
        <label for="traveler_issued_on">Issued on</label>
        <input id="traveler_issued_on" data-document-field="issued_on" type="date" value="${escapeHtml(document.issued_on)}" />
      </div>
      <div class="field">
        <label for="traveler_expires_on">Expires on</label>
        <input id="traveler_expires_on" data-document-field="expires_on" type="date" value="${escapeHtml(document.expires_on)}"${supportsNoExpirationDate && document.no_expiration_date ? " disabled" : ""} />
      </div>
    </div>
    ${supportsNoExpirationDate ? `
    <label class="traveler-details-document__checkbox">
      <input type="checkbox" data-document-field="no_expiration_date"${document.no_expiration_date ? " checked" : ""} />
      No expiration date
    </label>
    ` : ""}
  `;
}

function renderSummary() {
  els.summary.innerHTML = summaryRows().map(([label, value]) => `
    <div class="traveler-details-summary__row">
      <div class="traveler-details-summary__label">${escapeHtml(label)}</div>
      <div class="traveler-details-summary__value">${escapeHtml(value)}</div>
    </div>
  `).join("");
}

function renderTravelerCard() {
  els.list.innerHTML = state.traveler ? travelerCardMarkup(state.traveler) : "";
}

function render() {
  const access = state.access;
  const bookingName = normalizeText(access?.booking_name || access?.booking_id);
  if (bookingName) {
    document.title = `Traveler Details | ${bookingName}`;
    els.title.textContent = bookingName;
  }
  if (access?.customer_language) {
    document.documentElement.lang = normalizeText(query.get("lang") || access.customer_language || "en").toLowerCase() || "en";
  }
  if (els.privacyNotice) {
    els.privacyNotice.textContent = normalizeText(access?.privacy_notice);
    els.privacyNotice.hidden = !normalizeText(access?.privacy_notice);
  }
  els.loading.hidden = Boolean(access);
  els.content.hidden = !access;
  els.saveBtn.disabled = state.saving;
  renderSummary();
  renderTravelerCard();
}

function handleTravelerFormInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
  if (!state.traveler) return;

  if (target.hasAttribute("data-field")) {
    const field = normalizeText(target.dataset.field);
    state.traveler[field] = field === "nationality"
      ? normalizeText(target.value).toUpperCase()
      : normalizeText(target.value);
    return;
  }

  if (target.hasAttribute("data-address-field")) {
    const field = normalizeText(target.dataset.addressField);
    state.traveler.address[field] = field === "country_code"
      ? normalizeText(target.value).toUpperCase()
      : normalizeText(target.value);
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
  state.traveler.selected_document_type = normalizeText(target.value) || "passport";
  if (state.traveler.selected_document_type === "passport") {
    const passportDocument = state.traveler.documents.passport || emptyDocumentDraft("passport");
    passportDocument.no_expiration_date = false;
    state.traveler.documents.passport = passportDocument;
  }
  renderTravelerCard();
}

function validateTravelerDraft() {
  const traveler = state.traveler;
  if (!traveler) return "Traveler details could not be loaded.";
  if (!normalizeText(traveler.name)) {
    return "Traveler needs a full name.";
  }
  if (normalizeText(traveler.date_of_birth) && !parseDateOnly(traveler.date_of_birth)) {
    return "Traveler date of birth must use YYYY-MM-DD.";
  }
  const document = activeDocumentForDraft(traveler);
  if (normalizeText(document.issued_on) && !parseDateOnly(document.issued_on)) {
    return "Traveler travel document issue date must use YYYY-MM-DD.";
  }
  if (!document.no_expiration_date && normalizeText(document.expires_on) && !parseDateOnly(document.expires_on)) {
    return "Traveler travel document expiry date must use YYYY-MM-DD.";
  }
  return "";
}

async function saveTravelerDetails() {
  const validationError = validateTravelerDraft();
  if (validationError) {
    setStatus(validationError, "error");
    return;
  }

  state.saving = true;
  render();
  setStatus("Saving traveler details...");
  try {
    const result = await requestJson("/traveler-details", {
      method: "PATCH",
      body: {
        person: buildTravelerPayload(state.traveler)
      }
    });
    if (!result.ok || !result.payload) {
      const message = normalizeText(result.payload?.error)
        || (result.status === 410 ? "This traveler details link has expired." : "Could not save traveler details.");
      setStatus(message, "error");
      return;
    }
    state.access = result.payload;
    state.traveler = createTravelerDraft(result.payload.person);
    setStatus("Traveler details saved.", "success");
    render();
  } catch {
    setStatus("Could not save traveler details.", "error");
  } finally {
    state.saving = false;
    render();
  }
}

async function loadTravelerDetails() {
  if (!state.bookingId || !state.personId || !state.token) {
    setError("This traveler details link is invalid.");
    return;
  }
  const result = await requestJson("/traveler-details/access");
  if (!result.ok || !result.payload) {
    const message = normalizeText(result.payload?.error)
      || (result.status === 410 ? "This traveler details link has expired." : "Could not load traveler details.");
    setError(message);
    return;
  }
  state.access = result.payload;
  state.traveler = createTravelerDraft(result.payload.person);
  setStatus("");
  render();
}

els.form?.addEventListener("input", handleTravelerFormInput);
els.form?.addEventListener("change", handleTravelerFormChange);
els.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveTravelerDetails();
});

void loadTravelerDetails();
