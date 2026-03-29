import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig, isSupabasePublicConfigured } from "./config";

export function createSupabaseBrowserClient() {
  const { anonKey, url } = getSupabasePublicConfig();

  return createClient(url, anonKey);
}

export function getSupabaseBrowserConfig() {
  return {
    ...getSupabasePublicConfig(),
    isReady: isSupabasePublicConfigured(),
  };
}
