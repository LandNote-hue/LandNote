import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  loadNaverMaps,
  geocodeAddressVariants,
  fitMapToPoints,
  getNaverMapClientId,
  runPool,
  createNaverMap,
  latLng,
  getMapBoundsBox,
} from '../services/naver/naverMaps.js';
import { addMapListener, removeMapListener } from '../features/map/mapEvents.js';
import { placeClusteredMarkers } from '../features/map/mapCluster.js';
import { clearMapOverlayLayers } from '../features/map/mapLayers.js';
import { MapSiteToolbar } from '../features/map/MapSiteToolbar.jsx';
import { MapZoomRail } from '../features/map/MapZoomRail.jsx';
import { createMapRoadviewController } from '../features/map/mapRoadview.js';
import {
  attachScreenMarkerPositionSync,
  clearPropertyLayer,
  mountOverlayHost,
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

function destroyMapInstance(mapRef, mapsNsRef, container, zoomListenerRef) {
  const map = mapRef.current;
  removeMapListener(zoomListenerRef.current);
  zoomListenerRef.current = null;
  clearMapOverlayLayers(map);
  try { map?.destroy?.(); } catch { /* ignore */ }
  mapRef.current = null;
  mapsNsRef.current = null;

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

function placeMarkersOnMap(naver, map, resolved, cluster, clustererRef, markerMapRef, onMarkerClick, showMarkerCards, selectedId) {
  if (!map || !naver) return;
  clearMarkers(clustererRef, markerMapRef);

  if (cluster && !showMarkerCards && resolved.length > 1) {
    clustererRef.current = placeClusteredMarkers(naver, map, resolved, {
      onClick: onMarkerClick,
      selectedId,
      minLevel: 5,
      markerMapRef,
    });
    return;
  }

  resolved.forEach((item) => {
    const isSelected = markerKey(selectedId) === markerKey(item.id);
    const marker = new naver.maps.Marker({
      position: latLng(item.lat, item.lng),
      title: item.title || '',
      zIndex: showMarkerCards ? (isSelected ? 28 : 24) : (isSelected ? 20 : 10),
    });
    marker.setMap(map);
    if (onMarkerClick) {
      addMapListener(marker, 'click', () => onMarkerClick(item));
    }
    if (item.id != null) markerMapRef.current.set(markerKey(item.id), { marker, item });
  });
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
 *   onMapReady?: (map: unknown, naver: typeof window.naver) => void,
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
export function SiteMap({
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
  areaUnit = 'py',
  style,
  className,
}) {
  const containerRef = useRef(null);
  const [containerNode, setContainerNode] = useState(null);
  const mapRef = useRef(null);
  const mapsNsRef = useRef(null);
  const markerMapRef = useRef(new Map());
  const clustererRef = useRef(null);
  const placeMarkerRef = useRef(null);
  const propertyRefs = useRef([]);
  const screenLayerRef = useRef(null);
  const overlayHostRef = useRef(null);
  const overlayUnmountRef = useRef(null);
  const screenSyncCleanupRef = useRef(null);
  const roadviewContainerRef = useRef(null);
  const roadviewControllerRef = useRef(null);
  const [roadviewActive, setRoadviewActive] = useState(false);
  const resolvedRef = useRef([]);
  const fittedSignatureRef = useRef('');
  const selectedIdRef = useRef(selectedId);
  const lastPannedSelectedIdRef = useRef(null);
  const zoomListenerRef = useRef(null);
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

  const screenLayerEl = () => overlayHostRef.current || screenLayerRef.current;
  const screenClipEl = () => containerRef.current;

  const syncMapLevel = (nextLevel) => {
    onZoomLevelChangeRef.current?.(nextLevel);
  };

  const handleRoadviewToggle = useCallback(async () => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (roadviewActive) {
      const naver = mapsNsRef.current;
      roadviewControllerRef.current?.disable();
      setRoadviewActive(false);
      if (naver) {
        refreshScreenMarkerPositions(naver, map, propertyRefs, screenClipEl());
      }
      return;
    }

    setRoadviewActive(true);
    try {
      const naver = await loadNaverMaps({ panorama: true });
      mapsNsRef.current = naver;
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      if (!roadviewContainerRef.current) {
        setRoadviewActive(false);
        return;
      }
      if (!roadviewControllerRef.current) {
        roadviewControllerRef.current = createMapRoadviewController(
          naver,
          map,
          roadviewContainerRef.current,
          {
            onLayout: () => refreshScreenMarkerPositions(
              naver,
              map,
              propertyRefs,
              screenClipEl(),
            ),
          },
        );
      }
      await roadviewControllerRef.current.enable();
      refreshScreenMarkerPositions(naver, map, propertyRefs, screenClipEl());
    } catch (err) {
      roadviewControllerRef.current?.disable();
      setRoadviewActive(false);
      window.alert(err instanceof Error ? err.message : '거리뷰를 불러오지 못했습니다.');
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
    const naver = mapsNsRef.current;
    const sid = selectedIdRef.current;
    if (!map || !naver || sid == null) return;
    if (!force && lastPannedSelectedIdRef.current === sid) return;

    const entry = markerMapRef.current.get(markerKey(sid));
    const item = entry?.item ?? resolvedRef.current.find((r) => markerKey(r.id) === markerKey(sid));
    if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;

    lastPannedSelectedIdRef.current = sid;
    map.setCenter(latLng(item.lat, item.lng));
    map.setLevel(detailZoomLevelRef.current);
    syncMapLevel(detailZoomLevelRef.current);
    refreshScreenMarkerPositions(naver, map, propertyRefs, screenClipEl());
  };

  const applyResolvedMarkers = (resolved, { fit }) => {
    if (!aliveRef.current) return;
    const map = mapRef.current;
    const naver = mapsNsRef.current;
    if (!map || !naver || resolved.length === 0) return;

    const showCards = showMarkerCardsRef.current && renderMarkerCardRef.current;

    clearMarkers(clustererRef, markerMapRef);

    if (showCards) {
      clearPropertyLayer(propertyRefs);
      placePropertyLayer(
        naver,
        map,
        resolved,
        renderMarkerCardRef.current,
        selectedId,
        cardDisplayModeRef.current,
        propertyRefs,
        markerMapRef,
        (item) => onMarkerClickRef.current?.(item),
        screenLayerEl(),
      );
    } else {
      clearPropertyLayer(propertyRefs);
      placeMarkersOnMap(
        naver,
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
    () => markerInputs.map((m) => `${m.id}:${m.address}:${m.fallbackAddress ?? ''}:${(m.fallbackAddresses || []).join('+')}`).join('|'),
    [markerInputs],
  );

  useEffect(() => {
    if (!getNaverMapClientId()) {
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
        const naver = await loadNaverMaps();
        if (cancelled || !containerNode) return;

        mapsNsRef.current = naver;
        const initCenter = initialCenterRef.current;
        const map = createNaverMap(containerNode, {
          lat: initCenter?.lat,
          lng: initCenter?.lng,
          level: initialLevelRef.current,
          interactive,
        });
        mapRef.current = map;
        if (!aliveRef.current || cancelled) return;
        overlayUnmountRef.current?.();
        const overlay = mountOverlayHost(naver, map);
        overlayHostRef.current = overlay?.host ?? null;
        overlayUnmountRef.current = overlay?.unmount ?? null;
        setMapReady(true);
        setStatus('ready');
        onMapReadyRef.current?.(map, naver);
        screenSyncCleanupRef.current?.();
        screenSyncCleanupRef.current = attachScreenMarkerPositionSync(
          naver,
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
        zoomListenerRef.current = addMapListener(map, 'zoom_changed', onZoom);
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
      overlayUnmountRef.current?.();
      overlayUnmountRef.current = null;
      overlayHostRef.current = null;
      roadviewControllerRef.current?.destroy();
      roadviewControllerRef.current = null;
      setRoadviewActive(false);
      clearMarkers(clustererRef, markerMapRef);
      clearPropertyLayer(propertyRefs);
      destroyMapInstance(mapRef, mapsNsRef, containerNode, zoomListenerRef);
      resolvedRef.current = [];
      fittedSignatureRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- containerNode/level/interactive/showWhenEmpty only for init
  }, [containerNode, level, interactive, showWhenEmpty]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = mapsNsRef.current;
    if (!mapReady || !map || !naver) return;

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

      /** @type {(MapMarkerInput & { lat: number, lng: number })[]} */
      const geocoded = [];
      await runPool(needGeocode, 4, async (item) => {
        if (geocodeRunRef.current !== runId || !aliveRef.current) return null;
        const extras = [
          item.fallbackAddress,
          ...(item.fallbackAddresses || []),
        ].filter(Boolean);
        const point = await geocodeAddressVariants(item.address, extras, { maxVariants: 3 });
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
            setErrorMsg('주소를 지도에서 찾을 수 없습니다.\n주소 형식을 확인하거나 네이버 지도 Client ID·Web 서비스 URL 설정을 확인하세요.');
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

  useEffect(() => {
    if (!mapReady || resolvedRef.current.length === 0) return;
    const resolved = resolvedRef.current;
    const naver = mapsNsRef.current;
    const map = mapRef.current;
    const useOverlays = showMarkerCardsRef.current && renderMarkerCardRef.current;
    if (useOverlays && propertyLayerMatchesResolved(propertyRefs, resolved)) {
      const updated = updatePropertyLayerInPlace(
        naver,
        map,
        propertyRefs,
        renderMarkerCardRef.current,
        selectedId,
        cardDisplayModeRef.current,
      );
      if (updated) return;
    }
    applyResolvedMarkers(resolved, { fit: false });
  }, [cluster, showMarkerCards, cardDisplayMode, mapReady, selectedId, areaUnit]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = mapsNsRef.current;
    if (!mapReady || !map || !naver?.maps?.Event) return;

    const reportBounds = () => {
      try {
        const box = getMapBoundsBox(map);
        if (!box) return;
        onBoundsChangeRef.current?.(box, resolvedRef.current);
        refreshScreenMarkerPositions(naver, map, propertyRefs, screenClipEl());
      } catch {
        /* 지도 초기화 직후 bounds 미준비 */
      }
    };

    const idleListener = addMapListener(map, 'idle', reportBounds);
    reportBounds();
    return () => removeMapListener(idleListener);
  }, [mapReady, markerSignature]);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useLayoutEffect(() => () => {
    aliveRef.current = false;
    screenSyncCleanupRef.current?.();
    screenSyncCleanupRef.current = null;
    overlayUnmountRef.current?.();
    overlayUnmountRef.current = null;
    overlayHostRef.current = null;
    roadviewControllerRef.current?.destroy();
    roadviewControllerRef.current = null;
    clearMarkers(clustererRef, markerMapRef);
    clearPropertyLayer(propertyRefs);
    destroyMapInstance(mapRef, mapsNsRef, containerNodeRef.current, zoomListenerRef);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const naver = mapsNsRef.current;
    if (!mapReady || !map || !naver || !viewTarget) return;
    map.setCenter(latLng(viewTarget.lat, viewTarget.lng));
    if (viewTarget.level != null) map.setLevel(viewTarget.level);
    syncMapLevel(map.getLevel());
    refreshScreenMarkerPositions(naver, map, propertyRefs, screenClipEl());
  }, [viewTarget, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = mapsNsRef.current;
    if (!mapReady || !map || !naver || !searchFitTarget?.points?.length) return;

    const points = searchFitTarget.points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    if (!points.length) return;

    fitMapToPoints(map, points, 56);
    if (points.length === 1 && searchFitTarget.level != null) {
      map.setLevel(searchFitTarget.level);
    }
    syncMapLevel(map.getLevel());
    refreshScreenMarkerPositions(naver, map, propertyRefs, screenClipEl());
  }, [searchFitTarget, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const naver = mapsNsRef.current;
    if (!mapReady || !map || !naver) return;
    if (placeMarkerRef.current) {
      placeMarkerRef.current.setMap(null);
      placeMarkerRef.current = null;
    }
    if (!placePin) return;
    const marker = new naver.maps.Marker({
      position: latLng(placePin.lat, placePin.lng),
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

  useEffect(() => {
    if (selectedId == null) {
      lastPannedSelectedIdRef.current = null;
      return;
    }
    panToSelectedIfNeeded(true);
  }, [selectedId, mapReady]);

  if (status === 'no-key') {
    const prodHost = typeof window !== 'undefined'
      && window.location.hostname !== 'localhost'
      && window.location.hostname !== '127.0.0.1';
    return (
      <MapPlaceholder
        height={height}
        message="네이버 지도 API 키 미설정"
        sub={prodHost
          ? '운영 빌드에 VITE_NAVER_MAP_CLIENT_ID가 없습니다. Vercel 환경 변수 또는 .env.production을 넣고 다시 배포하세요.'
          : '.env.local에 VITE_NAVER_MAP_CLIENT_ID(ncpKeyId / Client ID)를 설정한 뒤 개발 서버를 재시작하세요.'}
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
            mapsNs={mapsNsRef.current}
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

/** @param {{ address?: string, fallbackAddress?: string, markers?: MapMarkerInput[], onClose: () => void, title?: string }} props */
export function SiteMapExpandWin({ address, fallbackAddress, markers, onClose, title = '지도 보기' }) {
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
          <SiteMap
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

export { geocodeAddresses, geocodeAddressVariants as geocodeAddress, loadNaverMaps } from '../services/naver/naverMaps.js';
