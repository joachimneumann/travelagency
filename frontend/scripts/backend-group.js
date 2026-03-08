import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText,
  resolveApiUrl,
  setDirtySurface
} from "./shared/backend-common.js";
import {
  buildBookingHref,
  buildCustomerHref
} from "./shared/backend-links.js";
import {
  fetchCustomerSearchPage,
  renderCustomerTable
} from "./shared/customer-search.js";
import { renderPagination } from "./shared/backend-pagination.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const state = {
  id: qs.get("id") || "",
  client: null,
  travelGroup: null,
  memberCustomers: [],
  bookings: [],
  allCustomers: [],
  contactSearchResults: [],
  contactSearch: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  contactPanelOpen: false,
  travelerSearchResults: [],
  travelerSearch: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  travelerPanelOpen: false,
  isSaving: false,
  dirty: {
    primary: false,
    travelers: false
  }
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  heroCopyBtn: document.getElementById("groupHeroCopyBtn"),
  heroCopyStatus: document.getElementById("groupHeroCopyStatus"),
  heroName: document.getElementById("groupHeroName"),
  heroId: document.getElementById("groupHeroId"),
  error: document.getElementById("detailError"),
  primaryGroup: document.getElementById("groupPrimaryGroup"),
  travelersPanel: document.getElementById("groupTravelersPanel"),
  nameInput: document.getElementById("groupNameInput"),
  contactCurrent: document.getElementById("groupContactCurrent"),
  contactToggleBtn: document.getElementById("groupContactToggleBtn"),
  contactChangePanel: document.getElementById("groupContactChangePanel"),
  contactSearch: document.getElementById("groupContactSearch"),
  contactSearchBtn: document.getElementById("groupContactSearchBtn"),
  contactResultsTable: document.getElementById("groupContactResultsTable"),
  contactResultsPagination: document.getElementById("groupContactResultsPagination"),
  travelersToggleBtn: document.getElementById("groupTravelersToggleBtn"),
  travelerChangePanel: document.getElementById("groupTravelersChangePanel"),
  travelerSearch: document.getElementById("groupTravelerSearch"),
  travelerSearchBtn: document.getElementById("groupTravelerSearchBtn"),
  travelerResultsTable: document.getElementById("groupTravelerResultsTable"),
  travelerResultsPagination: document.getElementById("groupTravelerResultsPagination"),
  travelersList: document.getElementById("groupTravelersList"),
  bookingsTable: document.getElementById("groupBookingsTable"),
  systemMeta: document.getElementById("groupSystemMeta"),
  saveBtn: document.getElementById("groupSaveBtn"),
  saveStatus: document.getElementById("groupSaveStatus"),
  deleteBtn: document.getElementById("groupDeleteBtn"),
  deleteReason: document.getElementById("groupDeleteReason")
};

let heroCopyClipboardPoll = null;
let heroCopiedValue = "";

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: true,
  connectionErrorMessage: "Could not connect to backend API. Ensure backend is running on localhost:8787."
});

init();

async function init() {
  if (!state.id) {
    showError("Missing travel group id.");
    return;
  }
  if (els.homeLink) els.homeLink.href = "backend.html";
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }
  if (els.heroCopyBtn) {
    els.heroCopyBtn.addEventListener("click", () => {
      void copyHeroIdToClipboard();
    });
  }
  if (els.contactToggleBtn) {
    els.contactToggleBtn.addEventListener("click", () => {
      void toggleContactPanel();
    });
  }
  if (els.contactSearchBtn) {
    els.contactSearchBtn.addEventListener("click", () => {
      state.contactSearch.page = 1;
      void searchCustomersForContact();
    });
  }
  if (els.contactSearch) {
    els.contactSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state.contactSearch.page = 1;
      void searchCustomersForContact();
    });
  }
  if (els.travelersToggleBtn) {
    els.travelersToggleBtn.addEventListener("click", () => {
      void toggleTravelerPanel();
    });
  }
  if (els.travelerSearchBtn) {
    els.travelerSearchBtn.addEventListener("click", () => {
      state.travelerSearch.page = 1;
      void searchCustomersForTravelers();
    });
  }
  if (els.travelerSearch) {
    els.travelerSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state.travelerSearch.page = 1;
      void searchCustomersForTravelers();
    });
  }
  if (els.saveBtn) els.saveBtn.addEventListener("click", saveTravelGroup);
  if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteTravelGroup);
  if (els.nameInput) els.nameInput.addEventListener("input", () => markDirty("primary", true));
  await loadAuthStatus();
  await Promise.all([loadTravelGroup(), loadCustomers()]);
  render();
}

