import {
  CUSTOMER_SCHEMA,
  CUSTOMER_CONSENT_SCHEMA,
  CUSTOMER_DOCUMENT_SCHEMA,
  TRAVEL_GROUP_SCHEMA,
  TRAVEL_GROUP_MEMBER_SCHEMA
} from "../../frontend/Generated/Models/generated_Aux.js";
import { CUSTOMER_CONSENT_CREATE_REQUEST_SCHEMA } from "../../frontend/Generated/API/generated_APIModels.js";
import {
  normalizeCurrencyCode
} from "../../frontend/Generated/Models/generated_Currency.js";
import { normalizeLocalDateTimeToIso } from "./shared/datetime.js";
import {
  customerConsentCreateRequest,
  customerDetailRequest,
  customerPhotoUploadRequest,
  customerUpdateRequest
} from "../../frontend/Generated/API/generated_APIRequestFactory.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const ORGANIZATION_CUSTOMER_FIELDS = new Set([
  "organization_name",
  "organization_address",
  "organization_phone_number",
  "organization_webpage",
  "organization_email",
  "tax_id"
]);

const state = {
  id: qs.get("id") || "",
  customer: null,
  consents: [],
  isSaving: false,
  isOrganizationCustomer: false
};

const CUSTOMER_FIELD_UI_CONFIG = {
  id: { editable: false },
  created_at: { editable: false },
  updated_at: { editable: false },
  archived_at: { editable: false },
  notes: { editable: true, control: "textarea", rows: 4 }
};

const CUSTOMER_CONSENT_CREATE_FIELDS = Object.fromEntries(
  CUSTOMER_CONSENT_CREATE_REQUEST_SCHEMA.fields.map((field) => [field.name, field])
);

function selectOptionsFromField(field) {
  if (!Array.isArray(field?.options)) return [];
  return field.options
    .map((option) => ({
      value: String(option?.value || ""),
      label: String(option?.label || option?.value || "")
    }))
    .filter((option) => option.value);
}

const CUSTOMER_CONSENT_TYPE_OPTIONS = selectOptionsFromField(CUSTOMER_CONSENT_CREATE_FIELDS.consent_type);
const CUSTOMER_CONSENT_STATUS_OPTIONS = selectOptionsFromField(CUSTOMER_CONSENT_CREATE_FIELDS.status);

const CUSTOMER_PRIMARY_GROUP_FIELD_NAMES = [
  "title",
  "name",
  "date_of_birth",
  "nationality",
  "phone_number",
  "email",
  "preferred_language",
  "preferred_currency",
  "timezone"
];

const CUSTOMER_ADDRESS_GROUP_FIELD_NAMES = [
  "address_line_1",
  "address_line_2",
  "address_postal_code",
  "address_city",
  "address_country_code",
  "address_state_region"
];

const CUSTOMER_NOTES_GROUP_FIELD_NAMES = [
  "notes"
];

const CUSTOMER_EDIT_FIELDS = CUSTOMER_SCHEMA.fields
  .filter((field) => !["id", "first_name", "last_name"].includes(field.name))
  .map((field) => {
    const config = CUSTOMER_FIELD_UI_CONFIG[field.name] || {};
    return {
      ...field,
      ...(field.kind === "enum" && Array.isArray(field.options) && field.options.length
        ? { control: "select", options: selectOptionsFromField(field) }
        : {}),
      ...config,
      editable: config.editable ?? true
    };
  });

const CUSTOMER_PRIMARY_GROUP_FIELDS = CUSTOMER_PRIMARY_GROUP_FIELD_NAMES
  .map((fieldName) => CUSTOMER_EDIT_FIELDS.find((field) => field.name === fieldName))
  .filter(Boolean);

const CUSTOMER_ADDRESS_GROUP_FIELDS = CUSTOMER_ADDRESS_GROUP_FIELD_NAMES
  .map((fieldName) => CUSTOMER_EDIT_FIELDS.find((field) => field.name === fieldName))
  .filter(Boolean);

const CUSTOMER_ORGANIZATION_GROUP_FIELDS = CUSTOMER_EDIT_FIELDS.filter((field) =>
  ORGANIZATION_CUSTOMER_FIELDS.has(field.name)
);

