import {
  createApiFetcher,
  escapeHtml,
  fetchApiJson,
  formatDateTime,
  normalizeText
} from "../shared/api.js";
import { DESTINATION_COUNTRY_CODE_SET } from "../../../shared/js/destination_country_codes.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  countryReferenceInfoRequest,
  countryReferenceInfoUpdateRequest,
  keycloakUserStaffProfileUpdateRequest,
  keycloakUserStaffProfileTranslateFieldsRequest,
  keycloakUserStaffProfilePictureUploadRequest,
  toursRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  COUNTRY_CODE_OPTIONS,
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
  settingsObservabilityPanel: document.getElementById("settingsObservabilityPanel"),
  settingsObservabilityStatus: document.getElementById("settingsObservabilityStatus"),
  settingsObservabilityRefreshBtn: document.getElementById("settingsObservabilityRefreshBtn"),
  settingsLoggedInUsers: document.getElementById("settingsLoggedInUsers"),
  settingsLastChangedBooking: document.getElementById("settingsLastChangedBooking"),
  settingsPanel: document.getElementById("settingsPanel"),
  staffStatus: document.getElementById("staffStatus"),
  staffTable: document.getElementById("staffTable"),
  websiteDestinationPublicationPanel: document.getElementById("websiteDestinationPublicationPanel"),
  websiteDestinationPublicationStatus: document.getElementById("websiteDestinationPublicationStatus"),
  websiteDestinationPublicationList: document.getElementById("websiteDestinationPublicationList"),
  websiteDestinationPublicationSaveBtn: document.getElementById("websiteDestinationPublicationSaveBtn"),
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
  staffEditorTeamOrder: document.getElementById("staffEditorTeamOrder"),
  staffEditorAppearsInTeamWebPage: document.getElementById("staffEditorAppearsInTeamWebPage"),
  staffEditorLanguages: document.getElementById("staffEditorLanguages"),
  staffEditorDestinations: document.getElementById("staffEditorDestinations"),
  staffEditorDescription: document.getElementById("staffEditorDescription"),
  staffEditorShortDescription: document.getElementById("staffEditorShortDescription"),
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

function currentStaffSourceLang() {
  return normalizeCatalogLanguageCode(
    typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "en",
    { fallback: "en" }
  );
}

function qualificationLanguageOptionsForEditor() {
  const options = QUALIFICATION_LANGUAGE_OPTIONS.length
    ? [...QUALIFICATION_LANGUAGE_OPTIONS]
    : [{ value: "en", label: "EN", direction: "ltr" }];
  const byCode = new Map(options.map((option) => [normalizeText(option.value).toLowerCase(), option]));
  const sourceLang = currentStaffSourceLang();
  const prioritized = [];
  const primary = byCode.get(sourceLang);
  if (primary) prioritized.push(primary);
  const pairedLang = sourceLang === "vi" ? "en" : "vi";
  const paired = byCode.get(pairedLang);
  if (paired && !prioritized.some((option) => option.value === paired.value)) {
    prioritized.push(paired);
  }
  const remaining = options
    .filter((option) => !prioritized.some((entry) => entry.value === option.value))
    .sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""), "en", { sensitivity: "base" }));
  return [...prioritized, ...remaining];
}

function currentStaffSourceOption() {
  return qualificationLanguageOptionsForEditor()[0] || { value: "en", label: "EN", direction: "ltr" };
}

function translateAllButtonLabel() {
  return backendT("backend.users.translation.translate_all", "{source} → ALL", {
    source: currentStaffSourceOption().label
  });
}

function translateButtonLabel(targetOption) {
  return `${currentStaffSourceOption().label} → ${normalizeText(targetOption?.label) || normalizeText(targetOption?.value).toUpperCase()}`;
}

function translationTargetLanguages() {
  const sourceLang = currentStaffSourceLang();
  return qualificationLanguageOptionsForEditor()
    .map((option) => normalizeText(option?.value).toLowerCase())
    .filter((lang) => lang && lang !== sourceLang);
}

const LANGUAGE_LABEL_BY_VALUE = new Map(
  (LANGUAGE_OPTIONS.length ? LANGUAGE_OPTIONS : enumOptionsFor("LanguageCode"))
    .map((option) => [normalizeText(option?.value).toLowerCase(), normalizeText(option?.label) || normalizeText(option?.value).toUpperCase()])
);

const COUNTRY_OPTIONS = Object.freeze(
  COUNTRY_CODE_OPTIONS
    .map((option) => ({
      value: normalizeText(option?.value).toUpperCase(),
      label: normalizeText(option?.label) || normalizeText(option?.value).toUpperCase()
    }))
    .filter((option) => DESTINATION_COUNTRY_CODE_SET.has(option.value))
    .filter((option) => option.value)
    .sort((left, right) => left.label.localeCompare(right.label, "en", { sensitivity: "base" }))
);

const COUNTRY_LABEL_BY_VALUE = new Map(COUNTRY_OPTIONS.map((option) => [option.value, option.label]));

const TOUR_DESTINATION_TO_COUNTRY_CODE = Object.freeze({
  vietnam: "VN",
  thailand: "TH",
  cambodia: "KH",
  laos: "LA"
});