async function loadTravelGroup() {
  clearError();
  const payload = await fetchApi(`/api/v1/travel_groups/${encodeURIComponent(state.id)}`);
  if (!payload) return;
  state.client = payload.client || null;
  state.travelGroup = payload.travel_group || null;
  state.memberCustomers = Array.isArray(payload.memberCustomers) ? payload.memberCustomers : [];
  state.bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
}

async function loadCustomers() {
  const payload = await fetchApi("/api/v1/customers?page=1&page_size=200");
  if (!payload) return;
  state.allCustomers = Array.isArray(payload.items) ? payload.items : [];
}

function render() {
  const group = state.travelGroup;
  if (!group) return;
  document.title = `${group.group_name || "Travel Group"} | AsiaTravelPlan`;
  if (els.heroName) els.heroName.textContent = group.group_name || "Travel Group";
  const identifier = getCurrentGroupIdentifier();
  if (els.heroId) els.heroId.textContent = `ID: ${identifier || "-"}`;
  if (heroCopiedValue && heroCopiedValue !== identifier) clearHeroCopyStatus();
  if (els.nameInput) els.nameInput.value = group.group_name || "";
  renderContactSummary();
  renderContactSearchResults();
  renderTravelers();
  renderTravelerSearchResults();
  renderBookings();
  renderSystemMeta();
  syncDirtyUi();
  syncDeleteButtonState();
}

function getCurrentGroupIdentifier() {
  return normalizeText(state.travelGroup?.id) || state.id;
}

function setHeroCopyStatus(message) {
  if (!els.heroCopyStatus) return;
  els.heroCopyStatus.textContent = message || "";
  els.heroCopyStatus.hidden = !message;
}

function clearHeroCopyStatus() {
  heroCopiedValue = "";
  setHeroCopyStatus("");
  if (heroCopyClipboardPoll) {
    window.clearInterval(heroCopyClipboardPoll);
    heroCopyClipboardPoll = null;
  }
}

function startHeroClipboardWatcher(expectedValue) {
  if (!navigator.clipboard?.readText) return;
  if (heroCopyClipboardPoll) window.clearInterval(heroCopyClipboardPoll);
  heroCopyClipboardPoll = window.setInterval(async () => {
    try {
      const currentClipboard = await navigator.clipboard.readText();
      if (currentClipboard !== expectedValue) clearHeroCopyStatus();
    } catch (_error) {
      // Ignore clipboard read permission failures. Reload also clears the status.
    }
  }, 1500);
}

async function copyHeroIdToClipboard() {
  const identifier = getCurrentGroupIdentifier();
  if (!identifier || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(identifier);
    heroCopiedValue = identifier;
    setHeroCopyStatus("copied");
    startHeroClipboardWatcher(identifier);
  } catch (_error) {
    clearHeroCopyStatus();
  }
}

function renderContactSummary() {
  if (!els.contactCurrent) return;
  const contactId = normalizeText(state.travelGroup?.group_contact_customer_id);
  const customer = state.allCustomers.find((item) => normalizeText(item.client_id) === contactId) || null;
  if (!customer) {
    els.contactCurrent.textContent = "no group contact";
    return;
  }
  const href = buildCustomerHref(customer.client_id || "");
  const label = [customer.name, customer.email, customer.phone_number].filter(Boolean).join(" · ");
  els.contactCurrent.innerHTML = `<a href="${escapeHtml(href)}">${escapeHtml(label || customer.client_id || "group contact")}</a>`;
}

