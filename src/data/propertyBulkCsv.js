/** 통합 일괄 등록 양식 (CSV · Excel) */

/** 양식 참고용 — 업로드 시 등록 데이터에는 사용하지 않음 */
export const BULK_PROPERTY_NO_HEADER = '매물번호';

export const BULK_UNIFIED_HEADERS = [
  '주소(필수)',
  '상세주소',
  '매물유형',
  '거래방식',
  '금액(매매가 또는 보증금)',
  '월세',
  '권리금',
  '관리비',
  '면적(평)',
  // 아래부터는 나중에 추가된 컬럼 — 기존 업로드 파일과의 호환을 위해 항상 끝에 이어붙일 것
  '매물대분류',
  '매물소분류',
  '진행여부',
  '공개여부',
  '도로상황',
  '전세보증금',
  '전세계약만료일',
  '전용면적(㎡)',
  '계약면적(㎡)',
  '보증금',
  '단기임대료',
  '단기임대기간',
  '게시글제목',
  '담당자이름',
  '담당자연락처',
  '홍보문구',
  '내부메모',
];

/** 다운로드 양식 헤더 (매물번호 + 통합 컬럼) */
export const BULK_TEMPLATE_HEADERS = [
  BULK_PROPERTY_NO_HEADER,
  ...BULK_UNIFIED_HEADERS,
];

/** @deprecated 구 양식 — 업로드 시 자동 호환 */
export const BULK_LEGACY_HEADERS = [
  '주소(필수)',
  '상세주소(동호수)',
  '매물유형',
  '거래유형',
  '가격(만원)',
  '보증금(월세)',
  '특이사항',
];

/** 기본 파싱 헤더 (통합 양식) */
export const BULK_CSV_HEADERS = BULK_UNIFIED_HEADERS;

export const BULK_UNIFIED_SAMPLE_ROWS = [
  [
    '1', '서울시 노원구 상계동 123', '101동 502호', '아파트', '매매', '85000', '0', '0', '15', '25',
    '아파트·오피스텔', '아파트', '진행중', '공개', '8m 도로 접함', '', '', '84.5', '105.2', '', '', '',
    '역세권 신축급 아파트 매매', '홍길동', '010-1234-5678', '역세권 도보 5분, 남향 고층 세대', '집주인 직접 거주 중, 이사 협의 필요',
  ],
  [
    '2', '서울시 수지구 풍덕천동 456', '1층 102호', '상가', '월세', '5000', '250', '3000', '20', '18',
    '상가·업무·공장·토지', '상가', '신규', '공개', '왕복 4차선 대로변', '', '', '59.5', '66.1', '5000', '', '',
    '역세권 1층 상가 임대', '김민수', '010-9876-5432', '유동인구 많은 코너 상가, 즉시 입주 가능', '보증금 협의 가능',
  ],
];

export const BULK_MAX_ROWS = 500;
export const BULK_CHUNK_SIZE = 30;

/** @type {Record<string, { main: string, sub: string, tag: string }>} */
export const BULK_PROPERTY_TYPE_MAP = {
  '아파트': { main: 'APT_OFFICETEL', sub: 'APARTMENT', tag: '아파트' },
  '오피스텔': { main: 'APT_OFFICETEL', sub: 'OFFICETEL_RESI', tag: '오피스텔' },
  '빌라': { main: 'VILLA_HOUSE', sub: 'VILLA', tag: '빌라/연립' },
  '단독': { main: 'VILLA_HOUSE', sub: 'DETACHED', tag: '단독/다가구' },
  '상가': { main: 'COMMERCIAL', sub: 'STORE', tag: '상가' },
  '사무실': { main: 'COMMERCIAL', sub: 'OFFICE', tag: '사무실' },
  '건물': { main: 'COMMERCIAL', sub: 'WHOLE_BUILDING', tag: '건물(통건물)' },
  '토지': { main: 'COMMERCIAL', sub: 'LAND', tag: '토지' },
};

/** @type {Record<string, string>} */
export const BULK_TRADE_TYPE_MAP = {
  '매매': 'SALE',
  '전세': 'JEONSE',
  '월세': 'MONTHLY',
  '임대': 'MONTHLY',
  '단기': 'SHORT_TERM',
  '분양': 'PRESALE',
};

/** 진행여부 한글 라벨 → status 코드 */
export const BULK_STATUS_MAP = {
  '신규': 'NEW',
  '진행중': 'ACTIVE',
  '보류': 'HOLD',
  '계약완료': 'COMPLETED',
  '완료': 'COMPLETED',
};

/** 공개여부 한글 라벨 → boolean (비워두면 기본 공개) */
export const BULK_PUB_MAP = {
  '공개': true,
  '비공개': false,
};

const normHeader = (s) => String(s || '').replace(/\s/g, '').trim();

const NUMBER_HEADER_KEYS = new Set([
  normHeader('매물번호'),
  normHeader('번호'),
  normHeader('No'),
  normHeader('NO'),
  normHeader('순번'),
  normHeader('넘버'),
]);

/** @param {string[][]} matrix */
export function stripBulkPropertyNoColumn(matrix) {
  if (!matrix?.length) return matrix;
  const first = normHeader(matrix[0]?.[0]);
  const isNumberCol = NUMBER_HEADER_KEYS.has(first)
    || first.includes('매물번호')
    || (first.includes('번호') && !first.includes('주소'));
  if (!isNumberCol) return matrix;
  return matrix.map((row) => (Array.isArray(row) ? row.slice(1) : row));
}

/**
 * CSV/Excel 첫 행으로 양식 종류 판별
 * @param {string[][]} matrix
 */
export function detectBulkCsvHeaders(matrix) {
  const stripped = stripBulkPropertyNoColumn(matrix);
  if (!stripped?.length) return BULK_UNIFIED_HEADERS;
  const headerNorm = stripped[0].map(normHeader);
  const hasUnified = headerNorm.some((h) => h.includes('금액') && h.includes('보증금'))
    || headerNorm.includes(normHeader('거래방식'));
  if (hasUnified) return BULK_UNIFIED_HEADERS;
  const hasLegacy = headerNorm.includes(normHeader('가격(만원)'))
    || headerNorm.includes(normHeader('거래유형'));
  if (hasLegacy) return BULK_LEGACY_HEADERS;
  return BULK_UNIFIED_HEADERS;
}

function escapeCsvCell(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/** 통합 매물 양식 CSV 다운로드 (BOM 포함) */
export function downloadUnifiedBulkCsvTemplate() {
  const lines = [
    BULK_TEMPLATE_HEADERS.join(','),
    ...BULK_UNIFIED_SAMPLE_ROWS.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'landnote_bulk_unified_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** 통합 매물 양식 Excel(.xlsx) 다운로드 */
export async function downloadUnifiedBulkXlsxTemplate() {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([
    BULK_TEMPLATE_HEADERS,
    ...BULK_UNIFIED_SAMPLE_ROWS,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '매물목록');
  XLSX.writeFile(wb, 'landnote_bulk_unified_template.xlsx');
}

/** @deprecated downloadUnifiedBulkCsvTemplate 사용 */
export function downloadBulkCsvTemplate() {
  downloadUnifiedBulkCsvTemplate();
}

/** @deprecated downloadUnifiedBulkXlsxTemplate 사용 */
export function downloadBulkXlsxTemplate() {
  return downloadUnifiedBulkXlsxTemplate();
}
