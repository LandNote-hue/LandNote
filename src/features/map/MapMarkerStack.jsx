import React from 'react';
import { MapInfoCard } from './MapInfoCard.jsx';
import { MapPropertyPin } from './MapPropertyPin.jsx';
import { typeTheme } from './mapCardMeta.js';

/** 핀 끝이 좌표. 카드는 스팟 북쪽 정중앙. */
export function MapMarkerStack({
  p, mode, selected, onSelect, onOpenDetail, areaUnit = 'py',
}) {
  const theme = typeTheme(p);

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <div style={{ marginBottom: 2 }}>
        <MapInfoCard
          p={p}
          inline
          mode={mode}
          selected={selected}
          onSelect={onSelect}
          onOpenDetail={onOpenDetail}
          areaUnit={areaUnit}
        />
      </div>
      <MapPropertyPin selected={selected} fill={theme.pin} />
    </div>
  );
}