function renderContactSearchResults() {
  renderCustomerTable({
    tableEl: els.contactResultsTable,
    items: state.contactSearchResults,
    mode: "select",
    emptyMessage: "no customer found",
    actionLabel: "Select",
    actionColumnFirst: true
  });
  if (els.contactResultsPagination) {
    renderPagination(els.contactResultsPagination, state.contactSearch, (page) => {
      state.contactSearch.page = page;
      void searchCustomersForContact();
    });
  }
  if (!els.contactResultsTable) return;
  els.contactResultsTable.querySelectorAll("button[data-customer-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const customerClientId = normalizeText(button.getAttribute("data-customer-select"));
      if (!customerClientId) return;
      void assignGroupContact(customerClientId);
    });
  });
}

async function toggleContactPanel() {
  state.contactPanelOpen = !state.contactPanelOpen;
  if (els.contactChangePanel) els.contactChangePanel.hidden = !state.contactPanelOpen;
  if (state.contactPanelOpen) {
    await searchCustomersForContact();
    if (els.contactSearch) els.contactSearch.focus();
  }
}

async function toggleTravelerPanel() {
  state.travelerPanelOpen = !state.travelerPanelOpen;
  if (els.travelerChangePanel) els.travelerChangePanel.hidden = !state.travelerPanelOpen;
  if (state.travelerPanelOpen) {
    await searchCustomersForTravelers();
    if (els.travelerSearch) els.travelerSearch.focus();
  }
}

async function searchCustomersForContact() {
  state.contactSearch.search = els.contactSearch?.value || "";
  const payload = await fetchCustomerSearchPage({
    fetchApi,
    page: state.contactSearch.page,
    pageSize: state.contactSearch.pageSize,
    search: state.contactSearch.search
  });
  if (!payload) return;
  state.contactSearchResults = Array.isArray(payload.items) ? payload.items : [];
  const pagination = payload.pagination || {};
  state.contactSearch.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.contactSearch.pageSize) || 1)
  );
  state.contactSearch.total = Number(pagination.total_items || 0);
  state.contactSearch.page = Number(pagination.page || state.contactSearch.page);
  renderContactSearchResults();
}

async function assignGroupContact(customerClientId) {
  if (!state.travelGroup) return;
  const payload = await patchTravelGroup({
    group_contact_customer_id: customerClientId
  });
  if (!payload) return;
  if (els.saveStatus) {
    els.saveStatus.hidden = false;
    els.saveStatus.textContent = "Group contact updated.";
  }
  render();
}

function renderTravelers() {
  if (!els.travelersList) return;
  const travelerIds = currentTravelerIds();
  const rows = travelerIds.map((customerId) => {
    const customer = state.allCustomers.find((item) => normalizeText(item.client_id) === customerId) || null;
    const label = customer
      ? [customer.name, customer.email, customer.phone_number].filter(Boolean).join(" · ")
      : customerId;
    return `<div class="group-travelers__item">
      <span>${escapeHtml(label || customerId)}</span>
      <button class="group-travelers__remove" type="button" data-traveler-remove="${escapeHtml(customerId)}" aria-label="Remove traveler">×</button>
    </div>`;
  }).join("");
  els.travelersList.innerHTML = rows || '<p class="micro">No travelers added.</p>';
  els.travelersList.querySelectorAll("button[data-traveler-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const customerId = normalizeText(button.getAttribute("data-traveler-remove"));
      if (!customerId) return;
      void removeTraveler(customerId);
    });
  });
}

