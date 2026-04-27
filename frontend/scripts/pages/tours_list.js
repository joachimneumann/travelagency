import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  fetchApiJson,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  destinationScopeAreaCreateRequest,
  destinationScopeCatalogRequest,
  destinationScopeDestinationCreateRequest,
  destinationScopePlaceCreateRequest,
  tourDeleteRequest,
  toursRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { buildTourCreateHref, buildTourEditHref } from "../shared/links.js";
import { renderPagination } from "../shared/pagination.js";
import { COUNTRY_CODE_OPTIONS } from "../shared/generated_catalogs.js";
import { normalizeDestinationScopeCatalog } from "../shared/destination_scope_editor.js";
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
const COUNTRY_LABEL_BY_CODE = new Map(
  COUNTRY_CODE_OPTIONS.map((option) => [normalizeText(option.value), normalizeText(option.label || option.value)])
);

const els = {
  pageBody: document.body,
  pageHeader: document.getElementById("top"),
  mainContent: document.getElementById("main-content"),
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  toursSearch: document.getElementById("toursSearch"),
  destinationScopeFilter: document.getElementById("toursDestinationScopeFilter"),
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
  destinationCatalogPanel: document.getElementById("tourDestinationCatalogPanel"),
  destinationCatalogContent: document.getElementById("tourDestinationCatalogContent"),
  destinationCatalogStatus: document.getElementById("tourDestinationCatalogStatus"),
  tourDeleteModal: document.getElementById("tourDeleteModal"),
  tourDeleteModalMessage: document.getElementById("tourDeleteModalMessage"),
  tourDeleteModalCloseBtn: document.getElementById("tourDeleteModalCloseBtn"),
  tourDeleteModalCancelBtn: document.getElementById("tourDeleteModalCancelBtn"),
  tourDeleteModalConfirmBtn: document.getElementById("tourDeleteModalConfirmBtn"),
  deleteOverlay: document.getElementById("toursDeleteOverlay"),
  deleteOverlayText: document.getElementById("toursDeleteOverlayText")
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
    pageSize: 100,
    totalPages: 1,
    total: 0,
    lastItems: [],
    search: "",
    destination: "",
    area: "",
    place: "",
    style: "all",
    pendingDeleteId: "",
    pendingDeleteTitle: "",
    pendingDeleteTrigger: null,
    deletingId: "",
    loadToken: 0
  },
  destinationCatalog: {
    catalog: normalizeDestinationScopeCatalog({}),
    loading: false,
    saving: false
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

function setToursPageOverlay(isVisible, message = "") {
  if (els.deleteOverlayText) {
    els.deleteOverlayText.textContent = String(
      message || backendT("backend.tours.status.deleting", "Deleting tour...")
    ).trim();
  }
  if (els.pageBody instanceof HTMLElement) {
    els.pageBody.classList.toggle("backend-list-page--busy", Boolean(isVisible));
  }
  if (els.pageHeader instanceof HTMLElement) {
    els.pageHeader.inert = Boolean(isVisible);
    els.pageHeader.setAttribute("aria-busy", isVisible ? "true" : "false");
  }
  if (els.mainContent instanceof HTMLElement) {
    els.mainContent.inert = Boolean(isVisible);
    els.mainContent.setAttribute("aria-busy", isVisible ? "true" : "false");
  }
  if (!(els.deleteOverlay instanceof HTMLElement)) return;
  if (isVisible) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    els.deleteOverlay.hidden = false;
    els.deleteOverlay.setAttribute("aria-hidden", "false");
    return;
  }
  els.deleteOverlay.hidden = true;
  els.deleteOverlay.setAttribute("aria-hidden", "true");
}

