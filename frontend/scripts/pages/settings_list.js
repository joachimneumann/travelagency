import {
  createApiFetcher,
  escapeHtml,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  keycloakUsersRequest,
  keycloakUserStaffProfileUpdateRequest,
  keycloakUserStaffProfileTranslateFieldsRequest,
  keycloakUserStaffProfilePictureUploadRequest,
  toursRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  enumOptionsFor
} from "../shared/generated_catalogs.js";
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
  staffTable: document.getElementById("staffTable"),
  staffEditorPanel: document.getElementById("staffEditorPanel"),
  staffEditorStatus: document.getElementById("staffEditorStatus"),
  staffEditorCloseBtn: document.getElementById("staffEditorCloseBtn"),
  staffEditorPhotoBtn: document.getElementById("staffEditorPhotoBtn"),
  staffEditorPhoto: document.getElementById("staffEditorPhoto"),
  staffEditorNameLine: document.getElementById("staffEditorNameLine"),
  staffEditorUsernameLine: document.getElementById("staffEditorUsernameLine"),
  staffEditorRolesLine: document.getElementById("staffEditorRolesLine"),
  staffEditorPhotoInput: document.getElementById("staffEditorPhotoInput"),
  staffEditorLanguages: document.getElementById("staffEditorLanguages"),
  staffEditorDestinations: document.getElementById("staffEditorDestinations"),
  staffEditorQualification: document.getElementById("staffEditorQualification"),
  staffEditorSaveBtn: document.getElementById("staffEditorSaveBtn")
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

const LANGUAGE_OPTIONS = Object.freeze(
  (window.ASIATRAVELPLAN_LANGUAGE_CATALOG?.languages || [])
    .map((entry) => ({
      value: normalizeText(entry?.code).toLowerCase(),
      label: normalizeText(entry?.nativeLabel) || normalizeText(entry?.apiValue) || normalizeText(entry?.code).toUpperCase()
    }))
    .filter((entry) => entry.value)
);

const QUALIFICATION_LANGUAGE_OPTIONS = Object.freeze(
  (window.ASIATRAVELPLAN_LANGUAGE_CATALOG?.languages || [])
    .filter((entry) => entry?.customerContentSupported)
    .map((entry) => ({
      value: normalizeText(entry?.code).toLowerCase(),
      label: normalizeText(entry?.shortLabel) || normalizeText(entry?.code).toUpperCase(),
      direction: normalizeText(entry?.direction).toLowerCase() === "rtl" ? "rtl" : "ltr"
    }))
    .filter((entry) => entry.value)
);

const LANGUAGE_LABEL_BY_VALUE = new Map(
  (LANGUAGE_OPTIONS.length ? LANGUAGE_OPTIONS : enumOptionsFor("LanguageCode"))
    .map((option) => [normalizeText(option?.value).toLowerCase(), normalizeText(option?.label) || normalizeText(option?.value).toUpperCase()])
);

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadSettings: false,
    canEditStaffProfiles: false
  },
  keycloakUsers: [],
  destinationOptions: [],
  selectedUsername: "",
  editor: {
    languages: [],
    destinations: [],
    qualificationByLang: {}
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

function showEditorStatus(message, isError = false) {
  if (!els.staffEditorStatus) return;
  els.staffEditorStatus.textContent = normalizeText(message);
  els.staffEditorStatus.classList.toggle("is-error", Boolean(isError));
}

function clearEditorStatus() {
  showEditorStatus("", false);
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
  bindEvents();

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
      canReadSettings: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT),
      canEditStaffProfiles: roles.includes(ROLES.ADMIN)
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
    canReadSettings: Boolean(authState.permissions?.canReadSettings),
    canEditStaffProfiles: Boolean(authState.permissions?.canEditStaffProfiles)
  };

  updateStatusCopy();
  if (state.permissions.canReadSettings) {
    await Promise.all([
      loadKeycloakUsers(),
      state.permissions.canEditStaffProfiles ? loadDestinationOptions() : Promise.resolve()
    ]);
  }
}

