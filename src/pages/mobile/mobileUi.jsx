import { useNavigate } from 'react-router-dom';

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
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 14px 24px' }}>
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
