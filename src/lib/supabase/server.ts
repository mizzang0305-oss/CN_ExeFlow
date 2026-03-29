import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerConfig as readSupabaseServerConfig } from "./config";

export function createSupabaseServerClient() {
  const { serviceRoleKey, url } = readSupabaseServerConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function getSupabaseServerRuntimeConfig() {
  const { anonKey, serviceRoleKey, url } = readSupabaseServerConfig();

  return {
    anonKey,
    isReady: true,
    serviceRoleKey,
    url,
  };
}
