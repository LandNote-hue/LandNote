import { useParams, useNavigate } from 'react-router-dom';
import { useOwnerCallLogs, useOwnerCustomers } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { formatPhone } from '../../utils/formatPhone.js';
import { MobilePage, MobileDetailHeader, MobileCard, MobileSectionTitle, MobileInfoRow, MobileEmptyState, M } from './mobileUi.jsx';

export function MobileCallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const callLogs = useOwnerCallLogs();
  const customers = useOwnerCustomers();
  const properties = useProperties();
  const call = callLogs.find((c) => String(c.id) === String(id));

  if (!call) {
    return (
      <>
        <MobileDetailHeader title="통화 상세" fallback="/calls" />
        <MobilePage><MobileEmptyState message="통화 기록을 찾을 수 없습니다" /></MobilePage>
      </>
    );
  }

  const cust = customers.find((c) => c.id === call.cid);
  const prop = properties.find((p) => p.id === call.pid);
  const telDigits = String(cust?.phone || '').replace(/[^0-9+]/g, '');

  return (
    <>
      <MobileDetailHeader title="통화 상세" fallback="/calls" />
      <MobilePage>
        <MobileCard>
          <div style={{ fontSize: 13, color: M.txM, marginBottom: 6 }}>{call.date} {call.time}</div>
          <div style={{ fontSize: 15, color: M.tx, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{call.content}</div>
        </MobileCard>

        <MobileSectionTitle>관련 정보</MobileSectionTitle>
        <MobileCard>
          <MobileInfoRow
            label="고객"
            value={cust ? (
              <span onClick={() => navigate(`/customers/${cust.id}`)} style={{ color: M.info, cursor: 'pointer' }}>
                {cust.name} {formatPhone(cust.phone)}
              </span>
            ) : null}
          />
          <MobileInfoRow
            label="매물"
            value={prop ? (
              <span onClick={() => navigate(`/properties/${prop.id}`)} style={{ color: M.info, cursor: 'pointer' }}>
                {propDisplayAddr(prop)}
              </span>
            ) : null}
          />
          <MobileInfoRow label="다음 액션" value={call.next} />
          <MobileInfoRow label="다음 일정일" value={call.nDate} />
        </MobileCard>

        {telDigits && (
          <a
            href={`tel:${telDigits}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 48, borderRadius: 12, background: M.brand, color: '#fff',
              fontSize: 15, fontWeight: 700, textDecoration: 'none', marginTop: 4,
            }}
          >
            {cust?.name || '고객'}에게 전화하기
          </a>
        )}
      </MobilePage>
    </>
  );
}
