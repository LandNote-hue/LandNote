import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage.js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(url && anonKey);

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: authStorage,
      },
    })
  : null;
