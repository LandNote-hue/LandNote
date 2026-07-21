import { propDisplayAddr } from '../utils/propAddress.js';
import { fmtPropPrice as propPrice } from '../utils/formatMoney.js';

const BRAND = '#C8102E';
const TL = { SALE: '매매', JEONSE: '전세', MONTHLY: '월세', SHORT_TERM: '단기', PRESALE: '분양' };

const STATUS = {
  NEW: { label: '신규', bg: '#ECFDF5', color: '#047857' },
  ACTIVE: { label: '진행중', bg: '#EFF6FF', color: '#2563EB' },
  HOLD: { label: '보류', bg: '#FFFBEB', color: '#D97706' },
  COMPLETED: { label: '완료', bg: '#F1F5F9', color: '#475569' },
};

function StatusChip({ status }) {
  const s = STATUS[status] || STATUS.NEW;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function SharedTag({ label }) {
  if (!label) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
      color: '#185FA5', background: '#E6F1FB', borderRadius: 4, padding: '2px 7px',
    }}>
      {label}
    </span>
  );
}

export function PropertyCardList({
  properties,
  onOpen,
  onToggleFav,
  emptyMessage = '매물이 없습니다',
  getSharedLabel,
}) {
  if (!properties.length) {
    return (
      <div style={{
        padding: '48px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 14,
        background: '#fff', borderRadius: 12, border: '1px solid #E8EAED',
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {properties.map((p) => {
        const sharedLabel = getSharedLabel?.(p);
        return (
        <article
          key={p.id}
          onClick={() => onOpen(p)}
          style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            border: '1px solid #E8EAED', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
            cursor: 'pointer',
          }}
        >
          <div style={{
            fontSize: 15, fontWeight: 600, color: '#0F172A', lineHeight: 1.4,
            wordBreak: 'keep-all', overflowWrap: 'anywhere',
            marginBottom: 10,
          }}>
            {propDisplayAddr(p)}
            {p.bldg ? ` · ${p.bldg}` : ''}
          </div>
          {sharedLabel && <div style={{ marginBottom: 8 }}><SharedTag label={sharedLabel} /></div>}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
              <button
                type="button"
                onClick={(e) => onToggleFav(p, e)}
                aria-label={p.fav ? '즐겨찾기 해제' : '즐겨찾기'}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 18, lineHeight: 1, color: p.fav ? '#F59E0B' : '#CBD5E1', flexShrink: 0,
                }}
              >
                {p.fav ? '★' : '☆'}
              </button>
              <StatusChip status={p.status} />
              {p.tag && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                  background: '#F1F5F9', color: '#475569',
                }}>
                  {p.tag}
                </span>
              )}
              {p.trade && (
                <span style={{ fontSize: 12, color: '#6B7280' }}>{TL[p.trade] || p.trade}</span>
              )}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: '#2563EB', flexShrink: 0,
              whiteSpace: 'nowrap', textAlign: 'right',
            }}>
              {propPrice(p)}
            </div>
          </div>
        </article>
        );
      })}
    </div>
  );
}
