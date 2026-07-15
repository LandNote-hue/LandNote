/** @param {Record<string, unknown>|null|undefined} profile */
export function isRegistrationComplete(profile) {
  if (!profile) return false;
  return profile.terms_required_agreed === true && !!profile.company_id;
}

/** @param {import('@supabase/supabase-js').User|null|undefined} user */
export function isOAuthUser(user) {
  if (!user) return false;
  if (user.app_metadata?.provider === 'google') return true;
  return user.identities?.some?.((i) => i.provider === 'google') ?? false;
}

/** @param {import('@supabase/supabase-js').User|null|undefined} user */
export function displayNameFromUser(user) {
  const meta = user?.user_metadata ?? {};
  return meta.full_name || meta.name || meta.display_name || user?.email?.split('@')[0] || '';
}