const INVALID_TEAM_ORDER = "__invalid_team_order__";

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadObservability: false,
    canReadSettings: false,
    canReadStaffProfiles: false,
    canEditStaffProfiles: false,
    canReadWebsiteDestinationPublication: false,
    canEditWebsiteDestinationPublication: false
  },
  observabilityLoading: false,
  observability: {
    loggedInUsers: [],
    sessionCount: 0,
    userCount: 0,
    latestChangedBooking: null
  },
  keycloakUsers: [],
  staffProfilesByUsername: {},
  destinationOptions: [],
  countryReferenceItems: [],
  websiteDestinationPublicationInitialByCountry: {},
  websiteDestinationPublicationDraftByCountry: {},
  websiteDestinationPublicationSaving: false,
  selectedUsername: "",
  editorSaving: false,
  editor: {
    fullName: "",
    friendlyShortName: "",
    teamOrder: "",
    appearsInTeamWebPage: true,
    languages: [],
    destinations: [],
    positionByLang: {},
    descriptionByLang: {},
    shortDescriptionByLang: {},
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

function countryLabel(countryCode) {
  const normalizedCountry = normalizeText(countryCode).toUpperCase();
  return normalizeText(COUNTRY_LABEL_BY_VALUE.get(normalizedCountry)) || normalizedCountry;
}

function collectKeycloakRoleNames(user) {
  return [
    ...(Array.isArray(user?.realm_roles) ? user.realm_roles : []),
    ...(Array.isArray(user?.client_roles) ? user.client_roles : [])
  ].map((role) => normalizeText(role)).filter(Boolean);
}

function isEligibleAtpStaffUser(user) {
  const roles = collectKeycloakRoleNames(user);
  return roles.some((role) => GENERATED_APP_ROLES.includes(role));
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

function homepageAssetSyncFailed(payload) {
  return payload?.homepage_assets?.ok === false;
}

function homepageAssetSyncWarningMessage() {
  return backendT(
    "backend.users.public_sync_failed",
    "ATP staff profile saved, but refreshing the public homepage failed. Please retry or run the homepage asset generator."
  );
}

function countryReferenceHomepageAssetSyncWarningMessage() {
  return backendT(
    "backend.settings.public_sync_failed",
    "Settings saved, but refreshing the public homepage failed. Please retry or run the homepage asset generator."
  );
}

function showWebsiteDestinationPublicationStatus(message, isError = false) {
  if (!els.websiteDestinationPublicationStatus) return;
  els.websiteDestinationPublicationStatus.textContent = normalizeText(message);
  els.websiteDestinationPublicationStatus.classList.toggle("is-error", Boolean(isError));
}

function clearWebsiteDestinationPublicationStatus() {
  showWebsiteDestinationPublicationStatus("", false);
}

function showObservabilityStatus(message, isError = false) {
  if (!els.settingsObservabilityStatus) return;
  els.settingsObservabilityStatus.textContent = normalizeText(message);
  els.settingsObservabilityStatus.classList.toggle("is-error", Boolean(isError));
}

function clearObservabilityStatus() {
  showObservabilityStatus("", false);
}

function updateObservabilityRefreshButtonState() {
  if (!els.settingsObservabilityRefreshBtn) return;
  els.settingsObservabilityRefreshBtn.disabled = !state.permissions.canReadObservability || state.observabilityLoading;
}

function formatObservabilityDateTime(value) {
  return normalizeText(value) ? formatDateTime(value) : backendT("common.not_available", "Not available");
}

function bookingLinkHref(bookingId) {
  const normalizedBookingId = normalizeText(bookingId);
  if (!normalizedBookingId) return "#";
  const url = new URL("booking.html", window.location.origin);
  url.searchParams.set("id", normalizedBookingId);
  const lang = typeof window.backendI18n?.getLang === "function" ? normalizeText(window.backendI18n.getLang()) : "";
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function renderObservability() {
  if (els.settingsLoggedInUsers) {
    const users = Array.isArray(state.observability.loggedInUsers) ? state.observability.loggedInUsers : [];
    if (!users.length) {
      els.settingsLoggedInUsers.innerHTML = `<p class="micro settings-observability__empty">${escapeHtml(backendT("backend.settings.observability.no_sessions", "No active backend sessions."))}</p>`;
    } else {
      els.settingsLoggedInUsers.innerHTML = `<div class="settings-observability__list">${users.map((user) => {
        const displayName = normalizeText(user?.name) || normalizeText(user?.preferred_username) || normalizeText(user?.email) || normalizeText(user?.sub) || "-";
        const username = normalizeText(user?.preferred_username);
        const sessionsLabel = backendT("backend.settings.observability.sessions", "{count} session(s)", {
          count: Number(user?.session_count || 0)
        });
        const metaParts = [
          username ? `username: ${username}` : "",
          sessionsLabel,
          `latest login: ${formatObservabilityDateTime(user?.latest_login_at)}`
        ].filter(Boolean);
        return `<div class="settings-observability__list-item">
          <div class="settings-observability__item-title">${escapeHtml(displayName)}</div>
          <div class="micro settings-observability__item-meta">${escapeHtml(metaParts.join(" | "))}</div>
        </div>`;
      }).join("")}</div>`;
    }
  }

  if (els.settingsLastChangedBooking) {
    const booking = state.observability.latestChangedBooking;
    if (!booking?.id) {
      els.settingsLastChangedBooking.innerHTML = `<p class="micro settings-observability__empty">${escapeHtml(backendT("backend.settings.observability.no_bookings", "No booking changes yet."))}</p>`;
    } else {
      const bookingTitle = normalizeText(booking?.name) || normalizeText(booking?.id);
      const actor = normalizeText(booking?.last_activity?.actor);
      const detail = normalizeText(booking?.last_activity?.detail);
      const changedBy = actor || backendT("common.not_available", "Not available");
      const metaParts = [
        `updated: ${formatObservabilityDateTime(booking?.updated_at)}`
      ];
      if (booking?.assigned_keycloak_user_id) metaParts.push(`assigned: ${booking.assigned_keycloak_user_id}`);
      els.settingsLastChangedBooking.innerHTML = `<div class="settings-observability__booking">
        <a class="settings-observability__booking-link" href="${escapeHtml(bookingLinkHref(booking.id))}">${escapeHtml(bookingTitle)}</a>
        <div class="micro settings-observability__booking-meta">${escapeHtml(metaParts.join(" | "))}</div>
        <div class="micro settings-observability__booking-meta">${escapeHtml(`changed by: ${changedBy}`)}</div>
        ${detail ? `<div class="micro settings-observability__booking-meta">${escapeHtml(detail)}</div>` : ""}
      </div>`;
    }
  }

  updateObservabilityRefreshButtonState();
}

async function loadObservability() {
  if (!state.permissions.canReadObservability) {
    renderObservability();
    return;
  }

  clearObservabilityStatus();
  showObservabilityStatus(backendT("backend.settings.observability.loading", "Loading backend activity..."));
  state.observabilityLoading = true;
  updateObservabilityRefreshButtonState();

  try {
    const payload = await fetchApiJson(`${apiOrigin}/api/v1/settings/observability`, {
      onError: (message) => showObservabilityStatus(message, true),
      connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API."),
      includeDetailInError: false
    });

    if (!payload) {
      renderObservability();
      return;
    }

    state.observability = {
      loggedInUsers: Array.isArray(payload?.logged_in_users) ? payload.logged_in_users : [],
      sessionCount: Number(payload?.session_count || 0),
      userCount: Number(payload?.user_count || 0),
      latestChangedBooking: payload?.latest_changed_booking && typeof payload.latest_changed_booking === "object"
        ? payload.latest_changed_booking
        : null
    };
    renderObservability();
    showObservabilityStatus(
      backendT("backend.settings.observability.loaded", "{users} user(s), {sessions} session(s)", {
        users: state.observability.userCount,
        sessions: state.observability.sessionCount
      })
    );
  } finally {
    state.observabilityLoading = false;
    updateObservabilityRefreshButtonState();
  }
}

function translationProviderLabelFromResponse(response) {
  return normalizeText(response?.headers?.get("x-atp-translation-provider-label"));
}

function translationStatusMessage(baseMessage, { providerLabel = "", current = 0, total = 0 } = {}) {
  const parts = [normalizeText(baseMessage)];
  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    parts.push(`(${current}/${total}${providerLabel ? `, ${providerLabel}` : ""})`);
  } else if (providerLabel) {
    parts.push(`(${providerLabel})`);
  }
  return parts.filter(Boolean).join(" ");
}

function staffLanguageLabel(lang) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  return normalizeText(LANGUAGE_LABEL_BY_VALUE.get(normalizedLang)) || normalizedLang.toUpperCase();
}

function logStaffTranslationBatch(message, details = {}, isError = false) {
  const method = isError ? "error" : "info";
  const payload = details && typeof details === "object" ? details : { details };
  console[method](`[staff-translation] ${message}`, payload);
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
      canReadObservability: roles.includes(ROLES.ADMIN),
      canReadStaffProfiles: roles.includes(ROLES.ADMIN),
      canEditStaffProfiles: roles.includes(ROLES.ADMIN),
      canReadWebsiteDestinationPublication: roles.includes(ROLES.ADMIN),
      canEditWebsiteDestinationPublication: roles.includes(ROLES.ADMIN),
      canReadSettings: roles.includes(ROLES.ADMIN)
    }),
    hasPageAccess: (permissions) => permissions.canReadSettings,
    logKey: "backend-settings",
    pageName: "settings.html",
    expectedRolesAnyOf: [ROLES.ADMIN],
    likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to read settings."
  });

  state.authUser = authState.authUser;
  state.roles = authState.roles;
  state.permissions = {
    canReadObservability: Boolean(authState.permissions?.canReadObservability),
    canReadSettings: Boolean(authState.permissions?.canReadSettings),
    canReadStaffProfiles: Boolean(authState.permissions?.canReadStaffProfiles),
    canEditStaffProfiles: Boolean(authState.permissions?.canEditStaffProfiles),
    canReadWebsiteDestinationPublication: Boolean(authState.permissions?.canReadWebsiteDestinationPublication),
    canEditWebsiteDestinationPublication: Boolean(authState.permissions?.canEditWebsiteDestinationPublication)
  };

  renderPermissionScopedSections();
  updateStatusCopy();
  if (state.permissions.canReadSettings) {
    await Promise.all([
      state.permissions.canReadObservability ? loadObservability() : Promise.resolve(),
      state.permissions.canReadStaffProfiles ? loadStaffDirectoryEntries() : Promise.resolve(),
      state.permissions.canEditStaffProfiles ? loadDestinationOptions() : Promise.resolve(),
      state.permissions.canReadWebsiteDestinationPublication ? loadWebsiteDestinationPublication() : Promise.resolve()
    ]);
  } else {
    showError(backendT("backend.settings.forbidden", "You do not have access to reports and settings."));
  }
}

