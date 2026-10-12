import { useCallback, useRef, useState } from 'react';
import { toPublicDataQuery } from '../services/address/parseJibunAddress.js';
import { isUsablePnu } from '../services/address/buildPnu.js';
import { fetchAllBuildingLedger } from '../services/publicData/buildingLedger.js';
import { fetchVworldLandBundle } from '../services/vworld/landData.js';
import { fetchParcelLandForm } from '../services/publicData/fetchParcelLandForm.js';
import { fetchRegulationForPrimaryZone } from '../services/eum/landUseRegulation.js';
import {
  emptyBuildingForm,
  emptyLandForm,
  emptyLocationForm,
  mapPublicDataToPropertyForm,
  applyMeaningfulPatch,
} from '../services/publicData/mapToPropertyForm.js';
import { parcelIdentityKey, normalizeExtraParcels } from '../utils/propertyParcels.js';
import { keysFromAddressData } from '../utils/addressLookupKeys.js';
import { classifyParcelChange, shouldCommitLookupResult, lookupFailureFormPolicy } from '../utils/addressLookupSession.js';
import { hydrateEditLandFromProperty } from '../utils/propEditAddressState.js';

/** @typedef {'idle'|'address_confirmed'|'loading'|'success'|'error'|'unverified'} LookupStatus */

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

