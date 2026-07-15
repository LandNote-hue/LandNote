import { supabase } from '../lib/supabase.js';

import { normalizeCompanyRole } from '../data/companyRoles.js';

/** @param {string} userId */
export async function fetchUserCompany(userId) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, role, user_type')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.company_id) {
    const solo = profile?.user_type === 'SOLO' || profile?.role === 'SOLO';
    return { company: null, role: solo ? normalizeCompanyRole('SOLO') : null };
  }

  const [companyRes, memberRes] = await Promise.all([
    supabase.from('companies').select('id, name, slug, representative_id, created_at').eq('id', profile.company_id).maybeSingle(),
    supabase.from('company_members').select('role').eq('company_id', profile.company_id).eq('user_id', userId).maybeSingle(),
  ]);

  if (companyRes.error) console.error('[fetchUserCompany] companies', companyRes.error);
  if (memberRes.error) console.error('[fetchUserCompany] company_members', memberRes.error);

  const rawRole = memberRes.data?.role ?? profile.role ?? null;
  const role = rawRole ? normalizeCompanyRole(rawRole) : null;
  return { company: companyRes.data ?? null, role };
}

/** company_id 없는 레거시 계정 보정 */
export async function ensureUserCompany(companyName = null) {
  const { data, error } = await supabase.rpc('ensure_my_company', {
    p_company_name: companyName || null,
  });
  if (error) throw error;
  return data;
}
