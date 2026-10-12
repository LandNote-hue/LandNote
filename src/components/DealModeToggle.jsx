import { DEAL_MODE_RENT, DEAL_MODE_SALE } from '../theme/dealModeTheme.js';
import { useDealMode } from '../contexts/DealModeContext.jsx';

/**
 * 상단 매매/임대 전환. compact: 모바일 헤더용.
 */
export function DealModeToggle({ compact = false }) {
  const { mode, setDealMode } = useDealMode();

  const btn = (id, label) => {
    const active = mode === id;
    const accent = id === DEAL_MODE_RENT ? '#2563EB' : '#C8102E';
    const color = active ? accent : 'rgba(255,255,255,.48)';
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setDealMode(id)}
        style={{
          height: compact ? 28 : 30,
          padding: compact ? '0 10px' : '0 14px',
          border: 'none',
          borderRadius: 8,
          background: active ? 'rgba(255,255,255,.12)' : 'transparent',
          boxShadow: active ? `inset 0 0 0 1.5px ${accent}` : 'none',
          color,
          fontSize: compact ? 12 : 13,
          fontWeight: active ? 700 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '-0.02em',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="매매·임대 전환"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: 10,
        background: 'rgba(0,0,0,.22)',
        flexShrink: 0,
      }}
    >
      {btn(DEAL_MODE_SALE, '매매')}
      {btn(DEAL_MODE_RENT, '임대')}
    </div>
  );
}

export function DealModeAppFrame({ children, style }) {
  const { mode } = useDealMode();
  return (
    <div data-deal-mode={mode} style={style}>
      {children}
    </div>
  );
}
