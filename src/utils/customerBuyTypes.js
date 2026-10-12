/** 매수고객 매수유형 — 복수 선택 */

export const CUSTOMER_BUY_TYPE_OPTS = [
  { id: 'NEW_BUILD', label: '신축' },
  { id: 'REMODEL', label: '리모델링' },
  { id: 'HQ', label: '사옥' },
  { id: 'INCOME', label: '수익형' },
];

/** @type {Record<string, string>} */
export const CUSTOMER_BUY_TYPE_MAP = {
  신축: 'NEW_BUILD',
  NEW_BUILD: 'NEW_BUILD',
  리모델링: 'REMODEL',
  REMODEL: 'REMODEL',
  사옥: 'HQ',
  HQ: 'HQ',
  수익형: 'INCOME',
  INCOME: 'INCOME',
};

/** @type {Record<string, string>} */
export const CUSTOMER_BUY_TYPE_REPORT = Object.fromEntries(
  CUSTOMER_BUY_TYPE_OPTS.map(({ id, label }) => [id, label]),
);

const TYPE_PRIORITY = CUSTOMER_BUY_TYPE_OPTS.map((o) => o.id);

const normKey = (s) => String(s || '').replace(/\s/g, '').trim();

/** @param {string} token */
function mapSingleBuyTypeToken(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return '';
  return CUSTOMER_BUY_TYPE_MAP[trimmed]
    || CUSTOMER_BUY_TYPE_MAP[normKey(trimmed)]
    || '';
}

/**
 * @param {string} text e.g. "신축/사옥"
 * @returns {string[]}
 */
export function parseBuyTypesFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  /** @type {string[]} */
  const found = [];
  const add = (code) => {
    if (code && !found.includes(code)) found.push(code);
  };
  raw.split(/[,/·+]+/).map((t) => t.trim()).filter(Boolean).forEach((token) => {
    const mapped = mapSingleBuyTypeToken(token);
    if (mapped) add(mapped);
  });
  return TYPE_PRIORITY.filter((code) => found.includes(code));
}

/** @param {string[]|undefined|null} types */
export function normalizeBuyTypesField(types) {
  const raw = Array.isArray(types) ? types.filter(Boolean) : [];
  return TYPE_PRIORITY.filter((code) => raw.includes(code));
}

/** @param {Record<string, unknown>|null|undefined} c */
export function buyTypesOf(c) {
  const fromArray = normalizeBuyTypesField(/** @type {string[]} */ (c?.buyTypes));
  if (fromArray.length) return fromArray;
  return parseBuyTypesFromText(String(c?.buy_type || c?.buyType || ''));
}

/** @param {string[]} types */
export function formatBuyTypesLabel(types) {
  const list = normalizeBuyTypesField(types);
  if (!list.length) return '';
  return list.map((t) => CUSTOMER_BUY_TYPE_REPORT[t] || t).join('·');
}

/** @param {Record<string, unknown>|null|undefined} c */
export function customerBuyTypeLabelOf(c) {
  return formatBuyTypesLabel(buyTypesOf(c)) || '—';
}

/** @param {Record<string, unknown>|null|undefined} c */
export function customerBuyTimingOf(c) {
  return String(c?.buyTiming || '').trim();
}
