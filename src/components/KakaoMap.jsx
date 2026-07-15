import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  loadKakaoMaps,
  geocodeAddressVariants,
  fitMapToPoints,
  getKakaoMapJsKey,
  expandAddressVariants,
  runPool,
} from '../services/kakao/kakaoMaps.js';
import { MapSiteToolbar } from '../features/map/MapSiteToolbar.jsx';
import { MapZoomRail } from '../features/map/MapZoomRail.jsx';
import { createMapRoadviewController } from '../features/map/mapRoadview.js';
import {
  attachScreenMarkerPositionSync,
  clearPropertyLayer,
  placePropertyLayer,
  propertyLayerMatchesResolved,
  refreshScreenMarkerPositions,
  updatePropertyLayerInPlace,
} from '../features/map/mapPropertyLayer.js';

const C = {
  bdr: '#E8EAED',
  txM: '#6B7280',
  txP: '#94A3B8',
  brand: '#C8102E',
  surf2: '#F8F9FB',
};

/**
 * @typedef {{
 *   id?: string|number,
 *   address: string,
 *   fallbackAddress?: string,
 *   fallbackAddresses?: string[],
 *   lat?: number,
 *   lng?: number,
 *   title?: string,
 *   data?: unknown,
 * }} MapMarkerInput
 */