function bindEvents() {
  els.settingsObservabilityRefreshBtn?.addEventListener("click", () => {
    void loadObservability();
  });
  els.staffTable?.addEventListener("click", handleStaffTableClick);
  els.staffTable?.addEventListener("keydown", handleStaffTableKeydown);
  els.websiteDestinationPublicationList?.addEventListener("change", handleWebsiteDestinationPublicationToggle);
  els.websiteDestinationPublicationSaveBtn?.addEventListener("click", () => {
    void saveWebsiteDestinationPublication();
  });
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
  els.staffEditorTeamOrder?.addEventListener("input", handleTeamOrderInput);
  els.staffEditorAppearsInTeamWebPage?.addEventListener("change", handleAppearsInTeamWebPageChange);
  els.staffEditorLanguages?.addEventListener("change", handleLanguageToggle);
  els.staffEditorDestinations?.addEventListener("change", handleDestinationToggle);
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
  els.staffEditorShortDescription?.addEventListener("input", handleShortDescriptionInput);
  els.staffEditorShortDescription?.addEventListener("click", (event) => {
    const translateAllButton = event.target.closest("[data-staff-translate-all]");
    if (translateAllButton) {
      event.preventDefault();
      void translateShortDescriptionToAll(translateAllButton);
      return;
    }
    const translateButton = event.target.closest("[data-staff-translate-field]");
    if (!translateButton) return;
    event.preventDefault();
    void translateShortDescription(translateButton);
  });
}

function renderPermissionScopedSections() {
  if (els.settingsObservabilityPanel) {
    els.settingsObservabilityPanel.hidden = !state.permissions.canReadObservability;
  }
  if (els.settingsPanel) {
    els.settingsPanel.hidden = !state.permissions.canReadStaffProfiles;
  }
  if (els.staffStatus) {
    els.staffStatus.hidden = !state.permissions.canReadStaffProfiles;
  }
  if (els.websiteDestinationPublicationPanel) {
    els.websiteDestinationPublicationPanel.hidden = !state.permissions.canReadWebsiteDestinationPublication;
  }
  if (!state.permissions.canEditStaffProfiles && els.staffEditorPanel) {
    els.staffEditorPanel.hidden = true;
  }
}

function updateStatusCopy() {
  if (!els.staffStatus) return;
  if (!state.permissions.canReadStaffProfiles) {
    els.staffStatus.textContent = "";
    return;
  }
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

function firstLocalizedProfileValue(entries, fallbackValue = "") {
  return englishTextFromLocalizedEntries(entries)
    || normalizeText(fallbackValue);
}

function parseTeamOrderInput(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return { valid: true, isSet: false, value: null };
  }
  if (!/^-?\d+$/.test(normalized)) {
    return { valid: false, isSet: false, value: null };
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return { valid: false, isSet: false, value: null };
  }
  return { valid: true, isSet: true, value: parsed };
}

function normalizeStaffDestinationCode(value) {
  const normalized = normalizeText(value).trim();
  if (!normalized) return "";
  const upper = normalized.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return TOUR_DESTINATION_TO_COUNTRY_CODE[normalized.toLowerCase()] || "";
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

function normalizeCountryReferenceItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      country: normalizeText(item?.country).toUpperCase(),
      published_on_webpage: item?.published_on_webpage !== false,
      practical_tips: Array.isArray(item?.practical_tips) ? item.practical_tips.map((entry) => normalizeText(entry)).filter(Boolean) : [],
      emergency_contacts: Array.isArray(item?.emergency_contacts) ? item.emergency_contacts.map((entry) => ({
        label: normalizeText(entry?.label),
        phone: normalizeText(entry?.phone),
        ...(normalizeText(entry?.note) ? { note: normalizeText(entry.note) } : {})
      })) : []
    }))
    .filter((item) => item.country && DESTINATION_COUNTRY_CODE_SET.has(item.country));
}

function publicationMapFromCountryReferenceItems(items) {
  const defaults = Object.fromEntries(COUNTRY_OPTIONS.map((option) => [option.value, true]));
  for (const item of normalizeCountryReferenceItems(items)) {
    defaults[item.country] = item.published_on_webpage !== false;
  }
  return defaults;
}

