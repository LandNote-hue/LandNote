import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const MOBILE_MAX = 768;

export function useIsMobile(breakpoint = MOBILE_MAX) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint || Capacitor.isNativePlatform();
  });

  const check = useCallback(() => {
    const native = Capacitor.isNativePlatform();
    setIsMobile(native || window.innerWidth < breakpoint);
  }, [breakpoint]);

  useEffect(() => {
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [check]);

  return isMobile;
}

export { MOBILE_MAX };
