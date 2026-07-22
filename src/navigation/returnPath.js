import { AUTH_PATHS } from './authRoutes.js';

const LAST_APP_PATH_KEY = 'landnote.lastAppPath';

/** @param {string} pathname */
export function isAuthPathname(pathname) {
  const p = String(pathname || '');
  return p === AUTH_PATHS.login
    || p === AUTH_PATHS.signup
    || p === AUTH_PATHS.signupInvite
    || p.startsWith(`${AUTH_PATHS.signupInvite}/`);
}

/** @param {string} pathname */
export function isPersistableAppPath(pathname) {
  const p = String(pathname || '');
  if (!p || p === '/') return false;
  if (isAuthPathname(p)) return false;
  if (p === '/reset-password' || p.startsWith('/reset-password')) return false;
  return true;
}

/** @param {string} [pathWithSearch] */
export function saveLastAppPath(pathWithSearch) {
  const raw = String(pathWithSearch || '');
  const pathname = raw.split('?')[0] || '';
  if (!isPersistableAppPath(pathname)) return;
  try {
    sessionStorage.setItem(LAST_APP_PATH_KEY, raw);
  } catch {
    /* ignore */
  }
}

/** @returns {string|null} */
export function readLastAppPath() {
  try {
    const raw = sessionStorage.getItem(LAST_APP_PATH_KEY);
    if (!raw) return null;
    const pathname = raw.split('?')[0] || '';
    if (!isPersistableAppPath(pathname)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** 현재 주소가 앱 경로면 즉시 저장 (인증 리다이렉트 전에 호출) */
export function captureCurrentAppPathFromWindow() {
  if (typeof window === 'undefined') return;
  saveLastAppPath(`${window.location.pathname}${window.location.search || ''}`);
}

/** @param {string} [fallback='/dashboard'] */
export function resolveReturnAppPath(fallback = '/dashboard') {
  return readLastAppPath() || fallback;
}
