import React,{ useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useProperties, usePropertiesQuery } from "./hooks/useProperties.js";
import { MapView } from "./features/map/MapView.jsx";
import { loadPropListState, savePropListState, clearPropListState, rememberPropListTab, propertiesListPath, PROP_LIST_LATEST_EVENT } from "./navigation/propListPersist.js";
import {
  loadPropertyRegisterDraft,
  savePropertyRegisterDraft,
  clearPropertyRegisterDraft,
  hydratePropertyRegisterDraft,
  isPropertyRegisterPath,
} from "./navigation/propertyRegisterDraft.js";
import { loadFolderState, saveFolderState, getDefaultFolderState, DEFAULT_FOLDERS, DEFAULT_PROP_FOLDERS } from "./navigation/folderPersist.js";
import { MENU_PATHS, pathToMenuId } from "./navigation/routes.js";
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
  isBackupOwnRecordsOnlyExport,
} from "./db.js";
import { usePropertyAddressLookup } from "./hooks/usePropertyAddressLookup.js";
import { validatePropertyForSave, lookupBlocksPropertySave, propertySaveBlockedTitle } from "./utils/propertySaveValidate.js";
import { propertySaveToastMessage } from "./utils/recordSyncState.js";
import { AddressSearchModal } from "./components/AddressSearchModal.jsx";
import { PropertyPhotoPicker } from "./components/PropertyPhotoPicker.jsx";
import { PropertyDetailMap } from "./components/PropertyDetailMap.jsx";
import { PropertyDetailNewWin } from "./components/PropertyDetailNewWin.jsx";
import { PropertySaleBrochure } from "./components/PropertySaleBrochure.jsx";
import { PropJibunPhotoPreview } from "./components/PropJibunPhotoPreview.jsx";
import { PropSyncHint } from "./components/PropSyncHint.jsx";
import { printPdfBrochure, brochurePdfFileName } from "./utils/printPdfBrochure.js";
import { normalizePhotoSlots, photoSlotsToSave } from "./utils/readImageFile.js";
import { fmtNum, fmtLandPyUnit, fmtPropPrice as propPrice, fmtWon, calcPyUnitPriceMan, priceInManForFilter, fmtInputNum, formatKoreanAmountFromMan, parseMoneyMan, m2ToPyung } from "./utils/formatMoney.js";
import { buildSaleInvestmentMetrics } from "./utils/propInvestment.js";
import { formatPhone, normalizePhone, phoneMatches, digitsOnly, freePhoneOptionFromSearch } from "./utils/formatPhone.js";
import { formatCustomerTypesLabel, normalizeCustomerTypesField } from "./utils/customerTypes.js";
import { buyTypesOf, customerBuyTypeLabelOf, CUSTOMER_BUY_TYPE_OPTS } from "./utils/customerBuyTypes.js";
import { fmtCustomerBudgetRange, fmtCustomerMoney } from "./utils/customerMoney.js";
import {
  emptyLeaseCondition, leaseConditionsFromCustomer, serializeLeaseConditions,
  leaseConditionListSummary, fmtLeaseAreaRange, fmtLeaseBudgetRange,
} from "./utils/customerLeaseConditions.js";
import { CUST_STATUS_OPTS, normalizeCustStatus, custStatusOf, custGradeRank } from "./utils/customerStatus.js";
import { CUSTOMER_ADV_PROP_KIND_OPTS, customerMatchesAdvSearch, customerMatchesBasicSearch } from "./utils/customerSearch.js";
import { PROP_STATUS_LABEL_TO_CODE, PROP_STATUS_FILTER_LABELS, propStatusOpts, propStatusFilterLabels, propStatusLabel, propStatusStyle, propStatusChipStyle } from "./utils/propStatus.js";
import {
  PROP_LIST_TABS, normalizePropListTab, isLegacyRentListTab, isPropStatusListTab,
  propertyBelongsToListTab, countForListTab, RENT_TRADE_LABELS, propListTabLabel,
  isSaleTrade, isRentalListProperty, normalizePropTrade,
} from "./utils/propListKind.js";
import { useDealMode } from "./contexts/DealModeContext.jsx";
import { DealModeToggle, DealModeAppFrame } from "./components/DealModeToggle.jsx";
import { DEAL_MODE_RENT, DEAL_MODE_SALE, BRAND_CSS } from "./theme/dealModeTheme.js";
import {
  tradesForDealMode, tradeMatchesDealMode,
  propertyMatchesDealMode, customerMatchesDealMode, callMatchesDealMode,
  scheduleMatchesDealMode, dealModeFromProperty, linkedPidMatchesDealMode,
  inferCustomerDealMode,
} from "./utils/dealModeMatch.js";
import {
  rentalDepositMan, rentalRentMan, rentalMaintMan, fmtRentalMan, fmtRentalNoc, rentalNocManPerPy, fmtRentalAreaCell, rentalAreaParts,
  fmtListDotDate, rentalTradeLabel, RENT_LIST_SORT_KEYS, SALE_LIST_SORT_KEYS, moveInSortKey, rentalAddrSortKey, rentalListUsesJibunGroups, sortRentalListByJibunGroups, comparePropListActivityDesc, propListActivityMs,
} from "./utils/propRentList.js";
import { buildPropertyAddressFields, propDisplayAddr, propDetailWinTitle, propCallIdentLabel, propRoadAddr, propJibunAddr, propMatchesSearch, propSearchHaystack } from "./utils/propAddress.js";
import { handleDiscoLink, normalizeDiscoUrl, normalizeHttpUrl } from "./utils/externalPropertyLinks.js";
import { zoningTextColor } from "./utils/zoningColor.js";
import { uniquePropAgentNames, propertyMatchesAgentFilter, propAgentLabel, PROP_AGENT_NONE } from "./utils/propAgent.js";
import { fmtPropUpdatedAt, isLockedCallLog, LOCKED_CALL_LOG_MSG } from "./utils/propertyAuditLog.js";
import { resolveMapCoordFieldsForSave } from "./services/naver/propertyGeocode.js";
import { importIcsSchedules, importGoogleCalendarFromLink, syncLinkedGoogleCalendars, repairIcsScheduleIntegrity } from "./utils/icsImport.js";
import {
  listGoogleCalendarLinks,
  removeGoogleCalendarLink,
  GCAL_LINK_COLORS,
  flushPendingIcsSourceIdRemaps,
} from "./services/googleCalendarLinks.js";
import {
  PRI_C,
  PRI_BG,
  PRI_L,
  PRI_OPTS,
  schedulePriColor,
  schedulePriBg,
  scheduleSourceInfo,
  gcalFallbackColor,
  gcalLinkDisplayLabel,
  buildGcalMeta,
  scheduleOriginHint,
} from "./utils/scheduleColors.js";
import { PhoneInput } from "./components/PhoneInput.jsx";
import { PropAgentFields } from "./components/PropAgentFields.jsx";
import { MoneyInput } from "./components/MoneyInput.jsx";
import { parseFormNum } from "./utils/propertyForm.js";
import { useAuth } from "./contexts/AuthContext.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { InviteSignUpPage, SignUpPage } from "./pages/InviteSignUpPage.jsx";
import { AUTH_PATHS } from "./navigation/authRoutes.js";
import {
  captureCurrentAppPathFromWindow,
  resolveReturnAppPath,
  saveLastAppPath,
} from "./navigation/returnPath.js";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen.jsx";
import { PASSWORD_RESET_REDIRECT_PATH, validatePassword } from "./utils/authValidation.js";
import {
  scheduleCoversDay, dateEndForSave, fmtSchedulePeriodKo, fmtSchedulePeriodDot,
} from "./utils/schedulePeriod.js";
import { isBusinessRole, isCeoRole, isSoloRole, companyRoleLabel, usesTeamCloudSync } from "./data/companyRoles.js";
import { visiblePropMainEntries, visiblePropSubEntries, visibleAllPropSubEntries, findPropMainForSub, SALE_PROP_KIND_OPTS, normalizeSalePropKind, propertyMatchesSaleKind, saleKindFromProp, typeCodesForSave, propKindDisplayLabel } from "./data/propertyTypes.js";
import { matchesOwner } from "./services/sync/ownerScope.js";
import { canWriteRecord, isSharedRecord, displayPhone, PERMISSION_DENIED_TOOLTIP, CALL_LOG_MANAGE_DENIED_TOOLTIP, canManageCallLogs, getEffectivePermissions, canReadSharedResource, formatSharedPropertyLabel, canViewTeamProperties } from "./utils/permissions.js";
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
import { emptyCategorySearch } from "./utils/propCategorySearch.js";
import { emptyRangeFilters } from "./utils/rangeFilterConfig.js";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { MobileShell } from "./layouts/MobileShell.jsx";
import { MobileDashboard } from "./pages/mobile/MobileDashboard.jsx";
import { MobilePropertyList } from "./pages/mobile/MobilePropertyList.jsx";
import { MobilePropertyDetail } from "./pages/mobile/MobilePropertyDetail.jsx";
import { MobileSyncGate } from "./pages/mobile/mobileUi.jsx";
import { MobileMapView } from "./pages/mobile/MobileMapView.jsx";
import { MobileCustomerList } from "./pages/mobile/MobileCustomerList.jsx";
import { MobileCustomerDetail } from "./pages/mobile/MobileCustomerDetail.jsx";
import { MobileCallList } from "./pages/mobile/MobileCallList.jsx";
import { MobileCallDetail } from "./pages/mobile/MobileCallDetail.jsx";
import { MobileScheduleDetail } from "./pages/mobile/MobileScheduleDetail.jsx";
import { MobileCalendar } from "./pages/mobile/MobileCalendar.jsx";
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
  buildingFromProperty, buildingToPropertyFields,
  detailFormFromProperty, MOVE_IN_IMMEDIATE, isMoveInImmediate,
} from "./utils/propertyForm.js";
import { emptyBuildingForm, emptyLandForm } from "./services/publicData/mapToPropertyForm.js";
import {
  aggregateLandForm,
  extraParcelCount,
  formatJibunWithExtraParcels,
  landFieldsForPropertySave,
  landFromPropertyPrimary,
} from "./utils/propertyParcels.js";
import {
  applyLookupToLandEditState,
  buildEditSaveLandPayload,
  hydrateEditLandFromProperty,
} from "./utils/propEditAddressState.js";
import {
  showsSaleInvestmentFields, showsRentalUnitFields,
  buildPropSaleInfoRows, buildTradePriceInfoItems,
} from "./utils/propSaleInfo.js";


function findPropertyByRouteId(properties, idParam) {
  if (!properties?.length || idParam == null || idParam === '') return null;
  const n = Number(idParam);
  return properties.find(p => p.id === n || String(p.id) === String(idParam)) ?? null;
}

function findPropertyByPid(properties, pid) {
  const byId = findPropertyByRouteId(properties, pid);
  if (byId) return byId;
  if (!properties?.length || pid == null || pid === '') return null;
  return properties.find((p) => p.cloudId != null && String(p.cloudId) === String(pid)) ?? null;
}