const CUSTOMER_NOTES_GROUP_FIELDS = CUSTOMER_NOTES_GROUP_FIELD_NAMES
  .map((fieldName) => CUSTOMER_EDIT_FIELDS.find((field) => field.name === fieldName))
  .filter(Boolean);

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),
  userLabel: document.getElementById("backendUserLabel"),
  heroId: document.getElementById("customerHeroId"),
  heroName: document.getElementById("customerHeroName"),
  heroPhoto: document.getElementById("customerHeroPhoto"),
  heroPhotoPlaceholder: document.getElementById("customerHeroPhotoPlaceholder"),
  error: document.getElementById("detailError"),
  photoInput: document.getElementById("customerPhotoInput"),
  photoUploadBtn: document.getElementById("customerPhotoUploadBtn"),
  photoStatus: document.getElementById("customerPhotoStatus"),
  customerPrimaryGroup: document.getElementById("customerPrimaryGroup"),
  customerAddressGroup: document.getElementById("customerAddressGroup"),
  customerOrganizationGroup: document.getElementById("customerOrganizationGroup"),
  customerNotesGroup: document.getElementById("customerNotesGroup"),
  systemMeta: document.getElementById("customerSystemMeta"),
  consentsTable: document.getElementById("customerConsentsTable"),
  addConsentBtn: document.getElementById("customerAddConsentBtn"),
  consentForm: document.getElementById("customerConsentForm"),
  consentType: document.getElementById("customerConsentType"),
  consentStatusSelect: document.getElementById("customerConsentStatus"),
  consentCapturedVia: document.getElementById("customerConsentCapturedVia"),
  consentCapturedAt: document.getElementById("customerConsentCapturedAt"),
  consentEvidenceRef: document.getElementById("customerConsentEvidenceRef"),
  consentEvidenceFile: document.getElementById("customerConsentEvidenceFile"),
  consentSaveBtn: document.getElementById("customerConsentSaveBtn"),
  consentCancelBtn: document.getElementById("customerConsentCancelBtn"),
  consentFormStatus: document.getElementById("customerConsentFormStatus"),
  documentsTable: document.getElementById("customerDocumentsTable"),
  travelGroupsTable: document.getElementById("customerTravelGroupsTable"),
  travelGroupMembersTable: document.getElementById("customerTravelGroupMembersTable"),
  bookingsTable: document.getElementById("customerBookingsTable"),
  saveBtn: document.getElementById("customerSaveBtn"),
  saveBtnBottom: document.getElementById("customerSaveBtnBottom"),
  saveStatus: document.getElementById("customerSaveStatus"),
  organizationToggle: null
};

init();

async function init() {
  const backHref = "backend.html";

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  if (els.saveBtn) {
    els.saveBtn.addEventListener("click", saveCustomerProfile);
    els.saveBtn.disabled = true;
  }
  if (els.saveBtnBottom) {
    els.saveBtnBottom.addEventListener("click", saveCustomerProfile);
    els.saveBtnBottom.disabled = true;
  }
  if (els.photoUploadBtn) {
    els.photoUploadBtn.addEventListener("click", saveCustomerPhoto);
  }
  populateConsentFormOptions();
  if (els.addConsentBtn) els.addConsentBtn.addEventListener("click", () => toggleConsentForm(true));
  if (els.consentCancelBtn) els.consentCancelBtn.addEventListener("click", () => toggleConsentForm(false));
  if (els.consentSaveBtn) els.consentSaveBtn.addEventListener("click", saveCustomerConsent);

  bindSectionNavigation("customers");
  await loadAuthStatus();

  if (!state.id) {
    showError("Missing customer id.");
    return;
  }

  await loadCustomer();
}

function bindSectionNavigation(activeSection) {
  Array.from(els.sectionNavButtons || []).forEach((button) => {
    const section = button.dataset.backendSection;
    if (!section) return;
    button.classList.toggle("is-active", section === activeSection);
    if (section === activeSection) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
    button.addEventListener("click", () => {
      window.location.href = `backend.html?section=${encodeURIComponent(section)}`;
    });
  });
}

async function loadCustomer() {
  const payload = await fetchApi(customerDetailRequest({ baseURL: apiOrigin, params: { customerId: state.id } }).url);
  if (!payload?.customer) return;

  state.customer = normalizeCustomer(payload.customer);
  renderCustomerHero(state.customer);

  state.isOrganizationCustomer = shouldEnableOrganizationFields(state.customer);
  if (els.organizationToggle) {
    els.organizationToggle.checked = state.isOrganizationCustomer;
  }

  renderEditableCustomerGroup(els.customerPrimaryGroup, CUSTOMER_PRIMARY_GROUP_FIELDS, state.customer, "primary");
  renderEditableCustomerGroup(els.customerAddressGroup, CUSTOMER_ADDRESS_GROUP_FIELDS, state.customer, "address");
  renderEditableCustomerGroup(els.customerOrganizationGroup, CUSTOMER_ORGANIZATION_GROUP_FIELDS, state.customer, "organization");
  renderEditableCustomerGroup(els.customerNotesGroup, CUSTOMER_NOTES_GROUP_FIELDS, state.customer, "notes");
  bindOrganizationToggle();
  renderCustomerSystemMeta(state.customer);
  applyOrganizationFieldVisibility(state.isOrganizationCustomer);
  bindCustomerProfileInputs();
  state.consents = Array.isArray(payload.consents) ? payload.consents : [];
  renderCustomerConsents(state.consents);
  renderCustomerDocuments(payload.documents || []);
  renderTravelGroups(payload.travelGroups || []);
  renderTravelGroupMembers(payload.travelGroupMembers || []);
  renderRelatedBookings(payload.bookings || []);

  setSaveEnabled(false);
  clearSaveStatus();
}

