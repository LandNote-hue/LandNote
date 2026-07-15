import { supabase } from '../lib/supabase.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

/** @param {unknown} err */
export function mapAccountDeletionError(err) {
  const raw = String(err?.message || err || '');
  const msg = raw.toLowerCase();
  if (/could not find the function|schema cache/i.test(msg)) {
    return '회원탈퇴 RPC가 DB에 없습니다. Supabase SQL Editor에서 supabase/migrations/012_account_deletion.sql 을 실행한 뒤 다시 시도해 주세요.';
  }
  const upper = raw.toUpperCase();
  if (upper.includes('CEO_HAS_MEMBERS')) {
    return '소속된 직원이 있어 탈퇴할 수 없습니다. 대표 권한을 위임하거나 직원을 먼저 정리해 주세요.';
  }
  if (msg.includes('DELETE_NOT_ALLOWED') || upper.includes('FORBIDDEN')) {
    return '탈퇴할 수 없는 계정 상태입니다.';
  }
  if (upper.includes('NOT_AUTHENTICATED')) return '로그인이 필요합니다.';
  if (upper.includes('INVALID') && upper.includes('CREDENTIAL')) {
    return '비밀번호가 올바르지 않습니다.';
  }
  return raw || '회원탈퇴 처리에 실패했습니다.';
}

/** @returns {Promise<{ allowed: boolean, reason?: string, code?: string, accountKind?: string }>} */
export async function fetchCanDeleteAccount() {
  if (!isSupabaseConfigured) {
    return { allowed: false, reason: 'Supabase가 설정되지 않았습니다.', code: 'NO_SUPABASE' };
  }
  const { data, error } = await supabase.rpc('can_delete_my_account');
  if (error) throw error;
  const row = data ?? {};
  return {
    allowed: !!row.allowed,
    reason: row.reason ?? undefined,
    code: row.code ?? undefined,
    accountKind: row.account_kind ?? undefined,
  };
}

/**
 * 구글 OAuth 토큰 저장 시 revoke 호출용 (현재 ICS 연동만 사용 — no-op)
 * @param {import('@supabase/supabase-js').User | null | undefined} _user
 */
export async function revokeExternalIntegrations(_user) {
  // 향후 google_calendar_tokens 테이블 연동 시 oauth2.googleapis.com/revoke 호출
}

/** @returns {Promise<void>} */
export async function deleteMyAccountRpc() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
