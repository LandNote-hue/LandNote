import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { createSubmitCooldown, validatePassword } from '../utils/authValidation.js';

const BRAND = '#C8102E';

const Logo = ({ sz = 38 }) => (
  <svg width={sz} height={sz} viewBox="0 0 68 68" fill="none" aria-hidden>
    <g transform="translate(34,34) scale(1.2) translate(-34,-34)">
      <rect x="18" y="22" width="32" height="38" rx="2" fill="#fff" />
      <rect x="22" y="26" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="31" y="26" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="40" y="26" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="22" y="35" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="31" y="35" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="40" y="35" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="22" y="44" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="31" y="44" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="40" y="44" width="7" height="7" rx="1" fill={BRAND} />
      <rect x="28" y="52" width="12" height="8" rx="1" fill={BRAND} />
    </g>
  </svg>
);

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const {
    user,
    confirmPasswordReset,
    authError,
    clearAuthError,
    passwordRecovery,
    loading: authLoading,
  } = useAuth();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submitCooldown = useMemo(() => createSubmitCooldown(), []);

  const submit = async (e) => {
    e?.preventDefault();
    clearAuthError();
    setMessage('');

    const cooldownMsg = submitCooldown.check();
    if (cooldownMsg) {
      setMessage(cooldownMsg);
      return;
    }
    if (password !== passwordConfirm) {
      setMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    const pwHint = validatePassword(password, { forSignup: true });
    if (pwHint) {
      setMessage(pwHint);
      return;
    }

    setBusy(true);
    submitCooldown.mark();
    try {
      const { error } = await confirmPasswordReset(password);
      if (!error) {
        sessionStorage.setItem('authFlash', '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
        navigate('/', { replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#0B111C' }}>
        재설정 링크 확인 중…
      </div>
    );
  }

  if (!passwordRecovery && !user) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B111C', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', color: 'rgba(255,255,255,.75)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 16 }}>비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.</p>
          <button type="button" onClick={() => navigate('/', { replace: true })} style={btnPrimary}>
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', minHeight: '100dvh', margin: '0 auto',
      background: 'linear-gradient(135deg,#0B111C 0%,#141E2E 50%,#0E1927 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', padding: '24px 16px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 68, height: 68,
            background: `linear-gradient(145deg,${BRAND},#A00E25)`,
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(200,16,46,.45)', marginBottom: 16,
          }}>
            <Logo />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>새 비밀번호 설정</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', textAlign: 'center', lineHeight: 1.5 }}>
            {user?.email ? `${user.email} 계정의 비밀번호를 변경합니다.` : '새 비밀번호를 입력해 주세요.'}
          </div>
        </div>

        <div style={{
          width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 18, padding: '28px 24px', backdropFilter: 'blur(20px)',
        }}>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>새 비밀번호</label>
              <input type="password" required autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="영문·숫자·특수문자 8자 이상" minLength={8} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>새 비밀번호 확인</label>
              <input type="password" required autoComplete="new-password" value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 다시 입력" minLength={8} style={inputStyle} />
            </div>
            {(authError || message) && (
              <div style={{ fontSize: 13, color: authError ? '#FCA5A5' : '#86EFAC', marginBottom: 12, lineHeight: 1.4 }}>
                {authError || message}
              </div>
            )}
            <button type="submit" disabled={busy} style={btnPrimary}>
              {busy ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 14, lineHeight: 1.5, textAlign: 'center' }}>
            변경 완료 후 모든 기기에서 다시 로그인해야 합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6,
};

const inputStyle = {
  width: '100%', height: 46, background: 'rgba(255,255,255,.07)',
  border: '1.5px solid rgba(255,255,255,.12)', borderRadius: 10,
  padding: '0 16px', color: '#fff', fontSize: 15, fontFamily: 'inherit', outline: 'none',
};

const btnPrimary = {
  width: '100%', height: 46,
  background: `linear-gradient(135deg,${BRAND},#A00E25)`,
  border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};