function bindEvents() {
  els.staffTable?.addEventListener("click", handleStaffTableClick);
  els.staffTable?.addEventListener("keydown", handleStaffTableKeydown);
  els.staffEditorCloseBtn?.addEventListener("click", closeEditor);
  els.staffEditorSaveBtn?.addEventListener("click", saveSelectedStaffProfile);
  els.staffEditorPhotoBtn?.addEventListener("click", () => els.staffEditorPhotoInput?.click());
  els.staffEditorPhotoInput?.addEventListener("change", handleStaffPhotoSelected);
  els.staffEditorLanguages?.addEventListener("change", handleLanguageToggle);
  els.staffEditorDestinations?.addEventListener("change", handleDestinationToggle);
  els.staffEditorQualification?.addEventListener("input", handleQualificationInput);
  els.staffEditorQualification?.addEventListener("click", (event) => {
    const translateAllButton = event.target.closest("[data-staff-translate-all]");
    if (translateAllButton) {
      event.preventDefault();
      void translateQualificationToAll(translateAllButton);
      return;
    }
    const translateButton = event.target.closest("[data-staff-translate-field]");
    if (!translateButton) return;
    event.preventDefault();
    void translateQualification(translateButton);
  });
}

function updateStatusCopy() {
  if (!els.staffStatus) return;
  els.staffStatus.textContent = state.permissions.canEditStaffProfiles
    ? backendT("backend.users.status_editable", "Users are managed in Keycloak. ATP guide profile details can be edited here.")
    : backendT("backend.users.status", "Users are managed in Keycloak.");
}

async function loadDestinationOptions() {
  try {
    const request = toursRequest({
      baseURL: apiOrigin,
      query: {
        page: 1,
        page_size: 1,
        lang: new URL(window.location.href).searchParams.get("lang") || document.documentElement.lang || "en"
      }
    });
    const payload = await fetchApi(request.url, { suppressNotFound: true });
    state.destinationOptions = Array.isArray(payload?.available_destinations) ? payload.available_destinations : [];
  } catch (error) {
    console.error("[backend-settings] Failed to load tour destinations for ATP staff profile editor.", {
      error,
      apiOrigin,
      user: state.authUser?.username || state.authUser?.sub || null
    });
    state.destinationOptions = [];
  }
  renderDestinationChecklist();
}

async function loadKeycloakUsers() {
  clearError();
  const payload = await fetchApi(keycloakUsersRequest({ baseURL: apiOrigin }).url);
  if (!payload) return;
  state.keycloakUsers = Array.isArray(payload.items) ? payload.items : [];
  if (payload.warning && els.staffStatus) {
    els.staffStatus.textContent = payload.warning;
  } else {
    updateStatusCopy();
  }
  renderStaff(state.keycloakUsers);
  renderEditor();
}

function renderStaff(items) {
  if (!els.staffTable) return;
  const header = `<thead><tr>
    <th>${escapeHtml(backendT("backend.users.photo", "Picture"))}</th>
    <th>${escapeHtml(backendT("backend.table.username", "Username"))}</th>
    <th>${escapeHtml(backendT("backend.users.profile", "ATP profile"))}</th>
    <th class="keycloak-roles-col">${escapeHtml(backendT("backend.table.roles", "Roles"))}</th>
    <th class="backend-table-align-right">${escapeHtml(backendT("backend.table.active", "Active"))}</th>
  </tr></thead>`;

  const rows = items
    .map((staff) => {
      const profile = staff?.staff_profile || {};
      const username = normalizeText(staff?.username);
      const photoRef = normalizeText(profile?.picture_ref);
      const languages = formatLanguageList(profile?.languages);
      const destinations = formatDestinationList(profile?.destinations);
      const isSelected = username && username === state.selectedUsername;
      const isClickable = Boolean(state.permissions.canEditStaffProfiles && username);
      const rowClasses = [
        isSelected ? "is-selected" : "",
        isClickable ? "settings-staff-table__row--clickable" : ""
      ].filter(Boolean).join(" ");
      return `<tr${rowClasses ? ` class="${rowClasses}"` : ""}${isClickable ? ` data-staff-edit="${escapeHtml(username)}" tabindex="0" role="button" aria-label="${escapeHtml(backendT("backend.users.edit_profile_for", "Edit staff details for {name}", { name: staff?.name || username || "ATP staff" }))}"` : ""}>
        <td class="settings-staff-table__photo-cell">${photoRef
          ? `<img class="settings-staff-table__photo" src="${escapeHtml(photoRef)}" alt="${escapeHtml(staff?.name || username || "ATP staff")}" />`
          : `<div class="settings-staff-table__photo settings-staff-table__photo--placeholder"></div>`}</td>
        <td class="settings-staff-table__username-cell">
          <div>${escapeHtml(username || "-")}</div>
          <div class="micro settings-staff-table__username-name">${escapeHtml(staff?.name || "-")}</div>
        </td>
        <td>
          <div class="settings-staff-table__profile-summary">
            <div>${escapeHtml(languages || backendT("backend.users.no_languages", "No languages set"))}</div>
            <div class="micro">${escapeHtml(destinations || backendT("backend.users.no_destinations", "No destinations set"))}</div>
          </div>
        </td>
        <td class="keycloak-roles-col">${formatKeycloakRolesCell(staff)}</td>
        <td class="backend-table-align-right">${staff.active ? escapeHtml(backendT("common.yes", "Yes")) : escapeHtml(backendT("common.no", "No"))}</td>
      </tr>`;
    })
    .join("");

  const colSpan = 5;
  els.staffTable.innerHTML = `${header}<tbody>${rows || `<tr><td colspan="${colSpan}">${escapeHtml(backendT("backend.users.no_results", "No Keycloak users found"))}</td></tr>`}</tbody>`;
}

