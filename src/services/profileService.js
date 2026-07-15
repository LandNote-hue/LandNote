import { supabase } from '../lib/supabase.js';
import { formatPhone } from '../utils/formatPhone.js';
import { isRegistrationComplete } from '../utils/registrationStatus.js';
import { ensureUserCompany, fetchUserCompany } from './companyService.js';
import { acceptTeamInvite, transferTeamInvite, mapInviteError } from './teamService.js';

export { isRegistrationComplete } from '../utils/registrationStatus.js';

const PENDING_INVITE_KEY = 'landnote.pendingInvite';

/** @param {import('@supabase/supabase-js').User} user */
function hasCeoSignupIntent(user) {
  const meta = user.user_metadata ?? {};
  const userType = String(meta.user_type || '').toUpperCase();
  const companyName = meta.company_name || meta.agency_name;
  return userType === 'BUSINESS' && !!companyName;
}

const META_KEYS = ['title', 'phone', 'tel', 'agency_phone', 'address', 'website'];

/** @param {import('@supabase/supabase-js').User|null|undefined} user */
/** @param {Record<string, unknown>|null|undefined} profile */
/** @param {{ name?: string }|null|undefined} company */
export function accountDefaultsFromProfile(user, profile, company = null) {
  const meta = user?.user_metadata ?? {};
  const displayName = profile?.display_name
    || meta.full_name
    || meta.name
    || user?.email?.split('@')[0]
    || '';

  return {
    displayName,
    title: meta.title || '',
    phone: formatPhone(meta.phone) || '',
    tel: formatPhone(meta.tel) || '',
    email: user?.email || '',
    agencyName: company?.name || profile?.agency_name || meta.agency_name || '',
    agencyPhone: formatPhone(meta.agency_phone) || '',
    address: meta.address || '',
    website: meta.website || '',
  };
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** 로그인 사용자 프로필 로드 (OAuth 미완료 가입은 워크스페이스 자동 생성하지 않음) */
export async function loadUserProfile(user) {
  if (!user?.id) return null;

  let profile = await fetchProfile(user.id);
  if (!profile) {
    await new Promise((r) => setTimeout(r, 400));
    profile = await fetchProfile(user.id);
  }
  if (!profile || !isRegistrationComplete(profile)) {
    return profile;
  }

  if (!profile.company_id) {
    const companyName = metaCompanyName(user);
    const ceoIntent = hasCeoSignupIntent(user);
    const pendingInvite = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(PENDING_INVITE_KEY)
      : null;

    // 회사명·BUSINESS(CEO 개설) 의도가 있으면 초대 토큰보다 회사 생성을 우선
    if (companyName || ceoIntent) {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      const nameForCompany = companyName || user.user_metadata?.company_name || user.user_metadata?.agency_name;
      if (profile.terms_required_agreed && nameForCompany) {
        try {
          await ensureUserCompany(nameForCompany);
          profile = await fetchProfile(user.id);
        } catch (err) {
          console.error('[profile] ensure company', err);
        }
      }
    } else if (pendingInvite) {
      try {
        if (profile.company_id) {
          await transferTeamInvite(pendingInvite);
        } else {
          await acceptTeamInvite(pendingInvite);
        }
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        profile = await fetchProfile(user.id);
      } catch (err) {
        const mapped = mapInviteError(err);
        console.error('[profile] accept invite', mapped);
      }
    }
  } else if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  }

  return profile;
}

/** @deprecated loadUserProfile 사용 */
export async function ensureProfile(user) {
  return loadUserProfile(user);
}

/** @param {import('@supabase/supabase-js').User} user */
function metaCompanyName(user) {
  const meta = user.user_metadata ?? {};
  return meta.company_name || meta.agency_name || null;
}

/**
 * profiles 테이블: display_name, agency_name (001 스키마)
 * user_metadata: title, phone, tel, agency_phone, address, website
 */
export async function updateProfileRow(userId, patch) {
  const profilePatch = {};
  const metaPatch = {};

  if ('display_name' in patch) profilePatch.display_name = patch.display_name;
  if ('agency_name' in patch) profilePatch.agency_name = patch.agency_name;
  for (const key of META_KEYS) {
    if (key in patch) metaPatch[key] = patch[key];
  }

  let profile = null;
  let error = null;

  if (Object.keys(profilePatch).length > 0) {
    const res = await supabase
      .from('profiles')
      .update({ ...profilePatch, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    profile = res.data;
    error = res.error;
  } else {
    profile = await fetchProfile(userId);
  }

  let user = null;
  if (!error && Object.keys(metaPatch).length > 0) {
    const res = await supabase.auth.updateUser({ data: metaPatch });
    error = res.error;
    user = res.data?.user ?? null;
  }

  return { data: profile, user, error };
}
