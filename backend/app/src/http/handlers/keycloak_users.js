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
      name: keycloakDisplayName(user) || null,
      username: user.username || null,
      active: user.active !== false,
      realm_roles: Array.isArray(user.realm_roles) ? user.realm_roles : [],
      client_roles: Array.isArray(user.client_roles) ? user.client_roles : []
    };
  }

  async function handleListKeycloakUsers(req, res) {
    const principal = getPrincipal(req);
    if (!canViewKeycloakUsers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
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
