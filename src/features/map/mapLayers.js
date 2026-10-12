import { coordToLatLng } from '../../services/naver/naverMaps.js';

function layerStore(map) {
  if (!map.__lnLayers) map.__lnLayers = {};
  return map.__lnLayers;
}

/** @param {object} map @param {'roadmap' | 'skyview'} surface */
export function setMapSurface(map, surface) {
  const naver = window.naver;
  if (!map || !naver?.maps?.MapTypeId) return;
  map.__lnSurface = surface;
  const terrainOn = Boolean(map.__lnTerrainOn);
  if (surface === 'skyview') {
    map.setMapTypeId(naver.maps.MapTypeId.HYBRID);
    return;
  }
  map.setMapTypeId(terrainOn ? naver.maps.MapTypeId.TERRAIN : naver.maps.MapTypeId.NORMAL);
}

/**
 * @param {object} map
 * @param {'traffic' | 'terrain' | 'bicycle' | 'useDistrict'} layerId
 * @param {boolean} enabled
 */
export function setMapOverlayLayer(map, layerId, enabled) {
  const naver = window.naver;
  if (!map || !naver?.maps) return;
  const layers = layerStore(map);

  if (layerId === 'terrain') {
    map.__lnTerrainOn = enabled;
    setMapSurface(map, map.__lnSurface === 'skyview' ? 'skyview' : 'roadmap');
    return;
  }

  if (layerId === 'traffic') {
    if (!layers.traffic && typeof naver.maps.TrafficLayer === 'function') {
      layers.traffic = new naver.maps.TrafficLayer();
    }
    layers.traffic?.setMap(enabled ? map : null);
    return;
  }

  if (layerId === 'bicycle') {
    if (!layers.bicycle && typeof naver.maps.BicycleLayer === 'function') {
      layers.bicycle = new naver.maps.BicycleLayer();
    }
    layers.bicycle?.setMap(enabled ? map : null);
    return;
  }

  if (layerId === 'useDistrict') {
    if (!layers.cadastral && typeof naver.maps.CadastralLayer === 'function') {
      layers.cadastral = new naver.maps.CadastralLayer();
    }
    layers.cadastral?.setMap(enabled ? map : null);
  }
}

/** @param {object} map @param {boolean} enabled */
export function setStreetLayer(map, enabled) {
  const naver = window.naver;
  if (!map || typeof naver?.maps?.StreetLayer !== 'function') return;
  const layers = layerStore(map);
  if (!layers.street) layers.street = new naver.maps.StreetLayer();
  layers.street.setMap(enabled ? map : null);
}

export function clearMapOverlayLayers(map) {
  if (!map) return;
  const layers = map.__lnLayers;
  if (layers) {
    Object.values(layers).forEach((layer) => {
      try { layer?.setMap?.(null); } catch { /* ignore */ }
    });
  }
  map.__lnLayers = {};
  map.__lnTerrainOn = false;
  map.__lnSurface = 'roadmap';
}

/** @param {object} map */
export function buildNaverMapExportUrl(map) {
  const center = coordToLatLng(map.getCenter());
  const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 15;
  return `https://map.naver.com/p?c=${zoom}.00,0,0,0,dh&lng=${center.lng}&lat=${center.lat}`;
}
