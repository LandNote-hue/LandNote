import { useEffect, useRef, useState } from 'react';
import { searchMapLocations } from '../../services/naver/naverMaps.js';

/**
 * 입력된 쿼리로 네이버 지도 geocoder 주소 검색을 디바운스한다.
 * @param {string} query
 * @param {{ debounceMs?: number }} [opts]
 * @returns {{ results: import('../../services/naver/naverMaps.js').MapSearchResult[], loading: boolean }}
 */
export function useMapPlaceSearchResults(query, opts = {}) {
  const { debounceMs = 320 } = opts;
  const [results, setResults] = useState(/** @type {import('../../services/naver/naverMaps.js').MapSearchResult[]} */ ([]));
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
        const found = await searchMapLocations(q);
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
