import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  trackAuthActivityAsync,
  touchUserLastActiveAt,
} from "@/features/activity/service";
import { runBackgroundTask } from "@/lib/background-task";
import { readRequestClientContext } from "@/lib/request-context";
import { ApiError } from "@/lib/errors";
import {
  createSupabaseAuthServerClient,
  createSupabaseServerClient,
} from "@/lib/supabase";

import {
  APP_SESSION_COOKIE,
  APP_SESSION_MAX_AGE_DEFAULT_SECONDS,
  APP_SESSION_MAX_AGE_REMEMBER_SECONDS,
} from "./constants";
import type {
  AppSession,
  AuthLoginResult,
  AuthLookupResult,
  AuthenticatedUserProfile,
  UserRole,
} from "./types";
import {
  canViewDashboard,
  getDefaultAppRoute,
  isAdminRole,
  isExecutiveRole,
} from "./utils";

type DepartmentRow = {
  code: string;
  id: string;
  name: string;
};

type UserRow = {
  auth_user_id: string | null;
  department_id: string | null;
  email: string | null;
  id: string;
  is_active: boolean;
  last_active_at: string | null;
  last_login_at: string | null;
  name: string;
  profile_name: string | null;
  role: UserRole;
  title: string | null;
};

type AppSessionCookiePayload = {
  authUserId: string | null;
  expiresAt: string;
  issuedAt: string;
  rememberMe: boolean;
  userId: string;
};

function buildDisplayName(user: Pick<UserRow, "name" | "profile_name">) {
  const profileName = user.profile_name?.trim();
  return profileName && profileName.length > 0 ? profileName : user.name;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function encodeSessionCookie(payload: AppSessionCookiePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSessionCookie(rawValue: string | undefined) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(rawValue, "base64url").toString("utf8")) as Partial<AppSessionCookiePayload>;

    if (!parsed || typeof parsed.userId !== "string" || typeof parsed.expiresAt !== "string") {
      return null;
    }

    return {
      authUserId: typeof parsed.authUserId === "string" ? parsed.authUserId : null,
      expiresAt: parsed.expiresAt,
      issuedAt: typeof parsed.issuedAt === "string" ? parsed.issuedAt : new Date().toISOString(),
      rememberMe: parsed.rememberMe === true,
      userId: parsed.userId,
    } satisfies AppSessionCookiePayload;
  } catch {
    return null;
  }
}

