import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let clientOverride = null;

/** @param {import('@supabase/supabase-js').SupabaseClient | null} client */
export function setSyncClientForTests(client) {
  clientOverride = client;
}

export function getSyncClient() {
  return clientOverride || supabase;
}

export function isSyncConfigured() {
  return clientOverride != null || isSupabaseConfigured;
}