function renderCustomerHero(customer) {
  updateCustomerHeroName(customer.name || "Customer");
  updateCustomerHeroPhoto(customer.photo_ref);

  if (els.heroId) {
    els.heroId.textContent = customer.id ? `ID: ${customer.id}` : "ID: -";
  }
}

function normalizeCustomer(customer) {
  const normalized = {
    ...customer,
    name: normalizeText(customer.name) || "",
    photo_ref: normalizeText(customer.photo_ref) || "",
    title: normalizeText(customer.title) || "",
    phone_number: normalizeText(customer.phone_number) || "",
    preferred_language: normalizeText(customer.preferred_language) || "",
    first_name: normalizeText(customer.first_name) || "",
    last_name: normalizeText(customer.last_name) || "",
    date_of_birth: normalizeText(customer.date_of_birth) || "",
    nationality: normalizeText(customer.nationality) || "",
    address_line_1: normalizeText(customer.address_line_1) || "",
    address_line_2: normalizeText(customer.address_line_2) || "",
    address_city: normalizeText(customer.address_city) || "",
    address_state_region: normalizeText(customer.address_state_region) || "",
    address_postal_code: normalizeText(customer.address_postal_code) || "",
    address_country_code: normalizeText(customer.address_country_code) || "",
    organization_name: normalizeText(customer.organization_name) || "",
    organization_address: normalizeText(customer.organization_address) || "",
    organization_phone_number: normalizeText(customer.organization_phone_number) || "",
    organization_webpage: normalizeText(customer.organization_webpage) || "",
    organization_email: normalizeText(customer.organization_email) || "",
    tax_id: normalizeText(customer.tax_id) || "",
    email: normalizeText(customer.email) || "",
    preferred_currency: normalizeText(customer.preferred_currency) || "",
    timezone: normalizeText(customer.timezone) || "",
    notes: normalizeText(customer.notes) || ""
  };

  return normalized;
}

function updateCustomerHeroPhoto(value) {
  const photoRef = normalizeText(value);
  if (els.heroPhoto) {
    if (photoRef) {
      els.heroPhoto.src = photoRef;
      els.heroPhoto.hidden = false;
    } else {
      els.heroPhoto.removeAttribute("src");
      els.heroPhoto.hidden = true;
    }
  }
  if (els.heroPhotoPlaceholder) {
    els.heroPhotoPlaceholder.hidden = Boolean(photoRef);
  }
}

