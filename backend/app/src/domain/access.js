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
      hasRole(principal, appRoles.ACCOUNTANT);
  }

  function canViewKeycloakUsers(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ACCOUNTANT);
  }

  function canEditAtpStaffProfiles(principal) {
    return hasRole(principal, appRoles.ADMIN);
  }

  function canReadSettings(principal) {
    return hasRole(principal, appRoles.ADMIN);
  }

  function canReadTours(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.ACCOUNTANT) ||
      hasRole(principal, appRoles.TOUR_EDITOR);
  }

  function canEditTours(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.TOUR_EDITOR);
  }

  function canReadCountryReferenceInfo(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.TOUR_EDITOR);
  }

  function canEditCountryReferenceInfo(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.TOUR_EDITOR);
  }

  function canReadStandardTours(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ATP_STAFF);
  }

  function canEditStandardTours(principal) {
    return canReadStandardTours(principal);
  }

  return {
    getPrincipal,
    canReadBackend,
    canViewKeycloakUsers,
    canEditAtpStaffProfiles,
    canReadSettings,
    canReadTours,
    canEditTours,
    canReadCountryReferenceInfo,
    canEditCountryReferenceInfo,
    canReadStandardTours,
    canEditStandardTours
  };
}
