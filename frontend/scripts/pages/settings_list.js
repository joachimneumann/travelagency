import {
  createApiFetcher,
  escapeHtml,
  normalizeText
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  keycloakUserStaffProfileUpdateRequest,
  keycloakUserStaffProfileTranslateFieldsRequest,
  keycloakUserStaffProfilePictureUploadRequest,
  toursRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  enumOptionsFor
} from "../shared/generated_catalogs.js";
import {
  CUSTOMER_CONTENT_LANGUAGES,
  normalizeLanguageCode as normalizeCatalogLanguageCode
} from "../../../shared/generated/language_catalog.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState
} from "../shared/backend_page.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();
const STAFF_DIRECTORY_API_URL = `${apiOrigin}/api/v1/staff-profiles`;

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
  staffEditorFullName: document.getElementById("staffEditorFullName"),
  staffEditorPosition: document.getElementById("staffEditorPosition"),
  staffEditorFriendlyShortName: document.getElementById("staffEditorFriendlyShortName"),
  staffEditorAppearsInTeamWebPage: document.getElementById("staffEditorAppearsInTeamWebPage"),
  staffEditorLanguages: document.getElementById("staffEditorLanguages"),
  staffEditorDestinations: document.getElementById("staffEditorDestinations"),
  staffEditorQualification: document.getElementById("staffEditorQualification"),
  staffEditorDescription: document.getElementById("staffEditorDescription"),
  staffEditorMobileDescription: document.getElementById("staffEditorMobileDescription"),
  staffEditorSaveBtn: document.getElementById("staffEditorSaveBtn")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  STAFF: GENERATED_ROLE_LOOKUP.STAFF,
  MANAGER: GENERATED_ROLE_LOOKUP.MANAGER,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT
});

const LANGUAGE_OPTIONS = Object.freeze(
  (Array.isArray(window.ASIATRAVELPLAN_LANGUAGE_CATALOG?.languages)
    && window.ASIATRAVELPLAN_LANGUAGE_CATALOG.languages.length
    ? window.ASIATRAVELPLAN_LANGUAGE_CATALOG.languages
    : CUSTOMER_CONTENT_LANGUAGES)
    .map((entry) => ({
      value: normalizeCatalogLanguageCode(entry?.code, { fallback: "" }),
      label: normalizeText(entry?.nativeLabel) || normalizeText(entry?.apiValue) || normalizeText(entry?.code).toUpperCase()
    }))
    .filter((entry) => entry.value)
);

const QUALIFICATION_LANGUAGE_OPTIONS = Object.freeze(
  (Array.isArray(window.ASIATRAVELPLAN_LANGUAGE_CATALOG?.languages)
    && window.ASIATRAVELPLAN_LANGUAGE_CATALOG.languages.length
    ? window.ASIATRAVELPLAN_LANGUAGE_CATALOG.languages
    : CUSTOMER_CONTENT_LANGUAGES)
    .filter((entry) => entry?.customerContentSupported)
    .map((entry) => ({
      value: normalizeCatalogLanguageCode(entry?.code, { fallback: "" }),
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
  staffProfilesByUsername: {},
  destinationOptions: [],
  selectedUsername: "",
  editorSaving: false,
  editor: {
    fullName: "",
    friendlyShortName: "",
    appearsInTeamWebPage: true,
    languages: [],
    destinations: [],
    positionByLang: {},
    qualificationByLang: {},
    descriptionByLang: {},
    mobileDescriptionByLang: {},
    pendingPhoto: null
  }
};

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
}

function collectKeycloakRoleNames(user) {
  return [
    ...(Array.isArray(user?.realm_roles) ? user.realm_roles : []),
    ...(Array.isArray(user?.client_roles) ? user.client_roles : [])
  ].map((role) => normalizeText(role)).filter(Boolean);
}

function isEligibleAtpStaffUser(user) {
  const roles = collectKeycloakRoleNames(user);
  return roles.includes(ROLES.ADMIN) || roles.includes(ROLES.STAFF);
}

function resolveStaffPhotoUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/public/")) return `${apiOrigin}${normalized}`;
  return normalized;
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
      loadStaffDirectoryEntries(),
      state.permissions.canEditStaffProfiles ? loadDestinationOptions() : Promise.resolve()
    ]);
  } else {
    showError(backendT("backend.settings.forbidden", "You do not have access to reports and settings."));
  }
}

