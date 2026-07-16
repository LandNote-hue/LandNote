/**
 * 기기(User-Agent) 기준 모바일 판별 — PC 창 폭 축소는 모바일로 취급하지 않음
 * (뷰포트 기준 반응형은 useIsMobile 참고, 용도가 다름)
 */
import { Capacitor } from '@capacitor/core';

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i;

/** @param {string} [ua] */
export function isMobileUA(ua) {
  const s = ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  return MOBILE_UA.test(s);
}

export function useIsMobileDevice() {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() || isMobileUA(navigator.userAgent);
}
