import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { normalizeText } from "./lib/text.js";

export function createAuth({ port }) {
  const cfg = {
    keycloakEnabled: parseBoolEnv("KEYCLOAK_ENABLED", false),
    keycloakBaseUrl: normalizeText(process.env.KEYCLOAK_BASE_URL),
    keycloakRealm: normalizeText(process.env.KEYCLOAK_REALM),
    keycloakClientId: normalizeText(process.env.KEYCLOAK_CLIENT_ID),
    keycloakClientSecret: normalizeText(process.env.KEYCLOAK_CLIENT_SECRET),
    keycloakRedirectUri: normalizeText(process.env.KEYCLOAK_REDIRECT_URI || `http://localhost:${port}/auth/callback`),
    keycloakPostLogoutRedirectUri: normalizeText(process.env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI),
    keycloakForceLoginPrompt: parseBoolEnv("KEYCLOAK_FORCE_LOGIN_PROMPT", false),
    keycloakAllowedRoles: new Set(
      String(process.env.KEYCLOAK_ALLOWED_ROLES || "atp_admin,atp_manager,atp_accountant,atp_staff,atp_tour_editor")
        .split(",")
        .map((value) => normalizeText(value))
        .filter(Boolean)
    ),
    insecureTestAuth: parseBoolEnv("INSECURE_TEST_AUTH", false),
    returnToAllowedOrigins: new Set(
      String(process.env.RETURN_TO_ALLOWED_ORIGINS || `http://localhost:8080,http://127.0.0.1:8080,http://localhost:${port},http://127.0.0.1:${port}`)
        .split(",")
        .map((value) => normalizeText(value))
        .filter(Boolean)
    ),
    sessionCookieName: "asiatravelplan_session",
    sessionMaxAgeSeconds: 60 * 60 * 8,
    authRequestTtlMs: 10 * 60 * 1000
  };

  const sessionMaxAgeMs = cfg.sessionMaxAgeSeconds * 1000;
  const sessions = new Map();
  const authRequests = new Map();
  let keycloakDiscoveryPromise = null;
  let keycloakJwks = null;

  const routes = [
    { method: "GET", pattern: /^\/auth\/login$/, handler: handleAuthLogin },
    { method: "GET", pattern: /^\/auth\/callback$/, handler: handleAuthCallback },
    { method: "GET", pattern: /^\/auth\/logout$/, handler: handleAuthLogout }
  ];

  function isKeycloakEnabled() {
    return cfg.keycloakEnabled;
  }

  function getLoginRedirect(returnTo) {
    return `/auth/login?return_to=${encodeURIComponent(returnTo || "/bookings.html")}`;
  }

  function hasSession(req) {
    return Boolean(getSessionFromRequest(req));
  }

  function pruneState() {
    const now = Date.now();

    for (const [sid, session] of sessions.entries()) {
      if (!session || Number(session.expires_at) <= now) {
        sessions.delete(sid);
      }
    }

    for (const [state, requestState] of authRequests.entries()) {
      if (!requestState || now - Number(requestState.created_at || 0) > cfg.authRequestTtlMs) {
        authRequests.delete(state);
      }
    }
  }

  async function authorizeApiRequest(req, _requestUrl) {
    if (!cfg.keycloakEnabled) return { ok: false };

    const session = getSessionPrincipal(req);
    if (session) {
      return { ok: true, principal: session };
    }

    const testPrincipal = getInsecureTestPrincipal(req);
    if (testPrincipal) {
      const hasRole = testPrincipal.roles.some((role) => cfg.keycloakAllowedRoles.has(role));
      return { ok: hasRole, principal: testPrincipal };
    }

    const authHeader = normalizeText(req.headers.authorization);
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      try {
        const payload = await verifyKeycloakToken(token);
        const roles = extractRolesFromPayload(payload);
        const hasRole = roles.some((role) => cfg.keycloakAllowedRoles.has(role));
        return {
          ok: hasRole,
          principal: {
            type: "bearer",
            sub: String(payload.sub || ""),
            name: String(payload.name || ""),
            given_name: String(payload.given_name || ""),
            family_name: String(payload.family_name || ""),
            preferred_username: String(payload.preferred_username || ""),
            email: String(payload.email || ""),
            roles
          }
        };
      } catch {
        return { ok: false };
      }
    }

    return { ok: false };
  }

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

  function appendSetCookie(res, cookieValue) {
    const previous = res.getHeader("Set-Cookie");
    if (!previous) {
      res.setHeader("Set-Cookie", [cookieValue]);
      return;
    }
    const list = Array.isArray(previous) ? previous : [String(previous)];
    list.push(cookieValue);
    res.setHeader("Set-Cookie", list);
  }

  function setSessionCookie(res, sessionId) {
    appendSetCookie(
      res,
      `${cfg.sessionCookieName}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cfg.sessionMaxAgeSeconds}`
    );
  }

  function clearSessionCookie(res) {
    appendSetCookie(res, `${cfg.sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  function getSessionFromRequest(req) {
    const cookies = parseCookies(req);
    const sid = normalizeText(cookies[cfg.sessionCookieName]);
    if (!sid) return null;
    const session = sessions.get(sid);
    if (!session) return null;
    if (Number(session.expires_at) <= Date.now()) {
      sessions.delete(sid);
      return null;
    }
    return { ...session, sid };
  }

  function getSessionPrincipal(req) {
    const session = getSessionFromRequest(req);
    if (!session) return null;
    return {
      type: "session",
      sub: String(session.sub || ""),
      name: String(session.name || ""),
      given_name: String(session.given_name || ""),
      family_name: String(session.family_name || ""),
      preferred_username: String(session.preferred_username || ""),
      email: String(session.email || ""),
      roles: Array.isArray(session.roles) ? session.roles : [],
      access_token: String(session.access_token || "")
    };
  }

  function msToIso(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
    try {
      return new Date(timestamp).toISOString();
    } catch {
      return null;
    }
  }

  function listActiveSessions() {
    pruneState();
    return Array.from(sessions.entries())
      .map(([sid, session]) => ({
        sid,
        sub: String(session?.sub || ""),
        name: String(session?.name || ""),
        given_name: String(session?.given_name || ""),
        family_name: String(session?.family_name || ""),
        preferred_username: String(session?.preferred_username || ""),
        email: String(session?.email || ""),
        roles: Array.isArray(session?.roles) ? session.roles : [],
        created_at: msToIso(session?.created_at),
        expires_at: msToIso(session?.expires_at)
      }))
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  }

  function getInsecureTestPrincipal(req) {
    if (!cfg.insecureTestAuth) return null;
    const roles = String(req.headers["x-test-roles"] || "")
      .split(",")
      .map((value) => normalizeText(value))
      .filter(Boolean);
    if (!roles.length) return null;
    return {
      type: "insecure-test",
      sub: normalizeText(req.headers["x-test-sub"]) || "test-user",
      name: normalizeText(req.headers["x-test-name"]) || "",
      given_name: normalizeText(req.headers["x-test-given-name"]) || "",
      family_name: normalizeText(req.headers["x-test-family-name"]) || "",
      preferred_username: normalizeText(req.headers["x-test-username"]) || "test-user",
      email: normalizeText(req.headers["x-test-email"]) || "test@asiatravelplan.com",
      roles
    };
  }

  function extractRolesFromPayload(payload) {
    const realmRoles = Array.isArray(payload?.realm_access?.roles) ? payload.realm_access.roles : [];
    const clientRoles = Array.isArray(payload?.resource_access?.[cfg.keycloakClientId]?.roles)
      ? payload.resource_access[cfg.keycloakClientId].roles
      : [];
    const mappedRoles = Array.isArray(payload?.roles) ? payload.roles : [];
    const groups = Array.isArray(payload?.groups) ? payload.groups : [];
    const groupAliases = groups.flatMap((group) => {
      const raw = normalizeText(group);
      if (!raw) return [];
      const shortName = raw.split("/").filter(Boolean).pop() || raw;
      return [raw, shortName];
    });
    return Array.from(new Set(
      [...realmRoles, ...clientRoles, ...mappedRoles, ...groupAliases]
        .map((role) => normalizeText(role).toLowerCase())
        .filter(Boolean)
    ));
  }

  async function getKeycloakDiscovery() {
    if (!cfg.keycloakEnabled) return null;
    if (!keycloakDiscoveryPromise) {
      const issuer = `${cfg.keycloakBaseUrl}/realms/${cfg.keycloakRealm}`;
      const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
      keycloakDiscoveryPromise = fetch(discoveryUrl)
        .then(async (response) => {
          if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Keycloak discovery HTTP ${response.status} at ${discoveryUrl}: ${detail || "no response body"}`);
          }
          const discovery = await response.json();
          return { ...discovery, issuer };
        })
        .catch((error) => {
          keycloakDiscoveryPromise = null;
          throw new Error(
            `Keycloak discovery fetch failed at ${discoveryUrl}. Check KEYCLOAK_BASE_URL/KEYCLOAK_REALM and that Keycloak is reachable. Root error: ${String(
              error?.message || error
            )}`
          );
        });
    }
    return keycloakDiscoveryPromise;
  }

  async function verifyKeycloakToken(accessToken) {
    const discovery = await getKeycloakDiscovery();
    if (!discovery) throw new Error("Keycloak disabled");
    if (!keycloakJwks) {
      keycloakJwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
    }
    const { payload } = await jwtVerify(accessToken, keycloakJwks, {
      issuer: discovery.issuer
    });
    return payload;
  }

  function requireKeycloakConfigured() {
    if (!cfg.keycloakEnabled) return { ok: false, error: "Keycloak auth is disabled" };
    const missing = [
      ["KEYCLOAK_BASE_URL", cfg.keycloakBaseUrl],
      ["KEYCLOAK_REALM", cfg.keycloakRealm],
      ["KEYCLOAK_CLIENT_ID", cfg.keycloakClientId],
      ["KEYCLOAK_CLIENT_SECRET", cfg.keycloakClientSecret]
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missing.length) {
      return { ok: false, error: `Missing Keycloak config: ${missing.join(", ")}` };
    }
    return { ok: true };
  }

  function buildSafeReturnTo(value, fallback = "/bookings.html") {
    const raw = normalizeText(value);
    if (!raw) return fallback;

    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;

    try {
      const parsed = new URL(raw);
      if (cfg.returnToAllowedOrigins.has(parsed.origin)) {
        return parsed.toString();
      }
    } catch {
      // ignore
    }

    return fallback;
  }

  function isRootLikePath(pathname) {
    return pathname === "/" || pathname === "/index.html";
  }

  function isLoopbackHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  function sameLogoutOriginAlias(left, right) {
    if (left.origin === right.origin) return true;
    return (
      left.protocol === right.protocol &&
      left.port === right.port &&
      isLoopbackHost(left.hostname) &&
      isLoopbackHost(right.hostname)
    );
  }

  function normalizeLogoutReturnTo(value) {
    const raw = normalizeText(value);
    const configured = normalizeText(cfg.keycloakPostLogoutRedirectUri);
    if (!raw) return configured || "/bookings.html";
    if (!configured) return raw;

    try {
      const parsedRaw = new URL(raw, "http://localhost");
      const parsedConfigured = new URL(configured, "http://localhost");
      if (
        sameLogoutOriginAlias(parsedRaw, parsedConfigured) &&
        isRootLikePath(parsedRaw.pathname) &&
        isRootLikePath(parsedConfigured.pathname) &&
        !parsedRaw.search &&
        !parsedRaw.hash
      ) {
        return configured;
      }
    } catch {
      // Ignore and fall back to the validated caller-provided value.
    }

    return raw;
  }

  function getRequestOrigin(req) {
    const forwardedProto = normalizeText(req.headers["x-forwarded-proto"]);
    const proto = forwardedProto || (req.socket?.encrypted ? "https" : "http");
    const host = normalizeText(req.headers["x-forwarded-host"] || req.headers.host);
    if (!host) return "";
    return `${proto}://${host}`;
  }

  function resolveAuthRedirectUri(req) {
    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin) return cfg.keycloakRedirectUri;
    try {
      return new URL("/auth/callback", requestOrigin).toString();
    } catch {
      return cfg.keycloakRedirectUri;
    }
  }

  function sendJson(res, status, payload) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
  }

  function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
  }

  async function handleAuthLogin(req, res) {
    const configured = requireKeycloakConfigured();
    if (!configured.ok) {
      sendJson(res, 400, { error: configured.error });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const requestHost = extractHost(req.headers.host);
    const quickLoginAllowedHost =
      requestHost === "staging.asiatravelplan.com" || requestHost === "localhost" || requestHost === "127.0.0.1";
    const returnTo = buildSafeReturnTo(requestUrl.searchParams.get("return_to"), "/bookings.html");
    const redirectUri = resolveAuthRedirectUri(req);
    const quickLoginRequested =
      quickLoginAllowedHost && normalizeText(requestUrl.searchParams.get("quick_login")) === "1";
    const quickLoginUser = normalizeText(requestUrl.searchParams.get("quick_login_user")) || "joachim";
    const forcePromptLogin = normalizeText(requestUrl.searchParams.get("prompt")) === "login";
    const state = randomUUID();
    authRequests.set(state, {
      return_to: returnTo,
      redirect_uri: redirectUri,
      quick_login: quickLoginRequested,
      quick_login_user: quickLoginRequested ? quickLoginUser : undefined,
      created_at: Date.now()
    });

    const discovery = await getKeycloakDiscovery();
    const authUrl = new URL(discovery.authorization_endpoint);
    authUrl.searchParams.set("client_id", cfg.keycloakClientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid profile email");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    if (quickLoginRequested) {
      authUrl.searchParams.set("quick_login", "1");
      if (quickLoginUser) {
        authUrl.searchParams.set("login_hint", quickLoginUser);
      }
    }
    if (cfg.keycloakForceLoginPrompt || forcePromptLogin) {
      authUrl.searchParams.set("prompt", "login");
      authUrl.searchParams.set("max_age", "0");
    }

    redirect(res, authUrl.toString());
  }

  async function handleAuthCallback(req, res) {
    const configured = requireKeycloakConfigured();
    if (!configured.ok) {
      sendJson(res, 400, { error: configured.error });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const code = normalizeText(requestUrl.searchParams.get("code"));
    const state = normalizeText(requestUrl.searchParams.get("state"));
    if (!code || !state) {
      sendJson(res, 400, { error: "Missing code/state" });
      return;
    }

    const requestState = authRequests.get(state);
    authRequests.delete(state);
    if (!requestState) {
      sendJson(res, 400, { error: "Invalid state" });
      return;
    }

    const discovery = await getKeycloakDiscovery();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: normalizeText(requestState.redirect_uri) || cfg.keycloakRedirectUri,
      client_id: cfg.keycloakClientId,
      client_secret: cfg.keycloakClientSecret
    });

    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text();
      sendJson(res, 400, { error: "Token exchange failed", detail });
      return;
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = normalizeText(tokenPayload.access_token);
    const idToken = normalizeText(tokenPayload.id_token);
    const refreshToken = normalizeText(tokenPayload.refresh_token);
    if (!accessToken) {
      sendJson(res, 400, { error: "Missing access token in callback" });
      return;
    }

    const verified = await verifyKeycloakToken(accessToken);
    const roles = extractRolesFromPayload(verified);
    const hasRole = roles.some((role) => cfg.keycloakAllowedRoles.has(role));
    if (!hasRole) {
      console.warn(
        `[auth] denied backend access for ${String(verified.preferred_username || verified.email || verified.sub || "unknown")} with claims: ${JSON.stringify(
          {
            roles,
            groups: Array.isArray(verified.groups) ? verified.groups : []
          }
        )}`
      );
      sendJson(res, 403, { error: "Authenticated but not authorized for backend access" });
      return;
    }

    const sid = `sess_${randomUUID()}`;
    sessions.set(sid, {
      sub: String(verified.sub || ""),
      name: String(verified.name || ""),
      given_name: String(verified.given_name || ""),
      family_name: String(verified.family_name || ""),
      preferred_username: String(verified.preferred_username || ""),
      email: String(verified.email || ""),
      roles,
      access_token: accessToken,
      id_token: idToken || "",
      refresh_token: refreshToken || "",
      created_at: Date.now(),
      expires_at: Date.now() + sessionMaxAgeMs
    });
    setSessionCookie(res, sid);

    redirect(res, requestState.return_to || "/bookings.html");
  }

  async function handleAuthLogout(req, res) {
    const session = getSessionFromRequest(req);
    const requestUrl = new URL(req.url, "http://localhost");
    const returnTo = buildSafeReturnTo(requestUrl.searchParams.get("return_to"), "/bookings.html");
    const logoutReturnTo = normalizeLogoutReturnTo(returnTo);
    if (!cfg.keycloakEnabled) {
      if (session?.sid) {
        sessions.delete(session.sid);
      }
      clearSessionCookie(res);
      redirect(res, logoutReturnTo);
      return;
    }

    try {
      const discovery = await getKeycloakDiscovery();
      const endSessionEndpoint = normalizeText(discovery?.end_session_endpoint);

      if (session?.refresh_token && endSessionEndpoint) {
        try {
          await fetch(endSessionEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: cfg.keycloakClientId,
              client_secret: cfg.keycloakClientSecret,
              refresh_token: String(session.refresh_token)
            })
          });
        } catch {
          // Fall back to front-channel logout redirect below.
        }
      }

      if (session?.sid) {
        sessions.delete(session.sid);
      }
      clearSessionCookie(res);

      if (!endSessionEndpoint) {
        redirect(res, logoutReturnTo);
        return;
      }

      const logoutUrl = new URL(endSessionEndpoint);
      if (session?.id_token) {
        logoutUrl.searchParams.set("id_token_hint", String(session.id_token));
      }
      logoutUrl.searchParams.set("client_id", cfg.keycloakClientId);
      logoutUrl.searchParams.set(
        "post_logout_redirect_uri",
        logoutReturnTo || cfg.keycloakPostLogoutRedirectUri || "/bookings.html"
      );
      redirect(res, logoutUrl.toString());
      return;
    } catch {
      if (session?.sid) {
        sessions.delete(session.sid);
      }
      clearSessionCookie(res);
      redirect(res, logoutReturnTo);
    }
  }

  async function handleAuthMe(req, res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const session = getSessionFromRequest(req);
    if (!session) {
      sendJson(res, 200, { authenticated: false });
      return;
    }

    sendJson(res, 200, {
      authenticated: true,
      user: {
        sub: session.sub,
        name: session.name,
        given_name: session.given_name,
        family_name: session.family_name,
        preferred_username: session.preferred_username,
        email: session.email,
        roles: session.roles
      }
    });
  }

  async function handleProductionAccessCheck(req, res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (!getSessionFromRequest(req)) {
      redirect(res, "/");
      return;
    }

    res.writeHead(204);
    res.end();
  }

  return {
    routes,
    handleAuthMe,
    handleProductionAccessCheck,
    pruneState,
    isKeycloakEnabled,
    hasSession,
    getSessionPrincipal,
    listActiveSessions,
    getLoginRedirect,
    authorizeApiRequest
  };
}

function parseBoolEnv(name, defaultValue) {
  const raw = normalizeText(process.env[name]);
  if (!raw) return defaultValue;
  return raw.toLowerCase() === "true";
}

function extractHost(headerValue) {
  const raw = normalizeText(headerValue);
  if (!raw) return "";
  return raw.split(":")[0];
}
