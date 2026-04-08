import {
  createApiFetcher,
  escapeHtml,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  COUNTRY_CODE_OPTIONS
} from "../shared/generated_catalogs.js";
import { renderPagination } from "../shared/pagination.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  withBackendApiLang,
  withBackendLang
} from "../shared/backend_page.js";

const DESTINATION_COUNTRY_CODES = Object.freeze(["VN", "TH", "KH", "LA"]);
const DESTINATION_COUNTRY_OPTIONS = Object.freeze(
  COUNTRY_CODE_OPTIONS.filter((option) => DESTINATION_COUNTRY_CODES.includes(option?.value))
);
const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  search: document.getElementById("standardTravelPlansSearch"),
  destination: document.getElementById("standardTravelPlansDestination"),
  searchBtn: document.getElementById("standardTravelPlansSearchBtn"),
  clearFiltersBtn: document.getElementById("standardTravelPlansClearFiltersBtn"),
  countInfo: document.getElementById("standardTravelPlansCountInfo"),
  actionStatus: document.getElementById("standardTravelPlansActionStatus"),
  table: document.getElementById("standardTravelPlansTable"),
  pagination: document.getElementById("standardTravelPlansPagination")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  MANAGER: GENERATED_ROLE_LOOKUP.MANAGER,
  ATP_STAFF: GENERATED_ROLE_LOOKUP.ATP_STAFF
});

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadTemplates: false,
    canEditTemplates: false
  },
  list: {
    page: 1,
    pageSize: 20,
    totalPages: 1,
    total: 0,
    lastItems: [],
    search: "",
    destination: "all",
    loadToken: 0
  }
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

function setActionStatus(message = "") {
  if (!els.actionStatus) return;
  els.actionStatus.textContent = message;
}

