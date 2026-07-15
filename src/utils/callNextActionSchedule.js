import { db, isActive, softDeleteSchedule } from '../db.js';
import { withOwnerId, getActiveOwnerId } from '../services/sync/ownerScope.js';

const DEFAULT_SCHED_TIME = '09:00';

function buildScheduleFields(call) {
  const title = String(call.next || '').trim();
  const date = call.nDate;
  const callDate = call.date || '';
  const callTime = call.time || '';
  const content = String(call.content || '').trim();
  const memoLines = ['통화 기록의 다음 액션에서 자동 등록'];
  if (callDate) memoLines.push(`통화일: ${callDate}${callTime ? ` ${callTime}` : ''}`);
  if (content) memoLines.push(content.length > 120 ? `${content.slice(0, 120)}…` : content);

  return {
    title,
    date,
    time: DEFAULT_SCHED_TIME,
    pri: 'IMPORTANT',
    pid: call.pid ?? null,
    memo: memoLines.join('\n'),
    chk: [],
    callId: call.id ?? null,
  };
}

export function shouldSyncCallNextAction(call) {
  return Boolean(String(call?.next || '').trim() && call?.nDate);
}

export async function syncCallNextActionSchedule(callId, callFields) {
  const call = { id: callId, ...callFields };
  const existing = await db.call_logs.get(callId);
  const schedId = existing?.schedId ?? null;

  if (!shouldSyncCallNextAction(call)) {
    if (schedId) {
      const sched = await db.schedules.get(schedId);
      if (sched && isActive(sched)) await softDeleteSchedule(schedId);
      await db.call_logs.update(callId, { schedId: null });
    }
    return null;
  }

  const schedFields = buildScheduleFields(call);

  if (schedId) {
    const sched = await db.schedules.get(schedId);
    if (sched) {
      if (isActive(sched)) {
        await db.schedules.update(schedId, {
          ...schedFields,
          chk: sched.chk ?? [],
          pri: sched.pri ?? schedFields.pri,
          time: sched.time || schedFields.time,
        });
        return schedId;
      }
      const newSchedId = await db.schedules.add(withOwnerId({ ...schedFields, deletedAt: null }));
      await db.call_logs.update(callId, { schedId: newSchedId });
      return newSchedId;
    }
  }

  const newSchedId = await db.schedules.add(withOwnerId({ ...schedFields, deletedAt: null }));
  await db.call_logs.update(callId, { schedId: newSchedId });
  return newSchedId;
}

export async function backfillCallNextActionSchedules() {
  const ownerId = getActiveOwnerId();
  const [calls, schedules] = await Promise.all([
    db.call_logs.where('ownerId').equals(ownerId).toArray(),
    db.schedules.where('ownerId').equals(ownerId).toArray(),
  ]);

  for (const call of calls.filter(isActive)) {
    if (call.schedId != null || !shouldSyncCallNextAction(call)) continue;
    const title = String(call.next || '').trim();
    const match = schedules.find((s) => isActive(s)
      && s.date === call.nDate
      && s.title === title
      && (s.pid ?? null) === (call.pid ?? null));
    if (match) {
      await db.call_logs.update(call.id, { schedId: match.id });
      if (!match.callId) await db.schedules.update(match.id, { callId: call.id });
      continue;
    }
    await syncCallNextActionSchedule(call.id, call);
  }
}
