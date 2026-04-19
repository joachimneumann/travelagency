import { normalizeText } from "./text.js";

function normalizeRoles(items) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => normalizeText(item))
        .filter(Boolean)
    )
  );
}

function normalizeRoleSets(roleSets = {}) {
  const realmRoles = normalizeRoles(roleSets?.realm_roles);
  const clientRoles = normalizeRoles(roleSets?.client_roles);
  return {
    realm_roles: realmRoles,
    client_roles: clientRoles,
    roles: normalizeRoles([...realmRoles, ...clientRoles])
  };
}

function toDirectoryUser(user, roleSets = {}) {
  const id = normalizeText(user?.id) || null;
  const username = normalizeText(user?.username) || null;
  const firstName = normalizeText(user?.firstName);
  const lastName = normalizeText(user?.lastName);
  const combinedName = `${firstName} ${lastName}`.trim();
  const name = combinedName || normalizeText(user?.name) || null;
  const normalizedRoleSets = normalizeRoleSets(roleSets);
  return {
    id,
    username,
    first_name: firstName || null,
    name,
    active: user?.enabled !== false,
    ...normalizedRoleSets
  };
}

export function createKeycloakDirectory({
  keycloakEnabled,
  keycloakBaseUrl,
  keycloakRealm,
  keycloakClientId,
  keycloakAllowedRoles,
  keycloakDirectoryUsername,
  keycloakDirectoryPassword,
  keycloakDirectoryAdminRealm,
  listCacheTtlMs = 60 * 1000,
  requestTimeoutMs = 2500
}) {
  const cfg = {
    keycloakEnabled: Boolean(keycloakEnabled),
    keycloakBaseUrl: normalizeText(keycloakBaseUrl),
    keycloakRealm: normalizeText(keycloakRealm),
    keycloakClientId: normalizeText(keycloakClientId),
    keycloakAllowedRoles: new Set(
      Array.from(keycloakAllowedRoles || [])
        .map((role) => normalizeText(role))
        .filter(Boolean)
    ),
    keycloakDirectoryUsername: normalizeText(keycloakDirectoryUsername),
    keycloakDirectoryPassword: normalizeText(keycloakDirectoryPassword),
    keycloakDirectoryAdminRealm: normalizeText(keycloakDirectoryAdminRealm) || "master",
    listCacheTtlMs,
    requestTimeoutMs: Math.max(250, Number(requestTimeoutMs) || 2500)
  };

  let tokenCache = null;
  let assignableUserCache = null;
  let allowedUserCache = null;
  const userByIdCache = new Map();
  let clientUuidCache = null;

  function isConfigured() {
    return Boolean(
      cfg.keycloakEnabled &&
        cfg.keycloakBaseUrl &&
        cfg.keycloakRealm &&
        cfg.keycloakDirectoryUsername &&
        cfg.keycloakDirectoryPassword
    );
  }

  function tokenEndpoint() {
    return `${cfg.keycloakBaseUrl}/realms/${cfg.keycloakDirectoryAdminRealm}/protocol/openid-connect/token`;
  }

  function adminApiBase() {
    return `${cfg.keycloakBaseUrl}/admin/realms/${cfg.keycloakRealm}`;
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Keycloak directory HTTP ${response.status} for ${url}: ${detail || "no response body"}`);
      }
      return response.json();
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`Keycloak directory request timed out after ${cfg.requestTimeoutMs}ms for ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getAdminAccessToken() {
    if (!isConfigured()) {
      throw new Error("Keycloak directory is not configured");
    }
    const now = Date.now();
    if (tokenCache && Number(tokenCache.expires_at) > now + 10_000) {
      return tokenCache.access_token;
    }
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: cfg.keycloakDirectoryUsername,
      password: cfg.keycloakDirectoryPassword
    });
    const payload = await fetchJson(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const accessToken = normalizeText(payload?.access_token);
    const expiresIn = Number(payload?.expires_in || 60);
    if (!accessToken) {
      throw new Error("Keycloak directory token response did not include access_token");
    }
    tokenCache = {
      access_token: accessToken,
      expires_at: now + Math.max(15, expiresIn - 10) * 1000
    };
    return accessToken;
  }

  async function listUsers() {
    const accessToken = await getAdminAccessToken();
    const users = [];
    let first = 0;
    const pageSize = 100;
    while (true) {
      const page = await fetchJson(`${adminApiBase()}/users?first=${first}&max=${pageSize}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const items = Array.isArray(page) ? page : [];
      users.push(...items);
      if (items.length < pageSize) break;
      first += pageSize;
    }
    return users;
  }

  async function getClientUuid() {
    if (!cfg.keycloakClientId) return null;
    if (clientUuidCache) return clientUuidCache;
    const accessToken = await getAdminAccessToken();
    const clients = await fetchJson(`${adminApiBase()}/clients?clientId=${encodeURIComponent(cfg.keycloakClientId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const client = (Array.isArray(clients) ? clients : []).find((item) => normalizeText(item?.clientId) === cfg.keycloakClientId);
    clientUuidCache = normalizeText(client?.id) || null;
    return clientUuidCache;
  }

  async function listUserRoles(userId) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) {
      return {
        realm_roles: [],
        client_roles: [],
        roles: []
      };
    }
    const accessToken = await getAdminAccessToken();
    const realmRoleNames = [];
    const clientRoleNames = [];
    async function fetchRoleNames(primaryUrl, fallbackUrl = "") {
      try {
        const payload = await fetchJson(primaryUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return (Array.isArray(payload) ? payload : []).map((role) => role?.name);
      } catch (error) {
        if (!fallbackUrl) throw error;
        const payload = await fetchJson(fallbackUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        return (Array.isArray(payload) ? payload : []).map((role) => role?.name);
      }
    }

    realmRoleNames.push(
      ...await fetchRoleNames(
        `${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}/role-mappings/realm/composite`,
        `${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}/role-mappings/realm`
      )
    );

    if (cfg.keycloakClientId) {
      const clientUuid = await getClientUuid();
      if (clientUuid) {
        clientRoleNames.push(
          ...await fetchRoleNames(
            `${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}/role-mappings/clients/${encodeURIComponent(clientUuid)}/composite`,
            `${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}/role-mappings/clients/${encodeURIComponent(clientUuid)}`
          )
        );
      }
    }

    return normalizeRoleSets({
      realm_roles: realmRoleNames,
      client_roles: clientRoleNames
    });
  }

  function isAssignableRoleSet(roles) {
    return normalizeRoles(Array.isArray(roles) ? roles : roles?.roles).includes("atp_staff");
  }

  function isAllowedRoleSet(roles) {
    return normalizeRoles(Array.isArray(roles) ? roles : roles?.roles).some((role) => cfg.keycloakAllowedRoles.has(role));
  }

  async function mapWithConcurrency(items, limit, worker) {
    const source = Array.isArray(items) ? items : [];
    const size = Math.max(1, Number(limit) || 1);
    const results = new Array(source.length);
    let nextIndex = 0;
    async function runWorker() {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= source.length) return;
        results[currentIndex] = await worker(source[currentIndex], currentIndex);
      }
    }
    await Promise.all(Array.from({ length: Math.min(size, source.length) }, () => runWorker()));
    return results;
  }

  async function listAssignableUsers() {
    if (assignableUserCache && assignableUserCache.expires_at > Date.now()) {
      return assignableUserCache.items;
    }
    try {
      const users = await listUsers();
      await getClientUuid().catch(() => null);
      const results = await mapWithConcurrency(users, 8, async (user) => {
        if (user?.enabled === false) return null;
        const summary = toDirectoryUser(user);
        if (!summary.id) return null;
        const roleSets = await listUserRoles(summary.id);
        if (!isAssignableRoleSet(roleSets)) return null;
        const normalized = { ...summary, ...roleSets };
        userByIdCache.set(normalized.id, normalized);
        return normalized;
      });
      const items = results.filter(Boolean);
      items.sort((a, b) => {
        const left = normalizeText(a.name) || normalizeText(a.username) || normalizeText(a.id);
        const right = normalizeText(b.name) || normalizeText(b.username) || normalizeText(b.id);
        return left.localeCompare(right);
      });
      assignableUserCache = {
        items,
        expires_at: Date.now() + cfg.listCacheTtlMs
      };
      return items;
    } catch (error) {
      if (assignableUserCache?.items?.length) {
        return assignableUserCache.items;
      }
      throw error;
    }
  }

  async function listAllowedUsers() {
    if (allowedUserCache && allowedUserCache.expires_at > Date.now()) {
      return allowedUserCache.items;
    }
    try {
      const users = await listUsers();
      await getClientUuid().catch(() => null);
      const results = await mapWithConcurrency(users, 8, async (user) => {
        if (user?.enabled === false) return null;
        const summary = toDirectoryUser(user);
        if (!summary.id) return null;
        const roleSets = await listUserRoles(summary.id);
        if (!isAllowedRoleSet(roleSets)) return null;
        const normalized = { ...summary, ...roleSets };
        userByIdCache.set(normalized.id, normalized);
        return normalized;
      });
      const items = results.filter(Boolean);
      items.sort((a, b) => {
        const left = normalizeText(a.name) || normalizeText(a.username) || normalizeText(a.id);
        const right = normalizeText(b.name) || normalizeText(b.username) || normalizeText(b.id);
        return left.localeCompare(right);
      });
      allowedUserCache = {
        items,
        expires_at: Date.now() + cfg.listCacheTtlMs
      };
      return items;
    } catch (error) {
      if (allowedUserCache?.items?.length) {
        return allowedUserCache.items;
      }
      throw error;
    }
  }

  async function getUserById(userId) {
    const normalizedUserId = normalizeText(userId);
    if (!normalizedUserId) return null;
    if (userByIdCache.has(normalizedUserId)) {
      return userByIdCache.get(normalizedUserId) || null;
    }
    const accessToken = await getAdminAccessToken();
    const payload = await fetchJson(`${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const roleSets = await listUserRoles(normalizedUserId).catch(() => ({
      realm_roles: [],
      client_roles: [],
      roles: []
    }));
    const summary = toDirectoryUser(payload, roleSets);
    if (summary?.id) userByIdCache.set(summary.id, summary);
    return summary;
  }

  async function resolveUsersByIds(userIds) {
    const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((item) => normalizeText(item)).filter(Boolean)));
    if (!ids.length) return new Map();
    const items = await listAssignableUsers().catch(() => []);
    const result = new Map(items.map((item) => [item.id, item]));
    for (const id of ids) {
      if (result.has(id)) continue;
      const user = await getUserById(id).catch(() => null);
      if (user) result.set(id, user);
    }
    return result;
  }

  function toDisplayName(user) {
    return normalizeText(user?.name) || normalizeText(user?.username) || normalizeText(user?.id) || "";
  }

  return {
    isConfigured,
    listAssignableUsers,
    listAllowedUsers,
    getUserById,
    resolveUsersByIds,
    toDisplayName
  };
}