function MapPlaceholder({ height, message, sub }) {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        background: C.surf2,
        border: `1px solid ${C.bdr}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.txP} strokeWidth="1.8">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
      <div style={{ fontSize: 13, color: C.txM, fontWeight: 500 }}>{message}</div>
      {sub && <div style={{ fontSize: 12, color: C.txP, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

function markerKey(id) {
  return id == null ? '' : String(id);
}

function collectAddressQueries(item, singleFallback) {
  /** @type {string[]} */
  const queries = [];
  const seen = new Set();
  const add = (s) => {
    for (const v of expandAddressVariants(s)) {
      if (!v || seen.has(v)) continue;
      seen.add(v);
      queries.push(v);
    }
  };
  add(item.address);
  if (item.fallbackAddress) add(item.fallbackAddress);
  if (item.fallbackAddresses?.length) item.fallbackAddresses.forEach(add);
  if (singleFallback && item.id === 'single') add(singleFallback);
  return queries;
}

function clearMarkers(clustererRef, markerMapRef) {
  clustererRef.current?.clear();
  clustererRef.current = null;
  markerMapRef.current.forEach(({ marker, overlay }) => {
    try {
      if (marker) marker.setMap(null);
    } catch { /* ignore */ }
    try {
      if (overlay) overlay.setMap(null);
    } catch { /* ignore */ }
  });
  markerMapRef.current.clear();
}

function destroyMapInstance(mapRef, kakaoRef, container, zoomHandlerRef) {
  const map = mapRef.current;
  const kakao = kakaoRef.current;

  if (map && kakao?.maps?.event && zoomHandlerRef.current) {
    try {
      kakao.maps.event.removeListener(map, 'zoom_changed', zoomHandlerRef.current);
    } catch { /* ignore */ }
    zoomHandlerRef.current = null;
  }

  if (map && kakao?.maps?.MapTypeId) {
    const { MapTypeId } = kakao.maps;
    [MapTypeId.ROADVIEW, MapTypeId.TRAFFIC, MapTypeId.TERRAIN, MapTypeId.BICYCLE, MapTypeId.USE_DISTRICT]
      .filter(Boolean)
      .forEach((typeId) => {
        try { map.removeOverlayMapTypeId(typeId); } catch { /* ignore */ }
      });
  }

  mapRef.current = null;

  if (container) {
    try {
      container.replaceChildren();
    } catch {
      try { container.innerHTML = ''; } catch { /* ignore */ }
    }
  }

  if (typeof document !== 'undefined') {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
}

function placeMarkersOnMap(kakao, map, resolved, cluster, clustererRef, markerMapRef, onMarkerClick, showMarkerCards, selectedId) {
  if (!map) return;
  clearMarkers(clustererRef, markerMapRef);

  const kakaoMarkers = resolved.map((item) => {
    const isSelected = markerKey(selectedId) === markerKey(item.id);
    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(item.lat, item.lng),
      title: item.title || '',
      zIndex: showMarkerCards ? (isSelected ? 28 : 24) : (isSelected ? 20 : 10),
    });
    if (onMarkerClick) {
      kakao.maps.event.addListener(marker, 'click', () => onMarkerClick(item));
    }
    if (item.id != null) markerMapRef.current.set(markerKey(item.id), { marker, item });
    return marker;
  });

  if (cluster && !showMarkerCards && kakaoMarkers.length > 1 && typeof kakao.maps.MarkerClusterer === 'function') {
    try {
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map,
        markers: kakaoMarkers,
        gridSize: 64,
        averageCenter: true,
        minLevel: 5,
      });
      return;
    } catch {
      /* clusterer 실패 시 개별 마커로 폴백 */
    }
  }
  kakaoMarkers.forEach((m) => m.setMap(map));
}

/**
 * @param {{
 *   address?: string,
 *   fallbackAddress?: string,
 *   markers?: MapMarkerInput[],
 *   height?: number|string,
 *   level?: number,
 *   cluster?: boolean,
 *   selectedId?: string|number|null,
 *   onMarkerClick?: (item: MapMarkerInput & { lat: number, lng: number }) => void,
 *   onMapReady?: (map: unknown, kakao: typeof window.kakao) => void,
 *   onMarkersResolved?: (resolved: (MapMarkerInput & { lat: number, lng: number })[], total: number) => void,
 *   showMarkerCards?: boolean,
 *   renderMarkerCard?: (item: MapMarkerInput & { lat: number, lng: number }, selected: boolean, mode: string) => React.ReactNode,
 *   cardDisplayMode?: string,
 *   onZoomLevelChange?: (level: number) => void,
 *   onBaselineLevelChange?: (level: number) => void,
 *   onBoundsChange?: (bounds: { south: number, west: number, north: number, east: number }, resolved: (MapMarkerInput & { lat: number, lng: number })[]) => void,
 *   center?: { lat: number, lng: number },
 *   autoFitMarkers?: boolean,
 *   detailZoomLevel?: number,
 *   viewTarget?: { lat: number, lng: number, level?: number, token?: number } | null,
 *   searchFitTarget?: { points: { lat: number, lng: number }[], level?: number, token?: number } | null,
 *   placePin?: { lat: number, lng: number, title?: string } | null,
 *   showMapSiteControls?: boolean,
 *   showZoomControl?: boolean,
 *   interactive?: boolean,
 *   showWhenEmpty?: boolean,
 *   style?: React.CSSProperties,
 *   className?: string,
 * }} props
 */
export function KakaoMap({
  address,
  fallbackAddress,
  markers,
  height = '100%',
  level = 3,
  cluster = false,
  selectedId = null,
  onMarkerClick,
  onMapReady,
  onMarkersResolved,
  showMarkerCards = false,
  renderMarkerCard,
  cardDisplayMode = 'full',
  onZoomLevelChange,
  onBaselineLevelChange,
  onBoundsChange,
  center,
  autoFitMarkers = true,
  detailZoomLevel = 3,
  viewTarget = null,
  searchFitTarget = null,
  placePin = null,
  showMapSiteControls = false,
  showZoomControl = false,
  interactive = true,
  showWhenEmpty = false,
  style,
  className,
}) {
  const containerRef = useRef(null);
  const [containerNode, setContainerNode] = useState(null);
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const markerMapRef = useRef(new Map());
  const clustererRef = useRef(null);
  const placeMarkerRef = useRef(null);
  const propertyRefs = useRef([]);
  const screenLayerRef = useRef(null);
  const screenSyncCleanupRef = useRef(null);
  const roadviewContainerRef = useRef(null);
  const roadviewControllerRef = useRef(null);
  const [roadviewActive, setRoadviewActive] = useState(false);
  const resolvedRef = useRef([]);
  const fittedSignatureRef = useRef('');
  const selectedIdRef = useRef(selectedId);
  const lastPannedSelectedIdRef = useRef(null);
  const zoomHandlerRef = useRef(null);
  const geocodeRunRef = useRef(0);
  const aliveRef = useRef(true);
  const containerNodeRef = useRef(null);
  const clusterRef = useRef(cluster);
  const showMarkerCardsRef = useRef(showMarkerCards);
  const cardDisplayModeRef = useRef(cardDisplayMode);
  const initialLevelRef = useRef(level);
  const renderMarkerCardRef = useRef(renderMarkerCard);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onMapReadyRef = useRef(onMapReady);
  const onMarkersResolvedRef = useRef(onMarkersResolved);
  const onZoomLevelChangeRef = useRef(onZoomLevelChange);
  const onBaselineLevelChangeRef = useRef(onBaselineLevelChange);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const autoFitMarkersRef = useRef(autoFitMarkers);
  const detailZoomLevelRef = useRef(detailZoomLevel);
  const initialCenterRef = useRef(center);
  const useSiteControls = showMapSiteControls || showZoomControl;
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const syncMapLevel = (nextLevel) => {
    onZoomLevelChangeRef.current?.(nextLevel);
  };

  const handleRoadviewToggle = useCallback(async () => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (roadviewActive) {
      const kakao = kakaoRef.current;
      roadviewControllerRef.current?.disable();
      setRoadviewActive(false);
      if (kakao) {
        refreshScreenMarkerPositions(kakao, map, propertyRefs, screenLayerRef.current?.parentElement ?? containerRef.current);
      }
      return;
    }

    setRoadviewActive(true);
    try {
      // 초기 지도는 services만 로드 — 로드뷰 켤 때 라이브러리 추가
      const kakao = await loadKakaoMaps(['services', 'roadview']);
      kakaoRef.current = kakao;
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      if (!roadviewContainerRef.current) {
        setRoadviewActive(false);
        return;
      }
      if (!roadviewControllerRef.current) {
        roadviewControllerRef.current = createMapRoadviewController(
          kakao,
          map,
          roadviewContainerRef.current,
          {
            onLayout: () => refreshScreenMarkerPositions(
              kakao,
              map,
              propertyRefs,
              screenLayerRef.current?.parentElement ?? containerRef.current,
            ),
          },
        );
      }
      await roadviewControllerRef.current.enable();
      refreshScreenMarkerPositions(kakao, map, propertyRefs, screenLayerRef.current?.parentElement ?? containerRef.current);
    } catch (err) {
      roadviewControllerRef.current?.disable();
      setRoadviewActive(false);
      window.alert(err instanceof Error ? err.message : '로드뷰를 불러오지 못했습니다.');
    }
  }, [mapReady, roadviewActive]);

  onMarkerClickRef.current = onMarkerClick;
  onMapReadyRef.current = onMapReady;
  onMarkersResolvedRef.current = onMarkersResolved;
  onZoomLevelChangeRef.current = onZoomLevelChange;
  onBaselineLevelChangeRef.current = onBaselineLevelChange;
  onBoundsChangeRef.current = onBoundsChange;
  autoFitMarkersRef.current = autoFitMarkers;
  detailZoomLevelRef.current = detailZoomLevel;
  initialCenterRef.current = center;
  renderMarkerCardRef.current = renderMarkerCard;
  clusterRef.current = cluster;
  showMarkerCardsRef.current = showMarkerCards;
  cardDisplayModeRef.current = cardDisplayMode;
  initialLevelRef.current = level;
  selectedIdRef.current = selectedId;
  containerNodeRef.current = containerNode;

  const panToSelectedIfNeeded = (force = false) => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    const sid = selectedIdRef.current;
    if (!map || !kakao || sid == null) return;
    if (!force && lastPannedSelectedIdRef.current === sid) return;

    const entry = markerMapRef.current.get(markerKey(sid));
    const item = entry?.item ?? resolvedRef.current.find((r) => markerKey(r.id) === markerKey(sid));
    if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;

    lastPannedSelectedIdRef.current = sid;
    map.setCenter(new kakao.maps.LatLng(item.lat, item.lng));
    map.setLevel(detailZoomLevelRef.current);
    syncMapLevel(detailZoomLevelRef.current);
    refreshScreenMarkerPositions(kakao, map, propertyRefs, screenLayerRef.current?.parentElement ?? containerRef.current);
  };

  const applyResolvedMarkers = (resolved, { fit }) => {
    if (!aliveRef.current) return;
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!map || !kakao || resolved.length === 0) return;

    const showCards = showMarkerCardsRef.current && renderMarkerCardRef.current;

    clearMarkers(clustererRef, markerMapRef);

    if (showCards) {
      clearPropertyLayer(propertyRefs);
      placePropertyLayer(
        kakao,
        map,
        resolved,
        renderMarkerCardRef.current,
        selectedId,
        cardDisplayModeRef.current,
        propertyRefs,
        markerMapRef,
        (item) => onMarkerClickRef.current?.(item),
        screenLayerRef.current,
      );
    } else {
      clearPropertyLayer(propertyRefs);
      placeMarkersOnMap(
        kakao,
        map,
        resolved,
        clusterRef.current,
        clustererRef,
        markerMapRef,
        (item) => onMarkerClickRef.current?.(item),
        false,
        selectedId,
      );
    }
    if (fit && autoFitMarkersRef.current) {
      fitMapToPoints(
        kakao,
        map,
        resolved.map((r) => ({ lat: r.lat, lng: r.lng })),
        resolved.length === 1 ? 0 : 56,
      );
      if (resolved.length === 1) map.setLevel(initialLevelRef.current);
      onBaselineLevelChangeRef.current?.(map.getLevel());
      syncMapLevel(map.getLevel());
    } else if (fit) {
      onBaselineLevelChangeRef.current?.(map.getLevel());
      syncMapLevel(map.getLevel());
    }
    panToSelectedIfNeeded(false);
  };

  const markerInputs = useMemo(() => (
    markers?.length
      ? markers
      : address
        ? [{ id: 'single', address, fallbackAddress, title: address }]
        : []
  ), [markers, address, fallbackAddress]);

  const markerSignature = useMemo(
    // 좌표(lat/lng)는 시그니처에서 제외 — DB 저장 후 Dexie 반영으로 불필요 재지오코딩 방지
    () => markerInputs.map((m) => `${m.id}:${m.address}:${m.fallbackAddress ?? ''}:${(m.fallbackAddresses || []).join('+')}`).join('|'),
    [markerInputs],
  );

  /* 지도 초기화 (1회) */
  useEffect(() => {
    if (!getKakaoMapJsKey()) {
      setStatus('no-key');
      setMapReady(false);
      return;
    }
    if (!containerNode) return;
    if (markerInputs.length === 0 && !showWhenEmpty) {
      setStatus('empty');
      setMapReady(false);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMsg('');
    setMapReady(false);

    (async () => {
      try {
        // services만 먼저 로드(빠른 초기화). roadview는 툴바에서 켤 때 지연 로드
        const kakao = await loadKakaoMaps(['services']);
        if (cancelled || !containerNode) return;

        kakaoRef.current = kakao;
        const initCenter = initialCenterRef.current;
        const map = new kakao.maps.Map(containerNode, {
          center: new kakao.maps.LatLng(
            initCenter?.lat ?? 37.5665,
            initCenter?.lng ?? 126.978,
          ),
          level: initialLevelRef.current,
          draggable: interactive,
          scrollwheel: interactive,
          disableDoubleClick: !interactive,
          disableDoubleClickZoom: !interactive,
        });
        mapRef.current = map;
        if (!aliveRef.current || cancelled) return;
        setMapReady(true);
        setStatus('ready');
        onMapReadyRef.current?.(map, kakao);
        screenSyncCleanupRef.current?.();
        screenSyncCleanupRef.current = attachScreenMarkerPositionSync(
          kakao,
          map,
          propertyRefs,
          containerNode,
        );
        if (!autoFitMarkersRef.current) {
          onBaselineLevelChangeRef.current?.(map.getLevel());
        }
        syncMapLevel(map.getLevel());
        const onZoom = () => {
          if (!aliveRef.current) return;
          syncMapLevel(map.getLevel());
        };
        zoomHandlerRef.current = onZoom;
        kakao.maps.event.addListener(map, 'zoom_changed', onZoom);
      } catch (err) {
        if (!cancelled && aliveRef.current) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : '지도를 불러오지 못했습니다.');
          setMapReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      screenSyncCleanupRef.current?.();
      screenSyncCleanupRef.current = null;
      roadviewControllerRef.current?.destroy();
      roadviewControllerRef.current = null;
      setRoadviewActive(false);
      clearMarkers(clustererRef, markerMapRef);
      clearPropertyLayer(propertyRefs);
      destroyMapInstance(mapRef, kakaoRef, containerNode, zoomHandlerRef);
      kakaoRef.current = null;
      resolvedRef.current = [];
      fittedSignatureRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- containerNode/level/interactive/showWhenEmpty only for init
  }, [containerNode, level, interactive, showWhenEmpty]);

  /* 마커 갱신 */
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!mapReady || !map || !kakao) return;

    if (markerInputs.length === 0) {
      clearMarkers(clustererRef, markerMapRef);
      clearPropertyLayer(propertyRefs);
      resolvedRef.current = [];
      onMarkersResolvedRef.current?.([], 0);
      return;
    }

    const runId = ++geocodeRunRef.current;

    (async () => {
      /** @type {(MapMarkerInput & { lat: number, lng: number })[]} */
      const known = [];
      /** @type {MapMarkerInput[]} */
      const needGeocode = [];
      for (const item of markerInputs) {
        if (typeof item.lat === 'number' && typeof item.lng === 'number'
          && Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
          known.push({ ...item, lat: item.lat, lng: item.lng });
        } else {
          needGeocode.push(item);
        }
      }

      // 1) 저장된 좌표 즉시 표시 — 전체 지오코딩을 기다리지 않음
      /** @type {(MapMarkerInput & { lat: number, lng: number })[]} */
      let resolved = [...known];
      resolvedRef.current = resolved;

      if (resolved.length > 0) {
        if (aliveRef.current) {
          setStatus('ready');
          setErrorMsg('');
        }
        onMarkersResolvedRef.current?.(resolved, markerInputs.length);
        const shouldFit = autoFitMarkersRef.current
          && fittedSignatureRef.current !== markerSignature;
        if (shouldFit) fittedSignatureRef.current = markerSignature;
        applyResolvedMarkers(resolved, { fit: shouldFit });
      } else if (needGeocode.length === 0) {
        clearMarkers(clustererRef, markerMapRef);
        clearPropertyLayer(propertyRefs);
        onMarkersResolvedRef.current?.([], 0);
        if (!showWhenEmpty && aliveRef.current) {
          setStatus('error');
          setErrorMsg('표시할 매물 좌표가 없습니다.');
        } else if (aliveRef.current) {
          setStatus('ready');
        }
        return;
      }

      if (needGeocode.length === 0) return;
      if (geocodeRunRef.current !== runId || !aliveRef.current) return;

      let flushQueued = false;
      const flushProgress = () => {
        flushQueued = false;
        if (geocodeRunRef.current !== runId || !aliveRef.current) return;
        resolvedRef.current = resolved;
        onMarkersResolvedRef.current?.(resolved, markerInputs.length);
        applyResolvedMarkers(resolved, { fit: false });
        if (aliveRef.current) {
          setStatus('ready');
          setErrorMsg('');
        }
      };
      const scheduleFlush = () => {
        if (flushQueued) return;
        flushQueued = true;
        requestAnimationFrame(flushProgress);
      };

      // 2) 나머지 주소 → 병렬 지오코딩 (동시 4건, 변형 최대 3개)
      /** @type {(MapMarkerInput & { lat: number, lng: number })[]} */
      const geocoded = [];
      await runPool(needGeocode, 4, async (item) => {
        if (geocodeRunRef.current !== runId || !aliveRef.current) return null;
        const extras = [
          item.fallbackAddress,
          ...(item.fallbackAddresses || []),
        ].filter(Boolean);
        const point = await geocodeAddressVariants(kakao, item.address, extras, { maxVariants: 3 });
        if (geocodeRunRef.current !== runId || !aliveRef.current) return null;
        if (point) {
          const row = { ...item, ...point };
          geocoded.push(row);
          resolved = [...known, ...geocoded];
          scheduleFlush();
          return row;
        }
        return null;
      });

      if (geocodeRunRef.current !== runId || !aliveRef.current) return;

      resolved = [...known, ...geocoded];
      resolvedRef.current = resolved;
      onMarkersResolvedRef.current?.(resolved, markerInputs.length);

      if (resolved.length === 0) {
        clearMarkers(clustererRef, markerMapRef);
        clearPropertyLayer(propertyRefs);
        if (!showWhenEmpty) {
          if (aliveRef.current) {
            setStatus('error');
            setErrorMsg('주소를 지도에서 찾을 수 없습니다.\n주소 형식을 확인하거나 카카오맵 JavaScript SDK 도메인 설정을 확인하세요.');
          }
        } else if (aliveRef.current) {
          setStatus('ready');
        }
        return;
      }

      if (!aliveRef.current) return;
      setStatus('ready');
      setErrorMsg('');

      const shouldFit = autoFitMarkersRef.current
        && fittedSignatureRef.current !== markerSignature;
      if (shouldFit) fittedSignatureRef.current = markerSignature;
      applyResolvedMarkers(resolved, { fit: shouldFit && known.length === 0 });
    })();

    return () => {
      geocodeRunRef.current += 1;
    };
  }, [markerSignature, fallbackAddress, mapReady, showWhenEmpty]);

  /* 줌·표시 모드 변경 시 오버레이 내용만 갱신 (핀 Marker 좌표는 카카오가 유지) */
  useEffect(() => {
    if (!mapReady || resolvedRef.current.length === 0) return;
    const resolved = resolvedRef.current;
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    const useOverlays = showMarkerCardsRef.current && renderMarkerCardRef.current;
    if (useOverlays && propertyLayerMatchesResolved(propertyRefs, resolved)) {
      const updated = updatePropertyLayerInPlace(
        kakao,
        map,
        propertyRefs,
        renderMarkerCardRef.current,
        selectedId,
        cardDisplayModeRef.current,
      );
      if (updated) return;
    }
    applyResolvedMarkers(resolved, { fit: false });
  }, [cluster, showMarkerCards, cardDisplayMode, mapReady, selectedId]);

  /* 지도 화면(bounds) 변경 시 목록 연동 */
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!mapReady || !map || !kakao?.maps?.event) return;

    const reportBounds = () => {
      try {
        const bounds = map.getBounds();
        if (!bounds) return;
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        onBoundsChangeRef.current?.({
          south: sw.getLat(),
          west: sw.getLng(),
          north: ne.getLat(),
          east: ne.getLng(),
        }, resolvedRef.current);
        refreshScreenMarkerPositions(kakao, map, propertyRefs, screenLayerRef.current?.parentElement ?? containerRef.current);
      } catch {
        /* 지도 초기화 직후 bounds 미준비 */
      }
    };

    kakao.maps.event.addListener(map, 'idle', reportBounds);
    reportBounds();
    return () => kakao.maps.event.removeListener(map, 'idle', reportBounds);
  }, [mapReady, markerSignature]);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useLayoutEffect(() => () => {
    aliveRef.current = false;
    screenSyncCleanupRef.current?.();
    screenSyncCleanupRef.current = null;
    roadviewControllerRef.current?.destroy();
    roadviewControllerRef.current = null;
    clearMarkers(clustererRef, markerMapRef);
    clearPropertyLayer(propertyRefs);
    destroyMapInstance(mapRef, kakaoRef, containerNodeRef.current, zoomHandlerRef);
    kakaoRef.current = null;
  }, []);

  /* 지도 검색 결과로 이동 */
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!mapReady || !map || !kakao || !viewTarget) return;
    map.setCenter(new kakao.maps.LatLng(viewTarget.lat, viewTarget.lng));
    if (viewTarget.level != null) map.setLevel(viewTarget.level);
    syncMapLevel(map.getLevel());
    refreshScreenMarkerPositions(kakao, map, propertyRefs, screenLayerRef.current?.parentElement ?? containerRef.current);
  }, [viewTarget, mapReady]);

  /* 매물 검색 결과 영역으로 이동 (결과 있을 때만) */
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!mapReady || !map || !kakao || !searchFitTarget?.points?.length) return;

    const points = searchFitTarget.points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    if (!points.length) return;

    fitMapToPoints(kakao, map, points, 56);
    if (points.length === 1 && searchFitTarget.level != null) {
      map.setLevel(searchFitTarget.level);
    }
    syncMapLevel(map.getLevel());
    refreshScreenMarkerPositions(kakao, map, propertyRefs, screenLayerRef.current?.parentElement ?? containerRef.current);
  }, [searchFitTarget, mapReady]);

  /* 지도검색 핀 (매물 마커와 구분) */
  useEffect(() => {
    const map = mapRef.current;
    const kakao = kakaoRef.current;
    if (!mapReady || !map || !kakao) return;
    if (placeMarkerRef.current) {
      placeMarkerRef.current.setMap(null);
      placeMarkerRef.current = null;
    }
    if (!placePin) return;
    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(placePin.lat, placePin.lng),
      map,
      title: placePin.title || '',
      zIndex: 50,
    });
    placeMarkerRef.current = marker;
    return () => {
      marker.setMap(null);
      placeMarkerRef.current = null;
    };
  }, [placePin, mapReady]);

  /* 목록·마커 선택 → 해당 매물로 이동 (검색 필터 변경 시에는 이동하지 않음) */
  useEffect(() => {
    if (selectedId == null) {
      lastPannedSelectedIdRef.current = null;
      return;
    }
    panToSelectedIfNeeded(true);
  }, [selectedId, mapReady]);

  if (status === 'no-key') {
    return (
      <MapPlaceholder
        height={height}
        message="카카오맵 API 키 미설정"
        sub=".env.local에 VITE_KAKAO_MAP_JS_KEY(JavaScript 키)를 설정하세요."
      />
    );
  }
  if (status === 'empty') {
    return <MapPlaceholder height={height} message="표시할 주소가 없습니다." />;
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height,
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid ${C.bdr}`,
        background: C.surf2,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: roadviewActive ? '0 0 50%' : '1 1 100%',
            minWidth: 0,
            height: '100%',
            overflow: 'hidden',
            zIndex: 1,
            isolation: 'isolate',
          }}
        >
          <div
            ref={(node) => {
              containerRef.current = node;
              if (node) setContainerNode(node);
            }}
            style={{ width: '100%', height: '100%' }}
          />
          <div
            ref={screenLayerRef}
            aria-hidden={false}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              zIndex: 1,
            }}
          />
        </div>
        <div
          ref={roadviewContainerRef}
          style={{
            position: 'relative',
            flex: roadviewActive ? '0 0 50%' : '0 0 0',
            display: roadviewActive ? 'block' : 'none',
            minWidth: 0,
            height: '100%',
            background: '#000',
            zIndex: 2,
          }}
        />
      </div>
      {(status === 'loading' || status === 'error') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(248,249,251,.88)',
            fontSize: 13,
            color: status === 'error' ? C.brand : C.txM,
            fontWeight: 500,
            padding: 16,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.55,
            overflowY: 'auto',
            pointerEvents: 'none',
          }}
        >
          {status === 'loading' ? '지도 불러오는 중…' : errorMsg || '지도를 표시할 수 없습니다.'}
        </div>
      )}
      {useSiteControls && status === 'ready' && mapReady && (
        <>
          <MapSiteToolbar
            map={mapRef.current}
            kakao={kakaoRef.current}
            mapReady={mapReady}
            roadviewActive={roadviewActive}
            onRoadviewToggle={handleRoadviewToggle}
          />
          <MapZoomRail map={mapRef.current} mapReady={mapReady} onZoom={syncMapLevel} />
        </>
      )}
    </div>
  );
}

/** @param {{ address?: string, fallbackAddress?: string, markers?: import('./KakaoMap.jsx').MapMarkerInput[], onClose: () => void, title?: string }} props */
export function KakaoMapExpandWin({ address, fallbackAddress, markers, onClose, title = '지도 보기' }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: 'min(960px, calc(100vw - 48px))',
          height: 'min(640px, calc(100vh - 48px))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            height: 50,
            borderBottom: `1px solid ${C.bdr}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1.5px solid ${C.bdr}`,
              background: C.surf2,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
          <KakaoMap
            markers={markers}
            address={address}
            fallbackAddress={fallbackAddress}
            height="100%"
            level={2}
            interactive
            showMapSiteControls
          />
        </div>
      </div>
    </div>
  );
}

export { geocodeAddresses, geocodeAddressVariants as geocodeAddress, loadKakaoMaps } from '../services/kakao/kakaoMaps.js';
