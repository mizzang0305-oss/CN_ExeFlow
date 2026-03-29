import { ApiError } from "@/lib/errors";

function readEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ApiError(500, `Missing environment variable: ${name}`);
  }

  return value;
}

export function getSupabasePublicConfig() {
  return {
    anonKey: readEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    url: readEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
  };
}

export function getSupabaseServerConfig() {
  return {
    ...getSupabasePublicConfig(),
    serviceRoleKey: readEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function isSupabasePublicConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function isSupabaseServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
