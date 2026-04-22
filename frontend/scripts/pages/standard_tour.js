import {
  standardTourDetailRequest,
  standardTourUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  createApiFetcher,
  escapeHtml,
  normalizeText,
  setDirtySurface
} from "../shared/api.js";
import { createSnapshotDirtyTracker } from "../shared/edit_state.js";
import { createBookingStyleDirtyBarController } from "../shared/booking_style_dirty_bar.js";
import {
  COUNTRY_CODE_OPTIONS
} from "../shared/generated_catalogs.js";
import { createStandardTourEditor } from "../shared/standard_tour_editor.js";
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
const qs = new URLSearchParams(window.location.search);

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  heading: document.getElementById("standardTourHeading"),
  subtitle: document.getElementById("standardTourSubtitle"),
  error: document.getElementById("standardTourError"),
  form: document.getElementById("standardTourForm"),
  backBtn: document.getElementById("backToBackend"),
  dirtyBar: document.getElementById("booking_dirty_bar"),
  dirtyBarTitle: document.getElementById("booking_dirty_bar_title"),
  dirtyBarSummary: document.getElementById("booking_dirty_bar_summary"),
  discardEditsBtn: document.getElementById("booking_discard_edits_btn"),
  saveEditsBtn: document.getElementById("booking_save_edits_btn"),
  saveErrorHint: document.getElementById("booking_save_error_hint"),
  titleInput: document.getElementById("standardTourTitleInput"),
  destinationsInput: document.getElementById("standardTourDestinationsInput"),
  travel_plan_panel: document.getElementById("travel_plan_panel"),
  travel_plan_panel_summary: document.getElementById("travel_plan_panel_summary"),
  travel_plan_editor: document.getElementById("travel_plan_editor"),
  travel_plan_status: document.getElementById("travel_plan_status")
};

const state = {
  id: normalizeText(qs.get("id")),
  authUser: null,
  roles: [],
  permissions: {
    canReadTemplates: false,
    canEditTemplates: false,
    canEditBooking: false
  },
  template: null,
  booking: null,
  travelPlanDraft: null,
  originalTravelPlanState: null,
  originalTravelPlanSnapshot: "",
  travelPlanDirty: false,
  travelPlanSaving: false,
  travelPlanCollapsedServiceIds: new Set(),
  travelPlanCollapsedDayIds: new Set(),
  user: "keycloak_user",
  saving: false,
  pageDirtyBarStatus: "",
  pageSaveActionError: "",
  pageIsDirty: false
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

function selectedDestinationValues() {
  if (!(els.destinationsInput instanceof HTMLElement)) return [];
  return Array.from(els.destinationsInput.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => normalizeText(input instanceof HTMLInputElement ? input.value : ""))
    .filter(Boolean);
}

function setSelectedDestinationValues(values) {
  const selected = new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)));
  if (!(els.destinationsInput instanceof HTMLElement)) return;
  Array.from(els.destinationsInput.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
    if (input instanceof HTMLInputElement) {
      input.checked = selected.has(normalizeText(input.value));
    }
  });
}

function renderDestinationChoices() {
  if (!(els.destinationsInput instanceof HTMLElement)) return;
  els.destinationsInput.innerHTML = DESTINATION_COUNTRY_OPTIONS.map((option) => {
    const value = escapeHtml(option.value);
    const label = escapeHtml(option.label || option.value);
    const inputId = `standard_tour_destination_${String(option.value || "").toLowerCase()}`;
    return `
      <label class="filter-checkbox-option" for="${escapeHtml(inputId)}">
        <input id="${escapeHtml(inputId)}" type="checkbox" value="${value}" />
        <span>${label}</span>
      </label>
    `;
  }).join("");
}

function captureFormSnapshot() {
  return JSON.stringify({
    title: normalizeText(els.titleInput?.value),
    destinations: selectedDestinationValues().sort(),
    travel_plan: state.travelPlanDraft || null
  });
}

const pageDirtyTracker = createSnapshotDirtyTracker({
  captureSnapshot: captureFormSnapshot,
  isEnabled: () => state.permissions.canEditTemplates,
  onDirtyChange: (isDirty) => {
    state.pageIsDirty = Boolean(isDirty);
    setDirtySurface(els.form, isDirty);
    updatePageDirtyBar();
  }
});

function markSnapshotClean() {
  pageDirtyTracker.markClean();
}

function refreshDirtyState() {
  pageDirtyTracker.refresh();
}

function sameStringList(left, right) {
  const a = (Array.isArray(left) ? left : []).map((value) => normalizeText(value)).filter(Boolean).sort();
  const b = (Array.isArray(right) ? right : []).map((value) => normalizeText(value)).filter(Boolean).sort();
  return JSON.stringify(a) === JSON.stringify(b);
}

function dirtySectionLabels() {
  const labels = [];
  if (normalizeText(els.titleInput?.value) !== normalizeText(state.template?.title)) {
    labels.push(backendT("backend.standard_tours.form.title", "Title"));
  }
  if (!sameStringList(selectedDestinationValues(), state.template?.destinations || [])) {
    labels.push(backendT("backend.standard_tours.form.destinations", "Destinations"));
  }
  if (state.travelPlanDirty) {
    labels.push(backendT("booking.travel_plan", "Travel plan"));
  }
  return labels;
}

function updatePageDirtyBar() {
  dirtyBarController.render();
}

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API."),
  suppressNotFound: false,
  includeDetailInError: false
});

