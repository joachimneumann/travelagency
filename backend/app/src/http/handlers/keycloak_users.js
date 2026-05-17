export function createKeycloakUserHandlers(deps) {
  const {
    getPrincipal,
    canViewKeycloakUsers,
    listAssignableUsers,
    listCachedAssignableUsers,
    keycloakDisplayName,
    sendJson
  } = deps;

  function toKeycloakUserResponse(user) {
    return {
      id: user.id,
      first_name: user.first_name || null,
      name: keycloakDisplayName(user) || null,
      username: user.username || null,
      active: user.active !== false,
      realm_roles: Array.isArray(user.realm_roles) ? user.realm_roles : [],
      client_roles: Array.isArray(user.client_roles) ? user.client_roles : []
    };
  }

  function requestPrefersCache(req) {
    try {
      const requestUrl = new URL(req?.url || "/", "http://localhost");
      return requestUrl.searchParams.get("prefer_cache") === "1"
        || requestUrl.searchParams.get("cache") === "1";
    } catch {
      return false;
    }
  }

  async function handleListKeycloakUsers(req, res) {
    const principal = getPrincipal(req);
    if (!canViewKeycloakUsers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (requestPrefersCache(req)) {
      const cachedItems = await listCachedAssignableUsers().catch(() => []);
      if (cachedItems.length) {
        sendJson(res, 200, {
          items: cachedItems.map(toKeycloakUserResponse),
          total: cachedItems.length,
          cached: true,
          stale: true
        });
        return;
      }
    }
    try {
      const items = await listAssignableUsers();
      sendJson(res, 200, {
        items: items.map(toKeycloakUserResponse),
        total: items.length
      });
    } catch (error) {
      const detail = String(error?.message || error || "");
      const cachedItems = await listCachedAssignableUsers().catch(() => []);
      const warningSuffix = cachedItems.length ? " Showing cached users from the last successful sync." : "";
      sendJson(res, 200, {
        items: cachedItems.map(toKeycloakUserResponse),
        total: cachedItems.length,
        unavailable: true,
        stale: cachedItems.length > 0,
        warning: `Keycloak user directory unavailable: ${detail}.${warningSuffix}`.trim()
      });
    }
  }

  return { handleListKeycloakUsers };
}
