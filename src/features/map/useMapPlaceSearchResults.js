import { useEffect, useRef, useState } from 'react';
import { loadKakaoMaps, searchMapLocations } from '../../services/kakao/kakaoMaps.js';

/**
 * 입력된 쿼리로 카카오맵 장소·주소·지하철역을 디바운스 검색한다.
 * (지하철역은 별도 API 없이 카카오 키워드 검색(장소) 결과에 포함된다)
 * @param {string} query
 * @param {{ debounceMs?: number }} [opts]
 * @returns {{ results: import('../../services/kakao/kakaoMaps.js').MapSearchResult[], loading: boolean }}
 */
export function useMapPlaceSearchResults(query, opts = {}) {
  const { debounceMs = 320 } = opts;
  const [results, setResults] = useState(/** @type {import('../../services/kakao/kakaoMaps.js').MapSearchResult[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      reqIdRef.current += 1;
      setResults([]);
      setLoading(false);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      const reqId = (reqIdRef.current += 1);
      setLoading(true);
      try {
        const kakao = await loadKakaoMaps(['services']);
        const found = await searchMapLocations(kakao, q);
        if (reqIdRef.current === reqId) setResults(found);
      } catch {
        if (reqIdRef.current === reqId) setResults([]);
      } finally {
        if (reqIdRef.current === reqId) setLoading(false);
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, debounceMs]);

  return { results, loading };
}
