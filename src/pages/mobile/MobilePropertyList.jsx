import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProperties } from '../../hooks/useProperties.js';
import { setPropertyFav } from '../../db.js';
import { propDisplayAddr, propSearchHaystack } from '../../utils/propAddress.js';
import { PropertyCardList } from '../../components/PropertyCardList.jsx';
import {
  loadFolderState,
  DEFAULT_FOLDERS,
  DEFAULT_PROP_FOLDERS,
} from '../../navigation/folderPersist.js';
import { PROP_LIST_TABS, propertyBelongsToListTab, normalizePropListTab, isLegacyRentListTab } from '../../utils/propListKind.js';
import { useDealMode } from '../../contexts/DealModeContext.jsx';
import { DEAL_MODE_RENT } from '../../theme/dealModeTheme.js';
import { comparePropListActivityDesc } from '../../utils/propRentList.js';
import { SALE_PROP_KIND_OPTS, propertyMatchesSaleKind } from '../../data/propertyTypes.js';
import { PROP_STATUS_FILTER_LABELS, PROP_STATUS_LABEL_TO_CODE, propStatusFilterLabels } from '../../utils/propStatus.js';
import { uniquePropAgentNames, propertyMatchesAgentFilter, PROP_AGENT_NONE } from '../../utils/propAgent.js';
import { KR_GU, KR_SIDO, sidoMatch } from '../../features/map/regions.js';
import { priceInManForFilter, m2ToPyung, fmtInputNum } from '../../utils/formatMoney.js';
import { loadPropListState, rememberPropListTab } from '../../navigation/propListPersist.js';
import {
  MobilePage, M, MobileCloudDataHint, MobileCard,
  useMobileCloudBusy,
} from './mobileUi.jsx';

