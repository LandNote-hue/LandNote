import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerCustomers } from '../../hooks/useOwnerScopedData.js';
import { formatCustomerTypesLabel } from '../../utils/customerTypes.js';
import { formatPhone } from '../../utils/formatPhone.js';
import { MobilePage, MobileCard, MobileEmptyState, MobileCloudDataHint, M } from './mobileUi.jsx';

export function MobileCustomerList() {
  const navigate = useNavigate();
  const customers = useOwnerCustomers();
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
      .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  }, [customers, search]);

  return (
    <MobilePage>
      <MobileCloudDataHint empty={customers.length === 0} resourceLabel="고객" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="이름·연락처 검색"
        style={{
          width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${M.bdr}`,
          padding: '0 14px', fontSize: 15, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
      {visible.length === 0 ? (
        <MobileEmptyState message="조건에 맞는 고객이 없습니다" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((c) => (
            <MobileCard key={c.id} style={{ margin: 0, cursor: 'pointer' }}>
              <div onClick={() => navigate(`/customers/${c.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: M.tx }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: M.txM, marginTop: 3 }}>{formatPhone(c.phone) || c.phone}</div>
                  </div>
                  {(c.customer_types?.length || c.type) && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#EFF6FF', color: '#2563EB', flexShrink: 0 }}>
                      {formatCustomerTypesLabel(c.customer_types?.length ? c.customer_types : [c.type])}
                    </span>
                  )}
                </div>
                {c.co && <div style={{ fontSize: 12, color: M.txP, marginTop: 6 }}>{c.co}</div>}
              </div>
            </MobileCard>
          ))}
        </div>
      )}
    </MobilePage>
  );
}
