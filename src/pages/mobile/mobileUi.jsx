import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { isSupabaseConfigured } from '../../lib/supabase.js';
import { normalizeCompanyRole } from '../../data/companyRoles.js';

/** 모바일 조회 전용 화면 공용 색상 — MobileShell과 동일 값 사용 */
export const M = {
  brand: '#C8102E',
  bg: '#F5F6FA',
  surf: '#FFFFFF',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txS: '#374151',
  txM: '#6B7280',
  txP: '#94A3B8',
  info: '#2563EB',
};

export function MobilePage({ children }) {
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      /* 짧은 세로 화면에서도 마지막 항목이 잘리지 않도록 여유 패딩 */
      padding: '14px 14px calc(48px + env(safe-area-inset-bottom, 0px))',
      boxSizing: 'border-box',
    }}>
      {children}
    </div>
  );
}

/** 상세 화면 상단 — 뒤로가기 + 타이틀 (MobileShell 헤더 바로 아래에 붙는 보조 헤더) */
export function MobileDetailHeader({ title, fallback = '/dashboard' }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
      background: M.surf, borderBottom: `1px solid ${M.bdr}`, flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={() => navigate(fallback)}
        aria-label="뒤로가기"
        style={{
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, color: M.tx,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div style={{ fontSize: 16, fontWeight: 700, color: M.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
    </div>
  );
}

export function MobileCard({ children, style }) {
  return (
    <div style={{
      background: M.surf, borderRadius: 14, border: `1px solid ${M.bdr}`,
      padding: '16px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', marginBottom: 12, ...style,
    }}>
      {children}
    </div>
  );
}

export function MobileSectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: M.txM, margin: '4px 2px 8px' }}>{children}</div>
  );
}

/** 라벨-값 세로 스택 행 (상세 요약용) */
export function MobileInfoRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: `1px solid ${M.bdr}` }}>
      <span style={{ fontSize: 13, color: M.txM, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 14, color: M.tx, fontWeight: 600, textAlign: 'right', wordBreak: 'keep-all' }}>{value}</span>
    </div>
  );
}

export function MobileEmptyState({ message = '데이터가 없습니다' }) {
  return (
    <div style={{
      padding: '48px 20px', textAlign: 'center', color: M.txP, fontSize: 14,
      background: M.surf, borderRadius: 12, border: `1px solid ${M.bdr}`,
    }}>
      {message}
    </div>
  );
}

/**
 * 모바일 — 클라우드 데이터 미적재/로딩/실패 안내 + 다시 불러오기
 * (휴대폰 IndexedDB는 PC와 분리되어 로그인 pull이 필요)
 */
export function MobileCloudDataHint({ empty = false, resourceLabel = '데이터' }) {
  const {
    user, profile, companyRole, profileLoading,
    sessionCloudSyncStatus, sessionCloudSyncSummary, reloadSessionCloudData,
  } = useAuth();
  const [busy, setBusy] = useState(false);

  const rawRole = companyRole ?? profile?.role;
  const isSolo = (rawRole != null && rawRole !== ''
    ? normalizeCompanyRole(rawRole) === 'SOLO'
    : false) || profile?.user_type === 'SOLO';

  if (!isSupabaseConfigured || !user?.id || user.id === 'dev-local' || !isSolo || !empty) {
    return null;
  }

  const loading = profileLoading
    || sessionCloudSyncStatus === 'idle'
    || sessionCloudSyncStatus === 'syncing'
    || busy;
  const failed = sessionCloudSyncStatus === 'error';
  const pulled = sessionCloudSyncSummary?.pulled ?? null;
  const cloudEmpty = !failed && sessionCloudSyncStatus === 'done' && pulled === 0;

  const onReload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await reloadSessionCloudData?.();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <MobileCard style={{ marginBottom: 16, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 6 }}>데이터 불러오는 중…</div>
        <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.55 }}>
          개인 계정은 로그인 시 클라우드에서 {resourceLabel}을(를) 가져옵니다. 잠시만 기다려 주세요.
        </div>
      </MobileCard>
    );
  }

  const detail = sessionCloudSyncSummary
    ? `매물 ${sessionCloudSyncSummary.properties ?? 0} · 고객 ${sessionCloudSyncSummary.customers ?? 0} · 일정 ${sessionCloudSyncSummary.schedules ?? 0} · 통화 ${sessionCloudSyncSummary.callLogs ?? 0}`
    : null;

  return (
    <MobileCard style={{ marginBottom: 16, background: '#FFF8F0', border: '1px solid #FED7AA' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 6 }}>
        {failed
          ? '데이터를 불러오지 못했습니다'
          : cloudEmpty
            ? '클라우드에 저장된 데이터가 없습니다'
            : `표시할 ${resourceLabel}이(가) 없습니다`}
      </div>
      <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.55, marginBottom: 10 }}>
        {failed
          ? (sessionCloudSyncSummary?.errorMessage
            ? `오류: ${sessionCloudSyncSummary.errorMessage}`
            : '네트워크·권한 문제일 수 있습니다. 다시 불러오기를 눌러 주세요.')
          : cloudEmpty
            ? 'PC에만 있고 클라우드에 없으면 휴대폰에는 표시되지 않습니다. PC에서 매물을 저장·수정한 뒤 다시 불러오세요.'
            : '휴대폰은 PC와 저장소가 다릅니다. 클라우드에서 다시 불러올 수 있습니다.'}
      </div>
      {detail && (
        <div style={{ fontSize: 12, color: M.txM, marginBottom: 10 }}>
          최근 동기화: {detail}
        </div>
      )}
      <button
        type="button"
        onClick={onReload}
        disabled={busy}
        style={{
          height: 36, padding: '0 14px', borderRadius: 8, border: 'none',
          background: M.brand, color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? '불러오는 중…' : '다시 불러오기'}
      </button>
    </MobileCard>
  );
}

export function MobileStatCard({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        background: M.surf, borderRadius: 14, border: `1px solid ${M.bdr}`,
        padding: '16px 14px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)', fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 13, color: M.txM, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: M.tx }}>{value}</div>
    </button>
  );
}
