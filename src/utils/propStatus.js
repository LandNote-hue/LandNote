/** 매물 진행 상태 — 목록·등록·지도·일괄등록 공통 */

export const PROP_STATUS_OPTS = [
  { id: 'NEW', label: '준비중' },
  { id: 'ACTIVE', label: '매각중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '계약완료' },
];

/** @type {Record<string, string>} */
export const PROP_STATUS_LABEL = Object.fromEntries(
  PROP_STATUS_OPTS.map((o) => [o.id, o.label]),
);

/** 고급검색·지도 필터용 (구 라벨도 호환) */
export const PROP_STATUS_LABEL_TO_CODE = {
  준비중: 'NEW',
  매각중: 'ACTIVE',
  보류: 'HOLD',
  계약완료: 'COMPLETED',
  완료: 'COMPLETED',
  신규: 'NEW',
  진행중: 'ACTIVE',
};

/** @param {string|undefined|null} status */
export function propStatusLabel(status) {
  return PROP_STATUS_LABEL[status] || PROP_STATUS_LABEL.NEW;
}

/** select·필터 option 라벨 목록 */
export const PROP_STATUS_FILTER_LABELS = PROP_STATUS_OPTS.map((o) => o.label);
