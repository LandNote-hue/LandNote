import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerCallLogs, useOwnerCustomers } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { MobilePage, MobileCard, MobileEmptyState, M } from './mobileUi.jsx';

export function MobileCallList() {
  const navigate = useNavigate();
  const callLogs = useOwnerCallLogs();
  const customers = useOwnerCustomers();
  const properties = useProperties();

  const sorted = useMemo(
    () => [...callLogs].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [callLogs],
  );
  const findCust = (cid) => customers.find((c) => c.id === cid);
  const findProp = (pid) => properties.find((p) => p.id === pid);

  return (
    <MobilePage>
      {sorted.length === 0 ? (
        <MobileEmptyState message="통화 기록이 없습니다" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((c) => {
            const cust = findCust(c.cid);
            const prop = findProp(c.pid);
            return (
              <MobileCard key={c.id} style={{ margin: 0, cursor: 'pointer' }}>
                <div onClick={() => navigate(`/calls/${c.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: M.tx }}>{cust?.name || '고객 미지정'}</span>
                    <span style={{ fontSize: 12, color: M.txM, flexShrink: 0 }}>{c.date} {c.time}</span>
                  </div>
                  {prop && (
                    <div style={{ fontSize: 12, color: M.txP, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {propDisplayAddr(prop)}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: M.txS, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.content}
                  </div>
                </div>
              </MobileCard>
            );
          })}
        </div>
      )}
    </MobilePage>
  );
}
