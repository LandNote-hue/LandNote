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