function renderTravelerSearchResults() {
  const selectedIds = new Set(currentTravelerIds());
  renderCustomerTable({
    tableEl: els.travelerResultsTable,
    items: state.travelerSearchResults,
    mode: "select",
    emptyMessage: "no customer found",
    actionLabel: "Add",
    actionColumnFirst: true,
    isActionDisabled: (customer) => selectedIds.has(normalizeText(customer.client_id || customer.id))
  });
  if (els.travelerResultsPagination) {
    renderPagination(els.travelerResultsPagination, state.travelerSearch, (page) => {
      state.travelerSearch.page = page;
      void searchCustomersForTravelers();
    });
  }
  if (!els.travelerResultsTable) return;
  els.travelerResultsTable.querySelectorAll("button[data-customer-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const customerClientId = normalizeText(button.getAttribute("data-customer-select"));
      if (!customerClientId) return;
      void addTraveler(customerClientId);
    });
  });
}

async function searchCustomersForTravelers() {
  state.travelerSearch.search = els.travelerSearch?.value || "";
  const payload = await fetchCustomerSearchPage({
    fetchApi,
    page: state.travelerSearch.page,
    pageSize: state.travelerSearch.pageSize,
    search: state.travelerSearch.search
  });
  if (!payload) return;
  state.travelerSearchResults = Array.isArray(payload.items) ? payload.items : [];
  const pagination = payload.pagination || {};
  state.travelerSearch.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.travelerSearch.pageSize) || 1)
  );
  state.travelerSearch.total = Number(pagination.total_items || 0);
  state.travelerSearch.page = Number(pagination.page || state.travelerSearch.page);
  renderTravelerSearchResults();
}

async function addTraveler(customerClientId) {
  const travelerIds = new Set(currentTravelerIds());
  travelerIds.add(customerClientId);
  const payload = await patchTravelGroup({
    traveler_customer_ids: Array.from(travelerIds)
  });
  if (!payload) return;
  if (els.saveStatus) {
    els.saveStatus.hidden = false;
    els.saveStatus.textContent = "Traveler added.";
  }
  render();
}

async function removeTraveler(customerClientId) {
  const customer = state.allCustomers.find((item) => normalizeText(item.client_id) === customerClientId);
  const label = customer ? (customer.name || customerClientId) : customerClientId;
  if (!window.confirm(`Remove traveler ${label}?`)) return;
  const travelerIds = currentTravelerIds().filter((id) => id !== customerClientId);
  const payload = await patchTravelGroup({
    traveler_customer_ids: travelerIds
  });
  if (!payload) return;
  if (els.saveStatus) {
    els.saveStatus.hidden = false;
    els.saveStatus.textContent = "Traveler removed.";
  }
  render();
}

function renderBookings() {
  if (!els.bookingsTable) return;
  const header = `<thead><tr><th>ID</th><th>Stage</th><th>Client</th><th>Updated</th></tr></thead>`;
  const rows = (Array.isArray(state.bookings) ? state.bookings : []).map((booking) => {
    const href = buildBookingHref(booking.id);
    return `<tr>
      <td><a href="${escapeHtml(href)}">${escapeHtml(shortId(booking.id))}</a></td>
      <td>${escapeHtml(booking.stage || "-")}</td>
      <td>${escapeHtml(booking.client_display_name || "-")}</td>
      <td>${escapeHtml(formatDateTime(booking.updated_at || booking.created_at))}</td>
    </tr>`;
  }).join("");
  els.bookingsTable.innerHTML = `${header}<tbody>${rows || '<tr><td colspan="4">No related bookings</td></tr>'}</tbody>`;
}

function renderSystemMeta() {
  if (!els.systemMeta || !state.travelGroup) return;
  const group = state.travelGroup;
  els.systemMeta.textContent = `Created At ${group.created_at || "-"}   Updated At ${group.updated_at || "-"}   Archived At ${group.archived_at || "-"}`;
}

function currentTravelerIds() {
  return Array.isArray(state.travelGroup?.traveler_customer_ids)
    ? state.travelGroup.traveler_customer_ids.map((value) => normalizeText(value)).filter(Boolean)
    : [];
}

function travelGroupChanged() {
  const group = state.travelGroup;
  if (!group) return false;
  return normalizeText(els.nameInput?.value) !== normalizeText(group.group_name);
}

function markDirty(section, dirty) {
  state.dirty[section] = Boolean(dirty);
  syncDirtyUi();
}