const RouteLoading=({label='불러오는 중…', detail=null})=>(
  <div style={{
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    height:'100%', minHeight:'100dvh', padding:24, boxSizing:'border-box',
    background:C.bg, color:C.txM, gap:10, textAlign:'center',
  }}>
    <div translate="no" lang="en" style={{fontSize:18,fontWeight:800,color:C.brand,letterSpacing:'-.02em',marginBottom:4}}>LandNote</div>
    <div style={{
      width:28, height:28, borderRadius:'50%',
      border:`3px solid ${C.bdr}`, borderTopColor:C.brand,
      animation:'landnote-spin .8s linear infinite',
    }}/>
    <div style={{fontSize:15, fontWeight:700, color:C.tx}}>{label}</div>
    {detail&&<div style={{fontSize:13, lineHeight:1.55, maxWidth:300}}>{detail}</div>}
    <style>{`@keyframes landnote-spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    // 브라우저 번역·확장/DOM 경합으로 나는 removeChild는 화면 전체를 깨지 않음
    const msg = String(error?.message || error || '');
    if (error?.name === 'NotFoundError' || /removeChild/i.test(msg)) {
      return { error: null };
    }
    return { error };
  }

  componentDidCatch(error, info) {
    const msg = String(error?.message || error || '');
    if (error?.name === 'NotFoundError' || /removeChild/i.test(msg)) {
      console.warn('[RouteErrorBoundary] ignored DOM removeChild', error);
      return;
    }
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
    const q = id ? db.rentals.where("pid").equals(id).toArray() : db.rentals.toArray();
    return q.then((rows) => rows.filter(isActive));
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
  brand:BRAND_CSS.brand,brandD:BRAND_CSS.brandD,brandL:BRAND_CSS.brandL,
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
const TL={SALE:'매매',JEONSE:'전세',MONTHLY:'월세',SHORT_TERM:'단기',PRESALE:'매매'};
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
const custTypeOptsForMode=(mode)=>CUST_TYPE_OPTS.filter((o)=>(
  mode===DEAL_MODE_RENT
    ? o.id==='TENANT'||o.id==='LANDLORD'||o.id==='OTHER'
    : o.id==='BUYER'||o.id==='SELLER'||o.id==='OTHER'
));
const customerTypesOf=(c)=>{
  if(Array.isArray(c?.customer_types)&&c.customer_types.length) return c.customer_types;
  return c?.type?[c.type]:[];
};
const customerTypeLabelOf=(c)=>formatCustomerTypesLabel(customerTypesOf(c))||CT[c?.type]||'—';
const customerBuyLabelOf=(c)=>customerBuyTypeLabelOf(c);
const customerMatchesTypeTab=(c,tabId)=>{
  if(tabId==='ALL') return true;
  return customerTypesOf(c).includes(tabId);
};
const CustStatusBdg=({s})=>{
  const m={URGENT:{l:'긴급',t:'err'},NORMAL:{l:'보통',t:'info'},HOLD:{l:'보류',t:'warn'},MANAGE:{l:'관리',t:'gray'}};
  const x=m[normalizeCustStatus(s)]||m.NORMAL;
  return (<Bdg label={x.l} type={x.t}/>);
};
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
        <rect x="9.5"  y={base-19} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="14.5" y={base-19} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="9.5"  y={base-13} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="14.5" y={base-13} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="9.5"  y={base-7}  width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="14.5" y={base-7}  width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        {/* 가운데 고층 빌딩 */}
        <rect x="24" y={base-36} width="20" height="36" rx="2" fill="#fff"/>
        {/* 안테나 */}
        <rect x="33" y={base-43} width="2.5" height="9" rx="1.2" fill="#fff"/>
        <rect x="32" y={base-44} width="4.5" height="3" rx="1" fill="#fff"/>
        {/* 창문 4행×2열 */}
        <rect x="27"   y={base-33} width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="35.5" y={base-33} width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="27"   y={base-25} width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="35.5" y={base-25} width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="27"   y={base-17} width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="35.5" y={base-17} width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="27"   y={base-9}  width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="35.5" y={base-9}  width="5" height="5" rx="0.8" fill="var(--ln-brand)" opacity=".9"/>
        {/* 오른쪽 빌딩 */}
        <rect x="47" y={base-28} width="14" height="28" rx="2" fill="#fff"/>
        <rect x="49.5" y={base-25} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="55"   y={base-25} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="49.5" y={base-18} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="55"   y={base-18} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="49.5" y={base-11} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        <rect x="55"   y={base-11} width="3.5" height="3.5" rx="0.6" fill="var(--ln-brand)" opacity=".9"/>
        {/* 지면선 */}
        <line x1="5" y1={base}   x2="63" y2={base}   stroke="rgba(255,255,255,0.4)" strokeWidth="2"   strokeLinecap="round"/>
        {/* 빨간 강조선 */}
        <line x1="5" y1={base+4} x2="63" y2={base+4} stroke="var(--ln-brand)"              strokeWidth="2.5" strokeLinecap="round"/>
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
  'ti-list':         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>),
  'ti-table':        (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>),
  'ti-arrow-right':  (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>),
  'ti-user':         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  'ti-upload':       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>),
  'ti-settings':     (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  'ti-rotate':       (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.12"/></svg>),
  'ti-printer':      (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>),
  'ti-file':         (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>),
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

const PropStatusBdg=({s,compact,rent})=>{
  const st=propStatusStyle(s,{rent});
  return (<span style={propStatusChipStyle(s,{compact,rent})}>{st.label}</span>);
};

/** 연결 매물 드롭다운 — 지번 · 유형 · 거래방식 */
const PropDropListItem=({p})=>(
  <div>
    <div className="cell-wrap" style={{fontWeight:500,color:C.tx,fontSize:13}}>{propDisplayAddr(p)}</div>
    <div style={{fontSize:12,color:C.txM,marginTop:4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
      {p.tag&&<Bdg label={propKindDisplayLabel(p)||p.tag} type="gray"/>}
      <span>{TL[p.trade]||'—'}</span>
    </div>
  </div>
);


const PROP_DETAIL_SEC_TITLE_H=Math.round(36*1.1); /* 매물상세 섹션 타이틀 — 기준 36px의 110% */

const SecLabel=({ch,badge,sx,plain,propTitle,ic,formSection,end})=>(
  <div className={formSection?'prop-form-sec':undefined} style={{height:propTitle?PROP_DETAIL_SEC_TITLE_H:(formSection?46:36),background:propTitle?C.surf:(formSection?'#E8EEF5':C.secBg),borderBottom:formSection?`1.5px solid ${C.bdrSt}`:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',padding:'0 18px',gap:8,flexShrink:0,...(sx||{})}}>
    {propTitle&&ic&&PROP_DETAIL_SEC_ICONS[ic]&&(
      <span style={{width:22,height:22,borderRadius:6,background:PROP_DETAIL_IC.bg,color:PROP_DETAIL_IC.fg,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <span style={{width:14,height:14,display:'flex',alignItems:'center',justifyContent:'center'}}>{PROP_DETAIL_SEC_ICONS[ic]}</span>
      </span>
    )}
    <span style={{fontSize:propTitle?13:(formSection?15:13),fontWeight:propTitle||formSection?800:700,color:C.tx,textTransform:(plain||formSection)?'none':'uppercase',letterSpacing:(plain||formSection)?'-.01em':'.06em',flexShrink:0}}>{ch}</span>
    {badge&&<span style={{fontSize:12,background:C.infoBg,color:C.info,padding:'1px 6px',borderRadius:3,fontWeight:600}}>{badge}</span>}
    {end?<div style={{marginLeft:'auto',display:'flex',alignItems:'center',flexShrink:0,minWidth:0}}>{end}</div>:null}
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
  <div className="no-print" style={{flexShrink:0,background:C.surf,borderTop:`2px solid ${C.bdr}`,
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
const TitleBar=({onSignOut,onHome})=>(
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
      <span translate="no" lang="en" style={{fontSize:19.5,fontWeight:700,color:'rgba(255,255,255,.7)',letterSpacing:'-.01em'}}>LandNote</span>
    </button>
    <div style={{marginLeft:16,flexShrink:0}}><DealModeToggle/></div>
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
  {id:'customers',icon:'ti-users',label:'고객 관리'},
  {id:'calls',icon:'ti-phone',label:'통화 내역'},
  {id:'calendar',icon:'ti-calendar',label:'일정 관리'},
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
      <div onClick={onToggle} style={{width:34,height:34,background:'rgba(var(--ln-brand-rgb),.25)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(var(--ln-brand-rgb),.4)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(var(--ln-brand-rgb),.25)'}>
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
                import('./services/naver/naverMaps.js').then((mod)=>mod.loadNaverMaps()).catch(()=>{});
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
  <div className="no-print" style={{minHeight:50,height:'auto',background:'#FFFFFF',borderBottom:`1.5px solid ${C.bdr}`,display:'flex',alignItems:'center',padding:'8px 12px 8px 20px',gap:12,flexShrink:0}}>
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
const Win=({title,ic,onClose,ch,acts,w=1020,fullWidth=false,shellClass})=>(
  <div className={shellClass} style={{
    position:'fixed',inset:0,background:'rgba(0,0,0,.42)',zIndex:520,
    display:'flex',flexDirection:'column',
    padding:fullWidth?0:WIN_OUTER_PAD,
    /* 모바일 브라우저 주소창 등으로 하단이 잘리지 않도록 */
    maxHeight:'100dvh', boxSizing:'border-box',
    backdropFilter:'blur(3px)', overflow:'hidden',
  }}>
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
      <div style={{position:'absolute',top:'8%',right:'12%',width:500,height:500,background:'rgba(var(--ln-brand-rgb),.07)',borderRadius:'50%',filter:'blur(100px)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:'8%',left:'10%',width:380,height:380,background:'rgba(37,99,235,.06)',borderRadius:'50%',filter:'blur(80px)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'40%',left:'35%',width:300,height:300,background:'rgba(var(--ln-brand-rgb),.04)',borderRadius:'50%',filter:'blur(60px)',pointerEvents:'none'}}/>

      <div style={{display:'flex',flexDirection:'column',alignItems:'center',zIndex:1,width:420}}>
        {/* 로고 + 브랜드 */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:48}}>
          <div style={{width:68,height:68,background:`linear-gradient(145deg,${C.brand},#A00E25)`,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 32px rgba(var(--ln-brand-rgb),.45)',marginBottom:20}}>
            <Logo sz={38}/>
          </div>
          <div translate="no" lang="en" style={{fontSize:32,fontWeight:800,color:'#fff',letterSpacing:'-.02em',marginBottom:6}}>LandNote</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,.42)',letterSpacing:'.08em',fontWeight:500}}>부동산 매물관리 시스템</div>
        </div>

        {/* 로그인 카드 */}
        <div style={{width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:18,padding:'36px 36px 32px',backdropFilter:'blur(20px)',boxShadow:'0 24px 48px rgba(0,0,0,.3)'}}>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:16,color:'rgba(255,255,255,.55)',fontWeight:600,display:'block',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase'}}>비밀번호</label>
            <input type="password" placeholder="비밀번호를 입력하세요" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onLogin()}
              style={{width:'100%',height:46,background:'rgba(255,255,255,.07)',border:'1.5px solid rgba(255,255,255,.12)',borderRadius:10,padding:'0 16px',color:'#fff',fontSize:15,letterSpacing:'.1em',fontFamily:'inherit',outline:'none',transition:'border-color .15s'}}
              onFocus={e=>e.target.style.borderColor='rgba(var(--ln-brand-rgb),.7)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}/>
          </div>
          <button onClick={onLogin}
            style={{width:'100%',height:46,background:`linear-gradient(135deg,${C.brand},#A00E25)`,border:'none',borderRadius:10,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px rgba(var(--ln-brand-rgb),.4)',fontFamily:'inherit',letterSpacing:'.02em',transition:'opacity .15s',display:'flex',alignItems:'center',justifyContent:'center'}}
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
  const { user }=useAuth();
  const { mode, isRent }=useDealMode();
  const PAll=useProperties();
  const P=useMemo(()=>PAll.filter((p)=>propertyMatchesDealMode(p,mode)),[PAll,mode]);
  const SCHEDSAll=useOwnerSchedules();
  const CALLSAll=useOwnerCallLogs();
  const SCHEDS=useMemo(()=>SCHEDSAll.filter((s)=>scheduleMatchesDealMode(s,PAll,mode)),[SCHEDSAll,PAll,mode]);
  const CALLS=useMemo(()=>CALLSAll.filter((c)=>callMatchesDealMode(c,PAll,mode)),[CALLSAll,PAll,mode]);
  const RENTALSAll=useRentals();
  const RENTALS=useMemo(()=>isRent?RENTALSAll.filter((r)=>linkedPidMatchesDealMode(r.pid,PAll,mode)):[],[RENTALSAll,PAll,mode,isRent]);
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d;},[]);
  const todayLabel=fmtTodayKorean();
  const gcalOwnerId=user?.id&&user.id!=='dev-local'?user.id:undefined;
  const gcalMeta=useMemo(()=>buildGcalMeta(gcalOwnerId),[gcalOwnerId]);
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
      const {c,bg,label:sourceLabel}=scheduleSourceInfo(s,gcalMeta);
      const period=fmtSchedulePeriodDot(s);
      const chkList=Array.isArray(s.chk)?s.chk.filter(c=>c&&String(c.t||'').trim()):[];
      const chkTotal=chkList.length;
      const chkDone=chkList.filter(c=>c.d).length;
      items.push({
        kind:'sched',target:s,sortKey,
        c,
        bg,
        icon:DASH_CALENDAR_ICON,
        label:`${ongoing?'진행 중 일정':dashSchedPrefix(startDiff)} — ${s.title}`,
        dayLabel:ongoing?'오늘':dashRelativeDayLabel(startDiff),
        priLabel:sourceLabel,
        whenLabel:period+(s.time?` ${s.time}`:''),
        chkLabel:chkTotal>0?`${chkDone}/${chkTotal}`:null,
        sub:`${ongoing?'오늘':dashRelativeDayLabel(startDiff)} · ${sourceLabel} · ${period}${s.time?` ${s.time}`:''}`,
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
  },[SCHEDS,CALLS,RENTALS,P,today,gcalMeta]);
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
    {id:'ALL',label:'전체 매물',val:countForListTab(P,'ALL',undefined,mode),
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 21v-6h6v6"/></svg>,
      c:'#6366F1',bg:'#EEF2FF'},
    {id:'NEW',label:'준비중',val:countForListTab(P,'NEW',undefined,mode),
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
      c:C.ok,bg:C.okBg},
    {id:'ACTIVE',label:'매각중',val:countForListTab(P,'ACTIVE',undefined,mode),
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
      c:C.info,bg:C.infoBg},
    {id:'HOLD',label:'보류',val:countForListTab(P,'HOLD',undefined,mode),
      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>,
      c:C.warn,bg:C.warnBg},
    {id:'COMPLETED',label:'계약완료',val:countForListTab(P,'COMPLETED',undefined,mode),
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
  const dashPriceCell=(p)=>(
    <div className="cell-ellipsis" style={{fontWeight:600,color:C.info,fontSize:12}}>{propPrice(p)}</div>
  );
  const dashAddrCell=(p)=>(
    <td>
      <div className="cell-wrap" style={{fontWeight:500}}>{propDisplayAddr(p)}</div>
      {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
    </td>
  );
  const dashKindCell=(p)=>(
    <td style={{whiteSpace:'nowrap'}}><Bdg label={propKindDisplayLabel(p)||p.tag} type="gray"/></td>
  );
  const dashStatusCell=(p)=>(
    <td style={{whiteSpace:'nowrap'}}><PropStatusBdg s={p.status}/></td>
  );
  /* 매물관리와 동일 순: 상태·종류·주소·매도호가… (체크·별·거래방식 제외) */
  const dashColStatus='7%';
  const dashColTag='8%';
  const dashColPrice='12%';
  const dashColRoi='6%';
  const dashColLandPy='8%';
  const dashColDate='8%';
  const DASH_TBL_MIN_W=isRent?1180:1120;
  const DashColgroup=()=>isRent?(
    <colgroup>
      <col style={{width:'7%'}}/>
      <col style={{width:'7%'}}/>
      <col style={{width:'8%'}}/>
      <col />
      <col style={{width:88}}/>
      <col style={{width:88}}/>
      <col style={{width:64}}/>
      <col style={{width:88}}/>
      <col style={{width:80}}/>
      <col style={{width:72}}/>
      <col style={{width:72}}/>
      <col style={{width:82}}/>
      <col style={{width:82}}/>
    </colgroup>
  ):(
    <colgroup>
      <col style={{width:dashColStatus}}/>
      <col style={{width:dashColTag}}/>
      <col />
      <col style={{width:dashColPrice}}/>
      <col style={{width:dashColRoi}}/>
      <col style={{width:80}}/>
      <col style={{width:80}}/>
      <col style={{width:110}}/>
      <col style={{width:dashColLandPy}}/>
      <col style={{width:dashColDate}}/>
      <col style={{width:dashColDate}}/>
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
  const dashTblHead=isRent?(
    <tr>
      <th>상태</th><th>거래방식</th><th>종류</th><th>주소 / 건물명</th>
      <th style={{textAlign:'right'}}>계약면적</th>
      <th style={{textAlign:'right'}}>전용면적</th>
      <th style={{textAlign:'center'}}>해당층</th>
      <th style={{textAlign:'right'}}>보증금</th>
      <th style={{textAlign:'right'}}>임대료</th>
      <th style={{textAlign:'right'}}>NOC</th>
      <th style={{textAlign:'right'}}>관리비</th>
      <th>최종통화일</th>
      <th>입주가능일</th>
    </tr>
  ):(
    <tr>
      <th>상태</th><th>종류</th><th>주소 / 건물명</th><th>매도호가</th>
      <th style={{textAlign:'right'}}>수익률</th>
      <th style={{textAlign:'right'}}>대지면적</th>
      <th style={{textAlign:'right'}}>연면적</th>
      <th style={{textAlign:'center'}}>용도지역</th>
      <th style={{textAlign:'right'}}>대지단가</th>
      <th>최종통화일</th>
      <th>등록일</th>
    </tr>
  );
  const dashPropRow=(p)=>isRent?(
    <tr key={p.id} onClick={()=>onOpen('pd',p)}>
      {dashStatusCell(p)}
      <td style={{whiteSpace:'nowrap',overflow:'hidden'}}><span style={{fontSize:12,color:C.txM}}>{rentalTradeLabel(p.trade)||TL[p.trade]}</span></td>
      {dashKindCell(p)}
      {dashAddrCell(p)}
      <td style={{textAlign:'right',fontSize:12,whiteSpace:'nowrap'}}>{fmtRentalAreaCell(p.contractArea)}</td>
      <td style={{textAlign:'right',fontSize:12,whiteSpace:'nowrap'}}>{fmtRentalAreaCell(p.exclusiveArea)}</td>
      <td style={{textAlign:'center',fontSize:12,color:p.unitFloor?C.tx:C.txP,whiteSpace:'nowrap'}}>{p.unitFloor||'—'}</td>
      <td style={{textAlign:'right',fontWeight:600,color:C.info,fontSize:12,whiteSpace:'nowrap'}}>{fmtRentalMan(rentalDepositMan(p))}</td>
      <td style={{textAlign:'right',fontWeight:600,color:C.info,fontSize:12,whiteSpace:'nowrap'}}>{fmtRentalMan(rentalRentMan(p))}</td>
      <td style={{textAlign:'right',fontSize:12,whiteSpace:'nowrap'}}>{fmtRentalNoc(p)}</td>
      <td style={{textAlign:'right',fontSize:12,whiteSpace:'nowrap'}}>{fmtRentalMan(rentalMaintMan(p))}</td>
      <td><div className="cell-ellipsis" style={{color:p.lastCall!=='—'?C.txS:C.txP,fontSize:12}}>{p.lastCall}</div></td>
      <td><div className="cell-ellipsis" style={{color:p.moveInDate?C.tx:C.txP,fontSize:12}}>{fmtListDotDate(p.moveInDate)}</div></td>
    </tr>
  ):(
    <tr key={p.id} onClick={()=>onOpen('pd',p)}>
      {dashStatusCell(p)}
      {dashKindCell(p)}
      {dashAddrCell(p)}
      <td>{dashPriceCell(p)}</td>
      <td style={{textAlign:'right'}}><div className="cell-ellipsis" style={{color:C.ok,fontWeight:500,fontSize:12}}>{p.roi||'-'}</div></td>
      {dashPropMetricCells(p)}
      <td><div className="cell-ellipsis" style={{color:p.lastCall!=='—'?C.txS:C.txP,fontSize:12}}>{p.lastCall}</div></td>
      <td><div className="cell-ellipsis" style={{color:C.txM,fontSize:12}}>{p.created}</div></td>
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:DASH_STAT_GAP}}>
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
                  {favs.map(p=>dashPropRow(p))}
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
                  {recent.map(p=>dashPropRow(p))}
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
/* ═══ PROPERTY LIST — 가격 70%, 종류·대지평단가 120%, 상태 90%, 부족분은 주소/건물명에서 차감 */
/** 매물관리 리스트 행 — 수정/삭제 버튼 노출 (false: 미노출, 상세·일괄 작업으로만 편집) */
const PROP_LIST_PAD_X=20;
const PROP_LIST_SHOW_ROW_ACTIONS=false;
const PROP_ROW_ACTION_COL_W=136;
const PROP_PRICE=122;
const PROP_ADDR_NOM=248;
const PROP_COL={
  check:32,star:32,status:76,tag:86,
  roi:64,landArea:88,floorArea:88,zoning:118,landPy:94,floorPy:108,updatedAt:92,agent:76,
  ...(PROP_LIST_SHOW_ROW_ACTIONS?{action:PROP_ROW_ACTION_COL_W}:{}),
};
const PROP_COL_FIXED=Object.values(PROP_COL).reduce((a,b)=>a+b,0);
const PROP_ADDR_MIN=96;
const PROP_COL_ADDR_REMAINDER=PROP_COL_FIXED+PROP_PRICE;
const PROP_LIST_MIN_W=PROP_COL_ADDR_REMAINDER+PROP_ADDR_MIN;
/** 주소 열은 상한을 두고, 남는 가로 폭은 가격~최종수정일 열 쪽으로 배분 */
const propAddrColWidth=PROP_LIST_SHOW_ROW_ACTIONS
  ? `min(${PROP_ADDR_NOM}px, max(${PROP_ADDR_MIN}px, calc((100% - ${PROP_COL_ADDR_REMAINDER}px) * 0.8)))`
  : `min(${PROP_ADDR_NOM}px, max(${PROP_ADDR_MIN}px, calc(100% - ${PROP_COL_ADDR_REMAINDER}px)))`;
const PROP_LIST_TBL_ADDR_CSS=`.prop-list-tbl .prop-col-addr{max-width:${PROP_ADDR_NOM}px!important;overflow:hidden}`;
const PROP_LIST_TBL_METRICS_CSS=`.prop-list-tbl .prop-col-metrics{padding-left:10px!important;padding-right:10px!important}`;
const PROP_LIST_TBL_DATE_CSS=`.prop-list-tbl .prop-col-date{text-align:center!important;white-space:nowrap!important;font-size:12px;min-width:${PROP_COL.updatedAt}px;overflow:visible!important}.prop-list-tbl th.prop-col-date{text-align:center!important}`;
/** sticky 우측 열 — box-shadow 금지 (인접 열 세로선 회귀 방지) */
const PROP_LIST_STICKY_COL=`position:sticky!important;right:0;background:${C.surf}!important`;
const PROP_LIST_TBL_CREATED_STICKY_CSS=!PROP_LIST_SHOW_ROW_ACTIONS
  ? `.prop-list-tbl .prop-col-agent{${PROP_LIST_STICKY_COL};z-index:2;min-width:${PROP_COL.agent}px}.prop-list-tbl thead .prop-col-agent{z-index:4;background:#F8F9FB!important}.prop-list-tbl tbody tr:hover .prop-col-agent{background:#FAFBFF!important}`
  : '';
const PROP_LIST_TBL_ACTION_CSS=PROP_LIST_SHOW_ROW_ACTIONS
  ? `.prop-list-tbl .prop-col-action{${PROP_LIST_STICKY_COL};z-index:3;overflow:visible!important;min-width:${PROP_ROW_ACTION_COL_W}px}.prop-list-tbl thead .prop-col-action{z-index:5;background:#F8F9FB!important}.prop-list-tbl tbody tr:hover .prop-col-action{background:#FAFBFF!important}`
  : '';
const PROP_RENT_COL={
  check:32,star:32,status:76,trade:78,tag:86,
  contractArea:108,exclusiveArea:108,unitFloor:72,
  deposit:100,rent:92,noc:96,maintenance:80,lastCall:82,moveIn:90,agent:76,
};
const PROP_RENT_COL_FIXED=Object.values(PROP_RENT_COL).reduce((a,b)=>a+b,0);
const PROP_RENT_LIST_MIN_W=PROP_RENT_COL_FIXED+PROP_ADDR_MIN;
const propRentAddrColWidth=`min(${PROP_ADDR_NOM}px, max(${PROP_ADDR_MIN}px, calc(100% - ${PROP_RENT_COL_FIXED}px)))`;
const PROP_RENT_TBL_AGENT_CSS=!PROP_LIST_SHOW_ROW_ACTIONS
  ? `.prop-list-tbl .prop-col-agent{${PROP_LIST_STICKY_COL};z-index:2;min-width:${PROP_RENT_COL.agent}px}.prop-list-tbl thead .prop-col-agent{z-index:4;background:#F8F9FB!important}.prop-list-tbl tbody tr:hover .prop-col-agent{background:#FAFBFF!important}`
  : '';
const PROP_RENT_TBL_AREA_CSS=`.prop-list-tbl td.prop-col-area{white-space:normal!important;line-height:1.3;height:auto}.prop-list-tbl tbody td{height:auto}`;
const FOLDER_LIST_MIN_W=1336;
const FOLDER_TBL_STYLE=`.folder-prop-tbl th,.folder-prop-tbl td{padding:10px 8px!important;vertical-align:middle;letter-spacing:-0.01em}.folder-prop-tbl .f-col-star{text-align:center}.folder-prop-tbl .f-col-num{text-align:right!important;white-space:nowrap;font-size:12px}.folder-prop-tbl th.f-col-num{text-align:right!important}.folder-prop-tbl .f-col-zone{text-align:center!important;white-space:nowrap;font-size:12px;overflow:hidden;text-overflow:ellipsis}.folder-prop-tbl th.f-col-zone{text-align:center!important}.folder-prop-tbl .f-col-date{text-align:center!important;white-space:nowrap;font-size:12px}.folder-prop-tbl th.f-col-date{text-align:center!important}`;

const FolderPickCheckbox=({checked,inFolder})=>(
  <div style={{width:18,height:18,borderRadius:5,border:`1.5px solid ${inFolder?C.bdrSt:checked?C.brand:C.bdrSt}`,background:inFolder?C.surf2:checked?C.brand:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,margin:'0 auto'}}>
    {(inFolder||checked)&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={inFolder?C.txP:'#fff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
  </div>
);

const FolderPropTable=({pick,rows,emptyMsg,getPickState,onToggleFav,onAddrClick,onRowClick,renderTrailing,getRowOpacity,maxHeight,wrapStyle})=>{
  const colSpan=pick?15:14;
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
            <col style={{width:PROP_COL.floorPy}}/>
            <col style={{width:PROP_COL.updatedAt}}/>
            <col style={{width:PROP_COL.agent}}/>
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
              <th className="f-col-num">대지단가</th>
              <th className="f-col-num">연면적단가</th>
              <th className="f-col-date">최종수정일</th>
              <th className="f-col-date">담당자</th>
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
                  <td style={{whiteSpace:'nowrap'}}><PropStatusBdg s={p.status}/></td>
                  <td style={{whiteSpace:'nowrap'}}><Bdg label={propKindDisplayLabel(p)||p.tag} type="gray"/></td>
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
                  <td className="f-col-num" style={{color:p.floor>0&&p.price>0?C.tx:C.txP}}>{fmtLandPyUnit(p.price,p.floor)}</td>
                  <td className="f-col-date" style={{color:C.txM}}>{fmtPropUpdatedAt(p)}</td>
                  <td className="f-col-date" style={{color:C.txM}}>{propAgentLabel(p)}</td>
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

const PropList=({onOpen,onNav,folders,propFolders,setPropFolders,onDeleteProperty})=>{
  const { mode, isRent, setDealMode }=useDealMode();
  const P=useProperties();
  const CALLS=useOwnerCallLogs();
  const { user, company, profile, companyRole, teamNameMap, teamRoleMap, memberPermissions }=useAuth();
  const workspaceId=company?.id??profile?.company_id??null;
  const showOwnerScopeTabs=isBusinessRole(companyRole)&&workspaceId&&!isSoloRole(companyRole);
  const effectivePerms=getEffectivePermissions(companyRole,memberPermissions);
  const canViewTeamProps=canViewTeamProperties(effectivePerms);
  const isMobile=useIsMobile();
  const [searchParams,setSearchParams]=useSearchParams();
  const saved=loadPropListState();
  const urlTab=searchParams.get('tab');
  const scrollRef=useRef(null);
  const ownerScopeMenuRef=useRef(null);
  const [ownerScopeTab,setOwnerScopeTab]=useState(()=>saved.ownerScopeTab==='MINE'?'MINE':'ALL');
  const [ownerScopeMenuOpen,setOwnerScopeMenuOpen]=useState(false);
  const getSharedLabel=useCallback((p)=>{
    if(!isSharedRecord(p,user?.id)) return null;
    return formatSharedPropertyLabel(teamNameMap[p.ownerId],teamRoleMap[p.ownerId]);
  },[user?.id,teamNameMap,teamRoleMap]);
  const propCallDateMap=useMemo(()=>buildPropCallDateMap(CALLS),[CALLS]);
  const baseProps=useMemo(()=>{
    const scoped=(!showOwnerScopeTabs||ownerScopeTab==='ALL')?P:P.filter(p=>matchesOwner(p,user?.id));
    return scoped.map(p=>({...p,lastCall:fmtCallDate(propCallDatesOf(propCallDateMap,p.id).last)}));
  },[P,showOwnerScopeTabs,ownerScopeTab,user?.id,propCallDateMap]);
  const [search,setSearch]=useState(saved.search??'');
  const [filter,setFilter]=useState(saved.filter??false);
  const [selSido,setSelSido]=useState(saved.selSido??'');
  const [selGu,setSelGu]=useState(saved.selGu??'');
  const [statusTab,setStatusTab]=useState(()=>normalizePropListTab(urlTab||saved.statusTab||'ALL'));
  useEffect(()=>{
    if(isLegacyRentListTab(urlTab)){
      setDealMode(DEAL_MODE_RENT);
      setStatusTab('ALL');
      setSearchParams({}, {replace:true});
      return;
    }
    if(isPropStatusListTab(urlTab)){
      setStatusTab('ALL');
      setColFilter((f)=>({...f,status:urlTab}));
      return;
    }
    if(urlTab) setStatusTab(normalizePropListTab(urlTab));
  },[urlTab]);
  useEffect(()=>{
    if(!ownerScopeMenuOpen) return undefined;
    const onDoc=(e)=>{
      if(ownerScopeMenuRef.current&&!ownerScopeMenuRef.current.contains(e.target)) setOwnerScopeMenuOpen(false);
    };
    document.addEventListener('mousedown',onDoc);
    return ()=>document.removeEventListener('mousedown',onDoc);
  },[ownerScopeMenuOpen]);
  const [sortKey,setSortKey]=useState(()=>{
    if(isRent) return saved.sortKey!==undefined?saved.sortKey:'created';
    return 'updatedAt';
  });
  const [sortDir,setSortDir]=useState(()=>{
    if(isRent){
      if(saved.sortDir) return saved.sortDir;
      if(saved.sortKey!==undefined) return 'asc';
      return 'desc';
    }
    return 'desc';
  });
  const [colFilter,setColFilter]=useState(()=>{
    const f=saved.colFilter??{tag:'',trade:'',status:'',agent:''};
    if(isPropStatusListTab(urlTab)) return {...f,status:urlTab};
    return f;
  });
  const [openColFilter,setOpenColFilter]=useState(null);
  const [filterResetKey,setFilterResetKey]=useState(0);
  const [advTag,setAdvTag]=useState(saved.advTag??'');
  const [advTrade,setAdvTrade]=useState(saved.advTrade??'');
  const [advAgent,setAdvAgent]=useState(saved.advAgent??'');
  const [advStatus,setAdvStatus]=useState(saved.advStatus??'');
  const [advPriceMin,setAdvPriceMin]=useState(saved.advPriceMin??'');
  const [advPriceMax,setAdvPriceMax]=useState(saved.advPriceMax??'');
  const [advLandMin,setAdvLandMin]=useState(saved.advLandMin??'');
  const [advLandMax,setAdvLandMax]=useState(saved.advLandMax??'');
  const [advFloorMin,setAdvFloorMin]=useState(saved.advFloorMin??'');
  const [advFloorMax,setAdvFloorMax]=useState(saved.advFloorMax??'');
  const [advMain,setAdvMain]=useState(normalizeSalePropKind(saved.advKind||saved.advMain||''));
  const [advRoiMin,setAdvRoiMin]=useState(saved.advRoiMin??'');
  const [appliedAdv,setAppliedAdv]=useState(()=>{
    const a=saved.appliedAdv;
    if(!a||typeof a!=='object') return null;
    const kind=normalizeSalePropKind(a.kind||a.main||'');
    return {...a,kind,main:kind||undefined};
  });
  const [catSearch,setCatSearch]=useState(()=>{
    const s=saved.catSearch&&typeof saved.catSearch==='object'?saved.catSearch:null;
    if(!s) return emptyCategorySearch();
    return {...emptyCategorySearch(),...s,ranges:{...emptyRangeFilters(),...(s.ranges&&typeof s.ranges==='object'?s.ranges:{})}};
  });
  const STATUS_LABEL_TO_CODE=PROP_STATUS_LABEL_TO_CODE;
  const applyAdvSearch=()=>setAppliedAdv({
    sido:selSido,gu:selGu,tag:advTag,kind:advMain,trade:'',agent:advAgent,status:advStatus,
    priceMin:advPriceMin,priceMax:advPriceMax,landMin:advLandMin,landMax:advLandMax,
    floorMin:advFloorMin,floorMax:advFloorMax,roiMin:advRoiMin,
  });
  const resetAdvSearch=()=>{
    setSelSido('');setSelGu('');setAdvTag('');setAdvMain('');setAdvTrade('');setAdvAgent('');setAdvStatus('');
    setAdvPriceMin('');setAdvPriceMax('');setAdvLandMin('');setAdvLandMax('');
    setAdvFloorMin('');setAdvFloorMax('');setAdvRoiMin('');
    setCatSearch(emptyCategorySearch());
    setColFilter((f)=>({...f,agent:''}));
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
      search, filter, selSido, selGu, statusTab, ownerScopeTab, sortKey, sortDir, colFilter,
      advTag, advKind:advMain, advMain, advTrade, advAgent, advStatus, advPriceMin, advPriceMax, advLandMin, advLandMax,
      advFloorMin, advFloorMax, advRoiMin, appliedAdv, catSearch, visibleCount, expandedFolders,
      scrollTop: scrollTop??scrollRef.current?.scrollTop??0,
    });
  }, [search, filter, selSido, selGu, statusTab, ownerScopeTab, sortKey, sortDir, colFilter,
    advTag, advMain, advTrade, advAgent, advStatus, advPriceMin, advPriceMax, advLandMin, advLandMax,
    advFloorMin, advFloorMax, advRoiMin, appliedAdv, catSearch, visibleCount, expandedFolders]);
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
  useEffect(()=>{
    const onLatest=()=>{
      if(!isRent){setSortKey('updatedAt');setSortDir('desc');}
      if(scrollRef.current) scrollRef.current.scrollTop=0;
    };
    window.addEventListener(PROP_LIST_LATEST_EVENT,onLatest);
    return ()=>window.removeEventListener(PROP_LIST_LATEST_EVENT,onLatest);
  },[isRent]);
  const persistListStateRef=useRef(persistListState);
  persistListStateRef.current=persistListState;
  useEffect(()=>()=>{ persistListStateRef.current(); },[]);
  useEffect(()=>{ savePropListState({ statusTab }); },[statusTab]);
  const toggleSort=(key)=>{
    if(sortKey!==key){setSortKey(key);setSortDir(key==='updatedAt'?'desc':'asc');return;}
    if(sortDir==='asc'){setSortDir('desc');return;}
    if(!rentList){setSortKey('updatedAt');setSortDir(key==='updatedAt'?'asc':'desc');return;}
    setSortKey(null);setSortDir('asc');
  };
  const handleScroll=(e)=>{
    const el=e.currentTarget;
    if(el.scrollHeight-el.scrollTop-el.clientHeight<80)setVisibleCount(v=>v+20);
    savePropListState({ scrollTop: el.scrollTop });
  };
  const sanitizeTradeFiltersForTab=()=>{
    setColFilter((f)=>tradeMatchesDealMode(f.trade,mode)?f:{...f,trade:''});
    setAdvTrade((t)=>tradeMatchesDealMode(t,mode)?t:'');
    setCatSearch((c)=>tradeMatchesDealMode(c.trade,mode)?c:{...c,trade:''});
    setAppliedAdv((a)=>{
      if(!a||tradeMatchesDealMode(a.trade,mode)) return a;
      return {...a,trade:''};
    });
  };
  const goStatusTab=(id,{toggleOwnerScope}={})=>{
    sanitizeTradeFiltersForTab();
    if(toggleOwnerScope){
      setStatusTab('ALL');
      setVisibleCount(20);
      setSearchParams({}, {replace:true});
      setOwnerScopeMenuOpen((v)=>statusTab==='ALL'?!v:true);
      return;
    }
    setOwnerScopeMenuOpen(false);
    setStatusTab(id);
    setVisibleCount(20);
    if(id==='ALL') setSearchParams({}, {replace:true});
    else setSearchParams({tab:id},{replace:true});
  };
  useEffect(()=>{
    sanitizeTradeFiltersForTab();
    const sortSet=isRent?RENT_LIST_SORT_KEYS:SALE_LIST_SORT_KEYS;
    if(sortKey&&!sortSet.has(sortKey)){setSortKey(isRent?'created':'updatedAt');setSortDir('desc');}
  }, [statusTab, mode]);
  const statusTabList=PROP_LIST_TABS;
  const rentList=isRent;
  const listTradeOpts=tradesForDealMode(mode).map((k)=>({id:k,label:rentList?(RENT_TRADE_LABELS[k]||TL[k]):(TL[k]||k)}));
  const agentNameOpts=useMemo(()=>uniquePropAgentNames(baseProps),[baseProps]);
  const sortMark=(key)=>(
    <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sortKey===key?1:.28}}>
      {sortKey===key&&sortDir==='asc'?'▲':'▼'}
    </span>
  );
  const priceOfForFilter=(p)=>priceInManForFilter(p);
  const rows=baseProps.filter(p=>{
    if(!propertyBelongsToListTab(p,statusTab,{inFolder:(propFolders[p.id]||[]).length>0,dealMode:mode})) return false;
    if(colFilter.tag&&p.tag!==colFilter.tag) return false;
    if(colFilter.trade&&p.trade!==colFilter.trade) return false;
    if(colFilter.status&&p.status!==colFilter.status) return false;
    if(rentList&&colFilter.agent&&!propertyMatchesAgentFilter(p,colFilter.agent)) return false;
    if(appliedAdv){
      const a=appliedAdv;
      const num=(v)=>{const n=parseFloat(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null;};
      if(!sidoMatch(propSearchHaystack(p),a.sido)) return false;
      if(a.gu&&!propSearchHaystack(p).includes(a.gu)) return false;
      if(a.tag&&p.tag!==a.tag) return false;
      if(a.kind&&!propertyMatchesSaleKind(p,a.kind)) return false;
      if(!a.kind&&a.main&&p.main!==a.main) return false;
      if(!propertyMatchesAgentFilter(p,a.agent)) return false;
      if(a.status&&p.status!==STATUS_LABEL_TO_CODE[a.status]) return false;
      const price=priceOfForFilter(p);
      const pmin=num(a.priceMin), pmax=num(a.priceMax);
      if(pmin!=null&&(price==null||price<pmin)) return false;
      if(pmax!=null&&(price==null||price>pmax)) return false;
      const landPy=p.land>0?Number(m2ToPyung(p.land)):0;
      const lmin=num(a.landMin), lmax=num(a.landMax);
      if(lmin!=null&&landPy<lmin) return false;
      if(lmax!=null&&landPy>lmax) return false;
      const floorPy=p.floor>0?Number(m2ToPyung(p.floor)):0;
      const fmin=num(a.floorMin), fmax=num(a.floorMax);
      if(fmin!=null&&floorPy<fmin) return false;
      if(fmax!=null&&floorPy>fmax) return false;
      const rmin=num(a.roiMin);
      if(rmin!=null){
        const roi=parseFloat(p.roi);
        if(!Number.isFinite(roi)||roi<rmin) return false;
      }
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
    if(key==='floorPy') return calcPyUnitPriceMan(p.price,p.floor)??-1;
    if(key==='lastCall') return p.lastCall==='—'?'':p.lastCall;
    if(key==='created') return p.created;
    if(key==='updatedAt') return propListActivityMs(p);
    if(key==='agentName') return String(p.agentName||'').trim();
    if(key==='contractArea') return parseFloat(p.contractArea)||-1;
    if(key==='exclusiveArea') return parseFloat(p.exclusiveArea)||-1;
    if(key==='deposit') return rentalDepositMan(p);
    if(key==='rent') return rentalRentMan(p);
    if(key==='noc') return rentalNocManPerPy(p)??-1;
    if(key==='maintenance') return rentalMaintMan(p);
    if(key==='moveInDate') return moveInSortKey(p.moveInDate);
    if(key==='addr') return rentalAddrSortKey(p);
    return '';
  };
  const sorted=rentList&&rentalListUsesJibunGroups(sortKey)
    ? sortRentalListByJibunGroups(rows,{createdDir:sortKey==='created'?sortDir:'desc'})
    : [...rows].sort((a,b)=>{
    if(!sortKey&&!rentList) return comparePropListActivityDesc(a,b);
    if(sortKey==='updatedAt'){
      const c=comparePropListActivityDesc(a,b);
      return sortDir==='asc'?-c:c;
    }
    if(sortKey){
      const av=getSortVal(a,sortKey), bv=getSortVal(b,sortKey);
      if(typeof av==='string'&&typeof bv==='string'){
        const c=av.localeCompare(bv,'ko',{numeric:true,sensitivity:'base'});
        if(c!==0) return sortDir==='asc'?c:-c;
        return 0;
      }
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
  const otherDealCount=baseProps.filter((p)=>!propertyMatchesDealMode(p,mode)).length;
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
    const ready=[];
    const blocked=[];
    for(const p of targets){
      const check=validatePropertyForSave({...p,status:newStatus});
      if(check.ok) ready.push(p);
      else blocked.push(`${propDisplayAddr(p)||p.bldg||p.id}: ${check.message}`);
    }
    if(blocked.length){
      window.alert(`매각중으로 바꿀 수 없는 매물이 있습니다.\n${blocked.slice(0,8).join('\n')}${blocked.length>8?`\n외 ${blocked.length-8}건`:''}`);
    }
    if(!ready.length) return;
    try{
      await Promise.all(ready.map((p)=>updateProperty(p.id,{status:newStatus})));
      showNotification(blocked.length?`가능한 ${ready.length}건만 수정되었습니다.`:'수정되었습니다.','info');
    }catch(err){
      window.alert(err instanceof Error?err.message:String(err));
      return;
    }
    setStatusBulkOpen(false);
    setChecked({});
  };
  const PROP_STATUS_BULK_OPTS=propStatusOpts(rentList);

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
      style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,height:'100%',overflow:'hidden',background:C.bg,position:'relative'}}
      onDragOver={onBulkDragOver}
      onDragLeave={onBulkDragLeave}
      onDrop={onBulkDrop}
    >
      {bulkDragActive&&(
        <div style={{
          position:'absolute',inset:0,zIndex:50,background:'rgba(var(--ln-brand-rgb),.08)',
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
      <PH title="매물 관리" sub={`${propListTabLabel(statusTab)} ${rows.length}건`}
        acts={<>
          <Btn role="page-secondary" ch="그룹 관리" ic="ti-folder" on={()=>onOpen('fm',null)}/>
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
        <div style={{fontSize:13,color:C.txM}}>{statusTab==='ALL'&&showOwnerScopeTabs&&ownerScopeTab==='MINE'?'내 매물':propListTabLabel(statusTab)} <strong style={{color:C.tx}}>{rows.length}</strong>건</div>
      </div>
      )}
      {filter&&(
        <div key={filterResetKey} style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:isMobile?'12px 16px':'14px 24px',flexShrink:0}}>
          {rentList?(
            <>
          <div style={{display:'flex',flexWrap:'wrap',gap:12,marginBottom:10}}>
            <div style={{flex:'0 1 150px',minWidth:110}}>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>지역(도·시)</div>
              <select className="sel" style={{height:34,fontSize:13}} value={selSido} onChange={e=>{setSelSido(e.target.value);setSelGu('');}}>
                <option value="">전체</option>
                {KR_SIDO.map(s=>(<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div style={{flex:'0 1 150px',minWidth:110}}>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>구·군</div>
              <select className="sel" style={{height:34,fontSize:13}} value={selGu} onChange={e=>setSelGu(e.target.value)}>
                <option value="">전체</option>
                {(selSido?KR_GU[selSido]||[]:[...new Set(KR_SIDO.flatMap(s=>KR_GU[s]||[]))]).slice().sort((a,b)=>a.localeCompare(b,'ko')).map(g=>(<option key={g} value={g}>{g}</option>))}
              </select>
            </div>
            <div style={{flex:'0 1 150px',minWidth:110}}>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>진행 상태</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advStatus} onChange={e=>setAdvStatus(e.target.value)}>
                <option value="">전체</option>{propStatusFilterLabels(true).map(s=>(<option key={s}>{s}</option>))}
              </select>
            </div>
          </div>
            </>
          ):(
            <>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,minmax(0,1fr))':'repeat(7,minmax(0,1fr))',gap:'12px 14px'}}>
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
                  <select className="sel" style={{height:34,fontSize:13}} value={advMain} onChange={e=>setAdvMain(e.target.value)}>
                    <option value="">전체</option>
                    {SALE_PROP_KIND_OPTS.map(({id,label})=>(<option key={id} value={id}>{label}</option>))}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>진행 상태</div>
                  <select className="sel" style={{height:34,fontSize:13}} value={advStatus} onChange={e=>setAdvStatus(e.target.value)}>
                    <option value="">전체</option>{PROP_STATUS_FILTER_LABELS.map(s=>(<option key={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>담당자</div>
                  <select className="sel" style={{height:34,fontSize:13}} value={advAgent} onChange={e=>setAdvAgent(e.target.value)}>
                    <option value="">전체</option>
                    {agentNameOpts.map((n)=>(<option key={n} value={n}>{n}</option>))}
                    <option value={PROP_AGENT_NONE}>미지정</option>
                  </select>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>가격 최소(만)</div>
                  <input className="inp" inputMode="numeric" style={{height:34,fontSize:13}} value={advPriceMin} onChange={e=>setAdvPriceMin(fmtInputNum(e.target.value))} placeholder="0"/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>가격 최대(만)</div>
                  <input className="inp" inputMode="numeric" style={{height:34,fontSize:13}} value={advPriceMax} onChange={e=>setAdvPriceMax(fmtInputNum(e.target.value))} placeholder="0"/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,minmax(0,1fr))':'repeat(5,minmax(0,1fr))',gap:'12px 14px',marginTop:12,maxWidth:isMobile?undefined:920}}>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>대지면적 최소(평)</div>
                  <input className="inp" inputMode="decimal" style={{height:34,fontSize:13}} value={advLandMin} onChange={e=>setAdvLandMin(fmtInputNum(e.target.value,{decimal:true}))} placeholder="0"/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>대지면적 최대(평)</div>
                  <input className="inp" inputMode="decimal" style={{height:34,fontSize:13}} value={advLandMax} onChange={e=>setAdvLandMax(fmtInputNum(e.target.value,{decimal:true}))} placeholder="0"/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>연면적 최소(평)</div>
                  <input className="inp" inputMode="decimal" style={{height:34,fontSize:13}} value={advFloorMin} onChange={e=>setAdvFloorMin(fmtInputNum(e.target.value,{decimal:true}))} placeholder="-"/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>연면적 최대(평)</div>
                  <input className="inp" inputMode="decimal" style={{height:34,fontSize:13}} value={advFloorMax} onChange={e=>setAdvFloorMax(fmtInputNum(e.target.value,{decimal:true}))} placeholder="-"/>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>수익률 이상(%)</div>
                  <input className="inp" inputMode="decimal" style={{height:34,fontSize:13}} value={advRoiMin} onChange={e=>setAdvRoiMin(fmtInputNum(e.target.value,{decimal:true}))} placeholder="-"/>
                </div>
              </div>
            </>
          )}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <Btn role="toolbar-primary" ch="검색 적용" ic="ti-search" on={applyAdvSearch}/>
            <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={resetAdvSearch}/>
          </div>
        </div>
      )}
      {/* 검색 결과 구분: 목록 바로 위 */}
      <div style={{background:C.surf,borderBottom:`1px solid ${C.bdr}`,padding:isMobile?'0 12px':'0 28px',display:'flex',gap:0,alignItems:'center',overflowX:isMobile&&!ownerScopeMenuOpen?'auto':'visible',flexShrink:0,overflowY:'visible'}}>
        {statusTabList.map(t=>{
          const isAllScope=t.id==='ALL'&&showOwnerScopeTabs;
          const allLabel=ownerScopeTab==='MINE'?'내 매물':'전체';
          const active=statusTab===t.id;
          return (
          <React.Fragment key={t.id}>
          {t.separate&&<div aria-hidden style={{width:1,alignSelf:'stretch',background:C.bdr,margin:'8px 6px',flexShrink:0}}/>}
          <div ref={isAllScope?ownerScopeMenuRef:undefined} style={{position:'relative',flexShrink:0}}>
            <div onClick={()=>{
              if(isAllScope){
                goStatusTab('ALL',{toggleOwnerScope:true});
                return;
              }
              goStatusTab(t.id);
            }} style={{padding:'10px 18px',cursor:'pointer',fontSize:13,fontWeight:active?600:400,color:active?C.brand:C.txM,borderBottom:active?`2px solid ${C.brand}`:'2px solid transparent',marginBottom:-1,transition:'color .1s',display:'flex',alignItems:'center',gap:5,userSelect:'none'}}>
              {isAllScope?allLabel:t.label}
              {isAllScope&&<span style={{fontSize:11,opacity:ownerScopeTab==='MINE'?1:.35,lineHeight:1}}>▼</span>}
              {t.id!=='ALL'&&<span style={{fontSize:12,color:t.id==='FAV'?'#F59E0B':C.txP}}>{
                countForListTab(baseProps,t.id,propFolders,mode)
              }</span>}
            </div>
            {isAllScope&&ownerScopeMenuOpen&&(
              <div style={{position:'absolute',top:'100%',left:0,zIndex:20,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,boxShadow:'0 8px 24px rgba(15,23,42,.12)',minWidth:112,padding:'4px 0',marginTop:2}}>
                {[{id:'ALL',label:'전체'},{id:'MINE',label:'내 매물'}].map(opt=>(
                  <div key={opt.id} onClick={()=>{
                    setOwnerScopeTab(opt.id);
                    sanitizeTradeFiltersForTab();
                    setStatusTab('ALL');
                    setVisibleCount(20);
                    setSearchParams({}, {replace:true});
                    setOwnerScopeMenuOpen(false);
                  }} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:ownerScopeTab===opt.id?C.brand:C.tx,fontWeight:ownerScopeTab===opt.id?600:400,whiteSpace:'nowrap'}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surf2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          </React.Fragment>
          );
        })}
        {rentList&&(
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,padding:'6px 0 6px 16px',flexShrink:0}}>
            <span style={{fontSize:12,color:C.txM,fontWeight:600,whiteSpace:'nowrap'}}>담당자</span>
            <select className="sel" style={{height:30,fontSize:13,minWidth:120}} value={colFilter.agent||''} onChange={e=>setColFilter((f)=>({...f,agent:e.target.value}))}>
              <option value="">전체</option>
              {agentNameOpts.map((n)=>(<option key={n} value={n}>{n}</option>))}
              <option value={PROP_AGENT_NONE}>미지정</option>
            </select>
          </div>
        )}
      </div>
      {showOwnerScopeTabs&&ownerScopeTab==='ALL'&&!canViewTeamProps&&!isCeoRole(companyRole)&&(
        <div style={{padding:isMobile?'8px 12px 10px':'8px 28px 10px',fontSize:12,color:C.txM,lineHeight:1.5,background:C.surf2,borderBottom:`1px solid ${C.bdr}`}}>
          동료 매물 보기 권한이 없어 <strong style={{color:C.tx}}>내가 등록한 매물</strong>만 표시됩니다. 권한 변경은 대표에게 문의하세요.
        </div>
      )}
      {showOwnerScopeTabs&&ownerScopeTab==='ALL'&&canViewTeamProps&&!isCeoRole(companyRole)&&P.filter(p=>p.ownerId&&p.ownerId!==user?.id).length===0&&(
        <div style={{padding:isMobile?'8px 12px 10px':'8px 28px 10px',fontSize:12,color:C.txM,lineHeight:1.5,background:C.surf2,borderBottom:`1px solid ${C.bdr}`}}>
          공유 매물이 아직 없습니다. <strong style={{color:C.tx}}>대시보드 상단「동기화」</strong>를 눌러 주세요. 옆 <strong style={{color:C.tx}}>?</strong> 버튼에서 안내를 볼 수 있습니다.
        </div>
      )}
      <div ref={scrollRef} style={{flex:1,minHeight:0,overflow:'auto',padding:isMobile?'12px 16px 16px':'16px 28px'}} onScroll={handleScroll}>
        {statusTab==='FOLDER'&&(
          <div style={{marginBottom:16}} onClick={()=>setFolderAddOpen(null)}>
            <div style={{fontSize:12,fontWeight:700,color:C.txM,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
              폴더별 매물
              <span style={{fontSize:12,color:C.txP,fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:4}}>· {folders.length}개 폴더</span>
            </div>
            {folders.length===0?(
              <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'18px 20px',fontSize:13,color:C.txP,display:'flex',alignItems:'center',gap:8}}>
                만든 폴더가 없습니다. <span onClick={()=>onOpen('fm',null)} style={{color:C.brand,fontWeight:600,cursor:'pointer'}}>그룹 관리에서 만들어보세요</span>
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
          <PropertyCardList properties={visible} variant={rentList?'rental':'sale'} onOpen={openProperty} onToggleFav={togglePropertyFav} getSharedLabel={getSharedLabel} emptyMessage={rentList?'등록된 임대 매물이 없습니다':'조건에 맞는 매물이 없습니다'}/>
        ):(
        <div style={{background:C.surf,borderRadius:10,overflowX:'auto',padding:`0 ${PROP_LIST_PAD_X}px`,boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
          <style dangerouslySetInnerHTML={{__html:`.prop-list-tbl{border-collapse:separate;border-spacing:0}.prop-list-tbl th,.prop-list-tbl td{padding:10px 8px!important;letter-spacing:-0.01em;vertical-align:middle}.prop-list-tbl thead th{color:${C.txM}!important}.prop-list-tbl .prop-col-price{padding:10px 6px!important;font-size:12px;text-align:right}.prop-list-tbl .prop-col-num{text-align:right;font-size:12px;white-space:nowrap}.prop-list-tbl tbody .prop-col-zone{text-align:center;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.prop-list-tbl thead .prop-col-zone{text-align:center}${PROP_LIST_TBL_ADDR_CSS}${PROP_LIST_TBL_METRICS_CSS}${PROP_LIST_TBL_DATE_CSS}${rentList?PROP_RENT_TBL_AGENT_CSS+PROP_RENT_TBL_AREA_CSS:PROP_LIST_TBL_CREATED_STICKY_CSS}${PROP_LIST_TBL_ACTION_CSS}`}}/>
          <table className="tbl prop-list-tbl" style={{tableLayout:'fixed',minWidth:rentList?PROP_RENT_LIST_MIN_W:PROP_LIST_MIN_W,width:'100%'}} onClick={()=>setOpenColFilter(null)}>
            <colgroup>
              <col style={{width:PROP_COL.check}}/>
              <col style={{width:PROP_COL.star}}/>
              <col style={{width:PROP_COL.status}}/>
              {rentList&&<col style={{width:PROP_RENT_COL.trade}}/>}
              <col style={{width:PROP_COL.tag}}/>
              <col style={{width:rentList?propRentAddrColWidth:propAddrColWidth}}/>
              {rentList?(
                <>
                  <col style={{width:PROP_RENT_COL.contractArea}}/>
                  <col style={{width:PROP_RENT_COL.exclusiveArea}}/>
                  <col style={{width:PROP_RENT_COL.unitFloor}}/>
                  <col style={{width:PROP_RENT_COL.deposit}}/>
                  <col style={{width:PROP_RENT_COL.rent}}/>
                  <col style={{width:PROP_RENT_COL.noc}}/>
                  <col style={{width:PROP_RENT_COL.maintenance}}/>
                  <col style={{width:PROP_RENT_COL.lastCall}}/>
                  <col style={{width:PROP_RENT_COL.moveIn}}/>
                  <col style={{width:PROP_RENT_COL.agent}}/>
                </>
              ):(
                <>
                  <col style={{width:PROP_PRICE}}/>
                  <col style={{width:PROP_COL.roi}}/>
                  <col style={{width:PROP_COL.landArea}}/>
                  <col style={{width:PROP_COL.floorArea}}/>
                  <col style={{width:PROP_COL.zoning}}/>
                  <col style={{width:PROP_COL.landPy}}/>
                  <col style={{width:PROP_COL.floorPy}}/>
                  <col style={{width:PROP_COL.updatedAt}}/>
                  <col style={{width:PROP_COL.agent}}/>
                </>
              )}
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
                      {propStatusOpts(rentList).map(({id,label})=>(
                        <div key={id} onClick={()=>{setColFilter(f=>({...f,status:id}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.status===id?C.brand:C.tx,fontWeight:colFilter.status===id?600:400}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{label}</div>
                      ))}
                    </div>
                  )}
                </th>
                {rentList&&(
                <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                  <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                    onClick={()=>setOpenColFilter(v=>v==='trade'?null:'trade')}>거래방식<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.trade?1:.28}}>▼</span></span>
                  {openColFilter==='trade'&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:120,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                      <div onClick={()=>{setColFilter(f=>({...f,trade:''}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.trade?C.brand:C.tx,fontWeight:!colFilter.trade?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                      {listTradeOpts.map((o)=>(
                        <div key={o.id} onClick={()=>{setColFilter(f=>({...f,trade:o.id}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.trade===o.id?C.brand:C.tx,fontWeight:colFilter.trade===o.id?600:400}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{o.label}</div>
                      ))}
                    </div>
                  )}
                </th>
                )}
                <th style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                  <span style={{cursor:'pointer',display:'flex',alignItems:'center',gap:3}}
                    onClick={()=>setOpenColFilter(v=>v==='tag'?null:'tag')}>종류<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.tag?1:.28}}>▼</span></span>
                  {openColFilter==='tag'&&(
                    <div style={{position:'absolute',top:'100%',left:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:140,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4}}>
                      <div onClick={()=>{setColFilter(f=>({...f,tag:''}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.tag?C.brand:C.tx,fontWeight:!colFilter.tag?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                      {[...new Set(baseProps.filter((p)=>propertyBelongsToListTab(p,statusTab,{inFolder:(propFolders[p.id]||[]).length>0,dealMode:mode})).map(p=>p.tag).filter(Boolean))].map(t=>(
                        <div key={t} onClick={()=>{setColFilter(f=>({...f,tag:t}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.tag===t?C.brand:C.tx,fontWeight:colFilter.tag===t?600:400}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{t}</div>
                      ))}
                    </div>
                  )}
                </th>
                {rentList?(
                  <th className="prop-col-addr" style={{cursor:'pointer'}} onClick={()=>toggleSort('addr')}>주소 / 건물명 {sortMark('addr')}</th>
                ):(
                  <th className="prop-col-addr">주소 / 건물명</th>
                )}
                {rentList?(
                  <>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('contractArea')}>계약면적 {sortMark('contractArea')}</th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('exclusiveArea')}>전용면적 {sortMark('exclusiveArea')}</th>
                    <th className="prop-col-metrics" style={{textAlign:'center'}}>해당층</th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('deposit')}>보증금 {sortMark('deposit')}</th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('rent')}>임대료 {sortMark('rent')}</th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('noc')}>NOC {sortMark('noc')}</th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('maintenance')}>관리비 {sortMark('maintenance')}</th>
                    <th className="prop-col-date prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('lastCall')}>최종통화일 {sortMark('lastCall')}</th>
                    <th className="prop-col-date prop-col-movein prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('moveInDate')}>입주가능일 {sortMark('moveInDate')}</th>
                    <th className="prop-col-date prop-col-agent prop-col-metrics" style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
                      <span style={{cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:3}}
                        onClick={()=>setOpenColFilter(v=>v==='agent'?null:'agent')}>담당자<span style={{fontSize:11,color:C.txM,marginLeft:2,opacity:colFilter.agent?1:.28}}>▼</span></span>
                      {openColFilter==='agent'&&(
                        <div style={{position:'absolute',top:'100%',right:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,minWidth:140,boxShadow:'0 6px 20px rgba(0,0,0,.12)',marginTop:4,textAlign:'left'}}>
                          <div onClick={()=>{setColFilter(f=>({...f,agent:''}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:!colFilter.agent?C.brand:C.tx,fontWeight:!colFilter.agent?600:400}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>전체</div>
                          {agentNameOpts.map((n)=>(
                            <div key={n} onClick={()=>{setColFilter(f=>({...f,agent:n}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.agent===n?C.brand:C.tx,fontWeight:colFilter.agent===n?600:400}}
                              onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{n}</div>
                          ))}
                          <div onClick={()=>{setColFilter(f=>({...f,agent:PROP_AGENT_NONE}));setOpenColFilter(null);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:13,color:colFilter.agent===PROP_AGENT_NONE?C.brand:C.tx,fontWeight:colFilter.agent===PROP_AGENT_NONE?600:400}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.surf2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>미지정</div>
                        </div>
                      )}
                    </th>
                  </>
                ):(
                  <>
                    <th onClick={()=>toggleSort('price')} className="prop-col-price prop-col-metrics" style={{cursor:'pointer'}}>
                      매도호가 {sortMark('price')}
                    </th>
                    <th className="prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('roi')}>
                      수익률 {sortMark('roi')}
                    </th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('landArea')}>
                      대지면적 {sortMark('landArea')}
                    </th>
                    <th className="prop-col-num prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('floorArea')}>
                      연면적 {sortMark('floorArea')}
                    </th>
                    <th className="prop-col-zone prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('zoning')}>
                      용도지역 {sortMark('zoning')}
                    </th>
                    <th className="prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('landPy')}>
                      대지단가 {sortMark('landPy')}
                    </th>
                    <th className="prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('floorPy')}>
                      연면적단가 {sortMark('floorPy')}
                    </th>
                    <th className="prop-col-date prop-col-updated prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('updatedAt')}>
                      최종수정일 {sortMark('updatedAt')}
                    </th>
                    <th className="prop-col-date prop-col-agent prop-col-metrics" style={{cursor:'pointer'}} onClick={()=>toggleSort('agentName')}>
                      담당자 {sortMark('agentName')}
                    </th>
                  </>
                )}
                {PROP_LIST_SHOW_ROW_ACTIONS&&<th className="prop-col-action"/>}
              </tr>
            </thead>
            <tbody>
              {visible.length===0?(
                <tr>
                  <td colSpan={rentList?16:(PROP_LIST_SHOW_ROW_ACTIONS?15:14)} style={{height:140,textAlign:'center',color:C.txP,fontSize:14,cursor:'default'}}>
                    {otherDealCount&&!search&&!appliedAdv&&!colFilter.status&&!colFilter.tag&&!colFilter.trade
                      ?`이 목록은 ${rentList?'임대':'매매'} 매물만 표시합니다. 상단에서 ${rentList?'매매':'임대'}로 전환해 보세요.`
                      :(search||appliedAdv||colFilter.status||colFilter.tag||colFilter.trade
                        ?'조건에 맞는 매물이 없습니다. 상세검색을 초기화하거나 상태 필터를 전체로 바꿔 보세요.'
                        :(rentList?'등록된 임대 매물이 없습니다':'등록된 매물이 없습니다'))}
                  </td>
                </tr>
              ):visible.map(p=>rentList?(
                <PropRentRow key={p.id} p={p} onOpenDetail={openProperty} onToggleFav={togglePropertyFav} checked={checked} toggleCheck={toggleCheck}
                  sharedLabel={getSharedLabel(p)}/>
              ):(
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
                  {folders.length===0&&<div style={{padding:'12px 14px',fontSize:12,color:C.txP}}>그룹 관리에서 먼저 폴더를 만들어주세요</div>}
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
    <td style={{whiteSpace:'nowrap'}}><PropStatusBdg s={p.status}/></td>
    <td style={{whiteSpace:'nowrap'}}><Bdg label={propKindDisplayLabel(p)||p.tag} type="gray"/></td>
    <td className="prop-col-addr" style={{overflow:'hidden',verticalAlign:'middle'}}>
      <PropJibunPhotoPreview property={p}>
        <div className="cell-wrap" style={{fontWeight:500,fontSize:14}}>{propDisplayAddr(p)}</div>
      </PropJibunPhotoPreview>
      {sharedLabel&&<div style={{marginTop:4}}><span style={{display:'inline-flex',alignItems:'center',fontSize:11,fontWeight:600,color:'#185FA5',background:'#E6F1FB',borderRadius:4,padding:'2px 7px'}}>{sharedLabel}</span></div>}
      {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
      <PropSyncHint rec={p} cloudEnabled={isSupabaseConfigured}/>
    </td>
    <td className="prop-col-price prop-col-metrics" style={{fontWeight:600,color:C.info,fontSize:12,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={propPrice(p)}>{propPrice(p)}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:C.ok,fontWeight:500}}>{p.roi||'-'}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:p.land>0?C.tx:C.txP}}>{propLandPyungLabel(p)}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:p.floor>0?C.tx:C.txP}}>{propFloorPyungLabel(p)}</td>
    <PropZoningCell p={p} className="prop-col-zone prop-col-metrics"/>
    <td className="prop-col-num prop-col-metrics" style={{color:p.land>0&&p.price>0?C.tx:C.txP}}>{fmtLandPyUnit(p.price,p.land)}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:p.floor>0&&p.price>0?C.tx:C.txP}}>{fmtLandPyUnit(p.price,p.floor)}</td>
    <td className="prop-col-date prop-col-updated prop-col-metrics" style={{color:C.txM,fontSize:12,whiteSpace:'nowrap'}}>{fmtPropUpdatedAt(p)}</td>
    <td className="prop-col-date prop-col-agent prop-col-metrics" style={{color:C.txM,fontSize:12,whiteSpace:'nowrap'}}>{propAgentLabel(p)}</td>
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
const RentalAreaCell=({m2})=>{
  const a=rentalAreaParts(m2);
  return (
    <td className="prop-col-num prop-col-metrics prop-col-area" style={{color:m2>0?C.tx:C.txP}} title={fmtRentalAreaCell(m2)}>
      {a?<>{a.m2Label}{a.pyLabel&&<div style={{fontSize:11,color:C.txM}}>{a.pyLabel}</div>}</>:'—'}
    </td>
  );
};
const PropRentRow=({p,onOpenDetail,onToggleFav,checked,toggleCheck,sharedLabel})=>(
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
    <td style={{whiteSpace:'nowrap'}}><PropStatusBdg s={p.status} rent/></td>
    <td style={{whiteSpace:'nowrap',overflow:'hidden'}}><span style={{fontSize:12,color:C.txM}}>{rentalTradeLabel(p.trade)}</span></td>
    <td style={{whiteSpace:'nowrap'}}><Bdg label={propKindDisplayLabel(p)||p.tag} type="gray"/></td>
    <td className="prop-col-addr" style={{overflow:'hidden',verticalAlign:'middle'}}>
      <PropJibunPhotoPreview property={p}>
        <div className="cell-wrap" style={{fontWeight:500,fontSize:14}}>{propDisplayAddr(p)}</div>
      </PropJibunPhotoPreview>
      {sharedLabel&&<div style={{marginTop:4}}><span style={{display:'inline-flex',alignItems:'center',fontSize:11,fontWeight:600,color:'#185FA5',background:'#E6F1FB',borderRadius:4,padding:'2px 7px'}}>{sharedLabel}</span></div>}
      {p.bldg&&<div className="cell-wrap" style={{fontSize:12,color:C.txM,marginTop:2}}>{p.bldg}</div>}
      <PropSyncHint rec={p} cloudEnabled={isSupabaseConfigured}/>
    </td>
    <RentalAreaCell m2={p.contractArea}/>
    <RentalAreaCell m2={p.exclusiveArea}/>
    <td className="prop-col-metrics" style={{textAlign:'center',fontSize:12,color:p.unitFloor?C.tx:C.txP,whiteSpace:'nowrap'}}>{p.unitFloor||'—'}</td>
    <td className="prop-col-num prop-col-metrics" style={{fontWeight:600,color:C.info}}>{fmtRentalMan(rentalDepositMan(p))}</td>
    <td className="prop-col-num prop-col-metrics" style={{fontWeight:600,color:C.info}}>{fmtRentalMan(rentalRentMan(p))}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:rentalNocManPerPy(p)!=null?C.tx:C.txP,whiteSpace:'nowrap'}}>{fmtRentalNoc(p)}</td>
    <td className="prop-col-num prop-col-metrics" style={{color:rentalMaintMan(p)>0?C.tx:C.txP}}>{fmtRentalMan(rentalMaintMan(p))}</td>
    <td className="prop-col-date prop-col-metrics" style={{color:p.lastCall!=='—'?C.txS:C.txP,fontSize:12,whiteSpace:'nowrap'}}>{p.lastCall}</td>
    <td className="prop-col-date prop-col-movein prop-col-metrics" style={{color:p.moveInDate?C.tx:C.txP,fontSize:12,whiteSpace:'nowrap'}}>{fmtListDotDate(p.moveInDate)}</td>
    <td className="prop-col-date prop-col-agent prop-col-metrics" style={{color:C.txM,fontSize:12,whiteSpace:'nowrap'}}>{propAgentLabel(p)}</td>
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
    <Win title="그룹 관리" ic="ti-folder" onClose={onClose} w={920}
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
const TradeModeChips=({trade,setTrade})=>{
  const { mode }=useDealMode();
  const tradeOpts=tradesForDealMode(mode);
  return(
    <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',justifyContent:'flex-end'}}>
      {tradeOpts.map(t=>(
        <div key={t} onClick={()=>setTrade(t)} style={{padding:'4px 12px',borderRadius:20,border:'1.5px solid',borderColor:trade===t?C.brand:C.bdr,background:trade===t?C.brandL:'transparent',color:trade===t?C.brand:C.txS,fontSize:12,cursor:'pointer',fontWeight:trade===t?700:400,lineHeight:1.2,transition:'all .1s'}}>
          {TL[t]}
        </div>
      ))}
    </div>
  );
};

const PropPriceSection=({trade,priceForm,setPriceForm,idPrefix='',subType,collectMoveInDate=false})=>{
  const set=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:e.target.value}));
  const setNum=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:fmtInputNum(e.target.value)}));
  const setDecNum=(k)=>(e)=>setPriceForm((f)=>({...f,[k]:fmtInputNum(e.target.value,{decimal:true})}));
  const L=({children,req})=>(<div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>{children}{req&&<span style={{color:C.brand}}> *</span>}</div>);
  const numVal=(k)=>fmtInputNum(priceForm[k]??'');
  const decVal=(k)=>fmtInputNum(priceForm[k]??'',{decimal:true});
  const showInvest=showsSaleInvestmentFields(trade, subType);
  const showUnit=showsRentalUnitFields(trade);

  return(
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14}}>
        {isSaleTrade(trade)&&<>
          <div><L req>매도호가 (만)</L><input className="inp" inputMode="numeric" value={numVal('price')} onChange={setNum('price')} placeholder="예: 4,300,000"/></div>
          <div><L>입금가 (만)</L><input className="inp" inputMode="numeric" value={numVal('inPrice')} onChange={setNum('inPrice')} placeholder="예: 4,300,000"/></div>
          {showInvest&&(
            <div style={{gridColumn:'1 / -1',fontSize:12,color:C.txP,lineHeight:1.5}}>
              보증금·월임대료·임차계약만료일·수익률은 임대차관리에서 입력합니다.
            </div>
          )}
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
          {collectMoveInDate&&(()=>{
            const immediate=isMoveInImmediate(priceForm.moveInDate);
            const immId=`${idPrefix}moveInImm`;
            return(
              <div>
                <L>입주가능일</L>
                <input type="date" className="inp" value={immediate?'':(priceForm.moveInDate||'')}
                  onChange={(e)=>setPriceForm((f)=>({...f,moveInDate:e.target.value}))}
                  disabled={immediate} style={immediate?{background:C.surf2}:undefined}/>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
                  <input type="checkbox" id={immId} checked={immediate}
                    onChange={(e)=>setPriceForm((f)=>({...f,moveInDate:e.target.checked?MOVE_IN_IMMEDIATE:''}))}
                    style={{width:16,height:16,accentColor:C.brand}}/>
                  <label htmlFor={immId} style={{fontSize:13,color:C.txS,cursor:'pointer'}}>즉시입주가능</label>
                </div>
              </div>
            );
          })()}
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
        </>}
    </div>
  );
};

const LAND_FORM_FIELDS=[
  {label:'토지면적 (㎡)',key:'landAreaM2',min:7},
  {label:'용도지역',key:'landUseZone',min:8},
  {label:'지목',key:'landCategory',min:4},
  {label:'개별공시지가 (원/㎡)',key:'officialPriceM2',min:10},
  {label:'기준년도',key:'officialPriceYear',min:4},
];

const landFieldWeight=(label,value,min)=>{
  const val=String(value??'');
  return Math.max(min,[...String(label)].length,[...val].length+1);
};

const PropLandFields=({landForm,setLandForm,readOnlyStyle,locked})=>{
  const set=(k)=>(e)=>{
    if(locked) return;
    if(k==='officialPriceM2'){
      const raw=e.target.value.replace(/\D/g,'');
      setLandForm((f)=>({...f,officialPriceM2:raw===''?'':fmtNum(raw)}));
      return;
    }
    setLandForm((f)=>({...f,[k]:e.target.value}));
  };
  return(
    <div style={{display:'flex',gap:10,alignItems:'flex-end',width:'100%',minWidth:0,overflowX:'auto'}}>
      {LAND_FORM_FIELDS.map(({label,key,min})=>{
        const val=landForm[key]??'';
        const w=landFieldWeight(label,val,min);
        return(
          <div key={key} style={{flex:`${w} 1 ${Math.max(56,w*9)}px`,minWidth:key==='officialPriceYear'?72:0}}>
            <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6,whiteSpace:'nowrap'}}>{label}</div>
            <input className="inp" value={val} onChange={set(key)} readOnly={!!locked} inputMode={key==='officialPriceM2'?'numeric':undefined} style={readOnlyStyle||(locked?{background:C.surf2}:undefined)}/>
          </div>
        );
      })}
    </div>
  );
};

const PropExtraParcelsList=({extraParcels,onChangeLand,onRemove,onRefetch})=>{
  if(!extraParcels?.length) return null;
  return extraParcels.map((p,i)=>(
    <div key={p.id} style={{border:`1px solid ${C.bdr}`,borderRadius:8,padding:'12px 14px',background:C.surf2}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,color:C.tx}}>추가 필지 {i+1}</div>
          <div style={{fontSize:12,color:C.txM,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {p.jibunAddr||p.roadAddr||'주소 없음'}
            {p.status==='loading'?' · 토지정보 조회 중…':''}
            {p.status==='success'?' · API완료':''}
            {p.status==='error'&&p.error?` · ${p.error}`:''}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexShrink:0}}>
          {onRefetch&&(
            <button type="button" onClick={()=>onRefetch(p.id)} disabled={p.status==='loading'}
              style={{border:'none',background:'transparent',padding:'4px 6px',fontSize:12,cursor:p.status==='loading'?'wait':'pointer',color:C.txS,textDecoration:'underline'}}>
              재조회
            </button>
          )}
          <button type="button" onClick={()=>onRemove(p.id)}
            style={{border:'none',background:'transparent',padding:'4px 6px',fontSize:12,cursor:'pointer',color:C.txS,textDecoration:'underline'}}>
            삭제
          </button>
        </div>
      </div>
      <PropLandFields
          landForm={p.landForm}
          setLandForm={(fn)=>onChangeLand(p.id,fn)}
          readOnlyStyle={(p.status==='success'||p.status==='loading')?{background:'#fff'}:undefined}
        />
    </div>
  ));
};

const PropFieldLabel=({children,req})=>(
  <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>{children}{req&&<span style={{color:C.brand}}> *</span>}</div>
);

const PropFormSplit=({children})=>(
  <div className="prop-form-split">{children}</div>
);
const PropFormCol=({children})=>(
  <div className="prop-form-col">{children}</div>
);

const lookupApiBadge=(lookup)=>lookup.status==='loading'?'조회중…'
  :lookup.status==='success'?'API완료'
  :lookup.status==='unverified'?'미확인'
  :lookup.status==='error'?'API오류'
  :lookup.status==='address_confirmed'?'코드대기':'API';

const PropLocationBlock=({
  lookup, isLoading, extraParcelLoading,
  roadSearch,
  onAddressSearch, onResetAddress, onAddParcelSearch,
  setLocationForm,
  extraParcels, onRemoveExtra,
  jibunValue, roadValue, ownerNameValue, ownerTelValue, roadInfoValue,
})=>{
  const openSearch=()=>{ if(!isLoading) onAddressSearch(); };
  const searchFieldStyle={flex:1,cursor:isLoading?'wait':'pointer',background:'#fff'};
  const lockedFieldStyle={background:C.surf2,cursor:isLoading?'wait':'pointer'};
  return(
    <>
      <SecLabel ch="소재지" badge={lookupApiBadge(lookup)} formSection/>
      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
        {lookup.error&&<div style={{fontSize:12,color:C.err,padding:'8px 12px',background:C.errBg,borderRadius:7}}>{lookup.error}</div>}
        {lookup.warnings?.length>0&&lookup.status!=='idle'&&(
          <div style={{fontSize:12,color:C.warn,padding:'8px 12px',background:C.warnBg,borderRadius:7}}>
            {lookup.warnings.join(' · ')}
          </div>
        )}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <input className="inp" value={roadSearch} readOnly
            onClick={openSearch}
            onKeyDown={e=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); openSearch(); } }}
            placeholder="클릭하면 주소 검색 — 도로명·지번·건물명" style={{...searchFieldStyle,flex:'1 1 180px',minWidth:160}} disabled={isLoading}/>
          <Btn role="page-primary" ch={isLoading?'조회중…':'주소 검색'} ic="ti-search" on={openSearch}/>
          <Btn role="page-secondary" ch="초기화" ic="ti-x" on={onResetAddress}/>
          <Btn role="page-secondary" ch={extraParcelLoading?'필지 조회중…':'필지 추가'} ic="ti-plus" on={onAddParcelSearch}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:14,alignItems:'start'}}>
          <div>
            <PropFieldLabel>지번주소</PropFieldLabel>
            <input className="inp" value={jibunValue} readOnly onClick={openSearch} style={lockedFieldStyle}/>
          </div>
          <div>
            <PropFieldLabel>도로명주소</PropFieldLabel>
            <input className="inp" value={roadValue} readOnly onClick={openSearch} style={lockedFieldStyle}/>
          </div>
          {(extraParcels||[]).map((p)=>(
            <React.Fragment key={p.id}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input className="inp" value={p.jibunAddr||''} readOnly
                  style={{background:C.surf2,flex:1}}
                  placeholder={p.status==='loading'?'조회 중…':'추가 지번주소'}/>
                {onRemoveExtra&&(
                  <button type="button" onClick={()=>onRemoveExtra(p.id)}
                    style={{border:'none',background:'transparent',padding:'4px 6px',fontSize:12,cursor:'pointer',color:C.txS,textDecoration:'underline',flexShrink:0}}>
                    삭제
                  </button>
                )}
              </div>
              <input className="inp" value={p.roadAddr||''} readOnly
                style={{background:C.surf2}}
                placeholder="추가 도로명주소"/>
            </React.Fragment>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:14}}>
          <div>
            <PropFieldLabel>소유주명</PropFieldLabel>
            <input className="inp" value={ownerNameValue||''} onChange={e=>setLocationForm(f=>({...f,ownerName:e.target.value}))} placeholder="소유주 이름"/>
          </div>
          <div>
            <PropFieldLabel>소유주 연락처</PropFieldLabel>
            <PhoneInput value={ownerTelValue} onChange={e=>setLocationForm(f=>({...f,ownerTel:e.target.value}))} placeholder="010-0000-0000"/>
          </div>
          <div>
            <PropFieldLabel>도로조건</PropFieldLabel>
            <input className="inp" value={roadInfoValue} onChange={e=>setLocationForm(f=>({...f,roadInfo:e.target.value}))} placeholder="예: 8m × 4m"/>
          </div>
        </div>
      </div>
    </>
  );
};

const PropLandSection=({apiBadge, extraParcels, landForm, setLandForm, lookupSuccess, onChangeLand, onRemove, onRefetch})=>{
  const hasExtra=extraParcels.length>0;
  return(
    <>
      <SecLabel ch="토지정보" badge={apiBadge} formSection/>
      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
        {hasExtra&&(
          <div style={{fontSize:12,fontWeight:700,color:C.tx}}>합계 (면적 합 · 공시지가 가중평균 · 직접 수정 불가)</div>
        )}
        <PropLandFields
          landForm={hasExtra?aggregateLandForm(landForm,extraParcels):landForm}
          setLandForm={setLandForm}
          locked={hasExtra}
          readOnlyStyle={(lookupSuccess||hasExtra)?{background:C.surf2}:undefined}
        />
        {hasExtra&&(
          <>
            <div style={{fontSize:12,fontWeight:700,color:C.tx,marginTop:4}}>대표 필지</div>
            <PropLandFields landForm={landForm} setLandForm={setLandForm} readOnlyStyle={lookupSuccess?{background:C.surf2}:undefined}/>
          </>
        )}
        <PropExtraParcelsList extraParcels={extraParcels} onChangeLand={onChangeLand} onRemove={onRemove} onRefetch={onRefetch}/>
      </div>
    </>
  );
};

const BUILDING_COMMA_KEYS = new Set(['grossFloorAreaM2', 'vlRatEstmTotAreaM2', 'archAreaM2', 'bcRat', 'vlRat']);

const BUILDING_FORM_FIELDS=[
  {label:'연면적 (㎡)',key:'grossFloorAreaM2',min:8},
  {label:'용적률산정연면적 (㎡)',key:'vlRatEstmTotAreaM2',min:12},
  {label:'건축면적 (㎡)',key:'archAreaM2',min:8},
  {label:'건폐율 (%)',key:'bcRat',min:5},
  {label:'용적률 (%)',key:'vlRat',min:5},
  {label:'지상층수',key:'grndFlrCnt',min:4},
  {label:'지하층수',key:'ugrndFlrCnt',min:4},
  {label:'주차대수',key:'parkingCnt',min:4},
  {label:'승강기 대수',key:'elevatorCnt',min:5},
  {label:'주구조',key:'strctCdNm',min:6},
  {label:'주용도',key:'mainPurpsCdNm',min:8},
  {label:'사용승인일',key:'useAprDay',min:10},
];

const PropBuildingFields=({buildingForm,setBuildingForm,readOnlyStyle})=>{
  const set=(k)=>(e)=>setBuildingForm((f)=>({...f,[k]:e.target.value}));
  const setNum=(k)=>(e)=>setBuildingForm((f)=>({...f,[k]:fmtInputNum(e.target.value,{decimal:true})}));
  const displayVal=(k)=>BUILDING_COMMA_KEYS.has(k)?fmtInputNum(buildingForm[k]??'',{decimal:true}):(buildingForm[k]??'');
  const rowSizes=[3,6,3];
  const rows=[];
  let idx=0;
  for(const n of rowSizes){
    rows.push(BUILDING_FORM_FIELDS.slice(idx,idx+n));
    idx+=n;
  }
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14,width:'100%',minWidth:0}}>
      {rows.map((row,ri)=>(
        <div key={ri} style={{display:'flex',gap:10,alignItems:'flex-end',width:'100%',minWidth:0,overflowX:'auto'}}>
          {row.map(({label,key,min})=>{
            const val=displayVal(key);
            const w=landFieldWeight(label,val,min);
            return(
              <div key={key} style={{flex:`${w} 1 ${Math.max(56,w*9)}px`,minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6,whiteSpace:'nowrap'}}>{label}</div>
                <input className="inp" type={key==='useAprDay'?'date':'text'} inputMode={BUILDING_COMMA_KEYS.has(key)?'decimal':undefined} value={val} onChange={BUILDING_COMMA_KEYS.has(key)?setNum(key):set(key)} style={readOnlyStyle}/>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const PropRegister=({onNav})=>{
  const { accountDefaults, user, teamMembers }=useAuth();
  const { mode, isRent, defaultTrade }=useDealMode();
  const userId=user?.id??null;
  const registerDraft=useMemo(()=>hydratePropertyRegisterDraft(loadPropertyRegisterDraft(userId)),[userId]);
  const [draftReady,setDraftReady]=useState(()=>!registerDraft);
  const draftRestoredRef=useRef(false);
  const [trade,setTrade]=useState(()=>{
    const t=normalizePropTrade(registerDraft?.trade??defaultTrade);
    return tradeMatchesDealMode(t,mode)?t:defaultTrade;
  });
  const [mainType,setMainType]=useState(()=>registerDraft?.mainType??'COMMERCIAL');
  const [subType,setSubType]=useState(()=>registerDraft?.subType??'WHOLE_BUILDING');
  const [saleKind,setSaleKind]=useState(()=>normalizeSalePropKind(registerDraft?.saleKind)||saleKindFromProp({main:registerDraft?.mainType,sub:registerDraft?.subType,tag:''})||'BUILDING');
  const [status,setStatus]=useState(()=>registerDraft?.status??'NEW');
  const [pub,setPub]=useState(()=>registerDraft?.pub??'true');
  const [photoSlots,setPhotoSlots]=useState(()=>registerDraft?.photoSlots??[null,null,null]);
  const [priceForm,setPriceForm]=useState(()=>registerDraft?.priceForm??emptyPriceForm());
  useEffect(()=>{
    setTrade((prev)=>{
      const t=normalizePropTrade(prev);
      if(!tradeMatchesDealMode(t,mode)) return defaultTrade;
      return t;
    });
  },[mode,defaultTrade]);
  const [roadSearch,setRoadSearch]=useState(()=>registerDraft?.roadSearch??'');
  const [addressModalOpen,setAddressModalOpen]=useState(false);
  const [addressModalMode,setAddressModalMode]=useState('primary');
  const [detailForm,setDetailForm]=useState(()=>registerDraft?.detailForm??{
    title:'', agentName:'', agentTel:'', promo:'', memo:'', discoUrl:'', folderUrl:'',
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
    extraParcels, addExtraParcelFromAddress, removeExtraParcel, updateExtraParcelLand, extraParcelLoading, refetchExtraParcel,
    handleAddressFetchSuccess, resetAddressLookup, isLoading,
    restoreAddressLookupDraft,
  }=usePropertyAddressLookup({ mode:'register' });

  const persistDraftRef=useRef(true);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(draftRestoredRef.current||!registerDraft) return;
    draftRestoredRef.current=true;
    restoreAddressLookupDraft(registerDraft);
    setDraftReady(true);
  },[registerDraft,restoreAddressLookupDraft]);

  useEffect(()=>{
    if(!draftReady) return;
    const timer=window.setTimeout(()=>{
      if(!persistDraftRef.current) return;
      savePropertyRegisterDraft({
        trade, mainType, subType, saleKind, status, pub,
        priceForm, roadSearch, detailForm, photoSlots,
        locationForm, landForm, buildingForm, addressKeys, extraParcels,
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
    trade, mainType, subType, saleKind, status, pub,
    priceForm, roadSearch, detailForm, photoSlots,
    locationForm, landForm, buildingForm, addressKeys, extraParcels, lookup,
  ]);
  const subOpts=Object.fromEntries(visiblePropSubEntries(mainType,subType));

  const onAddressSearch=()=>{ setAddressModalMode('primary'); setAddressModalOpen(true); };
  const onAddParcelSearch=()=>{ setAddressModalMode('extra'); setAddressModalOpen(true); };
  const onResetAddress=()=>{
    setRoadSearch('');
    resetAddressLookup();
  };

  const onAddressSelected=async (addr)=>{
    if(addressModalMode==='extra'){
      await addExtraParcelFromAddress(addr);
      return;
    }
    setRoadSearch(addr.jibunAddr||addr.roadAddr||'');
    await handleAddressFetchSuccess(addr);
  };

  const apiBadge=lookupApiBadge(lookup);

  const handleSave=async()=>{
    if(saving) return;
    if(lookupBlocksPropertySave(lookup, extraParcelLoading)){
      window.alert(propertySaveBlockedTitle(lookup, extraParcelLoading));
      return;
    }
    persistDraftRef.current=false;
    setSaving(true);
    try{
    const addressFields=buildPropertyAddressFields(locationForm, roadSearch);
    const mapCoordFields=await resolveMapCoordFieldsForSave(null, {
      ...addressFields,
      bldg: detailForm.title || '',
    });
    const typeCodes=typeCodesForSave({isSale:!isRent,saleKind,main:mainType,sub:subType});
    const payload={
      main:typeCodes.main, sub:typeCodes.sub, status, pub:pub==='true', trade, fav:false, favAt:null,
      ...addressFields,
      ...mapCoordFields,
      bldg:detailForm.title||'',
      ownerName:locationForm.ownerName||'',
      ownerTel:normalizePhone(locationForm.ownerTel)||'',
      roadInfo:locationForm.roadInfo||'',
      promo:detailForm.promo||'',
      memo:detailForm.memo||'',
      discoUrl:normalizeDiscoUrl(detailForm.discoUrl)||'',
      folderUrl:normalizeHttpUrl(detailForm.folderUrl)||'',
      agentName:detailForm.agentName||'',
      agentTel:normalizePhone(detailForm.agentTel)||'',
      photos:photoSlotsToSave(photoSlots),
      tag:typeCodes.tag,
      lastCall:'—', created:formatCreatedDate(), deletedAt:null,
      ...buildPriceFields(trade, priceForm),
      ...landFieldsForPropertySave(landForm, extraParcels, addressKeys),
      ...buildingToPropertyFields(buildingForm),
    };
    const check=validatePropertyForSave(payload);
    if(!check.ok){
      persistDraftRef.current=true;
      window.alert(check.message);
      return;
    }
    const { sync }=await addProperty(payload);
    clearPropertyRegisterDraft();
    showNotification(propertySaveToastMessage(sync),'success');
    onNav('properties');
    }catch(err){
      persistDraftRef.current=true;
      window.alert(err instanceof Error?err.message:String(err));
    }finally{
      setSaving(false);
    }
  };

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      <AddressSearchModal
        open={addressModalOpen}
        onClose={()=>setAddressModalOpen(false)}
        onSelect={onAddressSelected}
        initialKeyword={addressModalMode==='extra'?'':roadSearch}
        initialMode={addressModalMode==='extra'?'jibun':'all'}
        autoSearchOnOpen={false}
      />
      <PH title="매물 등록" sub="필드에 * 표시는 필수 입력항목입니다"
        acts={<Btn role="page-secondary" ch="일괄 등록" ic="ti-upload" on={()=>onNav&&onNav('registerBulk')}/>}
      />
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'20px 28px 0'}}>
        <PropFormSplit>
          <PropFormCol>
          <SecLabel ch="매물종류 · 상태" formSection/>
          <div className="prop-form-sec-body" style={{padding:'16px 20px',display:'grid',gridTemplateColumns:isRent?'repeat(4,minmax(0,1fr))':'repeat(3,minmax(0,1fr))',gap:14}}>
            {isRent?(
              <>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매물 대분류 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={mainType} onChange={e=>{setMainType(e.target.value);setSubType(visiblePropSubEntries(e.target.value)[0]?.[0]||'');}}>
                {visiblePropMainEntries(mainType).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매물 소분류 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={subType} onChange={e=>setSubType(e.target.value)}>
                {Object.entries(subOpts).map(([k,v])=>(<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
              </>
            ):(
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매물 종류 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={saleKind} onChange={e=>{
                const k=normalizeSalePropKind(e.target.value)||'BUILDING';
                setSaleKind(k);
                const t=typeCodesForSave({isSale:true,saleKind:k});
                setMainType(t.main);setSubType(t.sub);
              }}>
                {SALE_PROP_KIND_OPTS.map(({id,label})=>(<option key={id} value={id}>{label}</option>))}
              </select>
            </div>
            )}
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>진행 상태 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={status} onChange={e=>setStatus(e.target.value)}>{propStatusOpts(isRent).map(({id,label})=>(<option key={id} value={id}>{label}</option>))}</select>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>공개 여부 <span style={{color:C.brand}}>*</span></div>
              <select className="sel" value={pub} onChange={e=>setPub(e.target.value)}><option value="true">공개</option><option value="false">비공개</option></select>
            </div>
          </div>
          </PropFormCol>
          <PropFormCol>
          <SecLabel ch="거래방식 · 가격" formSection end={<TradeModeChips trade={trade} setTrade={setTrade}/>}/>
          <div className="prop-form-sec-body" style={{padding:'16px 20px'}}>
            <PropPriceSection trade={trade} priceForm={priceForm} setPriceForm={setPriceForm} idPrefix="reg_" subType={subType} collectMoveInDate/>
          </div>
          </PropFormCol>
        </PropFormSplit>
        <PropFormSplit>
          <PropFormCol>
          <PropLocationBlock
            lookup={lookup} isLoading={isLoading} extraParcelLoading={extraParcelLoading}
            roadSearch={roadSearch}
            onAddressSearch={onAddressSearch} onResetAddress={onResetAddress} onAddParcelSearch={onAddParcelSearch}
            setLocationForm={setLocationForm}
            extraParcels={extraParcels} onRemoveExtra={removeExtraParcel}
            jibunValue={locationForm.jibunAddr}
            roadValue={locationForm.roadAddr}
            ownerNameValue={locationForm.ownerName}
            ownerTelValue={locationForm.ownerTel}
            roadInfoValue={locationForm.roadInfo}
          />
          <PropLandSection
            apiBadge={apiBadge} extraParcels={extraParcels}
            landForm={landForm} setLandForm={setLandForm}
            lookupSuccess={lookup.status==='success'}
            onChangeLand={updateExtraParcelLand} onRemove={removeExtraParcel} onRefetch={refetchExtraParcel}
          />
          <SecLabel ch="건물정보" badge={apiBadge} formSection/>
          <div style={{padding:'16px 20px'}}>
            <PropBuildingFields buildingForm={buildingForm} setBuildingForm={setBuildingForm} readOnlyStyle={lookup.status==='success'?{background:C.surf2}:undefined}/>
          </div>
          <SecLabel ch="임대차관리" formSection/>
          <div style={{padding:'16px 20px',fontSize:13,color:C.txM,lineHeight:1.6}}>
            {isSaleTrade(trade)
              ? '매물을 저장한 뒤 수정 화면에서 층별 임대차 내역을 등록할 수 있습니다.'
              : '임대 거래는 위 거래방식·가격에서 보증금·월세 등을 입력합니다.'}
          </div>
          </PropFormCol>
          <PropFormCol>
          <SecLabel ch="사진 (선택, 최대 3장)" formSection/>
          <PropertyPhotoPicker slots={photoSlots} onChange={setPhotoSlots}/>
          <SecLabel ch="세부내용" formSection/>
          <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>게시글 제목 <span style={{color:C.brand}}>*</span></div>
              <input className="inp" value={detailForm.title} onChange={e=>setDetailForm(f=>({...f,title:e.target.value}))} placeholder="예: 영등포 핵심 상권 상가건물 매매"/></div>
            <PropAgentFields
              detailForm={detailForm}
              setDetailForm={setDetailForm}
              teamMembers={teamMembers}
              accountDefaults={accountDefaults}
            />
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>홍보문구 (공개)</div>
              <textarea className="ta" rows={6} value={detailForm.promo} onChange={e=>setDetailForm(f=>({...f,promo:e.target.value}))} placeholder="외부에 공개되는 홍보문구"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>내부 메모 (비공개)</div>
              <textarea className="ta" rows={2} value={detailForm.memo} onChange={e=>setDetailForm(f=>({...f,memo:e.target.value}))} placeholder="내부 참고 사항"/></div>
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>저장폴더 바로가기 <span style={{fontWeight:400,color:C.txP}}>(선택)</span></div>
              <input className="inp" value={detailForm.folderUrl||''} onChange={e=>setDetailForm(f=>({...f,folderUrl:e.target.value}))} placeholder="구글 드라이브, 원드라이브 등 폴더 주소"/></div>
            {isRent&&(
            <div style={{gridColumn:'1/-1'}}><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>디스코 상세 링크 <span style={{fontWeight:400,color:C.txP}}>(선택)</span></div>
              <input className="inp" value={detailForm.discoUrl||''} onChange={e=>setDetailForm(f=>({...f,discoUrl:e.target.value}))} placeholder="디스코에서 복사한 주소 링크가 있다면 입력해주세요 (선택)"/></div>
            )}
          </div>
          </PropFormCol>
        </PropFormSplit>
      </div>
      <ActionBar saveLabel={saving?'저장 중…':'저장하기'} onSave={handleSave} onCancel={()=>onNav('properties')} saveDisabled={saving||lookupBlocksPropertySave(lookup,extraParcelLoading)} saveDisabledTitle={saving?'저장 중입니다.':propertySaveBlockedTitle(lookup,extraParcelLoading)}/>
    </div>
  );
};

/* ═══ CUSTOMER LIST ═══ */
const CustList=({onOpen,onNav})=>{
  const { isRent }=useDealMode();
  const CUAll=useOwnerCustomers();
  const saleAll=useMemo(()=>CUAll.filter((c)=>customerMatchesDealMode(c,DEAL_MODE_SALE)),[CUAll]);
  const rentAll=useMemo(()=>CUAll.filter((c)=>customerMatchesDealMode(c,DEAL_MODE_RENT)),[CUAll]);
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
  const [sortSale,setSortSale]=useState({key:'grade',dir:'desc'});
  const [sortRent,setSortRent]=useState({key:'grade',dir:'desc'});
  const [colFilter,setColFilter]=useState({status:'',type:''});
  const [openColFilter,setOpenColFilter]=useState(null);
  const [visibleCount,setVisibleCount]=useState(20);
  useEffect(()=>{ setVisibleCount(20); },[isRent]);
  const handleScroll=(e)=>{const el=e.currentTarget;if(el.scrollHeight-el.scrollTop-el.clientHeight<80)setVisibleCount(v=>v+20);};
  const toggleSort=(pane,key)=>{
    const apply=(prev)=>{
      if(prev.key!==key) return {key,dir:key==='grade'?'desc':'asc'};
      if(key==='grade') return prev.dir==='desc'?{key,dir:'asc'}:{key:'grade',dir:'desc'};
      if(prev.dir==='asc') return {key,dir:'desc'};
      return {key:'grade',dir:'desc'};
    };
    if(pane==='rent') setSortRent(apply);
    else setSortSale(apply);
  };
  const getSortVal=(c,key)=>{
    const cd=custCallDatesOf(callDateMap,c.id);
    if(key==='name') return c.name||'';
    if(key==='co') return c.co||'';
    if(key==='region') return serializeLeaseConditions(leaseConditionsFromCustomer(c))[0]?.region||c.region||'';
    if(key==='preferredTrades'||key==='buyTypes') return customerBuyLabelOf(c);
    if(key==='buyTiming') return String(c.buyTiming||'');
    if(key==='leaseArea'){
      const row=serializeLeaseConditions(leaseConditionsFromCustomer(c))[0];
      return Number(row?.exclusiveAreaPyMin||row?.exclusiveAreaPyMax)||0;
    }
    if(key==='leaseBudget'){
      const row=serializeLeaseConditions(leaseConditionsFromCustomer(c))[0];
      return Number(row?.budgetManMin||row?.budgetManMax)||0;
    }
    if(key==='moveTiming') return serializeLeaseConditions(leaseConditionsFromCustomer(c))[0]?.moveTiming||'';
    if(key==='lastCall') return cd.last||'';
    if(key==='created') return c.created||'';
    if(key==='grade') return custGradeRank(c);
    return '';
  };
  const custSortMark=(pane,key)=>{
    const sort=pane==='rent'?sortRent:sortSale;
    return (
    <span style={{fontSize:11,color:C.txM,marginLeft:2,verticalAlign:'middle',opacity:sort.key===key?1:.28}}>
      {sort.key===key&&sort.dir==='asc'?'▲':'▼'}
    </span>
    );
  };
  const filterCust=(c,pane)=>{
    if(colFilter.status&&custStatusOf(c)!==colFilter.status) return false;
    if(colFilter.type&&!customerMatchesTypeTab(c,colFilter.type)) return false;
    if(appliedAdv){
      const adv=pane==='rent'?{...appliedAdv,trade:'',buyMin:'',buyMax:''}:appliedAdv;
      if(!customerMatchesAdvSearch(c,adv)) return false;
    }
    if(!customerMatchesBasicSearch(c,search)) return false;
    return true;
  };
  const sortCusts=(list,sort)=>{
    return [...list].sort((a,b)=>{
      if(sort.key==='grade'){
        const d=custGradeRank(a)-custGradeRank(b);
        return sort.dir==='asc'?d:-d;
      }
      if(sort.key){
        const av=getSortVal(a,sort.key), bv=getSortVal(b,sort.key);
        if(av<bv) return sort.dir==='asc'?-1:1;
        if(av>bv) return sort.dir==='asc'?1:-1;
      }
      const g=custGradeRank(b)-custGradeRank(a);
      if(g) return g;
      return (b.fav?1:0)-(a.fav?1:0)||b.id-a.id;
    });
  };
  const saleSorted=sortCusts(saleAll.filter((c)=>filterCust(c,'sale')),sortSale);
  const rentSorted=sortCusts(rentAll.filter((c)=>filterCust(c,'rent')),sortRent);
  const saleVisible=saleSorted.slice(0,visibleCount);
  const rentVisible=rentSorted.slice(0,visibleCount);
  const panes=isRent
    ?[{title:'임차고객',count:rentSorted.length,rows:rentVisible,createMode:DEAL_MODE_RENT,rent:true}]
    :[{title:'매수고객',count:saleSorted.length,rows:saleVisible,createMode:DEAL_MODE_SALE,rent:false}];
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:C.bg}}>
      <PH title="고객 관리" sub={isRent?`임차 ${rentSorted.length}명`:`매수 ${saleSorted.length}명`}
        acts={<>
          <Btn role="page-secondary" ch="일괄 등록" ic="ti-upload" on={()=>onNav&&onNav('customersBulk')}/>
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
          <div style={{display:'grid',gridTemplateColumns:isRent?'repeat(2,1fr)':'repeat(5,1fr)',gap:12,marginBottom:14}}>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매물 종류</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advTag} onChange={e=>setAdvTag(e.target.value)}>
                <option value="">전체</option>
                {CUSTOMER_ADV_PROP_KIND_OPTS.map(t=>(<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            {!isRent&&(
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매수유형</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advTrade} onChange={e=>setAdvTrade(e.target.value)}>
                <option value="">전체</option>
                {CUSTOMER_BUY_TYPE_OPTS.map((opt)=>(<option key={opt.id} value={opt.id}>{opt.label}</option>))}
              </select>
            </div>
            )}
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>등급</div>
              <select className="sel" style={{height:34,fontSize:13}} value={advStatus} onChange={e=>setAdvStatus(e.target.value)}>
                <option value="">전체</option>
                {CUST_STATUS_OPTS.map(s=>(<option key={s.id} value={s.label}>{s.label}</option>))}
              </select>
            </div>
            {!isRent&&(
            <>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매입가능액 최소(만)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advBuyMin} onChange={e=>setAdvBuyMin(e.target.value)}/>
            </div>
            <div>
              <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>매입가능액 최대(만)</div>
              <MoneyInput style={{height:32,fontSize:13}} placeholder="0" value={advBuyMax} onChange={e=>setAdvBuyMax(e.target.value)}/>
            </div>
            </>
            )}
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn role="toolbar-primary" ch="검색 적용" ic="ti-search" on={()=>{applyAdvSearch();setVisibleCount(20);}}/>
            <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={()=>{resetAdvSearch();setVisibleCount(20);}}/>
          </div>
        </div>
      )}
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}} onScroll={handleScroll} onClick={()=>setOpenColFilter(null)}>
        <style dangerouslySetInnerHTML={{__html:`.cust-list-tbl thead th{color:${C.txM}!important}.cust-list-tbl{table-layout:auto!important}.cust-list-tbl td{overflow:visible;height:auto;min-height:57px;padding-top:10px;padding-bottom:10px;vertical-align:middle}.cust-list-tbl .cust-col-fav{width:28px;max-width:28px;padding-left:4px!important;padding-right:4px!important;text-align:center}.cust-list-tbl .cust-col-grade{width:52px;max-width:52px;padding-left:4px!important;padding-right:4px!important;text-align:center;white-space:nowrap}.cust-list-tbl .cust-col-name{padding-left:6px!important;padding-right:6px!important}.cust-list-tbl .cust-call-cell,.cust-list-tbl .cust-call-cell span{white-space:nowrap;overflow:visible;text-overflow:clip}.cust-pane{flex:1;minWidth:0;background:${C.surf};border-radius:10;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04);display:flex;flex-direction:column}`}}/>
        <div style={{display:'flex',gap:14,flex:1,minHeight:0,alignItems:'stretch'}}>
        {panes.map((pane)=>{
          const paneKey=pane.rent?'rent':'sale';
          return (
        <div key={pane.createMode} className="cust-pane" onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'12px 14px',borderBottom:`1px solid ${C.bdr}`}}>
            <div style={{fontSize:14,fontWeight:800,color:C.tx}}>{pane.title} <span style={{fontWeight:600,color:C.txM,fontSize:12}}>{pane.count}명</span></div>
            <Btn role="page-primary" ch="등록" on={()=>onOpen('cf',{__createMode:pane.createMode})}/>
          </div>
          <div style={{overflow:'auto',flex:1}}>
          <table className="tbl tbl-fixed cust-list-tbl">
            <thead><tr>
              <th className="cust-col-fav">★</th>
              <th className="cust-col-grade" onClick={()=>{toggleSort(paneKey,'grade');setVisibleCount(20);}} style={{cursor:'pointer'}}>등급 {custSortMark(paneKey,'grade')}</th>
              <th className="cust-col-name" onClick={()=>{toggleSort(paneKey,'name');setVisibleCount(20);}} style={{cursor:'pointer'}}>이름 {custSortMark(paneKey,'name')}</th>
              {pane.rent?(
                <>
                  <th onClick={()=>{toggleSort(paneKey,'leaseArea');setVisibleCount(20);}} style={{cursor:'pointer'}}>전용면적(평) {custSortMark(paneKey,'leaseArea')}</th>
                  <th onClick={()=>{toggleSort(paneKey,'leaseBudget');setVisibleCount(20);}} style={{cursor:'pointer'}}>예산(만) {custSortMark(paneKey,'leaseBudget')}</th>
                  <th onClick={()=>{toggleSort(paneKey,'region');setVisibleCount(20);}} style={{cursor:'pointer'}}>선호지역 {custSortMark(paneKey,'region')}</th>
                  <th onClick={()=>{toggleSort(paneKey,'moveTiming');setVisibleCount(20);}} style={{cursor:'pointer'}}>이전시기 {custSortMark(paneKey,'moveTiming')}</th>
                </>
              ):(
                <>
                  <th onClick={()=>{toggleSort(paneKey,'region');setVisibleCount(20);}} style={{cursor:'pointer'}}>선호지역 {custSortMark(paneKey,'region')}</th>
                  <th onClick={()=>{toggleSort(paneKey,'buyTypes');setVisibleCount(20);}} style={{cursor:'pointer'}}>매수유형 {custSortMark(paneKey,'buyTypes')}</th>
                  <th onClick={()=>{toggleSort(paneKey,'buyTiming');setVisibleCount(20);}} style={{cursor:'pointer'}}>매수시기 {custSortMark(paneKey,'buyTiming')}</th>
                  <th>매입가능액</th>
                </>
              )}
              <th className="cust-call-cell" style={{minWidth:108,width:108}} onClick={()=>{toggleSort(paneKey,'lastCall');setVisibleCount(20);}}>통화 {custSortMark(paneKey,'lastCall')}</th>
            </tr></thead>
            <tbody>
              {pane.rows.map(c=>{
                const cd=custCallDatesOf(callDateMap,c.id);
                const lease=pane.rent?leaseConditionListSummary(c):null;
                return(
                <tr key={c.id} onClick={()=>onOpen('cd',c)}>
                  <td className="cust-col-fav" onClick={e=>e.stopPropagation()}>
                    <span style={{fontSize:16,color:c.fav?'#F59E0B':C.txP,cursor:'pointer'}} onClick={e=>toggleCustomerFav(c,e)}>{c.fav?'★':'☆'}</span>
                  </td>
                  <td className="cust-col-grade"><CustStatusBdg s={c.status}/></td>
                  <td className="cust-col-name"><div className="cell-ellipsis" style={{fontWeight:600,fontSize:13}} title={c.name}>{c.name}</div></td>
                  {pane.rent?(
                    <>
                      <td><div className="cell-ellipsis" style={{fontSize:12}} title={lease.area}>{lease.area}</div></td>
                      <td><div className="cell-ellipsis" style={{fontSize:12,color:C.info,fontWeight:500}} title={lease.budget}>{lease.budget}</div></td>
                      <td><div className="cell-ellipsis" style={{fontSize:12}} title={lease.region}>{lease.region}</div></td>
                      <td><div className="cell-ellipsis" style={{fontSize:12}} title={lease.moveTiming}>{lease.moveTiming}</div></td>
                    </>
                  ):(
                    <>
                      <td><div className="cell-ellipsis" style={{fontSize:12}} title={c.region}>{c.region||'—'}</div></td>
                      <td><div className="cell-ellipsis" style={{fontSize:12}} title={customerBuyLabelOf(c)}>{customerBuyLabelOf(c)}</div></td>
                      <td><div className="cell-ellipsis" style={{fontSize:12}} title={c.buyTiming||''}>{c.buyTiming||'—'}</div></td>
                      <td><div className="cell-ellipsis" style={{fontSize:12,color:C.info,fontWeight:500}} title={fmtCustomerBudgetRange(c.buyMin,c.buyMax)}>{fmtCustomerBudgetRange(c.buyMin,c.buyMax)}</div></td>
                    </>
                  )}
                  <td className="cust-call-cell" style={{whiteSpace:'nowrap'}}><span style={{fontSize:12,color:C.txM,whiteSpace:'nowrap'}}>{fmtCallDate(cd.last)}</span></td>
                </tr>
              );})}
              {pane.rows.length===0&&(
                <tr><td colSpan={8} style={{textAlign:'center',padding:'28px 12px',color:C.txP,fontSize:13}}>등록된 고객이 없습니다</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        );
        })}
        </div>
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
          <span onClick={onClear} style={{width:20,height:20,borderRadius:'50%',background:'rgba(var(--ln-brand-rgb),.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:C.brand,fontSize:13,fontWeight:700,flexShrink:0,marginTop:1}}>×</span>
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
  const { mode }=useDealMode();
  const { user, companyRole, memberPermissions }=useAuth();
  const P=useProperties();
  const CU=useOwnerCustomers();
  const CALLSAll=useOwnerCallLogs();
  const CALLS=useMemo(()=>CALLSAll.filter((c)=>callMatchesDealMode(c,P,mode)),[CALLSAll,P,mode]);
  const canEditCall=(c)=>canManageCallLogs(companyRole)&&canWriteRecord(c,user?.id,companyRole,memberPermissions,'call_logs');
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
    const prop=findPropertyByPid(P,c.pid);
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
                const prop=findPropertyByPid(P,c.pid);
                const cust=CU.find(cu=>cu.id===c.cid);
                const propLabel=prop?propCallIdentLabel(prop):'';
                return(
                  <div key={c.id} style={{background:C.surf,borderRadius:10,padding:'14px 18px',boxShadow:'0 1px 3px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.04)',display:'flex',gap:14,borderBottom:`2px solid ${C.bdr}`}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:prop?C.brand:C.bdrSt,marginTop:5,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:600,color:C.tx}}>{c.date} {c.time}</span>
                        {prop&&<span onClick={()=>onOpen('pd',prop)} style={{fontSize:13,color:C.info,cursor:'pointer',fontWeight:500}} title={propLabel}>{propLabel}</span>}
                        {cust&&<span onClick={e=>{e.stopPropagation();if(onOpen)onOpen('cd',cust);}} style={{fontSize:12,color:C.info,cursor:'pointer',fontWeight:500,textDecoration:'underline',textDecorationColor:'rgba(37,99,235,.3)'}}>· {cust.name}</span>}
                        {!cust&&c.contactPhone&&<span style={{fontSize:12,color:C.txM,fontWeight:500}}>· {formatPhone(c.contactPhone)||c.contactPhone}</span>}
                        {!prop&&!cust&&!c.contactPhone&&<span style={{fontSize:12,color:C.txP}}>(관련 매물/고객 없음)</span>}
                      </div>
                      <div style={{fontSize:13,color:C.txS,lineHeight:1.6,maxHeight:80,overflowY:'auto',whiteSpace:'pre-line'}}>{c.content}</div>
                      {c.next&&<div style={{marginTop:8,display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.txM}}>
                        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
                        <span style={{fontWeight:500}}>다음 액션:</span>
                        <span>{c.next}</span>
                        {c.nDate&&<span style={{background:C.warnBg,color:C.warn,padding:'2px 8px',borderRadius:20,fontSize:12,fontWeight:500}}>{c.nDate}</span>}
                      </div>}
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                      {isLockedCallLog(c)?(
                        <span style={{fontSize:11,fontWeight:600,color:C.txM,background:C.surf3,borderRadius:4,padding:'3px 8px',whiteSpace:'nowrap'}} title={LOCKED_CALL_LOG_MSG}>변경기록</span>
                      ):(
                        <>
                          <Btn role="row-edit" ch="수정" on={()=>{if(onOpen)onOpen('ce',c);}} disabled={!canEditCall(c)} title={!canEditCall(c)?(canManageCallLogs(companyRole)?PERMISSION_DENIED_TOOLTIP:CALL_LOG_MANAGE_DENIED_TOOLTIP):undefined}/>
                          <Btn role="row-delete" ch="삭제" on={()=>onDelete&&onDelete(c)} disabled={!canEditCall(c)||!onDelete} title={!canEditCall(c)?(canManageCallLogs(companyRole)?PERMISSION_DENIED_TOOLTIP:CALL_LOG_MANAGE_DENIED_TOOLTIP):undefined}/>
                        </>
                      )}
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
                구글 캘린더와 한 번 연동하면, 이후 일정 화면을 열 때마다 새 일정을 자동으로 가져옵니다.
                이미 가져온 일정은 유지되며 중복 저장되지 않습니다. 바로 다시 받으려면「전체 동기화」를 누르면 됩니다.
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

const GoogleCalendarSyncWin=({onClose,onImported,gcalLinks,gcalSyncing,onSyncNow,onFullResync,onUnlinkOne,gcalMeta,ownerId})=>{
  const [link,setLink]=useState('');
  const [label,setLabel]=useState('');
  const [loading,setLoading]=useState(false);

  const handleImport=async()=>{
    if(loading||!link.trim()) return;
    setLoading(true);
    try{
      const imported=await importGoogleCalendarFromLink(link,{label:label.trim(),ownerId});
      onImported(imported);
      if(imported.alreadyLinked){
        showNotification(`이미 연동된 캘린더입니다. 일정을 동기화했습니다. (${imported.added}건 추가 · ${imported.duplicated}건 중복 제외)`,'success');
      }else{
        showNotification(`구글 캘린더를 연동했습니다. 총 ${imported.total}건 중 ${imported.added}건 가져옴, ${imported.duplicated}건 중복 제외.`,'success');
      }
      setLink('');
      setLabel('');
    }catch(err){
      window.alert(err instanceof Error?err.message:'구글 캘린더를 불러오지 못했습니다.');
    }finally{
      setLoading(false);
    }
  };

  const handleFullResync=()=>{
    if(gcalSyncing||!onFullResync) return;
    const ok=window.confirm(
      '앱에서 삭제했던 구글 일정도 다시 가져옵니다.\n삭제 이력을 초기화하고 전체를 다시 동기화할까요?',
    );
    if(ok) onFullResync();
  };

  return(
    <Win title="구글 캘린더 동기화" ic="ti-brand-google" onClose={onClose} w={560}
      ch={<>
        <div style={{...WIN_BODY_SCROLL,padding:'20px 24px',display:'flex',flexDirection:'column',gap:18}}>
          {gcalLinks.length>0&&(
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                <span style={{fontSize:13,fontWeight:700,color:C.tx}}>연동된 캘린더 ({gcalLinks.length})</span>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <button type="button" disabled={gcalSyncing} onClick={onSyncNow}
                    style={{border:`1px solid ${C.bdr}`,background:'#fff',borderRadius:6,padding:'5px 12px',fontSize:12,cursor:gcalSyncing?'wait':'pointer',color:C.tx,fontWeight:600}}>
                    {gcalSyncing?'동기화 중…':'전체 동기화'}
                  </button>
                  <button type="button" disabled={gcalSyncing} onClick={handleFullResync}
                    title="삭제했던 일정도 포함해 다시 가져오기"
                    style={{border:`1px solid ${C.bdr}`,background:'#fff',borderRadius:6,padding:'5px 12px',fontSize:12,cursor:gcalSyncing?'wait':'pointer',color:C.txM,fontWeight:500}}>
                    전체 다시 동기화
                  </button>
                </div>
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
              Google Calendar의 공유 링크 또는 iCal 주소를 붙여 넣으면 일정을 가져옵니다. 한 번 연동하면 일정 화면을 열 때마다 자동으로 동기화됩니다. 바로 다시 받으려면「전체 동기화」를 누르세요. (이미 가져온 일정은 유지되며 중복 저장되지 않습니다.)
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

/* 달력 슬롯/칩 — Calendar 밖에 두어 setSel 시 타입 재생성(remount)으로 removeChild 오류가 나지 않게 함 */
const CAL_CELL_H=112;
const CAL_EVT_H=18;
const CAL_EVT_GAP=2;
const CAL_EVT_MAX=2;
const CAL_EVT_AREA_H=CAL_EVT_MAX*(CAL_EVT_H+CAL_EVT_GAP)+CAL_EVT_H;
const CAL_SIDEBAR_W=340;
/** 세션당 1회만 구글 일정 owner 복구·중복 합치기 (클릭 중 liveQuery 폭주 방지) */
const gcalCalendarRepairedOwners=new Set();

const CalEvtSlot=({children,style})=>(
  <div style={{height:CAL_EVT_H,minHeight:CAL_EVT_H,maxHeight:CAL_EVT_H,flexShrink:0,...style}}>{children}</div>
);

const CalSchedChip=React.memo(function CalSchedChip({s,gcalMeta,onOpen}){
  const {c,bg,label}=scheduleSourceInfo(s,gcalMeta);
  const period=fmtSchedulePeriodDot(s);
  return(
    <CalEvtSlot>
      <div
        title={`${label} · ${period}${s.time?` ${s.time}`:''} ${s.title||''}`.trim()}
        onClick={(e)=>{e.stopPropagation();onOpen?.('sd',s);}}
        style={{height:'100%',display:'flex',alignItems:'center',gap:3,padding:'0 4px',borderRadius:4,background:bg,borderLeft:`3px solid ${c}`,cursor:'pointer',overflow:'hidden',minWidth:0}}>
        {s.time&&<span style={{fontSize:10,color:C.txM,flexShrink:0}}>{s.time.slice(0,5)}</span>}
        <span style={{fontSize:11,color:c,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{s.title}</span>
      </div>
    </CalEvtSlot>
  );
});

const CalendarDayCell=React.memo(function CalendarDayCell({
  d, cellIndex, year, month, today, selD, daySchds, dayCalls, cellBg,
  onSelectDay, onHoverDay, onUnhoverDay, onOpen, gcalMeta,
}){
  const extraScheds=Math.max(0,daySchds.length-CAL_EVT_MAX);
  return(
    <div
      onClick={()=>{if(d) onSelectDay(d);}}
      onMouseEnter={()=>{if(d&&!selD) onHoverDay(d);}}
      onMouseLeave={()=>{onUnhoverDay(d);}}
      style={{height:CAL_CELL_H,minHeight:CAL_CELL_H,maxHeight:CAL_CELL_H,boxSizing:'border-box',padding:'6px 8px',borderRight:(cellIndex+1)%7!==0?`1px solid ${C.bdr}`:'none',borderBottom:cellIndex<35?`1px solid ${C.bdr}`:'none',cursor:d?'pointer':'default',background:cellBg,transition:'background .1s',position:'relative',overflow:'hidden',display:'flex',flexDirection:'column'}}
    >
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',height:24,minHeight:24,flexShrink:0,marginBottom:4}}>
        <span style={{fontSize:13,fontWeight:today||selD?700:400,width:24,height:24,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:(today&&selD)?C.brand:selD?C.info:'transparent',color:!d?C.txP:(today&&selD)||selD?'#fff':cellIndex%7===0?C.err:cellIndex%7===6?C.info:C.tx}}>{d||''}</span>
        {d&&(
          <span
            onClick={e=>{e.stopPropagation();onOpen('sf',{_newDate:`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`});}}
            style={{width:18,height:18,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:C.txP,cursor:'pointer',flexShrink:0}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.brandL;e.currentTarget.style.color=C.brand;}}
            onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.txP;}}
          >+</span>
        )}
      </div>
      <div style={{height:CAL_EVT_AREA_H,minHeight:CAL_EVT_AREA_H,maxHeight:CAL_EVT_AREA_H,display:'flex',flexDirection:'column',gap:CAL_EVT_GAP,overflow:'hidden'}}>
        {Array.from({length:CAL_EVT_MAX}).map((_,idx)=>{
          const s=daySchds[idx];
          if(!s) return <CalEvtSlot key={`empty-${idx}`}/>;
          return <CalSchedChip key={s.id} s={s} gcalMeta={gcalMeta} onOpen={onOpen}/>;
        })}
        <CalEvtSlot>
          {extraScheds>0?(
            <div style={{height:'100%',display:'flex',alignItems:'center',padding:'0 4px',fontSize:10,color:C.txM,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
              외 {extraScheds}건
            </div>
          ):dayCalls.length>0?(
            <div translate="no" style={{height:'100%',display:'flex',alignItems:'center',gap:3,padding:'0 4px',fontSize:10,color:C.info,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}} aria-hidden><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.58 2.34.7A2 2 0 0 1 22 16.92z"/></svg>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>통화 {dayCalls.length}건</span>
            </div>
          ):null}
        </CalEvtSlot>
      </div>
    </div>
  );
});

const Calendar=({onOpen})=>{
  const { mode }=useDealMode();
  const { user, companyRole, memberPermissions }=useAuth();
  const P=useProperties();
  const SCHEDSAll=useOwnerSchedules();
  const CALLSAll=useOwnerCallLogs();
  const SCHEDS=useMemo(()=>SCHEDSAll.filter((s)=>scheduleMatchesDealMode(s,P,mode)),[SCHEDSAll,P,mode]);
  const CALLS=useMemo(()=>CALLSAll.filter((c)=>callMatchesDealMode(c,P,mode)),[CALLSAll,P,mode]);
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

  // 연동된 구글 캘린더가 있으면 일정 화면 진입 시 자동 동기화 (15분 이내 재요청은 생략)
  useEffect(()=>{
    const links=listGoogleCalendarLinks(gcalOwnerId).filter((l)=>l.enabled!==false);
    if(!links.length) return undefined;
    let cancelled=false;
    (async()=>{
      setGcalSyncing(true);
      try{
        const result=await syncLinkedGoogleCalendars({force:false,ownerId:gcalOwnerId});
        if(cancelled) return;
        refreshGcalLinks();
        if(!result.synced){
          if(result.errors){
            setIcsNotice('구글 캘린더 자동 동기화에 실패했습니다. 「구글 캘린더」에서 링크를 확인해 주세요.');
          }
          return;
        }
        if(result.added>0){
          refreshGcalLinks();
          setIcsNotice(`구글 캘린더에서 새 일정 ${result.added}건을 가져왔습니다.`);
          showNotification(`구글 캘린더 동기화: 총 ${result.total}건 중 신규 ${result.added}건`,'success');
        }
      }catch(err){
        if(!cancelled) console.warn('[Calendar] auto gcal sync',err);
      }finally{
        if(!cancelled) setGcalSyncing(false);
      }
    })();
    return()=>{ cancelled=true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 일정 화면 마운트·계정 변경 시에만
  },[gcalOwnerId,refreshGcalLinks]);

  // syncUserId 지연으로 ownerId=dev-local 에 묶인 구글 일정 → 귀속·합치기 (맹삭제 금지)
  useEffect(()=>{
    if(!gcalOwnerId) return;
    if(gcalCalendarRepairedOwners.has(gcalOwnerId)) return;
    let cancelled=false;
    const timer=window.setTimeout(()=>{
      (async()=>{
        try{
          if(cancelled) return;
          await flushPendingIcsSourceIdRemaps(gcalOwnerId);
          if(cancelled) return;
          await repairIcsScheduleIntegrity(gcalOwnerId);
          gcalCalendarRepairedOwners.add(gcalOwnerId);
        }catch(err){
          console.error('[Calendar] repair gcal ownerId',err);
        }
      })();
    },1200);
    return()=>{ cancelled=true; window.clearTimeout(timer); };
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

  const handleGcalSyncNow=async(opts={})=>{
    if(gcalSyncing) return;
    setGcalSyncing(true);
    try{
      const result=await syncLinkedGoogleCalendars({
        force:true,
        ownerId:gcalOwnerId,
        resetDeletedUids:opts.resetDeletedUids===true,
      });
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

  const gcalMeta=useMemo(()=>{
    const m=new Map();
    gcalLinks.forEach(l=>{
      const color=l.color&&GCAL_LINK_COLORS.includes(l.color)?l.color:gcalFallbackColor(l.sourceId);
      m.set(l.sourceId,{color,label:gcalLinkDisplayLabel(l)});
    });
    return m;
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
  const [hoverDay,setHoverDay]=useState(null);
  const [hoverSchedId,setHoverSchedId]=useState(null);
  const selectDay=useCallback((d)=>setSel(d),[]);
  const hoverDayOn=useCallback((d)=>setHoverDay(d),[]);
  const hoverDayOff=useCallback((d)=>setHoverDay((h)=>h===d?null:h),[]);

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
          onFullResync={()=>handleGcalSyncNow({resetDeletedUids:true})}
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
          {gcalSyncing&&<span style={{fontSize:12,color:C.txM}}>동기화 중…</span>}
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
      <div style={{flex:1,minHeight:0,display:'flex',gap:16,padding:'20px 28px',overflow:'hidden'}} translate="no">
        <div style={{flex:1,minWidth:0,overflow:'auto'}}>
          <div style={{background:C.surf,borderRadius:10,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04)'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:`1px solid ${C.bdr}`}}>
              {days.map((d,i)=><div key={i} style={{textAlign:'center',padding:'10px 0',fontSize:12,fontWeight:600,color:i===0?C.err:i===6?C.info:C.txM,letterSpacing:'.04em'}}>{d}</div>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gridAutoRows:`${CAL_CELL_H}px`}}>
              {cells.map((d,i)=>{
                const today=isTodayCell(d);
                const selD=d!=null&&d===sel;
                const hovered=d!=null&&d===hoverDay&&!selD;
                const daySchds=d?dayData[d]?.scheds||[]:[];
                const dayCalls=d?dayData[d]?.calls||[]:[];
                const cellBg=!d?C.surf3:(today&&selD)?C.brandL:selD?'#fff':hovered?C.surf2:today?`${C.brand}06`:'transparent';
                return(
                  <CalendarDayCell
                    key={d!=null?`d-${year}-${month}-${d}`:`e-${i}`}
                    d={d}
                    cellIndex={i}
                    year={year}
                    month={month}
                    today={today}
                    selD={selD}
                    daySchds={daySchds}
                    dayCalls={dayCalls}
                    cellBg={cellBg}
                    onSelectDay={selectDay}
                    onHoverDay={hoverDayOn}
                    onUnhoverDay={hoverDayOff}
                    onOpen={onOpen}
                    gcalMeta={gcalMeta}
                  />
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
                    <div key={s.id} onClick={()=>onOpen('sd',s)}
                      onMouseEnter={()=>setHoverSchedId(s.id)}
                      onMouseLeave={()=>setHoverSchedId((id)=>id===s.id?null:id)}
                      style={{padding:'12px 16px',borderBottom:`1px solid ${C.bdr}`,display:'flex',gap:10,alignItems:'flex-start',cursor:'pointer',background:hoverSchedId===s.id?bg:'transparent'}}>
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
const BACKUP_LAST_INFO_KEY_PREFIX='landnote.lastBackup';
const BACKUP_LAST_INFO_LEGACY_KEY='landnote.lastBackup';
/** @param {string|null|undefined} ownerId */
const backupLastInfoKey=(ownerId)=>`${BACKUP_LAST_INFO_KEY_PREFIX}.${ownerId||'anonymous'}`;
/** @param {string|null|undefined} ownerId */
const loadLastBackupInfo=(ownerId)=>{
  if(!ownerId) return null;
  try{
    // 계정 공용 키는 더 이상 사용하지 않음 (다른 계정 이력 노출 방지)
    try{ localStorage.removeItem(BACKUP_LAST_INFO_LEGACY_KEY); }catch{ /* ignore */ }
    const raw=localStorage.getItem(backupLastInfoKey(ownerId));
    return raw?JSON.parse(raw):null;
  }catch{
    return null;
  }
};
/** @param {string|null|undefined} ownerId @param {object} info */
const saveLastBackupInfo=(ownerId,info)=>{
  if(!ownerId) return;
  try{
    localStorage.setItem(backupLastInfoKey(ownerId),JSON.stringify(info));
    try{ localStorage.removeItem(BACKUP_LAST_INFO_LEGACY_KEY); }catch{ /* ignore */ }
  }catch{ /* ignore */ }
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
  const { user, company, companyRole }=useAuth();
  const ownerId=user?.id||null;
  const ownOnlyExport=isBackupOwnRecordsOnlyExport();
  const isTeamAccount=usesTeamCloudSync(companyRole);
  const [busy,setBusy]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const [alertMsg,setAlertMsg]=useState('');
  const [lastBackup,setLastBackup]=useState(()=>loadLastBackupInfo(ownerId));
  const [localCounts,setLocalCounts]=useState(null);
  const fileInputRef=useRef(null);

  useEffect(()=>{
    setLastBackup(loadLastBackupInfo(ownerId));
  },[ownerId]);

  useEffect(()=>{
    let cancelled=false;
    getLocalTableCounts().then((c)=>{ if(!cancelled) setLocalCounts(c); }).catch(()=>{});
    return ()=>{ cancelled=true; };
  },[busy, company?.id, companyRole]);

  const handleExport=async()=>{
    if(busy) return;
    setBusy(true);
    try{
      const backup=await exportBackupData();
      let json;
      try{
        json=JSON.stringify(backup);
      }catch(serErr){
        console.error('[backup export stringify]',serErr);
        setAlertMsg('데이터가 너무 크거나 직렬화할 수 없어 내보내기에 실패했습니다.\n(매물 사진이 많으면 일부 사진을 정리한 뒤 다시 시도해 주세요)');
        return;
      }
      if(!json||json==='{}'){
        setAlertMsg('내보낼 데이터가 비어 있습니다.');
        return;
      }
      const blob=new Blob([json],{type:'application/json;charset=utf-8'});
      const filename=`landnote_backup_${backupFileTimestamp(new Date())}.rmxbak`;
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=filename;
      a.rel='noopener';
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      const info={at:new Date().toISOString(),filename,size:blob.size,counts:backup.counts};
      saveLastBackupInfo(ownerId,info);
      setLastBackup(info);
      setLocalCounts(backup.counts);
      const gcalN=Array.isArray(backup.meta?.googleCalendarLinks)?backup.meta.googleCalendarLinks.length:0;
      const sizeNote=blob.size>20*1024*1024?`\n파일 크기 ${backupFileSize(blob.size)} — 안전한 곳에 보관하세요.`:'';
      setAlertMsg(`내보내기가 완료되었습니다.\n${formatBackupCountsLabel(backup.counts)}${gcalN?`\n구글 캘린더 연동 ${gcalN}개`:''}${sizeNote}`);
    }catch(err){
      console.error('[backup export]',err);
      const code=err?.message||'';
      if(String(code).startsWith('BACKUP_SERIALIZE_FAILED')){
        setAlertMsg(`데이터 내보내기에 실패했습니다.\n(${String(code).replace('BACKUP_SERIALIZE_FAILED:','')} 테이블 직렬화 오류)`);
      }else{
        setAlertMsg('데이터 내보내기에 실패했습니다.');
      }
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
        const raw=String(reader.result||'').replace(/^\uFEFF/,'');
        parsed=JSON.parse(raw);
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
      const gcalN=Array.isArray(parsed.meta?.googleCalendarLinks)?parsed.meta.googleCalendarLinks.length:0;
      const total=(counts.properties||0)+(counts.customers||0)+(counts.call_logs||0)+(counts.schedules||0)+(counts.rentals||0);
      if(total===0&&gcalN===0){
        setBusy(false);
        setAlertMsg('백업 파일에 복원할 데이터가 없습니다.');
        return;
      }
      setBusy(false);
      setConfirm({
        msg:'데이터를 가져오시겠습니까?',
        subMsg:`기존 데이터는 유지하고, 백업에만 있는 항목을 추가합니다.\n이미 있는 동일 데이터는 건너뜁니다.\n\n파일 항목: ${formatBackupCountsLabel(counts)}${gcalN?`\n구글 캘린더 연동 ${gcalN}개`:''}`,
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

  const exportDesc=ownOnlyExport
    ?'본인이 등록한 매물·고객·통화이력·일정·임대차·매물 사진·구글 캘린더 연동 설정만 .rmxbak 파일로 저장합니다. 동료가 공유한 데이터는 포함되지 않습니다. 휴지통(소프트 삭제) 항목도 포함됩니다.'
    :'매물·고객·통화이력·일정·임대차·매물 사진·구글 캘린더 연동 설정을 .rmxbak 파일로 저장합니다. 휴지통(소프트 삭제) 항목도 포함됩니다.';
  const items=[
    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
      title:'데이터 내보내기',desc:exportDesc,btn:busy?'내보내는 중…':'내보내기',role:'backup-primary',ic:'ti-upload',on:handleExport,disabled:busy},
    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.96"/></svg>,
      title:'데이터 가져오기',desc:'백업 파일을 기존 데이터에 병합합니다. 동일한 항목은 건너뛰고, 새로 추가된 매물·고객·일정·통화는 클라우드에 동기화합니다. 구글 캘린더 연동 설정도 함께 복원됩니다.',btn:busy?'파일 확인 중…':'파일 선택',role:'backup-danger',ic:'ti-upload',on:()=>fileInputRef.current?.click(),disabled:busy},
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
            <div style={{fontSize:14,color:'#854F0B',lineHeight:1.6}}>
              {isTeamAccount
                ?<>동기화로 클라우드에 보관됩니다. <strong>대시보드 상단「동기화」</strong>로 최신 상태를 맞춰 주세요. 파일 백업(.rmxbak)은 기기 이전·사고 대비를 위한 <strong>추가 안전장치</strong>입니다.</>
                :<>데이터가 이 브라우저(IndexedDB)에 로컬로 저장됩니다. 캐시 삭제 시 손실될 수 있으니 <strong>정기적인 파일 백업</strong>을 권장합니다.</>}
            </div>
          </div>
          {ownOnlyExport&&(
            <div style={{background:C.surf2,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'14px 18px',display:'flex',gap:12}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,flexShrink:0,color:C.txM,marginTop:1}} aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
              <div style={{fontSize:14,color:C.txS,lineHeight:1.6}}>
                <strong style={{color:C.tx}}>팀장·직원 계정</strong>은 본인이 등록한 매물·고객·통화·일정·임대차만 내보낼 수 있습니다.
                동료가 공유한 데이터는 앱에서 볼 수 있어도 백업 파일에는 포함되지 않습니다.
                회사 전체 데이터 백업이 필요하면 <strong>대표(CEO)</strong> 계정을 이용하세요.
              </div>
            </div>
          )}
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'16px 20px'}}>
            <div style={{fontSize:12,fontWeight:600,color:C.txM,marginBottom:8,textTransform:'uppercase',letterSpacing:'.04em'}}>
              {ownOnlyExport?'내보내기 대상 (본인 등록)':'현재 로컬 데이터'}
            </div>
            <div style={{fontSize:14,color:C.txS}}>
              {localCounts?formatBackupCountsLabel(localCounts):'집계 중…'}
            </div>
            {ownOnlyExport&&(
              <div style={{fontSize:12,color:C.txM,marginTop:8,lineHeight:1.5}}>
                위 항목 수는 내보내기 파일에 포함되는 본인 등록 데이터 기준입니다.
              </div>
            )}
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
/* Win(매물상세 등) zIndex:520 보다 위에 두어 상세 위에서도 확인 가능 */
const CONFIRM_DIALOG_Z=600;
const ConfirmDialog=({msg,subMsg,confirmLabel='확인',onConfirm,onCancel,danger})=>(
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:CONFIRM_DIALOG_Z,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
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
const FolderLinkDialog=({value,canEdit,onClose,onSave,onOpen})=>{
  const [draft,setDraft]=useState(value||'');
  const save=()=>{
    if(!canEdit) return;
    const raw=String(draft||'').trim();
    if(raw){
      const next=normalizeHttpUrl(raw);
      if(!next){
        showNotification('http(s) 주소를 입력해 주세요.','warning');
        return;
      }
      onSave(next);
      return;
    }
    onSave('');
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:CONFIRM_DIALOG_Z,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
      onClick={onClose}>
      <div style={{background:'#fff',borderRadius:14,padding:'24px 28px',maxWidth:480,width:'90%',boxShadow:'0 16px 48px rgba(0,0,0,.2)'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:C.tx,marginBottom:8}}>저장폴더 바로가기</div>
        <div style={{fontSize:13,color:C.txM,lineHeight:1.55,marginBottom:14}}>구글 드라이브, 원드라이브 등 폴더 링크를 붙여넣으세요.</div>
        <input className="inp" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="https://drive.google.com/drive/folders/..."
          onKeyDown={e=>{if(e.key==='Enter') save();}} autoFocus/>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap',marginTop:18}}>
          {value&&<Btn role="page-secondary" ch="열기" ic="ti-folder" on={onOpen}/>}
          <Btn role="dialog-cancel" ch="취소" on={onClose}/>
          {canEdit&&<Btn role="dialog-confirm" ch="저장" on={save}/>}
        </div>
      </div>
    </div>
  );
};
const AlertDialog=({msg,onClose})=>(
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:CONFIRM_DIALOG_Z,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(2px)'}}
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
  const { mode }=useDealMode();
  const P=useProperties();
  const deletedPropsAll=useOwnerDeletedProperties();
  const deletedCustsAll=useOwnerDeletedCustomers();
  const deletedSchedsAll=useOwnerDeletedSchedules();
  const deletedCallsAll=useOwnerDeletedCallLogs();
  const deletedProps=useMemo(()=>deletedPropsAll.filter((p)=>propertyMatchesDealMode(p,mode)),[deletedPropsAll,mode]);
  const deletedCusts=useMemo(()=>deletedCustsAll.filter((c)=>customerMatchesDealMode(c,mode)),[deletedCustsAll,mode]);
  const deletedScheds=useMemo(()=>deletedSchedsAll.filter((s)=>scheduleMatchesDealMode(s,P,mode)),[deletedSchedsAll,P,mode]);
  const deletedCalls=useMemo(()=>deletedCallsAll.filter((c)=>callMatchesDealMode(c,P,mode)),[deletedCallsAll,P,mode]);
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
  const handleHardDelete=async(type,id)=>{
    if(type==='props'){
      const result=await hardDeleteProperty(id);
      if(result&&result.ok===false){
        window.alert(result.conflict
          ? '클라우드 삭제와 충돌했습니다. 로컬 자료와 사진을 유지합니다.'
          : '클라우드 삭제를 확인하지 못해 로컬 자료와 사진을 유지합니다.');
      }
    }
    else if(type==='custs') await hardDeleteCustomer(id);
    else if(type==='scheds') await hardDeleteSchedule(id);
    else if(type==='calls') await hardDeleteCallLog(id);
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
      const results=await Promise.all(deletedProps.map((p)=>hardDeleteProperty(p.id)));
      if(results.some((r)=>r&&r.ok===false)){
        window.alert('일부 매물은 클라우드 삭제를 확인하지 못해 로컬에 남겼습니다.');
      }
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
                    <td style={{whiteSpace:'nowrap'}}><Bdg label={propKindDisplayLabel(p)||p.tag} type="gray"/></td>
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
const Settings=({onClose,onSignOut})=>{
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
  const [bizModalOpen,setBizModalOpen]=useState(false);
  const [bizCompanyName,setBizCompanyName]=useState('');
  const [bizBusy,setBizBusy]=useState(false);
  const [bizError,setBizError]=useState('');

  useEffect(()=>{
    setForm({
      displayName:accountDefaults.displayName,
      title:accountDefaults.title,
      phone:accountDefaults.phone,
      tel:accountDefaults.tel,
      email:accountDefaults.email,
      workEmail:accountDefaults.workEmail,
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
      work_email:String(form.workEmail||'').trim()||null,
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
            <div><div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:5}}>업무용 이메일</div>
              <input className="inp" type="email" value={form.workEmail||''} autoComplete="email" placeholder="업무용 이메일" onChange={e=>setForm(f=>({...f,workEmail:e.target.value}))}/></div>
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
              LandNote를 더 이상 사용하지 않으시나요?{' '}
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
        {onSignOut&&(
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
            <div style={{padding:'12px 18px',background:C.surf2,borderBottom:`1px solid ${C.bdr}`,fontSize:14,fontWeight:600,color:C.tx,borderRadius:'10px 10px 0 0'}}>계정</div>
            <div style={{padding:'16px 18px'}}>
              <button
                type="button"
                onClick={()=>{ onClose?.(); onSignOut(); }}
                style={{
                  width:'100%', height:42, borderRadius:8, border:`1.5px solid ${C.bdr}`,
                  background:'#fff', color:C.tx, fontSize:14, fontWeight:600, cursor:'pointer',
                  fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                로그아웃
              </button>
            </div>
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
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(var(--ln-brand-rgb),.85)';}}
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
              <span style={{
                ...propDetailLabelCell,
                ...(item.wrapLabel?{whiteSpace:'normal',lineHeight:1.35}:{}),
              }}>{item.k}</span>
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

/** 매각정보 — 4열 행(좌·우 항목쌍). 1행은 매각가액·입금가 */
const PropSaleInfoGrid=({rows})=>{
  const twoCol=`${PROP_DETAIL_LABEL_W}px 1fr`;
  const fourCol=`${PROP_DETAIL_LABEL_W}px 1fr ${PROP_DETAIL_LABEL_W}px 1fr`;
  const renderHalf=(item,withRightBorder)=>{
    if(!item) return null;
    return(
      <>
        <span style={propDetailLabelCell}>{item.k}</span>
        <span style={{...propDetailValueCell,color:item.c||C.tx,fontWeight:item.c?500:400,borderRight:withRightBorder?`1px solid ${C.bdr}`:'none'}}>{item.v||'—'}</span>
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
              <span style={{...propDetailValueCell,color:row.full.c||C.tx,fontWeight:row.full.c?500:400}}>{row.full.v||'—'}</span>
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

const EXT_SITES=[
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
  callsManage=false,
  linkPicker,onDismissPicker,
  whiteBg=false,
  compact=false,
})=>{
  const panelBg=whiteBg?C.surf:C.surf2;
  const headPad=compact?'6px 8px':'12px 16px';
  const listPad=compact?'8px 8px':'12px 14px';
  const footPad=compact?'6px 8px 4px':'12px 14px';
  return(
  <div style={{display:'flex',flexDirection:'column',minHeight:0,height:'100%',background:whiteBg?C.surf:undefined}}>
    <div style={{padding:headPad,background:panelBg,borderBottom:`1px solid ${C.bdr}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
      <span style={{fontSize:14,fontWeight:600,color:C.tx}}>통화 이력</span>
      <span style={{fontSize:12,color:C.txM,background:C.surf3,padding:'2px 8px',borderRadius:20}}>{calls.length}건</span>
    </div>
    <div style={{flex:1,overflowY:'auto',padding:listPad,display:'flex',flexDirection:'column',gap:compact?8:10,minHeight:0,background:whiteBg?C.surf:undefined}}>
      {calls.length>0?calls.map(c=>(
        <div key={c.id} style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:8,padding:compact?'8px 10px':'12px 14px',boxShadow:'0 1px 3px rgba(0,0,0,.04)',marginBottom:2,borderBottom:`2px solid ${C.bdr}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
            <div style={{minWidth:0,flex:1,paddingRight:8}}>
              <div>
                <span style={{fontSize:13,fontWeight:600,color:C.tx}}>{c.date}</span>
                <span style={{fontSize:12,color:C.txM,marginLeft:6}}>{c.time}</span>
              </div>
              {renderCallLink?.(c)}
            </div>
            <div style={{display:'flex',gap:5,flexShrink:0,alignItems:'center'}}>
              {isLockedCallLog(c)?(
                <span style={{fontSize:11,fontWeight:600,color:C.txM,background:C.surf3,borderRadius:4,padding:'3px 8px',whiteSpace:'nowrap'}} title={LOCKED_CALL_LOG_MSG}>변경기록</span>
              ):(
                <>
                  <Btn role="row-edit" ch="수정" on={()=>onOpen('ce',c)} disabled={!callsManage} title={!callsManage?CALL_LOG_MANAGE_DENIED_TOOLTIP:undefined}/>
                  <Btn role="row-delete" ch="삭제" on={()=>onDeleteCall&&onDeleteCall(c)} disabled={!callsManage||!onDeleteCall} title={!callsManage?CALL_LOG_MANAGE_DENIED_TOOLTIP:undefined}/>
                </>
              )}
            </div>
          </div>
          <div style={{fontSize:13,color:C.txS,lineHeight:1.6,maxHeight:80,overflowY:'auto',whiteSpace:'pre-line'}}>{c.content}</div>
          {c.next&&<div style={{marginTop:6,fontSize:12,color:C.txM,display:'flex',alignItems:'center',gap:4}}>
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>{c.next}
            {c.nDate&&<span style={{background:C.warnBg,color:C.warn,padding:'1px 6px',borderRadius:20,fontSize:12,marginLeft:2}}>{c.nDate}</span>}
          </div>}
        </div>
      )):<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:80,fontSize:13,color:C.txM}}>통화 이력 없음</div>}
    </div>
    <div style={{borderTop:`1px solid ${C.bdr}`,padding:footPad,background:panelBg,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:compact?6:8}}>
        <div style={{fontSize:12,fontWeight:700,color:C.txM,whiteSpace:'nowrap',flexShrink:0,letterSpacing:'.02em'}}>통화 기록 추가</div>
        {linkPicker?<div style={{flex:1,minWidth:0}}>{linkPicker}</div>:null}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:compact?6:8}}>
        <input type="date" className="inp" value={newCallDate} onChange={e=>setNewCallDate(e.target.value)} style={{flex:'1 1 0',minWidth:0,height:compact?28:32,fontSize:13}}/>
        <input type="time" className="inp" value={newCallTime} onChange={e=>setNewCallTime(e.target.value)} style={{width:compact?92:140,flexShrink:0,height:compact?28:32,fontSize:13}}/>
      </div>
      <textarea className="ta" rows={compact?2:3} placeholder="통화 내용을 입력하세요..."
        style={{marginBottom:compact?6:8,fontSize:13,width:'100%',display:'block',boxSizing:'border-box'}}
        value={newCallContent}
        onChange={e=>setNewCallContent(e.target.value)}
        onClick={()=>onDismissPicker&&onDismissPicker()}/>
      <Btn role="toolbar-primary" ch="통화 기록 추가" ic="ti-plus" full disabled={addDisabled} title={addDisabled?addDisabledTitle:undefined} on={onAddCall}/>
    </div>
  </div>
  );
};

const PropDetail=({prop,onClose,onEdit,onOpen,onDelete,onDeleteCall})=>{
  const { setDealMode }=useDealMode();
  const { accountDefaults, user, companyRole, memberPermissions, teamNameMap, teamRoleMap }=useAuth();
  const P=useProperties();
  const CU=useOwnerCustomers();
  const CALLS=useOwnerCallLogs();
  const RENTALS=useRentals(prop.id);
  const liveProp=P.find(x=>x.id===prop.id);
  useEffect(()=>{
    const next=dealModeFromProperty(liveProp||prop);
    if(next) setDealMode(next);
  },[prop.id, prop.trade, liveProp?.trade, setDealMode]);
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
  const [showPdfView,setShowPdfView]=useState(false);
  const [folderLinkOpen,setFolderLinkOpen]=useState(false);
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
        <Bdg label={propStatusLabel(propData.status, isRentalListProperty(propData))} type={{NEW:'gray',ACTIVE:'info',HOLD:'warn',COMPLETED:'gray'}[propData.status]||'gray'}/>
        <Bdg label={propData.pub?'공개':'비공개'} type={propData.pub?'gray':'warn'}/>
        {sharedLabel&&<span style={{display:'inline-flex',alignItems:'center',fontSize:11,fontWeight:600,color:'#185FA5',background:'#E6F1FB',borderRadius:4,padding:'2px 7px'}}>{sharedLabel}</span>}
        <span onClick={()=>setPropertyFav(prop.id,!isFav)} style={{fontSize:18,color:isFav?'#F59E0B':C.txP,cursor:'pointer',lineHeight:1}} title={isFav?'즐겨찾기 해제':'즐겨찾기'}>{isFav?'★':'☆'}</span>
      </div>
    </>
  );

  const tradePriceItems=buildTradePriceInfoItems(propData, TL);
  const jibunAddr=propJibunAddr(propData)||propDisplayAddr(propData);
  const roadAddr=propRoadAddr(propData);
  const locationJibun=formatJibunWithExtraParcels(jibunAddr, extraParcelCount(propData))||jibunAddr;
  const locationDisplay=(
    <span style={{display:'block',lineHeight:1.45}}>
      <span style={{display:'block'}}>{locationJibun||roadAddr||'—'}</span>
      {roadAddr&&roadAddr!==jibunAddr&&(
        <span style={{display:'block',marginTop:2,color:C.txM,fontSize:12,fontWeight:400}}>{roadAddr}</span>
      )}
    </span>
  );
  const buildingScale=(propData.floorsBelow?`B${propData.floorsBelow}/`:'')+(propData.floorsAbove?`${propData.floorsAbove}F`:'—');
  const saleInfoRows=buildPropSaleInfoRows(propData, RENTALS, { fmtSalePriceEokWon, fmtLandPyUnit });
  const detailSpecPanel=(
    <>
      <SecLabel ch="기본정보" plain propTitle ic="location" sx={{marginTop:0}}/>
      <PropInfoGrid items={[
        {k:'소재지',v:locationDisplay,full:true,wrap:true},
        {k:'매물 종류',v:propKindDisplayLabel(propData)||'—'},
        {k:'소유주명',v:propData.ownerName||'—'},
        {k:'소유주 연락처',v:hasOwnerTel?showPhone(propData.ownerTel):'—'},
        {k:'도로조건',v:propData.roadInfo||'—'},
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
      {(isSaleTrade(propData.trade))&&<>
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
      <div style={{height:16}}/>
    </>
  );
  const brochurePhotoPanel=(
    <div style={{width:'100%',height:'100%',background:'#F4F6F9',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
      {hasPhotos ? (
        <img src={photoList[photoIdx]} alt="" style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',display:'block'}}/>
      ) : (
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:44,height:44,flexShrink:0,color:'#185FA5',opacity:.35}} aria-hidden>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </span>
      )}
    </div>
  );
  const brochureCadastral=(
    <PropertyDetailMap
      key={`pd-cad-${propData.id}-${propData.jibunAddr || propData.addr || ''}`}
      property={propData}
      useDistrict
    />
  );
  const brochureRentPrice=(
    <div>
      {tradePriceItems.map((item)=>(
        <div key={item.k} style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:8,fontSize:12}}>
          <span style={{color:C.txM}}>{item.k}</span>
          <span style={{fontWeight:700,color:item.c||C.tx}}>{item.v||'—'}</span>
        </div>
      ))}
    </div>
  );

  const agentNameLabel=propData.agentName||accountDefaults.displayName||'—';
  const agentTelLabel=formatPhone(propData.agentTel||accountDefaults.phone)||'—';
  const detailCallPanel=(
    <div style={{display:'flex',flexDirection:'column',minHeight:0,height:'100%'}}>
      <div style={{
        flexShrink:0,display:'flex',alignItems:'center',gap:14,padding:'2px 2px 6px',
        fontSize:12,whiteSpace:'nowrap',overflow:'hidden',minHeight:0,lineHeight:1.3,
      }}>
        <span style={{display:'inline-flex',alignItems:'baseline',gap:6,minWidth:0,overflow:'hidden'}}>
          <span style={{color:C.txM,fontWeight:600,flexShrink:0}}>담당자</span>
          <span style={{color:C.tx,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis'}} title={agentNameLabel}>{agentNameLabel}</span>
        </span>
        <span style={{display:'inline-flex',alignItems:'baseline',gap:6,minWidth:0,overflow:'hidden'}}>
          <span style={{color:C.txM,fontWeight:600,flexShrink:0}}>연락처</span>
          <span style={{color:C.tx,overflow:'hidden',textOverflow:'ellipsis'}} title={agentTelLabel}>{agentTelLabel}</span>
        </span>
      </div>
      <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
    <DetailCallHistoryPanel
      whiteBg
      compact
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
      callsManage={canWriteCalls&&canManageCallLogs(companyRole)}
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
        <div style={{position:'relative',marginBottom:0}}>
          {selCallCust?(
            <div style={{display:'flex',alignItems:'center',gap:8,height:28,border:`1.5px solid ${C.brand}`,borderRadius:7,background:C.brandL,padding:'0 8px'}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:C.brand,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0,color:'#fff'}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              </div>
              <span style={{fontSize:13,fontWeight:600,color:C.brand,flex:1}}>
                {isFreePhoneSel(selCallCust)?(selCallCust.phone):(selCallCust.name)}
              </span>
              {!isFreePhoneSel(selCallCust)&&<span style={{fontSize:12,color:C.txM}}>{selCallCust.co}</span>}
              {isFreePhoneSel(selCallCust)&&<span style={{fontSize:11,color:C.txM,background:'#fff',padding:'1px 6px',borderRadius:10}}>미등록</span>}
              <span onClick={()=>{setSelCallCust(null);setCustSearch('');setCustDropOpen(false);}}
                style={{width:20,height:20,borderRadius:'50%',background:'rgba(var(--ln-brand-rgb),.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,color:C.brand,fontSize:13,fontWeight:700}}>×</span>
            </div>
          ):(
            <div style={{display:'flex',alignItems:'center',gap:0,height:28,border:`1.5px solid ${C.bdr}`,borderRadius:7,background:'#fff',overflow:'hidden'}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:13,height:13,flexShrink:0,color:C.txP,marginLeft:8}} aria-hidden><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
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
            <div style={{position:'absolute',bottom:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:`1px solid ${C.bdr}`,borderRadius:8,zIndex:20,maxHeight:200,overflowY:'auto',boxShadow:'0 6px 20px rgba(0,0,0,.12)'}}>
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
      </div>
    </div>
  );

  if(showPdfView){
    const pdfTitle=(
      <span style={{fontSize:15,fontWeight:600,color:C.tx,letterSpacing:'-.01em'}}>매각안내서</span>
    );
    return(
      <Win title={pdfTitle} ic="ti-building" onClose={()=>setShowPdfView(false)} w={PROP_DETAIL_WIN_W}
        shellClass="prop-detail-win-overlay"
        acts={<>
          <Btn role="page-secondary" ch="인쇄" ic="ti-printer" on={()=>{
            const el=document.querySelector('.prop-pdf-print-root');
            printPdfBrochure(el, { fileName: brochurePdfFileName(propData) });
          }}/>
        </>}
        ch={
          <div className="prop-pdf-print-pane" style={{height:'100%',minHeight:0,overflow:'hidden'}}>
            <PropertySaleBrochure
              prop={propData}
              photo={brochurePhotoPanel}
              locationMap={detailMapPanel}
              cadastralMap={brochureCadastral}
              accountDefaults={accountDefaults}
              extras={{
                rentals: RENTALS,
                rentPrice: brochureRentPrice,
              }}
            />
          </div>
        }
      />
    );
  }

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
  const folderUrl=normalizeHttpUrl(propData.folderUrl);
  const openFolderUrl=()=>{
    if(folderUrl) window.open(folderUrl,'_blank','noopener,noreferrer');
  };
  const saveFolderUrl=async(next)=>{
    try{
      await updateProperty(prop.id,{folderUrl:next||''});
      setPropData((p)=>({...p,folderUrl:next||''}));
      setFolderLinkOpen(false);
      showNotification(next?'저장폴더 바로가기를 지정했습니다.':'저장폴더 바로가기를 지웠습니다.','success');
    }catch(err){
      if(err?.message==='FORBIDDEN') showNotification(PERMISSION_DENIED_TOOLTIP,'warning');
      else showNotification(err?.message||'저장에 실패했습니다.','error');
    }
  };
  return(
    <>
    <Win title={detailWinTitle} ic="ti-building" onClose={onClose} w={PROP_DETAIL_WIN_W}
      acts={<>
        <span
          style={{display:'inline-flex'}}
          onContextMenu={(e)=>{
            e.preventDefault();
            if(!canEditProp&&!folderUrl) return;
            setFolderLinkOpen(true);
          }}
        >
          <Btn
            role="page-secondary"
            ch="저장폴더"
            ic="ti-folder"
            title={folderUrl?'저장폴더 열기 (우클릭: 바로가기 변경)':'저장폴더 바로가기 지정'}
            on={()=>{
              if(folderUrl) openFolderUrl();
              else if(!canEditProp){
                showNotification(PERMISSION_DENIED_TOOLTIP,'warning');
                return;
              }
              setFolderLinkOpen(true);
            }}
          />
        </span>
        <Btn role="page-secondary" ch="PDF뷰" ic="ti-file" on={()=>setShowPdfView(true)}/>
        {EXT_SITES.map(s=><ExtSiteBtn key={s.key} site={s} addr={extSiteAddr} property={propData}/>)}
      </>}
      ch={detailBody}
    />
    {folderLinkOpen&&(
      <FolderLinkDialog
        value={folderUrl}
        canEdit={canEditProp}
        onClose={()=>setFolderLinkOpen(false)}
        onOpen={()=>{openFolderUrl();setFolderLinkOpen(false);}}
        onSave={saveFolderUrl}
      />
    )}
    </>
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
      const sync=await saveRentalsForProperty(pid, rows);
      dirtyRef.current=false;
      showNotification(propertySaveToastMessage(sync),'success');
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
  const isNew=!custData?.id;
  const { mode }=useDealMode();
  const formMode=isNew
    ? (custData?.__createMode===DEAL_MODE_RENT?DEAL_MODE_RENT:custData?.__createMode===DEAL_MODE_SALE?DEAL_MODE_SALE:mode)
    : inferCustomerDealMode(custData);
  const isRentForm=formMode===DEAL_MODE_RENT;
  const CALLS=useOwnerCallLogs();
  const callDates=!isNew&&custData?.id?custCallDatesOf(buildCustCallDateMap(CALLS),custData.id):null;
  const [name,setName]=useState(custData?.name||'');
  const [phone,setPhone]=useState(()=>formatPhone(custData?.phone||''));
  const [addr,setAddr]=useState(custData?.addr||'');
  const [email,setEmail]=useState(custData?.email||'');
  const [co,setCo]=useState(custData?.co||'');
  const [title,setTitle]=useState(custData?.title||'');
  const [customerTypes,setCustomerTypes]=useState(()=>{
    const t=customerTypesOf(custData||{});
    if(t.length) return t;
    if(isNew&&formMode===DEAL_MODE_RENT) return ['TENANT'];
    if(isNew&&formMode===DEAL_MODE_SALE) return ['BUYER'];
    return [];
  });
  const [status,setStatus]=useState(()=>normalizeCustStatus(custData?.status));
  const [cash,setCash]=useState(()=>fmtInputNum(custData?.cash??''));
  const [buyMin,setBuyMin]=useState(()=>fmtInputNum(custData?.buyMin??''));
  const [buyMax,setBuyMax]=useState(()=>fmtInputNum(custData?.buyMax??''));
  const [region,setRegion]=useState(custData?.region||'');
  const [buyTypes,setBuyTypes]=useState(()=>buyTypesOf(custData||{}));
  const [buyTiming,setBuyTiming]=useState(()=>String(custData?.buyTiming||''));
  const [memo,setMemo]=useState(custData?.memo||'');
  const [leaseRows,setLeaseRows]=useState(()=>leaseConditionsFromCustomer(custData||{}));
  const [alertMsg,setAlertMsg]=useState(null);
  const [showSaleExtra,setShowSaleExtra]=useState(false);

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
    setBuyTypes(buyTypesOf(custData));
    setBuyTiming(String(custData.buyTiming||''));
    setMemo(custData.memo||'');
    setLeaseRows(leaseConditionsFromCustomer(custData));
    setShowSaleExtra(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 수정 대상 고객 변경 시 폼 동기화
  },[custData?.id]);

  const toggleBuyType=(id)=>{
    setBuyTypes((prev)=>(
      prev.includes(id) ? prev.filter((t)=>t!==id) : [...prev, id]
    ));
  };

  const handleSave=async()=>{
    if(!name.trim()){
      setAlertMsg('고객이름을 입력해주세요.');
      return;
    }
    const typesForSave=customerTypes.length
      ? customerTypes
      : (isRentForm?['TENANT']:['BUYER']);
    const cashNum=parseFormNum(cash);
    const buyMinNum=parseFormNum(buyMin);
    const buyMaxNum=parseFormNum(buyMax);
    if(!isRentForm&&buyMinNum>0&&buyMaxNum>0&&buyMinNum>buyMaxNum){
      setAlertMsg('매입가능액 최소(만)은 최대(만)보다 클 수 없습니다.');
      return;
    }
    if(isRentForm){
      for(let i=0;i<leaseRows.length;i+=1){
        const row=leaseRows[i];
        const areaMin=Number(String(row.exclusiveAreaPyMin??'').replace(/,/g,'').trim())||0;
        const areaMax=Number(String(row.exclusiveAreaPyMax??'').replace(/,/g,'').trim())||0;
        if(areaMin>0&&areaMax>0&&areaMin>areaMax){
          setAlertMsg(`임차조건 ${i+1}: 필요 전용면적 최소는 최대보다 클 수 없습니다.`);
          return;
        }
        const budMin=parseFormNum(row.budgetManMin);
        const budMax=parseFormNum(row.budgetManMax);
        if(budMin>0&&budMax>0&&budMin>budMax){
          setAlertMsg(`임차조건 ${i+1}: 예산 최소는 최대보다 클 수 없습니다.`);
          return;
        }
      }
    }
    const { customer_types, type }=normalizeCustomerTypesField(typesForSave);
    const leaseConditions=isRentForm?serializeLeaseConditions(leaseRows):[];
    const firstLease=leaseConditions[0];
    const payload={
      name:name.trim(),phone:normalizePhone(phone),addr:addr.trim(),email,co,title,customer_types,type,
      status:normalizeCustStatus(status),
      cash:isRentForm?0:cashNum,buyMin:isRentForm?0:buyMinNum,buyMax:isRentForm?0:buyMaxNum,
      region:isRentForm?(firstLease?.region||''):region,preferred_trades:[],buyTypes:isRentForm?[]:buyTypes,buyTiming:isRentForm?'':buyTiming.trim(),memo,
      dealMode:formMode,
      leaseConditions,
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
    <Win title={isNew?(isRentForm?'임차고객 등록':'매수고객 등록'):(isRentForm?'임차고객 수정':'매수고객 수정')} ic={isNew?'ti-user-plus':'ti-user-edit'} onClose={onClose} w={760}
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
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>연락처</div>
                <PhoneInput value={phone} onChange={e=>setPhone(e.target.value)} placeholder="010-0000-0000"/>
              </div>
              {!showSaleExtra?(
                <div style={{gridColumn:'1 / -1'}}>
                  <button type="button" onClick={()=>setShowSaleExtra(true)}
                    style={{height:40,width:'100%',borderRadius:8,border:`1.5px dashed ${C.bdrSt}`,background:'transparent',color:C.brand,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    + 상세내역 추가
                  </button>
                </div>
              ):(
                <>
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
                    <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>직함</div>
                    <input className="inp" value={title} onChange={e=>setTitle(e.target.value)} placeholder="대표, 이사, 팀장..."/>
                  </div>
                </>
              )}
              <div style={{minWidth:0}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>등급 <span style={{color:C.brand}}>*</span></div>
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

          {/* 투자 조건 / 임차조건 */}
          {isRentForm?(
          <div style={{background:C.surf,border:`1px solid ${C.bdr}`,borderRadius:10}}>
            <SecLabel ch="임차조건" formSection end={
              <button type="button" onClick={()=>setLeaseRows((rows)=>[...rows,emptyLeaseCondition()])} title="임차조건 추가"
                style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${C.brand}`,background:C.brandL,color:C.brand,fontSize:20,fontWeight:700,lineHeight:1,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
            }/>
            <div style={{padding:'16px 18px 18px',display:'flex',flexDirection:'column',gap:14}}>
              {leaseRows.map((row,idx)=>(
                <div key={idx} style={{border:`1px solid ${C.bdr}`,borderRadius:8,padding:'12px 12px 14px',background:C.surf2}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.tx}}>임차조건 {idx+1}</div>
                    {leaseRows.length>1&&(
                      <Btn role="row-delete" ch="삭제" on={()=>setLeaseRows((rows)=>rows.filter((_,i)=>i!==idx))}/>
                    )}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 12px'}}>
                    <div style={{gridColumn:'1 / -1'}}>
                      <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>필요 전용면적 (평)</div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <input className="inp" inputMode="decimal" value={row.exclusiveAreaPyMin??''} onChange={e=>setLeaseRows((rows)=>rows.map((r,i)=>i===idx?{...r,exclusiveAreaPyMin:e.target.value}:r))} placeholder="최소"/>
                        <span style={{color:C.txM,fontSize:13,flexShrink:0}}>~</span>
                        <input className="inp" inputMode="decimal" value={row.exclusiveAreaPyMax??''} onChange={e=>setLeaseRows((rows)=>rows.map((r,i)=>i===idx?{...r,exclusiveAreaPyMax:e.target.value}:r))} placeholder="최대"/>
                      </div>
                    </div>
                    <div style={{gridColumn:'1 / -1'}}>
                      <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>예산 (만원)</div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <MoneyInput value={row.budgetManMin??''} onChange={e=>setLeaseRows((rows)=>rows.map((r,i)=>i===idx?{...r,budgetManMin:e.target.value}:r))} placeholder="최소"/>
                        <span style={{color:C.txM,fontSize:13,flexShrink:0}}>~</span>
                        <MoneyInput value={row.budgetManMax??''} onChange={e=>setLeaseRows((rows)=>rows.map((r,i)=>i===idx?{...r,budgetManMax:e.target.value}:r))} placeholder="최대"/>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>선호지역</div>
                      <input className="inp" value={row.region??''} onChange={e=>setLeaseRows((rows)=>rows.map((r,i)=>i===idx?{...r,region:e.target.value}:r))} placeholder="예: 강남·서초"/>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>이전시기</div>
                      <input className="inp" value={row.moveTiming??''} onChange={e=>setLeaseRows((rows)=>rows.map((r,i)=>i===idx?{...r,moveTiming:e.target.value}:r))} placeholder="예: 즉시, 3월 말"/>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={()=>setLeaseRows((rows)=>[...rows,emptyLeaseCondition()])}
                style={{height:40,borderRadius:8,border:`1.5px dashed ${C.bdrSt}`,background:'transparent',color:C.brand,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                + 임차조건 추가
              </button>
            </div>
          </div>
          ):(
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
                  매수유형
                  <span style={{fontWeight:400,color:C.txP,marginLeft:6,fontSize:11}}>복수 선택</span>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {CUSTOMER_BUY_TYPE_OPTS.map((opt)=>(
                    <div key={opt.id} onClick={()=>toggleBuyType(opt.id)} style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid',borderColor:buyTypes.includes(opt.id)?C.brand:C.bdr,background:buyTypes.includes(opt.id)?C.brandL:'transparent',color:buyTypes.includes(opt.id)?C.brand:C.txS,fontSize:13,cursor:'pointer',fontWeight:buyTypes.includes(opt.id)?600:400,transition:'all .1s'}}>
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{minWidth:0,gridColumn:'1 / -1'}}>
                <div style={{fontSize:12,color:C.txM,fontWeight:600,marginBottom:6}}>매수시기</div>
                <input className="inp" value={buyTiming} onChange={e=>setBuyTiming(e.target.value)} placeholder="예: 즉시, 3개월 내"/>
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
          )}

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
  const { companyRole }=useAuth();
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
              <InfoRow k="등급" v={<CustStatusBdg s={c.status}/>}/>
              <InfoRow k="최초 통화일" v={fmtCallDate(callDates.first)}/>
              <InfoRow k="마지막 통화일" v={fmtCallDate(callDates.last)}/>
            </div>
            {inferCustomerDealMode(c)===DEAL_MODE_RENT?(
            <>
            <SecLabel ch="임차조건"/>
            <div>
              {(()=>{
                const leaseRows=serializeLeaseConditions(leaseConditionsFromCustomer(c));
                if(!leaseRows.length) return <InfoRow k="임차조건" v="—"/>;
                return leaseRows.flatMap((row,i)=>[
                  leaseRows.length>1?(
                    <div key={`h-${i}`} style={{padding:'8px 14px',fontSize:11,fontWeight:700,color:C.txM,background:C.surf2,borderBottom:`1px solid ${C.bdr}`}}>조건 {i+1}</div>
                  ):null,
                  <InfoRow key={`a-${i}`} k="필요 전용면적" v={fmtLeaseAreaRange(row.exclusiveAreaPyMin,row.exclusiveAreaPyMax)}/>,
                  <InfoRow key={`b-${i}`} k="예산" v={fmtLeaseBudgetRange(row.budgetManMin,row.budgetManMax)} vc={C.ok}/>,
                  <InfoRow key={`r-${i}`} k="선호지역" v={row.region||'—'}/>,
                  <InfoRow key={`m-${i}`} k="이전시기" v={row.moveTiming||'—'}/>,
                ].filter(Boolean));
              })()}
            </div>
            </>
            ):(
            <>
            <SecLabel ch="투자 조건"/>
            <div style={{padding:'2px 0'}}>
              <InfoRow k="현금 가용금액" v={fmtCustomerMoney(c.cash)} vc={C.ok}/>
              <InfoRow k="매입가능액 범위" v={fmtCustomerBudgetRange(c.buyMin,c.buyMax)} vc={C.ok}/>
              <InfoRow k="선호 지역" v={c.region||'—'}/>
              <InfoRow k="매수유형" v={customerBuyLabelOf(c)}/>
              <InfoRow k="매수시기" v={c.buyTiming||'—'}/>
            </div>
            </>
            )}
            {c.memo&&<><SecLabel ch="메모"/>
              <div style={{padding:'14px 16px',fontSize:13,color:C.txS,lineHeight:1.7,maxHeight:120,overflowY:'auto'}}>{c.memo}</div>
            </>}
          </div>
          <div style={{width:'48%',display:'flex',flexDirection:'column',minHeight:0}}>
            <DetailCallHistoryPanel
              calls={calls}
              onOpen={onOpen}
              onDeleteCall={onDeleteCall}
              callsManage={canManageCallLogs(companyRole)}
              renderCallLink={(cl)=>{
                const prop=cl.pid?findPropertyByPid(P,cl.pid):null;
                return prop?(
                  <div onClick={e=>{e.stopPropagation();onOpen('pd',prop);}}
                    style={{fontSize:12,color:C.info,cursor:'pointer',fontWeight:500,marginTop:3,lineHeight:1.4}}>
                    {propCallIdentLabel(prop)}
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
                <div style={{position:'relative',marginBottom:0}}>
                  {selCallProp?(
                    <div style={{display:'flex',alignItems:'center',gap:8,height:34,border:`1.5px solid ${C.brand}`,borderRadius:7,background:C.brandL,padding:'0 10px'}}>
                      <div style={{width:22,height:22,borderRadius:'50%',background:C.brand,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:12,height:12,flexShrink:0,color:'#fff'}} aria-hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                      </div>
                      <span className="cell-wrap" style={{fontSize:13,fontWeight:600,color:C.brand,flex:1}}>{propDisplayAddr(selCallProp)}</span>
                      <span onClick={()=>{setSelCallProp(null);setPropSearch('');setPropDropOpen(false);}}
                        style={{width:20,height:20,borderRadius:'50%',background:'rgba(var(--ln-brand-rgb),.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,color:C.brand,fontSize:13,fontWeight:700}}>×</span>
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
  const gcalOwnerId=user?.id&&user.id!=='dev-local'?user.id:undefined;
  const gcalMeta=useMemo(()=>buildGcalMeta(gcalOwnerId),[gcalOwnerId]);
  const originHint=useMemo(()=>scheduleOriginHint(liveSched,gcalMeta),[liveSched,gcalMeta]);
  const headerAccent=originHint?.color||detailPriC;

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
          <div style={{padding:'18px 24px 14px',borderBottom:`1px solid ${C.bdr}`,background:C.surf,borderLeft:`4px solid ${headerAccent}`}}>
            {originHint&&(
              <div style={{fontSize:11,fontWeight:600,color:originHint.color,marginBottom:8,letterSpacing:'.02em'}}>
                {originHint.badge}
              </div>
            )}
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
  const { accountDefaults, teamMembers }=useAuth();
  const { setDealMode }=useDealMode();
  const RENTALS=useRentals(prop.id);
  const [showRental,setShowRental]=useState(false);
  const [trade,setTrade]=useState(()=>{
    const t=normalizePropTrade(prop.trade||'SALE');
    return isSaleTrade(t)?t:'MONTHLY';
  });
  useEffect(()=>{
    const next=dealModeFromProperty(prop);
    if(next) setDealMode(next);
  },[prop.id, prop.trade, setDealMode]);
  const [mainType,setMainType]=useState(prop.main||'COMMERCIAL');
  const [subType,setSubType]=useState(prop.sub||'WHOLE_BUILDING');
  const [saleKind,setSaleKind]=useState(()=>saleKindFromProp(prop));
  const [status,setStatus]=useState(prop.status||'ACTIVE');
  const [pub,setPub]=useState(prop.pub?'true':'false');
  const [photoSlots,setPhotoSlots]=useState(()=>normalizePhotoSlots(prop.photos));
  const [priceForm,setPriceForm]=useState(()=>{
    const pf=priceFormFromProperty(prop);
    if(!isSaleTrade(prop.trade) && !pf.mDep && pf.jDep) return {...pf, mDep: pf.jDep};
    return pf;
  });
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
  const [landEdit,setLandEdit]=useState(()=>landFromPropertyPrimary(prop));
  const [buildingEdit,setBuildingEdit]=useState(()=>buildingFromProperty(prop));
  const [roadSearch,setRoadSearch]=useState(propDisplayAddr(prop));
  const [addressModalOpen,setAddressModalOpen]=useState(false);
  const [addressModalMode,setAddressModalMode]=useState('primary');
  const [saving,setSaving]=useState(false);
  const {
    lookup, addressKeys, locationForm, setLocationForm,
    landForm, setLandForm, buildingForm, setBuildingForm,
    extraParcels, addExtraParcelFromAddress, removeExtraParcel, updateExtraParcelLand, extraParcelLoading, refetchExtraParcel,
    handleAddressFetchSuccess, resetAddressLookup, isLoading,
    restoreAddressLookupDraft,
  }=usePropertyAddressLookup({ mode:'edit' });
  useEffect(()=>{
    const hydrated=hydrateEditLandFromProperty(prop);
    restoreAddressLookupDraft({
      addressKeys: hydrated.addressKeys,
      locationForm: {
        jibunAddr: prop.jibunAddr || prop.addr || '',
        roadAddr: prop.roadAddr || '',
        ownerName: prop.ownerName || '',
        ownerTel: prop.ownerTel || '',
        roadInfo: prop.roadInfo || '',
      },
      landForm: hydrated.landEdit,
      buildingForm: hydrated.buildingEdit,
      extraParcels: prop.extraParcels,
      lookup: hydrated.lookup,
    });
    setLandEdit(hydrated.landEdit);
    setBuildingEdit(hydrated.buildingEdit);
    setRoadSearch(propDisplayAddr(prop));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 매물 전환 시에만 복원
  }, [prop.id, restoreAddressLookupDraft]);
  useEffect(()=>{
    setLandEdit((prevLand)=>applyLookupToLandEditState(prevLand, null, lookup, landForm, buildingForm).landEdit);
    setBuildingEdit((prevBuilding)=>applyLookupToLandEditState(null, prevBuilding, lookup, landForm, buildingForm).buildingEdit);
  },[lookup.status, lookup.fetchedAt, lookup.parcelChanged, landForm, buildingForm]);
  const onAddressSearch=()=>{ setAddressModalMode('primary'); setAddressModalOpen(true); };
  const onAddParcelSearch=()=>{ setAddressModalMode('extra'); setAddressModalOpen(true); };
  const onResetAddress=()=>{
    setRoadSearch('');
    resetAddressLookup();
    setLandEdit(emptyLandForm());
    setBuildingEdit(emptyBuildingForm());
  };
  const onAddressSelected=async (addr)=>{
    if(addressModalMode==='extra'){
      await addExtraParcelFromAddress(addr);
      return;
    }
    setRoadSearch(addr.jibunAddr||addr.roadAddr||'');
    await handleAddressFetchSuccess(addr);
  };
  const apiBadge=lookupApiBadge(lookup);
  const handleSave=async()=>{
    if(saving) return;
    if(lookupBlocksPropertySave(lookup, extraParcelLoading)){
      window.alert(propertySaveBlockedTitle(lookup, extraParcelLoading));
      return;
    }
    setSaving(true);
    try{
    const addressFields=buildPropertyAddressFields({
      jibunAddr: locationForm.jibunAddr,
      roadAddr: locationForm.roadAddr,
    });
    const mapCoordFields=await resolveMapCoordFieldsForSave(prop, {
      ...addressFields,
      bldg: detailForm.title || '',
    });
    const typeCodes=typeCodesForSave({isSale:isSaleTrade(trade),saleKind,main:mainType,sub:subType});
    const changes={
      trade,main:typeCodes.main,sub:typeCodes.sub,status,pub:pub==='true',photos:photoSlotsToSave(photoSlots),
      tag:typeCodes.tag,
      ...addressFields,
      ...mapCoordFields,
      ownerName: locationForm.ownerName ?? '',
      ownerTel: normalizePhone(locationForm.ownerTel ?? ''),
      roadInfo: locationForm.roadInfo ?? '',
      bldg: detailForm.title || '',
      promo: detailForm.promo || '',
      memo: detailForm.memo || '',
      discoUrl: normalizeDiscoUrl(detailForm.discoUrl) || '',
      folderUrl: normalizeHttpUrl(detailForm.folderUrl) || '',
      agentName: detailForm.agentName || '',
      agentTel: normalizePhone(detailForm.agentTel || ''),
      ...buildPriceFields(trade, priceForm),
      ...buildEditSaveLandPayload({
        lookup, landForm, buildingForm, landEdit, buildingEdit, extraParcels, addressKeys,
      }),
    };
    if(isSaleTrade(trade)){
      const price=parseFormNum(priceForm.price)??prop.price??0;
      const metrics=buildSaleInvestmentMetrics(price, RENTALS, {
        ...prop,
        price,
        maintenance: parseFormNum(priceForm.maintenance),
      });
      changes.roi=metrics.yieldLabel;
    }
    const check=validatePropertyForSave({...prop,...changes});
    if(!check.ok){
      window.alert(check.message);
      return;
    }
    const sync=await updateProperty(prop.id,changes);
    showNotification(propertySaveToastMessage(sync),'info');
    if(onSaved) onSaved({...prop,...changes});
    else onClose();
    }catch(err){
      window.alert(err instanceof Error?err.message:String(err));
    }finally{
      setSaving(false);
    }
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
        initialKeyword={addressModalMode==='extra'?'':roadSearch}
        initialMode={addressModalMode==='extra'?'jibun':'all'}
      />
      <PH title="매물 수정" lead={propDetailWinTitle({
        jibunAddr: locationForm.jibunAddr || prop.jibunAddr,
        addr: prop.addr,
        bldg: (detailForm.title || '').trim(),
      })}
        acts={<Btn role="page-secondary" ch="상세로" ic="ti-arrow-left" on={onClose}/>}
      />
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'16px 28px 0'}}>
        <PropFormSplit>
          <PropFormCol>
              <SecLabel ch="매물종류 · 상태" formSection/>
              <div className="prop-form-sec-body" style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:14}}>
                {isSaleTrade(trade)?(
                <div><FL label="매물 종류" req/>
                  <select className="sel" value={saleKind} onChange={e=>{
                    const k=normalizeSalePropKind(e.target.value);
                    setSaleKind(k);
                    if(!k) return;
                    const t=typeCodesForSave({isSale:true,saleKind:k});
                    setMainType(t.main);setSubType(t.sub);
                  }}>
                    {!saleKind&&<option value="">선택</option>}
                    {SALE_PROP_KIND_OPTS.map(({id,label})=>(<option key={id} value={id}>{label}</option>))}
                  </select></div>
                ):(
                <div><FL label="매물 분류" req/>
                  <select className="sel" value={subType} onChange={e=>{
                    const v=e.target.value;
                    setSubType(v);
                    const nextMain=findPropMainForSub(v);
                    if(nextMain) setMainType(nextMain);
                  }}>
                    {visibleAllPropSubEntries(mainType, subType).map(({id,label})=>(<option key={id} value={id}>{label}</option>))}
                  </select></div>
                )}
                <div><FL label="진행 상태" req/>
                  <select className="sel" value={status} onChange={e=>setStatus(e.target.value)}>
                    {propStatusOpts(isSaleTrade(trade)?false:true).map(({id,label})=>(<option key={id} value={id}>{label}</option>))}
                  </select></div>
                <div><FL label="공개 여부" req/>
                  <select className="sel" value={pub} onChange={e=>setPub(e.target.value)}>
                    <option value="true">공개</option><option value="false">비공개</option>
                  </select></div>
              </div>
          </PropFormCol>
          <PropFormCol>
              <SecLabel ch={isSaleTrade(trade)?'거래방식 · 가격':'임대조건'} formSection end={isSaleTrade(trade)?<TradeModeChips trade={trade} setTrade={setTrade}/>:null}/>
              <div className="prop-form-sec-body" style={{padding:'14px 20px'}}>
                <PropPriceSection trade={isSaleTrade(trade)?trade:'MONTHLY'} priceForm={priceForm} setPriceForm={setPriceForm} idPrefix="edit_" subType={subType} collectMoveInDate/>
              </div>
          </PropFormCol>
        </PropFormSplit>
        <PropFormSplit>
          <PropFormCol>
              <PropLocationBlock
                lookup={lookup} isLoading={isLoading} extraParcelLoading={extraParcelLoading}
                roadSearch={roadSearch}
                onAddressSearch={onAddressSearch} onResetAddress={onResetAddress} onAddParcelSearch={onAddParcelSearch}
                setLocationForm={setLocationForm}
                extraParcels={extraParcels} onRemoveExtra={removeExtraParcel}
                jibunValue={locationForm.jibunAddr}
                roadValue={locationForm.roadAddr}
                ownerNameValue={locationForm.ownerName}
                ownerTelValue={locationForm.ownerTel}
                roadInfoValue={locationForm.roadInfo}
              />
              <PropLandSection
                apiBadge={apiBadge} extraParcels={extraParcels}
                landForm={landEdit} setLandForm={setLandEdit}
                lookupSuccess={lookup.status==='success'}
                onChangeLand={updateExtraParcelLand} onRemove={removeExtraParcel} onRefetch={refetchExtraParcel}
              />
              <SecLabel ch="건물정보" badge={apiBadge} formSection/>
              <div style={{padding:'14px 20px'}}>
                <PropBuildingFields buildingForm={buildingEdit} setBuildingForm={setBuildingEdit} readOnlyStyle={lookup.status==='success'?{background:C.surf2}:undefined}/>
              </div>
              <SecLabel ch="임대차관리" formSection/>
              <div style={{padding:'14px 20px'}}>
                {isSaleTrade(trade)?(
                  <>
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
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
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
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}>
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
                  </>
                ):(
                  <div style={{fontSize:13,color:C.txM,lineHeight:1.6}}>
                    임대 거래는 위 임대조건에서 보증금·월세 등을 입력합니다.
                  </div>
                )}
              </div>
          </PropFormCol>
          <PropFormCol>
              <SecLabel ch="세부내용" formSection/>
              <div style={{padding:'14px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div style={{gridColumn:'1/-1'}}><FL label="게시글 제목" req/>
                  <input className="inp" value={detailForm.title} onChange={e=>setDetailForm(f=>({...f,title:e.target.value}))} placeholder="예: 영등포 핵심 상권 상가건물 매매"/></div>
                <PropAgentFields
                  detailForm={detailForm}
                  setDetailForm={setDetailForm}
                  teamMembers={teamMembers}
                  accountDefaults={accountDefaults}
                  Label={({children})=><FL label={children}/>}
                />
                <div style={{gridColumn:'1/-1'}}><FL label="홍보문구 (공개)"/>
                  <textarea className="ta" rows={9} value={detailForm.promo} onChange={e=>setDetailForm(f=>({...f,promo:e.target.value}))} placeholder="외부에 공개되는 홍보문구"/></div>
                <div style={{gridColumn:'1/-1'}}><FL label="내부 메모 (비공개)"/>
                  <textarea className="ta" rows={3} value={detailForm.memo} onChange={e=>setDetailForm(f=>({...f,memo:e.target.value}))} placeholder="내부 참고 사항 (공개 안 됨)"/></div>
                <div style={{gridColumn:'1/-1'}}><FL label="저장폴더 바로가기" hint="선택"/>
                  <input className="inp" value={detailForm.folderUrl||''} onChange={e=>setDetailForm(f=>({...f,folderUrl:e.target.value}))} placeholder="구글 드라이브, 원드라이브 등 폴더 주소"/></div>
                {!isSaleTrade(trade)&&(
                <div style={{gridColumn:'1/-1'}}><FL label="디스코 상세 링크" hint="선택"/>
                  <input className="inp" value={detailForm.discoUrl||''} onChange={e=>setDetailForm(f=>({...f,discoUrl:e.target.value}))} placeholder="디스코에서 복사한 주소 링크가 있다면 입력해주세요 (선택)"/></div>
                )}
              </div>
              <SecLabel ch="사진 (선택, 최대 3장)" formSection/>
              <PropertyPhotoPicker slots={photoSlots} onChange={setPhotoSlots} compact/>
          </PropFormCol>
        </PropFormSplit>
        </div>
        <ActionBar saveLabel={saving?'저장 중…':'저장'} onSave={handleSave} onDelete={onDelete?()=>onDelete(prop):null} onCancel={onClose} saveDisabled={saving||lookupBlocksPropertySave(lookup,extraParcelLoading)} saveDisabledTitle={saving?'저장 중입니다.':propertySaveBlockedTitle(lookup,extraParcelLoading)}/>
      </div>
    );
  };


/** 북마크/직접 URL 접근 시 목록으로 돌아가며 Win 팝업으로 상세 표시 */
const PropDetailRedirect=({onOpen})=>{
  const { id }=useParams();
  const navigate=useNavigate();
  const props=usePropertiesQuery();
  const { sessionCloudSyncStatus }=useAuth();
  useEffect(()=>{
    if(props===undefined) return;
    const prop=findPropertyByRouteId(props,id);
    if(prop) onOpen('pd',prop);
    navigate(propertiesListPath(),{replace:true});
  },[props,id,navigate,onOpen]);
  if(props===undefined&&(sessionCloudSyncStatus==='idle'||sessionCloudSyncStatus==='syncing')){
    return <RouteLoading label="매물 상세 여는 중…"/>;
  }
  return null;
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
  const { user, companyRole, memberPermissions, sessionCloudSyncStatus }=useAuth();
  if(props===undefined){
    if(sessionCloudSyncStatus==='idle'||sessionCloudSyncStatus==='syncing'){
      return <RouteLoading label="매물 정보 불러오는 중…"/>;
    }
    return null;
  }
  const prop=findPropertyByRouteId(props,id);
  if(!prop) return <Navigate to={propertiesListPath()} replace />;
  if(!canWriteRecord(prop,user?.id,companyRole,memberPermissions,'properties')){
    return <Navigate to={propertiesListPath()} replace />;
  }
  const goList=()=>navigate(propertiesListPath());
  return (
    <PropEdit
      prop={prop}
      onClose={goList}
      onSaved={goList}
      onDelete={(item)=>softDelete('props',item,propDisplayAddr(item)||item.bldg,goList)}
    />
  );
};

/* ═══ GLOBAL APP STYLES (메인 + 팝업 공통) ═══ */
const APP_STYLES_ID='landnote-app-styles-v5';
function useInjectAppStyles(){
  useEffect(()=>{
    if(document.getElementById(APP_STYLES_ID)) return undefined;
    const link=document.createElement('link');
    link.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';
    link.rel='stylesheet';
    document.head.appendChild(link);
    const s=document.createElement('style');
    s.id=APP_STYLES_ID;
    s.textContent=`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1A2332;text-align:left}#root{width:100%;height:100%;font-family:inherit;text-align:left}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}input,textarea,select{font-family:inherit;text-align:left}button{font-family:inherit;cursor:pointer}input:focus,textarea:focus,select:focus{outline:none}.tbl{width:100%;border-collapse:collapse;table-layout:auto}.tbl th{background:#F8F9FB;color:#6B7280;font-size:12px;font-weight:600;padding:0 16px;height:49px;text-align:left;border-bottom:1.5px solid #E8EAED;white-space:nowrap;letter-spacing:.03em;text-transform:uppercase;position:sticky;top:0;z-index:1}.tbl td{padding:0 16px;height:57px;border-bottom:1px solid #E8EAED;color:#0F172A;font-size:14px;vertical-align:middle;white-space:normal;text-align:left;word-break:keep-all}.tbl tbody tr:hover td{background:#FAFBFF;cursor:pointer}.tbl-fixed{table-layout:fixed;width:100%}.tbl-fixed td,.tbl-fixed th{overflow:hidden}.cell-ellipsis{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;max-width:100%}.cell-wrap{display:block;white-space:normal;word-break:keep-all;overflow-wrap:break-word;line-height:1.35;min-width:0}.inp{height:36px;min-height:36px;line-height:1.25;border:1.5px solid #E2E8F0;border-radius:7px;padding:0 12px;font-size:14px;color:#0F172A;background:#fff;width:100%;display:block;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}.inp:focus{border-color:var(--ln-brand);box-shadow:0 0 0 3px rgba(var(--ln-brand-rgb),.09)}.inp::placeholder{color:#94A3B8;font-size:13px}.sel{height:36px;min-height:36px;line-height:1.25;border:1.5px solid #E2E8F0;border-radius:7px;padding:0 10px;font-size:14px;color:#0F172A;background:#fff;cursor:pointer;width:100%;display:block;box-sizing:border-box}.sel:focus{border-color:var(--ln-brand)}.ta{display:block;width:100%;box-sizing:border-box;border:1.5px solid #E2E8F0;border-radius:7px;padding:10px 12px;font-size:14px;color:#0F172A;background:#fff;resize:vertical;min-height:72px}.ta:focus{border-color:var(--ln-brand);box-shadow:0 0 0 3px rgba(var(--ln-brand-rgb),.09)}.ta::placeholder{color:#94A3B8;font-size:13px}.nav-item{display:flex;align-items:center;gap:10px;height:40px;padding:0 10px;border-radius:8px;cursor:pointer;color:rgba(255,255,255,.52);font-size:14px;transition:background .1s,color .1s;margin-bottom:2px;text-align:left}.nav-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85)}.nav-item.active{background:rgba(var(--ln-brand-rgb),.16);color:#fff;font-weight:600}@keyframes spin{to{transform:rotate(360deg)}}.prop-form-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:stretch;margin-bottom:16px}.prop-form-col{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.04);min-width:0;display:flex;flex-direction:column;height:100%}.prop-form-col .prop-form-sec-body{flex:1}.prop-form-col .prop-form-sec{margin-top:14px;border-top:2px solid #CBD5E1}.prop-form-col .prop-form-sec:first-child{margin-top:0;border-top:none}@media (max-width:1100px){.prop-form-split{grid-template-columns:1fr}}`;
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

/** 로그인 전 공개 라우트 — 딥링크 URL을 /login으로 바꾸지 않아 새로고침 후 복원 가능 */
function AuthPublicCatchAll({ onLegacyLogin }) {
  const location = useLocation();
  useLayoutEffect(() => {
    saveLastAppPath(`${location.pathname}${location.search || ''}`);
  }, [location.pathname, location.search]);
  return <LoginScreen variant="login" onLegacyLogin={onLegacyLogin} />;
}

/** 로그인된 상태에서 /login 등에 남아 있으면 직전 앱 경로로 즉시 복귀 (중간 로딩 화면 없음) */
function AuthPathRedirect() {
  return <Navigate to={resolveReturnAppPath('/dashboard')} replace />;
}

/** 알 수 없는 경로 — 가능하면 직전 페이지, 없으면 대시보드 (루프 방지) */
function FallbackAppPath() {
  const location = useLocation();
  const saved = resolveReturnAppPath('/dashboard');
  const savedPath = String(saved).split('?')[0];
  const target = savedPath && savedPath !== location.pathname ? saved : '/dashboard';
  return <Navigate to={target} replace />;
}

function AuthPublicRoutes({ onLegacyLogin }) {
  return (
  <Routes>
      <Route path={AUTH_PATHS.login} element={<LoginScreen variant="login" onLegacyLogin={onLegacyLogin} />} />
      <Route path={AUTH_PATHS.signup} element={<SignUpPage onLegacyLogin={onLegacyLogin} />} />
      <Route path={AUTH_PATHS.signupInvite} element={<InviteSignUpPage onLegacyLogin={onLegacyLogin} />} />
      <Route path="/" element={<AuthRootRedirect />} />
      <Route path="*" element={<AuthPublicCatchAll onLegacyLogin={onLegacyLogin} />} />
    </Routes>
  );
}

/* ═══ MAIN APP ═══ */
function AppShell(){
  const { user, loading: authLoading, profileLoading, profilePending, needsSignupCompletion, signOut, passwordRecovery, sessionCloudSyncStatus } = useAuth();
  const [cloudWaitTimedOut, setCloudWaitTimedOut] = useState(false);
  const isMobile = useIsMobile();
  const isMobileDevice = useIsMobileDevice();
  const [forceDesktop, setForceDesktopState] = useState(getForceDesktop);
  const viewDesktop = () => { setForceDesktop(true); setForceDesktopState(true); };
  const viewMobile = () => { setForceDesktop(false); setForceDesktopState(false); };
  const [legacyUnlocked, setLegacyUnlocked] = useState(false);
  /** 로그아웃 중 — 앱 셸↔로그인 전환·AuthPathRedirect 바운스를 막아 한 번만 로그인 화면으로 이동 */
  const [signingOut, setSigningOut] = useState(false);

  // 새로고침 직후 인증 리다이렉트가 URL을 바꿔도 복원할 수 있게 즉시 저장
  useLayoutEffect(() => {
    captureCurrentAppPathFromWindow();
  }, []);

  useEffect(() => {
    const waiting = isSupabaseConfigured
      && !!user?.id
      && user.id !== 'dev-local'
      && (sessionCloudSyncStatus === 'idle' || sessionCloudSyncStatus === 'syncing');
    let sessionReady = false;
    try { sessionReady = sessionStorage.getItem(`landnote.sessionCloudReady.${user?.id}`) === '1'; } catch { /* ignore */ }
    if (!waiting || sessionReady) {
      setCloudWaitTimedOut(false);
      return undefined;
    }
    const t = window.setTimeout(() => {
      console.warn('[auth] login bootstrap timed out — continue with local data');
      setCloudWaitTimedOut(true);
    }, 12000);
    return () => window.clearTimeout(t);
  }, [user?.id, sessionCloudSyncStatus]);

  // 로그인 시 seed만 — prepareLocalStore는 Auth 세션 sync가 pull 직전에 수행 (경합 방지)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!user?.id) return;
      if(profileLoading) return;
      if(cancelled) return;
      const skipSeed=isSupabaseConfigured&&user.id!=='dev-local';
      await seedDatabase({ skipSeed });
    })();
    return ()=>{ cancelled=true; };
  },[user?.id, profileLoading]);
  const navigate=useNavigate();
  const location=useLocation();

  useEffect(() => {
    if (isPropertyRegisterPath(location.pathname)) return;
    clearPropertyRegisterDraft();
  }, [location.pathname]);

  // 앱 사용 중 경로를 계속 기록 — 새로고침 후 같은 페이지 유지
  useEffect(() => {
    if (!user?.id && !legacyUnlocked) return;
    if (authLoading || profileLoading) return;
    saveLastAppPath(`${location.pathname}${location.search || ''}`);
  }, [user?.id, legacyUnlocked, authLoading, profileLoading, location.pathname, location.search]);

  const properties=useProperties();
  const [wins,setWins]=useState([]);
  const [registerFormKey,setRegisterFormKey]=useState(0);
  const [showSet,setShowSet]=useState(false);
  const [sidebarExpanded,setSidebarExpanded]=useState(false);
  const [folders,setFolders]=useState(()=>loadFolderState()?.folders??FOLDERS);
  const [propFolders,setPropFolders]=useState(()=>loadFolderState()?.propFolders??PROP_FOLDERS);
  useEffect(()=>{
    if (!user?.id || user.id === 'dev-local') return;
    saveFolderState(folders, propFolders, user.id);
  },[folders, propFolders, user?.id]);

  useEffect(() => {
    if (!user?.id || user.id === 'dev-local') return;
    const saved = loadFolderState(user.id);
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
  const navTo=(id)=>{
    const path=MENU_PATHS[id]||'/dashboard';
    if(path==='/register'){
      clearPropertyRegisterDraft();
      setRegisterFormKey((k)=>k+1);
    }
    navigate(path);
  };

  const softDelete=(type,item,label,afterFn)=>{
    if(type==='calls'&&isLockedCallLog(item)){
      showNotification(LOCKED_CALL_LOG_MSG,'warning');
      return;
    }
    setGlobalConfirm({
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
        }else if(err?.message==='LOCKED_CALL_LOG'){
          showNotification(LOCKED_CALL_LOG_MSG,'warning');
        }else{
          console.error('[softDelete]',err);
          showNotification('삭제에 실패했습니다.','error');
        }
      }
      setGlobalConfirm(null);
      if(afterFn) afterFn();
    }
  });
  };

  const openWin=useCallback((type,data)=>{
    if(type==='ce'&&data&&isLockedCallLog(data)){
      showNotification(LOCKED_CALL_LOG_MSG,'warning');
      return;
    }
    if(type==='pd'){
      setWins(prev=>{
        const filtered=prev.filter(w=>w.type!=='cd'&&!(w.type==='pd'&&w.data?.id===data?.id));
        return [...filtered,{type,data,wid:`pd-${Date.now()}`}];
      });
      return;
    }
    if(type==='pe'){
      const tab=new URLSearchParams(window.location.search).get('tab');
      rememberPropListTab(tab||loadPropListState().statusTab||'ALL');
      navigate(`/properties/${data.id}/edit`);
      return;
    }
    setWins(prev=>{
      const filtered=prev.filter(w=>!(w.type===type&&w.data?.id===data?.id));
      return[...filtered,{type,data,wid:`${type}-${Date.now()}`}];
    });
  },[navigate,showNotification]);
  const closeWin=useCallback((wid)=>setWins(prev=>prev.filter(w=>w.wid!==wid)),[]);
  const closeCustomerWins=useCallback((custId)=>{
    setWins(prev=>prev.filter(w=>!((w.type==='cd'||w.type==='cf')&&w.data?.id===custId)));
  },[]);

  const trashCount=useOwnerTrashCount();

  const handleSignOut=async()=>{
    if(signingOut) return;
    setSigningOut(true);
    clearPropListState();
    setLegacyUnlocked(false);
    // user 해제 전에 URL을 /login으로 — CatchAll 로그인→/login 재마운트(새로고침처럼 보임) 방지
    navigate(AUTH_PATHS.login,{replace:true});
    try{
      await signOut();
    }finally{
      setSigningOut(false);
    }
  };

  const legacyLoginProps = {
    onLegacyLogin: () => { clearPropListState(); setLegacyUnlocked(true); navigate('/dashboard'); },
  };

  if(passwordRecovery||location.pathname===PASSWORD_RESET_REDIRECT_PATH){
    return <ResetPasswordScreen/>;
  }

  // 로그아웃 중에는 세션이 남아 있어도 공개 로그인 라우트만 표시 (대시보드로 튕기지 않음)
  if(signingOut||(!user&&!legacyUnlocked)){
    if(authLoading&&!signingOut){
      return (
        <RouteLoading
          label="로그인 중…"
          detail="계정 인증을 확인하고 있습니다."
        />
      );
    }
    return <AuthPublicRoutes {...legacyLoginProps} />;
  }

  // 프로필 확정·클라우드 준비 전에는 가입완료 화면으로 보내지 않음 (새로고침 시 /signup 깜빡임 방지)
  const waitCloudBootstrap = isSupabaseConfigured
    && !!user?.id
    && user.id !== 'dev-local'
    && (sessionCloudSyncStatus === 'idle' || sessionCloudSyncStatus === 'syncing')
    && (() => {
      try { return sessionStorage.getItem(`landnote.sessionCloudReady.${user.id}`) !== '1'; }
      catch { return true; }
    })();
  const bootstrapping = authLoading
    || profilePending
    || (user?.id && user.id !== 'dev-local' && profileLoading)
    || (waitCloudBootstrap && !cloudWaitTimedOut);
  if(bootstrapping){
    return (
      <RouteLoading
        label="로그인 중…"
        detail="계정과 데이터를 준비하고 있습니다."
      />
    );
  }

  if(user&&needsSignupCompletion){
    if (location.pathname === AUTH_PATHS.signupInvite) {
      return <InviteSignUpPage {...legacyLoginProps} />;
    }
    if (location.pathname === AUTH_PATHS.signup) {
      return <LoginScreen variant="signup" {...legacyLoginProps} />;
    }
    return <Navigate to={AUTH_PATHS.signup} replace />;
  }

  const appRoutes=(
    <RouteErrorBoundary key={menuId}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path={AUTH_PATHS.login} element={<AuthPathRedirect />} />
        <Route path={AUTH_PATHS.signup} element={<AuthPathRedirect />} />
        <Route path={AUTH_PATHS.signupInvite} element={<AuthPathRedirect />} />
        <Route path="/dashboard" element={<Dashboard onOpen={openWin} onNav={navTo} onNavWithTab={(tab)=>navigate(`/properties?tab=${tab}`)} onNotify={showNotification}/>} />
        <Route path="/properties" element={<PropList onOpen={openWin} onNav={navTo} folders={folders} propFolders={propFolders} setPropFolders={setPropFolders} onDeleteProperty={(p,after)=>softDelete('props',p,propDisplayAddr(p)||p.bldg,after||(()=>{}))}/>} />
        <Route path="/properties/:id/edit" element={<PropEditRoute softDelete={softDelete} onOpen={openWin}/>} />
        <Route path="/properties/:id" element={<PropDetailRedirect onOpen={openWin}/>} />
        <Route path="/mapview" element={<MapView onOpen={openWin} onNav={navTo} Btn={Btn} PH={PH}/>} />
        <Route path="/register/bulk" element={<PropertyBulkUploadPage onNav={navTo}/>} />
        <Route path="/register" element={<PropRegister key={registerFormKey} onNav={navTo}/>} />
        <Route path="/customers/bulk" element={<CustomerBulkUploadPage onNav={navTo}/>} />
        <Route path="/customers" element={<CustList onOpen={openWin} onNav={navTo}/>} />
        <Route path="/calls" element={<CallLogs onOpen={openWin} onDelete={(item)=>softDelete('calls',item,item.content?.slice(0,20)||'통화기록',()=>{})}/>} />
        <Route path="/calendar" element={<Calendar onOpen={openWin}/>} />
        <Route path="/backup" element={<Backup/>} />
        <Route path="/trash" element={<Trash/>} />
        <Route path="/team/manage" element={<TeamManageRoute/>} />
        <Route path="/settings/withdraw" element={<WithdrawAccountPage/>} />
        <Route path="*" element={<FallbackAppPath />} />
      </Routes>
    </RouteErrorBoundary>
  );

  /* 모바일 조회 전용 라우트 — PC 전용 등록/일괄등록/백업/휴지통/멤버관리는 제외 */
  const mobileRoutes=(
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path={AUTH_PATHS.login} element={<AuthPathRedirect />} />
        <Route path={AUTH_PATHS.signup} element={<AuthPathRedirect />} />
        <Route path={AUTH_PATHS.signupInvite} element={<AuthPathRedirect />} />
        <Route path="/dashboard" element={<MobileDashboard/>} />
        <Route path="/properties" element={<MobilePropertyList/>} />
        <Route path="/properties/:id" element={<MobilePropertyDetail/>} />
        <Route path="/mapview" element={<MobileMapView/>} />
        <Route path="/customers" element={<MobileCustomerList/>} />
        <Route path="/customers/:id" element={<MobileCustomerDetail/>} />
        <Route path="/calls" element={<MobileCallList/>} />
        <Route path="/calls/:id" element={<MobileCallDetail/>} />
        <Route path="/calendar" element={<MobileCalendar/>} />
        <Route path="/calendar/:id" element={<MobileScheduleDetail/>} />
        <Route path="*" element={<FallbackAppPath />} />
      </Routes>
    </RouteErrorBoundary>
  );

  const overlays=(
    <>
      {globalConfirm&&<ConfirmDialog msg={globalConfirm.msg} subMsg={globalConfirm.subMsg} confirmLabel={globalConfirm.confirmLabel} danger={globalConfirm.danger||false} onConfirm={globalConfirm.onConfirm} onCancel={()=>setGlobalConfirm(null)}/>}
      {showSet&&<Settings onClose={()=>setShowSet(false)} onSignOut={handleSignOut}/>}
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
              onEdit={(p)=>{ close(); rememberPropListTab(new URLSearchParams(window.location.search).get('tab')); navigate(`/properties/${p.id}/edit`); }}
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
      <DealModeAppFrame style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <MobileShell menuId={menuId}
          onSettings={()=>setShowSet(true)} onViewDesktop={viewDesktop}>
          <MobileSyncGate background={C.bg}>
            {mobileRoutes}
          </MobileSyncGate>
        </MobileShell>
        {showSet&&<Settings onClose={()=>setShowSet(false)} onSignOut={handleSignOut}/>}
        <ToastPopup toast={toast} onClose={dismissToast}/>
      </DealModeAppFrame>
    );
  }

  return(
    <DealModeAppFrame style={{width:'100%',height:'100%'}}>
      <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:'inherit',background:C.sidebar}}>
        <TitleBar onSignOut={handleSignOut} onHome={()=>navTo('dashboard')}/>
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
    </DealModeAppFrame>
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
  const locked=isLockedCallLog(callData);
  const canManageCalls=canManageCallLogs(companyRole);
  const canEdit=!locked&&(isNew||(canManageCalls&&canWriteRecord(callData,user?.id,companyRole,memberPermissions,'call_logs')));
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
    try{
      if(isNew){
        await saveCallLog(payload);
        showNotification('저장하였습니다.','success');
      }else{
        await saveCallLog(payload, callData.id);
        showNotification('수정되었습니다.','info');
      }
    }catch(err){
      if(err?.message==='LOCKED_CALL_LOG'){
        showNotification(LOCKED_CALL_LOG_MSG,'warning');
        return;
      }
      throw err;
    }
    if(onSaved) onSaved({...callData,...payload});
    onClose();
  };

  return(
    <Win title={locked?'변경기록':(isNew?'통화 기록 등록':'통화 기록 수정')} ic={isNew?'ti-phone-plus':'ti-phone-edit'} onClose={onClose} w={760}
      ch={<>
        <div style={{...WIN_BODY_SCROLL,padding:'20px 24px',display:'flex',flexDirection:'column',gap:14,pointerEvents:locked?'none':undefined}}
          onClick={()=>{setPropOpen(false);setCustOpen(false);}}>
          {locked&&(
            <div style={{padding:'10px 12px',background:C.surf2,border:`1px solid ${C.bdr}`,borderRadius:8,fontSize:13,color:C.txM}}>
              {LOCKED_CALL_LOG_MSG}
            </div>
          )}

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
          onSave={locked?null:handleSave}
          saveDisabled={!canEdit}
          saveDisabledTitle={locked?LOCKED_CALL_LOG_MSG:PERMISSION_DENIED_TOOLTIP}
          onDelete={!locked&&!isNew&&onDelete?()=>onDelete(callData):null}
          deleteDisabled={!canEdit}
          deleteDisabledTitle={locked?LOCKED_CALL_LOG_MSG:PERMISSION_DENIED_TOOLTIP}
          onCancel={onClose}/>
      </>}/>
  );
};


