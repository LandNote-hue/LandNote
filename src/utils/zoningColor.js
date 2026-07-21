/**
 * 카카오맵 지적편집도(용도지역) 범례에 맞춘 텍스트 색
 * — 지도 면색(연한 fill)을 가독성 있게 채도·명도 조정한 톤
 */

/** @type {Record<string, string>} 정규화 키 → 텍스트용 HEX */
const ZONING_COLOR_EXACT = {
  // 주거 — 노랑·주황 계열
  제1종전용주거지역: '#C4A000',
  제2종전용주거지역: '#B8860B',
  제1종일반주거지역: '#D4A017',
  제2종일반주거지역: '#E67E00',
  제3종일반주거지역: '#E65100',
  준주거지역: '#E85D75',
  전용주거지역: '#B8860B',
  일반주거지역: '#D4A017',
  주거지역: '#C9A227',

  // 상업 — 분홍·자홍 계열
  중심상업지역: '#C2185B',
  일반상업지역: '#D81B60',
  근린상업지역: '#EC407A',
  유통상업지역: '#AD1457',
  상업지역: '#D81B60',

  // 공업 — 보라 계열
  전용공업지역: '#6A1B9A',
  일반공업지역: '#8E24AA',
  준공업지역: '#9C27B0',
  공업지역: '#8E24AA',

  // 녹지 — 초록 계열
  보전녹지지역: '#2E7D32',
  생산녹지지역: '#388E3C',
  자연녹지지역: '#43A047',
  녹지지역: '#388E3C',

  // 관리·농림·보전
  보전관리지역: '#558B2F',
  생산관리지역: '#689F38',
  계획관리지역: '#7CB342',
  관리지역: '#689F38',
  농림지역: '#6D4C41',
  자연환경보전지역: '#1B5E20',
};

/** @type {[RegExp, string][]} 부분 매칭 (긴 패턴 우선) */
const ZONING_COLOR_PATTERNS = [
  [/제\s*1\s*종\s*전용\s*주거/, '#C4A000'],
  [/제\s*2\s*종\s*전용\s*주거/, '#B8860B'],
  [/제\s*1\s*종\s*일반\s*주거/, '#D4A017'],
  [/제\s*2\s*종\s*일반\s*주거/, '#E67E00'],
  [/제\s*3\s*종\s*일반\s*주거/, '#E65100'],
  [/준\s*주거/, '#E85D75'],
  [/전용\s*주거/, '#B8860B'],
  [/일반\s*주거/, '#D4A017'],
  [/중심\s*상업/, '#C2185B'],
  [/일반\s*상업/, '#D81B60'],
  [/근린\s*상업/, '#EC407A'],
  [/유통\s*상업/, '#AD1457'],
  [/전용\s*공업/, '#6A1B9A'],
  [/일반\s*공업/, '#8E24AA'],
  [/준\s*공업/, '#9C27B0'],
  [/보전\s*녹지/, '#2E7D32'],
  [/생산\s*녹지/, '#388E3C'],
  [/자연\s*녹지/, '#43A047'],
  [/보전\s*관리/, '#558B2F'],
  [/생산\s*관리/, '#689F38'],
  [/계획\s*관리/, '#7CB342'],
  [/농림/, '#6D4C41'],
  [/자연\s*환경\s*보전/, '#1B5E20'],
  [/상업/, '#D81B60'],
  [/공업/, '#8E24AA'],
  [/녹지/, '#388E3C'],
  [/주거/, '#C9A227'],
  [/관리/, '#689F38'],
];

const DEFAULT_ZONING_COLOR = '#6B7280';

/** @param {string} s */
function normalizeZoningKey(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()（）·・]/g, '');
}

/**
 * @param {string|null|undefined} zoning
 * @returns {string} CSS color
 */
export function zoningTextColor(zoning) {
  const raw = String(zoning || '').trim();
  if (!raw || raw === '-' || raw === '—') return DEFAULT_ZONING_COLOR;

  const key = normalizeZoningKey(raw);
  if (ZONING_COLOR_EXACT[key]) return ZONING_COLOR_EXACT[key];

  // 복합표기 "제2종일반주거지역,준주거지역" → 첫 구간
  const first = key.split(/[,/|]/)[0]?.trim() || key;
  if (ZONING_COLOR_EXACT[first]) return ZONING_COLOR_EXACT[first];

  for (const [re, color] of ZONING_COLOR_PATTERNS) {
    if (re.test(raw) || re.test(first)) return color;
  }
  return DEFAULT_ZONING_COLOR;
}
