import { emptyBuildingForm, emptyLandForm } from '../services/publicData/mapToPropertyForm.js';
import { landFromPropertyPrimary, landFieldsForPropertySave, parcelIdentityKey } from './propertyParcels.js';
import { buildingFromProperty, buildingToPropertyFields } from './propertyForm.js';
import { buildPropertyAddressFields } from './propAddress.js';
import { classifyParcelChange, lookupFailureFormPolicy, shouldCommitLookupResult } from './addressLookupSession.js';

function emptyAddressKeys() {
  return {
    roadAddr: '',
    jibunAddr: '',
    sigunguCd: '',
    bjdongCd: '',
    bun: '',
    ji: '',
    platGbCd: '0',
    pnu: '',
  };
}

export function addressKeysFromProperty(prop) {
  const stored = prop?.addressKeys && typeof prop.addressKeys === 'object' ? prop.addressKeys : {};
  return {
    ...emptyAddressKeys(),
    ...stored,
    jibunAddr: stored.jibunAddr || prop?.jibunAddr || '',
    roadAddr: stored.roadAddr || prop?.roadAddr || '',
    pnu: stored.pnu || prop?.pnu || '',
    sigunguCd: stored.sigunguCd || prop?.sigunguCd || '',
    bjdongCd: stored.bjdongCd || prop?.bjdongCd || '',
    bun: stored.bun || prop?.bun || '',
    ji: stored.ji || prop?.ji || '',
  };
}

/**
 * lookup 훅의 landForm과 수정 화면 landEdit를 저장에 쓸 값으로 맞춘다.
 * 다른 필지 변경·미확인이면 훅이 비운 landForm을 쓰고, 같은 필지 재조회 실패면 기존 landEdit 유지.
 */
export function landBuildingForEditSave({
  lookup, landForm, buildingForm, landEdit, buildingEdit,
}) {
  const parcelChanged = !!lookup?.parcelChanged;
  const status = lookup?.status;
  if (status === 'unverified' || parcelChanged) {
    return {
      land: landForm || emptyLandForm(),
      building: buildingForm || emptyBuildingForm(),
      addressUnverified: status === 'unverified' || parcelChanged,
    };
  }
  if (status === 'success') {
    return { land: landEdit, building: buildingEdit, addressUnverified: false };
  }
  return { land: landEdit, building: buildingEdit, addressUnverified: false };
}

/** PropEdit useEffect와 동일한 규칙 — 테스트가 화면 저장 경로를 재현 */
export function applyLookupToLandEditState(prevLand, prevBuilding, lookup, landForm, buildingForm) {
  const status = lookup?.status;
  if (status === 'success' || status === 'unverified' || lookup?.parcelChanged) {
    return { landEdit: landForm, buildingEdit: buildingForm };
  }
  return { landEdit: prevLand, buildingEdit: prevBuilding };
}

export function hydrateEditLandFromProperty(prop) {
  return {
    addressKeys: addressKeysFromProperty(prop),
    landEdit: landFromPropertyPrimary(prop),
    buildingEdit: buildingFromProperty(prop),
    parcelKey: parcelIdentityKey(addressKeysFromProperty(prop)),
    lookup: {
      status: 'success',
      parcelChanged: false,
      error: null,
      mode: 'edit',
    },
  };
}

export function buildEditSaveLandPayload({
  lookup, landForm, buildingForm, landEdit, buildingEdit, extraParcels, addressKeys,
}) {
  const bound = landBuildingForEditSave({
    lookup, landForm, buildingForm, landEdit, buildingEdit,
  });
  return {
    ...landFieldsForPropertySave(bound.land, extraParcels, addressKeys),
    ...buildingToPropertyFields(bound.building),
    addressLookupStatus: lookup?.status || null,
    addressUnverified: bound.addressUnverified,
    addressParcelKey: parcelIdentityKey(addressKeys),
  };
}

/** PropEdit handleSave와 동일한 주소·토지·건물 저장 페이로드 */
export function simulatePropEditHandleSave({
  lookup, landForm, buildingForm, landEdit, buildingEdit, extraParcels, addressKeys, locationForm,
}) {
  return {
    ...buildPropertyAddressFields({
      jibunAddr: locationForm?.jibunAddr,
      roadAddr: locationForm?.roadAddr,
    }),
    ...buildEditSaveLandPayload({
      lookup, landForm, buildingForm, landEdit, buildingEdit, extraParcels, addressKeys,
    }),
  };
}

