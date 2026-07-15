import { isCeoRole, isSoloRole } from '../data/companyRoles.js';
import {
  CEO_FULL_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  RESOURCE_READ_KEYS,
  RESOURCE_WRITE_KEYS,
} from '../data/memberPermissions.js';
import { matchesOwner } from '../services/sync/ownerScope.js';

/** @typedef {import('../data/memberPermissions.js').MemberPermissions} MemberPermissions */
/** @typedef {import('../data/memberPermissions.js').ShareResource} ShareResource */

/** @param {string|null|undefined} role @param {MemberPermissions|null|undefined} memberPermissions */
export function getEffectivePermissions(role, memberPermissions) {
  if (isSoloRole(role)) return null;
  if (isCeoRole(role)) return CEO_FULL_PERMISSIONS;
  return memberPermissions ?? DEFAULT_MEMBER_PERMISSIONS;
}

/** @param {MemberPermissions|null} permissions @param {ShareResource} resource */
export function canReadSharedResource(permissions, resource) {
  if (!permissions) return true;
  const key = RESOURCE_READ_KEYS[resource];
  return !!permissions[key];
}

/** @param {MemberPermissions|null} permissions @param {ShareResource} resource */
export function canWriteSharedResource(permissions, resource) {
  if (!permissions) return true;
  const key = RESOURCE_WRITE_KEYS[resource];
  return !!permissions[key];
}

/**
 * @param {Record<string, unknown>|null|undefined} item
 * @param {string} userId
 * @param {string|null|undefined} role
 * @param {MemberPermissions|null|undefined} permissions
 * @param {ShareResource} [resource='properties']
 */
export function canReadRecord(item, userId, role, permissions, resource = 'properties') {
  if (!item) return false;
  if (matchesOwner(item, userId)) return true;
  if (isCeoRole(role) && !isSoloRole(role)) return true;
  const effective = getEffectivePermissions(role, permissions);
  return canReadSharedResource(effective, resource);
}

/**
 * @param {Record<string, unknown>|null|undefined} item
 * @param {string} userId
 * @param {string|null|undefined} role
 * @param {MemberPermissions|null|undefined} permissions
 * @param {ShareResource} [resource='properties']
 */
export function canWriteRecord(item, userId, role, permissions, resource = 'properties') {
  if (!item) return false;
  if (matchesOwner(item, userId)) return true;
  if (isCeoRole(role) && !isSoloRole(role)) return true;
  const effective = getEffectivePermissions(role, permissions);
  return canWriteSharedResource(effective, resource);
}

/** @param {Record<string, unknown>|null|undefined} item @param {string} userId */
export function isSharedRecord(item, userId) {
  if (!item) return false;
  return !matchesOwner(item, userId);
}

/** @param {string|null|undefined} phone @param {boolean} masked */
export function displayPhone(phone, masked) {
  if (!phone) return '—';
  if (!masked) return phone;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 8) {
    const head = digits.slice(0, digits.length - 4);
    const formatted = head.length <= 3
      ? `${head}-${'****'}`
      : head.length <= 7
        ? `${head.slice(0, 3)}-${head.slice(3)}-****`
        : `${head.slice(0, 3)}-${head.slice(3, 7)}-****`;
    return formatted;
  }
  return '****';
}

export const PERMISSION_DENIED_TOOLTIP = '대표의 수정 권한 승인이 필요합니다';

/** @param {string|null|undefined} ownerName @param {string|null|undefined} [ownerRole] */
export function formatSharedPropertyLabel(ownerName, ownerRole) {
  const name = ownerName || '동료';
  const roleLabel = ownerRole === 'MANAGER' ? '팀장' : ownerRole === 'MEMBER' ? '사원' : '';
  return roleLabel ? `공유받음 - ${name} ${roleLabel}` : `공유받음 - ${name}`;
}

/** @param {MemberPermissions|null|undefined} permissions */
export function canViewTeamProperties(permissions) {
  return canReadSharedResource(permissions ?? DEFAULT_MEMBER_PERMISSIONS, 'properties');
}
