import { logBrowserConsoleError } from "./api.js";
import { fetchAuthMe } from "./auth.js";
import { resolveBackendSectionHref } from "./nav.js";

export function backendT(id, fallback, vars) {
  if (typeof window.backendT === "function") {
    return window.backendT(id, fallback, vars);
  }
  const template = String(fallback ?? id);
  if (!vars || typeof vars !== "object") return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey in vars ? String(vars[normalizedKey]) : match;
  });
}

export async function waitForBackendI18n() {
  await (window.__BACKEND_I18N_PROMISE || Promise.resolve());
}

export function currentBackendLang() {
  return typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
}

export function withBackendLang(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const lang = currentBackendLang();
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

export function withBackendApiLang(pathname, params = {}) {
  return withBackendLang(pathname, params);
}

export function getBackendApiBase() {
  return String(window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
}

export function getBackendApiOrigin() {
  const apiBase = getBackendApiBase();
  return apiBase || window.location.origin;
}

export function refreshBackendNavElements({
  logoutLinkId = "backendLogoutLink",
  userLabelId = "backendUserLabel"
} = {}) {
  return {
    logoutLink: document.getElementById(logoutLinkId),
    userLabel: document.getElementById(userLabelId)
  };
}

export async function initializeBackendPageChrome({
  currentSection = "bookings",
  homeLink = null,
  refreshNav = refreshBackendNavElements
} = {}) {
  await waitForBackendI18n();
  const apiBase = getBackendApiBase();
  const apiOrigin = getBackendApiOrigin();
  const navElements = typeof refreshNav === "function" ? (refreshNav() || {}) : {};

  if (homeLink) {
    homeLink.href = resolveBackendSectionHref("bookings");
  }

  if (navElements.logoutLink) {
    const returnTo = `${window.location.origin}${withBackendLang("/index.html")}`;
    navElements.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  return {
    apiBase,
    apiOrigin,
    logoutLink: navElements.logoutLink || null,
    userLabel: navElements.userLabel || null
  };
}

export async function loadBackendPageAuthState({
  apiOrigin = getBackendApiOrigin(),
  refreshNav = refreshBackendNavElements,
  computePermissions = () => ({}),
  hasPageAccess = () => true,
  logKey = "backend-page",
  pageName = "backend.html",
  expectedRolesAnyOf = [],
  likelyCause = "The user is authenticated in Keycloak but does not have the ATP roles required to access this page."
} = {}) {
  const navElements = typeof refreshNav === "function" ? (refreshNav() || {}) : {};
  const userLabel = navElements.userLabel || null;

  try {
    const { request, response, payload } = await fetchAuthMe(apiOrigin);
    if (!response.ok || !payload?.authenticated) {
      if (userLabel) userLabel.textContent = "";
      return {
        authUser: null,
        roles: [],
        permissions: {},
        request,
        response,
        payload
      };
    }

    const authUser = payload.user || null;
    const roles = Array.isArray(authUser?.roles) ? authUser.roles : [];
    const permissions = computePermissions(roles, authUser) || {};

    if (userLabel) {
      userLabel.textContent = authUser?.preferred_username || authUser?.email || authUser?.sub || "";
    }

    if (!hasPageAccess(permissions, roles, authUser)) {
      logBrowserConsoleError(
        `[${logKey}] Authenticated user cannot access ${pageName}. ${pageName} will remain empty until the required roles are granted.`,
        {
          page_url: window.location.href,
          auth_me_url: request.url,
          authenticated_user: {
            id: authUser?.sub || "",
            username: authUser?.preferred_username || "",
            email: authUser?.email || ""
          },
          roles,
          computed_permissions: permissions,
          expected_roles_any_of: expectedRolesAnyOf.filter(Boolean),
          likely_cause: likelyCause
        }
      );
    }

    return {
      authUser,
      roles,
      permissions,
      request,
      response,
      payload
    };
  } catch (error) {
    if (userLabel) userLabel.textContent = "";
    logBrowserConsoleError(
      `[${logKey}] Failed to load backend authentication status for ${pageName}.`,
      {
        page_url: window.location.href,
        auth_me_url: `${String(apiOrigin || window.location.origin).replace(/\/$/, "")}/auth/me`
      },
      error
    );
    return {
      authUser: null,
      roles: [],
      permissions: {}
    };
  }
}
