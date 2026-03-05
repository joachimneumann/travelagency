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

const state = {
  id: qs.get("id") || "",
  user: qs.get("user") || "admin",
  customer: null
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  error: document.getElementById("detailError"),
  customerDataTable: document.getElementById("customerDataTable"),
  consentsTable: document.getElementById("customerConsentsTable"),
  documentsTable: document.getElementById("customerDocumentsTable"),
  travelGroupsTable: document.getElementById("customerTravelGroupsTable"),
  travelGroupMembersTable: document.getElementById("customerTravelGroupMembersTable"),
  bookingsTable: document.getElementById("customerBookingsTable")
};

init();

async function init() {
  const backParams = new URLSearchParams({ user: state.user });
  const backHref = `backend.html?${backParams.toString()}`;

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  await loadAuthStatus();

  if (!state.id) {
    showError("Missing customer id.");
    return;
  }

  await loadCustomer();
}

async function loadCustomer() {
  const payload = await fetchApi(customerDetailRequest({ baseURL: apiOrigin, params: { customerId: state.id } }).url);
  if (!payload?.customer) return;

  state.customer = payload.customer || {};
  const normalizedCustomer = normalizeCustomer(state.customer);
  state.customer = normalizedCustomer;

  if (els.title) {
    const displayName = normalizedCustomer.display_name || normalizedCustomer.name || "Customer";
    els.title.textContent = `Customer ${normalizeCustomerId(normalizedCustomer.id)}`;
    if (displayName) {
      els.title.textContent = displayName;
    }
  }
  if (els.subtitle) {
    els.subtitle.textContent = `${normalizedCustomer.entity_type || "person"} · ${normalizedCustomer.id || ""}`;
    els.subtitle.hidden = false;
  }

  renderModelTable(els.customerDataTable, CUSTOMER_SCHEMA.fields, normalizedCustomer, "Customer");
  renderCustomerConsents(payload.consents || []);
  renderCustomerDocuments(payload.documents || []);
  renderTravelGroups(payload.travelGroups || []);
  renderTravelGroupMembers(payload.travelGroupMembers || []);
  renderRelatedBookings(payload.bookings || []);
}

function normalizeCustomer(customer) {
  return {
    ...customer,
    display_name: customer.display_name || customer.name || "",
    phone_number: customer.phone_number || customer.phone || "",
    preferred_language: customer.preferred_language || customer.language || "",
    first_name: customer.first_name || "",
    last_name: customer.last_name || "",
    date_of_birth: customer.date_of_birth || customer.birthdate || ""
  };
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

  const body =
    rows || `<tr><td colspan="6">${escapeHtml("No related bookings")}</td></tr>`;
  if (els.bookingsTable) {
    els.bookingsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  }
}

function renderModelTable(tableEl, fields, entity, title) {
  const header = `<thead><tr><th>${escapeHtml(title)} field</th><th>Value</th></tr></thead>`;
  const rows = fields
    .map((field) => {
      const raw = entity?.[field.name];
      return `
        <tr>
          <th>${escapeHtml(fieldLabel(field.name))}</th>
          <td>${escapeHtml(formatFieldValue(raw, field))}</td>
        </tr>
      `;
    })
    .join("");
  const body = rows || `<tr><td colspan="2">${escapeHtml(`No ${title} data`)}</td></tr>`;
  if (tableEl) {
    tableEl.innerHTML = `${header}<tbody>${body}</tbody>`;
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

function buildBookingHref(id) {
  const params = new URLSearchParams({ type: "booking", id, user: state.user });
  return `backend-booking.html?${params.toString()}`;
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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
