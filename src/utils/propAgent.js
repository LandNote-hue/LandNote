import { formatPhone } from './formatPhone.js';

/** 담당자 미입력 */
export const PROP_AGENT_NONE = '__NONE__';

export function propAgentName(p) {
  return String(p?.agentName || '').trim();
}

export function propAgentLabel(p) {
  return propAgentName(p) || '—';
}

/** @param {unknown[]} props */
export function uniquePropAgentNames(props) {
  const names = new Set();
  for (const p of props || []) {
    const n = propAgentName(p);
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ko'));
}

export function propertyMatchesAgentFilter(p, agent) {
  if (!agent) return true;
  const n = propAgentName(p);
  if (agent === PROP_AGENT_NONE) return !n;
  return n === agent;
}

/**
 * 매물 담당자 드롭다운 — 본인(내 정보) + 팀 멤버
 * @param {Array<{ user_id?: string, display_name?: string, phone?: string }>|null|undefined} teamMembers
 * @param {{ displayName?: string, phone?: string, tel?: string }|null|undefined} accountDefaults
 */
export function buildTeamAgentDirectory(teamMembers, accountDefaults) {
  /** @type {Map<string, { name: string, phone: string }>} */
  const map = new Map();
  const add = (name, phone) => {
    const n = String(name || '').trim();
    if (!n) return;
    const tel = formatPhone(phone) || '';
    const prev = map.get(n);
    if (!prev) map.set(n, { name: n, phone: tel });
    else if (!prev.phone && tel) map.set(n, { name: n, phone: tel });
  };
  add(accountDefaults?.displayName, accountDefaults?.phone || accountDefaults?.tel);
  for (const m of teamMembers || []) {
    add(m.display_name, m.phone);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** @param {{ name: string, phone: string }[]} directory */
export function phoneForAgentName(directory, name) {
  const n = String(name || '').trim();
  if (!n) return '';
  return directory.find((a) => a.name === n)?.phone || '';
}
