import { parseDongLotKeyword, jibunAddrMatchesLot } from './parseJibunAddress.js';

/** @typedef {import('./jusoApi.js').AddressSearchMode} AddressSearchMode */

/**
 * @param {import('./jusoApi.js').ReturnType<typeof import('./jusoApi.js').mapJusoApiItem>[]} items
 * @param {AddressSearchMode} mode
 * @param {string} keyword
 */
export function filterJusoResults(items, mode, keyword) {
  const kw = keyword.trim().toLowerCase();
  if (!kw || mode === 'all') return items;

  if (mode === 'road') {
    return items.filter(i =>
      i.roadAddr?.toLowerCase().includes(kw)
      || i.roadAddr?.replace(/\s/g, '').includes(kw.replace(/\s/g, '')),
    );
  }

  if (mode === 'jibun' || mode === 'land') {
    return items.filter(i => matchesJibunKeyword(i, kw, mode));
  }

  if (mode === 'building') {
    return items.filter(i => {
      const hasBldg = Boolean(i.bdNm || i.detBdNmList || i.bdKdcd === '1');
      if (!hasBldg) return false;
      const hay = `${i.roadAddr} ${i.jibunAddr} ${i.bdNm} ${i.detBdNmList}`.toLowerCase();
      return hay.includes(kw);
    });
  }

  return items;
}

/** @param {ReturnType<typeof import('./jusoApi.js').mapJusoApiItem>} item @param {string} kw @param {'jibun'|'land'} mode */
function matchesJibunKeyword(item, kw, mode) {
  const jibun = item.jibunAddr || '';
  const jibunLo = jibun.toLowerCase();
  const kwCompact = kw.replace(/\s/g, '');

  if (mode === 'land') {
    const isLandParcel = item.bdKdcd !== '1' && !item.bdNm && !item.detBdNmList;
    if (!isLandParcel) return false;
  }

  if (jibunLo.includes(kw) || jibun.replace(/\s/g, '').toLowerCase().includes(kwCompact)) {
    return true;
  }

  const parsed = parseDongLotKeyword(kw);
  if (parsed) {
    const dongLo = parsed.dong.toLowerCase();
    if (jibunLo.includes(dongLo) && jibunAddrMatchesLot(jibun, parsed.lot)) {
      return true;
    }
  }

  return false;
}

/** @param {ReturnType<typeof import('./jusoApi.js').mapJusoApiItem>[]} items @param {string} dong @param {string} lot */
export function filterByDongLot(items, dong, lot) {
  const dongLo = dong.toLowerCase();
  return items.filter(i => {
    const jibun = i.jibunAddr || '';
    return jibun.toLowerCase().includes(dongLo) && jibunAddrMatchesLot(jibun, lot);
  });
}
