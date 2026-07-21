import { useCallback, useState } from 'react';
import { normalizeAddressKeys, toPublicDataQuery } from '../services/address/parseJibunAddress.js';
import { buildPnu } from '../services/address/buildPnu.js';
import { fetchAllBuildingLedger } from '../services/publicData/buildingLedger.js';
import { fetchVworldLandBundle } from '../services/vworld/landData.js';
import { fetchRegulationForPrimaryZone } from '../services/eum/landUseRegulation.js';
import {
  emptyBuildingForm,
  emptyLandForm,
  emptyLocationForm,
  mapPublicDataToPropertyForm,
  applyMeaningfulPatch,
} from '../services/publicData/mapToPropertyForm.js';

/** @typedef {'idle'|'address_confirmed'|'loading'|'success'|'error'} LookupStatus */

/** @typedef {import('../services/address/parseJibunAddress.js').PublicAddressKeys} PublicAddressKeys */

export const initialAddressKeys = () => ({
  roadAddr: '',
  jibunAddr: '',
  sigunguCd: '',
  bjdongCd: '',
  bun: '',
  ji: '',
  platGbCd: '0',
  pnu: '',
});

const initialLookupMeta = () => ({
  status: /** @type {LookupStatus} */ ('idle'),
  error: null,
  warnings: /** @type {string[]} */ ([]),
  fetchedAt: null,
  /** @type {'register'|'edit'} */
  mode: 'register',
});

/**
 * 매물 등록·수정 — 주소 확정 후 공공데이터 자동 채움
 * @param {{ mode?: 'register'|'edit', includeExpos?: boolean, dongNm?: string, hoNm?: string }} [options]
 */
export function usePropertyAddressLookup(options = {}) {
  const { mode = 'register', includeExpos = false, dongNm, hoNm } = options;

  const [lookup, setLookup] = useState(initialLookupMeta);
  const [addressKeys, setAddressKeys] = useState(initialAddressKeys);
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [landForm, setLandForm] = useState(emptyLandForm);
  const [buildingForm, setBuildingForm] = useState(emptyBuildingForm);
  /** 원본 API 응답 보관 (디버그·재매핑) */
  const [apiRaw, setApiRaw] = useState({ building: null, land: null });

  /**
   * [주소 조회] 완료 콜백 — juso/카카오 등 주소 검색 UI에서 호출
   * @param {import('../services/address/parseJibunAddress.js').AddressSearchResult} addressData
   */
  const handleAddressFetchSuccess = useCallback(async (addressData) => {
    setLookup(s => ({ ...s, status: 'loading', error: null, mode }));

    try {
      const normalized = normalizeAddressKeys(addressData);
      const keys = {
        roadAddr: normalized.roadAddr,
        jibunAddr: normalized.jibunAddr,
        sigunguCd: normalized.sigunguCd,
        bjdongCd: normalized.bjdongCd,
        bun: normalized.bun,
        ji: normalized.ji,
        platGbCd: normalized.platGbCd,
        pnu: buildPnu({
          admCd: addressData.admCd,
          sigunguCd: normalized.sigunguCd,
          bjdongCd: normalized.bjdongCd,
          bun: normalized.bun,
          ji: normalized.ji,
          platGbCd: normalized.platGbCd,
        }),
      };
      if (addressData.pnu) {
        keys.pnu = String(addressData.pnu);
      }

      setAddressKeys(keys);
      setLocationForm(prev => ({
        ...prev,
        roadAddr: normalized.roadAddr,
        jibunAddr: normalized.jibunAddr,
      }));

      if (!keys.sigunguCd || !keys.bjdongCd) {
        setLandForm(emptyLandForm());
        setBuildingForm(emptyBuildingForm());
        setLookup(s => ({
          ...s,
          status: 'address_confirmed',
          warnings: normalized.warnings,
          fetchedAt: new Date().toISOString(),
        }));
        return { keys, building: null, land: null, skippedApi: true };
      }

      setLandForm(emptyLandForm());
      setBuildingForm(emptyBuildingForm());

      const queryKeys = toPublicDataQuery(keys);
      const pnu = keys.pnu;
      const stdrYear = String(new Date().getFullYear());

      const [building, vworld] = await Promise.all([
        fetchAllBuildingLedger(queryKeys, { includeExpos, dongNm, hoNm }),
        fetchVworldLandBundle(pnu, stdrYear),
      ]);

      const useFields = vworld.landUse?.fields?.length
        ? vworld.landUse.fields
        : (vworld.landUse?.item ? [vworld.landUse.item] : []);

      const regulation = await fetchRegulationForPrimaryZone(pnu, useFields);

      setApiRaw({ building, land: { vworld, regulation } });

      const { landForm: nextLand, buildingForm: nextBuilding } = mapPublicDataToPropertyForm(
        building,
        { vworld, regulation },
      );

      setLandForm(prev => applyMeaningfulPatch(prev, nextLand));
      setBuildingForm(prev => applyMeaningfulPatch(prev, nextBuilding));

      setLookup({
        status: 'success',
        error: null,
        warnings: normalized.warnings,
        fetchedAt: new Date().toISOString(),
        mode,
      });

      return { keys: queryKeys, pnu, building, vworld, regulation, skippedApi: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : '공공데이터 조회 실패';
      setLookup(s => ({ ...s, status: 'error', error: message }));
      throw err;
    }
  }, [mode, includeExpos, dongNm, hoNm]);

  /** [재조회] — 동일 키로 API만 다시 호출 */
  const refetchPublicData = useCallback(async () => {
    if (!addressKeys.sigunguCd || !addressKeys.jibunAddr) return;
    return handleAddressFetchSuccess({
      ...addressKeys,
      roadAddr: locationForm.roadAddr,
      jibunAddr: addressKeys.jibunAddr,
      admCd: addressKeys.sigunguCd + addressKeys.bjdongCd,
    });
  }, [addressKeys, locationForm.roadAddr, handleAddressFetchSuccess]);

  const resetAddressLookup = useCallback(() => {
    setLookup(initialLookupMeta());
    setAddressKeys(initialAddressKeys());
    setLocationForm(emptyLocationForm());
    setLandForm(emptyLandForm());
    setBuildingForm(emptyBuildingForm());
    setApiRaw({ building: null, land: null });
  }, []);

  /** 매물 등록 임시 저장 복원 */
  const restoreAddressLookupDraft = useCallback((draft) => {
    if (!draft || typeof draft !== 'object') return;
    if (draft.addressKeys) setAddressKeys({ ...initialAddressKeys(), ...draft.addressKeys });
    if (draft.locationForm) setLocationForm({ ...emptyLocationForm(), ...draft.locationForm });
    if (draft.landForm) setLandForm({ ...emptyLandForm(), ...draft.landForm });
    if (draft.buildingForm) setBuildingForm({ ...emptyBuildingForm(), ...draft.buildingForm });
    if (draft.lookup) {
      setLookup((s) => ({
        ...initialLookupMeta(),
        ...draft.lookup,
        mode,
      }));
    }
  }, [mode]);

  return {
    lookup,
    addressKeys,
    locationForm,
    setLocationForm,
    landForm,
    setLandForm,
    buildingForm,
    setBuildingForm,
    apiRaw,
    handleAddressFetchSuccess,
    refetchPublicData,
    resetAddressLookup,
    restoreAddressLookupDraft,
    isLoading: lookup.status === 'loading',
  };
}
