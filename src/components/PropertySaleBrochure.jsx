import React, { useMemo } from 'react';
import { fmtNum, m2ToPyung, calcPyUnitPriceMan, formatKoreanAmountFromMan } from '../utils/formatMoney.js';
import { formatPhone } from '../utils/formatPhone.js';
import { extraParcelCount, formatJibunWithExtraParcels } from '../utils/propertyParcels.js';
import { propJibunAddr, propDisplayAddr } from '../utils/propAddress.js';
import { isSaleTrade } from '../utils/propListKind.js';
import { getSaleMetricsForDisplay } from '../utils/propSaleInfo.js';

const NAVY = '#1B3A5F';
const BDR = '#D9DEE6';
const TX = '#1F2937';
const TXM = '#6B7280';
const SURF2 = '#F4F6F9';

function areaParts(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return { m2: '—', py: '—' };
  const py = m2ToPyung(n);
  return {
    m2: `${fmtNum(n, { decimal: true })} m²`,
    py: py != null ? `${fmtNum(py, { decimal: true })} 평` : '—',
  };
}

function fmtBrochureSaleAmount(priceMan) {
  const raw = formatKoreanAmountFromMan(priceMan);
  if (!raw) return '—';
  return raw.replace(/(\d)([억만])/g, '$1 $2');
}

function fmtPyUnit(priceMan, areaM2) {
  const n = calcPyUnitPriceMan(priceMan, areaM2);
  if (n == null) return '—';
  return `${fmtNum(Math.round(n))} 만원/py`;
}

function featureLines(promo) {
  const raw = String(promo || '').trim();
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .map((s) => s.replace(/^[•▶·ㆍ\-–\s]+/, '').trim())
    .filter(Boolean);
}

function dash(v) {
  const s = v == null ? '' : String(v).trim();
  return s && s !== '—' ? s : '-';
}

function floorStructure(prop) {
  const below = Number(prop.floorsBelow) || 0;
  const above = Number(prop.floorsAbove) || 0;
  const parts = [];
  if (below) parts.push(`지하${below}층`);
  if (above) parts.push(`지상${above}층`);
  const floor = parts.join(' / ');
  const st = String(prop.structure || '').trim();
  if (floor && st) return `${floor} ${st}`;
  return floor || st || '-';
}

