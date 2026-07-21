import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOwnerCallLogs, useOwnerCustomers } from '../../hooks/useOwnerScopedData.js';
import { useProperties } from '../../hooks/useProperties.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { MobilePage, MobileCard, MobileEmptyState, MobileCloudDataHint, M } from './mobileUi.jsx';

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
      <MobileCloudDataHint empty={callLogs.length === 0} resourceLabel="통화" />
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700, color: M.tx, lineHeight: 1.45, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {c.content || '내용 없음'}
                    </div>
                    <span style={{ fontSize: 12, color: M.txM, flexShrink: 0, textAlign: 'right', lineHeight: 1.4 }}>
                      {c.date}{c.time ? ` ${String(c.time).slice(0, 5)}` : ''}
                    </span>
                  </div>
                  {(cust?.name || prop) && (
                    <div style={{
                      marginTop: 8, fontSize: 12, color: M.txM, lineHeight: 1.45,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {[cust?.name, prop ? propDisplayAddr(prop) : null].filter(Boolean).join(' · ')}
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