async function readDepartmentRecord(departmentId: string | null) {
  if (!departmentId) {
    return null;
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("departments")
    .select("id, code, name")
    .eq("id", departmentId)
    .maybeSingle<DepartmentRow>();

  if (error) {
    throw new ApiError(
      500,
      "부서 정보를 확인하지 못했습니다.",
      error,
      "SESSION_DEPARTMENT_LOAD_FAILED",
    );
  }

  return data ?? null;
}

function buildSession(user: UserRow, department: DepartmentRow | null): AppSession {
  return {
    departmentCode: department?.code ?? null,
    departmentId: user.department_id,
    departmentName: department?.name ?? null,
    displayName: buildDisplayName(user),
    email: user.email,
    name: user.name,
    profileName: user.profile_name,
    role: user.role,
    title: user.title,
    userId: user.id,
  };
}

function buildAuthenticatedUserProfile(
  user: UserRow,
  department: DepartmentRow | null,
): AuthenticatedUserProfile {
  return {
    authUserId: user.auth_user_id,
    departmentId: user.department_id,
    departmentName: department?.name ?? null,
    displayName: buildDisplayName(user),
    email: user.email,
    isActivated: Boolean(user.auth_user_id),
    name: user.name,
    profileName: user.profile_name,
    role: user.role,
    title: user.title,
    userId: user.id,
  };
}

async function findSingleUserByEmail(email: string) {
  const client = createSupabaseServerClient();
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await client
    .from("users")
    .select(
      "id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at",
    )
    .ilike("email", normalizedEmail);

  if (error) {
    throw new ApiError(
      500,
      "사용자 정보를 확인하지 못했습니다.",
      error,
      "AUTH_USER_LOOKUP_FAILED",
    );
  }

  const users = (data ?? []) as UserRow[];

  if (users.length > 1) {
    throw new ApiError(
      409,
      "동일한 이메일이 여러 사용자에 연결되어 있습니다. 관리자에게 문의해주세요.",
      { email: normalizedEmail },
      "AUTH_USER_DUPLICATED_EMAIL",
    );
  }

  return users[0] ?? null;
}

async function findUserById(userId: string) {
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("users")
    .select(
      "id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at",
    )
    .eq("id", userId)
    .maybeSingle<UserRow>();

  if (error) {
    throw new ApiError(
      500,
      "현재 사용자 정보를 확인하지 못했습니다.",
      error,
      "SESSION_LOAD_FAILED",
    );
  }

  return data ?? null;
}

async function writeAppSessionCookie(user: UserRow, rememberMe: boolean) {
  const cookieStore = await cookies();
  const issuedAt = new Date();
  const maxAge = rememberMe
    ? APP_SESSION_MAX_AGE_REMEMBER_SECONDS
    : APP_SESSION_MAX_AGE_DEFAULT_SECONDS;
  const expiresAt = new Date(issuedAt.getTime() + maxAge * 1000).toISOString();

  cookieStore.set(APP_SESSION_COOKIE, encodeSessionCookie({
    authUserId: user.auth_user_id,
    expiresAt,
    issuedAt: issuedAt.toISOString(),
    rememberMe,
    userId: user.id,
  }), {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function deleteAppSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
}

async function logSessionExpired(user: UserRow | null, email: string | null) {
  try {
    const headerStore = await headers();
    const requestContext = readRequestClientContext(headerStore);

    trackAuthActivityAsync({
      deviceType: requestContext.deviceType,
      email: email ?? user?.email ?? null,
      eventResult: "EXPIRED",
      eventType: "SESSION_EXPIRED",
      ipAddress: requestContext.ipAddress,
      platform: requestContext.platform,
      userAgent: requestContext.userAgent,
      userId: user?.id ?? null,
    });
  } catch {
    trackAuthActivityAsync({
      email: email ?? user?.email ?? null,
      eventResult: "EXPIRED",
      eventType: "SESSION_EXPIRED",
      userId: user?.id ?? null,
    });
  }
}

async function invalidateCurrentSession(user: UserRow | null, email: string | null = null) {
  await deleteAppSessionCookie();
  await logSessionExpired(user, email);
}

async function finalizeLogin(user: UserRow, rememberMe: boolean): Promise<AuthLoginResult> {
  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("users")
    .update({
      last_active_at: now,
      last_login_at: now,
    })
    .eq("id", user.id);

  if (error) {
    throw new ApiError(
      500,
      "로그인 시각을 저장하지 못했습니다.",
      error,
      "AUTH_LAST_LOGIN_UPDATE_FAILED",
    );
  }

  const refreshedUser = {
    ...user,
    last_active_at: now,
    last_login_at: now,
  } satisfies UserRow;
  const department = await readDepartmentRecord(refreshedUser.department_id);
  await writeAppSessionCookie(refreshedUser, rememberMe);

  return {
    redirectTo: getDefaultAppRoute(refreshedUser.role),
    rememberMe,
    session: buildSession(refreshedUser, department),
  };
}

export async function lookupUserByEmailForActivation(email: string): Promise<AuthLookupResult> {
  const user = await findSingleUserByEmail(email);

  if (!user || !user.is_active) {
    return {
      found: false,
      user: null,
    };
  }

  const department = await readDepartmentRecord(user.department_id);

  return {
    found: true,
    user: buildAuthenticatedUserProfile(user, department),
  };
}

export async function activateUserByEmail(
  request: Request,
  input: {
    email: string;
    password: string;
  },
): Promise<AuthLoginResult> {
  const client = createSupabaseServerClient();
  const user = await findSingleUserByEmail(input.email);

  if (!user || !user.is_active) {
    throw new ApiError(
      404,
      "활성화할 사용자를 찾지 못했습니다.",
      null,
      "AUTH_ACTIVATION_USER_NOT_FOUND",
    );
  }

  if (user.auth_user_id) {
    throw new ApiError(
      409,
      "이미 최초 설정이 완료된 사용자입니다. 로그인 또는 비밀번호 재설정을 이용해주세요.",
      null,
      "AUTH_ACTIVATION_ALREADY_LINKED",
    );
  }

  const createResult = await client.auth.admin.createUser({
    email: normalizeEmail(input.email),
    email_confirm: true,
    password: input.password,
    user_metadata: {
      public_user_id: user.id,
      role: user.role,
    },
  });

  if (createResult.error || !createResult.data.user) {
    throw new ApiError(
      500,
      "최초 사용자 설정을 완료하지 못했습니다.",
      createResult.error ?? null,
      "AUTH_ACTIVATION_CREATE_FAILED",
    );
  }

  const updateResult = await client
    .from("users")
    .update({
      auth_user_id: createResult.data.user.id,
    })
    .eq("id", user.id);

  if (updateResult.error) {
    throw new ApiError(
      500,
      "인증 계정을 사용자 정보에 연결하지 못했습니다.",
      updateResult.error,
      "AUTH_ACTIVATION_LINK_FAILED",
    );
  }

  return loginWithEmailAndPassword(request, {
    email: input.email,
    password: input.password,
    rememberMe: true,
  });
}

export async function loginWithEmailAndPassword(
  request: Request,
  input: {
    email: string;
    password: string;
    rememberMe: boolean;
  },
): Promise<AuthLoginResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const publicUser = await findSingleUserByEmail(normalizedEmail);
  const requestContext = readRequestClientContext(request);

  if (!publicUser || !publicUser.is_active || !publicUser.auth_user_id) {
    trackAuthActivityAsync({
      deviceType: requestContext.deviceType,
      email: normalizedEmail,
      eventResult: "FAILED",
      eventType: "LOGIN_FAILED",
      ipAddress: requestContext.ipAddress,
      platform: requestContext.platform,
      userAgent: requestContext.userAgent,
      userId: publicUser?.id ?? null,
    });

    throw new ApiError(
      401,
      "이메일 또는 비밀번호를 확인해주세요.",
      null,
      "AUTH_LOGIN_INVALID",
    );
  }

  const authClient = createSupabaseAuthServerClient();
  const signInResult = await authClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  });

  if (signInResult.error || !signInResult.data.user) {
    trackAuthActivityAsync({
      deviceType: requestContext.deviceType,
      email: normalizedEmail,
      eventResult: "FAILED",
      eventType: "LOGIN_FAILED",
      ipAddress: requestContext.ipAddress,
      platform: requestContext.platform,
      userAgent: requestContext.userAgent,
      userId: publicUser.id,
    });

    throw new ApiError(
      401,
      "이메일 또는 비밀번호를 확인해주세요.",
      null,
      "AUTH_LOGIN_INVALID",
    );
  }

  if (signInResult.data.user.id !== publicUser.auth_user_id) {
    trackAuthActivityAsync({
      deviceType: requestContext.deviceType,
      email: normalizedEmail,
      eventResult: "FAILED",
      eventType: "LOGIN_FAILED",
      ipAddress: requestContext.ipAddress,
      platform: requestContext.platform,
      userAgent: requestContext.userAgent,
      userId: publicUser.id,
    });

    throw new ApiError(
      403,
      "인증 계정 연결 정보가 올바르지 않습니다. 관리자에게 문의해주세요.",
      null,
      "AUTH_LOGIN_LINK_MISMATCH",
    );
  }

  const result = await finalizeLogin(publicUser, input.rememberMe);

  trackAuthActivityAsync({
    deviceType: requestContext.deviceType,
    email: normalizedEmail,
    eventResult: "SUCCESS",
    eventType: "LOGIN_SUCCESS",
    ipAddress: requestContext.ipAddress,
    platform: requestContext.platform,
    userAgent: requestContext.userAgent,
    userId: publicUser.id,
  });

  return result;
}

