import { NextResponse } from "next/server";

import { getPasswordResetRedirectTo } from "@/features/auth";

export const runtime = "nodejs";

const FORWARDED_PARAMS = [
  "code",
  "token_hash",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

const RESET_PASSWORD_PATH = "/reset-password";

export function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const resetUrl = new URL(getPasswordResetRedirectTo());
  resetUrl.pathname = RESET_PASSWORD_PATH;

  for (const key of FORWARDED_PARAMS) {
    const value = requestUrl.searchParams.get(key);

    if (value) {
      resetUrl.searchParams.set(key, value);
    }
  }

  if (requestUrl.searchParams.get("error_code") === "otp_expired") {
    resetUrl.searchParams.set("error", requestUrl.searchParams.get("error") ?? "access_denied");
    resetUrl.searchParams.set("error_code", "otp_expired");
  }

  return NextResponse.redirect(resetUrl);
}
