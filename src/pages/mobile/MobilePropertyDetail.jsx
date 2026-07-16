import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProperties } from '../../hooks/useProperties.js';
import { propDisplayAddr, propJibunAddr } from '../../utils/propAddress.js';
import { fmtPropPrice as propPrice, fmtWithUnit, m2ToPyung, fmtNum } from '../../utils/formatMoney.js';
import { PropertyDetailMap } from '../../components/PropertyDetailMap.jsx';
import { MobilePage, MobileDetailHeader, MobileCard, MobileSectionTitle, MobileInfoRow, MobileEmptyState, M } from './mobileUi.jsx';

const TL = { SALE: '매매', JEONSE: '전세', MONTHLY: '월세', SHORT_TERM: '단기', PRESALE: '분양' };
const STATUS = {
  NEW: { label: '신규', bg: '#ECFDF5', color: '#047857' },
  ACTIVE: { label: '진행중', bg: '#EFF6FF', color: '#2563EB' },
  HOLD: { label: '보류', bg: '#FFFBEB', color: '#D97706' },
  COMPLETED: { label: '완료', bg: '#F1F5F9', color: '#475569' },
};

function areaLabel(m2) {
  if (m2 == null || m2 === '' || Number(m2) <= 0) return null;
  const py = m2ToPyung(m2);
  return `${fmtNum(m2, { decimal: true })}㎡${py ? ` (${fmtNum(py, { decimal: true })}평)` : ''}`;
}

export function MobilePropertyDetail() {
  const { id } = useParams();
  const properties = useProperties();
  const prop = properties.find((p) => String(p.id) === String(id));
  const [photoIdx, setPhotoIdx] = useState(0);

  if (!prop) {
    return (
      <>
        <MobileDetailHeader title="매물 상세" fallback="/properties" />
        <MobilePage><MobileEmptyState message="매물을 찾을 수 없습니다" /></MobilePage>
      </>
    );
  }

  const photos = Array.isArray(prop.photos) ? prop.photos.filter(Boolean) : [];
  const status = STATUS[prop.status] || STATUS.NEW;
  const telDigits = String(prop.ownerTel || '').replace(/[^0-9+]/g, '');

  return (
    <>
      <MobileDetailHeader title={propDisplayAddr(prop)} fallback="/properties" />
      <MobilePage>
        {photos.length > 0 ? (
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <div
              style={{
                width: '100%', aspectRatio: '4/3', borderRadius: 14, overflow: 'hidden',
                background: '#111',
              }}
            >
              <img src={photos[photoIdx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            {photos.length > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                {photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    aria-label={`사진 ${i + 1}`}
                    style={{
                      width: i === photoIdx ? 18 : 6, height: 6, borderRadius: 3, border: 'none',
                      background: i === photoIdx ? M.brand : M.bdr, transition: 'width .15s', cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        <MobileCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: status.bg, color: status.color }}>
              {status.label}
            </span>
            {prop.tag && (
              <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: '#F1F5F9', color: '#475569' }}>
                {prop.tag}
              </span>
            )}
            {prop.trade && <span style={{ fontSize: 12, color: M.txM }}>{TL[prop.trade] || prop.trade}</span>}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: M.tx, lineHeight: 1.4, marginBottom: 4 }}>
            {propDisplayAddr(prop)}
          </div>
          {prop.bldg && <div style={{ fontSize: 14, color: M.txM, marginBottom: 10 }}>{prop.bldg}</div>}
          <div style={{ fontSize: 22, fontWeight: 800, color: M.info }}>{propPrice(prop)}</div>
        </MobileCard>

        <MobileSectionTitle>자산 개요</MobileSectionTitle>
        <MobileCard>
          <MobileInfoRow label="지번 주소" value={propJibunAddr(prop) || null} />
          <MobileInfoRow label="용도지역" value={prop.zoning} />
          <MobileInfoRow label="지목" value={prop.landCategory} />
          <MobileInfoRow label="대지면적" value={areaLabel(prop.land)} />
          <MobileInfoRow label="연면적" value={areaLabel(prop.farArea)} />
          <MobileInfoRow label="건축면적" value={areaLabel(prop.buildingArea)} />
          <MobileInfoRow label="건폐율" value={prop.buildingCoverage ? `${prop.buildingCoverage}%` : null} />
          <MobileInfoRow label="용적률" value={prop.floorAreaRatio ? `${prop.floorAreaRatio}%` : null} />
          <MobileInfoRow label="층수" value={(prop.floorsAbove || prop.floorsBelow) ? `지상 ${prop.floorsAbove || 0}층 / 지하 ${prop.floorsBelow || 0}층` : null} />
          <MobileInfoRow label="구조" value={prop.structure} />
          <MobileInfoRow label="주용도" value={prop.mainUse} />
          <MobileInfoRow label="사용승인일" value={prop.approvalDate} />
          <MobileInfoRow label="주차대수" value={prop.parking ? `${prop.parking}대` : null} />
          <MobileInfoRow label="엘리베이터" value={prop.elevators ? `${prop.elevators}대` : null} />
          <MobileInfoRow label="개별공시지가" value={prop.officialLandPrice ? fmtWithUnit(prop.officialLandPrice, '원') : null} />
        </MobileCard>

        {(prop.promo || prop.memo) && (
          <>
            <MobileSectionTitle>특징 / 메모</MobileSectionTitle>
            <MobileCard>
              {prop.promo && <div style={{ fontSize: 14, color: M.tx, lineHeight: 1.6, marginBottom: prop.memo ? 10 : 0 }}>{prop.promo}</div>}
              {prop.memo && <div style={{ fontSize: 13, color: M.txM, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{prop.memo}</div>}
            </MobileCard>
          </>
        )}

        <MobileSectionTitle>위치</MobileSectionTitle>
        <MobileCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ width: '100%', height: 220 }}>
            <PropertyDetailMap property={prop} />
          </div>
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
            소유주에게 전화하기
          </a>
        )}
      </MobilePage>
    </>
  );
}
