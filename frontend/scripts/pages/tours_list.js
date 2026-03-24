import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  fetchApiJson,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import { tourDeleteRequest, toursRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { buildTourCreateHref, buildTourEditHref } from "../shared/links.js";
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
  toursCreateBtn: document.getElementById("toursCreateBtn"),
  toursCountInfo: document.getElementById("toursCountInfo"),
  toursActionStatus: document.getElementById("toursActionStatus"),
  toursMatrixMount: document.getElementById("toursMatrixMount"),
  toursMatrixTotal: document.getElementById("toursMatrixTotal"),
  toursPagination: document.getElementById("toursPagination"),
  toursTable: document.getElementById("toursTable"),
  tourDeleteModal: document.getElementById("tourDeleteModal"),
  tourDeleteModalMessage: document.getElementById("tourDeleteModalMessage"),
  tourDeleteModalCloseBtn: document.getElementById("tourDeleteModalCloseBtn"),
  tourDeleteModalCancelBtn: document.getElementById("tourDeleteModalCancelBtn"),
  tourDeleteModalConfirmBtn: document.getElementById("tourDeleteModalConfirmBtn")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT,
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
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
    lastItems: [],
    search: "",
    destination: "all",
    style: "all",
    pendingDeleteId: "",
    pendingDeleteTitle: "",
    pendingDeleteTrigger: null,
    deletingId: "",
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
  if (!els.toursActionStatus) return;
  els.toursActionStatus.textContent = message;
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
      canReadTours: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TOUR_EDITOR),
      canEditTours: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.TOUR_EDITOR)
    }),
    hasPageAccess: (permissions) => permissions.canReadTours,
    logKey: "backend-tours",
    pageName: "tours.html",
    expectedRolesAnyOf: [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TOUR_EDITOR],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to access tours."
  });
  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadTours: Boolean(authState.permissions?.canReadTours),
    canEditTours: Boolean(authState.permissions?.canEditTours)
  };
  bindControls();
  if (els.toursCreateBtn) els.toursCreateBtn.hidden = !state.permissions.canEditTours;

  if (state.permissions.canReadTours) {
    loadTours();
  } else {
    showError(backendT("tour.error.forbidden", "You do not have access to tours."));
  }
}