export async function sendPasswordResetEmail(
  request: Request,
  input: {
    email: string;
  },
) {
  const user = await findSingleUserByEmail(input.email);

  if (!user || !user.is_active || !user.auth_user_id || !user.email) {
    return {
      requested: true,
    };
  }

  const authClient = createSupabaseAuthServerClient();
  const requestUrl = new URL(request.url);
  const resetResult = await authClient.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${requestUrl.origin}/login?mode=recovery`,
  });

  if (resetResult.error) {
    throw new ApiError(
      500,
      "비밀번호 재설정 메일을 보내지 못했습니다.",
      resetResult.error,
      "AUTH_PASSWORD_RESET_FAILED",
    );
  }

  return {
    requested: true,
  };
}

export async function clearAppSession() {
  await deleteAppSessionCookie();
}

export async function getCurrentSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(APP_SESSION_COOKIE)?.value;
  const sessionCookie = decodeSessionCookie(rawCookie);

  if (!sessionCookie) {
    if (rawCookie) {
      await invalidateCurrentSession(null, null);
    }

    return null;
  }

  if (new Date(sessionCookie.expiresAt).getTime() <= Date.now()) {
    const expiredUser = await findUserById(sessionCookie.userId);
    await invalidateCurrentSession(expiredUser, expiredUser?.email ?? null);
    return null;
  }

  const user = await findUserById(sessionCookie.userId);

  if (!user || !user.is_active || !user.auth_user_id) {
    await invalidateCurrentSession(user, user?.email ?? null);
    return null;
  }

  if (sessionCookie.authUserId !== user.auth_user_id) {
    await invalidateCurrentSession(user, user.email ?? null);
    return null;
  }

  const department = await readDepartmentRecord(user.department_id);

  runBackgroundTask("touch-last-active", () =>
    touchUserLastActiveAt({
      lastActiveAt: user.last_active_at,
      userId: user.id,
    }),
  );

  return buildSession(user, department);
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireDashboardSession() {
  const session = await requireCurrentSession();

  if (!canViewDashboard(session.role)) {
    redirect(getDefaultAppRoute(session.role));
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireCurrentSession();

  if (!isAdminRole(session.role)) {
    redirect(getDefaultAppRoute(session.role));
  }

  return session;
}

export async function requireAdminApiSession() {
  const session = await getCurrentSession();

  if (!session || !isAdminRole(session.role)) {
    throw new ApiError(403, "관리자 권한이 필요합니다.", null, "ADMIN_ACCESS_DENIED");
  }

  return session;
}

export async function requireExecutiveSession() {
  const session = await requireCurrentSession();

  if (!isExecutiveRole(session.role)) {
    redirect(getDefaultAppRoute(session.role));
  }

  return session;
}

export async function requireDepartmentSession() {
  const session = await requireCurrentSession();

  if (!session.departmentId) {
    throw new ApiError(
      403,
      "부서 정보가 없는 계정입니다.",
      null,
      "SESSION_DEPARTMENT_REQUIRED",
    );
  }

  return session;
}
