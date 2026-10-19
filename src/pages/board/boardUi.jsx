import { BOARD } from '../../theme/boardTheme.js';

export function Ico({ d, size = 16, stroke = 'currentColor', fill = 'none', children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const BoardIco = {
  write: (p) => <Ico {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></Ico>,
  clip: (p) => <Ico {...p}><rect x="8" y="4" width="12" height="16" rx="2"/><path d="M16 4V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1"/><path d="M11 10h6M11 14h6"/></Ico>,
  star: (p) => <Ico {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ico>,
  starFill: (p) => <Ico fill={BOARD.brand} stroke={BOARD.brand} {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ico>,
  folder: (p) => <Ico {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></Ico>,
  trash: (p) => <Ico {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Ico>,
  search: (p) => <Ico {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ico>,
  paperclip: (p) => <Ico {...p}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></Ico>,
  comment: (p) => <Ico {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Ico>,
  chevron: (p) => <Ico {...p}><polyline points="6 9 12 15 18 9"/></Ico>,
  gear: (p) => <Ico {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ico>,
  list: (p) => <Ico {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Ico>,
  cards: (p) => <Ico {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Ico>,
  sort: (p) => <Ico {...p}><path d="M11 5h10M11 12h7M11 19h4"/><path d="M3 8l3-3 3 3M6 5v14"/></Ico>,
};

export function NotifyDot() {
  return <span title="알림 설정" style={{ width: 6, height: 6, borderRadius: '50%', background: BOARD.brand, display: 'inline-block', flexShrink: 0, marginLeft: 4 }} />;
}

export function UnreadDot() {
  return <span aria-label="읽지 않음" style={{ width: 6, height: 6, borderRadius: '50%', background: BOARD.brand, display: 'inline-block', flexShrink: 0 }} />;
}

export function MustBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px',
      borderRadius: 4, background: BOARD.brand, color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.02em',
    }}>공지</span>
  );
}

export function ImportantBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 6px',
      borderRadius: 4, background: '#1E3A5F', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.02em',
    }}>중요</span>
  );
}

export function comingSoon(label) {
  window.alert(`${label} 기능은 준비 중입니다.`);
}
