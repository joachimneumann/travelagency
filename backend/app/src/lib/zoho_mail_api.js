function normalizeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function trimTrailingSlash(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function zohoError(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  return error;
}

export function createZohoMailApiClient({
  accountsBaseUrl = "https://accounts.zoho.com",
  mailApiBaseUrl = "https://mail.zoho.com",
  clientId,
  clientSecret,
  refreshToken,
  accountId,
  fromEmail,
  fetchImpl = globalThis.fetch
} = {}) {
  const safeAccountsBaseUrl = trimTrailingSlash(accountsBaseUrl) || "https://accounts.zoho.com";
  const safeMailApiBaseUrl = trimTrailingSlash(mailApiBaseUrl) || "https://mail.zoho.com";
  const safeClientId = normalizeText(clientId);
  const safeClientSecret = String(clientSecret || "");
  const safeRefreshToken = normalizeText(refreshToken);
  const safeAccountId = normalizeText(accountId);
  const safeFromEmail = normalizeText(fromEmail);
  let accessToken = "";
  let accessTokenExpiresAt = 0;

  if (typeof fetchImpl !== "function") throw new Error("Fetch is not available for Zoho Mail API.");
  if (!safeClientId) throw new Error("ZOHO_CLIENT_ID is not configured.");
  if (!safeClientSecret) throw new Error("ZOHO_CLIENT_SECRET is not configured.");
  if (!safeRefreshToken) throw new Error("ZOHO_REFRESH_TOKEN is not configured.");
  if (!safeAccountId) throw new Error("ZOHO_ACCOUNT_ID is not configured.");
  if (!safeFromEmail) throw new Error("WEB_INQUIRY_NOTIFICATION_FROM is not configured.");

  async function refreshAccessToken() {
    const tokenUrl = new URL(`${safeAccountsBaseUrl}/oauth/v2/token`);
    tokenUrl.searchParams.set("refresh_token", safeRefreshToken);
    tokenUrl.searchParams.set("grant_type", "refresh_token");
    tokenUrl.searchParams.set("client_id", safeClientId);
    tokenUrl.searchParams.set("client_secret", safeClientSecret);

    const response = await fetchImpl(tokenUrl, { method: "POST" });
    const payload = await readJsonResponse(response);
    if (!response.ok || !normalizeText(payload?.access_token)) {
      throw zohoError("Zoho access token refresh failed.", {
        status: response.status,
        code: payload?.error || payload?.status?.code || "",
        description: payload?.error_description || payload?.status?.description || payload?.data?.moreInfo || ""
      });
    }

    accessToken = normalizeText(payload.access_token);
    const expiresInSeconds = Math.max(60, Number(payload.expires_in || 3600) || 3600);
    accessTokenExpiresAt = Date.now() + Math.max(1, expiresInSeconds - 60) * 1000;
    return accessToken;
  }

  async function getAccessToken() {
    if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;
    return refreshAccessToken();
  }

  async function postMessage(accessTokenValue, { to, subject, htmlBody }) {
    const response = await fetchImpl(`${safeMailApiBaseUrl}/api/accounts/${encodeURIComponent(safeAccountId)}/messages`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-oauthtoken ${accessTokenValue}`
      },
      body: JSON.stringify({
        fromAddress: safeFromEmail,
        toAddress: normalizeText(to),
        subject: normalizeText(subject),
        content: String(htmlBody || ""),
        mailFormat: "html",
        encoding: "UTF-8"
      })
    });
    const payload = await readJsonResponse(response);
    return { response, payload };
  }

  async function sendMessage({ to, subject, htmlBody }) {
    if (!normalizeText(to)) throw new Error("WEB_INQUIRY_NOTIFICATION_TO is not configured.");
    if (!normalizeText(subject)) throw new Error("Zoho Mail API email requires a subject.");

    let token = await getAccessToken();
    let { response, payload } = await postMessage(token, { to, subject, htmlBody });
    if (response.status === 401) {
      accessToken = "";
      accessTokenExpiresAt = 0;
      token = await getAccessToken();
      ({ response, payload } = await postMessage(token, { to, subject, htmlBody }));
    }

    const zohoStatusCode = Number(payload?.status?.code || response.status);
    if (!response.ok || zohoStatusCode >= 400) {
      throw zohoError("Zoho Mail API send failed.", {
        status: response.status,
        code: payload?.status?.code || "",
        description: payload?.status?.description || payload?.data?.moreInfo || ""
      });
    }

    return {
      messageId: normalizeText(payload?.data?.messageId || payload?.data?.mailId || "")
    };
  }

  return Object.freeze({ sendMessage });
}
