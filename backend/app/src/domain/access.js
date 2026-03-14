export function createAccessHelpers({ auth, appRoles }) {
  function hasRole(principal, role) {
    return Array.isArray(principal?.roles) ? principal.roles.includes(role) : false;
  }

  function getPrincipal(req) {
    return req?.authz?.principal || auth.getSessionPrincipal(req) || null;
  }

  function canReadBackend(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ACCOUNTANT) ||
      hasRole(principal, appRoles.ATP_STAFF);
  }

  function canViewKeycloakUsers(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ACCOUNTANT);
  }

  function canReadTours(principal) {
    return canReadBackend(principal);
  }

  function canEditTours(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ATP_STAFF);
  }

  function canReadSuppliers(principal) {
    return canReadBackend(principal);
  }

  function canEditSuppliers(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ATP_STAFF);
  }

  return {
    getPrincipal,
    canReadBackend,
    canViewKeycloakUsers,
    canReadTours,
    canEditTours,
    canReadSuppliers,
    canEditSuppliers
  };
}