const dirtyBarController = createBookingStyleDirtyBarController({
  els,
  backendT,
  readState: () => ({
    saving: state.saving,
    discarding: false,
    status: state.pageDirtyBarStatus,
    error: state.pageSaveActionError
  }),
  getDirtySectionLabels: dirtySectionLabels,
  onSave: () => {
    void saveTemplate();
  },
  onDiscard: () => {
    discardEdits();
  },
  onBack: () => {
    window.location.href = withBackendLang("/standard-tours.html");
  }
});

const travelPlanEditor = createStandardTourEditor({
  state,
  els,
  apiOrigin,
  fetchApi,
  onDirtyChange: () => {
    refreshDirtyState();
  }
});

init();

async function init() {
  if (!state.id) {
    showError(backendT("backend.standard_tours.missing_id", "Missing standard tour id."));
    return;
  }

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
      canReadTemplates: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR),
      canEditTemplates: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR)
    }),
    hasPageAccess: (permissions) => permissions.canReadTemplates,
    logKey: "backend-standard-tour",
    pageName: "standard-tour.html",
    expectedRolesAnyOf: [ROLES.TOUR_EDITOR],
    likelyCause: "The user is authenticated in Keycloak but does not have the atp_tour_editor role required to access standard tours."
  });

  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadTemplates: Boolean(authState.permissions?.canReadTemplates),
    canEditTemplates: Boolean(authState.permissions?.canEditTemplates),
    canEditBooking: Boolean(authState.permissions?.canEditTemplates)
  };
  state.user = normalizeText(state.authUser?.id || state.authUser?.sub || state.authUser?.username) || "keycloak_user";

  renderDestinationChoices();
  bindControls();
  dirtyBarController.bind();
  travelPlanEditor.bind();

  if (!state.permissions.canReadTemplates) {
    showError(backendT("backend.standard_tours.forbidden", "You do not have access to standard tours."));
    return;
  }

  await loadTemplate();
}

function bindControls() {
  els.form?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveTemplate();
  });
  els.titleInput?.addEventListener("input", () => {
    state.pageDirtyBarStatus = "";
    state.pageSaveActionError = "";
    refreshDirtyState();
  });
  els.destinationsInput?.addEventListener("change", () => {
    state.pageDirtyBarStatus = "";
    state.pageSaveActionError = "";
    refreshDirtyState();
  });
}

async function loadTemplate() {
  clearError();
  state.pageDirtyBarStatus = "";
  state.pageSaveActionError = "";
  updatePageDirtyBar();
  const request = standardTourDetailRequest({
    baseURL: apiOrigin,
    params: { standard_tour_id: state.id }
  });
  const payload = await fetchApi(withBackendApiLang(request.url), {
    method: request.method
  });
  if (!payload?.standard_tour) {
    return;
  }
  applyTemplate(payload.standard_tour);
}

function applyTemplate(template) {
  state.template = template;
  state.booking = {
    id: normalizeText(template?.id),
    travel_plan: template?.travel_plan || { days: [], attachments: [] },
    translation_enabled: false,
    travel_plan_translation_status: {}
  };
  if (els.heading) {
    els.heading.textContent = normalizeText(template?.title) || backendT("backend.standard_tours.detail_heading", "Standard tour");
  }
  if (els.subtitle) {
    const destinations = Array.isArray(template?.destinations) ? template.destinations : [];
    els.subtitle.textContent = destinations.length
      ? destinations.join(" · ")
      : backendT("backend.standard_tours.detail_subtitle", "Edit title, destinations, and travel plan.");
  }
  if (els.titleInput) {
    els.titleInput.value = normalizeText(template?.title);
  }
  setSelectedDestinationValues(template?.destinations || []);
  travelPlanEditor.applyTemplate(template);
  state.pageDirtyBarStatus = "";
  state.pageSaveActionError = "";
  markSnapshotClean();
  updatePageDirtyBar();
}

function discardEdits() {
  if (!state.template || state.saving) return;
  applyTemplate(state.template);
  state.pageDirtyBarStatus = "discarded";
  state.pageSaveActionError = "";
  updatePageDirtyBar();
}

async function saveTemplate() {
  if (state.saving || !state.permissions.canEditTemplates || !state.id) return;
  clearError();
  state.pageSaveActionError = "";
  const title = normalizeText(els.titleInput?.value);
  if (!title) {
    state.pageSaveActionError = backendT("backend.standard_tours.validation.title_required", "Title is required.");
    updatePageDirtyBar();
    els.titleInput?.focus?.();
    return;
  }

  const travelPlanResult = travelPlanEditor.collectPayload({ focusFirstInvalid: true });
  if (!travelPlanResult.ok) {
    state.pageSaveActionError = travelPlanResult.error || backendT("backend.standard_tours.validation.travel_plan_invalid", "Travel plan is invalid.");
    updatePageDirtyBar();
    return;
  }

  state.saving = true;
  state.pageDirtyBarStatus = "";
  updatePageDirtyBar();

  const request = standardTourUpdateRequest({
    baseURL: apiOrigin,
    params: { standard_tour_id: state.id },
    body: {
      title,
      destinations: selectedDestinationValues(),
      travel_plan: travelPlanResult.payload
    }
  });
  const payload = await fetchApi(withBackendApiLang(request.url), {
    method: request.method,
    body: request.body
  });

  state.saving = false;
  updatePageDirtyBar();
  if (!payload?.standard_tour) return;
  applyTemplate(payload.standard_tour);
  state.pageDirtyBarStatus = "saved";
  state.pageSaveActionError = "";
  updatePageDirtyBar();
}
