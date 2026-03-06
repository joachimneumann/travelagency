import {
  CUSTOMER_SCHEMA,
  CUSTOMER_CONSENT_SCHEMA,
  CUSTOMER_DOCUMENT_SCHEMA,
  TRAVEL_GROUP_SCHEMA,
  TRAVEL_GROUP_MEMBER_SCHEMA
} from "../../frontend/Generated/Models/generated_Aux.js";
import { customerDetailRequest } from "../../frontend/Generated/API/generated_APIRequestFactory.js";

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
  isSaving: false,
  isOrganizationCustomer: false
};

const CUSTOMER_FIELD_UI_CONFIG = {
  id: { editable: false },
  created_at: { editable: false },
  updated_at: { editable: false },
  archived_at: { editable: false },
  notes: { editable: true, control: "textarea", rows: 4 },
  tags: { editable: true, control: "textarea", rows: 2 },
  can_receive_marketing: { editable: true, control: "checkbox" }
};

const CUSTOMER_EDIT_FIELDS = CUSTOMER_SCHEMA.fields
  .filter((field) => field.name !== "id")
  .map((field) => {
    const config = CUSTOMER_FIELD_UI_CONFIG[field.name] || {};
    return {
      ...field,
      ...config,
      editable: config.editable ?? true
    };
  });

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),
  userLabel: document.getElementById("backendUserLabel"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  error: document.getElementById("detailError"),
  customerDataTable: document.getElementById("customerDataTable"),
  consentsTable: document.getElementById("customerConsentsTable"),
  documentsTable: document.getElementById("customerDocumentsTable"),
  travelGroupsTable: document.getElementById("customerTravelGroupsTable"),
  travelGroupMembersTable: document.getElementById("customerTravelGroupMembersTable"),
  bookingsTable: document.getElementById("customerBookingsTable"),
  saveBtn: document.getElementById("customerSaveBtn"),
  saveStatus: document.getElementById("customerSaveStatus"),
  organizationToggle: document.getElementById("customerIsOrganization")
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

  if (els.organizationToggle) {
    els.organizationToggle.addEventListener("change", handleOrganizationToggleChange);
  }

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

  if (els.title) {
    const displayName = state.customer.display_name || state.customer.name || "Customer";
    els.title.textContent = displayName;
  }

  if (els.subtitle) {
    const customerId = state.customer.id ? `ID: ${state.customer.id}` : "";
    els.subtitle.textContent = customerId;
    els.subtitle.hidden = false;
  }

  state.isOrganizationCustomer = shouldEnableOrganizationFields(state.customer);
  if (els.organizationToggle) {
    els.organizationToggle.checked = state.isOrganizationCustomer;
  }

  renderEditableCustomerTable(els.customerDataTable, CUSTOMER_EDIT_FIELDS, state.customer);
  applyOrganizationFieldVisibility(state.isOrganizationCustomer);
  bindCustomerProfileInputs();
  renderCustomerConsents(payload.consents || []);
  renderCustomerDocuments(payload.documents || []);
  renderTravelGroups(payload.travelGroups || []);
  renderTravelGroupMembers(payload.travelGroupMembers || []);
  renderRelatedBookings(payload.bookings || []);

  setSaveEnabled(false);
  clearSaveStatus();
}

function normalizeCustomer(customer) {
  const normalized = {
    ...customer,
    display_name: normalizeText(customer.display_name) || normalizeText(customer.name) || "",
    name: normalizeText(customer.name) || normalizeText(customer.display_name) || "",
    phone_number: normalizeText(customer.phone_number) || normalizeText(customer.phone) || "",
    phone: normalizeText(customer.phone) || normalizeText(customer.phone_number) || "",
    preferred_language: normalizeText(customer.preferred_language) || normalizeText(customer.language) || "",
    language: normalizeText(customer.language) || normalizeText(customer.preferred_language) || "",
    first_name: normalizeText(customer.first_name) || "",
    last_name: normalizeText(customer.last_name) || "",
    date_of_birth: normalizeText(customer.date_of_birth) || "",
    nationality: normalizeText(customer.nationality) || "",
    organization_name: normalizeText(customer.organization_name) || "",
    organization_address: normalizeText(customer.organization_address) || "",
    organization_phone_number: normalizeText(customer.organization_phone_number) || "",
    organization_webpage: normalizeText(customer.organization_webpage) || "",
    organization_email: normalizeText(customer.organization_email) || "",
    tax_id: normalizeText(customer.tax_id) || "",
    email: normalizeText(customer.email) || "",
    address_line_1: normalizeText(customer.address_line_1) || "",
    address_line_2: normalizeText(customer.address_line_2) || "",
    address_city: normalizeText(customer.address_city) || "",
    address_state_region: normalizeText(customer.address_state_region) || "",
    address_postal_code: normalizeText(customer.address_postal_code) || "",
    address_country_code: normalizeText(customer.address_country_code) || "",
    preferred_currency: normalizeText(customer.preferred_currency) || "",
    timezone: normalizeText(customer.timezone) || "",
    notes: normalizeText(customer.notes) || "",
    can_receive_marketing: Boolean(customer.can_receive_marketing),
    tags: Array.isArray(customer.tags) ? customer.tags.map((value) => normalizeText(value)).filter(Boolean) : []
  };

  return normalized;
}

