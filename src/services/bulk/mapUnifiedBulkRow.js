import {
  BULK_PROPERTY_TYPE_MAP,
  BULK_TRADE_TYPE_MAP,
  BULK_LEGACY_HEADERS,
  BULK_UNIFIED_HEADERS,
} from '../../data/propertyBulkCsv.js';

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
  const commercial = isCommercialType(propertyType);

  let priceManwon = 0;
  let depositManwon = 0;
  let monthlyRentManwon = 0;

  if (tradeCode === 'SALE' || tradeCode === 'PRESALE') {
    // 조건 A: 매매 — 금액→매매가, 월세/보증금 0
    priceManwon = amount;
    depositManwon = 0;
    monthlyRentManwon = 0;
  } else if (tradeCode === 'JEONSE') {
    priceManwon = amount;
    depositManwon = 0;
    monthlyRentManwon = 0;
  } else if (tradeCode === 'MONTHLY' || tradeCode === 'SHORT_TERM') {
    // 조건 B: 월세/임대 — 금액→보증금, 월세 컬럼→월세
    depositManwon = amount;
    monthlyRentManwon = monthlyRent;
    priceManwon = 0;
  }

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
      typeLabel: BULK_PROPERTY_TYPE_MAP[propertyType]?.tag || propertyType,
      reportKey: buildReportKey(propertyType, tradeLabel),
      monthlyRentManwon: String(monthlyRentManwon),
      premiumManwon: commercial ? String(premium) : '0',
      maintenanceManwon: commercial ? String(maintenance) : '0',
      areaPyeong: String(areaPyeong),
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
    return {
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
  }

  const n = normalizeBulkRow(row);
  const u = n._unified || {};
  const tradeCode = u.tradeCode || 'SALE';
  let amount = n['가격(만원)'] || '0';
  if (tradeCode === 'MONTHLY' || tradeCode === 'SHORT_TERM') {
    amount = n['보증금(월세)'] || '0';
  }
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
  };
}