function bindControls() {
  bindSearch(els.toursSearchBtn, els.toursSearch, state.tours, loadTours);

  if (els.toursCreateBtn) {
    els.toursCreateBtn.addEventListener("click", () => {
      if (!state.permissions.canEditTours) return;
      window.location.href = buildTourCreateHref();
    });
  }

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

  if (els.toursTable) {
    els.toursTable.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-tour-delete]") : null;
      if (!button) return;
      const tourId = normalizeText(button.getAttribute("data-tour-delete"));
      const title = normalizeText(button.getAttribute("data-tour-title"));
      openDeleteModal(tourId, title, button);
    });
  }

  if (els.tourDeleteModalCloseBtn) {
    els.tourDeleteModalCloseBtn.addEventListener("click", () => closeDeleteModal());
  }

  if (els.tourDeleteModalCancelBtn) {
    els.tourDeleteModalCancelBtn.addEventListener("click", () => closeDeleteModal());
  }

  if (els.tourDeleteModalConfirmBtn) {
    els.tourDeleteModalConfirmBtn.addEventListener("click", () => confirmDeleteTour());
  }

  if (els.tourDeleteModal) {
    els.tourDeleteModal.addEventListener("click", (event) => {
      if (event.target === els.tourDeleteModal) closeDeleteModal();
    });
    els.tourDeleteModal.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeDeleteModal();
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
  state.tours.lastItems = Array.isArray(payload.items) ? payload.items : [];
  populateTourFilterOptions(payload);
  updatePaginationUi();
  renderTours(state.tours.lastItems);
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
  const canEditTours = state.permissions.canEditTours;
  const header = `<thead><tr><th>${escapeHtml(backendT("backend.table.id", "ID"))}</th><th>${escapeHtml(backendT("backend.table.title", "Title"))}</th><th>${escapeHtml(backendT("backend.table.country", "Country"))}</th><th>${escapeHtml(backendT("backend.table.styles", "Styles"))}</th><th>${escapeHtml(backendT("backend.table.updated", "Updated"))}</th>${canEditTours ? `<th>${escapeHtml(backendT("backend.table.actions", "Actions"))}</th>` : ""}</tr></thead>`;
  const rows = items
    .map((tour) => {
      const styles = Array.isArray(tour.styles) ? tour.styles.join(", ") : "";
      const countries = Array.isArray(tour.destinations) ? tour.destinations.join(", ") : "";
      const href = buildTourEditHref(tour.id);
      const actionCell = canEditTours
        ? `<td><button class="btn btn-ghost offer-remove-btn" type="button" data-tour-delete="${escapeHtml(tour.id)}" data-tour-title="${escapeHtml(tour.title || "")}" title="${escapeHtml(backendT("backend.tours.delete", "Delete"))}" aria-label="${escapeHtml(backendT("backend.tours.delete", "Delete"))}" ${state.tours.deletingId === tour.id ? "disabled" : ""}>&times;</button></td>`
        : "";
      return `<tr>
        <td><a href="${escapeHtml(href)}" title="${escapeHtml(tour.id)}">${escapeHtml(shortId(tour.id))}</a></td>
        <td>${escapeHtml(tour.title || "-")}</td>
        <td>${escapeHtml(countries || "-")}</td>
        <td>${escapeHtml(styles || "-")}</td>
        <td>${escapeHtml(formatDateTime(tour.updated_at || tour.created_at))}</td>
        ${actionCell}
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="${canEditTours ? "6" : "5"}">${escapeHtml(backendT("backend.tours.no_results", "No tours found"))}</td></tr>`;
  if (els.toursTable) els.toursTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function openDeleteModal(tourId, title, trigger = null) {
  if (!state.permissions.canEditTours || !tourId || !els.tourDeleteModal) return;
  state.tours.pendingDeleteId = tourId;
  state.tours.pendingDeleteTitle = title || "";
  state.tours.pendingDeleteTrigger = trigger instanceof HTMLElement ? trigger : null;
  if (els.tourDeleteModalMessage) {
    els.tourDeleteModalMessage.textContent = backendT(
      "backend.tours.delete_confirm",
      "Delete tour \"{name}\"? This cannot be undone.",
      { name: title || tourId }
    );
  }
  els.tourDeleteModal.hidden = false;
  if (!els.tourDeleteModal.hasAttribute("tabindex")) els.tourDeleteModal.setAttribute("tabindex", "-1");
  window.setTimeout(() => {
    if (els.tourDeleteModalConfirmBtn?.focus) {
      els.tourDeleteModalConfirmBtn.focus();
      return;
    }
    els.tourDeleteModal.focus?.();
  }, 0);
}

function closeDeleteModal({ returnFocus = true } = {}) {
  if (!els.tourDeleteModal) return;
  els.tourDeleteModal.hidden = true;
  if (returnFocus && state.tours.pendingDeleteTrigger?.focus) {
    state.tours.pendingDeleteTrigger.focus();
  }
  state.tours.pendingDeleteId = "";
  state.tours.pendingDeleteTitle = "";
  state.tours.pendingDeleteTrigger = null;
}

async function confirmDeleteTour() {
  const tourId = state.tours.pendingDeleteId;
  const title = state.tours.pendingDeleteTitle;
  closeDeleteModal({ returnFocus: false });
  await deleteTour(tourId, title);
}

async function deleteTour(tourId, title) {
  if (!state.permissions.canEditTours || !tourId) return;
  clearError();
  state.tours.deletingId = tourId;
  setActionStatus(backendT("backend.tours.status.deleting", "Deleting tour..."));
  renderTours(state.tours.lastItems);

  const request = tourDeleteRequest({
    baseURL: apiOrigin,
    params: { tour_id: tourId }
  });
  const result = await fetchApiJson(withBackendApiLang(request.url), {
    apiBase,
    method: request.method,
    includeDetailInError: false,
    connectionErrorMessage: backendT("tour.error.connect", "Could not connect to backend API."),
    onError: (message) => showError(message)
  });

  state.tours.deletingId = "";
  if (!result?.deleted) {
    renderTours(state.tours.lastItems);
    return;
  }

  clearError();
  setActionStatus(backendT("backend.tours.status.deleted", "Tour deleted."));
  const wouldLeavePageEmpty = state.tours.page > 1 && state.tours.total > 0 && state.tours.total - 1 <= (state.tours.page - 1) * state.tours.pageSize;
  if (wouldLeavePageEmpty) state.tours.page = Math.max(1, state.tours.page - 1);
  await loadTours();
}
