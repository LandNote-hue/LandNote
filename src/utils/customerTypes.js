/** 고객 역할 — 수요(손님) / 공급(건물주) */

import { normalizeCustomerMoneyFields } from './customerMoney.js';
import { normalizePreferredTradesField, preferredTradesOf } from './customerTradePreference.js';

export const CUSTOMER_TYPE_HEADER = '고객구분(중복시 콤마나 슬래시로 구분)';
export const CUSTOMER_TYPE_HEADER_LEGACY = '고객구분';

/** @type {Record<string, string>} */
export const CUSTOMER_TYPE_MAP = {
  매수: 'BUYER',
  매수인: 'BUYER',
  BUYER: 'BUYER',
  임차: 'TENANT',
  임차인: 'TENANT',
  TENANT: 'TENANT',
  매도: 'SELLER',
  SELLER: 'SELLER',
  매도인: 'SELLER',
  임대: 'LANDLORD',
  LANDLORD: 'LANDLORD',
  임대인: 'LANDLORD',
  기타: 'OTHER',
  OTHER: 'OTHER',
};

/** @type {Record<string, string>} */
export const CUSTOMER_TYPE_REPORT = {
  BUYER: '매수인',
  TENANT: '임차인',
  SELLER: '매도인',
  LANDLORD: '임대인',
  OTHER: '기타',
};

export const DEMAND_CUSTOMER_TYPES = new Set(['BUYER', 'TENANT']);
export const SUPPLY_CUSTOMER_TYPES = new Set(['SELLER', 'LANDLORD']);

const TYPE_PRIORITY = ['BUYER', 'TENANT', 'SELLER', 'LANDLORD', 'OTHER'];

const KEYWORD_MATCHERS = [
  { pattern: /매수(?:인)?/g, code: 'BUYER' },
  { pattern: /매도(?:인)?/g, code: 'SELLER' },
  { pattern: /임차(?:인)?/g, code: 'TENANT' },
  { pattern: /임대(?:인)?/g, code: 'LANDLORD' },
];

const normKey = (s) => String(s || '').replace(/\s/g, '').trim();

/** @param {string} token */
function mapSingleTypeToken(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return '';
  return CUSTOMER_TYPE_MAP[trimmed]
    || CUSTOMER_TYPE_MAP[normKey(trimmed)]
    || '';
}

/** @param {string} text */
function extractTypesByKeywords(text) {
  /** @type {string[]} */
  const found = [];
  KEYWORD_MATCHERS.forEach(({ pattern, code }) => {
    pattern.lastIndex = 0;
    if (pattern.test(text) && !found.includes(code)) found.push(code);
  });
  return found;
}

/**
 * CSV·폼 입력 → customer_types 코드 배열
 * @param {string} text e.g. "매수/임차", "매도, 매수"
 * @returns {string[]}
 */
export function parseCustomerTypesFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  /** @type {string[]} */
  const found = [];
  const add = (code) => {
    if (code && !found.includes(code)) found.push(code);
  };

  const tokens = raw.split(/[,/]+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length) {
    tokens.forEach((token) => {
      const mapped = mapSingleTypeToken(token);
      if (mapped) {
        add(mapped);
        return;
      }
      extractTypesByKeywords(token).forEach(add);
    });
  }

  if (!found.length) {
    extractTypesByKeywords(raw).forEach(add);
  }

  return TYPE_PRIORITY.filter((code) => found.includes(code));
}

/** @param {string[]|undefined|null} customerTypes @param {string} [fallbackType] */
export function normalizeCustomerTypesField(customerTypes, fallbackType = '') {
  const raw = Array.isArray(customerTypes) ? customerTypes.filter(Boolean) : [];
  const unique = TYPE_PRIORITY.filter((code) => raw.includes(code));
  if (unique.length) {
    return { customer_types: unique, type: unique[0] };
  }
  const single = fallbackType && CUSTOMER_TYPE_REPORT[fallbackType] ? fallbackType : '';
  return {
    customer_types: single ? [single] : [],
    type: single,
  };
}

/** @param {Record<string, unknown>} data */
export function normalizeCustomerRecord(data) {
  const { customer_types, type } = normalizeCustomerTypesField(
    /** @type {string[]} */ (data.customer_types),
    String(data.type || ''),
  );
  const preferred_trades = normalizePreferredTradesField(
    data.preferred_trades != null
      ? /** @type {string[]} */ (data.preferred_trades)
      : preferredTradesOf(data),
  );
  return normalizeCustomerMoneyFields({ ...data, customer_types, type, preferred_trades });
}

/** @param {string[]} types */
export function formatCustomerTypesLabel(types) {
  if (!types?.length) return '';
  return types.map((t) => CUSTOMER_TYPE_REPORT[t] || t).join('+');
}

/** @param {string[]} types */
export function customerHasDemandRole(types) {
  return (types || []).some((t) => DEMAND_CUSTOMER_TYPES.has(t));
}

/** @param {string[]} types */
export function customerHasSupplyRole(types) {
  return (types || []).some((t) => SUPPLY_CUSTOMER_TYPES.has(t));
}

/** @param {Record<string, string>} raw @param {string[]} types */
export function getCustomerTypeRawValue(raw) {
  return String(
    raw[CUSTOMER_TYPE_HEADER]
    ?? raw[CUSTOMER_TYPE_HEADER_LEGACY]
    ?? raw['고객구분']
    ?? '',
  ).trim();
}
