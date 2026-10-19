import { useEffect, useMemo, useRef, useState } from 'react';
import { BRAND_CSS } from '../../theme/dealModeTheme.js';
import { scheduleSourceInfo } from '../../utils/scheduleColors.js';
import {
  addCalendarDays,
  CAL_WEEKDAY_LABELS,
  formatHourLabel,
  isoFromParts,
  parseScheduleTimeParts,
  scheduleCoversDay,
  startOfWeekSunday,
} from '../../utils/schedulePeriod.js';

const C = {
  brand: BRAND_CSS.brand,
  brandL: BRAND_CSS.brandL,
  bg: '#F5F6FA',
  surf: '#FFFFFF',
  surf2: '#F8F9FB',
  surf3: '#F1F5F9',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txS: '#374151',
  txM: '#6B7280',
  txP: '#94A3B8',
  err: '#DC2626',
  info: '#2563EB',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ROW_H = 52;
const COMPACT_ROW_H = 44;
const TIME_W = 56;
const HOURS_START_SCROLL = 8;

function ymd(d) {
  return isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function splitDaySchedules(list) {
  const allDay = [];
  const timed = Array.from({ length: 24 }, () => []);
  for (const s of list || []) {
    const parts = parseScheduleTimeParts(s.time);
    if (!parts) allDay.push(s);
    else timed[parts.hour].push(s);
  }
  for (const bucket of timed) {
    bucket.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }
  return { allDay, timed };
}

function EventChip({ s, gcalMeta, onEventClick, compact }) {
  const { c, bg } = scheduleSourceInfo(s, gcalMeta);
  const t = parseScheduleTimeParts(s.time);
  return (
    <button
      type="button"
      title={`${t ? `${t.label} ` : ''}${s.title || ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick?.(s);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        minWidth: 0,
        textAlign: 'left',
        border: 'none',
        borderLeft: `3px solid ${c}`,
        background: bg,
        borderRadius: 4,
        padding: compact ? '2px 5px' : '3px 6px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {t && (
        <span style={{ fontSize: compact ? 10 : 11, color: C.txM, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {t.label}
        </span>
      )}
      <span style={{
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        color: c,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {s.title || '(제목 없음)'}
      </span>
    </button>
  );
}

function NowLine({ rowH, timeW, colCount, todayIndex }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);
  if (todayIndex < 0) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  const top = (mins / 60) * rowH;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: `calc(${timeW}px + (100% - ${timeW}px) * ${todayIndex} / ${colCount})`,
        width: `calc((100% - ${timeW}px) / ${colCount})`,
        top,
        height: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: -1,
        height: 2,
        background: C.brand,
      }} />
      <div style={{
        position: 'absolute',
        left: -4,
        top: -4,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: C.brand,
      }} />
    </div>
  );
}

/**
 * 주별·일별 시간대 그리드
 * @param {{
 *   mode: 'week' | 'day',
 *   year: number,
 *   month: number,
 *   day: number,
 *   schedules: Array<Record<string, unknown>>,
 *   gcalMeta?: Map<string, {color:string,label:string}>,
 *   onSelectDay?: (year:number, month:number, day:number) => void,
 *   onEventClick?: (sched: Record<string, unknown>) => void,
 *   onSlotClick?: (info: { iso: string, time: string }) => void,
 *   compact?: boolean,
 * }} props
 */
export function CalendarTimeGrid({
  mode,
  year,
  month,
  day,
  schedules,
  gcalMeta,
  onSelectDay,
  onEventClick,
  onSlotClick,
  compact = false,
}) {
  const rowH = compact ? COMPACT_ROW_H : ROW_H;
  const timeW = compact ? 44 : TIME_W;
  const anchor = useMemo(() => new Date(year, month - 1, day || 1), [year, month, day]);
  const days = useMemo(() => {
    if (mode === 'day') return [anchor];
    return Array.from({ length: 7 }, (_, i) => addCalendarDays(startOfWeekSunday(anchor), i));
  }, [mode, anchor]);
  const today = useMemo(() => new Date(), []);
  const todayIndex = days.findIndex((d) => isSameDay(d, today));
  const selectedIso = ymd(anchor);

  const byDay = useMemo(() => days.map((d) => {
    const list = (schedules || []).filter((s) => scheduleCoversDay(s, d.getFullYear(), d.getMonth() + 1, d.getDate()));
    return splitDaySchedules(list);
  }), [days, schedules]);

  const scrollerRef = useRef(null);
  const rangeKey = mode === 'week' ? ymd(startOfWeekSunday(anchor)) : ymd(anchor);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const hour = todayIndex >= 0 ? new Date().getHours() : HOURS_START_SCROLL;
    el.scrollTop = Math.max(0, hour * rowH - rowH);
  }, [mode, rangeKey, rowH, todayIndex]);

  const colCount = days.length;

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      background: C.surf,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: compact ? 'none' : '0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)',
      border: compact ? `1px solid ${C.bdr}` : 'none',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${timeW}px repeat(${colCount}, minmax(0, 1fr))`,
        borderBottom: `1px solid ${C.bdr}`,
        position: 'sticky',
        top: 0,
        zIndex: 4,
        background: C.surf,
        flexShrink: 0,
      }}>
        <div />
        {days.map((d) => {
          const iso = ymd(d);
          const isToday = isSameDay(d, today);
          const isSel = iso === selectedIso;
          const wd = d.getDay();
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay?.(d.getFullYear(), d.getMonth() + 1, d.getDate())}
              style={{
                border: 'none',
                borderLeft: `1px solid ${C.bdr}`,
                background: isSel ? C.brandL : 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: compact ? '8px 4px' : '10px 6px',
                textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: wd === 0 ? C.err : wd === 6 ? C.info : C.txM,
                letterSpacing: '.04em',
              }}>
                {CAL_WEEKDAY_LABELS[wd]}
              </div>
              <div style={{
                margin: '4px auto 0',
                width: compact ? 26 : 28,
                height: compact ? 26 : 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 13 : 14,
                fontWeight: isToday || isSel ? 700 : 500,
                background: isToday ? C.brand : isSel ? C.info : 'transparent',
                color: isToday || isSel ? '#fff' : C.tx,
              }}>
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `${timeW}px repeat(${colCount}, minmax(0, 1fr))`,
        borderBottom: `1px solid ${C.bdr}`,
        flexShrink: 0,
        background: C.surf2,
        minHeight: 44,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.txM,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 4px',
        }}>
          종일
        </div>
        {days.map((d, di) => {
          const iso = ymd(d);
          const items = byDay[di].allDay;
          return (
            <div
              key={`all-${iso}`}
              onClick={() => onSlotClick?.({ iso })}
              style={{
                borderLeft: `1px solid ${C.bdr}`,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                minHeight: 44,
                cursor: onSlotClick ? 'pointer' : 'default',
              }}
            >
              {items.map((s) => (
                <EventChip key={s.id} s={s} gcalMeta={gcalMeta} onEventClick={onEventClick} compact={compact} />
              ))}
            </div>
          );
        })}
      </div>

      <div ref={scrollerRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${timeW}px repeat(${colCount}, minmax(0, 1fr))`,
            gridAutoRows: rowH,
          }}>
            {HOURS.flatMap((h) => {
              const label = (
                <div key={`lab-${h}`} style={{
                  borderTop: `1px solid ${C.bdr}`,
                  fontSize: 11,
                  color: C.txP,
                  fontVariantNumeric: 'tabular-nums',
                  padding: '4px 6px 0 0',
                  textAlign: 'right',
                  position: 'sticky',
                  left: 0,
                  background: C.surf,
                  zIndex: 1,
                }}>
                  {formatHourLabel(h)}
                </div>
              );
              const cells = days.map((d, di) => {
                const iso = ymd(d);
                const items = byDay[di].timed[h];
                return (
                  <div
                    key={`${iso}-${h}`}
                    onClick={() => onSlotClick?.({ iso, time: formatHourLabel(h) })}
                    style={{
                      borderTop: `1px solid ${C.bdr}`,
                      borderLeft: `1px solid ${C.bdr}`,
                      background: isSameDay(d, today) ? C.brandL : C.surf,
                      padding: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      overflow: 'hidden',
                      cursor: onSlotClick ? 'pointer' : 'default',
                      minHeight: rowH,
                    }}
                  >
                    {items.map((s) => (
                      <EventChip key={s.id} s={s} gcalMeta={gcalMeta} onEventClick={onEventClick} compact={compact} />
                    ))}
                  </div>
                );
              });
              return [label, ...cells];
            })}
          </div>
          <NowLine rowH={rowH} timeW={timeW} colCount={colCount} todayIndex={todayIndex} />
        </div>
      </div>
    </div>
  );
}

export const CAL_VIEW_TABS = [
  { id: 'month', label: '월별보기' },
  { id: 'week', label: '주별보기' },
  { id: 'day', label: '일별보기' },
];

export function CalendarViewTabs({ value, onChange, style }) {
  return (
    <div
      role="tablist"
      aria-label="달력 보기"
      style={{
        display: 'flex',
        background: C.surf2,
        border: `1.5px solid ${C.bdr}`,
        borderRadius: 7,
        padding: 2,
        gap: 2,
        flexShrink: 0,
        ...style,
      }}
    >
      {CAL_VIEW_TABS.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(t.id)}
            style={{
              height: 28,
              padding: '0 12px',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: on ? 700 : 600,
              background: on ? C.brand : 'transparent',
              color: on ? '#fff' : C.txS,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
