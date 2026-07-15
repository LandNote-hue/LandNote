/**
 * 토지이음(eum.go.kr) — 건폐율·용적률(조례) 조회
 * luLandDetUseGYAjax.jsp HTML에서 gun_basic, yong_basic hidden 값 파싱
 */

import { eumClient } from './eumClient.js';
import {
  buildUcodesFromPlan,
  pickPrimaryLandUseCodeFromPlan,
} from '../publicData/landUseParse.js';

const GY_PATH = '/web/ar/lu/luLandDetUseGYAjax.jsp';

function parseForZoneCode(html, zoneCode) {
  if (!html || !zoneCode) return { bcRat: '', vlRat: '' };

  const bcRe = new RegExp(
    `name=["']gun_basic_${zoneCode}["'][^>]*value=["']\\s*(\\d+)`,
    'i',
  );
  const vlRe = new RegExp(
    `name=["']yong_basic_${zoneCode}["'][^>]*value=["']\\s*(\\d+)`,
    'i',
  );

  const bcMatch = html.match(bcRe);
  const vlMatch = html.match(vlRe);

  return {
    bcRat: bcMatch?.[1]?.trim() ?? '',
    vlRat: vlMatch?.[1]?.trim() ?? '',
  };
}

/**
 * @param {string} html
 * @param {string} zoneCode e.g. UQA122
 */
export function parseEumRegulationHtml(html, zoneCode) {
  if (!html) return { bcRat: '', vlRat: '' };

  const direct = parseForZoneCode(html, zoneCode);
  if (direct.bcRat || direct.vlRat) return direct;

  const carUcode = html.match(/name=["']car_ucode["'][^>]*value=["']([^"']+)["']/i)?.[1]?.trim();
  if (carUcode && carUcode !== zoneCode) {
    const fromCar = parseForZoneCode(html, carUcode);
    if (fromCar.bcRat || fromCar.vlRat) return fromCar;
  }

  const anyCode = html.match(/name=["']gun_basic_([^"']+)["']/i)?.[1]?.trim();
  if (anyCode) return parseForZoneCode(html, anyCode);

  return { bcRat: '', vlRat: '' };
}

/**
 * @param {string} pnu 19자리
 * @param {string} ucodes 세미콜론 구분 (UQA122;UQQ300;...)
 * @param {string} [sigunguCd] PNU 앞 5자리
 */
export async function fetchEumLandUseRegulation(pnu, ucodes, sigunguCd) {
  if (!pnu || !ucodes) {
    return { raw: '', bcRat: '', vlRat: '', zoneCode: '' };
  }

  const sggcd = sigunguCd || pnu.slice(0, 5);
  const { data: html } = await eumClient.get(GY_PATH, {
    params: {
      ucodes,
      sggcd,
      pnu,
      carGbn: 'GY',
    },
  });

  return { raw: html, bcRat: '', vlRat: '', zoneCode: '' };
}

/**
 * vworld 토지이용계획 + 주용도지역 → 조례 건폐율·용적률
 * @param {string} pnu
 * @param {Record<string, unknown>[]} useFields
 */
export async function fetchRegulationForPrimaryZone(pnu, useFields) {
  const ucodes = buildUcodesFromPlan(useFields);
  const zoneCode = pickPrimaryLandUseCodeFromPlan(useFields);

  if (!ucodes || !zoneCode) {
    return { bcRat: '', vlRat: '', zoneCode: '', ucodes: '' };
  }

  try {
    const result = await fetchEumLandUseRegulation(pnu, ucodes);
    const parsed = parseEumRegulationHtml(result.raw, zoneCode);
    return { ...parsed, zoneCode, ucodes };
  } catch (err) {
    console.warn('[eum] 건폐율·용적률 조회 실패:', err?.message || err);
    return { bcRat: '', vlRat: '', zoneCode, ucodes };
  }
}
