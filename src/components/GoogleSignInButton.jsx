import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

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

  rememberMeRef.current = rememberMe;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || disabled) return undefined;

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
  }, [disabled, signInWithGoogleCredential]);

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
