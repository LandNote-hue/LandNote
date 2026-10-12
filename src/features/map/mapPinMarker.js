/** MapPropertyPin SVG — 네이버 Marker icon (줌 시 좌표 고정) */

export const PIN_WIDTH = 26;
export const PIN_HEIGHT = 36;
/** 카드 오버레이 하단 여백 = 핀 높이 + marginTop(2) */
export const CARD_PIN_GAP_PX = 38;

const PIN_SVG = (fill) => (
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 26 36">`
  + `<path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 23 13 23s13-13.25 13-23C26 5.8 20.2 0 13 0z" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`
  + `<circle cx="13" cy="12" r="4.5" fill="#fff"/>`
  + '</svg>'
);

function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const PIN_IMAGE = {
  default: svgDataUrl(PIN_SVG('#2563EB')),
  selected: svgDataUrl(PIN_SVG('#C8102E')),
};

/** @param {boolean} [selected] */
export function createPropertyPinMarkerIcon(selected = false) {
  const src = selected ? PIN_IMAGE.selected : PIN_IMAGE.default;
  const naver = window.naver;
  return {
    url: src,
    size: new naver.maps.Size(PIN_WIDTH, PIN_HEIGHT),
    scaledSize: new naver.maps.Size(PIN_WIDTH, PIN_HEIGHT),
    anchor: new naver.maps.Point(PIN_WIDTH / 2, PIN_HEIGHT),
  };
}
