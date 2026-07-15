const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function validateEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return '이메일을 입력해 주세요.';
  if (normalized.length > 254) return '이메일 주소가 너무 깁니다.';
  if (!EMAIL_RE.test(normalized)) return '올바른 이메일 형식이 아닙니다.';
  if (/[<>"'`\\;]/.test(normalized)) return '허용되지 않는 문자가 포함되어 있습니다.';
  return null;
}

export function validatePassword(password, { forSignup = false } = {}) {
  const pw = String(password || '');
  if (!pw) return '비밀번호를 입력해 주세요.';
  if (forSignup) {
    if (pw.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
    if (pw.length > 128) return '비밀번호는 128자 이하여야 합니다.';
    if (!/[a-zA-Z]/.test(pw)) return '비밀번호에 영문을 포함해 주세요.';
    if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해 주세요.';
    if (!/[^a-zA-Z0-9]/.test(pw)) return '비밀번호에 특수문자를 포함해 주세요.';
  }
  return null;
}

/** @param {import('@supabase/supabase-js').AuthError | Error | null | undefined} error */
export function mapAuthErrorMessage(error) {
  if (!error) return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  const err = /** @type {Record<string, unknown>} */ (error);
  const parts = [
    err.message,
    err.error_description,
    err.msg,
    err.details,
    err.hint,
  ]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean);

  const raw = parts.find((p) => p && p !== '{}' && p !== '[object Object]') || parts[0] || '';
  const msg = raw.toLowerCase();

  if (!msg || msg === '{}' || msg === '[object object]') {
    if (err.status === 500 || err.code === 'unexpected_failure') {
      return '가입/로그인 처리 중 서버(DB) 오류가 발생했습니다. Supabase SQL Editor에서 supabase/migrations/014_signup_schema_repair.sql 을 실행한 뒤 다시 시도해 주세요.';
    }
    return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (msg.includes('company_name_required')) return '회사명을 입력해 주세요.';
  if (msg.includes('signup_failed') || msg.includes('company_members_role_check')) {
    return '가입 처리 중 조직 설정 오류가 발생했습니다. Supabase SQL Editor에서 014_signup_schema_repair.sql 을 실행해 주세요.';
  }  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return '이미 가입된 이메일이거나, 가입 확인 메일을 보낼 수 없습니다.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (msg.includes('auth session missing') || msg.includes('session missing') || err.name === 'AuthSessionMissingError') {
    return '로그인 세션이 없습니다. 비밀번호 재설정 링크를 다시 요청하거나, 새로 로그인해 주세요.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 받은 편지함의 확인 링크를 눌러 주세요.';
  }
  if (
    msg.includes('rate limit')
    || msg.includes('too many requests')
    || msg.includes('only request this after')
    || msg.includes('over_email_send')
    || err.code === 'over_email_send_rate_limit'
  ) {
    const waitLabel = formatRetryWaitLabel(raw);
    const isEmailSendLimit = (
      msg.includes('email')
      || msg.includes('security purposes')
      || msg.includes('over_email_send')
      || err.code === 'over_email_send_rate_limit'
    );
    if (isEmailSendLimit) {
      return waitLabel
        ? `비밀번호 재설정 메일을 연속으로 보낼 수 없습니다.\n약 ${waitLabel} 뒤에 다시 시도해 주세요.`
        : '비밀번호 재설정 메일을 연속으로 보낼 수 없습니다.\n약 1분 뒤에 다시 시도해 주세요.';
    }
    return waitLabel
      ? `요청이 너무 많습니다.\n약 ${waitLabel} 뒤에 다시 시도해 주세요.`
      : '요청이 너무 많습니다.\n약 1분 뒤에 다시 시도해 주세요.';
  }
  if (msg.includes('password')) return '비밀번호 요건을 확인해 주세요.';
  if (msg.includes('terms_required') || msg.includes('required terms')) {
    return '필수 약관에 동의해주세요.';
  }
  if (msg.includes('terms_version')) return '약관 동의 정보가 올바르지 않습니다. 다시 시도해 주세요.';
  if (msg.includes('invite_email_mismatch')) return '초대된 이메일과 가입 이메일이 일치하지 않습니다.';
  if (msg.includes('invite_invalid')) return '초대 링크가 만료되었거나 유효하지 않습니다.';
  return raw || '요청을 처리하지 못했습니다.';
}

/** 서버 메시지에서 재시도 대기 시간 추출 → "45초" / "2분" */
function formatRetryWaitLabel(raw) {
  const text = String(raw || '');
  const afterSec = text.match(/after\s+(\d+)\s+seconds?/i);
  if (afterSec) {
    const sec = Number(afterSec[1]);
    if (Number.isFinite(sec) && sec > 0) {
      if (sec < 60) return `${sec}초`;
      return `${Math.ceil(sec / 60)}분`;
    }
  }
  const afterMin = text.match(/after\s+(\d+)\s+minutes?/i);
  if (afterMin) {
    const min = Number(afterMin[1]);
    if (Number.isFinite(min) && min > 0) return `${min}분`;
  }
  const koSec = text.match(/(\d+)\s*초\s*(?:후|뒤|뒤)/);
  if (koSec) {
    const sec = Number(koSec[1]);
    if (Number.isFinite(sec) && sec > 0) {
      if (sec < 60) return `${sec}초`;
      return `${Math.ceil(sec / 60)}분`;
    }
  }
  const koMin = text.match(/(\d+)\s*분\s*(?:후|뒤)/);
  if (koMin) {
    const min = Number(koMin[1]);
    if (Number.isFinite(min) && min > 0) return `${min}분`;
  }
  return null;
}

export const AUTH_SUBMIT_COOLDOWN_MS = 30_000;

/** 이메일 로그인: 비밀번호 오류 허용 횟수 (이후 잠금) */
export const LOGIN_MAX_FAILED_ATTEMPTS = 3;
/** 비밀번호 오류 N회 후 잠금 시간 */
export const LOGIN_LOCKOUT_MS = 60_000;

const LOGIN_ATTEMPTS_STORAGE_KEY = 'landnote.auth.loginAttempts';

/**
 * @returns {Record<string, { fails: number, lockedUntil: number }>}
 */
function loadLoginAttemptStore() {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, { fails: number, lockedUntil: number }>} store */
function saveLoginAttemptStore(store) {
  try {
    sessionStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} email
 * @returns {{ locked: boolean, remainSec: number, fails: number, remainingAttempts: number }}
 */
export function getLoginAttemptStatus(email) {
  const key = normalizeEmail(email);
  if (!key) {
    return { locked: false, remainSec: 0, fails: 0, remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS };
  }
  const store = loadLoginAttemptStore();
  const entry = store[key] || { fails: 0, lockedUntil: 0 };
  const now = Date.now();

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      locked: true,
      remainSec: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
      fails: entry.fails,
      remainingAttempts: 0,
    };
  }

  if (entry.lockedUntil && entry.lockedUntil <= now) {
    store[key] = { fails: 0, lockedUntil: 0 };
    saveLoginAttemptStore(store);
    return { locked: false, remainSec: 0, fails: 0, remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS };
  }

  return {
    locked: false,
    remainSec: 0,
    fails: entry.fails || 0,
    remainingAttempts: Math.max(0, LOGIN_MAX_FAILED_ATTEMPTS - (entry.fails || 0)),
  };
}

