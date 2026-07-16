import {
  BULK_PROPERTY_TYPE_MAP,
  BULK_TRADE_TYPE_MAP,
  BULK_STATUS_MAP,
  BULK_PUB_MAP,
  BULK_LEGACY_HEADERS,
  BULK_UNIFIED_HEADERS,
} from '../../data/propertyBulkCsv.js';
import { resolvePropTypeFromLabels, PROP_MAIN, PROP_SUB } from '../../data/propertyTypes.js';

const STATUS_CODE_TO_LABEL = Object.fromEntries(
  Object.entries(BULK_STATUS_MAP).map(([label, code]) => [code, label]),
);

/** 신규로 추가된 컬럼들의 기본값 (모두 빈 문자열) */
const EXTRA_UNIFIED_KEYS = [
  '매물대분류', '매물소분류', '진행여부', '공개여부', '도로상황',
  '전세보증금', '전세계약만료일', '전용면적(㎡)', '계약면적(㎡)', '보증금',
  '단기임대료', '단기임대기간', '게시글제목', '담당자이름', '담당자연락처', '홍보문구', '내부메모',
];

function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeTradeLabel(raw) {
  const s = String(raw || '').trim();
  if (s === '임대') return '월세';
  return s;
}

function resolveTradeCode(tradeLabel) {
  const key = normalizeTradeLabel(tradeLabel);
  return BULK_TRADE_TYPE_MAP[key] || 'SALE';
}

function isCommercialType(propertyType) {
  const t = String(propertyType || '').trim();
  return t === '상가' || t === '사무실';
}

function buildReportKey(propertyType, tradeLabel) {
  const typeLabel = BULK_PROPERTY_TYPE_MAP[propertyType]?.tag || propertyType || '기타';
  const trade = normalizeTradeLabel(tradeLabel) || '매매';
  return `${typeLabel} ${trade}`;
}

/**
 * 통합·구 양식 행을 enrich/API용 공통 구조로 변환
 * @param {Record<string, string>} row
 * @returns {Record<string, string> & { _unified: object, _rowIndex?: string }}}
 */
export function normalizeBulkRow(row) {
  if (row?._unified?.format) {
    return row;
  }

  const rowIndex = row._rowIndex;
  const isUnified = BULK_UNIFIED_HEADERS.some((h) => h in row && row[h] !== undefined)
    || '거래방식' in row
    || '금액(매매가 또는 보증금)' in row;

  if (isUnified) {
    return mapUnifiedFormat(row, rowIndex);
  }
  return mapLegacyFormat(row, rowIndex);
}

/**
 * @param {Record<string, string>} row
 * @param {string} [rowIndex]
 */
