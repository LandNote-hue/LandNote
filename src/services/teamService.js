import { supabase } from '../lib/supabase.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { normalizeCompanyRole } from '../data/companyRoles.js';
import { buildInviteSignupUrl } from '../navigation/authRoutes.js';

export function buildInviteUrl(token) {
  return buildInviteSignupUrl(token);
}

/** @param {string} token */
export async function previewInviteToken(token) {
  if (!isSupabaseConfigured) {
    return { valid: false, companyName: '', inviteRole: '', expiresAt: null };
  }
  const trimmed = String(token || '').trim();
  if (!trimmed) return { valid: false, companyName: '', inviteRole: '', expiresAt: null };

  const { data, error } = await supabase.rpc('preview_company_invite', { p_token: trimmed });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    valid: !!row?.valid,
    companyName: row?.company_name ?? '',
    inviteRole: row?.invite_role ?? 'MEMBER',
    expiresAt: row?.expires_at ?? null,
    invitedEmail: row?.invited_email ?? '',
    existingUser: !!row?.existing_user,
    existingHasCompany: !!row?.existing_has_company,
  };
}

export async function fetchCompanyTeam() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('list_company_team');
  if (error) throw error;
  return data ?? [];
}

export async function fetchPendingInvites() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('list_pending_invites');
  if (error) throw error;
  return data ?? [];
}

export async function fetchInviteHistory() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('list_company_invite_history');
  if (error) throw error;
  return data ?? [];
}

/** @param {string} email @param {'MANAGER'|'MEMBER'} role */
export async function createTeamInvite(email, role = 'MEMBER') {
  const { data, error } = await supabase.rpc('create_company_invite', {
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const token = row?.token ?? row?.invite_token;
  if (!token) throw new Error('초대 생성에 실패했습니다.');
  return {
    id: row.invite_id ?? row.id,
    token,
    expiresAt: row.expires_at,
    url: buildInviteUrl(token),
  };
}

/** @param {string} inviteId */
export async function revokeTeamInvite(inviteId) {
  const { data, error } = await supabase.rpc('revoke_company_invite', { p_invite_id: inviteId });
  if (error) throw error;
  return data;
}

/** @param {string} userId — CEO: 직원 팀에서 제거 */
export async function removeTeamMember(userId) {
  const { data, error } = await supabase.rpc('remove_company_member', { p_user_id: userId });
  if (error) throw error;
  return data;
}

/** @param {string} token */
export async function acceptTeamInvite(token) {
  const { data, error } = await supabase.rpc('accept_company_invite', { p_token: token.trim() });
  if (error) throw error;
  return data;
}

/** @param {string} token — 기존 가입 회원 소속 이관 */
export async function transferTeamInvite(token) {
  const { data, error } = await supabase.rpc('transfer_company_invite', { p_token: token.trim() });
  if (error) throw error;
  return data;
}

/** @param {string} companyId @param {string} grantorUserId */
export async function fetchSharingPolicies(companyId, grantorUserId) {
  const { data, error } = await supabase
    .from('sharing_policies')
    .select('*')
    .eq('company_id', companyId)
    .eq('grantor_user_id', grantorUserId);
  if (error) throw error;
  return data ?? [];
}

/** @param {string} companyId @param {string} granteeUserId @param {{ share_properties: boolean, share_calls: boolean, share_schedules: boolean }} flags */
export async function upsertSharingPolicy(companyId, granteeUserId, flags) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('로그인이 필요합니다.');

  const { data, error } = await supabase
    .from('sharing_policies')
    .upsert({
      company_id: companyId,
      grantor_user_id: user.id,
      grantee_user_id: granteeUserId,
      share_properties: !!flags.share_properties,
      share_calls: !!flags.share_calls,
      share_schedules: !!flags.share_schedules,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,grantor_user_id,grantee_user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** @param {number} policyId */
export async function deleteSharingPolicy(policyId) {
  const { error } = await supabase.from('sharing_policies').delete().eq('id', policyId);
  if (error) throw error;
}

export function mapInviteError(error) {
  const msg = String(error?.message || error || '').toUpperCase();
  if (msg.includes('INVITE_EMAIL_MISMATCH')) return '초대된 이메일과 가입 이메일이 일치하지 않습니다.';
  if (msg.includes('INVITE_INVALID')) return '초대 링크가 만료되었거나 유효하지 않습니다.';
  if (msg.includes('ALREADY_IN_COMPANY')) return '이미 다른 워크스페이스에 소속되어 있습니다.';
  if (msg.includes('ALREADY_IN_THIS_COMPANY')) return '이미 이 회사에 소속되어 있습니다.';
  if (msg.includes('CEO_HAS_MEMBERS')) return '대표 계정에 남은 직원이 있어 소속을 변경할 수 없습니다. 먼저 직원 이관 또는 탈퇴 처리를 진행해 주세요.';
  if (msg.includes('FORBIDDEN')) return '권한이 없습니다.';
  if (msg.includes('CANNOT_REMOVE_SELF')) return '본인은 팀에서 제거할 수 없습니다.';
  if (msg.includes('CANNOT_REMOVE_CEO')) return '대표 계정은 제거할 수 없습니다.';
  if (msg.includes('MEMBER_NOT_FOUND')) return '팀원을 찾을 수 없습니다.';
  return error?.message || '요청을 처리하지 못했습니다.';
}

export { normalizeCompanyRole };
