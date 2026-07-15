import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoginScreen } from '../components/LoginScreen.jsx';
import { InviteTransferFlow } from '../components/InviteTransferFlow.jsx';
import { previewInviteToken } from '../services/teamService.js';
import { AUTH_PATHS } from '../navigation/authRoutes.js';

const BRAND = '#C8102E';

function InvitePreviewLoading() {
  return (
    <div style={{
      width: '100%', minHeight: '100dvh', margin: '0 auto',
      background: 'linear-gradient(135deg,#0B111C 0%,#141E2E 50%,#0E1927 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,.55)', fontSize: 14,
    }}>
      초대 링크 확인 중…
    </div>
  );
}

function InvitePreviewError({ message }) {
  return (
    <div style={{
      width: '100%', minHeight: '100dvh', margin: '0 auto',
      background: 'linear-gradient(135deg,#0B111C 0%,#141E2E 50%,#0E1927 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '28px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#FCA5A5', marginBottom: 12 }}>
          초대 링크를 사용할 수 없습니다
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', lineHeight: 1.6, marginBottom: 20 }}>
          {message}
        </p>
        <Link
          to={AUTH_PATHS.login}
          style={{
            display: 'inline-block', padding: '10px 20px', borderRadius: 10,
            background: `linear-gradient(135deg,${BRAND},#A00E25)`,
            color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14,
          }}
        >
          로그인으로 이동
        </Link>
      </div>
    </div>
  );
}

/** @param {{ onLegacyLogin?: () => void }} props */
export function InviteSignUpPage({ onLegacyLogin }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim()
    || searchParams.get('invite')?.trim()
    || '';
  const [companyName, setCompanyName] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [existingUser, setExistingUser] = useState(false);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('초대 토큰이 없습니다. 대표에게 받은 초대 링크 전체를 주소창에 붙여 넣어 주세요.');
      setLoading(false);
      return;
    }

    sessionStorage.setItem('landnote.pendingInvite', token);
    let cancelled = false;

    (async () => {
      try {
        const preview = await previewInviteToken(token);
        if (cancelled) return;
        if (!preview?.valid) {
          setError('초대 링크가 만료되었거나 유효하지 않습니다. 대표에게 새 초대 링크를 요청해 주세요.');
          return;
        }
        setCompanyName(preview.companyName || '회사');
        setInviteRole(preview.inviteRole || 'MEMBER');
        setInvitedEmail(preview.invitedEmail || '');
        setExistingUser(!!preview.existingUser);
      } catch (err) {
        if (!cancelled) {
          const detail = err?.message || err?.details || '';
          console.error('[invite] preview_company_invite failed', err);
          setError(
            detail.includes('preview_company_invite') || detail.includes('42883')
              ? '초대 링크를 확인하지 못했습니다. Supabase SQL Editor에서 022(또는 repair_preview_company_invite.sql) 마이그레이션 적용 여부를 확인해 주세요.'
              : detail
                ? `초대 링크를 확인하지 못했습니다. (${detail})`
                : '초대 링크를 확인하지 못했습니다. Supabase 연결 상태를 확인해 주세요.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  if (loading) return <InvitePreviewLoading />;
  if (error) return <InvitePreviewError message={error} />;

  if (existingUser) {
    return (
      <InviteTransferFlow
        token={token}
        companyName={companyName}
        invitedEmail={invitedEmail}
        inviteRole={inviteRole}
      />
    );
  }

  return (
    <LoginScreen
      variant="invite"
      inviteToken={token}
      inviteCompanyName={companyName}
      invitedEmail={invitedEmail}
      inviteRole={inviteRole}
      onLegacyLogin={onLegacyLogin}
    />
  );
}

/** @param {{ onLegacyLogin?: () => void }} props */
export function SignUpPage({ onLegacyLogin }) {
  const [searchParams] = useSearchParams();
  const legacyToken = searchParams.get('token')?.trim() || searchParams.get('invite')?.trim();

  useEffect(() => {
    if (!legacyToken) {
      sessionStorage.removeItem('landnote.pendingInvite');
    }
  }, [legacyToken]);

  if (legacyToken) {
    const next = `/signup/invite?token=${encodeURIComponent(legacyToken)}`;
    window.location.replace(next);
    return <InvitePreviewLoading />;
  }
  return <LoginScreen variant="signup" onLegacyLogin={onLegacyLogin} />;
}
