import { authMeRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { validateAuthMeResponse } from "../../Generated/API/generated_APIModels.js";

export async function fetchAuthMe(apiBase = "") {
  const authBase = String(apiBase || window.location.origin).replace(/\/$/, "");
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
