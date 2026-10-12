import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEAL_MODE_RENT, DEAL_MODE_SALE } from '../../theme/dealModeTheme.js';
import { customerMatchesDealMode } from '../../utils/dealModeMatch.js';
import { useDealMode } from '../../contexts/DealModeContext.jsx';
import { useOwnerCustomers } from '../../hooks/useOwnerScopedData.js';
import { formatCustomerTypesLabel } from '../../utils/customerTypes.js';
import { leaseConditionListSummary } from '../../utils/customerLeaseConditions.js';
import { customerBuyTypeLabelOf } from '../../utils/customerBuyTypes.js';
import { custGradeRank, normalizeCustStatus, CUST_STATUS_OPTS } from '../../utils/customerStatus.js';
import { formatPhone } from '../../utils/formatPhone.js';
import { MobilePage, MobileCard, MobileEmptyState, MobileCloudDataHint, M } from './mobileUi.jsx';

function gradeLabel(status) {
  const code = normalizeCustStatus(status);
  return CUST_STATUS_OPTS.find((o) => o.id === code)?.label || '보통';
}

function gradeChipStyle(status) {
  const code = normalizeCustStatus(status);
  if (code === 'URGENT') return { background: '#FEF2F2', color: '#B91C1C' };
  if (code === 'HOLD') return { background: '#FFFBEB', color: '#B45309' };
  if (code === 'MANAGE') return { background: '#F1F5F9', color: '#475569' };
  return { background: '#EFF6FF', color: '#2563EB' };
}

function CustomerPane({ title, rows, rent, onOpen }) {
  return (
    <section style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: M.tx, marginBottom: 8 }}>
        {title} <span style={{ fontWeight: 600, color: M.txM, fontSize: 12 }}>{rows.length}명</span>
      </div>
      {rows.length === 0 ? (
        <MobileEmptyState message="등록된 고객이 없습니다" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((c) => {
            const lease = rent ? leaseConditionListSummary(c) : null;
            return (
              <MobileCard key={c.id} style={{ margin: 0, cursor: 'pointer' }}>
                <div onClick={() => onOpen(c.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: M.tx }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: M.txM, marginTop: 3 }}>{formatPhone(c.phone) || c.phone}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, ...gradeChipStyle(c.status) }}>
                        {gradeLabel(c.status)}
                      </span>
                      {(c.customer_types?.length || c.type) && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#EFF6FF', color: '#2563EB' }}>
                          {formatCustomerTypesLabel(c.customer_types?.length ? c.customer_types : [c.type])}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.co && <div style={{ fontSize: 12, color: M.txP, marginTop: 6 }}>{c.co}</div>}
                  {rent && lease && (
                    <div style={{ fontSize: 12, color: M.txS, marginTop: 8, lineHeight: 1.5 }}>
                      <div>전용 {lease.area} · 예산 {lease.budget}</div>
                      <div>지역 {lease.region} · 이전 {lease.moveTiming}</div>
                    </div>
                  )}
                  {!rent && (
                    <div style={{ fontSize: 12, color: M.txS, marginTop: 8, lineHeight: 1.5 }}>
                      <div>매수유형 {customerBuyTypeLabelOf(c)}</div>
                      {c.buyTiming ? <div>매수시기 {c.buyTiming}</div> : null}
                    </div>
                  )}
                </div>
              </MobileCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MobileCustomerList() {
  const navigate = useNavigate();
  const { isRent } = useDealMode();
  const customersAll = useOwnerCustomers();
  const [search, setSearch] = useState('');

  const { saleRows, rentRows } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (c) => {
      if (!q) return true;
      const phone = String(c.phone || '');
      const name = String(c.name || '').toLowerCase();
      const region = String(c.region || '').toLowerCase();
      const summary = leaseConditionListSummary(c);
      return name.includes(q)
        || phone.includes(search.trim())
        || region.includes(q)
        || String(summary.region).toLowerCase().includes(q)
        || String(summary.moveTiming).toLowerCase().includes(q);
    };
    const byGrade = (a, b) => custGradeRank(b) - custGradeRank(a) || (b.created || '').localeCompare(a.created || '');
    return {
      saleRows: customersAll.filter((c) => customerMatchesDealMode(c, DEAL_MODE_SALE) && match(c)).sort(byGrade),
      rentRows: customersAll.filter((c) => customerMatchesDealMode(c, DEAL_MODE_RENT) && match(c)).sort(byGrade),
    };
  }, [customersAll, search]);

  return (
    <MobilePage>
      <MobileCloudDataHint empty={customersAll.length === 0} resourceLabel="고객" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="이름·연락처·지역 검색"
        style={{
          width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${M.bdr}`,
          padding: '0 14px', fontSize: 15, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start' }}>
        {isRent
          ? <CustomerPane title="임차고객" rows={rentRows} rent onOpen={(id) => navigate(`/customers/${id}`)} />
          : <CustomerPane title="매수고객" rows={saleRows} rent={false} onOpen={(id) => navigate(`/customers/${id}`)} />}
      </div>
    </MobilePage>
  );
}
