/** @param {unknown} error */
export function extractSupabaseErrorMessage(error) {
  if (!error) return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

  const err = /** @type {Record<string, unknown>} */ (error);
  const parts = [
    err.message,
    err.error_description,
    err.msg,
    err.details,
    err.hint,
    err.code,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);

  const raw = parts.find((p) => p && p !== '{}' && p !== '[object Object]') || parts[0] || '';
  const msg = raw.toLowerCase();

  if (!msg || msg === '{}' || msg === '[object object]') {
    if (err.status === 500 || err.code === 'unexpected_failure') {
      return '가입 처리 중 서버(DB) 오류가 발생했습니다. Supabase SQL Editor에서 supabase/migrations/014_signup_schema_repair.sql 을 실행한 뒤 다시 시도해 주세요.';
    }
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (/could not find the function|schema cache/i.test(msg)) {
    return '가입 RPC가 DB에 없습니다. Supabase SQL Editor에서 014_signup_schema_repair.sql 을 실행해 주세요.';
  }
  if (msg.includes('signup_failed') || msg.includes('company_members_role_check')) {
    return '가입 처리 중 조직 설정 오류가 발생했습니다. Supabase SQL Editor에서 014_signup_schema_repair.sql 을 실행해 주세요.';
  }
  if (msg.includes('terms_required') || msg.includes('required terms')) {
    return '필수 약관에 동의해 주세요.';
  }
  if (msg.includes('terms_version')) return '약관 동의 정보가 올바르지 않습니다.';
  if (msg.includes('company_name_required')) return '회사명을 입력해 주세요.';
  if (msg.includes('profile_not_found')) {
    return '프로필이 생성되지 않았습니다. SQL Editor에서 014_signup_schema_repair.sql 실행 후 다시 로그인해 주세요.';
  }
  if (msg.includes('registration_already_complete')) return '이미 가입이 완료된 계정입니다.';
  if (msg.includes('not_authenticated')) return '로그인이 필요합니다.';

  return raw;
}
