import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isCeoRole, companyRoleLabel, COMPANY_ROLES, normalizeCompanyRole } from '../data/companyRoles.js';
import { ToggleSwitch } from '../components/ToggleSwitch.jsx';
import {
  createTeamInvite,
  fetchInviteHistory,
  mapInviteError,
  revokeTeamInvite,
  removeTeamMember,
} from '../services/teamService.js';
import {
  fetchMemberPermissionsDashboard,
  saveMemberSharingPolicies,
  mapPermissionError,
} from '../services/memberPermissionsService.js';
import { normalizeMemberPermissions } from '../data/memberPermissions.js';
import { InviteHistoryPanel } from '../components/InviteHistoryPanel.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { BTN_SIZE, btnPx } from '../theme/buttonLayout.js';

const C = {
  surf: '#fff',
  surf2: '#F8F9FB',
  bg: '#F5F6FA',
  thead: '#F8FAFC',
  bdr: '#E8EAED',
  bdrLight: '#F1F5F9',
  tx: '#0F172A',
  txM: '#64748B',
  txS: '#94A3B8',
  brand: '#C8102E',
  brandL: '#FEF2F2',
};

const MD = BTN_SIZE.md;
const SM = BTN_SIZE.sm;

const RESOURCE_GROUPS = [
  { key: 'properties', label: '매물', read: 'read_properties', write: 'write_properties' },
  { key: 'schedules', label: '일정', read: 'read_schedules', write: 'write_schedules' },
  { key: 'calls', label: '통화내역', read: 'read_calls', write: 'write_calls' },
];

function UsersEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** @param {{ onToast?: (msg: string) => void }} props */
export function TeamManagementPage({ onToast }) {
  const navigate = useNavigate();
  const { company, companyRole, profile, accountDefaults, isConfigured, isDevBypass, refreshMemberPermissions } = useAuth();
  const workspaceId = company?.id ?? profile?.company_id ?? null;
  const displayRole = companyRole ?? (profile?.role ? normalizeCompanyRole(profile.role) : null);
  const isCeo = isCeoRole(displayRole);
  const workspaceName = company?.name ?? profile?.agency_name ?? accountDefaults.agencyName ?? '회사';

  const [email, setEmail] = useState('');
  const [role, setRole] = useState(COMPANY_ROLES.MEMBER);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteHistory, setInviteHistory] = useState([]);
  const [members, setMembers] = useState([]);
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [generatedLink, setGeneratedLink] = useState('');
  const [inviteLinkMode, setInviteLinkMode] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(null);

  const reload = useCallback(async () => {
    if (!isConfigured || !workspaceId || !isCeo) return;
    setLoading(true);
    try {
      const [dashboardResult, historyResult] = await Promise.allSettled([
        fetchMemberPermissionsDashboard(),
        fetchInviteHistory(),
      ]);

      if (dashboardResult.status === 'fulfilled') {
        setMembers(dashboardResult.value);
        setDirtyIds(new Set());
      } else {
        console.error('[team] member dashboard', dashboardResult.reason);
        onToast?.(mapPermissionError(dashboardResult.reason));
      }

      if (historyResult.status === 'fulfilled') {
        setInviteHistory(historyResult.value);
      } else {
        console.error('[team] invite history', historyResult.reason);
        onToast?.(mapInviteError(historyResult.reason));
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isConfigured, isCeo, onToast]);

  useEffect(() => { reload(); }, [reload]);

  const resetInviteForm = () => {
    setInviteLinkMode(false);
    setGeneratedLink('');
    setEmail('');
  };

  const sendInvite = async () => {
    if (!email.trim() || inviteBusy) return;
    setInviteBusy(true);
    try {
      const inv = await createTeamInvite(email, role);
      setGeneratedLink(inv.url);
      setInviteLinkMode(true);
      onToast?.('초대 링크가 생성되었습니다.');
      await reload();
    } catch (err) {
      onToast?.(mapInviteError(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const copyLink = async (url) => {
    const ok = await copyTextToClipboard(url);
    onToast?.(ok ? '링크를 복사했습니다.' : '복사에 실패했습니다.');
  };

  const revokeInvite = async (inv) => {
    if (!inv?.id) return;
    const label = inv.invited_email || '해당';
    if (!window.confirm(`${label} 초대를 취소하시겠습니까?\n대기 중인 초대 링크가 모두 무효화됩니다.`)) return;
    setToggleBusy(`revoke:${inv.id}`);
    try {
      const ok = await revokeTeamInvite(inv.id);
      if (!ok) {
        onToast?.('취소할 수 있는 초대가 없습니다.');
        return;
      }
      onToast?.('초대를 취소했습니다.');
      await reload();
    } catch (err) {
      onToast?.(mapInviteError(err));
    } finally {
      setToggleBusy(null);
    }
  };

  const removeMember = async (member) => {
    if (!member?.user_id) return;
    const name = member.display_name || member.email || '직원';
    if (!window.confirm(`${name} 님을 팀에서 제거하시겠습니까?\n계정은 유지되며 개인 워크스페이스로 전환됩니다.`)) return;
    setToggleBusy(`remove:${member.user_id}`);
    try {
      await removeTeamMember(member.user_id);
      onToast?.('직원을 팀에서 제거했습니다.');
      await reload();
      await refreshMemberPermissions?.();
    } catch (err) {
      onToast?.(mapInviteError(err));
    } finally {
      setToggleBusy(null);
    }
  };

  const handleToggle = (userId, permission, next) => {
    setMembers((prev) => prev.map((m) => {
      if (m.user_id !== userId) return m;
      const updated = { ...m, [permission]: next };
      if (permission.startsWith('read_') && !next) {
        updated[permission.replace(/^read_/, 'write_')] = false;
      }
      if (permission.startsWith('write_') && next) {
        updated[permission.replace(/^write_/, 'read_')] = true;
      }
      return updated;
    }));
    setDirtyIds((prev) => new Set(prev).add(userId));
  };

  const handleSaveMember = async (userId) => {
    const member = members.find((m) => m.user_id === userId);
    if (!member) return;
    setToggleBusy(`save:${userId}`);
    try {
      const updated = await saveMemberSharingPolicies(userId, normalizeMemberPermissions(member));
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, ...updated } : m)));
      setDirtyIds((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
      await refreshMemberPermissions?.();
      onToast?.('설정이 저장되었습니다.');
    } catch (err) {
      onToast?.(mapPermissionError(err));
    } finally {
      setToggleBusy(null);
    }
  };

  const handleSaveAll = async () => {
    if (!dirtyIds.size) return;
    setToggleBusy('save:all');
    try {
      for (const userId of [...dirtyIds]) {
        const member = members.find((m) => m.user_id === userId);
        if (!member) continue;
        const updated = await saveMemberSharingPolicies(userId, normalizeMemberPermissions(member));
        setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, ...updated } : m)));
      }
      setDirtyIds(new Set());
      await refreshMemberPermissions?.();
      onToast?.('모든 변경사항이 저장되었습니다.');
    } catch (err) {
      onToast?.(mapPermissionError(err));
    } finally {
      setToggleBusy(null);
    }
  };

  if ((!isConfigured && !isDevBypass) || !workspaceId) {
    return (
      <div style={{ padding: 32, color: C.txM, fontSize: 14 }}>
        클라우드 로그인 후 사내 관리 기능을 사용할 수 있습니다.
      </div>
    );
  }

  if (!isCeo) {
    return (
      <div style={{ padding: 32, color: C.txM, fontSize: 14, lineHeight: 1.6 }}>
        사내 멤버 관리는 대표(CEO) 계정만 이용할 수 있습니다.
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => navigate('/dashboard')} style={{ border: 'none', background: 'transparent', color: C.brand, cursor: 'pointer', fontSize: 13 }}>
            ← 대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <PageHeader
        title="멤버 관리"
        sub={`${workspaceName} · 멤버 ${members.length}명`}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px' }}>
        <section style={{ background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: C.surf2, borderBottom: `1px solid ${C.bdr}`, fontSize: 14, fontWeight: 600 }}>
            직원 초대하기
          </div>
          <div style={{ padding: '16px 18px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(200px, 1fr) 120px auto',
              gap: 10,
              alignItems: 'flex-end',
              width: '100%',
              maxWidth: 640,
            }}>
              {inviteLinkMode ? (
                <>
                  <div style={{ width: 360, maxWidth: '100%', minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>생성된 초대 링크</div>
                    <div className="inp" style={{
                      display: 'flex', alignItems: 'center', height: 36, padding: '0 12px',
                      fontSize: 12, color: C.tx, background: C.thead, overflow: 'hidden',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{generatedLink}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    style={{
                      height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius, border: 'none',
                      background: C.brand, color: '#fff', fontWeight: 600, fontSize: MD.fontSize,
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                    onClick={() => copyLink(generatedLink)}
                  >
                    복사하기
                  </button>
                  <button
                    type="button"
                    style={{
                      height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius,
                      border: `1px solid ${C.bdr}`, background: C.surf, color: C.txM,
                      fontSize: MD.fontSize, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                    onClick={resetInviteForm}
                  >
                    새 초대
                  </button>
                </>
              ) : (
                <>
                  <div style={{ width: 260, maxWidth: '100%', minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>초대할 이메일</div>
                    <input
                      className="inp"
                      type="email"
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }}
                      placeholder="member@example.com"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: '0 0 120px' }}>
                    <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>역할</div>
                    <select className="sel" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
                      <option value={COMPANY_ROLES.MEMBER}>직원</option>
                      <option value={COMPANY_ROLES.MANAGER}>팀장</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={inviteBusy || !email.trim()}
                    onClick={sendInvite}
                    style={{
                      height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius, border: 'none',
                      background: email.trim() && !inviteBusy ? C.brand : C.bdr,
                      color: '#fff', fontWeight: 600, fontSize: MD.fontSize,
                      cursor: email.trim() && !inviteBusy ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {inviteBusy ? '생성 중…' : '초대 링크 발송'}
                  </button>
                </>
              )}
            </div>
            <p style={{ fontSize: 11, color: C.txS, lineHeight: 1.5, marginTop: 12, marginBottom: 0 }}>
              초대 링크는 7일간 유효합니다. 수신자는 동일한 이메일로 가입하면 자동으로 팀에 합류합니다.
            </p>
          </div>
        </section>

        <InviteHistoryPanel
          invites={inviteHistory}
          onCopySuccess={() => onToast?.('링크를 복사했습니다.')}
          onCopyFail={() => onToast?.('복사에 실패했습니다.')}
          onRevoke={revokeInvite}
          revokeBusyId={toggleBusy}
        />

        <section style={{ background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: C.surf2, borderBottom: `1px solid ${C.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              직원 권한 관리
              <span style={{ fontWeight: 400, color: C.txM, marginLeft: 8, fontSize: 12 }}>
                기본 꺼짐 · 토글 후 「저장」을 눌러야 반영됩니다
              </span>
            </div>
            <button
              type="button"
              disabled={!dirtyIds.size || toggleBusy === 'save:all'}
              onClick={handleSaveAll}
              style={{
                height: 32, padding: '0 12px', borderRadius: 7, border: 'none',
                background: dirtyIds.size ? C.brand : C.bdr, color: '#fff',
                fontSize: 12, fontWeight: 600,
                cursor: dirtyIds.size ? 'pointer' : 'not-allowed',
              }}
            >
              {toggleBusy === 'save:all' ? '저장 중…' : `설정 저장${dirtyIds.size ? ` (${dirtyIds.size})` : ''}`}
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: C.txM, fontSize: 13 }}>불러오는 중…</div>
          ) : !members.length ? (
            <div style={{ padding: '56px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <UsersEmptyIcon />
              <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, lineHeight: 1.4 }}>
                아직 초대·가입한 직원이 없습니다
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: C.txM, lineHeight: 1.65, maxWidth: 340 }}>
                위에서 직원 이메일을 입력하고 초대 링크를 발송하면 권한 관리가 시작됩니다.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ fontSize: 13, minWidth: 720 }}>
                <thead style={{ background: C.thead }}>
                  <tr>
                    <th style={{ width: '22%', textAlign: 'left', background: C.thead }}>직원</th>
                    {RESOURCE_GROUPS.map((g) => (
                      <th key={g.key} colSpan={2} style={{ textAlign: 'center', borderLeft: `1px solid ${C.bdrLight}`, background: C.thead }}>
                        {g.label}
                      </th>
                    ))}
                    <th style={{ width: 80, background: C.thead }} />
                    <th style={{ width: 72, textAlign: 'center', background: C.thead }}>관리</th>
                  </tr>
                  <tr>
                    <th style={{ background: C.thead }} />
                    {RESOURCE_GROUPS.flatMap((g) => ([
                      <th key={`${g.key}-r`} style={{ fontSize: 11, fontWeight: 500, color: C.txM, textAlign: 'center', borderLeft: `1px solid ${C.bdrLight}`, background: C.thead }}>보기</th>,
                      <th key={`${g.key}-w`} style={{ fontSize: 11, fontWeight: 500, color: C.txM, textAlign: 'center', background: C.thead }}>쓰기</th>,
                    ]))}
                    <th style={{ width: 80, fontSize: 11, color: C.txM, background: C.thead }}>저장</th>
                    <th style={{ width: 72, fontSize: 11, color: C.txM, textAlign: 'center', background: C.thead }}>제거</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id} style={dirtyIds.has(m.user_id) ? { background: C.brandL } : undefined}>
                      <td>
                        <div style={{ fontWeight: 600, color: C.tx }}>{m.display_name || '—'}</div>
                        <div style={{ fontSize: 11, color: C.txM, marginTop: 2 }}>{m.email}</div>
                        <div style={{ fontSize: 11, color: C.txM }}>{companyRoleLabel(m.role)}</div>
                      </td>
                      {RESOURCE_GROUPS.flatMap((g) => ([
                        <td key={`${m.user_id}-${g.read}`} style={{ textAlign: 'center', borderLeft: `1px solid ${C.bdrLight}` }}>
                          <ToggleSwitch
                            checked={!!m[g.read]}
                            label={`${m.display_name} ${g.label} 보기`}
                            onChange={(next) => handleToggle(m.user_id, g.read, next)}
                          />
                        </td>,
                        <td key={`${m.user_id}-${g.write}`} style={{ textAlign: 'center' }}>
                          <ToggleSwitch
                            checked={!!m[g.write]}
                            disabled={!m[g.read]}
                            label={`${m.display_name} ${g.label} 쓰기`}
                            onChange={(next) => handleToggle(m.user_id, g.write, next)}
                          />
                        </td>,
                      ]))}
                      <td style={{ textAlign: 'center' }}>
                        {dirtyIds.has(m.user_id) && (
                          <button type="button" disabled={toggleBusy === `save:${m.user_id}`}
                            onClick={() => handleSaveMember(m.user_id)}
                            style={{ height: SM.height, padding: `0 ${SM.padX}px`, borderRadius: SM.borderRadius, border: 'none', background: C.brand, color: '#fff', fontSize: SM.fontSize, fontWeight: 600, cursor: 'pointer' }}>
                            {toggleBusy === `save:${m.user_id}` ? '…' : '저장'}
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={toggleBusy === `remove:${m.user_id}`}
                          onClick={() => removeMember(m)}
                          style={{
                            border: 'none', background: 'transparent',
                            color: toggleBusy === `remove:${m.user_id}` ? C.txS : '#DC2626',
                            cursor: toggleBusy === `remove:${m.user_id}` ? 'not-allowed' : 'pointer',
                            fontSize: 12, fontWeight: 600, padding: '4px 6px', whiteSpace: 'nowrap',
                          }}
                        >
                          {toggleBusy === `remove:${m.user_id}` ? '…' : '팀에서 제거'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default TeamManagementPage;
