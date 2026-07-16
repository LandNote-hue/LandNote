import { useParams } from 'react-router-dom';
import { useOwnerCustomers, useOwnerCallLogs } from '../../hooks/useOwnerScopedData.js';
import { formatCustomerTypesLabel } from '../../utils/customerTypes.js';
import { formatPreferredTradesLabel } from '../../utils/customerTradePreference.js';
import { formatPhone } from '../../utils/formatPhone.js';
import { fmtWithUnit } from '../../utils/formatMoney.js';
import { MobilePage, MobileDetailHeader, MobileCard, MobileSectionTitle, MobileInfoRow, MobileEmptyState, M } from './mobileUi.jsx';

export function MobileCustomerDetail() {
  const { id } = useParams();
  const customers = useOwnerCustomers();
  const callLogs = useOwnerCallLogs();
  const cust = customers.find((c) => String(c.id) === String(id));

  if (!cust) {
    return (
      <>
        <MobileDetailHeader title="고객 상세" fallback="/customers" />
        <MobilePage><MobileEmptyState message="고객을 찾을 수 없습니다" /></MobilePage>
      </>
    );
  }

  const telDigits = String(cust.phone || '').replace(/[^0-9+]/g, '');
  const relatedCalls = callLogs
    .filter((c) => c.cid === cust.id)
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const typesLabel = formatCustomerTypesLabel(cust.customer_types?.length ? cust.customer_types : [cust.type]);
  const tradesLabel = formatPreferredTradesLabel?.(cust.preferred_trades) || '';

  return (
    <>
      <MobileDetailHeader title={cust.name} fallback="/customers" />
      <MobilePage>
        <MobileCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: M.tx }}>{cust.name}</div>
              <div style={{ fontSize: 14, color: M.txM, marginTop: 4 }}>{formatPhone(cust.phone) || cust.phone}</div>
            </div>
            {typesLabel && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#EFF6FF', color: '#2563EB', flexShrink: 0 }}>
                {typesLabel}
              </span>
            )}
          </div>
        </MobileCard>

        <MobileSectionTitle>기본 정보</MobileSectionTitle>
        <MobileCard>
          <MobileInfoRow label="소속" value={cust.co} />
          <MobileInfoRow label="선호 거래" value={tradesLabel} />
          <MobileInfoRow label="보유 현금" value={cust.cash ? fmtWithUnit(cust.cash, '만원') : null} />
          <MobileInfoRow label="매수 희망가" value={(cust.buyMin || cust.buyMax) ? `${fmtWithUnit(cust.buyMin || 0, '만원')} ~ ${fmtWithUnit(cust.buyMax || 0, '만원')}` : null} />
          <MobileInfoRow label="등록일" value={cust.created} />
        </MobileCard>

        {cust.memo && (
          <>
            <MobileSectionTitle>메모</MobileSectionTitle>
            <MobileCard>
              <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{cust.memo}</div>
            </MobileCard>
          </>
        )}

        {relatedCalls.length > 0 && (
          <>
            <MobileSectionTitle>통화 이력</MobileSectionTitle>
            <MobileCard style={{ padding: 0 }}>
              {relatedCalls.map((c, i) => (
                <div key={c.id} style={{
                  padding: '12px 16px',
                  borderBottom: i < relatedCalls.length - 1 ? `1px solid ${M.bdr}` : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: M.tx }}>{c.date} {c.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: M.txM, marginTop: 4 }}>{c.content}</div>
                </div>
              ))}
            </MobileCard>
          </>
        )}

        {telDigits && (
          <a
            href={`tel:${telDigits}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 48, borderRadius: 12, background: M.brand, color: '#fff',
              fontSize: 15, fontWeight: 700, textDecoration: 'none', marginTop: 4,
            }}
          >
            전화 걸기
          </a>
        )}
      </MobilePage>
    </>
  );
}
