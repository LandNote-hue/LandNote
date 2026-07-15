import { PAGE_HEADER_LAYOUT as L } from '../theme/pageHeaderLayout.js';

/** 매물·고객·멤버 관리 등 탭 페이지 공통 상단 타이틀 영역 */
const C = {
  surf: '#FFFFFF',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
};

/**
 * @param {{
 *   title: string,
 *   sub?: string,
 *   actions?: import('react').ReactNode,
 *   acts?: import('react').ReactNode,
 *   ch?: import('react').ReactNode,
 * }} props
 */
export function PageHeader({ title, sub, actions, acts, ch }) {
  const right = actions || acts;
  return (
    <div style={{
      background: C.surf,
      borderBottom: `1px solid ${C.bdr}`,
      padding: `0 ${L.padX}px`,
      height: L.height,
      display: 'flex',
      alignItems: 'center',
      gap: L.gap,
      flexShrink: 0,
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
    }}>
      <div style={{ flexShrink: 0, minWidth: 0 }}>
        <div style={{
          fontSize: L.titleSize,
          fontWeight: 700,
          color: C.tx,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          {title}
        </div>
        {sub ? (
          <div style={{
            fontSize: L.subSize,
            color: C.txM,
            marginTop: L.subMarginTop,
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 'min(100vw, 960px)',
          }}>
            {sub}
          </div>
        ) : null}
      </div>
      {ch ? <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>{ch}</div> : null}
      {right ? (
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          gap: L.gap * 0.5,
          alignItems: 'center',
          flexShrink: 0,
        }}>
          {right}
        </div>
      ) : null}
    </div>
  );
}

export default PageHeader;
