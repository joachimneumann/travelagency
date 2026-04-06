import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  COUNTRY_CODE_OPTIONS
} from "../shared/generated_catalogs.js";
import { buildBookingHref } from "../shared/links.js";
import { renderPagination } from "../shared/pagination.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  withBackendApiLang
} from "../shared/backend_page.js";

const TEMPLATE_STATUSES = Object.freeze(["draft", "published", "archived"]);
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
  status: document.getElementById("standardTravelPlansStatus"),
  destination: document.getElementById("standardTravelPlansDestination"),
  searchBtn: document.getElementById("standardTravelPlansSearchBtn"),
  clearFiltersBtn: document.getElementById("standardTravelPlansClearFiltersBtn"),
  createBtn: document.getElementById("standardTravelPlansCreateBtn"),
  countInfo: document.getElementById("standardTravelPlansCountInfo"),
  actionStatus: document.getElementById("standardTravelPlansActionStatus"),
  table: document.getElementById("standardTravelPlansTable"),
  pagination: document.getElementById("standardTravelPlansPagination"),
  modal: document.getElementById("travelPlanTemplateModal"),
  modalTitle: document.getElementById("travelPlanTemplateModalTitle"),
  modalStatus: document.getElementById("travelPlanTemplateModalStatus"),
  modalCloseBtn: document.getElementById("travelPlanTemplateModalCloseBtn"),
  modalCancelBtn: document.getElementById("travelPlanTemplateCancelBtn"),
  modalSubmitBtn: document.getElementById("travelPlanTemplateSubmitBtn"),
  form: document.getElementById("travelPlanTemplateForm"),
  titleInput: document.getElementById("travelPlanTemplateTitleInput"),
  descriptionInput: document.getElementById("travelPlanTemplateDescriptionInput"),
  formStatusInput: document.getElementById("travelPlanTemplateStatusInput"),
  formDestinationsInput: document.getElementById("travelPlanTemplateDestinationsInput"),
  selectedBooking: document.getElementById("travelPlanTemplateSelectedBooking"),
  bookingSearchInput: document.getElementById("travelPlanTemplateBookingSearchInput"),
  bookingSearchBtn: document.getElementById("travelPlanTemplateBookingSearchBtn"),
  bookingResults: document.getElementById("travelPlanTemplateBookingResults")
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
    status: "all",
    destination: "all",
    loadToken: 0
  },
  modal: {
    open: false,
    saving: false,
    editingId: "",
    originalSourceBookingId: "",
    selectedSourceBookingId: "",
    selectedSourceBookingName: "",
    bookingResults: [],
    bookingSearchQuery: "",
    bookingSearching: false
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

function setModalStatus(message = "") {
  if (!els.modalStatus) return;
  els.modalStatus.textContent = message;
}

function selectedValues(select) {
  if (select instanceof HTMLSelectElement) {
    return Array.from(select.selectedOptions).map((option) => normalizeText(option.value)).filter(Boolean);
  }
  if (!(select instanceof HTMLElement)) return [];
  return Array.from(select.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => normalizeText(input instanceof HTMLInputElement ? input.value : ""))
    .filter(Boolean);
}

function setSelectValues(select, values) {
  const selected = new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)));
  if (select instanceof HTMLSelectElement) {
    Array.from(select.options).forEach((option) => {
      option.selected = selected.has(normalizeText(option.value));
    });
    return;
  }
  if (!(select instanceof HTMLElement)) return;
  Array.from(select.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
    if (input instanceof HTMLInputElement) {
      input.checked = selected.has(normalizeText(input.value));
    }
  });
}

function renderCheckboxOption(kind, value, label = value) {
  const safeValue = escapeHtml(value);
  const safeLabel = escapeHtml(label);
  const inputId = `${kind}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `
    <label class="filter-checkbox-option" for="${escapeHtml(inputId)}">
      <input id="${escapeHtml(inputId)}" type="checkbox" value="${safeValue}" />
      <span>${safeLabel}</span>
    </label>
  `;
}

function renderStatusSelectOptions() {
  const optionsHtml = TEMPLATE_STATUSES.map((value) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(backendT(`backend.standard_travel_plans.status.${value}`, value))}</option>`
  )).join("");

  if (els.status instanceof HTMLSelectElement) {
    els.status.innerHTML = `
      <option value="all">${escapeHtml(backendT("backend.standard_travel_plans.all_statuses", "All statuses"))}</option>
      ${optionsHtml}
    `;
    els.status.value = state.list.status;
  }

  if (els.formStatusInput instanceof HTMLSelectElement) {
    els.formStatusInput.innerHTML = optionsHtml;
    els.formStatusInput.value = "draft";
  }
}

