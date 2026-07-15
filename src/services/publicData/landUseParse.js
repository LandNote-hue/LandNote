/**
 * 토지이용계획·건축물대장 지역지구구역에서 주용도지역(용도지역지구)만 추출
 *
 * vworld getLandUseAttr 응답은 용도지역·지구·구역·협조구역 등이 배열로 혼재한다.
 * UQA2xx = 세부 용도지역(예: 제3종일반주거지역), UNE/UDA/UQQ 등 = 지구·구역
 */

/** @param {string} code */
function isLandUseRegionCode(code) {
  const c = String(code || '').trim();
  if (!c) return false;
  if (/^UQA2[A-Z0-9]{2,}$/i.test(c)) return true;
  if (/^UQA1[A-Z0-9]{2,}$/i.test(c)) return true;
  return false;
}

/** @param {string} code */
function isNonRegionCode(code) {
  const c = String(code || '').trim();
  if (!c) return false;
  return /^UN[ED]|^UDA|^UQQ|^UBA|^UMZ|^UQS|^ZA0|^UBA/i.test(c);
}

/** @param {string} name */
function isExcludedZoneName(name) {
  const n = String(name || '').trim();
  if (!n) return true;
  return /협조구역|제한구역|권역$|과밀|재정비|지구단위|건축선|대로\d|가축|공원|유원|자연경관|고도|방화|방재|취락|특정|보호|개발제한|개발진흥|시설보|문화재|전통|자연환경|농업|산림|수변|해안|습지|수자|도시자연|정비|미관|조경|공공|녹지|택지|경관|공항|항만|철도|군사|국방|비행|소음|진동|유해물질|매립|폐기물|하천|저수|댐|하수|오수|전기|가스|통신|광역|지구$/.test(n);
}

/** @param {string} name */
function isLandUseRegionName(name) {
  const n = String(name || '').trim();
  if (!n || isExcludedZoneName(n)) return false;
  if (/^제\d+종/.test(n)) return true;
  if (/지역$/.test(n) && !/권역$/.test(n)) {
    return /주거|상업|공업|녹지|관리|농림|자연환경|유통|중심|근린|전용|일반|준|도시/.test(n);
  }
  return false;
}

/** @param {Record<string, unknown>} item */
export function isPrimaryLandUseRegionItem(item) {
  if (!item) return false;
  const name = String(item.prposAreaDstrcCodeNm ?? item.jijiguCdNm ?? '');
  const code = String(item.prposAreaDstrcCode ?? item.jijiguCd ?? '');

  if (isNonRegionCode(code)) return false;
  if (isLandUseRegionCode(code)) return true;
  return isLandUseRegionName(name);
}

/** @param {string} name */
function scoreLandUseRegionName(name) {
  const n = String(name || '').trim();
  if (/^제\d+종/.test(n)) return 100;
  if (/일반|전용|중심|근린|유통|준/.test(n) && /지역$/.test(n)) return 80;
  if (n === '도시지역') return 10;
  if (/관리지역|농림지역|자연환경보전지역/.test(n)) return 30;
  return 50;
}

/** @param {Record<string, unknown>[]} items */
function sortLandUseRegionItems(items) {
  return [...items].sort((a, b) => {
    const nameA = String(a.prposAreaDstrcCodeNm ?? a.jijiguCdNm ?? '');
    const nameB = String(b.prposAreaDstrcCodeNm ?? b.jijiguCdNm ?? '');
    const codeA = String(a.prposAreaDstrcCode ?? a.jijiguCd ?? '');
    const codeB = String(b.prposAreaDstrcCode ?? b.jijiguCd ?? '');

    const scoreDiff = scoreLandUseRegionName(nameB) - scoreLandUseRegionName(nameA);
    if (scoreDiff !== 0) return scoreDiff;

    const uqa2A = /^UQA2/i.test(codeA) ? 1 : 0;
    const uqa2B = /^UQA2/i.test(codeB) ? 1 : 0;
    if (uqa2B !== uqa2A) return uqa2B - uqa2A;

    return nameB.length - nameA.length;
  });
}

/** @param {string} name */
export function zoneNameFromItem(item) {
  if (!item) return '';
  return String(item.prposAreaDstrcCodeNm ?? item.jijiguCdNm ?? '').trim();
}

/** vworld 토지이용계획 배열 → 주용도지역 1건 */
export function pickPrimaryLandUseFromPlan(fields) {
  if (!fields?.length) return '';

  const regions = fields.filter(isPrimaryLandUseRegionItem);
  if (!regions.length) return '';

  const sorted = sortLandUseRegionItems(regions);
  return zoneNameFromItem(sorted[0]);
}

/** vworld 토지이용계획 배열 → 주용도지역 코드(UQA2xx 등) */
export function pickPrimaryLandUseCodeFromPlan(fields) {
  if (!fields?.length) return '';

  const regions = fields.filter(isPrimaryLandUseRegionItem);
  if (!regions.length) return '';

  const sorted = sortLandUseRegionItems(regions);
  return String(sorted[0]?.prposAreaDstrcCode ?? '').trim();
}

/** 토지이음 API용 ucodes — 토지이용계획 전체 코드(;) */
export function buildUcodesFromPlan(fields) {
  if (!fields?.length) return '';
  const codes = fields
    .map(f => String(f.prposAreaDstrcCode ?? '').trim())
    .filter(Boolean);
  return [...new Set(codes)].join(';');
}

/** @param {Record<string, unknown>} item */
function jijiguAsPlanItem(item) {
  return {
    prposAreaDstrcCodeNm: item.jijiguCdNm,
    prposAreaDstrcCode: item.jijiguCd,
  };
}

/** 건축물대장 지역지구구역 → 주용도지역 */
export function pickPrimaryLandUseFromJijigu(items) {
  if (!items?.length) return '';

  const isRegionJijigu = (item) => {
    const gb = String(item.jijiguGbCd ?? '');
    const gbNm = String(item.jijiguGbCdNm ?? '');
    if (gb === '2' || gb === '3') return false;
    if (/용도지구|용도구역/.test(gbNm) && !/용도지역/.test(gbNm)) return false;
    return isPrimaryLandUseRegionItem(jijiguAsPlanItem(item));
  };

  const repr = items.find(
    i => (i.reprYn === '1' || i.reprYn === 1) && isRegionJijigu(i),
  );
  if (repr) return zoneNameFromItem(repr);

  const regions = items.filter(isRegionJijigu);
  if (!regions.length) return '';

  const sorted = sortLandUseRegionItems(regions.map(jijiguAsPlanItem));
  return zoneNameFromItem(sorted[0]);
}

/** 주용도지역명과 일치하는 토지이용계획 항목의 면적(㎡) */
export function pickLandAreaFromPlan(fields, primaryZone) {
  if (!fields?.length || !primaryZone) return '';

  const match = fields.find(f => zoneNameFromItem(f) === primaryZone);
  if (!match) return '';

  const area = match.lndpclAr ?? match.area ?? match.ar ?? match.platArea;
  if (area == null || area === '') return '';
  const n = parseFloat(String(area).replace(/,/g, ''));
  if (Number.isNaN(n) || n === 0) return '';
  return String(n);
}
