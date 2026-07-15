import {
  CUSTOMER_TYPE_HEADER,
  CUSTOMER_TYPE_HEADER_LEGACY,
  CUSTOMER_TYPE_REPORT,
  customerHasDemandRole,
  customerHasSupplyRole,
  formatCustomerTypesLabel,
  getCustomerTypeRawValue,
  parseCustomerTypesFromText,
} from '../../utils/customerTypes.js';
import {
  CUSTOMER_BULK_HEADERS,
  CUSTOMER_BULK_LEGACY_HEADERS,
} from '../../data/customerBulkCsv.js';
import { digitsOnly, normalizePhone } from '../../utils/formatPhone.js';
import {
  parseCustomerMoneyInput,
  parseCustomerMoneyMan,
} from '../../utils/customerMoney.js';
import { parseCustomerStatusFromText } from '../../utils/customerStatus.js';
import { parsePreferredTradesFromText } from '../../utils/customerTradePreference.js';
import { formatCreatedDate } from '../../db.js';

export {
  CUSTOMER_TYPE_MAP,
  CUSTOMER_TYPE_REPORT,
  CUSTOMER_TYPE_HEADER,
} from '../../utils/customerTypes.js';

const normKey = (s) => String(s || '').replace(/\s/g, '').trim();

/** @param {Record<string, string>} raw @param {string} key */
function cell(raw, key) {
  const direct = raw[key];
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const nk = normKey(key);
  const hit = Object.entries(raw).find(([k]) => normKey(k) === nk);
  return hit ? String(hit[1]).trim() : '';
}

/** @param {Record<string, string>} raw */
export function rowToCustomerBulkInput(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  CUSTOMER_BULK_HEADERS.forEach((h) => {
    out[h] = cell(raw, h);
  });
  CUSTOMER_BULK_LEGACY_HEADERS.forEach((h) => {
    const v = cell(raw, h);
    if (v) out[h] = v;
  });
  if (cell(raw, CUSTOMER_TYPE_HEADER_LEGACY) && !out[CUSTOMER_TYPE_HEADER]) {
    out[CUSTOMER_TYPE_HEADER] = cell(raw, CUSTOMER_TYPE_HEADER_LEGACY);
  }
  if (!out['선호지역']) {
    out['선호지역'] = cell(raw, '희망지역');
  }
  if (!out['진행상태']) {
    out['진행상태'] = cell(raw, '상태') || cell(raw, '진행 상태');
  }
  if (raw._rowIndex != null) out._rowIndex = String(raw._rowIndex);
  return out;
}

/** @param {unknown} value */
function parseBudgetManwon(value) {
  const n = parseCustomerMoneyMan(value);
  return n > 0 ? n : 0;
}

/** @param {Record<string, string>} raw @param {string} manKey @param {string} [eokKey] */
function parseMoneyToMan(raw, manKey, eokKey = '') {
  return parseCustomerMoneyInput(cell(raw, manKey), eokKey ? cell(raw, eokKey) : '');
}

/** @param {string} phone */
export function getPhoneValidationError(phone) {
  const normalized = normalizePhone(phone);
  const digits = digitsOnly(normalized);
  if (!digits) return '휴대폰 번호 누락';
  if (!digits.startsWith('0')) return '휴대폰 번호 형식 오류 (0으로 시작해야 함)';
  if (digits.length < 9 || digits.length > 11) return '휴대폰 번호 형식 오류 (자릿수 확인)';
  return '';
}

/** @param {string} name @param {string} co */
export function getCustomerIdentityValidationError(name, co) {
  if (!String(name || '').trim() && !String(co || '').trim()) {
    return '고객명 또는 회사 중 하나 이상 필요';
  }
  return '';
}

/** @param {string} label @deprecated 단일 — parseCustomerTypesFromText 사용 */
export function mapCustomerType(label) {
  const types = parseCustomerTypesFromText(label);
  return types[0] || '';
}

