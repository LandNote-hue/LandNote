/**
 * 행정안전부 도로명주소 팝업 API
 * @see https://www.juso.go.kr/addrlink/devAddrLinkRequestWrite.do?menu=menu2
 */

import { padLotNumber } from './parseJibunAddress.js';

/** @typedef {import('./parseJibunAddress.js').AddressSearchResult} AddressSearchResult */

const POPUP_OPTS='width=570,height=420,scrollbars=yes,resizable=yes';

function getPopupKey(mobile = false) {
  const key = (mobile
    ? (import.meta.env.VITE_JUSO_POPUP_MOBILE_KEY || import.meta.env.VITE_JUSO_MOBILE_KEY)
    : (import.meta.env.VITE_JUSO_POPUP_KEY || import.meta.env.VITE_JUSO_CONFIRM_KEY))?.trim();
  if (!key) {
    throw new Error(
      'juso 팝업 API 승인키가 없습니다. .env.local의 VITE_JUSO_POPUP_KEY(또는 VITE_JUSO_CONFIRM_KEY)를 확인하세요.',
    );
  }
  return key;
}

/** juso 샘플: confmKey는 URL 인코딩하지 않음(끝 = 패딩 유지). returnUrl만 인코딩 */
export function hasJusoPopupKey(mobile = false) {
  try {
    getPopupKey(mobile);
    return true;
  } catch {
    return false;
  }
}

/**
 * juso 팝업 콜백 인자 → AddressSearchResult
 * @param {string[]} args popCallBack / jusoCallBack 인자 목록
 */
export function mapJusoCallbackArgs(args) {
  const roadFullAddr = args[0];
  const jibunAddr = args[5];
  const admCd = args[7];
  const mtYn = args[21];
  const lnbrMnnm = args[22];
  const lnbrSlno = args[23];

  const hasBun = lnbrMnnm !== undefined && lnbrMnnm !== null && String(lnbrMnnm).trim() !== '';
  const hasJi = lnbrSlno !== undefined && lnbrSlno !== null && String(lnbrSlno).trim() !== '';

  return {
    roadAddr: roadFullAddr || '',
    jibunAddr: jibunAddr || '',
    admCd: admCd || '',
    platGbCd: mtYn === '1' ? '1' : '0',
    bun: hasBun ? padLotNumber(lnbrMnnm) : undefined,
    ji: hasJi ? padLotNumber(lnbrSlno) : undefined,
  };
}

/**
 * 도로명주소 검색 팝업
 * @param {(result: AddressSearchResult) => void|Promise<void>} onSelect
 * @param {{ mobile?: boolean }} [opts]
 */
export function openJusoAddressPopup(onSelect, opts = {}) {
  openJusoPopup(onSelect, {
    ...opts,
    popupPath: 'addrLinkUrl.do',
    popupName: 'jusoRoadPopup',
  });
}

/**
 * 지번주소 검색 팝업
 * @param {(result: AddressSearchResult) => void|Promise<void>} onSelect
 * @param {{ mobile?: boolean }} [opts]
 */
export function openJusoJibunAddressPopup(onSelect, opts = {}) {
  openJusoPopup(onSelect, {
    ...opts,
    popupPath: 'jibunAddrLinkUrl.do',
    popupName: 'jusoJibunPopup',
  });
}

/**
 * @param {(result: AddressSearchResult) => void|Promise<void>} onSelect
 * @param {{ mobile?: boolean, popupPath: string, popupName: string }} opts
 */
function openJusoPopup(onSelect, opts) {
  const confmKey = getPopupKey(opts.mobile);
  const returnUrl = encodeURIComponent(`${window.location.origin}/juso-return.html`);

  const handler = (...args) => {
    delete window.jusoCallBack;
    delete window.popCallBack;
    const result = mapJusoCallbackArgs(args);
    Promise.resolve(onSelect(result)).catch(err => {
      console.error('[juso]', err);
    });
  };

  window.jusoCallBack = handler;
  window.popCallBack = handler;

  const url = `https://business.juso.go.kr/addrlink/${opts.popupPath}?confmKey=${confmKey}&returnUrl=${returnUrl}&resultType=4`;
  const pop = window.open(url, opts.popupName, POPUP_OPTS);
  if (!pop) {
    throw new Error('주소 팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도하세요.');
  }
}