function fmtApprovalDate(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.`;
  }
  const s = String(raw || '').trim();
  if (!s) return '-';
  const dotted = s.replace(/-/g, '.');
  return dotted.endsWith('.') ? dotted : `${dotted}.`;
}

function fmtCountDae(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '-';
  return `${fmtNum(v)}대`;
}

function fmtPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '-';
  return `${fmtNum(v, { decimal: true })}%`;
}

function fmtAreaM2(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return `${fmtNum(n, { decimal: true })} m²`;
}

function fmtAreaPy(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const py = m2ToPyung(n);
  return py != null ? `${fmtNum(py, { decimal: true })} py` : '-';
}

function fmtFloorAreaCell(m2) {
  const a = fmtAreaM2(m2);
  const b = fmtAreaPy(m2);
  if (a === '-' && b === '-') return '-';
  if (b === '-') return a;
  return `${a} / ${b}`;
}

function pngFill(hex, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, w, h);
  return c.toDataURL('image/png');
}

function saleBadgePng(label) {
  const dpr = 2;
  const w = 138;
  const h = 34;
  const c = document.createElement('canvas');
  c.width = w * dpr;
  c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(0.9, 0.9, w - 1.8, h - 1.8);
  ctx.fillStyle = NAVY;
  ctx.font = '700 12px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = '2.2px'; } catch { /* ignore */ }
  ctx.fillText(label, w / 2, h / 2 + 0.5);
  return c.toDataURL('image/png');
}

function BrochureDocHeader({ title, sale }) {
  const badge = sale ? 'FOR SALE' : 'FOR LEASE';
  const sub = sale ? 'COMMERCIAL BUILDING SALE PROPOSAL' : 'PROPERTY LEASE PROPOSAL';
  const badgeSrc = useMemo(() => saleBadgePng(badge), [badge]);
  const ruleSrc = useMemo(() => pngFill(NAVY, 16, 16), []);
  return (
    <div className="prop-pdf-doc-header" style={{ flexShrink: 0, padding: '10px 18px 0', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111', letterSpacing: '-0.03em', lineHeight: 1.3 }}>
            {title}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#A0AEC0', letterSpacing: '0.08em', marginTop: 5 }}>
            {sub}
          </div>
        </div>
        <img
          src={badgeSrc}
          alt={badge}
          width={138}
          height={34}
          style={{ flexShrink: 0, marginTop: 1, width: 138, height: 34, display: 'block' }}
        />
      </div>
      <img
        src={ruleSrc}
        alt=""
        style={{ display: 'block', width: '100%', height: 3, marginTop: 10, border: 0 }}
      />
    </div>
  );
}

function SectionHead({ num, ko, en }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 2, background: NAVY, color: '#fff',
        fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, letterSpacing: '-0.02em',
      }}>{num}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, letterSpacing: '-0.02em' }}>
        {ko}<span style={{ fontWeight: 500, color: TXM, marginLeft: 6 }}>·  {en}</span>
      </span>
    </div>
  );
}

function MediaBox({ children, fitPhoto = false }) {
  return (
    <div style={{
      border: `1px solid ${BDR}`,
      background: SURF2,
      height: 280,
      minHeight: 280,
      maxHeight: 280,
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
    }}>
      <div
        className={fitPhoto ? 'prop-pdf-photo-fit' : undefined}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      >
        {children}
      </div>
    </div>
  );
}

const TBL_BDR = '#E0E0E0';
const TBL_HEAD_BG = '#F5F5F5';
const DETAIL_PANEL_H = 236;
const CELL = {
  border: `1px solid ${TBL_BDR}`,
  padding: '3px 8px',
  fontSize: 11,
  lineHeight: 1.25,
  verticalAlign: 'middle',
};
const LABEL_CELL = {
  ...CELL,
  color: '#6B7280',
  fontWeight: 400,
  background: TBL_HEAD_BG,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};
const VAL_CELL = {
  ...CELL,
  color: '#1A1A1A',
  fontWeight: 700,
  background: '#fff',
  textAlign: 'left',
  wordBreak: 'keep-all',
  overflowWrap: 'anywhere',
};

function VertHead({ label, rowSpan }) {
  return (
    <td
      rowSpan={rowSpan}
      style={{
        ...CELL,
        width: 26,
        padding: '4px 0',
        background: TBL_HEAD_BG,
        color: '#6B7280',
        fontWeight: 500,
        fontSize: 11,
        letterSpacing: '0.02em',
        textAlign: 'center',
        verticalAlign: 'middle',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, lineHeight: 1.2 }}>
        {[...label].map((ch, i) => <span key={i}>{ch}</span>)}
      </div>
    </td>
  );
}

function AssetOverviewTable({ addrLine, prop }) {
  const landRows = [
    { k: '주소', a: dash(addrLine), span: true },
    { k: '대지면적', a: fmtAreaM2(prop.land), b: fmtAreaPy(prop.land) },
    { k: '용도지역', a: dash(prop.zoning), span: true },
    { k: '도로', a: dash(prop.roadInfo), span: true },
  ];
  const bldgRows = [
    { k: '연면적', a: fmtFloorAreaCell(prop.floor), span: true },
    { k: '건폐율/용적률', a: fmtPct(prop.buildingCoverage), b: fmtPct(prop.floorAreaRatio) },
    { k: '승강기/주차', a: fmtCountDae(prop.elevators), b: fmtCountDae(prop.parking) },
    { k: '주용도', a: dash(prop.mainUse), span: true },
    { k: '층수/구조', a: floorStructure(prop), span: true },
    { k: '사용승인일', a: fmtApprovalDate(prop.approvalDate), span: true },
  ];

  const renderRows = (rows, vertLabel) => rows.map((row, i) => (
    <tr key={`${vertLabel}-${row.k}`} style={{ height: '10%' }}>
      {i === 0 ? <VertHead label={vertLabel} rowSpan={rows.length} /> : null}
      <td style={LABEL_CELL}>{row.k}</td>
      {row.span ? (
        <td colSpan={2} style={VAL_CELL}>{row.a}</td>
      ) : (
        <>
          <td style={VAL_CELL}>{row.a}</td>
          <td style={VAL_CELL}>{row.b || '-'}</td>
        </>
      )}
    </tr>
  ));

  return (
    <table className="prop-pdf-asset-table" style={{
      width: '100%',
      height: '100%',
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      border: `1px solid ${TBL_BDR}`,
      boxShadow: '0 1px 4px rgba(15, 23, 42, 0.08)',
      background: '#fff',
    }}>
      <colgroup>
        <col style={{ width: 26 }} />
        <col style={{ width: 86 }} />
        <col />
        <col />
      </colgroup>
      <tbody>
        {renderRows(landRows, '토지정보')}
        {renderRows(bldgRows, '건축물개요')}
      </tbody>
    </table>
  );
}

/**
 * 석관동 매각안내서(1page) 양식 — 매물 상세 본문
 */
export function PropertySaleBrochure({
  prop,
  photo,
  locationMap,
  cadastralMap,
  extras,
  accountDefaults,
}) {
  const jibun = formatJibunWithExtraParcels(
    propJibunAddr(prop) || propDisplayAddr(prop),
    extraParcelCount(prop),
  ) || propDisplayAddr(prop);
  const land = areaParts(prop.land);
  const floor = areaParts(prop.floor);
  const sale = isSaleTrade(prop.trade);
  const metrics = getSaleMetricsForDisplay(prop.price, extras?.rentals, prop);
  const features = featureLines(prop.promo);
  const contactName = prop.agentName || accountDefaults?.displayName || '';
  const contactTitle = String(accountDefaults?.title || '').trim();
  const contactMobile = formatPhone(prop.agentTel || accountDefaults?.phone) || '';
  const contactDirect = formatPhone(accountDefaults?.tel) || '';
  const contactWorkMail = String(accountDefaults?.workEmail || '').trim();
  const contactCompany = String(accountDefaults?.agencyName || '').trim();
  const contactPersonItems = [
    contactName,
    contactTitle,
    contactMobile ? `M. ${contactMobile}` : '',
    contactDirect ? `T. ${contactDirect}` : '',
    contactWorkMail ? `E. ${contactWorkMail}` : '',
  ].filter(Boolean);

  return (
    <div className="prop-pdf-print-root" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', background: '#fff' }}>
      <BrochureDocHeader
        sale={sale}
        title={`${jibun}${String(prop.bldg || '').trim() ? ` ${String(prop.bldg).trim()}` : ''}`}
      />
      <div className="prop-pdf-print-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{
          padding: '14px 18px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          alignItems: 'stretch',
        }}>
          <div style={{ minWidth: 0 }}>
            <SectionHead num="01" ko="건물사진" en="PHOTO" />
            <MediaBox fitPhoto>{photo}</MediaBox>
          </div>
          <div style={{ minWidth: 0 }}>
            <SectionHead num="02" ko="위치도" en="LOCATION" />
            <MediaBox>{locationMap}</MediaBox>
          </div>
          <div style={{ minWidth: 0 }}>
            <SectionHead num="03" ko="지적도" en="CADASTRAL MAP" />
            <MediaBox>{cadastralMap}</MediaBox>
          </div>
        </div>
        <div style={{
          padding: '8px 18px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
          alignItems: 'start',
        }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHead num="04" ko="자산개요" en="DETAILS" />
          <div className="prop-pdf-detail-panel" style={{
            height: DETAIL_PANEL_H, minHeight: DETAIL_PANEL_H, maxHeight: DETAIL_PANEL_H,
            overflow: 'hidden', boxSizing: 'border-box',
          }}>
            <AssetOverviewTable prop={prop} addrLine={jibun} />
          </div>
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHead num="05" ko="특징" en="FEATURES" />
          <div className="prop-pdf-detail-panel" style={{
            height: DETAIL_PANEL_H, minHeight: DETAIL_PANEL_H, maxHeight: DETAIL_PANEL_H,
            overflow: 'hidden', boxSizing: 'border-box',
            border: `1px solid ${BDR}`, padding: '8px 10px 6px',
          }}>
            {features.length > 0 ? features.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{
                  width: 0, height: 0, marginTop: 4, flexShrink: 0,
                  borderTop: '3px solid transparent',
                  borderBottom: '3px solid transparent',
                  borderLeft: `6px solid ${NAVY}`,
                }} />
                <div style={{ fontSize: 11, color: TX, lineHeight: 1.4, fontWeight: 500 }}>{line}</div>
              </div>
            )) : (
              <div style={{ fontSize: 11, color: TXM, lineHeight: 1.5 }}>홍보문구를 입력하면 특징이 표시됩니다.</div>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SectionHead num="06" ko={sale ? '매각조건' : '임대조건'} en="PRICE" />
          <div className="prop-pdf-detail-panel" style={{
            height: DETAIL_PANEL_H, minHeight: DETAIL_PANEL_H, maxHeight: DETAIL_PANEL_H,
            overflow: 'hidden', boxSizing: 'border-box',
            border: `1px solid ${BDR}`, padding: '10px 12px',
          }}>
            {sale ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 4 }}>매각가액</div>
                <div style={{
                  fontSize: 38, fontWeight: 800, color: NAVY, letterSpacing: '-0.05em', lineHeight: 1.08,
                  textAlign: 'right',
                }}>
                  {prop.price ? fmtBrochureSaleAmount(prop.price) : '—'}
                </div>
                <div style={{ height: 1, background: BDR, margin: '22px 0 16px' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: TX, marginBottom: 8 }}>평단가</div>
                {[
                  ['대지면적당', fmtPyUnit(prop.price, prop.land)],
                  ['연면적당', fmtPyUnit(prop.price, prop.floor)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: TXM }}>{k}</span>
                    <span style={{ fontWeight: 700, color: TX }}>{v}</span>
                  </div>
                ))}
                {metrics?.yieldLabel && metrics.yieldLabel !== '—' && (
                  <>
                    <div style={{ height: 1, background: BDR, margin: '8px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: TXM }}>수익률</span>
                      <span style={{ fontWeight: 700, color: TX }}>{metrics.yieldLabel}</span>
                    </div>
                  </>
                )}
              </>
            ) : extras?.rentPrice}
          </div>
        </div>
        </div>

        <div style={{ paddingBottom: 8 }} />
      </div>

      <div style={{
        flexShrink: 0,
        background: NAVY,
        color: '#fff',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'nowrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', flexShrink: 0 }}>Contact us</span>
          {contactPersonItems.length > 0 ? contactPersonItems.map((item, i) => (
            <span key={i} style={{ fontSize: 14, fontWeight: 500, opacity: 0.95, whiteSpace: 'nowrap' }}>
              {item}
            </span>
          )) : (
            <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.8 }}>내 정보 · 설정에서 담당자 정보를 입력하세요</span>
          )}
        </div>
        {contactCompany ? (
          <span style={{ fontSize: 14, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{contactCompany}</span>
        ) : null}
      </div>
    </div>
  );
}
