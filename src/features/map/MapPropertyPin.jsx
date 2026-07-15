/** 지도 매물 핀 — CustomOverlay 하단(yAnchor:1) = 핀 끝 */
export function MapPropertyPin({ selected = false }) {
  const fill = selected ? '#C8102E' : '#2563EB';
  return (
    <svg
      width="26"
      height="36"
      viewBox="0 0 26 36"
      aria-hidden
      style={{ display: 'block', flexShrink: 0, marginTop: 2 }}
    >
      <path
        d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 23 13 23s13-13.25 13-23C26 5.8 20.2 0 13 0z"
        fill={fill}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <circle cx="13" cy="12" r="4.5" fill="#fff" />
    </svg>
  );
}
