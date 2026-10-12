/** @param {object} target @param {string} type @param {(...args: unknown[]) => void} handler */
export function addMapListener(target, type, handler) {
  const Event = window.naver?.maps?.Event;
  if (!Event || !target) return null;
  return Event.addListener(target, type, handler);
}

/** @param {unknown} listener */
export function removeMapListener(listener) {
  if (!listener) return;
  try {
    window.naver?.maps?.Event?.removeListener(listener);
  } catch {
    /* ignore */
  }
}