/**
 * 수정 화면: 조회 훅 결과를 landEdit에 반영. 늦은 응답은 커밋하지 않음.
 */
export function applyCommittedLookupToEdit(state, lookupTick) {
  const {
    lookup, landForm, buildingForm, gen, ident, activeGen, activeIdent,
  } = lookupTick;
  if (!shouldCommitLookupResult(activeGen, gen, activeIdent, ident)) {
    return state;
  }
  const next = applyLookupToLandEditState(
    state.landEdit,
    state.buildingEdit,
    lookup,
    landForm,
    buildingForm,
  );
  return {
    ...state,
    lookup,
    landForm,
    buildingForm,
    landEdit: next.landEdit,
    buildingEdit: next.buildingEdit,
    addressKeys: lookupTick.addressKeys || state.addressKeys,
    locationForm: lookupTick.locationForm || state.locationForm,
  };
}

/** PropEdit 마운트와 동일하게 조회·토지·건물 상태를 연다. */
export function createPropEditSessionFromProperty(prop) {
  const h = hydrateEditLandFromProperty(prop);
  return {
    addressKeys: h.addressKeys,
    landEdit: h.landEdit,
    buildingEdit: h.buildingEdit,
    landForm: h.landEdit,
    buildingForm: h.buildingEdit,
    lookup: h.lookup,
    extraParcels: Array.isArray(prop?.extraParcels) ? prop.extraParcels : [],
    locationForm: {
      jibunAddr: h.addressKeys.jibunAddr || prop?.jibunAddr || '',
      roadAddr: h.addressKeys.roadAddr || prop?.roadAddr || '',
    },
    gen: 1,
    ident: h.parcelKey,
  };
}

/**
 * 주소 검색 직후 훅과 같은 로딩·필지 변경. 이어서 commitPropEditLookup / save.
 */
export function beginPropEditAddressChange(session, nextKeys, locationForm) {
  const classified = classifyParcelChange(session.addressKeys, nextKeys);
  const nextGen = (session.gen || 1) + 1;
  const landForm = classified.parcelChanged ? emptyLandForm() : session.landForm;
  const buildingForm = classified.parcelChanged ? emptyBuildingForm() : session.buildingForm;
  const lookup = {
    status: 'loading',
    parcelChanged: classified.parcelChanged,
    error: null,
    mode: 'edit',
  };
  const synced = applyLookupToLandEditState(session.landEdit, session.buildingEdit, lookup, landForm, buildingForm);
  return {
    ...session,
    addressKeys: nextKeys,
    locationForm: locationForm || session.locationForm,
    lookup,
    landForm,
    buildingForm,
    landEdit: synced.landEdit,
    buildingEdit: synced.buildingEdit,
    gen: nextGen,
    ident: classified.next,
    activeGen: nextGen,
    activeIdent: classified.next,
  };
}

export function commitPropEditLookup(session, outcome) {
  const policy = outcome.ok
    ? null
    : lookupFailureFormPolicy(!!session.lookup?.parcelChanged);
  const landForm = outcome.ok
    ? outcome.landForm
    : (policy.clearLandBuilding ? emptyLandForm() : session.landForm);
  const buildingForm = outcome.ok
    ? outcome.buildingForm
    : (policy.clearLandBuilding ? emptyBuildingForm() : session.buildingForm);
  const lookup = outcome.ok
    ? { status: 'success', parcelChanged: false, error: null, mode: 'edit', fetchedAt: 't' }
    : { status: policy.status, parcelChanged: policy.parcelChanged, error: outcome.error || 'fail', mode: 'edit' };
  return applyCommittedLookupToEdit(session, {
    lookup,
    landForm,
    buildingForm,
    gen: outcome.gen ?? session.gen,
    ident: outcome.ident ?? session.ident,
    activeGen: session.activeGen ?? session.gen,
    activeIdent: session.activeIdent ?? session.ident,
    addressKeys: session.addressKeys,
    locationForm: session.locationForm,
  });
}

export function savePropEditLikeScreen(session) {
  return simulatePropEditHandleSave(session);
}
