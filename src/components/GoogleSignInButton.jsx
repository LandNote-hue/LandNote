import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  detectInAppBrowser,
  isAndroidUA,
  buildExternalBrowserIntentUrl,
  IN_APP_BROWSER_LABELS,
} from '../utils/inAppBrowser.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

let gsiScriptPromise = null;

function loadGsiScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

/** @param {{ disabled?: boolean, rememberMe?: boolean, onFallback?: () => void }} props */
export function GoogleSignInButton({ disabled, rememberMe = true, onFallback }) {
  const { signInWithGoogleCredential } = useAuth();
  const containerRef = useRef(null);
  const rememberMeRef = useRef(rememberMe);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const inAppBrowser = useMemo(
    () => (typeof navigator === 'undefined' ? null : detectInAppBrowser(navigator.userAgent)),
    [],
  );

  rememberMeRef.current = rememberMe;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || disabled || inAppBrowser) return undefined;

    let cancelled = false;

    const init = async () => {
      try {
        await loadGsiScript();
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        const width = Math.max(containerRef.current.offsetWidth, 280);

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          callback: async (response) => {
            if (!response?.credential) return;
            await signInWithGoogleCredential(response.credential, {
              rememberMe: rememberMeRef.current,
            });
          },
        });

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width,
        });

        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          console.error('[google-signin]', err);
          setLoadError(err.message || 'Google 버튼 초기화 실패');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [disabled, signInWithGoogleCredential, inAppBrowser]);

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

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button type="button" disabled={disabled} onClick={onFallback} style={fallbackBtnStyle}>
        Google로 계속
      </button>
    );
  }

  if (loadError) {
    return (
      <div>
        <div style={{ fontSize: 12, color: '#FCA5A5', marginBottom: 8, lineHeight: 1.4 }}>{loadError}</div>
        <button type="button" disabled={disabled} onClick={onFallback} style={fallbackBtnStyle}>
          Google로 계속 (리다이렉트)
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', marginBottom: 16 }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: ready ? 1 : 0,
          minHeight: ready ? undefined : 0,
          overflow: 'hidden',
          pointerEvents: disabled || !ready ? 'none' : 'auto',
        }}
      />
      {!ready && !loadError && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', textAlign: 'center' }}>
          Google 로그인 준비 중…
        </div>
      )}
    </div>
  );
}

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

const fallbackBtnStyle = {
  width: '100%',
  height: 48,
  background: '#fff',
  border: 'none',
  borderRadius: 10,
  color: '#374151',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginBottom: 16,
};
