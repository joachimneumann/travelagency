export function createKeycloakUserHandlers(deps) {
  const {
    getPrincipal,
    canViewKeycloakUsers,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
    sendJson
  } = deps;

  async function handleListKeycloakUsers(req, res) {
    const principal = getPrincipal(req);
    if (!canViewKeycloakUsers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const items = await listAssignableKeycloakUsers();
      sendJson(res, 200, {
        items: items.map((user) => ({
          id: user.id,
          name: keycloakDisplayName(user) || null,
          username: user.username || null,
          active: user.active !== false,
          realm_roles: Array.isArray(user.realm_roles) ? user.realm_roles : [],
          client_roles: Array.isArray(user.client_roles) ? user.client_roles : []
        })),
        total: items.length
      });
    } catch (error) {
      sendJson(res, 503, { error: `Keycloak user directory unavailable: ${String(error?.message || error)}` });
    }
  }

  return { handleListKeycloakUsers };
}
