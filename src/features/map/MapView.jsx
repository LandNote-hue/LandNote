import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SiteMap } from '../../components/SiteMap.jsx';
import { updateProperty } from '../../db.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useProperties } from '../../hooks/useProperties.js';

import { coordsFromProperty } from '../../services/naver/propertyGeocode.js';
import { fmtLandPyUnit } from '../../utils/formatMoney.js';
import {
  propDisplayAddr,
  propGeocodeQueries,
  propJibunGeocodeQueries,
  propHasMappableAddress,
  propMatchesSearch,
} from '../../utils/propAddress.js';
import { getCardDisplayMode } from './cardDisplayMode.js';
import {
  GANGNAM_GU_CENTER,
  isPointInMapBounds,
  MAP_DEFAULT_LEVEL_250M,
  MAP_DETAIL_CARD_LEVEL,
} from './mapDefaults.js';
import {
  mapLevelFromZoomPercent,
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
import { MapAreaUnitToggle } from './MapAreaUnitToggle.jsx';

import { BRAND_CSS } from '../../theme/dealModeTheme.js';
import { useDealMode } from '../../contexts/DealModeContext.jsx';
import { propertyMatchesDealMode } from '../../utils/dealModeMatch.js';
import { uniquePropAgentNames } from '../../utils/propAgent.js';
import {
  emptyAdvSearchDraft,
  buildAppliedAdv,
  propertyMatchesAppliedAdv,
} from '../../utils/propAdvSearch.js';
import { PropListAdvSearchPanel } from '../../components/PropListAdvSearchPanel.jsx';
import { rememberPropListTab } from '../../navigation/propListPersist.js';

const C = {
  brand: BRAND_CSS.brand,
  brandL: BRAND_CSS.brandL,
  bg: '#F5F6FA',
  surf: '#fff',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  txP: '#94A3B8',
};

/** 지도 기본 상태 필터 — 매각중(임대 모드에서는 임대중, 동일 코드) */
const MAP_STATUS_DEFAULT = 'ACTIVE';

/**
 * @param {{
 *   onOpen: (type: string, data: unknown) => void,
 *   onNav?: (id: string) => void,
 *   Btn?: React.ComponentType<Record<string, unknown>>,
 *   PH: React.ComponentType<{title?: string, sub?: string, ch?: React.ReactNode, acts?: React.ReactNode}>,
 * }} props
 */
export function MapView({ onOpen, onNav, Btn, PH }) {
  const isMobile = useIsMobile();
  const { mode, isRent } = useDealMode();

  const openPropertyDetail = useCallback((p) => {
    onOpen('pd', p);
  }, [onOpen]);

  const P = useProperties();

  /* ── 매물 검색 (좌측 패널) ── */
  const [propSearch, setPropSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(MAP_STATUS_DEFAULT);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [advDraft, setAdvDraft] = useState(emptyAdvSearchDraft);
  const [appliedAdv, setAppliedAdv] = useState(null);

  /* ── 지도 검색 ── */
  const [mapViewTarget, setMapViewTarget] = useState(null);
  const [searchFitTarget, setSearchFitTarget] = useState(null);
  const [placePin, setPlacePin] = useState(null);

  const [resolvedMarkerCount, setResolvedMarkerCount] = useState(0);
  const [mapLevel, setMapLevel] = useState(MAP_TAB_DEFAULT_LEVEL);
  const [baselineLevel, setBaselineLevel] = useState(MAP_DEFAULT_LEVEL_250M);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [resolvedOnMap, setResolvedOnMap] = useState(/** @type {{ id: string|number, lat: number, lng: number, data?: unknown }[]} */ ([]));
  const [cardDisplayMode, setCardDisplayMode] = useState(() => getCardDisplayMode(MAP_TAB_DEFAULT_LEVEL, MAP_DEFAULT_LEVEL_250M));
  const [areaUnit, setAreaUnit] = useState(/** @type {'py' | 'm2'} */ ('py'));
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
      level: mapLevelFromZoomPercent(ZOOM_PLACE_SEARCH_PERCENT, baselineLevel),
      token: Date.now(),
    });
  }, [baselineLevel]);

  useEffect(() => {
    if (baselineLevel != null) {
      setCardDisplayMode(getCardDisplayMode(mapLevel, baselineLevel));
    }
  }, [baselineLevel, mapLevel]);

  const agentNameOpts = useMemo(
    () => uniquePropAgentNames(P.filter((p) => propertyMatchesDealMode(p, mode))),
    [P, mode],
  );

  const applyAdvSearch = useCallback(() => {
    setAppliedAdv(buildAppliedAdv(advDraft));
  }, [advDraft]);

  const resetAdvSearch = useCallback(() => {
    setAdvDraft(emptyAdvSearchDraft());
    setAppliedAdv(null);
    setFilterResetKey((k) => k + 1);
  }, []);

  const visibleP = useMemo(() => P.filter((p) => {
    if (!propertyMatchesDealMode(p, mode)) return false;
    if (appliedAdv) {
      if (!propertyMatchesAppliedAdv(p, appliedAdv)) return false;
    } else if (statusFilter && p.status !== statusFilter) {
      return false;
    }
    if (propSearch && !propMatchesSearch(p, propSearch)) return false;
    return true;
  }), [P, mode, statusFilter, propSearch, appliedAdv]);

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

  /** 검색·기본 외 상태 필터 활성 시 전체 매물 결과, 아니면 지도 화면 내 매물만 */
  const hasPropFilter = Boolean(propSearch.trim() || appliedAdv || (statusFilter && statusFilter !== MAP_STATUS_DEFAULT));
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
        areaUnit={areaUnit}
      />
    );
  }, [areaUnit, landPy, openPropertyDetail, selectProperty]);

  const loadingCoords = !coordsSettled && mapMarkersStable.length > 0;

  const sidebarProps = {
    propSearch, setPropSearch,
    statusFilter, setStatusFilter,
    listP: sidebarListP,
    listMode: hasPropFilter ? 'search' : 'viewport',
    visibleCount: visibleP.length,
    selectedId, setSelectedId: selectProperty, onOpenDetail: openPropertyDetail,
    loadingCoords,
    onPlaceSelect: handlePlaceSelect,
    areaUnit,
  };

  const advPanel = filterOpen && Btn ? (
    <PropListAdvSearchPanel
      rentList={isRent}
      isMobile={isMobile}
      draft={advDraft}
      setDraft={setAdvDraft}
      agentNameOpts={agentNameOpts}
      onApply={applyAdvSearch}
      onReset={resetAdvSearch}
      Btn={Btn}
      resetKey={filterResetKey}
    />
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: C.bg, minWidth: 0 }}>
      {!isMobile ? (
        <>
          <PH title="지도 보기" sub={mapZoomSub}
            acts={Btn ? (
              <>
                <Btn role="page-secondary" ch="그룹 관리" ic="ti-folder" on={() => onOpen('fm', null)} />
                <Btn role="page-secondary" ch="리스트로 보기" ic="ti-list" on={() => { rememberPropListTab('ALL'); onNav && onNav('properties'); }} />
                <Btn role="page-secondary" ch="일괄 등록" ic="ti-upload" on={() => onNav && onNav('registerBulk')} />
                <Btn role="page-primary" ch="매물 등록" on={() => onNav && onNav('register')} />
              </>
            ) : undefined}
            ch={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 20, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: `1.5px solid ${C.bdr}`, borderRadius: 7, padding: '0 12px', flex: 1, maxWidth: 360 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, flexShrink: 0, color: C.txP }} aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  </span>
                  <input value={propSearch} onChange={(e) => setPropSearch(e.target.value)} placeholder="도로명·지번·건물명 검색..." style={{ border: 'none', background: 'transparent', fontSize: 14, color: C.tx, flex: 1, height: '100%' }} />
                </div>
                {Btn ? (
                  <Btn role="filter" ch={filterOpen ? '필터 닫기' : '상세검색'} ic={filterOpen ? 'ti-x' : 'ti-adjustments-horizontal'} sx={{ gap: 6 }}
                    on={() => setFilterOpen((v) => !v)} />
                ) : null}
              </div>
            } />
          {advPanel}
        </>
      ) : (
        <>
          <div style={{ background: '#fff', borderBottom: `1px solid ${C.bdr}`, padding: '12px 16px', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>지도 보기</div>
            <div style={{ fontSize: 12, color: C.txM, marginBottom: 8 }}>{mapZoomSub}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="search" value={propSearch} onChange={(e) => setPropSearch(e.target.value)} placeholder="도로명·지번·건물명 검색..."
                style={{ flex: 1, height: 36, border: `1.5px solid ${C.bdr}`, borderRadius: 8, padding: '0 10px', fontSize: 14 }} />
              {Btn ? (
                <Btn role="filter" ch={filterOpen ? '닫기' : '상세검색'} ic={filterOpen ? 'ti-x' : 'ti-adjustments-horizontal'} sx={{ gap: 6, flexShrink: 0 }}
                  on={() => setFilterOpen((v) => !v)} />
              ) : null}
            </div>
          </div>
          {advPanel}
        </>
      )}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {!isMobile && <MapPropertySidebar {...sidebarProps} />}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0, minHeight: 360 }}>
          <SiteMap
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
            areaUnit={areaUnit}
            renderMarkerCard={renderMapMarkerCard}
            onMarkerClick={(item) => selectProperty(item.id)}
            onMarkersResolved={handleMarkersResolved}
            onZoomLevelChange={handleZoomLevelChange}
            onBaselineLevelChange={handleBaselineLevelChange}
            onBoundsChange={handleBoundsChange}
            height="100%"
          />
          <MapAreaUnitToggle unit={areaUnit} onChange={setAreaUnit} />
          {isMobile && <MapPlaceSearch onSelect={handlePlaceSelect} isMobile={isMobile} />}
        </div>
      </div>
    </div>
  );
}
