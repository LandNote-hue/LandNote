import { propertySyncUiLabel } from '../utils/recordSyncState.js';

const STYLES = {
  device: { color: '#64748B', bg: '#F1F5F9' },
  cloud: { color: '#047857', bg: '#ECFDF5' },
  pending: { color: '#B45309', bg: '#FFFBEB' },
  failed: { color: '#B91C1C', bg: '#FEF2F2' },
  conflict: { color: '#B91C1C', bg: '#FEF2F2' },
};

/**
 * @param {{ rec: Record<string, unknown>, cloudEnabled?: boolean }} props
 */
export function PropSyncHint({ rec, cloudEnabled = true }) {
  const { key, text } = propertySyncUiLabel(rec, { cloudEnabled });
  const s = STYLES[key] || STYLES.device;
  return (
    <span
      title={rec?.syncError ? String(rec.syncError) : text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginTop: 4,
        fontSize: 10,
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        borderRadius: 4,
        padding: '1px 6px',
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}
