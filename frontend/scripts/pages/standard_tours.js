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
  search: document.getElementById("standardToursSearch"),
  destination: document.getElementById("standardToursDestination"),
  searchBtn: document.getElementById("standardToursSearchBtn"),
  clearFiltersBtn: document.getElementById("standardToursClearFiltersBtn"),
  countInfo: document.getElementById("standardToursCountInfo"),
  actionStatus: document.getElementById("standardToursActionStatus"),
  table: document.getElementById("standardToursTable"),
  pagination: document.getElementById("standardToursPagination")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadStandardTours: false,
    canEditStandardTours: false
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
    <option value="all">${escapeHtml(backendT("backend.standard_tours.all_destinations", "All destinations"))}</option>
    ${DESTINATION_COUNTRY_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`).join("")}
  `;
  els.destination.value = state.list.destination;
}

function standardTourDetailHref(standardTourId) {
  return withBackendLang("/standard-tour.html", { id: normalizeText(standardTourId) });
}

function findListStandardTour(standardTourId) {
  return (Array.isArray(state.list.lastItems) ? state.list.lastItems : [])
    .find((standardTour) => normalizeText(standardTour?.id) === normalizeText(standardTourId)) || null;
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
    currentSection: "standard-tours",
    homeLink: els.homeLink,
    refreshNav: refreshBackendNavElements
  });
  els.logoutLink = chrome.logoutLink;
  els.userLabel = chrome.userLabel;

  const authState = await loadBackendPageAuthState({
    apiOrigin,
    refreshNav: refreshBackendNavElements,
    computePermissions: (roles) => ({
      canReadStandardTours: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR),
      canEditStandardTours: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR)
    }),
    hasPageAccess: (permissions) => permissions.canReadStandardTours,
    logKey: "backend-standard-tours",
    pageName: "standard-tours.html",
    expectedRolesAnyOf: [ROLES.TOUR_EDITOR],
    likelyCause: "The user is authenticated in Keycloak but does not have the atp_tour_editor role required to access standard tours."
  });

  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadStandardTours: Boolean(authState.permissions?.canReadStandardTours),
    canEditStandardTours: Boolean(authState.permissions?.canEditStandardTours)
  };

  renderCatalogOptions();
  bindControls();
  window.addEventListener("backend-i18n-changed", handleBackendLanguageChanged);

  if (state.permissions.canReadStandardTours) {
    await loadStandardTours();
  } else {
    showError(backendT("backend.standard_tours.forbidden", "You do not have access to standard tours."));
  }
}

function handleBackendLanguageChanged() {
  renderCatalogOptions();
  if (!state.permissions.canReadStandardTours) {
    showError(backendT("backend.standard_tours.forbidden", "You do not have access to standard tours."));
    return;
  }
  void loadStandardTours();
}

function bindControls() {
  els.searchBtn?.addEventListener("click", () => {
    state.list.page = 1;
    state.list.search = normalizeText(els.search?.value);
    void loadStandardTours();
  });

  els.search?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    state.list.page = 1;
    state.list.search = normalizeText(els.search?.value);
    void loadStandardTours();
  });

  els.destination?.addEventListener("change", () => {
    state.list.page = 1;
    state.list.destination = normalizeText(els.destination?.value) || "all";
    void loadStandardTours();
  });

  els.clearFiltersBtn?.addEventListener("click", () => {
    state.list.page = 1;
    state.list.search = "";
    state.list.destination = "all";
    if (els.search) els.search.value = "";
    if (els.destination) els.destination.value = "all";
    void loadStandardTours();
  });

  els.table?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-standard-tour-delete]") : null;
    if (!button) return;
    const deleteId = normalizeText(button.getAttribute("data-standard-tour-delete"));
    if (deleteId) {
      void deleteStandardTour(deleteId);
    }
  });
}

