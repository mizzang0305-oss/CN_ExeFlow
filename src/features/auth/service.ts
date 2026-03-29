import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { trackAuthActivity } from "@/features/activity/service";
import { runBackgroundTask } from "@/lib/background-task";
import { ApiError } from "@/lib/errors";
import { readRequestClientContext } from "@/lib/request-context";
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
  ActivateAccountInput,
  ActivationLookupData,
  AppSession,
  AuthLoginResult,
  AuthLookupResult,
  AuthenticatedUserProfile,
  LoginRequestInput,
  PasswordResetRequestInput,
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

type SessionCookiePayload = {
  authUserId: string;
  email: string | null;
  expiresAt: string;
  issuedAt: string;
  rememberMe: boolean;
  userId: string;
};

function buildDisplayName(user: Pick<UserRow, "name" | "profile_name">) {
  const profileName = user.profile_name?.trim();
  return profileName && profileName.length > 0 ? profileName : user.name;
}

function encodeSessionCookie(payload: SessionCookiePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSessionCookie(rawValue: string | undefined) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(rawValue, "base64url").toString("utf8")) as Partial<SessionCookiePayload>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.authUserId !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }

    return {
      authUserId: parsed.authUserId,
      email: typeof parsed.email === "string" ? parsed.email : null,
      expiresAt: parsed.expiresAt,
      issuedAt: parsed.issuedAt,
      rememberMe: parsed.rememberMe === true,
      userId: parsed.userId,
    } satisfies SessionCookiePayload;
  } catch {
    return null;
  }
}