function getSelectedUser() {
  return state.keycloakUsers.find((user) => normalizeText(user?.username) === state.selectedUsername) || null;
}

function cloneEditorProfile(user) {
  const profile = user?.staff_profile || {};
  const qualificationByLang = Object.fromEntries(
    (Array.isArray(profile?.qualification_i18n) ? profile.qualification_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(qualificationByLang).length && normalizeText(profile?.qualification)) {
    qualificationByLang.en = normalizeText(profile.qualification);
  }
  return {
    languages: Array.isArray(profile?.languages)
      ? profile.languages.map((code) => normalizeText(code).toLowerCase()).filter(Boolean)
      : [],
    destinations: Array.isArray(profile?.destinations)
      ? profile.destinations.map((code) => normalizeText(code).toUpperCase()).filter(Boolean)
      : [],
    qualificationByLang
  };
}

function openEditorForUsername(rawUsername) {
  const username = normalizeText(rawUsername);
  const user = state.keycloakUsers.find((entry) => normalizeText(entry?.username) === username);
  if (!user) return;
  state.selectedUsername = username;
  state.editor = cloneEditorProfile(user);
  clearEditorStatus();
  renderStaff(state.keycloakUsers);
  renderEditor();
}

function closeEditor() {
  if (els.staffEditorPanel) {
    els.staffEditorPanel.hidden = true;
  }
  state.selectedUsername = "";
  state.editor = {
    languages: [],
    destinations: [],
    qualificationByLang: {}
  };
  if (els.staffEditorPhotoInput) {
    els.staffEditorPhotoInput.value = "";
  }
  clearEditorStatus();
  renderStaff(state.keycloakUsers);
  renderEditor();
}

function renderEditor() {
  if (!els.staffEditorPanel) return;
  const canEdit = state.permissions.canEditStaffProfiles;
  const user = getSelectedUser();
  if (!canEdit || !user) {
    els.staffEditorPanel.hidden = true;
    return;
  }

  const profile = user?.staff_profile || {};
  els.staffEditorPanel.hidden = false;
  if (els.staffEditorPhoto) {
    els.staffEditorPhoto.src = normalizeText(profile?.picture_ref) || "assets/img/profile_person.png";
    els.staffEditorPhoto.alt = normalizeText(user?.name) || normalizeText(user?.username) || "ATP staff";
  }
  if (els.staffEditorPhotoBtn) {
    const label = normalizeText(user?.name) || normalizeText(user?.username) || backendT("backend.users.profile_heading", "ATP staff profile");
    els.staffEditorPhotoBtn.setAttribute("aria-label", backendT("backend.users.change_picture_for", "Change picture for {name}", { name: label }));
  }
  if (els.staffEditorNameLine) {
    els.staffEditorNameLine.textContent = `${backendT("backend.table.name", "Name")}: ${normalizeText(user?.name) || "-"}`;
  }
  if (els.staffEditorUsernameLine) {
    els.staffEditorUsernameLine.textContent = `${backendT("backend.table.username", "Username")}: ${normalizeText(user?.username) || "-"}`;
  }
  if (els.staffEditorRolesLine) {
    els.staffEditorRolesLine.textContent = `${backendT("backend.table.roles", "Roles")}: ${formatKeycloakRoleList(getDisplayedKeycloakRoles(user))}`;
  }

  renderLanguageChecklist();
  renderDestinationChecklist();
  renderQualificationEditor();
}

function renderLanguageChecklist() {
  if (!els.staffEditorLanguages) return;
  const current = new Set((Array.isArray(state.editor?.languages) ? state.editor.languages : []).map((code) => normalizeText(code).toLowerCase()));
  els.staffEditorLanguages.innerHTML = (LANGUAGE_OPTIONS.length ? LANGUAGE_OPTIONS : enumOptionsFor("LanguageCode"))
    .map((option) => {
      const value = normalizeText(option?.value).toLowerCase();
      const label = normalizeText(option?.label) || value.toUpperCase();
      return `<label class="settings-staff-editor__check-pill">
        <input type="checkbox" data-staff-language="${escapeHtml(value)}" ${current.has(value) ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>`;
    })
    .join("");
}

function renderDestinationChecklist() {
  if (!els.staffEditorDestinations) return;
  const current = new Set((Array.isArray(state.editor?.destinations) ? state.editor.destinations : []).map((code) => normalizeText(code).toUpperCase()));
  const options = (Array.isArray(state.destinationOptions) ? state.destinationOptions : [])
    .map((option) => ({
      value: normalizeText(option?.code || option?.value).toUpperCase(),
      label: normalizeText(option?.label) || normalizeText(option?.code || option?.value).toUpperCase()
    }))
    .filter((option) => option.value);
  if (!options.length) {
    els.staffEditorDestinations.innerHTML = `<p class="micro">${escapeHtml(backendT("backend.users.no_destinations_available", "No tour destinations available yet."))}</p>`;
    return;
  }
  els.staffEditorDestinations.innerHTML = options
    .map((option) => `<label class="settings-staff-editor__check-pill">
      <input type="checkbox" data-staff-destination="${escapeHtml(option.value)}" ${current.has(option.value) ? "checked" : ""} />
      <span>${escapeHtml(option.label)}</span>
    </label>`)
    .join("");
}

function renderQualificationEditor() {
  if (!els.staffEditorQualification) return;
  const options = QUALIFICATION_LANGUAGE_OPTIONS.length
    ? QUALIFICATION_LANGUAGE_OPTIONS
    : [{ value: "en", label: "EN", direction: "ltr" }];
  const current = state.editor?.qualificationByLang && typeof state.editor.qualificationByLang === "object"
    ? state.editor.qualificationByLang
    : {};
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === "en"
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="qualification">${escapeHtml(backendT("backend.users.translation.translate_all", "EN → ALL"))}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="qualification" data-target-lang="${escapeHtml(lang)}">EN → ${escapeHtml(option.label)}</button>`;
      return `<div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${buttonHtml}</div>
        <div class="tour-localized-group__field">
          <textarea id="${escapeHtml(qualificationTextareaId(lang))}" data-qualification-lang="${escapeHtml(lang)}" dir="${escapeHtml(option.direction)}" rows="4" spellcheck="true">${escapeHtml(normalizeText(current[lang]))}</textarea>
        </div>
      </div>`;
    })
    .join("");
  els.staffEditorQualification.innerHTML = `<div class="tour-localized-group tour-localized-group--multiline">${rows}</div>`;
}

function handleStaffTableClick(event) {
  const editButton = event.target.closest("[data-staff-edit]");
  if (!editButton) return;
  openEditorForUsername(editButton.getAttribute("data-staff-edit"));
}

function handleStaffTableKeydown(event) {
  const row = event.target.closest("[data-staff-edit]");
  if (!row) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openEditorForUsername(row.getAttribute("data-staff-edit"));
}

function handleQualificationInput(event) {
  const input = event.target.closest("[data-qualification-lang]");
  if (!input) return;
  const lang = normalizeText(input.getAttribute("data-qualification-lang")).toLowerCase();
  if (!lang) return;
  const nextValue = normalizeText(input.value);
  if (!state.editor.qualificationByLang || typeof state.editor.qualificationByLang !== "object") {
    state.editor.qualificationByLang = {};
  }
  if (nextValue) state.editor.qualificationByLang[lang] = nextValue;
  else delete state.editor.qualificationByLang[lang];
  clearEditorStatus();
}

function qualificationTextareaId(lang) {
  return `staff_qualification_${normalizeText(lang).toLowerCase()}`;
}

function getQualificationTextarea(lang) {
  return document.getElementById(qualificationTextareaId(lang));
}

function buildQualificationTranslationEntries(sourceText) {
  const value = normalizeText(sourceText);
  return value ? { value } : {};
}

function translatedQualificationValue(entries) {
  return normalizeText(entries?.value);
}

function setQualificationValue(lang, value) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  const normalizedValue = normalizeText(value);
  if (!state.editor.qualificationByLang || typeof state.editor.qualificationByLang !== "object") {
    state.editor.qualificationByLang = {};
  }
  if (normalizedValue) state.editor.qualificationByLang[normalizedLang] = normalizedValue;
  else delete state.editor.qualificationByLang[normalizedLang];
  const textarea = getQualificationTextarea(normalizedLang);
  if (textarea && textarea.value !== normalizedValue) {
    textarea.value = normalizedValue;
  }
}

async function requestQualificationTranslation(targetLang, sourceText) {
  const user = getSelectedUser();
  if (!user) return null;
  const entries = buildQualificationTranslationEntries(sourceText);
  if (!Object.keys(entries).length) return null;
  const request = keycloakUserStaffProfileTranslateFieldsRequest({
    baseURL: apiOrigin,
    params: { username: user.username },
    body: {
      source_lang: "en",
      target_lang: targetLang,
      entries: Object.entries(entries).map(([key, value]) => ({ key, value }))
    }
  });
  const payload = await fetchApi(request.url, {
    method: request.method,
    body: request.body
  });
  if (!Array.isArray(payload?.entries)) return null;
  return Object.fromEntries(
    payload.entries
      .map((entry) => [normalizeText(entry?.key), normalizeText(entry?.value)])
      .filter(([key, value]) => Boolean(key && value))
  );
}

async function translateQualification(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const englishInput = getQualificationTextarea("en");
  const targetInput = getQualificationTextarea(targetLang);
  if (!targetLang || !englishInput || !targetInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildQualificationTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.translation.missing_source", "Add English qualification first."), true);
    return;
  }

  setQualificationValue(targetLang, "");
  showEditorStatus(backendT("backend.users.translation.translating", "Translating qualification..."));
  const translatedEntries = await requestQualificationTranslation(targetLang, englishSource);
  if (!translatedEntries) {
    showEditorStatus(backendT("backend.users.translation.error", "Could not translate the qualification."), true);
    return;
  }

  setQualificationValue(targetLang, translatedQualificationValue(translatedEntries));
  showEditorStatus(backendT("backend.users.translation.done", "Qualification translated."));
}

async function translateQualificationToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "qualification") return;
  const englishInput = getQualificationTextarea("en");
  if (!englishInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildQualificationTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.translation.missing_source", "Add English qualification first."), true);
    return;
  }

  const targets = QUALIFICATION_LANGUAGE_OPTIONS
    .map((option) => normalizeText(option?.value).toLowerCase())
    .filter((lang) => lang && lang !== "en");
  if (!targets.length) return;

  for (const targetLang of targets) {
    setQualificationValue(targetLang, "");
  }
  showEditorStatus(backendT("backend.users.translation.translating_all", "Translating all qualification languages..."));

  for (const targetLang of targets) {
    const translatedEntries = await requestQualificationTranslation(targetLang, englishSource);
    if (!translatedEntries) {
      showEditorStatus(backendT("backend.users.translation.error", "Could not translate the qualification."), true);
      return;
    }
    setQualificationValue(targetLang, translatedQualificationValue(translatedEntries));
  }

  showEditorStatus(backendT("backend.users.translation.all_done", "All qualification translations updated."));
}

function handleDestinationToggle(event) {
  const input = event.target.closest("[data-staff-destination]");
  if (!input) return;
  const set = new Set(Array.isArray(state.editor.destinations) ? state.editor.destinations : []);
  const value = normalizeText(input.getAttribute("data-staff-destination")).toUpperCase();
  if (input.checked) set.add(value);
  else set.delete(value);
  state.editor.destinations = Array.from(set);
  clearEditorStatus();
}

function handleLanguageToggle(event) {
  const input = event.target.closest("[data-staff-language]");
  if (!input) return;
  const value = normalizeText(input.getAttribute("data-staff-language")).toLowerCase();
  const current = new Set(Array.isArray(state.editor.languages) ? state.editor.languages : []);
  if (input.checked) current.add(value);
  else current.delete(value);
  state.editor.languages = Array.from(current);
  clearEditorStatus();
}

function normalizeQualificationEntriesForSave() {
  const source = state.editor?.qualificationByLang && typeof state.editor.qualificationByLang === "object"
    ? state.editor.qualificationByLang
    : {};
  return Object.entries(source)
    .map(([lang, value]) => ({
      lang: normalizeText(lang).toLowerCase(),
      value: normalizeText(value)
    }))
    .filter((entry) => Boolean(entry.lang && entry.value))
    .sort((left, right) => left.lang.localeCompare(right.lang));
}

async function saveSelectedStaffProfile() {
  const user = getSelectedUser();
  if (!user || !state.permissions.canEditStaffProfiles) return;

  const languages = Array.from(new Set((Array.isArray(state.editor?.languages) ? state.editor.languages : []).map((code) => normalizeText(code).toLowerCase()).filter(Boolean)));
  if (!languages.length) {
    showEditorStatus(backendT("backend.users.languages_required", "Select at least one language."), true);
    return;
  }
  const destinations = Array.from(new Set((Array.isArray(state.editor?.destinations) ? state.editor.destinations : []).map((code) => normalizeText(code).toUpperCase()).filter(Boolean)));

  const qualificationI18n = normalizeQualificationEntriesForSave();

  clearError();
  clearEditorStatus();
  const request = keycloakUserStaffProfileUpdateRequest({
    baseURL: apiOrigin,
    params: { username: user.username }
  });
  const payload = await fetchApi(request.url, {
    method: request.method,
    body: {
      languages,
      destinations,
      qualification_i18n: qualificationI18n
    }
  });
  if (!payload?.user) return;
  applyUpdatedUser(payload.user);
  showEditorStatus(backendT("backend.users.profile_saved", "ATP staff profile saved."));
}

async function handleStaffPhotoSelected(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const user = getSelectedUser();
  if (!user || !state.permissions.canEditStaffProfiles) return;

  const base64 = await fileToBase64(file);
  if (!base64) {
    showEditorStatus(backendT("backend.users.picture_invalid", "Could not read picture file."), true);
    return;
  }

  clearError();
  clearEditorStatus();
  const request = keycloakUserStaffProfilePictureUploadRequest({
    baseURL: apiOrigin,
    params: { username: user.username }
  });
  const payload = await fetchApi(request.url, {
    method: request.method,
    body: {
      filename: file.name || `${user.username}.upload`,
      mime_type: file.type || "image/*",
      data_base64: base64
    }
  });
  if (els.staffEditorPhotoInput) {
    els.staffEditorPhotoInput.value = "";
  }
  if (!payload?.user) return;
  applyUpdatedUser(payload.user);
  showEditorStatus(backendT("backend.users.picture_uploaded", "Picture updated."));
}

function applyUpdatedUser(updatedUser) {
  const username = normalizeText(updatedUser?.username);
  if (!username) return;
  state.keycloakUsers = state.keycloakUsers.map((user) => (normalizeText(user?.username) === username ? updatedUser : user));
  const currentUser = getSelectedUser();
  if (currentUser) {
    state.editor = cloneEditorProfile(currentUser);
  }
  renderStaff(state.keycloakUsers);
  renderEditor();
}

function formatLanguageList(codes) {
  const items = (Array.isArray(codes) ? codes : [])
    .map((code) => LANGUAGE_LABEL_BY_VALUE.get(normalizeText(code).toLowerCase()) || normalizeText(code).toUpperCase())
    .filter(Boolean);
  return items.join(", ");
}

function formatDestinationList(codes) {
  const items = (Array.isArray(codes) ? codes : [])
    .map((code) => normalizeText(code).toUpperCase())
    .filter(Boolean);
  return items.join(", ");
}

function formatKeycloakRoleList(roles) {
  const items = (Array.isArray(roles) ? roles : [])
    .map((role) => normalizeText(role))
    .filter(Boolean);
  return items.length ? items.join(", ") : "-";
}

function getDisplayedKeycloakRoles(user) {
  return Array.from(new Set([
    ...(Array.isArray(user?.realm_roles) ? user.realm_roles : []),
    ...(Array.isArray(user?.client_roles) ? user.client_roles : [])
  ]
    .map((role) => normalizeText(role))
    .filter((role) => role
      && !/^default-roles-/i.test(role)
      && !/^offline_access$/i.test(role)
      && !/^uma_authorization$/i.test(role))));
}

function formatKeycloakRolesCell(user) {
  return escapeHtml(formatKeycloakRoleList(getDisplayedKeycloakRoles(user)));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : "");
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  }).catch(() => "");
}