async function loadStandardTours() {
  clearError();
  const loadToken = ++state.list.loadToken;
  setActionStatus(backendT("backend.standard_tours.loading", "Loading..."));
  const params = new URLSearchParams();
  if (state.list.search) params.set("q", state.list.search);
  if (state.list.destination !== "all") params.set("destination", state.list.destination);
  params.set("page", String(state.list.page));
  params.set("page_size", String(state.list.pageSize));
  const payload = await fetchApi(withBackendApiLang(`/api/v1/standard-tours?${params.toString()}`));
  if (!payload || loadToken !== state.list.loadToken) return;
  const total = Number(payload.total || 0);
  state.list.total = total;
  state.list.totalPages = Math.max(1, Math.ceil(total / state.list.pageSize));
  state.list.lastItems = Array.isArray(payload.items) ? payload.items : [];
  renderStandardToursTable();
  renderPagination(els.pagination, {
    page: state.list.page,
    totalPages: state.list.totalPages
  }, (page) => {
    state.list.page = page;
    void loadStandardTours();
  });
  if (els.countInfo) {
    els.countInfo.textContent = backendT(
      "backend.standard_tours.count",
      "{count} standard tour(s)",
      { count: total }
    );
  }
  setActionStatus("");
}

function renderStandardToursTable() {
  if (!(els.table instanceof HTMLTableElement)) return;
  const items = Array.isArray(state.list.lastItems) ? state.list.lastItems : [];
  if (!items.length) {
    els.table.innerHTML = `
      <thead>
        <tr>
          <th>${escapeHtml(backendT("backend.standard_tours.form.title", "Title"))}</th>
          <th>${escapeHtml(backendT("backend.standard_tours.destination_label", "Destination"))}</th>
          <th>${escapeHtml(backendT("backend.standard_tours.day_count", "Days"))}</th>
          <th>${escapeHtml(backendT("backend.standard_tours.service_count", "Services"))}</th>
          <th>${escapeHtml(backendT("common.actions", "Actions"))}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="5">${escapeHtml(backendT("backend.standard_tours.empty", "No standard tours found."))}</td></tr>
      </tbody>
    `;
    return;
  }
  els.table.innerHTML = `
    <thead>
      <tr>
        <th>${escapeHtml(backendT("backend.standard_tours.form.title", "Title"))}</th>
        <th>${escapeHtml(backendT("backend.standard_tours.destination_label", "Destination"))}</th>
        <th>${escapeHtml(backendT("backend.standard_tours.day_count", "Days"))}</th>
        <th>${escapeHtml(backendT("backend.standard_tours.service_count", "Services"))}</th>
        <th>${escapeHtml(backendT("common.actions", "Actions"))}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((standardTour) => `
        <tr>
          <td>
            <a class="backend-link" href="${escapeHtml(standardTourDetailHref(standardTour.id || ""))}">
              <strong>${escapeHtml(standardTour.title || "")}</strong>
            </a>
          </td>
          <td>${escapeHtml((Array.isArray(standardTour.destinations) ? standardTour.destinations : []).join(", ") || "-")}</td>
          <td>${escapeHtml(String(Array.isArray(standardTour?.travel_plan?.days) ? standardTour.travel_plan.days.length : 0))}</td>
          <td>${escapeHtml(String((Array.isArray(standardTour?.travel_plan?.days) ? standardTour.travel_plan.days : []).flatMap((day) => (Array.isArray(day?.services) ? day.services : [])).length))}</td>
          <td>
            <div class="backend-table__actions">
              <a class="btn btn-ghost" href="${escapeHtml(standardTourDetailHref(standardTour.id || ""))}">${escapeHtml(backendT("common.edit", "Edit"))}</a>
              <button class="btn btn-ghost" type="button" data-standard-tour-delete="${escapeHtml(standardTour.id || "")}">${escapeHtml(backendT("common.delete", "Delete"))}</button>
            </div>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

async function deleteStandardTour(standardTourId) {
  if (!standardTourId) return;
  const standardTour = findListStandardTour(standardTourId);
  if (window.confirm(
    backendT(
      "backend.standard_tours.confirm_delete",
      "Delete standard tour “{title}”?",
      { title: standardTour?.title || standardTourId }
    )
  ) !== true) {
    return;
  }
  clearError();
  const payload = await fetchApi(withBackendApiLang(`/api/v1/standard-tours/${encodeURIComponent(standardTourId)}`), {
    method: "DELETE"
  });
  if (!payload?.deleted) return;
  setActionStatus(backendT("backend.standard_tours.deleted", "Standard tour deleted."));
  await loadStandardTours();
}
