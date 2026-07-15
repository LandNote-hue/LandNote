import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';
import { transferTeamInvite, mapInviteError } from '../services/teamService.js';
import { companyRoleLabel } from '../data/companyRoles.js';
import { AUTH_PATHS } from '../navigation/authRoutes.js';
import {
  clearLoginAttempts,
  getLoginAttemptStatus,
  isInvalidLoginCredentialsError,
  LOGIN_MAX_FAILED_ATTEMPTS,
  recordLoginFailure,
} from '../utils/authValidation.js';

const BRAND = '#C8102E';

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

/**
 * @param {{
 *   token: string,
 *   companyName: string,
 *   invitedEmail: string,
 *   inviteRole: string,
 * }} props
 */
export function InviteTransferFlow({ token, companyName, invitedEmail, inviteRole }) {
  const navigate = useNavigate();
  const {
    user,
    signInWithEmail,
    signInWithOAuth,
    authError,
    clearAuthError,
    refreshProfile,
    isConfigured,
  } = useAuth();

  const [email, setEmail] = useState(invitedEmail || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  const emailMatches = user?.email
    && lower(user.email) === lower(invitedEmail);

  useEffect(() => {
    if (emailMatches) {
      setShowModal(true);
    }
  }, [emailMatches]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    clearAuthError();
    setMessage('');
    if (lower(email.trim()) !== lower(invitedEmail)) {
      setMessage('초대된 이메일과 동일한 계정으로 로그인해 주세요.');
      return;
    }
    const lock = getLoginAttemptStatus(email);
    if (lock.locked) {
      setMessage(`로그인 시도가 너무 많습니다. ${lock.remainSec}초 후 다시 시도해 주세요.`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await signInWithEmail(email.trim(), password, { rememberMe: false });
      if (!error) {
        clearLoginAttempts(email);
        setPassword('');
      } else if (isInvalidLoginCredentialsError(error)) {
        const status = recordLoginFailure(email);
        clearAuthError();
        if (status.locked) {
          setMessage(`비밀번호 오류가 ${LOGIN_MAX_FAILED_ATTEMPTS}회 발생했습니다. ${status.remainSec}초 후 다시 시도해 주세요.`);
        } else {
          setMessage(`이메일 또는 비밀번호가 올바르지 않습니다. (남은 시도 ${status.remainingAttempts}회)`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async () => {
    setBusy(true);
    clearAuthError();
    setMessage('');
    try {
      await transferTeamInvite(token);
      sessionStorage.removeItem('landnote.pendingInvite');
      await refreshProfile?.();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setMessage(mapInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = companyRoleLabel(inviteRole);

  return (
    <div style={{
      width: '100%', minHeight: '100dvh', margin: '0 auto',
      background: 'linear-gradient(135deg,#0B111C 0%,#141E2E 50%,#0E1927 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 18, padding: '28px 24px',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.4 }}>
          {companyName} 팀 초대
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, marginBottom: 20 }}>
          <strong style={{ color: 'rgba(255,255,255,.85)' }}>{invitedEmail}</strong>
          {' '}계정은 이미 랜드노트에 가입되어 있습니다.
          로그인 후 소속 변경을 진행해 주세요.
        </p>

        {!user ? (
          <>
            {isConfigured && (
              <>
                <GoogleSignInButton
                  disabled={busy}
                  rememberMe={false}
                  onFallback={() => signInWithOAuth('google', { rememberMe: false })}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.12)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>또는 이메일</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.12)' }} />
                </div>
              </>
            )}
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  이메일
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  비밀번호
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>
              {(authError || message) && (
                <div style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 12, lineHeight: 1.4 }}>
                  {authError || message}
                </div>
              )}
              <button type="submit" disabled={busy} style={btnPrimary}>
                {busy ? '로그인 중…' : '로그인'}
              </button>
            </form>
          </>
        ) : !emailMatches ? (
          <div style={{ fontSize: 14, color: '#FCA5A5', lineHeight: 1.6 }}>
            현재 로그인 계정({user.email})과 초대 이메일이 다릅니다.
            <div style={{ marginTop: 16 }}>
              <Link to={AUTH_PATHS.login} style={{ color: '#93C5FD', fontSize: 13 }}>다른 계정으로 로그인</Link>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.6 }}>
            아래 확인 버튼을 눌러 소속 변경을 완료해 주세요.
          </p>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to={AUTH_PATHS.login} style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', textDecoration: 'none' }}>
            로그인으로 돌아가기
          </Link>
        </div>
      </div>

      {showModal && emailMatches && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            width: '100%', maxWidth: 380, background: '#fff', borderRadius: 14, padding: '24px 22px',
            boxShadow: '0 20px 50px rgba(0,0,0,.35)',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
              소속 변경 확인
            </div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, marginBottom: 20 }}>
              이미 가입된 계정입니다. 초대한 회사의 직원으로 소속을 변경하시겠습니까?
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 10 }}>
                <strong style={{ color: '#0F172A' }}>{companyName}</strong>
                {' '}· {roleLabel}
                {' '}— 기존에 작성한 매물·고객 데이터는 본인 계정에 유지됩니다.
              </div>
            </div>
            {(authError || message) && (
              <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 12, lineHeight: 1.4 }}>
                {authError || message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setShowModal(false); navigate(AUTH_PATHS.login); }}
                style={{ flex: 1, height: 42, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleTransfer}
                style={{ flex: 1, height: 42, borderRadius: 8, border: 'none', background: BRAND, color: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                {busy ? '처리 중…' : '소속 변경 수락'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function lower(v) {
  return String(v || '').trim().toLowerCase();
}
