import React,{ useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useProperties, usePropertiesQuery } from "./hooks/useProperties.js";
import { MapView } from "./features/map/MapView.jsx";
import { loadPropListState, savePropListState, clearPropListState } from "./navigation/propListPersist.js";
import {
  loadPropertyRegisterDraft,
  savePropertyRegisterDraft,
  clearPropertyRegisterDraft,
  hydratePropertyRegisterDraft,
} from "./navigation/propertyRegisterDraft.js";
import { loadFolderState, saveFolderState, getDefaultFolderState, DEFAULT_FOLDERS, DEFAULT_PROP_FOLDERS } from "./navigation/folderPersist.js";
import { MENU_PATHS, pathToMenuId, resolveTitle } from "./navigation/routes.js";
import {
  db, seedDatabase, isActive, formatCreatedDate,
  softDeleteProperty, softDeleteCustomer, softDeleteCallLog, softDeleteSchedule,
  setPropertyFav, setCustomerFav,
  restoreProperty, restoreCustomer, restoreCallLog, restoreSchedule,
  hardDeleteProperty, hardDeleteCustomer, hardDeleteCallLog, hardDeleteSchedule,
  saveRentalsForProperty, addProperty, duplicateProperty, updateProperty, addCustomer, updateCustomer,
  normalizePropertyLocalId,
  saveCallLog, addCallLogDirect, addScheduleDirect, updateScheduleDirect,
  exportBackupData, restoreBackupData,
  getBackupTableCounts, getLocalTableCounts, formatBackupCountsLabel, formatRestoreMergeLabel,
} from "./db.js";
import { usePropertyAddressLookup } from "./hooks/usePropertyAddressLookup.js";
import { AddressSearchModal } from "./components/AddressSearchModal.jsx";
import { PropertyPhotoPicker } from "./components/PropertyPhotoPicker.jsx";
import { PropertyDetailMap } from "./components/PropertyDetailMap.jsx";
import { PropertyDetailNewWin } from "./components/PropertyDetailNewWin.jsx";
import { normalizePhotoSlots, photoSlotsToSave } from "./utils/readImageFile.js";
import { fmtNum, fmtLandPyUnit, fmtPropPrice as propPrice, fmtWon, calcPyUnitPriceMan, priceInManForFilter, fmtInputNum, formatKoreanAmountFromMan, parseMoneyMan } from "./utils/formatMoney.js";
import { buildSaleInvestmentMetrics } from "./utils/propInvestment.js";
import { formatPhone, normalizePhone, phoneMatches, digitsOnly, freePhoneOptionFromSearch } from "./utils/formatPhone.js";
import { formatCustomerTypesLabel, normalizeCustomerTypesField } from "./utils/customerTypes.js";
import { CUSTOMER_TRADE_OPTS, formatPreferredTradesLabel, preferredTradesOf } from "./utils/customerTradePreference.js";
import { fmtCustomerBudgetRange, fmtCustomerMoney } from "./utils/customerMoney.js";
import { CUST_STATUS_OPTS, normalizeCustStatus, custStatusOf } from "./utils/customerStatus.js";
import { CUSTOMER_ADV_PROP_KIND_OPTS, customerMatchesAdvSearch, customerMatchesBasicSearch } from "./utils/customerSearch.js";
import { loadStoragePathLabel, saveStoragePathLabel, pickStorageFolder } from "./utils/storageFolder.js";
import { buildPropertyAddressFields, propDisplayAddr, propDetailWinTitle, propRoadAddr, propJibunAddr, propMatchesSearch, propSearchHaystack } from "./utils/propAddress.js";
import { handleDiscoLink, normalizeDiscoUrl } from "./utils/externalPropertyLinks.js";
import { zoningTextColor } from "./utils/zoningColor.js";
import { resolveMapCoordFieldsForSave } from "./services/kakao/propertyGeocode.js";
import { importIcsSchedules, importGoogleCalendarFromLink, syncLinkedGoogleCalendars } from "./utils/icsImport.js";
import {
  listGoogleCalendarLinks,
  removeGoogleCalendarLink,
  GCAL_LINK_COLORS,
} from "./services/googleCalendarLinks.js";
import { PhoneInput } from "./components/PhoneInput.jsx";
import { MoneyInput } from "./components/MoneyInput.jsx";
import { parseFormNum } from "./utils/propertyForm.js";
import { useAuth } from "./contexts/AuthContext.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { InviteSignUpPage, SignUpPage } from "./pages/InviteSignUpPage.jsx";
import { AUTH_PATHS } from "./navigation/authRoutes.js";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen.jsx";
import { PASSWORD_RESET_REDIRECT_PATH, validatePassword } from "./utils/authValidation.js";
import {
  scheduleCoversDay, dateEndForSave, fmtSchedulePeriodKo, fmtSchedulePeriodDot,
} from "./utils/schedulePeriod.js";
import { isBusinessRole, isCeoRole, isSoloRole, companyRoleLabel } from "./data/companyRoles.js";
import { PROP_MAIN, PROP_SUB } from "./data/propertyTypes.js";
import { matchesOwner } from "./services/sync/ownerScope.js";
import { canWriteRecord, isSharedRecord, displayPhone, PERMISSION_DENIED_TOOLTIP, getEffectivePermissions, canReadSharedResource, formatSharedPropertyLabel, canViewTeamProperties } from "./utils/permissions.js";
import TeamManagementPage from "./pages/TeamManagementPage.jsx";
import { upgradeSoloToBusiness } from "./services/companyService.js";
import { PageHeader as PH } from "./components/PageHeader.jsx";
import { CloudSyncHeaderActions } from "./components/CloudSyncHeaderActions.jsx";
import { BTN_SIZE, btnPx } from "./theme/buttonLayout.js";
import { WIN_OUTER_PAD, WIN_BODY_SCROLL, WIN_COLUMN } from "./theme/winLayout.js";
import PropertyBulkUploadPage from "./pages/PropertyBulkUploadPage.jsx";
import CustomerBulkUploadPage from "./pages/CustomerBulkUploadPage.jsx";
import { isBulkUploadFile } from "./utils/parseBulkUploadFile.js";
import { setPendingBulkFile } from "./services/bulk/bulkUploadPendingFile.js";
import { WithdrawAccountPage } from "./pages/WithdrawAccountPage.jsx";
import { useIsMobile } from "./hooks/useIsMobile.js";
import { useIsMobileDevice } from "./hooks/useIsMobileDevice.js";
import { getForceDesktop, setForceDesktop } from "./utils/forceDesktop.js";
import { PropertyCardList } from "./components/PropertyCardList.jsx";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { MobileShell } from "./layouts/MobileShell.jsx";
import { MobileDashboard } from "./pages/mobile/MobileDashboard.jsx";
import { MobilePropertyList } from "./pages/mobile/MobilePropertyList.jsx";
import { MobilePropertyDetail } from "./pages/mobile/MobilePropertyDetail.jsx";
import { MobileMapView } from "./pages/mobile/MobileMapView.jsx";
import { MobileCustomerList } from "./pages/mobile/MobileCustomerList.jsx";
import { MobileCustomerDetail } from "./pages/mobile/MobileCustomerDetail.jsx";
import { MobileCallList } from "./pages/mobile/MobileCallList.jsx";
import { MobileCallDetail } from "./pages/mobile/MobileCallDetail.jsx";
import { MobileScheduleList } from "./pages/mobile/MobileScheduleList.jsx";
import { MobileScheduleDetail } from "./pages/mobile/MobileScheduleDetail.jsx";
import { initialCloudSync, pushRestoredLocalData } from "./services/sync/cloudSync.js";
import {
  useOwnerCustomers,
  useOwnerCallLogs,
  useOwnerSchedules,
  useOwnerDeletedProperties,
  useOwnerDeletedCustomers,
  useOwnerDeletedCallLogs,
  useOwnerDeletedSchedules,
  useOwnerTrashCount,
} from "./hooks/useOwnerScopedData.js";
import {
  emptyPriceForm, priceFormFromProperty, buildPriceFields,
  landFromProperty, buildingFromProperty, landToPropertyFields, buildingToPropertyFields,
  detailFormFromProperty,
} from "./utils/propertyForm.js";
import {
  showsSaleInvestmentFields, showsPremiumField, showsRentalUnitFields,
  buildPropSaleInfoRows, buildTradePriceInfoItems,
} from "./utils/propSaleInfo.js";


function findPropertyByRouteId(properties, idParam) {
  if (!properties?.length || idParam == null || idParam === '') return null;
  const n = Number(idParam);
  return properties.find(p => p.id === n || String(p.id) === String(idParam)) ?? null;
}

const RouteLoading=({label='불러오는 중…'})=>(
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:C.txM,fontSize:14}}>
    {label}
  </div>
);

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, gap: 12, background: C.bg }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.tx }}>화면을 불러오지 못했습니다</div>
          <div style={{ fontSize: 13, color: C.txM, textAlign: 'center', lineHeight: 1.5 }}>{String(this.state.error?.message || this.state.error)}</div>
          <button type="button" onClick={() => { this.setState({ error: null }); window.location.assign('/dashboard'); }}
            style={{ marginTop: 8, height: btnPx(36), padding: `0 ${btnPx(16)}px`, border: 'none', borderRadius: btnPx(8), background: C.brand, color: '#fff', fontSize: btnPx(13), fontWeight: 600, cursor: 'pointer' }}>
            대시보드로 이동
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
const useRentals = (pid) => useLiveQuery(
  () => {
    const id = normalizePropertyLocalId(pid);
    return id ? db.rentals.where("pid").equals(id).toArray() : db.rentals.toArray();
  },
  [pid]
) ?? [];

/* ═══════════════════════════════════════════
   LandNote v2.0  |  1440px  |  Pretendard
   Brand: #C8102E  |  Light Mode
═══════════════════════════════════════════ */
/* CSS injected via useEffect in App */

/* ═══ TOKENS ═══ */
const C={
  brand:'#C8102E',brandD:'#A00E25',brandL:'#FBE9EC',
  sidebar:'#1A2332',sBar:'#243352',
  bg:'#F5F6FA',surf:'#FFFFFF',surf2:'#F8F9FB',surf3:'#F1F5F9',
  bdr:'#E8EAED',bdrSt:'#D1D5DB',
  tx:'#0F172A',txS:'#374151',txM:'#6B7280',txP:'#94A3B8',
  ok:'#047857',okBg:'#ECFDF5',okBd:'#A7F3D0',
  warn:'#D97706',warnBg:'#FFFBEB',warnBd:'#FDE68A',
  err:'#DC2626',errBg:'#FEF2F2',errBd:'#FECACA',
  info:'#2563EB',infoBg:'#EFF6FF',infoBd:'#BFDBFE',
  secBg:'#F2F3F5',
};
const SIDEBAR_EXPANDED_W=220, SIDEBAR_COLLAPSED_W=64;
const SIDEBAR_ICON_SZ=18, SIDEBAR_NAV_ITEM_SZ=40;

/* ═══ GLOBAL TOAST NOTIFICATION ═══ */
const notifyRef={fn:null};
function showNotification(message,type='success'){
  notifyRef.fn?.(message,type);
}
const TOAST_TYPE_STYLE={
  success:{accent:C.ok,accentBg:C.okBg,accentBd:C.okBd},
  info:{accent:C.info,accentBg:C.infoBg,accentBd:C.infoBd},
  warning:{accent:C.warn,accentBg:C.warnBg,accentBd:C.warnBd},
};
const ToastPopup=({toast,onClose})=>{
  const style=TOAST_TYPE_STYLE[toast.type]||TOAST_TYPE_STYLE.success;
  return(
    <div role="status" aria-live="polite"
      style={{
        position:'fixed',top:20,right:20,zIndex:9999,minWidth:280,maxWidth:420,
        padding:'14px 16px',display:'flex',alignItems:'flex-start',gap:12,
        background:C.surf,border:`1px solid ${C.bdr}`,borderLeft:`4px solid ${style.accent}`,
        borderRadius:10,boxShadow:'0 8px 24px rgba(15,23,42,.12),0 2px 8px rgba(15,23,42,.06)',
        opacity:toast.show?1:0,transform:toast.show?'translateX(0)':'translateX(24px)',
        pointerEvents:toast.show?'auto':'none',transition:'all 0.3s ease',
      }}>
      <div style={{width:8,height:8,borderRadius:'50%',background:style.accent,marginTop:6,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0,fontSize:14,color:C.tx,lineHeight:1.5,fontWeight:500}}>{toast.message}</div>
      <button type="button" onClick={onClose} aria-label="알림 닫기"
        style={{width:24,height:24,border:'none',background:style.accentBg,borderRadius:6,cursor:'pointer',color:C.txM,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.2s ease'}}
        onMouseEnter={e=>{e.currentTarget.style.background=style.accentBd;}}
        onMouseLeave={e=>{e.currentTarget.style.background=style.accentBg;}}>
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12}} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      </button>
    </div>
  );
};

const FOLDER_COLORS=['#C8102E','#2563EB','#059669','#D97706','#7C3AED','#0891B2'];
const FOLDERS = DEFAULT_FOLDERS;
const PROP_FOLDERS = DEFAULT_PROP_FOLDERS;

/* ═══ KOREAN ADMINISTRATIVE REGIONS ═══ */
const KR_SIDO=['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'];
const KR_GU={
  '서울특별시':['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'],
  '부산광역시':['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'],
  '대구광역시':['중구','동구','서구','남구','북구','수성구','달서구','달성군','군위군'],
  '인천광역시':['중구','동구','미추홀구','연수구','남동구','부평구','계양구','서구','강화군','옹진군'],
  '광주광역시':['동구','서구','남구','북구','광산구'],
  '대전광역시':['동구','중구','서구','유성구','대덕구'],
  '울산광역시':['중구','남구','동구','북구','울주군'],
  '세종특별자치시':['세종시 전체'],
  '경기도':['수원시','성남시','의정부시','안양시','부천시','광명시','평택시','동두천시','안산시','고양시','과천시','구리시','남양주시','오산시','시흥시','군포시','의왕시','하남시','용인시','파주시','이천시','안성시','김포시','화성시','광주시','양주시','포천시','여주시','연천군','가평군','양평군'],
  '강원특별자치도':['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군','평창군','정선군','철원군','화천군','양구군','인제군','고성군','양양군'],
  '충청북도':['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'],
  '충청남도':['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군'],
  '전북특별자치도':['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'],
  '전라남도':['목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군','화순군','장흥군','강진군','해남군','영암군','무안군','함평군','영광군','장성군','완도군','진도군','신안군'],
  '경상북도':['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시','의성군','청송군','영양군','영덕군','청도군','고령군','성주군','칠곡군','예천군','봉화군','울진군','울릉군'],
  '경상남도':['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군','창녕군','고성군','남해군','하동군','산청군','함양군','거창군','합천군'],
  '제주특별자치도':['제주시','서귀포시'],
};

// 시도 정식명칭(드롭다운용) → 실제 주소 표기에 쓰이는 줄임말 변환
const SIDO_SHORT={
  '서울특별시':'서울','부산광역시':'부산','대구광역시':'대구','인천광역시':'인천','광주광역시':'광주',
  '대전광역시':'대전','울산광역시':'울산','세종특별자치시':'세종','경기도':'경기','강원특별자치도':'강원',
  '충청북도':'충북','충청남도':'충남','전북특별자치도':'전북','전라남도':'전남','경상북도':'경북',
  '경상남도':'경남','제주특별자치도':'제주',
};
const sidoMatch=(addr,sido)=>!sido||addr.includes(SIDO_SHORT[sido]||sido);
const TL={SALE:'매매',JEONSE:'전세',MONTHLY:'월세',SHORT_TERM:'단기',PRESALE:'분양'};
/** 일정 우선순위 색 — 긴급(빨강) · 중요(주황) · 보통(파랑) */
const PRI_C={URGENT:'#DC2626',IMPORTANT:'#D97706',NORMAL:'#2563EB'};
const PRI_BG={URGENT:'rgba(220,38,38,.16)',IMPORTANT:'rgba(217,119,6,.16)',NORMAL:'rgba(37,99,235,.16)'};
const PRI_L={URGENT:'긴급',IMPORTANT:'중요',NORMAL:'보통'};
const PRI_OPTS=[['URGENT','긴급'],['IMPORTANT','중요'],['NORMAL','보통']];
const schedulePriColor=(pri)=>PRI_C[pri]||PRI_C.NORMAL;
const schedulePriBg=(pri)=>PRI_BG[pri]||PRI_BG.NORMAL;
/** @param {string} hex @param {number} [alpha] */
const hexToRgba=(hex,alpha=.16)=>{
  const h=String(hex||'').replace('#','');
  const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
};
/**
 * 일정 표시색 — 연동 캘린더에서 가져온 일정은 캘린더 구분색, 직접 등록한 일정은 우선순위색
 * @param {{pri?:string, icsSourceId?:string}} s
 * @param {Map<string,{color:string,label:string}>} gcalMeta
 */
const scheduleSourceInfo=(s,gcalMeta)=>{
  const src=s.icsSourceId?gcalMeta?.get(s.icsSourceId):null;
  if(src) return {c:src.color,bg:hexToRgba(src.color,.08),label:src.label,isSource:true};
  return {c:schedulePriColor(s.pri),bg:schedulePriBg(s.pri),label:PRI_L[s.pri]||'보통',isSource:false};
};
/** 구버전(색 미지정) 연동 링크용 — sourceId로부터 결정적으로 색 선택 */
const gcalFallbackColor=(sourceId)=>{
  let h=0;
  const s=String(sourceId||'');
  for(let i=0;i<s.length;i+=1) h=(h*31+s.charCodeAt(i))>>>0;
  return GCAL_LINK_COLORS[h%GCAL_LINK_COLORS.length];
};

/** 일정 우선순위 선택 (등록·수정) */
const PriorityPicker=({value,onChange})=>{
  const cur=value&&PRI_C[value]?value:'NORMAL';
  return(
    <div style={{display:'flex',gap:6}}>
      {PRI_OPTS.map(([v,l])=>{
        const on=cur===v;
        const c=PRI_C[v];
        return(
          <button
            key={v}
            type="button"
            onClick={()=>onChange(v)}
            style={{
              flex:1,height:36,borderRadius:7,cursor:'pointer',fontFamily:'inherit',
              border:`1.5px solid ${on?c:C.bdr}`,
              background:on?PRI_BG[v]:'#fff',
              color:on?c:C.txM,
              fontSize:13,fontWeight:on?700:500,
              transition:'all .12s',
            }}
          >{l}</button>
        );
      })}
    </div>
  );
};
const DASH_CALENDAR_ICON=<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/></svg>;
const DASH_PHONE_ICON=<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.12.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.58 2.34.7A2 2 0 0 1 22 16.92z"/></svg>;
const DASH_WARN_ICON=<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const parseDashDate=(s)=>{
  if(!s) return null;
  const iso=String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return new Date(+iso[1],+iso[2]-1,+iso[3]);
  const dot=String(s).match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if(dot) return new Date(+dot[1],+dot[2]-1,+dot[3]);
  return null;
};
const parseRentalExpiry=(rOrMemo)=>{
  if(rOrMemo&&typeof rOrMemo==='object'){
    if(rOrMemo.leaseEnd){
      const fromField=parseDashDate(rOrMemo.leaseEnd);
      if(fromField) return fromField;
    }
    rOrMemo=rOrMemo.memo;
  }
  if(!rOrMemo) return null;
  const m=String(rOrMemo).match(/(?:만료\s*)?(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?(?:\s*만료)?/);
  if(!m) return null;
  const y=+m[1],mo=+m[2],day=m[3]?+m[3]:new Date(y,mo,0).getDate();
  return new Date(y,mo-1,day);
};
const dashDayDiff=(from,to)=>{
  const a=new Date(from.getFullYear(),from.getMonth(),from.getDate());
  const b=new Date(to.getFullYear(),to.getMonth(),to.getDate());
  return Math.round((b-a)/86400000);
};
const dashDdayLabel=(diff)=>{
  if(diff===0) return 'D-day';
  if(diff>0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
};
const fmtDashDate=(d)=>{
  if(!d) return '—';
  if(d instanceof Date) return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  const p=parseDashDate(d);
  return p?fmtDashDate(p):String(d);
};
const DASH_WEEKDAY_KO=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
const fmtTodayKorean=()=>{
  const d=new Date();
  return `오늘: ${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${DASH_WEEKDAY_KO[d.getDay()]}`;
};
const dashRelativeDayLabel=(diff)=>{
  if(diff===0) return '오늘';
  if(diff===1) return '내일';
  return dashDdayLabel(diff);
};
const dashSchedPrefix=(diff)=>{
  if(diff===0) return '오늘 일정';
  if(diff===1) return '내일 일정';
  return '예정 일정';
};
const DASH_ALERT_MAX_DAYS=7;
const CT={BUYER:'매수인',SELLER:'매도인',TENANT:'임차인',LANDLORD:'임대인',OTHER:'기타'};
const CUST_TYPE_OPTS=[{id:'BUYER',label:'매수인'},{id:'SELLER',label:'매도인'},{id:'TENANT',label:'임차인'},{id:'LANDLORD',label:'임대인'},{id:'OTHER',label:'기타'}];
const customerTypesOf=(c)=>{
  if(Array.isArray(c?.customer_types)&&c.customer_types.length) return c.customer_types;
  return c?.type?[c.type]:[];
};
const customerTypeLabelOf=(c)=>formatCustomerTypesLabel(customerTypesOf(c))||CT[c?.type]||'—';
const customerTradeLabelOf=(c)=>formatPreferredTradesLabel(preferredTradesOf(c))||'—';
const customerMatchesTypeTab=(c,tabId)=>{
  if(tabId==='ALL') return true;
  return customerTypesOf(c).includes(tabId);
};
const CustStatusBdg=({s})=><StatusBdg s={s||'ACTIVE'}/>;
const fmtCallDate=(iso)=>{
  if(!iso) return '—';
  const [y,m,d]=String(iso).split('-');
  return y&&m&&d?`${y}.${m}.${d}`:String(iso).replace(/-/g,'.');
};
const callDtKey=(cl)=>`${cl.date||''}T${cl.time||'00:00'}`;
/** cid/pid는 Supabase bigint 컬럼을 거치며 string으로 올 수 있어 항상 String()으로 키를 통일 */
const buildCustCallDateMap=(calls)=>{
  const m=new Map();
  for(const cl of calls){
    if(!cl.cid||!cl.date) continue;
    const key=callDtKey(cl);
    const ck=String(cl.cid);
    const prev=m.get(ck);
    if(!prev){
      m.set(ck,{first:cl.date,last:cl.date,firstKey:key,lastKey:key});
      continue;
    }
    if(key<prev.firstKey){prev.first=cl.date;prev.firstKey=key;}
    if(key>prev.lastKey){prev.last=cl.date;prev.lastKey=key;}
  }
  return m;
};
const custCallDatesOf=(map,cid)=>(cid==null?{first:null,last:null}:map.get(String(cid))||{first:null,last:null});
const buildPropCallDateMap=(calls)=>{
  const m=new Map();
  for(const cl of calls){
    if(!cl.pid||!cl.date) continue;
    const key=callDtKey(cl);
    const pk=String(cl.pid);
    const prev=m.get(pk);
    if(!prev){
      m.set(pk,{first:cl.date,last:cl.date,firstKey:key,lastKey:key});
      continue;
    }
    if(key<prev.firstKey){prev.first=cl.date;prev.firstKey=key;}
    if(key>prev.lastKey){prev.last=cl.date;prev.lastKey=key;}
  }
  return m;
};
const propCallDatesOf=(map,pid)=>(pid==null?{first:null,last:null}:map.get(String(pid))||{first:null,last:null});
const propLinkedChip=(p)=>propDisplayAddr(p);

/* ═══ UI PRIMITIVES ═══ */
const Logo=({sz=20})=>{
  const base=52;
  return(
    <svg width={sz} height={sz} viewBox="0 0 68 68" fill="none">
      {/* 아이콘 전체를 중앙(34,34) 기준으로 120% 확대 */}
      <g transform="translate(34,34) scale(1.2) translate(-34,-34)">
        {/* 왼쪽 빌딩 */}
        <rect x="7"  y={base-22} width="13" height="22" rx="2" fill="#fff"/>
        <rect x="9.5"  y={base-19} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="14.5" y={base-19} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="9.5"  y={base-13} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="14.5" y={base-13} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="9.5"  y={base-7}  width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="14.5" y={base-7}  width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        {/* 가운데 고층 빌딩 */}
        <rect x="24" y={base-36} width="20" height="36" rx="2" fill="#fff"/>
        {/* 안테나 */}
        <rect x="33" y={base-43} width="2.5" height="9" rx="1.2" fill="#fff"/>
        <rect x="32" y={base-44} width="4.5" height="3" rx="1" fill="#fff"/>
        {/* 창문 4행×2열 */}
        <rect x="27"   y={base-33} width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="35.5" y={base-33} width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="27"   y={base-25} width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="35.5" y={base-25} width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="27"   y={base-17} width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="35.5" y={base-17} width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="27"   y={base-9}  width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        <rect x="35.5" y={base-9}  width="5" height="5" rx="0.8" fill="#C8102E" opacity=".9"/>
        {/* 오른쪽 빌딩 */}
        <rect x="47" y={base-28} width="14" height="28" rx="2" fill="#fff"/>
        <rect x="49.5" y={base-25} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="55"   y={base-25} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="49.5" y={base-18} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="55"   y={base-18} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="49.5" y={base-11} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        <rect x="55"   y={base-11} width="3.5" height="3.5" rx="0.6" fill="#C8102E" opacity=".9"/>
        {/* 지면선 */}
        <line x1="5" y1={base}   x2="63" y2={base}   stroke="rgba(255,255,255,0.4)" strokeWidth="2"   strokeLinecap="round"/>
        {/* 빨간 강조선 */}
        <line x1="5" y1={base+4} x2="63" y2={base+4} stroke="#C8102E"              strokeWidth="2.5" strokeLinecap="round"/>
      </g>
    </svg>
  );
};

/* ───── 인라인 SVG 아이콘 맵 (Tabler 폰트 완전 대체) ───── */
const BTN_ICONS={
  'ti-plus':         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  'ti-trash':        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>),
  'ti-edit':         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  'ti-search':       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  'ti-refresh':      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.12"/></svg>),
  'ti-folder':       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>),
  'ti-folder-plus':  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>),
  'ti-device-floppy':(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>),
  'ti-map-2':        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>),
  'ti-table':        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>),
  'ti-arrow-right':  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>),
  'ti-user':         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  'ti-upload':       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
  'ti-settings':     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  'ti-rotate':       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.12"/></svg>),
  'ti-building':     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg>),
  'ti-x':            (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  'ti-adjustments-horizontal':(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/></svg>),
  'ti-calendar':     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  'ti-calendar-plus':(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="15" x2="12" y2="19"/><line x1="10" y1="17" x2="14" y2="17"/></svg>),
  'ti-calendar-event':(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/></svg>),
};

/* 매물 상세 섹션 타이틀 아이콘 (Tabler 스타일 인라인 SVG · MIT) */
const PROP_DETAIL_IC={fg:'#9CA3AF',bg:'#F1F5F9'};
const _pdSvg={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'};
const PROP_DETAIL_SEC_ICONS={
  location:(<svg {..._pdSvg}><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/></svg>),
  land:(<svg {..._pdSvg}><path d="M3 20h18l-6.929-9.071a2 2 0 0 0-3.086 0l-8.985 9.071"/></svg>),
  building:(<svg {..._pdSvg}><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg>),
  sale:(<svg {..._pdSvg}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>),
  rental:(<svg {..._pdSvg}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>),
  promo:(<svg {..._pdSvg}><path d="M18 8a3 3 0 0 1 0 6"/><path d="M10 8v6a3 3 0 0 0 5.1 2.1"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="8" y1="20" x2="16" y2="20"/><path d="M12 8V5a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v2"/></svg>),
  memo:(<svg {..._pdSvg}><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>),
  detail:(<svg {..._pdSvg}><path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/><path d="M3 4m0 1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 14m0 1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>),
};

/* Btn role → variant/size (B). ActionBar labels: DB저장「저장」·신규「저장하기」·편집진입「수정」·닫기「완료」(C) */
const BTN_ROLES={
  'action-save':       { v:'primary', sz:'lg' },
  'action-cancel':     { v:'subtle',  sz:'lg' },
  'action-delete':     { v:'danger',  sz:'lg' },
  'action-copy':       { v:'subtle',  sz:'lg' },
  'dialog-confirm':    { v:'primary', sz:'lg' },
  'dialog-cancel':     { v:'subtle',  sz:'lg' },
  'dialog-danger':     { v:'danger',  sz:'lg' },
  'page-primary':      { v:'primary', sz:'md' },
  'page-secondary':    { v:'subtle',  sz:'md' },
  'toolbar-primary':   { v:'primary', sz:'sm' },
  'toolbar-secondary': { v:'subtle',  sz:'sm' },
  'toolbar-danger':    { v:'danger',  sz:'sm' },
  'row-edit':          { v:'subtle',  sz:'sm' },
  'row-delete':        { v:'danger',  sz:'sm' },
  'row-restore':       { v:'success', sz:'sm' },
  'filter':            { v:'subtle',  sz:'md' },
  'link':              { v:'subtle',  sz:'sm' },
  'block-link':        { v:'subtle',  sz:'md' },
  'settings-primary':  { v:'primary', sz:'sm' },
  'settings-danger':   { v:'danger',  sz:'sm' },
  'settings-secondary':{ v:'subtle',  sz:'md' },
  'backup-primary':    { v:'primary', sz:'md' },
  'backup-danger':     { v:'danger',  sz:'md' },
};

const Btn=({ch,on,v,sz,ic,full,sx,role,disabled,title})=>{
  const rd=role?BTN_ROLES[role]:null;
  const bv=v??rd?.v??'def';
  const bsz=sz??rd?.sz??'md';
  const bsx=sx||{};
  const S={
    sm:{fontSize:BTN_SIZE.sm.fontSize,height:BTN_SIZE.sm.height,borderRadius:BTN_SIZE.sm.borderRadius},
    md:{fontSize:BTN_SIZE.md.fontSize,height:BTN_SIZE.md.height,borderRadius:BTN_SIZE.md.borderRadius},
    lg:{fontSize:BTN_SIZE.lg.fontSize,height:BTN_SIZE.lg.height,borderRadius:BTN_SIZE.lg.borderRadius},
  };
  const vs={
    def:{background:'#fff',border:`1.5px solid ${C.bdr}`,color:C.tx},
    primary:{background:C.brand,border:`1.5px solid ${C.brand}`,color:'#fff'},
    danger:{background:C.err,border:`1.5px solid ${C.err}`,color:'#fff'},
    success:{background:'#047857',border:'1.5px solid #047857',color:'#fff'},
    subtle:{background:C.surf2,border:`1.5px solid ${C.bdr}`,color:C.txS},
  };
  const iconSz={sm:BTN_SIZE.sm.icon,md:BTN_SIZE.md.icon,lg:BTN_SIZE.lg.icon}[bsz];
  const pad={sm:BTN_SIZE.sm.padX,md:BTN_SIZE.md.padX,lg:BTN_SIZE.lg.padX}[bsz];
  const hasIc=Boolean(ic),hasTx=Boolean(ch);
  const onEnt=(e)=>{
    if(disabled) return;
    const el=e.currentTarget;
    const hasDarkBg=el.style.background&&(el.style.background.includes('rgba(255,255,255,.1)')||el.style.background.includes('rgba(220,38'));
    if(bv==='primary'){el.style.background=C.brandD;}
    else if(bv==='def'){el.style.background=C.surf3;el.style.color=C.tx;}
    else if(bv==='subtle'){if(hasDarkBg){el.style.background='rgba(255,255,255,.18)';el.style.color='#fff';}else{el.style.background=C.surf3;el.style.color=C.tx;}}
    else if(bv==='danger'){el.style.background='#B91C1C';el.style.color='#fff';}
    else if(bv==='success'){el.style.background='#065F46';el.style.color='#fff';}
  };
  const onLve=(e)=>{
    if(disabled) return;
    const el=e.currentTarget;
    const hasDarkBg=el.style.background&&(el.style.background.includes('rgba(255,255,255,.1)')||el.style.background.includes('rgba(220,38'));
    if(bv==='primary'){el.style.background=C.brand;}
    else if(bv==='def'){el.style.background='#fff';el.style.color=C.tx;}
    else if(bv==='subtle'){if(hasDarkBg){el.style.background='rgba(255,255,255,.1)';el.style.color='rgba(255,255,255,.8)';}else{el.style.background=C.surf2;el.style.color=C.txS;}}
    else if(bv==='danger'){el.style.background=C.err;el.style.color='#fff';}
    else if(bv==='success'){el.style.background='#047857';el.style.color='#fff';}
  };
  return(
    <button type="button" onClick={disabled?undefined:on} disabled={disabled} title={title}
      style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:hasIc&&hasTx?5:0,
        fontWeight:500,cursor:disabled?'not-allowed':'pointer',whiteSpace:'nowrap',lineHeight:1,userSelect:'none',
        opacity:disabled?0.5:1,
        padding:`0 ${pad}px`,...S[bsz],...vs[bv],width:full?'100%':undefined,...bsx}}
      onMouseEnter={onEnt} onMouseLeave={onLve}>
      {hasIc&&<span style={{width:iconSz,height:iconSz,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'inherit'}}>
        {BTN_ICONS[ic]?React.cloneElement(BTN_ICONS[ic],{width:iconSz,height:iconSz,style:{display:'block',flexShrink:0}}):<i className={`ti ${ic}`} style={{fontSize:iconSz,lineHeight:1}} aria-hidden/>}
      </span>}
      {hasTx&&<span style={{lineHeight:1}}>{ch}</span>}
    </button>
  );
};

const Bdg=({label,type='def'})=>{
  const t={def:{bg:C.surf3,c:C.txS},brand:{bg:C.brandL,c:C.brand},ok:{bg:C.okBg,c:C.ok},warn:{bg:C.warnBg,c:C.warn},err:{bg:C.errBg,c:C.err},info:{bg:C.infoBg,c:C.info},gray:{bg:'#F1F5F9',c:'#475569'}};
  const x=t[type]||t.def;
  return (<span style={{fontSize:12,padding:'3px 8px',borderRadius:20,fontWeight:500,background:x.bg,color:x.c,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center'}}>{label}</span>);
};

const StatusBdg=({s})=>{
  const m={NEW:{l:'신규',t:'ok'},ACTIVE:{l:'진행중',t:'info'},HOLD:{l:'보류',t:'warn'},COMPLETED:{l:'완료',t:'gray'}};
  const x=m[s]||m.NEW;
  return (<Bdg label={x.l} type={x.t}/>);
};

/** 연결 매물 드롭다운 — 지번 · 유형 · 거래방식 */
const PropDropListItem=({p})=>(
  <div>
    <div className="cell-wrap" style={{fontWeight:500,color:C.tx,fontSize:13}}>{propDisplayAddr(p)}</div>
    <div style={{fontSize:12,color:C.txM,marginTop:4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
      {p.tag&&<Bdg label={p.tag} type="gray"/>}
      <span>{TL[p.trade]||'—'}</span>
    </div>
  </div>
);


const PROP_DETAIL_SEC_TITLE_H=Math.round(36*1.1); /* 매물상세 섹션 타이틀 — 기준 36px의 110% */

const SecLabel=({ch,badge,sx,plain,propTitle,ic})=>(
  <div style={{height:propTitle?PROP_DETAIL_SEC_TITLE_H:36,background:propTitle?C.surf:C.secBg,borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',padding:'0 18px',gap:8,flexShrink:0,...(sx||{})}}>
    {propTitle&&ic&&PROP_DETAIL_SEC_ICONS[ic]&&(
      <span style={{width:22,height:22,borderRadius:6,background:PROP_DETAIL_IC.bg,color:PROP_DETAIL_IC.fg,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <span style={{width:14,height:14,display:'flex',alignItems:'center',justifyContent:'center'}}>{PROP_DETAIL_SEC_ICONS[ic]}</span>
      </span>
    )}
    <span style={{fontSize:13,fontWeight:propTitle?800:700,color:C.tx,textTransform:plain?'none':'uppercase',letterSpacing:plain?'-.01em':'.06em'}}>{ch}</span>
    {badge&&<span style={{fontSize:12,background:C.infoBg,color:C.info,padding:'1px 6px',borderRadius:3,fontWeight:600}}>{badge}</span>}
  </div>
);

const PROP_DETAIL_LABEL_W=Math.round(172*0.8); /* 매물상세 PropInfoGrid 항목명 열 — 기준 172px의 80% */
const PROP_DETAIL_ROW_SCALE=0.95;
const PROP_DETAIL_ROW_MIN_H=Math.floor(36*PROP_DETAIL_ROW_SCALE);
const PROP_DETAIL_CELL_PAD_V=Math.floor(8*PROP_DETAIL_ROW_SCALE);
const PROP_DETAIL_CELL_PAD_H=Math.floor(12*PROP_DETAIL_ROW_SCALE);

const propDetailLabelCell={
  fontSize:12,
  color:C.txM,
  padding:`${PROP_DETAIL_CELL_PAD_V}px ${PROP_DETAIL_CELL_PAD_H}px`,
  borderRight:`1px solid ${C.bdr}`,
  fontWeight:600,
  whiteSpace:'nowrap',
  overflow:'visible',
  display:'flex',
  alignItems:'center',
  justifyContent:'center',
  textAlign:'center',
  minHeight:PROP_DETAIL_ROW_MIN_H,
  boxSizing:'border-box',
  background:C.surf2,
};
const propDetailValueCell={
  fontSize:13,
  padding:`${PROP_DETAIL_CELL_PAD_V}px ${PROP_DETAIL_CELL_PAD_H}px`,
  display:'flex',
  alignItems:'center',
  justifyContent:'flex-start',
  textAlign:'left',
  minHeight:PROP_DETAIL_ROW_MIN_H,
  whiteSpace:'nowrap',
  overflow:'hidden',
  textOverflow:'ellipsis',
  minWidth:0,
  boxSizing:'border-box',
};

const InfoRow=({k,v,vc,span=1,last=true,detail=false})=>{
  if(detail){
    return(
      <div style={{display:'grid',gridTemplateColumns:`${PROP_DETAIL_LABEL_W}px 1fr`,borderBottom:`1px solid ${C.bdr}`,minHeight:PROP_DETAIL_ROW_MIN_H}}>
        <span style={propDetailLabelCell}>{k}</span>
        <span style={{...propDetailValueCell,color:vc||C.tx,fontWeight:vc?500:400,whiteSpace:'normal',wordBreak:'keep-all',lineHeight:1.43,alignItems:'flex-start'}}>{v||'—'}</span>
      </div>
    );
  }
  const labelW=120;
  return (
  <div style={{gridColumn:`span ${span}`,display:'grid',gridTemplateColumns:`${labelW}px 1fr`,borderBottom:`1px solid ${C.bdr}`,borderRight:last?'none':`1px solid ${C.bdr}`,minHeight:36}}>
    <span style={{fontSize:12,color:C.txM,padding:'8px 14px',borderRight:`1px solid ${C.bdr}`,fontWeight:500,display:'flex',alignItems:'center',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={k}>{k}</span>
    <span style={{fontSize:14,color:vc||C.tx,padding:'8px 14px',display:'flex',alignItems:'flex-start',fontWeight:vc?500:400,whiteSpace:'normal',wordBreak:'keep-all',lineHeight:1.5}}>{v||'—'}</span>
  </div>
);};
const IR2=({items})=>(
  <div style={{display:'flex',flexDirection:'column'}}>
    {items.map((x,i)=><InfoRow key={i} k={x.k} v={x.v} vc={x.c} detail/>)}
  </div>
);

const py=(m2)=>m2>0?(m2/3.3058).toFixed(1):'—';
const propLandPyungLabel=(p)=>p.land>0?`${py(p.land)}평`:'-';
const propFloorPyungLabel=(p)=>p.floor>0?`${py(p.floor)}평`:'-';
const propZoningLabel=(p)=>p.zoning||'-';
const PropZoningCell=({p,className,style})=>(
  <td className={className} style={style} title={p.zoning||''}>
    <span style={{color:zoningTextColor(p.zoning),fontWeight:p.zoning?600:400}}>{propZoningLabel(p)}</span>
  </td>
);

/* ═══ ACTION BAR — 저장/수정/삭제 공통 하단 고정 컴포넌트 ═══ */
const ActionBar=({
  onSave,onDelete,onCopy,onCancel,saveLabel,
  saveDisabled,saveDisabledTitle,
  deleteDisabled,deleteDisabledTitle,
  copyDisabled,copyDisabledTitle,copyLabel,
})=>(
  <div style={{flexShrink:0,background:C.surf,borderTop:`2px solid ${C.bdr}`,
    padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      {onDelete&&(
        <Btn role="action-delete" ch="삭제" on={onDelete} disabled={deleteDisabled} title={deleteDisabled?deleteDisabledTitle:undefined}/>
      )}
      {onCopy&&(
        <Btn role="action-copy" ch={copyLabel||'매물 복사'} on={onCopy} disabled={copyDisabled} title={copyDisabled?copyDisabledTitle:undefined}/>
      )}
    </div>
    <div style={{display:'flex',gap:10}}>
      {onCancel&&<Btn role="action-cancel" ch="취소" on={onCancel}/>}
      {onSave&&<Btn role="action-save" ch={saveLabel||'저장'} on={onSave} disabled={saveDisabled} title={saveDisabled?saveDisabledTitle:undefined}/>}
    </div>
  </div>
);

/* ═══ TITLE BAR ═══ */
const TitleBar=({screen,onSignOut,onHome})=>(
  <div style={{height:50,background:C.sidebar,display:'flex',alignItems:'center',padding:0,flexShrink:0,userSelect:'none'}}>
    <button type="button" onClick={onHome} aria-label="대시보드로 이동"
      style={{display:'flex',alignItems:'center',gap:0,border:'none',background:'transparent',cursor:'pointer',padding:0,fontFamily:'inherit',flexShrink:0}}
      onMouseEnter={e=>{e.currentTarget.style.opacity='.88';}}
      onMouseLeave={e=>{e.currentTarget.style.opacity='1';}}>
      <div style={{width:SIDEBAR_COLLAPSED_W,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <div style={{width:SIDEBAR_NAV_ITEM_SZ,height:SIDEBAR_NAV_ITEM_SZ,background:C.brand,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Logo sz={SIDEBAR_ICON_SZ}/>
        </div>
      </div>
      <span style={{fontSize:19.5,fontWeight:700,color:'rgba(255,255,255,.7)',letterSpacing:'-.01em'}}>LandNote</span>
    </button>
    {screen&&<><span style={{fontSize:12,color:'rgba(255,255,255,.2)',margin:'0 6px'}}>›</span>
    <span style={{fontSize:13,color:'rgba(255,255,255,.55)'}}>{screen}</span></>}
    {onSignOut&&(
      <button type="button" onClick={onSignOut}
        style={{marginLeft:'auto',marginRight:16,height:btnPx(32),padding:`0 ${btnPx(12)}px`,borderRadius:btnPx(8),border:'none',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,.55)',fontSize:btnPx(13),fontWeight:600,fontFamily:'inherit'}}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.1)';e.currentTarget.style.color='#fff';}}
        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,.55)';}}>
        로그아웃
      </button>
    )}
  </div>
);

/* ═══ SIDEBAR — 브랜드 영역 없음 ═══ */
const MENU_ICONS={
  dashboard:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>),
  properties:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 11h0M14 11h0M9 15h0M14 15h0"/></svg>),
  mapview:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>),
  register:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>),
  customers:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  calls:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.58 2.34.7A2 2 0 0 1 22 16.92z"/></svg>),
  calendar:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  backup:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16l-4-4-4 4"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
  trash:(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>),
};
const MENUS=[
  {id:'dashboard',icon:'ti-layout-dashboard',label:'대시보드'},
  {id:'properties',icon:'ti-building-estate',label:'매물 관리'},
  {id:'mapview',icon:'ti-map-2',label:'지도 보기'},
  {id:'register',icon:'ti-circle-plus',label:'매물 등록'},
  {id:'customers',icon:'ti-users',label:'고객 관리'},
  {id:'calls',icon:'ti-phone',label:'통화 내역'},
  {id:'calendar',icon:'ti-calendar',label:'일정 관리'},
  {id:'backup',icon:'ti-cloud-upload',label:'백업·복원'},
  {id:'trash',icon:'ti-trash',label:'휴지통'},
];
const Sidebar=({screen,onNav,onSettings,trash=0,expanded,onToggle,overlay})=>{
  const [hoverId,setHoverId]=useState(null);
  const { accountDefaults, company, companyRole, profile, isConfigured, isDevBypass }=useAuth();
  const workspaceId=company?.id??profile?.company_id??null;
  const displayRole=companyRole??(profile?.role?normalizeCompanyRole(profile.role):null);
  const canAccessTeamManage=(isConfigured||isDevBypass)&&workspaceId&&isBusinessRole(displayRole)&&isCeoRole(displayRole);
  const teamActive=screen==='team';
  return(
  <div style={{width:expanded?SIDEBAR_EXPANDED_W:SIDEBAR_COLLAPSED_W,background:C.sidebar,display:'flex',flexDirection:'column',height:'100%',flexShrink:0,
    transition:'width .18s ease-out',
    ...(overlay?{position:'absolute',left:0,top:0,zIndex:200,boxShadow:'4px 0 24px rgba(0,0,0,.25)'}:{})}}>
    {/* ═══ 사용자 영역 (최상단) ═══ */}
    <div style={{padding:expanded?'14px 14px 12px':'14px 10px 12px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',gap:expanded?10:0,flexShrink:0,justifyContent:expanded?'flex-start':'center'}}>
      <div onClick={onToggle} style={{width:34,height:34,background:'rgba(200,16,46,.25)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(200,16,46,.4)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(200,16,46,.25)'}>
        {expanded?(
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        ):(
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        )}
      </div>
      {expanded&&<>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,.88)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{accountDefaults.displayName||'사용자'}</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.38)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}>{accountDefaults.agencyName||accountDefaults.email||'—'}</div>
        </div>
        <div onClick={onSettings} style={{width:28,height:28,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.12)';e.currentTarget.querySelector('svg').style.stroke='#E2E4E9'}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.querySelector('svg').style.stroke='#9CA3AF'}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{transition:'stroke .12s'}}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
      </>}
    </div>
    {/* ═══ 메뉴 ═══ */}
    <nav style={{flex:1,padding:expanded?'10px 8px 8px':'10px 6px 8px',overflow:'visible'}}>
      {MENUS.map(m=>{
        const act=screen===m.id;
        return(
          <div key={m.id} onClick={()=>onNav(m.id)}
            onMouseEnter={()=>{
              setHoverId(m.id);
              if(m.id==='mapview'){
                import('./services/kakao/kakaoMaps.js').then((mod)=>mod.loadKakaoMaps(['services'])).catch(()=>{});
              }
            }} onMouseLeave={()=>setHoverId(null)}
            className={`nav-item${act?' active':''}`}
            style={expanded?{}:{justifyContent:'center',padding:0,width:40,height:40,margin:'0 auto 2px',position:'relative'}}>
            <span style={{display:'flex',alignItems:'center',justifyContent:'center',color:act?C.brand:'inherit',flexShrink:0}}>{MENU_ICONS[m.id]}</span>
            {expanded&&<span>{m.label}</span>}
            {expanded&&m.id==='trash'&&trash>0&&<span style={{marginLeft:'auto',fontSize:13,background:C.brand,color:'#fff',borderRadius:20,padding:'1px 7px',fontWeight:600}}>{trash}</span>}
            {expanded&&act&&<div style={{marginLeft:'auto',width:3,height:16,background:C.brand,borderRadius:2,flexShrink:0}}/>}
            {!expanded&&!act&&m.id==='trash'&&trash>0&&<span style={{position:'absolute',top:2,right:2,width:8,height:8,borderRadius:'50%',background:C.brand}}/>}
            {!expanded&&hoverId===m.id&&(
              <div style={{position:'absolute',left:'calc(100% + 10px)',top:'50%',transform:'translateY(-50%)',background:'#1A2332',color:'#fff',fontSize:13,padding:'6px 12px',borderRadius:6,whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(0,0,0,.3)',zIndex:300,pointerEvents:'none'}}>
                {m.label}
              </div>
            )}
          </div>
        );
      })}
      {canAccessTeamManage&&(
        <div onClick={()=>onNav('team')}
          onMouseEnter={()=>setHoverId('team')} onMouseLeave={()=>setHoverId(null)}
          className={`nav-item${teamActive?' active':''}`}
          style={expanded?{marginTop:8,borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:10}: {justifyContent:'center',padding:0,width:40,height:40,margin:'8px auto 2px',position:'relative'}}>
          <span style={{display:'flex',alignItems:'center',justifyContent:'center',color:teamActive?C.brand:'inherit',flexShrink:0}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          {expanded&&<span>멤버 관리</span>}
          {expanded&&teamActive&&<div style={{marginLeft:'auto',width:3,height:16,background:C.brand,borderRadius:2,flexShrink:0}}/>}
          {!expanded&&hoverId==='team'&&(
            <div style={{position:'absolute',left:'calc(100% + 10px)',top:'50%',transform:'translateY(-50%)',background:'#1A2332',color:'#fff',fontSize:13,padding:'6px 12px',borderRadius:6,whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(0,0,0,.3)',zIndex:300,pointerEvents:'none'}}>
              멤버 관리
            </div>
          )}
        </div>
      )}
    </nav>
  </div>
  );
};

/* ═══ WIN OVERLAY ═══ */
const WinBar=({title,ic,onClose,acts})=>(
  <div style={{height:50,background:'#FFFFFF',borderBottom:`1.5px solid ${C.bdr}`,display:'flex',alignItems:'center',padding:'0 12px 0 20px',gap:12,flexShrink:0}}>
    {ic&&<div style={{width:28,height:28,borderRadius:6,background:C.brandL,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:C.brand}}>
      {BTN_ICONS[ic]?React.cloneElement(BTN_ICONS[ic],{width:14,height:14}):<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"/>}
    </div>}
    <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:10}}>
      {typeof title==='string'?(
        <span style={{fontSize:15,color:C.tx,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:'-.01em',flex:1,minWidth:0}}>{title}</span>
      ):(
        <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:8,overflow:'hidden',justifyContent:'flex-start'}}>{title}</div>
      )}
    </div>
    {acts&&<div style={{display:'flex',gap:6}}>{acts}</div>}
    {onClose&&(
      <button type="button" onClick={onClose} aria-label="닫기"
        style={{width:btnPx(32),height:btnPx(32),borderRadius:btnPx(8),background:'#F1F5F9',border:'1.5px solid #CBD5E1',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#374151',fontSize:btnPx(17),fontWeight:700,flexShrink:0,transition:'all .12s',lineHeight:1}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.brand;e.currentTarget.style.borderColor=C.brand;e.currentTarget.style.color='#fff';}}
        onMouseLeave={e=>{e.currentTarget.style.background='#F1F5F9';e.currentTarget.style.borderColor='#CBD5E1';e.currentTarget.style.color='#374151';}}>
        ✕
      </button>
    )}
  </div>
);
const PROP_DETAIL_WIN_W=1440;
const Win=({title,ic,onClose,ch,acts,w=1020,fullWidth=false})=>(
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.42)',zIndex:520,display:'flex',flexDirection:'column',padding:fullWidth?0:WIN_OUTER_PAD,backdropFilter:'blur(3px)',boxSizing:'border-box',overflow:'hidden'}}>
    <div style={{background:C.surf,borderRadius:fullWidth?0:12,width:'100%',maxWidth:fullWidth?'100%':w,flex:1,minHeight:0,margin:'0 auto',alignSelf:'stretch',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:fullWidth?'none':'0 24px 64px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.08)'}}>
      <WinBar title={title} ic={ic} onClose={onClose} acts={acts}/>
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>{ch}</div>
    </div>
  </div>
);

/* ═══ LOCK ═══ */
const LockScreen=({onLogin})=>{
  const [pw,setPw]=useState('');
  return(
    <div style={{width:'100%',maxWidth:1440,height:'100vh',margin:'0 auto',background:'linear-gradient(135deg,#0B111C 0%,#141E2E 50%,#0E1927 100%)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      {/* 배경 글로우 */}
      <div style={{position:'absolute',top:'8%',right:'12%',width:500,height:500,background:'rgba(200,16,46,.07)',borderRadius:'50%',filter:'blur(100px)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:'8%',left:'10%',width:380,height:380,background:'rgba(37,99,235,.06)',borderRadius:'50%',filter:'blur(80px)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'40%',left:'35%',width:300,height:300,background:'rgba(200,16,46,.04)',borderRadius:'50%',filter:'blur(60px)',pointerEvents:'none'}}/>

      <div style={{display:'flex',flexDirection:'column',alignItems:'center',zIndex:1,width:420}}>
        {/* 로고 + 브랜드 */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:48}}>
          <div style={{width:68,height:68,background:`linear-gradient(145deg,${C.brand},#A00E25)`,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 32px rgba(200,16,46,.45)',marginBottom:20}}>
            <Logo sz={38}/>
          </div>
          <div style={{fontSize:32,fontWeight:800,color:'#fff',letterSpacing:'-.02em',marginBottom:6}}>LandNote</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.42)',letterSpacing:'.08em',fontWeight:500}}>부동산 매물관리 시스템</div>
        </div>

        {/* 로그인 카드 */}
        <div style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:18,padding:'36px 36px 32px',backdropFilter:'blur(20px)',boxShadow:'0 24px 48px rgba(0,0,0,.3)'}}>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:16,color:'rgba(255,255,255,.55)',fontWeight:600,display:'block',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase'}}>비밀번호</label>
            <input type="password" placeholder="비밀번호를 입력하세요" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onLogin()}
              style={{width:'100%',height:46,background:'rgba(255,255,255,.07)',border:'1.5px solid rgba(255,255,255,.12)',borderRadius:10,padding:'0 16px',color:'#fff',fontSize:15,letterSpacing:'.1em',fontFamily:'inherit',outline:'none',transition:'border-color .15s'}}
              onFocus={e=>e.target.style.borderColor='rgba(200,16,46,.7)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}/>
          </div>
          <button onClick={onLogin}
            style={{width:'100%',height:46,background:`linear-gradient(135deg,${C.brand},#A00E25)`,border:'none',borderRadius:10,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(200,16,46,.4)',fontFamily:'inherit',letterSpacing:'.02em',transition:'opacity .15s',display:'flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            로그인
          </button>
          <div style={{textAlign:'center',marginTop:20}}>
            <span style={{fontSize:13,color:'rgba(255,255,255,.3)',cursor:'pointer',transition:'color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.65)'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.3)'}>비밀번호를 잊으셨나요?</span>
          </div>
        </div>

        <div style={{fontSize:12,color:'rgba(255,255,255,.2)',marginTop:32,letterSpacing:'.04em',textAlign:'center'}}>RE/MAX Platinum Partners  ·  © 2026 LandNote</div>
      </div>
    </div>
  );
};


/* ═══ DASHBOARD ═══ */
const Dashboard=({onOpen,onNav,onNavWithTab,onNotify})=>{
  const P=useProperties();
  const SCHEDS=useOwnerSchedules();
  const CALLS=useOwnerCallLogs();
  const RENTALS=useRentals();
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d;},[]);
  const todayLabel=fmtTodayKorean();
  const alerts=useMemo(()=>{
    const items=[];
    const inWindow=(diff)=>diff>=0&&diff<=DASH_ALERT_MAX_DAYS;
    SCHEDS.forEach(s=>{
      const start=parseDashDate(s.date);
      if(!start) return;
      const endIso=s.dateEnd&&String(s.dateEnd)>String(s.date)?s.dateEnd:s.date;
      const end=parseDashDate(endIso)||start;
      const startDiff=dashDayDiff(today,start);
      const endDiff=dashDayDiff(today,end);
      if(endDiff<0) return; // 이미 종료
      const ongoing=startDiff<=0&&endDiff>=0;
      const upcoming=startDiff>0&&startDiff<=DASH_ALERT_MAX_DAYS;
      if(!ongoing&&!upcoming) return;
      const sortKey=ongoing?0:startDiff;
      const priC=schedulePriColor(s.pri);
      const period=fmtSchedulePeriodDot(s);
      const chkList=Array.isArray(s.chk)?s.chk.filter(c=>c&&String(c.t||'').trim()):[];
      const chkTotal=chkList.length;
      const chkDone=chkList.filter(c=>c.d).length;
      items.push({
        kind:'sched',target:s,sortKey,
        c:priC,
        bg:schedulePriBg(s.pri),
        icon:DASH_CALENDAR_ICON,
        label:`${ongoing?'진행 중 일정':dashSchedPrefix(startDiff)} — ${s.title}`,
        dayLabel:ongoing?'오늘':dashRelativeDayLabel(startDiff),
        priLabel:PRI_L[s.pri]||'보통',
        whenLabel:period+(s.time?` ${s.time}`:''),
        chkLabel:chkTotal>0?`${chkDone}/${chkTotal}`:null,
        sub:`${ongoing?'오늘':dashRelativeDayLabel(startDiff)} · ${PRI_L[s.pri]||'보통'} · ${period}${s.time?` ${s.time}`:''}`,
      });
    });
    CALLS.filter(c=>c.nDate&&c.next).forEach(c=>{
      const d=parseDashDate(c.nDate);
      if(!d) return;
      const diff=dashDayDiff(today,d);
      if(!inWindow(diff)) return;
      const prop=c.pid?P.find(p=>p.id===c.pid):null;
      items.push({
        kind:'call',target:c,sortKey:diff,
        c:diff===0?C.err:diff===1?C.info:C.info,
        icon:DASH_PHONE_ICON,
        label:`다음 액션 — ${c.next}`,
        sub:`${dashRelativeDayLabel(diff)} · ${fmtDashDate(d)} · ${dashDdayLabel(diff)}`,
        prop,
      });
    });
    RENTALS.forEach(r=>{
      const expiry=parseRentalExpiry(r);
      if(!expiry) return;
      const prop=P.find(p=>p.id===r.pid);
      if(!prop) return;
      const diff=dashDayDiff(today,expiry);
      if(!inWindow(diff)) return;
      const tenant=r.tenant||r.purpose||r.floor||'임차';
      items.push({
        kind:'rental',target:{rental:r,prop},sortKey:diff,
        c:diff<=1?C.warn:C.txM,
        icon:DASH_WARN_ICON,
        label:`임차만료 — ${tenant}`,
        sub:`${dashRelativeDayLabel(diff)} · ${fmtDashDate(expiry)} · ${dashDdayLabel(diff)}`,
      });
    });
    return items.sort((a,b)=>a.sortKey-b.sortKey||a.label.localeCompare(b.label,'ko'));
  },[SCHEDS,CALLS,RENTALS,P,today]);
  const alertSections=useMemo(()=>[
    {title:'오늘',items:alerts.filter(a=>a.sortKey===0)},
    {title:'내일',items:alerts.filter(a=>a.sortKey===1)},
    {title:'일주일 내',items:alerts.filter(a=>a.sortKey>=2&&a.sortKey<=DASH_ALERT_MAX_DAYS)},
  ].filter(s=>s.items.length>0),[alerts]);
  const openAlert=(a)=>{
    if(a.kind==='sched') onOpen('sd',a.target);
    else if(a.kind==='call'){
      if(a.prop) onOpen('pd',a.prop);
      else onOpen('ce',a.target);
    }else if(a.kind==='rental') onOpen('pd',a.target.prop);
  };
  const stats=[
    {id:'ALL',label:'전체 매물',val:P.length,
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg>,
      c:'#6366F1',bg:'#EEF2FF'},
    {id:'NEW',label:'신규',val:P.filter(x=>x.status==='NEW').length,
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
      c:C.ok,bg:C.okBg},
    {id:'ACTIVE',label:'진행중',val:P.filter(x=>x.status==='ACTIVE').length,
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      c:C.info,bg:C.infoBg},
    {id:'HOLD',label:'보류',val:P.filter(x=>x.status==='HOLD').length,
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>,
      c:C.warn,bg:C.warnBg},
    {id:'COMPLETED',label:'계약완료',val:P.filter(x=>x.status==='COMPLETED').length,
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
      c:'#64748B',bg:'#F1F5F9'},
  ];
  const propFavSortKey=(p)=>{
    if(p.favAt) return new Date(p.favAt).getTime();
    if(p.created){const [y,m,d]=p.created.split('.');return new Date(+y,+m-1,+d).getTime();}
    return p.id||0;
  };
  const propCreatedSortKey=(p)=>{
    if(p.created){const [y,m,d]=p.created.split('.');return new Date(+y,+m-1,+d).getTime();}
    return p.id||0;
  };
  const favAll=P.filter(x=>x.fav);
  const favs=[...favAll].sort((a,b)=>propFavSortKey(b)-propFavSortKey(a)||b.id-a.id).slice(0,5);
  const recent=[...P].sort((a,b)=>propCreatedSortKey(b)-propCreatedSortKey(a)||b.id-a.id).slice(0,5);
  /* 종류·거래·상태 % · 면적·용도지역 px — 차액은 주소 열 */
  const dashColTag='8%';
  const dashColTrade='12%';
  const dashColStatus='7%';
  const dashColRoi='6%';
  const dashColLandPy='8%';
  const dashColCreated='9%';
  const DASH_TBL_MIN_W=1020;
  const DashColgroup=()=>(
    <colgroup>
      <col style={{width:dashColTag}}/>
      <col />
      <col style={{width:dashColTrade}}/>
      <col style={{width:dashColStatus}}/>
      <col style={{width:dashColRoi}}/>
      <col style={{width:80}}/>
      <col style={{width:80}}/>
      <col style={{width:110}}/>
      <col style={{width:dashColLandPy}}/>
      <col style={{width:dashColCreated}}/>
    </colgroup>
  );
  const dashPropMetricCells=(p)=>(
    <>
      <td style={{textAlign:'right',fontSize:12,color:p.land>0?C.tx:C.txP,whiteSpace:'nowrap'}}>{propLandPyungLabel(p)}</td>
      <td style={{textAlign:'right',fontSize:12,color:p.floor>0?C.tx:C.txP,whiteSpace:'nowrap'}}>{propFloorPyungLabel(p)}</td>
      <td style={{textAlign:'center',fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={p.zoning||''}>
        <span style={{color:zoningTextColor(p.zoning),fontWeight:p.zoning?600:400}}>{propZoningLabel(p)}</span>
      </td>
      <td style={{textAlign:'right',fontSize:12,color:p.land>0&&p.price>0?C.tx:C.txP,whiteSpace:'nowrap'}}>{fmtLandPyUnit(p.price,p.land)}</td>
    </>
  );
  const dashTblHead=(
    <tr>
      <th>종류</th><th>주소</th><th>거래·가격</th><th>상태</th>
      <th style={{textAlign:'right'}}>수익률</th>
      <th style={{textAlign:'right'}}>대지면적</th>
      <th style={{textAlign:'right'}}>연면적</th>
      <th style={{textAlign:'center'}}>용도지역</th>
      <th style={{textAlign:'right'}}>대지 평단가</th>
      <th>등록일</th>
    </tr>
  );
  const DASH_STAT_PAD_Y=11;
  const DASH_STAT_PAD_X=16;
  const DASH_STAT_GAP=10;
  return(
    <div style={{flex:1,overflow:'auto',background:C.bg,minHeight:0}}>
      <PH title="대시보드" sub={todayLabel} acts={<CloudSyncHeaderActions onNotify={onNotify}/>}/>
      <div style={{padding:'20px 28px',display:'flex',flexDirection:'column',gap:20}}>
        {/* Stats — 세로 영역 약 60% (패딩·간격·가로 배치, 폰트 크기 유지) */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:DASH_STAT_GAP}}>
          {stats.map((s,i)=>(
            <div key={i} style={{background:C.surf,borderRadius:8,padding:`${DASH_STAT_PAD_Y}px ${DASH_STAT_PAD_X}px`,boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)',cursor:'pointer',display:'flex',alignItems:'center',gap:10,minHeight:0}}
              onClick={()=>onNavWithTab?onNavWithTab(s.id):onNav('properties')}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,.09),0 0 0 1px rgba(0,0,0,.06)'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}>
              <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',color:s.c}}>
                {React.cloneElement(s.icon,{width:16,height:16})}
              </div>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:28,fontWeight:700,color:C.tx,letterSpacing:'-.02em',lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:12,color:C.txM,marginTop:3,fontWeight:500,lineHeight:1.2}}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Row 2 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16}}>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* Favorites */}
            <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
              <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,flexShrink:0,color:'#F59E0B'}} aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></span>
                  <span style={{fontSize:14,fontWeight:600,color:C.tx}}>즐겨찾기 매물</span>
                  <span style={{fontSize:12,color:C.txM}}>{favAll.length}건</span>
                </div>
                <Btn role="link" ch="전체보기" ic="ti-arrow-right" on={()=>onNavWithTab?onNavWithTab('FAV'):onNav('properties')}/>
              </div>
              <div style={{overflowX:'auto'}}>
              <style dangerouslySetInnerHTML={{__html:`.dash-prop-tbl th,.dash-prop-tbl td{padding:10px 8px!important;letter-spacing:-0.01em;vertical-align:middle}`}}/>
              <table className="tbl tbl-fixed dash-prop-tbl" style={{tableLayout:'fixed',minWidth:DASH_TBL_MIN_W,width:'100%'}}>
                <DashColgroup/>
                <thead>{dashTblHead}</thead>
                <tbody>
                  {favs.map(p=>(
                    <tr key={p.id} onClick={()=>onOpen('pd',p)}>
                      <td style={{whiteSpace:'nowrap'}}><Bdg label={p.tag} type="gray"/></td>
                      <td>
                        <div className="cell-wrap" style={{fontWeight:500}}>{propDisplayAddr(p)}</div>
                        {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
                      </td>
                      <td><div className="cell-ellipsis"><span style={{fontSize:12,color:C.txM}}>{TL[p.trade]}</span><span style={{fontWeight:600,color:C.info,marginLeft:6}}>{propPrice(p)}</span></div></td>
                      <td style={{whiteSpace:'nowrap'}}><StatusBdg s={p.status}/></td>
                      <td style={{textAlign:'right'}}><div className="cell-ellipsis" style={{color:C.ok,fontWeight:500,fontSize:12}}>{p.roi||'-'}</div></td>
                      {dashPropMetricCells(p)}
                      <td><div className="cell-ellipsis" style={{color:C.txM,fontSize:12}}>{p.created}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            {/* Recent */}
            <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
              <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,flexShrink:0,color:C.txM}} aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                  <span style={{fontSize:14,fontWeight:600,color:C.tx}}>최근 등록 매물</span>
                </div>
                <Btn role="link" ch="전체보기" ic="ti-arrow-right" on={()=>onNav('properties')}/>
              </div>
              <div style={{overflowX:'auto'}}>
              <table className="tbl tbl-fixed dash-prop-tbl" style={{tableLayout:'fixed',minWidth:DASH_TBL_MIN_W,width:'100%'}}>
                <DashColgroup/>
                <thead>{dashTblHead}</thead>
                <tbody>
                  {recent.map(p=>(
                    <tr key={p.id} onClick={()=>onOpen('pd',p)}>
                      <td style={{whiteSpace:'nowrap'}}><Bdg label={p.tag} type="gray"/></td>
                      <td>
                        <div className="cell-wrap" style={{fontWeight:500}}>{propDisplayAddr(p)}</div>
                        {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
                      </td>
                      <td><div className="cell-ellipsis"><span style={{fontSize:12,color:C.txM}}>{TL[p.trade]}</span><span style={{fontWeight:600,color:C.info,marginLeft:6}}>{propPrice(p)}</span></div></td>
                      <td style={{whiteSpace:'nowrap'}}><StatusBdg s={p.status}/></td>
                      <td style={{textAlign:'right'}}><div className="cell-ellipsis" style={{color:C.ok,fontWeight:500,fontSize:12}}>{p.roi||'-'}</div></td>
                      {dashPropMetricCells(p)}
                      <td><div className="cell-ellipsis" style={{color:C.txM,fontSize:12}}>{p.created}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
          {/* D-day alerts */}
          <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)',height:'fit-content'}}>
            <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:8}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,flexShrink:0,color:C.err}} aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
              <span style={{fontSize:14,fontWeight:600,color:C.tx}}>D-day 알림</span>
            </div>
            {alertSections.length===0?(
              <div style={{padding:'20px 18px',fontSize:13,color:C.txM,textAlign:'center'}}>오늘~일주일 내 알림이 없습니다</div>
            ):alertSections.map((section,si)=>(
              <React.Fragment key={section.title}>
                <div style={{padding:'10px 18px 6px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:11,fontWeight:700,color:C.txM,textTransform:'uppercase',letterSpacing:'.06em'}}>
                  {section.title}
                </div>
                {section.items.map((a,i)=>(
              <div key={`${section.title}-${a.kind}-${a.target?.id??a.target?.prop?.id??i}`} style={{padding:'14px 18px',borderBottom:(si<alertSections.length-1||i<section.items.length-1)?`1px solid ${C.bdr}`:'none',display:'flex',gap:12,cursor:'pointer',minWidth:0,overflow:'hidden',borderLeft:a.kind==='sched'?`3px solid ${a.c}`:'3px solid transparent'}}
                onClick={()=>openAlert(a)}
                onMouseEnter={e=>e.currentTarget.style.background=a.bg||C.surf2}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{width:36,height:36,borderRadius:8,background:a.bg||`${a.c}18`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:a.c}}>
                  {React.cloneElement(a.icon,{width:18,height:18})}
                </div>
                <div style={{minWidth:0,flex:1,overflow:'hidden'}}>
                  <div className="cell-ellipsis" style={{fontSize:13,fontWeight:a.kind==='sched'?600:500,color:a.kind==='sched'?a.c:C.tx,lineHeight:1.4}} title={a.label}>{a.label}</div>
                  <div className="cell-ellipsis" style={{fontSize:12,color:C.txM,marginTop:3}} title={a.sub}>
                    {a.kind==='sched'?(
                      <>
                        {a.dayLabel} · <span style={{color:a.c,fontWeight:600}}>{a.priLabel}</span>
                        {a.whenLabel?` · ${a.whenLabel}`:''}
                        {a.chkLabel?` · 체크리스트 ${a.chkLabel}`:''}
                      </>
                    ):a.sub}
                  </div>
                </div>
              </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
/* ═══ PROPERTY LIST — 가격 70%, 종류·대지평단가 120%, 거래방식(기준55px) 110%, 상태 90%, 부족분은 주소/건물명에서 차감 */
/** 매물관리 리스트 행 — 수정/삭제 버튼 노출 (false: 미노출, 상세·일괄 작업으로만 편집) */
const PROP_LIST_PAD_X=20;
const PROP_LIST_SHOW_ROW_ACTIONS=false;
const PROP_ROW_ACTION_COL_W=136;
const PROP_TRADE_BASE=55;
const PROP_PRICE=122;
const PROP_ADDR_NOM=248;
const PROP_COL={
  check:32,star:32,status:76,trade:Math.round(PROP_TRADE_BASE*1.1),tag:86,
  roi:64,landArea:88,floorArea:88,zoning:118,landPy:94,lastCall:82,created:80,
  ...(PROP_LIST_SHOW_ROW_ACTIONS?{action:PROP_ROW_ACTION_COL_W}:{}),
};
const PROP_COL_FIXED=Object.values(PROP_COL).reduce((a,b)=>a+b,0);
const PROP_ADDR_MIN=96;
const PROP_COL_ADDR_REMAINDER=PROP_COL_FIXED+PROP_PRICE;
const PROP_LIST_MIN_W=PROP_COL_ADDR_REMAINDER+PROP_ADDR_MIN;
/** 주소 열은 상한을 두고, 남는 가로 폭은 가격~등록일 열 쪽으로 배분 */
const propAddrColWidth=PROP_LIST_SHOW_ROW_ACTIONS
  ? `min(${PROP_ADDR_NOM}px, max(${PROP_ADDR_MIN}px, calc((100% - ${PROP_COL_ADDR_REMAINDER}px) * 0.8)))`
  : `min(${PROP_ADDR_NOM}px, max(${PROP_ADDR_MIN}px, calc(100% - ${PROP_COL_ADDR_REMAINDER}px)))`;
const PROP_LIST_TBL_ADDR_CSS=`.prop-list-tbl .prop-col-addr{max-width:${PROP_ADDR_NOM}px!important;overflow:hidden}`;
const PROP_LIST_TBL_METRICS_CSS=`.prop-list-tbl .prop-col-metrics{padding-left:10px!important;padding-right:10px!important}`;
const PROP_LIST_TBL_DATE_CSS=`.prop-list-tbl .prop-col-date{text-align:center!important;white-space:nowrap!important;font-size:12px;min-width:${PROP_COL.created}px;overflow:visible!important}.prop-list-tbl th.prop-col-date{text-align:center!important}`;
/** sticky 우측 열 — box-shadow 금지 (인접 열·최종통화일 옆 세로선 회귀 방지) */
const PROP_LIST_STICKY_COL=`position:sticky!important;right:0;background:${C.surf}!important`;
const PROP_LIST_TBL_CREATED_STICKY_CSS=!PROP_LIST_SHOW_ROW_ACTIONS
  ? `.prop-list-tbl .prop-col-created{${PROP_LIST_STICKY_COL};z-index:2;min-width:${PROP_COL.created}px}.prop-list-tbl thead .prop-col-created{z-index:4;background:#F8F9FB!important}.prop-list-tbl tbody tr:hover .prop-col-created{background:#FAFBFF!important}`
  : '';
const PROP_LIST_TBL_ACTION_CSS=PROP_LIST_SHOW_ROW_ACTIONS
  ? `.prop-list-tbl .prop-col-action{${PROP_LIST_STICKY_COL};z-index:3;overflow:visible!important;min-width:${PROP_ROW_ACTION_COL_W}px}.prop-list-tbl thead .prop-col-action{z-index:5;background:#F8F9FB!important}.prop-list-tbl tbody tr:hover .prop-col-action{background:#FAFBFF!important}`
  : '';
const FOLDER_LIST_MIN_W=1150;
const FOLDER_TBL_STYLE=`.folder-prop-tbl th,.folder-prop-tbl td{padding:10px 8px!important;vertical-align:middle;letter-spacing:-0.01em}.folder-prop-tbl .f-col-star{text-align:center}.folder-prop-tbl .f-col-num{text-align:right!important;white-space:nowrap;font-size:12px}.folder-prop-tbl th.f-col-num{text-align:right!important}.folder-prop-tbl .f-col-zone{text-align:center!important;white-space:nowrap;font-size:12px;overflow:hidden;text-overflow:ellipsis}.folder-prop-tbl th.f-col-zone{text-align:center!important}.folder-prop-tbl .f-col-date{text-align:center!important;white-space:nowrap;font-size:12px}.folder-prop-tbl th.f-col-date{text-align:center!important}`;

const FolderPickCheckbox=({checked,inFolder})=>(
  <div style={{width:18,height:18,borderRadius:5,border:`1.5px solid ${inFolder?C.bdrSt:checked?C.brand:C.bdrSt}`,background:inFolder?C.surf2:checked?C.brand:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,margin:'0 auto'}}>
    {(inFolder||checked)&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={inFolder?C.txP:'#fff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
  </div>
);

const FolderPropTable=({pick,rows,emptyMsg,getPickState,onToggleFav,onAddrClick,onRowClick,renderTrailing,getRowOpacity,maxHeight,wrapStyle})=>{
  const colSpan=pick?14:13;
  return(
    <>
      <style dangerouslySetInnerHTML={{__html:FOLDER_TBL_STYLE}}/>
      <div style={{overflowX:'auto',overflowY:maxHeight?'auto':undefined,maxHeight,...wrapStyle}}>
        <table className="tbl folder-prop-tbl" style={{tableLayout:'fixed',minWidth:FOLDER_LIST_MIN_W,width:'100%'}}>
          <colgroup>
            {pick&&<col style={{width:32}}/>}
            <col style={{width:PROP_COL.star}}/>
            <col style={{width:PROP_COL.status}}/>
            <col style={{width:PROP_COL.tag}}/>
            <col />
            <col style={{width:PROP_PRICE}}/>
            <col style={{width:PROP_COL.roi}}/>
            <col style={{width:PROP_COL.landArea}}/>
            <col style={{width:PROP_COL.floorArea}}/>
            <col style={{width:PROP_COL.zoning}}/>
            <col style={{width:PROP_COL.landPy}}/>
            <col style={{width:PROP_COL.lastCall}}/>
            <col style={{width:PROP_COL.created}}/>
            <col style={{width:pick?48:PROP_ROW_ACTION_COL_W}}/>
          </colgroup>
          <thead>
            <tr style={{background:C.secBg}}>
              {pick&&<th style={{width:32}}/>}
              <th className="f-col-star">★</th>
              <th>상태</th>
              <th>종류</th>
              <th>주소 / 건물명</th>
              <th className="f-col-num">가격</th>
              <th className="f-col-num">수익률</th>
              <th className="f-col-num">대지면적</th>
              <th className="f-col-num">연면적</th>
              <th className="f-col-zone">용도지역</th>
              <th className="f-col-num">대지 평단가</th>
              <th className="f-col-date">최종통화일</th>
              <th className="f-col-date">등록일</th>
              <th/>
            </tr>
          </thead>
          <tbody>
            {rows.length===0?(
              <tr><td colSpan={colSpan} style={{textAlign:'center',padding:'14px',color:C.txP,fontSize:13}}>{emptyMsg||'없음'}</td></tr>
            ):rows.map(p=>{
              const ps=getPickState?.(p)||{};
              const inFolder=!!ps.inFolder;
              const sel=!!ps.sel;
              const opacity=getRowOpacity?getRowOpacity(p,ps):inFolder&&pick?0.55:1;
              return(
                <tr key={p.id}
                  onClick={onRowClick?()=>onRowClick(p,ps):undefined}
                  style={{cursor:onRowClick?'pointer':'default',opacity}}
                  onMouseEnter={e=>{if(onRowClick)e.currentTarget.style.background=C.surf2;}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                  {pick&&(
                    <td style={{textAlign:'center'}}>
                      <FolderPickCheckbox checked={sel} inFolder={inFolder}/>
                    </td>
                  )}
                  <td className="f-col-star" onClick={e=>e.stopPropagation()}>
                    <span onClick={e=>onToggleFav?.(p,e)} style={{color:p.fav?'#F59E0B':C.txP,fontSize:15,cursor:onToggleFav?'pointer':'default',lineHeight:1}}>{p.fav?'★':'☆'}</span>
                  </td>
                  <td style={{whiteSpace:'nowrap'}}><StatusBdg s={p.status}/></td>
                  <td style={{whiteSpace:'nowrap'}}><Bdg label={p.tag} type="gray"/></td>
                  <td style={{overflow:'hidden',verticalAlign:'middle',cursor:onAddrClick?'pointer':'default'}}
                    onClick={e=>{if(onAddrClick){e.stopPropagation();onAddrClick(p);}}}>
                    <div className="cell-wrap" style={{fontWeight:500,fontSize:13,color:C.tx}}>{propDisplayAddr(p)}</div>
                    {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
                  </td>
                  <td className="f-col-num" style={{fontWeight:600,color:C.info}} title={propPrice(p)}>{propPrice(p)}</td>
                  <td className="f-col-num" style={{color:C.ok,fontWeight:500}}>{p.roi||'—'}</td>
                  <td className="f-col-num" style={{color:p.land>0?C.tx:C.txP}}>{propLandPyungLabel(p)}</td>
                  <td className="f-col-num" style={{color:p.floor>0?C.tx:C.txP}}>{propFloorPyungLabel(p)}</td>
                  <PropZoningCell p={p} className="f-col-zone"/>
                  <td className="f-col-num" style={{color:p.land>0&&p.price>0?C.tx:C.txP}}>{fmtLandPyUnit(p.price,p.land)}</td>
                  <td className="f-col-date" style={{color:p.lastCall!=='—'?C.txS:C.txP}}>{p.lastCall}</td>
                  <td className="f-col-date" style={{color:C.txM}}>{p.created}</td>
                  <td style={{textAlign:'center',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>
                    {renderTrailing?.(p,ps)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

const PROP_LIST_TABS=new Set(['ALL','NEW','ACTIVE','HOLD','COMPLETED','FAV','FOLDER']);
const normalizePropListTab=(tab)=>PROP_LIST_TABS.has(tab)?tab:'ALL';

const PropList=({onOpen,onNav,folders,propFolders,setPropFolders,onDeleteProperty})=>{
  const P=useProperties();
  const CALLS=useOwnerCallLogs();
  const { user, company, profile, companyRole, teamNameMap, teamRoleMap, memberPermissions }=useAuth();
  const workspaceId=company?.id??profile?.company_id??null;
  const showOwnerScopeTabs=isBusinessRole(companyRole)&&workspaceId&&!isSoloRole(companyRole);
  const effectivePerms=getEffectivePermissions(companyRole,memberPermissions);
  const canViewTeamProps=canViewTeamProperties(effectivePerms);
  const [ownerScopeTab,setOwnerScopeTab]=useState('ALL');
  const getSharedLabel=useCallback((p)=>{
    if(!isSharedRecord(p,user?.id)) return null;
    return formatSharedPropertyLabel(teamNameMap[p.ownerId],teamRoleMap[p.ownerId]);
  },[user?.id,teamNameMap,teamRoleMap]);
  const propCallDateMap=useMemo(()=>buildPropCallDateMap(CALLS),[CALLS]);
  const baseProps=useMemo(()=>{
    const scoped=(!showOwnerScopeTabs||ownerScopeTab==='ALL')?P:P.filter(p=>matchesOwner(p,user?.id));
    return scoped.map(p=>({...p,lastCall:fmtCallDate(propCallDatesOf(propCallDateMap,p.id).last)}));
  },[P,showOwnerScopeTabs,ownerScopeTab,user?.id,propCallDateMap]);
  const isMobile=useIsMobile();
  const [searchParams,setSearchParams]=useSearchParams();
  const saved=loadPropListState();
  const urlTab=searchParams.get('tab');
  const scrollRef=useRef(null);
  const [search,setSearch]=useState(saved.search??'');
  const [filter,setFilter]=useState(saved.filter??false);
  const [selSido,setSelSido]=useState(saved.selSido??'');
  const [selGu,setSelGu]=useState(saved.selGu??'');
  const [statusTab,setStatusTab]=useState(()=>normalizePropListTab(urlTab||saved.statusTab||'ALL'));
  useEffect(()=>{
    if(urlTab) setStatusTab(normalizePropListTab(urlTab));
  },[urlTab]);
  const [sortKey,setSortKey]=useState(saved.sortKey!==undefined?saved.sortKey:'created');
  const [sortDir,setSortDir]=useState(()=>{
    if(saved.sortDir) return saved.sortDir;
    if(saved.sortKey!==undefined) return 'asc';
    return 'desc';
  });
  const [colFilter,setColFilter]=useState(saved.colFilter??{tag:'',trade:'',status:''});
  const [openColFilter,setOpenColFilter]=useState(null);
  const [filterResetKey,setFilterResetKey]=useState(0);
  const [advTag,setAdvTag]=useState(saved.advTag??'');
  const [advTrade,setAdvTrade]=useState(saved.advTrade??'');
  const [advStatus,setAdvStatus]=useState(saved.advStatus??'');
  const [advPriceMin,setAdvPriceMin]=useState(saved.advPriceMin??'');
  const [advPriceMax,setAdvPriceMax]=useState(saved.advPriceMax??'');
  const [advLandMin,setAdvLandMin]=useState(saved.advLandMin??'');
  const [advLandMax,setAdvLandMax]=useState(saved.advLandMax??'');
  const [advFloorMin,setAdvFloorMin]=useState(saved.advFloorMin??'');
  const [advFloorMax,setAdvFloorMax]=useState(saved.advFloorMax??'');
  const [advRoiMin,setAdvRoiMin]=useState(saved.advRoiMin??'');
  const [appliedAdv,setAppliedAdv]=useState(saved.appliedAdv??null);
  const STATUS_LABEL_TO_CODE={'신규':'NEW','진행중':'ACTIVE','보류':'HOLD','계약완료':'COMPLETED'};
  const applyAdvSearch=()=>setAppliedAdv({
    sido:selSido,gu:selGu,tag:advTag,trade:advTrade,status:advStatus,
    priceMin:advPriceMin,priceMax:advPriceMax,
    landMin:advLandMin,landMax:advLandMax,
    floorMin:advFloorMin,floorMax:advFloorMax,
    roiMin:advRoiMin,
  });
  const resetAdvSearch=()=>{
    setSelSido('');setSelGu('');setAdvTag('');setAdvTrade('');setAdvStatus('');
    setAdvPriceMin('');setAdvPriceMax('');setAdvLandMin('');setAdvLandMax('');
    setAdvFloorMin('');setAdvFloorMax('');setAdvRoiMin('');
    setAppliedAdv(null);
    setFilterResetKey(k=>k+1);
  };
  const [checked,setChecked]=useState({});
  const [expandedFolders,setExpandedFolders]=useState(saved.expandedFolders??{});
  const toggleFolderOpen=(fid)=>setExpandedFolders(e=>({...e,[fid]:!e[fid]}));
  const toggleCheck=(id)=>setChecked(c=>({...c,[id]:!c[id]}));
  const checkedIds=Object.keys(checked).filter(id=>checked[id]).map(Number);
  const [bulkOpen,setBulkOpen]=useState(false);
  const [statusBulkOpen,setStatusBulkOpen]=useState(false);
  const [folderAddOpen,setFolderAddOpen]=useState(null);
  const [folderAddSearch,setFolderAddSearch]=useState('');
  const [folderAddSel,setFolderAddSel]=useState({});
  const [bulkDragActive,setBulkDragActive]=useState(false);
  const [visibleCount,setVisibleCount]=useState(saved.visibleCount??20);
  const persistListState=useCallback((scrollTop)=>{
    savePropListState({
      search, filter, selSido, selGu, statusTab, sortKey, sortDir, colFilter,
      advTag, advTrade, advStatus, advPriceMin, advPriceMax, advLandMin, advLandMax,
      advFloorMin, advFloorMax, advRoiMin, appliedAdv, visibleCount, expandedFolders,
      scrollTop: scrollTop??scrollRef.current?.scrollTop??0,
    });
  }, [search, filter, selSido, selGu, statusTab, sortKey, sortDir, colFilter,
    advTag, advTrade, advStatus, advPriceMin, advPriceMax, advLandMin, advLandMax,
    advFloorMin, advFloorMax, advRoiMin, appliedAdv, visibleCount, expandedFolders]);
  const togglePropertyFav=useCallback(async(p,e)=>{
    e?.stopPropagation?.();
    await setPropertyFav(p.id,!p.fav);
  },[]);
  const openProperty=useCallback((p)=>{
    persistListState();
    onOpen('pd',p);
  }, [onOpen, persistListState]);
  useLayoutEffect(()=>{
    if(scrollRef.current&&saved.scrollTop){
      scrollRef.current.scrollTop=saved.scrollTop;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount 시 scroll 복원
  }, []);
  useEffect(()=>()=>clearPropListState(),[]);
  const toggleSort=(key)=>{
    if(sortKey!==key){setSortKey(key);setSortDir('asc');}
    else if(sortDir==='asc'){setSortDir('desc');}
    else{setSortKey(null);setSortDir('asc');}
  };
  const handleScroll=(e)=>{
    const el=e.currentTarget;
    if(el.scrollHeight-el.scrollTop-el.clientHeight<80)setVisibleCount(v=>v+20);
    savePropListState({ scrollTop: el.scrollTop });
  };
  const statusTabList=[
    {id:'ALL',label:'전체'},
    {id:'FAV',label:'즐겨찾기'},
    {id:'FOLDER',label:'폴더'},
    {id:'NEW',label:'신규'},
    {id:'ACTIVE',label:'진행중'},
    {id:'HOLD',label:'보류'},
    {id:'COMPLETED',label:'계약완료'},
  ];
  const folderPropCount=baseProps.filter(p=>(propFolders[p.id]||[]).length>0).length;
  const priceOfForFilter=(p)=>priceInManForFilter(p);
  const rows=baseProps.filter(p=>{
    if(statusTab==='FAV'&&!p.fav) return false;
    if(statusTab==='FOLDER'&&!(propFolders[p.id]||[]).length) return false;
    if(statusTab!=='ALL'&&statusTab!=='FAV'&&statusTab!=='FOLDER'&&p.status!==statusTab) return false;
    if(colFilter.tag&&p.tag!==colFilter.tag) return false;
    if(colFilter.trade&&p.trade!==colFilter.trade) return false;
    if(colFilter.status&&p.status!==colFilter.status) return false;
    if(appliedAdv){
      const a=appliedAdv;
      if(!sidoMatch(propSearchHaystack(p),a.sido)) return false;
      if(a.gu&&!propSearchHaystack(p).includes(a.gu)) return false;
      if(a.tag&&p.tag!==a.tag) return false;
      if(a.trade&&p.trade!==a.trade) return false;
      if(a.status&&p.status!==STATUS_LABEL_TO_CODE[a.status]) return false;
      if((a.priceMin||a.priceMax)&&priceOfForFilter(p)===null) return false;
      if(a.priceMin&&priceOfForFilter(p)<Number(a.priceMin)) return false;
      if(a.priceMax&&priceOfForFilter(p)>Number(a.priceMax)) return false;
      const landPyVal=p.land>0?py(p.land):0;
      if(a.landMin&&(!landPyVal||Number(landPyVal)<Number(a.landMin))) return false;
      if(a.landMax&&(!landPyVal||Number(landPyVal)>Number(a.landMax))) return false;
      const floorPyVal=p.floor>0?py(p.floor):0;
      if(a.floorMin&&(!floorPyVal||Number(floorPyVal)<Number(a.floorMin))) return false;
      if(a.floorMax&&(!floorPyVal||Number(floorPyVal)>Number(a.floorMax))) return false;
      if(a.roiMin&&(parseFloat(p.roi)||0)<Number(a.roiMin)) return false;
    }
    if(!search) return true;
    return propMatchesSearch(p,search);
  });
  const getSortVal=(p,key)=>{
    if(key==='price') return priceInManForFilter(p) ?? (p.mRent||0);
    if(key==='roi') return parseFloat(p.roi)||-1;
    if(key==='landArea') return parseFloat(p.land)||-1;
    if(key==='floorArea') return parseFloat(p.floor)||-1;
    if(key==='zoning') return p.zoning||'';
    if(key==='landPy') return calcPyUnitPriceMan(p.price,p.land)??-1;
    if(key==='lastCall') return p.lastCall==='—'?'':p.lastCall;
    if(key==='created') return p.created;
    return '';
  };
  const sorted=[...rows].sort((a,b)=>{
    if(sortKey){
      const av=getSortVal(a,sortKey), bv=getSortVal(b,sortKey);
      if(av<bv) return sortDir==='asc'?-1:1;
      if(av>bv) return sortDir==='asc'?1:-1;
      return 0;
    }
    const av=getSortVal(a,'created'), bv=getSortVal(b,'created');
    if(av<bv) return 1;
    if(av>bv) return -1;
    return (b.fav?1:0)-(a.fav?1:0)||b.id-a.id;
  });
  const visible=sorted.slice(0,visibleCount);
  const selectableIds=useMemo(()=>sorted.map((p)=>p.id),[sorted]);
  const allSelected=selectableIds.length>0&&selectableIds.every((id)=>checked[id]);
  const someSelected=selectableIds.some((id)=>checked[id]);
  const toggleSelectAll=()=>{
    if(allSelected){
      setChecked((c)=>{
        const next={...c};
        selectableIds.forEach((id)=>{ delete next[id]; });
        return next;
      });
    }else{
      setChecked((c)=>{
        const next={...c};
        selectableIds.forEach((id)=>{ next[id]=true; });
        return next;
      });
    }
  };
  const canEditProp=(p)=>canWriteRecord(p,user?.id,companyRole,memberPermissions,'properties');
  const handleDeleteProperty=(p)=>{
    if(!onDeleteProperty) return;
    onDeleteProperty(p,()=>setChecked((c)=>{const next={...c};delete next[p.id];return next;}));
  };
  const applyBulkStatus=async(newStatus)=>{
    const targets=sorted.filter((p)=>checked[p.id]&&canEditProp(p));
    if(!targets.length){
      window.alert('선택한 매물 중 수정 가능한 항목이 없습니다.');
      return;
    }
    await Promise.all(targets.map((p)=>updateProperty(p.id,{status:newStatus})));
    showNotification('수정되었습니다.','info');
    setStatusBulkOpen(false);
    setChecked({});
  };
  const PROP_STATUS_BULK_OPTS=[
    {id:'NEW',label:'신규'},
    {id:'ACTIVE',label:'진행중'},
    {id:'HOLD',label:'보류'},
    {id:'COMPLETED',label:'계약완료'},
  ];

  const openFolderAdd=(fid)=>{
    setFolderAddOpen(prev=>prev===fid?null:fid);
    setFolderAddSearch('');
    setFolderAddSel({});
  };
  const toggleFolderAddSel=(pid)=>{
    setFolderAddSel(s=>({...s,[pid]:!s[pid]}));
  };
  const addSelectedToFolder=(fid)=>{
    const ids=Object.keys(folderAddSel).filter(id=>folderAddSel[id]).map(Number);
    if(!ids.length) return;
    setPropFolders(pf=>{
      const next={...pf};
      ids.forEach(pid=>{
        const cur=next[pid]||[];
        if(!cur.includes(fid)) next[pid]=[...cur,fid];
      });
      return next;
    });
    setFolderAddSel({});
    setFolderAddSearch('');
    setFolderAddOpen(null);
  };
  const removePropFromFolder=(pid,fid)=>{
    setPropFolders(pf=>{
      const cur=pf[pid]||[];
      return {...pf,[pid]:cur.filter(x=>x!==fid)};
    });
  };
  const folderItemsOf=(fid)=>sorted.filter(p=>(propFolders[p.id]||[]).includes(fid));
  const folderAddCandidates=useMemo(()=>[...baseProps.filter(p=>!folderAddSearch||propMatchesSearch(p,folderAddSearch))]
    .sort((a,b)=>(b.fav?1:0)-(a.fav?1:0)),[baseProps,folderAddSearch]);
  const onBulkDragOver=(e)=>{
    if(!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setBulkDragActive(true);
  };
  const onBulkDragLeave=(e)=>{
    if(!e.currentTarget.contains(e.relatedTarget)) setBulkDragActive(false);
  };
  const onBulkDrop=(e)=>{
    e.preventDefault();
    setBulkDragActive(false);
    const file=e.dataTransfer.files?.[0];
    if(!file) return;
    if(!isBulkUploadFile(file)){
      window.alert('CSV 또는 Excel(.xlsx) 파일만 일괄 등록할 수 있습니다.');
      return;
    }
    setPendingBulkFile(file);
    onNav&&onNav('registerBulk');
  };
  return(
    <div
      style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg,position:'relative'}}
      onDragOver={onBulkDragOver}
      onDragLeave={onBulkDragLeave}
      onDrop={onBulkDrop}
    >
      {bulkDragActive&&(
        <div style={{
          position:'absolute',inset:0,zIndex:50,background:'rgba(200,16,46,.08)',
          border:`3px dashed ${C.brand}`,borderRadius:4,pointerEvents:'none',
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <div style={{
            background:'#fff',borderRadius:12,padding:'20px 28px',boxShadow:'0 8px 32px rgba(15,23,42,.12)',
            textAlign:'center',border:`1px solid ${C.bdr}`,
          }}>
            <div style={{fontSize:16,fontWeight:700,color:C.tx,marginBottom:4}}>일괄 등록 파일을 놓으세요</div>
            <div style={{fontSize:13,color:C.txM}}>CSV · Excel(.xlsx)</div>
          </div>
        </div>
      )}
      {!isMobile?(
      <PH title="매물 관리" sub={`${statusTabList.find(t=>t.id===statusTab)?.label||'전체'} ${rows.length}건`}
        acts={<>
          <Btn role="page-secondary" ch="폴더 관리" ic="ti-folder" on={()=>onOpen('fm',null)}/>
          <Btn role="page-secondary" ch="지도로 보기" ic="ti-map-2" on={()=>onNav&&onNav('mapview')}/>
          <Btn role="page-secondary" ch="일괄 등록" ic="ti-upload" on={()=>onNav&&onNav('registerBulk')}/>
          <Btn role="page-primary" ch="매물 등록" on={()=>onNav&&onNav('register')}/>
        </>}
        ch={
          <div style={{display:'flex',alignItems:'center',gap:10,marginLeft:20,flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,height:36,background:'#fff',border:`1.5px solid ${C.bdr}`,borderRadius:7,padding:'0 12px',flex:1,maxWidth:360}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:15,height:15,flexShrink:0,color:C.txP}} aria-hidden><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="도로명·지번·건물명 검색..." style={{border:'none',background:'transparent',fontSize:14,color:C.tx,flex:1,height:'100%'}}/>
            </div>
            <Btn role="filter" ch={filter?'필터 닫기':'상세검색'} ic={filter?'ti-x':'ti-adjustments-horizontal'} sx={{gap:6}}
              on={()=>setFilter(v=>!v)}/>
          </div>
        }/>
      ):(
      <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 16px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8,height:40,background:'#fff',border:`1.5px solid ${C.bdr}`,borderRadius:10,padding:'0 12px',flex:1}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.txP} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="주소·건물명 검색..." style={{border:'none',background:'transparent',fontSize:15,color:C.tx,flex:1,height:'100%'}}/>
          </div>
          <button type="button" onClick={()=>setFilter(v=>!v)} style={{width:btnPx(40),height:btnPx(40),borderRadius:btnPx(10),border:`1.5px solid ${filter?C.brand:C.bdr}`,background:filter?C.brandL:'#fff',color:filter?C.brand:C.txM,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} aria-label="상세검색">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/></svg>
          </button>
        </div>
        <div style={{fontSize:13,color:C.txM}}>{statusTabList.find(t=>t.id===statusTab)?.label||'전체'} <strong style={{color:C.tx}}>{rows.length}</strong>건</div>
      </div>
      )}
      {showOwnerScopeTabs&&(
        <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:isMobile?'0 12px':'0 28px',display:'flex',flexDirection:'column',flexShrink:0}}>
          <div style={{display:'flex',gap:0}}>
            {[{id:'ALL',label:'전체 매물'},{id:'MINE',label:'내 매물'}].map(t=>(
              <div key={t.id} onClick={()=>{setOwnerScopeTab(t.id);setVisibleCount(20);}}
                style={{padding:'10px 18px',cursor:'pointer',fontSize:13,fontWeight:ownerScopeTab===t.id?600:400,color:ownerScopeTab===t.id?C.brand:C.txM,borderBottom:ownerScopeTab===t.id?`2px solid ${C.brand}`:'2px solid transparent',marginBottom:-1}}>
                {t.label}
              </div>
            ))}
          </div>
          {ownerScopeTab==='ALL'&&!canViewTeamProps&&!isCeoRole(companyRole)&&(
            <div style={{padding:'8px 18px 10px',fontSize:12,color:C.txM,lineHeight:1.5,background:C.surf2}}>
              동료 매물 보기 권한이 없어 <strong style={{color:C.tx}}>내가 등록한 매물</strong>만 표시됩니다. 권한 변경은 대표에게 문의하세요.
            </div>
          )}
          {ownerScopeTab==='ALL'&&canViewTeamProps&&!isCeoRole(companyRole)&&P.filter(p=>p.ownerId&&p.ownerId!==user?.id).length===0&&(
            <div style={{padding:'8px 18px 10px',fontSize:12,color:C.txM,lineHeight:1.5,background:C.surf2}}>
              공유 매물이 아직 없습니다. <strong style={{color:C.tx}}>대시보드 상단「동기화」</strong>를 눌러 주세요. 옆 <strong style={{color:C.tx}}>?</strong> 버튼에서 안내를 볼 수 있습니다.
            </div>
          )}
        </div>
      )}
      {/* Status filter tabs */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:isMobile?'0 12px':'0 28px',display:'flex',gap:0,overflowX:isMobile?'auto':'visible',flexShrink:0}}>
        {statusTabList.map(t=>(
          <div key={t.id} onClick={()=>{setStatusTab(t.id);setVisibleCount(20);setSearchParams(t.id==='ALL'?{}:{tab:t.id},{replace:true});}} style={{padding:'10px 18px',cursor:'pointer',fontSize:13,fontWeight:statusTab===t.id?600:400,color:statusTab===t.id?C.brand:C.txM,borderBottom:statusTab===t.id?`2px solid ${C.brand}`:'2px solid transparent',marginBottom:-1,transition:'color .1s',display:'flex',alignItems:'center',gap:5}}>
            {t.label}
            {t.id!=='ALL'&&<span style={{fontSize:12,color:t.id==='FAV'?'#F59E0B':C.txP}}>{
              t.id==='FAV'?P.filter(p=>p.fav).length:
              t.id==='FOLDER'?folderPropCount:
              P.filter(p=>p.status===t.id).length
            }</span>}
          </div>
        ))}
      </div>
      {filter&&(
        <div key={filterResetKey} style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'16px 28px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>거래방식</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advTrade} onChange={e=>setAdvTrade(e.target.value)}>
                <option value="">전체</option>
                {Object.entries(TL).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>지역(도·시)</div>
              <select className="sel" style={{height:34,fontSize:13}} value={selSido} onChange={e=>{setSelSido(e.target.value);setSelGu('');}}>
                <option value="">전체</option>
                {KR_SIDO.map(s=>(<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>구·군</div>
              <select className="sel" style={{height:34,fontSize:13}} value={selGu} onChange={e=>setSelGu(e.target.value)}>
                <option value="">전체</option>
                {(selSido?KR_GU[selSido]||[]:[...new Set(KR_SIDO.flatMap(s=>KR_GU[s]||[]))]).slice().sort((a,b)=>a.localeCompare(b,'ko')).map(g=>(<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매물 종류</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advTag} onChange={e=>setAdvTag(e.target.value)}>
                <option value="">전체</option>{['상가건물','아파트','오피스텔','사무실','빌라','토지','원룸/투룸'].map(t=>(<option key={t}>{t}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>진행 상태</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advStatus} onChange={e=>setAdvStatus(e.target.value)}>
                <option value="">전체</option>{['신규','진행중','보류','계약완료'].map(s=>(<option key={s}>{s}</option>))}
              </select>
            </div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>가격 최소(만)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advPriceMin} onChange={e=>setAdvPriceMin(e.target.value)}/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>가격 최대(만)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advPriceMax} onChange={e=>setAdvPriceMax(e.target.value)}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:14}}>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>대지면적 최소(평)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advLandMin} onChange={e=>setAdvLandMin(e.target.value)}/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>대지면적 최대(평)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advLandMax} onChange={e=>setAdvLandMax(e.target.value)}/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>연면적 최소(평)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="-" value={advFloorMin} onChange={e=>setAdvFloorMin(e.target.value)}/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>연면적 최대(평)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="-" value={advFloorMax} onChange={e=>setAdvFloorMax(e.target.value)}/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>수익률 이상(%)</div>
              <MoneyInput decimal style={{height:32,fontSize:13}} placeholder="-" value={advRoiMin} onChange={e=>setAdvRoiMin(e.target.value)}/></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn role="toolbar-primary" ch="검색 적용" ic="ti-search" on={applyAdvSearch}/>
            <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={resetAdvSearch}/>
          </div>
        </div>
      )}
      <div ref={scrollRef} style={{flex:1,overflow:'auto',padding:isMobile?'12px 16px 16px':'16px 28px'}} onScroll={handleScroll}>
        {statusTab==='FOLDER'&&(
          <div style={{marginBottom:16}} onClick={()=>setFolderAddOpen(null)}>
            <div style={{fontSize:12,fontWeight:700,color:C.txM,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
              폴더별 매물
              <span style={{fontSize:12,color:C.txP,fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:4}}>· {folders.length}개 폴더</span>
            </div>
            {folders.length===0?(
              <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'18px 20px',fontSize:13,color:C.txP,display:'flex',alignItems:'center',gap:8}}>
                만든 폴더가 없습니다. <span onClick={()=>onOpen('fm',null)} style={{color:C.brand,fontWeight:600,cursor:'pointer'}}>폴더 관리에서 만들어보세요</span>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {folders.map(f=>{
                  const items=folderItemsOf(f.id);
                  const open=Boolean(expandedFolders[f.id]);
                  const addOpen=folderAddOpen===f.id;
                  const addSelCount=Object.values(folderAddSel).filter(Boolean).length;
                  return(
                    <div key={f.id} style={{background:C.surf,border:`1px solid ${addOpen?f.color:C.bdr}`,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 16px',background:open?C.surf2:C.surf,borderBottom:open||addOpen?`1px solid ${C.bdr}`:'none',cursor:'pointer',userSelect:'none'}}
                        onClick={()=>toggleFolderOpen(f.id)}>
                        <span style={{width:13,height:13,display:'inline-flex',alignItems:'center',justifyContent:'center',color:C.txP,flexShrink:0}} aria-hidden>
                          {open
                            ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                            :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                          }
                        </span>
                        <span style={{width:9,height:9,borderRadius:'50%',background:f.color,flexShrink:0}}/>
                        <span style={{fontSize:14,fontWeight:600,color:C.tx,flex:1}}>{f.name}</span>
                        <span style={{fontSize:12,color:C.txM,background:C.bg,borderRadius:20,padding:'2px 8px'}}>{items.length}건</span>
                        <span onClick={e=>e.stopPropagation()} style={{flexShrink:0}}>
                          <Btn role="toolbar-secondary" ch="매물 담기" ic="ti-folder-plus" on={()=>openFolderAdd(f.id)}/>
                        </span>
                      </div>
                      {addOpen&&(
                        <div style={{padding:'12px 16px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`}} onClick={e=>e.stopPropagation()}>
                          <input className="inp" value={folderAddSearch} onChange={e=>setFolderAddSearch(e.target.value)} placeholder="도로명·지번·건물명 검색..." style={{height:34,fontSize:13,marginBottom:8}}/>
                          <FolderPropTable
                            pick
                            rows={folderAddCandidates}
                            emptyMsg="검색 결과 없음"
                            maxHeight={320}
                            wrapStyle={{background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,marginBottom:8}}
                            getPickState={p=>({inFolder:(propFolders[p.id]||[]).includes(f.id),sel:!!folderAddSel[p.id]})}
                            onRowClick={(p,ps)=>{if(!ps.inFolder) toggleFolderAddSel(p.id);}}
                            getRowOpacity={(p,ps)=>ps.inFolder?0.55:1}
                            onToggleFav={togglePropertyFav}
                            onAddrClick={openProperty}
                            renderTrailing={(p,ps)=>ps.inFolder?<span style={{fontSize:11,color:C.txM}}>담김</span>:null}
                          />
                          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                            <Btn role="toolbar-secondary" ch="취소" on={()=>{setFolderAddOpen(null);setFolderAddSearch('');setFolderAddSel({});}}/>
                            <Btn role="toolbar-primary" ch={addSelCount?`선택 ${addSelCount}건 담기`:'담기'} ic="ti-plus" on={()=>addSelectedToFolder(f.id)}/>
                          </div>
                        </div>
                      )}
                      {open&&(
                        <div style={{overflowX:'auto'}}>
                          {items.length>0?(
                            <FolderPropTable
                              rows={items}
                              onToggleFav={togglePropertyFav}
                              onAddrClick={openProperty}
                              renderTrailing={p=><Btn role="row-delete" ch="제거" on={()=>removePropFromFolder(p.id,f.id)}/>}
                            />
                          ):<div style={{padding:'16px',fontSize:13,color:C.txP,textAlign:'center'}}>담긴 매물이 없습니다</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {statusTab!=='FOLDER'&&(
        isMobile?(
          <PropertyCardList properties={visible} onOpen={openProperty} onToggleFav={togglePropertyFav} getSharedLabel={getSharedLabel} emptyMessage="조건에 맞는 매물이 없습니다"/>
        ):(
        <div style={{background:C.surf,borderRadius:10,overflowX:'auto',padding:`0 ${PROP_LIST_PAD_X}px`,boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
          <style dangerouslySetInnerHTML={{__html:`.prop-list-tbl{border-collapse:separate;border-spacing:0}.prop-list-tbl th,.prop-list-tbl td{padding:10px 8px!important;letter-spacing:-0.01em;vertical-align:middle}.prop-list-tbl thead th{color:${C.txM}!important}.prop-list-tbl .prop-col-price{padding:10px 6px!important;font-size:12px;text-align:right}.prop-list-tbl .prop-col-num{text-align:right;font-size:12px;white-space:nowrap}.prop-list-tbl tbody .prop-col-zone{text-align:center;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prop-list-tbl thead .prop-col-zone{text-align:center}${PROP_LIST_TBL_ADDR_CSS}${PROP_LIST_TBL_METRICS_CSS}${PROP_LIST_TBL_DATE_CSS}${PROP_LIST_TBL_CREATED_STICKY_CSS}${PROP_LIST_TBL_ACTION_CSS}`}}/>
          <table className="tbl prop-list-tbl" style={{tableLayout:'fixed',minWidth:PROP_LIST_MIN_W,width:'100%'}} onClick={()=>setOpenColFilter(null)}>
            <colgroup>
              <col style={{width:PROP_COL.check}}/>
              <col style={{width:PROP_COL.star}}/>
              <col style={{width:PROP_COL.status}}/>
              <col style={{width:PROP_COL.trade}}/>
              <col style={{width:PROP_COL.tag}}/>
              <col style={{width:propAddrColWidth}}/>
              <col style={{width:PROP_PRICE}}/>
              <col style={{width:PROP_COL.roi}}/>
              <col style={{width:PROP_COL.landArea}}/>
              <col style={{width:PROP_COL.floorArea}}/>
              <col style={{width:PROP_COL.zoning}}/>
              <col style={{width:PROP_COL.landPy}}/>
              <col style={{width:PROP_COL.lastCall}}/>
              <col style={{width:PROP_COL.created}}/>
              {PROP_LIST_SHOW_ROW_ACTIONS&&<col style={{width:PROP_COL.action}}/>}
            </colgroup>
            <thead>
              <tr>
                <th style={{width:32,textAlign:'center',cursor:'pointer'}} title={allSelected?'전체 선택 해제':'전체 선택'} onClick={(e)=>{e.stopPropagation();toggleSelectAll();}}>
                  <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${allSelected||someSelected?C.brand:C.bdrSt}`,background:allSelected?C.brand:someSelected?C.brandL:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
                    {allSelected&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    {!allSelected&&someSelected&&<span style={{width:8,height:2,background:C.brand,borderRadius:1,display:'block'}}/>}
                  </div>
                </th>
                <th style={{width:32}}>★</th>
                <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                  <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                    onClick={()=>setOpenColFilter(v=>v==='status'?null:'status')}>상태<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.status?1:.28}}>▼</span></span>
                  {openColFilter==='status'&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:120,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                      <div onClick={()=>{setColFilter(f=>({...f,status:''}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.status?C.brand:C.tx,fontWeight:!colFilter.status?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                      {[['NEW','신규'],['ACTIVE','진행중'],['HOLD','보류'],['COMPLETED','계약완료']].map(([k,v])=>(
                        <div key={k} onClick={()=>{setColFilter(f=>({...f,status:k}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.status===k?C.brand:C.tx,fontWeight:colFilter.status===k?600:400}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{v}</div>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                  <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                    onClick={()=>setOpenColFilter(v=>v==='trade'?null:'trade')}>거래방식<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.trade?1:.28}}>▼</span></span>
                  {openColFilter==='trade'&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:120,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                      <div onClick={()=>{setColFilter(f=>({...f,trade:''}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.trade?C.brand:C.tx,fontWeight:!colFilter.trade?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                      {Object.entries(TL).map(([k,v])=>(
                        <div key={k} onClick={()=>{setColFilter(f=>({...f,trade:k}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.trade===k?C.brand:C.tx,fontWeight:colFilter.trade===k?600:400}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{v}</div>
                      ))}
                    </div>
                  )}
                </th>
                <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                  <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                    onClick={()=>setOpenColFilter(v=>v==='tag'?null:'tag')}>종류<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.tag?1:.28}}>▼</span></span>
                  {openColFilter==='tag'&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:140,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                      <div onClick={()=>{setColFilter(f=>({...f,tag:''}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.tag?C.brand:C.tx,fontWeight:!colFilter.tag?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                      {[...new Set(P.map(p=>p.tag))].map(t=>(
                        <div key={t} onClick={()=>{setColFilter(f=>({...f,tag:t}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.tag===t?C.brand:C.tx,fontWeight:colFilter.tag===t?600:400}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{t}</div>
                      ))}
                    </div>
                  )}
                </th>
                <th className="prop-col-addr">주소 / 건물명</th>
                <th onClick={()=>toggleSort('price')} className="prop-col-price prop-col-metrics" style={{cursor:'pointer'}}>
                  가격 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='price'?1:.28}}>
                    {sortKey==='price'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('roi')}>
                  수익률 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='roi'?1:.28}}>
                    {sortKey==='roi'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('landArea')}>
                  대지면적 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='landArea'?1:.28}}>
                    {sortKey==='landArea'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('floorArea')}>
                  연면적 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='floorArea'?1:.28}}>
                    {sortKey==='floorArea'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-zone prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('zoning')}>
                  용도지역 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='zoning'?1:.28}}>
                    {sortKey==='zoning'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('landPy')}>
                  대지 평단가 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='landPy'?1:.28}}>
                    {sortKey==='landPy'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-date prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('lastCall')}>
                  최종통화일 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='lastCall'?1:.28}}>
                    {sortKey==='lastCall'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                <th className="prop-col-date prop-col-created prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('created')}>
                  등록일 <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey==='created'?1:.28}}>
                    {sortKey==='created'&&sortDir==='asc'?'▲':'▼'}
                  </span>
                </th>
                {PROP_LIST_SHOW_ROW_ACTIONS&&<th className="prop-col-action"/>}
              </tr>
            </thead>
            <tbody>
              {visible.map(p=>(
                <PropRow key={p.id} p={p} onOpenDetail={openProperty} onOpen={onOpen} onToggleFav={togglePropertyFav} checked={checked} toggleCheck={toggleCheck}
                  onDelete={handleDeleteProperty}
                  sharedLabel={getSharedLabel(p)}
                  canEditProperty={canEditProp(p)}/>
              ))}
            </tbody>
          </table>
        </div>
        ))}
        {checkedIds.length>0&&(
          <div style={{position:'sticky',bottom:0,marginTop:12,background:'#1A2332',borderRadius:10,padding:'10px 18px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 4px 16px rgba(0,0,0,.2)'}}>
            <span style={{fontSize:13,color:'#fff',fontWeight:500}}>{checkedIds.length}건 선택됨</span>
            <div style={{position:'relative'}}>
              <Btn role="toolbar-secondary" ch="상태 변경" on={()=>setStatusBulkOpen((v)=>!v)} sx={{background:'rgba(255,255,255,.1)',borderColor:'rgba(255,255,255,.2)',color:'#fff'}}/>
              {statusBulkOpen&&(
                <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,minWidth:160,boxShadow:'0 6px 20px rgba(0,0,0,.15)',overflow:'hidden'}}>
                  <div style={{padding:'8px 14px',fontSize:11,color:C.txM,borderBottom:`1px solid ${C.bdr}`}}>선택한 매물의 상태를 변경합니다</div>
                  {PROP_STATUS_BULK_OPTS.map((opt)=>(
                    <div key={opt.id} onClick={()=>applyBulkStatus(opt.id)}
                      style={{padding:'9px 14px',cursor:'pointer',fontSize:13,color:C.tx}}
                      onMouseEnter={(e)=>{ e.currentTarget.style.background=C.surf2; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.background='transparent'; }}>
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{position:'relative'}}>
              <Btn role="toolbar-primary" ch="폴더에 담기" ic="ti-folder-plus" on={()=>setBulkOpen(v=>!v)}/>
              {bulkOpen&&(
                <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,minWidth:180,boxShadow:'0 6px 20px rgba(0,0,0,.15)',overflow:'hidden'}}>
                  {folders.length===0&&<div style={{padding:'12px 14px',fontSize:12,color:C.txP}}>폴더 관리에서 먼저 폴더를 만들어주세요</div>}
                  {folders.map(f=>(
                    <div key={f.id} onClick={()=>{
                        setPropFolders(pf=>{
                          const next={...pf};
                          checkedIds.forEach(id=>{
                            const cur=next[id]||[];
                            if(!cur.includes(f.id)) next[id]=[...cur,f.id];
                          });
                          return next;
                        });
                        setBulkOpen(false);setChecked({});
                      }}
                      style={{padding:'9px 14px',cursor:'pointer',fontSize:13,color:C.tx,display:'flex',alignItems:'center',gap:8}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{width:9,height:9,borderRadius:'50%',background:f.color}}/>{f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Btn role="toolbar-secondary" ch="선택 해제" on={()=>setChecked({})} sx={{background:'rgba(255,255,255,.1)',borderColor:'rgba(255,255,255,.2)',color:'#fff'}}/>
          </div>
        )}
      </div>
    </div>
  );
};
const PropRow=({p,onOpenDetail,onOpen,onToggleFav,checked,toggleCheck,onDelete,sharedLabel,canEditProperty=true})=>(
  <tr onClick={()=>onOpenDetail(p)}>
    <td onClick={e=>{e.stopPropagation();toggleCheck(p.id);}} style={{textAlign:'center',cursor:'pointer'}}>
      <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${checked[p.id]?C.brand:C.bdrSt}`,background:checked[p.id]?C.brand:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
        {checked[p.id]&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
    </td>
    <td onClick={e=>e.stopPropagation()} style={{cursor:'default',textAlign:'center'}}>
      <span style={{fontSize:18,color:p.fav?'#F59E0B':C.txP,cursor:'pointer',lineHeight:1}}
        onClick={e=>onToggleFav(p,e)}>
        {p.fav?'★':'☆'}
      </span>
    </td>
    <td style={{whiteSpace:'nowrap'}}><StatusBdg s={p.status}/></td>
    <td style={{whiteSpace:'nowrap',overflow:'hidden'}}><span style={{fontSize:12,color:C.txM}}>{TL[p.trade]}</span></td>
    <td style={{whiteSpace:'nowrap'}}><Bdg label={p.tag} type="gray"/></td>
    <td className="prop-col-addr" style={{overflow:'hidden',verticalAlign:'middle'}}>
      <div className="cell-wrap" style={{fontWeight:500,fontSize:14}}>{propDisplayAddr(p)}</div>
      {sharedLabel&&<div style={{marginTop:4}}><span style={{display:'inline-flex',alignItems:'center',fontSize:11,fontWeight:600,color:'#185FA5',background:'#E6F1FB',borderRadius:4,padding:'2px 7px'}}>{sharedLabel}</span></div>}
      {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
    </td>
    <td className="prop-col-price prop-col-metrics" style={{fontWeight:600,color:C.info,fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={propPrice(p)}>{propPrice(p)}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:C.ok,fontWeight:500}}>{p.roi||'-'}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:p.land>0?C.tx:C.txP}}>{propLandPyungLabel(p)}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:p.floor>0?C.tx:C.txP}}>{propFloorPyungLabel(p)}</td>
    <PropZoningCell p={p} className="prop-col-zone prop-col-metrics"/>
    <td className="prop-col-num prop-col-metrics" style={{color:p.land>0&&p.price>0?C.tx:C.txP}}>{fmtLandPyUnit(p.price,p.land)}</td>
    <td className="prop-col-date prop-col-metrics" style={{color:p.lastCall!=='—'?C.txS:C.txP,fontSize:12,whiteSpace:'nowrap'}}>{p.lastCall}</td>
    <td className="prop-col-date prop-col-created prop-col-metrics" style={{color:C.txM,fontSize:12,whiteSpace:'nowrap'}}>{p.created}</td>
    {PROP_LIST_SHOW_ROW_ACTIONS&&(
      <td onClick={e=>e.stopPropagation()} className="prop-col-action">
        <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'nowrap',minWidth:120}}>
          <Btn role="row-edit" ch="수정" on={()=>onOpen('pe',p)} disabled={!canEditProperty} title={!canEditProperty?PERMISSION_DENIED_TOOLTIP:undefined}/>
          <Btn role="row-delete" ch="삭제" on={()=>onDelete&&onDelete(p)} disabled={!canEditProperty||!onDelete} title={!canEditProperty?PERMISSION_DENIED_TOOLTIP:undefined}/>
        </div>
      </td>
    )}
  </tr>
);

/* ═══ FOLDER MANAGE WIN (폴더 생성/매물 묶음 관리) ═══ */
const FolderManageWin=({folders,setFolders,propFolders,setPropFolders,onClose,onOpen})=>{
  const rawP=useProperties();
  const CALLS=useOwnerCallLogs();
  const propCallDateMap=useMemo(()=>buildPropCallDateMap(CALLS),[CALLS]);
  const P=useMemo(()=>rawP.map(p=>({...p,lastCall:fmtCallDate(propCallDatesOf(propCallDateMap,p.id).last)})),[rawP,propCallDateMap]);
  const [newName,setNewName]=useState('');
  const [newColor,setNewColor]=useState(FOLDER_COLORS[0]);
  const [activeFolder,setActiveFolder]=useState(null);
  const [editName,setEditName]=useState('');
  const [editColor,setEditColor]=useState(FOLDER_COLORS[0]);
  const [search,setSearch]=useState('');
  const togglePropertyFav=useCallback(async(p,e)=>{
    e?.stopPropagation?.();
    await setPropertyFav(p.id,!p.fav);
  },[]);

  useEffect(()=>{
    if(!activeFolder){setEditName('');return;}
    const f=folders.find(x=>x.id===activeFolder);
    if(f){setEditName(f.name);setEditColor(f.color);}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택 폴더 변경 시에만 폼 동기화
  },[activeFolder]);

  const countOf=(fid)=>Object.values(propFolders).filter(arr=>arr.includes(fid)).length;

  const renameFolder=()=>{
    if(!activeFolder||!editName.trim()) return;
    const name=editName.trim();
    setFolders(fs=>fs.map(f=>f.id===activeFolder?{...f,name,color:editColor}:f));
    setEditName(name);
  };
  const setFolderColor=(color)=>{
    setEditColor(color);
    if(!activeFolder) return;
    setFolders(fs=>fs.map(f=>f.id===activeFolder?{...f,color}:f));
  };

  const createFolder=()=>{
    if(!newName.trim()) return;
    const id=Date.now();
    setFolders(f=>[...f,{id,name:newName.trim(),color:newColor}]);
    setNewName('');
    setActiveFolder(id);
  };
  const deleteFolder=(fid)=>{
    setFolders(f=>f.filter(x=>x.id!==fid));
    setPropFolders(pf=>{
      const next={...pf};
      Object.keys(next).forEach(pid=>{next[pid]=next[pid].filter(x=>x!==fid);});
      return next;
    });
    if(activeFolder===fid) setActiveFolder(null);
  };
  const togglePropInFolder=(pid,fid)=>{
    setPropFolders(pf=>{
      const cur=pf[pid]||[];
      const next=cur.includes(fid)?cur.filter(x=>x!==fid):[...cur,fid];
      return {...pf,[pid]:next};
    });
  };

  const folderProps=activeFolder?P.filter(p=>(propFolders[p.id]||[]).includes(activeFolder)):[];
  const allFiltered=useMemo(()=>[...P.filter(p=>!search||propMatchesSearch(p,search))]
    .sort((a,b)=>(b.fav?1:0)-(a.fav?1:0)),[P,search]);

  return(
    <Win title="폴더 관리" ic="ti-folder" onClose={onClose} w={920}
      ch={<>
        <div style={{flex:1,minHeight:0,display:'flex',overflow:'hidden',padding:'20px 24px',gap:16}}>
          {/* 좌측: 폴더 목록 + 새 폴더 생성 */}
          <div style={{width:280,flexShrink:0,display:'flex',flexDirection:'column',background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            <SecLabel ch="새 폴더 만들기"/>
            <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.bdr}`}}>
              <div style={{display:'flex',gap:6,marginBottom:10}}>
                <input className="inp" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="폴더 이름" style={{height:34,fontSize:13,flex:1}}
                  onKeyDown={e=>e.key==='Enter'&&createFolder()}/>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                {FOLDER_COLORS.map(c=>(
                  <div key={c} onClick={()=>setNewColor(c)} style={{width:18,height:18,borderRadius:'50%',background:c,cursor:'pointer',border:newColor===c?'2px solid #1A2332':'2px solid transparent',boxShadow:newColor===c?'0 0 0 1.5px #fff inset':'none'}}/>
                ))}
                <Btn role="toolbar-primary" ch="추가" ic="ti-plus" sx={{marginLeft:'auto'}} on={createFolder}/>
              </div>
            </div>
            <SecLabel ch="폴더 목록" badge={folders.length>0?`${folders.length}`:null}/>
            <div style={{flex:1,overflowY:'auto'}}>
              {folders.length===0&&(
                <div style={{padding:'32px 16px',textAlign:'center',fontSize:13,color:C.txP,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:26,height:26,flexShrink:0,color:C.txP}} aria-hidden><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></span>
                  아직 만든 폴더가 없습니다<br/>위에서 새 폴더를 만들어보세요
                </div>
              )}
              {folders.map(f=>(
                <div key={f.id} onClick={()=>setActiveFolder(f.id)}
                  style={{padding:'11px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,background:activeFolder===f.id?C.surf2:'transparent',borderLeft:activeFolder===f.id?`3px solid ${f.color}`:'3px solid transparent',borderBottom:`1px solid ${C.bdr}`}}
                  onMouseEnter={e=>{if(activeFolder!==f.id)e.currentTarget.style.background=C.surf2;}}
                  onMouseLeave={e=>{if(activeFolder!==f.id)e.currentTarget.style.background='transparent';}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:f.color,flexShrink:0}}/>
                  <span style={{fontSize:13,color:C.tx,fontWeight:activeFolder===f.id?600:400,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                  <span style={{fontSize:12,color:C.txM,background:C.surf2,borderRadius:20,padding:'1px 7px'}}>{countOf(f.id)}</span>
                  <span onClick={e=>{e.stopPropagation();deleteFolder(f.id);}} style={{color:C.txP,fontSize:14,padding:'0 2px',cursor:'pointer',lineHeight:1}}
                    onMouseEnter={e=>e.currentTarget.style.color=C.err} onMouseLeave={e=>e.currentTarget.style.color=C.txP}>✕</span>
                </div>
              ))}
            </div>
          </div>
          {/* 우측: 선택한 폴더에 매물 담기 */}
          <div style={{flex:1,display:'flex',flexDirection:'column',background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            {!activeFolder?(
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:C.txM,fontSize:13,gap:8}}>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,flexShrink:0,color:C.txP}} aria-hidden><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
                왼쪽에서 폴더를 선택하거나 새로 만들어주세요
              </div>
            ):(
              <>
                <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.bdr}`,background:C.surf2}}>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>폴더 이름</div>
                  <input className="inp" value={editName} onChange={e=>setEditName(e.target.value)}
                    onBlur={renameFolder}
                    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();renameFolder();}}}
                    placeholder="폴더 이름" style={{height:34,fontSize:13,marginBottom:10}}/>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    {FOLDER_COLORS.map(c=>(
                      <div key={c} onClick={()=>setFolderColor(c)} title="폴더 색상"
                        style={{width:18,height:18,borderRadius:'50%',background:c,cursor:'pointer',border:editColor===c?'2px solid #1A2332':'2px solid transparent',boxShadow:editColor===c?'0 0 0 1.5px #fff inset':'none'}}/>
                    ))}
                  </div>
                </div>
                <SecLabel ch={`${folders.find(f=>f.id===activeFolder)?.name||''} · 매물 담기`} badge={`${folderProps.length}건`}/>
                <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.bdr}`}}>
                  <input className="inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="도로명·지번·건물명 검색 후 체크..." style={{height:34,fontSize:13}}/>
                </div>
                <div style={{flex:1,overflow:'auto',padding:'0'}}>
                  <FolderPropTable
                    pick
                    rows={allFiltered}
                    emptyMsg="검색 결과 없음"
                    getPickState={p=>({inFolder:(propFolders[p.id]||[]).includes(activeFolder),sel:false})}
                    onRowClick={p=>togglePropInFolder(p.id,activeFolder)}
                    onToggleFav={togglePropertyFav}
                    onAddrClick={prop=>onOpen&&onOpen('pd',prop)}
                    renderTrailing={(p,ps)=>ps.inFolder?<span style={{fontSize:11,color:C.brand,fontWeight:600}}>담김</span>:null}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        <ActionBar saveLabel="완료" onSave={onClose}/>
      </>}/>
  );
};

/* ═══ PROPERTY REGISTER ═══ */
const PropPriceSection=({trade,setTrade,priceForm,setPriceForm,idPrefix='',mainType,subType})=>{
  const set=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:e.target.value}));
  const setNum=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:fmtInputNum(e.target.value)}));
  const setDecNum=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:fmtInputNum(e.target.value,{decimal:true})}));
  const chk=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:e.target.checked}));
  const L=({children,req})=>(<div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>{children}{req&&<span style={{color:C.brand}}> *</span>}</div>);
  const negId=`${idPrefix}neg`;
  const numVal=(k)=>fmtInputNum(priceForm[k]??'');
  const decVal=(k)=>fmtInputNum(priceForm[k]??'',{decimal:true});
  const showInvest=showsSaleInvestmentFields(trade, subType);
  const showPremium=showsPremiumField(trade, subType);
  const showUnit=showsRentalUnitFields(trade);

  return(
    <>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {['SALE','JEONSE','MONTHLY','SHORT_TERM','PRESALE'].map(t=>(
          <div key={t} onClick={()=>setTrade(t)} style={{padding:'6px 16px',borderRadius:20,border:'1.5px solid',borderColor:trade===t?C.brand:C.bdr,background:trade===t?C.brandL:'transparent',color:trade===t?C.brand:C.txS,fontSize:13,cursor:'pointer',fontWeight:trade===t?600:400,transition:'all .1s'}}>
            {TL[t]}
          </div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {(trade==='SALE'||trade==='PRESALE')&&<>
          <div><L req>매매가 (만)</L><input className="inp" inputMode="numeric" value={numVal('price')} onChange={setNum('price')} placeholder="예: 4,300,000"/></div>
          <div><L>융자금 (만)</L><input className="inp" inputMode="numeric" value={numVal('loan')} onChange={setNum('loan')} placeholder="0"/></div>
          {showInvest&&<>
            <div><L>관리비 (만)</L><input className="inp" inputMode="numeric" value={numVal('maintenance')} onChange={setNum('maintenance')} placeholder="0"/></div>
            <div style={{gridColumn:'1 / -1',fontSize:12,color:C.txP,lineHeight:1.5}}>
              보증금·월임대료·임차계약만료일·수익률은 임대차관리에서 입력합니다.
            </div>
          </>}
          {showPremium&&<div><L>권리금 (만)<span style={{fontSize:12,color:C.txP,marginLeft:4}}>상가</span></L><input className="inp" inputMode="numeric" value={numVal('premium')} onChange={setNum('premium')} placeholder="0"/></div>}
          <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:22}}><input type="checkbox" id={negId} checked={priceForm.priceNegotiable} onChange={chk('priceNegotiable')} style={{width:16,height:16,accentColor:C.brand}}/><label htmlFor={negId} style={{fontSize:13,color:C.txS,cursor:'pointer'}}>가격 협의 가능</label></div>
        </>}
        {trade==='JEONSE'&&<>
          <div><L req>전세보증금 (만)</L><input className="inp" inputMode="numeric" value={numVal('jDep')} onChange={setNum('jDep')} placeholder="예: 35,000"/></div>
          <div><L>전세계약만료일</L><input type="date" className="inp" value={priceForm.jLeaseEnd} onChange={set('jLeaseEnd')}/></div>
        </>}
        {trade==='MONTHLY'&&<>
          <div><L req>보증금 (만)</L><input className="inp" inputMode="numeric" value={numVal('mDep')} onChange={setNum('mDep')} placeholder="예: 5000"/></div>
          <div><L req>월세 (만)</L><input className="inp" inputMode="numeric" value={numVal('mRent')} onChange={setNum('mRent')} placeholder="예: 350"/></div>
          <div><L>관리비 (만)</L><input className="inp" inputMode="numeric" value={numVal('maintenance')} onChange={setNum('maintenance')} placeholder="0"/></div>
          <div><L>관리비 포함 내역</L><input className="inp" value={priceForm.maintenanceDetail} onChange={set('maintenanceDetail')} placeholder="예: 전기·수도·가스"/></div>
        </>}
        {trade==='SHORT_TERM'&&<>
          <div><L req>보증금 (만)</L><input className="inp" inputMode="numeric" value={numVal('mDep')} onChange={setNum('mDep')} placeholder="예: 1000"/></div>
          <div><L req>단기임대료 (만)</L><input className="inp" inputMode="numeric" value={numVal('mRent')} onChange={setNum('mRent')} placeholder="예: 150"/></div>
          <div><L req>단기임대기간</L><input className="inp" value={priceForm.shortTermPeriod} onChange={set('shortTermPeriod')} placeholder="예: 6개월, 12개월"/></div>
          <div><L>관리비 (만)</L><input className="inp" inputMode="numeric" value={numVal('maintenance')} onChange={setNum('maintenance')} placeholder="0"/></div>
        </>}
        {showUnit&&<>
          <div><L>해당 층</L><input className="inp" value={priceForm.unitFloor} onChange={set('unitFloor')} placeholder="예: 3F, B1, 2~3층"/></div>
          <div><L>전용면적 (㎡)</L><input className="inp" inputMode="decimal" value={decVal('exclusiveArea')} onChange={setDecNum('exclusiveArea')} placeholder="예: 84.5"/></div>
          <div><L>계약면적 (㎡)</L><input className="inp" inputMode="decimal" value={decVal('contractArea')} onChange={setDecNum('contractArea')} placeholder="예: 110.2"/></div>
          <div><L>권리금 (만)</L><input className="inp" inputMode="numeric" value={numVal('premium')} onChange={setNum('premium')} placeholder="0"/></div>
        </>}
        {(trade==='JEONSE'||trade==='MONTHLY'||trade==='SHORT_TERM')&&(
          <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:22}}>
            <input type="checkbox" id={`${negId}${trade}`} checked={priceForm.priceNegotiable} onChange={chk('priceNegotiable')} style={{width:16,height:16,accentColor:C.brand}}/>
            <label htmlFor={`${negId}${trade}`} style={{fontSize:13,color:C.txS,cursor:'pointer'}}>가격 협의 가능</label>
          </div>
        )}
      </div>
    </>
  );
};

const PropLandFields=({landForm,setLandForm,readOnlyStyle})=>{
  const set=(k)=>(e)=>{
    if(k==='officialPriceM2'){
      const raw=e.target.value.replace(/\D/g,'');
      setLandForm((f)=>({...f,officialPriceM2:raw===''?'':fmtNum(raw)}));
      return;
    }
    setLandForm((f)=>({...f,[k]:e.target.value}));
  };
  return(
    <>
      {[['토지면적 (㎡)','landAreaM2'],['용도지역','landUseZone'],['지목','landCategory'],['개별공시지가 (원/㎡)','officialPriceM2'],['기준년도','officialPriceYear']].map(([l,k])=>(
        <div key={k}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>{l}</div>
          <input className="inp" value={landForm[k]??''} onChange={set(k)} inputMode={k==='officialPriceM2'?'numeric':undefined} style={readOnlyStyle}/></div>
      ))}
    </>
  );
};

const BUILDING_COMMA_KEYS = new Set(['grossFloorAreaM2', 'vlRatEstmTotAreaM2', 'archAreaM2', 'bcRat', 'vlRat']);

const PropBuildingFields=({buildingForm,setBuildingForm,readOnlyStyle})=>{
  const set=(k)=>(e)=>setBuildingForm((f)=>({...f,[k]:e.target.value}));
  const setNum=(k)=>(e)=>setBuildingForm((f)=>({...f,[k]:fmtInputNum(e.target.value,{decimal:true})}));
  const displayVal=(k)=>BUILDING_COMMA_KEYS.has(k)?fmtInputNum(buildingForm[k]??'',{decimal:true}):(buildingForm[k]??'');
  return(
    <>
      {[['연면적 (㎡)','grossFloorAreaM2'],['용적률산정연면적 (㎡)','vlRatEstmTotAreaM2'],['건축면적 (㎡)','archAreaM2'],['건폐율 (%)','bcRat'],['용적률 (%)','vlRat'],['지상층수','grndFlrCnt'],['지하층수','ugrndFlrCnt'],['주차대수','parkingCnt'],['승강기 대수','elevatorCnt'],['주구조','strctCdNm'],['주용도','mainPurpsCdNm'],['사용승인일','useAprDay']].map(([l,k])=>(
        <div key={k}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>{l}</div>
          <input className="inp" type={k==='useAprDay'?'date':'text'} inputMode={BUILDING_COMMA_KEYS.has(k)?'decimal':undefined} value={displayVal(k)} onChange={BUILDING_COMMA_KEYS.has(k)?setNum(k):set(k)} style={readOnlyStyle}/></div>
      ))}
    </>
  );
};

const PropRegister=({onNav})=>{
  const { accountDefaults, user }=useAuth();
  const userId=user?.id??null;
  const registerDraft=useMemo(()=>hydratePropertyRegisterDraft(loadPropertyRegisterDraft(userId)),[userId]);
  const [draftReady,setDraftReady]=useState(()=>!registerDraft);
  const draftRestoredRef=useRef(false);
  const [trade,setTrade]=useState(()=>registerDraft?.trade??'SALE');
  const [mainType,setMainType]=useState(()=>registerDraft?.mainType??'COMMERCIAL');
  const [subType,setSubType]=useState(()=>registerDraft?.subType??'WHOLE_BUILDING');
  const [status,setStatus]=useState(()=>registerDraft?.status??'NEW');
  const [pub,setPub]=useState(()=>registerDraft?.pub??'true');
  const [photoSlots,setPhotoSlots]=useState(()=>registerDraft?.photoSlots??[null,null,null]);
  const [priceForm,setPriceForm]=useState(()=>registerDraft?.priceForm??emptyPriceForm());
  const [roadSearch,setRoadSearch]=useState(()=>registerDraft?.roadSearch??'');
  const [addressModalOpen,setAddressModalOpen]=useState(false);
  const [detailForm,setDetailForm]=useState(()=>registerDraft?.detailForm??{
    title:'', agentName:'', agentTel:'', promo:'', memo:'', discoUrl:'',
  });
  useEffect(()=>{
    setDetailForm(f=>({
      ...f,
      agentName:f.agentName||accountDefaults.displayName,
      agentTel:f.agentTel||accountDefaults.phone,
    }));
  },[accountDefaults.displayName,accountDefaults.phone]);
  const {
    lookup, addressKeys, locationForm, setLocationForm,
    landForm, setLandForm, buildingForm, setBuildingForm,
    handleAddressFetchSuccess, refetchPublicData, isLoading,
    restoreAddressLookupDraft,
  }=usePropertyAddressLookup({ mode:'register' });

  useEffect(()=>{
    if(draftRestoredRef.current||!registerDraft) return;
    draftRestoredRef.current=true;
    restoreAddressLookupDraft(registerDraft);
    setDraftReady(true);
  },[registerDraft,restoreAddressLookupDraft]);

  useEffect(()=>{
    if(!draftReady) return;
    const timer=window.setTimeout(()=>{
      savePropertyRegisterDraft({
        trade, mainType, subType, status, pub,
        priceForm, roadSearch, detailForm, photoSlots,
        locationForm, landForm, buildingForm, addressKeys,
        lookup: {
          status: lookup.status,
          error: lookup.error,
          warnings: lookup.warnings,
          fetchedAt: lookup.fetchedAt,
          mode: lookup.mode,
        },
      }, userId);
    },400);
    return ()=>window.clearTimeout(timer);
  },[
    draftReady, userId,
    trade, mainType, subType, status, pub,
    priceForm, roadSearch, detailForm, photoSlots,
    locationForm, landForm, buildingForm, addressKeys, lookup,
  ]);
  const subOpts=PROP_SUB[mainType]||{};

  const onAddressSearch=()=>setAddressModalOpen(true);

  const onAddressSelected=async (addr)=>{
    setRoadSearch(addr.jibunAddr||addr.roadAddr||'');
    await handleAddressFetchSuccess(addr);
  };

  const apiBadge=lookup.status==='loading'?'조회중…'
    :lookup.status==='success'?'API완료'
    :lookup.status==='error'?'API오류'
    :lookup.status==='address_confirmed'?'코드대기':'API';

  const handleSave=async()=>{
    const addressFields=buildPropertyAddressFields(locationForm, roadSearch);
    const mapCoordFields=await resolveMapCoordFieldsForSave(null, {
      ...addressFields,
      bldg: detailForm.title || '',
    });
    await addProperty({
      main:mainType, sub:subType, status, pub:pub==='true', trade, fav:false, favAt:null,
      ...addressFields,
      ...mapCoordFields,
      bldg:detailForm.title||'',
      ownerTel:normalizePhone(locationForm.ownerTel)||'',
      roadInfo:locationForm.roadInfo||'',
      promo:detailForm.promo||'',
      memo:detailForm.memo||'',
      discoUrl:normalizeDiscoUrl(detailForm.discoUrl)||'',
      agentName:detailForm.agentName||'',
      agentTel:normalizePhone(detailForm.agentTel)||'',
      photos:photoSlotsToSave(photoSlots),
      tag:PROP_SUB[mainType]?.[subType]||'',
      lastCall:'—', created:formatCreatedDate(), deletedAt:null,
      ...buildPriceFields(trade, priceForm),
      ...landToPropertyFields(landForm),
      ...buildingToPropertyFields(buildingForm),
    });
    clearPropertyRegisterDraft();
    showNotification('저장하였습니다.','success');
    onNav('properties');
  };

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      <AddressSearchModal
        open={addressModalOpen}
        onClose={()=>setAddressModalOpen(false)}
        onSelect={onAddressSelected}
        initialKeyword={roadSearch}
      />
      <PH title="매물 등록" sub="필드에 * 표시는 필수 입력항목입니다"
        acts={<Btn role="page-secondary" ch="일괄 등록" ic="ti-upload" on={()=>onNav&&onNav('registerBulk')}/>}
      />
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'20px 28px 0'}}>
        <div style={{display:'flex',flexDirection:'column',gap:0,background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)',marginBottom:20}}>
          {/* 매물종류·상태 */}
          <SecLabel ch="매물종류 · 상태"/>
          <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,borderBottom:`1px solid ${C.bdr}`}}>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매물 대분류 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={mainType} onChange={e=>{setMainType(e.target.value);setSubType(Object.keys(PROP_SUB[e.target.value]||{})[0]||'');}}>
                {Object.entries(PROP_MAIN).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매물 소분류 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={subType} onChange={e=>setSubType(e.target.value)}>
                {Object.entries(subOpts).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>진행 상태 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={status} onChange={e=>setStatus(e.target.value)}><option value="NEW">신규</option><option value="ACTIVE">진행중</option><option value="HOLD">보류</option><option value="COMPLETED">계약완료</option></select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>공개 여부 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={pub} onChange={e=>setPub(e.target.value)}><option value="true">공개</option><option value="false">비공개</option></select>
            </div>
          </div>
          {/* 소재지 — addressKeys: sigunguCd·bjdongCd·bun·ji (공공데이터 키) */}
          <SecLabel ch="소재지" badge={apiBadge}/>
          <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.bdr}`,display:'flex',flexDirection:'column',gap:14}}>
            {lookup.error&&<div style={{fontSize:12,color:C.err,padding:'8px 12px',background:C.errBg,borderRadius:7}}>{lookup.error}</div>}
            {lookup.warnings?.length>0&&lookup.status!=='idle'&&(
              <div style={{fontSize:12,color:C.warn,padding:'8px 12px',background:C.warnBg,borderRadius:7}}>
                {lookup.warnings.join(' · ')}
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <input className="inp" value={roadSearch} onChange={e=>setRoadSearch(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') onAddressSearch(); }}
                placeholder="주소 검색 — 도로명·지번·건물명 (예: 상계동 737, 동일로215길 48)" style={{flex:1}} disabled={isLoading}/>
              <Btn role="page-primary" ch={isLoading?'조회중…':'주소 검색'} ic="ti-search" on={onAddressSearch}/>
              <Btn role="page-secondary" ch="재조회" ic="ti-refresh" on={refetchPublicData}/>
            </div>
            {addressKeys.pnu&&(
              <div style={{fontSize:11,color:C.txP,fontFamily:'monospace',letterSpacing:'.04em'}}>
                PNU {addressKeys.pnu} · 시군구 {addressKeys.sigunguCd} · 법정동 {addressKeys.bjdongCd} · 본번 {addressKeys.bun} · 부번 {addressKeys.ji}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>지번주소</div>
                <input className="inp" value={locationForm.jibunAddr} readOnly style={{background:C.surf2}}/></div>
              <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>도로명주소</div>
                <input className="inp" value={locationForm.roadAddr} readOnly style={{background:C.surf2}}/></div>
              <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>소유주 연락처</div>
                <PhoneInput value={locationForm.ownerTel} onChange={e=>setLocationForm(f=>({...f,ownerTel:e.target.value}))} placeholder="010-0000-0000"/></div>
              <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>도로상황</div>
                <input className="inp" value={locationForm.roadInfo} onChange={e=>setLocationForm(f=>({...f,roadInfo:e.target.value}))} placeholder="예: 8m × 4m"/></div>
            </div>
          </div>
          {/* 거래방식·가격 */}
          <SecLabel ch="거래방식 · 가격"/>
          <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.bdr}`}}>
            <PropPriceSection trade={trade} setTrade={setTrade} priceForm={priceForm} setPriceForm={setPriceForm} idPrefix="reg_" mainType={mainType} subType={subType}/>
          </div>
          {/* 토지정보 — landForm: 토지대장·이용계획 API 매핑 */}
          <SecLabel ch="토지정보" badge={apiBadge}/>
          <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,borderBottom:`1px solid ${C.bdr}`}}>
            <PropLandFields landForm={landForm} setLandForm={setLandForm} readOnlyStyle={lookup.status==='success'?{background:C.surf2}:undefined}/>
          </div>
          {/* 건물정보 — buildingForm: 건축물대장 API 매핑 */}
          <SecLabel ch="건물정보" badge={apiBadge}/>
          <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,borderBottom:`1px solid ${C.bdr}`}}>
            <PropBuildingFields buildingForm={buildingForm} setBuildingForm={setBuildingForm} readOnlyStyle={lookup.status==='success'?{background:C.surf2}:undefined}/>
          </div>
          {/* 사진 */}
          <SecLabel ch="사진 (선택, 최대 3장)"/>
          <PropertyPhotoPicker slots={photoSlots} onChange={setPhotoSlots}/>
          {/* 게시·담당자 */}
          <SecLabel ch="세부내용"/>
          <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>게시글 제목 <span style={{color:C.brand}}>*</span></div>
              <input className="inp" value={detailForm.title} onChange={e=>setDetailForm(f=>({...f,title:e.target.value}))} placeholder="예: 영등포 핵심 상권 상가건물 매매"/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>담당자 이름</div>
              <input className="inp" value={detailForm.agentName} onChange={e=>setDetailForm(f=>({...f,agentName:e.target.value}))} placeholder="담당자 이름"/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>담당자 연락처</div>
              <PhoneInput value={detailForm.agentTel} onChange={e=>setDetailForm(f=>({...f,agentTel:e.target.value}))} placeholder="010-0000-0000"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>홍보문구 (공개)</div>
              <textarea className="ta" rows={6} value={detailForm.promo} onChange={e=>setDetailForm(f=>({...f,promo:e.target.value}))} placeholder="외부에 공개되는 홍보문구"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>내부 메모 (비공개)</div>
              <textarea className="ta" rows={2} value={detailForm.memo} onChange={e=>setDetailForm(f=>({...f,memo:e.target.value}))} placeholder="내부 참고 사항"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>디스코 상세 링크 <span style={{fontWeight:400,color:C.txP}}>(선택)</span></div>
              <input className="inp" value={detailForm.discoUrl||''} onChange={e=>setDetailForm(f=>({...f,discoUrl:e.target.value}))} placeholder="디스코에서 복사한 주소 링크가 있다면 입력해주세요 (선택)"/></div>
          </div>
        </div>
      </div>
      <ActionBar saveLabel="저장하기" onSave={handleSave} onCancel={()=>onNav('properties')}/>
    </div>
  );
};

/* ═══ CUSTOMER LIST ═══ */
const CustList=({onOpen,onNav,onDeleteCustomer,onCustomersDeleted})=>{
  const CU=useOwnerCustomers();
  const { user, companyRole, memberPermissions }=useAuth();
  const canEditCust=(c)=>canWriteRecord(c,user?.id,companyRole,memberPermissions,'customers');
  const CALLS=useOwnerCallLogs();
  const callDateMap=useMemo(()=>buildCustCallDateMap(CALLS),[CALLS]);
  const toggleCustomerFav=useCallback(async(c,e)=>{
    e?.stopPropagation?.();
    await setCustomerFav(c.id,!c.fav);
  },[]);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState(false);
  const [filterResetKey,setFilterResetKey]=useState(0);
  const [advTag,setAdvTag]=useState('');
  const [advTrade,setAdvTrade]=useState('');
  const [advStatus,setAdvStatus]=useState('');
  const [advBuyMin,setAdvBuyMin]=useState('');
  const [advBuyMax,setAdvBuyMax]=useState('');
  const [appliedAdv,setAppliedAdv]=useState(null);
  const applyAdvSearch=()=>setAppliedAdv({
    tag:advTag,trade:advTrade,status:advStatus,
    buyMin:advBuyMin,buyMax:advBuyMax,
  });
  const resetAdvSearch=()=>{
    setAdvTag('');setAdvTrade('');setAdvStatus('');
    setAdvBuyMin('');setAdvBuyMax('');
    setAppliedAdv(null);
    setFilterResetKey((k)=>k+1);
  };
  const [typeTab,setTypeTab]=useState('ALL');
  const [sortKey,setSortKey]=useState(null);
  const [sortDir,setSortDir]=useState('asc');
  const [colFilter,setColFilter]=useState({status:'',type:''});
  const [openColFilter,setOpenColFilter]=useState(null);
  const [visibleCount,setVisibleCount]=useState(20);
  const [checked,setChecked]=useState({});
  const [statusBulkOpen,setStatusBulkOpen]=useState(false);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const toggleCheck=(id)=>setChecked((c)=>({...c,[id]:!c[id]}));
  const checkedIds=Object.keys(checked).filter((id)=>checked[id]).map(Number);
  const handleScroll=(e)=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<80)setVisibleCount(v=>v+20);};
  const typeTabList=[{id:'ALL',label:'전체'},{id:'BUYER',label:'매수인'},{id:'SELLER',label:'매도인'},{id:'TENANT',label:'임차인'},{id:'LANDLORD',label:'임대인'},{id:'OTHER',label:'기타'}];
  const toggleSort=(key)=>{
    if(sortKey!==key){setSortKey(key);setSortDir('asc');}
    else if(sortDir==='asc'){setSortDir('desc');}
    else{setSortKey(null);setSortDir('asc');}
  };
  const getSortVal=(c,key)=>{
    const cd=custCallDatesOf(callDateMap,c.id);
    if(key==='name') return c.name||'';
    if(key==='co') return c.co||'';
    if(key==='region') return c.region||'';
    if(key==='preferredTrades') return customerTradeLabelOf(c);
    if(key==='lastCall') return cd.last||'';
    if(key==='created') return c.created||'';
    return '';
  };
  const custSortMark=(key)=>(
    <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey===key?1:.28}}>
      {sortKey===key&&sortDir==='asc'?'▲':'▼'}
    </span>
  );
  const base=CU.filter(c=>{
    if(!customerMatchesTypeTab(c,typeTab)) return false;
    if(colFilter.status&&custStatusOf(c)!==colFilter.status) return false;
    if(colFilter.type&&!customerMatchesTypeTab(c,colFilter.type)) return false;
    if(appliedAdv&&!customerMatchesAdvSearch(c,appliedAdv)) return false;
    if(!customerMatchesBasicSearch(c,search)) return false;
    return true;
  });
  const sorted=[...base].sort((a,b)=>{
    if(sortKey){
      const av=getSortVal(a,sortKey), bv=getSortVal(b,sortKey);
      if(av<bv) return sortDir==='asc'?-1:1;
      if(av>bv) return sortDir==='asc'?1:-1;
      return 0;
    }
    return (b.fav?1:0)-(a.fav?1:0)||b.id-a.id;
  });
  const visible=sorted.slice(0,visibleCount);
  const selectableIds=useMemo(()=>sorted.map((c)=>c.id),[sorted]);
  const allSelected=selectableIds.length>0&&selectableIds.every((id)=>checked[id]);
  const someSelected=selectableIds.some((id)=>checked[id]);
  const toggleSelectAll=()=>{
    if(allSelected){
      setChecked((c)=>{
        const next={...c};
        selectableIds.forEach((id)=>{ delete next[id]; });
        return next;
      });
    }else{
      setChecked((c)=>{
        const next={...c};
        selectableIds.forEach((id)=>{ next[id]=true; });
        return next;
      });
    }
  };
  const applyBulkStatus=async(newStatus)=>{
    const targets=sorted.filter((c)=>checked[c.id]&&canEditCust(c));
    if(!targets.length){
      window.alert('선택한 고객 중 수정 가능한 항목이 없습니다.');
      return;
    }
    await Promise.all(targets.map((c)=>updateCustomer(c.id,{status:newStatus})));
    showNotification('수정되었습니다.','info');
    setStatusBulkOpen(false);
    setChecked({});
  };
  const requestBulkDelete=()=>{
    const targets=sorted.filter((c)=>checked[c.id]&&canEditCust(c));
    if(!targets.length){
      window.alert('선택한 고객 중 삭제 가능한 항목이 없습니다.');
      return;
    }
    const skipped=checkedIds.length-targets.length;
    setDeleteConfirm({
      count:targets.length,
      skipped,
      onConfirm:async()=>{
        await Promise.all(targets.map((c)=>softDeleteCustomer(c.id)));
        showNotification('삭제한 항목은 휴지통으로 이동되었습니다.','warning');
        if(onCustomersDeleted) onCustomersDeleted(targets.map((c)=>c.id));
        setDeleteConfirm(null);
        setStatusBulkOpen(false);
        setChecked({});
      },
    });
  };
  const handleDeleteCustomer=(c)=>{
    if(!onDeleteCustomer) return;
    onDeleteCustomer(c,()=>setChecked((chk)=>{const next={...chk};delete next[c.id];return next;}));
  };
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      {deleteConfirm&&(
        <ConfirmDialog
          msg={`${deleteConfirm.count}명을 휴지통으로 이동하시겠습니까?`}
          subMsg={deleteConfirm.skipped>0
            ? `삭제 권한이 없는 ${deleteConfirm.skipped}명은 제외됩니다. 휴지통에서 복구할 수 있습니다.`
            : '선택한 고객이 휴지통으로 이동됩니다. 언제든지 복구할 수 있습니다.'}
          confirmLabel="이동"
          danger={false}
          onConfirm={deleteConfirm.onConfirm}
          onCancel={()=>setDeleteConfirm(null)}
        />
      )}
      <PH title="고객 관리" sub={`전체 ${sorted.length}명`}
        acts={<>
          <Btn role="page-secondary" ch="일괄 등록" ic="ti-upload" on={()=>onNav&&onNav('customersBulk')}/>
          <Btn role="page-primary" ch="고객 등록" on={()=>onOpen('cf',null)}/>
        </>}
        ch={
          <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:20,flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,height:36,background:'#fff',border:`1.5px solid ${C.bdr}`,borderRadius:7,padding:'0 12px',width:280}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,flexShrink:0,color:C.txP}} aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름·연락처·회사·선호지역 검색" style={{border:'none',background:'transparent',fontSize:13,color:C.tx,flex:1,height:'100%'}}/>
            </div>
            <Btn role="filter" ch={filter?'필터 닫기':'상세검색'} ic={filter?'ti-x':'ti-adjustments-horizontal'} sx={{gap:6}}
              on={()=>setFilter((v)=>!v)}/>
          </div>
        }/>
      {filter&&(
        <div key={filterResetKey} style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'16px 28px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:14}}>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매물 종류</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advTag} onChange={e=>setAdvTag(e.target.value)}>
                <option value="">전체</option>
                {CUSTOMER_ADV_PROP_KIND_OPTS.map(t=>(<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>희망거래방식</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advTrade} onChange={e=>setAdvTrade(e.target.value)}>
                <option value="">전체</option>
                {CUSTOMER_TRADE_OPTS.map((opt)=>(<option key={opt.id} value={opt.id}>{opt.label}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>진행 상태</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advStatus} onChange={e=>setAdvStatus(e.target.value)}>
                <option value="">전체</option>
                {CUST_STATUS_OPTS.map(s=>(<option key={s.id} value={s.label}>{s.label}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매입가능액 최소(만)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advBuyMin} onChange={e=>setAdvBuyMin(e.target.value)}/>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매입가능액 최대(만)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advBuyMax} onChange={e=>setAdvBuyMax(e.target.value)}/>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn role="toolbar-primary" ch="검색 적용" ic="ti-search" on={()=>{applyAdvSearch();setVisibleCount(20);}}/>
            <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={()=>{resetAdvSearch();setVisibleCount(20);}}/>
          </div>
        </div>
      )}
      {/* Type filter tabs */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'0 28px',display:'flex',gap:0}}>
        {typeTabList.map(t=>(
          <div key={t.id} onClick={()=>setTypeTab(t.id)} style={{padding:'10px 18px',cursor:'pointer',fontSize:13,fontWeight:typeTab===t.id?600:400,color:typeTab===t.id?C.brand:C.txM,borderBottom:typeTab===t.id?`2px solid ${C.brand}`:'2px solid transparent',marginBottom:-1,transition:'color .1s'}}>
            {t.label}
            {t.id!=='ALL'&&<span style={{fontSize:12,color:C.txP,marginLeft:5}}>{CU.filter(c=>customerMatchesTypeTab(c,t.id)).length}</span>}
          </div>
        ))}
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 28px'}} onScroll={handleScroll} onClick={()=>setOpenColFilter(null)}>
        <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}} onClick={e=>e.stopPropagation()}>
          <style dangerouslySetInnerHTML={{__html:`.cust-list-tbl thead th{color:${C.txM}!important}`}}/>
          <table className="tbl tbl-fixed cust-list-tbl">
            <colgroup>
              <col style={{width:32}}/>
              <col style={{width:44}}/>
              <col style={{width:72}}/>
              <col style={{width:'7%'}}/>
              <col style={{width:'8.4%'}}/>
              <col style={{width:'9.2%'}}/>
              <col style={{width:'8.8%'}}/>
              <col style={{width:132}}/>
              <col style={{width:82}}/>
              <col style={{width:82}}/>
              <col style={{width:'14%'}}/>
              <col style={{width:99}}/>
              <col style={{width:128}}/>
            </colgroup>
            <thead><tr>
              <th style={{textAlign:'center',cursor:'pointer'}} title={allSelected?'전체 선택 해제':'전체 선택'} onClick={(e)=>{e.stopPropagation();toggleSelectAll();}}>
                <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${allSelected||someSelected?C.brand:C.bdrSt}`,background:allSelected?C.brand:someSelected?C.brandL:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
                  {allSelected&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {!allSelected&&someSelected&&<span style={{width:8,height:2,background:C.brand,borderRadius:1,display:'block'}}/>}
                </div>
              </th>
              <th style={{width:44}}>★</th>
              <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                  onClick={()=>setOpenColFilter(v=>v==='status'?null:'status')}>상태<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.status?1:.28}}>▼</span></span>
                {openColFilter==='status'&&(
                  <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:120,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                    <div onClick={()=>{setColFilter(f=>({...f,status:''}));setOpenColFilter(null);setVisibleCount(20);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.status?C.brand:C.tx,fontWeight:!colFilter.status?600:400}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                    {CUST_STATUS_OPTS.map(o=>(
                      <div key={o.id} onClick={()=>{setColFilter(f=>({...f,status:o.id}));setOpenColFilter(null);setVisibleCount(20);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.status===o.id?C.brand:C.tx,fontWeight:colFilter.status===o.id?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{o.label}</div>
                    ))}
                  </div>
                )}
              </th>
              <th onClick={()=>{toggleSort('name');setVisibleCount(20);}} style={{cursor:'pointer'}}>
                이름 {custSortMark('name')}
              </th>
              <th onClick={()=>{toggleSort('co');setVisibleCount(20);}} style={{cursor:'pointer'}}>
                회사 {custSortMark('co')}
              </th>
              <th onClick={()=>{toggleSort('region');setVisibleCount(20);}} style={{cursor:'pointer'}}>
                선호지역 {custSortMark('region')}
              </th>
              <th onClick={()=>{toggleSort('preferredTrades');setVisibleCount(20);}} style={{cursor:'pointer'}}>
                희망거래방식 {custSortMark('preferredTrades')}
              </th>
              <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                  onClick={()=>setOpenColFilter(v=>v==='type'?null:'type')}>유형<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.type?1:.28}}>▼</span></span>
                {openColFilter==='type'&&(
                  <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:120,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                    <div onClick={()=>{setColFilter(f=>({...f,type:''}));setOpenColFilter(null);setVisibleCount(20);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.type?C.brand:C.tx,fontWeight:!colFilter.type?600:400}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                    {CUST_TYPE_OPTS.map(o=>(
                      <div key={o.id} onClick={()=>{setColFilter(f=>({...f,type:o.id}));setOpenColFilter(null);setVisibleCount(20);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.type===o.id?C.brand:C.tx,fontWeight:colFilter.type===o.id?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{o.label}</div>
                    ))}
                  </div>
                )}
              </th>
              <th style={{textTransform:'none',letterSpacing:0,fontSize:11,lineHeight:1.25,whiteSpace:'normal'}} title="매입가능액 최소(만)">매입가능액<br/>최소(만)</th>
              <th style={{textTransform:'none',letterSpacing:0,fontSize:11,lineHeight:1.25,whiteSpace:'normal'}} title="매입가능액 최대(만)">매입가능액<br/>최대(만)</th>
              <th>메모</th>
              <th onClick={()=>{toggleSort('lastCall');setVisibleCount(20);}} style={{cursor:'pointer'}}>
                마지막 통화일 {custSortMark('lastCall')}
              </th>
              <th style={{width:128}}></th>
            </tr></thead>
            <tbody>
              {visible.map(c=>{
                const cd=custCallDatesOf(callDateMap,c.id);
                return(
                <tr key={c.id} onClick={()=>onOpen('cd',c)}>
                  <td onClick={(e)=>{e.stopPropagation();toggleCheck(c.id);}} style={{textAlign:'center',cursor:'pointer'}}>
                    <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${checked[c.id]?C.brand:C.bdrSt}`,background:checked[c.id]?C.brand:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                      {checked[c.id]&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </td>
                  <td onClick={e=>e.stopPropagation()} style={{textAlign:'center',whiteSpace:'nowrap'}}>
                    <span style={{fontSize:18,color:c.fav?'#F59E0B':C.txP,cursor:'pointer'}}
                      onClick={e=>toggleCustomerFav(c,e)}>{c.fav?'★':'☆'}</span>
                  </td>
                  <td style={{whiteSpace:'nowrap'}}><CustStatusBdg s={c.status}/></td>
                  <td><div className="cell-ellipsis" style={{fontWeight:600,fontSize:14}} title={c.name}>{c.name}</div></td>
                  <td><div className="cell-ellipsis" style={{color:C.txS}} title={c.co}>{c.co}</div></td>
                  <td><div className="cell-ellipsis" style={{color:C.txS}} title={c.region}>{c.region||'—'}</div></td>
                  <td><div className="cell-ellipsis" style={{color:C.txM,fontSize:12,whiteSpace:'nowrap'}} title={customerTradeLabelOf(c)}>{customerTradeLabelOf(c)}</div></td>
                  <td style={{whiteSpace:'nowrap',overflow:'visible'}}><Bdg label={customerTypeLabelOf(c)} type="info"/></td>
                  <td><div className="cell-ellipsis" style={{color:C.info,fontSize:12,fontWeight:500,textAlign:'right'}} title={fmtCustomerMoney(c.buyMin)}>{fmtCustomerMoney(c.buyMin)}</div></td>
                  <td><div className="cell-ellipsis" style={{color:C.info,fontSize:12,fontWeight:500,textAlign:'right'}} title={fmtCustomerMoney(c.buyMax)}>{fmtCustomerMoney(c.buyMax)}</div></td>
                  <td><div className="cell-ellipsis" style={{color:C.txM,fontSize:13}} title={c.memo}>{c.memo}</div></td>
                  <td><div className="cell-ellipsis" style={{color:C.txM,fontSize:13}} title={fmtCallDate(cd.last)}>{fmtCallDate(cd.last)}</div></td>
                  <td onClick={e=>e.stopPropagation()} style={{whiteSpace:'nowrap'}}>
                    <div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'nowrap'}}>
                      <Btn role="row-edit" ch="수정" on={()=>onOpen('cf',c)} disabled={!canEditCust(c)} title={!canEditCust(c)?PERMISSION_DENIED_TOOLTIP:undefined}/>
                      <Btn role="row-delete" ch="삭제" on={()=>handleDeleteCustomer(c)} disabled={!canEditCust(c)||!onDeleteCustomer} title={!canEditCust(c)?PERMISSION_DENIED_TOOLTIP:undefined}/>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        {checkedIds.length>0&&(
          <div style={{position:'sticky',bottom:0,marginTop:12,background:'#1A2332',borderRadius:10,padding:'10px 18px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 4px 16px rgba(0,0,0,.2)'}}>
            <span style={{fontSize:13,color:'#fff',fontWeight:500}}>{checkedIds.length}명 선택됨</span>
            <div style={{position:'relative'}}>
              <Btn role="toolbar-secondary" ch="상태 변경" on={()=>setStatusBulkOpen((v)=>!v)} sx={{background:'rgba(255,255,255,.1)',borderColor:'rgba(255,255,255,.2)',color:'#fff'}}/>
              {statusBulkOpen&&(
                <div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,minWidth:140,boxShadow:'0 6px 20px rgba(0,0,0,.15)',overflow:'hidden'}}>
                  {CUST_STATUS_OPTS.map((opt)=>(
                    <div key={opt.id} onClick={()=>applyBulkStatus(opt.id)}
                      style={{padding:'9px 14px',cursor:'pointer',fontSize:13,color:C.tx}}
                      onMouseEnter={(e)=>{ e.currentTarget.style.background=C.surf2; }}
                      onMouseLeave={(e)=>{ e.currentTarget.style.background='transparent'; }}>
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Btn role="toolbar-danger" ch="삭제" on={requestBulkDelete} sx={{background:'rgba(220,38,38,.85)',borderColor:'rgba(255,255,255,.2)',color:'#fff'}}/>
            <Btn role="toolbar-secondary" ch="선택 해제" on={()=>{setChecked({});setStatusBulkOpen(false);}} sx={{background:'rgba(255,255,255,.1)',borderColor:'rgba(255,255,255,.2)',color:'#fff'}}/>
          </div>
        )}
      </div>
    </div>
  );
};
/* ═══ CALL LOGS ═══ */
/* ═══ CALL FORM (등록/수정 공용) ═══ */
const isFreePhoneSel=(x)=>!!(x&&x.__freePhone);
const makeFreePhoneSel=(phone)=>({__freePhone:true,phone:formatPhone(phone)||String(phone||''),name:formatPhone(phone)||String(phone||'')});

const DropSelect=({sel,onSel,onClear,search,setSearch,open,setOpen,items,renderChip,renderItem,placeholder,freeTextOption,onSelectFreeText})=>(
    <div style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
      {sel?(
        <div style={{display:'flex',alignItems:'flex-start',gap:8,minHeight:38,border:`1.5px solid ${C.brand}`,borderRadius:7,background:C.brandL,padding:'8px 12px'}}>
          <span className="cell-wrap" style={{fontSize:13,fontWeight:600,color:C.brand,flex:1,minWidth:0}}>{renderChip(sel)}</span>
          <span onClick={onClear} style={{width:20,height:20,borderRadius:'50%',background:'rgba(200,16,46,.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.brand,fontSize:13,fontWeight:700,flexShrink:0,marginTop:1}}>×</span>
        </div>
      ):(
        <div style={{display:'flex',alignItems:'center',height:38,border:`1.5px solid ${C.bdr}`,borderRadius:7,background:'#fff',overflow:'hidden'}}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0,color:C.txP,marginLeft:12}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)}
            onKeyDown={e=>{
              if(e.key!=='Enter'||!freeTextOption||!onSelectFreeText) return;
              e.preventDefault();
              onSelectFreeText(freeTextOption);
              setSearch('');
              setOpen(false);
            }}
            placeholder={placeholder}
            style={{border:'none',background:'transparent',flex:1,padding:'0 10px',fontSize:13,color:C.tx,height:'100%'}}/>
          {search&&<span onClick={()=>{setSearch('');setOpen(false);}} style={{padding:'0 10px',cursor:'pointer',color:C.txP,fontSize:14}}>×</span>}
        </div>
      )}
      {!sel&&open&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:50,maxHeight:220,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,.15)'}}>
          {items.map((item,i)=>(
            <div key={i} onClick={()=>{onSel(item);setSearch('');setOpen(false);}}
              style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${C.bdr}`,fontSize:13}}
              onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {renderItem(item)}
            </div>
          ))}
          {freeTextOption&&onSelectFreeText&&(
            <div onClick={()=>{onSelectFreeText(freeTextOption);setSearch('');setOpen(false);}}
              style={{padding:'10px 14px',cursor:'pointer',background:C.brandL,borderTop:items.length?`1px solid ${C.bdr}`:'none',fontSize:13}}
              onMouseEnter={e=>e.currentTarget.style.background='#FADADD'}
              onMouseLeave={e=>e.currentTarget.style.background=C.brandL}>
              <div style={{fontWeight:600,color:C.brand}}>미등록 번호로 추가</div>
              <div style={{fontSize:12,color:C.txM,marginTop:2}}>{freeTextOption}</div>
            </div>
          )}
          {items.length===0&&!freeTextOption&&(
            <div style={{padding:'16px',textAlign:'center',color:C.txP,fontSize:13}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:18,height:18,flexShrink:0}} aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9a3 3 0 0 0 4.24 4.24"/><path d="M10.58 5.16A7 7 0 0 1 18.36 13"/><path d="M18.36 18.36A7 7 0 0 1 5 12c0-1.07.24-2.08.67-3"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              검색 결과가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  );

/* ═══ CALL LOGS ═══ */
const CallLogs=({onOpen,onDelete})=>{
  const { user, companyRole, memberPermissions }=useAuth();
  const P=useProperties();
  const CU=useOwnerCustomers();
  const CALLS=useOwnerCallLogs();
  const canEditCall=(c)=>canWriteRecord(c,user?.id,companyRole,memberPermissions,'call_logs');
  const [showFilter,setShowFilter]=useState(false);
  const [keyword,setKeyword]=useState('');
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [visibleCount,setVisibleCount]=useState(20);
  const handleScroll=(e)=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<80)setVisibleCount(v=>v+20);};
  const filtered=CALLS.filter(c=>{
    if(dateFrom&&c.date<dateFrom) return false;
    if(dateTo&&c.date>dateTo) return false;
    if(!keyword) return true;
    const kw=keyword.toLowerCase();
    const prop=P.find(p=>p.id===c.pid);
    const cust=CU.find(cu=>cu.id===c.cid);
    return (c.content&&c.content.toLowerCase().includes(kw))||
      (cust&&cust.name&&cust.name.includes(kw))||
      (c.contactPhone&&String(c.contactPhone).includes(kw))||
      (prop&&propMatchesSearch(prop,kw));
  });
  const visible=filtered.slice(0,visibleCount);
  const grouped=visible.reduce((a,c)=>{a[c.date]=a[c.date]||[];a[c.date].push(c);return a;},{});
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      <PH title="통화 내역" sub={`${filtered.length}건 / 전체 ${CALLS.length}건`}
        ch={
          <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:20,flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,height:36,background:'#fff',border:`1.5px solid ${C.bdr}`,borderRadius:7,padding:'0 12px',flex:1,maxWidth:420}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,flexShrink:0,color:C.txP}} aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="통화내용 / 고객명 / 주소 검색..." style={{border:'none',background:'transparent',fontSize:13,color:C.tx,flex:1,height:'100%'}}/>
              {keyword&&<span onClick={()=>setKeyword('')} style={{fontSize:14,color:C.txP,cursor:'pointer',lineHeight:1}}>×</span>}
            </div>
            <Btn role="filter" ch={showFilter?'날짜 닫기':'날짜 필터'} ic={showFilter?'ti-x':'ti-calendar'} on={()=>setShowFilter(v=>!v)}/>
          </div>
        }
        acts={<Btn role="page-primary" ch="통화 등록" on={()=>onOpen&&onOpen('ce',null)}/>}/>
      {showFilter&&(
        <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'12px 28px'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:12,color:C.txM,fontWeight:600,whiteSpace:'nowrap'}}>기간 필터</span>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="date" className="inp" style={{height:34,fontSize:13,width:150}} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
              <span style={{fontSize:13,color:C.txM}}>~</span>
              <input type="date" className="inp" style={{height:34,fontSize:13,width:150}} value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
            </div>
            <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={()=>{setDateFrom('');setDateTo('');}}/>
          </div>
        </div>
      )}
      <div style={{flex:1,overflow:'auto',padding:'16px 28px'}} onScroll={handleScroll}>
        {Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,calls])=>(
          <div key={date} style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:600,color:C.txM,whiteSpace:'nowrap'}}>{date}</span>
              <div style={{flex:1,height:1,background:C.bdr}}/>
              <span style={{fontSize:12,color:C.txP}}>{calls.length}건</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {calls.map(c=>{
                const prop=P.find(p=>p.id===c.pid);
                const cust=CU.find(cu=>cu.id===c.cid);
                return(
                  <div key={c.id} style={{background:C.surf,borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.04)',display:'flex',gap:14,borderBottom:`2px solid ${C.bdr}`}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:prop?C.brand:C.bdrSt,marginTop:5,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.tx}}>{c.date} {c.time}</span>
                        {prop&&<span onClick={()=>onOpen('pd',prop)} style={{fontSize:13,color:C.info,cursor:'pointer',fontWeight:500}}>{prop.bldg||propDisplayAddr(prop)}</span>}
                        {cust&&<span onClick={e=>{e.stopPropagation();if(onOpen)onOpen('cd',cust);}} style={{fontSize:12,color:C.info,cursor:'pointer',fontWeight:500,textDecoration:'underline',textDecorationColor:'rgba(37,99,235,.3)'}}>· {cust.name}</span>}
                        {!cust&&c.contactPhone&&<span style={{fontSize:12,color:C.txM,fontWeight:500}}>· {formatPhone(c.contactPhone)||c.contactPhone}</span>}
                        {!prop&&!cust&&!c.contactPhone&&<span style={{fontSize:12,color:C.txP}}>(관련 매물/고객 없음)</span>}
                      </div>
                      <div style={{fontSize:13,color:C.txS,lineHeight:1.6,maxHeight:80,overflowY:'auto'}}>{c.content}</div>
                      {c.next&&<div style={{marginTop:8,display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.txM}}>
                        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
                        <span style={{fontWeight:500}}>다음 액션:</span>
                        <span>{c.next}</span>
                        {c.nDate&&<span style={{background:C.warnBg,color:C.warn,padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:500}}>{c.nDate}</span>}
                      </div>}
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <Btn role="row-edit" ch="수정" on={()=>{if(onOpen)onOpen('ce',c);}} disabled={!canEditCall(c)} title={!canEditCall(c)?PERMISSION_DENIED_TOOLTIP:undefined}/>
                      <Btn role="row-delete" ch="삭제" on={()=>onDelete&&onDelete(c)} disabled={!canEditCall(c)||!onDelete} title={!canEditCall(c)?PERMISSION_DENIED_TOOLTIP:undefined}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:'60px 0',color:C.txM,fontSize:14}}>
            검색 결과가 없습니다
          </div>
        )}
      </div>
    </div>
  );
};
/* ═══ CALENDAR ═══ */
const SCHEDULE_IMPORT_GUIDE_SEEN_KEY='landnote.scheduleImportGuide.seen';

const ScheduleImportGuideWin=({onClose})=>{
  const handleConfirm=()=>{
    try{ localStorage.setItem(SCHEDULE_IMPORT_GUIDE_SEEN_KEY,'1'); }catch{ /* ignore */ }
    onClose();
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)',padding:20,boxSizing:'border-box'}}
      onClick={handleConfirm}>
      <div style={{background:'#fff',borderRadius:14,maxWidth:520,width:'100%',boxShadow:'0 16px 48px rgba(0,0,0,.2)',overflow:'hidden',display:'flex',flexDirection:'column'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{padding:'28px 28px 8px'}}>
          <div style={{fontSize:20,fontWeight:800,color:C.tx,letterSpacing:'-.02em',lineHeight:1.35,marginBottom:20}}>
            일정 연동 및 가져오기 안내
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{padding:'14px 16px',background:C.surf2,borderRadius:10,border:`1px solid ${C.bdr}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:8}}>구글 캘린더</div>
              <div style={{fontSize:13,color:C.txM,lineHeight:1.65}}>
                구글 캘린더와 연동하면 일정을 한 번 가져옵니다. 이미 가져온 일정은 유지되며 중복 저장되지 않습니다.
                이후 새 일정을 반영하려면「동기화」버튼을 눌러 주세요.
                <div style={{marginTop:8}}>단, LandNote에서 등록한 일정은 구글 캘린더에 등록되지 않습니다.</div>
              </div>
            </div>
            <div style={{padding:'14px 16px',background:C.surf2,borderRadius:10,border:`1px solid ${C.bdr}`}}>
              <div style={{fontSize:14,fontWeight:700,color:C.tx,marginBottom:8}}>.ics 가져오기</div>
              <div style={{fontSize:13,color:C.txM,lineHeight:1.65}}>
                .ics 파일로 일정을 가져오면 한 번만 반영됩니다. 가져온 이후에는 자동으로 추가·동기화되지 않습니다.
              </div>
            </div>
          </div>
        </div>
        <div style={{padding:'20px 28px 24px',display:'flex',justifyContent:'flex-end'}}>
          <Btn role="dialog-confirm" ch="확인" on={handleConfirm}/>
        </div>
      </div>
    </div>
  );
};

const GoogleCalendarSyncWin=({onClose,onImported,gcalLinks,gcalSyncing,onSyncNow,onUnlinkOne,gcalMeta,ownerId})=>{
  const [link,setLink]=useState('');
  const [label,setLabel]=useState('');
  const [loading,setLoading]=useState(false);

  const handleImport=async()=>{
    if(loading||!link.trim()) return;
    setLoading(true);
    try{
      const imported=await importGoogleCalendarFromLink(link,{label:label.trim(),ownerId});
      onImported(imported);
      showNotification(`구글 캘린더를 연동했습니다. 총 ${imported.total}건 중 ${imported.added}건 가져옴, ${imported.duplicated}건 중복 제외.`,'success');
      setLink('');
      setLabel('');
    }catch(err){
      window.alert(err instanceof Error?err.message:'구글 캘린더를 불러오지 못했습니다.');
    }finally{
      setLoading(false);
    }
  };

  return(
    <Win title="구글 캘린더 동기화" ic="ti-brand-google" onClose={onClose} w={560}
      ch={<>
        <div style={{...WIN_BODY_SCROLL,padding:'20px 24px',display:'flex',flexDirection:'column',gap:18}}>
          {gcalLinks.length>0&&(
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:C.tx}}>연동된 캘린더 ({gcalLinks.length})</span>
                <button type="button" disabled={gcalSyncing} onClick={onSyncNow}
                  style={{border:`1px solid ${C.bdr}`,background:'#fff',borderRadius:6,padding:'5px 12px',fontSize:12,cursor:gcalSyncing?'wait':'pointer',color:C.tx,fontWeight:600}}>
                  {gcalSyncing?'동기화 중…':'전체 동기화'}
                </button>
              </div>
              <div style={{border:`1px solid ${C.bdr}`,borderRadius:8,overflow:'hidden'}}>
                {gcalLinks.map((l,i)=>{
                  const meta=gcalMeta.get(l.sourceId);
                  return(
                  <div key={l.sourceId} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderTop:i>0?`1px solid ${C.bdr}`:'none',background:C.surf2}}>
                    <span style={{width:9,height:9,borderRadius:'50%',background:meta?.color,flexShrink:0}}/>
                    <span style={{fontSize:13,fontWeight:600,color:C.tx,flexShrink:0}}>{meta?.label}</span>
                    <span style={{flex:1,minWidth:0,fontSize:12,color:C.txM,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {l.lastSyncAt?`최근 동기화 ${new Date(l.lastSyncAt).toLocaleString('ko-KR')}`:'아직 동기화하지 않음'}
                      {l.lastError?` · 오류: ${l.lastError}`:''}
                    </span>
                    <button type="button" onClick={()=>onUnlinkOne(l.sourceId,meta?.label)}
                      style={{border:'none',background:'transparent',padding:'4px 6px',fontSize:12,cursor:'pointer',color:C.txS,textDecoration:'underline',flexShrink:0}}>
                      연동 해제
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:14,paddingTop:gcalLinks.length>0?18:0,borderTop:gcalLinks.length>0?`1px solid ${C.bdr}`:'none'}}>
            <div style={{fontSize:13,fontWeight:700,color:C.tx}}>새 캘린더 연동하기</div>
            <div style={{fontSize:13,color:C.txS,lineHeight:1.6}}>
              Google Calendar의 공유 링크 또는 iCal 주소를 붙여 넣으면 일정을 가져옵니다. 이후에는「동기화」버튼을 눌러야 새 일정이 반영됩니다. (이미 가져온 일정은 유지되며 중복 저장되지 않습니다.)
              <div style={{marginTop:8,padding:'10px 12px',background:C.surf2,borderRadius:8,border:`1px solid ${C.bdr}`,fontSize:12,color:C.txM}}>
                <div style={{fontWeight:600,color:C.tx,marginBottom:6}}>링크 찾는 방법</div>
                <div>Google Calendar → 설정 → 내 캘린더 → 해당 캘린더 →「캘린더 통합」</div>
                <div style={{marginTop:4}}>· 공개 캘린더: embed 링크 또는「공개 URL」</div>
                <div>· 비공개 캘린더:「iCal 형식의 비공개 주소」전체 URL</div>
              </div>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>캘린더 링크</div>
              <input className="inp" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…"
                onKeyDown={e=>{if(e.key==='Enter'&&!loading&&link.trim()) handleImport();}}/>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>이름 (선택)</div>
              <input className="inp" value={label} onChange={e=>setLabel(e.target.value)} placeholder="예: 회사 캘린더, 개인 일정"
                onKeyDown={e=>{if(e.key==='Enter'&&!loading&&link.trim()) handleImport();}}/>
              <div style={{fontSize:11,color:C.txM,marginTop:4}}>여러 캘린더를 연동할 때 구분하기 쉽도록 이름을 붙여 두면, 나중에 개별적으로 연동을 해제할 수 있습니다.</div>
            </div>
          </div>
        </div>
        <ActionBar
          saveLabel={loading?'가져오는 중…':'연동·가져오기'}
          onSave={handleImport}
          onCancel={loading?undefined:onClose}
        />
      </>}/>
  );
};

const Calendar=({onOpen})=>{
  const { user, companyRole, memberPermissions }=useAuth();
  const SCHEDS=useOwnerSchedules();
  const CALLS=useOwnerCallLogs();
  const todayRef=useMemo(()=>{
    const d=new Date();
    return {year:d.getFullYear(),month:d.getMonth()+1,date:d.getDate()};
  },[]);
  const [sel,setSel]=useState(todayRef.date);
  const [year,setYear]=useState(todayRef.year);
  const [month,setMonth]=useState(todayRef.month);
  const icsInputRef=useRef(null);
  const [icsNotice,setIcsNotice]=useState('');
  const [googleCalOpen,setGoogleCalOpen]=useState(false);
  const gcalOwnerId=user?.id&&user.id!=='dev-local'?user.id:undefined;
  const [gcalLinks,setGcalLinks]=useState(()=>listGoogleCalendarLinks(gcalOwnerId));
  const [gcalSyncing,setGcalSyncing]=useState(false);
  const [importGuideOpen,setImportGuideOpen]=useState(()=>{
    try{ return localStorage.getItem(SCHEDULE_IMPORT_GUIDE_SEEN_KEY)!=='1'; }catch{ return true; }
  });
  const [expandedChkIds,setExpandedChkIds]=useState(()=>new Set());
  const [chkBusyId,setChkBusyId]=useState(null);

  const toggleChkExpand=(schedId,e)=>{
    e?.stopPropagation?.();
    setExpandedChkIds(prev=>{
      const next=new Set(prev);
      if(next.has(schedId)) next.delete(schedId);
      else next.add(schedId);
      return next;
    });
  };

  const toggleSidebarChkItem=async(sched,chkIndex,e)=>{
    e?.stopPropagation?.();
    if(!sched?.id||chkBusyId!=null) return;
    if(!canWriteRecord(sched,user?.id,companyRole,memberPermissions,'schedules')){
      showNotification(PERMISSION_DENIED_TOOLTIP,'warning');
      return;
    }
    const full=Array.isArray(sched.chk)?sched.chk.map(c=>({...c})):[];
    if(!full[chkIndex]) return;
    full[chkIndex]={...full[chkIndex],d:!full[chkIndex].d};
    setChkBusyId(sched.id);
    try{
      await updateScheduleDirect(sched.id,{chk:full});
    }catch(err){
      console.error('[Calendar chk toggle]',err);
      showNotification(err?.message==='FORBIDDEN'?PERMISSION_DENIED_TOOLTIP:'체크리스트 수정에 실패했습니다.','error');
    }finally{
      setChkBusyId(null);
    }
  };

  const refreshGcalLinks=useCallback(()=>{
    setGcalLinks(listGoogleCalendarLinks(gcalOwnerId));
  },[gcalOwnerId]);

  useEffect(()=>{
    refreshGcalLinks();
  },[refreshGcalLinks]);

  // syncUserId 지연으로 ownerId=dev-local 에 묶인 구글 일정을 현재 계정으로 복구
  useEffect(()=>{
    if(!gcalOwnerId) return;
    let cancelled=false;
    (async()=>{
      try{
        const misplaced=await db.schedules.where('ownerId').equals('dev-local').toArray();
        const toFix=misplaced.filter((s)=>s.icsSourceId&&!s.deletedAt);
        for(const s of toFix){
          if(cancelled) return;
          await db.schedules.update(s.id,{ownerId:gcalOwnerId});
        }
      }catch(err){
        console.error('[Calendar] repair gcal ownerId',err);
      }
    })();
    return()=>{ cancelled=true; };
  },[gcalOwnerId]);

  const formatImportNotice=(result)=>{
    if(Array.isArray(result)){
      return `${result.length}건의 일정을 가져왔습니다.`;
    }
    const added=result?.added??0;
    const updated=result?.updated??0;
    const skipped=result?.skipped??0;
    const parts=[`${added}건 추가`];
    if(updated) parts.push(`${updated}건 갱신`);
    if(skipped) parts.push(`${skipped}건 중복 건너뜀`);
    return parts.join(' · ');
  };

  const applyImportedSchedules=(result)=>{
    setIcsNotice('');
    const list=Array.isArray(result)
      ? result
      : (result?.addedSchedules?.length?result.addedSchedules:result?.schedules)||[];
    const first=list[0];
    if(first?.date){
      const [y,m,d]=first.date.split('-').map(Number);
      if(y) setYear(y);
      if(m) setMonth(m);
      if(d) setSel(d);
    }
    setIcsNotice(formatImportNotice(result));
    refreshGcalLinks();
  };

  const handleIcsFile=async(e)=>{
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file) return;
    try{
      const text=await file.text();
      applyImportedSchedules(await importIcsSchedules(text));
      showNotification('저장하였습니다.','success');
    }catch(err){
      window.alert(err instanceof Error?err.message:'ICS 파일을 불러오지 못했습니다.');
    }
  };

  const handleGcalSyncNow=async()=>{
    if(gcalSyncing) return;
    setGcalSyncing(true);
    try{
      const result=await syncLinkedGoogleCalendars({force:true,ownerId:gcalOwnerId});
      refreshGcalLinks();
      if(result.errors&&!result.synced){
        window.alert('구글 캘린더 동기화에 실패했습니다. 연동 링크를 확인해 주세요.');
        return;
      }
      applyImportedSchedules(result);
      if(result.added>0) showNotification(`구글 캘린더 동기화: 총 ${result.total}건 중 신규 ${result.added}건, 중복 제외 ${result.duplicated}건`,'success');
      else showNotification(`동기화 완료 — 새 일정이 없습니다. (총 ${result.total}건 중 중복 ${result.duplicated}건)`,'success');
    }catch(err){
      window.alert(err instanceof Error?err.message:'구글 캘린더 동기화에 실패했습니다.');
    }finally{
      setGcalSyncing(false);
    }
  };

  const gcalLinkLabel=(l)=>{
    if(l.label&&l.label.trim()) return l.label.trim();
    const src=l.sourceLink||l.icsUrl||'';
    return src.length>42?`${src.slice(0,42)}…`:(src||'연동된 캘린더');
  };
  const gcalMeta=useMemo(()=>{
    const m=new Map();
    gcalLinks.forEach(l=>{
      const color=l.color&&GCAL_LINK_COLORS.includes(l.color)?l.color:gcalFallbackColor(l.sourceId);
      m.set(l.sourceId,{color,label:gcalLinkLabel(l)});
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- gcalLinkLabel은 gcalLinks에서 파생, 별도 의존성 불필요
  },[gcalLinks]);

  const handleGcalUnlinkOne=(sourceId,label)=>{
    if(!window.confirm(`'${label}' 캘린더의 연동을 해제할까요? (이미 가져온 일정은 삭제되지 않습니다. 다른 연동 캘린더에는 영향이 없습니다.)`)) return;
    removeGoogleCalendarLink(sourceId,gcalOwnerId);
    refreshGcalLinks();
    setIcsNotice(`'${label}' 캘린더 연동을 해제했습니다.`);
  };
  const isTodayCell=(d)=>d!=null&&year===todayRef.year&&month===todayRef.month&&d===todayRef.date;
  const goToday=()=>{setYear(todayRef.year);setMonth(todayRef.month);setSel(todayRef.date);};
  const days=['일','월','화','수','목','금','토'];
  const daysInMonth=new Date(year,month,0).getDate();
  const firstDow=new Date(year,month-1,1).getDay();
  const cells=Array.from({length:42},(_,i)=>{const d=i-firstDow+1;return d>=1&&d<=daysInMonth?d:null;});

  const getSchedsForDay=(d)=>SCHEDS.filter(s=>scheduleCoversDay(s,year,month,d));

  const selScheds=sel?getSchedsForDay(sel):[];
  const hasItems=selScheds.length>0;

  const CAL_CELL_H=112;
  const CAL_EVT_H=18;
  const CAL_EVT_GAP=2;
  const CAL_EVT_MAX=2;
  const CAL_EVT_AREA_H=CAL_EVT_MAX*(CAL_EVT_H+CAL_EVT_GAP)+CAL_EVT_H;

  const dayData=useMemo(()=>{
    const map={};
    for(let day=1;day<=daysInMonth;day++){
      map[day]={
        scheds:SCHEDS.filter(s=>scheduleCoversDay(s,year,month,day)),
        calls:CALLS.filter(c=>{
          const cd=parseDashDate(c.date);
          if(!cd) return false;
          return cd.getFullYear()===year&&cd.getMonth()+1===month&&cd.getDate()===day;
        }),
      };
    }
    return map;
  },[SCHEDS,CALLS,year,month,daysInMonth]);

  const CalEvtSlot=({children,style})=>(
    <div style={{height:CAL_EVT_H,minHeight:CAL_EVT_H,maxHeight:CAL_EVT_H,flexShrink:0,...style}}>{children}</div>
  );

  const CalSchedChip=({s,onClick})=>{
    const {c,bg,label}=scheduleSourceInfo(s,gcalMeta);
    const period=fmtSchedulePeriodDot(s);
    return(
      <CalEvtSlot>
        <div
          title={`${label} · ${period}${s.time?` ${s.time}`:''} ${s.title||''}`.trim()}
          onClick={onClick}
          style={{height:'100%',display:'flex',alignItems:'center',gap:3,padding:'0 4px',borderRadius:4,background:bg,borderLeft:`3px solid ${c}`,cursor:'pointer',overflow:'hidden',minWidth:0}}>
          {s.time&&<span style={{fontSize:10,color:C.txM,flexShrink:0}}>{s.time.slice(0,5)}</span>}
          <span style={{fontSize:11,color:c,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{s.title}</span>
        </div>
      </CalEvtSlot>
    );
  };

  const CAL_SIDEBAR_W=340;

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      {importGuideOpen&&(
        <ScheduleImportGuideWin onClose={()=>setImportGuideOpen(false)}/>
      )}
      {googleCalOpen&&(
        <GoogleCalendarSyncWin
          onClose={()=>setGoogleCalOpen(false)}
          onImported={applyImportedSchedules}
          gcalLinks={gcalLinks}
          gcalSyncing={gcalSyncing}
          onSyncNow={handleGcalSyncNow}
          onUnlinkOne={handleGcalUnlinkOne}
          gcalMeta={gcalMeta}
          ownerId={gcalOwnerId}
        />
      )}
      <PH title="일정 관리" sub={fmtTodayKorean()}
        ch={<div style={{display:'flex',alignItems:'center',gap:10,marginLeft:20}}>
          <button onClick={()=>{if(month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1);setSel(null);}}
            style={{width:btnPx(28),height:btnPx(28),borderRadius:btnPx(6),border:`1.5px solid ${C.bdr}`,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}
            onMouseEnter={e=>e.currentTarget.style.background=C.surf3}
            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{fontSize:15,fontWeight:600,color:C.tx,minWidth:130,textAlign:'center'}}>{year}년 {month}월</span>
          <button onClick={()=>{if(month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1);setSel(null);}}
            style={{width:btnPx(28),height:btnPx(28),borderRadius:btnPx(6),border:`1.5px solid ${C.bdr}`,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}
            onMouseEnter={e=>e.currentTarget.style.background=C.surf3}
            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <Btn role="page-secondary" ch="오늘" on={goToday}/>
        </div>}
        acts={<>
          <input ref={icsInputRef} type="file" accept=".ics,text/calendar" style={{display:'none'}} onChange={handleIcsFile}/>
          <Btn role="page-secondary" ch="?" title="일정 연동 및 가져오기 안내" on={()=>setImportGuideOpen(true)}/>
          <Btn role="page-secondary" ch="구글 캘린더" ic="ti-brand-google" on={()=>setGoogleCalOpen(true)}/>
          <Btn role="page-secondary" ch=".ics 가져오기" ic="ti-upload" on={()=>icsInputRef.current?.click()}/>
          <Btn role="page-primary" ch="일정 추가" on={()=>onOpen('sf',null)}/>
        </>}/>
      <div style={{padding:'8px 28px',background:C.surf,borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <span style={{fontSize:12,color:C.txM,fontWeight:600}}>우선순위</span>
        {PRI_OPTS.map(([v,l])=>(
          <span key={v} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:PRI_C[v]}}>
            <span style={{width:8,height:8,borderRadius:2,background:PRI_C[v],flexShrink:0}}/>
            {l}
          </span>
        ))}
        {gcalLinks.length>0&&(<>
          <span style={{width:1,height:14,background:C.bdr,flexShrink:0}}/>
          <span style={{fontSize:12,color:C.txM,fontWeight:600}}>연동 캘린더</span>
          {gcalLinks.map(l=>{
            const meta=gcalMeta.get(l.sourceId);
            return(
              <span key={l.sourceId} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:meta?.color}}>
                <span style={{width:8,height:8,borderRadius:'50%',background:meta?.color,flexShrink:0}}/>
                {meta?.label}
              </span>
            );
          })}
        </>)}
      </div>
      {icsNotice&&(
        <div style={{padding:'10px 28px',background:C.okBg,color:C.ok,fontSize:13,borderBottom:`1px solid ${C.okBd}`}}>
          {icsNotice}
        </div>
      )}
      <div style={{flex:1,minHeight:0,display:'flex',gap:16,padding:'20px 28px',overflow:'hidden'}}>
        <div style={{flex:1,minWidth:0,overflow:'auto'}}>
          <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:`1px solid ${C.bdr}`}}>
              {days.map((d,i)=><div key={i} style={{textAlign:'center',padding:'10px 0',fontSize:12,fontWeight:600,color:i===0?C.err:i===6?C.info:C.txM,letterSpacing:'.04em'}}>{d}</div>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridAutoRows:`${CAL_CELL_H}px`}}>
              {cells.map((d,i)=>{
                const today=isTodayCell(d);
                const selD=d!=null&&d===sel;
                const daySchds=d?dayData[d]?.scheds||[]:[];
                const dayCalls=d?dayData[d]?.calls||[]:[];
                const extraScheds=Math.max(0,daySchds.length-CAL_EVT_MAX);
                return(
                  <div key={i}
                    onClick={()=>{if(d){setSel(d);}}}
                    style={{height:CAL_CELL_H,minHeight:CAL_CELL_H,maxHeight:CAL_CELL_H,boxSizing:'border-box',padding:'6px 8px',borderRight:(i+1)%7!==0?`1px solid ${C.bdr}`:'none',borderBottom:i<35?`1px solid ${C.bdr}`:'none',cursor:d?'pointer':'default',background:!d?C.surf3:(today&&selD)?C.brandL:selD?'#fff':today?`${C.brand}06`:'transparent',transition:'background .1s',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column'}}
                    onMouseEnter={e=>{if(d&&!selD)e.currentTarget.style.background=C.surf2}}
                    onMouseLeave={e=>{if(d&&!selD)e.currentTarget.style.background=(today&&selD)?C.brandL:today?`${C.brand}06`:'transparent'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',height:24,minHeight:24,flexShrink:0,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:today||selD?700:400,width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:(today&&selD)?C.brand:selD?C.info:'transparent',color:!d?C.txP:(today&&selD)||selD?'#fff':i%7===0?C.err:i%7===6?C.info:C.tx}}>{d||''}</span>
                      {d&&<span onClick={e=>{e.stopPropagation();onOpen('sf',{_newDate:`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`});}} style={{width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:C.txP,cursor:'pointer',flexShrink:0}}
                        onMouseEnter={e=>{e.currentTarget.style.background=C.brandL;e.currentTarget.style.color=C.brand;}}
                        onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.txP;}}>+</span>}
                    </div>
                    <div style={{height:CAL_EVT_AREA_H,minHeight:CAL_EVT_AREA_H,maxHeight:CAL_EVT_AREA_H,display:'flex',flexDirection:'column',gap:CAL_EVT_GAP,overflow:'hidden'}}>
                      {Array.from({length:CAL_EVT_MAX}).map((_,idx)=>{
                        const s=daySchds[idx];
                        if(!s) return <CalEvtSlot key={`empty-${idx}`}/>;
                        return (
                          <CalSchedChip
                            key={s.id}
                            s={s}
                            onClick={e=>{e.stopPropagation();onOpen('sd',s);}}
                          />
                        );
                      })}
                      <CalEvtSlot>
                        {extraScheds>0?(
                          <div style={{height:'100%',display:'flex',alignItems:'center',padding:'0 4px',fontSize:10,color:C.txM,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                            외 {extraScheds}건
                          </div>
                        ):dayCalls.length>0?(
                          <div style={{height:'100%',display:'flex',alignItems:'center',gap:3,padding:'0 4px',fontSize:10,color:C.info,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.58 2.34.7A2 2 0 0 1 22 16.92z"/></svg>
                            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>통화 {dayCalls.length}건</span>
                          </div>
                        ):null}
                      </CalEvtSlot>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{width:CAL_SIDEBAR_W,flexShrink:0,display:'flex',flexDirection:'column',minHeight:0}}>
          <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            {sel?(
              <>
                <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:C.tx,lineHeight:1.35}}>
                        {month}월 {sel}일
                        {isTodayCell(sel)&&<span style={{fontSize:11,color:C.brand,fontWeight:600,marginLeft:6}}>오늘</span>}
                      </div>
                      <div style={{fontSize:12,color:C.txM,marginTop:4}}>
                        일정 {selScheds.length}건
                      </div>
                    </div>
                  </div>
                  <Btn role="toolbar-primary" ch="이 날 일정 추가" ic="ti-plus" full
                    on={()=>onOpen('sf',{_newDate:`${year}-${String(month).padStart(2,'0')}-${String(sel).padStart(2,'0')}`})}/>
                </div>
                <div style={{flex:1,minHeight:0,overflow:'auto'}}>
                  {!hasItems&&(
                    <div style={{padding:'32px 16px',textAlign:'center',color:C.txM,fontSize:13,lineHeight:1.6}}>
                      이 날의 일정이 없습니다
                    </div>
                  )}
                  {selScheds.map(s=>{
                    const {c,bg,label}=scheduleSourceInfo(s,gcalMeta);
                    const chkRaw=Array.isArray(s.chk)?s.chk:[];
                    const chkEntries=chkRaw
                      .map((item,idx)=>({item,idx}))
                      .filter(({item})=>item&&String(item.t||'').trim());
                    const chkDone=chkEntries.filter(({item})=>item.d).length;
                    const chkOpen=expandedChkIds.has(s.id);
                    const memoText=String(s.memo||'').trim();
                    const canEditChk=canWriteRecord(s,user?.id,companyRole,memberPermissions,'schedules');
                    const chkBusy=chkBusyId===s.id;
                    return(
                    <div key={s.id} onClick={()=>onOpen('sd',s)} style={{padding:'12px 16px',borderBottom:`1px solid ${C.bdr}`,display:'flex',gap:10,alignItems:'flex-start',cursor:'pointer',background:'transparent'}}
                      onMouseEnter={e=>e.currentTarget.style.background=bg}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:4,alignSelf:'stretch',minHeight:40,borderRadius:2,background:c,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap',minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:c,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0,flex:'1 1 auto'}} title={s.title}>{s.title}</div>
                          <div style={{fontSize:11,color:C.txM,lineHeight:1.35,flexShrink:0,whiteSpace:'nowrap'}}>
                            {fmtSchedulePeriodDot(s)}{s.time?` ${s.time}`:''}
                            {' · '}<span style={{color:c,fontWeight:600}}>{label}</span>
                          </div>
                        </div>
                        {memoText&&(
                          <div
                            onClick={e=>e.stopPropagation()}
                            style={{marginTop:6,fontSize:12,color:C.txS,lineHeight:1.5,whiteSpace:'pre-wrap',wordBreak:'break-word',maxHeight:'4.5em',overflowY:'auto',paddingRight:2}}
                            title={memoText}
                          >
                            {memoText}
                          </div>
                        )}
                        {chkEntries.length>0&&(
                          <div style={{marginTop:8}} onClick={e=>e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e)=>toggleChkExpand(s.id,e)}
                              style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 8px',borderRadius:6,border:`1px solid ${C.bdr}`,background:C.surf2,cursor:'pointer',fontSize:11,fontWeight:600,color:C.txM,fontFamily:'inherit'}}
                            >
                              <span style={{fontSize:10,lineHeight:1,transform:chkOpen?'rotate(90deg)':'none',transition:'transform .12s',display:'inline-block'}}>▶</span>
                              체크리스트 {chkDone}/{chkEntries.length}
                              <span style={{fontWeight:500,color:C.txP}}>{chkOpen?'접기':'펼치기'}</span>
                            </button>
                            {chkOpen&&(
                              <div style={{marginTop:6,padding:'8px 10px',background:C.surf2,borderRadius:8,border:`1px solid ${C.bdr}`,display:'flex',flexDirection:'column',gap:5,maxHeight:140,overflowY:'auto'}}>
                                {chkEntries.map(({item,idx})=>(
                                  <div key={idx} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,lineHeight:1.4,color:item.d?C.txP:C.txS}}>
                                    <button
                                      type="button"
                                      disabled={!canEditChk||chkBusy}
                                      title={!canEditChk?PERMISSION_DENIED_TOOLTIP:(item.d?'완료 해제':'완료 처리')}
                                      onClick={(e)=>toggleSidebarChkItem(s,idx,e)}
                                      style={{flexShrink:0,width:18,height:18,marginTop:1,borderRadius:'50%',border:`1.5px solid ${item.d?C.ok:C.bdr}`,background:item.d?C.ok:'#fff',color:'#fff',cursor:!canEditChk||chkBusy?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0,fontSize:10,lineHeight:1,fontFamily:'inherit',opacity:chkBusy?0.6:1}}
                                    >
                                      {item.d?'✓':''}
                                    </button>
                                    <span
                                      onClick={canEditChk&&!chkBusy?(e)=>toggleSidebarChkItem(s,idx,e):undefined}
                                      style={{flex:1,minWidth:0,textDecoration:item.d?'line-through':'none',wordBreak:'break-word',cursor:canEditChk&&!chkBusy?'pointer':'default'}}
                                    >
                                      {item.t}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </>
            ):(
              <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 16px',textAlign:'center',color:C.txM,fontSize:13,lineHeight:1.6}}>
                달력에서 날짜를 선택하면<br/>일정이 표시됩니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
const BACKUP_LAST_INFO_KEY='landnote.lastBackup';
const loadLastBackupInfo=()=>{
  try{
    const raw=localStorage.getItem(BACKUP_LAST_INFO_KEY);
    return raw?JSON.parse(raw):null;
  }catch{
    return null;
  }
};
const saveLastBackupInfo=(info)=>{
  try{ localStorage.setItem(BACKUP_LAST_INFO_KEY,JSON.stringify(info)); }catch{ /* ignore */ }
};
const pad2=(n)=>String(n).padStart(2,'0');
const backupFileTimestamp=(d)=>`${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
const backupDisplayDate=(iso)=>{
  const d=new Date(iso);
  return `${d.getFullYear()}.${pad2(d.getMonth()+1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const backupFileSize=(bytes)=>{
  if(bytes<1024) return `${bytes} B`;
  const kb=bytes/1024;
  if(kb<1024) return `${kb.toFixed(1)} KB`;
  return `${(kb/1024).toFixed(1)} MB`;
};

const Backup=()=>{
  const { user, company }=useAuth();
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const [alertMsg,setAlertMsg]=useState('');
  const [lastBackup,setLastBackup]=useState(loadLastBackupInfo);
  const [localCounts,setLocalCounts]=useState(null);
  const fileInputRef=useRef(null);

  useEffect(()=>{
    let cancelled=false;
    getLocalTableCounts().then((c)=>{ if(!cancelled) setLocalCounts(c); }).catch(()=>{});
    return ()=>{ cancelled=true; };
  },[busy]);

  const handleExport=async()=>{
    if(busy) return;
    setBusy(true);
    try{
      const backup=await exportBackupData();
      const json=JSON.stringify(backup);
      const blob=new Blob([json],{type:'application/json'});
      const filename=`landnote_backup_${backupFileTimestamp(new Date())}.rmxbak`;
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=filename;
      a.click();
      URL.revokeObjectURL(url);
      const info={at:new Date().toISOString(),filename,size:blob.size,counts:backup.counts};
      saveLastBackupInfo(info);
      setLastBackup(info);
      setLocalCounts(backup.counts);
      setAlertMsg(`내보내기가 완료되었습니다.\n${formatBackupCountsLabel(backup.counts)}`);
    }catch(err){
      console.error('[backup export]',err);
      setAlertMsg('데이터 내보내기에 실패했습니다.');
    }finally{
      setBusy(false);
    }
  };

  const handleFileSelected=(e)=>{
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file) return;
    setBusy(true);
    const reader=new FileReader();
    reader.onload=()=>{
      let parsed;
      try{
        parsed=JSON.parse(String(reader.result||''));
      }catch{
        setBusy(false);
        setAlertMsg('올바른 백업 파일이 아닙니다.');
        return;
      }
      if(!parsed||parsed.format!=='rmxbak'||!parsed.tables){
        setBusy(false);
        setAlertMsg('올바른 백업 파일이 아닙니다.');
        return;
      }
      const counts=getBackupTableCounts(parsed);
      const total=(counts.properties||0)+(counts.customers||0)+(counts.call_logs||0)+(counts.schedules||0)+(counts.rentals||0);
      if(total===0){
        setBusy(false);
        setAlertMsg('백업 파일에 복원할 데이터가 없습니다.');
        return;
      }
      setBusy(false);
      setConfirm({
        msg:'데이터를 가져오시겠습니까?',
        subMsg:`기존 데이터는 유지하고, 백업에만 있는 항목을 추가합니다.\n이미 있는 동일 데이터(매물·고객·통화·일정·임대차)는 건너뜁니다.\n\n파일 항목: ${formatBackupCountsLabel(counts)}`,
        label:'가져오기',
        danger:false,
        onConfirm:async()=>{
          setConfirm(null);
          setBusy(true);
          try{
            const restored=await restoreBackupData(parsed,{
              ownerId:user?.id||undefined,
              companyId:company?.id??null,
              markLocalWins:true,
            });
            // 복원 직후 클라우드에 올려 로그아웃·재로그인 후에도 유지
            let pushNote='';
            if(user?.id&&user.id!=='dev-local'&&isSupabaseConfigured){
              try{
                const pushResult=await pushRestoredLocalData(user.id);
                if(pushResult.failed>0){
                  pushNote=`\n(클라우드 동기화 ${pushResult.failed}건 실패 —「클라우드 동기화」버튼으로 다시 시도해 주세요)`;
                }else{
                  // 즉시 push 성공 시 플래그 소비해 재로그인 pull과 충돌 방지
                  const { consumeRestoreLocalWinsFlag }=await import('./db.js');
                  consumeRestoreLocalWinsFlag();
                  pushNote='\n클라우드에 동기화되었습니다.';
                }
              }catch(pushErr){
                console.error('[backup restore push]',pushErr);
                pushNote='\n(클라우드 동기화 실패 —「클라우드 동기화」버튼으로 다시 시도해 주세요)';
              }
            }
            setAlertMsg(`가져오기가 완료되었습니다. 페이지를 새로고침합니다.\n${formatRestoreMergeLabel(restored)}${pushNote}`);
            setTimeout(()=>{ window.location.reload(); },800);
          }catch(err){
            console.error('[backup restore]',err);
            setBusy(false);
            setAlertMsg('데이터 가져오기에 실패했습니다. 올바른 백업 파일인지 확인해주세요.');
          }
        },
      });
    };
    reader.onerror=()=>{
      setBusy(false);
      setAlertMsg('파일을 읽을 수 없습니다.');
    };
    reader.readAsText(file);
  };

  const items=[
    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
      title:'데이터 내보내기',desc:'매물·고객·통화이력·일정·임대차 데이터를 .rmxbak 파일로 저장합니다. 소프트 삭제(휴지통) 항목도 포함됩니다.',btn:busy?'내보내는 중…':'내보내기',role:'backup-primary',ic:'ti-upload',on:handleExport,disabled:busy},
    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.96"/></svg>,
      title:'데이터 가져오기',desc:'백업 파일의 매물·고객·통화이력·일정·임대차를 기존 데이터에 병합합니다. 동일한 항목은 중복 추가하지 않으며, 새로 추가된 항목만 클라우드에 동기화합니다.',btn:busy?'파일 확인 중…':'파일 선택',role:'backup-danger',ic:'ti-upload',on:()=>fileInputRef.current?.click(),disabled:busy},
  ];

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      <input ref={fileInputRef} type="file" accept=".rmxbak,application/json" style={{display:'none'}} onChange={handleFileSelected}/>
      {confirm&&<ConfirmDialog msg={confirm.msg} subMsg={confirm.subMsg} confirmLabel={confirm.label} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
      {alertMsg&&<AlertDialog msg={alertMsg} onClose={()=>setAlertMsg('')}/>}
      <PH title="백업 · 복원" sub="파일로 데이터를 내보내고 가져옵니다"/>
      <div style={{flex:1,overflow:'auto',padding:'24px 28px'}}>
        <div style={{maxWidth:760,display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:C.warnBg,border:`1px solid ${C.warnBd}`,borderRadius:10,padding:'14px 18px',display:'flex',gap:12}}>
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,flexShrink:0,color:C.warn,marginTop:1}} aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            <div style={{fontSize:14,color:'#854F0B',lineHeight:1.6}}>IndexedDB는 브라우저 데이터입니다. 브라우저 캐시 삭제 시 모든 데이터가 손실될 수 있습니다. <strong>정기적인 백업을 권장합니다.</strong> 클라우드 동기화는 <strong>대시보드 상단</strong>의「동기화」버튼을 사용하세요.</div>
          </div>
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'16px 20px'}}>
            <div style={{fontSize:12,fontWeight:600,color:C.txM,marginBottom:8,textTransform:'uppercase',letterSpacing:'.04em'}}>현재 로컬 데이터</div>
            <div style={{fontSize:14,color:C.txS}}>
              {localCounts?formatBackupCountsLabel(localCounts):'집계 중…'}
            </div>
          </div>
          {items.map((item,i)=>(
            <div key={i} style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'22px 24px',display:'flex',gap:18,boxShadow:'0 1px 4px rgba(0,0,0,.04)'}}>
              <div style={{width:48,height:48,background:C.surf2,border:`1px solid ${C.bdr}`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:C.txM}}>
                {React.cloneElement(item.icon,{width:24,height:24})}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:600,color:C.tx,marginBottom:6}}>{item.title}</div>
                <div style={{fontSize:13,color:C.txM,lineHeight:1.7,marginBottom:14}}>{item.desc}</div>
                <Btn role={item.role} ch={item.btn} ic={item.ic} on={item.on} disabled={item.disabled}/>
              </div>
            </div>
          ))}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'16px 20px'}}>
            <div style={{fontSize:12,fontWeight:600,color:C.txM,marginBottom:6,textTransform:'uppercase',letterSpacing:'.04em'}}>마지막 백업</div>
            <div style={{fontSize:14,color:C.txS}}>
              {lastBackup
                ?`${backupDisplayDate(lastBackup.at)}  ·  ${lastBackup.filename}  ·  ${backupFileSize(lastBackup.size)}${lastBackup.counts?`  ·  ${formatBackupCountsLabel(lastBackup.counts)}`:''}`
                :'백업 이력이 없습니다'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══ TRASH ═══ */
/* ═══ CONFIRM DIALOG ═══ */
const ConfirmDialog=({msg,subMsg,confirmLabel='확인',onConfirm,onCancel,danger})=>(
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
    onClick={onCancel}>
    <div style={{background:'#fff',borderRadius:14,padding:'28px 32px',maxWidth:420,width:'90%',boxShadow:'0 16px 48px rgba(0,0,0,.2)',textAlign:'center'}}
      onClick={e=>e.stopPropagation()}>
      <div style={{width:52,height:52,borderRadius:'50%',background:danger?C.errBg:C.warnBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',color:danger?C.err:C.warn}}>
        {danger
          ?<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          :<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        }
      </div>
      <div style={{fontSize:16,fontWeight:700,color:C.tx,marginBottom:8,whiteSpace:'pre-line'}}>{msg}</div>
      {subMsg&&<div style={{fontSize:13,color:C.txM,lineHeight:1.6,marginBottom:18,whiteSpace:'pre-line'}}>{subMsg}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:20}}>
        <Btn role="dialog-cancel" ch="취소" on={onCancel}/>
        <Btn role={danger?'dialog-danger':'dialog-confirm'} ch={confirmLabel} on={onConfirm}/>
      </div>
    </div>
  </div>
);
const AlertDialog=({msg,onClose})=>(
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
    onClick={onClose}>
    <div style={{background:'#fff',borderRadius:14,padding:'28px 32px',maxWidth:360,width:'90%',boxShadow:'0 16px 48px rgba(0,0,0,.2)',textAlign:'center'}}
      onClick={e=>e.stopPropagation()}>
      <div style={{width:52,height:52,borderRadius:'50%',background:C.warnBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',color:C.warn}}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div style={{fontSize:16,fontWeight:700,color:C.tx,marginBottom:8,whiteSpace:'pre-line'}}>{msg}</div>
    </div>
  </div>
);

const Trash=()=>{
  const deletedProps=useOwnerDeletedProperties();
  const deletedCusts=useOwnerDeletedCustomers();
  const deletedScheds=useOwnerDeletedSchedules();
  const deletedCalls=useOwnerDeletedCallLogs();
  const [tab,setTab]=useState('props');
  const [confirm,setConfirm]=useState(null); // {msg,subMsg,label,danger,onConfirm}
  const [checked,setChecked]=useState({});
  const tabs=[{id:'props',l:'매물',count:deletedProps.length},{id:'custs',l:'고객',count:deletedCusts.length},{id:'scheds',l:'일정',count:deletedScheds.length},{id:'calls',l:'통화이력',count:deletedCalls.length}];
  const tabItems=useMemo(()=>{
    if(tab==='props') return deletedProps;
    if(tab==='custs') return deletedCusts;
    if(tab==='scheds') return deletedScheds;
    return deletedCalls;
  },[tab,deletedProps,deletedCusts,deletedScheds,deletedCalls]);
  useEffect(()=>{ setChecked({}); },[tab]);
  const toggleCheck=(id)=>setChecked((c)=>({...c,[id]:!c[id]}));
  const checkedIds=Object.keys(checked).filter((id)=>checked[id]).map(Number);
  const selectableIds=useMemo(()=>tabItems.map((x)=>x.id),[tabItems]);
  const allSelected=selectableIds.length>0&&selectableIds.every((id)=>checked[id]);
  const someSelected=selectableIds.some((id)=>checked[id]);
  const toggleSelectAll=()=>{
    if(allSelected){
      setChecked((c)=>{
        const next={...c};
        selectableIds.forEach((id)=>{ delete next[id]; });
        return next;
      });
    }else{
      setChecked((c)=>{
        const next={...c};
        selectableIds.forEach((id)=>{ next[id]=true; });
        return next;
      });
    }
  };
  const handleRestore=async(type,id)=>{
    if(type==='props') await restoreProperty(id);
    else if(type==='custs') await restoreCustomer(id);
    else if(type==='scheds') await restoreSchedule(id);
    else if(type==='calls') await restoreCallLog(id);
  };
  const handleHardDelete=(type,id)=>{
    if(type==='props') hardDeleteProperty(id);
    else if(type==='custs') hardDeleteCustomer(id);
    else if(type==='scheds') hardDeleteSchedule(id);
    else if(type==='calls') hardDeleteCallLog(id);
  };
  const requestBulkRestore=()=>{
    const ids=checkedIds;
    if(!ids.length) return;
    const tabLabel=tabs.find((t)=>t.id===tab)?.l||'항목';
    askConfirm(
      `${ids.length}건을 복구하시겠습니까?`,
      `선택한 ${tabLabel} ${ids.length}건이 목록으로 복구됩니다.`,
      '복구',
      false,
      async()=>{
        await Promise.all(ids.map((id)=>handleRestore(tab,id)));
        setChecked({});
      },
    );
  };
  const emptyCurrentTrashTab=async()=>{
    if(tab==='props'){
      await Promise.all(deletedProps.map((p)=>hardDeleteProperty(p.id)));
    }else if(tab==='custs'){
      await Promise.all(deletedCusts.map((c)=>hardDeleteCustomer(c.id)));
    }else if(tab==='scheds'){
      await Promise.all(deletedScheds.map((s)=>hardDeleteSchedule(s.id)));
    }else if(tab==='calls'){
      await Promise.all(deletedCalls.map((c)=>hardDeleteCallLog(c.id)));
    }
    setChecked({});
  };
  const C_PRI={URGENT:'#DC2626',IMPORTANT:'#D97706',NORMAL:'#2563EB'};
  const PRI_L={URGENT:'긴급',IMPORTANT:'중요',NORMAL:'보통'};
  const askConfirm=(msg,subMsg,label,danger,fn)=>setConfirm({msg,subMsg,label,danger,onConfirm:()=>{fn();setConfirm(null);}});

  const TrashCheckHead=()=>(
    <th style={{width:32,textAlign:'center',cursor:'pointer'}} title={allSelected?'전체 선택 해제':'전체 선택'} onClick={(e)=>{e.stopPropagation();toggleSelectAll();}}>
      <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${allSelected||someSelected?C.brand:C.bdrSt}`,background:allSelected?C.brand:someSelected?C.brandL:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
        {allSelected&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        {!allSelected&&someSelected&&<span style={{width:8,height:2,background:C.brand,borderRadius:1,display:'block'}}/>}
      </div>
    </th>
  );
  const TrashCheckCell=({id})=>(
    <td onClick={(e)=>{e.stopPropagation();toggleCheck(id);}} style={{textAlign:'center',cursor:'pointer',width:32}}>
      <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${checked[id]?C.brand:C.bdrSt}`,background:checked[id]?C.brand:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
        {checked[id]&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
    </td>
  );
  const TrashBulkBar=()=>checkedIds.length>0?(
    <div style={{position:'sticky',bottom:0,marginTop:12,background:'#1A2332',borderRadius:10,padding:'10px 18px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 4px 16px rgba(0,0,0,.2)'}}>
      <span style={{fontSize:13,color:'#fff',fontWeight:500}}>{checkedIds.length}건 선택됨</span>
      <Btn role="toolbar-primary" ch="선택 복구" ic="ti-rotate" on={requestBulkRestore} sx={{background:C.brand,borderColor:C.brand,color:'#fff'}}/>
      <Btn role="toolbar-secondary" ch="선택 해제" on={()=>setChecked({})} sx={{background:'rgba(255,255,255,.1)',borderColor:'rgba(255,255,255,.2)',color:'#fff'}}/>
    </div>
  ):null;

  const ActionBtns=({label,onRestore,onDelete})=>(
    <div style={{display:'flex',gap:6}}>
      <Btn role="row-restore" ch="복구" ic="ti-rotate" on={()=>askConfirm('복구하시겠습니까?',`"${label}"을(를) 복구합니다`,'복구',false,onRestore||function(){})}/>
      <Btn role="row-delete" ch="영구삭제" on={()=>askConfirm('영구삭제하시겠습니까?','이 작업은 되돌릴 수 없습니다','영구삭제',true,onDelete||function(){})}/>
    </div>
  );
  const TrashEmpty=()=>(
    <div style={{background:C.surf,borderRadius:10,padding:'48px 24px',textAlign:'center',color:C.txM,fontSize:14,boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
      삭제된 항목이 없습니다
    </div>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      {confirm&&<ConfirmDialog msg={confirm.msg} subMsg={confirm.subMsg} confirmLabel={confirm.label} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
      <PH title="휴지통" sub="삭제된 항목을 복구하거나 영구삭제합니다. 영구삭제는 복구할 수 없습니다."/>
      <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:'0 28px',display:'flex',gap:0,alignItems:'flex-end',justifyContent:'space-between'}}>
        <div style={{display:'flex'}}>
          {tabs.map(t=>(
            <div key={t.id} onClick={()=>setTab(t.id)} style={{padding:'12px 20px',cursor:'pointer',fontSize:13,fontWeight:tab===t.id?600:400,color:tab===t.id?C.brand:C.txM,borderBottom:tab===t.id?`2px solid ${C.brand}`:'2px solid transparent',marginBottom:-1,display:'flex',alignItems:'center',gap:6}}>
              {t.l}
              <span style={{fontSize:12,background:t.count>0?C.errBg:C.surf3,color:t.count>0?C.err:C.txP,padding:'1px 7px',borderRadius:20,fontWeight:600}}>{t.count}</span>
            </div>
          ))}
        </div>
        <div style={{padding:'8px 0'}}>
          <Btn role="toolbar-danger" ch="전체 비우기" on={()=>askConfirm('전체 영구삭제','휴지통의 모든 항목을 영구삭제합니다. 복구할 수 없습니다.','모두 삭제',true,emptyCurrentTrashTab)}/>
        </div>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 28px'}}>
        {tab==='props'&&(deletedProps.length===0?<TrashEmpty/>:(
          <>
          <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            <table className="tbl">
              <thead><tr><TrashCheckHead/><th>종류</th><th>주소</th><th>상태</th><th>삭제일시</th><th style={{width:180}}>작업</th></tr></thead>
              <tbody>
                {deletedProps.map(p=>(
                  <tr key={p.id}>
                    <TrashCheckCell id={p.id}/>
                    <td style={{whiteSpace:'nowrap'}}><Bdg label={p.tag} type="gray"/></td>
                    <td style={{fontWeight:500}}>{propDisplayAddr(p)}</td>
                    <td><span style={{fontSize:12,color:C.txM}}>{p.status}</span></td>
                    <td style={{color:C.txM,fontSize:13}}>{p.deletedAt}</td>
                    <td><ActionBtns label={propDisplayAddr(p)} onRestore={()=>handleRestore('props',p.id)} onDelete={()=>handleHardDelete('props',p.id)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TrashBulkBar/>
          </>
        ))}
        {tab==='custs'&&(deletedCusts.length===0?<TrashEmpty/>:(
          <>
          <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            <table className="tbl">
              <thead><tr><TrashCheckHead/><th>이름</th><th>연락처</th><th>유형</th><th>삭제일시</th><th style={{width:180}}>작업</th></tr></thead>
              <tbody>
                {deletedCusts.map(c=>(
                  <tr key={c.id}>
                    <TrashCheckCell id={c.id}/>
                    <td style={{fontWeight:600}}>{c.name}</td>
                    <td style={{color:C.txS}}>{formatPhone(c.phone)||'—'}</td>
                    <td><Bdg label={customerTypeLabelOf(c)} type="info"/></td>
                    <td style={{color:C.txM,fontSize:13}}>{c.deletedAt}</td>
                    <td><ActionBtns label={c.name} onRestore={()=>handleRestore('custs',c.id)} onDelete={()=>handleHardDelete('custs',c.id)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TrashBulkBar/>
          </>
        ))}
        {tab==='scheds'&&(deletedScheds.length===0?<TrashEmpty/>:(
          <>
          <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            <table className="tbl">
              <thead><tr><TrashCheckHead/><th>일정 제목</th><th>날짜</th><th>우선순위</th><th>삭제일시</th><th style={{width:180}}>작업</th></tr></thead>
              <tbody>
                {deletedScheds.map(s=>(
                  <tr key={s.id}>
                    <TrashCheckCell id={s.id}/>
                    <td style={{fontWeight:500}}>{s.title}</td>
                    <td style={{color:C.txS}}>{fmtSchedulePeriodDot(s)}</td>
                    <td><span style={{fontSize:12,fontWeight:600,color:C_PRI[s.pri]}}>{PRI_L[s.pri]}</span></td>
                    <td style={{color:C.txM,fontSize:13}}>{s.deletedAt}</td>
                    <td><ActionBtns label={s.title} onRestore={()=>handleRestore('scheds',s.id)} onDelete={()=>handleHardDelete('scheds',s.id)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TrashBulkBar/>
          </>
        ))}
        {tab==='calls'&&(deletedCalls.length===0?<TrashEmpty/>:(
          <>
          <div style={{background:C.surf,borderRadius:10,padding:'10px 14px',marginBottom:8,display:'flex',alignItems:'center',gap:10,boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${allSelected||someSelected?C.brand:C.bdrSt}`,background:allSelected?C.brand:someSelected?C.brandL:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}
              title={allSelected?'전체 선택 해제':'전체 선택'} onClick={toggleSelectAll}>
              {allSelected&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              {!allSelected&&someSelected&&<span style={{width:8,height:2,background:C.brand,borderRadius:1,display:'block'}}/>}
            </div>
            <span style={{fontSize:13,color:C.txM}}>전체 선택 / 해제</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {deletedCalls.map(c=>(
              <div key={c.id} style={{background:C.surf,borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.04)',display:'flex',alignItems:'center',gap:14}}>
                <div onClick={()=>toggleCheck(c.id)} style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${checked[c.id]?C.brand:C.bdrSt}`,background:checked[c.id]?C.brand:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                  {checked[c.id]&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.tx,marginBottom:4,whiteSpace:'pre-wrap',maxHeight:72,overflowY:'auto'}}>{c.content}</div>
                  <div style={{fontSize:12,color:C.txM}}>{c.date} · 삭제일시: {c.deletedAt}</div>
                </div>
                <ActionBtns label={c.content.slice(0,15)} onRestore={()=>handleRestore('calls',c.id)} onDelete={()=>handleHardDelete('calls',c.id)}/>
              </div>
            ))}
          </div>
          <TrashBulkBar/>
          </>
        ))}
      </div>
    </div>
  );
};
/* ═══ SETTINGS OVERLAY ═══ */
const Settings=({onClose})=>{
  const navigate=useNavigate();
  const { user, profile, accountDefaults, updateProfile, updatePassword, verifyCurrentPassword, company, companyRole, profileLoading, isConfigured, isDevBypass, refreshProfile }=useAuth();
  const displayRole=companyRole??(profile?.role?normalizeCompanyRole(profile.role):null);
  const workspaceId=company?.id??profile?.company_id??null;
  const canAccessTeamManage=(isConfigured||isDevBypass)&&workspaceId&&isBusinessRole(displayRole)&&isCeoRole(displayRole);
  const [form,setForm]=useState(null);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState(null);
  const [currentPw,setCurrentPw]=useState('');
  const [currentPwReady,setCurrentPwReady]=useState(false);
  const [currentPwError,setCurrentPwError]=useState('');
  const [pwModal,setPwModal]=useState(null); // { currentPassword } when open
  const [pwForm,setPwForm]=useState({ next:'', confirm:'' });
  const [pwBusy,setPwBusy]=useState(false);
  const [storagePath,setStoragePath]=useState(()=>loadStoragePathLabel());
  const [pickingFolder,setPickingFolder]=useState(false);
  const [bizModalOpen,setBizModalOpen]=useState(false);
  const [bizCompanyName,setBizCompanyName]=useState('');
  const [bizBusy,setBizBusy]=useState(false);
  const [bizError,setBizError]=useState('');

  useEffect(()=>{
    setStoragePath(loadStoragePathLabel());
  },[user?.id]);

  useEffect(()=>{
    setForm({
      displayName:accountDefaults.displayName,
      title:accountDefaults.title,
      phone:accountDefaults.phone,
      tel:accountDefaults.tel,
      email:accountDefaults.email,
      agencyName:accountDefaults.agencyName,
      agencyPhone:accountDefaults.agencyPhone,
      address:accountDefaults.address,
      website:accountDefaults.website,
    });
  },[accountDefaults]);

  const isGoogleUser=user?.app_metadata?.provider==='google'
    ||user?.identities?.some?.(i=>i.provider==='google');

  const showToast=(msg)=>{ setToast(msg); setTimeout(()=>setToast(null),2200); };

  const openBizUpgradeModal=()=>{
    setBizCompanyName(String(form?.agencyName||company?.name||'').trim());
    setBizError('');
    setBizModalOpen(true);
  };

  const closeBizUpgradeModal=()=>{
    if(bizBusy) return;
    setBizModalOpen(false);
    setBizError('');
  };

  const submitBizUpgrade=async()=>{
    const name=String(bizCompanyName||'').trim();
    if(!name){
      setBizError('회사명을 입력해 주세요.');
      return;
    }
    if(!isConfigured){
      showToast('클라우드 연동 후에 전환할 수 있습니다.');
      return;
    }
    setBizBusy(true);
    setBizError('');
    try{
      await upgradeSoloToBusiness(name);
      await refreshProfile();
      setBizModalOpen(false);
      onClose();
      navigate('/team/manage', { state: { toast: '회사형으로 전환되었습니다. 직원을 초대해 보세요.' } });
    }catch(err){
      setBizError(err?.message||'회사형 전환에 실패했습니다.');
    }finally{
      setBizBusy(false);
    }
  };

  const saveProfile=async()=>{
    if(!form) return { error: new Error('폼을 불러오는 중입니다') };
    let website=String(form.website||'').trim()||null;
    if(website&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(website)){
      website=null;
    }
    const { error }=await updateProfile({
      display_name:form.displayName||null,
      title:form.title||null,
      phone:normalizePhone(form.phone)||null,
      tel:normalizePhone(form.tel)||null,
      agency_name:form.agencyName||null,
      agency_phone:normalizePhone(form.agencyPhone)||null,
      address:form.address||null,
      website,
    });
    return { error, websiteDropped: website===null&&!!String(form.website||'').trim() };
  };

  const saveAll=async()=>{
    if(!form||saving||pwBusy) return;
    setSaving(true);
    const { error: profileError, websiteDropped }=await saveProfile();
    if(profileError){
      setSaving(false);
      showToast(profileError.message||'저장 실패');
      return;
    }
    if(websiteDropped){
      setForm(f=>({...f,website:''}));
      showToast('홈페이지에 이메일 형식은 저장하지 않습니다. 브라우저 자동완성을 확인해 주세요.');
    }
    saveStoragePathLabel(storagePath.trim());
    setSaving(false);
    onClose();
  };

  const openPasswordChangeModal=async()=>{
    if(pwBusy||isGoogleUser) return;
    setCurrentPwError('');
    if(!String(currentPw||'').trim()){
      setCurrentPwError('현재 비밀번호를 입력해 주세요.');
      return;
    }
    setPwBusy(true);
    try{
      const { error }=await verifyCurrentPassword(currentPw);
      if(error){
        setCurrentPwError(error.message||'현재 비밀번호가 일치하지 않습니다.');
        return;
      }
      setPwForm({ next:'', confirm:'' });
      setPwModal({ currentPassword: currentPw });
    }catch(err){
      setCurrentPwError(err?.message||'현재 비밀번호가 일치하지 않습니다.');
    }finally{
      setPwBusy(false);
    }
  };

  const closePasswordModal=()=>{
    if(pwBusy) return;
    setPwModal(null);
    setPwForm({ next:'', confirm:'' });
  };

  const submitNewPassword=async()=>{
    if(!pwModal||pwBusy) return;
    const pwHint=validatePassword(pwForm.next,{ forSignup:true });
    if(pwHint){
      showToast(pwHint);
      return;
    }
    if(pwForm.next!==pwForm.confirm){
      showToast('새 비밀번호가 일치하지 않습니다');
      return;
    }
    setPwBusy(true);
    try{
      const { error }=await updatePassword(pwForm.next,{ currentPassword:pwModal.currentPassword });
      if(error){
        showToast(error.message||'비밀번호 변경 실패');
        return;
      }
      setPwModal(null);
      setPwForm({ next:'', confirm:'' });
      setCurrentPw('');
      setCurrentPwReady(false);
      setCurrentPwError('');
      showToast('비밀번호가 변경되었습니다');
    }catch(err){
      showToast(err?.message||'비밀번호 변경 실패');
    }finally{
      setPwBusy(false);
    }
  };

  const selectStorageFolder=async()=>{
    if(pickingFolder) return;
    setPickingFolder(true);
    try{
      const { label, cancelled, error }=await pickStorageFolder();
      if(error){ showToast(error.message||'폴더 선택에 실패했습니다'); return; }
      if(!cancelled&&label){
        setStoragePath(label);
        showToast(`폴더 선택: ${label}`);
      }
    }catch(err){
      if(err?.name==='AbortError') return;
      showToast(err?.message||'폴더 선택에 실패했습니다');
    }finally{
      setPickingFolder(false);
    }
  };

  if(!form) return null;

  const profileFields=[
    ['displayName','담당자 이름'],
    ['title','직함'],
    ['phone','휴대폰'],
    ['tel','직통전화'],
  ];
  const agencyFields=[
    ['agencyName','업체명'],
    ['agencyPhone','대표전화'],
    ['address','업체주소'],
    ['website','홈페이지'],
  ];
  const phoneFieldKeys=new Set(['phone','tel','agencyPhone']);

  return(
  <>
  <Win title="내 정보 · 설정" ic="ti-settings" onClose={onClose} w={720}
    ch={<>
      <div style={{...WIN_BODY_SCROLL,padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
          <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>계정 유형</div>
          <div style={{padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:C.tx}}>
                {profileLoading?'확인 중…':companyRoleLabel(displayRole)||'알 수 없음'}
              </div>
              <div style={{fontSize:12,color:C.txM,marginTop:4,lineHeight:1.55}}>
                {isConfigured&&profileLoading&&'계정 정보를 불러오는 중입니다.'}
                {!profileLoading&&!isConfigured&&!isDevBypass&&'Supabase 연결 후 팀 기능을 사용할 수 있습니다.'}
                {!profileLoading&&isConfigured&&isSoloRole(displayRole)&&'개인 계정 — 멤버 관리·팀 공유 메뉴가 표시되지 않습니다.'}
                {!profileLoading&&isConfigured&&displayRole&&isBusinessRole(displayRole)&&!isCeoRole(displayRole)&&'직원 계정 — 대표가 허용한 매물·일정·통화를 볼 수 있습니다. 로그인 시 자동 동기화되며, 추가 반영이 필요하면 대시보드「동기화」를 눌러 주세요.'}
                {!profileLoading&&canAccessTeamManage&&'대표 계정 — 아래 「멤버 관리」 또는 사이드바 하단 메뉴에서 직원 권한을 설정하세요.'}
                {!profileLoading&&isDevBypass&&isCeoRole(displayRole)&&'로컬 개발 모드 — 멤버 관리 UI를 미리 볼 수 있습니다.'}
                {!profileLoading&&isConfigured&&user?.id&&profile?.company_id&&!displayRole&&'역할 정보를 불러오지 못했습니다. 로그아웃 후 다시 로그인해 주세요.'}
              </div>
            </div>
            {canAccessTeamManage&&(
              <Btn role="settings-primary" ch="멤버 관리 열기" on={()=>{ onClose(); navigate('/team/manage'); }}/>
            )}
          </div>
        </div>
        <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
          <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>내 프로필</div>
          <div style={{padding:'16px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {profileFields.map(([key,label])=>(
              <div key={key}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>{label}</div>
                {phoneFieldKeys.has(key)?(
                  <PhoneInput value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
                ):(
                  <input className="inp" value={form[key]} readOnly={key==='email'} autoComplete={key==='email'?'email':key==='website'?'url':'off'} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
                )}</div>
            ))}
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>이메일</div>
              <input className="inp" value={form.email} readOnly style={{background:C.surf2,color:C.txM,cursor:'default'}}/></div>
          </div>
        </div>
        <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
          <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>업체 정보</div>
          <div style={{padding:'16px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {agencyFields.map(([key,label])=>(
              <div key={key} style={key==='address'?{gridColumn:'1 / -1'}:{}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>{label}</div>
                {phoneFieldKeys.has(key)?(
                  <PhoneInput value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
                ):(
                  <input className="inp" value={form[key]} readOnly={key==='email'} autoComplete={key==='email'?'email':key==='website'?'url':'off'} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
                )}</div>
            ))}
          </div>
        </div>
        {canAccessTeamManage && (
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
            <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>사내 관리</div>
            <div style={{padding:'16px 18px',fontSize:13,color:C.txM,lineHeight:1.6}}>
              직원 초대 · 매물·일정·통화 권한 토글은 <strong style={{color:C.tx}}>멤버 관리</strong> 화면에서 설정합니다.
              사이드바를 펼치면(← 클릭) 하단에 <strong style={{color:C.tx}}>멤버 관리</strong> 메뉴도 있습니다.
            </div>
          </div>
        )}
        {(isConfigured || isDevBypass) && isSoloRole(displayRole) && (
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
            <div style={{padding:'16px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{fontSize:13,color:C.txM,lineHeight:1.6}}>
                직원을 채용해 팀과 매물을 공유하려면 회사형으로 전환하세요.
              </div>
              <Btn role="settings-secondary" ch="회사형으로 전환" on={openBizUpgradeModal}/>
            </div>
          </div>
        )}
        <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
          <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>보안 설정</div>
          <div style={{padding:'16px 18px'}}>
            {isGoogleUser?(
              <div style={{fontSize:13,color:C.txM,lineHeight:1.6}}>Google 계정으로 로그인 중입니다. 비밀번호는 Google에서 관리됩니다.</div>
            ):(
              <>
                <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 220px',minWidth:0}}>
                    <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>현재 비밀번호</div>
                    <input
                      type="password"
                      className="inp"
                      name="landnote-pw-verify"
                      value={currentPw}
                      onChange={e=>{ setCurrentPw(e.target.value); if(currentPwError) setCurrentPwError(''); }}
                      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); openPasswordChangeModal(); } }}
                      placeholder="현재 비밀번호 입력"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      readOnly={!currentPwReady}
                      onFocus={()=>setCurrentPwReady(true)}
                      style={currentPwError?{borderColor:C.err,boxShadow:`0 0 0 3px rgba(220,38,38,.12)`}:undefined}
                    />
                    {currentPwError&&(
                      <div style={{fontSize:12,color:C.err,marginTop:6,lineHeight:1.45,fontWeight:500}}>{currentPwError}</div>
                    )}
                  </div>
                  <Btn
                    role="settings-secondary"
                    ch={pwBusy&&!pwModal?'확인 중…':'비밀번호 변경'}
                    on={openPasswordChangeModal}
                    disabled={pwBusy}
                  />
                </div>
                <div style={{fontSize:12,color:C.txM,marginTop:10,lineHeight:1.5}}>
                  현재 비밀번호가 일치하면 새 비밀번호 설정 창이 열립니다.
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
          <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>파일 저장 위치</div>
          <div style={{padding:'16px 18px',display:'flex',gap:10,alignItems:'center'}}>
            <input className="inp" value={storagePath} onChange={e=>setStoragePath(e.target.value)} placeholder="폴더를 선택하거나 경로를 입력하세요" style={{flex:1}}/>
            <Btn role="settings-secondary" ch={pickingFolder?'선택 중…':'폴더 선택'} ic="ti-folder" on={selectStorageFolder}/>
          </div>
          <div style={{padding:'0 18px 14px',fontSize:12,color:C.txM,lineHeight:1.5}}>
            Chrome·Edge에서는 폴더 선택 창이 열립니다. 브라우저 보안상 전체 경로(C:\…)는 표시되지 않을 수 있으며, 선택한 폴더 이름이 저장됩니다.
          </div>
        </div>
        {isConfigured && (
          <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
            <button
              type="button"
              onClick={() => { onClose(); navigate('/settings/withdraw'); }}
              style={{
                background: 'none', border: 'none', padding: '8px 4px',
                fontSize: 12, color: '#94A3B8', cursor: 'pointer', fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            >
              랜드노트를 더 이상 사용하지 않으시나요?{' '}
              <span
                data-withdraw-link
                style={{
                  color: '#DC2626',
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                }}
              >
                회원탈퇴
              </span>
            </button>
          </div>
        )}
      </div>
      <ActionBar saveLabel={saving?'저장 중…':'저장'} onSave={saveAll}/>
    </>}/>
  {toast&&(
    <div style={{position:'fixed',top:72,left:'50%',transform:'translateX(-50%)',zIndex:600,background:'#1A2332',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:13,boxShadow:'0 4px 16px rgba(0,0,0,.2)'}}>{toast}</div>
  )}
  {pwModal&&(
    <div
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:550,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
      onClick={closePasswordModal}
    >
      <div
        style={{background:'#fff',borderRadius:14,padding:'28px 28px 24px',maxWidth:420,width:'90%',boxShadow:'0 16px 48px rgba(0,0,0,.2)'}}
        onClick={e=>e.stopPropagation()}
      >
        <div style={{fontSize:16,fontWeight:700,color:C.tx,marginBottom:8}}>새 비밀번호 설정</div>
        <div style={{fontSize:13,color:C.txM,lineHeight:1.55,marginBottom:18}}>
          영문·숫자·특수문자 포함 8자 이상으로 설정해 주세요.
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
          <div>
            <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>새 비밀번호</div>
            <input
              type="password"
              className="inp"
              value={pwForm.next}
              onChange={e=>setPwForm(f=>({...f,next:e.target.value}))}
              placeholder="새 비밀번호"
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div>
            <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>비밀번호 확인</div>
            <input
              type="password"
              className="inp"
              value={pwForm.confirm}
              onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))}
              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); submitNewPassword(); } }}
              placeholder="새 비밀번호 다시 입력"
              autoComplete="new-password"
            />
          </div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn role="dialog-cancel" ch="취소" on={closePasswordModal}/>
          <Btn role="dialog-confirm" ch={pwBusy?'변경 중…':'변경하기'} on={submitNewPassword}/>
        </div>
      </div>
    </div>
  )}
  {bizModalOpen&&(
    <div
      role="dialog"
      aria-modal="true"
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:550,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
      onClick={closeBizUpgradeModal}
    >
      <div
        style={{background:'#fff',borderRadius:14,padding:'28px 28px 24px',maxWidth:420,width:'90%',boxShadow:'0 16px 48px rgba(0,0,0,.2)'}}
        onClick={e=>e.stopPropagation()}
      >
        <div style={{fontSize:16,fontWeight:700,color:C.tx,marginBottom:8}}>회사형으로 전환</div>
        <div style={{fontSize:13,color:C.txM,lineHeight:1.55,marginBottom:18}}>
          대표(CEO) 계정으로 전환됩니다. 전환 후 멤버 관리에서 직원을 초대하고 매물·일정을 공유할 수 있습니다. 기존 매물·일정·통화 데이터는 그대로 유지됩니다.
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>회사명</div>
          <input
            className="inp"
            value={bizCompanyName}
            onChange={e=>{ setBizCompanyName(e.target.value); if(bizError) setBizError(''); }}
            onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); submitBizUpgrade(); } }}
            placeholder="예: ○○공인중개사사무소"
            autoFocus
            disabled={bizBusy}
          />
          {bizError&&(
            <div style={{fontSize:12,color:C.err,marginTop:6,lineHeight:1.45,fontWeight:500}}>{bizError}</div>
          )}
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <Btn role="dialog-cancel" ch="취소" on={closeBizUpgradeModal}/>
          <Btn role="dialog-confirm" ch={bizBusy?'전환 중…':'전환 후 멤버 관리'} on={submitBizUpgrade}/>
        </div>
      </div>
    </div>
  )}
  </>
  );};

/* ═══ PROPERTY DETAIL OVERLAY ═══ */
/* ═══ PHOTO VIEWER OVERLAY ═══ */
const PhotoViewer=({photos,startIdx,onClose})=>{
  const [idx,setIdx]=useState(startIdx||0);
  const total=photos.length;
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.92)',zIndex:300,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
      onClick={onClose}>
      <div style={{position:'absolute',top:16,right:16}}>
        <div onClick={onClose} style={{width:36,height:36,borderRadius:8,background:'rgba(255,255,255,.2)',border:'1.5px solid rgba(255,255,255,.4)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',fontSize:17,fontWeight:700,lineHeight:1}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(200,16,46,.85)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.2)';}}>
          ✕
        </div>
      </div>
      <div style={{position:'absolute',top:16,left:'50%',transform:'translateX(-50%)',fontSize:13,color:'rgba(255,255,255,.7)'}}>
        {idx+1} / {total}
      </div>
      <div style={{position:'relative',width:'80%',maxWidth:900,display:'flex',alignItems:'center',justifyContent:'center'}}
        onClick={e=>e.stopPropagation()}>
        {/* Prev */}
        {total>1&&<button onClick={()=>setIdx(i=>(i-1+total)%total)}
          style={{position:'absolute',left:-56,width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',color:'#fff',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.28)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.15)'}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:16,height:16,flexShrink:0}} aria-hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span>
        </button>}
        {/* Image */}
        <div style={{width:'100%',aspectRatio:'16/9',background:'#111',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
          {typeof photos[idx]==='string'&&photos[idx] ? (
            <img src={photos[idx]} alt="" style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>
          ) : (
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:64,height:64,flexShrink:0,color:'#185FA5',opacity:.35}} aria-hidden><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>
          )}
        </div>
        {/* Next */}
        {total>1&&<button onClick={()=>setIdx(i=>(i+1)%total)}
          style={{position:'absolute',right:-56,width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',color:'#fff',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.28)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.15)'}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:16,height:16,flexShrink:0}} aria-hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>}
      </div>
      {/* Dots */}
      {total>1&&<div style={{display:'flex',gap:8,marginTop:20}}>
        {photos.map((_,i)=>(
          <div key={i} onClick={e=>{e.stopPropagation();setIdx(i);}}
            style={{width:i===idx?20:8,height:8,borderRadius:4,background:i===idx?'#fff':'rgba(255,255,255,.35)',cursor:'pointer',transition:'all .2s'}}/>
        ))}
      </div>}
    </div>
  );
};

/* ── PropInfoGrid: 매물상세 전용 2열 정보 그리드 (항목명 열 너비 통일) ── */
const PropInfoGrid=({items})=>{
  const rows=[];
  for(let i=0;i<items.length;){
    if(items[i].full){
      rows.push([items[i]]);
      i+=1;
    }else if(i+1<items.length&&!items[i+1].full){
      rows.push([items[i],items[i+1]]);
      i+=2;
    }else{
      rows.push([items[i]]);
      i+=1;
    }
  }
  const twoCol=`${PROP_DETAIL_LABEL_W}px 1fr ${PROP_DETAIL_LABEL_W}px 1fr`;
  return(
    <div style={{borderBottom:`1px solid ${C.bdr}`}}>
      {rows.map((pair,ri)=>(
        <div
          key={ri}
          style={{
            display:'grid',
            gridTemplateColumns:pair.length===2?twoCol:`${PROP_DETAIL_LABEL_W}px 1fr`,
            borderTop:ri>0?`1px solid ${C.bdr}`:'none',
          }}
        >
          {pair.map((item,ci)=>(
            <React.Fragment key={ci}>
              <span style={propDetailLabelCell}>{item.k}</span>
              <span style={{
                ...propDetailValueCell,
                color:item.c||C.tx,
                fontWeight:item.c?500:400,
                borderRight:pair.length===2&&ci===0?`1px solid ${C.bdr}`:'none',
                ...(item.wrap||typeof item.v!=='string'?{whiteSpace:'normal',alignItems:'flex-start',lineHeight:1.43}:{}),
              }} title={typeof item.v==='string'?item.v:undefined}>{item.v||'—'}</span>
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
};

/** 매각정보 — 1행 전체(매각가액) + 이하 4열 행(좌·우 항목쌍) */
const PropSaleInfoGrid=({rows})=>{
  const twoCol=`${PROP_DETAIL_LABEL_W}px 1fr`;
  const fourCol=`${PROP_DETAIL_LABEL_W}px 1fr ${PROP_DETAIL_LABEL_W}px 1fr`;
  const renderHalf=(item,withRightBorder)=>{
    if(!item) return null;
    return(
      <>
        <span style={propDetailLabelCell}>{item.k}</span>
        <span style={{...propDetailValueCell,color:item.c||C.tx,fontWeight:item.c?600:400,borderRight:withRightBorder?`1px solid ${C.bdr}`:'none'}}>{item.v||'—'}</span>
      </>
    );
  };
  return(
    <div style={{borderBottom:`1px solid ${C.bdr}`}}>
      {rows.map((row,ri)=>{
        const borderTop=ri>0?`1px solid ${C.bdr}`:'none';
        if(row.full){
          return(
            <div key={ri} style={{display:'grid',gridTemplateColumns:twoCol,borderTop}}>
              <span style={propDetailLabelCell}>{row.full.k}</span>
              <span style={{...propDetailValueCell,color:row.full.c||C.tx,fontWeight:row.full.bold?700:(row.full.c?600:500),fontSize:row.full.c?14:undefined}}>{row.full.v||'—'}</span>
            </div>
          );
        }
        return(
          <div key={ri} style={{display:'grid',gridTemplateColumns:fourCol,borderTop}}>
            {renderHalf(row.left,true)}
            {renderHalf(row.right,false)}
          </div>
        );
      })}
    </div>
  );
};

const fmtAreaWithPy=(m2)=>{
  const n=parseFloat(m2);
  if(!Number.isFinite(n)||n<=0) return '—';
  return `${n}㎡ (${py(n)}평)`;
};
const fmtOfficialLandPriceDisplay=(prop)=>{
  if(!prop.officialLandPrice) return '—';
  const price=fmtWon(String(prop.officialLandPrice).replace(/,/g,''),'원/㎡');
  return prop.baseYear?`${price} (${prop.baseYear}년)`:price;
};
const fmtSalePriceEokWon=(priceMan)=>{
  const p=parseFloat(priceMan);
  if(!Number.isFinite(p)||p<=0) return '—';
  return formatKoreanAmountFromMan(p);
};

/* 매물 상세 - 지도영역 외부 사이트 연결 (지번주소로 검색결과 연결) */
const EXT_SITES=[
  {key:'K',label:'카카오맵',bg:'#FEE500',fg:'#3C1E1E',url:(addr)=>`https://map.kakao.com/?q=${encodeURIComponent(addr)}`},
  {key:'D',label:'디스코',bg:'#1F2937',fg:'#FFFFFF',handler:'disco'},
  {key:'V',label:'밸류맵',bg:'#2563EB',fg:'#FFFFFF',url:()=>`https://www.valueupmap.com/`},
  {key:'N',label:'네이버 부동산',bg:'#03C75A',fg:'#FFFFFF',url:()=>`https://land.naver.com/`},
];
const ExtSiteBtn=({site,addr,property})=>(
  <button
    type="button"
    title={site.handler==='disco'
      ? ((property?.discoUrl||property?.disco_url) ? `${site.label} 상세 링크로 이동` : `${site.label}에서 "${addr}" 검색`)
      : `${site.label}에서 "${addr}" 검색결과 보기`}
    onClick={()=>{
      if(site.handler==='disco') handleDiscoLink(property);
      else if(typeof site.url==='function') window.open(site.url(addr),'_blank','noopener,noreferrer');
    }}
    style={{width:32,height:32,borderRadius:8,background:site.bg,color:site.fg,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,letterSpacing:'-.02em',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 1px 3px rgba(0,0,0,.12),inset 0 0 0 1px rgba(0,0,0,.04)',transition:'transform .12s,box-shadow .12s',flexShrink:0}}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 8px rgba(0,0,0,.18)';}}
    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,.12),inset 0 0 0 1px rgba(0,0,0,.04)';}}>
    {site.key}
  </button>
);
const defaultCallDateTime=()=>{
  const n=new Date();
  return {
    date:n.toISOString().slice(0,10),
    time:`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`,
  };
};

/** 고객·매물 상세 공통 — 통화 이력 목록 + 기록 추가 폼 (고객 상세 UI 기준) */
/** 통화 이력 — 최신(날짜·시간) 우선, 동시각이면 id 큰 순(신규 등록 상단) */
const sortCallsNewestFirst=(list)=>[...(list||[])].sort((a,b)=>{
  const byDateTime=`${b.date||''}${b.time||''}`.localeCompare(`${a.date||''}${a.time||''}`);
  if(byDateTime) return byDateTime;
  return (Number(b.id)||0)-(Number(a.id)||0);
});

const DetailCallHistoryPanel=({
  calls,onOpen,onDeleteCall,renderCallLink,
  newCallDate,setNewCallDate,newCallTime,setNewCallTime,
  newCallContent,setNewCallContent,onAddCall,
  addDisabled,addDisabledTitle,
  callsWrite=true,
  linkPicker,onDismissPicker,
  whiteBg=false,
})=>{
  const panelBg=whiteBg?C.surf:C.surf2;
  return(
  <div style={{display:'flex',flexDirection:'column',minHeight:0,height:'100%',background:whiteBg?C.surf:undefined}}>
    <div style={{padding:'12px 16px',background:panelBg,borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
      <span style={{fontSize:14,fontWeight:600,color:C.tx}}>통화 이력</span>
      <span style={{fontSize:12,color:C.txM,background:C.surf3,padding:'2px 8px',borderRadius:20}}>{calls.length}건</span>
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10,minHeight:0,background:whiteBg?C.surf:undefined}}>
      {calls.length>0?calls.map(c=>(
        <div key={c.id} style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'12px 14px',boxShadow:'0 1px 3px rgba(0,0,0,.04)',marginBottom:2,borderBottom:`2px solid ${C.bdr}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
            <div style={{minWidth:0,flex:1,paddingRight:8}}>
              <div>
                <span style={{fontSize:13,fontWeight:600,color:C.tx}}>{c.date}</span>
                <span style={{fontSize:12,color:C.txM,marginLeft:6}}>{c.time}</span>
              </div>
              {renderCallLink?.(c)}
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0}}>
              <Btn role="row-edit" ch="수정" on={()=>onOpen('ce',c)} disabled={!callsWrite} title={!callsWrite?PERMISSION_DENIED_TOOLTIP:undefined}/>
              <Btn role="row-delete" ch="삭제" on={()=>onDeleteCall&&onDeleteCall(c)} disabled={!callsWrite||!onDeleteCall} title={!callsWrite?PERMISSION_DENIED_TOOLTIP:undefined}/>
            </div>
          </div>
          <div style={{fontSize:13,color:C.txS,lineHeight:1.6,maxHeight:80,overflowY:'auto'}}>{c.content}</div>
          {c.next&&<div style={{marginTop:6,fontSize:12,color:C.txM,display:'flex',alignItems:'center',gap:4}}>
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>{c.next}
            {c.nDate&&<span style={{background:C.warnBg,color:C.warn,padding:'1px 6px',borderRadius:20,fontSize:12,marginLeft:2}}>{c.nDate}</span>}
          </div>}
        </div>
      )):<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:80,fontSize:13,color:C.txM}}>통화 이력 없음</div>}
    </div>
    <div style={{borderTop:`1px solid ${C.bdr}`,padding:'12px 14px',background:panelBg,flexShrink:0}}>
      <div style={{fontSize:12,fontWeight:700,color:C.txM,marginBottom:10,textTransform:'uppercase',letterSpacing:'.04em'}}>통화 기록 추가</div>
      <div style={{display:'flex',gap:6,marginBottom:8}}>
        <input type="date" className="inp" value={newCallDate} onChange={e=>setNewCallDate(e.target.value)} style={{flex:'1 1 140px',minWidth:0,height:32,fontSize:13}}/>
        <input type="time" className="inp" value={newCallTime} onChange={e=>setNewCallTime(e.target.value)} style={{width:140,flexShrink:0,height:32,fontSize:13}}/>
      </div>
      {linkPicker}
      <textarea className="ta" rows={3} placeholder="통화 내용을 입력하세요..."
        style={{marginBottom:8,fontSize:13,width:'100%',display:'block',boxSizing:'border-box'}}
        value={newCallContent}
        onChange={e=>setNewCallContent(e.target.value)}
        onClick={()=>onDismissPicker&&onDismissPicker()}/>
      <Btn role="toolbar-primary" ch="통화 기록 추가" ic="ti-plus" full disabled={addDisabled} title={addDisabled?addDisabledTitle:undefined} on={onAddCall}/>
    </div>
  </div>
  );
};

const PropDetail=({prop,onClose,onEdit,onOpen,onDelete,onDeleteCall})=>{
  const { accountDefaults, user, companyRole, memberPermissions, teamNameMap, teamRoleMap }=useAuth();
  const P=useProperties();
  const CU=useOwnerCustomers();
  const CALLS=useOwnerCallLogs();
  const RENTALS=useRentals(prop.id);
  const liveProp=P.find(x=>x.id===prop.id);
  const [propData,setPropData]=useState({...prop});
  useEffect(()=>{
    if(liveProp) setPropData(prev=>({...prev,...liveProp}));
  },[liveProp]);
  const isFav=!!(liveProp?.fav??propData.fav);
  const [showRental,setShowRental]=useState(false);
  const [photoIdx,setPhotoIdx]=useState(0);
  const [showViewer,setShowViewer]=useState(false);
  const [custSearch,setCustSearch]=useState('');
  const [custDropOpen,setCustDropOpen]=useState(false);
  const [selCallCust,setSelCallCust]=useState(null);
  const [newCallDate,setNewCallDate]=useState(()=>defaultCallDateTime().date);
  const [newCallTime,setNewCallTime]=useState(()=>defaultCallDateTime().time);
  const [newCallContent,setNewCallContent]=useState('');
  const [copying,setCopying]=useState(false);
  const photoList=Array.isArray(propData.photos)?propData.photos.filter(Boolean):[];
  const hasPhotos=photoList.length>0;
  const saleInvest=buildSaleInvestmentMetrics(propData.price, RENTALS, propData);
  useEffect(()=>{ setPhotoIdx(0); },[prop.id]);
  useEffect(()=>{
    const {date,time}=defaultCallDateTime();
    setNewCallDate(date);
    setNewCallTime(time);
  },[prop.id]);
  useEffect(()=>{
    if(photoIdx>=photoList.length&&photoList.length>0) setPhotoIdx(0);
  },[photoList.length,photoIdx]);
  const filtCusts=CU.filter(c=>!custSearch||c.name.includes(custSearch)||phoneMatches(c.phone,custSearch)||(c.co&&c.co.includes(custSearch)));
  const freePhoneOpt=freePhoneOptionFromSearch(custSearch, CU);
  const calls=sortCallsNewestFirst(CALLS.filter(c=>c.pid===prop.id));
  const shared=isSharedRecord(propData,user?.id);
  const effectivePerms=getEffectivePermissions(companyRole,memberPermissions);
  const maskSensitive=shared&&!canReadSharedResource(effectivePerms,'call_logs');
  const showPhone=(phone)=>displayPhone(formatPhone(phone)||phone||'',maskSensitive);
  const canEditProp=canWriteRecord(propData,user?.id,companyRole,memberPermissions,'properties');
  const canWriteCalls=canWriteRecord(propData,user?.id,companyRole,memberPermissions,'call_logs');
  const sharedLabel=shared?formatSharedPropertyLabel(teamNameMap[propData.ownerId],teamRoleMap[propData.ownerId]):null;
  if(showRental) return(<RentalWin prop={propData} onClose={()=>setShowRental(false)} canWrite={canEditProp}/>);

  const detailPhotoPanel=(
    <div style={{width:'100%',height:'100%',position:'relative',background:hasPhotos?'#111':`linear-gradient(135deg,#E6F1FB,#C7D9F5)`,display:'flex',alignItems:'center',justifyContent:'center',cursor:hasPhotos?'pointer':'default',overflow:'hidden'}}
      onClick={()=>{ if(hasPhotos) setShowViewer(true); }}>
      {hasPhotos ? (
        <img src={photoList[photoIdx]} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
      ) : (
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:44,height:44,flexShrink:0,color:'#185FA5',opacity:.35}} aria-hidden><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>
      )}
      {hasPhotos&&photoList.length>1&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 10px',opacity:0,transition:'opacity .2s'}}
        onMouseEnter={e=>e.currentTarget.style.opacity='1'}
        onMouseLeave={e=>e.currentTarget.style.opacity='0'}
        onClick={e=>e.stopPropagation()}>
        <button onClick={e=>{e.stopPropagation();setPhotoIdx(i=>(i-1+photoList.length)%photoList.length);}}
          style={{width:36,height:36,borderRadius:'50%',background:'rgba(0,0,0,.45)',border:'none',color:'#fff',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:16,height:16,flexShrink:0}} aria-hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span>
        </button>
        <button onClick={e=>{e.stopPropagation();setPhotoIdx(i=>(i+1)%photoList.length);}}
          style={{width:36,height:36,borderRadius:'50%',background:'rgba(0,0,0,.45)',border:'none',color:'#fff',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:16,height:16,flexShrink:0}} aria-hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
      </div>}
      {hasPhotos&&<div style={{position:'absolute',top:10,right:10,background:'rgba(0,0,0,.45)',borderRadius:6,padding:'3px 8px',fontSize:12,color:'#fff'}}>{photoIdx+1}/{photoList.length}</div>}
      {hasPhotos&&photoList.length>1&&<div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5}}>
        {photoList.map((_,i)=><div key={i} style={{width:i===photoIdx?16:6,height:6,borderRadius:3,background:i===photoIdx?'#fff':'rgba(255,255,255,.45)',transition:'width .2s'}}/>)}
      </div>}
      {hasPhotos&&<div style={{position:'absolute',bottom:10,right:10,background:'rgba(0,0,0,.45)',borderRadius:6,padding:'4px 8px',fontSize:12,color:'#fff',display:'flex',alignItems:'center',gap:4}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>확대
      </div>}
    </div>
  );

  const detailMapPanel=(
    <PropertyDetailMap
      key={`pd-map-${propData.id}-${propData.jibunAddr || propData.addr || ''}`}
      property={propData}
    />
  );

  const extSiteAddr=propJibunAddr(propData)||propDisplayAddr(propData);
  const hasOwnerTel=digitsOnly(propData.ownerTel||'').length>0;
  const detailWinTitle=(
    <>
      <span style={{fontSize:15,color:C.tx,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',letterSpacing:'-.01em',flexShrink:1,minWidth:0}}>
        {propDetailWinTitle(propData)}
      </span>
      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
        <Bdg label={TL[propData.trade]||'—'} type="brand"/>
        <Bdg label={{NEW:'신규',ACTIVE:'진행중',HOLD:'보류',COMPLETED:'완료'}[propData.status]||'신규'} type={{NEW:'gray',ACTIVE:'info',HOLD:'warn',COMPLETED:'gray'}[propData.status]||'gray'}/>
        <Bdg label={propData.pub?'공개':'비공개'} type={propData.pub?'gray':'warn'}/>
        {sharedLabel&&<span style={{display:'inline-flex',alignItems:'center',fontSize:11,fontWeight:600,color:'#185FA5',background:'#E6F1FB',borderRadius:4,padding:'2px 7px'}}>{sharedLabel}</span>}
        <span onClick={()=>setPropertyFav(prop.id,!isFav)} style={{fontSize:18,color:isFav?'#F59E0B':C.txP,cursor:'pointer',lineHeight:1}} title={isFav?'즐겨찾기 해제':'즐겨찾기'}>{isFav?'★':'☆'}</span>
      </div>
    </>
  );

  const jibunAddr=propJibunAddr(propData)||propDisplayAddr(propData);
  const roadAddr=propRoadAddr(propData);
  const locationDisplay=(
    <span style={{display:'block',lineHeight:1.45}}>
      <span style={{display:'block'}}>{jibunAddr||roadAddr||'—'}</span>
      {roadAddr&&roadAddr!==jibunAddr&&(
        <span style={{display:'block',marginTop:2,color:C.txM,fontSize:12,fontWeight:400}}>{roadAddr}</span>
      )}
    </span>
  );
  const buildingScale=(propData.floorsBelow?`B${propData.floorsBelow}/`:'')+(propData.floorsAbove?`${propData.floorsAbove}F`:'—');
  const saleInfoRows=buildPropSaleInfoRows(propData, RENTALS, { fmtSalePriceEokWon, fmtLandPyUnit });
  const tradePriceItems=buildTradePriceInfoItems(propData, TL);

  const detailSpecPanel=(
    <>
      <SecLabel ch="기본정보" plain propTitle ic="location" sx={{marginTop:0}}/>
      <PropInfoGrid items={[
        {k:'소재지',v:locationDisplay,full:true,wrap:true},
        {k:'매물 대분류',v:PROP_MAIN[propData.main]||'—'},
        {k:'매물 소분류',v:PROP_SUB[propData.main]?.[propData.sub]||'—'},
        {k:'도로상황',v:propData.roadInfo||'—',full:true},
      ]}/>
      <SecLabel ch="토지정보" plain propTitle ic="land"/>
      <PropInfoGrid items={[
        {k:'토지면적',v:propData.land>0?fmtAreaWithPy(propData.land):'—'},
        {k:'용도지역',v:propData.zoning||'—'},
        {k:'지목',v:propData.landCategory||'—'},
        {k:'개별공시지가',v:fmtOfficialLandPriceDisplay(propData)},
      ]}/>
      <SecLabel ch="건물정보" plain propTitle ic="building"/>
      <PropInfoGrid items={[
        {k:'연면적',v:propData.floor>0?fmtAreaWithPy(propData.floor):'—'},
        {k:'용적률산정용 연면적',v:propData.farArea>0?fmtAreaWithPy(propData.farArea):'—'},
        {k:'건축면적',v:propData.buildingArea>0?fmtAreaWithPy(propData.buildingArea):'—'},
        {k:'규모',v:buildingScale},
        {k:'건폐율',v:propData.buildingCoverage?`${propData.buildingCoverage}%`:'—'},
        {k:'용적률',v:propData.floorAreaRatio?`${propData.floorAreaRatio}%`:'—'},
        {k:'주구조',v:propData.structure||'—'},
        {k:'주용도',v:propData.mainUse||'—'},
        {k:'주차',v:propData.parking?`${propData.parking}대`:'—'},
        {k:'승강기',v:propData.elevators?`${propData.elevators}대`:'—'},
        {k:'사용승인일',v:propData.approvalDate||'—'},
      ]}/>
      <SecLabel ch="매각정보" plain propTitle ic="sale"/>
      {saleInfoRows?(
        <PropSaleInfoGrid rows={saleInfoRows}/>
      ):(
        <PropInfoGrid items={tradePriceItems}/>
      )}
      {(propData.trade==='SALE'||propData.trade==='PRESALE')&&<>
        <SecLabel ch="임대차내역" plain propTitle ic="rental"/>
        <div style={{padding:'14px 18px',borderBottom:`1px solid ${C.bdr}`}}>
          {RENTALS.length>0&&(()=>{
            const totalDep=saleInvest.existingDeposit;
            const totalRent=RENTALS.reduce((s,r)=>s+parseMoneyMan(r.rent),0);
            const totalMaint=RENTALS.reduce((s,r)=>s+parseMoneyMan(r.maint),0);
            const vacantCount=RENTALS.filter(r=>r.dep===null&&r.rent===null).length;
            const rentalSummaryCell={
              padding:'10px 14px',
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              justifyContent:'center',
              textAlign:'center',
            };
            return(
              <div style={{border:`1px solid ${C.bdr}`,borderRadius:8,overflow:'hidden',marginBottom:12}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
                  {[
                    ['매각금액',propData.price?formatKoreanAmountFromMan(propData.price):'—',C.brand],
                    ['수익률',saleInvest.yieldLabel,C.tx],
                    ['공실 현황',vacantCount>0?`${vacantCount}개층`:'없음',vacantCount>0?C.warn:C.tx],
                  ].map(([l,v,c],i)=>(
                    <div key={i} style={{...rentalSummaryCell,borderRight:i<2?`1px solid ${C.bdr}`:'none',borderBottom:`1px solid ${C.bdr}`,background:C.surf2}}>
                      <div style={{fontSize:11,color:C.txM,fontWeight:500,marginBottom:4}}>{l}</div>
                      <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
                  {[
                    ['총 보증금',formatKoreanAmountFromMan(totalDep),C.tx],
                    ['총 임대료',formatKoreanAmountFromMan(totalRent),C.tx],
                    ['총 관리비',formatKoreanAmountFromMan(totalMaint),C.tx],
                  ].map(([l,v,c],i)=>(
                    <div key={i} style={{...rentalSummaryCell,borderRight:i<2?`1px solid ${C.bdr}`:'none',background:'#fff'}}>
                      <div style={{fontSize:11,color:C.txM,fontWeight:500,marginBottom:4}}>{l}</div>
                      <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {RENTALS.length===0&&(
            <div style={{fontSize:13,color:C.txM,lineHeight:1.6,marginBottom:12}}>
              등록된 임대차 내역이 없습니다. 층별 임대차를 등록하면 투자분석이 자동 반영됩니다.
            </div>
          )}
          <Btn role="block-link" ch={RENTALS.length>0?'임대차 내역 보기':'임대차 등록 · 관리'} ic="ti-table" full on={()=>setShowRental(true)}/>
        </div>
      </>}
      <SecLabel ch="홍보문구" plain propTitle ic="promo"/>
      <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.bdr}`}}>
        <div style={{padding:'10px 14px',borderLeft:`3px solid ${C.bdr}`,background:C.surf2,borderRadius:'0 7px 7px 0',fontSize:13,color:propData.promo?C.txS:C.txP,lineHeight:1.7,minHeight:120,maxHeight:400,overflow:'auto',whiteSpace:'pre-wrap'}}>
          {propData.promo||<span style={{fontStyle:'italic',color:C.txP}}>홍보문구 없음</span>}
        </div>
      </div>
      <SecLabel ch="메모" plain propTitle ic="memo"/>
      <div style={{padding:'12px 18px',borderBottom:`1px solid ${C.bdr}`}}>
        <div style={{padding:'10px 14px',borderLeft:`3px solid ${C.bdr}`,background:C.surf2,borderRadius:'0 7px 7px 0',fontSize:13,color:propData.memo?C.txM:C.txP,lineHeight:1.7,minHeight:80,maxHeight:200,overflow:'auto',whiteSpace:'pre-wrap'}}>
          {propData.memo||<span style={{fontStyle:'italic',color:C.txP}}>메모 없음</span>}
        </div>
      </div>
      <SecLabel ch="세부내용" plain propTitle ic="detail"/>
      <PropInfoGrid items={[
        {k:'게시글 제목',v:propData.bldg||propDisplayAddr(propData)||'—'},
        {k:'공개 여부',v:propData.pub?'공개':'비공개',c:propData.pub?undefined:C.warn},
        {k:'담당자',v:propData.agentName||accountDefaults.displayName||'—'},
        {k:'담당자 연락처',v:formatPhone(propData.agentTel||accountDefaults.phone)||'—'},
        ...(hasOwnerTel?[{k:'소유주 연락처',v:showPhone(propData.ownerTel)}]:[]),
      ]}/>
      <div style={{height:16}}/>
    </>
  );

  const detailCallPanel=(
    <DetailCallHistoryPanel
      whiteBg
      calls={calls}
      onOpen={onOpen}
      onDeleteCall={onDeleteCall}
      renderCallLink={(c)=>{
        const cust=CU.find(cu=>cu.id===c.cid);
        if(cust){
          const phone=showPhone(cust.phone);
          return(
            <div onClick={e=>{e.stopPropagation();onOpen('cd',cust);}}
              style={{fontSize:12,color:C.info,cursor:'pointer',fontWeight:500,marginTop:3,lineHeight:1.4}}>
              {cust.name}{phone?` · ${phone}`:''}
            </div>
          );
        }
        if(c.contactPhone){
          return (
            <div style={{fontSize:12,color:C.txM,fontWeight:500,marginTop:3,lineHeight:1.4}}>
              {formatPhone(c.contactPhone)||c.contactPhone}
            </div>
          );
        }
        return null;
      }}
      newCallDate={newCallDate}
      setNewCallDate={setNewCallDate}
      newCallTime={newCallTime}
      setNewCallTime={setNewCallTime}
      newCallContent={newCallContent}
      setNewCallContent={setNewCallContent}
      addDisabled={!canWriteCalls}
      addDisabledTitle={PERMISSION_DENIED_TOOLTIP}
      callsWrite={canWriteCalls}
      onDismissPicker={()=>setCustDropOpen(false)}
      onAddCall={async()=>{
        if(!canWriteCalls||!newCallContent.trim()) return;
        const freePhone=!isFreePhoneSel(selCallCust)&&!selCallCust
          ? freePhoneOptionFromSearch(custSearch, CU)
          : null;
        const contactPhone=isFreePhoneSel(selCallCust)
          ? normalizePhone(selCallCust.phone)
          : (freePhone?normalizePhone(freePhone):'');
        const cid=(!isFreePhoneSel(selCallCust)&&selCallCust?.id)||null;
        await addCallLogDirect({
          pid:prop.id,
          cid,
          contactPhone:contactPhone||'',
          date:newCallDate,
          time:newCallTime,
          content:newCallContent,
          next:null,
          nDate:null,
        });
        showNotification('저장하였습니다.','success');
        setNewCallContent('');
        setSelCallCust(null);
        setCustSearch('');
        setCustDropOpen(false);
      }}
      linkPicker={
        <div style={{position:'relative',marginBottom:8}}>
          {selCallCust?(
            <div style={{display:'flex',alignItems:'center',gap:8,height:34,border:`1.5px solid ${C.brand}`,borderRadius:7,background:C.brandL,padding:'0 10px'}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:C.brand,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0,color:'#fff'}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              </div>
              <span style={{fontSize:13,fontWeight:600,color:C.brand,flex:1}}>
                {isFreePhoneSel(selCallCust)?(selCallCust.phone):(selCallCust.name)}
              </span>
              {!isFreePhoneSel(selCallCust)&&<span style={{fontSize:12,color:C.txM}}>{selCallCust.co}</span>}
              {isFreePhoneSel(selCallCust)&&<span style={{fontSize:11,color:C.txM,background:'#fff',padding:'1px 6px',borderRadius:10}}>미등록</span>}
              <span onClick={()=>{setSelCallCust(null);setCustSearch('');setCustDropOpen(false);}}
                style={{width:20,height:20,borderRadius:'50%',background:'rgba(200,16,46,.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,color:C.brand,fontSize:13,fontWeight:700}}>×</span>
            </div>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:0,height:34,border:`1.5px solid ${C.bdr}`,borderRadius:7,background:'#fff',overflow:'hidden'}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0,color:C.txP,marginLeft:10}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
              <input value={custSearch}
                onChange={e=>{setCustSearch(e.target.value);setCustDropOpen(true);}}
                onFocus={()=>setCustDropOpen(true)}
                onKeyDown={e=>{
                  if(e.key!=='Enter'||!freePhoneOpt) return;
                  e.preventDefault();
                  setSelCallCust(makeFreePhoneSel(freePhoneOpt));
                  setCustSearch('');
                  setCustDropOpen(false);
                }}
                placeholder="고객명·회사·연락처 검색..."
                style={{border:'none',background:'transparent',flex:1,padding:'0 8px',fontSize:13,color:C.tx,height:'100%'}}/>
              {custSearch&&<span onClick={()=>{setCustSearch('');setCustDropOpen(false);}} style={{padding:'0 10px',cursor:'pointer',color:C.txP,fontSize:14,lineHeight:1}}>×</span>}
            </div>
          )}
          {!selCallCust&&custDropOpen&&(
            <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,maxHeight:200,overflowY:'auto',boxShadow:'0 6px 20px rgba(0,0,0,.12)'}}>
              {filtCusts.map(c=>{
                const nameCount=filtCusts.filter(x=>x.name===c.name).length;
                return(
                  <div key={c.id} onClick={()=>{setSelCallCust(c);setCustSearch('');setCustDropOpen(false);}}
                    style={{padding:'10px 12px',cursor:'pointer',borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',gap:10}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{width:30,height:30,borderRadius:8,background:C.surf2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:14,height:14,flexShrink:0,color:C.txM}} aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.tx}}>{c.name}</span>
                        {nameCount>1&&<span style={{fontSize:12,background:C.warnBg,color:C.warn,padding:'1px 6px',borderRadius:10,fontWeight:600}}>동명이인</span>}
                        <Bdg label={customerTypeLabelOf(c)} type="info"/>
                      </div>
                      <div style={{fontSize:12,color:C.txM,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {c.co&&c.co!=='개인'?`${c.co} · `:''}{showPhone(c.phone)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {freePhoneOpt&&(
                <div onClick={()=>{setSelCallCust(makeFreePhoneSel(freePhoneOpt));setCustSearch('');setCustDropOpen(false);}}
                  style={{padding:'10px 12px',cursor:'pointer',background:C.brandL,borderTop:filtCusts.length?`1px solid ${C.bdr}`:'none'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#FADADD'}
                  onMouseLeave={e=>e.currentTarget.style.background=C.brandL}>
                  <div style={{fontSize:13,fontWeight:600,color:C.brand}}>미등록 번호로 추가</div>
                  <div style={{fontSize:12,color:C.txM,marginTop:2}}>{freePhoneOpt}</div>
                </div>
              )}
              {filtCusts.length===0&&!freePhoneOpt&&(
                <div style={{padding:'14px 12px',fontSize:13,color:C.txP,textAlign:'center'}}>검색 결과 없음</div>
              )}
            </div>
          )}
        </div>
      }
    />
  );

  const detailBody=(
    <>
      {showViewer&&hasPhotos&&<PhotoViewer photos={photoList} startIdx={photoIdx} onClose={()=>setShowViewer(false)}/>}
      <PropertyDetailNewWin
        leftTop={detailPhotoPanel}
        leftBottom={detailMapPanel}
        center={detailSpecPanel}
        right={detailCallPanel}
        footer={
          <ActionBar saveLabel="수정" onSave={()=>{
            if(!canEditProp) return;
            if(onEdit) onEdit(propData);
            else onOpen('pe',{...propData,_onSaved:(updated)=>setPropData(prev=>({...prev,...updated}))});
          }} saveDisabled={!canEditProp} saveDisabledTitle={PERMISSION_DENIED_TOOLTIP}
            onDelete={()=>onDelete&&onDelete(propData)} deleteDisabled={!canEditProp||copying} deleteDisabledTitle={PERMISSION_DENIED_TOOLTIP}
            onCopy={async()=>{
              if(!canEditProp||copying) return;
              setCopying(true);
              try{
                const { record }=await duplicateProperty(propData);
                showNotification('매물을 복사했습니다. 층수·조건을 수정한 뒤 저장하세요.','success');
                onClose();
                if(onOpen) onOpen('pe',record);
              }catch(err){
                console.error('[prop copy]',err);
                showNotification(err?.message||'매물 복사에 실패했습니다.','error');
              }finally{
                setCopying(false);
              }
            }}
            copyLabel={copying?'복사 중…':'매물 복사'}
            copyDisabled={!canEditProp||copying}
            copyDisabledTitle={!canEditProp?PERMISSION_DENIED_TOOLTIP:undefined}
            onCancel={onClose}/>
        }
      />
    </>
  );
  return(
    <Win title={detailWinTitle} ic="ti-building" onClose={onClose} w={PROP_DETAIL_WIN_W}
      acts={<>{EXT_SITES.map(s=><ExtSiteBtn key={s.key} site={s} addr={extSiteAddr} property={propData}/>)}</>}
      ch={detailBody}
    />
  );
};

const RentalWin=({prop,onClose,canWrite=true})=>{
  const pid=normalizePropertyLocalId(prop.id);
  const dbRows=useRentals(pid);
  const [rows,setRows]=useState([]);
  const [saving,setSaving]=useState(false);
  const dirtyRef=useRef(false);

  useEffect(()=>{
    dirtyRef.current=false;
  },[pid]);

  useEffect(()=>{
    if(dirtyRef.current) return;
    setRows(dbRows.map(r=>({...r,status:(r.dep===null&&r.rent===null)?'vacant':'occupied'})));
  },[dbRows,pid]);

  const markDirty=()=>{ dirtyRef.current=true; };
  const updateRow=(i,field,val)=>{ markDirty(); setRows(r=>r.map((row,j)=>j===i?{...row,[field]:val}:row)); };
  const addRow=()=>{ markDirty(); setRows(r=>[...r,{id:Date.now(),floor:'',tenant:'',purpose:'',area:'',dep:'',rent:'',maint:'',leaseEnd:'',memo:'',status:'occupied'}]); };
  const delRow=i=>{ markDirty(); setRows(r=>r.filter((_,j)=>j!==i)); };
  const setRowStatus=(i,status)=>{ markDirty(); setRows(r=>r.map((row,j)=>j===i?{...row,status,...(status==='vacant'?{dep:null,rent:null,maint:null}:{dep:row.dep===null?'':row.dep,rent:row.rent===null?'':row.rent,maint:row.maint===null?'':row.maint})}:row)); };
  const toPy=a=>parseFloat(a)>0?`${(parseFloat(a)/3.3058).toFixed(1)}평`:'—';
  const EI={height:30,border:'none',borderBottom:`1px solid ${C.bdr}`,background:'transparent',padding:'0 8px',fontSize:13,color:C.tx,width:'100%',fontFamily:'inherit'};

  const totalDep=rows.reduce((s,r)=>s+parseMoneyMan(r.dep),0);
  const totalRent=rows.reduce((s,r)=>s+parseMoneyMan(r.rent),0);
  const totalMaint=rows.reduce((s,r)=>s+parseMoneyMan(r.maint),0);
  const vacantCount=rows.filter(r=>r.dep===null&&r.rent===null).length;
  const saleInvest=buildSaleInvestmentMetrics(prop.price, rows, prop);

  const handleSave=async()=>{
    if(!canWrite||saving) return;
    setSaving(true);
    try{
      await saveRentalsForProperty(pid, rows);
      dirtyRef.current=false;
      showNotification('저장하였습니다.','success');
      onClose();
    }catch(err){
      console.error('[rentals save]', err);
      const msg=err?.message==='FORBIDDEN'?PERMISSION_DENIED_TOOLTIP:(err?.message||'임대차 저장에 실패했습니다.');
      showNotification(msg,'error');
    }finally{
      setSaving(false);
    }
  };

  return(
    <Win title={`임대차 내역 — ${propDisplayAddr(prop)}`} ic="ti-table" onClose={onClose} w={1320}
      acts={null}
      ch={<>
        <div style={{...WIN_BODY_SCROLL,padding:'18px 22px'}}>
          {/* 임대차 현황 요약 (카드형) */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden',marginBottom:18}}>
            <SecLabel ch="임대차 현황 요약"/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
              {[
                ['매각금액',propPrice(prop),C.brand],
                ['수익률',saleInvest.yieldLabel,C.tx],
                ['공실 현황',vacantCount>0?`${vacantCount}개층`:'없음',vacantCount>0?C.warn:C.tx],
              ].map(([l,v,c],i)=>(
                <div key={i} style={{padding:'14px 18px',borderRight:i<2?`1px solid ${C.bdr}`:'none',borderBottom:`1px solid ${C.bdr}`,background:C.surf2}}>
                  <div style={{fontSize:12,color:C.txM,fontWeight:500,marginBottom:5}}>{l}</div>
                  <div style={{fontSize:17,fontWeight:600,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
              {[
                ['총 보증금',formatKoreanAmountFromMan(totalDep),C.tx],
                ['총 임대료',formatKoreanAmountFromMan(totalRent),C.tx],
                ['총 관리비',formatKoreanAmountFromMan(totalMaint),C.tx],
              ].map(([l,v,c],i)=>(
                <div key={i} style={{padding:'14px 18px',borderRight:i<2?`1px solid ${C.bdr}`:'none'}}>
                  <div style={{fontSize:12,color:C.txM,fontWeight:500,marginBottom:5}}>{l}</div>
                  <div style={{fontSize:17,fontWeight:600,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 층별 임대차 내역 테이블 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            <SecLabel ch="층별 임대차 내역"/>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',minWidth:1200,borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:C.surf2,borderBottom:`1.5px solid ${C.bdr}`}}>
                    {[['층/호실',86],['상태',90],['임차사',120],['용도',160],['면적(㎡)',74],['평',46],['보증금(만)',96],['임대료(만)',96],['관리비(만)',96],['임차계약만료일',130],['메모',260],['',30]].map(([h,w],i)=>(
                      <th key={i} style={{padding:'9px 10px',textAlign:'left',fontSize:12,fontWeight:700,color:C.txM,letterSpacing:'.03em',textTransform:'uppercase',whiteSpace:'nowrap',width:w,minWidth:w}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,i)=>{
                    const vacant=r.status==='vacant';
                    return(
                      <tr key={r.id} style={{borderBottom:`1px solid ${C.bdr}`,background:i%2===0?'#fff':C.surf2}}>
                        <td style={{padding:4}}><input style={EI} value={r.floor||''} onChange={e=>updateRow(i,'floor',e.target.value)}/></td>
                        <td style={{padding:'4px 6px'}}>
                          <select value={r.status} onChange={e=>setRowStatus(i,e.target.value)}
                            style={{height:28,border:`1px solid ${vacant?C.warnBd:C.bdr}`,borderRadius:14,background:vacant?C.warnBg:C.surf2,color:vacant?C.warn:C.tx,fontSize:11,fontWeight:600,padding:'0 8px',fontFamily:'inherit',cursor:'pointer',width:'100%'}}>
                            <option value="occupied">임대중</option>
                            <option value="vacant">공실</option>
                          </select>
                        </td>
                        <td style={{padding:4}}><input style={EI} value={r.tenant||''} onChange={e=>updateRow(i,'tenant',e.target.value)}/></td>
                        <td style={{padding:4}}><input style={EI} value={r.purpose||''} onChange={e=>updateRow(i,'purpose',e.target.value)}/></td>
                        <td style={{padding:4}}><input type="number" style={{...EI,width:70,textAlign:'right'}} value={r.area||''} onChange={e=>updateRow(i,'area',e.target.value)}/></td>
                        <td style={{padding:'0 10px',fontSize:12,color:C.txM,whiteSpace:'nowrap'}}>{toPy(r.area)}</td>
                        {vacant?[0,1,2].map(j=><td key={j} style={{padding:'0 10px',color:C.txP,fontSize:13,fontStyle:'italic'}}>—</td>)
                          :['dep','rent','maint'].map(f=>(
                            <td key={f} style={{padding:4}}><MoneyInput style={{...EI,width:88,minWidth:88,textAlign:'right'}} value={r[f]??''} onChange={e=>updateRow(i,f,e.target.value)}/></td>
                          ))}
                        <td style={{padding:4}}>
                          <input type="date" style={{...EI,width:'100%',minWidth:118}} value={r.leaseEnd||''} onChange={e=>updateRow(i,'leaseEnd',e.target.value)}/>
                        </td>
                        <td style={{padding:'6px 8px',verticalAlign:'top'}}>
                          <textarea value={r.memo||''} onChange={e=>updateRow(i,'memo',e.target.value)} placeholder="메모 입력..." rows={1}
                            onInput={e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}}
                            style={{width:'100%',minHeight:30,border:'none',borderBottom:`1px solid ${C.bdr}`,background:'transparent',padding:'4px 4px',fontSize:13,color:C.tx,fontFamily:'inherit',resize:'none',overflow:'hidden',whiteSpace:'pre-wrap',wordBreak:'break-word',display:'block'}}/>
                        </td>
                        <td style={{padding:'0 4px',textAlign:'center'}}>
                          <Btn role="row-delete" ch="×" on={()=>delRow(i)}/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={12}>
                      <button onClick={addRow} style={{width:'100%',padding:'10px',background:'none',border:'none',cursor:'pointer',fontSize:13,color:C.info,display:'flex',alignItems:'center',justifyContent:'center',gap:6,borderTop:`1px dashed ${C.bdrSt}`,fontFamily:'inherit'}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>행 추가
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        <ActionBar saveLabel={saving?'저장 중…':'저장'} onSave={handleSave} saveDisabled={!canWrite||saving} saveDisabledTitle={!canWrite?PERMISSION_DENIED_TOOLTIP:undefined} onCancel={onClose}/>
      </>}/>
  );
};

/* ═══ CUST FORM (고객 등록/수정 공용 Win 오버레이) ═══ */
const CustForm=({custData,onClose,onSaved})=>{
  const isNew=!custData;
  const CALLS=useOwnerCallLogs();
  const callDates=!isNew&&custData?.id?custCallDatesOf(buildCustCallDateMap(CALLS),custData.id):null;
  const [name,setName]=useState(custData?.name||'');
  const [phone,setPhone]=useState(()=>formatPhone(custData?.phone||''));
  const [addr,setAddr]=useState(custData?.addr||'');
  const [email,setEmail]=useState(custData?.email||'');
  const [co,setCo]=useState(custData?.co||'');
  const [title,setTitle]=useState(custData?.title||'');
  const [customerTypes,setCustomerTypes]=useState(()=>customerTypesOf(custData||{}));
  const [status,setStatus]=useState(()=>normalizeCustStatus(custData?.status));
  const [cash,setCash]=useState(()=>fmtInputNum(custData?.cash??''));
  const [buyMin,setBuyMin]=useState(()=>fmtInputNum(custData?.buyMin??''));
  const [buyMax,setBuyMax]=useState(()=>fmtInputNum(custData?.buyMax??''));
  const [region,setRegion]=useState(custData?.region||'');
  const [preferredTrades,setPreferredTrades]=useState(()=>preferredTradesOf(custData||{}));
  const [memo,setMemo]=useState(custData?.memo||'');
  const [alertMsg,setAlertMsg]=useState(null);

  useEffect(()=>{
    if(!custData?.id) return;
    setName(custData.name||'');
    setPhone(formatPhone(custData.phone||''));
    setAddr(custData.addr||'');
    setEmail(custData.email||'');
    setCo(custData.co||'');
    setTitle(custData.title||'');
    setCustomerTypes(customerTypesOf(custData));
    setStatus(normalizeCustStatus(custData.status));
    setCash(fmtInputNum(custData.cash??''));
    setBuyMin(fmtInputNum(custData.buyMin??''));
    setBuyMax(fmtInputNum(custData.buyMax??''));
    setRegion(custData.region||'');
    setPreferredTrades(preferredTradesOf(custData));
    setMemo(custData.memo||'');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 수정 대상 고객 변경 시 폼 동기화
  },[custData?.id]);

  const toggleCustomerType=(id)=>{
    setCustomerTypes((prev)=>(
      prev.includes(id) ? prev.filter((t)=>t!==id) : [...prev, id]
    ));
  };

  const togglePreferredTrade=(id)=>{
    setPreferredTrades((prev)=>(
      prev.includes(id) ? prev.filter((t)=>t!==id) : [...prev, id]
    ));
  };

  const handleSave=async()=>{
    if(!name.trim()){
      setAlertMsg('고객이름을 입력해주세요.');
      return;
    }
    if(!customerTypes.length){
      setAlertMsg('고객유형을 하나 이상 선택해주세요.');
      return;
    }
    const cashNum=parseFormNum(cash);
    const buyMinNum=parseFormNum(buyMin);
    const buyMaxNum=parseFormNum(buyMax);
    if(buyMinNum>0&&buyMaxNum>0&&buyMinNum>buyMaxNum){
      setAlertMsg('매입가능액 최소(만)은 최대(만)보다 클 수 없습니다.');
      return;
    }
    const { customer_types, type }=normalizeCustomerTypesField(customerTypes);
    const payload={
      name:name.trim(),phone:normalizePhone(phone),addr:addr.trim(),email,co,title,customer_types,type,
      status:normalizeCustStatus(status),
      cash:cashNum,buyMin:buyMinNum,buyMax:buyMaxNum,region,preferred_trades:preferredTrades,memo,
    };
    try{
      if(isNew){
        const created=formatCreatedDate();
        const id=await addCustomer({...payload,fav:false,deletedAt:null,created});
        if(onSaved) onSaved({id,...payload,fav:false,deletedAt:null,created});
        showNotification('저장하였습니다.','success');
      }else{
        await updateCustomer(custData.id,payload);
        if(onSaved) onSaved({...custData,...payload});
        showNotification('수정되었습니다.','info');
      }
      onClose();
    }catch(err){
      console.error('[CustForm save]', err);
      setAlertMsg(err?.message||'고객 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return(
    <>
    {alertMsg&&<AlertDialog msg={alertMsg} onClose={()=>setAlertMsg(null)}/>}
    <Win title={isNew?'고객 등록':'고객 수정'} ic={isNew?'ti-user-plus':'ti-user-edit'} onClose={onClose} w={760}
      ch={<>
        <div style={{...WIN_COLUMN}}>
          <div style={{...WIN_BODY_SCROLL,padding:'20px 24px 28px',display:'flex',flexDirection:'column',gap:16}}>

          {/* 기본 정보 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="기본 정보"/>
            <div style={{padding:'16px 18px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px 14px',alignItems:'start'}}>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>이름 <span style={{color:C.brand}}>*</span></div>
                <input className="inp" value={name} onChange={e=>setName(e.target.value)} placeholder="홍길동"/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>연락처 <span style={{color:C.brand}}>*</span></div>
                <PhoneInput value={phone} onChange={e=>setPhone(e.target.value)} placeholder="010-0000-0000"/>
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>주소</div>
                <input className="inp" value={addr} onChange={e=>setAddr(e.target.value)} placeholder="서울 강남구 역삼동 123"/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>이메일</div>
                <input className="inp" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com"/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>회사</div>
                <input className="inp" value={co} onChange={e=>setCo(e.target.value)} placeholder="회사명"/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:8}}>
                  고객 유형 <span style={{color:C.brand}}>*</span>
                  <span style={{fontWeight:400,color:C.txP,marginLeft:6,fontSize:11}}>복수 선택</span>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {CUST_TYPE_OPTS.map((opt)=>(
                    <label key={opt.id} style={{display:'inline-flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:13,color:C.tx,userSelect:'none'}}>
                      <input
                        type="checkbox"
                        checked={customerTypes.includes(opt.id)}
                        onChange={()=>toggleCustomerType(opt.id)}
                        style={{width:16,height:16,accentColor:C.brand}}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>직함</div>
                <input className="inp" value={title} onChange={e=>setTitle(e.target.value)} placeholder="대표, 이사, 팀장..."/>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>진행 상태 <span style={{color:C.brand}}>*</span></div>
                <select className="sel" value={status} onChange={e=>setStatus(e.target.value)} style={{display:'block'}}>
                  {CUST_STATUS_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              {!isNew&&<>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>최초 통화일</div>
                  <input className="inp" readOnly value={fmtCallDate(callDates?.first)} style={{background:C.surf2,color:C.txM}}/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>마지막 통화일</div>
                  <input className="inp" readOnly value={fmtCallDate(callDates?.last)} style={{background:C.surf2,color:C.txM}}/>
                </div>
              </>}
            </div>
          </div>

          {/* 투자 조건 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="투자 조건"/>
            <div style={{padding:'16px 18px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px 14px',alignItems:'start'}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>현금 가용금액 (만)</div>
                <MoneyInput value={cash} onChange={e=>setCash(e.target.value)} placeholder="0"/>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>선호 지역</div>
                <input className="inp" value={region} onChange={e=>setRegion(e.target.value)} placeholder="예: 강남·서초"/>
              </div>
              <div style={{gridColumn:'1 / -1'}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:8}}>
                  희망 거래방식
                  <span style={{fontWeight:400,color:C.txP,marginLeft:6,fontSize:11}}>복수 선택</span>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {CUSTOMER_TRADE_OPTS.map((opt)=>(
                    <div key={opt.id} onClick={()=>togglePreferredTrade(opt.id)} style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid',borderColor:preferredTrades.includes(opt.id)?C.brand:C.bdr,background:preferredTrades.includes(opt.id)?C.brandL:'transparent',color:preferredTrades.includes(opt.id)?C.brand:C.txS,fontSize:13,cursor:'pointer',fontWeight:preferredTrades.includes(opt.id)?600:400,transition:'all .1s'}}>
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매입가능액 최소 (만)</div>
                <MoneyInput value={buyMin} onChange={e=>setBuyMin(e.target.value)} placeholder="0"/>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매입가능액 최대 (만)</div>
                <MoneyInput value={buyMax} onChange={e=>setBuyMax(e.target.value)} placeholder="0"/>
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="메모"/>
            <div style={{padding:'16px 18px 20px'}}>
              <textarea className="ta" rows={4} value={memo} onChange={e=>setMemo(e.target.value)} placeholder="고객 관련 특이사항, 선호 조건 등"/>
            </div>
          </div>
        </div>
        </div>
        <ActionBar
          saveLabel={isNew?'저장하기':'저장'}
          onSave={handleSave}
          onCancel={onClose}/>
      </>}/>
    </>
  );
};

/* ═══ CUSTOMER DETAIL ═══ */
const CustDetail=({cust,onClose,onOpen,onDelete,onDeleteCall})=>{
  const P=useProperties();
  const CALLS=useOwnerCallLogs();
  const CU=useOwnerCustomers();
  const c=CU?.find(x=>x.id===cust.id)??cust;
  const calls=sortCallsNewestFirst(CALLS.filter(cl=>cl.cid===c.id));
  const callDates=custCallDatesOf(buildCustCallDateMap(CALLS),c.id);
  const [propSearch,setPropSearch]=useState('');
  const [propDropOpen,setPropDropOpen]=useState(false);
  const [selCallProp,setSelCallProp]=useState(null);
  const [newCallDate,setNewCallDate]=useState(()=>defaultCallDateTime().date);
  const [newCallTime,setNewCallTime]=useState(()=>defaultCallDateTime().time);
  const [newCallContent,setNewCallContent]=useState('');
  const filtProps=P.filter(p=>!propSearch||propMatchesSearch(p,propSearch));
  return(
    <Win title={`${c.name} — 고객 상세`} ic="ti-user" onClose={onClose} w={860}
      acts={null}
      ch={
        <>
        <div style={{...WIN_COLUMN}}>
        <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
          <div style={{width:'52%',borderRight:`1px solid ${C.bdr}`,overflowY:'auto'}}>
            <SecLabel ch="기본 정보"/>
            <div style={{padding:'2px 0'}}>
              <InfoRow k="이름" v={c.name}/>
              <InfoRow k="연락처" v={formatPhone(c.phone)||'—'}/>
              <InfoRow k="주소" v={c.addr||'—'}/>
              <InfoRow k="이메일" v={c.email||'—'}/>
              <InfoRow k="회사" v={c.co}/>
              <InfoRow k="직함" v={c.title||'—'}/>
              <InfoRow k="고객 유형" v={customerTypeLabelOf(c)}/>
              <InfoRow k="진행 상태" v={<CustStatusBdg s={c.status}/>}/>
              <InfoRow k="최초 통화일" v={fmtCallDate(callDates.first)}/>
              <InfoRow k="마지막 통화일" v={fmtCallDate(callDates.last)}/>
            </div>
            <SecLabel ch="투자 조건"/>
            <div style={{padding:'2px 0'}}>
              <InfoRow k="현금 가용금액" v={fmtCustomerMoney(c.cash)} vc={C.ok}/>
              <InfoRow k="매입가능액 범위" v={fmtCustomerBudgetRange(c.buyMin,c.buyMax)} vc={C.ok}/>
              <InfoRow k="선호 지역" v={c.region||'—'}/>
              <InfoRow k="희망 거래방식" v={customerTradeLabelOf(c)}/>
            </div>
            {c.memo&&<><SecLabel ch="메모"/>
              <div style={{padding:'14px 16px',fontSize:13,color:C.txS,lineHeight:1.7,maxHeight:120,overflowY:'auto'}}>{c.memo}</div>
            </>}
          </div>
          <div style={{width:'48%',display:'flex',flexDirection:'column',minHeight:0}}>
            <DetailCallHistoryPanel
              calls={calls}
              onOpen={onOpen}
              onDeleteCall={onDeleteCall}
              renderCallLink={(cl)=>{
                const prop=cl.pid?P.find(p=>p.id===cl.pid):null;
                return prop?(
                  <div onClick={e=>{e.stopPropagation();onOpen('pd',prop);}}
                    style={{fontSize:12,color:C.info,cursor:'pointer',fontWeight:500,marginTop:3,lineHeight:1.4}}>
                    {prop.bldg||propDisplayAddr(prop)}
                  </div>
                ):null;
              }}
              newCallDate={newCallDate}
              setNewCallDate={setNewCallDate}
              newCallTime={newCallTime}
              setNewCallTime={setNewCallTime}
              newCallContent={newCallContent}
              setNewCallContent={setNewCallContent}
              onDismissPicker={()=>setPropDropOpen(false)}
              onAddCall={async()=>{
                if(!newCallContent.trim()) return;
                await addCallLogDirect({pid:selCallProp?.id||null,cid:c.id,date:newCallDate,time:newCallTime,content:newCallContent,next:null,nDate:null});
                showNotification('저장하였습니다.','success');
                setNewCallContent('');
                setSelCallProp(null);
                setPropSearch('');
              }}
              linkPicker={
                <div style={{position:'relative',marginBottom:8}}>
                  {selCallProp?(
                    <div style={{display:'flex',alignItems:'center',gap:8,height:34,border:`1.5px solid ${C.brand}`,borderRadius:7,background:C.brandL,padding:'0 10px'}}>
                      <div style={{width:22,height:22,borderRadius:'50%',background:C.brand,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0,color:'#fff'}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                      </div>
                      <span className="cell-wrap" style={{fontSize:13,fontWeight:600,color:C.brand,flex:1}}>{propDisplayAddr(selCallProp)}</span>
                      <span onClick={()=>{setSelCallProp(null);setPropSearch('');setPropDropOpen(false);}}
                        style={{width:20,height:20,borderRadius:'50%',background:'rgba(200,16,46,.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,color:C.brand,fontSize:13,fontWeight:700}}>×</span>
                    </div>
                  ):(
                    <div style={{display:'flex',alignItems:'center',gap:0,height:34,border:`1.5px solid ${C.bdr}`,borderRadius:7,background:'#fff',overflow:'hidden'}}>
                      <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0,color:C.txP,marginLeft:10}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                      <input value={propSearch}
                        onChange={e=>{setPropSearch(e.target.value);setPropDropOpen(true);}}
                        onFocus={()=>setPropDropOpen(true)}
                        placeholder="도로명·지번·건물명 검색..."
                        style={{border:'none',background:'transparent',flex:1,padding:'0 8px',fontSize:13,color:C.tx,height:'100%'}}/>
                      {propSearch&&<span onClick={()=>{setPropSearch('');setPropDropOpen(false);}} style={{padding:'0 10px',cursor:'pointer',color:C.txP,fontSize:14,lineHeight:1}}>×</span>}
                    </div>
                  )}
                  {!selCallProp&&propDropOpen&&(
                    <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,maxHeight:180,overflowY:'auto',boxShadow:'0 6px 20px rgba(0,0,0,.12)'}}>
                      {filtProps.length===0?(
                        <div style={{padding:'14px 12px',fontSize:13,color:C.txP,textAlign:'center'}}>검색 결과 없음</div>
                      ):filtProps.map(p=>(
                        <div key={p.id} onClick={()=>{setSelCallProp(p);setPropSearch('');setPropDropOpen(false);}}
                          style={{padding:'10px 12px',cursor:'pointer',borderBottom:`1px solid ${C.bdr}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <PropDropListItem p={p}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </div>
        </div>
        <ActionBar saveLabel="수정" onSave={()=>{if(onOpen)onOpen('cf',c);}} onDelete={()=>onDelete&&onDelete(c)} onCancel={onClose}/>
        </div>
        </>
      }/>
  );
};

/* ═══ SCHEDULE DETAIL ═══ */
/* ═══ SCHED FORM (일정 등록/수정 공용 페이지) ═══ */
const SchedForm=({schedData,onClose,onSaved,onDelete})=>{
  const { user, companyRole, memberPermissions }=useAuth();
  const P=useProperties();
  const isNew=!schedData?.id;
  const canEdit=isNew||canWriteRecord(schedData,user?.id,companyRole,memberPermissions,'schedules');
  const prefillDate=schedData?._newDate||schedData?.date||new Date().toISOString().slice(0,10);
  const [title,setTitle]=useState(schedData?.title||'');
  const [date,setDate]=useState(prefillDate);
  const [dateEnd,setDateEnd]=useState(schedData?.dateEnd||'');
  const [time,setTime]=useState(schedData?.time||'09:00');
  const [pri,setPri]=useState(schedData?.pri||'NORMAL');
  const [selPropId,setSelPropId]=useState(schedData?.pid||null);
  const [propSearch,setPropSearch]=useState('');
  const [propDropOpen,setPropDropOpen]=useState(false);
  const selProp=selPropId?P.find(p=>p.id===selPropId):null;
  const filteredProps=P.filter(p=>!propSearch||propMatchesSearch(p,propSearch));
  const [memo,setMemo]=useState(schedData?.memo||'');
  const [chk,setChk]=useState(isNew?[]:(schedData?.chk||[]).map(c=>({...c})));
  const [alertMsg,setAlertMsg]=useState(null);
  const [saving,setSaving]=useState(false);
  const onStartDateChange=(v)=>{
    setDate(v);
    if(dateEnd&&dateEnd<=v) setDateEnd('');
  };

  const handleSave=async()=>{
    if(!canEdit){
      setAlertMsg(PERMISSION_DENIED_TOOLTIP);
      return;
    }
    if(!title.trim()){
      setAlertMsg('일정 제목을 입력해주세요.');
      return;
    }
    if(!date){
      setAlertMsg('시작일을 선택해주세요.');
      return;
    }
    if(dateEnd&&dateEnd<=date){
      setAlertMsg('종료일은 시작일보다 이후여야 합니다. 당일 일정이면 종료일을 비워주세요.');
      return;
    }
    const payload={title:title.trim(),date,dateEnd:dateEndForSave(date,dateEnd),time,pri,pid:selPropId||null,memo,chk:chk.filter(c=>c.t?.trim())};
    setSaving(true);
    try{
      if(isNew){
        await addScheduleDirect(payload);
        showNotification('저장하였습니다.','success');
      }else{
        await updateScheduleDirect(schedData.id,payload);
        showNotification('수정되었습니다.','info');
      }
      if(onSaved) onSaved(payload);
      onClose();
    }catch(err){
      console.error('[SchedForm save]', err);
      const msg=err?.message==='FORBIDDEN'?PERMISSION_DENIED_TOOLTIP:(err?.message||'일정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setAlertMsg(msg);
    }finally{
      setSaving(false);
    }
  };

  const handleDelete=()=>{
    if(!canEdit) return;
    if(onDelete) onDelete(schedData);
  };

  return(
    <>
    {alertMsg&&<AlertDialog msg={alertMsg} onClose={()=>setAlertMsg(null)}/>}
    <Win title={isNew?'일정 등록':'일정 수정'} ic={isNew?"ti-calendar-plus":"ti-calendar-event"} onClose={onClose} w={640}
      ch={
        <div style={WIN_COLUMN}>
        <div style={{...WIN_BODY_SCROLL,padding:'20px 24px 28px',display:'flex',flexDirection:'column',gap:16}}>
          {/* 기본 정보 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="기본 정보" sx={{borderRadius:'10px 10px 0 0'}}/>
            <div style={{padding:'16px 18px'}}>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>일정 제목 <span style={{color:C.brand}}>*</span></div>
                <input className="inp" value={title} onChange={e=>setTitle(e.target.value)} placeholder="일정 제목을 입력하세요"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>시작일 <span style={{color:C.brand}}>*</span></div>
                  <input type="date" className="inp" value={date} onChange={e=>onStartDateChange(e.target.value)}/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>종료일 <span style={{fontSize:12,color:C.txP,fontWeight:500}}>(선택)</span></div>
                  <input type="date" className="inp" value={dateEnd} onChange={e=>setDateEnd(e.target.value)}/>
                </div>
              </div>
              <div style={{fontSize:12,color:C.txP,marginTop:8,lineHeight:1.45}}>종료일을 비우면 당일 일정입니다. 예: 2026-07-15 ~ 2027-01-12</div>
              <div style={{marginTop:14}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>시간</div>
                <input type="time" className="inp" value={time} onChange={e=>setTime(e.target.value)} style={{maxWidth:180}}/>
              </div>
              <div style={{marginTop:14}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>우선순위</div>
                <PriorityPicker value={pri} onChange={setPri}/>
              </div>
            </div>
          </div>
          {/* 연결 매물 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,position:'relative'}} onClick={()=>setPropDropOpen(false)}>
            <SecLabel ch="연결 매물" sx={{borderRadius:'10px 10px 0 0'}}/>
            <div style={{padding:'14px 18px'}}>
              <DropSelect
                sel={selProp}
                onSel={(p)=>setSelPropId(p.id)}
                onClear={()=>{setSelPropId(null);setPropSearch('');}}
                search={propSearch}
                setSearch={setPropSearch}
                open={propDropOpen}
                setOpen={setPropDropOpen}
                items={filteredProps}
                renderChip={propLinkedChip}
                renderItem={(p)=><PropDropListItem p={p}/>}
                placeholder="도로명·지번·건물명 검색..."
              />
            </div>
          </div>
          {/* 메모 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="메모" sx={{borderRadius:'10px 10px 0 0'}}/>
            <div style={{padding:'14px 18px'}}>
              <textarea className="ta" rows={4} value={memo} onChange={e=>setMemo(e.target.value)} placeholder="일정 관련 메모 및 준비사항"/>
            </div>
          </div>
          {/* 체크리스트 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="체크리스트" sx={{borderRadius:'10px 10px 0 0'}}/>
            <div style={{padding:'14px 18px'}}>
              {chk.map((c,i)=>(
                <div key={i} style={{display:'flex',gap:8,marginBottom:10,alignItems:'center'}}>
                  <div style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${c.d?C.ok:C.bdrSt}`,background:c.d?C.ok:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}
                    onClick={()=>setChk(r=>r.map((x,j)=>j===i?{...x,d:!x.d}:x))}>
                    {c.d&&<span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:11,height:11,flexShrink:0,color:'#fff'}} aria-hidden><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                  </div>
                  <input className="inp" value={c.t} onChange={e=>setChk(r=>r.map((x,j)=>j===i?{...x,t:e.target.value}:x))} placeholder={`항목 ${i+1}`} style={{flex:1}}/>
                  <Btn role="row-delete" ch="×" on={()=>setChk(r=>r.filter((_,j)=>j!==i))}/>
                </div>
              ))}
              <Btn role="toolbar-secondary" ch="항목 추가" ic="ti-plus" full on={()=>setChk(r=>[...r,{t:'',d:false}])}/>
            </div>
          </div>
        </div>
        <ActionBar
          saveLabel={saving?(isNew?'저장 중…':'저장 중…'):(isNew?'저장하기':'저장')}
          onSave={handleSave}
          saveDisabled={!canEdit||saving}
          saveDisabledTitle={!canEdit?PERMISSION_DENIED_TOOLTIP:undefined}
          onDelete={!isNew?handleDelete:null}
          deleteDisabled={!canEdit||saving}
          deleteDisabledTitle={PERMISSION_DENIED_TOOLTIP}
          onCancel={isNew?onClose:null}/>
        </div>
      }/>
    </>
  );
};

const SchedDetail=({sched,onClose,onOpen,onDelete})=>{
  const { user, companyRole, memberPermissions }=useAuth();
  const P=useProperties();
  const SCHEDS=useOwnerSchedules();
  const liveSched=sched?.id?(SCHEDS.find(s=>s.id===sched.id)??sched):sched;
  const isNew=!sched?.id;
  const canEdit=isNew||canWriteRecord(liveSched,user?.id,companyRole,memberPermissions,'schedules');
  const prefillDate=sched?._newDate||sched?.date||new Date().toISOString().slice(0,10);
  const [newTitle,setNewTitle]=useState(sched?.title||'');
  const [newDate,setNewDate]=useState(prefillDate);
  const [newDateEnd,setNewDateEnd]=useState(sched?.dateEnd||'');
  const [newTime,setNewTime]=useState(sched?.time||'09:00');
  const [newPri,setNewPri]=useState(sched?.pri||'NORMAL');
  const [newPid,setNewPid]=useState(sched?.pid||null);
  const [newMemo,setNewMemo]=useState(sched?.memo||'');
  const [newPropSearch,setNewPropSearch]=useState('');
  const [newPropDropOpen,setNewPropDropOpen]=useState(false);
  const newSelProp=newPid?P.find(p=>p.id===newPid):null;
  const newFilteredProps=P.filter(p=>!newPropSearch||propMatchesSearch(p,newPropSearch));
  const [chk,setChk]=useState(()=>(liveSched?.chk||[]).map(c=>({...c})));
  const [alertMsg,setAlertMsg]=useState(null);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(!isNew) setChk((liveSched?.chk||[]).map(c=>({...c})));
  },[isNew,liveSched?.id]);
  const onNewStartDateChange=(v)=>{
    setNewDate(v);
    if(newDateEnd&&newDateEnd<=v) setNewDateEnd('');
  };
  const handleNewSave=async()=>{
    if(!newTitle.trim()){
      setAlertMsg('일정 제목을 입력해주세요.');
      return;
    }
    if(!newDate){
      setAlertMsg('시작일을 선택해주세요.');
      return;
    }
    if(newDateEnd&&newDateEnd<=newDate){
      setAlertMsg('종료일은 시작일보다 이후여야 합니다. 당일 일정이면 종료일을 비워주세요.');
      return;
    }
    setSaving(true);
    try{
      await addScheduleDirect({
        title:newTitle.trim(),date:newDate,dateEnd:dateEndForSave(newDate,newDateEnd),time:newTime,pri:newPri,
        pid:newPid||null,memo:newMemo,chk:chk.filter(c=>c.t?.trim()),
      });
      showNotification('저장하였습니다.','success');
      onClose();
    }catch(err){
      console.error('[SchedDetail save]', err);
      setAlertMsg(err?.message||'일정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }finally{
      setSaving(false);
    }
  };
  const openEdit=()=>{
    if(!canEdit||!onOpen||!liveSched?.id) return;
    onClose();
    onOpen('sf',liveSched);
  };
  const toggleChk=async(i)=>{
    if(!canEdit) return;
    const next=chk.map((x,j)=>j===i?{...x,d:!x.d}:x);
    setChk(next);
    const schedId=liveSched?.id??sched?.id;
    if(schedId){
      await updateScheduleDirect(schedId,{chk:next});
      showNotification('수정되었습니다.','info');
    }
  };
  const done=chk.filter(c=>c.d).length;
  const prop=isNew?null:P.find(p=>p.id===liveSched?.pid);
  const detailPri=liveSched?.pri||'NORMAL';
  const detailPriC=schedulePriColor(detailPri);
  const detailPriBg=schedulePriBg(detailPri);

  if(isNew) return(
    <>
    {alertMsg&&<AlertDialog msg={alertMsg} onClose={()=>setAlertMsg(null)}/>}
    <Win title="일정 등록" ic="ti-calendar-plus" onClose={onClose} w={600}
      acts={null}
      ch={
        <div style={WIN_COLUMN}>
        <div style={{...WIN_BODY_SCROLL,padding:'24px 26px 28px',display:'flex',flexDirection:'column',gap:18}}>
          <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>일정 제목 <span style={{color:C.brand}}>*</span></div>
            <input className="inp" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="일정 제목을 입력하세요"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>시작일 <span style={{color:C.brand}}>*</span></div>
              <input type="date" className="inp" value={newDate} onChange={e=>onNewStartDateChange(e.target.value)}/></div>
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>종료일 <span style={{fontSize:12,color:C.txP,fontWeight:500}}>(선택)</span></div>
              <input type="date" className="inp" value={newDateEnd} onChange={e=>setNewDateEnd(e.target.value)}/></div>
          </div>
          <div style={{fontSize:12,color:C.txP,marginTop:-6,lineHeight:1.45}}>종료일을 비우면 당일 일정입니다.</div>
          <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>시간</div>
            <input type="time" className="inp" value={newTime} onChange={e=>setNewTime(e.target.value)} style={{maxWidth:180}}/></div>
          <div>
            <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>우선순위</div>
            <PriorityPicker value={newPri} onChange={setNewPri}/>
          </div>
          <div onClick={()=>setNewPropDropOpen(false)}>
            <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>연결 매물 <span style={{fontSize:12,color:C.txP}}>(선택)</span></div>
            <DropSelect
              sel={newSelProp}
              onSel={(p)=>setNewPid(p.id)}
              onClear={()=>{setNewPid(null);setNewPropSearch('');}}
              search={newPropSearch}
              setSearch={setNewPropSearch}
              open={newPropDropOpen}
              setOpen={setNewPropDropOpen}
              items={newFilteredProps}
              renderChip={propLinkedChip}
              renderItem={(p)=><PropDropListItem p={p}/>}
              placeholder="도로명·지번·건물명 검색..."
            />
          </div>
          <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>메모</div>
            <textarea className="ta" rows={4} value={newMemo} onChange={e=>setNewMemo(e.target.value)} placeholder="일정 관련 메모 및 준비사항"/></div>
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <span style={{fontSize:12,color:C.txM,fontWeight:600}}>체크리스트 <span style={{fontSize:12,color:C.txP}}>(선택)</span></span>
              <Btn role="toolbar-secondary" ch="항목 추가" ic="ti-plus" on={()=>setChk(r=>[...r,{t:'',d:false}])}/>
            </div>
            {chk.map((c,i)=>(
              <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                <input className="inp" value={c.t} onChange={e=>setChk(r=>r.map((x,j)=>j===i?{...x,t:e.target.value}:x))} placeholder={`항목 ${i+1}`} style={{flex:1}}/>
                <Btn role="row-delete" ch="×" on={()=>setChk(r=>r.filter((_,j)=>j!==i))}/>
              </div>
            ))}
          </div>
        </div>
        <ActionBar saveLabel={saving?'저장 중…':'저장하기'} onSave={handleNewSave} saveDisabled={saving}/>
        </div>
      }/>
    </>
  );
  return(
    <Win title={liveSched?.title||'일정 상세'} ic="ti-calendar-event" onClose={onClose} w={640}
      acts={null}
      ch={
        <div style={WIN_COLUMN}>
        <div style={{...WIN_BODY_SCROLL}}>
          {/* Priority + Date Header */}
          <div style={{padding:'18px 24px 14px',borderBottom:`1px solid ${C.bdr}`,background:C.surf,borderLeft:`4px solid ${detailPriC}`}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <span style={{fontSize:12,padding:'4px 12px',borderRadius:20,background:detailPriBg,color:detailPriC,fontWeight:700}}>{PRI_L[detailPri]||'보통'}</span>
              <span style={{fontSize:13,color:C.txS,fontWeight:500}}>{fmtSchedulePeriodKo(liveSched)}{liveSched?.time?` ${liveSched.time}`:''}</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:C.tx,lineHeight:1.3}}>{liveSched?.title}</div>
            {prop&&<div onClick={()=>onOpen&&onOpen('pd',prop)} style={{marginTop:8,display:'flex',alignItems:'center',gap:6,fontSize:13,color:C.info,cursor:'pointer',fontWeight:500}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg></span>
              {prop.bldg||propDisplayAddr(prop)}
            </div>}
          </div>
          {/* Memo */}
          {liveSched?.memo&&(
            <div style={{padding:'16px 24px',borderBottom:`1px solid ${C.bdr}`}}>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:8,textTransform:'uppercase',letterSpacing:'.04em'}}>메모</div>
              <div style={{fontSize:14,color:C.txS,lineHeight:1.7,background:C.surf2,borderRadius:8,padding:'12px 14px',borderLeft:`3px solid ${C.bdr}`,maxHeight:120,overflowY:'auto'}}>{liveSched?.memo}</div>
            </div>
          )}
          {/* Checklist */}
          {chk.length>0&&(
            <div style={{padding:'16px 24px'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:600,color:C.txM,textTransform:'uppercase',letterSpacing:'.04em'}}>체크리스트</span>
                <span style={{fontSize:12,color:C.txM}}>{done}/{chk.length}</span>
                <div style={{flex:1,height:5,background:C.surf3,borderRadius:3}}>
                  <div style={{width:`${chk.length>0?done/chk.length*100:0}%`,height:'100%',background:done===chk.length?C.ok:C.brand,borderRadius:3,transition:'width .3s'}}/>
                </div>
                <span style={{fontSize:12,color:done===chk.length?C.ok:C.txM,fontWeight:done===chk.length?600:400}}>{done===chk.length?'완료 ✓':''}</span>
              </div>
              {chk.map((c,i)=>(
                <div key={i} onClick={()=>toggleChk(i)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:9,cursor:'pointer',marginBottom:6,background:c.d?C.okBg:C.surf,border:`1.5px solid ${c.d?C.okBd:C.bdr}`,transition:'all .12s'}}>
                  <div style={{width:20,height:20,borderRadius:6,border:'1.5px solid',borderColor:c.d?C.ok:C.bdrSt,background:c.d?C.ok:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .12s'}}>
                    {c.d&&<span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0,color:'#fff'}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                  </div>
                  <span style={{fontSize:14,color:c.d?C.txM:C.tx,textDecoration:c.d?'line-through':'none',flex:1}}>{c.t}</span>
                </div>
              ))}
            </div>
          )}
          {chk.length===0&&!liveSched?.memo&&(
            <div style={{padding:'40px',textAlign:'center',color:C.txM,fontSize:13}}>
              메모나 체크리스트가 없습니다
            </div>
          )}
        </div>
        <ActionBar
          saveLabel="수정"
          onSave={openEdit}
          saveDisabled={!canEdit}
          saveDisabledTitle={PERMISSION_DENIED_TOOLTIP}
          onDelete={()=>onDelete&&onDelete(liveSched)}
          deleteDisabled={!canEdit||!onDelete}
          deleteDisabledTitle={PERMISSION_DENIED_TOOLTIP}
          onCancel={onClose}/>
        </div>
      }/>
  );
};
/* ═══ PROPERTY EDIT ═══ */
const PropEdit=({prop,onClose,onDelete,onSaved})=>{
  const { accountDefaults }=useAuth();
  const RENTALS=useRentals(prop.id);
  const [showRental,setShowRental]=useState(false);
  const [trade,setTrade]=useState(prop.trade||'SALE');
  const [mainType,setMainType]=useState(prop.main||'COMMERCIAL');
  const [subType,setSubType]=useState(prop.sub||'WHOLE_BUILDING');
  const [status,setStatus]=useState(prop.status||'ACTIVE');
  const [pub,setPub]=useState(prop.pub?'true':'false');
  const [photoSlots,setPhotoSlots]=useState(()=>normalizePhotoSlots(prop.photos));
  const [priceForm,setPriceForm]=useState(()=>priceFormFromProperty(prop));
  const [detailForm,setDetailForm]=useState(()=>detailFormFromProperty(prop,accountDefaults));
  useEffect(()=>{
    setPhotoSlots(normalizePhotoSlots(prop.photos));
  },[prop.id]);
  useEffect(()=>{
    setDetailForm(f=>({
      ...f,
      agentName:prop.agentName||f.agentName||accountDefaults.displayName,
      agentTel:prop.agentTel||f.agentTel||accountDefaults.phone,
    }));
  },[prop.id,accountDefaults.displayName,accountDefaults.phone]);
  const [landEdit,setLandEdit]=useState(()=>landFromProperty(prop));
  const [buildingEdit,setBuildingEdit]=useState(()=>buildingFromProperty(prop));
  const [roadSearch,setRoadSearch]=useState(propDisplayAddr(prop));
  const [addressModalOpen,setAddressModalOpen]=useState(false);
  const {
    lookup, addressKeys, locationForm, setLocationForm,
    landForm, setLandForm, buildingForm, setBuildingForm,
    handleAddressFetchSuccess, refetchPublicData, isLoading,
  }=usePropertyAddressLookup({ mode:'edit' });
  const subOpts=PROP_SUB[mainType]||{};
  useEffect(()=>{
    if(lookup.status==='success'){
      setLandEdit(landForm);
      setBuildingEdit(buildingForm);
    }
  },[lookup.status, lookup.fetchedAt, landForm, buildingForm]);
  const onAddressSearch=()=>setAddressModalOpen(true);
  const onAddressSelected=async (addr)=>{
    setRoadSearch(addr.jibunAddr||addr.roadAddr||'');
    await handleAddressFetchSuccess(addr);
  };
  const apiBadge=lookup.status==='loading'?'조회중…'
    :lookup.status==='success'?'API완료'
    :lookup.status==='error'?'API오류'
    :lookup.status==='address_confirmed'?'코드대기':'API';
  const handleSave=async()=>{
    const addressFields=buildPropertyAddressFields({
      jibunAddr: locationForm.jibunAddr || prop.jibunAddr || prop.addr,
      roadAddr: locationForm.roadAddr || prop.roadAddr || propRoadAddr(prop),
    });
    const mapCoordFields=await resolveMapCoordFieldsForSave(prop, {
      ...addressFields,
      bldg: detailForm.title || '',
    });
    const changes={
      trade,main:mainType,sub:subType,status,pub:pub==='true',photos:photoSlotsToSave(photoSlots),
      tag:PROP_SUB[mainType]?.[subType]||'',
      ...addressFields,
      ...mapCoordFields,
      ownerTel: normalizePhone(locationForm.ownerTel ?? prop.ownerTel ?? ''),
      roadInfo: locationForm.roadInfo ?? prop.roadInfo ?? '',
      bldg: detailForm.title || '',
      promo: detailForm.promo || '',
      memo: detailForm.memo || '',
      discoUrl: normalizeDiscoUrl(detailForm.discoUrl) || '',
      agentName: detailForm.agentName || '',
      agentTel: normalizePhone(detailForm.agentTel || ''),
      ...buildPriceFields(trade, priceForm),
      ...landToPropertyFields(landEdit),
      ...buildingToPropertyFields(buildingEdit),
    };
    if(trade==='SALE'||trade==='PRESALE'){
      const price=parseFormNum(priceForm.price)??prop.price??0;
      const metrics=buildSaleInvestmentMetrics(price, RENTALS, {
        ...prop,
        price,
        maintenance: parseFormNum(priceForm.maintenance),
      });
      changes.roi=metrics.yieldLabel;
      changes.realInvest=metrics.realInvest!=null?String(metrics.realInvest):'';
    }
    await updateProperty(prop.id,changes);
    showNotification('수정되었습니다.','info');
    if(onSaved) onSaved({...prop,...changes});
    else onClose();
  };
  const FL=({label,req,hint})=>(
    <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>
      {label}{req&&<span style={{color:C.brand}}> *</span>}
      {hint&&<span style={{color:C.txP,fontWeight:400,marginLeft:4}}>{hint}</span>}
    </div>
  );
  const rentalProp={...prop,trade,price:parseFormNum(priceForm.price)??prop.price??0};
  const saleInvest=buildSaleInvestmentMetrics(rentalProp.price, RENTALS, rentalProp);
  if(showRental) return(<RentalWin prop={rentalProp} onClose={()=>setShowRental(false)}/>);
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      <AddressSearchModal
        open={addressModalOpen}
        onClose={()=>setAddressModalOpen(false)}
        onSelect={onAddressSelected}
        initialKeyword={roadSearch}
      />
      <PH title="매물 수정" sub={propDisplayAddr(prop)}
        acts={<Btn role="page-secondary" ch="상세로" ic="ti-arrow-left" on={onClose}/>}
      />
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'16px 28px 0'}}>
            <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)',marginBottom:20}}>

              {/* 1. 매물종류 · 상태 */}
              <SecLabel ch="매물종류 · 상태"/>
              <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,borderBottom:`1px solid ${C.bdr}`}}>
                <div><FL label="매물 대분류" req/>
                  <select className="sel" value={mainType} onChange={e=>{setMainType(e.target.value);setSubType(Object.keys(PROP_SUB[e.target.value]||{})[0]||'');}}>
                    {Object.entries(PROP_MAIN).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
                  </select></div>
                <div><FL label="매물 소분류" req/>
                  <select className="sel" value={subType} onChange={e=>setSubType(e.target.value)}>
                    {Object.entries(subOpts).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
                  </select></div>
                <div><FL label="진행 상태" req/>
                  <select className="sel" value={status} onChange={e=>setStatus(e.target.value)}>
                    <option value="NEW">신규</option><option value="ACTIVE">진행중</option>
                    <option value="HOLD">보류</option><option value="COMPLETED">계약완료</option>
                  </select></div>
                <div><FL label="공개 여부" req/>
                  <select className="sel" value={pub} onChange={e=>setPub(e.target.value)}>
                    <option value="true">공개</option><option value="false">비공개</option>
                  </select></div>
              </div>

              {/* 2. 소재지 */}
              <SecLabel ch="소재지" badge={apiBadge}/>
              <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bdr}`,display:'flex',flexDirection:'column',gap:12}}>
                {lookup.error&&<div style={{fontSize:12,color:C.err,padding:'8px 12px',background:C.errBg,borderRadius:7}}>{lookup.error}</div>}
                {lookup.warnings?.length>0&&lookup.status!=='idle'&&(
                  <div style={{fontSize:12,color:C.warn,padding:'8px 12px',background:C.warnBg,borderRadius:7}}>
                    {lookup.warnings.join(' · ')}
                  </div>
                )}
                <div style={{display:'flex',gap:10}}>
                  <input className="inp" value={roadSearch} onChange={e=>setRoadSearch(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') onAddressSearch(); }}
                    placeholder="주소 검색 — 도로명·지번·건물명 (예: 상계동 737, 동일로215길 48)" style={{flex:1}} disabled={isLoading}/>
                  <Btn role="page-primary" ch={isLoading?'조회중…':'주소 검색'} ic="ti-search" on={onAddressSearch}/>
                  <Btn role="page-secondary" ch="재조회" ic="ti-refresh" on={refetchPublicData}/>
                </div>
                {addressKeys.pnu&&(
                  <div style={{fontSize:11,color:C.txP,fontFamily:'monospace',letterSpacing:'.04em'}}>
                    PNU {addressKeys.pnu} · 시군구 {addressKeys.sigunguCd} · 법정동 {addressKeys.bjdongCd} · 본번 {addressKeys.bun} · 부번 {addressKeys.ji}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div><FL label="지번주소"/>
                    <input className="inp" value={locationForm.jibunAddr||prop.jibunAddr||prop.addr||''} readOnly style={{background:C.surf2}}/></div>
                  <div><FL label="도로명주소"/>
                    <input className="inp" value={locationForm.roadAddr||prop.roadAddr||propRoadAddr(prop)||''} readOnly style={{background:C.surf2}}/></div>
                  <div><FL label="소유주 연락처"/>
                    <PhoneInput value={locationForm.ownerTel||prop.ownerTel||''} onChange={e=>setLocationForm(f=>({...f,ownerTel:e.target.value}))} placeholder="예: 010-0000-0000"/></div>
                  <div><FL label="도로상황"/>
                    <input className="inp" value={locationForm.roadInfo||prop.roadInfo||''} onChange={e=>setLocationForm(f=>({...f,roadInfo:e.target.value}))} placeholder="예: 8m × 4m"/></div>
                </div>
              </div>

              {/* 3. 거래방식 · 가격 */}
              <SecLabel ch="거래방식 · 가격"/>
              <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bdr}`}}>
                <PropPriceSection trade={trade} setTrade={setTrade} priceForm={priceForm} setPriceForm={setPriceForm} idPrefix="edit_" mainType={mainType} subType={subType}/>
              </div>

              {/* 3-1. 임대차관리 (매매·분양) */}
              {(trade==='SALE'||trade==='PRESALE')&&<>
                <SecLabel ch="임대차관리"/>
                <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.bdr}`}}>
                  {RENTALS.length>0?(()=>{
                    const totalDep=saleInvest.existingDeposit;
                    const totalRent=RENTALS.reduce((s,r)=>s+(parseFloat(r.rent)||0),0);
                    const totalMaint=RENTALS.reduce((s,r)=>s+(parseFloat(r.maint)||0),0);
                    const vacantCount=RENTALS.filter(r=>r.dep===null&&r.rent===null).length;
                    const rentalSummaryCell={
                      padding:'10px 14px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',
                    };
                    return(
                      <div style={{border:`1px solid ${C.bdr}`,borderRadius:8,overflow:'hidden',marginBottom:12}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
                          {[
                            ['등록 호실',`${RENTALS.length}건`,C.tx],
                            ['공실',vacantCount>0?`${vacantCount}개층`:'없음',vacantCount>0?C.warn:C.ok],
                            ['수익률',saleInvest.yieldLabel,C.ok],
                          ].map(([l,v,c],i)=>(
                            <div key={i} style={{...rentalSummaryCell,borderRight:i<2?`1px solid ${C.bdr}`:'none',borderBottom:`1px solid ${C.bdr}`,background:C.surf2}}>
                              <div style={{fontSize:11,color:C.txM,fontWeight:500,marginBottom:4}}>{l}</div>
                              <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)'}}>
                          {[
                            ['총 보증금',formatKoreanAmountFromMan(totalDep),C.tx],
                            ['총 임대료',formatKoreanAmountFromMan(totalRent),C.tx],
                            ['총 관리비',formatKoreanAmountFromMan(totalMaint),C.tx],
                          ].map(([l,v,c],i)=>(
                            <div key={i} style={{...rentalSummaryCell,borderRight:i<2?`1px solid ${C.bdr}`:'none',background:'#fff'}}>
                              <div style={{fontSize:11,color:C.txM,fontWeight:500,marginBottom:4}}>{l}</div>
                              <div style={{fontSize:14,fontWeight:600,color:c}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })():(
                    <div style={{fontSize:13,color:C.txM,lineHeight:1.6,marginBottom:12}}>
                      층별 임대차 내역을 등록하면 투자분석(기존임차보증금·월임대료·수익률)이 자동 반영됩니다.
                    </div>
                  )}
                  <Btn role="block-link" ch={RENTALS.length>0?'임대차 내역 관리':'임대차 등록 · 관리'} ic="ti-table" full on={()=>setShowRental(true)}/>
                </div>
              </>}

              {/* 4. 토지정보 */}
              <SecLabel ch="토지정보" badge={apiBadge}/>
              <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,borderBottom:`1px solid ${C.bdr}`}}>
                <PropLandFields landForm={landEdit} setLandForm={setLandEdit} readOnlyStyle={lookup.status==='success'?{background:C.surf2}:undefined}/>
              </div>

              {/* 5. 건물정보 */}
              <SecLabel ch="건물정보" badge={apiBadge}/>
              <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,borderBottom:`1px solid ${C.bdr}`}}>
                <PropBuildingFields buildingForm={buildingEdit} setBuildingForm={setBuildingEdit} readOnlyStyle={lookup.status==='success'?{background:C.surf2}:undefined}/>
              </div>

              {/* 6. 사진 */}
              <SecLabel ch="사진 (선택, 최대 3장)"/>
              <PropertyPhotoPicker slots={photoSlots} onChange={setPhotoSlots} compact/>

              {/* 7. 세부내용 */}
              <SecLabel ch="세부내용"/>
              <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div style={{gridColumn:'1/-1'}}><FL label="게시글 제목" req/>
                  <input className="inp" value={detailForm.title} onChange={e=>setDetailForm(f=>({...f,title:e.target.value}))} placeholder="예: 영등포 핵심 상권 상가건물 매매"/></div>
                <div><FL label="담당자 이름"/>
                  <input className="inp" value={detailForm.agentName} onChange={e=>setDetailForm(f=>({...f,agentName:e.target.value}))} placeholder="담당자 이름"/></div>
                <div><FL label="담당자 연락처"/>
                  <PhoneInput value={detailForm.agentTel} onChange={e=>setDetailForm(f=>({...f,agentTel:e.target.value}))} placeholder="010-0000-0000"/></div>
                <div style={{gridColumn:'1/-1'}}><FL label="홍보문구 (공개)"/>
                  <textarea className="ta" rows={9} value={detailForm.promo} onChange={e=>setDetailForm(f=>({...f,promo:e.target.value}))} placeholder="외부에 공개되는 홍보문구"/></div>
                <div style={{gridColumn:'1/-1'}}><FL label="내부 메모 (비공개)"/>
                  <textarea className="ta" rows={3} value={detailForm.memo} onChange={e=>setDetailForm(f=>({...f,memo:e.target.value}))} placeholder="내부 참고 사항 (공개 안 됨)"/></div>
                <div style={{gridColumn:'1/-1'}}><FL label="디스코 상세 링크" hint="선택"/>
                  <input className="inp" value={detailForm.discoUrl||''} onChange={e=>setDetailForm(f=>({...f,discoUrl:e.target.value}))} placeholder="디스코에서 복사한 주소 링크가 있다면 입력해주세요 (선택)"/></div>
              </div>
            </div>
        </div>
        <ActionBar saveLabel="저장" onSave={handleSave} onDelete={onDelete?()=>onDelete(prop):null} onCancel={onClose}/>
      </div>
    );
  };


/** 북마크/직접 URL 접근 시 목록으로 돌아가며 Win 팝업으로 상세 표시 */
const PropDetailRedirect=({onOpen})=>{
  const { id }=useParams();
  const navigate=useNavigate();
  const props=usePropertiesQuery();
  useEffect(()=>{
    if(props===undefined) return;
    const prop=findPropertyByRouteId(props,id);
    if(prop) onOpen('pd',prop);
    navigate('/properties',{replace:true});
  },[props,id,navigate,onOpen]);
  return <RouteLoading label="매물 상세 여는 중…"/>;
};

const TeamManageRoute=()=>{
  const [toast,setToast]=useState(null);
  const location=useLocation();
  useEffect(()=>{
    const msg=location.state?.toast;
    if(typeof msg==='string'&&msg.trim()){
      setToast(msg.trim());
      window.history.replaceState({}, '', location.pathname);
    }
  },[location.state, location.pathname]);
  useEffect(()=>{
    if(!toast) return undefined;
    const t=setTimeout(()=>setToast(null),2500);
    return ()=>clearTimeout(t);
  },[toast]);
  return(<>
  {toast&&<div style={{position:'fixed',top:72,left:'50%',transform:'translateX(-50%)',zIndex:400,background:'#1A2332',color:'#fff',padding:'10px 18px',borderRadius:8,fontSize:13,boxShadow:'0 4px 16px rgba(0,0,0,.2)'}}>{toast}</div>}
    <TeamManagementPage onToast={setToast}/>
  </>);
};

const PropEditRoute=({softDelete,onOpen})=>{
  const { id }=useParams();
  const navigate=useNavigate();
  const props=usePropertiesQuery();
  const { user, companyRole, memberPermissions }=useAuth();
  if(props===undefined) return <RouteLoading label="매물 정보 불러오는 중…"/>;
  const prop=findPropertyByRouteId(props,id);
  if(!prop) return <Navigate to="/properties" replace />;
  if(!canWriteRecord(prop,user?.id,companyRole,memberPermissions,'properties')){
    return <Navigate to="/properties" replace />;
  }
  const goDetail=()=>{
    navigate('/properties');
    onOpen('pd',prop);
  };
  return (
    <PropEdit
      prop={prop}
      onClose={goDetail}
      onSaved={goDetail}
      onDelete={(item)=>softDelete('props',item,propDisplayAddr(item)||item.bldg,()=>navigate('/properties'))}
    />
  );
};

/* ═══ GLOBAL APP STYLES (메인 + 팝업 공통) ═══ */
const APP_STYLES_ID='landnote-app-styles-v2';
function useInjectAppStyles(){
  useEffect(()=>{
    if(document.getElementById(APP_STYLES_ID)) return undefined;
    const link=document.createElement('link');
    link.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';
    link.rel='stylesheet';
    document.head.appendChild(link);
    const s=document.createElement('style');
    s.id=APP_STYLES_ID;
    s.textContent=`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1A2332;text-align:left}#root{width:100%;height:100%;font-family:inherit;text-align:left}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}input,textarea,select{font-family:inherit;text-align:left}button{font-family:inherit;cursor:pointer}input:focus,textarea:focus,select:focus{outline:none}.tbl{width:100%;border-collapse:collapse;table-layout:auto}.tbl th{background:#F8F9FB;color:#6B7280;font-size:12px;font-weight:600;padding:0 16px;height:49px;text-align:left;border-bottom:1.5px solid #E8EAED;white-space:nowrap;letter-spacing:.03em;text-transform:uppercase;position:sticky;top:0;z-index:1}.tbl td{padding:0 16px;height:57px;border-bottom:1px solid #E8EAED;color:#0F172A;font-size:14px;vertical-align:middle;white-space:normal;text-align:left;word-break:keep-all}.tbl tbody tr:hover td{background:#FAFBFF;cursor:pointer}.tbl-fixed{table-layout:fixed;width:100%}.tbl-fixed td,.tbl-fixed th{overflow:hidden}.cell-ellipsis{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;max-width:100%}.cell-wrap{display:block;white-space:normal;word-break:keep-all;overflow-wrap:break-word;line-height:1.35;min-width:0}.inp{height:36px;min-height:36px;line-height:1.25;border:1.5px solid #E2E8F0;border-radius:7px;padding:0 12px;font-size:14px;color:#0F172A;background:#fff;width:100%;display:block;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}.inp:focus{border-color:#C8102E;box-shadow:0 0 0 3px rgba(200,16,46,.09)}.inp::placeholder{color:#94A3B8;font-size:13px}.sel{height:36px;min-height:36px;line-height:1.25;border:1.5px solid #E2E8F0;border-radius:7px;padding:0 10px;font-size:14px;color:#0F172A;background:#fff;cursor:pointer;width:100%;display:block;box-sizing:border-box}.sel:focus{border-color:#C8102E}.ta{display:block;width:100%;box-sizing:border-box;border:1.5px solid #E2E8F0;border-radius:7px;padding:10px 12px;font-size:14px;color:#0F172A;background:#fff;resize:vertical;min-height:72px}.ta:focus{border-color:#C8102E;box-shadow:0 0 0 3px rgba(200,16,46,.09)}.ta::placeholder{color:#94A3B8;font-size:13px}.nav-item{display:flex;align-items:center;gap:10px;height:40px;padding:0 10px;border-radius:8px;cursor:pointer;color:rgba(255,255,255,.52);font-size:14px;transition:background .1s,color .1s;margin-bottom:2px;text-align:left}.nav-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85)}.nav-item.active{background:rgba(200,16,46,.16);color:#fff;font-weight:600}@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(s);
    return ()=>{};
  },[]);
}

function AuthRootRedirect() {
  const [searchParams] = useSearchParams();
  const legacyInvite = searchParams.get('invite')?.trim();
  if (legacyInvite) {
    return <Navigate to={`${AUTH_PATHS.signupInvite}?token=${encodeURIComponent(legacyInvite)}`} replace />;
  }
  return <Navigate to={AUTH_PATHS.login} replace />;
}

function AuthPublicRoutes({ onLegacyLogin }) {
  return (
    <Routes>
      <Route path={AUTH_PATHS.login} element={<LoginScreen variant="login" onLegacyLogin={onLegacyLogin} />} />
      <Route path={AUTH_PATHS.signup} element={<SignUpPage onLegacyLogin={onLegacyLogin} />} />
      <Route path={AUTH_PATHS.signupInvite} element={<InviteSignUpPage onLegacyLogin={onLegacyLogin} />} />
      <Route path="/" element={<AuthRootRedirect />} />
      <Route path="*" element={<Navigate to={AUTH_PATHS.login} replace />} />
    </Routes>
  );
}

/* ═══ MAIN APP ═══ */
function AppShell(){
  const { user, loading: authLoading, profileLoading, needsSignupCompletion, signOut, passwordRecovery } = useAuth();
  const isMobile = useIsMobile();
  const isMobileDevice = useIsMobileDevice();
  const [forceDesktop, setForceDesktopState] = useState(getForceDesktop);
  const viewDesktop = () => { setForceDesktop(true); setForceDesktopState(true); };
  const viewMobile = () => { setForceDesktop(false); setForceDesktopState(false); };
  const [legacyUnlocked, setLegacyUnlocked] = useState(false);

  // 로그인 시 seed만 — prepareLocalStore는 Auth 세션 sync가 pull 직전에 수행 (경합 방지)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(profileLoading) return;
      if(cancelled) return;
      const skipSeed=isSupabaseConfigured&&!!user?.id&&user.id!=='dev-local';
      await seedDatabase({ skipSeed });
    })();
    return ()=>{ cancelled=true; };
  },[user?.id, profileLoading]);
  const navigate=useNavigate();
  const location=useLocation();
  const properties=useProperties();
  const [wins,setWins]=useState([]);
  const [showSet,setShowSet]=useState(false);
  const [sidebarExpanded,setSidebarExpanded]=useState(false);
  const [folders,setFolders]=useState(()=>loadFolderState()?.folders??FOLDERS);
  const [propFolders,setPropFolders]=useState(()=>loadFolderState()?.propFolders??PROP_FOLDERS);
  useEffect(()=>{ saveFolderState(folders,propFolders); },[folders,propFolders]);

  useEffect(() => {
    if (!user?.id || user.id === 'dev-local') return;
    const saved = loadFolderState();
    if (saved) {
      setFolders(saved.folders);
      setPropFolders(saved.propFolders);
    } else {
      const defaults = getDefaultFolderState();
      setFolders(defaults.folders);
      setPropFolders(defaults.propFolders);
    }
  }, [user?.id]);
  const [globalConfirm,setGlobalConfirm]=useState(null);
  const [toast,setToast]=useState({show:false,message:'',type:''});
  const toastHideTimerRef=useRef(null);
  const dismissToast=useCallback(()=>{
    if(toastHideTimerRef.current){clearTimeout(toastHideTimerRef.current);toastHideTimerRef.current=null;}
    setToast(prev=>({...prev,show:false}));
  },[]);
  const showNotification=useCallback((message,type='success')=>{
    if(toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current);
    setToast({show:true,message,type});
    const hideMs=1000;
    toastHideTimerRef.current=setTimeout(()=>{
      setToast(prev=>({...prev,show:false}));
      toastHideTimerRef.current=null;
    },hideMs);
  },[]);
  useEffect(()=>{
    notifyRef.fn=showNotification;
    return()=>{
      notifyRef.fn=null;
      if(toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current);
    };
  },[showNotification]);

  const menuId=pathToMenuId(location.pathname);
  const titleLabel=resolveTitle(location.pathname, {}, properties);
  const navTo=(id)=>navigate(MENU_PATHS[id]||'/dashboard');

  const softDelete=(type,item,label,afterFn)=>setGlobalConfirm({
    msg:'휴지통으로 이동하시겠습니까?',
    subMsg:`"${label}"이(가) 휴지통으로 이동됩니다. 언제든지 복구할 수 있습니다.`,
    confirmLabel:'이동',
    danger:false,
    onConfirm:async()=>{
      try{
        if(type==='props') await softDeleteProperty(item.id);
        else if(type==='custs') await softDeleteCustomer(item.id);
        else if(type==='scheds') await softDeleteSchedule(item.id);
        else if(type==='calls') await softDeleteCallLog(item.id);
        showNotification('삭제한 항목은 휴지통으로 이동되었습니다.','warning');
      }catch(err){
        if(err?.message==='FORBIDDEN'){
          showNotification(PERMISSION_DENIED_TOOLTIP,'warning');
        }else{
          console.error('[softDelete]',err);
          showNotification('삭제에 실패했습니다.','error');
        }
      }
      setGlobalConfirm(null);
      if(afterFn) afterFn();
    }
  });

  const openWin=useCallback((type,data)=>{
    if(type==='pd'){
      setWins(prev=>{
        const filtered=prev.filter(w=>w.type!=='cd'&&!(w.type==='pd'&&w.data?.id===data?.id));
        return [...filtered,{type,data,wid:`pd-${Date.now()}`}];
      });
      return;
    }
    if(type==='pe'){
      navigate(`/properties/${data.id}/edit`);
      return;
    }
    setWins(prev=>{
      const filtered=prev.filter(w=>!(w.type===type&&w.data?.id===data?.id));
      return[...filtered,{type,data,wid:`${type}-${Date.now()}`}];
    });
  },[navigate]);
  const closeWin=useCallback((wid)=>setWins(prev=>prev.filter(w=>w.wid!==wid)),[]);
  const closeCustomerWins=useCallback((custId)=>{
    setWins(prev=>prev.filter(w=>!((w.type==='cd'||w.type==='cf')&&w.data?.id===custId)));
  },[]);

  const trashCount=useOwnerTrashCount();

  const handleSignOut=async()=>{
    clearPropListState();
    setLegacyUnlocked(false);
    await signOut();
    navigate('/dashboard');
  };

  if(authLoading) return <RouteLoading label="인증 확인 중…"/>;

  if(passwordRecovery||location.pathname===PASSWORD_RESET_REDIRECT_PATH){
    return <ResetPasswordScreen/>;
  }

  if(user?.id&&user.id!=='dev-local'&&profileLoading){
    return <RouteLoading label="프로필 확인 중…"/>;
  }

  const legacyLoginProps = {
    onLegacyLogin: () => { clearPropListState(); setLegacyUnlocked(true); navigate('/dashboard'); },
  };

  if(user&&needsSignupCompletion){
    if (location.pathname === AUTH_PATHS.signupInvite) {
      return <InviteSignUpPage {...legacyLoginProps} />;
    }
    if (location.pathname === AUTH_PATHS.signup) {
      return <LoginScreen variant="signup" {...legacyLoginProps} />;
    }
    return <Navigate to={AUTH_PATHS.signup} replace />;
  }

  if(!user&&!legacyUnlocked) return <AuthPublicRoutes {...legacyLoginProps} />;

  const appRoutes=(
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard onOpen={openWin} onNav={navTo} onNavWithTab={(tab)=>navigate(`/properties?tab=${tab}`)} onNotify={showNotification}/>} />
        <Route path="/properties" element={<PropList onOpen={openWin} onNav={navTo} folders={folders} propFolders={propFolders} setPropFolders={setPropFolders} onDeleteProperty={(p,after)=>softDelete('props',p,propDisplayAddr(p)||p.bldg,after||(()=>{}))}/>} />
        <Route path="/properties/:id/edit" element={<PropEditRoute softDelete={softDelete} onOpen={openWin}/>} />
        <Route path="/properties/:id" element={<PropDetailRedirect onOpen={openWin}/>} />
        <Route path="/mapview" element={<MapView onOpen={openWin} Btn={Btn} PH={PH}/>} />
        <Route path="/register/bulk" element={<PropertyBulkUploadPage onNav={navTo}/>} />
        <Route path="/register" element={<PropRegister onNav={navTo}/>} />
        <Route path="/customers/bulk" element={<CustomerBulkUploadPage onNav={navTo}/>} />
        <Route path="/customers" element={<CustList onOpen={openWin} onNav={navTo} onDeleteCustomer={(c,after)=>softDelete('custs',c,c.name,()=>{if(after)after();closeCustomerWins(c.id);})} onCustomersDeleted={(ids)=>ids.forEach((id)=>closeCustomerWins(id))}/>} />
        <Route path="/calls" element={<CallLogs onOpen={openWin} onDelete={(item)=>softDelete('calls',item,item.content?.slice(0,20)||'통화기록',()=>{})}/>} />
        <Route path="/calendar" element={<Calendar onOpen={openWin}/>} />
        <Route path="/backup" element={<Backup/>} />
        <Route path="/trash" element={<Trash/>} />
        <Route path="/team/manage" element={<TeamManageRoute/>} />
        <Route path="/settings/withdraw" element={<WithdrawAccountPage/>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );

  /* 모바일 조회 전용 라우트 — PC 전용 등록/일괄등록/백업/휴지통/멤버관리는 제외 */
  const mobileRoutes=(
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<MobileDashboard/>} />
        <Route path="/properties" element={<MobilePropertyList/>} />
        <Route path="/properties/:id" element={<MobilePropertyDetail/>} />
        <Route path="/mapview" element={<MobileMapView/>} />
        <Route path="/customers" element={<MobileCustomerList/>} />
        <Route path="/customers/:id" element={<MobileCustomerDetail/>} />
        <Route path="/calls" element={<MobileCallList/>} />
        <Route path="/calls/:id" element={<MobileCallDetail/>} />
        <Route path="/calendar" element={<MobileScheduleList/>} />
        <Route path="/calendar/:id" element={<MobileScheduleDetail/>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );

  const overlays=(
    <>
      {globalConfirm&&<ConfirmDialog msg={globalConfirm.msg} subMsg={globalConfirm.subMsg} confirmLabel={globalConfirm.confirmLabel} danger={globalConfirm.danger||false} onConfirm={globalConfirm.onConfirm} onCancel={()=>setGlobalConfirm(null)}/>}
      {showSet&&<Settings onClose={()=>setShowSet(false)}/>}
      {wins.map(w=>{
          const close=()=>closeWin(w.wid);
          if(w.type==='fm') return (<FolderManageWin key={w.wid} folders={folders} setFolders={setFolders} propFolders={propFolders} setPropFolders={setPropFolders} onClose={close} onOpen={openWin}/>);
          if(w.type==='cd') return (<CustDetail key={w.wid} cust={w.data} onClose={close} onOpen={openWin} onDelete={(item)=>softDelete('custs',item,item.name,()=>closeCustomerWins(item.id))} onDeleteCall={(item)=>softDelete('calls',item,item.content?.slice(0,20)||'통화기록',()=>{})}/>);
          if(w.type==='cf') return (
            <CustForm
              key={w.wid}
              custData={w.data}
              onClose={close}
              onSaved={(updated)=>{
                if(!updated?.id) return;
                setWins(prev=>prev.map(win=>{
                  if(win.type==='cd'&&win.data?.id===updated.id) return {...win,data:{...win.data,...updated}};
                  return win;
                }));
              }}
            />
          );
          if(w.type==='ce') return (<CallEditWin key={w.wid} callData={w.data} onClose={close} onSaved={()=>{}} onDelete={(item)=>softDelete('calls',item,item.content?.slice(0,20)||'통화기록',close)}/>);
          if(w.type==='sd') return (<SchedDetail key={w.wid} sched={w.data} onClose={close} onOpen={openWin} onDelete={(item)=>softDelete('scheds',item,item?.title||'일정',close)}/>);
          if(w.type==='sf') return (<SchedForm key={w.wid} schedData={w.data} onClose={close} onSaved={()=>{}} onDelete={(item)=>softDelete('scheds',item,item?.title||'일정',close)}/>);
          if(w.type==='pd') return (
            <PropDetail key={w.wid} prop={w.data} onClose={close}
              onEdit={(p)=>{ close(); navigate(`/properties/${p.id}/edit`); }}
              onOpen={openWin}
              onDelete={(item)=>softDelete('props',item,propDisplayAddr(item)||item.bldg,close)}
              onDeleteCall={(item)=>softDelete('calls',item,item.content?.slice(0,20)||'통화기록',()=>{})}
            />
          );
          return null;
        })}
    </>
  );

  if(isMobileDevice&&!forceDesktop){
    return(
      <>
        <MobileShell screenTitle={titleLabel} menuId={menuId}
          onSettings={()=>setShowSet(true)} onSignOut={handleSignOut} onViewDesktop={viewDesktop}>
          <div style={{flex:1,overflow:'hidden',background:C.bg,display:'flex',flexDirection:'column',minHeight:0}}>
            {mobileRoutes}
          </div>
        </MobileShell>
        {showSet&&<Settings onClose={()=>setShowSet(false)}/>}
        <ToastPopup toast={toast} onClose={dismissToast}/>
      </>
    );
  }

  return(
    <>
      <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:'inherit',background:C.sidebar}}>
        <TitleBar screen={titleLabel} onSignOut={handleSignOut} onHome={()=>navTo('dashboard')}/>
        <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative'}}>
          <Sidebar screen={menuId} onNav={(id)=>{navTo(id);setSidebarExpanded(false);}} onSettings={()=>setShowSet(true)} trash={trashCount}
            expanded={false} onToggle={()=>setSidebarExpanded(true)}/>
          {sidebarExpanded&&(
            <>
              <div onClick={()=>setSidebarExpanded(false)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,.25)',zIndex:190}}/>
              <Sidebar screen={menuId} onNav={(id)=>{navTo(id);setSidebarExpanded(false);}} onSettings={()=>{setShowSet(true);setSidebarExpanded(false);}} trash={trashCount}
                expanded={true} onToggle={()=>setSidebarExpanded(false)} overlay/>
            </>
          )}
          <div style={{flex:1,overflow:'hidden',background:C.bg,display:'flex',flexDirection:'column',minHeight:0}}>
            {appRoutes}
          </div>
        </div>
      </div>
      {isMobileDevice&&forceDesktop&&(
        <button type="button" onClick={viewMobile} style={{
          position:'fixed',right:14,bottom:14,zIndex:500,height:38,padding:'0 16px',borderRadius:20,
          border:'none',background:C.brand,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',
          boxShadow:'0 6px 18px rgba(0,0,0,.25)',fontFamily:'inherit',
        }}>
          모바일 버전으로 돌아가기
        </button>
      )}
      {overlays}
      <ToastPopup toast={toast} onClose={dismissToast}/>
    </>
  );
}

function AppRouter(){
  useInjectAppStyles();
  return <AppShell/>;
}

export default function App(){
  return <AppRouter/>;
}
/* ═══ CALL EDIT WIN (통화 등록/수정 오버레이) ═══ */
const CallEditWin=({callData,onClose,onSaved,onDelete})=>{
  const { user, companyRole, memberPermissions }=useAuth();
  const P=useProperties();
  const CU=useOwnerCustomers();
  const isNew=!callData;
  const canEdit=isNew||canWriteRecord(callData,user?.id,companyRole,memberPermissions,'call_logs');
  const [date,setDate]=useState(callData?.date||new Date().toISOString().slice(0,10));
  const [time,setTime]=useState(callData?.time||'09:00');
  const [content,setContent]=useState(callData?.content||'');
  const [nextAction,setNextAction]=useState(callData?.next||'');
  const [nextDate,setNextDate]=useState(callData?.nDate||'');
  const [selProp,setSelProp]=useState(null);
  const [selCust,setSelCust]=useState(null);
  useEffect(()=>{
    if(callData?.pid) setSelProp(P.find(p=>p.id===callData.pid)||null);
    else setSelProp(null);
    if(callData?.cid) setSelCust(CU.find(c=>c.id===callData.cid)||null);
    else if(callData?.contactPhone) setSelCust(makeFreePhoneSel(callData.contactPhone));
    else setSelCust(null);
  },[callData,P,CU]);
  const [propSearch,setPropSearch]=useState('');
  const [custSearch,setCustSearch]=useState('');
  const [propOpen,setPropOpen]=useState(false);
  const [custOpen,setCustOpen]=useState(false);
  const filtProps=P.filter(p=>!propSearch||propMatchesSearch(p,propSearch));
  const filtCusts=CU.filter(c=>!custSearch||c.name.includes(custSearch)||phoneMatches(c.phone,custSearch)||(c.co&&c.co.includes(custSearch)));
  const freePhoneOpt=freePhoneOptionFromSearch(custSearch, CU);

  const handleSave=async()=>{
    if(!canEdit) return;
    const contactPhone=isFreePhoneSel(selCust)
      ? normalizePhone(selCust.phone)
      : (!selCust ? (freePhoneOpt ? normalizePhone(freePhoneOpt) : '') : '');
    const payload={
      date,time,content,next:nextAction,nDate:nextDate,
      pid:selProp?.id||null,
      cid:isFreePhoneSel(selCust)?null:(selCust?.id||null),
      contactPhone:contactPhone||'',
    };
    if(isNew){
      await saveCallLog(payload);
      showNotification('저장하였습니다.','success');
    }else{
      await saveCallLog(payload, callData.id);
      showNotification('수정되었습니다.','info');
    }
    if(onSaved) onSaved({...callData,...payload});
    onClose();
  };

  return(
    <Win title={isNew?'통화 기록 등록':'통화 기록 수정'} ic={isNew?'ti-phone-plus':'ti-phone-edit'} onClose={onClose} w={760}
      ch={<>
        <div style={{...WIN_BODY_SCROLL,padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}
          onClick={()=>{setPropOpen(false);setCustOpen(false);}}>

          {/* 기본 정보 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            <SecLabel ch="기본 정보"/>
            <div style={{padding:'16px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>통화 날짜 <span style={{color:C.brand}}>*</span></div>
                <input type="date" className="inp" value={date} onChange={e=>setDate(e.target.value)}/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>통화 시간</div>
                <input type="time" className="inp" value={time} onChange={e=>setTime(e.target.value)}/>
              </div>
            </div>
          </div>

          {/* 연결 정보 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'visible'}}>
            <SecLabel ch="연결 정보"/>
            <div style={{padding:'16px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}} onClick={e=>e.stopPropagation()}>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>연결 매물</div>
                <DropSelect
                  sel={selProp} onSel={setSelProp} onClear={()=>{setSelProp(null);setPropSearch('');}}
                  search={propSearch} setSearch={setPropSearch} open={propOpen} setOpen={setPropOpen}
                  items={filtProps} placeholder="도로명·지번·건물명 검색..."
                  renderChip={propLinkedChip}
                  renderItem={(p)=><PropDropListItem p={p}/>}
                />
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>고객 선택</div>
                <DropSelect
                  sel={selCust} onSel={setSelCust} onClear={()=>{setSelCust(null);setCustSearch('');}}
                  search={custSearch} setSearch={setCustSearch} open={custOpen} setOpen={setCustOpen}
                  items={filtCusts} placeholder="고객명·회사·연락처..."
                  freeTextOption={freePhoneOpt}
                  onSelectFreeText={(phone)=>setSelCust(makeFreePhoneSel(phone))}
                  renderChip={c=>isFreePhoneSel(c)?`미등록 ${c.phone}`:`${c.name} (${formatPhone(c.phone)})`}
                  renderItem={c=>(
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontWeight:600,color:C.tx}}>{c.name}</span>
                        <Bdg label={customerTypeLabelOf(c)} type="info"/>
                        {CU.filter(x=>x.name===c.name).length>1&&<Bdg label="동명이인" type="warn"/>}
                      </div>
                      <div style={{fontSize:12,color:C.txM,marginTop:2}}>{c.co&&c.co!=='개인'?`${c.co} · `:''}{formatPhone(c.phone)}</div>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          {/* 통화 내용 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            <SecLabel ch="통화 내용"/>
            <div style={{padding:'16px 18px'}}>
              <textarea className="ta" rows={5} value={content} onChange={e=>setContent(e.target.value)} placeholder="통화 내용을 상세히 입력하세요..."/>
            </div>
          </div>

          {/* 다음 액션 */}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            <SecLabel ch="다음 액션"/>
            <div style={{padding:'16px 18px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>다음 액션 내용</div>
                <input className="inp" value={nextAction} onChange={e=>setNextAction(e.target.value)} placeholder="예: 현장 방문, 계약서 검토"/>
              </div>
              <div>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>예정일</div>
                <input type="date" className="inp" value={nextDate} onChange={e=>setNextDate(e.target.value)}/>
                <div style={{fontSize:11,color:C.txM,marginTop:6}}>내용과 예정일을 입력하면 일정 관리 달력에도 자동 등록됩니다.</div>
              </div>
            </div>
          </div>
        </div>
        <ActionBar
          saveLabel={isNew?'저장하기':'저장'}
          onSave={handleSave}
          saveDisabled={!canEdit}
          saveDisabledTitle={PERMISSION_DENIED_TOOLTIP}
          onDelete={!isNew&&onDelete?()=>onDelete(callData):null}
          deleteDisabled={!canEdit}
          deleteDisabledTitle={PERMISSION_DENIED_TOOLTIP}
          onCancel={onClose}/>
      </>}/>
  );
};


