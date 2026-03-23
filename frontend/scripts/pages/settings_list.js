import {
  createApiFetcher,
  escapeHtml,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import { keycloakUsersRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState
} from "../shared/backend_page.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  staffStatus: document.getElementById("staffStatus"),
  staffTable: document.getElementById("staffTable")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  MANAGER: GENERATED_ROLE_LOOKUP.MANAGER,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT
});

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadSettings: false
  },
  keycloakUsers: []
};

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
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

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: false,
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

init();

async function init() {
  const chrome = await initializeBackendPageChrome({
    currentSection: "settings",
    homeLink: els.homeLink,
    refreshNav: refreshBackendNavElements
  });
  els.logoutLink = chrome.logoutLink;
  els.userLabel = chrome.userLabel;

  const authState = await loadBackendPageAuthState({
    apiOrigin,
    refreshNav: refreshBackendNavElements,
    computePermissions: (roles) => ({
      canReadSettings: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT)
    }),
    hasPageAccess: (permissions) => permissions.canReadSettings,
    logKey: "backend-settings",
    pageName: "settings.html",
    expectedRolesAnyOf: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to read settings."
  });
  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadSettings: Boolean(authState.permissions?.canReadSettings)
  };
  if (state.permissions.canReadSettings) {
    loadKeycloakUsers();
  }
}

async function loadKeycloakUsers() {
  clearError();
  const payload = await fetchApi(keycloakUsersRequest({ baseURL: apiOrigin }).url);
  if (!payload) return;
  state.keycloakUsers = Array.isArray(payload.items) ? payload.items : [];
  renderStaff(state.keycloakUsers);
}

function renderStaff(items) {
  if (!els.staffTable) return;
  const header = `<thead><tr><th>${escapeHtml(backendT("backend.table.name", "Name"))}</th><th>${escapeHtml(backendT("backend.table.username", "Username"))}</th><th class="keycloak-roles-col">${escapeHtml(backendT("backend.table.roles", "Roles"))}</th><th class="backend-table-align-right">${escapeHtml(backendT("backend.table.active", "Active"))}</th></tr></thead>`;
  const rows = items
    .map((staff) => `<tr>
      <td>${escapeHtml(staff.name || "-")}</td>
      <td>${escapeHtml(staff.username || "-")}</td>
      <td class="keycloak-roles-col">${formatKeycloakRolesCell(staff)}</td>
      <td class="backend-table-align-right">${staff.active ? escapeHtml(backendT("common.yes", "Yes")) : escapeHtml(backendT("common.no", "No"))}</td>
      </tr>`)
    .join("");
  els.staffTable.innerHTML = `${header}<tbody>${rows || `<tr><td colspan="4">${escapeHtml(backendT("backend.users.no_results", "No Keycloak users found"))}</td></tr>`}</tbody>`;
}

function formatKeycloakRoleList(roles) {
  const items = (Array.isArray(roles) ? roles : [])
    .map((role) => normalizeText(role))
    .filter(Boolean);
  return items.length ? items.join(", ") : "-";
}

function formatKeycloakRolesCell(user) {
  return escapeHtml(formatKeycloakRoleList(user?.client_roles));
}
