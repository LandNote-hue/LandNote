import { useParams, useNavigate } from 'react-router-dom';
import { useOwnerSchedules } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { MobilePage, MobileDetailHeader, MobileCard, MobileSectionTitle, MobileInfoRow, MobileEmptyState, M } from './mobileUi.jsx';

const PRI_LABEL = { IMPORTANT: { label: '중요', color: '#DC2626' }, NORMAL: { label: '일반', color: '#6B7280' } };

export function MobileScheduleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const schedules = useOwnerSchedules();
  const properties = useProperties();
  const sched = schedules.find((s) => String(s.id) === String(id));

  if (!sched) {
    return (
      <>
        <MobileDetailHeader title="일정 상세" fallback="/calendar" />
        <MobilePage><MobileEmptyState message="일정을 찾을 수 없습니다" /></MobilePage>
      </>
    );
  }

  const prop = sched.pid ? properties.find((p) => p.id === sched.pid) : null;
  const pri = PRI_LABEL[sched.pri] || PRI_LABEL.NORMAL;

  return (
    <>
      <MobileDetailHeader title="일정 상세" fallback="/calendar" />
      <MobilePage>
        <MobileCard>
          <span style={{ fontSize: 11, fontWeight: 600, color: pri.color }}>{pri.label}</span>
          <div style={{ fontSize: 18, fontWeight: 800, color: M.tx, marginTop: 6 }}>{sched.title}</div>
          <div style={{ fontSize: 14, color: M.txM, marginTop: 6 }}>{sched.date} {sched.time}</div>
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

        {(() => {
          const chkList = Array.isArray(sched.chk)
            ? sched.chk.filter((c) => c && String(c.t || '').trim())
            : [];
          if (!chkList.length) return null;
          const done = chkList.filter((c) => c.d).length;
          return (
            <>
              <MobileSectionTitle>체크리스트 ({done}/{chkList.length})</MobileSectionTitle>
              <MobileCard style={{ padding: '8px 0' }}>
                {chkList.map((c, i) => (
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
                        border: `1.5px solid ${c.d ? M.brand : M.bdr}`,
                        background: c.d ? M.brand : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {c.d && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span style={{
                      fontSize: 14, lineHeight: 1.45, color: c.d ? M.txP : M.tx,
                      textDecoration: c.d ? 'line-through' : 'none', wordBreak: 'keep-all',
                    }}>
                      {String(c.t).trim()}
                    </span>
                  </div>
                ))}
              </MobileCard>
            </>
          );
        })()}

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