function renderCatalogOptions() {
  if (els.destination instanceof HTMLSelectElement) {
    els.destination.innerHTML = `
      <option value="all">${escapeHtml(backendT("backend.standard_travel_plans.all_destinations", "All destinations"))}</option>
      ${DESTINATION_COUNTRY_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`).join("")}
    `;
    els.destination.value = state.list.destination;
  }
  if (els.formDestinationsInput instanceof HTMLSelectElement) {
    els.formDestinationsInput.innerHTML = DESTINATION_COUNTRY_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`)
      .join("");
  } else if (els.formDestinationsInput instanceof HTMLElement) {
    els.formDestinationsInput.innerHTML = DESTINATION_COUNTRY_OPTIONS
      .map((option) => renderCheckboxOption("travelPlanTemplateDestination", option.value, option.label || option.value))
      .join("");
  }
}

function renderSelectedSourceBooking() {
  if (!(els.selectedBooking instanceof HTMLElement)) return;
  const bookingId = normalizeText(state.modal.selectedSourceBookingId);
  const bookingName = normalizeText(state.modal.selectedSourceBookingName);
  if (!bookingId) {
    els.selectedBooking.hidden = true;
    els.selectedBooking.innerHTML = "";
    return;
  }
  els.selectedBooking.hidden = false;
  els.selectedBooking.innerHTML = `
    <strong>${escapeHtml(backendT("backend.standard_travel_plans.form.selected_source_booking", "Selected source booking"))}</strong><br />
    ${escapeHtml(bookingName || bookingId)}
    <div class="micro">${escapeHtml(bookingId)}</div>
  `;
}

function renderBookingSearchResults() {
  if (!(els.bookingResults instanceof HTMLElement)) return;
  const rows = Array.isArray(state.modal.bookingResults) ? state.modal.bookingResults : [];
  if (!rows.length) {
    els.bookingResults.innerHTML = "";
    return;
  }
  els.bookingResults.innerHTML = rows.map((booking) => `
    <div class="travel-plan-template-modal__booking-result">
      <div class="travel-plan-template-modal__booking-meta">
        <div class="travel-plan-template-modal__booking-title">${escapeHtml(booking.name || booking.id || "")}</div>
        <div class="micro">${escapeHtml(booking.id || "")}</div>
      </div>
      <button
        class="btn btn-ghost"
        type="button"
        data-template-source-booking="${escapeHtml(booking.id || "")}"
        data-template-source-booking-name="${escapeHtml(booking.name || booking.id || "")}"
      >${escapeHtml(backendT("backend.standard_travel_plans.form.use_booking", "Use booking"))}</button>
    </div>
  `).join("");
}

function setModalBusyState(isBusy) {
  state.modal.saving = Boolean(isBusy);
  [
    els.modalCloseBtn,
    els.modalCancelBtn,
    els.modalSubmitBtn,
    els.titleInput,
    els.descriptionInput,
    els.formStatusInput,
    els.formDestinationsInput,
    els.bookingSearchInput,
    els.bookingSearchBtn
  ].forEach((element) => {
    if (element) element.disabled = Boolean(isBusy);
  });
  [els.formDestinationsInput].forEach((container) => {
    if (!(container instanceof HTMLElement)) return;
    Array.from(container.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
      if (input instanceof HTMLInputElement) input.disabled = Boolean(isBusy);
    });
  });
}

function resetModalState() {
  state.modal.open = false;
  state.modal.saving = false;
  state.modal.editingId = "";
  state.modal.originalSourceBookingId = "";
  state.modal.selectedSourceBookingId = "";
  state.modal.selectedSourceBookingName = "";
  state.modal.bookingResults = [];
  state.modal.bookingSearchQuery = "";
  state.modal.bookingSearching = false;
  if (els.form) els.form.reset();
  if (els.formStatusInput instanceof HTMLSelectElement) els.formStatusInput.value = "draft";
  setSelectValues(els.formDestinationsInput, []);
  if (els.bookingSearchInput) els.bookingSearchInput.value = "";
  setModalStatus("");
  renderSelectedSourceBooking();
  renderBookingSearchResults();
  setModalBusyState(false);
}

