import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { normalizeMemberPermissions } from '../data/memberPermissions.js';

/** @typedef {import('../data/memberPermissions.js').MemberPermissions} MemberPermissions */

/** @type {Record<keyof MemberPermissions, { resource_type: string, field: 'can_view' | 'can_edit' }>} */
export const PERMISSION_TO_SHARING = {
  read_properties: { resource_type: 'properties', field: 'can_view' },
  write_properties: { resource_type: 'properties', field: 'can_edit' },
  read_schedules: { resource_type: 'schedules', field: 'can_view' },
  write_schedules: { resource_type: 'schedules', field: 'can_edit' },
  read_calls: { resource_type: 'call_logs', field: 'can_view' },
  write_calls: { resource_type: 'call_logs', field: 'can_edit' },
};

/** @param {MemberPermissions} perms */
export function memberPermissionsToSharingPolicies(perms) {
  return [
    { resource_type: 'properties', can_view: !!perms.read_properties, can_edit: !!perms.write_properties },
    { resource_type: 'schedules', can_view: !!perms.read_schedules, can_edit: !!perms.write_schedules },
    { resource_type: 'call_logs', can_view: !!perms.read_calls, can_edit: !!perms.write_calls },
  ];
}

export async function fetchMyMemberPermissions() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('get_my_member_permissions');
  if (error) throw error;
  if (data == null) return null;
  return normalizeMemberPermissions(data);
}

export async function fetchMemberPermissionsDashboard() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('list_member_permissions_dashboard');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    ...normalizeMemberPermissions(row),
  }));
}

/**
 * CEO: sharing_policies 단일 리소스 Upsert
 * @param {string} memberId
 * @param {'properties'|'schedules'|'call_logs'} resourceType
 * @param {boolean} canView
 * @param {boolean} canEdit
 */
export async function upsertMemberSharingPolicy(memberId, resourceType, canView, canEdit) {
  const { data, error } = await supabase.rpc('upsert_member_sharing_policy', {
    p_member_id: memberId,
    p_resource_type: resourceType,
    p_can_view: canView,
    p_can_edit: canEdit,
  });
  if (error) throw error;
  return data;
}

/**
 * CEO: 직원 1명의 권한 일괄 저장 (설정 저장 버튼용)
 * @param {string} memberId
 * @param {MemberPermissions} permissions
 */
export async function saveMemberSharingPolicies(memberId, permissions) {
  const policies = memberPermissionsToSharingPolicies(normalizeMemberPermissions(permissions));
  const { data, error } = await supabase.rpc('upsert_member_sharing_policies_batch', {
    p_member_id: memberId,
    p_policies: policies,
  });
  if (error) throw error;
  return normalizeMemberPermissions(await fetchMemberPermissionsForUser(memberId));
}

async function fetchMemberPermissionsForUser(memberId) {
  const { data, error } = await supabase.rpc('get_my_member_permissions_for_user', {
    p_user_id: memberId,
  });
  if (error) throw error;
  return normalizeMemberPermissions(data);
}

/** @param {string} userId @param {keyof MemberPermissions} permission @param {boolean} enabled */
export async function setMemberPermission(userId, permission, enabled) {
  const { data, error } = await supabase.rpc('set_member_permission', {
    p_user_id: userId,
    p_permission: permission,
    p_enabled: enabled,
  });
  if (error) throw error;
  return normalizeMemberPermissions(data);
}

export function mapPermissionError(error) {
  const msg = String(error?.message || error || '').toUpperCase();
  if (msg.includes('FORBIDDEN')) return '권한이 없습니다. 대표(CEO) 계정으로 로그인해 주세요.';
  if (msg.includes('CANNOT_EDIT_SELF')) return '본인 권한은 변경할 수 없습니다.';
  if (msg.includes('MEMBER_NOT_FOUND')) return '팀원을 찾을 수 없습니다.';
  if (msg.includes('INVALID_RESOURCE_TYPE')) return '잘못된 리소스 유형입니다.';
  return error?.message || '권한 저장에 실패했습니다.';
}
