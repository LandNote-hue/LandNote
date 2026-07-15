/**
 * 공공데이터 API 응답 → 매물 등록 폼 필드 매핑
 *
 * 용도지역: prposArea1Nm → 토지이용계획(용도지역만) → 건축물대장 지역지구구역
 * 건폐율·용적률: 총괄표제부 우선(0% 제외) → 표제부 → 토지이음 조례
 */

import { fmtNum } from '../../utils/formatMoney.js';
import {
  applyMeaningfulPatch,
  formatArea,
  formatCount,
  formatPercentNonZero,
  formatUseAprDay,
  mergeFormFields,
  pickBestBuildingItem,
  pickFirst,
  pickPrimaryLandUseZone,
  sumElevatorCounts,
  sumParkingCounts,
} from './formValueUtils.js';
import {
  pickLandAreaFromPlan,
  pickPrimaryLandUseFromJijigu,
  pickPrimaryLandUseFromPlan,
} from './landUseParse.js';
import {
  pickBestIndvdLandPrice,
  pickBestLandCharacteristic,
} from '../vworld/vworldFieldPick.js';

export const emptyLandForm = () => ({
  landAreaM2: '',
  landUseZone: '',
  landCategory: '',
  officialPriceM2: '',
  officialPriceYear: '',
});

export const emptyBuildingForm = () => ({
  grossFloorAreaM2: '',
  vlRatEstmTotAreaM2: '',
  archAreaM2: '',
  bcRat: '',
  vlRat: '',
  grndFlrCnt: '',
  ugrndFlrCnt: '',
  parkingCnt: '',
  elevatorCnt: '',
  strctCdNm: '',
  mainPurpsCdNm: '',
  useAprDay: '',
});

export const emptyLocationForm = () => ({
  roadAddr: '',
  jibunAddr: '',
  ownerTel: '',
  roadInfo: '',
});

/** @param {Record<string, unknown>|null|undefined} item 건축물대장 1건 (표제부·총괄표제부) */
export function mapBuildingRecordToForm(item) {
  if (!item) return emptyBuildingForm();

  return {
    grossFloorAreaM2: formatArea(pickFirst(item.totArea, item.totarea, item.grossFloorArea)),
    vlRatEstmTotAreaM2: formatArea(pickFirst(item.vlRatEstmTotArea, item.vlRatEstmTotAreaM2)),
    archAreaM2: formatArea(pickFirst(item.archArea, item.archAreaM2)),
    bcRat: formatPercentNonZero(pickFirst(item.bcRat, item.bcRatCalc)),
    vlRat: formatPercentNonZero(pickFirst(item.vlRat, item.vlRatCalc)),
    grndFlrCnt: formatCount(item.grndFlrCnt),
    ugrndFlrCnt: formatCount(item.ugrndFlrCnt),
    parkingCnt: sumParkingCounts(item),
    elevatorCnt: sumElevatorCounts(item),
    strctCdNm: pickFirst(item.strctCdNm, item.strctCd, item.etcStrct),
    mainPurpsCdNm: pickFirst(item.mainPurpsCdNm, item.mainPurpsCd, item.etcPurps),
    useAprDay: formatUseAprDay(pickFirst(item.useAprDay, item.useConfDay)),
  };
}

/** 건축물대장 대지면적 → 토지면적 보조 (0 제외) */
export function mapBuildingPlatAreaToLand(item) {
  if (!item) return {};
  return { landAreaM2: formatArea(pickFirst(item.platArea, item.platAreaM2, item.ldArea)) };
}

/** @param {Record<string, unknown>|null|undefined} item vworld 토지특성 (지목·면적·용도지역) */
export function mapVworldCharacteristicsToForm(item) {
  if (!item) return {};
  return {
    landAreaM2: formatArea(pickFirst(item.lndpclAr, item.lndPclAr, item.lndpclArIndict)),
    landCategory: pickFirst(item.lndcgrCodeNm, item.jimok, item.lndcgrCode),
    landUseZone: pickPrimaryLandUseZone(item),
  };
}

/** @param {Record<string, unknown>|null|undefined} item vworld 개별공시지가 */
export function mapVworldPriceToForm(item) {
  if (!item) return {};
  return {
    officialPriceM2: fmtNum(pickFirst(item.pblntfPclnd, item.indvdLandPrice)),
    officialPriceYear: pickFirst(item.stdrYear, item.stdrMt),
  };
}