function formatIntegerWithGrouping(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(Number(value));
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
    pageName: "marketing_tours.html",
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
    loadDestinationCatalog();
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

  if (els.toursStyle) {
    els.toursStyle.addEventListener("change", () => {
      state.tours.style = els.toursStyle.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (els.toursClearFiltersBtn) {
    els.toursClearFiltersBtn.addEventListener("click", () => {
      state.tours.destination = "";
      state.tours.area = "";
      state.tours.place = "";
      state.tours.style = "all";
      state.tours.page = 1;
      if (els.toursStyle) els.toursStyle.value = "all";
      renderDestinationScopeFilter();
      loadTours();
    });
  }

  if (els.destinationScopeFilter) {
    els.destinationScopeFilter.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-destination-filter]") : null;
      if (!(button instanceof HTMLElement)) return;
      event.preventDefault();
      applyDestinationScopeFilter({
        destination: normalizeText(button.getAttribute("data-destination-filter-destination")),
        area: normalizeText(button.getAttribute("data-destination-filter-area")),
        place: normalizeText(button.getAttribute("data-destination-filter-place"))
      });
    });
  }

  if (els.toursTable) {
    els.toursTable.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-tour-delete]") : null;
      if (button) {
        const tourId = normalizeText(button.getAttribute("data-tour-delete"));
        const title = normalizeText(button.getAttribute("data-tour-title"));
        openDeleteModal(tourId, title, button);
        return;
      }
      const row = resolveTourRowTarget(event.target);
      if (!row) return;
      openTourFromRow(row);
    });
    els.toursTable.addEventListener("keydown", handleToursTableKeydown);
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

  if (els.destinationCatalogContent) {
    els.destinationCatalogContent.addEventListener("submit", (event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form) return;
      event.preventDefault();
      if (form.hasAttribute("data-destination-area-create")) {
        void createDestinationCatalogArea(form);
        return;
      }
      if (form.hasAttribute("data-destination-create")) {
        void createDestinationCatalogDestination(form);
        return;
      }
      if (form.hasAttribute("data-destination-place-create")) {
        void createDestinationCatalogPlace(form);
      }
    });
  }
}

function resolveTourRowTarget(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest("a, button, input, select, textarea, summary, label")) return null;
  const row = target.closest("[data-tour-href]");
  return row instanceof HTMLElement ? row : null;
}

function openTourFromRow(row) {
  if (!(row instanceof HTMLElement)) return;
  const href = normalizeText(row.getAttribute("data-tour-href"));
  if (!href) return;
  window.location.href = href;
}

function handleToursTableKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = resolveTourRowTarget(event.target);
  if (!row) return;
  event.preventDefault();
  openTourFromRow(row);
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
  const payload = await fetchApi(withBackendApiLang(request.url), { cache: "no-store" });
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
  renderDestinationCatalog();
}

function buildToursQueryEntries({ page = 1, pageSize = state.tours.pageSize } = {}) {
  const entries = {
    page: String(page),
    page_size: String(pageSize),
    sort: "updated_at_desc"
  };
  if (state.tours.search) entries.search = state.tours.search;
  if (state.tours.destination) entries.destination = state.tours.destination;
  if (state.tours.area) entries.area = state.tours.area;
  if (state.tours.place) entries.place = state.tours.place;
  if (state.tours.style && state.tours.style !== "all") entries.style = state.tours.style;
  return entries;
}

