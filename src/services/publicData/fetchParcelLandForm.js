import { fetchVworldLandBundle } from '../vworld/landData.js';
import { fetchAllBuildingLedger } from './buildingLedger.js';
import { isUsablePnu } from '../address/buildPnu.js';
import { toPublicDataQuery } from '../address/parseJibunAddress.js';
import { mapPublicDataToPropertyForm } from './mapToPropertyForm.js';

/** @param {Record<string, string>|null|undefined} land */
export function isLandFormFilled(land) {
  if (!land || typeof land !== 'object') return false;
  return Boolean(
    String(land.landAreaM2 || '').trim()
    || String(land.officialPriceM2 || '').trim()
    || String(land.landCategory || '').trim()
    || String(land.landUseZone || '').trim(),
  );
}

const EMPTY_BUILDING = { title: { items: [] }, recap: { items: [] }, jijigu: { items: [] } };

/**
 * 추가 필지 토지정보 — vworld + 건축물대장(대지면적·용도지역)
 * @param {Record<string, string>} keys
 */
export async function fetchParcelLandForm(keys) {
  const pnu = String(keys?.pnu || '').replace(/\D/g, '');
  if (!isUsablePnu(pnu)) {
    throw new Error('필지번호(PNU)를 확인하지 못했습니다. 지번으로 다시 검색해 주세요.');
  }

  const queryKeys = toPublicDataQuery(keys);
  const [vworld, building] = await Promise.all([
    fetchVworldLandBundle(pnu).catch((err) => {
      console.warn('[fetchParcelLandForm] vworld', err);
      return null;
    }),
    (queryKeys.sigunguCd && queryKeys.bjdongCd)
      ? fetchAllBuildingLedger(queryKeys).catch((err) => {
        console.warn('[fetchParcelLandForm] building', err);
        return null;
      })
      : Promise.resolve(null),
  ]);

  const { landForm } = mapPublicDataToPropertyForm(building || EMPTY_BUILDING, { vworld });
  if (!isLandFormFilled(landForm)) {
    throw new Error('이 필지의 토지대장·공시지가 정보를 찾지 못했습니다.');
  }
  return landForm;
}