function normalizeWebsiteDestinationPublicationDraft(draft) {
  return Object.fromEntries(
    COUNTRY_OPTIONS.map((option) => [option.value, draft?.[option.value] !== false])
  );
}

function isWebsiteDestinationPublicationDirty() {
  if (!state.permissions.canEditWebsiteDestinationPublication) return false;
  return JSON.stringify(normalizeWebsiteDestinationPublicationDraft(state.websiteDestinationPublicationDraftByCountry))
    !== JSON.stringify(normalizeWebsiteDestinationPublicationDraft(state.websiteDestinationPublicationInitialByCountry));
}

function updateWebsiteDestinationPublicationSaveButtonState() {
  if (!els.websiteDestinationPublicationSaveBtn) return;
  els.websiteDestinationPublicationSaveBtn.disabled = !state.permissions.canEditWebsiteDestinationPublication
    || state.websiteDestinationPublicationSaving
    || !isWebsiteDestinationPublicationDirty();
}

function renderWebsiteDestinationPublication() {
  if (!els.websiteDestinationPublicationList) return;
  if (!state.permissions.canReadWebsiteDestinationPublication) {
    els.websiteDestinationPublicationList.innerHTML = "";
    updateWebsiteDestinationPublicationSaveButtonState();
    return;
  }
  const current = normalizeWebsiteDestinationPublicationDraft(state.websiteDestinationPublicationDraftByCountry);
  els.websiteDestinationPublicationList.innerHTML = COUNTRY_OPTIONS
    .map((option) => `<label class="settings-staff-editor__check-pill">
      <input type="checkbox" data-website-destination-publication="${escapeHtml(option.value)}" ${current[option.value] !== false ? "checked" : ""} />
      <span>${escapeHtml(countryLabel(option.value))}</span>
    </label>`)
    .join("");
  updateWebsiteDestinationPublicationSaveButtonState();
}

async function loadWebsiteDestinationPublication() {
  clearWebsiteDestinationPublicationStatus();
  showWebsiteDestinationPublicationStatus(
    backendT("backend.settings.website_destinations_loading", "Loading website destinations...")
  );
  try {
    const request = countryReferenceInfoRequest({ baseURL: apiOrigin });
    const payload = await fetchApi(request.url, { suppressNotFound: true });
    if (!payload) {
      showWebsiteDestinationPublicationStatus(
        backendT("backend.settings.website_destinations_load_failed", "Could not load website destinations."),
        true
      );
      renderWebsiteDestinationPublication();
      return;
    }
    state.countryReferenceItems = normalizeCountryReferenceItems(payload?.items);
    state.websiteDestinationPublicationInitialByCountry = publicationMapFromCountryReferenceItems(state.countryReferenceItems);
    state.websiteDestinationPublicationDraftByCountry = { ...state.websiteDestinationPublicationInitialByCountry };
    renderWebsiteDestinationPublication();
    showWebsiteDestinationPublicationStatus(
      backendT("backend.settings.website_destinations_status", "Destination publication is managed here.")
    );
  } catch (error) {
    console.error("[backend-settings] Failed to load website destination publication controls.", {
      error,
      apiOrigin,
      user: state.authUser?.username || state.authUser?.sub || null
    });
    state.countryReferenceItems = [];
    state.websiteDestinationPublicationInitialByCountry = publicationMapFromCountryReferenceItems([]);
    state.websiteDestinationPublicationDraftByCountry = { ...state.websiteDestinationPublicationInitialByCountry };
    renderWebsiteDestinationPublication();
    showWebsiteDestinationPublicationStatus(
      backendT("backend.settings.website_destinations_load_failed", "Could not load website destinations."),
      true
    );
  }
}

function handleWebsiteDestinationPublicationToggle(event) {
  const input = event.target.closest("[data-website-destination-publication]");
  if (!input) return;
  const country = normalizeText(input.getAttribute("data-website-destination-publication")).toUpperCase();
  if (!country || !DESTINATION_COUNTRY_CODE_SET.has(country)) return;
  state.websiteDestinationPublicationDraftByCountry = {
    ...normalizeWebsiteDestinationPublicationDraft(state.websiteDestinationPublicationDraftByCountry),
    [country]: input.checked !== false
  };
  showWebsiteDestinationPublicationStatus(
    backendT("backend.settings.website_destinations_unsaved", "Unsaved changes.")
  );
  updateWebsiteDestinationPublicationSaveButtonState();
}

async function saveWebsiteDestinationPublication() {
  if (!state.permissions.canEditWebsiteDestinationPublication) return;
  if (!isWebsiteDestinationPublicationDirty()) {
    updateWebsiteDestinationPublicationSaveButtonState();
    return;
  }
  clearError();
  clearWebsiteDestinationPublicationStatus();
  showWebsiteDestinationPublicationStatus(
    backendT("backend.settings.website_destinations_saving", "Saving website destinations...")
  );
  state.websiteDestinationPublicationSaving = true;
  updateWebsiteDestinationPublicationSaveButtonState();

  try {
    const currentItemsByCountry = new Map(
      normalizeCountryReferenceItems(state.countryReferenceItems).map((item) => [item.country, item])
    );
    const draft = normalizeWebsiteDestinationPublicationDraft(state.websiteDestinationPublicationDraftByCountry);
    const nextItems = COUNTRY_OPTIONS
      .map((option) => {
        const existing = currentItemsByCountry.get(option.value) || null;
        const publishedOnWebpage = draft[option.value] !== false;
        if (existing) {
          return {
            ...existing,
            published_on_webpage: publishedOnWebpage
          };
        }
        if (!publishedOnWebpage) {
          return {
            country: option.value,
            published_on_webpage: false,
            practical_tips: [],
            emergency_contacts: []
          };
        }
        return null;
      })
      .filter(Boolean);

    const request = countryReferenceInfoUpdateRequest({ baseURL: apiOrigin });
    const payload = await fetchApi(request.url, {
      method: request.method,
      body: { items: nextItems }
    });
    if (!payload) {
      showWebsiteDestinationPublicationStatus(
        backendT("backend.settings.website_destinations_save_failed", "Could not save website destinations."),
        true
      );
      return;
    }
    state.countryReferenceItems = normalizeCountryReferenceItems(payload?.items);
    state.websiteDestinationPublicationInitialByCountry = publicationMapFromCountryReferenceItems(state.countryReferenceItems);
    state.websiteDestinationPublicationDraftByCountry = { ...state.websiteDestinationPublicationInitialByCountry };
    renderWebsiteDestinationPublication();
    showWebsiteDestinationPublicationStatus(
      homepageAssetSyncFailed(payload)
        ? countryReferenceHomepageAssetSyncWarningMessage()
        : backendT("backend.settings.website_destinations_saved", "Website destinations saved."),
      homepageAssetSyncFailed(payload)
    );
  } finally {
    state.websiteDestinationPublicationSaving = false;
    updateWebsiteDestinationPublicationSaveButtonState();
  }
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
    <th class="keycloak-roles-col">${escapeHtml(backendT("backend.table.roles", "Roles"))}</th>
    <th>${escapeHtml(backendT("backend.table.status", "Status"))}</th>
    <th class="backend-table-align-right">${escapeHtml(backendT("backend.table.active", "Active"))}</th>
  </tr></thead>`;

  const rows = items
    .map((staff) => {
      const username = normalizeText(staff?.username);
      const profile = getStaffProfileForUsername(username) || {};
      const photoRef = resolveStaffPhotoUrl(profile?.picture_ref);
      const profileStatus = formatStaffProfileStatus(profile);
      const displayName = normalizeText(profile?.full_name) || normalizeText(staff?.name) || "-";
      const profileStatusClass = profileStatus === backendT("backend.users.status_complete", "complete")
        ? "settings-staff-table__status-pill settings-staff-table__status-pill--complete"
        : "settings-staff-table__status-pill settings-staff-table__status-pill--incomplete";
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
          <div class="settings-staff-table__username-display">${escapeHtml(displayName)}</div>
          <div class="micro settings-staff-table__username-name">username: ${escapeHtml(username || "-")}</div>
        </td>
        <td class="keycloak-roles-col">${formatKeycloakRolesCell(staff)}</td>
        <td><span class="${profileStatusClass}">${escapeHtml(profileStatus)}</span></td>
        <td class="backend-table-align-right">${staff.active ? escapeHtml(backendT("common.yes", "Yes")) : escapeHtml(backendT("common.no", "No"))}</td>
      </tr>`;
    })
    .join("");

  const colSpan = 5;
  els.staffTable.innerHTML = `${header}<tbody>${rows || `<tr><td colspan="${colSpan}">${escapeHtml(backendT("backend.users.no_results", "No Keycloak users found"))}</td></tr>`}</tbody>`;
}

