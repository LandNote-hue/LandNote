/**
 * 매물 주소 — 지번 우선 표시·저장·검색
 */

/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string, bldg?: string }|null|undefined} p */
export function propDisplayAddr(p) {
  if (!p) return '—';
  const jibun = (p.jibunAddr || '').trim();
  const addr = (p.addr || '').trim();
  return jibun || addr || '—';
}

/** 매물 상세 Win 타이틀 — 주소 + 게시글 제목(bldg), 「매물 상세」 접두어 없음 */
/** @param {{ addr?: string, jibunAddr?: string, bldg?: string }|null|undefined} p */
export function propDetailWinTitle(p) {
  if (!p) return '—';
  const addr = propDisplayAddr(p);
  const title = (p.bldg || '').trim();
  if (title && title !== addr) return `${addr} · ${title}`;
  return addr !== '—' ? addr : (title || '—');
}

/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string }|null|undefined} p */
export function propRoadAddr(p) {
  if (!p) return '';
  const road = (p.roadAddr || '').trim();
  if (road) return road;
  const jibun = (p.jibunAddr || '').trim();
  const addr = (p.addr || '').trim();
  if (jibun && addr && jibun !== addr) return addr;
  return '';
}

/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string, bldg?: string }|null|undefined} p */
export function propJibunAddr(p) {
  if (!p) return '';
  return (p.jibunAddr || '').trim() || (p.addr || '').trim();
}

/** 상세 지도 등 — 지번·addr·건물명만 (도로명 제외) */
/** @param {{ addr?: string, jibunAddr?: string, bldg?: string }|null|undefined} p */
export function propJibunGeocodeQueries(p) {
  if (!p) return [];
  /** @type {string[]} */
  const queries = [];
  const seen = new Set();
  const add = (s) => {
    const t = String(s || '').trim();
    if (!t || t === '—' || seen.has(t)) return;
    seen.add(t);
    queries.push(t);
  };
  const jibun = (p.jibunAddr || '').trim();
  const addr = (p.addr || '').trim();
  add(jibun);
  // 지번이 있으면 addr(도로명이 섞인 레거시 데이터)로 폴백하지 않음
  if (!jibun) add(addr);
  const base = propJibunAddr(p);
  if (p.bldg && base) add(`${base} ${p.bldg}`);
  return queries;
}

/** @param {string} [s] */
function normSearch(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

/** 검색 대상 문자열 — 도로명·지번·건물명 */
/** 지도 지오코딩용 주소 후보 (우선순위 순, 중복 제거) */
/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string, bldg?: string }|null|undefined} p */
export function propGeocodeQueries(p) {
  if (!p) return [];
  /** @type {string[]} */
  const queries = [];
  const seen = new Set();
  const add = (s) => {
    const t = String(s || '').trim();
    if (!t || t === '—' || seen.has(t)) return;
    seen.add(t);
    queries.push(t);
  };
  add(p.jibunAddr);
  add(p.addr);
  add(p.roadAddr);
  const base = (p.jibunAddr || p.addr || '').trim();
  if (p.bldg && base) add(`${base} ${p.bldg}`);
  return queries;
}

/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string, bldg?: string, mapLat?: number, mapLng?: number }|null|undefined} p */
export function propHasMappableAddress(p) {
  if (!p) return false;
  if (typeof p.mapLat === 'number' && typeof p.mapLng === 'number'
    && Number.isFinite(p.mapLat) && Number.isFinite(p.mapLng)) {
    return true;
  }
  return propGeocodeQueries(p).length > 0;
}

/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string, bldg?: string }|null|undefined} p */
export function propSearchHaystack(p) {
  if (!p) return '';
  return [p.jibunAddr, p.addr, p.roadAddr, p.bldg].filter(Boolean).join(' ');
}

/** @param {{ addr?: string, jibunAddr?: string, roadAddr?: string, bldg?: string }|null|undefined} p @param {string} [kw] */
export function propMatchesSearch(p, kw) {
  if (!p) return !kw;
  const raw = String(kw || '').trim();
  if (!raw) return true;

  const hay = propSearchHaystack(p);
  const hayLower = hay.toLowerCase();
  const hayNorm = normSearch(hay);
  const kwLower = raw.toLowerCase();
  const kwNorm = normSearch(raw);

  if (hayLower.includes(kwLower) || hayNorm.includes(kwNorm)) return true;

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((t) => {
      const tl = t.toLowerCase();
      const tn = normSearch(t);
      return hayLower.includes(tl) || hayNorm.includes(tn);
    });
  }
  return false;
}

/** @param {{ jibunAddr?: string, roadAddr?: string }} locationForm @param {string} [searchKeyword] */
export function buildPropertyAddressFields(locationForm, searchKeyword = '') {
  const jibun = (locationForm.jibunAddr || '').trim();
  const road = (locationForm.roadAddr || '').trim();
  const fallback = (searchKeyword || '').trim();
  return {
    addr: jibun || fallback || '주소 미입력',
    jibunAddr: jibun,
    roadAddr: road,
  };
}
