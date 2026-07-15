import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  fetchCanDeleteAccount,
  mapAccountDeletionError,
} from '../services/accountDeletionService.js';

const CONFIRM_PHRASE = '탈퇴할게요';

/** @param {{ onToast?: (msg: string) => void, onDeleted?: () => void }} props */
export function WithdrawAccountPanel({ onToast, onDeleted }) {
  const { user, deleteAccount, isConfigured } = useAuth();
  const [loading, setLoading] = useState(true);
  const [canDelete, setCanDelete] = useState(/** @type {{ allowed: boolean, reason?: string } | null} */ (null));
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const isGoogleUser = user?.app_metadata?.provider === 'google'
    || user?.identities?.some?.((i) => i.provider === 'google');

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
      const message = mapAccountDeletionError(err);
      const rpcMissing = /schema cache|could not find the function/i.test(String(err?.message || ''));
      setCanDelete({
        allowed: false,
        reason: message,
        code: rpcMissing ? 'RPC_MISSING' : 'ERROR',
      });
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    refreshEligibility();
  }, [refreshEligibility]);

  const confirmOk = isGoogleUser
    ? confirmText.trim() === CONFIRM_PHRASE
    : password.length > 0 && confirmText.trim() === CONFIRM_PHRASE;

  const handleWithdraw = async () => {
    if (!confirmOk || busy || !canDelete?.allowed) return;
    setBusy(true);
    try {
      const { error } = await deleteAccount({
        password: isGoogleUser ? undefined : password,
      });
      if (error) {
        onToast?.(mapAccountDeletionError(error));
        return;
      }
      setShowModal(false);
      onDeleted?.();
    } catch (err) {
      onToast?.(mapAccountDeletionError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isConfigured) return null;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 13, color: '#991B1B', fontWeight: 600, marginBottom: 8 }}>회원탈퇴</div>
      <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.55, marginBottom: 12 }}>
        탈퇴 시 개인 일정·고객 등 일부 데이터는 즉시 삭제되며 복구할 수 없습니다.
        회사에 등록한 매물·통화내역은 회사 자산으로 남으며 작성자 정보만 익명화됩니다.
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: '#64748B' }}>탈퇴 가능 여부 확인 중…</div>
      )}

      {!loading && canDelete?.code === 'RPC_MISSING' && (
        <div style={{
          fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8, padding: '10px 12px', marginBottom: 12, lineHeight: 1.55,
        }}>
          {canDelete.reason}
        </div>
      )}

      {!loading && canDelete && !canDelete.allowed && canDelete.code !== 'RPC_MISSING' && (
        <div style={{
          fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 8, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5,
        }}>
          {canDelete.reason || '현재 탈퇴할 수 없습니다.'}
        </div>
      )}

      {!loading && canDelete?.allowed && (
        <>
          {isGoogleUser ? (
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
              Google 계정입니다. 아래에 <strong>{CONFIRM_PHRASE}</strong>를 입력해 주세요.
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 5 }}>비밀번호 확인</div>
              <input
                type="password"
                className="inp"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
              />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 5 }}>
              확인 문구 (<span style={{ fontFamily: 'monospace' }}>{CONFIRM_PHRASE}</span>)
            </div>
            <input
              type="text"
              className="inp"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            disabled={!confirmOk || busy}
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 16px', borderRadius: 8, border: `1px solid ${confirmOk ? '#F87171' : '#E2E8F0'}`,
              background: confirmOk ? '#FEF2F2' : '#F8FAFC',
              color: confirmOk ? '#991B1B' : '#94A3B8',
              fontSize: 14, fontWeight: 700, cursor: confirmOk ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            탈퇴하기
          </button>
        </>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '22px 20px', maxWidth: 360, width: '100%',
            boxShadow: '0 16px 40px rgba(0,0,0,.18)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
              정말 탈퇴하시겠습니까?
            </div>
            <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, marginBottom: 18 }}>
              계정과 개인 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowModal(false)}
                style={modalBtnSecondary}
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleWithdraw}
                style={modalBtnDanger}
              >
                {busy ? '처리 중…' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalBtnSecondary = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
  background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const modalBtnDanger = {
  padding: '8px 14px', borderRadius: 8, border: 'none',
  background: '#DC2626', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
};
