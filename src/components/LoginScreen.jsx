import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';
import { SignUpTermsAgreement } from './SignUpTermsAgreement.jsx';
import { createSubmitCooldown, validatePassword, PASSWORD_RESET_REQUEST_MESSAGE, getLoginAttemptStatus, recordLoginFailure, clearLoginAttempts, isInvalidLoginCredentialsError, LOGIN_MAX_FAILED_ATTEMPTS } from '../utils/authValidation.js';
import { getRememberMe, setRememberMe, getRememberEmail, setRememberEmail, getSavedEmail, setSavedEmail, clearSupabaseAuthTokens, getSupabaseProjectRef } from '../lib/authStorage.js';
import {
  buildSignUpConsentPayload,
  createEmptyTermAgreements,
  validateRequiredTerms,
} from '../data/termsData.js';
import { USER_TYPES } from '../data/userTypes.js';
import { displayNameFromUser } from '../utils/registrationStatus.js';
import { AUTH_PATHS } from '../navigation/authRoutes.js';
import { resolveReturnAppPath } from '../navigation/returnPath.js';
import { previewInviteToken } from '../services/teamService.js';
import { InviteTransferFlow } from './InviteTransferFlow.jsx';
import { InviteExistingUserModal } from './InviteExistingUserModal.jsx';

import { btnPx } from '../theme/buttonLayout.js';

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

/**
 * @param {{ onLegacyLogin?: () => void, variant?: 'login' | 'signup' | 'invite', inviteToken?: string, inviteCompanyName?: string, invitedEmail?: string, inviteRole?: string }} props
 */