function renderCustomerConsents(consents) {
  if (!els.consentsTable) return;
  const fields = CUSTOMER_CONSENT_SCHEMA.fields;
  const rows = Array.isArray(consents) ? consents : [];
  const header = `<thead><tr>${fields.map((field) => `<th>${escapeHtml(fieldLabel(field.name))}</th>`).join("")}</tr></thead>`;
  const bodyRows = rows
    .map((row) => {
      const cells = fields
        .map((field) => {
          const value = row?.[field.name];
          const evidenceRef = normalizeText(row?.evidence_ref) || normalizeText(row?.evidenceRef);
          if ((field.name === "evidence_ref" || field.name === "evidenceRef") && evidenceRef) {
            return `<td><a href="${escapeHtml(evidenceRef)}" target="_blank" rel="noopener">Open</a></td>`;
          }
          return `<td>${escapeHtml(formatFieldValue(value, field))}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const emptyText = `<tr><td colspan="${fields.length}">${escapeHtml("No Customer Consents")}</td></tr>`;
  els.consentsTable.innerHTML = `${header}<tbody>${bodyRows || emptyText}</tbody>`;
}

function toggleConsentForm(show) {
  if (!els.consentForm) return;
  els.consentForm.hidden = !show;
  if (!show) {
    resetConsentForm();
  }
}

function resetConsentForm() {
  if (els.consentType) els.consentType.value = CUSTOMER_CONSENT_TYPE_OPTIONS[0]?.value || "";
  if (els.consentStatusSelect) els.consentStatusSelect.value = CUSTOMER_CONSENT_STATUS_OPTIONS[0]?.value || "";
  if (els.consentCapturedVia) els.consentCapturedVia.value = "";
  if (els.consentCapturedAt) els.consentCapturedAt.value = "";
  if (els.consentEvidenceRef) els.consentEvidenceRef.value = "";
  if (els.consentEvidenceFile) els.consentEvidenceFile.value = "";
  if (els.consentFormStatus) els.consentFormStatus.textContent = "";
}

function populateConsentFormOptions() {
  populateSelectElement(els.consentType, CUSTOMER_CONSENT_TYPE_OPTIONS);
  populateSelectElement(els.consentStatusSelect, CUSTOMER_CONSENT_STATUS_OPTIONS);
  resetConsentForm();
}

function populateSelectElement(selectEl, options, { includeBlank = false } = {}) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const optionHtml = options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    )
    .join("");
  const blankHtml = includeBlank ? '<option value="">(select)</option>' : "";
  selectEl.innerHTML = `${blankHtml}${optionHtml}`;
}

async function saveCustomerConsent() {
  if (!state.id) return;
  if (els.consentSaveBtn) els.consentSaveBtn.disabled = true;
  if (els.consentFormStatus) els.consentFormStatus.textContent = "";
  try {
    const evidenceUpload = await readConsentEvidenceUpload();
    const request = customerConsentCreateRequest({
      baseURL: apiOrigin,
      params: { customerId: state.id }
    });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        consent_type: els.consentType?.value || CUSTOMER_CONSENT_TYPE_OPTIONS[0]?.value || "",
        status: els.consentStatusSelect?.value || CUSTOMER_CONSENT_STATUS_OPTIONS[0]?.value || "",
        captured_via: normalizeText(els.consentCapturedVia?.value) || null,
        captured_at: normalizeLocalDateTimeToIso(els.consentCapturedAt?.value),
        evidence_ref: normalizeText(els.consentEvidenceRef?.value) || null,
        evidence_upload: evidenceUpload
      }
    });
    if (!result?.consent) {
      if (els.consentFormStatus && !els.consentFormStatus.textContent) {
        els.consentFormStatus.textContent = "Could not save consent.";
      }
      return;
    }
    state.consents = [result.consent, ...(Array.isArray(state.consents) ? state.consents : [])];
    renderCustomerConsents(state.consents);
    toggleConsentForm(false);
    await loadCustomer();
  } catch (error) {
    if (els.consentFormStatus) {
      els.consentFormStatus.textContent = error?.message || "Could not save consent.";
    }
  } finally {
    if (els.consentSaveBtn) els.consentSaveBtn.disabled = false;
  }
}

async function saveCustomerPhoto() {
  if (!state.id) return;
  const photoUpload = await readCustomerPhotoUpload();
  if (!photoUpload) {
    if (els.photoStatus) els.photoStatus.textContent = "Choose an image first.";
    return;
  }
  if (els.photoUploadBtn) els.photoUploadBtn.disabled = true;
  if (els.photoStatus) els.photoStatus.textContent = "";
  try {
    const request = customerPhotoUploadRequest({
      baseURL: apiOrigin,
      params: { customerId: state.id }
    });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        photo_upload: photoUpload
      }
    });
    if (!result?.customer) {
      if (els.photoStatus && !els.photoStatus.textContent) {
        els.photoStatus.textContent = "Could not upload photo.";
      }
      return;
    }
    state.customer = normalizeCustomer(result.customer);
    renderCustomerHero(state.customer);
    if (els.photoInput) els.photoInput.value = "";
    if (els.photoStatus) els.photoStatus.textContent = "Photo uploaded.";
  } catch (error) {
    if (els.photoStatus) {
      els.photoStatus.textContent = error?.message || "Could not upload photo.";
    }
  } finally {
    if (els.photoUploadBtn) els.photoUploadBtn.disabled = false;
  }
}

async function readCustomerPhotoUpload() {
  const file = els.photoInput?.files?.[0];
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
  const [, base64 = ""] = dataUrl.split(",", 2);
  return {
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
    data_base64: base64
  };
}

async function readConsentEvidenceUpload() {
  const file = els.consentEvidenceFile?.files?.[0];
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
  const [, base64 = ""] = dataUrl.split(",", 2);
  return {
    filename: file.name,
    mime_type: file.type || "application/octet-stream",
    data_base64: base64
  };
}

function renderCustomerDocuments(documents) {
  renderEntityCollectionTable(
    els.documentsTable,
    "Customer Documents",
    Array.isArray(documents) ? documents : [],
    CUSTOMER_DOCUMENT_SCHEMA.fields
  );
}

function renderTravelGroups(groups) {
  renderEntityCollectionTable(
    els.travelGroupsTable,
    "Travel Groups",
    Array.isArray(groups) ? groups : [],
    TRAVEL_GROUP_SCHEMA.fields
  );
}

function renderTravelGroupMembers(members) {
  renderEntityCollectionTable(
    els.travelGroupMembersTable,
    "Travel Group Members",
    Array.isArray(members) ? members : [],
    TRAVEL_GROUP_MEMBER_SCHEMA.fields
  );
}

function renderEditableCustomerTable(tableEl, fields, entity) {
  if (!tableEl) return;

  const header = `<thead><tr><th>Field</th><th>Value</th></tr></thead>`;
  const rows = fields
    .map((field) => {
      const value = entity?.[field.name];
      const isOrganizationField = isCustomerOrganizationField(field.name);
      const hiddenStyle = !state.isOrganizationCustomer && isOrganizationField ? ' style="display: none;"' : "";
      return `
        <tr data-customer-org-field="${isOrganizationField ? "1" : "0"}"${hiddenStyle}>
          <th>${escapeHtml(fieldLabel(field.name))}</th>
          <td>${renderEditableFieldInput(field, value)}</td>
        </tr>
      `;
    })
    .join("");

  tableEl.innerHTML = `${header}<tbody>${rows}</tbody>`;
}

function renderEditableCustomerGroup(containerEl, fields, entity, variant = "primary") {
  if (!containerEl) return;

  const rows = fields
    .map((field) => {
      const value = entity?.[field.name];
      const labelText = fieldLabel(field.name);
      const layoutClass = variant === "primary"
        ? getCustomerPrimaryFieldLayoutClass(field.name)
        : variant === "address"
          ? getCustomerAddressFieldLayoutClass(field.name)
        : variant === "organization"
          ? getCustomerOrganizationFieldLayoutClass(field.name)
          : variant === "notes"
            ? " full"
          : "";
      return `
        <div class="field${layoutClass}">
          ${labelText ? `<label for="${customerFieldInputId(field.name)}">${escapeHtml(labelText)}</label>` : ""}
          ${renderEditableFieldInput(field, value)}
        </div>
      `;
    })
    .join("");

  const organizationToggle = variant === "organization"
    ? `
      <div class="field field--organization-toggle">
        <label class="customer-primary-group__toggle" for="customerIsOrganization">
          <input id="customerIsOrganization" type="checkbox" ${state.isOrganizationCustomer ? "checked" : ""} />
          <span>Organization</span>
        </label>
      </div>
    `
    : "";

  if (variant === "organization") {
    containerEl.innerHTML = `
      <div class="field-grid">
        ${organizationToggle}
        <div class="customer-organization-group__fields">
          ${rows}
        </div>
      </div>
    `;
    return;
  }

  containerEl.innerHTML = `<div class="field-grid">${organizationToggle}${rows}</div>`;
}

function getCustomerPrimaryFieldLayoutClass(fieldName) {
  if (fieldName === "title") return " field--title";
  if (fieldName === "name") return " field--name";
  if (fieldName === "date_of_birth") return " field--dob";
  if (fieldName === "nationality") return " field--nationality";
  if (fieldName === "phone_number") return " field--phone";
  if (fieldName === "email") return " field--email";
  return "";
}

function getCustomerOrganizationFieldLayoutClass(fieldName) {
  if (fieldName === "organization_name") return " full";
  if (fieldName === "organization_address") return " full";
  if (fieldName === "organization_phone_number") return " full";
  if (fieldName === "organization_webpage") return " full";
  if (fieldName === "organization_email") return " full";
  if (fieldName === "tax_id") return " full";
  return "";
}

function getCustomerAddressFieldLayoutClass(fieldName) {
  if (fieldName === "address_line_1") return " field--line-1";
  if (fieldName === "address_line_2") return " field--line-2";
  if (fieldName === "address_postal_code") return " field--postal";
  if (fieldName === "address_city") return " field--city";
  if (fieldName === "address_country_code") return " field--country-code";
  if (fieldName === "address_state_region") return " field--state-region";
  return "";
}

function renderEditableFieldInput(field, value) {
  const fieldId = customerFieldInputId(field.name);
  if (!field.editable) {
    return `<span>${escapeHtml(formatFieldValue(value, field))}</span>`;
  }

  const options = field.options || [];
  if (field.typeName === "bool") {
    const checked = value ? "checked" : "";
    return `<label><input type="checkbox" id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" ${checked} /></label>`;
  }

  if (field.control === "select" && options.length) {
    const optionsHtml = options
      .map((entry) => {
        const optionValue = String(entry.value || "");
        const optionLabel = String(entry.label || entry.value || "");
        const selected = normalizeText(optionValue) === normalizeText(value) ? " selected" : "";
        return `<option value="${escapeHtml(optionValue)}"${selected}>${escapeHtml(optionLabel)}</option>`;
      })
      .join("");
    return `<select id="${fieldId}" data-customer-field="${escapeHtml(field.name)}"><option value="">(select)</option>${optionsHtml}</select>`;
  }

  if (field.control === "textarea") {
    const isMultiLine = field.isArray;
    const rows = Number(field.rows) > 0 ? Number(field.rows) : 2;
    const asText = field.isArray ? (Array.isArray(value) ? value.join(", ") : "") : String(value || "");
    return `<textarea id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" rows="${rows}">${escapeHtml(asText)}</textarea>`;
  }

  if (field.isArray) {
    const asText = Array.isArray(value) ? value.join(", ") : "";
    return `<textarea id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" rows="2">${escapeHtml(asText)}</textarea>`;
  }

  if (field.format === "date") {
    const dateValue = formatDateOnlyForInput(value);
    const displayValue = formatDateOnlyForDisplay(dateValue);
    return `
      <div class="customer-date-picker">
        <input
          type="date"
          id="${fieldId}"
          class="customer-date-picker__native"
          data-customer-field="${escapeHtml(field.name)}"
          value="${escapeHtml(dateValue)}"
        />
        <div class="customer-date-picker__shell">
          <input
            type="text"
            class="customer-date-picker__display"
            data-customer-date-display="${escapeHtml(field.name)}"
            value="${escapeHtml(displayValue)}"
            placeholder="dd.mm.yyyy"
            inputmode="numeric"
          />
        </div>
      </div>
    `;
  }

  if (field.format === "date-time") {
    const dateTimeValue = formatDateTimeForInput(value);
    return `<input type="datetime-local" id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" value="${escapeHtml(dateTimeValue)}" />`;
  }

  const inputType = getInputTypeForField(field);
  const textValue = value === null || value === undefined ? "" : String(value);
  return `<input type="${inputType}" id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" value="${escapeHtml(textValue)}" />`;
}

function getInputTypeForField(field) {
  if (field.format === "email") return "email";
  if (field.format === "uri") return "url";
  if (field.name === "email") return "email";
  if (field.name.includes("phone")) return "tel";
  if (field.name === "phone_number") return "tel";
  return "text";
}

function renderRelatedBookings(bookings) {
  const items = Array.isArray(bookings) ? bookings : [];
  const header = `
    <thead>
      <tr>
        <th>Booking</th>
        <th>Stage</th>
        <th>Destination</th>
        <th>Style</th>
        <th>Staff</th>
        <th>Updated</th>
      </tr>
    </thead>
  `;
  const rows = items
    .map((booking) => {
      const bookingHref = buildBookingHref(booking.id);
      return `
        <tr>
          <td><a href="${escapeHtml(bookingHref)}">${escapeHtml(normalizeCustomerId(booking.id))}</a></td>
          <td>${escapeHtml(booking.stage || "-")}</td>
          <td>${escapeHtml(booking.destination || "-")}</td>
          <td>${escapeHtml(booking.style || "-")}</td>
          <td>${escapeHtml(booking.staff_name || booking.owner_name || "Unassigned")}</td>
          <td>${escapeHtml(formatDateTime(booking.updated_at))}</td>
        </tr>
      `;
    })
    .join("");

  const body = rows || `<tr><td colspan="6">${escapeHtml("No related bookings")}</td></tr>`;
  if (els.bookingsTable) {
    els.bookingsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  }
}

function renderCustomerSystemMeta(customer) {
  if (!els.systemMeta) return;
  const createdAt = formatFieldValue(customer?.created_at, { format: "date-time" });
  const updatedAt = formatFieldValue(customer?.updated_at, { format: "date-time" });
  const archivedAt = formatFieldValue(customer?.archived_at, { format: "date-time" });
  els.systemMeta.innerHTML = `
    <strong>Created At</strong> ${escapeHtml(createdAt)}
    &nbsp;&nbsp;&nbsp;
    <strong>Updated At</strong> ${escapeHtml(updatedAt)}
    &nbsp;&nbsp;&nbsp;
    <strong>Archived At</strong> ${escapeHtml(archivedAt)}
  `;
}

function renderEntityCollectionTable(tableEl, title, rows, fields) {
  if (!tableEl) return;

  const header = `<thead><tr>${fields.map((field) => `<th>${escapeHtml(fieldLabel(field.name))}</th>`).join("")}</tr></thead>`;
  const bodyRows = rows
    .map((row) => {
      const cells = fields
        .map((field) => `<td>${escapeHtml(formatFieldValue(row?.[field.name], field))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const emptyText = `<tr><td colspan="${fields.length}">${escapeHtml(`No ${title}`)}</td></tr>`;
  tableEl.innerHTML = `${header}<tbody>${bodyRows || emptyText}</tbody>`;
}

function bindCustomerProfileInputs() {
  const controls = Array.from(
    document.querySelectorAll('[data-customer-field]')
  );

  controls.forEach((control) => {
    if (control.dataset.bound === "1") return;
    control.dataset.bound = "1";
    const markDirty = () => {
      setSaveEnabled(true);
    };
    control.addEventListener("input", markDirty);
    control.addEventListener("change", markDirty);

    if (control.dataset.customerField === "name") {
      const syncName = () => updateCustomerHeroName(control.value);
      control.addEventListener("input", syncName);
      control.addEventListener("change", syncName);
    }
  });

  bindDatePickerControls();
}

function updateCustomerHeroName(value) {
  const name = normalizeText(value) || "Customer";
  if (els.heroName) {
    els.heroName.textContent = name;
  }
  document.title = `${name} | AsiaTravelPlan Customer`;
}

function bindDatePickerControls() {
  const dateInputs = Array.from(document.querySelectorAll('[data-customer-field][type="date"]'));
  dateInputs.forEach((input) => {
    if (input.dataset.dateBound === "1") return;
    input.dataset.dateBound = "1";

    const fieldName = input.dataset.customerField;
    const display = document.querySelector(`[data-customer-date-display="${fieldName}"]`);
    if (!(display instanceof HTMLInputElement)) return;

    const syncFromNative = () => {
      display.value = formatDateOnlyForDisplay(input.value);
    };

    input.addEventListener("input", syncFromNative);
    input.addEventListener("change", syncFromNative);

    display.addEventListener("input", () => {
      const normalized = normalizeDateDisplayValue(display.value);
      if (normalized) {
        input.value = normalized;
      } else if (!normalizeText(display.value)) {
        input.value = "";
      }
      setSaveEnabled(true);
    });

    display.addEventListener("blur", () => {
      display.value = formatDateOnlyForDisplay(input.value || normalizeDateDisplayValue(display.value));
    });

    display.addEventListener("focus", () => {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      }
    });
  });
}

function collectEditableCustomerPayload() {
  const fields = CUSTOMER_EDIT_FIELDS;
  const payload = {};
  fields.forEach((field) => {
    if (!field.editable) return;
    if (isCustomerOrganizationField(field.name) && !state.isOrganizationCustomer) return;
    const el = document.getElementById(customerFieldInputId(field.name));
    if (!el) return;
    payload[field.name] = getFieldValueFromInput(field, el);
  });

  if (Object.prototype.hasOwnProperty.call(payload, "preferred_currency")) {
    payload.preferred_currency = normalizeCurrencyCode(payload.preferred_currency) || payload.preferred_currency;
  }

  return payload;
}

function getFieldValueFromInput(field, element) {
  if (field.typeName === "bool") {
    return Boolean(element.checked);
  }

  if (field.isArray) {
    const text = normalizeText(element.value);
    if (!text) return [];
    return text
      .split(",")
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  if (field.format === "date") {
    return normalizeText(element.value);
  }

  if (field.format === "date-time") {
    return normalizeLocalDateTimeToIso(element.value);
  }

  return normalizeText(element.value);
}

async function saveCustomerProfile() {
  if (state.isSaving || !state.customer?.id) return;

  const payload = collectEditableCustomerPayload();
  state.isSaving = true;
  setSaveEnabled(false);
  setSaveStatus("Saving customer…");

  const request = customerUpdateRequest({
    baseURL: apiOrigin,
    params: { customerId: state.id }
  });
  const result = await fetchApi(request.url, {
    method: request.method,
    body: payload
  });

  state.isSaving = false;

  if (!result?.customer) {
    setSaveStatus("");
    return;
  }

  state.customer = normalizeCustomer(result.customer);
  renderEditableCustomerGroup(els.customerPrimaryGroup, CUSTOMER_PRIMARY_GROUP_FIELDS, state.customer, "primary");
  renderEditableCustomerGroup(els.customerAddressGroup, CUSTOMER_ADDRESS_GROUP_FIELDS, state.customer, "address");
  renderEditableCustomerGroup(els.customerOrganizationGroup, CUSTOMER_ORGANIZATION_GROUP_FIELDS, state.customer, "organization");
  renderEditableCustomerGroup(els.customerNotesGroup, CUSTOMER_NOTES_GROUP_FIELDS, state.customer, "notes");
  bindOrganizationToggle();
  renderCustomerSystemMeta(state.customer);
  applyOrganizationFieldVisibility(state.isOrganizationCustomer);
  bindCustomerProfileInputs();
  setSaveEnabled(false);
  setSaveStatus("Customer updated.");
}

function shouldEnableOrganizationFields(customer = {}) {
  return Array.from(ORGANIZATION_CUSTOMER_FIELDS).some((fieldName) => {
    return normalizeText(customer?.[fieldName]);
  });
}

function isCustomerOrganizationField(fieldName) {
  return ORGANIZATION_CUSTOMER_FIELDS.has(String(fieldName || ""));
}

function applyOrganizationFieldVisibility(enabled) {
  if (els.customerOrganizationGroup) {
    els.customerOrganizationGroup.classList.toggle("is-expanded", Boolean(enabled));
  }
}

function handleOrganizationToggleChange() {
  state.isOrganizationCustomer = Boolean(els.organizationToggle?.checked);
  applyOrganizationFieldVisibility(state.isOrganizationCustomer);
  setSaveEnabled(true);
}

function bindOrganizationToggle() {
  els.organizationToggle = document.getElementById("customerIsOrganization");
  if (!els.organizationToggle || els.organizationToggle.dataset.bound === "1") return;
  els.organizationToggle.dataset.bound = "1";
  els.organizationToggle.addEventListener("change", handleOrganizationToggleChange);
}

function setSaveEnabled(enabled) {
  const buttons = [els.saveBtn, els.saveBtnBottom].filter(Boolean);
  if (!buttons.length) return;
  if (state.isSaving) {
    buttons.forEach((button) => {
      button.disabled = true;
      button.textContent = "Saving…";
    });
    return;
  }

  buttons.forEach((button) => {
    button.disabled = !enabled;
    button.textContent = "Update";
  });
}

function setSaveStatus(message) {
  if (!els.saveStatus) return;
  if (!message) {
    els.saveStatus.hidden = true;
    els.saveStatus.textContent = "";
    return;
  }

  els.saveStatus.hidden = false;
  els.saveStatus.textContent = message;
}

function clearSaveStatus() {
  setSaveStatus("");
}

function buildBookingHref(id) {
  const params = new URLSearchParams({ type: "booking", id });
  return `backend-booking.html?${params.toString()}`;
}

function customerFieldInputId(fieldName) {
  return `customer-field-${String(fieldName || "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function formatFieldValue(value, field = {}) {
  if (value === undefined || value === null || value === "") return "-";
  if (field.isArray) {
    if (!Array.isArray(value)) return String(value);
    if (value.length === 0) return "-";
    if (value.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")) {
      return value.join(", ");
    }
    return JSON.stringify(value);
  }

  if (field.kind === "enum" && Array.isArray(field.options)) {
    const matched = field.options.find((option) => String(option?.value || "") === String(value));
    if (matched) return String(matched.label || matched.value || value);
  }
  if (field.format === "date-time") return formatDateTime(value);
  if (field.format === "date") return formatDateOnly(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function fieldLabel(raw) {
  const overrides = {
    photo_ref: "Customer Photo",
    address_line_1: "Address Line 1",
    address_line_2: "Address Line 2",
    address_city: "City",
    address_state_region: "State Region",
    address_postal_code: "Postal Code",
    address_country_code: "Country Code"
  };
  if (Object.prototype.hasOwnProperty.call(overrides, raw)) return overrides[raw];
  return String(raw || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateOnly(value) {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return String(value || "-");
  return d.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function formatDateOnlyForInput(value) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    const plain = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(plain) ? plain : "";
  }
  return d.toISOString().slice(0, 10);
}

function formatDateOnlyForDisplay(value) {
  const normalized = formatDateOnlyForInput(value);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-");
  return `${day}.${month}.${year}`;
}

function normalizeDateDisplayValue(value) {
  const text = normalizeText(value).replace(/\//g, ".").replace(/-/g, ".");
  if (!text) return "";

  const dotted = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const day = dotted[1].padStart(2, "0");
    const month = dotted[2].padStart(2, "0");
    const year = dotted[3];
    return `${year}-${month}-${day}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return "";
}

function formatDateTimeForInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${date}T${hours}:${minutes}`;
}

function normalizeCustomerId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}

async function loadAuthStatus() {
  if (!els.userLabel) return;
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      els.userLabel.textContent = "";
      return;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    els.userLabel.textContent = user || "";
  } catch {
    els.userLabel.textContent = "";
  }
}

async function fetchApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;
  try {
    const response = await fetch(resolveApiUrl(path), {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.detail
        ? `${payload.error || "Request failed"}: ${payload.detail}`
        : payload?.error || "Request failed";
      showError(message);
      return null;
    }

    clearError();
    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

function resolveApiUrl(pathOrUrl) {
  const value = String(pathOrUrl || "");
  if (/^https?:\/\//.test(value)) return value;
  return `${apiBase}${value}`;
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = "";
  els.error.classList.remove("show");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
