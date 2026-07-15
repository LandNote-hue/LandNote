import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useProperties } from '../hooks/useProperties.js';
import {
  useOwnerCustomers,
  useOwnerCallLogs,
  useOwnerSchedules,
} from '../hooks/useOwnerScopedData.js';
import {
  fetchCanDeleteAccount,
  mapAccountDeletionError,
} from '../services/accountDeletionService.js';
import { USER_TYPES } from '../data/userTypes.js';

const BRAND = '#C8102E';
const CONFIRM_PHRASE = '탈퇴할게요';

const WITHDRAW_REASONS = [
  { id: 'cost', label: '비용이 부담돼요' },
  { id: 'difficult', label: '사용이 어려워요' },
  { id: 'features', label: '필요한 기능이 없어요' },
  { id: 'competitor', label: '다른 서비스로 옮겨요' },
  { id: 'pause', label: '당분간 쓰지 않을 것 같아요' },
  { id: 'other', label: '기타' },
];

export function WithdrawAccountPage() {
  const navigate = useNavigate();
  const {
    user,
    accountDefaults,
    companyRole,
    profile,
    deleteAccount,
    isConfigured,
  } = useAuth();

  const properties = useProperties();
  const customers = useOwnerCustomers();
  const callLogs = useOwnerCallLogs();
  const schedules = useOwnerSchedules();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canDelete, setCanDelete] = useState(/** @type {{ allowed: boolean, reason?: string, code?: string } | null} */ (null));
  const [dataAck, setDataAck] = useState(false);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isGoogleUser = user?.app_metadata?.provider === 'google'
    || user?.identities?.some?.((i) => i.provider === 'google');
  const isSolo = profile?.user_type === USER_TYPES.SOLO || companyRole === 'SOLO';
  const displayName = accountDefaults.displayName || user?.email?.split('@')[0] || '회원';

  const stats = useMemo(() => ({
    properties: properties?.length ?? 0,
    customers: customers?.length ?? 0,
    callLogs: callLogs?.length ?? 0,
    schedules: schedules?.length ?? 0,
  }), [properties, customers, callLogs, schedules]);

  const refreshEligibility = useCallback(async () => {
    if (!isConfigured) {
      setCanDelete({ allowed: false, reason: '클라우드 계정만 탈퇴할 수 있습니다.' });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchCanDeleteAccount();
      setCanDelete(result);
    } catch (err) {
      setCanDelete({
        allowed: false,
        reason: mapAccountDeletionError(err),
        code: 'ERROR',
      });
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  const phraseOk = confirmText === CONFIRM_PHRASE;
  const passwordOk = isGoogleUser || password.length > 0;
  const step3Ok = phraseOk && passwordOk && canDelete?.allowed;

  const handlePasteBlock = (e) => {
    e.preventDefault();
    setErrorMsg('확약 문구는 직접 입력해 주세요. (붙여넣기 불가)');
  };

  const handleWithdraw = async () => {
    if (!step3Ok || busy) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const { error } = await deleteAccount({
        password: isGoogleUser ? undefined : password,
      });
      if (error) {
        setErrorMsg(mapAccountDeletionError(error));
        setShowFinalModal(false);
        return;
      }
      window.location.href = '/';
    } catch (err) {
      setErrorMsg(mapAccountDeletionError(err));
      setShowFinalModal(false);
    } finally {
      setBusy(false);
    }
  };

  if (!user || user.id === 'dev-local') {
    return (
      <Shell>
        <Card>
          <p style={bodyText}>로그인 후 이용할 수 있습니다.</p>
          <button type="button" style={btnSecondary} onClick={() => navigate('/dashboard')}>돌아가기</button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <button type="button" onClick={() => navigate('/dashboard')} style={backLink}>
          ← 설정으로 돌아가기
        </button>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '12px 0 6px' }}>회원탈퇴</h1>
        <StepIndicator current={step} total={3} />

        {loading && (
          <Card><p style={mutedText}>탈퇴 가능 여부 확인 중…</p></Card>
        )}

        {!loading && canDelete && !canDelete.allowed && (
          <Card>
            <p style={{ ...bodyText, color: '#B45309' }}>{canDelete.reason || '현재 탈퇴할 수 없습니다.'}</p>
            <button type="button" style={btnSecondary} onClick={() => navigate('/dashboard')}>돌아가기</button>
          </Card>
        )}

        {!loading && canDelete?.allowed && step === 1 && (
          <Card>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={warnIcon}>!</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
                  탈퇴 시 데이터가 영구 삭제됩니다
                </div>
                <p style={bodyText}>
                  <strong>{displayName}</strong>님이 등록하신 자산이 즉시 삭제되거나 익명화됩니다.
                </p>
              </div>
            </div>

            <div style={statsGrid}>
              <StatBox label="매물" value={stats.properties} />
              <StatBox label="고객" value={stats.customers} />
              <StatBox label="통화내역" value={stats.callLogs} />
              <StatBox label="일정" value={stats.schedules} />
            </div>

            <ul style={bulletList}>
              <li>개인 일정·고객·폴더 등은 복구할 수 없습니다.</li>
              <li>회사(Business) 계정의 매물·통화는 회사에 남고 작성자만 익명화됩니다.</li>
              <li>유료 구독·보너스 혜택이 도입되면 탈퇴 시 잔여 기간은 소멸되며 환불되지 않습니다.</li>
            </ul>

            <label style={checkRow}>
              <input
                type="checkbox"
                checked={dataAck}
                onChange={(e) => setDataAck(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: BRAND }}
              />
              <span>위 내용을 모두 확인했으며, 데이터 삭제에 동의합니다.</span>
            </label>

            <button
              type="button"
              disabled={!dataAck}
              onClick={() => setStep(2)}
              style={btnPrimary(!dataAck)}
            >
              다음
            </button>
          </Card>
        )}

        {!loading && canDelete?.allowed && step === 2 && (
          <Card>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              잠시 쉬어가는 건 어떠세요?
            </div>
            <p style={{ ...mutedText, marginBottom: 16 }}>
              탈퇴 대신 아래 방법을 고려해 보실 수 있습니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <AltCard
                title="한 달간 멤버십 잠시 멈추기"
                desc="데이터는 보존하고 결제만 한 달 유예 (유료 플랜 도입 예정)"
                badge="준비 중"
                disabled
              />
              {!isSolo && (
                <AltCard
                  title="무료(개인) 플랜으로 변경"
                  desc="팀 공유는 끄고 내 매물장만 유지합니다."
                  actionLabel="설정으로 이동"
                  onAction={() => navigate('/dashboard')}
                />
              )}
              {isSolo && (
                <AltCard
                  title="현재 개인(Solo) 플랜 이용 중"
                  desc="팀 기능 없이 개인 매물만 관리하는 무료 플랜입니다."
                  disabled
                />
              )}
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 10 }}>
              탈퇴 사유를 알려주세요 <span style={{ color: '#94A3B8', fontWeight: 400 }}>(필수)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {WITHDRAW_REASONS.map((r) => (
                <label key={r.id} style={radioRow}>
                  <input
                    type="radio"
                    name="withdraw-reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" style={btnGhost} onClick={() => setStep(1)}>이전</button>
              <button
                type="button"
                disabled={!reason}
                onClick={() => setStep(3)}
                style={btnDangerOutline(!reason)}
              >
                그래도 탈퇴 진행
              </button>
            </div>
          </Card>
        )}

        {!loading && canDelete?.allowed && step === 3 && (
          <Card>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#991B1B', marginBottom: 8 }}>
              최종 확인
            </div>
            <p style={{ ...bodyText, marginBottom: 16 }}>
              실수를 방지하기 위해 본인 확인과 확약 문구 입력이 필요합니다.
            </p>

            {!isGoogleUser && (
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>현재 비밀번호</label>
                <input
                  type="password"
                  className="inp"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="비밀번호 입력"
                />
              </div>
            )}

            {isGoogleUser && (
              <p style={{ ...mutedText, marginBottom: 14 }}>
                Google 계정입니다. 아래 확약 문구를 정확히 입력해 주세요.
              </p>
            )}

            <div style={{ marginBottom: 8 }}>
              <label style={fieldLabel}>확약 문구 (아래 문장을 그대로 입력)</label>
              <div style={phraseBox}>{CONFIRM_PHRASE}</div>
            </div>
            <input
              type="text"
              className="inp"
              value={confirmText}
              onChange={(e) => { setConfirmText(e.target.value); setErrorMsg(''); }}
              onPaste={handlePasteBlock}
              onDrop={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck={false}
              placeholder="위 문장을 직접 입력"
              style={{ marginBottom: 8 }}
            />
            {confirmText && !phraseOk && (
              <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>문구가 일치하지 않습니다.</p>
            )}

            {errorMsg && (
              <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 12, lineHeight: 1.5 }}>{errorMsg}</p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 }}>
              <button type="button" style={btnGhost} onClick={() => setStep(2)} disabled={busy}>이전</button>
              <button
                type="button"
                disabled={!step3Ok || busy}
                onClick={() => setShowFinalModal(true)}
                style={btnDanger(!step3Ok || busy)}
              >
                완전히 탈퇴하기
              </button>
            </div>
          </Card>
        )}
      </div>

      {showFinalModal && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
              정말 마지막입니다
            </div>
            <p style={{ ...bodyText, marginBottom: 18 }}>
              탈퇴 후에는 계정과 데이터를 복구할 수 없습니다. 탈퇴하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" disabled={busy} onClick={() => setShowFinalModal(false)} style={btnSecondary}>
                취소
              </button>
              <button type="button" disabled={busy} onClick={handleWithdraw} style={btnDanger(false)}>
                {busy ? '처리 중…' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F1F5F9',
      display: 'flex',
      justifyContent: 'center',
      padding: '32px 16px 48px',
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {children}
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #E2E8F0',
      padding: '22px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      marginTop: 16,
    }}>
      {children}
    </div>
  );
}