function formatStaffProfileStatus(profile) {
  const missing = [];
  const languages = Array.isArray(profile?.languages) ? profile.languages.filter(Boolean) : [];
  const destinations = Array.isArray(profile?.destinations) ? profile.destinations.filter(Boolean) : [];
  const position = firstLocalizedProfileValue(profile?.position_i18n, profile?.position);
  const description = firstLocalizedProfileValue(profile?.description_i18n, profile?.description);
  const shortDescription = firstLocalizedProfileValue(profile?.short_description_i18n, profile?.short_description);

  if (!languages.length) missing.push(backendT("backend.users.status_missing_languages", "missing languages"));
  if (!destinations.length) missing.push(backendT("backend.users.status_missing_destinations", "missing destinations"));
  if (!position) missing.push(backendT("backend.users.status_missing_position", "missing position"));
  if (!description) missing.push(backendT("backend.users.status_missing_description", "missing description"));
  if (!shortDescription) missing.push(backendT("backend.users.status_missing_short_description", "missing short description"));

  return missing.join(", ") || backendT("backend.users.status_complete", "complete");
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
  const descriptionByLang = Object.fromEntries(
    (Array.isArray(profile?.description_i18n) ? profile.description_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(descriptionByLang).length && normalizeText(profile?.description)) {
    descriptionByLang.en = normalizeText(profile.description);
  }
  const shortDescriptionByLang = Object.fromEntries(
    (Array.isArray(profile?.short_description_i18n) ? profile.short_description_i18n : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  if (!Object.keys(shortDescriptionByLang).length && normalizeText(profile?.short_description)) {
    shortDescriptionByLang.en = normalizeText(profile.short_description);
  }
  return {
    fullName: normalizeText(profile?.full_name),
    friendlyShortName: normalizeText(profile?.friendly_short_name),
    teamOrder: profile?.team_order === null || profile?.team_order === undefined ? "" : String(profile.team_order),
    appearsInTeamWebPage: profile?.appears_in_team_web_page !== false,
    languages: Array.isArray(profile?.languages)
      ? profile.languages.map((code) => normalizeText(code).toLowerCase()).filter(Boolean)
      : [],
    destinations: Array.isArray(profile?.destinations)
      ? profile.destinations.map((code) => normalizeText(code).toUpperCase()).filter(Boolean)
      : [],
    positionByLang,
    descriptionByLang,
    shortDescriptionByLang,
    pendingPhoto: null
  };
}

function normalizeEditorProfile(profile) {
  const teamOrder = parseTeamOrderInput(profile?.teamOrder);
  const positionByLang = Object.fromEntries(
    Object.entries(profile?.positionByLang && typeof profile.positionByLang === "object" ? profile.positionByLang : {})
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
  const shortDescriptionByLang = Object.fromEntries(
    Object.entries(profile?.shortDescriptionByLang && typeof profile.shortDescriptionByLang === "object" ? profile.shortDescriptionByLang : {})
      .map(([lang, value]) => [normalizeText(lang).toLowerCase(), normalizeText(value)])
      .filter(([lang, value]) => Boolean(lang && value))
      .sort(([leftLang], [rightLang]) => leftLang.localeCompare(rightLang))
  );
  return {
    fullName: normalizeText(profile?.fullName),
    friendlyShortName: normalizeText(profile?.friendlyShortName),
    teamOrder: teamOrder.valid ? (teamOrder.isSet ? teamOrder.value : null) : INVALID_TEAM_ORDER,
    appearsInTeamWebPage: profile?.appearsInTeamWebPage !== false,
    languages: Array.from(new Set((Array.isArray(profile?.languages) ? profile.languages : []).map((code) => normalizeText(code).toLowerCase()).filter(Boolean))).sort(),
    destinations: Array.from(new Set((Array.isArray(profile?.destinations) ? profile.destinations : []).map((code) => normalizeText(code).toUpperCase()).filter(Boolean))).sort(),
    positionByLang,
    descriptionByLang,
    shortDescriptionByLang
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
    teamOrder: "",
    appearsInTeamWebPage: true,
    languages: [],
    destinations: [],
    positionByLang: {},
    descriptionByLang: {},
    shortDescriptionByLang: {},
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
  if (els.staffEditorTeamOrder) {
    els.staffEditorTeamOrder.value = normalizeText(state.editor?.teamOrder);
  }
  if (els.staffEditorAppearsInTeamWebPage) {
    els.staffEditorAppearsInTeamWebPage.checked = state.editor?.appearsInTeamWebPage !== false;
  }

  renderLanguageChecklist();
  renderDestinationChecklist();
  renderPositionEditor();
  renderDescriptionEditor();
  renderShortDescriptionEditor();
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
  const current = new Set(
    (Array.isArray(state.editor?.destinations) ? state.editor.destinations : [])
      .map((code) => normalizeStaffDestinationCode(code))
      .filter(Boolean)
  );
  const options = (Array.isArray(state.destinationOptions) ? state.destinationOptions : [])
    .map((option) => ({
      value: normalizeStaffDestinationCode(option?.code || option?.value),
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

function renderPositionEditor() {
  if (!els.staffEditorPosition) return;
  const options = qualificationLanguageOptionsForEditor();
  const current = state.editor?.positionByLang && typeof state.editor.positionByLang === "object"
    ? state.editor.positionByLang
    : {};
  const sourceLang = currentStaffSourceLang();
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === sourceLang
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="position">${escapeHtml(translateAllButtonLabel())}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="position" data-target-lang="${escapeHtml(lang)}">${escapeHtml(translateButtonLabel(option))}</button>`;
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
  const options = qualificationLanguageOptionsForEditor();
  const current = state.editor?.descriptionByLang && typeof state.editor.descriptionByLang === "object"
    ? state.editor.descriptionByLang
    : {};
  const sourceLang = currentStaffSourceLang();
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === sourceLang
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="description">${escapeHtml(translateAllButtonLabel())}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="description" data-target-lang="${escapeHtml(lang)}">${escapeHtml(translateButtonLabel(option))}</button>`;
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

function renderShortDescriptionEditor() {
  if (!els.staffEditorShortDescription) return;
  const options = qualificationLanguageOptionsForEditor();
  const current = state.editor?.shortDescriptionByLang && typeof state.editor.shortDescriptionByLang === "object"
    ? state.editor.shortDescriptionByLang
    : {};
  const sourceLang = currentStaffSourceLang();
  const rows = options
    .map((option) => {
      const lang = normalizeText(option.value).toLowerCase();
      const buttonHtml = lang === sourceLang
        ? `<button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-staff-translate-all="short-description">${escapeHtml(translateAllButtonLabel())}</button>`
        : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-staff-translate-field="short-description" data-target-lang="${escapeHtml(lang)}">${escapeHtml(translateButtonLabel(option))}</button>`;
      return `<div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${buttonHtml}</div>
        <div class="tour-localized-group__field">
          <textarea id="${escapeHtml(shortDescriptionTextareaId(lang))}" data-short-description-lang="${escapeHtml(lang)}" dir="${escapeHtml(option.direction)}" rows="4" spellcheck="true">${escapeHtml(normalizeText(current[lang]))}</textarea>
        </div>
      </div>`;
    })
    .join("");
  els.staffEditorShortDescription.innerHTML = `<div class="tour-localized-group tour-localized-group--multiline">${rows}</div>`;
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

function handleShortDescriptionInput(event) {
  const input = event.target.closest("[data-short-description-lang]");
  if (!input) return;
  const lang = normalizeText(input.getAttribute("data-short-description-lang")).toLowerCase();
  if (!lang) return;
  const nextValue = normalizeText(input.value);
  if (!state.editor.shortDescriptionByLang || typeof state.editor.shortDescriptionByLang !== "object") {
    state.editor.shortDescriptionByLang = {};
  }
  if (nextValue) state.editor.shortDescriptionByLang[lang] = nextValue;
  else delete state.editor.shortDescriptionByLang[lang];
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

function handleTeamOrderInput(event) {
  state.editor.teamOrder = normalizeText(event.target?.value);
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function handleAppearsInTeamWebPageChange(event) {
  state.editor.appearsInTeamWebPage = event.target?.checked !== false;
  clearEditorStatus();
  updateEditorSaveButtonState();
}

function descriptionTextareaId(lang) {
  return `staff_description_${normalizeText(lang).toLowerCase()}`;
}

function getDescriptionTextarea(lang) {
  return document.getElementById(descriptionTextareaId(lang));
}

function shortDescriptionTextareaId(lang) {
  return `staff_short_description_${normalizeText(lang).toLowerCase()}`;
}

function getShortDescriptionTextarea(lang) {
  return document.getElementById(shortDescriptionTextareaId(lang));
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

function buildShortDescriptionTranslationEntries(sourceText) {
  return buildMultilineTranslationEntries(sourceText);
}

function translatedShortDescriptionValue(entries, sourceText) {
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

function setShortDescriptionValue(lang, value) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  const normalizedValue = normalizeText(value);
  if (!state.editor.shortDescriptionByLang || typeof state.editor.shortDescriptionByLang !== "object") {
    state.editor.shortDescriptionByLang = {};
  }
  if (normalizedValue) state.editor.shortDescriptionByLang[normalizedLang] = normalizedValue;
  else delete state.editor.shortDescriptionByLang[normalizedLang];
  const textarea = getShortDescriptionTextarea(normalizedLang);
  if (textarea && textarea.value !== normalizedValue) {
    textarea.value = normalizedValue;
  }
  updateEditorSaveButtonState();
}

async function requestPositionTranslation(targetLang, sourceText) {
  return requestStaffTranslation(targetLang, buildPositionTranslationEntries(sourceText));
}

async function requestDescriptionTranslation(targetLang, sourceText) {
  return requestStaffTranslation(targetLang, buildDescriptionTranslationEntries(sourceText));
}

async function requestShortDescriptionTranslation(targetLang, sourceText) {
  return requestStaffTranslation(targetLang, buildShortDescriptionTranslationEntries(sourceText));
}

async function requestStaffTranslation(targetLang, entries) {
  const user = getSelectedUser();
  if (!user) return null;
  const sourceLang = currentStaffSourceLang();
  if (!Object.keys(entries).length) return null;
  const request = keycloakUserStaffProfileTranslateFieldsRequest({
    baseURL: apiOrigin,
    params: { username: user.username },
    body: {
      source_lang: sourceLang,
      target_lang: targetLang,
      entries: Object.entries(entries).map(([key, value]) => ({ key, value }))
    }
  });
  let providerLabel = "";
  const payload = await fetchApiJson(request.url, {
    apiBase,
    method: request.method,
    body: request.body,
    suppressNotFound: false,
    includeDetailInError: false,
    onError: (message) => showError(message),
    connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API."),
    onSuccess: (_payload, response) => {
      providerLabel = translationProviderLabelFromResponse(response);
    }
  });
  if (!Array.isArray(payload?.entries)) return null;
  return {
    entries: Object.fromEntries(
      payload.entries
        .map((entry) => [normalizeText(entry?.key), normalizeText(entry?.value)])
        .filter(([key, value]) => Boolean(key && value))
    ),
    providerLabel
  };
}

async function translatePosition(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const sourceInput = getPositionInput(currentStaffSourceLang());
  const targetInput = getPositionInput(targetLang);
  if (!targetLang || !sourceInput || !targetInput) return;

  const sourceText = String(sourceInput.value || "");
  if (!Object.keys(buildPositionTranslationEntries(sourceText)).length) {
    showEditorStatus(backendT("backend.users.position_translation.missing_source", "Add {language} position first.", {
      language: currentStaffSourceOption().label
    }), true);
    return;
  }

  setPositionValue(targetLang, "");
  showEditorStatus(backendT("backend.users.position_translation.translating", "Translating position..."));
  const translationResult = await requestPositionTranslation(targetLang, sourceText);
  if (!translationResult?.entries) {
    showEditorStatus(backendT("backend.users.position_translation.error", "Could not translate the position."), true);
    return;
  }

  setPositionValue(targetLang, translatedPositionValue(translationResult.entries));
  showEditorStatus(translationStatusMessage(
    backendT("backend.users.position_translation.done", "Position translated."),
    { providerLabel: translationResult.providerLabel }
  ));
}

async function translatePositionToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "position") return;
  const sourceInput = getPositionInput(currentStaffSourceLang());
  if (!sourceInput) return;

  const sourceText = String(sourceInput.value || "");
  if (!Object.keys(buildPositionTranslationEntries(sourceText)).length) {
    showEditorStatus(backendT("backend.users.position_translation.missing_source", "Add {language} position first.", {
      language: currentStaffSourceOption().label
    }), true);
    return;
  }

  const targets = translationTargetLanguages();
  if (!targets.length) return;

  for (const targetLang of targets) {
    setPositionValue(targetLang, "");
  }
  let providerLabel = "";
  logStaffTranslationBatch("Starting translate-all batch", {
    field: "position",
    source_lang: currentStaffSourceLang(),
    source_label: currentStaffSourceOption().label,
    total_targets: targets.length
  });

  for (let index = 0; index < targets.length; index += 1) {
    const targetLang = targets[index];
    logStaffTranslationBatch("Translating target language", {
      field: "position",
      current: index + 1,
      total: targets.length,
      target_lang: targetLang,
      target_label: staffLanguageLabel(targetLang),
      provider: providerLabel || "pending"
    });
    showEditorStatus(translationStatusMessage(
      backendT("backend.users.position_translation.translating_all", "Translating all position languages..."),
      { current: index + 1, total: targets.length, providerLabel }
    ));
    const translationResult = await requestPositionTranslation(targetLang, sourceText);
    if (!translationResult?.entries) {
      logStaffTranslationBatch("Translate-all batch failed", {
        field: "position",
        current: index + 1,
        total: targets.length,
        target_lang: targetLang,
        target_label: staffLanguageLabel(targetLang),
        provider: providerLabel || "unknown"
      }, true);
      showEditorStatus(backendT("backend.users.position_translation.error", "Could not translate the position."), true);
      return;
    }
    providerLabel = translationResult.providerLabel || providerLabel;
    setPositionValue(targetLang, translatedPositionValue(translationResult.entries));
    logStaffTranslationBatch("Translated target language", {
      field: "position",
      current: index + 1,
      total: targets.length,
      target_lang: targetLang,
      target_label: staffLanguageLabel(targetLang),
      provider: providerLabel || "unknown"
    });
  }

  showEditorStatus(translationStatusMessage(
    backendT("backend.users.position_translation.all_done", "All position translations updated."),
    { current: targets.length, total: targets.length, providerLabel }
  ));
  logStaffTranslationBatch("Translate-all batch completed", {
    field: "position",
    total: targets.length,
    provider: providerLabel || "unknown"
  });
}

async function translateDescription(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const sourceInput = getDescriptionTextarea(currentStaffSourceLang());
  const targetInput = getDescriptionTextarea(targetLang);
  if (!targetLang || !sourceInput || !targetInput) return;

  const sourceText = String(sourceInput.value || "");
  if (!Object.keys(buildDescriptionTranslationEntries(sourceText)).length) {
    showEditorStatus(backendT("backend.users.description_translation.missing_source", "Add {language} description first.", {
      language: currentStaffSourceOption().label
    }), true);
    return;
  }

  setDescriptionValue(targetLang, "");
  showEditorStatus(backendT("backend.users.description_translation.translating", "Translating description..."));
  const translationResult = await requestDescriptionTranslation(targetLang, sourceText);
  if (!translationResult?.entries) {
    showEditorStatus(backendT("backend.users.description_translation.error", "Could not translate the description."), true);
    return;
  }

  setDescriptionValue(targetLang, translatedDescriptionValue(translationResult.entries, sourceText));
  showEditorStatus(translationStatusMessage(
    backendT("backend.users.description_translation.done", "Description translated."),
    { providerLabel: translationResult.providerLabel }
  ));
}

async function translateDescriptionToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "description") return;
  const sourceInput = getDescriptionTextarea(currentStaffSourceLang());
  if (!sourceInput) return;

  const sourceText = String(sourceInput.value || "");
  if (!Object.keys(buildDescriptionTranslationEntries(sourceText)).length) {
    showEditorStatus(backendT("backend.users.description_translation.missing_source", "Add {language} description first.", {
      language: currentStaffSourceOption().label
    }), true);
    return;
  }

  const targets = translationTargetLanguages();
  if (!targets.length) return;

  for (const targetLang of targets) {
    setDescriptionValue(targetLang, "");
  }
  let providerLabel = "";
  logStaffTranslationBatch("Starting translate-all batch", {
    field: "description",
    source_lang: currentStaffSourceLang(),
    source_label: currentStaffSourceOption().label,
    total_targets: targets.length
  });

  for (let index = 0; index < targets.length; index += 1) {
    const targetLang = targets[index];
    logStaffTranslationBatch("Translating target language", {
      field: "description",
      current: index + 1,
      total: targets.length,
      target_lang: targetLang,
      target_label: staffLanguageLabel(targetLang),
      provider: providerLabel || "pending"
    });
    showEditorStatus(translationStatusMessage(
      backendT("backend.users.description_translation.translating_all", "Translating all description languages..."),
      { current: index + 1, total: targets.length, providerLabel }
    ));
    const translationResult = await requestDescriptionTranslation(targetLang, sourceText);
    if (!translationResult?.entries) {
      logStaffTranslationBatch("Translate-all batch failed", {
        field: "description",
        current: index + 1,
        total: targets.length,
        target_lang: targetLang,
        target_label: staffLanguageLabel(targetLang),
        provider: providerLabel || "unknown"
      }, true);
      showEditorStatus(backendT("backend.users.description_translation.error", "Could not translate the description."), true);
      return;
    }
    providerLabel = translationResult.providerLabel || providerLabel;
    setDescriptionValue(targetLang, translatedDescriptionValue(translationResult.entries, sourceText));
    logStaffTranslationBatch("Translated target language", {
      field: "description",
      current: index + 1,
      total: targets.length,
      target_lang: targetLang,
      target_label: staffLanguageLabel(targetLang),
      provider: providerLabel || "unknown"
    });
  }

  showEditorStatus(translationStatusMessage(
    backendT("backend.users.description_translation.all_done", "All description translations updated."),
    { current: targets.length, total: targets.length, providerLabel }
  ));
  logStaffTranslationBatch("Translate-all batch completed", {
    field: "description",
    total: targets.length,
    provider: providerLabel || "unknown"
  });
}

async function translateShortDescription(button) {
  const targetLang = normalizeText(button?.getAttribute("data-target-lang")).toLowerCase();
  const sourceInput = getShortDescriptionTextarea(currentStaffSourceLang());
  const targetInput = getShortDescriptionTextarea(targetLang);
  if (!targetLang || !sourceInput || !targetInput) return;

  const sourceText = String(sourceInput.value || "");
  if (!Object.keys(buildShortDescriptionTranslationEntries(sourceText)).length) {
    showEditorStatus(backendT("backend.users.short_description_translation.missing_source", "Add {language} short description first.", {
      language: currentStaffSourceOption().label
    }), true);
    return;
  }

  setShortDescriptionValue(targetLang, "");
  showEditorStatus(backendT("backend.users.short_description_translation.translating", "Translating short description..."));
  const translationResult = await requestShortDescriptionTranslation(targetLang, sourceText);
  if (!translationResult?.entries) {
    showEditorStatus(backendT("backend.users.short_description_translation.error", "Could not translate the short description."), true);
    return;
  }

  setShortDescriptionValue(targetLang, translatedShortDescriptionValue(translationResult.entries, sourceText));
  showEditorStatus(translationStatusMessage(
    backendT("backend.users.short_description_translation.done", "Short description translated."),
    { providerLabel: translationResult.providerLabel }
  ));
}

async function translateShortDescriptionToAll(button) {
  const field = normalizeText(button?.getAttribute("data-staff-translate-all")).toLowerCase();
  if (field !== "short-description") return;
  const sourceInput = getShortDescriptionTextarea(currentStaffSourceLang());
  if (!sourceInput) return;

  const sourceText = String(sourceInput.value || "");
  if (!Object.keys(buildShortDescriptionTranslationEntries(sourceText)).length) {
    showEditorStatus(backendT("backend.users.short_description_translation.missing_source", "Add {language} short description first.", {
      language: currentStaffSourceOption().label
    }), true);
    return;
  }

  const targets = translationTargetLanguages();
  if (!targets.length) return;

  for (const targetLang of targets) {
    setShortDescriptionValue(targetLang, "");
  }
  let providerLabel = "";
  logStaffTranslationBatch("Starting translate-all batch", {
    field: "short_description",
    source_lang: currentStaffSourceLang(),
    source_label: currentStaffSourceOption().label,
    total_targets: targets.length
  });

  for (let index = 0; index < targets.length; index += 1) {
    const targetLang = targets[index];
    logStaffTranslationBatch("Translating target language", {
      field: "short_description",
      current: index + 1,
      total: targets.length,
      target_lang: targetLang,
      target_label: staffLanguageLabel(targetLang),
      provider: providerLabel || "pending"
    });
    showEditorStatus(translationStatusMessage(
      backendT("backend.users.short_description_translation.translating_all", "Translating all short description languages..."),
      { current: index + 1, total: targets.length, providerLabel }
    ));
    const translationResult = await requestShortDescriptionTranslation(targetLang, sourceText);
    if (!translationResult?.entries) {
      logStaffTranslationBatch("Translate-all batch failed", {
        field: "short_description",
        current: index + 1,
        total: targets.length,
        target_lang: targetLang,
        target_label: staffLanguageLabel(targetLang),
        provider: providerLabel || "unknown"
      }, true);
      showEditorStatus(backendT("backend.users.short_description_translation.error", "Could not translate the short description."), true);
      return;
    }
    providerLabel = translationResult.providerLabel || providerLabel;
    setShortDescriptionValue(targetLang, translatedShortDescriptionValue(translationResult.entries, sourceText));
    logStaffTranslationBatch("Translated target language", {
      field: "short_description",
      current: index + 1,
      total: targets.length,
      target_lang: targetLang,
      target_label: staffLanguageLabel(targetLang),
      provider: providerLabel || "unknown"
    });
  }

  showEditorStatus(translationStatusMessage(
    backendT("backend.users.short_description_translation.all_done", "All short description translations updated."),
    { current: targets.length, total: targets.length, providerLabel }
  ));
  logStaffTranslationBatch("Translate-all batch completed", {
    field: "short_description",
    total: targets.length,
    provider: providerLabel || "unknown"
  });
}

function handleDestinationToggle(event) {
  const input = event.target.closest("[data-staff-destination]");
  if (!input) return;
  const set = new Set(Array.isArray(state.editor.destinations) ? state.editor.destinations : []);
  const value = normalizeStaffDestinationCode(input.getAttribute("data-staff-destination"));
  if (!value) return;
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

function normalizeShortDescriptionEntriesForSave() {
  const source = state.editor?.shortDescriptionByLang && typeof state.editor.shortDescriptionByLang === "object"
    ? state.editor.shortDescriptionByLang
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
  const destinations = Array.from(
    new Set(
      (Array.isArray(state.editor?.destinations) ? state.editor.destinations : [])
        .map((code) => normalizeStaffDestinationCode(code))
        .filter(Boolean)
    )
  );

  const positionI18n = normalizePositionEntriesForSave();
  const descriptionI18n = normalizeDescriptionEntriesForSave();
  const shortDescriptionI18n = normalizeShortDescriptionEntriesForSave();
  const teamOrder = parseTeamOrderInput(state.editor?.teamOrder);
  if (!teamOrder.valid) {
    showEditorStatus(backendT("backend.users.team_order_invalid", "Team order must be a whole number."), true);
    return;
  }
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
    let finalStatusMessage = backendT("backend.users.profile_saved", "ATP staff profile saved.");
    let finalStatusIsError = false;
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
          team_order: teamOrder.isSet ? teamOrder.value : null,
          appears_in_team_web_page: state.editor?.appearsInTeamWebPage !== false,
          languages,
          destinations,
          description_i18n: descriptionI18n,
          short_description_i18n: shortDescriptionI18n
        }
      });
      if (!payload?.user) return;
      latestUser = payload.user;
      if (homepageAssetSyncFailed(payload)) {
        finalStatusMessage = homepageAssetSyncWarningMessage();
        finalStatusIsError = true;
      }
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
      if (homepageAssetSyncFailed(picturePayload)) {
        finalStatusMessage = homepageAssetSyncWarningMessage();
        finalStatusIsError = true;
      }
    }
    applyUpdatedUser(latestUser);
    showEditorStatus(finalStatusMessage, finalStatusIsError);
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
  const items = getDisplayedKeycloakRoles(user);
  return items.length ? items.map((role) => escapeHtml(role)).join("<br>") : "-";
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
