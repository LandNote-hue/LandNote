/** 고객 일괄 등록 CSV 양식 — 고객 등록 폼 입력 항목과 동일 */

import { CUSTOMER_TYPE_HEADER } from '../utils/customerTypes.js';

/** @type {readonly string[]} */
export const CUSTOMER_BULK_HEADERS = [
  '고객명',
  '연락처',
  '주소',
  '이메일',
  '회사',
  '직함',
  '진행상태',
  CUSTOMER_TYPE_HEADER,
  '현금가용금액(만)',
  '선호지역',
  '희망거래방식',
  '매입가능액 최소(만)',
  '매입가능액 최대(만)',
  '메모',
];

/** 구 양식·확장 열 (업로드 호환) */
export const CUSTOMER_BULK_LEGACY_HEADERS = [
  '상태',
  '진행 상태',
  '희망매물종류',
  '희망거래방식',
  '최대예산(만원)',
  '희망지역',
  '현금가용금액(억)',
  '매입가능액 최소(억)',
  '매입가능액 최대(억)',
];

export const CUSTOMER_BULK_MAX_ROWS = 1000;

export const CUSTOMER_BULK_SAMPLE_ROWS = [
  [
    '홍길동', '010-1234-5678', '서울 강남구 역삼동 123', 'hong@example.com',
    '(주)ABC부동산', '팀장', '진행중', '매수/임차', '500000', '강남·서초', '매매/월세', '30000', '50000', '주말 연락 선호',
  ],
  [
    '김철수', '010-9876-5432', '경기 성남시 분당구 정자동 88', '',
    '', '대표', '보류', '매도,매수', '0', '성남·분당', '전세', '80000', '90000', '',
  ],
];

const normHeader = (s) => String(s || '').replace(/\s/g, '').trim();

/** @param {string[][]} matrix */
export function detectCustomerBulkHeaders(matrix) {
  if (!matrix?.length) return [...CUSTOMER_BULK_HEADERS];
  const first = matrix[0].map((h) => String(h || '').trim());
  const normalized = first.map(normHeader);
  const hasPhone = normalized.some((n) => n.startsWith('연락처'));
  const hasType = normalized.some((n) => n.startsWith('고객구분'));
  if (hasPhone && hasType && first.some(Boolean)) return first;
  const expected = CUSTOMER_BULK_HEADERS.map(normHeader);
  if (expected.every((h, i) => normalized[i] === h || normalized.includes(h)) && first.some(Boolean)) {
    return first;
  }
  return [...CUSTOMER_BULK_HEADERS];
}

/** @param {string[][]} matrix @param {string[]} headers */
export function customerRowsFromMatrix(matrix, headers) {
  const headerRow = matrix[0] || [];
  const colIndex = headers.map((h) => {
    const nh = normHeader(h);
    const idx = headerRow.findIndex((cell) => normHeader(cell) === nh);
    if (idx >= 0) return idx;
    const stdIdx = CUSTOMER_BULK_HEADERS.findIndex((x) => normHeader(x) === nh);
    if (stdIdx >= 0) return stdIdx;
    return headerRow.findIndex((cell) => normHeader(cell) === nh);
  });

  /** @type {Record<string, string>[]} */
  const rows = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const line = matrix[r];
    if (!line || !line.some((c) => String(c || '').trim())) continue;
    /** @type {Record<string, string>} */
    const row = {};
    headers.forEach((h, i) => {
      const ci = colIndex[i];
      row[h] = ci >= 0 ? String(line[ci] ?? '').trim() : '';
    });
    rows.push(row);
  }
  return rows;
}

/** @param {number} count */
export function customerBulkMaxRowsExceededMessage(count) {
  return `고객 일괄 등록은 안정적인 데이터 정제를 위해 1회 최대 ${CUSTOMER_BULK_MAX_ROWS}건까지 가능합니다. 현재 파일은 ${count}건입니다.`;
}

export function downloadCustomerBulkCsvTemplate() {
  const lines = [
    CUSTOMER_BULK_HEADERS.join(','),
    ...CUSTOMER_BULK_SAMPLE_ROWS.map((row) => row.map((c) => (
      String(c).includes(',') ? `"${String(c).replace(/"/g, '""')}"` : c
    )).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'landnote_customer_bulk_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
