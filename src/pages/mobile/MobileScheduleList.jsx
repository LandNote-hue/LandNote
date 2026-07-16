import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerSchedules } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { MobilePage, MobileCard, MobileEmptyState, M } from './mobileUi.jsx';

const PRI_LABEL = { IMPORTANT: { label: '중요', color: '#DC2626' }, NORMAL: { label: '일반', color: '#6B7280' } };

function formatDateHeading(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

export function MobileScheduleList() {
  const navigate = useNavigate();
  const schedules = useOwnerSchedules();
  const properties = useProperties();
  const findProp = (pid) => properties.find((p) => p.id === pid);

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
                const pri = PRI_LABEL[s.pri] || PRI_LABEL.NORMAL;
                const prop = s.pid ? findProp(s.pid) : null;
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/calendar/${s.id}`)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: i < items.length - 1 ? `1px solid ${M.bdr}` : 'none',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 13, color: M.info, fontWeight: 700, flexShrink: 0, width: 44 }}>{s.time}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: M.tx }}>{s.title}</div>
                      {prop && (
                        <div style={{ fontSize: 12, color: M.txP, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {propDisplayAddr(prop)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: pri.color, flexShrink: 0 }}>{pri.label}</span>
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
