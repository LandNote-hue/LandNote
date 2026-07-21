import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { isBusinessRole, isCeoRole, normalizeCompanyRole, usesTeamCloudSync } from '../data/companyRoles.js';
import { initialCloudSync, refreshSharedCloudData } from '../services/sync/cloudSync.js';
import { BTN_SIZE } from '../theme/buttonLayout.js';

const C = {
  brand: '#C8102E',
  brandD: '#A50E25',
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#64748B',
};

function CloudSyncGuideWin({ onClose, isEmployee }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 560,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)', padding: 20, boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%',
          boxShadow: '0 16px 48px rgba(0,0,0,.2)', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '28px 28px 8px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.tx, letterSpacing: '-.02em', lineHeight: 1.35, marginBottom: 20 }}>
            클라우드 동기화 안내
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '14px 16px', background: C.surf2, borderRadius: 10, border: `1px solid ${C.bdr}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>무엇을 하나요?</div>
              <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.65 }}>
                서버(클라우드)에 저장된 매물·고객·일정·통화 데이터를 이 기기로 가져오고,
                아직 올리지 않은 내 변경 사항도 서버에 반영합니다.
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: C.surf2, borderRadius: 10, border: `1px solid ${C.bdr}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>자동 동기화</div>
              <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.65 }}>
                로그인하면 한 번 자동으로 동기화됩니다. 추가로 맞출 때는「동기화」버튼을 눌러 주세요.
                {isEmployee ? ' 대표가 권한을 바꾸면 자동으로 다시 가져옵니다.' : ''}
              </div>
            </div>
            {isEmployee ? (
              <div style={{ padding: '14px 16px', background: C.surf2, borderRadius: 10, border: `1px solid ${C.bdr}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>직원 계정</div>
                <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.65 }}>
                  대표가 허용한 매물·일정·통화만 가져옵니다. 다른 기기에서 바뀐 내용이 보이지 않으면「동기화」를 다시 눌러 주세요.
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px 16px', background: C.surf2, borderRadius: 10, border: `1px solid ${C.bdr}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>언제 더 누르나요?</div>
                <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.65 }}>
                  다른 PC·브라우저에서 수정한 뒤, 이 기기에 최신 데이터를 맞출 때 눌러 주세요.
                </div>
              </div>
            )}
            <div style={{ padding: '14px 16px', background: C.surf2, borderRadius: 10, border: `1px solid ${C.bdr}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>개인 계정</div>
              <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.65 }}>
                개인(Solo) 계정에는 동기화 버튼이 없습니다. 로그인 시 자동으로 불러오고, 등록·수정·삭제할 때만 클라우드에 반영합니다.
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 28px 24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: BTN_SIZE.lg.height, padding: `0 ${BTN_SIZE.lg.padX}px`,
              borderRadius: BTN_SIZE.lg.borderRadius, border: 'none',
              background: C.brand, color: '#fff', fontSize: BTN_SIZE.lg.fontSize,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 대시보드 등 페이지 헤더용 클라우드 동기화 + 안내(?)
 * 팀(대표·직원) 계정만 표시 — 개인(SOLO)은 숨김 (로그인 pull + 변경 시 push)
 * @param {{ onNotify?: (message: string, type?: string) => void, compact?: boolean }} props
 */
export function CloudSyncHeaderActions({ onNotify, compact = false }) {
  const { user, companyRole, profile, profileLoading } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const rawRole = companyRole ?? profile?.role;
  const displayRole = rawRole != null && rawRole !== '' ? normalizeCompanyRole(rawRole) : null;
  const teamSync = isSupabaseConfigured
    && !!user?.id
    && user.id !== 'dev-local'
    && !profileLoading
    && usesTeamCloudSync(displayRole);
  const isEmployee = displayRole && isBusinessRole(displayRole) && !isCeoRole(displayRole);

  const handleSync = useCallback(async () => {
    if (!teamSync || syncing || !user?.id) return;
    setSyncing(true);
    try {
      if (isEmployee) await refreshSharedCloudData(user.id);
      else await initialCloudSync(user.id);
      try {
        localStorage.setItem(`landnote.manualCloudSync.at.${user.id}`, new Date().toISOString());
      } catch { /* ignore */ }
      onNotify?.('클라우드 동기화가 완료되었습니다.', 'success');
    } catch (err) {
      console.error('[cloud sync]', err);
      onNotify?.('클라우드 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setSyncing(false);
    }
  }, [teamSync, syncing, user?.id, isEmployee, onNotify]);

  if (!teamSync) return null;

  const btnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    fontWeight: 500,
    cursor: syncing ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    lineHeight: 1,
    userSelect: 'none',
    opacity: syncing ? 0.6 : 1,
    height: compact ? 34 : BTN_SIZE.md.height,
    padding: compact ? '0 12px' : `0 ${BTN_SIZE.md.padX}px`,
    borderRadius: BTN_SIZE.md.borderRadius,
    fontSize: compact ? 13 : BTN_SIZE.md.fontSize,
  };

  return (
    <>
      {guideOpen && (
        <CloudSyncGuideWin onClose={() => setGuideOpen(false)} isEmployee={isEmployee} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          style={{
            ...btnBase,
            background: C.brand,
            border: `1.5px solid ${C.brand}`,
            color: '#fff',
          }}
        >
          {syncing ? '동기화 중…' : '동기화'}
        </button>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          title="클라우드 동기화 안내"
          aria-label="클라우드 동기화 안내"
          style={{
            ...btnBase,
            width: compact ? 34 : BTN_SIZE.md.height,
            padding: 0,
            background: C.surf2,
            border: `1.5px solid ${C.bdr}`,
            color: C.txM,
            fontWeight: 700,
          }}
        >
          ?
        </button>
      </div>
    </>
  );
}
