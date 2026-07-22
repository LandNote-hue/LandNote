import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  detectInAppBrowser,
  isAndroidUA,
  buildExternalBrowserIntentUrl,
  IN_APP_BROWSER_LABELS,
} from '../utils/inAppBrowser.js';

const BTN_LABEL = '구글계정으로 로그인';

/** Google G 로고 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** @param {{ disabled?: boolean, rememberMe?: boolean, onFallback?: () => void }} props */
export function GoogleSignInButton({ disabled, rememberMe = true, onFallback }) {
  const { signInWithOAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const inAppBrowser = useMemo(
    () => (typeof navigator === 'undefined' ? null : detectInAppBrowser(navigator.userAgent)),
    [],
  );

  const handleClick = async () => {
    if (disabled || busy) return;
    if (onFallback) {
      onFallback();
      return;
    }
    setBusy(true);
    try {
      await signInWithOAuth('google', { rememberMe });
    } finally {
      setBusy(false);
    }
  };

  if (inAppBrowser) {
    const label = IN_APP_BROWSER_LABELS[inAppBrowser] || '인앱 브라우저';
    const android = isAndroidUA();
    return (
      <div style={inAppBannerStyle}>
        <div style={{ fontSize: 13, color: '#FDE68A', lineHeight: 1.5, marginBottom: android ? 10 : 0 }}>
          {label} 안에서는 Google 정책상 구글 로그인을 사용할 수 없습니다.{' '}
          {android
            ? '아래 버튼으로 외부 브라우저에서 열어주세요.'
            : '오른쪽 상단 메뉴에서 "다른 브라우저로 열기"를 선택해 주세요.'}
        </div>
        {android && (
          <a href={buildExternalBrowserIntentUrl()} style={openExternalBtnStyle}>
            외부 브라우저(Chrome)로 열기
          </a>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={handleClick}
      style={{
        ...btnStyle,
        opacity: disabled || busy ? 0.65 : 1,
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
      }}
    >
      <GoogleMark />
      <span>{BTN_LABEL}</span>
    </button>
  );
}

const btnStyle = {
  width: '100%',
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: '#fff',
  border: 'none',
  borderRadius: 10,
  color: '#374151',
  fontSize: 15,
  fontWeight: 600,
  fontFamily: 'inherit',
  marginBottom: 16,
  boxSizing: 'border-box',
};

const inAppBannerStyle = {
  width: '100%',
  marginBottom: 16,
  padding: '14px 16px',
  borderRadius: 10,
  background: 'rgba(251,191,36,.1)',
  border: '1px solid rgba(251,191,36,.3)',
  boxSizing: 'border-box',
};

const openExternalBtnStyle = {
  display: 'inline-block',
  fontSize: 13,
  fontWeight: 700,
  color: '#fff',
  background: '#374151',
  padding: '8px 14px',
  borderRadius: 8,
  textDecoration: 'none',
};
