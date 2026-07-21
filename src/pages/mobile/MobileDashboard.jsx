import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProperties } from '../../hooks/useProperties.js';
import { useOwnerCustomers, useOwnerCallLogs, useOwnerSchedules } from '../../hooks/useOwnerScopedData.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import {
  collectUpcomingSchedules,
  groupUpcomingScheduleSections,
  fmtSchedulePeriodDot,
} from '../../utils/schedulePeriod.js';
import { MobilePage, MobileCard, MobileSectionTitle, MobileStatCard, MobileEmptyState, M } from './mobileUi.jsx';

export function MobileDashboard() {
  const navigate = useNavigate();
  const properties = useProperties();
  const customers = useOwnerCustomers();
  const callLogs = useOwnerCallLogs();
  const schedules = useOwnerSchedules();

  const upcoming = useMemo(() => collectUpcomingSchedules(schedules), [schedules]);
  const upcomingSections = useMemo(() => groupUpcomingScheduleSections(upcoming), [upcoming]);
  const todayCount = useMemo(() => upcoming.filter((a) => a.sortKey === 0).length, [upcoming]);

  const activeCount = useMemo(() => properties.filter((p) => p.status === 'ACTIVE').length, [properties]);
  const newCount = useMemo(() => properties.filter((p) => p.status === 'NEW').length, [properties]);
  const recentCalls = useMemo(
    () => [...callLogs].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0, 3),
    [callLogs],
  );
  const findProp = (pid) => properties.find((p) => p.id === pid);
  const findCust = (cid) => customers.find((c) => c.id === cid);

  return (
    <MobilePage>
      <MobileSectionTitle>오늘 현황</MobileSectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <MobileStatCard label="오늘 일정" value={todayCount} onClick={() => navigate('/calendar')} />
        <MobileStatCard label="진행중 매물" value={activeCount} onClick={() => navigate('/properties')} />
        <MobileStatCard label="신규 매물" value={newCount} onClick={() => navigate('/properties')} />
        <MobileStatCard label="등록 고객" value={customers.length} onClick={() => navigate('/customers')} />
      </div>

      <MobileSectionTitle>다가오는 일정 (7일)</MobileSectionTitle>
      {upcomingSections.length ? (
        upcomingSections.map((section) => (
          <div key={section.title} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: M.txM, margin: '0 2px 6px' }}>{section.title}</div>
            <MobileCard style={{ padding: 0, marginBottom: 0 }}>
              {section.items.map((item, i) => {
                const s = item.schedule;
                const prop = s.pid ? findProp(s.pid) : null;
                const chkList = Array.isArray(s.chk) ? s.chk.filter((c) => c && String(c.t || '').trim()) : [];
                const chkLabel = chkList.length > 0
                  ? `${chkList.filter((c) => c.d).length}/${chkList.length}`
                  : null;
                return (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/calendar/${s.id}`)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: i < section.items.length - 1 ? `1px solid ${M.bdr}` : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: M.tx }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: M.txM, marginTop: 2 }}>
                        {item.dayLabel} · {fmtSchedulePeriodDot(s)}{s.time ? ` ${s.time}` : ''}
                        {chkLabel ? ` · 체크리스트 ${chkLabel}` : ''}
                      </div>
                      {prop && (
                        <div style={{ fontSize: 12, color: M.txP, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {propDisplayAddr(prop)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: M.info, fontWeight: 700, flexShrink: 0 }}>{item.dayLabel}</div>
                  </div>
                );
              })}
            </MobileCard>
          </div>
        ))
      ) : (
        <MobileEmptyState message="오늘부터 7일 내 일정이 없습니다" />
      )}

      <MobileSectionTitle>최근 통화</MobileSectionTitle>
      {recentCalls.length ? (
        <MobileCard style={{ padding: 0 }}>
          {recentCalls.map((c, i) => {
            const cust = findCust(c.cid);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/calls/${c.id}`)}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: i < recentCalls.length - 1 ? `1px solid ${M.bdr}` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: M.tx }}>{cust?.name || '고객 미지정'}</span>
                  <span style={{ fontSize: 12, color: M.txM, flexShrink: 0 }}>{c.date}</span>
                </div>
                <div style={{ fontSize: 13, color: M.txM, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.content}
                </div>
              </div>
            );
          })}
        </MobileCard>
      ) : (
        <MobileEmptyState message="통화 기록이 없습니다" />
      )}
    </MobilePage>
  );
}
