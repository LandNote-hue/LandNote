/** @type {string | null} */
let syncUserId = null;
/** @type {string | null} */
let syncCompanyId = null;
/** @type {string | null} */
let syncCompanyRole = null;
/** @type {import('../../data/memberPermissions.js').MemberPermissions | null} */
let syncMemberPermissions = null;

/** @param {string | null} id */
export function setSyncUserId(id) {
  syncUserId = id;
}

export function getSyncUserId() {
  return syncUserId;
}

/** @param {{ companyId?: string | null, role?: string | null }} ctx */
export function setSyncCompanyContext({ companyId = null, role = null } = {}) {
  syncCompanyId = companyId;
  syncCompanyRole = role;
}

export function getSyncCompanyId() {
  return syncCompanyId;
}

export function getSyncCompanyRole() {
  return syncCompanyRole;
}

export function clearSyncCompanyContext() {
  syncCompanyId = null;
  syncCompanyRole = null;
  syncMemberPermissions = null;
}

/** @param {import('../../data/memberPermissions.js').MemberPermissions | null} perms */
export function setSyncMemberPermissions(perms) {
  syncMemberPermissions = perms;
}

export function getSyncMemberPermissions() {
  return syncMemberPermissions;
}