async function setAppSessionCookie(payload: SessionCookiePayload) {
  const cookieStore = await cookies();

  cookieStore.set(APP_SESSION_COOKIE, encodeSessionCookie(payload), {
    httpOnly: true,
    maxAge: payload.rememberMe
      ? APP_SESSION_MAX_AGE_REMEMBER_SECONDS
      : APP_SESSION_MAX_AGE_DEFAULT_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function deleteAppSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
}

async function getDepartmentRecord(departmentId: string | null) {
  if (!departmentId) {
    return null;
  }

  const client = createSupabaseServerClient();
  const departmentQuery = await client
    .from("departments")
    .select("id, code, name")
    .eq("id", departmentId)
    .maybeSingle<DepartmentRow>();

  if (departmentQuery.error) {
    throw new ApiError(500, "부서 정보를 확인하지 못했습니다.", departmentQuery.error, "SESSION_DEPARTMENT_LOAD_FAILED");
  }

  return departmentQuery.data ?? null;
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

function buildAuthenticatedProfile(user: UserRow, department: DepartmentRow | null): AuthenticatedUserProfile {
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

async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("users")
    .select("id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at")
    .ilike("email", normalizedEmail);

  if (error) {
    throw new ApiError(500, "사용자 정보를 확인하지 못했습니다.", error, "AUTH_USER_EMAIL_LOOKUP_FAILED");
  }

  const users = (data ?? []) as UserRow[];

  if (users.length > 1) {
    throw new ApiError(
      409,
      "같은 이메일이 여러 사용자에 연결되어 있습니다. 관리자에게 문의해주세요.",
      null,
      "AUTH_USER_EMAIL_DUPLICATED",
    );
  }

  return users[0] ?? null;
}

async function findUserByAuthUserId(authUserId: string) {
  const client = createSupabaseServerClient();
  const userQuery = await client
    .from("users")
    .select("id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .maybeSingle<UserRow>();

  if (userQuery.error) {
    throw new ApiError(500, "인증 사용자 정보를 확인하지 못했습니다.", userQuery.error, "AUTH_USER_LOOKUP_FAILED");
  }

  return userQuery.data ?? null;
}

async function updateUserLoginTimestamps(userId: string) {
  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("users")
    .update({
      last_active_at: now,
      last_login_at: now,
    })
    .eq("id", userId);

  if (error) {
    throw new ApiError(500, "로그인 시각을 저장하지 못했습니다.", error, "AUTH_LOGIN_TIMESTAMP_UPDATE_FAILED");
  }

  return now;
}

async function authenticateWithSupabase(email: string, password: string) {
  const client = createSupabaseAuthServerClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    throw new ApiError(401, "이메일 또는 비밀번호를 확인해주세요.", error, "AUTH_LOGIN_FAILED");
  }

  return data.user;
}

async function createAuthUser(email: string, password: string) {
  const client = createSupabaseServerClient();
  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (error || !data.user) {
    throw new ApiError(500, "최초 사용자 활성화를 완료하지 못했습니다.", error, "AUTH_ACCOUNT_CREATE_FAILED");
  }

  return data.user;
}

async function linkAuthUserToPublicUser(userId: string, authUserId: string) {
  const client = createSupabaseServerClient();
  const { error } = await client
    .from("users")
    .update({
      auth_user_id: authUserId,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new ApiError(500, "조직 사용자와 인증 계정을 연결하지 못했습니다.", error, "AUTH_USER_LINK_FAILED");
  }
}

async function buildLoginResult(user: UserRow, rememberMe: boolean): Promise<AuthLoginResult> {
  if (!user.auth_user_id) {
    throw new ApiError(500, "인증 계정 연결 정보가 없습니다.", null, "AUTH_SESSION_LINK_MISSING");
  }

  const department = await getDepartmentRecord(user.department_id);
  const session = buildSession(user, department);
  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() +
      (rememberMe ? APP_SESSION_MAX_AGE_REMEMBER_SECONDS : APP_SESSION_MAX_AGE_DEFAULT_SECONDS) * 1000,
  );

  await setAppSessionCookie({
    authUserId: user.auth_user_id,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    rememberMe,
    userId: user.id,
  });

  return {
    redirectTo: getDefaultAppRoute(user.role),
    rememberMe,
    session,
  };
}

async function readRequestContextFromHeaders() {
  const headerStore = await headers();
  return readRequestClientContext(new Headers(headerStore));
}

export async function lookupUserForActivation(email: string): Promise<ActivationLookupData> {
  const user = await findUserByEmail(email);

  if (!user || !user.is_active) {
    return {
      canActivate: false,
      profile: null,
    };
  }

  const department = await getDepartmentRecord(user.department_id);

  return {
    canActivate: !user.auth_user_id,
    profile: buildAuthenticatedProfile(user, department),
  };
}

export async function loginWithEmail(input: LoginRequestInput): Promise<AuthLoginResult> {
  const email = input.email.trim().toLowerCase();
  const requestContext = await readRequestContextFromHeaders();

  try {
    const authUser = await authenticateWithSupabase(email, input.password);
    const publicUser = await findUserByAuthUserId(authUser.id);

    if (!publicUser || !publicUser.is_active) {
      throw new ApiError(403, "사용자 정보 또는 권한을 확인해주세요.", null, "AUTH_PUBLIC_USER_NOT_FOUND");
    }

    await updateUserLoginTimestamps(publicUser.id);
    const result = await buildLoginResult(publicUser, input.rememberMe);

    runBackgroundTask("auth-login-success", () =>
      trackAuthActivity({
        email,
        eventResult: "SUCCESS",
        eventType: "LOGIN_SUCCESS",
        requestContext,
        userId: publicUser.id,
      }),
    );

    return result;
  } catch (error) {
    const publicUser = await findUserByEmail(email).catch(() => null);

    runBackgroundTask("auth-login-failed", () =>
      trackAuthActivity({
        email,
        eventResult: "FAILED",
        eventType: "LOGIN_FAILED",
        requestContext,
        userId: publicUser?.id ?? null,
      }),
    );

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "이메일 또는 비밀번호를 확인해주세요.", null, "AUTH_LOGIN_FAILED");
  }
}

export async function activateUserWithEmail(input: ActivateAccountInput): Promise<AuthLoginResult> {
  const email = input.email.trim().toLowerCase();
  const lookup = await lookupUserForActivation(email);

  if (!lookup.profile) {
    throw new ApiError(404, "등록된 조직 사용자를 찾을 수 없습니다.", null, "AUTH_ACTIVATION_USER_NOT_FOUND");
  }

  if (!lookup.canActivate) {
    throw new ApiError(
      409,
      "이미 활성화된 사용자입니다. 로그인 또는 비밀번호 재설정을 이용해주세요.",
      null,
      "AUTH_ACTIVATION_ALREADY_DONE",
    );
  }

  const authUser = await createAuthUser(email, input.password);
  await linkAuthUserToPublicUser(lookup.profile.userId, authUser.id);

  return loginWithEmail({
    email,
    password: input.password,
    rememberMe: input.rememberMe,
  });
}

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  const email = input.email.trim().toLowerCase();
  const publicUser = await findUserByEmail(email);

  if (!publicUser?.auth_user_id || !publicUser.is_active) {
    return { requested: true };
  }

  const client = createSupabaseAuthServerClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: input.redirectTo,
  });

  if (error) {
    throw new ApiError(500, "비밀번호 재설정 메일을 전송하지 못했습니다.", error, "AUTH_PASSWORD_RESET_FAILED");
  }

  return { requested: true };
}

export async function clearAppSession() {
  await deleteAppSessionCookie();
}

export async function getCurrentSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(APP_SESSION_COOKIE)?.value;
  const payload = decodeSessionCookie(rawValue);

  if (!payload) {
    return null;
  }

  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    await deleteAppSessionCookie();
    const requestContext = await readRequestContextFromHeaders();

    runBackgroundTask("auth-session-expired", () =>
      trackAuthActivity({
        email: payload.email,
        eventResult: "EXPIRED",
        eventType: "SESSION_EXPIRED",
        requestContext,
        userId: payload.userId,
      }),
    );

    return null;
  }

  const user = await findUserByAuthUserId(payload.authUserId);

  if (!user || user.id !== payload.userId) {
    await deleteAppSessionCookie();
    return null;
  }

  const department = await getDepartmentRecord(user.department_id);
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
    throw new ApiError(403, "부서 정보가 없는 계정입니다.", null, "SESSION_DEPARTMENT_REQUIRED");
  }

  return session;
}

export async function getAuthLookupResult(email: string): Promise<AuthLookupResult> {
  const lookup = await lookupUserForActivation(email);

  return {
    found: Boolean(lookup.profile),
    user: lookup.profile,
  };
}
