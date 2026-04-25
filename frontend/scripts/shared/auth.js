import { authMeRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { validateAuthMeResponse } from "../../Generated/API/generated_APIModels.js";
import { logLocalhostDiagnostic } from "./api.js";

const BACKEND_AUTH_CACHE_KEY = "asiatravelplan_backend_auth_me_v1";

export function resolveAuthBase(apiBase = "") {
  return String(apiBase || window.ASIATRAVELPLAN_API_BASE || window.location.origin).replace(/\/$/, "");
}

function normalizeCachedAuthPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.authenticated !== true || !payload.user || typeof payload.user !== "object") return null;
  const user = payload.user;
  return {
    authenticated: true,
    user: {
      sub: String(user.sub || "").trim(),
      preferred_username: String(user.preferred_username || "").trim(),
      email: String(user.email || "").trim(),
      roles: Array.isArray(user.roles) ? user.roles.map((role) => String(role || "").trim()).filter(Boolean) : []
    }
  };
}

export function readCachedAuthMe() {
  try {
    const raw = window.sessionStorage.getItem(BACKEND_AUTH_CACHE_KEY);
    if (!raw) return null;
    return normalizeCachedAuthPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearCachedAuthMe() {
  try {
    window.sessionStorage.removeItem(BACKEND_AUTH_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

function writeCachedAuthMe(payload) {
  try {
    const normalized = normalizeCachedAuthPayload(payload);
    if (!normalized) {
      clearCachedAuthMe();
      return;
    }
    window.sessionStorage.setItem(BACKEND_AUTH_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore cache write failures.
  }
}

export function buildAuthLogoutHref({ apiBase = "", returnTo = "" } = {}) {
  const authBase = resolveAuthBase(apiBase);
  const resolvedReturnTo = String(returnTo || `${window.location.origin}/`);
  return `${authBase}/auth/logout?return_to=${encodeURIComponent(resolvedReturnTo)}`;
}

export function wireAuthLogoutLink(link, { apiBase = "", returnTo = "" } = {}) {
  if (!link) return "";
  const href = buildAuthLogoutHref({ apiBase, returnTo });
  link.href = href;
  link.dataset.logoutHref = href;
  if (link.dataset.logoutBound !== "true") {
    link.addEventListener("click", (event) => {
      clearCachedAuthMe();
      const targetHref = String(link.getAttribute("href") || link.dataset.logoutHref || "").trim();
      if (targetHref && targetHref !== "#") return;
      event.preventDefault();
      const fallbackHref = buildAuthLogoutHref({
        apiBase,
        returnTo: String(link.dataset.logoutReturnTo || returnTo || `${window.location.origin}/`)
      });
      link.href = fallbackHref;
      window.location.assign(fallbackHref);
    });
    link.dataset.logoutBound = "true";
  }
  link.dataset.logoutReturnTo = String(returnTo || `${window.location.origin}/`);
  return href;
}

export async function fetchAuthMe(apiBase = "") {
  const authBase = resolveAuthBase(apiBase);
  const request = authMeRequest({ baseURL: authBase });
  logLocalhostDiagnostic("info", "auth/me request started", {
    request_url: request.url,
    method: request.method
  });
  let response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      credentials: "include",
      headers: request.headers
    });
  } catch (error) {
    logLocalhostDiagnostic("error", "auth/me request failed before a response", {
      request_url: request.url,
      method: request.method
    }, error);
    throw error;
  }
  const payload = await response.json().catch((error) => {
    logLocalhostDiagnostic("warn", "auth/me response body was not valid JSON", {
      request_url: request.url,
      status: response.status,
      status_text: response.statusText
    }, error);
    return null;
  });
  logLocalhostDiagnostic("info", "auth/me response received", {
    request_url: request.url,
    status: response.status,
    status_text: response.statusText,
    authenticated: payload?.authenticated === true
  });
  if (payload) {
    try {
      validateAuthMeResponse(payload);
    } catch (error) {
      logLocalhostDiagnostic("error", "auth/me payload validation failed", {
        request_url: request.url,
        status: response.status,
        payload_keys: Object.keys(payload || {})
      }, error);
      throw error;
    }
  }
  writeCachedAuthMe(payload);
  return { request, response, payload };
}
