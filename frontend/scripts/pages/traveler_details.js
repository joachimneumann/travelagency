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
  error: document.getElementById("traveler_details_error"),
  loading: document.getElementById("traveler_details_loading"),
  content: document.getElementById("traveler_details_content"),
  form: document.getElementById("traveler_details_form"),
  list: document.getElementById("traveler_details_list"),
  actions: document.getElementById("traveler_details_actions"),
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
    food_preferences: normalizePreferenceList(traveler.food_preferences),
    allergies: normalizePreferenceList(traveler.allergies),
    hotel_room_smoker: traveler?.hotel_room_smoker === true,
    hotel_room_sharing_ok: traveler?.hotel_room_sharing_ok !== false,
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

function travelerCardMarkup(traveler) {
  const document = activeDocumentForDraft(traveler);
  const documentType = normalizeText(traveler.selected_document_type) || "passport";
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
      <div class="field">
        <label for="traveler_food_preferences">Food preferences</label>
        <input id="traveler_food_preferences" data-field="food_preferences" type="text" value="${escapeHtml(traveler.food_preferences.join(", "))}" placeholder="Vegetarian, vegan, halal..." />
      </div>
      <div class="field">
        <label for="traveler_allergies">Allergies</label>
        <input id="traveler_allergies" data-field="allergies" type="text" value="${escapeHtml(traveler.allergies.join(", "))}" placeholder="Peanuts, shellfish..." />
      </div>
      <div class="field">
        <label for="traveler_hotel_room_smoker">Hotel room smoking preference</label>
        <select id="traveler_hotel_room_smoker" data-field="hotel_room_smoker">
          <option value="false"${traveler.hotel_room_smoker === true ? "" : " selected"}>Non-smoker</option>
          <option value="true"${traveler.hotel_room_smoker === true ? " selected" : ""}>Smoker</option>
        </select>
      </div>
      <div class="field">
        <label for="traveler_hotel_room_preference">Hotel room preference</label>
        <select id="traveler_hotel_room_preference" data-field="hotel_room_sharing_ok">
          <option value="true"${traveler.hotel_room_sharing_ok !== false ? " selected" : ""}>Sharing room ok</option>
          <option value="false"${traveler.hotel_room_sharing_ok === false ? " selected" : ""}>Single room</option>
        </select>
      </div>
    </div>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title" aria-hidden="true"></h3>
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
        <label for="traveler_state_region">State / region (optional)</label>
        <input id="traveler_state_region" data-address-field="state_region" type="text" value="${escapeHtml(traveler.address.state_region)}" autocomplete="address-level1" />
      </div>
      <div class="field">
        <label for="traveler_postal_code">Postal code</label>
        <input id="traveler_postal_code" data-address-field="postal_code" type="text" value="${escapeHtml(traveler.address.postal_code)}" autocomplete="postal-code" />
      </div>
      <div class="field">
        <label for="traveler_country_code">Country code of address</label>
        <select id="traveler_country_code" data-address-field="country_code">
          ${renderCountryOptions(traveler.address.country_code, "Select country")}
        </select>
      </div>
    </div>

    <div class="traveler-details-document__head">
      <h3 class="traveler-details-document__title" aria-hidden="true"></h3>
    </div>
    <div class="traveler-details-card__grid traveler-details-card__grid--document">
      <div class="field">
        <label>Travel document</label>
        <div class="booking-person-modal__document-switch traveler-details-document__switch" role="tablist" aria-label="Travel document type">
          <button
            class="booking-person-modal__document-switch-btn${documentType === "passport" ? " is-active" : ""}"
            type="button"
            data-document-switch="passport"
            aria-selected="${documentType === "passport" ? "true" : "false"}"
          >Passport</button>
          <button
            class="booking-person-modal__document-switch-btn${documentType === "national_id" ? " is-active" : ""}"
            type="button"
            data-document-switch="national_id"
            aria-selected="${documentType === "national_id" ? "true" : "false"}"
          >ID card</button>
        </div>
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
        <div class="traveler-details-document__checkbox-wrap">
        ${supportsNoExpirationDate ? `
          <label class="traveler-details-document__checkbox">
            <input type="checkbox" data-document-field="no_expiration_date"${document.no_expiration_date ? " checked" : ""} />
            No expiration date
          </label>
        ` : `
          <span class="traveler-details-document__checkbox traveler-details-document__checkbox--placeholder" aria-hidden="true">No expiration date</span>
        `}
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
  if (bookingName && Number.isInteger(travelerNumber) && travelerNumber >= 1) {
    const heading = `Traveler ${travelerNumber}: ${bookingName}`;
    els.title.textContent = heading;
    document.title = `${heading} | AsiaTravelPlan`;
  } else if (bookingName) {
    els.title.textContent = bookingName;
    document.title = `${bookingName} | AsiaTravelPlan`;
  }
  if (access?.customer_language) {
    document.documentElement.lang = normalizeText(query.get("lang") || access.customer_language || "en").toLowerCase() || "en";
  }
  els.loading.hidden = Boolean(access);
  els.content.hidden = !access;
  els.saveBtn.disabled = state.saving;
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

function handleTravelerFormClick(event) {
  const switchButton = event.target instanceof Element
    ? event.target.closest("[data-document-switch]")
    : null;
  if (!(switchButton instanceof HTMLButtonElement) || !state.traveler) return;
  event.preventDefault();
  state.traveler.selected_document_type = normalizeText(switchButton.getAttribute("data-document-switch")) || "passport";
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
els.form?.addEventListener("click", handleTravelerFormClick);
els.form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveTravelerDetails();
});

void loadTravelerDetails();
