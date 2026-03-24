import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import { toursRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { buildTourEditHref } from "../shared/links.js";
import { renderPagination } from "../shared/pagination.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  withBackendApiLang
} from "../shared/backend_page.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  toursSearch: document.getElementById("toursSearch"),
  toursDestination: document.getElementById("toursDestination"),
  toursStyle: document.getElementById("toursStyle"),
  toursClearFiltersBtn: document.getElementById("toursClearFiltersBtn"),
  toursSearchBtn: document.getElementById("toursSearchBtn"),
  toursCountInfo: document.getElementById("toursCountInfo"),
  toursMatrixMount: document.getElementById("toursMatrixMount"),
  toursMatrixTotal: document.getElementById("toursMatrixTotal"),
  toursPagination: document.getElementById("toursPagination"),
  toursTable: document.getElementById("toursTable")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT
});

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadTours: false,
    canEditTours: false
  },
  tours: {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    total: 0,
    search: "",
    destination: "all",
    style: "all",
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

function formatIntegerWithGrouping(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(Number(value));
}

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
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
    currentSection: "tours",
    homeLink: els.homeLink,
    refreshNav: refreshBackendNavElements
  });
  els.logoutLink = chrome.logoutLink;
  els.userLabel = chrome.userLabel;

  const authState = await loadBackendPageAuthState({
    apiOrigin,
    refreshNav: refreshBackendNavElements,
    computePermissions: (roles) => ({
      canReadTours: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.ACCOUNTANT),
      canEditTours: hasAnyRoleInList(roles, ROLES.ADMIN)
    }),
    hasPageAccess: (permissions) => permissions.canReadTours,
    logKey: "backend-tours",
    pageName: "tours.html",
    expectedRolesAnyOf: [ROLES.ADMIN, ROLES.ACCOUNTANT],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to read tours."
  });
  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadTours: Boolean(authState.permissions?.canReadTours),
    canEditTours: Boolean(authState.permissions?.canEditTours)
  };
  bindControls();

  if (state.permissions.canReadTours) {
    loadTours();
  }
}

function bindControls() {
  bindSearch(els.toursSearchBtn, els.toursSearch, state.tours, loadTours);

  if (els.toursDestination) {
    els.toursDestination.addEventListener("change", () => {
      state.tours.destination = els.toursDestination.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (els.toursStyle) {
    els.toursStyle.addEventListener("change", () => {
      state.tours.style = els.toursStyle.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (els.toursClearFiltersBtn) {
    els.toursClearFiltersBtn.addEventListener("click", () => {
      state.tours.destination = "all";
      state.tours.style = "all";
      state.tours.page = 1;
      if (els.toursDestination) els.toursDestination.value = "all";
      if (els.toursStyle) els.toursStyle.value = "all";
      loadTours();
    });
  }
}

function bindSearch(searchBtn, searchInput, model, reloadFn) {
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      model.page = 1;
      model.search = (searchInput?.value || "").trim();
      reloadFn();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      model.page = 1;
      model.search = (searchInput?.value || "").trim();
      reloadFn();
    });
  }
}

async function loadTours() {
  clearError();
  const loadToken = ++state.tours.loadToken;
  if (els.toursMatrixMount) els.toursMatrixMount.innerHTML = "";
  if (els.toursMatrixTotal) els.toursMatrixTotal.textContent = "";

  const request = toursRequest({
    baseURL: apiOrigin,
    query: buildToursQueryEntries({
      page: state.tours.page,
      pageSize: state.tours.pageSize
    })
  });
  const payload = await fetchApi(withBackendApiLang(request.url));
  if (!payload || loadToken !== state.tours.loadToken) return;
  const pagination = payload.pagination || {};

  state.tours.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.tours.pageSize) || 1)
  );
  state.tours.total = Number(pagination.total_items || 0);
  state.tours.page = Number(pagination.page || state.tours.page);
  populateTourFilterOptions(payload);
  updatePaginationUi();
  renderTours(payload.items || []);
  renderToursMatrix(payload?.matrix, Number((payload?.matrix?.total_tours ?? pagination.total_items) || 0));
}

function buildToursQueryEntries({ page = 1, pageSize = state.tours.pageSize } = {}) {
  const entries = {
    page: String(page),
    page_size: String(pageSize),
    sort: "updated_at_desc"
  };
  if (state.tours.search) entries.search = state.tours.search;
  if (state.tours.destination && state.tours.destination !== "all") entries.destination = state.tours.destination;
  if (state.tours.style && state.tours.style !== "all") entries.style = state.tours.style;
  return entries;
}

