import { supabase } from '../lib/supabase.js';
import { extractSupabaseErrorMessage } from '../utils/supabaseError.js';

/** @param {unknown} err */
export function mapOAuthRegistrationError(err) {
  return extractSupabaseErrorMessage(err);
}

/**
 * @param {{
 *   consent: Record<string, unknown>,
 *   userType?: string,
 *   displayName?: string,
 *   companyName?: string,
 *   inviteToken?: string,
 * }} opts
 */
export async function completeOAuthRegistrationRpc({
  consent,
  userType = 'SOLO',
  displayName = '',
  companyName = '',
  inviteToken = '',
}) {
  const { data, error } = await supabase.rpc('complete_oauth_registration', {
    p_terms_version: consent.terms_version,
    p_terms_required_agreed: consent.terms_required_agreed,
    p_marketing_agreed: consent.marketing_agreed ?? false,
    p_terms_agreed_at: consent.terms_agreed_at,
    p_terms_items: consent.terms_items ?? [],
    p_user_type: userType,
    p_display_name: displayName || null,
    p_company_name: companyName || null,
    p_invite_token: inviteToken || null,
  });
  if (error) throw error;
  return data;
}

export async function abandonIncompleteRegistrationRpc() {
  const { error } = await supabase.rpc('abandon_incomplete_registration');
  if (error) throw error;
}
