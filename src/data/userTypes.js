/** @typedef {'SOLO' | 'BUSINESS'} UserType */

/** @readonly */
export const USER_TYPES = {
  SOLO: 'SOLO',
  BUSINESS: 'BUSINESS',
};

/** @param {string} [type] */
export function normalizeUserType(type) {
  const t = String(type || '').toUpperCase();
  return t === USER_TYPES.BUSINESS ? USER_TYPES.BUSINESS : USER_TYPES.SOLO;
}

/** @param {string} [type] */
export function userTypeLabel(type) {
  return normalizeUserType(type) === USER_TYPES.BUSINESS ? '회사·팀' : '개인';
}

/** @param {string} [type] @param {string} [role] */
export function isBusinessAccount(type, role) {
  if (normalizeUserType(type) === USER_TYPES.BUSINESS) return true;
  const r = String(role || '').toUpperCase();
  return r === 'CEO' || r === 'MANAGER' || r === 'MEMBER';
}