function openTemplateModal(template = null) {
  if (!state.permissions.canEditTemplates || !(els.modal instanceof HTMLElement)) return;
  resetModalState();
  state.modal.open = true;
  state.modal.editingId = normalizeText(template?.id);
  state.modal.originalSourceBookingId = normalizeText(template?.source_booking_id);
  state.modal.selectedSourceBookingId = normalizeText(template?.source_booking_id);
  state.modal.selectedSourceBookingName = normalizeText(template?.source_booking_name || template?.source_booking_id);
  if (els.modalTitle) {
    els.modalTitle.textContent = state.modal.editingId
      ? backendT("backend.standard_travel_plans.modal_title_edit", "Edit standard travel plan")
      : backendT("backend.standard_travel_plans.modal_title_create", "Create standard travel plan");
  }
  if (els.titleInput) els.titleInput.value = normalizeText(template?.title);
  if (els.descriptionInput) els.descriptionInput.value = normalizeText(template?.description);
  if (els.formStatusInput instanceof HTMLSelectElement) {
    els.formStatusInput.value = normalizeText(template?.status) || "draft";
  }
  setSelectValues(els.formDestinationsInput, template?.travel_plan?.destinations || []);
  renderSelectedSourceBooking();
  els.modal.hidden = false;
  window.setTimeout(() => {
    els.titleInput?.focus?.();
  }, 0);
}

function closeTemplateModal() {
  if (!(els.modal instanceof HTMLElement) || state.modal.saving) return;
  els.modal.hidden = true;
  resetModalState();
  els.createBtn?.focus?.();
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

  renderStatusSelectOptions();
  renderCatalogOptions();
  bindControls();
  if (els.createBtn) els.createBtn.hidden = !state.permissions.canEditTemplates;

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

  els.status?.addEventListener("change", () => {
    state.list.page = 1;
    state.list.status = normalizeText(els.status?.value) || "all";
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
    state.list.status = "all";
    state.list.destination = "all";
    if (els.search) els.search.value = "";
    if (els.status) els.status.value = "all";
    if (els.destination) els.destination.value = "all";
    void loadTemplates();
  });
  els.createBtn?.addEventListener("click", () => openTemplateModal());

  els.table?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button) return;
    const editId = normalizeText(button.getAttribute("data-template-edit"));
    if (editId) {
      const template = findListTemplate(editId);
      if (template) openTemplateModal(template);
      return;
    }
    const deleteId = normalizeText(button.getAttribute("data-template-delete"));
    if (deleteId) {
      void deleteTemplate(deleteId);
    }
  });

  els.modalCloseBtn?.addEventListener("click", closeTemplateModal);
  els.modalCancelBtn?.addEventListener("click", closeTemplateModal);
  els.modalSubmitBtn?.addEventListener("click", () => void saveTemplate());
  els.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveTemplate();
  });
  els.modal?.addEventListener("click", (event) => {
    if (event.target === els.modal) closeTemplateModal();
  });
  els.modal?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeTemplateModal();
  });
  els.bookingSearchBtn?.addEventListener("click", () => void searchSourceBookings());
  els.bookingSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void searchSourceBookings();
  });
  els.bookingResults?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button[data-template-source-booking]") : null;
    if (!button) return;
    state.modal.selectedSourceBookingId = normalizeText(button.getAttribute("data-template-source-booking"));
    state.modal.selectedSourceBookingName = normalizeText(button.getAttribute("data-template-source-booking-name"));
    renderSelectedSourceBooking();
    if (els.titleInput instanceof HTMLInputElement && !normalizeText(els.titleInput.value)) {
      els.titleInput.value = state.modal.selectedSourceBookingName;
    }
  });
}