function formatConditionBlock(prefix, propKind, trade, region, budgetMan) {
  const parts = [];
  if (propKind) parts.push(`희망매물: ${propKind}`);
  if (trade) parts.push(`희망거래: ${trade}`);
  if (region) parts.push(`희망지역: ${region}`);
  if (budgetMan > 0) parts.push(`예산: ${budgetMan.toLocaleString()}만원`);
  if (!parts.length) return '';
  return `${prefix}${parts.join(' · ')}`;
}

/** 구 양식 희망 조건 열 → 메모 보조 (있을 때만) */
function buildLegacyMemoAppendix(raw, customerTypes, preferredTrades) {
  const propKind = cell(raw, '희망매물종류');
  const trade = preferredTrades?.length ? '' : cell(raw, '희망거래방식');
  const legacyRegion = cell(raw, '희망지역');
  const budgetMan = parseBudgetManwon(cell(raw, '최대예산(만원)'));
  if (!propKind && !trade && !legacyRegion && budgetMan <= 0) return '';

  /** @type {string[]} */
  const sections = [];
  if (customerHasDemandRole(customerTypes)) {
    const block = formatConditionBlock('[수요] ', propKind, trade, legacyRegion, budgetMan);
    if (block) sections.push(block);
  }
  if (customerHasSupplyRole(customerTypes)) {
    const block = formatConditionBlock('[공급] ', propKind, trade, legacyRegion, budgetMan);
    if (block) sections.push(block);
  }
  if (!sections.length) {
    const fallback = formatConditionBlock('', propKind, trade, legacyRegion, budgetMan);
    if (fallback) sections.push(fallback);
  }
  return sections.join(' · ');
}

/**
 * @param {Record<string, string>} raw
 * @param {string[]} customerTypes
 */
function buildCustomerFields(raw, customerTypes) {
  const budgetMan = parseBudgetManwon(cell(raw, '최대예산(만원)'));
  const buyMinMan = parseMoneyToMan(raw, '매입가능액 최소(만)', '매입가능액 최소(억)');
  const buyMaxMan = parseMoneyToMan(raw, '매입가능액 최대(만)', '매입가능액 최대(억)');
  const buyMax = buyMaxMan > 0 ? buyMaxMan : budgetMan;
  const preferredTrades = parsePreferredTradesFromText(cell(raw, '희망거래방식'));
  const userMemo = cell(raw, '메모');
  const legacyMemo = buildLegacyMemoAppendix(raw, customerTypes, preferredTrades);
  const memo = [legacyMemo, userMemo].filter(Boolean).join(' · ');

  return {
    type: customerTypes[0],
    customer_types: customerTypes,
    email: cell(raw, '이메일'),
    co: cell(raw, '회사'),
    title: cell(raw, '직함'),
    addr: cell(raw, '주소'),
    cash: parseMoneyToMan(raw, '현금가용금액(만)', '현금가용금액(억)'),
    buyMin: buyMinMan,
    buyMax,
    region: cell(raw, '선호지역'),
    preferred_trades: preferredTrades,
    memo,
  };
}

/**
 * @param {Record<string, string>} raw
 * @param {number} rowIndex
 */
export function parseCustomerBulkRow(raw, rowIndex) {
  const row = rowToCustomerBulkInput(raw);

  const phoneError = getPhoneValidationError(cell(row, '연락처'));
  if (phoneError) {
    return { ok: false, error: phoneError, row };
  }

  const name = cell(row, '고객명');
  const co = cell(row, '회사');
  const identityError = getCustomerIdentityValidationError(name, co);
  if (identityError) {
    return { ok: false, error: identityError, row };
  }

  const typeText = getCustomerTypeRawValue(row);
  const customerTypes = parseCustomerTypesFromText(typeText);

  const roleFields = buildCustomerFields(row, customerTypes);

  const statusParsed = parseCustomerStatusFromText(cell(row, '진행상태'));
  if (!statusParsed.ok) {
    return { ok: false, error: statusParsed.error, row };
  }

  return {
    ok: true,
    row,
    reportKey: formatCustomerTypesLabel(customerTypes) || '미분류',
    customer: {
      name: name.trim(),
      phone: normalizePhone(cell(row, '연락처')),
      status: statusParsed.status,
      ...roleFields,
      fav: false,
      deletedAt: null,
      created: formatCreatedDate(),
    },
  };
}
