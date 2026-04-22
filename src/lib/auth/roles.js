export const ROLE = {
  USER: "user",
  CLIENT: "client",
  SUPPORT: "support",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
};

export const INTERNAL_ONLY_ROLES = [ROLE.SUPERADMIN];
export const ADMIN_VISIBLE_ROLES = [ROLE.USER, ROLE.CLIENT, ROLE.SUPPORT, ROLE.ADMIN];
export const ADMIN_MANAGEABLE_ROLES = [ROLE.USER, ROLE.CLIENT, ROLE.SUPPORT, ROLE.ADMIN];
export const ELEVATED_ROLES = [ROLE.ADMIN, ROLE.SUPPORT, ROLE.SUPERADMIN];

export function isSuperadminRole(role) {
  return String(role || "") === ROLE.SUPERADMIN;
}

export function isElevatedRole(role) {
  return ELEVATED_ROLES.includes(String(role || ""));
}

export function canRoleSatisfyRequired(requesterRole, requiredRole) {
  const requester = String(requesterRole || "");
  const required = String(requiredRole || "");
  if (requester === required) return true;
  if (requester === ROLE.SUPERADMIN && (required === ROLE.ADMIN || required === ROLE.SUPPORT)) return true;
  return false;
}

export function canAccessAllowedRoles(requesterRole, allowedRoles = []) {
  if (!allowedRoles.length) return true;
  return allowedRoles.some((required) => canRoleSatisfyRequired(requesterRole, required));
}
