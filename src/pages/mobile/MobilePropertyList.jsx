import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProperties } from '../../hooks/useProperties.js';
import { setPropertyFav } from '../../db.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { PropertyCardList } from '../../components/PropertyCardList.jsx';
import {
  loadFolderState,
  DEFAULT_FOLDERS,
  DEFAULT_PROP_FOLDERS,
} from '../../navigation/folderPersist.js';
import {
  MobilePage, M, MobileCloudDataHint, MobileCard,
  useMobileCloudBusy,
} from './mobileUi.jsx';

const STATUS_TABS = [
  { id: 'ALL', label: '전체' },
  { id: 'FAV', label: '즐겨찾기' },
  { id: 'FOLDER', label: '폴더' },
  { id: 'NEW', label: '신규' },
  { id: 'ACTIVE', label: '진행중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '완료' },
];

function readFolderSnapshot() {
  const saved = loadFolderState();
  return {
    folders: saved?.folders ?? DEFAULT_FOLDERS,
    propFolders: saved?.propFolders && typeof saved.propFolders === 'object'
      ? saved.propFolders
      : { ...DEFAULT_PROP_FOLDERS },
  };
}

export function MobilePropertyList() {
  const navigate = useNavigate();
  const properties = useProperties();
  const cloudBusy = useMobileCloudBusy();
  const [statusTab, setStatusTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const { folders, propFolders } = useMemo(() => readFolderSnapshot(), [properties]);

  const matchesSearch = (p, q) => {
    if (!q) return true;
    return propDisplayAddr(p).toLowerCase().includes(q)
      || (p.bldg || '').toLowerCase().includes(q);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties
      .filter((p) => {
        if (statusTab === 'FAV') return !!p.fav;
        if (statusTab === 'FOLDER') return (propFolders[p.id] || []).length > 0;
        if (statusTab !== 'ALL') return p.status === statusTab;
        return true;
      })
      .filter((p) => matchesSearch(p, q))
      .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  }, [properties, statusTab, search, propFolders]);

  const folderSections = useMemo(() => {
    if (statusTab !== 'FOLDER') return [];
    const q = search.trim().toLowerCase();
    return folders.map((f) => {
      const items = properties
        .filter((p) => (propFolders[p.id] || []).includes(f.id))
        .filter((p) => matchesSearch(p, q))
        .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
      return { folder: f, items };
    });
  }, [statusTab, folders, propFolders, properties, search]);

  const toggleFolder = (fid) => {
    setExpandedFolders((prev) => ({ ...prev, [fid]: !prev[fid] }));
  };

  return (
    <MobilePage>
      <MobileCloudDataHint empty={!cloudBusy && properties.length === 0} resourceLabel="매물" />
      {cloudBusy ? (
        <MobileCard style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: M.tx, marginBottom: 6 }}>매물 불러오는 중…</div>
          <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.55 }}>
            로그인 직후 클라우드에서 매물을 가져오는 중입니다. 이후에는 저장된 목록을 바로 보여 줍니다.
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

          {statusTab === 'FOLDER' ? (
            folders.length === 0 ? (
              <MobileCard>
                <div style={{ fontSize: 14, color: M.txM, lineHeight: 1.55 }}>
                  만든 폴더가 없습니다. PC의 폴더 관리에서 폴더를 만들어 주세요.
                </div>
              </MobileCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {folderSections.map(({ folder: f, items }) => {
                  const open = Boolean(expandedFolders[f.id]);
                  return (
                    <div
                      key={f.id}
                      style={{
                        background: '#fff',
                        border: `1.5px solid ${M.bdr}`,
                        borderRadius: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFolder(f.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '14px 14px', border: 'none', background: open ? '#F8FAFC' : '#fff',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: M.tx }}>{f.name}</span>
                        <span style={{
                          fontSize: 12, color: M.txM, background: '#F1F5F9',
                          borderRadius: 20, padding: '2px 8px', fontWeight: 600,
                        }}
                        >
                          {items.length}건
                        </span>
                        <span style={{ fontSize: 12, color: M.txM }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0 10px 12px', borderTop: `1px solid ${M.bdr}` }}>
                          <PropertyCardList
                            properties={items}
                            onOpen={(p) => navigate(`/properties/${p.id}`)}
                            onToggleFav={(p, e) => { e?.stopPropagation?.(); setPropertyFav(p.id, !p.fav); }}
                            emptyMessage="담긴 매물이 없습니다"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <PropertyCardList
              properties={visible}
              onOpen={(p) => navigate(`/properties/${p.id}`)}
              onToggleFav={(p, e) => { e?.stopPropagation?.(); setPropertyFav(p.id, !p.fav); }}
              emptyMessage={
                statusTab === 'FAV'
                  ? '즐겨찾기한 매물이 없습니다'
                  : '조건에 맞는 매물이 없습니다'
              }
            />
          )}
        </>
      )}
    </MobilePage>
  );
}
