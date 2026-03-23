import { authMeRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { validateAuthMeResponse } from "../../Generated/API/generated_APIModels.js";

export function resolveAuthBase(apiBase = "") {
  return String(apiBase || window.ASIATRAVELPLAN_API_BASE || window.location.origin).replace(/\/$/, "");
}

export function buildAuthLogoutHref({ apiBase = "", returnTo = "" } = {}) {
  const authBase = resolveAuthBase(apiBase);
  const resolvedReturnTo = String(returnTo || `${window.location.origin}/index.html`);
  return `${authBase}/auth/logout?return_to=${encodeURIComponent(resolvedReturnTo)}`;
}

export function wireAuthLogoutLink(link, { apiBase = "", returnTo = "" } = {}) {
  if (!link) return "";
  const href = buildAuthLogoutHref({ apiBase, returnTo });
  link.href = href;
  link.dataset.logoutHref = href;
  if (link.dataset.logoutBound !== "true") {
    link.addEventListener("click", (event) => {
      const targetHref = String(link.getAttribute("href") || link.dataset.logoutHref || "").trim();
      if (targetHref && targetHref !== "#") return;
      event.preventDefault();
      const fallbackHref = buildAuthLogoutHref({
        apiBase,
        returnTo: String(link.dataset.logoutReturnTo || returnTo || `${window.location.origin}/index.html`)
      });
      link.href = fallbackHref;
      window.location.assign(fallbackHref);
    });
    link.dataset.logoutBound = "true";
  }
  link.dataset.logoutReturnTo = String(returnTo || `${window.location.origin}/index.html`);
  return href;
}

export async function fetchAuthMe(apiBase = "") {
  const authBase = resolveAuthBase(apiBase);
  const request = authMeRequest({ baseURL: authBase });
  const response = await fetch(request.url, {
    method: request.method,
    credentials: "include",
    headers: request.headers
  });
  const payload = await response.json().catch(() => null);
  if (payload) validateAuthMeResponse(payload);
  return { request, response, payload };
}
