/** 매물 진행 상태 — 목록·등록·지도·일괄등록 공통 */

export const PROP_STATUS_OPTS = [
  { id: 'NEW', label: '컨택중' },
  { id: 'ACTIVE', label: '매각중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '매각완료' },
];

export const PROP_RENT_STATUS_OPTS = [
  { id: 'NEW', label: '컨택중' },
  { id: 'ACTIVE', label: '임대중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '임대완료' },
];

/** @type {Record<string, string>} */
export const PROP_STATUS_LABEL = Object.fromEntries(
  PROP_STATUS_OPTS.map((o) => [o.id, o.label]),
);

/** @type {Record<string, string>} */
export const PROP_RENT_STATUS_LABEL = Object.fromEntries(
  PROP_RENT_STATUS_OPTS.map((o) => [o.id, o.label]),
);

/** 고급검색·지도 필터용 (구 라벨·임대 라벨 호환) */
export const PROP_STATUS_LABEL_TO_CODE = {
  컨택중: 'NEW',
  매각중: 'ACTIVE',
  보류: 'HOLD',
  매각완료: 'COMPLETED',
  준비중: 'NEW',
  계약완료: 'COMPLETED',
  완료: 'COMPLETED',
  신규: 'NEW',
  진행중: 'ACTIVE',
  임대중: 'ACTIVE',
  임대완료: 'COMPLETED',
};

/** @param {boolean} [rent] */
export function propStatusOpts(rent) {
  return rent ? PROP_RENT_STATUS_OPTS : PROP_STATUS_OPTS;
}

/** @param {string|undefined|null} status @param {boolean} [rent] */
export function propStatusLabel(status, rent) {
  const map = rent ? PROP_RENT_STATUS_LABEL : PROP_STATUS_LABEL;
  return map[status] || map.NEW;
}

/** select·필터 option 라벨 목록 */
export const PROP_STATUS_FILTER_LABELS = PROP_STATUS_OPTS.map((o) => o.label);

/** @param {boolean} [rent] */
export function propStatusFilterLabels(rent) {
  return propStatusOpts(rent).map((o) => o.label);
}

/**
 * 목록·카드 상태 칩 — 컨택중 회색 / 매각중 파랑 / 보류 빨강 / 매각완료 보라
 * @type {Record<string, { label: string, bg: string, color: string, bd: string }>}
 */
export const PROP_STATUS_STYLE = {
  NEW: { label: '컨택중', bg: '#E8EDF2', color: '#334155', bd: '#94A3B8' },
  ACTIVE: { label: '매각중', bg: '#DBEAFE', color: '#1D4ED8', bd: '#3B82F6' },
  HOLD: { label: '보류', bg: '#FECACA', color: '#B91C1C', bd: '#EF4444' },
  COMPLETED: { label: '매각완료', bg: '#EDE9FE', color: '#6D28D9', bd: '#8B5CF6' },
};

/** @param {string|undefined|null} status @param {{ rent?: boolean }} [opts] */
export function propStatusStyle(status, opts = {}) {
  const base = PROP_STATUS_STYLE[status] || PROP_STATUS_STYLE.NEW;
  if (opts.rent) {
    return { ...base, label: PROP_RENT_STATUS_LABEL[status] || PROP_RENT_STATUS_LABEL.NEW };
  }
  return base;
}

/** @param {{ compact?: boolean, rent?: boolean }} [opts] */
export function propStatusChipStyle(status, opts = {}) {
  const s = propStatusStyle(status, opts);
  return {
    fontSize: opts.compact ? 11 : 12,
    fontWeight: 700,
    padding: opts.compact ? '3px 8px' : '3px 9px',
    borderRadius: 20,
    background: s.bg,
    color: s.color,
    border: `1.5px solid ${s.bd}`,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    letterSpacing: '-0.02em',
  };
}
