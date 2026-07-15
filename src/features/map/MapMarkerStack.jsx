import React from 'react';
import { MapInfoCard } from './MapInfoCard.jsx';
import { MapPropertyPin } from './MapPropertyPin.jsx';

/**
 * 카드 + 핀을 하나의 DOM 트리로 묶어 CustomOverlay 앵커(yAnchor:1) = 핀 끝
 */
export function MapMarkerStack({
  p, mode, selected, onSelect, onOpenDetail, landPy,
}) {
  const wrapStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxSizing: 'border-box',
    cursor: onSelect ? 'pointer' : 'default',
  };

  if (mode === 'none') {
    return (
      <div onClick={onSelect} style={wrapStyle}>
        <MapPropertyPin selected={selected} />
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={wrapStyle}
    >
      <MapInfoCard
        p={p}
        inline
        mode={mode}
        selected={selected}
        onSelect={onSelect}
        onOpenDetail={onOpenDetail}
        landPy={landPy}
      />
      <MapPropertyPin selected={selected} />
    </div>
  );
}
