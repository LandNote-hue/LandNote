const REMEMBER_KEY = 'landnote.auth.rememberMe';
const REMEMBER_EMAIL_KEY = 'landnote.auth.rememberEmail';
const SAVED_EMAIL_KEY = 'landnote.auth.savedEmail';

/** @param {string} [url] */
export function getSupabaseProjectRef(url = import.meta.env.VITE_SUPABASE_URL) {
  try {
    const host = new URL(String(url || '').trim()).hostname;
    return host.split('.')[0] || '';
  } catch {
    return '';
  }
}

/** 자동 로그인(세션 유지) — 기본값 false */
export function getRememberMe() {
  const v = localStorage.getItem(REMEMBER_KEY);
  if (v === null) return false;
  return v === 'true';
}

/** @param {boolean} enabled */
export function setRememberMe(enabled) {
  localStorage.setItem(REMEMBER_KEY, enabled ? 'true' : 'false');
}

/** 아이디(이메일) 기억 — 기본값 false, 비밀번호는 저장하지 않음 */
export function getRememberEmail() {
  const v = localStorage.getItem(REMEMBER_EMAIL_KEY);
  if (v === null) return false;
  return v === 'true';
}

/** @param {boolean} enabled */
export function setRememberEmail(enabled) {
  localStorage.setItem(REMEMBER_EMAIL_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    localStorage.removeItem(SAVED_EMAIL_KEY);
  }
}

/** @returns {string} */
export function getSavedEmail() {
  if (!getRememberEmail()) return '';
  return localStorage.getItem(SAVED_EMAIL_KEY)?.trim() || '';
}

/** @param {string} email */
export function setSavedEmail(email) {
  const trimmed = String(email || '').trim();
  if (!trimmed) {
    localStorage.removeItem(SAVED_EMAIL_KEY);
    return;
  }
  localStorage.setItem(SAVED_EMAIL_KEY, trimmed);
}

export function clearSavedEmail() {
  localStorage.removeItem(SAVED_EMAIL_KEY);
}

function activeStore() {
  return getRememberMe() ? localStorage : sessionStorage;
}

function authTokenKeys(store, projectRef = getSupabaseProjectRef()) {
  if (!projectRef) return [];
  const needle = `sb-${projectRef}-`;
  /** @type {string[]} */
  const keys = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(needle) && key.includes('auth')) keys.push(key);
  }
  return keys;
}

/** @param {string} [projectRef] */
export function clearSupabaseAuthTokens(projectRef = getSupabaseProjectRef()) {
  if (!projectRef) return;
  for (const store of [localStorage, sessionStorage]) {
    for (const key of authTokenKeys(store, projectRef)) {
      store.removeItem(key);
    }
  }
}

/**
 * rememberMe 설정에 맞게 세션 토큰을 localStorage 또는 sessionStorage 한쪽에만 둡니다.
 * Google OAuth·GIS 로그인 후 잘못된 저장소에 남은 토큰을 정리할 때 사용합니다.
 * @param {string} [projectRef]
 */
export function syncAuthTokensToRememberStore(projectRef = getSupabaseProjectRef()) {
  if (!projectRef) return;
  const primary = getRememberMe() ? localStorage : sessionStorage;
  const secondary = getRememberMe() ? sessionStorage : localStorage;
  for (const key of authTokenKeys(secondary, projectRef)) {
    const value = secondary.getItem(key);
    if (value != null) primary.setItem(key, value);
    secondary.removeItem(key);
  }
}

/** Supabase Auth용 — rememberMe에 따라 localStorage / sessionStorage 분기 */
export const authStorage = {
  getItem(key) {
    return activeStore().getItem(key);
  },
  setItem(key, value) {
    activeStore().setItem(key, value);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