function mapUnifiedFormat(row, rowIndex) {
  const propertyType = String(row['매물유형'] || '').trim() || '아파트';
  const tradeLabel = normalizeTradeLabel(row['거래방식'] || '매매');
  const tradeCode = resolveTradeCode(tradeLabel);
  const amount = parseNum(row['금액(매매가 또는 보증금)']);
  const monthlyRent = parseNum(row['월세']);
  const premium = parseNum(row['권리금']);
  const maintenance = parseNum(row['관리비']);
  const areaPyeong = parseNum(row['면적(평)']);

  // 매물대분류/매물소분류가 채워져 있으면 우선, 없으면 기존 매물유형으로 폴백
  const resolvedType = resolvePropTypeFromLabels(row['매물대분류'], row['매물소분류']);
  const typeLabel = resolvedType?.tag || BULK_PROPERTY_TYPE_MAP[propertyType]?.tag || propertyType;

  let priceManwon = 0;
  let depositManwon = 0;
  let monthlyRentManwon = 0;

  if (tradeCode === 'SALE' || tradeCode === 'PRESALE') {
    // 조건 A: 매매 — 금액→매매가
    priceManwon = amount;
  } else if (tradeCode === 'JEONSE') {
    // 전세보증금 컬럼이 채워져 있으면 우선, 없으면 기존 금액 컬럼 사용
    priceManwon = parseNum(row['전세보증금']) || amount;
  } else if (tradeCode === 'MONTHLY') {
    depositManwon = parseNum(row['보증금']) || amount;
    monthlyRentManwon = monthlyRent;
  } else if (tradeCode === 'SHORT_TERM') {
    depositManwon = parseNum(row['보증금']) || amount;
    // 단기임대료 컬럼이 채워져 있으면 우선, 없으면 기존 월세 컬럼 사용
    monthlyRentManwon = parseNum(row['단기임대료']) || monthlyRent;
  }

  const statusCode = BULK_STATUS_MAP[String(row['진행여부'] || '').trim()] || '';
  const pubLabel = String(row['공개여부'] || '').trim();
  const pub = pubLabel in BULK_PUB_MAP ? BULK_PUB_MAP[pubLabel] : true;

  return {
    _rowIndex: rowIndex,
    '주소(필수)': String(row['주소(필수)'] || '').trim(),
    '상세주소(동호수)': String(row['상세주소'] || row['상세주소(동호수)'] || '').trim(),
    '매물유형': propertyType,
    '거래유형': tradeLabel,
    '가격(만원)': String(priceManwon),
    '보증금(월세)': String(depositManwon),
    '특이사항': String(row['특이사항'] || '').trim(),
    _unified: {
      format: 'unified',
      tradeCode,
      tradeLabel,
      typeLabel,
      reportKey: buildReportKey(propertyType, tradeLabel),
      monthlyRentManwon: String(monthlyRentManwon),
      premiumManwon: String(premium),
      maintenanceManwon: String(maintenance),
      areaPyeong: String(areaPyeong),
      resolvedType,
      status: statusCode,
      pub,
      roadInfo: String(row['도로상황'] || '').trim(),
      jLeaseEnd: String(row['전세계약만료일'] || '').trim(),
      exclusiveArea: String(parseNum(row['전용면적(㎡)'])),
      contractArea: String(parseNum(row['계약면적(㎡)'])),
      shortTermPeriod: String(row['단기임대기간'] || '').trim(),
      postTitle: String(row['게시글제목'] || '').trim(),
      agentName: String(row['담당자이름'] || '').trim(),
      agentTel: String(row['담당자연락처'] || '').trim(),
      promoText: String(row['홍보문구'] || '').trim(),
      internalMemo: String(row['내부메모'] || '').trim(),
    },
  };
}

/**
 * @param {Record<string, string>} row
 * @param {string} [rowIndex]
 */
function mapLegacyFormat(row, rowIndex) {
  const propertyType = String(row['매물유형'] || '').trim() || '아파트';
  const tradeLabel = normalizeTradeLabel(row['거래유형'] || row['거래방식'] || '매매');
  const tradeCode = resolveTradeCode(tradeLabel);
  const priceManwon = parseNum(row['가격(만원)']);
  const depositManwon = parseNum(row['보증금(월세)']);
  const commercial = isCommercialType(propertyType);

  let monthlyRentManwon = 0;
  if (tradeCode === 'MONTHLY' || tradeCode === 'SHORT_TERM') {
    monthlyRentManwon = priceManwon;
  }

  return {
    _rowIndex: rowIndex,
    '주소(필수)': String(row['주소(필수)'] || '').trim(),
    '상세주소(동호수)': String(row['상세주소(동호수)'] || row['상세주소'] || '').trim(),
    '매물유형': propertyType,
    '거래유형': tradeLabel,
    '가격(만원)': String(priceManwon),
    '보증금(월세)': String(depositManwon),
    '특이사항': String(row['특이사항'] || '').trim(),
    _unified: {
      format: 'legacy',
      tradeCode,
      tradeLabel,
      typeLabel: BULK_PROPERTY_TYPE_MAP[propertyType]?.tag || propertyType,
      reportKey: buildReportKey(propertyType, tradeLabel),
      monthlyRentManwon: String(monthlyRentManwon),
      premiumManwon: '0',
      maintenanceManwon: '0',
      areaPyeong: '0',
    },
  };
}

