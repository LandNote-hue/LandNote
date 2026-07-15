/**
 * 공공데이터포털 API 엔드포인트 (국토교통부 / 국가공간정보포털)
 * @see https://www.data.go.kr — 활용신청 후 서비스 URL·인증키 발급
 * @see 건축물대장 열람 https://www.kras.go.kr/mainView.do
 * @see 토지이용·종합증명 https://www.eum.go.kr/web/am/amMain.jsp
 */

/** 국토교통부 건축HUB 건축물대장정보 서비스 */
export const BUILDING_LEDGER = {
  /** 표제부 (개별 건축물) */
  TITLE: '/1613000/BldRgstHubService/getBrTitleInfo',
  /** 총괄표제부 (다동·단지) */
  RECAP: '/1613000/BldRgstHubService/getBrRecapTitleInfo',
  /** 전유부 (집합건물 층·호) */
  EXPOS: '/1613000/BldRgstHubService/getBrExposInfo',
  /** 지역지구구역 (용도지역·지구·구역) */
  JIJIGU: '/1613000/BldRgstHubService/getBrJijiguInfo',
};

/** 국가공간정보포털 — 토지대장·이용계획 (서비스명은 활용신청 버전에 따라 조정) */
export const LAND_LEDGER = {
  /** 토지이용계획 */
  LAND_USE: '/1611000/nsdi/LandUseService/attr/getLandUseAttr',
  /** 토지대장(토지특성) */
  LAND_CHAR: '/1611000/nsdi/IndvdLandPriceService/attr/getIndvdLandPriceAttr',
};

/** 대체·구버전 서비스 경로 (마이그레이션 시 참고) */
export const LEGACY = {
  BUILDING_TITLE: '/1613000/ArchPmsHubService/getArchPmsHub',
};
