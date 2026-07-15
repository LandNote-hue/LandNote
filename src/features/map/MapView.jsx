import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { KakaoMap } from '../../components/KakaoMap.jsx';

import { updateProperty } from '../../db.js';

import { useIsMobile } from '../../hooks/useIsMobile.js';

import { useProperties } from '../../hooks/useProperties.js';

import { coordsFromProperty } from '../../services/kakao/propertyGeocode.js';

import { fmtLandPyUnit, priceInManForFilter } from '../../utils/formatMoney.js';

import {

  propDisplayAddr,

  propGeocodeQueries,

  propJibunGeocodeQueries,

  propHasMappableAddress,

  propMatchesSearch,

  propSearchHaystack,

} from '../../utils/propAddress.js';

import { getCardDisplayMode } from './cardDisplayMode.js';

import {
  GANGNAM_GU_CENTER,
  isPointInMapBounds,
  MAP_DEFAULT_LEVEL_250M,
  MAP_DETAIL_CARD_LEVEL,
} from './mapDefaults.js';

import {
  kakaoLevelFromZoomPercent,
  ZOOM_PLACE_SEARCH_PERCENT,
} from './mapZoom.js';

import {
  MAP_TAB_DEFAULT_LEVEL,
  pickDensestRegionView,
} from './mapInitialView.js';

import { MapPlaceSearch } from './MapPlaceSearch.jsx';

import { MapPropertySidebar } from './MapPropertySidebar.jsx';

import { getZoomPercentLabel } from './mapZoom.js';

import { MapMarkerStack } from './MapMarkerStack.jsx';

import { KR_GU, KR_SIDO, py, sidoMatch } from './regions.js';



const C = {

  brand: '#C8102E',

  bg: '#F5F6FA',

  bdr: '#E8EAED',

  txM: '#6B7280',

};



const STATUS_LABEL_TO_CODE = { '신규': 'NEW', '진행중': 'ACTIVE', '보류': 'HOLD', '계약완료': 'COMPLETED' };



/**

 * @param {{ onOpen: (type: string, data: unknown) => void, Btn: React.ComponentType<{ch?: string, on?: () => void, role?: string, ic?: string, sx?: object}>, PH: React.ComponentType<{title?: string, sub?: string, ch?: React.ReactNode}> }} props

 */