function bindEvents() {
  els.staffTable?.addEventListener("click", handleStaffTableClick);
  els.staffTable?.addEventListener("keydown", handleStaffTableKeydown);
  els.staffEditorCloseBtn?.addEventListener("click", closeEditor);
  els.staffEditorSaveBtn?.addEventListener("click", saveSelectedStaffProfile);
  els.staffEditorPhotoBtn?.addEventListener("click", () => els.staffEditorPhotoInput?.click());
  els.staffEditorPhotoInput?.addEventListener("change", handleStaffPhotoSelected);
  els.staffEditorFullName?.addEventListener("input", handleFullNameInput);
  els.staffEditorPosition?.addEventListener("input", handlePositionInput);
  els.staffEditorPosition?.addEventListener("click", (event) => {
    const translateAllButton = event.target.closest("[data-staff-translate-all]");
    if (translateAllButton) {
      event.preventDefault();
      void translatePositionToAll(translateAllButton);
      return;
    }
    const translateButton = event.target.closest("[data-staff-translate-field]");
    if (!translateButton) return;
    event.preventDefault();
    void translatePosition(translateButton);
  });
  els.staffEditorFriendlyShortName?.addEventListener("input", handleFriendlyShortNameInput);
  els.staffEditorAppearsInTeamWebPage?.addEventListener("change", handleAppearsInTeamWebPageChange);
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
  els.staffEditorDescription?.addEventListener("input", handleDescriptionInput);
  els.staffEditorDescription?.addEventListener("click", (event) => {
    const translateAllButton = event.target.closest("[data-staff-translate-all]");
    if (translateAllButton) {
      event.preventDefault();
      void translateDescriptionToAll(translateAllButton);
      return;
    }
    const translateButton = event.target.closest("[data-staff-translate-field]");
    if (!translateButton) return;
    event.preventDefault();
    void translateDescription(translateButton);
  });
  els.staffEditorMobileDescription?.addEventListener("input", handleMobileDescriptionInput);
  els.staffEditorMobileDescription?.addEventListener("click", (event) => {
    const translateAllButton = event.target.closest("[data-staff-translate-all]");
    if (translateAllButton) {
      event.preventDefault();
      void translateMobileDescriptionToAll(translateAllButton);
      return;
    }
    const translateButton = event.target.closest("[data-staff-translate-field]");
    if (!translateButton) return;
    event.preventDefault();
    void translateMobileDescription(translateButton);
  });
}

function updateStatusCopy() {
  if (!els.staffStatus) return;
  els.staffStatus.textContent = state.permissions.canEditStaffProfiles
    ? backendT("backend.users.status_editable", "Users are managed in Keycloak. ATP guide profile details can be edited here.")
    : backendT("backend.users.status", "Users are managed in Keycloak.");
}

function localizedEntriesFromProfileValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => ({
        lang: normalizeText(entry?.lang).toLowerCase(),
        value: normalizeText(entry?.value)
      }))
      .filter((entry) => Boolean(entry.lang && entry.value));
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([lang, text]) => ({
        lang: normalizeText(lang).toLowerCase(),
        value: normalizeText(text)
      }))
      .filter((entry) => Boolean(entry.lang && entry.value));
  }
  const normalized = normalizeText(value);
  return normalized ? [{ lang: "en", value: normalized }] : [];
}

function englishTextFromLocalizedEntries(entries) {
  const normalizedEntries = localizedEntriesFromProfileValue(entries);
  return normalizeText(
    normalizedEntries.find((entry) => entry.lang === "en")?.value
    || normalizedEntries[0]?.value
  );
}