const STATUS_TABS = PROP_LIST_TABS.map((t) => (
  t.id === 'COMPLETED' ? { ...t, label: '완료' } : t
));

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
  const { mode, isRent, setDealMode } = useDealMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const properties = useProperties();
  const cloudBusy = useMobileCloudBusy();
  const urlTab = searchParams.get('tab');
  const [statusTab, setStatusTab] = useState(() => normalizePropListTab(urlTab || loadPropListState().statusTab || 'ALL'));
  useEffect(() => {
    if (isLegacyRentListTab(urlTab)) {
      setDealMode(DEAL_MODE_RENT);
      setStatusTab('ALL');
      setSearchParams({}, { replace: true });
      return;
    }
    if (urlTab) setStatusTab(normalizePropListTab(urlTab));
  }, [urlTab]);
  const goStatusTab = (id) => {
    rememberPropListTab(id);
    setStatusTab(id);
    if (id === 'ALL') setSearchParams({}, { replace: true });
    else setSearchParams({ tab: id }, { replace: true });
  };
  const openProperty = (p) => {
    rememberPropListTab(statusTab);
    navigate(`/properties/${p.id}`);
  };
  const [search, setSearch] = useState('');
  const [advOpen, setAdvOpen] = useState(false);
  const [saleAdv, setSaleAdv] = useState({
    trade: '', agent: '', sido: '', gu: '', main: '', status: '',
    priceMin: '', priceMax: '', landMin: '', landMax: '',
    floorMin: '', floorMax: '', roiMin: '',
  });
  const patchSaleAdv = (k) => (e) => setSaleAdv((s) => ({ ...s, [k]: e.target.value }));
  const [advAgent, setAdvAgent] = useState('');
  const agentNameOpts = useMemo(() => uniquePropAgentNames(properties), [properties]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const { folders, propFolders } = useMemo(() => readFolderSnapshot(), [properties]);

  const matchesRentAdv = (p) => {
    if (!sidoMatch(propSearchHaystack(p), saleAdv.sido)) return false;
    if (saleAdv.gu && !propSearchHaystack(p).includes(saleAdv.gu)) return false;
    if (saleAdv.status && p.status !== PROP_STATUS_LABEL_TO_CODE[saleAdv.status]) return false;
    return propertyMatchesAgentFilter(p, advAgent);
  };

  const matchesSearch = (p, q) => {
    if (!q) return true;
    return propDisplayAddr(p).toLowerCase().includes(q)
      || (p.bldg || '').toLowerCase().includes(q);
  };

  const matchesSaleAdv = (p) => {
    const a = saleAdv;
    const num = (v) => {
      const n = parseFloat(String(v ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    if (!sidoMatch(propSearchHaystack(p), a.sido)) return false;
    if (a.gu && !propSearchHaystack(p).includes(a.gu)) return false;
    if (a.main && !propertyMatchesSaleKind(p, a.main)) return false;
    if (!propertyMatchesAgentFilter(p, a.agent)) return false;
    if (a.status && p.status !== PROP_STATUS_LABEL_TO_CODE[a.status]) return false;
    const price = priceInManForFilter(p);
    const pmin = num(a.priceMin);
    const pmax = num(a.priceMax);
    if (pmin != null && (price == null || price < pmin)) return false;
    if (pmax != null && (price == null || price > pmax)) return false;
    const landPy = p.land > 0 ? Number(m2ToPyung(p.land)) : 0;
    const lmin = num(a.landMin);
    const lmax = num(a.landMax);
    if (lmin != null && landPy < lmin) return false;
    if (lmax != null && landPy > lmax) return false;
    const floorPy = p.floor > 0 ? Number(m2ToPyung(p.floor)) : 0;
    const fmin = num(a.floorMin);
    const fmax = num(a.floorMax);
    if (fmin != null && floorPy < fmin) return false;
    if (fmax != null && floorPy > fmax) return false;
    const rmin = num(a.roiMin);
    if (rmin != null) {
      const roi = parseFloat(p.roi);
      if (!Number.isFinite(roi) || roi < rmin) return false;
    }
    return true;
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = properties
      .filter((p) => propertyBelongsToListTab(p, statusTab, {
        inFolder: (propFolders[p.id] || []).length > 0,
        dealMode: mode,
      }))
      .filter((p) => (isRent ? matchesRentAdv(p) : matchesSaleAdv(p)))
      .filter((p) => matchesSearch(p, q));
    return [...list].sort(comparePropListActivityDesc);
  }, [properties, statusTab, search, propFolders, saleAdv, advAgent, mode, isRent]);

  const folderSections = useMemo(() => {
    if (statusTab !== 'FOLDER') return [];
    const q = search.trim().toLowerCase();
    return folders.map((f) => {
      const items = properties
        .filter((p) => (propFolders[p.id] || []).includes(f.id))
        .filter((p) => propertyBelongsToListTab(p, 'FOLDER', { inFolder: true, dealMode: mode }))
        .filter((p) => (isRent ? matchesRentAdv(p) : matchesSaleAdv(p)))
        .filter((p) => matchesSearch(p, q))
        .sort(comparePropListActivityDesc);
      return { folder: f, items };
    });
  }, [statusTab, folders, propFolders, properties, search, saleAdv, advAgent, mode, isRent]);

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
          <button
            type="button"
            onClick={() => setAdvOpen((v) => !v)}
            style={{
              width: '100%', height: 36, marginBottom: advOpen ? 8 : 10, borderRadius: 10,
              border: `1.5px solid ${advOpen ? M.brand : M.bdr}`,
              background: advOpen ? 'var(--ln-brand-l)' : '#fff', color: advOpen ? M.brand : M.txM,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {advOpen ? '상세검색 닫기' : '상세검색'}
          </button>
          {advOpen && (
            <div style={{ marginBottom: 10, padding: 12, border: `1px solid ${M.bdr}`, borderRadius: 10, background: '#fff' }}>
              {isRent ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['지역(도·시)', (
                      <select className="sel" value={saleAdv.sido} onChange={(e) => setSaleAdv((s) => ({ ...s, sido: e.target.value, gu: '' }))}>
                        <option value="">전체</option>
                        {KR_SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )],
                    ['구·군', (
                      <select className="sel" value={saleAdv.gu} onChange={patchSaleAdv('gu')}>
                        <option value="">전체</option>
                        {(saleAdv.sido ? KR_GU[saleAdv.sido] || [] : [...new Set(KR_SIDO.flatMap((s) => KR_GU[s] || []))]).slice().sort((a, b) => a.localeCompare(b, 'ko')).map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )],
                    ['진행 상태', (
                      <select className="sel" value={saleAdv.status} onChange={patchSaleAdv('status')}>
                        <option value="">전체</option>
                        {propStatusFilterLabels(true).map((s) => <option key={s}>{s}</option>)}
                      </select>
                    )],
                    ['담당자', (
                      <select className="sel" value={advAgent} onChange={(e) => setAdvAgent(e.target.value)}>
                        <option value="">전체</option>
                        {agentNameOpts.map((n) => <option key={n} value={n}>{n}</option>)}
                        <option value={PROP_AGENT_NONE}>미지정</option>
                      </select>
                    )],
                  ].map(([label, control]) => (
                    <div key={label}>
                      <div style={{ fontSize: 12, color: M.txM, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                      {control}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['지역(도·시)', (
                      <select className="sel" value={saleAdv.sido} onChange={(e) => setSaleAdv((s) => ({ ...s, sido: e.target.value, gu: '' }))}>
                        <option value="">전체</option>
                        {KR_SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )],
                    ['구·군', (
                      <select className="sel" value={saleAdv.gu} onChange={patchSaleAdv('gu')}>
                        <option value="">전체</option>
                        {(saleAdv.sido ? KR_GU[saleAdv.sido] || [] : [...new Set(KR_SIDO.flatMap((s) => KR_GU[s] || []))]).slice().sort((a, b) => a.localeCompare(b, 'ko')).map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )],
                    ['매물 종류', (
                      <select className="sel" value={saleAdv.main} onChange={patchSaleAdv('main')}>
                        <option value="">전체</option>
                        {SALE_PROP_KIND_OPTS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                      </select>
                    )],
                    ['진행 상태', (
                      <select className="sel" value={saleAdv.status} onChange={patchSaleAdv('status')}>
                        <option value="">전체</option>
                        {PROP_STATUS_FILTER_LABELS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    )],
                    ['담당자', (
                      <select className="sel" value={saleAdv.agent} onChange={patchSaleAdv('agent')}>
                        <option value="">전체</option>
                        {agentNameOpts.map((n) => <option key={n} value={n}>{n}</option>)}
                        <option value={PROP_AGENT_NONE}>미지정</option>
                      </select>
                    )],
                    ['가격 최소(만)', <input className="inp" inputMode="numeric" value={saleAdv.priceMin} onChange={(e) => setSaleAdv((s) => ({ ...s, priceMin: fmtInputNum(e.target.value) }))} placeholder="0" />],
                    ['가격 최대(만)', <input className="inp" inputMode="numeric" value={saleAdv.priceMax} onChange={(e) => setSaleAdv((s) => ({ ...s, priceMax: fmtInputNum(e.target.value) }))} placeholder="0" />],
                    ['대지면적 최소(평)', <input className="inp" inputMode="decimal" value={saleAdv.landMin} onChange={(e) => setSaleAdv((s) => ({ ...s, landMin: fmtInputNum(e.target.value, { decimal: true }) }))} placeholder="0" />],
                    ['대지면적 최대(평)', <input className="inp" inputMode="decimal" value={saleAdv.landMax} onChange={(e) => setSaleAdv((s) => ({ ...s, landMax: fmtInputNum(e.target.value, { decimal: true }) }))} placeholder="0" />],
                    ['연면적 최소(평)', <input className="inp" inputMode="decimal" value={saleAdv.floorMin} onChange={(e) => setSaleAdv((s) => ({ ...s, floorMin: fmtInputNum(e.target.value, { decimal: true }) }))} placeholder="-" />],
                    ['연면적 최대(평)', <input className="inp" inputMode="decimal" value={saleAdv.floorMax} onChange={(e) => setSaleAdv((s) => ({ ...s, floorMax: fmtInputNum(e.target.value, { decimal: true }) }))} placeholder="-" />],
                    ['수익률 이상(%)', <input className="inp" inputMode="decimal" value={saleAdv.roiMin} onChange={(e) => setSaleAdv((s) => ({ ...s, roiMin: fmtInputNum(e.target.value, { decimal: true }) }))} placeholder="-" />],
                  ].map(([label, control]) => (
                    <div key={label}>
                      <div style={{ fontSize: 12, color: M.txM, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                      {control}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2, alignItems: 'center' }}>
            {STATUS_TABS.map((t) => (
              <Fragment key={t.id}>
                {t.separate && (
                  <span aria-hidden style={{ width: 1, height: 20, background: M.bdr, flexShrink: 0, margin: '0 2px' }} />
                )}
                <button
                  type="button"
                  onClick={() => goStatusTab(t.id)}
                  style={{
                    flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${statusTab === t.id ? M.brand : M.bdr}`,
                    background: statusTab === t.id ? M.brand : '#fff',
                    color: statusTab === t.id ? '#fff' : M.txM, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {t.label}
                </button>
              </Fragment>
            ))}
            {isRent && (
              <select
                className="sel"
                value={advAgent}
                onChange={(e) => setAdvAgent(e.target.value)}
                style={{ marginLeft: 'auto', flexShrink: 0, height: 34, minWidth: 110, fontSize: 13 }}
                aria-label="담당자"
              >
                <option value="">담당자 전체</option>
                {agentNameOpts.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={PROP_AGENT_NONE}>미지정</option>
              </select>
            )}
          </div>

          {statusTab === 'FOLDER' ? (
            folders.length === 0 ? (
              <MobileCard>
                <div style={{ fontSize: 14, color: M.txM, lineHeight: 1.55 }}>
                  만든 폴더가 없습니다. PC의 그룹 관리에서 폴더를 만들어 주세요.
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
                            variant={isRent ? 'rental' : 'sale'}
                            onOpen={openProperty}
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
              variant={isRent ? 'rental' : 'sale'}
              onOpen={openProperty}
              onToggleFav={(p, e) => { e?.stopPropagation?.(); setPropertyFav(p.id, !p.fav); }}
              emptyMessage={
                statusTab === 'FAV'
                  ? '즐겨찾기한 매물이 없습니다'
                  : isRent
                    ? '등록된 임대 매물이 없습니다'
                    : '조건에 맞는 매물이 없습니다'
              }
            />
          )}
        </>
      )}
    </MobilePage>
  );
}
