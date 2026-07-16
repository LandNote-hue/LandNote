import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENU_PATHS } from '../navigation/routes.js';

const BRAND = '#C8102E';
const SIDEBAR = '#1A2332';

const TAB_ITEMS = [
  { id: 'dashboard', label: '홈', path: MENU_PATHS.dashboard },
  { id: 'properties', label: '매물', path: MENU_PATHS.properties },
  { id: 'mapview', label: '지도', path: MENU_PATHS.mapview },
  { id: 'customers', label: '고객', path: MENU_PATHS.customers },
];

const MORE_ITEMS = [
  { id: 'calls', label: '통화 내역' },
  { id: 'calendar', label: '일정 관리' },
  { id: 'desktop', label: 'PC버전으로 보기' },
];

const TabIcon = ({ id, active }) => {
  const c = active ? BRAND : 'rgba(255,255,255,.45)';
  const icons = {
    dashboard: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>),
    properties: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg>),
    mapview: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>),
    customers: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
    more: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="5" r="1.5" fill={c}/><circle cx="12" cy="12" r="1.5" fill={c}/><circle cx="12" cy="19" r="1.5" fill={c}/></svg>),
  };
  return icons[id] || null;
};

export function MobileShell({
  children,
  screenTitle,
  menuId,
  onSettings,
  onSignOut,
  onViewDesktop,
}) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_ITEMS.some((m) => m.id === menuId);

  const go = (id) => {
    setMoreOpen(false);
    if (id === 'desktop') {
      onViewDesktop?.();
      return;
    }
    navigate(MENU_PATHS[id] || '/dashboard');
  };

  return (
    <div style={{
      width: '100%', height: '100dvh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#F5F6FA', fontFamily: 'inherit',
    }}>
      <header style={{
        height: 52, background: SIDEBAR, display: 'flex', alignItems: 'center',
        padding: '0 16px', flexShrink: 0, gap: 10,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <button type="button" onClick={() => go('dashboard')} aria-label="대시보드로 이동"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: BRAND, letterSpacing: '-.02em' }}>LandNote</span>
        </button>
        {screenTitle && screenTitle !== 'LandNote' && (
          <>
            <span style={{ color: 'rgba(255,255,255,.25)', fontSize: 12 }}>›</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {screenTitle}
            </span>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button type="button" onClick={onSettings} aria-label="설정"
            style={headerBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          {onSignOut && (
            <button type="button" onClick={onSignOut} aria-label="로그아웃" style={headerBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </main>

      {moreOpen && (
        <>
          <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 400 }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401,
            background: '#fff', borderRadius: '16px 16px 0 0', padding: '12px 8px calc(12px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -8px 32px rgba(0,0,0,.12)',
          }}>
            {MORE_ITEMS.map((m) => (
              <button key={m.id} type="button" onClick={() => go(m.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', border: 'none', background: menuId === m.id ? '#FBE9EC' : 'transparent',
                  borderRadius: 10, fontSize: 15, fontWeight: menuId === m.id ? 600 : 400,
                  color: menuId === m.id ? BRAND : '#0F172A', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      <nav style={{
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: SIDEBAR, display: 'flex', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,.08)',
      }}>
        {TAB_ITEMS.map((t) => {
          const active = menuId === t.id;
          return (
            <button key={t.id} type="button" onClick={() => go(t.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 0',
                fontFamily: 'inherit',
              }}>
              <TabIcon id={t.id} active={active} />
              <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? BRAND : 'rgba(255,255,255,.45)' }}>{t.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 0',
            fontFamily: 'inherit',
          }}>
          <TabIcon id="more" active={isMoreActive || moreOpen} />
          <span style={{ fontSize: 11, fontWeight: isMoreActive ? 600 : 400, color: isMoreActive ? BRAND : 'rgba(255,255,255,.45)' }}>더보기</span>
        </button>
      </nav>
    </div>
  );
}

const headerBtn = {
  width: 40, height: 40, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