/** @param {string} email */
export function recordLoginFailure(email) {
  const key = normalizeEmail(email);
  if (!key) return getLoginAttemptStatus(email);

  const store = loadLoginAttemptStore();
  const prev = store[key] || { fails: 0, lockedUntil: 0 };
  const now = Date.now();
  // 잠금 중이면 카운트만 유지
  if (prev.lockedUntil && prev.lockedUntil > now) {
    return getLoginAttemptStatus(email);
  }

  const fails = (prev.fails || 0) + 1;
  const lockedUntil = fails >= LOGIN_MAX_FAILED_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : 0;
  store[key] = { fails, lockedUntil };
  saveLoginAttemptStore(store);
  return getLoginAttemptStatus(email);
}

/** @param {string} email */
export function clearLoginAttempts(email) {
  const key = normalizeEmail(email);
  if (!key) return;
  const store = loadLoginAttemptStore();
  if (!store[key]) return;
  delete store[key];
  saveLoginAttemptStore(store);
}

/** @param {unknown} error */
export function isInvalidLoginCredentialsError(error) {
  if (!error) return false;
  const msg = String(
    /** @type {{ message?: string }} */ (error).message
    || /** @type {{ error_description?: string }} */ (error).error_description
    || '',
  ).toLowerCase();
  return (
    msg.includes('invalid login credentials')
    || msg.includes('invalid credentials')
    || msg.includes('이메일 또는 비밀번호가 올바르지 않습니다')
  );
}

export function authRedirectUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}

export const PASSWORD_RESET_REDIRECT_PATH = '/reset-password';

export const PASSWORD_RESET_REQUEST_MESSAGE =
  '등록된 이메일이면 비밀번호 재설정 링크를 보냈습니다.\n메일함·스팸함을 확인해 주세요.\n(네이버 메일은 외부 메일이 스팸·차단될 수 있습니다.)';

export function createSubmitCooldown() {
  let lastAt = 0;
  return {
    check() {
      const now = Date.now();
      const remain = AUTH_SUBMIT_COOLDOWN_MS - (now - lastAt);
      if (remain > 0) {
        const sec = Math.ceil(remain / 1000);
        return sec >= 60
          ? `바로 다시 보낼 수 없습니다.\n약 ${Math.ceil(sec / 60)}분 뒤에 다시 시도해 주세요.`
          : `바로 다시 보낼 수 없습니다.\n약 ${sec}초 뒤에 다시 시도해 주세요.`;
      }
      return null;
    },
    mark() {
      lastAt = Date.now();
    },
  };
}
