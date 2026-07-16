/** 모바일 기기에서 "PC버전으로 보기"를 선택했는지 여부 (세션 동안 유지) */
const KEY = 'landnote.forceDesktop';

export function getForceDesktop() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setForceDesktop(on) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage 접근 불가 시 무시 */
  }
}