/** @param {Record<string, unknown>|null|undefined} item NSDI 토지특성 */
export function mapLandCharToForm(item) {
  if (!item) return emptyLandForm();
  return {
    landAreaM2: formatArea(pickFirst(item.lndpclAr, item.lndPclAr)),
    landCategory: pickFirst(item.lndcgrCodeNm, item.jimok, item.lndcgrCode),
    landUseZone: pickPrimaryLandUseZone(item),
    officialPriceM2: fmtNum(pickFirst(item.pblntfPclnd, item.indvdLandPrice)),
    officialPriceYear: pickFirst(item.stdrYear, item.lastUpdtDt?.slice?.(0, 4)),
  };
}

/** 표제부·총괄표제부 병합 — 표제부 우선, 비어 있으면 총괄표제부 보충 */
function mergeBuildingForms(titleItem, recapItem) {
  const titleForm = mapBuildingRecordToForm(titleItem);
  const recapForm = mapBuildingRecordToForm(recapItem);
  const merged = mergeFormFields(emptyBuildingForm(), titleForm, recapForm);

  merged.bcRat = pickFirst(recapForm.bcRat, titleForm.bcRat);
  merged.vlRat = pickFirst(recapForm.vlRat, titleForm.vlRat);

  const titlePark = parseInt(titleForm.parkingCnt, 10);
  const recapPark = parseInt(recapForm.parkingCnt, 10);
  if (!Number.isNaN(recapPark) && (Number.isNaN(titlePark) || recapPark > titlePark)) {
    merged.parkingCnt = String(recapPark);
  }

  return merged;
}

function resolveLandUseZone(charItem, useFields, jijiguItems) {
  return pickFirst(
    pickPrimaryLandUseZone(charItem),
    pickPrimaryLandUseFromPlan(useFields),
    pickPrimaryLandUseFromJijigu(jijiguItems),
  );
}

/** @param {import('./buildingLedger.js').fetchAllBuildingLedger extends (...args:any)=>Promise<infer R> ? R : never} building */
/** @param {{ vworld?: ..., regulation?: { bcRat?: string, vlRat?: string } }} landBundle */
export function mapPublicDataToPropertyForm(building, landBundle) {
  const titleItem = pickBestBuildingItem(building.title?.items ?? []);
  const recapItem = pickBestBuildingItem(building.recap?.items ?? []);
  const jijiguItems = building.jijigu?.items ?? [];

  const buildingForm = mergeBuildingForms(titleItem, recapItem);

  const regulation = landBundle?.regulation;
  if (regulation) {
    if (!buildingForm.bcRat && regulation.bcRat) buildingForm.bcRat = regulation.bcRat;
    if (!buildingForm.vlRat && regulation.vlRat) buildingForm.vlRat = regulation.vlRat;
  }

  const vw = landBundle?.vworld;
  let landForm = emptyLandForm();

  if (vw) {
    const charFields = vw.characteristics?.fields?.length
      ? vw.characteristics.fields
      : (vw.characteristics?.item ? [vw.characteristics.item] : []);
    const charItem = pickBestLandCharacteristic(charFields)
      ?? vw.characteristics?.item;

    const priceFields = vw.price?.fields?.length
      ? vw.price.fields
      : (vw.price?.item ? [vw.price.item] : []);
    const priceItem = pickBestIndvdLandPrice(priceFields)
      ?? vw.price?.item;

    const useFields = vw.landUse?.fields?.length
      ? vw.landUse.fields
      : (vw.landUse?.item ? [vw.landUse.item] : []);

    landForm = mergeFormFields(
      emptyLandForm(),
      mapBuildingPlatAreaToLand(recapItem),
      mapBuildingPlatAreaToLand(titleItem),
      mapVworldCharacteristicsToForm(charItem),
    );
    landForm = applyMeaningfulPatch(landForm, mapVworldPriceToForm(priceItem));

    const primaryZone = resolveLandUseZone(charItem, useFields, jijiguItems);
    landForm.landUseZone = primaryZone;

    if (!landForm.landAreaM2 && primaryZone) {
      landForm.landAreaM2 = pickLandAreaFromPlan(useFields, primaryZone);
    }

    landForm.officialPriceYear = pickFirst(
      priceItem?.stdrYear,
      landForm.officialPriceYear,
      vw.stdrYear,
    );
  } else {
    const landCharItem = landBundle?.landChar?.items?.[0];
    landForm = mergeFormFields(
      emptyLandForm(),
      mapBuildingPlatAreaToLand(recapItem),
      mapBuildingPlatAreaToLand(titleItem),
      mapLandCharToForm(landCharItem),
    );
    if (!landForm.landUseZone) {
      landForm.landUseZone = pickPrimaryLandUseFromJijigu(jijiguItems);
    }
  }

  return { landForm, buildingForm };
}

export { applyMeaningfulPatch };
