import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isCeoRole, companyRoleLabel, COMPANY_ROLES } from '../data/companyRoles.js';
import {
  fetchCompanyTeam,
  fetchPendingInvites,
  createTeamInvite,
  revokeTeamInvite,
  mapInviteError,
  buildInviteUrl,
} from '../services/teamService.js';

const C = {
  surf: '#fff',
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  brand: '#C8102E',
};

export function TeamInvitePanel({ onToast }) {
  const { company, companyRole, isConfigured } = useAuth();
  const isCeo = isCeoRole(companyRole);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(COMPANY_ROLES.MEMBER);
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState([]);
  const [invites, setInvites] = useState([]);
  const [lastLink, setLastLink] = useState('');

  const reload = useCallback(async () => {
    if (!isConfigured || !company?.id) return;
    try {
      const [t, i] = await Promise.all([fetchCompanyTeam(), fetchPendingInvites()]);
      setTeam(t);
      setInvites(i);
    } catch (err) {
      onToast?.(mapInviteError(err));
    }
  }, [company?.id, isConfigured, onToast]);

  useEffect(() => { reload(); }, [reload]);

  const sendInvite = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      const inv = await createTeamInvite(email, role);
      setLastLink(inv.url);
      setEmail('');
      onToast?.('초대 링크가 생성되었습니다.');
      await reload();
    } catch (err) {
      onToast?.(mapInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      onToast?.('링크를 복사했습니다.');
    } catch {
      onToast?.('복사에 실패했습니다.');
    }
  };

  const revoke = async (id) => {
    try {
      await revokeTeamInvite(id);
      onToast?.('초대를 취소했습니다.');
      await reload();
    } catch (err) {
      onToast?.(mapInviteError(err));
    }
  };

  if (!isConfigured || !company?.id) {
    return (
      <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
        클라우드 로그인 후 팀 기능을 사용할 수 있습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.55 }}>
        워크스페이스: <strong style={{ color: C.tx }}>{company.name}</strong>
        {' · '}내 역할: {companyRoleLabel(companyRole)}
      </div>

      {isCeo && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>초대할 이메일</div>
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>역할</div>
              <select className="sel" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value={COMPANY_ROLES.MEMBER}>직원</option>
                <option value={COMPANY_ROLES.MANAGER}>팀장</option>
              </select>
            </div>
            <button type="button" className="inp" style={{ height: 36, cursor: 'pointer', background: C.brand, color: '#fff', border: 'none', fontWeight: 600 }}
              disabled={busy} onClick={sendInvite}>
              {busy ? '생성 중…' : '초대 링크'}
            </button>
          </div>
          {lastLink && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <input className="inp" readOnly value={lastLink} style={{ flex: 1, fontSize: 12 }} />
              <button type="button" className="inp" style={{ height: 36, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => copyLink(lastLink)}>복사</button>
            </div>
          )}
          <div style={{ fontSize: 11, color: C.txM, lineHeight: 1.5 }}>
            초대 링크는 7일간 유효합니다. 수신자는 <strong>동일한 이메일</strong>로 가입해야 합니다.
          </div>
          {invites.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.txM, marginBottom: 8 }}>대기 중인 초대</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invites.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: C.surf2, borderRadius: 8, fontSize: 12 }}>
                    <span style={{ flex: 1 }}>{inv.invited_email} · {companyRoleLabel(inv.role)}</span>
                    <button type="button" style={{ border: 'none', background: 'transparent', color: C.brand, cursor: 'pointer', fontSize: 12 }}
                      onClick={() => copyLink(inv.url ?? buildInviteUrl(inv.token))}>링크</button>
                    <button type="button" style={{ border: 'none', background: 'transparent', color: C.txM, cursor: 'pointer', fontSize: 12 }}
                      onClick={() => revoke(inv.id)}>취소</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.txM, marginBottom: 8 }}>팀원 ({team.length}명)</div>
        <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 8, overflow: 'hidden' }}>
          <table className="tbl tbl-fixed" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ width: '28%' }}>이름</th>
                <th style={{ width: '36%' }}>이메일</th>
                <th style={{ width: '18%' }}>역할</th>
                <th>가입일</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.user_id}>
                  <td><span className="cell-ellipsis">{m.display_name || '—'}</span></td>
                  <td><span className="cell-ellipsis">{m.email}</span></td>
                  <td>{companyRoleLabel(m.role)}</td>
                  <td>{m.joined_at ? new Date(m.joined_at).toLocaleDateString('ko-KR') : '—'}</td>
                </tr>
              ))}
              {!team.length && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: C.txM, height: 48 }}>팀원이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
