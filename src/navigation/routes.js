/** @type {Record<string, string>} */
export const MENU_PATHS = {
  dashboard: '/dashboard',
  properties: '/properties',
  mapview: '/mapview',
  register: '/register',
  registerBulk: '/register/bulk',
  customers: '/customers',
  customersBulk: '/customers/bulk',
  calls: '/calls',
  calendar: '/calendar',
  backup: '/backup',
  trash: '/trash',
  team: '/team/manage',
};

/** @param {string} pathname */
export function pathToMenuId(pathname) {
  if (pathname.startsWith('/properties')) return 'properties';
  if (pathname.startsWith('/team')) return 'team';
  const entry = Object.entries(MENU_PATHS).find(([, path]) => pathname === path || pathname.startsWith(`${path}/`));
  return entry?.[0] ?? 'dashboard';
}

import { propDisplayAddr } from '../utils/propAddress.js';

/** @param {string} pathname @param {Record<string, string>} params @param {{ id: number, addr?: string, bldg?: string }[]} properties */
export function resolveTitle(pathname, params, properties) {
  const labels = {
    '/dashboard': '대시보드',
    '/properties': '매물 관리',
    '/mapview': '지도 보기',
    '/register': '매물 등록',
    '/register/bulk': '매물 일괄 등록',
    '/customers': '고객 관리',
    '/customers/bulk': '고객 일괄 등록',
    '/calls': '통화 내역',
    '/calendar': '일정 관리',
    '/backup': '백업·복원',
    '/trash': '휴지통',
    '/team/manage': '멤버 관리',
    '/settings/withdraw': '회원탈퇴',
  };

  const editMatch = pathname.match(/^\/properties\/(\d+)\/edit$/);
  if (editMatch) {
    const prop = properties.find(p => p.id === Number(editMatch[1]));
    return prop ? `매물 수정 — ${propDisplayAddr(prop)}` : '매물 수정';
  }

  const detailMatch = pathname.match(/^\/properties\/(\d+)$/);
  if (detailMatch) {
    const prop = properties.find(p => p.id === Number(detailMatch[1]));
    return prop ? `매물 상세 — ${propDisplayAddr(prop)}` : '매물 상세';
  }

  return labels[pathname] ?? 'LandNote';
}