function renderCatalogOptions() {
  if (!(els.destination instanceof HTMLSelectElement)) return;
  els.destination.innerHTML = `
    <option value="all">${escapeHtml(backendT("backend.standard_travel_plans.all_destinations", "All destinations"))}</option>
    ${DESTINATION_COUNTRY_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`).join("")}
  `;
  els.destination.value = state.list.destination;
}

function templateDetailHref(templateId) {
  return withBackendLang("/standard-travel-plan.html", { id: normalizeText(templateId) });
}

function findListTemplate(templateId) {
  return (Array.isArray(state.list.lastItems) ? state.list.lastItems : [])
    .find((template) => normalizeText(template?.id) === normalizeText(templateId)) || null;
}

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API."),
  suppressNotFound: false,
  includeDetailInError: false
});

init();

async function init() {
  const chrome = await initializeBackendPageChrome({
    currentSection: "standard-travel-plans",
    homeLink: els.homeLink,
    refreshNav: refreshBackendNavElements
  });
  els.logoutLink = chrome.logoutLink;
  els.userLabel = chrome.userLabel;

  const authState = await loadBackendPageAuthState({
    apiOrigin,
    refreshNav: refreshBackendNavElements,
    computePermissions: (roles) => ({
      canReadTemplates: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.MANAGER, ROLES.ATP_STAFF),
      canEditTemplates: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.MANAGER, ROLES.ATP_STAFF)
    }),
    hasPageAccess: (permissions) => permissions.canReadTemplates,
    logKey: "backend-standard-travel-plans",
    pageName: "standard-travel-plans.html",
    expectedRolesAnyOf: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ATP_STAFF],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to access standard travel plans."
  });

  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadTemplates: Boolean(authState.permissions?.canReadTemplates),
    canEditTemplates: Boolean(authState.permissions?.canEditTemplates)
  };

  renderCatalogOptions();
  bindControls();

  if (state.permissions.canReadTemplates) {
    await loadTemplates();
  } else {
    showError(backendT("backend.standard_travel_plans.forbidden", "You do not have access to standard travel plans."));
  }
}

function bindControls() {
  els.searchBtn?.addEventListener("click", () => {
    state.list.page = 1;
    state.list.search = normalizeText(els.search?.value);
    void loadTemplates();
  });

  els.search?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    state.list.page = 1;
    state.list.search = normalizeText(els.search?.value);
    void loadTemplates();
  });

  els.destination?.addEventListener("change", () => {
    state.list.page = 1;
    state.list.destination = normalizeText(els.destination?.value) || "all";
    void loadTemplates();
  });

  els.clearFiltersBtn?.addEventListener("click", () => {
    state.list.page = 1;
    state.list.search = "";
    state.list.destination = "all";
    if (els.search) els.search.value = "";
    if (els.destination) els.destination.value = "all";
    void loadTemplates();
  });

  els.table?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-template-delete]") : null;
    if (!button) return;
    const deleteId = normalizeText(button.getAttribute("data-template-delete"));
    if (deleteId) {
      void deleteTemplate(deleteId);
    }
  });
}

async function loadTemplates() {
  clearError();
  const loadToken = ++state.list.loadToken;
  setActionStatus(backendT("backend.standard_travel_plans.loading", "Loading..."));
  const params = new URLSearchParams();
  if (state.list.search) params.set("q", state.list.search);
  if (state.list.destination !== "all") params.set("destination", state.list.destination);
  params.set("page", String(state.list.page));
  params.set("page_size", String(state.list.pageSize));
  const payload = await fetchApi(withBackendApiLang(`/api/v1/travel-plan-templates?${params.toString()}`));
  if (!payload || loadToken !== state.list.loadToken) return;
  const total = Number(payload.total || 0);
  state.list.total = total;
  state.list.totalPages = Math.max(1, Math.ceil(total / state.list.pageSize));
  state.list.lastItems = Array.isArray(payload.items) ? payload.items : [];
  renderTemplatesTable();
  renderPagination(els.pagination, {
    page: state.list.page,
    totalPages: state.list.totalPages
  }, (page) => {
    state.list.page = page;
    void loadTemplates();
  });
  if (els.countInfo) {
    els.countInfo.textContent = backendT(
      "backend.standard_travel_plans.count",
      "{count} template(s)",
      { count: total }
    );
  }
  setActionStatus("");
}

function renderTemplatesTable() {
  if (!(els.table instanceof HTMLTableElement)) return;
  const items = Array.isArray(state.list.lastItems) ? state.list.lastItems : [];
  if (!items.length) {
    els.table.innerHTML = `
      <thead>
        <tr>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.form.title", "Title"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.destination_label", "Destination"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.day_count", "Days"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.service_count", "Services"))}</th>
          <th>${escapeHtml(backendT("common.actions", "Actions"))}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="5">${escapeHtml(backendT("backend.standard_travel_plans.empty", "No standard travel plans found."))}</td></tr>
      </tbody>
    `;
    return;
  }
  els.table.innerHTML = `
    <thead>
      <tr>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.form.title", "Title"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.destination_label", "Destination"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.day_count", "Days"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.service_count", "Services"))}</th>
        <th>${escapeHtml(backendT("common.actions", "Actions"))}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((template) => `
        <tr>
          <td>
            <a class="backend-link" href="${escapeHtml(templateDetailHref(template.id || ""))}">
              <strong>${escapeHtml(template.title || "")}</strong>
            </a>
          </td>
          <td>${escapeHtml((Array.isArray(template.destinations) ? template.destinations : []).join(", ") || "-")}</td>
          <td>${escapeHtml(String(Array.isArray(template?.travel_plan?.days) ? template.travel_plan.days.length : 0))}</td>
          <td>${escapeHtml(String((Array.isArray(template?.travel_plan?.days) ? template.travel_plan.days : []).flatMap((day) => (Array.isArray(day?.services) ? day.services : [])).length))}</td>
          <td>
            <div class="backend-table__actions">
              <a class="btn btn-ghost" href="${escapeHtml(templateDetailHref(template.id || ""))}">${escapeHtml(backendT("common.edit", "Edit"))}</a>
              <button class="btn btn-ghost" type="button" data-template-delete="${escapeHtml(template.id || "")}">${escapeHtml(backendT("common.delete", "Delete"))}</button>
            </div>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

async function deleteTemplate(templateId) {
  if (!templateId) return;
  const template = findListTemplate(templateId);
  if (window.confirm(
    backendT(
      "backend.standard_travel_plans.confirm_delete",
      "Delete standard travel plan “{title}”?",
      { title: template?.title || templateId }
    )
  ) !== true) {
    return;
  }
  clearError();
  const payload = await fetchApi(withBackendApiLang(`/api/v1/travel-plan-templates/${encodeURIComponent(templateId)}`), {
    method: "DELETE"
  });
  if (!payload?.deleted) return;
  setActionStatus(backendT("backend.standard_travel_plans.deleted", "Standard travel plan deleted."));
  await loadTemplates();
}
