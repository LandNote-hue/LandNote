import { propertySyncUiLabel } from '../utils/recordSyncState.js';

const MARK = {
  cloud: { color: '#059669', title: '클라우드 반영 완료' },
  pending: { color: '#D97706', title: '동기화 대기' },
  failed: { color: '#DC2626', title: '동기화 실패' },
  conflict: { color: '#DC2626', title: '동기화 충돌' },
};

function CheckIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/**
 * 주소 앞 동기화 표시 — 반영 완료는 초록 체크만. 문구 배지는 쓰지 않음.
 * @param {{ rec: Record<string, unknown>, cloudEnabled?: boolean }} props
 */
export function PropSyncHint({ rec, cloudEnabled = true }) {
  const { key, text } = propertySyncUiLabel(rec, { cloudEnabled });
  const mark = MARK[key];
  if (!mark) return null;
  return (
    <span
      title={rec?.syncError ? String(rec.syncError) : (text || mark.title)}
      aria-label={mark.title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: 14,
        height: 18,
        marginTop: 1,
      }}
    >
      {key === 'cloud' ? <CheckIcon color={mark.color} /> : <AlertIcon color={mark.color} />}
    </span>
  );
}
