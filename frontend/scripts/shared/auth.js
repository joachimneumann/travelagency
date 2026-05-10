import { authMeRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { validateAuthMeResponse } from "../../Generated/API/generated_APIModels.js";
import { logLocalhostDiagnostic } from "./api.js";

const BACKEND_AUTH_CACHE_KEY = "asiatravelplan_backend_auth_me_v1";
const DEFAULT_AUTH_CACHE_MAX_AGE_MS = 15_000;
const inFlightAuthMeRequests = new Map();

function sharedInFlightAuthMeRequests() {
  if (typeof window === "undefined") return inFlightAuthMeRequests;
  if (!(window.__BACKEND_AUTH_ME_IN_FLIGHT_REQUESTS__ instanceof Map)) {
    window.__BACKEND_AUTH_ME_IN_FLIGHT_REQUESTS__ = new Map();
  }
  return window.__BACKEND_AUTH_ME_IN_FLIGHT_REQUESTS__;
}

export function resolveAuthBase(apiBase = "") {
  return String(apiBase || window.ASIATRAVELPLAN_API_BASE || window.location.origin).replace(/\/$/, "");
}

function normalizeCachedAuthPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  const cachedAt = Number(payload.cached_at || payload.cachedAt || 0);
  if (payload.authenticated !== true || !payload.user || typeof payload.user !== "object") return null;
  const user = payload.user;
  return {
    authenticated: true,
    cached_at: Number.isFinite(cachedAt) && cachedAt > 0 ? cachedAt : 0,
    user: {
      sub: String(user.sub || "").trim(),
      preferred_username: String(user.preferred_username || "").trim(),
      email: String(user.email || "").trim(),
      roles: Array.isArray(user.roles) ? user.roles.map((role) => String(role || "").trim()).filter(Boolean) : []
    }
  };
}

export function readCachedAuthMe({ maxAgeMs = 0 } = {}) {
  try {
    const raw = window.sessionStorage.getItem(BACKEND_AUTH_CACHE_KEY);
    if (!raw) return null;
    const cached = normalizeCachedAuthPayload(JSON.parse(raw));
    if (!cached) return null;
    const ttl = Number(maxAgeMs);
    if (Number.isFinite(ttl) && ttl > 0) {
      if (!cached.cached_at || Date.now() - cached.cached_at > ttl) return null;
    }
    return cached;
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
    window.sessionStorage.setItem(BACKEND_AUTH_CACHE_KEY, JSON.stringify({
      ...normalized,
      cached_at: Date.now()
    }));
  } catch {
    // Ignore cache write failures.
  }
}

function dispatchBackendAuthReady(payload) {
  if (typeof window === "undefined" || !payload?.authenticated) return;
  window.dispatchEvent(new CustomEvent("backend-auth-ready", {
    detail: { payload }
  }));
}

export function readCachedAuthMeResult(apiBase = "", options = {}) {
  const payload = readCachedAuthMe(options);
  if (!payload) return null;
  const authBase = resolveAuthBase(apiBase);
  const request = authMeRequest({ baseURL: authBase });
  return {
    request,
    response: {
      ok: true,
      status: 200,
      statusText: "OK",
      url: request.url,
      cached: true
    },
    payload,
    cached: true
  };
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

export async function fetchAuthMe(apiBase = "", options = {}) {
  const authBase = resolveAuthBase(apiBase);
  const allowCached = options?.allowCached === true;
  const cacheMaxAgeMs = Number(options?.cacheMaxAgeMs || DEFAULT_AUTH_CACHE_MAX_AGE_MS);
  if (allowCached) {
    const cachedResult = readCachedAuthMeResult(authBase, { maxAgeMs: cacheMaxAgeMs });
    if (cachedResult) {
      dispatchBackendAuthReady(cachedResult.payload);
      return cachedResult;
    }
  }

  const request = authMeRequest({ baseURL: authBase });
  const cacheKey = request.url;
  if (
    options?.force !== true
    && typeof window !== "undefined"
    && window.__BACKEND_AUTH_ME_PROMISE_URL === cacheKey
    && typeof window.__BACKEND_AUTH_ME_PROMISE?.then === "function"
  ) {
    return window.__BACKEND_AUTH_ME_PROMISE;
  }
  const sharedInFlight = sharedInFlightAuthMeRequests();
  if (options?.force !== true && sharedInFlight.has(cacheKey)) {
    return sharedInFlight.get(cacheKey);
  }

  const fetchPromise = (async () => {
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
  dispatchBackendAuthReady(payload);
  return { request, response, payload };
  })();

  sharedInFlight.set(cacheKey, fetchPromise);
  if (typeof window !== "undefined") {
    window.__BACKEND_AUTH_ME_PROMISE_URL = cacheKey;
    window.__BACKEND_AUTH_ME_PROMISE = fetchPromise;
  }
  try {
    return await fetchPromise;
  } finally {
    if (sharedInFlight.get(cacheKey) === fetchPromise) {
      sharedInFlight.delete(cacheKey);
    }
    if (typeof window !== "undefined" && window.__BACKEND_AUTH_ME_PROMISE === fetchPromise) {
      window.__BACKEND_AUTH_ME_PROMISE = null;
      window.__BACKEND_AUTH_ME_PROMISE_URL = "";
    }
  }
}
