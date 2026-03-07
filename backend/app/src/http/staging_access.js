import { createHmac, timingSafeEqual } from "node:crypto";
import { URL } from "node:url";
import { escapeHtml, normalizeText } from "../../../../shared/js/text.js";

export function createStagingAccessHandlers({
  enabled,
  password,
  cookieSecret,
  cookieName,
  maxAgeSeconds,
  redirect,
  appendSetCookie,
  sendJson,
  sendHtml,
  readBodyText
}) {
  function parseCookies(req) {
    const cookieHeader = String(req.headers.cookie || "");
    const cookies = {};
    for (const segment of cookieHeader.split(";")) {
      const [rawKey, ...rest] = segment.trim().split("=");
      if (!rawKey) continue;
      cookies[rawKey] = decodeURIComponent(rest.join("=") || "");
    }
    return cookies;
  }

  function signStagingAccessCookie(value) {
    return createHmac("sha256", cookieSecret).update(String(value || ""), "utf8").digest("hex");
  }

  function safeEqualText(a, b) {
    const left = Buffer.from(String(a || ""), "utf8");
    const right = Buffer.from(String(b || ""), "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }

  function hasValidStagingAccess(req) {
    if (!enabled) return true;
    if (!password || !cookieSecret) return false;
    const cookies = parseCookies(req);
    const actual = normalizeText(cookies[cookieName]);
    const expected = signStagingAccessCookie(password);
    return Boolean(actual && expected && safeEqualText(actual, expected));
  }

  function setStagingAccessCookie(res) {
    const value = signStagingAccessCookie(password);
    appendSetCookie(
      res,
      `${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
    );
  }

  function clearStagingAccessCookie(res) {
    appendSetCookie(res, `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }

  function normalizeReturnToPath(value, fallback = "/") {
    const raw = normalizeText(value);
    if (!raw) return fallback;
    if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
    if (raw.startsWith("/staging-access/")) return fallback;
    return raw;
  }

  function getForwardedPath(req) {
    const forwardedUri = normalizeText(req.headers["x-forwarded-uri"]);
    if (forwardedUri) return normalizeReturnToPath(forwardedUri, "/");
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeReturnToPath(`${requestUrl.pathname}${requestUrl.search}`, "/");
    } catch {
      return "/";
    }
  }

  function renderStagingAccessLogin({ error = "", returnTo = "/" } = {}) {
    const safeReturnTo = normalizeReturnToPath(returnTo, "/");
    const errorBlock = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Staging Access | AsiaTravelPlan</title>
    <style>
      :root {
        --ink: #16222d;
        --muted: #5f6f7a;
        --line: #d9e1e6;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        font-family: "Segoe UI", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #f6f9fa 0%, #eef3f5 100%);
      }
      .card {
        width: min(440px, 100%);
        background: rgba(255,255,255,0.96);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 18px 48px rgba(16, 33, 45, 0.10);
        padding: 2rem;
      }
      h1 { margin: 0 0 0.75rem; font-size: 1.8rem; }
      p { margin: 0 0 1rem; color: var(--muted); }
      label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
      input[type="password"] {
        width: 100%;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--line);
        border-radius: 12px;
        font: inherit;
      }
      button {
        width: 100%;
        margin-top: 1rem;
        border: 0;
        border-radius: 12px;
        padding: 0.85rem 1rem;
        background: #163040;
        color: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .error {
        color: #a33434;
        background: #fff0f0;
        border: 1px solid #f0cccc;
        border-radius: 12px;
        padding: 0.75rem 0.9rem;
      }
      .micro { margin-top: 1rem; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Staging Access</h1>
      <p>This environment is password-protected and not intended for public access.</p>
      ${errorBlock}
      <form method="post" action="/staging-access/login">
        <input type="hidden" name="return_to" value="${escapeHtml(safeReturnTo)}" />
        <label for="stagingAccessPassword">Password</label>
        <input id="stagingAccessPassword" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Continue</button>
      </form>
      <p class="micro">Access is remembered with a secure cookie for approximately ${Math.round(
        maxAgeSeconds / (60 * 60 * 24)
      )} days.</p>
    </main>
  </body>
</html>`;
  }

  async function handleStagingAccessLoginPage(req, res) {
    if (!enabled) {
      redirect(res, "/");
      return;
    }
    const requestUrl = new URL(req.url, "http://localhost");
    const returnTo = normalizeReturnToPath(requestUrl.searchParams.get("return_to"), "/");
    if (hasValidStagingAccess(req)) {
      redirect(res, returnTo);
      return;
    }
    sendHtml(res, 200, renderStagingAccessLogin({ returnTo }));
  }

  async function handleStagingAccessLoginSubmit(req, res) {
    if (!enabled) {
      redirect(res, "/");
      return;
    }
    const contentType = normalizeText(req.headers["content-type"]).toLowerCase();
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      sendJson(res, 415, { error: "Expected form submission" });
      return;
    }
    const body = await readBodyText(req);
    const params = new URLSearchParams(body);
    const submittedPassword = String(params.get("password") || "");
    const returnTo = normalizeReturnToPath(params.get("return_to"), "/");
    if (!password || !cookieSecret) {
      sendHtml(res, 500, renderStagingAccessLogin({ error: "Staging access is not configured.", returnTo }));
      return;
    }
    if (!safeEqualText(submittedPassword, password)) {
      sendHtml(res, 401, renderStagingAccessLogin({ error: "Incorrect password.", returnTo }));
      return;
    }
    setStagingAccessCookie(res);
    redirect(res, returnTo);
  }

  async function handleStagingAccessCheck(req, res) {
    if (!enabled || hasValidStagingAccess(req)) {
      res.writeHead(204);
      res.end();
      return;
    }
    const returnTo = getForwardedPath(req);
    redirect(res, `/staging-access/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  async function handleStagingAccessLogout(_req, res) {
    clearStagingAccessCookie(res);
    redirect(res, "/staging-access/login");
  }

  return {
    safeEqualText,
    handleStagingAccessLoginPage,
    handleStagingAccessLoginSubmit,
    handleStagingAccessCheck,
    handleStagingAccessLogout
  };
}
