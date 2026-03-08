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
  contactSelect: document.getElementById("groupContactSelect"),
  travelersList: document.getElementById("groupTravelersList"),
  bookingsTable: document.getElementById("groupBookingsTable"),
  systemMeta: document.getElementById("groupSystemMeta"),
  saveBtn: document.getElementById("groupSaveBtn"),
  saveStatus: document.getElementById("groupSaveStatus"),
  deleteBtn: document.getElementById("groupDeleteBtn")
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
  if (els.saveBtn) els.saveBtn.addEventListener("click", saveTravelGroup);
  if (els.deleteBtn) els.deleteBtn.addEventListener("click", deleteTravelGroup);
  if (els.nameInput) els.nameInput.addEventListener("input", () => markDirty("primary", true));
  if (els.contactSelect) els.contactSelect.addEventListener("change", () => markDirty("primary", true));
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
  renderCustomerSelect();
  renderTravelers();
  renderBookings();
  renderSystemMeta();
  syncDirtyUi();
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

function renderCustomerSelect() {
  if (!els.contactSelect) return;
  const customers = [...state.allCustomers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const options = ['<option value="">No group contact</option>']
    .concat(customers.map((customer) => {
      const label = [customer.name, customer.email, customer.phone_number].filter(Boolean).join(" · ");
      return `<option value="${escapeHtml(customer.client_id || "")}">${escapeHtml(label || (customer.client_id || ""))}</option>`;
    }))
    .join("");
  els.contactSelect.innerHTML = options;
  els.contactSelect.value = normalizeText(state.travelGroup?.group_contact_customer_id) || "";
}

function renderTravelers() {
  if (!els.travelersList) return;
  const selectedIds = new Set(Array.isArray(state.travelGroup?.traveler_customer_ids) ? state.travelGroup.traveler_customer_ids.map((value) => normalizeText(value)).filter(Boolean) : []);
  const customers = [...state.allCustomers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const rows = customers.map((customer) => {
    const customerId = normalizeText(customer.client_id);
    const label = [customer.name, customer.email, customer.phone_number].filter(Boolean).join(" · ");
    return `<label class="group-travelers__item">
      <input type="checkbox" value="${escapeHtml(customerId)}" ${selectedIds.has(customerId) ? "checked" : ""} />
      <span>${escapeHtml(label || customerId)}</span>
    </label>`;
  }).join("");
  els.travelersList.innerHTML = rows || '<p class="micro">No customers available.</p>';
  els.travelersList.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener("change", () => markDirty("travelers", true));
  });
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
  if (!els.travelersList) return [];
  return Array.from(els.travelersList.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => normalizeText(input.value))
    .filter(Boolean);
}

function travelGroupChanged() {
  const group = state.travelGroup;
  if (!group) return false;
  const originalTravelers = JSON.stringify(Array.isArray(group.traveler_customer_ids) ? group.traveler_customer_ids : []);
  const currentTravelers = JSON.stringify(currentTravelerIds());
  return normalizeText(els.nameInput?.value) !== normalizeText(group.group_name)
    || normalizeText(els.contactSelect?.value) !== normalizeText(group.group_contact_customer_id)
    || originalTravelers !== currentTravelers;
}

function markDirty(section, dirty) {
  state.dirty[section] = Boolean(dirty);
  syncDirtyUi();
}

function syncDirtyUi() {
  const primaryDirty = travelGroupChanged();
  state.dirty.primary = primaryDirty;
  state.dirty.travelers = primaryDirty;
  setDirtySurface(els.primaryGroup, state.dirty.primary);
  setDirtySurface(els.travelersPanel, state.dirty.travelers);
  if (els.saveBtn) els.saveBtn.disabled = state.isSaving || !primaryDirty;
}

async function saveTravelGroup() {
  if (!state.travelGroup || !els.saveBtn) return;
  state.isSaving = true;
  syncDirtyUi();
  if (els.saveStatus) {
    els.saveStatus.hidden = false;
    els.saveStatus.textContent = "Saving...";
  }
  const payload = await fetchApi(`/api/v1/travel_groups/${encodeURIComponent(state.travelGroup.id)}`, {
    method: "PATCH",
    body: {
      travel_group_hash: state.travelGroup.travel_group_hash,
      group_name: normalizeText(els.nameInput?.value),
      group_contact_customer_id: normalizeText(els.contactSelect?.value) || null,
      traveler_customer_ids: currentTravelerIds()
    }
  });
  state.isSaving = false;
  if (!payload) {
    syncDirtyUi();
    if (els.saveStatus) els.saveStatus.textContent = "Could not update travel group.";
    return;
  }
  state.client = payload.client || state.client;
  state.travelGroup = payload.travel_group || state.travelGroup;
  state.memberCustomers = Array.isArray(payload.memberCustomers) ? payload.memberCustomers : state.memberCustomers;
  state.bookings = Array.isArray(payload.bookings) ? payload.bookings : state.bookings;
  if (els.saveStatus) els.saveStatus.textContent = "Updated.";
  render();
}

async function deleteTravelGroup() {
  if (!state.travelGroup) return;
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
