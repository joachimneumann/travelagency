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

function toDirectoryUser(user, roles = []) {
  const id = normalizeText(user?.id) || null;
  const username = normalizeText(user?.username) || null;
  const firstName = normalizeText(user?.firstName);
  const lastName = normalizeText(user?.lastName);
  const combinedName = `${firstName} ${lastName}`.trim();
  const name = combinedName || normalizeText(user?.name) || null;
  return {
    id,
    username,
    name,
    active: user?.enabled !== false,
    roles: normalizeRoles(roles)
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
  listCacheTtlMs = 60 * 1000
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
    listCacheTtlMs
  };

  let tokenCache = null;
  let assignableUserCache = null;
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
    const response = await fetch(url, options);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Keycloak directory HTTP ${response.status} for ${url}: ${detail || "no response body"}`);
    }
    return response.json();
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
    if (!normalizedUserId) return [];
    const accessToken = await getAdminAccessToken();
    const roleNames = [];
    const realmPayload = await fetchJson(`${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}/role-mappings/realm`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    roleNames.push(...(Array.isArray(realmPayload) ? realmPayload : []).map((role) => role?.name));

    if (cfg.keycloakClientId) {
      const clientUuid = await getClientUuid();
      if (clientUuid) {
        const clientPayload = await fetchJson(
          `${adminApiBase()}/users/${encodeURIComponent(normalizedUserId)}/role-mappings/clients/${encodeURIComponent(clientUuid)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        roleNames.push(...(Array.isArray(clientPayload) ? clientPayload : []).map((role) => role?.name));
      }
    }

    return normalizeRoles(roleNames);
  }

  function isAssignableRoleSet(roles) {
    return normalizeRoles(roles).some((role) => cfg.keycloakAllowedRoles.has(role));
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
        const roles = await listUserRoles(summary.id);
        if (!isAssignableRoleSet(roles)) return null;
        const normalized = { ...summary, roles };
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
    const roles = await listUserRoles(normalizedUserId).catch(() => []);
    const summary = toDirectoryUser(payload, roles);
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
    getUserById,
    resolveUsersByIds,
    toDisplayName
  };
}
