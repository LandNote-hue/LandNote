/** @typedef {'SOLO' | 'CEO' | 'MANAGER' | 'MEMBER'} CompanyRole */

/** @readonly */
export const COMPANY_ROLES = {
  SOLO: 'SOLO',
  CEO: 'CEO',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
};

/** @deprecated 007 호환 */
export const LEGACY_ROLE_MAP = {
  owner: COMPANY_ROLES.CEO,
  admin: COMPANY_ROLES.MANAGER,
  member: COMPANY_ROLES.MEMBER,
};

/** @param {string} [role] */
export function normalizeCompanyRole(role) {
  if (!role) return COMPANY_ROLES.MEMBER;
  if (role in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[role];
  if (role === COMPANY_ROLES.SOLO) return COMPANY_ROLES.SOLO;
  if (role === COMPANY_ROLES.CEO || role === COMPANY_ROLES.MANAGER || role === COMPANY_ROLES.MEMBER) return role;
  return COMPANY_ROLES.MEMBER;
}

/** @param {string} [role] */
export function isSoloRole(role) {
  return normalizeCompanyRole(role) === COMPANY_ROLES.SOLO;
}

/** @param {string} [role] */
export function isBusinessRole(role) {
  const r = normalizeCompanyRole(role);
  return r === COMPANY_ROLES.CEO || r === COMPANY_ROLES.MANAGER || r === COMPANY_ROLES.MEMBER;
}

/** @param {string} [role] */
export function isCeoRole(role) {
  return normalizeCompanyRole(role) === COMPANY_ROLES.CEO;
}

/** 팀(회사) 계정만 클라우드 동기화 UI·로그인 자동동기화 대상 (개인 SOLO 제외) */
/** @param {string|null|undefined} role */
export function usesTeamCloudSync(role) {
  if (role == null || role === '') return false;
  return isBusinessRole(role) && !isSoloRole(role);
}

/** @param {string} [role] */
export function companyRoleLabel(role) {
  if (role == null || role === '') return '—';
  switch (normalizeCompanyRole(role)) {
    case COMPANY_ROLES.SOLO: return '개인(Solo)';
    case COMPANY_ROLES.CEO: return '대표(CEO)';
    case COMPANY_ROLES.MANAGER: return '팀장(Manager)';
    case COMPANY_ROLES.MEMBER: return '직원(Member)';
    default: return role || '—';
  }
}
