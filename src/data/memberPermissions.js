/** @typedef {'properties' | 'schedules' | 'call_logs'} ShareResource */

/** @typedef {{
 *   read_properties: boolean,
 *   write_properties: boolean,
 *   read_schedules: boolean,
 *   write_schedules: boolean,
 *   read_calls: boolean,
 *   write_calls: boolean,
 * }} MemberPermissions */

/** @readonly */
export const PERMISSION_FIELDS = [
  'read_properties',
  'write_properties',
  'read_schedules',
  'write_schedules',
  'read_calls',
  'write_calls',
];

/** @type {MemberPermissions} */
export const DEFAULT_MEMBER_PERMISSIONS = {
  read_properties: false,
  write_properties: false,
  read_schedules: false,
  write_schedules: false,
  read_calls: false,
  write_calls: false,
};

/** @type {MemberPermissions} */
export const CEO_FULL_PERMISSIONS = {
  read_properties: true,
  write_properties: true,
  read_schedules: true,
  write_schedules: true,
  read_calls: true,
  write_calls: true,
};

/** @type {Record<ShareResource, keyof MemberPermissions>} */
export const RESOURCE_READ_KEYS = {
  properties: 'read_properties',
  schedules: 'read_schedules',
  call_logs: 'read_calls',
};

/** @type {Record<ShareResource, keyof MemberPermissions>} */
export const RESOURCE_WRITE_KEYS = {
  properties: 'write_properties',
  schedules: 'write_schedules',
  call_logs: 'write_calls',
};

/** @type {Record<keyof MemberPermissions, string>} */
export const PERMISSION_LABELS = {
  read_properties: '보기',
  write_properties: '쓰기',
  read_schedules: '보기',
  write_schedules: '쓰기',
  read_calls: '보기',
  write_calls: '쓰기',
};

/** @param {unknown} raw */
export function normalizeMemberPermissions(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MEMBER_PERMISSIONS };
  /** @type {MemberPermissions} */
  const out = { ...DEFAULT_MEMBER_PERMISSIONS };
  for (const key of PERMISSION_FIELDS) {
    if (key in raw) out[key] = !!raw[key];
  }
  return out;
}
