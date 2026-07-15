import React from 'react';

/** App.jsx C 토큰과 동일 — 레이아웃 전용 */
const C = {
  brand: '#C8102E',
  bg: '#F5F6FA',
  surf: '#FFFFFF',
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
};

/**
 * 매물 상세 Win — 30% / 45% / 25% 3분할 (레이아웃 전용)
 * - 좌: 사진·지도 고정 (내부 스크롤 없음)
 * - 중: 스펙 정보 (독립 세로 스크롤)
 * - 우: 통화 CRM (리스트만 내부 스크롤)
 */
export function PropertyDetailNewWin({ leftTop, leftBottom, center, right, footer }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: C.surf,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '30% 45% 25%',
          overflow: 'hidden',
        }}
      >
        {/* ── 좌측 30%: 사진(70%) + 지도(30%) ── */}
        <aside
          style={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            borderRight: `1px solid ${C.bdr}`,
            background: C.surf,
          }}
        >
          <div
            style={{
              flex: '7 1 0',
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              borderBottom: `1px solid ${C.bdr}`,
            }}
          >
            {leftTop}
          </div>
          <div
            style={{
              flex: '3 1 0',
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              isolation: 'isolate',
            }}
          >
            {leftBottom}
          </div>
        </aside>

        {/* ── 중앙 45%: 스펙 전체 연속 스크롤 ── */}
        <main
          style={{
            height: '100%',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: C.surf,
            borderRight: `1px solid ${C.bdr}`,
          }}
        >
          {center}
        </main>

        {/* ── 우측 25%: 통화 CRM ── */}
        <aside
          style={{
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
            background: C.surf,
            boxSizing: 'border-box',
          }}
        >
          {right}
        </aside>
      </div>
      {footer}
    </div>
  );
}