function syncDirtyUi() {
  const primaryDirty = travelGroupChanged();
  state.dirty.primary = primaryDirty;
  state.dirty.travelers = false;
  setDirtySurface(els.primaryGroup, state.dirty.primary);
  setDirtySurface(els.travelersPanel, state.dirty.travelers);
  if (els.saveBtn) els.saveBtn.disabled = state.isSaving || !primaryDirty;
}

async function patchTravelGroup(patch) {
  if (!state.travelGroup) return null;
  const payload = await fetchApi(`/api/v1/travel_groups/${encodeURIComponent(state.travelGroup.id)}`, {
    method: "PATCH",
    body: {
      travel_group_hash: state.travelGroup.travel_group_hash,
      ...patch
    }
  });
  if (!payload) return null;
  state.client = payload.client || state.client;
  state.travelGroup = payload.travel_group || state.travelGroup;
  state.memberCustomers = Array.isArray(payload.memberCustomers) ? payload.memberCustomers : state.memberCustomers;
  state.bookings = Array.isArray(payload.bookings) ? payload.bookings : state.bookings;
  return payload;
}

async function saveTravelGroup() {
  if (!state.travelGroup || !els.saveBtn) return;
  state.isSaving = true;
  syncDirtyUi();
  if (els.saveStatus) {
    els.saveStatus.hidden = false;
    els.saveStatus.textContent = "Saving...";
  }
  const payload = await patchTravelGroup({
    group_name: normalizeText(els.nameInput?.value),
    group_contact_customer_id: normalizeText(state.travelGroup?.group_contact_customer_id) || null,
    traveler_customer_ids: currentTravelerIds()
  });
  state.isSaving = false;
  if (!payload) {
    syncDirtyUi();
    if (els.saveStatus) els.saveStatus.textContent = "Could not update travel group.";
    return;
  }
  if (els.saveStatus) els.saveStatus.textContent = "Updated.";
  render();
}

async function deleteTravelGroup() {
  if (!state.travelGroup) return;
  syncDeleteButtonState();
  if (!travelGroupCanBeDeleted()) return;
  if (!window.confirm(`Delete travel group ${state.travelGroup.group_name || state.travelGroup.id}?`)) return;
  const payload = await fetchApi(`/api/v1/travel_groups/${encodeURIComponent(state.travelGroup.id)}`, {
    method: "DELETE",
    body: {
      travel_group_hash: state.travelGroup.travel_group_hash
    }
  });
  if (!payload) return;
  window.location.href = "backend.html?section=travelGroups";
}

function showError(message) {
  if (els.error) els.error.textContent = String(message || "");
}

function clearError() {
  if (els.error) els.error.textContent = "";
}

function travelGroupCanBeDeleted() {
  return !travelGroupDeleteBlockedReason();
}

function travelGroupDeleteBlockedReason() {
  const bookingCount = Array.isArray(state.bookings) ? state.bookings.length : 0;
  if (bookingCount > 0) {
    return `This travel group is still assigned to ${bookingCount === 1 ? "1 booking" : `${bookingCount} bookings`}. Reassign or delete those bookings first.`;
  }
  return "";
}

function syncDeleteButtonState() {
  if (!els.deleteBtn) return;
  const blockedReason = travelGroupDeleteBlockedReason();
  els.deleteBtn.disabled = !travelGroupCanBeDeleted();
  els.deleteBtn.title = blockedReason || "";
  if (els.deleteReason) {
    els.deleteReason.hidden = !blockedReason;
    els.deleteReason.textContent = blockedReason;
  }
}

function shortId(value) {
  const text = normalizeText(value);
  return text ? text.slice(-6) : "-";
}

async function loadAuthStatus() {
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    if (!response.ok) return;
    const payload = await response.json().catch(() => null);
    const user = payload?.user?.preferred_username || payload?.user?.email || payload?.user?.sub || "";
    if (els.userLabel) els.userLabel.textContent = user;
  } catch {
    // ignore auth status load failures on detail page
  }
}
