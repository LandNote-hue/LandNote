/**
 * 매각 건물 기존 임대차 행 식별 — 임대 매물(전월세 매물)과 별개.
 * @param {Record<string, unknown>} row
 * @param {number|string} pid
 */
export function rentalFingerprint(row, pid) {
  const floor = String(row?.floor || '').trim();
  const tenant = String(row?.tenant || '').trim();
  const leaseEnd = String(row?.leaseEnd || '').trim();
  const dep = row?.dep == null ? '' : String(row.dep);
  const rent = row?.rent == null ? '' : String(row.rent);
  return `${pid}|${floor}|${tenant}|${leaseEnd}|${dep}|${rent}`;
}

/**
 * 저장 시 기존 Dexie id를 재사용할지 (Date.now() 임시 id는 신규)
 * @param {unknown} rowId
 */
export function isPersistedRentalLocalId(rowId) {
  return typeof rowId === 'number' && Number.isFinite(rowId) && rowId > 0 && rowId < 1e10;
}
