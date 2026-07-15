/** 고객 희망 거래방식 — 매물 trade 코드(SALE 등)와 동일 */

export const CUSTOMER_TRADE_OPTS = [
  { id: 'SALE', label: '매매' },
  { id: 'JEONSE', label: '전세' },
  { id: 'MONTHLY', label: '월세' },
  { id: 'SHORT_TERM', label: '단기' },
  { id: 'PRESALE', label: '분양' },
];

/** @type {Record<string, string>} */
export const CUSTOMER_TRADE_MAP = {
  매매: 'SALE',
  SALE: 'SALE',
  전세: 'JEONSE',
  JEONSE: 'JEONSE',
  월세: 'MONTHLY',
  MONTHLY: 'MONTHLY',
  단기: 'SHORT_TERM',
  SHORT_TERM: 'SHORT_TERM',
  단기임대: 'SHORT_TERM',
  분양: 'PRESALE',
  PRESALE: 'PRESALE',
};

/** @type {Record<string, string>} */
export const CUSTOMER_TRADE_REPORT = Object.fromEntries(
  CUSTOMER_TRADE_OPTS.map(({ id, label }) => [id, label]),
);

const TRADE_PRIORITY = CUSTOMER_TRADE_OPTS.map((o) => o.id);

const normKey = (s) => String(s || '').replace(/\s/g, '').trim();

/** @param {string} token */
function mapSingleTradeToken(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return '';
  return CUSTOMER_TRADE_MAP[trimmed]
    || CUSTOMER_TRADE_MAP[normKey(trimmed)]
    || '';
}

/**
 * CSV·폼 입력 → preferred_trades 코드 배열
 * @param {string} text e.g. "매매/월세", "전세, 매매"
 * @returns {string[]}
 */
export function parsePreferredTradesFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  /** @type {string[]} */
  const found = [];
  const add = (code) => {
    if (code && !found.includes(code)) found.push(code);
  };

  raw.split(/[,/·+]+/).map((t) => t.trim()).filter(Boolean).forEach((token) => {
    const mapped = mapSingleTradeToken(token);
    if (mapped) add(mapped);
  });

  return TRADE_PRIORITY.filter((code) => found.includes(code));
}

/** @param {string[]|undefined|null} trades */
export function normalizePreferredTradesField(trades) {
  const raw = Array.isArray(trades) ? trades.filter(Boolean) : [];
  const unique = TRADE_PRIORITY.filter((code) => raw.includes(code));
  return unique;
}

/** @param {Record<string, unknown>|null|undefined} c */
export function preferredTradesOf(c) {
  const fromArray = normalizePreferredTradesField(/** @type {string[]} */ (c?.preferred_trades));
  if (fromArray.length) return fromArray;
  return parsePreferredTradesFromText(String(c?.preferred_trade || ''));
}

/** @param {string[]} trades */
export function formatPreferredTradesLabel(trades) {
  const list = normalizePreferredTradesField(trades);
  if (!list.length) return '';
  return list.map((t) => CUSTOMER_TRADE_REPORT[t] || t).join('·');
}
