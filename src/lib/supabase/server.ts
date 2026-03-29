import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerConfig as readSupabaseServerConfig } from "./config";

function createSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export function createSupabaseServerClient() {
  const { serviceRoleKey, url } = readSupabaseServerConfig();

  return createSupabaseClient(url, serviceRoleKey);
}

export function createSupabaseAuthServerClient() {
  const { anonKey, url } = readSupabaseServerConfig();

  return createSupabaseClient(url, anonKey);
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
