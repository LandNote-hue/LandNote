import { propDisplayAddr, propJibunAddr } from './propAddress.js';

/**
 * 디스코 상세 URL 정규화
 * @param {unknown} value
 */
/** http(s) 외부 링크. 프로토콜이 없으면 https:// 를 붙인다. */
export function normalizeHttpUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const withProto = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

export function normalizeDiscoUrl(value) {
  return normalizeHttpUrl(value);
}

/**
 * 지번주소 기준 디스코 검색 URL
 * @param {string} jibunAddress
 */
export function buildDiscoSearchUrl(jibunAddress) {
  const q = String(jibunAddress || '').trim();
  if (!q || q === '—') return 'https://www.disco.re/';
  return `https://www.disco.re/search?q=${encodeURIComponent(q)}`;
}

/**
 * 매물 상세 «디스코» 버튼 — 직접 링크 우선, 없으면 지번 검색
 * @param {Record<string, unknown>|null|undefined} property
 */
export function handleDiscoLink(property) {
  const direct = normalizeDiscoUrl(property?.discoUrl ?? property?.disco_url);
  if (direct) {
    window.open(direct, '_blank', 'noopener,noreferrer');
    return;
  }
  const jibun = propJibunAddr(property) || propDisplayAddr(property) || '';
  window.open(buildDiscoSearchUrl(jibun), '_blank', 'noopener,noreferrer');
}