/** @param {{ current: number, total: number }} props */
function StepIndicator({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i + 1 <= current ? BRAND : '#E2E8F0',
          }}
        />
      ))}
    </div>
  );
}

/** @param {{ label: string, value: number }} props */
function StatBox({ label, value }) {
  return (
    <div style={{
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: 10,
      padding: '14px 12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#991B1B' }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** @param {{ title: string, desc: string, badge?: string, actionLabel?: string, onAction?: () => void, disabled?: boolean }} props */
function AltCard({ title, desc, badge, actionLabel, onAction, disabled }) {
  return (
    <div style={{
      border: '1px solid #E2E8F0',
      borderRadius: 10,
      padding: '14px 16px',
      background: disabled ? '#F8FAFC' : '#fff',
      opacity: disabled && !actionLabel ? 0.85 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{title}</div>
        {badge && (
          <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: 999 }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#64748B', margin: '6px 0 0', lineHeight: 1.5 }}>{desc}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} style={{ ...btnGhost, marginTop: 10, fontSize: 13 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const statsGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginBottom: 16,
};

const bodyText = { fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 };
const mutedText = { fontSize: 13, color: '#64748B', lineHeight: 1.55, margin: 0 };
const bulletList = { fontSize: 13, color: '#64748B', lineHeight: 1.65, paddingLeft: 18, margin: '0 0 16px' };
const checkRow = { display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#334155', lineHeight: 1.55, marginBottom: 16, cursor: 'pointer' };
const radioRow = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155', cursor: 'pointer' };
const fieldLabel = { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6 };
const phraseBox = {
  fontSize: 13,
  fontFamily: 'ui-monospace, monospace',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#0F172A',
  lineHeight: 1.5,
  marginBottom: 8,
};
const backLink = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 13,
  color: '#64748B',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const warnIcon = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: '#FEE2E2',
  color: '#DC2626',
  fontWeight: 800,
  fontSize: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
const modalOverlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 600,
  background: 'rgba(15,23,42,.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};
const modalCard = {
  background: '#fff',
  borderRadius: 14,
  padding: '24px 22px',
  maxWidth: 380,
  width: '100%',
  boxShadow: '0 20px 50px rgba(0,0,0,.2)',
};

function btnPrimary(disabled) {
  return {
    width: '100%',
    height: 44,
    border: 'none',
    borderRadius: 10,
    background: disabled ? '#E2E8F0' : BRAND,
    color: disabled ? '#94A3B8' : '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

function btnDanger(disabled) {
  return {
    padding: '10px 18px',
    border: 'none',
    borderRadius: 8,
    background: disabled ? '#FECACA' : '#DC2626',
    color: disabled ? '#94A3B8' : '#fff',
    fontSize: 14,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

function btnDangerOutline(disabled) {
  return {
    padding: '10px 16px',
    borderRadius: 8,
    border: `1px solid ${disabled ? '#E2E8F0' : '#F87171'}`,
    background: disabled ? '#F8FAFC' : '#FEF2F2',
    color: disabled ? '#94A3B8' : '#991B1B',
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

const btnSecondary = {
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  background: '#fff',
  color: '#334155',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnGhost = {
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  color: '#64748B',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
