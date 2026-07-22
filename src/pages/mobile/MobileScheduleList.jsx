import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerSchedules } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { buildGcalMeta, scheduleSourceInfo } from '../../utils/scheduleColors.js';
import { MobilePage, MobileCard, MobileEmptyState, MobileCloudDataHint, M } from './mobileUi.jsx';

function formatDateHeading(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

export function MobileScheduleList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schedules = useOwnerSchedules();
  const properties = useProperties();
  const findProp = (pid) => properties.find((p) => p.id === pid);

  const gcalOwnerId = user?.id && user.id !== 'dev-local' ? user.id : undefined;
  const gcalMeta = useMemo(() => buildGcalMeta(gcalOwnerId), [gcalOwnerId]);

  const groups = useMemo(() => {
    const sorted = [...schedules].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    /** @type {Map<string, typeof schedules>} */
    const map = new Map();
    for (const s of sorted) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date).push(s);
    }
    return [...map.entries()];
  }, [schedules]);

  return (
    <MobilePage>
      <MobileCloudDataHint empty={schedules.length === 0} resourceLabel="일정" />
      {groups.length === 0 ? (
        <MobileEmptyState message="등록된 일정이 없습니다" />
      ) : (
        groups.map(([date, items]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: M.txM, margin: '0 2px 8px' }}>
              {formatDateHeading(date)}
            </div>
            <MobileCard style={{ padding: 0 }}>
              {items.map((s, i) => {
                const { c, label } = scheduleSourceInfo(s, gcalMeta);
                const prop = s.pid ? findProp(s.pid) : null;
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/calendar/${s.id}`)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: i < items.length - 1 ? `1px solid ${M.bdr}` : 'none',
                      borderLeft: `3px solid ${c}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 13, color: c, fontWeight: 700, flexShrink: 0, width: 44 }}>{s.time}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: c }}>{s.title}</div>
                      {prop && (
                        <div style={{ fontSize: 12, color: M.txP, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {propDisplayAddr(prop)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c, flexShrink: 0 }}>{label}</span>
                  </div>
                );
              })}
            </MobileCard>
          </div>
        ))
      )}
    </MobilePage>
  );
}