function populateTourFilterOptions(payload) {
  const styles = Array.isArray(payload?.available_styles) ? payload.available_styles : [];

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

function setDestinationCatalogStatus(message = "") {
  if (!els.destinationCatalogStatus) return;
  els.destinationCatalogStatus.textContent = message;
}

async function loadDestinationCatalog() {
  if (!state.permissions.canReadTours || !els.destinationCatalogContent) return;
  state.destinationCatalog.loading = true;
  renderDestinationScopeFilter();
  renderDestinationCatalog();
  try {
    const request = destinationScopeCatalogRequest({ baseURL: apiOrigin });
    const payload = await fetchApi(withBackendApiLang(request.url), { cache: "no-store" });
    if (payload) {
      state.destinationCatalog.catalog = normalizeDestinationScopeCatalog(payload);
    }
    clearError();
  } finally {
    state.destinationCatalog.loading = false;
    renderDestinationScopeFilter();
    renderDestinationCatalog();
  }
}

function applyDestinationScopeFilter({ destination = "", area = "", place = "" } = {}) {
  state.tours.destination = destination;
  state.tours.area = area;
  state.tours.place = place;
  state.tours.page = 1;
  renderDestinationScopeFilter();
  loadTours();
}

function destinationDisplayLabel(destination) {
  const code = normalizeText(destination?.code || destination);
  return normalizeText(destination?.label) || COUNTRY_LABEL_BY_CODE.get(code) || code;
}

function isDestinationFilterActive({ destination = "", area = "", place = "" } = {}) {
  return state.tours.destination === destination
    && state.tours.area === area
    && state.tours.place === place;
}

function renderFilterButton({ label, destination = "", area = "", place = "", className = "tour-destination-filter__chip" }) {
  return `
    <button
      class="${escapeHtml(className)}"
      type="button"
      data-destination-filter
      data-destination-filter-destination="${escapeHtml(destination)}"
      data-destination-filter-area="${escapeHtml(area)}"
      data-destination-filter-place="${escapeHtml(place)}"
      aria-pressed="${isDestinationFilterActive({ destination, area, place }) ? "true" : "false"}"
    >${escapeHtml(label)}</button>
  `;
}

function renderDestinationScopeFilter() {
  if (!els.destinationScopeFilter) return;
  if (state.destinationCatalog.loading) {
    els.destinationScopeFilter.innerHTML = `<p class="micro tour-destination-filter__empty">${escapeHtml(backendT("backend.tours.destination_catalog.loading", "Loading destinations..."))}</p>`;
    return;
  }

  const catalog = normalizeDestinationScopeCatalog(state.destinationCatalog.catalog);
  const areaByDestination = new Map();
  for (const area of catalog.areas) {
    const items = areaByDestination.get(area.destination) || [];
    items.push(area);
    areaByDestination.set(area.destination, items);
  }
  const placesByArea = new Map();
  for (const place of catalog.places) {
    const items = placesByArea.get(place.area_id) || [];
    items.push(place);
    placesByArea.set(place.area_id, items);
  }

  const destinationsMarkup = catalog.destinations.map((destination) => {
    const destinationCode = normalizeText(destination.code);
    const areas = areaByDestination.get(destinationCode) || [];
    return `
      <section class="tour-destination-filter__destination">
        ${renderFilterButton({
          label: destinationDisplayLabel(destination),
          destination: destinationCode,
          className: "tour-destination-filter__chip tour-destination-filter__destination-head"
        })}
        ${areas.length
          ? `<div class="tour-destination-filter__areas">
              ${areas.map((area) => {
                const places = placesByArea.get(area.id) || [];
                return `
                  <div class="tour-destination-filter__area">
                    ${renderFilterButton({
                      label: area.label || area.code || area.id,
                      destination: destinationCode,
                      area: area.id,
                      className: "tour-destination-filter__chip tour-destination-filter__area-head"
                    })}
                    ${places.length
                      ? `<div class="tour-destination-filter__places">
                          ${places.map((place) => renderFilterButton({
                            label: place.label || place.code || place.id,
                            destination: destinationCode,
                            area: area.id,
                            place: place.id
                          })).join("")}
                        </div>`
                      : ""}
                  </div>
                `;
              }).join("")}
            </div>`
          : `<p class="micro tour-destination-filter__empty">${escapeHtml(backendT("backend.tours.destination_catalog.no_areas", "No areas yet."))}</p>`}
      </section>
    `;
  }).join("");

  els.destinationScopeFilter.innerHTML = `
    <div class="tour-destination-filter__head">
      <p class="tour-destination-filter__title">${escapeHtml(backendT("backend.tours.destination_filter.heading", "Destination filter"))}</p>
      ${renderFilterButton({
        label: backendT("backend.tours.all_destinations", "All destinations"),
        className: "tour-destination-filter__chip"
      })}
    </div>
    ${destinationsMarkup
      ? `<div class="tour-destination-filter__destinations">${destinationsMarkup}</div>`
      : `<p class="micro tour-destination-filter__empty">${escapeHtml(backendT("backend.tours.destination_filter.empty", "No destinations configured."))}</p>`}
  `;
}

function selectedTourDestinationScopeWarnings(catalog) {
  const destinationByCode = new Map(catalog.destinations.map((destination) => [normalizeText(destination.code), destination]));
  const areaById = new Map(catalog.areas.map((area) => [normalizeText(area.id), area]));
  const placeById = new Map(catalog.places.map((place) => [normalizeText(place.id), place]));
  const warnings = [];

  for (const tour of state.tours.lastItems) {
    const problems = [];
    const scope = Array.isArray(tour?.travel_plan?.destination_scope) ? tour.travel_plan.destination_scope : [];
    for (const entry of scope) {
      const destination = normalizeText(entry?.destination);
      if (destination && !destinationByCode.has(destination)) {
        problems.push(backendT("backend.tours.destination_catalog.warning_destination", "destination {value}", {
          value: destination
        }));
      }
      for (const areaSelection of Array.isArray(entry?.areas) ? entry.areas : []) {
        const areaId = normalizeText(areaSelection?.area_id);
        const area = areaById.get(areaId);
        if (areaId && !area) {
          problems.push(backendT("backend.tours.destination_catalog.warning_area", "area {value}", {
            value: areaId
          }));
        } else if (area && destination && area.destination !== destination) {
          problems.push(backendT("backend.tours.destination_catalog.warning_area_mismatch", "area {value} under {destination}", {
            value: area.label || area.id,
            destination
          }));
        }
        for (const placeSelection of Array.isArray(areaSelection?.places) ? areaSelection.places : []) {
          const placeId = normalizeText(placeSelection?.place_id);
          const place = placeById.get(placeId);
          if (placeId && !place) {
            problems.push(backendT("backend.tours.destination_catalog.warning_place", "place {value}", {
              value: placeId
            }));
          } else if (place && areaId && place.area_id !== areaId) {
            problems.push(backendT("backend.tours.destination_catalog.warning_place_mismatch", "place {value} under {area}", {
              value: place.label || place.id,
              area: areaId
            }));
          }
        }
      }
    }
    if (problems.length) {
      warnings.push({
        tour: normalizeText(tour?.title) || normalizeText(tour?.id) || "-",
        problems: Array.from(new Set(problems))
      });
    }
  }

  return warnings;
}

function renderDestinationCatalogWarnings(catalog) {
  const warnings = selectedTourDestinationScopeWarnings(catalog);
  if (!warnings.length) return "";
  return `
    <div class="tour-destination-catalog__warnings" role="alert">
      <strong>${escapeHtml(backendT("backend.tours.destination_catalog.warning_heading", "Some tours use destinations, areas, or places that are not configured."))}</strong>
      <ul>
        ${warnings.map((warning) => `
          <li>${escapeHtml(warning.tour)}: ${escapeHtml(warning.problems.join(", "))}</li>
        `).join("")}
      </ul>
    </div>
  `;
}

function catalogInputValue(form) {
  const input = typeof form?.elements?.namedItem === "function" ? form.elements.namedItem("name") : null;
  return normalizeText(input?.value);
}

function clearCatalogInput(form) {
  const input = typeof form?.elements?.namedItem === "function" ? form.elements.namedItem("name") : null;
  if (input) input.value = "";
}

async function createDestinationCatalogDestination(form) {
  if (!state.permissions.canEditTours || state.destinationCatalog.saving) return;
  const select = typeof form?.elements?.namedItem === "function" ? form.elements.namedItem("destination") : null;
  const destination = normalizeText(select?.value);
  if (!destination) return;
  state.destinationCatalog.saving = true;
  setDestinationCatalogStatus(backendT("backend.tours.destination_catalog.saving", "Saving destination catalog..."));
  try {
    const request = destinationScopeDestinationCreateRequest({
      baseURL: apiOrigin,
      body: { destination }
    });
    const result = await fetchApi(withBackendApiLang(request.url), {
      method: request.method,
      body: request.body
    });
    if (result?.catalog) {
      state.destinationCatalog.catalog = normalizeDestinationScopeCatalog(result.catalog);
      setDestinationCatalogStatus(backendT("backend.tours.destination_catalog.saved", "Destination catalog saved."));
    }
  } finally {
    state.destinationCatalog.saving = false;
    renderDestinationCatalog();
  }
}

async function createDestinationCatalogArea(form) {
  if (!state.permissions.canEditTours || state.destinationCatalog.saving) return;
  const destination = normalizeText(form.getAttribute("data-destination-area-create"));
  const name = catalogInputValue(form);
  if (!destination || !name) return;
  state.destinationCatalog.saving = true;
  setDestinationCatalogStatus(backendT("backend.tours.destination_catalog.saving", "Saving destination catalog..."));
  try {
    const request = destinationScopeAreaCreateRequest({
      baseURL: apiOrigin,
      body: { destination, name }
    });
    const result = await fetchApi(withBackendApiLang(request.url), {
      method: request.method,
      body: request.body
    });
    if (result?.catalog) {
      state.destinationCatalog.catalog = normalizeDestinationScopeCatalog(result.catalog);
      clearCatalogInput(form);
      setDestinationCatalogStatus(backendT("backend.tours.destination_catalog.saved", "Destination catalog saved."));
    }
  } finally {
    state.destinationCatalog.saving = false;
    renderDestinationCatalog();
  }
}

async function createDestinationCatalogPlace(form) {
  if (!state.permissions.canEditTours || state.destinationCatalog.saving) return;
  const areaId = normalizeText(form.getAttribute("data-destination-place-create"));
  const name = catalogInputValue(form);
  if (!areaId || !name) return;
  state.destinationCatalog.saving = true;
  setDestinationCatalogStatus(backendT("backend.tours.destination_catalog.saving", "Saving destination catalog..."));
  try {
    const request = destinationScopePlaceCreateRequest({
      baseURL: apiOrigin,
      body: { area_id: areaId, name }
    });
    const result = await fetchApi(withBackendApiLang(request.url), {
      method: request.method,
      body: request.body
    });
    if (result?.catalog) {
      state.destinationCatalog.catalog = normalizeDestinationScopeCatalog(result.catalog);
      clearCatalogInput(form);
      setDestinationCatalogStatus(backendT("backend.tours.destination_catalog.saved", "Destination catalog saved."));
    }
  } finally {
    state.destinationCatalog.saving = false;
    renderDestinationCatalog();
  }
}

function renderDestinationCatalog() {
  if (!els.destinationCatalogContent) return;
  if (state.destinationCatalog.loading) {
    els.destinationCatalogContent.innerHTML = `<p class="micro tour-destination-catalog__empty">${escapeHtml(backendT("backend.tours.destination_catalog.loading", "Loading destinations..."))}</p>`;
    return;
  }

  const catalog = normalizeDestinationScopeCatalog(state.destinationCatalog.catalog);
  const canEdit = state.permissions.canEditTours && !state.destinationCatalog.saving;
  const areaByDestination = new Map();
  for (const area of catalog.areas) {
    const items = areaByDestination.get(area.destination) || [];
    items.push(area);
    areaByDestination.set(area.destination, items);
  }
  const placesByArea = new Map();
  for (const place of catalog.places) {
    const items = placesByArea.get(place.area_id) || [];
    items.push(place);
    placesByArea.set(place.area_id, items);
  }

  const destinationMarkup = catalog.destinations.map((destination) => {
    const areas = areaByDestination.get(destination.code) || [];
    return `
      <article class="tour-destination-catalog__destination">
        <h3>${escapeHtml(destination.label || destination.code)}</h3>
        ${areas.length
          ? areas.map((area) => renderDestinationCatalogArea(area, placesByArea.get(area.id) || [], canEdit)).join("")
          : `<p class="micro tour-destination-catalog__empty">${escapeHtml(backendT("backend.tours.destination_catalog.no_areas", "No areas yet."))}</p>`}
        ${canEdit ? renderDestinationCatalogAreaForm(destination) : ""}
      </article>
    `;
  }).join("");
  els.destinationCatalogContent.innerHTML = `
    ${renderDestinationCatalogWarnings(catalog)}
    ${canEdit ? renderDestinationCatalogDestinationForm(catalog.destinations) : ""}
    <div class="tour-destination-catalog__grid">
      ${destinationMarkup}
    </div>
  `;
}

function renderDestinationCatalogArea(area, places, canEdit) {
  return `
    <section class="tour-destination-catalog__area">
      <h4>${escapeHtml(area.label || area.code || area.id)}</h4>
      ${places.length
        ? `<ul class="tour-destination-catalog__places">${places.map((place) => `<li class="tour-destination-catalog__place">${escapeHtml(place.label || place.code || place.id)}</li>`).join("")}</ul>`
        : `<p class="micro tour-destination-catalog__empty">${escapeHtml(backendT("backend.tours.destination_catalog.no_places", "No places yet."))}</p>`}
      ${canEdit ? renderDestinationCatalogPlaceForm(area) : ""}
    </section>
  `;
}

function renderDestinationCatalogDestinationForm(destinations) {
  const existingCodes = new Set((Array.isArray(destinations) ? destinations : []).map((destination) => normalizeText(destination?.code)));
  const options = COUNTRY_CODE_OPTIONS
    .filter((option) => option?.value && !existingCodes.has(option.value))
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`);
  if (!options.length) {
    return `<p class="micro tour-destination-catalog__empty">${escapeHtml(backendT("backend.tours.destination_catalog.no_missing_destinations", "All destinations are already in the catalog."))}</p>`;
  }
  return `
    <form class="tour-destination-catalog__form tour-destination-catalog__form--destination" data-destination-create>
      <div class="field">
        <label>${escapeHtml(backendT("backend.tours.destination_catalog.destination_name", "Destination"))}</label>
        <select name="destination" required>${options.join("")}</select>
      </div>
      <button class="btn btn-ghost" type="submit">${escapeHtml(backendT("backend.tours.destination_catalog.add_destination", "Add destination"))}</button>
    </form>
  `;
}

function renderDestinationCatalogAreaForm(destination) {
  return `
    <form class="tour-destination-catalog__form" data-destination-area-create="${escapeHtml(destination.code)}">
      <div class="field">
        <label>${escapeHtml(backendT("backend.tours.destination_catalog.area_name", "New area"))}</label>
        <input name="name" type="text" autocomplete="off" required />
      </div>
      <button class="btn btn-ghost" type="submit">${escapeHtml(backendT("backend.tours.destination_catalog.add_area", "Add area"))}</button>
    </form>
  `;
}

function renderDestinationCatalogPlaceForm(area) {
  return `
    <form class="tour-destination-catalog__form" data-destination-place-create="${escapeHtml(area.id)}">
      <div class="field">
        <label>${escapeHtml(backendT("backend.tours.destination_catalog.place_name", "New place"))}</label>
        <input name="name" type="text" autocomplete="off" required />
      </div>
      <button class="btn btn-ghost" type="submit">${escapeHtml(backendT("backend.tours.destination_catalog.add_place", "Add place"))}</button>
    </form>
  `;
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
  const rows = items
    .map((tour) => {
      const countries = Array.isArray(tour.destinations) ? tour.destinations.join(", ") : "";
      const planSummary = formatTourPlanSummary(tour);
      const updatedAt = formatDateTime(tour.updated_at || tour.created_at);
      const href = buildTourEditHref(tour.id);
      const title = tour.title || "-";
      const tourImageMarkup = renderTourImageMarkup(tour);
      const rowAriaLabel = backendT("backend.tours.open_tour", "Open tour {name}", {
        name: title
      });
      const actionButton = canEditTours
        ? `<button class="btn btn-ghost offer-remove-btn" type="button" data-tour-delete="${escapeHtml(tour.id)}" data-tour-title="${escapeHtml(tour.title || "")}" title="${escapeHtml(backendT("backend.tours.delete", "Delete"))}" aria-label="${escapeHtml(backendT("backend.tours.delete", "Delete"))}" ${state.tours.deletingId === tour.id ? "disabled" : ""}>&times;</button>`
        : "";
      return `<tr class="tour-list__row tour-list__row--clickable" data-tour-href="${escapeHtml(href)}" tabindex="0" role="link" aria-label="${escapeHtml(rowAriaLabel)}">
        <td>
          <div class="booking-list__name-cell">
            <span class="booking-list__booking-thumb">${tourImageMarkup}</span>
            <div class="booking-list__name-copy">
              <div class="booking-list__booking-name">${escapeHtml(title)}</div>
              <div class="booking-list__representative">
                <span class="booking-list__representative-name">${escapeHtml(countries || "-")}</span>
              </div>
            </div>
          </div>
        </td>
        <td class="booking-list__meta-cell">
          <div class="booking-list__plan-summary">
            <div class="booking-list__plan-primary">${escapeHtml(planSummary.days)}</div>
            <div class="booking-list__plan-secondary">${escapeHtml(planSummary.services)}</div>
          </div>
        </td>
        <td class="tour-list__updated-cell" aria-label="${escapeHtml(backendT("backend.table.updated", "Updated"))}: ${escapeHtml(updatedAt)}">
          <div class="tour-list__updated-cell-content">
            <div class="tour-list__updated-summary">
              <div class="tour-list__updated-primary">${escapeHtml(updatedAt)}</div>
            </div>
            ${actionButton}
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="3">${escapeHtml(backendT("backend.tours.no_results", "No tours found"))}</td></tr>`;
  if (els.toursTable) els.toursTable.innerHTML = `<tbody>${body}</tbody>`;
}

function formatTourPlanSummary(tour) {
  const days = Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : [];
  const dayCount = days.length;
  const serviceCount = days.reduce((total, day) => total + (Array.isArray(day?.services) ? day.services.length : 0), 0);

  return {
    days: backendT(
      dayCount === 1 ? "booking.travel_plan.summary.day" : "booking.travel_plan.summary.days",
      dayCount === 1 ? "{count} day" : "{count} days",
      { count: formatIntegerWithGrouping(dayCount) }
    ),
    services: backendT(
      serviceCount === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items",
      serviceCount === 1 ? "{count} service" : "{count} services",
      { count: formatIntegerWithGrouping(serviceCount) }
    )
  };
}

function renderTourImageMarkup(tour) {
  const picture = Array.isArray(tour?.pictures) ? normalizeText(tour.pictures[0]) : "";
  const title = normalizeText(tour?.title);
  if (picture) {
    return `<img class="booking-list__booking-thumb-image" src="${escapeHtml(resolveApiUrl(apiBase, picture))}" alt="${escapeHtml(title || backendT("tour.picture_label", "Tour picture"))}" />`;
  }
  return `<span class="booking-list__booking-thumb-initials">${escapeHtml(getTourInitials(title))}</span>`;
}

function getTourInitials(value) {
  const parts = normalizeText(value).split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
  return initials || "T";
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
  let keepPageOverlayVisible = false;
  setToursPageOverlay(true, backendT("backend.tours.status.deleting_overlay", "Deleting tour. Please wait."));

  try {
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

    if (!result?.deleted) {
      renderTours(state.tours.lastItems);
      return;
    }

    clearError();
    setActionStatus(backendT("backend.tours.status.deleted", "Tour deleted."));
    keepPageOverlayVisible = true;
    window.location.reload();
  } finally {
    state.tours.deletingId = "";
    if (!keepPageOverlayVisible) {
      setToursPageOverlay(false);
      renderTours(state.tours.lastItems);
    }
  }
}