const PUBLIC_DATA_RETRY_ATTEMPTS = 3;
const PUBLIC_DATA_RETRY_DELAY_MS = 800;
const LOOKUP_FAIL_ALERT = '대장·토지 정보 조회에 실패했습니다. 주소 검색 또는 재조회로 다시 조회해 주세요.';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @template T @param {() => Promise<T>} run @param {number} attempts */
async function withRetries(run, attempts = PUBLIC_DATA_RETRY_ATTEMPTS) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(PUBLIC_DATA_RETRY_DELAY_MS * (i + 1));
    }
  }
  throw lastErr;
}

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
  const [extraParcels, setExtraParcels] = useState(() => []);
  const lookupGenRef = useRef(0);
  const activeIdentRef = useRef('');

  /**
   * [주소 조회] 완료 콜백 — juso/카카오 등 주소 검색 UI에서 호출
   * @param {import('../services/address/parseJibunAddress.js').AddressSearchResult} addressData
   */
  const handleAddressFetchSuccess = useCallback(async (addressData) => {
    const { keys, normalized } = keysFromAddressData(addressData);
    const { parcelChanged, sameParcel, next: ident } = classifyParcelChange(addressKeys, keys);
    lookupGenRef.current += 1;
    const gen = lookupGenRef.current;
    activeIdentRef.current = ident;

    setLookup((s) => ({ ...s, status: 'loading', error: null, mode, parcelChanged }));

    setAddressKeys(keys);
    setLocationForm((prev) => ({
      ...prev,
      roadAddr: normalized.roadAddr,
      jibunAddr: normalized.jibunAddr,
    }));
    if (ident) {
      setExtraParcels((prev) => prev.filter((p) => parcelIdentityKey(p.addressKeys) !== ident));
    }
    if (parcelChanged) {
      setLandForm(emptyLandForm());
      setBuildingForm(emptyBuildingForm());
      setApiRaw({ building: null, land: null });
    }

    try {
      if (!keys.sigunguCd || !keys.bjdongCd) {
        if (!shouldCommitLookupResult(lookupGenRef.current, gen, activeIdentRef.current, ident)) {
          return { keys, skippedApi: true, stale: true };
        }
        setLookup((s) => ({
          ...s,
          status: parcelChanged ? 'unverified' : 'address_confirmed',
          warnings: normalized.warnings,
          fetchedAt: new Date().toISOString(),
          parcelChanged,
        }));
        return { keys, building: null, land: null, skippedApi: true };
      }

      const queryKeys = toPublicDataQuery(keys);
      const pnu = keys.pnu;
      const stdrYear = String(new Date().getFullYear());

      const { building, vworld, regulation } = await withRetries(async () => {
        const [nextBuilding, nextVworld] = await Promise.all([
          fetchAllBuildingLedger(queryKeys, { includeExpos, dongNm, hoNm }),
          fetchVworldLandBundle(pnu, stdrYear),
        ]);
        const useFields = nextVworld.landUse?.fields?.length
          ? nextVworld.landUse.fields
          : (nextVworld.landUse?.item ? [nextVworld.landUse.item] : []);
        const nextRegulation = await fetchRegulationForPrimaryZone(pnu, useFields);
        return { building: nextBuilding, vworld: nextVworld, regulation: nextRegulation };
      });

      if (!shouldCommitLookupResult(lookupGenRef.current, gen, activeIdentRef.current, ident)) {
        return { keys: queryKeys, stale: true };
      }

      setApiRaw({ building, land: { vworld, regulation } });

      const { landForm: nextLand, buildingForm: nextBuilding } = mapPublicDataToPropertyForm(
        building,
        { vworld, regulation },
      );

      if (parcelChanged || !sameParcel) {
        setLandForm({ ...emptyLandForm(), ...nextLand });
        setBuildingForm({ ...emptyBuildingForm(), ...nextBuilding });
      } else {
        setLandForm((prev) => applyMeaningfulPatch(prev, nextLand));
        setBuildingForm((prev) => applyMeaningfulPatch(prev, nextBuilding));
      }

      setLookup({
        status: 'success',
        error: null,
        warnings: normalized.warnings,
        fetchedAt: new Date().toISOString(),
        mode,
        parcelChanged: false,
      });

      return { keys: queryKeys, pnu, building, vworld, regulation, skippedApi: false };
    } catch (err) {
      if (!shouldCommitLookupResult(lookupGenRef.current, gen, activeIdentRef.current, ident)) {
        return { keys: addressData, stale: true, ok: false };
      }
      const message = err instanceof Error ? err.message : '공공데이터 조회 실패';
      const policy = lookupFailureFormPolicy(parcelChanged);
      if (policy.clearLandBuilding) {
        setLandForm(emptyLandForm());
        setBuildingForm(emptyBuildingForm());
      }
      setLookup((s) => ({
        ...s,
        status: policy.status,
        error: message,
        parcelChanged: policy.parcelChanged,
      }));
      window.alert(LOOKUP_FAIL_ALERT);
      return { keys: addressData, skippedApi: false, error: message, ok: false };
    }
  }, [mode, includeExpos, dongNm, hoNm, addressKeys]);

  /** [재조회] — 대표 필지 + 추가 필지 */
  const refetchPublicData = useCallback(async () => {
    if (addressKeys.sigunguCd || addressKeys.jibunAddr) {
      await handleAddressFetchSuccess({
        ...addressKeys,
        roadAddr: locationForm.roadAddr,
        jibunAddr: addressKeys.jibunAddr,
        admCd: addressKeys.sigunguCd + addressKeys.bjdongCd,
      });
    }
    const extras = extraParcels.filter((p) => p.addressKeys);
    await Promise.all(extras.map(async (p) => {
      try {
        const landFormNext = await fetchParcelLandForm(p.addressKeys);
        setExtraParcels((prev) => prev.map((row) => (
          row.id === p.id ? { ...row, landForm: landFormNext, status: 'success', error: null } : row
        )));
      } catch (err) {
        const message = err instanceof Error ? err.message : '토지정보 조회 실패';
        setExtraParcels((prev) => prev.map((row) => (
          row.id === p.id ? { ...row, status: 'error', error: message } : row
        )));
      }
    }));
  }, [addressKeys, locationForm.roadAddr, handleAddressFetchSuccess, extraParcels]);

  const addExtraParcelFromAddress = useCallback(async (addressData) => {
    const { keys, normalized } = keysFromAddressData(addressData);
    const ident = parcelIdentityKey(keys);
    const primaryIdent = parcelIdentityKey(addressKeys)
      || parcelIdentityKey({ jibunAddr: locationForm.jibunAddr, pnu: addressKeys.pnu });
    if (ident && primaryIdent && ident === primaryIdent) {
      window.alert('대표 필지와 같은 주소입니다.');
      return null;
    }
    if (ident && extraParcels.some((p) => parcelIdentityKey(p.addressKeys) === ident)) {
      window.alert('이미 추가된 필지입니다.');
      return null;
    }

    const id = keys.pnu || `extra-${Date.now()}`;
    const row = {
      id,
      jibunAddr: normalized.jibunAddr,
      roadAddr: normalized.roadAddr,
      addressKeys: keys,
      landForm: emptyLandForm(),
      status: 'loading',
      error: null,
    };
    setExtraParcels((prev) => [...prev, row]);

    if (!isUsablePnu(keys.pnu)) {
      setExtraParcels((prev) => prev.map((p) => (
        p.id === id
          ? { ...p, status: 'error', error: '필지번호를 확인하지 못했습니다. 지번으로 다시 검색해 주세요.' }
          : p
      )));
      window.alert('추가 필지 주소를 지번으로 다시 선택해 주세요.');
      return row;
    }

    try {
      const landFormNext = await fetchParcelLandForm(keys);
      const done = { ...row, landForm: landFormNext, status: 'success', error: null };
      setExtraParcels((prev) => prev.map((p) => (p.id === id ? done : p)));
      return done;
    } catch (err) {
      const message = err instanceof Error ? err.message : '토지정보 조회 실패';
      setExtraParcels((prev) => prev.map((p) => (
        p.id === id ? { ...p, status: 'error', error: message } : p
      )));
      window.alert(message);
      return null;
    }
  }, [addressKeys, extraParcels, locationForm.jibunAddr]);

  const removeExtraParcel = useCallback((id) => {
    setExtraParcels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateExtraParcelLand = useCallback((id, patchOrFn) => {
    setExtraParcels((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const next = typeof patchOrFn === 'function'
        ? patchOrFn(p.landForm)
        : { ...p.landForm, ...patchOrFn };
      return { ...p, landForm: next };
    }));
  }, []);

  const refetchExtraParcel = useCallback(async (id) => {
    const target = extraParcels.find((p) => p.id === id);
    if (!target?.addressKeys) return;
    setExtraParcels((prev) => prev.map((p) => (
      p.id === id ? { ...p, status: 'loading', error: null } : p
    )));
    try {
      const landFormNext = await fetchParcelLandForm(target.addressKeys);
      setExtraParcels((prev) => prev.map((p) => (
        p.id === id ? { ...p, landForm: landFormNext, status: 'success', error: null } : p
      )));
    } catch (err) {
      const message = err instanceof Error ? err.message : '토지정보 조회 실패';
      setExtraParcels((prev) => prev.map((p) => (
        p.id === id ? { ...p, status: 'error', error: message } : p
      )));
      window.alert(message);
    }
  }, [extraParcels]);

  const restoreExtraParcels = useCallback((raw) => {
    setExtraParcels(normalizeExtraParcels(raw));
  }, []);

  const resetAddressLookup = useCallback(() => {
    setLookup(initialLookupMeta());
    setAddressKeys(initialAddressKeys());
    setLocationForm(emptyLocationForm());
    setLandForm(emptyLandForm());
    setBuildingForm(emptyBuildingForm());
    setApiRaw({ building: null, land: null });
    setExtraParcels([]);
  }, []);

  /** 매물 등록 임시 저장 복원 */
  const restoreAddressLookupDraft = useCallback((draft) => {
    if (!draft || typeof draft !== 'object') return;
    lookupGenRef.current += 1;
    if (draft.addressKeys) {
      const keys = { ...initialAddressKeys(), ...draft.addressKeys };
      setAddressKeys(keys);
      activeIdentRef.current = parcelIdentityKey(keys);
    }
    if (draft.locationForm) setLocationForm({ ...emptyLocationForm(), ...draft.locationForm });
    if (draft.landForm) setLandForm({ ...emptyLandForm(), ...draft.landForm });
    if (draft.buildingForm) setBuildingForm({ ...emptyBuildingForm(), ...draft.buildingForm });
    if (draft.extraParcels) setExtraParcels(normalizeExtraParcels(draft.extraParcels));
    if (draft.lookup) {
      setLookup((s) => ({
        ...initialLookupMeta(),
        ...draft.lookup,
        mode,
        parcelChanged: false,
      }));
    }
  }, [mode]);

  const hydrateFromExistingProperty = useCallback((prop) => {
    const h = hydrateEditLandFromProperty(prop);
    restoreAddressLookupDraft({
      addressKeys: h.addressKeys,
      lookup: h.lookup,
      landForm: h.landEdit,
      buildingForm: h.buildingEdit,
      extraParcels: prop?.extraParcels,
      locationForm: {
        jibunAddr: h.addressKeys.jibunAddr,
        roadAddr: h.addressKeys.roadAddr,
      },
    });
    return h;
  }, [restoreAddressLookupDraft]);

  const extraParcelLoading = extraParcels.some((p) => p.status === 'loading');

  return {
    lookup,
    addressKeys,
    locationForm,
    setLocationForm,
    landForm,
    setLandForm,
    buildingForm,
    setBuildingForm,
    extraParcels,
    addExtraParcelFromAddress,
    removeExtraParcel,
    updateExtraParcelLand,
    restoreExtraParcels,
    refetchExtraParcel,
    extraParcelLoading,
    apiRaw,
    handleAddressFetchSuccess,
    refetchPublicData,
    resetAddressLookup,
    restoreAddressLookupDraft,
    hydrateFromExistingProperty,
    isLoading: lookup.status === 'loading',
  };
}
