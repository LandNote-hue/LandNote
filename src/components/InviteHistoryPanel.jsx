import { companyRoleLabel } from '../data/companyRoles.js';
import { buildInviteUrl } from '../services/teamService.js';
import { copyTextToClipboard } from '../utils/copyToClipboard.js';

const C = {
  surf2: '#F8F9FB',
  thead: '#F8FAFC',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#64748B',
  txS: '#94A3B8',
  brand: '#C8102E',
  brandL: '#FEF2F2',
};

const INVITE_STATUS_LABEL = {
  pending: '대기중',
  accepted: '가입완료',
  expired: '만료',
};

function formatInviteDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * @param {{
 *   invites: Array<{ id: string, invited_email?: string, role?: string, created_at?: string, status?: string, token?: string }>,
 *   onCopySuccess?: () => void,
 *   onCopyFail?: () => void,
 *   onRevoke?: (inv: object) => void,
 *   revokeBusyId?: string | null,
 * }} props
 */
export function InviteHistoryPanel({
  invites = [],
  onCopySuccess,
  onCopyFail,
  onRevoke,
  revokeBusyId = null,
}) {
  const handleCopyLink = async (token) => {
    const ok = await copyTextToClipboard(buildInviteUrl(token));
    if (ok) onCopySuccess?.();
    else onCopyFail?.();
  };

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.bdr}`, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: C.surf2, borderBottom: `1px solid ${C.bdr}`, fontSize: 14, fontWeight: 600 }}>
        초대 진행 이력
      </div>
      {invites.length === 0 ? (
        <div style={{ padding: '36px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.txM }}>아직 발송한 초대 이력이 없습니다.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ fontSize: 13, minWidth: 640 }}>
            <thead style={{ background: C.thead }}>
              <tr>
                <th style={{ textAlign: 'left', background: C.thead }}>초대 이메일</th>
                <th style={{ width: 88, textAlign: 'center', background: C.thead }}>지정 역할</th>
                <th style={{ width: 150, textAlign: 'center', background: C.thead }}>초대 일시</th>
                <th style={{ width: 88, textAlign: 'center', background: C.thead }}>상태</th>
                <th style={{ width: 140, textAlign: 'center', background: C.thead }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const status = inv.status || 'pending';
                const statusLabel = INVITE_STATUS_LABEL[status] || status;
                const statusColor = status === 'pending' ? C.brand : status === 'accepted' ? '#16A34A' : C.txS;
                const busy = revokeBusyId === `revoke:${inv.id}`;
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500 }}>{inv.invited_email}</td>
                    <td style={{ textAlign: 'center', color: C.txM }}>{companyRoleLabel(inv.role)}</td>
                    <td style={{ textAlign: 'center', color: C.txM, fontSize: 12 }}>{formatInviteDate(inv.created_at)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600, color: statusColor,
                        background: status === 'pending' ? C.brandL : status === 'accepted' ? '#F0FDF4' : C.surf2,
                      }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {status === 'pending' && inv.token ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleCopyLink(inv.token)}
                            style={{
                              border: 'none', background: 'transparent', color: C.brand,
                              cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 6px',
                            }}
                          >
                            링크 재복사
                          </button>
                          {onRevoke && (
                            <>
                              <span style={{ color: C.bdr, fontSize: 11 }}>|</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onRevoke(inv)}
                                style={{
                                  border: 'none', background: 'transparent', color: C.txM,
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                  fontSize: 12, fontWeight: 600, padding: '4px 6px',
                                }}
                              >
                                {busy ? '취소 중…' : '초대 취소'}
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: C.txS, fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default InviteHistoryPanel;
