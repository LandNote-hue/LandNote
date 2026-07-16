/**
 * 카카오톡 등 인앱 브라우저(웹뷰) 감지
 * Google OAuth는 disallowed_useragent 정책으로 이런 웹뷰에서의 로그인을 차단함
 */

/** @type {Record<string, RegExp>} */
const IN_APP_BROWSER_PATTERNS = {
  kakaotalk: /KAKAOTALK/i,
  naver: /NAVER\(/i,
  line: /\bLine\//i,
  facebook: /FBAN|FBAV/i,
  instagram: /Instagram/i,
};

/** @param {string} [ua] @returns {string|null} */
export function detectInAppBrowser(ua) {
  const s = ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  for (const [name, pattern] of Object.entries(IN_APP_BROWSER_PATTERNS)) {
    if (pattern.test(s)) return name;
  }
  return null;
}

/** @param {string} [ua] */
export function isAndroidUA(ua) {
  const s = ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  return /Android/i.test(s);
}

/** @param {string} [targetUrl] Android intent:// 링크로 크롬에서 강제로 열기 */
export function buildExternalBrowserIntentUrl(targetUrl) {
  const href = targetUrl || (typeof window !== 'undefined' ? window.location.href : '');
  try {
    const u = new URL(href);
    const path = `${u.host}${u.pathname}${u.search}`;
    return `intent://${path}#Intent;scheme=https;package=com.android.chrome;end`;
  } catch {
    return href;
  }
}

export const IN_APP_BROWSER_LABELS = {
  kakaotalk: '카카오톡',
  naver: '네이버 앱',
  line: '라인',
  facebook: '페이스북',
  instagram: '인스타그램',
};
