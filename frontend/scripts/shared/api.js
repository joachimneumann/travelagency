import { escapeHtml, normalizeText } from "../../../shared/js/text.js";

export { escapeHtml, normalizeText } from "../../../shared/js/text.js";

export function resolveApiUrl(apiBase, pathOrUrl) {
  const base = String(apiBase || "").replace(/\/$/, "");
  const value = String(pathOrUrl || "");
  if (/^https?:\/\//.test(value)) return value;
  return `${base}${value}`;
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export function setDirtySurface(element, isDirty) {
  if (!element) return;
  element.classList.add("backend-dirty-frame");
  element.classList.toggle("backend-dirty-surface", Boolean(isDirty));
}

export function logBrowserConsoleError(message, details = {}, error = null) {
  const payload = details && typeof details === "object" ? { ...details } : { details };
  if (error) {
    payload.error_name = error?.name || null;
    payload.error_message = error?.message || String(error);
    if (error?.stack) payload.error_stack = error.stack;
    console.error(message, payload, error);
    return;
  }
  console.error(message, payload);
}

export function isLocalhostBrowser() {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

export function logLocalhostDiagnostic(level, message, details = {}, error = null) {
  if (!isLocalhostBrowser()) return;
  const logger = window.__ATP_LOCALHOST_DIAGNOSTICS_LOG__;
  if (logger && typeof logger[level] === "function") {
    logger[level](message, details, error);
    return;
  }

  const payload = details && typeof details === "object" ? { ...details } : { details };
  if (error) {
    payload.error_name = error?.name || null;
    payload.error_message = error?.message || String(error);
    console.error(`[localhost-diagnostics] ${message}`, payload, error);
    return;
  }

  const method = typeof console[level] === "function" ? level : "info";
  console[method](`[localhost-diagnostics] ${message}`, payload);
}

export function translationProviderMetaFromResponse(response) {
  if (!response?.headers || typeof response.headers.get !== "function") return null;
  const provider = normalizeText(response.headers.get("X-ATP-Translation-Provider"));
  const model = normalizeText(response.headers.get("X-ATP-Translation-Provider-Model"));
  const display = normalizeText(
    response.headers.get("X-ATP-Translation-Provider-Display")
    || (provider === "openai" ? model : provider)
  );
  if (!provider && !model && !display) return null;
  return {
    provider,
    model,
    display
  };
}

export async function fetchApiJson(path, options = {}) {
  const {
    apiBase = "",
    method = "GET",
    body,
    suppressNotFound = false,
    onError = null,
    onSuccess = null,
    connectionErrorMessage = "Could not connect to backend API.",
    includeDetailInError = true,
    cache = "",
    includeResponseMeta = false
  } = options;
  const url = resolveApiUrl(apiBase, path);
  const requestMeta = {
    method,
    url,
    ...(body !== undefined ? { request_body: body } : {})
  };

  try {
    const response = await fetch(url, {
      method,
      ...(cache ? { cache } : {}),
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (suppressNotFound && response.status === 404) return null;
      const message = includeDetailInError && payload?.detail
        ? `${payload.error || "Request failed"}: ${payload.detail}`
        : payload?.error || "Request failed";
      logLocalhostDiagnostic("warn", "backend request returned a non-OK response", {
        ...requestMeta,
        status: response.status,
        status_text: response.statusText,
        response_payload: payload
      });
      logBrowserConsoleError("[api] Backend request failed.", {
        ...requestMeta,
        status: response.status,
        status_text: response.statusText,
        response_payload: payload,
        suppress_not_found: suppressNotFound,
        include_detail_in_error: includeDetailInError
      });
      if (typeof onError === "function") onError(message, payload, response);
      return null;
    }

    const responseMeta = includeResponseMeta
      ? {
          translationProvider: translationProviderMetaFromResponse(response)
        }
      : null;
    if (typeof onSuccess === "function") onSuccess(payload, response);
    return includeResponseMeta ? { payload, responseMeta } : payload;
  } catch (error) {
    if (typeof onError === "function") onError(connectionErrorMessage, null, null, error);
    logLocalhostDiagnostic("error", "backend request failed before a response", {
      ...requestMeta,
      connection_error_message: connectionErrorMessage
    }, error);
    logBrowserConsoleError("[api] Network error while calling backend.", {
      ...requestMeta,
      connection_error_message: connectionErrorMessage
    }, error);
    return null;
  }
}

export function createApiFetcher(config = {}) {
  const {
    apiBase = "",
    onError = null,
    onSuccess = null,
    connectionErrorMessage = "Could not connect to backend API.",
    suppressNotFound = false,
    includeDetailInError = true
  } = config;

  return function fetchApi(path, options = {}) {
    return fetchApiJson(path, {
      apiBase,
      method: options.method || "GET",
      body: options.body,
      suppressNotFound: options.suppressNotFound ?? suppressNotFound,
      includeDetailInError: options.includeDetailInError ?? includeDetailInError,
      onError,
      onSuccess,
      connectionErrorMessage: options.connectionErrorMessage || connectionErrorMessage,
      cache: options.cache,
      includeResponseMeta: options.includeResponseMeta
    });
  };
}