export function LoginScreen({
  onLegacyLogin,
  variant = 'login',
  inviteToken: inviteTokenProp = '',
  inviteCompanyName = '',
  invitedEmail: invitedEmailProp = '',
  inviteRole: inviteRoleProp = 'MEMBER',
}) {
  const navigate = useNavigate();
  const inviteMode = variant === 'invite';
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    resetPassword,
    authError,
    clearAuthError,
    isConfigured,
    isDevBypass,
    user,
    needsSignupCompletion,
    completeOAuthSignup,
    abandonOAuthSignup,
  } = useAuth();

  const oauthSignupMode = needsSignupCompletion;

  const [mode, setMode] = useState(variant === 'login' ? 'login' : 'signup');
  const [email, setEmail] = useState(() => (variant === 'login' ? getSavedEmail() : ''));
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termAgreements, setTermAgreements] = useState(createEmptyTermAgreements);
  const [companyName, setCompanyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState(USER_TYPES.SOLO);
  const [inviteToken, setInviteToken] = useState(inviteTokenProp);
  const [rememberMe, setRememberMeState] = useState(() => getRememberMe());
  const [rememberEmail, setRememberEmailState] = useState(() => getRememberEmail());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showOAuthRejoinModal, setShowOAuthRejoinModal] = useState(false);
  const [showExistingUserModal, setShowExistingUserModal] = useState(false);
  const [forceTransferFlow, setForceTransferFlow] = useState(false);
  const submitCooldown = useMemo(() => createSubmitCooldown(), []);
  const honeypotRef = useRef(null);
  const passwordInputRef = useRef(null);
  const [passwordFieldReady, setPasswordFieldReady] = useState(false);

  useEffect(() => {
    if (!oauthSignupMode || !user) return;
    setMode('signup');
    if (user.email) setEmail(user.email);
    setDisplayName((prev) => prev.trim() || displayNameFromUser(user));
    setShowOAuthRejoinModal(true);
    setMessage('구글 계정 인증이 완료되었습니다. 약관 동의와 가입 유형을 선택해 주세요.');
  }, [oauthSignupMode, user]);

  useEffect(() => {
    if (inviteTokenProp) setInviteToken(inviteTokenProp);
  }, [inviteTokenProp]);

  useEffect(() => {
    if (variant === 'invite' && invitedEmailProp) {
      setEmail((prev) => (prev.trim() ? prev : invitedEmailProp));
    }
  }, [variant, invitedEmailProp]);

  useEffect(() => {
    if (variant === 'signup' || variant === 'login') {
      sessionStorage.removeItem('landnote.pendingInvite');
    }
    if (variant === 'invite' && inviteTokenProp) {
      sessionStorage.setItem('landnote.pendingInvite', inviteTokenProp);
    }
  }, [variant, inviteTokenProp]);

  useEffect(() => {
    const flash = sessionStorage.getItem('authFlash');
    if (flash) {
      setMessage(flash);
      sessionStorage.removeItem('authFlash');
    }
  }, []);

  useEffect(() => {
    if (variant !== 'login' || mode !== 'login' || oauthSignupMode) return;
    setPassword('');
    setPasswordFieldReady(false);
    if (passwordInputRef.current) passwordInputRef.current.value = '';
    const timer = window.setTimeout(() => {
      setPassword('');
      if (passwordInputRef.current) passwordInputRef.current.value = '';
    }, 150);
    return () => window.clearTimeout(timer);
  }, [variant, mode, oauthSignupMode, rememberEmail]);

  const submit = async (e) => {
    e?.preventDefault();
    clearAuthError();
    setMessage('');

    if (honeypotRef.current?.value) return;

    const isSignupForm = variant === 'signup' || variant === 'invite';
    const isEmailLogin = variant === 'login' && mode === 'login' && !oauthSignupMode;

    if (isEmailLogin) {
      const status = getLoginAttemptStatus(email);
      if (status.locked) {
        setMessage(`로그인 시도가 너무 많습니다. ${status.remainSec}초 후 다시 시도해 주세요.`);
        return;
      }
    } else {
      const cooldownMsg = submitCooldown.check();
      if (cooldownMsg) {
        setMessage(cooldownMsg);
        return;
      }
    }

    if (isSignupForm && !oauthSignupMode) {
      if (password !== passwordConfirm) {
        setMessage('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
      const pwHint = validatePassword(password, { forSignup: true });
      if (pwHint) {
        setMessage(pwHint);
        return;
      }
      const termsErr = validateRequiredTerms(termAgreements);
      if (termsErr) {
        setMessage(termsErr);
        return;
      }
      if (!displayName.trim()) {
        setMessage(inviteMode ? '이름을 입력해 주세요.' : userType === USER_TYPES.BUSINESS ? '대표자 이름을 입력해 주세요.' : '이름을 입력해 주세요.');
        return;
      }
      if (userType === USER_TYPES.BUSINESS && !inviteMode && !companyName.trim()) {
        setMessage('회사명을 입력해 주세요.');
        return;
      }
    }

    if (oauthSignupMode) {
      const termsErr = validateRequiredTerms(termAgreements);
      if (termsErr) {
        setMessage(termsErr);
        return;
      }
      if (!displayName.trim()) {
        setMessage(inviteMode ? '이름을 입력해 주세요.' : userType === USER_TYPES.BUSINESS ? '대표자 이름을 입력해 주세요.' : '이름을 입력해 주세요.');
        return;
      }
      if (userType === USER_TYPES.BUSINESS && !inviteMode && !companyName.trim()) {
        setMessage('회사명을 입력해 주세요.');
        return;
      }
    }

    const effectiveInviteToken = inviteMode
      ? (inviteToken || sessionStorage.getItem('landnote.pendingInvite') || '').trim()
      : '';

    setBusy(true);
    if (!isEmailLogin) submitCooldown.mark();
    try {
      if (oauthSignupMode) {
        const consent = buildSignUpConsentPayload(termAgreements);
        const { error } = await completeOAuthSignup({
          consent,
          userType: inviteMode ? USER_TYPES.BUSINESS : userType,
          displayName: displayName.trim(),
          companyName: inviteMode ? '' : companyName,
          inviteToken: inviteMode ? effectiveInviteToken : '',
        });
        if (!error) {
          setShowOAuthRejoinModal(false);
          sessionStorage.removeItem('landnote.pendingInvite');
          setMessage(inviteMode ? '직원 가입이 완료되었습니다.' : '회원가입이 완료되었습니다.');
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (!error) setMessage(PASSWORD_RESET_REQUEST_MESSAGE);
      } else if (isSignupForm) {
        // ── 기존 회원 소속 이관 분기 (초대 가입 — 기존 signUp 로직 보존) ──
        if (inviteMode && effectiveInviteToken) {
          try {
            const preview = await previewInviteToken(effectiveInviteToken);
            const invited = String(preview.invitedEmail || invitedEmailProp || '').trim().toLowerCase();
            const signingUp = email.trim().toLowerCase();
            if (preview.existingUser && invited && signingUp === invited) {
              setShowExistingUserModal(true);
              return;
            }
          } catch {
            /* preview 실패 시 아래 기존 가입 흐름 유지 */
          }
        }

        const consent = buildSignUpConsentPayload(termAgreements);
        const { error, needsEmailConfirmation } = await signUpWithEmail(email, password, consent, {
          companyName: inviteMode ? '' : companyName,
          inviteToken: inviteMode ? effectiveInviteToken : '',
          userType: inviteMode ? USER_TYPES.BUSINESS : userType,
          displayName: displayName.trim(),
        });
        if (error) {
          const errMsg = String(error?.message || '').toLowerCase();
          if (inviteMode && effectiveInviteToken && (
            errMsg.includes('already registered')
            || errMsg.includes('already been registered')
            || errMsg.includes('이미 가입')
          )) {
            setShowExistingUserModal(true);
            return;
          }
        }
        if (!error) {
          const successMsg = needsEmailConfirmation
            ? '가입 확인 메일을 보냈습니다. 링크를 눌러 이메일 인증을 완료한 뒤 로그인해 주세요.'
            : inviteMode
              ? '직원 가입이 완료되었습니다. 로그인해 주세요.'
              : '회원가입이 완료되었습니다. 로그인해 주세요.';
          sessionStorage.setItem('authFlash', successMsg);
          sessionStorage.removeItem('landnote.pendingInvite');
          navigate(AUTH_PATHS.login);
          setPassword('');
          setPasswordConfirm('');
          setCompanyName('');
          setDisplayName('');
          setUserType(USER_TYPES.SOLO);
          setTermAgreements(createEmptyTermAgreements());
        }
      } else {
        const { error } = await signInWithEmail(email, password, { rememberMe });
        if (!error) {
          clearLoginAttempts(email);
          if (rememberEmail) {
            setRememberEmail(true);
            setSavedEmail(email);
          } else {
            setRememberEmail(false);
          }
          setPassword('');
          setPasswordFieldReady(false);
          if (passwordInputRef.current) passwordInputRef.current.value = '';
          setMessage('');
          navigate(resolveReturnAppPath('/dashboard'), { replace: true });
        } else if (isInvalidLoginCredentialsError(error)) {
          const status = recordLoginFailure(email);
          clearAuthError();
          if (status.locked) {
            setMessage(`비밀번호 오류가 ${LOGIN_MAX_FAILED_ATTEMPTS}회 발생했습니다. ${status.remainSec}초 후 다시 시도해 주세요.`);
          } else {
            setMessage(`이메일 또는 비밀번호가 올바르지 않습니다. (남은 시도 ${status.remainingAttempts}회)`);
          }
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelOAuthSignup = async () => {
    setBusy(true);
    try {
      await abandonOAuthSignup();
      setShowOAuthRejoinModal(false);
      navigate(AUTH_PATHS.login);
      setPassword('');
      setPasswordConfirm('');
      setCompanyName('');
      setDisplayName('');
      setUserType(USER_TYPES.SOLO);
      setTermAgreements(createEmptyTermAgreements());
      setMessage('');
      clearAuthError();
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider) => {
    clearAuthError();
    if (variant === 'login') {
      sessionStorage.removeItem('landnote.pendingInvite');
    }
    setRememberMe(rememberMe);
    setBusy(true);
    try {
      await signInWithOAuth(provider, { rememberMe });
    } finally {
      setBusy(false);
    }
  };

  const toggleRememberMe = (checked) => {
    setRememberMeState(checked);
    setRememberMe(checked);
    if (!checked) {
      clearSupabaseAuthTokens(getSupabaseProjectRef());
    }
  };

  const toggleRememberEmail = (checked) => {
    setRememberEmailState(checked);
    setRememberEmail(checked);
    setPassword('');
    setPasswordFieldReady(false);
    if (passwordInputRef.current) passwordInputRef.current.value = '';
  };

  const isEmailLoginForm = variant === 'login' && mode === 'login' && !oauthSignupMode;

  const effectiveInviteTokenForRender = inviteMode
    ? (inviteToken || sessionStorage.getItem('landnote.pendingInvite') || '').trim()
    : '';

  if (inviteMode && forceTransferFlow && effectiveInviteTokenForRender) {
    return (
      <InviteTransferFlow
        token={effectiveInviteTokenForRender}
        companyName={inviteCompanyName}
        invitedEmail={invitedEmailProp || email}
        inviteRole={inviteRoleProp || 'MEMBER'}
      />
    );
  }

  return (
    <div style={{
      width: '100%', minHeight: '100dvh', maxHeight: '100dvh', margin: '0 auto',
      background: 'linear-gradient(135deg,#0B111C 0%,#141E2E 50%,#0E1927 100%)',
      position: 'relative', overflowX: 'hidden', overflowY: 'auto',
      WebkitOverflowScrolling: 'touch', boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', top: '8%', right: '12%', width: 500, height: 500, background: 'rgba(200,16,46,.07)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '8%', left: '10%', width: 380, height: 380, background: 'rgba(37,99,235,.06)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1,
        width: '100%', maxWidth: 420, margin: '0 auto',
        minHeight: '100dvh', justifyContent: 'center',
        padding: '24px 16px 32px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{
            width: 68, height: 68,
            background: `linear-gradient(145deg,${BRAND},#A00E25)`,
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(200,16,46,.45)', marginBottom: 20,
          }}>
            <Logo />
          </div>
          <div translate="no" lang="en" style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 6 }}>LandNote</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', letterSpacing: '.08em', fontWeight: 500 }}>
            {inviteMode && inviteCompanyName
              ? `${inviteCompanyName} 직원 가입`
              : variant === 'signup'
                ? '회원가입 — 개인 또는 회사 대표'
                : '부동산 매물관리 시스템'}
          </div>
        </div>

        <div style={{
          width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 18, padding: '32px 28px 28px', backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 48px rgba(0,0,0,.3)',
        }}>
          {authError && (mode !== 'login' || oauthSignupMode) && (
            <div style={{ fontSize: 13, color: '#FCA5A5', marginBottom: 16, lineHeight: 1.5, textAlign: 'center' }}>
              {authError}
            </div>
          )}
          {!isConfigured && !isDevBypass && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 16, lineHeight: 1.5, textAlign: 'center' }}>
              Supabase 미설정 — 로컬 개발 모드로 계속합니다.
            </div>
          )}

          {oauthSignupMode && (
            <div style={{
              marginBottom: 16, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.28)',
              fontSize: 13, color: 'rgba(255,255,255,.82)', lineHeight: 1.55,
            }}>
              등록되지 않았거나 탈퇴한 계정입니다. 구글 프로필 정보를 불러왔으니 약관 동의와 가입 유형만 선택해 주세요.
            </div>
          )}

          {isConfigured && variant === 'login' && mode === 'login' && !oauthSignupMode && (
            <>
              <GoogleSignInButton disabled={busy} rememberMe={rememberMe} onFallback={() => oauth('google')} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 16px' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.12)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>또는 이메일</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.12)' }} />
              </div>
            </>
          )}

          {isConfigured && (
            <form onSubmit={submit} autoComplete="off">
              <input ref={honeypotRef} type="text" name="company" tabIndex={-1} autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
              {(variant === 'login' && mode === 'login' && !oauthSignupMode) || mode === 'reset' || variant === 'signup' || variant === 'invite' || oauthSignupMode ? (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>이메일</label>
                <input type="email" required
                  autoComplete={isEmailLoginForm ? (rememberEmail ? 'username' : 'off') : 'email'}
                  value={email} readOnly={oauthSignupMode}
                  onChange={(e) => { if (!oauthSignupMode) setEmail(e.target.value); }}
                  placeholder="name@example.com"
                  style={{ ...inputStyle, ...(oauthSignupMode ? { opacity: 0.72, cursor: 'not-allowed' } : {}) }} />
              </div>
              ) : null}
              {(variant === 'signup' || oauthSignupMode) && !inviteMode && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, marginBottom: 8 }}>
                    가입 유형
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setUserType(USER_TYPES.SOLO)}
                      style={userTypeBtn(userType === USER_TYPES.SOLO)}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 4 }}>개인으로 시작</span>
                      <span style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.4 }}>1인 중개·개인 매물 관리</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType(USER_TYPES.BUSINESS)}
                      style={userTypeBtn(userType === USER_TYPES.BUSINESS)}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 4 }}>회사·팀으로 시작</span>
                      <span style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.4 }}>법인·팀원 초대·공유</span>
                    </button>
                  </div>
                </div>
              )}
              {(variant === 'signup' || variant === 'invite' || oauthSignupMode) && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    {inviteMode ? '이름' : userType === USER_TYPES.BUSINESS ? '대표자 이름' : '이름'}
                  </label>
                  <input type="text" autoComplete="name"
                    value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={inviteMode ? '홍길동' : userType === USER_TYPES.BUSINESS ? '홍길동' : '표시 이름'}
                    style={inputStyle} />
                </div>
              )}
              {inviteMode && (
                <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(200,16,46,.12)', border: '1px solid rgba(200,16,46,.25)' }}>
                  <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, marginBottom: 6 }}>
                    {inviteCompanyName ? `${inviteCompanyName} 직원 가입 페이지입니다` : '직원 초대 가입'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.55 }}>
                    회사명은 대표가 지정한 초대 링크로 자동 연결됩니다. 초대받은 이메일과 동일한 주소로 가입해 주세요.
                  </div>
                </div>
              )}
              {variant === 'signup' && !inviteMode && (
                <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.22)' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', lineHeight: 1.55 }}>
                    직원은 대표가 보낸 초대 링크로만 가입할 수 있습니다. 일반 가입에서는 개인 또는 회사 대표(CEO)만 선택할 수 있습니다.
                  </div>
                </div>
              )}
              {(variant === 'signup' || oauthSignupMode) && !inviteMode && userType === USER_TYPES.BUSINESS && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    회사 / 상호명 <span style={{ color: '#FCA5A5' }}>*</span>
                  </label>
                  <input type="text" autoComplete="organization" required
                    value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="부동산 중개법인명"
                    style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 6, lineHeight: 1.45 }}>
                    팀원 초대·데이터 공유에 사용됩니다. 대표(CEO) 권한으로 시작합니다.
                  </div>
                </div>
              )}
              {isEmailLoginForm && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>비밀번호</label>
                  <input type="password" required
                    ref={passwordInputRef}
                    autoComplete="new-password"
                    readOnly={!passwordFieldReady}
                    onFocus={() => setPasswordFieldReady(true)}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호"
                    style={inputStyle} />
                </div>
              )}
              {isEmailLoginForm && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16, flexWrap: 'wrap',
                }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => toggleRememberMe(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: BRAND, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
                      자동 로그인
                    </span>
                  </label>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => toggleRememberEmail(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: BRAND, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
                      아이디 기억하기
                    </span>
                  </label>
                </div>
              )}
              {(variant === 'signup' || variant === 'invite') && !oauthSignupMode && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>비밀번호</label>
                  <input type="password" required autoComplete="new-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="영문·숫자·특수문자 8자 이상"
                    minLength={8}
                    style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 6, lineHeight: 1.45 }}>
                    8자 이상, 영문·숫자·특수문자를 각각 1개 이상 포함
                  </div>
                </div>
              )}
              {(variant === 'signup' || variant === 'invite') && !oauthSignupMode && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', fontWeight: 600, display: 'block', marginBottom: 6 }}>비밀번호 확인</label>
                  <input type="password" required autoComplete="new-password"
                    value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 다시 입력"
                    minLength={8}
                    style={inputStyle} />
                </div>
              )}
              {(variant === 'signup' || variant === 'invite' || oauthSignupMode) && (
                <SignUpTermsAgreement agreements={termAgreements} onChange={setTermAgreements} />
              )}
              {(authError || message) && (
                <div style={{
                  fontSize: 13,
                  color: (authError || /올바르지|너무 많|초 후|분 뒤|연속|오류|실패|입력해|동의해|일치하지|보낼 수 없/.test(String(message || '')))
                    ? '#FCA5A5'
                    : '#86EFAC',
                  marginBottom: 12,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-line',
                  textAlign: (
                    message === PASSWORD_RESET_REQUEST_MESSAGE
                    || /재설정 메일을 연속|바로 다시 보낼 수 없습니다|요청이 너무 많습니다/.test(String(authError || message || ''))
                  )
                    ? 'center'
                    : 'left',
                }}>
                  {authError || message}
                </div>
              )}
              <button type="submit" disabled={busy} style={btnPrimary}>
                {busy ? '처리 중…' : oauthSignupMode ? '가입 완료' : variant === 'login' && mode === 'login' ? '로그인' : variant === 'login' && mode === 'reset' ? '재설정 메일 보내기' : inviteMode ? '직원 가입 완료' : '회원가입'}
              </button>
            </form>
          )}

          {(!isConfigured || isDevBypass) && (
            <button type="button" onClick={onLegacyLogin} style={{ ...btnPrimary, marginTop: isConfigured ? 12 : 0 }}>
              로컬 모드로 시작
            </button>
          )}

          {isConfigured && (
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,.4)' }}>
              {variant === 'login' && mode === 'login' && !oauthSignupMode && (
                <>
                  <Link to={AUTH_PATHS.signup} style={linkAnchor} onClick={() => { clearAuthError(); setMessage(''); }}>회원가입</Link>
                  <span style={{ margin: '0 8px' }}>·</span>
                  <button type="button" style={linkBtn} onClick={() => { setMode('reset'); clearAuthError(); setMessage(''); }}>비밀번호 찾기</button>
                </>
              )}
              {variant === 'login' && mode === 'reset' && !oauthSignupMode && (
                <button type="button" style={linkBtn} onClick={() => { setMode('login'); clearAuthError(); setMessage(''); }}>로그인으로 돌아가기</button>
              )}
              {(variant === 'signup' || variant === 'invite') && !oauthSignupMode && (
                <Link to={AUTH_PATHS.login} style={linkAnchor} onClick={() => { clearAuthError(); setMessage(''); setPasswordConfirm(''); setCompanyName(''); setDisplayName(''); setUserType(USER_TYPES.SOLO); setTermAgreements(createEmptyTermAgreements()); }}>로그인으로 돌아가기</Link>
              )}
              {oauthSignupMode && (
                <button type="button" style={linkBtn} disabled={busy} onClick={cancelOAuthSignup}>취소하고 로그인 화면으로</button>
              )}
            </div>
          )}

          {showOAuthRejoinModal && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}>
              <div style={{
                width: '100%', maxWidth: 360, background: '#fff', borderRadius: 14, padding: '24px 22px',
                boxShadow: '0 20px 50px rgba(0,0,0,.35)',
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>새 회원으로 가입</div>
                <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, marginBottom: 20 }}>
                  등록되지 않았거나 탈퇴한 회원 정보입니다. 새로운 회원으로 가입하시겠습니까?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" disabled={busy} onClick={cancelOAuthSignup}
                    style={{ flex: 1, height: btnPx(42), borderRadius: btnPx(8), border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: btnPx(14) }}>
                    취소
                  </button>
                  <button type="button" disabled={busy} onClick={() => setShowOAuthRejoinModal(false)}
                    style={{ flex: 1, height: btnPx(42), borderRadius: btnPx(8), border: 'none', background: BRAND, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: btnPx(14) }}>
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {showExistingUserModal && inviteMode && (
          <InviteExistingUserModal
            onCancel={() => setShowExistingUserModal(false)}
            onAccept={() => {
              setShowExistingUserModal(false);
              setForceTransferFlow(true);
            }}
          />
        )}

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.2)', marginTop: 28, letterSpacing: '.04em', textAlign: 'center' }}>
          RE/MAX Platinum Partners · © 2026 LandNote
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', height: btnPx(46), background: 'rgba(255,255,255,.07)',
  border: '1.5px solid rgba(255,255,255,.12)', borderRadius: btnPx(10),
  padding: `0 ${btnPx(16)}px`, color: '#fff', fontSize: btnPx(15), fontFamily: 'inherit', outline: 'none',
};

const btnPrimary = {
  width: '100%', height: btnPx(46),
  background: `linear-gradient(135deg,${BRAND},#A00E25)`,
  border: 'none', borderRadius: btnPx(10), color: '#fff', fontSize: btnPx(15), fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
};

const linkBtn = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,.55)',
  cursor: 'pointer', fontSize: btnPx(13), fontFamily: 'inherit', padding: 0,
};

const linkAnchor = {
  color: 'rgba(255,255,255,.55)',
  fontSize: btnPx(13),
  textDecoration: 'none',
};

function userTypeBtn(active) {
  return {
    padding: `${btnPx(12)}px ${btnPx(10)}px`,
    borderRadius: btnPx(10),
    border: active ? `2px solid ${BRAND}` : '1.5px solid rgba(255,255,255,.12)',
    background: active ? 'rgba(200,16,46,.15)' : 'rgba(255,255,255,.05)',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  };
}