function populateTourFilterOptions(payload) {
  const destinations = Array.isArray(payload?.available_destinations) ? payload.available_destinations : [];
  const styles = Array.isArray(payload?.available_styles) ? payload.available_styles : [];

  if (els.toursDestination) {
    const current = state.tours.destination || "all";
    const options = [`<option value="all">${escapeHtml(backendT("backend.tours.all_destinations", "All destinations"))}</option>`]
      .concat(destinations.map((value) => `<option value="${escapeHtml(value.code || value)}">${escapeHtml(value.label || value.code || value)}</option>`))
      .join("");
    els.toursDestination.innerHTML = options;
    els.toursDestination.value = destinations.some((value) => String(value?.code || value) === current) ? current : "all";
    state.tours.destination = els.toursDestination.value;
  }

  if (els.toursStyle) {
    const current = state.tours.style || "all";
    const options = [`<option value="all">${escapeHtml(backendT("backend.tours.all_styles", "All styles"))}</option>`]
      .concat(styles.map((value) => `<option value="${escapeHtml(value.code || value)}">${escapeHtml(value.label || value.code || value)}</option>`))
      .join("");
    els.toursStyle.innerHTML = options;
    els.toursStyle.value = styles.some((value) => String(value?.code || value) === current) ? current : "all";
    state.tours.style = els.toursStyle.value;
  }
}

function updatePaginationUi() {
  if (els.toursCountInfo) {
    els.toursCountInfo.textContent = backendT("common.page_status", "{total} total · page {page} of {totalPages}", {
      total: state.tours.total,
      page: state.tours.page,
      totalPages: state.tours.totalPages
    });
  }

  if (els.toursPagination) {
    renderPagination(els.toursPagination, state.tours, (page) => {
      state.tours.page = page;
      loadTours();
    });
  }
}

function renderToursMatrix(matrix, totalTours) {
  if (!els.toursMatrixMount || !els.toursMatrixTotal) return;
  const orderedDestinations = Array.isArray(matrix?.destinations)
    ? matrix.destinations.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  const orderedStyles = Array.isArray(matrix?.styles)
    ? matrix.styles.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  const counts = matrix?.counts && typeof matrix.counts === "object" ? matrix.counts : {};

  if (!orderedDestinations.length || !orderedStyles.length) {
    els.toursMatrixMount.innerHTML = `<div class="backend-tour-matrix__empty">${escapeHtml(backendT("backend.tours.no_results", "No tours found"))}</div>`;
    els.toursMatrixTotal.textContent = backendT("backend.tours.matrix.total", "Total tours: {count}", {
      count: String(totalTours)
    });
    return;
  }

  const headerCells = orderedDestinations
    .map((destination) => `<th scope="col" class="backend-tour-matrix__matrix-col">${escapeHtml(destination)}</th>`)
    .join("");
  const bodyRows = orderedStyles
    .map((style) => {
      const cells = orderedDestinations
        .map((destination) => `<td class="backend-tour-matrix__matrix-col"><span class="backend-tour-matrix__value">${escapeHtml(String(Number(counts[`${destination}::${style}`] || 0)))}</span></td>`)
        .join("");
      return `<tr><th scope="row" class="backend-tour-matrix__row-label">${escapeHtml(style)}</th>${cells}</tr>`;
    })
    .join("");

  els.toursMatrixMount.innerHTML = `
    <div class="backend-table-wrap backend-tour-matrix__wrap">
      <table class="backend-table backend-tour-matrix__table">
        <thead>
          <tr>
            <th scope="col" class="backend-tour-matrix__row-label-col">${escapeHtml(backendT("backend.tours.matrix.destination_style", "Travel style"))}</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
  els.toursMatrixTotal.textContent = backendT("backend.tours.matrix.total", "Total tours: {count}", {
    count: String(totalTours)
  });
}

function renderTours(items) {
  const header = `<thead><tr><th>${escapeHtml(backendT("backend.table.id", "ID"))}</th><th>${escapeHtml(backendT("backend.table.title", "Title"))}</th><th>${escapeHtml(backendT("backend.table.country", "Country"))}</th><th>${escapeHtml(backendT("backend.table.styles", "Styles"))}</th><th>${escapeHtml(backendT("backend.table.updated", "Updated"))}</th></tr></thead>`;
  const rows = items
    .map((tour) => {
      const styles = Array.isArray(tour.styles) ? tour.styles.join(", ") : "";
      const countries = Array.isArray(tour.destinations) ? tour.destinations.join(", ") : "";
      const href = buildTourEditHref(tour.id);
      return `<tr>
        <td><a href="${escapeHtml(href)}" title="${escapeHtml(tour.id)}">${escapeHtml(shortId(tour.id))}</a></td>
        <td>${escapeHtml(tour.title || "-")}</td>
        <td>${escapeHtml(countries || "-")}</td>
        <td>${escapeHtml(styles || "-")}</td>
        <td>${escapeHtml(formatDateTime(tour.updated_at || tour.created_at))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="5">${escapeHtml(backendT("backend.tours.no_results", "No tours found"))}</td></tr>`;
  if (els.toursTable) els.toursTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}