/** @param {string[][]} matrix @param {string[]} headers */
export function bulkRowsFromMatrix(matrix, headers = BULK_UNIFIED_HEADERS) {
  if (!matrix.length) return [];
  const [, ...dataRows] = matrix;
  return dataRows.map((cells, idx) => {
    /** @type {Record<string, string>} */
    const raw = { _rowIndex: String(idx + 2) };
    headers.forEach((key, i) => {
      raw[key] = cells[i]?.trim() ?? '';
    });
    return normalizeBulkRow(raw);
  }).filter((row) => row['주소(필수)']);
}

export { BULK_LEGACY_HEADERS, BULK_UNIFIED_HEADERS };

/** 실패 행 편집 UI용 — 통합 양식 키로 변환 */
export function rowToUnifiedInput(row) {
  if (row['거래방식'] !== undefined || row['금액(매매가 또는 보증금)'] !== undefined) {
    // 이미 통합 양식 컬럼명 그대로인 입력(수정 중인 행) — 그대로 전달
    const out = {
      _rowIndex: row._rowIndex || '',
      '주소(필수)': row['주소(필수)'] || '',
      '상세주소': row['상세주소'] || row['상세주소(동호수)'] || '',
      '매물유형': row['매물유형'] || '',
      '거래방식': row['거래방식'] || '',
      '금액(매매가 또는 보증금)': row['금액(매매가 또는 보증금)'] || '',
      '월세': row['월세'] || '0',
      '권리금': row['권리금'] || '0',
      '관리비': row['관리비'] || '0',
      '면적(평)': row['면적(평)'] || '0',
    };
    EXTRA_UNIFIED_KEYS.forEach((key) => { out[key] = row[key] || ''; });
    return out;
  }

  const n = normalizeBulkRow(row);
  const u = n._unified || {};
  const tradeCode = u.tradeCode || 'SALE';
  let amount = n['가격(만원)'] || '0';
  if (tradeCode === 'MONTHLY' || tradeCode === 'SHORT_TERM') {
    amount = n['보증금(월세)'] || '0';
  }
  const mainLabel = u.resolvedType?.main ? PROP_MAIN[u.resolvedType.main] || '' : '';
  const subLabel = u.resolvedType?.main && u.resolvedType?.sub
    ? PROP_SUB[u.resolvedType.main]?.[u.resolvedType.sub] || ''
    : '';
  return {
    _rowIndex: n._rowIndex || row._rowIndex || '',
    '주소(필수)': n['주소(필수)'] || '',
    '상세주소': n['상세주소(동호수)'] || row['상세주소'] || '',
    '매물유형': n['매물유형'] || '',
    '거래방식': n['거래유형'] || row['거래방식'] || '',
    '금액(매매가 또는 보증금)': amount,
    '월세': u.monthlyRentManwon || '0',
    '권리금': u.premiumManwon || '0',
    '관리비': u.maintenanceManwon || '0',
    '면적(평)': u.areaPyeong || '0',
    '매물대분류': mainLabel,
    '매물소분류': subLabel,
    '진행여부': STATUS_CODE_TO_LABEL[u.status] || '',
    '공개여부': u.pub === false ? '비공개' : '공개',
    '도로상황': u.roadInfo || '',
    '전세보증금': tradeCode === 'JEONSE' ? amount : '',
    '전세계약만료일': u.jLeaseEnd || '',
    '전용면적(㎡)': u.exclusiveArea || '',
    '계약면적(㎡)': u.contractArea || '',
    '보증금': (tradeCode === 'MONTHLY' || tradeCode === 'SHORT_TERM') ? amount : '',
    '단기임대료': tradeCode === 'SHORT_TERM' ? (u.monthlyRentManwon || '') : '',
    '단기임대기간': u.shortTermPeriod || '',
    '게시글제목': u.postTitle || '',
    '담당자이름': u.agentName || '',
    '담당자연락처': u.agentTel || '',
    '홍보문구': u.promoText || '',
    '내부메모': u.internalMemo || '',
  };
}
