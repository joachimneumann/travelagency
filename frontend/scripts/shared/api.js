import { escapeHtml, normalizeText } from "../../../shared/js/text.js?v=693624dd6d2c";

export { escapeHtml, normalizeText } from "../../../shared/js/text.js?v=693624dd6d2c";

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

export async function fetchApiJson(path, options = {}) {
  const {
    apiBase = "",
    method = "GET",
    body,
    suppressNotFound = false,
    onError = null,
    onSuccess = null,
    connectionErrorMessage = "Could not connect to backend API.",
    includeDetailInError = true
  } = options;

  try {
    const response = await fetch(resolveApiUrl(apiBase, path), {
      method,
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
      if (typeof onError === "function") onError(message, payload, response);
      return null;
    }

    if (typeof onSuccess === "function") onSuccess(payload, response);
    return payload;
  } catch (error) {
    if (typeof onError === "function") onError(connectionErrorMessage, null, null, error);
    console.error(error);
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
      connectionErrorMessage: options.connectionErrorMessage || connectionErrorMessage
    });
  };
}
