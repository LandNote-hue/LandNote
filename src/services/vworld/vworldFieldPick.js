/**
 * vworld API 다건 field[] 중 대표 1건 선택
 */

/** @param {Record<string, unknown>[]} items */
export function pickBestLandCharacteristic(items) {
  if (!items?.length) return null;
  if (items.length === 1) return items[0];

  return [...items].sort((a, b) => {
    const aReg = String(a.regstrSeCode ?? '') === '1' ? 1 : 0;
    const bReg = String(b.regstrSeCode ?? '') === '1' ? 1 : 0;
    if (bReg !== aReg) return bReg - aReg;

    const aJimok = a.lndcgrCodeNm ? 1 : 0;
    const bJimok = b.lndcgrCodeNm ? 1 : 0;
    if (bJimok !== aJimok) return bJimok - aJimok;

    return String(b.lastUpdtDt ?? '').localeCompare(String(a.lastUpdtDt ?? ''));
  })[0];
}

/** @param {Record<string, unknown>[]} items */
export function pickBestIndvdLandPrice(items) {
  if (!items?.length) return null;
  if (items.length === 1) return items[0];

  return [...items].sort((a, b) => {
    const aStd = String(a.stdLandAt ?? '').toUpperCase() === 'Y' ? 1 : 0;
    const bStd = String(b.stdLandAt ?? '').toUpperCase() === 'Y' ? 1 : 0;
    if (bStd !== aStd) return bStd - aStd;

    const aMt = parseInt(String(a.stdrMt ?? '0'), 10) || 0;
    const bMt = parseInt(String(b.stdrMt ?? '0'), 10) || 0;
    if (bMt !== aMt) return bMt - aMt;

    return String(b.lastUpdtDt ?? '').localeCompare(String(a.lastUpdtDt ?? ''));
  })[0];
}