export function MapView({ onOpen, Btn, PH }) {

  const isMobile = useIsMobile();

  const openPropertyDetail = useCallback((p) => {

    onOpen('pd', p);

  }, [onOpen]);

  const P = useProperties();



  /* ── 매물 검색 (좌측 패널) ── */

  const [propSearch, setPropSearch] = useState('');

  const [advOpen, setAdvOpen] = useState(false);

  const [selSido, setSelSido] = useState('');

  const [selGu, setSelGu] = useState('');

  const [filterResetKey, setFilterResetKey] = useState(0);

  const [advTag, setAdvTag] = useState('');

  const [advTrade, setAdvTrade] = useState('');

  const [advStatus, setAdvStatus] = useState('');

  const [advPriceMin, setAdvPriceMin] = useState('');

  const [advPriceMax, setAdvPriceMax] = useState('');

  const [advLandMin, setAdvLandMin] = useState('');

  const [advLandMax, setAdvLandMax] = useState('');

  const [advFloorMin, setAdvFloorMin] = useState('');

  const [advFloorMax, setAdvFloorMax] = useState('');

  const [advRoiMin, setAdvRoiMin] = useState('');

  const [appliedAdv, setAppliedAdv] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');



  /* ── 지도 검색 (카카오맵) ── */

  const [mapViewTarget, setMapViewTarget] = useState(null);

  const [searchFitTarget, setSearchFitTarget] = useState(null);

  const [placePin, setPlacePin] = useState(null);



  const [resolvedMarkerCount, setResolvedMarkerCount] = useState(0);

  const [mapLevel, setMapLevel] = useState(MAP_TAB_DEFAULT_LEVEL);

  const [baselineLevel, setBaselineLevel] = useState(MAP_DEFAULT_LEVEL_250M);

  const [viewportBounds, setViewportBounds] = useState(null);

  const [resolvedOnMap, setResolvedOnMap] = useState(/** @type {{ id: string|number, lat: number, lng: number, data?: unknown }[]} */ ([]));

  const [cardDisplayMode, setCardDisplayMode] = useState(() => getCardDisplayMode(MAP_TAB_DEFAULT_LEVEL, MAP_DEFAULT_LEVEL_250M));

  const [selectedId, setSelectedId] = useState(null);



  const handleZoomLevelChange = useCallback((level) => {

    setMapLevel(level);

    setCardDisplayMode(getCardDisplayMode(level, baselineLevel));

  }, [baselineLevel]);

  const handleBaselineLevelChange = useCallback(() => {
    setBaselineLevel(MAP_DEFAULT_LEVEL_250M);
  }, []);

  const handleBoundsChange = useCallback((bounds, resolved) => {

    setViewportBounds(bounds);

    setResolvedOnMap(resolved);

  }, []);



  const handlePlaceSelect = useCallback((item) => {
    setPlacePin({ lat: item.lat, lng: item.lng, title: item.title });
    setMapViewTarget({
      lat: item.lat,
      lng: item.lng,
      level: kakaoLevelFromZoomPercent(ZOOM_PLACE_SEARCH_PERCENT, baselineLevel),
      token: Date.now(),
    });
  }, [baselineLevel]);



  useEffect(() => {

    if (baselineLevel != null) {

      setCardDisplayMode(getCardDisplayMode(mapLevel, baselineLevel));

    }

  }, [baselineLevel, mapLevel]);



  const applyAdvSearch = () => setAppliedAdv({

    sido: selSido, gu: selGu, tag: advTag, trade: advTrade, status: advStatus,

    priceMin: advPriceMin, priceMax: advPriceMax,

    landMin: advLandMin, landMax: advLandMax,

    floorMin: advFloorMin, floorMax: advFloorMax,

    roiMin: advRoiMin,

  });

  const resetAdvSearch = () => {

    setSelSido(''); setSelGu(''); setAdvTag(''); setAdvTrade(''); setAdvStatus('');

    setAdvPriceMin(''); setAdvPriceMax(''); setAdvLandMin(''); setAdvLandMax('');

    setAdvFloorMin(''); setAdvFloorMax(''); setAdvRoiMin('');

    setAppliedAdv(null);

    setFilterResetKey((k) => k + 1);

  };



  const priceOfForFilter = (p) => priceInManForFilter(p);



  const visibleP = useMemo(() => P.filter((p) => {

    if (statusFilter && p.status !== statusFilter) return false;

    if (appliedAdv) {

      const a = appliedAdv;

      if (!sidoMatch(propSearchHaystack(p), a.sido)) return false;

      if (a.gu && !propSearchHaystack(p).includes(a.gu)) return false;

      if (a.tag && p.tag !== a.tag) return false;

      if (a.trade && p.trade !== a.trade) return false;

      if (a.status && p.status !== STATUS_LABEL_TO_CODE[a.status]) return false;

      if ((a.priceMin || a.priceMax) && priceOfForFilter(p) === null) return false;

      if (a.priceMin && priceOfForFilter(p) < Number(a.priceMin)) return false;

      if (a.priceMax && priceOfForFilter(p) > Number(a.priceMax)) return false;

      const landPyVal = p.land > 0 ? py(p.land) : 0;

      if (a.landMin && (!landPyVal || Number(landPyVal) < Number(a.landMin))) return false;

      if (a.landMax && (!landPyVal || Number(landPyVal) > Number(a.landMax))) return false;

      const floorPyVal = p.floor > 0 ? py(p.floor) : 0;

      if (a.floorMin && (!floorPyVal || Number(floorPyVal) < Number(a.floorMin))) return false;

      if (a.floorMax && (!floorPyVal || Number(floorPyVal) > Number(a.floorMax))) return false;

      if (a.roiMin && (parseFloat(p.roi) || 0) < Number(a.roiMin)) return false;

    }

    if (!propSearch) return true;

    return propMatchesSearch(p, propSearch);

  }), [P, statusFilter, appliedAdv, propSearch]);



  const landPy = (p) => (p.land > 0 && p.price > 0 ? fmtLandPyUnit(p.price, p.land) : null);



  const mapMarkers = useMemo(() => visibleP

    .filter(propHasMappableAddress)

    .map((p) => {

      const jibunQueries = propJibunGeocodeQueries(p);

      const allQueries = propGeocodeQueries(p);

      const stored = coordsFromProperty(p);

      const fallbackAddresses = [

        ...jibunQueries.slice(1),

        ...allQueries.filter((q) => !jibunQueries.includes(q)),

      ];

      return {

        id: p.id,

        address: jibunQueries[0] || allQueries[0] || propDisplayAddr(p),

        fallbackAddresses,

        lat: stored?.lat,

        lng: stored?.lng,

        title: p.bldg || jibunQueries[0] || propDisplayAddr(p),

        data: p,

      };

    }), [visibleP]);



  const [mapMarkersStable, setMapMarkersStable] = useState(mapMarkers);

  useEffect(() => {
    // 최초 진입·빈→있음: 즉시 반영. 필터 타이핑 등은 짧게 디바운스
    if (mapMarkersStable.length === 0 && mapMarkers.length > 0) {
      setMapMarkersStable(mapMarkers);
      return undefined;
    }
    const t = setTimeout(() => setMapMarkersStable(mapMarkers), 180);
    return () => clearTimeout(t);
  }, [mapMarkers]);

  const markersIdentity = useMemo(
    () => mapMarkersStable.map((m) => `${m.id}:${m.address}`).join('|'),
    [mapMarkersStable],
  );

  const [coordsSettled, setCoordsSettled] = useState(false);

  useEffect(() => {
    setCoordsSettled(false);
  }, [markersIdentity]);



  const viewportP = useMemo(() => {
    if (!viewportBounds || resolvedOnMap.length === 0) return [];
    const inViewIds = new Set(
      resolvedOnMap
        .filter((m) => isPointInMapBounds({ lat: m.lat, lng: m.lng }, viewportBounds))
        .map((m) => m.id),
    );
    return visibleP.filter((p) => inViewIds.has(p.id));
  }, [visibleP, viewportBounds, resolvedOnMap]);

  /** 검색·필터 활성 시 전체 매물 결과, 아니면 지도 화면 내 매물만 */
  const hasPropFilter = Boolean(propSearch.trim() || statusFilter || appliedAdv);
  const sidebarListP = hasPropFilter ? visibleP : viewportP;

  const hasPropFilterRef = useRef(hasPropFilter);
  hasPropFilterRef.current = hasPropFilter;

  const searchFitTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const initialViewAppliedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    initialViewAppliedRef.current = false;
    return () => {
      mountedRef.current = false;
      if (searchFitTimerRef.current) clearTimeout(searchFitTimerRef.current);
    };
  }, []);

  const scheduleSearchFit = useCallback((resolved) => {
    if (!hasPropFilterRef.current || !mountedRef.current) return;
    const points = resolved
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .map((r) => ({ lat: r.lat, lng: r.lng }));
    if (!points.length) return;

    if (searchFitTimerRef.current) clearTimeout(searchFitTimerRef.current);
    searchFitTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setSearchFitTarget({
        points,
        level: MAP_DEFAULT_LEVEL_250M,
        token: Date.now(),
      });
    }, 400);
  }, []);

  useEffect(() => {
    if (!hasPropFilter) {
      if (searchFitTimerRef.current) clearTimeout(searchFitTimerRef.current);
      setSearchFitTarget(null);
    }
  }, [hasPropFilter]);

  const mapZoomSub = baselineLevel != null
    ? hasPropFilter
      ? `${getZoomPercentLabel(mapLevel, baselineLevel)} · 검색 ${sidebarListP.length}건 · 지도 ${viewportP.length}건`
      : `${getZoomPercentLabel(mapLevel, baselineLevel)} · 화면 ${viewportP.length}건 · 전체 ${visibleP.length}건`
    : hasPropFilter
      ? `검색 ${sidebarListP.length}건 · 지도 ${viewportP.length}건`
      : `화면 ${viewportP.length}건 · 전체 ${visibleP.length}건`;



  const persistResolvedCoords = useCallback((resolved) => {

    for (const r of resolved) {

      const p = r.data;

      if (!p?.id || coordsFromProperty(p)) continue;

      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;

      updateProperty(p.id, {

        mapLat: r.lat,

        mapLng: r.lng,

        mapGeocodedAt: new Date().toISOString(),

      }).catch(() => {});

    }

  }, []);



  const selectedP = selectedId != null ? visibleP.find((p) => p.id === selectedId) : null;

  useEffect(() => {

    if (selectedId != null && !selectedP) setSelectedId(null);

  }, [selectedId, selectedP]);



  const selectProperty = useCallback((id) => {
    setPlacePin(null);
    if (searchFitTimerRef.current) clearTimeout(searchFitTimerRef.current);
    setSearchFitTarget(null);
    setSelectedId(id);
  }, []);

  const applyInitialMapView = useCallback((resolved) => {
    if (initialViewAppliedRef.current || hasPropFilterRef.current) return;
    const view = pickDensestRegionView(P, resolved);
    if (!view) return;

    initialViewAppliedRef.current = true;
    setMapViewTarget({
      lat: view.lat,
      lng: view.lng,
      level: view.level,
      token: Date.now(),
    });
    setMapLevel(view.level);
    setCardDisplayMode(getCardDisplayMode(view.level, MAP_DEFAULT_LEVEL_250M));
  }, [P]);

  const handleMarkersResolved = useCallback((resolved) => {
    setCoordsSettled(true);
    setResolvedMarkerCount(resolved.length);
    setResolvedOnMap(resolved);
    persistResolvedCoords(resolved);
    applyInitialMapView(resolved);
    scheduleSearchFit(resolved);
  }, [applyInitialMapView, persistResolvedCoords, scheduleSearchFit]);



  const renderMapMarkerCard = useCallback((item, isSelected, mode) => {
    const p = item.data;
    if (!p) return null;

    return (
      <MapMarkerStack
        p={p}
        mode={mode}
        selected={isSelected}
        onSelect={() => selectProperty(p.id)}
        onOpenDetail={openPropertyDetail}
        landPy={landPy}
      />
    );
  }, [landPy, openPropertyDetail, selectProperty]);



  const loadingCoords = !coordsSettled && mapMarkersStable.length > 0;



  const sidebarProps = {

    propSearch, setPropSearch,

    advOpen, setAdvOpen,

    statusFilter, setStatusFilter,

    selSido, setSelSido, selGu, setSelGu,

    advTag, setAdvTag, advTrade, setAdvTrade, advStatus, setAdvStatus,

    advPriceMin, setAdvPriceMin, advPriceMax, setAdvPriceMax,

    advLandMin, setAdvLandMin, advLandMax, setAdvLandMax,

    advFloorMin, setAdvFloorMin, advFloorMax, setAdvFloorMax,

    advRoiMin, setAdvRoiMin,

    filterResetKey, onApplyAdv: applyAdvSearch, onResetAdv: resetAdvSearch,
    listP: sidebarListP,
    listMode: hasPropFilter ? 'search' : 'viewport',
    visibleCount: visibleP.length,

    selectedId, setSelectedId: selectProperty, onOpenDetail: openPropertyDetail,

    loadingCoords, Btn,

  };



  return (

    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: C.bg, minWidth: 0 }}>

      {!isMobile ? (

        <PH title="지도 보기" sub={mapZoomSub} />

      ) : (

        <div style={{ background: '#fff', borderBottom: `1px solid ${C.bdr}`, padding: '12px 16px', flexShrink: 0 }}>

          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>지도 보기</div>

          <div style={{ fontSize: 12, color: C.txM, marginBottom: 8 }}>{mapZoomSub}</div>

          <input type="search" value={propSearch} onChange={(e) => setPropSearch(e.target.value)} placeholder="매물 검색 (건물명·주소)"

            style={{ width: '100%', height: 36, border: `1.5px solid ${C.bdr}`, borderRadius: 8, padding: '0 10px', fontSize: 14 }} />

        </div>

      )}



      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {!isMobile && <MapPropertySidebar {...sidebarProps} />}



        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 360 }}>

          <KakaoMap

            markers={mapMarkersStable}

            cluster={false}

            center={GANGNAM_GU_CENTER}

            level={MAP_TAB_DEFAULT_LEVEL}

            autoFitMarkers={false}

            detailZoomLevel={MAP_DETAIL_CARD_LEVEL}

            viewTarget={mapViewTarget}

            searchFitTarget={searchFitTarget}

            placePin={placePin}

            selectedId={selectedId}

            showWhenEmpty

            showMarkerCards

            showMapSiteControls

            cardDisplayMode={cardDisplayMode}

            renderMarkerCard={renderMapMarkerCard}

            onMarkerClick={(item) => selectProperty(item.id)}

            onMarkersResolved={handleMarkersResolved}

            onZoomLevelChange={handleZoomLevelChange}

            onBaselineLevelChange={handleBaselineLevelChange}

            onBoundsChange={handleBoundsChange}

            height="100%"

          />

          <MapPlaceSearch onSelect={handlePlaceSelect} isMobile={isMobile} />

        </div>

      </div>

    </div>

  );

}


