import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerSchedules } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { scheduleCoversDay, fmtSchedulePeriodDot } from '../../utils/schedulePeriod.js';
import { collapseDuplicateIcsSchedules } from '../../utils/icsImport.js';
import { MobilePage, MobileCard, MobileEmptyState, M } from './mobileUi.jsx';

const PRI_C = { URGENT: '#DC2626', IMPORTANT: '#D97706', NORMAL: '#2563EB' };
const WD = ['일', '월', '화', '수', '목', '금', '토'];

export function MobileCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schedules = useOwnerSchedules();
  const properties = useProperties();
  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, date: d.getDate() };
  }, []);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [sel, setSel] = useState(today.date);

  useEffect(() => {
    const ownerId = user?.id;
    if (!ownerId || ownerId === 'dev-local') return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await collapseDuplicateIcsSchedules(ownerId);
      } catch (err) {
        console.warn('[MobileCalendar] collapse ics', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => {
      const d = i - firstDow + 1;
      return d >= 1 && d <= daysInMonth ? d : null;
    }),
    [firstDow, daysInMonth],
  );

  const daySchedMap = useMemo(() => {
    /** @type {Map<number, typeof schedules>} */
    const map = new Map();
    for (let d = 1; d <= daysInMonth; d += 1) {
      const list = schedules
        .filter((s) => scheduleCoversDay(s, year, month, d))
        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
      if (list.length) map.set(d, list);
    }
    return map;
  }, [schedules, year, month, daysInMonth]);

  const selScheds = sel ? (daySchedMap.get(sel) || []) : [];
  const isToday = (d) => d != null && year === today.year && month === today.month && d === today.date;
  const goToday = () => {
    setYear(today.year);
    setMonth(today.month);
    setSel(today.date);
  };
  const findProp = (pid) => properties.find((p) => p.id === pid);

  const shiftMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setYear(y);
    setMonth(m);
    const dim = new Date(y, m, 0).getDate();
    setSel((prev) => {
      if (y === today.year && m === today.month) return today.date;
      return Math.min(prev || 1, dim);
    });
  };

  return (
    <MobilePage>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12,
      }}>
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="이전 달" style={navBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M.tx} strokeWidth="2.4"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: M.tx }}>{year}년 {month}월</div>
          <button type="button" onClick={goToday} style={{
            border: `1px solid ${M.bdr}`, background: '#fff', borderRadius: 6, padding: '3px 10px',
            fontSize: 12, fontWeight: 600, color: M.brand, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            오늘
          </button>
        </div>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달" style={navBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={M.tx} strokeWidth="2.4"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <MobileCard style={{ padding: 0, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${M.bdr}` }}>
          {WD.map((d, i) => (
            <div key={d} style={{
              textAlign: 'center', padding: '8px 0', fontSize: 11, fontWeight: 700,
              color: i === 0 ? '#DC2626' : i === 6 ? M.info : M.txM,
            }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d, i) => {
            const todayCell = isToday(d);
            const selected = d != null && d === sel;
            const count = d ? (daySchedMap.get(d)?.length || 0) : 0;
            return (
              <button
                key={i}
                type="button"
                disabled={d == null}
                onClick={() => { if (d) setSel(d); }}
                style={{
                  minHeight: 48, border: 'none', borderRight: (i + 1) % 7 !== 0 ? `1px solid ${M.bdr}` : 'none',
                  borderBottom: i < 35 ? `1px solid ${M.bdr}` : 'none',
                  background: !d ? '#F8F9FB' : (todayCell && selected) ? '#FBE9EC' : selected ? '#EFF6FF' : todayCell ? '#FFF5F6' : '#fff',
                  cursor: d ? 'pointer' : 'default', padding: '6px 2px', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: todayCell || selected ? 700 : 500,
                  background: (todayCell && selected) ? M.brand : selected ? M.info : 'transparent',
                  color: !d ? M.txP : ((todayCell && selected) || selected) ? '#fff' : i % 7 === 0 ? '#DC2626' : i % 7 === 6 ? M.info : M.tx,
                }}>
                  {d || ''}
                </span>
                {count > 0 && (
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: selected || todayCell ? M.brand : M.info,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </MobileCard>

      <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, margin: '0 2px 8px' }}>
        {sel ? `${month}월 ${sel}일 (${WD[new Date(year, month - 1, sel).getDay()]})` : '날짜 선택'}
        {selScheds.length > 0 && (
          <span style={{ fontWeight: 500, color: M.txM, marginLeft: 6 }}>{selScheds.length}건</span>
        )}
      </div>

      {selScheds.length === 0 ? (
        <MobileEmptyState message="이 날짜에 등록된 일정이 없습니다" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selScheds.map((s) => {
            const prop = s.pid ? findProp(s.pid) : null;
            const color = PRI_C[s.pri] || PRI_C.NORMAL;
            return (
              <MobileCard
                key={s.id}
                style={{ margin: 0, cursor: 'pointer', borderLeft: `3px solid ${color}` }}
              >
                <div onClick={() => navigate(`/calendar/${s.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: M.tx, minWidth: 0 }}>{s.title || '제목 없음'}</div>
                    {s.time && (
                      <span style={{ fontSize: 12, color: M.txM, flexShrink: 0 }}>{String(s.time).slice(0, 5)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: M.txM, marginTop: 4 }}>
                    {fmtSchedulePeriodDot(s)}
                  </div>
                  {prop && (
                    <div style={{
                      fontSize: 12, color: M.txP, marginTop: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {propDisplayAddr(prop)}
                    </div>
                  )}
                </div>
              </MobileCard>
            );
          })}
        </div>
      )}
    </MobilePage>
  );
}

const navBtn = {
  width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${M.bdr}`,
  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};
