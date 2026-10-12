import { useEffect, useState } from 'react';
import { getNaverMapClientId, loadNaverMaps } from '../services/naver/naverMaps.js';

/**
 * 네이버 지도 JS API v3 로드 훅.
 * @param {{ panorama?: boolean, enabled?: boolean }} [opts]
 * @returns {{
 *   naver: typeof window.naver | null,
 *   status: 'idle' | 'no-key' | 'loading' | 'ready' | 'error',
 *   error: string,
 * }}
 */
export function useNaverMaps(opts = {}) {
  const { panorama = false, enabled = true } = opts;
  const [naver, setNaver] = useState(/** @type {typeof window.naver | null} */ (null));
  const [status, setStatus] = useState(/** @type {'idle' | 'no-key' | 'loading' | 'ready' | 'error'} */ (
    enabled ? 'loading' : 'idle'
  ));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return undefined;
    }
    if (!getNaverMapClientId()) {
      setStatus('no-key');
      setNaver(null);
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');
    setError('');

    loadNaverMaps({ panorama })
      .then((ns) => {
        if (cancelled) return;
        setNaver(ns);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setNaver(null);
        setStatus('error');
        setError(err instanceof Error ? err.message : '네이버 지도를 불러오지 못했습니다.');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, panorama]);

  return { naver, status, error };
}
