import { useMemo } from 'react';
import { PhoneInput } from './PhoneInput.jsx';
import { buildTeamAgentDirectory, phoneForAgentName } from '../utils/propAgent.js';

/**
 * 매물 담당자 — 팀/내 정보 목록에서 선택하면 연락처 자동 입력
 */
export function PropAgentFields({
  detailForm,
  setDetailForm,
  teamMembers,
  accountDefaults,
  Label,
}) {
  const agents = useMemo(
    () => buildTeamAgentDirectory(teamMembers, accountDefaults),
    [teamMembers, accountDefaults],
  );
  const currentName = String(detailForm?.agentName || '').trim();
  const known = agents.some((a) => a.name === currentName);

  const applyAgent = (name) => {
    const n = String(name || '').trim();
    const phone = n ? phoneForAgentName(agents, n) : '';
    setDetailForm((f) => ({ ...f, agentName: n, agentTel: n ? (phone || f.agentTel || '') : '' }));
  };

  const nameField = (
    <select
      className="sel"
      value={currentName}
      onChange={(e) => applyAgent(e.target.value)}
      style={{ width: '100%' }}
    >
      <option value="">담당자 선택</option>
      {agents.map((a) => (
        <option key={a.name} value={a.name}>{a.name}</option>
      ))}
      {currentName && !known && (
        <option value={currentName}>{currentName}</option>
      )}
    </select>
  );

  const telField = (
    <PhoneInput
      value={detailForm?.agentTel || ''}
      onChange={(e) => setDetailForm((f) => ({ ...f, agentTel: e.target.value }))}
      placeholder="선택 시 자동 입력"
    />
  );

  if (Label) {
    return (
      <>
        <div>
          <Label>담당자</Label>
          {nameField}
        </div>
        <div>
          <Label>담당자 연락처</Label>
          {telField}
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>담당자</div>
        {nameField}
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>담당자 연락처</div>
        {telField}
      </div>
    </>
  );
}
