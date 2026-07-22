import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePropertiesQuery } from '../../hooks/useProperties.js';
import { setPropertyFav } from '../../db.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { PropertyCardList } from '../../components/PropertyCardList.jsx';
import {
  MobilePage, M, MobileCloudDataHint, MobileCard,
  useMobileCloudBusy,
} from './mobileUi.jsx';

const STATUS_TABS = [
  { id: 'ALL', label: '전체' },
  { id: 'NEW', label: '신규' },
  { id: 'ACTIVE', label: '진행중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '완료' },
];

export function MobilePropertyList() {
  const navigate = useNavigate();
  const propertiesQuery = usePropertiesQuery();
  const cloudBusy = useMobileCloudBusy();
  const properties = propertiesQuery ?? [];
  const listLoading = cloudBusy || propertiesQuery === undefined;
  const [statusTab, setStatusTab] = useState('ALL');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties
      .filter((p) => statusTab === 'ALL' || p.status === statusTab)
      .filter((p) => !q || propDisplayAddr(p).toLowerCase().includes(q) || (p.bldg || '').toLowerCase().includes(q))
      .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  }, [properties, statusTab, search]);

  return (
    <MobilePage>
      <MobileCloudDataHint empty={!listLoading && properties.length === 0} resourceLabel="매물" />
      {listLoading ? (
        <MobileCard style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 6 }}>매물 불러오는 중…</div>
          <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.55 }}>
            로그인 시 클라우드에서 가져온 매물을 표시합니다. 잠시만 기다려 주세요.
          </div>
        </MobileCard>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="주소·건물명 검색"
            style={{
              width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${M.bdr}`,
              padding: '0 14px', fontSize: 15, marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusTab(t.id)}
                style={{
                  flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${statusTab === t.id ? M.brand : M.bdr}`,
                  background: statusTab === t.id ? M.brand : '#fff',
                  color: statusTab === t.id ? '#fff' : M.txM, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <PropertyCardList
            properties={visible}
            onOpen={(p) => navigate(`/properties/${p.id}`)}
            onToggleFav={(p, e) => { e?.stopPropagation?.(); setPropertyFav(p.id, !p.fav); }}
            emptyMessage="조건에 맞는 매물이 없습니다"
          />
        </>
      )}
    </MobilePage>
  );
}