function getStaffProfileForUsername(rawUsername) {
  const username = normalizeText(rawUsername).toLowerCase();
  return username ? state.staffProfilesByUsername[username] || null : null;
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

async function loadStaffDirectoryEntries() {
  clearError();
  const payload = await fetchApi(STAFF_DIRECTORY_API_URL);
  if (!payload) return;
  const items = (Array.isArray(payload.items) ? payload.items : []).filter((user) => isEligibleAtpStaffUser(user));
  state.keycloakUsers = items.map((user) => ({
    id: normalizeText(user?.id),
    username: normalizeText(user?.username),
    name: normalizeText(user?.name),
    active: user?.active !== false,
    realm_roles: Array.isArray(user?.realm_roles) ? user.realm_roles : [],
    client_roles: Array.isArray(user?.client_roles) ? user.client_roles : []
  }));
  state.staffProfilesByUsername = Object.fromEntries(
    items
      .map((user) => [normalizeText(user?.username).toLowerCase(), user?.staff_profile && typeof user.staff_profile === "object"
        ? { ...user.staff_profile, picture_ref: resolveStaffPhotoUrl(user.staff_profile.picture_ref) }
        : null])
      .filter(([username, profile]) => Boolean(username && profile))
  );
  updateStatusCopy();
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
      const username = normalizeText(staff?.username);
      const profile = getStaffProfileForUsername(username) || {};
      const photoRef = resolveStaffPhotoUrl(profile?.picture_ref);
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
  const profile = getStaffProfileForUsername(user?.username) || {};
  const positionByLang = Object.fromEntries(
    (Array.isArray(profile?.position_i18n) ? profile.position_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(positionByLang).length && normalizeText(profile?.position)) {
    positionByLang.en = normalizeText(profile.position);
  }
  const qualificationByLang = Object.fromEntries(
    (Array.isArray(profile?.qualification_i18n) ? profile.qualification_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(qualificationByLang).length && normalizeText(profile?.qualification)) {
    qualificationByLang.en = normalizeText(profile.qualification);
  }
  const descriptionByLang = Object.fromEntries(
    (Array.isArray(profile?.description_i18n) ? profile.description_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(descriptionByLang).length && normalizeText(profile?.description)) {
    descriptionByLang.en = normalizeText(profile.description);
  }
  const mobileDescriptionByLang = Object.fromEntries(
    (Array.isArray(profile?.mobile_description_i18n) ? profile.mobile_description_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(mobileDescriptionByLang).length && normalizeText(profile?.mobile_description)) {
    mobileDescriptionByLang.en = normalizeText(profile.mobile_description);
  }
  return {
    fullName: normalizeText(profile?.full_name),
    friendlyShortName: normalizeText(profile?.friendly_short_name),
    appearsInTeamWebPage: profile?.appears_in_team_web_page !== false,
    languages: Array.isArray(profile?.languages)
      ? profile.languages.map((code) => normalizeText(code).toLowerCase()).filter(Boolean)
      : [],
    destinations: Array.isArray(profile?.destinations)
      ? profile.destinations.map((code) => normalizeText(code).toUpperCase()).filter(Boolean)
      : [],
    positionByLang,
    qualificationByLang,
    descriptionByLang,
    mobileDescriptionByLang,
    pendingPhoto: null
  };
}

function normalizeEditorProfile(profile) {
  const positionByLang = Object.fromEntries(
    Object.entries(profile?.positionByLang && typeof profile.positionByLang === "object" ? profile.positionByLang : {})
      .map(([lang, value]) => [normalizeText(lang).toLowerCase(), normalizeText(value)])
      .filter(([lang, value]) => Boolean(lang && value))
      .sort(([leftLang], [rightLang]) => leftLang.localeCompare(rightLang))
  );
  const qualificationByLang = Object.fromEntries(
    Object.entries(profile?.qualificationByLang && typeof profile.qualificationByLang === "object" ? profile.qualificationByLang : {})
      .map(([lang, value]) => [normalizeText(lang).toLowerCase(), normalizeText(value)])
      .filter(([lang, value]) => Boolean(lang && value))
      .sort(([leftLang], [rightLang]) => leftLang.localeCompare(rightLang))
  );
  const descriptionByLang = Object.fromEntries(
    Object.entries(profile?.descriptionByLang && typeof profile.descriptionByLang === "object" ? profile.descriptionByLang : {})
      .map(([lang, value]) => [normalizeText(lang).toLowerCase(), normalizeText(value)])
      .filter(([lang, value]) => Boolean(lang && value))
      .sort(([leftLang], [rightLang]) => leftLang.localeCompare(rightLang))
  );
  const mobileDescriptionByLang = Object.fromEntries(
    Object.entries(profile?.mobileDescriptionByLang && typeof profile.mobileDescriptionByLang === "object" ? profile.mobileDescriptionByLang : {})
      .map(([lang, value]) => [normalizeText(lang).toLowerCase(), normalizeText(value)])
      .filter(([lang, value]) => Boolean(lang && value))
      .sort(([leftLang], [rightLang]) => leftLang.localeCompare(rightLang))
  );
  return {
    fullName: normalizeText(profile?.fullName),
    friendlyShortName: normalizeText(profile?.friendlyShortName),
    appearsInTeamWebPage: profile?.appearsInTeamWebPage !== false,
    languages: Array.from(new Set((Array.isArray(profile?.languages) ? profile.languages : []).map((code) => normalizeText(code).toLowerCase()).filter(Boolean))).sort(),
    destinations: Array.from(new Set((Array.isArray(profile?.destinations) ? profile.destinations : []).map((code) => normalizeText(code).toUpperCase()).filter(Boolean))).sort(),
    positionByLang,
    qualificationByLang,
    descriptionByLang,
    mobileDescriptionByLang
  };
}

function isEditorDirty() {
  const user = getSelectedUser();
  if (!state.permissions.canEditStaffProfiles || !user) return false;
  return editorHasPendingPhoto()
    || JSON.stringify(normalizeEditorProfile(state.editor)) !== JSON.stringify(normalizeEditorProfile(cloneEditorProfile(user)));
}

function editorHasPendingPhoto() {
  return Boolean(normalizeText(state.editor?.pendingPhoto?.dataBase64));
}

function updateEditorSaveButtonState() {
  if (!els.staffEditorSaveBtn) return;
  els.staffEditorSaveBtn.disabled = !state.permissions.canEditStaffProfiles
    || !getSelectedUser()
    || !isEditorDirty()
    || state.editorSaving;
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
    fullName: "",
    friendlyShortName: "",
    appearsInTeamWebPage: true,
    languages: [],
    destinations: [],
    positionByLang: {},
    qualificationByLang: {},
    descriptionByLang: {},
    mobileDescriptionByLang: {},
    pendingPhoto: null
  };
  state.editorSaving = false;
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
    updateEditorSaveButtonState();
    return;
  }

  const profile = getStaffProfileForUsername(user?.username) || {};
  els.staffEditorPanel.hidden = false;
  if (els.staffEditorPhoto) {
    els.staffEditorPhoto.src = normalizeText(state.editor?.pendingPhoto?.previewSrc)
      || resolveStaffPhotoUrl(profile?.picture_ref)
      || "assets/img/profile_person.png";
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
  if (els.staffEditorFullName) {
    els.staffEditorFullName.value = normalizeText(state.editor?.fullName);
  }
  if (els.staffEditorFriendlyShortName) {
    els.staffEditorFriendlyShortName.value = normalizeText(state.editor?.friendlyShortName);
  }
  if (els.staffEditorAppearsInTeamWebPage) {
    els.staffEditorAppearsInTeamWebPage.checked = state.editor?.appearsInTeamWebPage !== false;
  }

  renderLanguageChecklist();
  renderDestinationChecklist();
  renderPositionEditor();
  renderQualificationEditor();
  renderDescriptionEditor();
  renderMobileDescriptionEditor();
  updateEditorSaveButtonState();
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

function renderPositionEditor() {
  if (!els.staffEditorPosition) return;
  const options = QUALIFICATION_LANGUAGE_OPTIONS.length
    ? QUALIFICATION_LANGUAGE_OPTIONS
    : [{ value: "en", label: "EN", direction: "ltr" }];
  const current = state.editor?.positionByLang && typeof state.editor.positionByLang === "object"
    ? state.editor.positionByLang
    : {};
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === "en"
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="position">${escapeHtml(backendT("backend.users.translation.translate_all", "EN → ALL"))}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="position" data-target-lang="${escapeHtml(lang)}">EN → ${escapeHtml(option.label)}</button>`;
      return `<div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${buttonHtml}</div>
        <div class="tour-localized-group__field">
          <input id="${escapeHtml(positionInputId(lang))}" data-position-lang="${escapeHtml(lang)}" dir="${escapeHtml(option.direction)}" type="text" autocomplete="organization-title" value="${escapeHtml(normalizeText(current[lang]))}" />
        </div>
      </div>`;
    })
    .join("");
  els.staffEditorPosition.innerHTML = `<div class="tour-localized-group">${rows}</div>`;
}

function renderDescriptionEditor() {
  if (!els.staffEditorDescription) return;
  const options = QUALIFICATION_LANGUAGE_OPTIONS.length
    ? QUALIFICATION_LANGUAGE_OPTIONS
    : [{ value: "en", label: "EN", direction: "ltr" }];
  const current = state.editor?.descriptionByLang && typeof state.editor.descriptionByLang === "object"
    ? state.editor.descriptionByLang
    : {};
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === "en"
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="description">${escapeHtml(backendT("backend.users.translation.translate_all", "EN → ALL"))}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="description" data-target-lang="${escapeHtml(lang)}">EN → ${escapeHtml(option.label)}</button>`;
      return `<div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${buttonHtml}</div>
        <div class="tour-localized-group__field">
          <textarea id="${escapeHtml(descriptionTextareaId(lang))}" data-description-lang="${escapeHtml(lang)}" dir="${escapeHtml(option.direction)}" rows="4" spellcheck="true">${escapeHtml(normalizeText(current[lang]))}</textarea>
        </div>
      </div>`;
    })
    .join("");
  els.staffEditorDescription.innerHTML = `<div class="tour-localized-group tour-localized-group--multiline">${rows}</div>`;
}

function renderMobileDescriptionEditor() {
  if (!els.staffEditorMobileDescription) return;
  const options = QUALIFICATION_LANGUAGE_OPTIONS.length
    ? QUALIFICATION_LANGUAGE_OPTIONS
    : [{ value: "en", label: "EN", direction: "ltr" }];
  const current = state.editor?.mobileDescriptionByLang && typeof state.editor.mobileDescriptionByLang === "object"
    ? state.editor.mobileDescriptionByLang
    : {};
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === "en"
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="mobile-description">${escapeHtml(backendT("backend.users.translation.translate_all", "EN → ALL"))}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="mobile-description" data-target-lang="${escapeHtml(lang)}">EN → ${escapeHtml(option.label)}</button>`;
      return `<div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${buttonHtml}</div>
        <div class="tour-localized-group__field">
          <textarea id="${escapeHtml(mobileDescriptionTextareaId(lang))}" data-mobile-description-lang="${escapeHtml(lang)}" dir="${escapeHtml(option.direction)}" rows="4" spellcheck="true">${escapeHtml(normalizeText(current[lang]))}</textarea>
        </div>
      </div>`;
    })
    .join("");
  els.staffEditorMobileDescription.innerHTML = `<div class="tour-localized-group tour-localized-group--multiline">${rows}</div>`;
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
  updateEditorSaveButtonState();
}

function handleDescriptionInput(event) {
  const input = event.target.closest("[data-description-lang]");
  if (!input) return;
  const lang = normalizeText(input.getAttribute("data-description-lang")).toLowerCase();
  if (!lang) return;
  const nextValue = normalizeText(input.value);
  if (!state.editor.descriptionByLang || typeof state.editor.descriptionByLang !== "object") {
    state.editor.descriptionByLang = {};
  }
  if (nextValue) state.editor.descriptionByLang[lang] = nextValue;
  else delete state.editor.descriptionByLang[lang];
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function handleMobileDescriptionInput(event) {
  const input = event.target.closest("[data-mobile-description-lang]");
  if (!input) return;
  const lang = normalizeText(input.getAttribute("data-mobile-description-lang")).toLowerCase();
  if (!lang) return;
  const nextValue = normalizeText(input.value);
  if (!state.editor.mobileDescriptionByLang || typeof state.editor.mobileDescriptionByLang !== "object") {
    state.editor.mobileDescriptionByLang = {};
  }
  if (nextValue) state.editor.mobileDescriptionByLang[lang] = nextValue;
  else delete state.editor.mobileDescriptionByLang[lang];
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function handleFullNameInput(event) {
  state.editor.fullName = normalizeText(event.target?.value);
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function handlePositionInput(event) {
  const input = event.target.closest("[data-position-lang]");
  if (!input) return;
  const lang = normalizeText(input.getAttribute("data-position-lang")).toLowerCase();
  if (!lang) return;
  const nextValue = normalizeText(input.value);
  if (!state.editor.positionByLang || typeof state.editor.positionByLang !== "object") {
    state.editor.positionByLang = {};
  }
  if (nextValue) state.editor.positionByLang[lang] = nextValue;
  else delete state.editor.positionByLang[lang];
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function handleFriendlyShortNameInput(event) {
  state.editor.friendlyShortName = normalizeText(event.target?.value);
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function handleAppearsInTeamWebPageChange(event) {
  state.editor.appearsInTeamWebPage = event.target?.checked !== false;
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function qualificationTextareaId(lang) {
  return `staff_qualification_${normalizeText(lang).toLowerCase()}`;
}

function getQualificationTextarea(lang) {
  return document.getElementById(qualificationTextareaId(lang));
}

function descriptionTextareaId(lang) {
  return `staff_description_${normalizeText(lang).toLowerCase()}`;
}

function getDescriptionTextarea(lang) {
  return document.getElementById(descriptionTextareaId(lang));
}

function mobileDescriptionTextareaId(lang) {
  return `staff_mobile_description_${normalizeText(lang).toLowerCase()}`;
}

function getMobileDescriptionTextarea(lang) {
  return document.getElementById(mobileDescriptionTextareaId(lang));
}

function positionInputId(lang) {
  return `staff_position_${normalizeText(lang).toLowerCase()}`;
}

function getPositionInput(lang) {
  return document.getElementById(positionInputId(lang));
}

function buildPositionTranslationEntries(sourceText) {
  const value = normalizeText(sourceText);
  return value ? { value } : {};
}

function translatedPositionValue(entries) {
  return normalizeText(entries?.value);
}

function setPositionValue(lang, value) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  const normalizedValue = normalizeText(value);
  if (!state.editor.positionByLang || typeof state.editor.positionByLang !== "object") {
    state.editor.positionByLang = {};
  }
  if (normalizedValue) state.editor.positionByLang[normalizedLang] = normalizedValue;
  else delete state.editor.positionByLang[normalizedLang];
  const input = getPositionInput(normalizedLang);
  if (input && input.value !== normalizedValue) {
    input.value = normalizedValue;
  }
  updateEditorSaveButtonState();
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
  updateEditorSaveButtonState();
}

function buildDescriptionTranslationEntries(sourceText) {
  return buildMultilineTranslationEntries(sourceText);
}

function translatedDescriptionValue(entries, sourceText) {
  return mergeMultilineTranslatedValue(entries, sourceText);
}

function setDescriptionValue(lang, value) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  const normalizedValue = normalizeText(value);
  if (!state.editor.descriptionByLang || typeof state.editor.descriptionByLang !== "object") {
    state.editor.descriptionByLang = {};
  }
  if (normalizedValue) state.editor.descriptionByLang[normalizedLang] = normalizedValue;
  else delete state.editor.descriptionByLang[normalizedLang];
  const textarea = getDescriptionTextarea(normalizedLang);
  if (textarea && textarea.value !== normalizedValue) {
    textarea.value = normalizedValue;
  }
  updateEditorSaveButtonState();
}

function buildMobileDescriptionTranslationEntries(sourceText) {
  return buildMultilineTranslationEntries(sourceText);
}

function translatedMobileDescriptionValue(entries, sourceText) {
  return mergeMultilineTranslatedValue(entries, sourceText);
}

function buildMultilineTranslationEntries(sourceText) {
  const lines = String(sourceText || "").replace(/\r\n?/g, "\n").split("\n");
  return Object.fromEntries(
    lines
      .map((line, index) => [`line_${index}`, normalizeText(line)])
      .filter(([, value]) => Boolean(value))
  );
}

function mergeMultilineTranslatedValue(entries, sourceText) {
  const translatedEntries = entries && typeof entries === "object" ? entries : {};
  const sourceLines = String(sourceText || "").replace(/\r\n?/g, "\n").split("\n");
  return sourceLines
    .map((line, index) => {
      if (!normalizeText(line)) return "";
      return normalizeText(translatedEntries[`line_${index}`]) || normalizeText(line);
    })
    .join("\n")
    .trim();
}

function setMobileDescriptionValue(lang, value) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  const normalizedValue = normalizeText(value);
  if (!state.editor.mobileDescriptionByLang || typeof state.editor.mobileDescriptionByLang !== "object") {
    state.editor.mobileDescriptionByLang = {};
  }
  if (normalizedValue) state.editor.mobileDescriptionByLang[normalizedLang] = normalizedValue;
  else delete state.editor.mobileDescriptionByLang[normalizedLang];
  const textarea = getMobileDescriptionTextarea(normalizedLang);
  if (textarea && textarea.value !== normalizedValue) {
    textarea.value = normalizedValue;
  }
  updateEditorSaveButtonState();
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

async function requestPositionTranslation(targetLang, sourceText) {
  const user = getSelectedUser();
  if (!user) return null;
  const entries = buildPositionTranslationEntries(sourceText);
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

async function requestDescriptionTranslation(targetLang, sourceText) {
  const user = getSelectedUser();
  if (!user) return null;
  const entries = buildDescriptionTranslationEntries(sourceText);
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

async function requestMobileDescriptionTranslation(targetLang, sourceText) {
  const user = getSelectedUser();
  if (!user) return null;
  const entries = buildMobileDescriptionTranslationEntries(sourceText);
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

async function translatePosition(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const englishInput = getPositionInput("en");
  const targetInput = getPositionInput(targetLang);
  if (!targetLang || !englishInput || !targetInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildPositionTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.position_translation.missing_source", "Add English position first."), true);
    return;
  }

  setPositionValue(targetLang, "");
  showEditorStatus(backendT("backend.users.position_translation.translating", "Translating position..."));
  const translatedEntries = await requestPositionTranslation(targetLang, englishSource);
  if (!translatedEntries) {
    showEditorStatus(backendT("backend.users.position_translation.error", "Could not translate the position."), true);
    return;
  }

  setPositionValue(targetLang, translatedPositionValue(translatedEntries));
  showEditorStatus(backendT("backend.users.position_translation.done", "Position translated."));
}

async function translatePositionToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "position") return;
  const englishInput = getPositionInput("en");
  if (!englishInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildPositionTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.position_translation.missing_source", "Add English position first."), true);
    return;
  }

  const targets = QUALIFICATION_LANGUAGE_OPTIONS
    .map((option) => normalizeText(option?.value).toLowerCase())
    .filter((lang) => lang && lang !== "en");
  if (!targets.length) return;

  for (const targetLang of targets) {
    setPositionValue(targetLang, "");
  }
  showEditorStatus(backendT("backend.users.position_translation.translating_all", "Translating all position languages..."));

  for (const targetLang of targets) {
    const translatedEntries = await requestPositionTranslation(targetLang, englishSource);
    if (!translatedEntries) {
      showEditorStatus(backendT("backend.users.position_translation.error", "Could not translate the position."), true);
      return;
    }
    setPositionValue(targetLang, translatedPositionValue(translatedEntries));
  }

  showEditorStatus(backendT("backend.users.position_translation.all_done", "All position translations updated."));
}

async function translateDescription(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const englishInput = getDescriptionTextarea("en");
  const targetInput = getDescriptionTextarea(targetLang);
  if (!targetLang || !englishInput || !targetInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildDescriptionTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.description_translation.missing_source", "Add English description first."), true);
    return;
  }

  setDescriptionValue(targetLang, "");
  showEditorStatus(backendT("backend.users.description_translation.translating", "Translating description..."));
  const translatedEntries = await requestDescriptionTranslation(targetLang, englishSource);
  if (!translatedEntries) {
    showEditorStatus(backendT("backend.users.description_translation.error", "Could not translate the description."), true);
    return;
  }

  setDescriptionValue(targetLang, translatedDescriptionValue(translatedEntries, englishSource));
  showEditorStatus(backendT("backend.users.description_translation.done", "Description translated."));
}

async function translateDescriptionToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "description") return;
  const englishInput = getDescriptionTextarea("en");
  if (!englishInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildDescriptionTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.description_translation.missing_source", "Add English description first."), true);
    return;
  }

  const targets = QUALIFICATION_LANGUAGE_OPTIONS
    .map((option) => normalizeText(option?.value).toLowerCase())
    .filter((lang) => lang && lang !== "en");
  if (!targets.length) return;

  for (const targetLang of targets) {
    setDescriptionValue(targetLang, "");
  }
  showEditorStatus(backendT("backend.users.description_translation.translating_all", "Translating all description languages..."));

  for (const targetLang of targets) {
    const translatedEntries = await requestDescriptionTranslation(targetLang, englishSource);
    if (!translatedEntries) {
      showEditorStatus(backendT("backend.users.description_translation.error", "Could not translate the description."), true);
      return;
    }
    setDescriptionValue(targetLang, translatedDescriptionValue(translatedEntries, englishSource));
  }

  showEditorStatus(backendT("backend.users.description_translation.all_done", "All description translations updated."));
}

async function translateMobileDescription(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const englishInput = getMobileDescriptionTextarea("en");
  const targetInput = getMobileDescriptionTextarea(targetLang);
  if (!targetLang || !englishInput || !targetInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildMobileDescriptionTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.mobile_description_translation.missing_source", "Add English mobile description first."), true);
    return;
  }

  setMobileDescriptionValue(targetLang, "");
  showEditorStatus(backendT("backend.users.mobile_description_translation.translating", "Translating mobile description..."));
  const translatedEntries = await requestMobileDescriptionTranslation(targetLang, englishSource);
  if (!translatedEntries) {
    showEditorStatus(backendT("backend.users.mobile_description_translation.error", "Could not translate the mobile description."), true);
    return;
  }

  setMobileDescriptionValue(targetLang, translatedMobileDescriptionValue(translatedEntries, englishSource));
  showEditorStatus(backendT("backend.users.mobile_description_translation.done", "Mobile description translated."));
}

async function translateMobileDescriptionToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "mobile-description") return;
  const englishInput = getMobileDescriptionTextarea("en");
  if (!englishInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildMobileDescriptionTranslationEntries(englishSource)).length) {
    showEditorStatus(backendT("backend.users.mobile_description_translation.missing_source", "Add English mobile description first."), true);
    return;
  }

  const targets = QUALIFICATION_LANGUAGE_OPTIONS
    .map((option) => normalizeText(option?.value).toLowerCase())
    .filter((lang) => lang && lang !== "en");
  if (!targets.length) return;

  for (const targetLang of targets) {
    setMobileDescriptionValue(targetLang, "");
  }
  showEditorStatus(backendT("backend.users.mobile_description_translation.translating_all", "Translating all mobile description languages..."));

  for (const targetLang of targets) {
    const translatedEntries = await requestMobileDescriptionTranslation(targetLang, englishSource);
    if (!translatedEntries) {
      showEditorStatus(backendT("backend.users.mobile_description_translation.error", "Could not translate the mobile description."), true);
      return;
    }
    setMobileDescriptionValue(targetLang, translatedMobileDescriptionValue(translatedEntries, englishSource));
  }

  showEditorStatus(backendT("backend.users.mobile_description_translation.all_done", "All mobile description translations updated."));
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
  updateEditorSaveButtonState();
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
  updateEditorSaveButtonState();
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

function normalizePositionEntriesForSave() {
  const source = state.editor?.positionByLang && typeof state.editor.positionByLang === "object"
    ? state.editor.positionByLang
    : {};
  return Object.entries(source)
    .map(([lang, value]) => ({
      lang: normalizeText(lang).toLowerCase(),
      value: normalizeText(value)
    }))
    .filter((entry) => Boolean(entry.lang && entry.value))
    .sort((left, right) => left.lang.localeCompare(right.lang));
}

function normalizeDescriptionEntriesForSave() {
  const source = state.editor?.descriptionByLang && typeof state.editor.descriptionByLang === "object"
    ? state.editor.descriptionByLang
    : {};
  return Object.entries(source)
    .map(([lang, value]) => ({
      lang: normalizeText(lang).toLowerCase(),
      value: normalizeText(value)
    }))
    .filter((entry) => Boolean(entry.lang && entry.value))
    .sort((left, right) => left.lang.localeCompare(right.lang));
}

function normalizeMobileDescriptionEntriesForSave() {
  const source = state.editor?.mobileDescriptionByLang && typeof state.editor.mobileDescriptionByLang === "object"
    ? state.editor.mobileDescriptionByLang
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
  if (!isEditorDirty()) {
    updateEditorSaveButtonState();
    return;
  }

  const languages = Array.from(new Set((Array.isArray(state.editor?.languages) ? state.editor.languages : []).map((code) => normalizeText(code).toLowerCase()).filter(Boolean)));
  if (!languages.length) {
    showEditorStatus(backendT("backend.users.languages_required", "Select at least one language."), true);
    return;
  }
  const destinations = Array.from(new Set((Array.isArray(state.editor?.destinations) ? state.editor.destinations : []).map((code) => normalizeText(code).toUpperCase()).filter(Boolean)));

  const qualificationI18n = normalizeQualificationEntriesForSave();
  const positionI18n = normalizePositionEntriesForSave();
  const descriptionI18n = normalizeDescriptionEntriesForSave();
  const mobileDescriptionI18n = normalizeMobileDescriptionEntriesForSave();
  const pendingPhoto = state.editor?.pendingPhoto && typeof state.editor.pendingPhoto === "object"
    ? state.editor.pendingPhoto
    : null;
  const profileDirty = JSON.stringify(normalizeEditorProfile(state.editor)) !== JSON.stringify(normalizeEditorProfile(cloneEditorProfile(user)));

  clearError();
  clearEditorStatus();
  state.editorSaving = true;
  updateEditorSaveButtonState();
  try {
    let latestUser = user;
    if (profileDirty) {
      const request = keycloakUserStaffProfileUpdateRequest({
        baseURL: apiOrigin,
        params: { username: user.username }
      });
      const payload = await fetchApi(request.url, {
        method: request.method,
        body: {
          full_name: normalizeText(state.editor?.fullName),
          position_i18n: positionI18n,
          friendly_short_name: normalizeText(state.editor?.friendlyShortName),
          appears_in_team_web_page: state.editor?.appearsInTeamWebPage !== false,
          languages,
          destinations,
          qualification_i18n: qualificationI18n,
          description_i18n: descriptionI18n,
          mobile_description_i18n: mobileDescriptionI18n
        }
      });
      if (!payload?.user) return;
      latestUser = payload.user;
    }
    if (pendingPhoto?.dataBase64) {
      const pictureRequest = keycloakUserStaffProfilePictureUploadRequest({
        baseURL: apiOrigin,
        params: { username: user.username }
      });
      const picturePayload = await fetchApi(pictureRequest.url, {
        method: pictureRequest.method,
        body: {
          filename: pendingPhoto.filename || `${user.username}.upload`,
          mime_type: pendingPhoto.mimeType || "image/*",
          data_base64: pendingPhoto.dataBase64
        }
      });
      if (!picturePayload?.user) return;
      latestUser = picturePayload.user;
    }
    applyUpdatedUser(latestUser);
    showEditorStatus(backendT("backend.users.profile_saved", "ATP staff profile saved."));
  } finally {
    state.editorSaving = false;
    updateEditorSaveButtonState();
  }
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

  if (els.staffEditorPhotoInput) {
    els.staffEditorPhotoInput.value = "";
  }
  state.editor.pendingPhoto = {
    filename: file.name || `${user.username}.upload`,
    mimeType: file.type || "image/*",
    dataBase64: base64,
    previewSrc: `data:${file.type || "image/*"};base64,${base64}`
  };
  clearError();
  showEditorStatus(backendT("backend.users.picture_ready", "Picture ready to save."));
  renderEditor();
}

function applyUpdatedUser(updatedUser) {
  const username = normalizeText(updatedUser?.username);
  if (!username) return;
  if (updatedUser?.staff_profile && typeof updatedUser.staff_profile === "object") {
    state.staffProfilesByUsername[username.toLowerCase()] = {
      ...updatedUser.staff_profile,
      picture_ref: resolveStaffPhotoUrl(updatedUser.staff_profile.picture_ref)
    };
  }
  const normalizedUser = {
    id: normalizeText(updatedUser?.id),
    username,
    name: normalizeText(updatedUser?.name),
    active: updatedUser?.active !== false,
    realm_roles: Array.isArray(updatedUser?.realm_roles) ? updatedUser.realm_roles : [],
    client_roles: Array.isArray(updatedUser?.client_roles) ? updatedUser.client_roles : []
  };
  state.keycloakUsers = state.keycloakUsers.map((user) => (normalizeText(user?.username) === username ? normalizedUser : user));
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