function renderCustomerConsents(consents) {
  renderEntityCollectionTable(
    els.consentsTable,
    "Customer Consents",
    Array.isArray(consents) ? consents : [],
    CUSTOMER_CONSENT_SCHEMA.fields
  );
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

  if (field.typeName === "DateOnly") {
    const dateValue = formatDateOnlyForInput(value);
    return `<input type="date" id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" value="${escapeHtml(dateValue)}" />`;
  }

  if (field.typeName === "Timestamp") {
    const dateTimeValue = formatDateTimeForInput(value);
    return `<input type="datetime-local" id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" value="${escapeHtml(dateTimeValue)}" />`;
  }

  const inputType = getInputTypeForField(field);
  const textValue = value === null || value === undefined ? "" : String(value);
  return `<input type="${inputType}" id="${fieldId}" data-customer-field="${escapeHtml(field.name)}" value="${escapeHtml(textValue)}" />`;
}

function getInputTypeForField(field) {
  if (field.name === "email") return "email";
  if (field.name.includes("phone")) return "tel";
  if (field.name === "phone_number") return "tel";
  if (field.name === "address_country_code" || field.name === "nationality") return "text";
  if (field.name === "preferred_currency") return "text";
  if (field.name.includes("date")) return "date";
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
    document.querySelectorAll('#customerDataTable [data-customer-field]')
  );

  controls.forEach((control) => {
    if (control.dataset.bound === "1") return;
    control.dataset.bound = "1";
    const markDirty = () => {
      setSaveEnabled(true);
    };
    control.addEventListener("input", markDirty);
    control.addEventListener("change", markDirty);
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

  if (Object.prototype.hasOwnProperty.call(payload, "display_name") && !Object.prototype.hasOwnProperty.call(payload, "name")) {
    payload.name = payload.display_name;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone_number") && !Object.prototype.hasOwnProperty.call(payload, "phone")) {
    payload.phone = payload.phone_number;
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "preferred_language") &&
    !Object.prototype.hasOwnProperty.call(payload, "language")
  ) {
    payload.language = payload.preferred_language;
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

  if (field.typeName === "DateOnly") {
    return normalizeText(element.value);
  }

  if (field.typeName === "Timestamp") {
    return parseDateTimeInputValue(element.value);
  }

  return normalizeText(element.value);
}

async function saveCustomerProfile() {
  if (state.isSaving || !state.customer?.id) return;

  const payload = collectEditableCustomerPayload();
  state.isSaving = true;
  setSaveEnabled(false);
  setSaveStatus("Saving customer…");

  const result = await fetchApi(`/api/v1/customers/${encodeURIComponent(state.id)}`, {
    method: "PATCH",
    body: payload
  });

  state.isSaving = false;

  if (!result?.customer) {
    setSaveStatus("");
    return;
  }

  state.customer = normalizeCustomer(result.customer);
  renderEditableCustomerTable(els.customerDataTable, CUSTOMER_EDIT_FIELDS, state.customer);
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
  if (!els.customerDataTable) return;
  const rows = els.customerDataTable.querySelectorAll('tr[data-customer-org-field="1"]');
  rows.forEach((row) => {
    row.style.display = enabled ? "" : "none";
  });
}

function handleOrganizationToggleChange() {
  state.isOrganizationCustomer = Boolean(els.organizationToggle?.checked);
  applyOrganizationFieldVisibility(state.isOrganizationCustomer);
}

function setSaveEnabled(enabled) {
  if (!els.saveBtn) return;
  if (state.isSaving) {
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = "Saving…";
    return;
  }

  els.saveBtn.disabled = !enabled;
  els.saveBtn.textContent = "Update";
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

  if (field.typeName === "Timestamp") return formatDateTime(value);
  if (field.typeName === "DateOnly") return formatDateOnly(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function fieldLabel(raw) {
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

function parseDateTimeInputValue(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString();
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
