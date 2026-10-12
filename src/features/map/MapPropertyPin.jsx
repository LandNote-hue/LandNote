/** 지도 매물 핀 — CustomOverlay 하단(yAnchor:1) = 핀 끝 */
export function MapPropertyPin({ selected = false, fill: fillProp, size = 26 }) {
  const fill = fillProp || (selected ? 'var(--ln-brand)' : '#64748B');
  const height = Math.round((size * 36) / 26);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 26 36"
      aria-hidden
      style={{ display: 'block', flexShrink: 0 }}
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
