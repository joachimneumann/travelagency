export function createKeycloakUserHandlers(deps) {
  const {
    getPrincipal,
    canViewKeycloakUsers,
    listAssignableStaffUsers,
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
      const items = await listAssignableStaffUsers();
      sendJson(res, 200, {
        items: items.map((user) => ({
          id: user.id,
          name: keycloakDisplayName(user) || null,
          username: user.username || null,
          active: user.active !== false,
          staff_profile: user.staff_profile || null,
          realm_roles: Array.isArray(user.realm_roles) ? user.realm_roles : [],
          client_roles: Array.isArray(user.client_roles) ? user.client_roles : []
        })),
        total: items.length
      });
    } catch (error) {
      const detail = String(error?.message || error || "");
      if (/not configured/i.test(detail)) {
        sendJson(res, 200, {
          items: [],
          total: 0,
          unavailable: true,
          warning: `Keycloak user directory unavailable: ${detail}`
        });
        return;
      }
      sendJson(res, 503, { error: `Keycloak user directory unavailable: ${String(error?.message || error)}` });
    }
  }

  return { handleListKeycloakUsers };
}
