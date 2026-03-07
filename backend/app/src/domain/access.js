import { normalizeText } from "../../../../shared/js/text.js";

function hasRole(principal, role) {
  return Array.isArray(principal?.roles) ? principal.roles.includes(role) : false;
}

export function createAccessHelpers({ auth, appRoles }) {
  function getPrincipal(req) {
    return req?.authz?.principal || auth.getSessionPrincipal(req) || null;
  }

  function staffUsernames(staffMembers) {
    return new Set(
      (Array.isArray(staffMembers) ? staffMembers : [])
        .flatMap((member) => Array.isArray(member?.usernames) ? member.usernames : [])
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
    );
  }

  function resolvePrincipalAtpStaffMember(principal, staffMembers) {
    const candidates = new Set(
      [principal?.preferred_username, principal?.email, principal?.sub]
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
        .flatMap((value) => (value.includes("@") ? [value, value.split("@")[0]] : [value]))
    );

    return (Array.isArray(staffMembers) ? staffMembers : []).find((member) => {
      const usernames = Array.isArray(member?.usernames) ? member.usernames : [];
      return usernames.some((username) => candidates.has(normalizeText(username).toLowerCase()));
    }) || null;
  }

  function canReadCustomers(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ACCOUNTANT) ||
      hasRole(principal, appRoles.ATP_STAFF);
  }

  function canViewAtpStaffDirectory(principal) {
    return canReadCustomers(principal);
  }

  function canManageAtpStaff(principal) {
    return hasRole(principal, appRoles.ADMIN) || hasRole(principal, appRoles.MANAGER);
  }

  function canReadTours(principal) {
    return canReadCustomers(principal);
  }

  function canEditTours(principal) {
    return hasRole(principal, appRoles.ADMIN) ||
      hasRole(principal, appRoles.MANAGER) ||
      hasRole(principal, appRoles.ATP_STAFF);
  }

  return {
    getPrincipal,
    staffUsernames,
    resolvePrincipalAtpStaffMember,
    canReadCustomers,
    canViewAtpStaffDirectory,
    canManageAtpStaff,
    canReadTours,
    canEditTours
  };
}
