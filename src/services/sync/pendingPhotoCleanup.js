/**
 * 서버 행 삭제 성공 후 Storage 사진 정리가 실패하면 재시도 대기열에 남긴다.
 */
const KEY = 'landnote.pendingPhotoCleanup';

function loadJobs() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch { /* ignore */ }
}

/** @param {Record<string, unknown>} prop */
export function rememberPhotoCleanupJob(prop) {
  if (!prop?.cloudId && !prop?.id) return;
  const jobs = loadJobs().filter((j) => String(j.cloudId) !== String(prop.cloudId || ''));
  jobs.push({
    cloudId: prop.cloudId || null,
    ownerId: prop.ownerId || null,
    companyId: prop.companyId || null,
    id: prop.id,
  });
  saveJobs(jobs);
}

export function listPhotoCleanupJobs() {
  return loadJobs();
}

export async function retryPendingPhotoCleanups(removeFn) {
  const jobs = loadJobs();
  const left = [];
  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await removeFn(job);
      done += 1;
    } catch {
      failed += 1;
      left.push(job);
    }
  }
  saveJobs(left);
  return { ok: failed === 0, done, failed, remaining: left.length };
}
