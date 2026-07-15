import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  fetchCompanyTeam,
  fetchSharingPolicies,
  upsertSharingPolicy,
  deleteSharingPolicy,
  mapInviteError,
} from '../services/teamService.js';

const C = {
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  brand: '#C8102E',
};

/** @typedef {{ share_properties: boolean, share_calls: boolean, share_schedules: boolean, id?: number }} ShareFlags */

export function SharingPoliciesPanel({ onToast }) {
  const { user, company, isConfigured } = useAuth();
  const [team, setTeam] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const others = useMemo(
    () => team.filter((m) => m.user_id !== user?.id),
    [team, user?.id],
  );

  const policyByGrantee = useMemo(() => {
    /** @type {Record<string, ShareFlags>} */
    const map = {};
    for (const p of policies) {
      map[p.grantee_user_id] = {
        id: p.id,
        share_properties: p.share_properties,
        share_calls: p.share_calls,
        share_schedules: p.share_schedules,
      };
    }
    return map;
  }, [policies]);

  const reload = useCallback(async () => {
    if (!isConfigured || !company?.id || !user?.id) return;
    try {
      const [t, p] = await Promise.all([
        fetchCompanyTeam(),
        fetchSharingPolicies(company.id, user.id),
      ]);
      setTeam(t);
      setPolicies(p);
    } catch (err) {
      onToast?.(mapInviteError(err));
    }
  }, [company?.id, isConfigured, user?.id, onToast]);

  useEffect(() => { reload(); }, [reload]);

  /** @param {string} granteeId @param {'share_properties'|'share_calls'|'share_schedules'} key @param {boolean} checked */
  const toggle = async (granteeId, key, checked) => {
    if (!company?.id || savingId) return;
    const prev = policyByGrantee[granteeId] || {
      share_properties: false,
      share_calls: false,
      share_schedules: false,
    };
    const next = { ...prev, [key]: checked };
    const allOff = !next.share_properties && !next.share_calls && !next.share_schedules;

    setSavingId(granteeId);
    try {
      if (allOff && prev.id) {
        await deleteSharingPolicy(prev.id);
      } else if (!allOff) {
        await upsertSharingPolicy(company.id, granteeId, next);
      }
      await reload();
      onToast?.('공유 설정이 저장되었습니다.');
    } catch (err) {
      onToast?.(mapInviteError(err));
    } finally {
      setSavingId(null);
    }
  };

  if (!isConfigured || !company?.id) {
    return (
      <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
        클라우드 로그인 후 데이터 공유 설정을 사용할 수 있습니다.
      </div>
    );
  }

  if (!others.length) {
    return (
      <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
        팀원이 추가되면 매물·통화·일정 공유 대상을 선택할 수 있습니다. 고객 정보는 팀원 간 공유되지 않습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.55 }}>
        내 데이터 중 선택한 항목만 해당 팀원에게 공개됩니다. <strong>고객 정보는 공유할 수 없습니다.</strong>
      </div>
      <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 8, overflow: 'hidden' }}>
        <table className="tbl" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>팀원</th>
              <th style={{ width: 72, textAlign: 'center' }}>매물</th>
              <th style={{ width: 72, textAlign: 'center' }}>통화</th>
              <th style={{ width: 72, textAlign: 'center' }}>일정</th>
            </tr>
          </thead>
          <tbody>
            {others.map((m) => {
              const flags = policyByGrantee[m.user_id] || {
                share_properties: false,
                share_calls: false,
                share_schedules: false,
              };
              const disabled = savingId === m.user_id;
              return (
                <tr key={m.user_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.display_name || m.email}</div>
                    <div style={{ fontSize: 11, color: C.txM }}>{m.email}</div>
                  </td>
                  {(['share_properties', 'share_calls', 'share_schedules']).map((key) => (
                    <td key={key} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!flags[key]}
                        disabled={disabled}
                        onChange={(e) => toggle(m.user_id, key, e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: C.brand, cursor: disabled ? 'wait' : 'pointer' }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: C.txM, lineHeight: 1.5, padding: '8px 10px', background: C.surf2, borderRadius: 8 }}>
        대표(CEO)는 별도 설정 없이 회사 전체 데이터를 조회합니다. 변경 후 직원이 로그인하거나 대시보드「동기화」를 하면 공유 데이터가 반영됩니다.
      </div>
    </div>
  );
}