async function loadTemplates() {
  clearError();
  const loadToken = ++state.list.loadToken;
  setActionStatus(backendT("backend.standard_travel_plans.loading", "Loading..."));
  const params = new URLSearchParams();
  if (state.list.search) params.set("q", state.list.search);
  if (state.list.status !== "all") params.set("status", state.list.status);
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
          <th>${escapeHtml(backendT("backend.standard_travel_plans.form.status", "Status"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.form.source_booking", "Source booking"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.day_count", "Days"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.service_count", "Services"))}</th>
          <th>${escapeHtml(backendT("backend.standard_travel_plans.updated_at", "Updated"))}</th>
          <th>${escapeHtml(backendT("common.actions", "Actions"))}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td colspan="7">${escapeHtml(backendT("backend.standard_travel_plans.empty", "No standard travel plans found."))}</td></tr>
      </tbody>
    `;
    return;
  }
  els.table.innerHTML = `
    <thead>
      <tr>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.form.title", "Title"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.form.status", "Status"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.form.source_booking", "Source booking"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.day_count", "Days"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.service_count", "Services"))}</th>
        <th>${escapeHtml(backendT("backend.standard_travel_plans.updated_at", "Updated"))}</th>
        <th>${escapeHtml(backendT("common.actions", "Actions"))}</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((template) => `
        <tr>
          <td>
            <strong>${escapeHtml(template.title || "")}</strong>
            ${template.description ? `<div class="micro">${escapeHtml(template.description)}</div>` : ""}
          </td>
          <td>${escapeHtml(backendT(`backend.standard_travel_plans.status.${normalizeText(template.status) || "draft"}`, template.status || "draft"))}</td>
          <td>
            ${template.source_booking_id
              ? `<a href="${escapeHtml(buildBookingHref(template.source_booking_id))}">${escapeHtml(template.source_booking_name || template.source_booking_id)}</a>`
              : "-"}
          </td>
          <td>${escapeHtml(String(template.day_count ?? "-"))}</td>
          <td>${escapeHtml(String(template.service_count ?? "-"))}</td>
          <td>${escapeHtml(formatDateTime(template.updated_at || template.created_at || ""))}</td>
          <td>
            <div class="backend-table__actions">
              <button class="btn btn-ghost" type="button" data-template-edit="${escapeHtml(template.id || "")}">${escapeHtml(backendT("common.edit", "Edit"))}</button>
              <button class="btn btn-ghost" type="button" data-template-delete="${escapeHtml(template.id || "")}">${escapeHtml(backendT("common.delete", "Delete"))}</button>
            </div>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;
}

async function searchSourceBookings() {
  if (state.modal.bookingSearching) return;
  const query = normalizeText(els.bookingSearchInput?.value);
  state.modal.bookingSearchQuery = query;
  if (!query) {
    state.modal.bookingResults = [];
    renderBookingSearchResults();
    return;
  }
  state.modal.bookingSearching = true;
  setModalStatus(backendT("backend.standard_travel_plans.searching_bookings", "Searching bookings..."));
  const params = new URLSearchParams({
    search: query,
    page: "1",
    page_size: "8"
  });
  const payload = await fetchApi(withBackendApiLang(`/api/v1/bookings?${params.toString()}`));
  state.modal.bookingSearching = false;
  if (!payload) return;
  state.modal.bookingResults = Array.isArray(payload.items) ? payload.items : [];
  renderBookingSearchResults();
  setModalStatus(
    state.modal.bookingResults.length
      ? backendT("backend.standard_travel_plans.bookings_found", "{count} booking(s) found.", { count: state.modal.bookingResults.length })
      : backendT("backend.standard_travel_plans.no_bookings_found", "No matching bookings found.")
  );
}

async function saveTemplate() {
  if (state.modal.saving) return;
  clearError();
  const title = normalizeText(els.titleInput?.value);
  if (!title) {
    setModalStatus(backendT("backend.standard_travel_plans.validation.title_required", "Title is required."));
    els.titleInput?.focus?.();
    return;
  }
  if (!state.modal.editingId && !normalizeText(state.modal.selectedSourceBookingId)) {
    setModalStatus(backendT("backend.standard_travel_plans.validation.source_booking_required", "Please select a source booking."));
    els.bookingSearchInput?.focus?.();
    return;
  }

  const sourceBookingId = normalizeText(state.modal.selectedSourceBookingId);
  const shouldRefreshFromSource = Boolean(sourceBookingId)
    && (!state.modal.editingId || sourceBookingId !== state.modal.originalSourceBookingId);
  const body = {
    title,
    description: normalizeText(els.descriptionInput?.value) || null,
    status: normalizeText(els.formStatusInput?.value) || "draft",
    destinations: selectedValues(els.formDestinationsInput),
    ...(shouldRefreshFromSource || !state.modal.editingId ? { source_booking_id: sourceBookingId } : {})
  };
  const isEditing = Boolean(state.modal.editingId);

  setModalBusyState(true);
  setModalStatus(backendT("backend.standard_travel_plans.saving", "Saving..."));
  const pathname = state.modal.editingId
    ? `/api/v1/travel-plan-templates/${encodeURIComponent(state.modal.editingId)}`
    : "/api/v1/travel-plan-templates";
  const payload = await fetchApi(withBackendApiLang(pathname), {
    method: state.modal.editingId ? "PATCH" : "POST",
    body
  });
  setModalBusyState(false);
  if (!payload?.template) return;
  closeTemplateModal();
  setActionStatus(
    isEditing
      ? backendT("backend.standard_travel_plans.updated", "Standard travel plan updated.")
      : backendT("backend.standard_travel_plans.created", "Standard travel plan created.")
  );
  await loadTemplates();
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
