import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOwnerSchedules } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { fmtSchedulePeriodDot } from '../../utils/schedulePeriod.js';
import { buildGcalMeta, scheduleOriginHint } from '../../utils/scheduleColors.js';
import { MobilePage, MobileDetailHeader, MobileCard, MobileSectionTitle, MobileEmptyState, M } from './mobileUi.jsx';

export function MobileScheduleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const schedules = useOwnerSchedules();
  const properties = useProperties();
  const sched = schedules.find((s) => String(s.id) === String(id));

  const gcalOwnerId = user?.id && user.id !== 'dev-local' ? user.id : undefined;
  const gcalMeta = useMemo(() => buildGcalMeta(gcalOwnerId), [gcalOwnerId]);
  const originHint = useMemo(() => (sched ? scheduleOriginHint(sched, gcalMeta) : null), [sched, gcalMeta]);

  if (!sched) {
    return (
      <>
        <MobileDetailHeader title="일정 상세" fallback="/calendar" />
        <MobilePage><MobileEmptyState message="일정을 찾을 수 없습니다" /></MobilePage>
      </>
    );
  }

  const prop = sched.pid ? properties.find((p) => p.id === sched.pid) : null;
  const accent = originHint?.color || M.info;

  const chkList = Array.isArray(sched.chk)
    ? sched.chk.filter((item) => item && String(item.t || '').trim())
    : [];
  const chkDone = chkList.filter((item) => item.d).length;

  return (
    <>
      <MobileDetailHeader title="일정 상세" fallback="/calendar" />
      <MobilePage>
        <MobileCard style={{ borderLeft: `3px solid ${accent}` }}>
          {originHint && (
            <div style={{ fontSize: 11, fontWeight: 600, color: originHint.color, marginBottom: 6 }}>
              {originHint.badge}
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 800, color: M.tx }}>{sched.title}</div>
          <div style={{ fontSize: 14, color: M.txM, marginTop: 6 }}>
            {fmtSchedulePeriodDot(sched)}{sched.time ? ` ${sched.time}` : ''}
          </div>
        </MobileCard>

        {prop && (
          <>
            <MobileSectionTitle>관련 매물</MobileSectionTitle>
            <MobileCard style={{ cursor: 'pointer' }}>
              <div onClick={() => navigate(`/properties/${prop.id}`)} style={{ color: M.info, fontWeight: 600 }}>
                {propDisplayAddr(prop)}
              </div>
            </MobileCard>
          </>
        )}

        {chkList.length > 0 && (
          <>
            <MobileSectionTitle>체크리스트 ({chkDone}/{chkList.length})</MobileSectionTitle>
            <MobileCard style={{ padding: '8px 0' }}>
              {chkList.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 16px',
                    borderBottom: i < chkList.length - 1 ? `1px solid ${M.bdr}` : 'none',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                      border: `1.5px solid ${item.d ? accent : M.bdr}`,
                      background: item.d ? accent : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {item.d && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span style={{
                    fontSize: 14, lineHeight: 1.45, color: item.d ? M.txP : M.tx,
                    textDecoration: item.d ? 'line-through' : 'none', wordBreak: 'keep-all',
                  }}>
                    {String(item.t).trim()}
                  </span>
                </div>
              ))}
            </MobileCard>
          </>
        )}

        {sched.memo && (
          <>
            <MobileSectionTitle>메모</MobileSectionTitle>
            <MobileCard>
              <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{sched.memo}</div>
            </MobileCard>
          </>
        )}
      </MobilePage>
    </>
  );
}
