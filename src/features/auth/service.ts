import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { trackAuthActivity, trackUserActivity } from "@/features/activity/service";
import { runBackgroundTask } from "@/lib/background-task";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
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
  ActivateAccountResult,
  AppSession,
  AuthLoginResult,
  AuthLookupResult,
  AuthenticatedUserProfile,
  InitialSetupLookupData,
  InitialSetupLookupInput,
  LoginBootstrapData,
  LoginDepartmentOption,
  LoginRequestInput,
  LoginUserOption,
  LoginUsersData,
  PasswordResetRequestInput,
  RegisterCompanyEmailInput,
  RegisterCompanyEmailResult,
  UserRole,
} from "./types";
import {
  COMPANY_EMAIL_DOMAIN,
  canViewDepartmentBoard,
  canViewDashboard,
  canViewStaffHome,
  canViewViewerHome,
  getDefaultAppRoute,
  hasCompanyEmail,
  isAdminRole,
  isExecutiveRole,
  normalizeEmailAddress,
} from "./utils";

type DepartmentRow = {
  code: string;
  head_user_id: string | null;
  id: string;
  is_active?: boolean;
  name: string;
  sort_order?: number | null;
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
  updated_at?: string | null;
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
    .select("id, code, name, head_user_id")
    .eq("id", departmentId)
    .maybeSingle<DepartmentRow>();

  if (departmentQuery.error) {
    throw new ApiError(500, "부서 정보를 불러오지 못했습니다.", departmentQuery.error, "SESSION_DEPARTMENT_LOAD_FAILED");
  }

  return departmentQuery.data ?? null;
}

function buildSession(user: UserRow, department: DepartmentRow | null): AppSession {
  return {
    departmentCode: department?.code ?? null,
    departmentId: user.department_id,
    departmentName: department?.name ?? null,
    displayName: buildDisplayName(user),
    email: normalizeEmailAddress(user.email),
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
    email: normalizeEmailAddress(user.email),
    hasCompanyEmail: hasCompanyEmail(user.email),
    isActivated: Boolean(user.auth_user_id),
    name: user.name,
    profileName: user.profile_name,
    role: user.role,
    title: user.title,
    userId: user.id,
  };
}

async function readRequestContextFromHeaders() {
  const headerStore = await headers();
  return readRequestClientContext(new Headers(headerStore));
}

function buildAuthUserErrorMessage(error: unknown, fallbackMessage: string, code: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("already") && (message.includes("registered") || message.includes("exists"))) {
    return new ApiError(409, "이미 사용 중인 이메일입니다.", error, code);
  }

  return new ApiError(500, fallbackMessage, error, code);
}

async function findUsersByNormalizedEmail(normalizedEmail: string, excludeUserId?: string) {
  const client = createSupabaseServerClient();
  const domain = normalizedEmail.slice(normalizedEmail.indexOf("@"));
  let query = client
    .from("users")
    .select(
      "id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at, updated_at",
    )
    .not("email", "is", null);

  if (domain) {
    query = query.ilike("email", `%${domain}%`);
  }

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, "이메일 정보를 확인하지 못했습니다.", error, "AUTH_EMAIL_LOOKUP_FAILED");
  }

  return ((data ?? []) as UserRow[]).filter((user) => normalizeEmailAddress(user.email) === normalizedEmail);
}

async function findUserByNormalizedEmail(normalizedEmail: string) {
  const users = await findUsersByNormalizedEmail(normalizedEmail);

  if (users.length > 1) {
    throw new ApiError(
      409,
      "이미 사용 중인 이메일입니다.",
      null,
      "AUTH_USER_EMAIL_DUPLICATED",
    );
  }

  return users[0] ?? null;
}

async function findUserById(userId: string) {
  const client = createSupabaseServerClient();
  const userQuery = await client
    .from("users")
    .select(
      "id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at, updated_at",
    )
    .eq("id", userId)
    .maybeSingle<UserRow>();

  if (userQuery.error) {
    throw new ApiError(500, "사용자 정보를 확인하지 못했습니다.", userQuery.error, "AUTH_USER_LOOKUP_FAILED");
  }

  return userQuery.data ?? null;
}

async function findUserByDepartmentAndName(input: InitialSetupLookupInput) {
  const client = createSupabaseServerClient();
  let query = client
    .from("users")
    .select(
      "id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at, updated_at",
    )
    .eq("department_id", input.departmentId)
    .eq("name", input.name.trim())
    .eq("is_active", true);

  if (input.userId) {
    query = query.eq("id", input.userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, "선택한 부서와 이름을 확인하지 못했습니다.", error, "AUTH_SETUP_USER_LOOKUP_FAILED");
  }

  const users = (data ?? []) as UserRow[];

  if (users.length === 0) {
    return null;
  }

  if (users.length > 1) {
    throw new ApiError(
      409,
      "같은 부서에 동일한 이름의 사용자가 여러 명 있습니다. 관리자에게 문의해주세요.",
      null,
      "AUTH_SETUP_USER_DUPLICATED",
    );
  }

  return users[0];
}

async function findUserByAuthUserId(authUserId: string) {
  const client = createSupabaseServerClient();
  const userQuery = await client
    .from("users")
    .select(
      "id, name, profile_name, role, department_id, title, email, is_active, auth_user_id, last_login_at, last_active_at, updated_at",
    )
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

async function ensureCompanyEmailAvailable(normalizedEmail: string, excludeUserId?: string) {
  const matches = await findUsersByNormalizedEmail(normalizedEmail, excludeUserId);

  if (matches.length > 0) {
    throw new ApiError(409, "이미 사용 중인 이메일입니다.", null, "AUTH_EMAIL_DUPLICATED");
  }
}

async function upsertAuthUser(user: UserRow, email: string, password: string) {
  const client = createSupabaseServerClient();

  if (user.auth_user_id) {
    const updateQuery = await client.auth.admin.updateUserById(user.auth_user_id, {
      email,
      email_confirm: true,
      password,
    });

    if (!updateQuery.error && updateQuery.data.user) {
      return updateQuery.data.user;
    }

    const shouldRecover =
      updateQuery.error instanceof Error &&
      updateQuery.error.message.toLowerCase().includes("not found");

    if (!shouldRecover) {
      throw buildAuthUserErrorMessage(
        updateQuery.error,
        "비밀번호 설정을 완료하지 못했습니다.",
        "AUTH_USER_UPDATE_FAILED",
      );
    }
  }

  const createQuery = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (createQuery.error || !createQuery.data.user) {
    throw buildAuthUserErrorMessage(
      createQuery.error,
      "비밀번호 설정을 완료하지 못했습니다.",
      "AUTH_ACCOUNT_CREATE_FAILED",
    );
  }

  return createQuery.data.user;
}

async function linkAuthUserToPublicUser(userId: string, authUserId: string) {
  const client = createSupabaseServerClient();
  const { error } = await client
    .from("users")
    .update({
      auth_user_id: authUserId,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new ApiError(500, "인증 계정 연결을 저장하지 못했습니다.", error, "AUTH_USER_LINK_FAILED");
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
    email: session.email,
    expiresAt: expiresAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    rememberMe,
    userId: user.id,
  });

  return {
    message: "로그인되었습니다.",
    redirectTo: getDefaultAppRoute(user.role),
    rememberMe,
    session,
  };
}

async function loadSetupRows() {
  const client = createSupabaseServerClient();
  const [departmentsQuery, usersQuery] = await Promise.all([
    client
      .from("departments")
      .select("id, code, name, head_user_id, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    client
      .from("users")
      .select("id, name, profile_name, role, department_id, title, is_active")
      .eq("is_active", true)
      .not("department_id", "is", null)
      .order("name", { ascending: true })
      .order("profile_name", { ascending: true, nullsFirst: false }),
  ]);

  if (departmentsQuery.error) {
    throw new ApiError(
      500,
      "최초 사용자 설정용 부서 목록을 불러오지 못했습니다.",
      departmentsQuery.error,
      "AUTH_SETUP_DEPARTMENTS_LOAD_FAILED",
    );
  }

  if (usersQuery.error) {
    throw new ApiError(
      500,
      "최초 사용자 설정용 사용자 목록을 불러오지 못했습니다.",
      usersQuery.error,
      "AUTH_SETUP_USERS_LOAD_FAILED",
    );
  }

  return {
    departments: (departmentsQuery.data ?? []) as DepartmentRow[],
    users: (usersQuery.data ?? []) as Array<
      Pick<UserRow, "department_id" | "id" | "name" | "profile_name" | "role" | "title">
    >,
  };
}

export async function getInitialSetupBootstrapData(): Promise<LoginBootstrapData> {
  const { departments, users } = await loadSetupRows();
  const activeDepartmentMap = new Map(departments.map((department) => [department.id, department]));
  const usersInActiveDepartments = users.filter(
    (user) => user.department_id && activeDepartmentMap.has(user.department_id),
  );
  const usersByDepartment = new Map<string, typeof usersInActiveDepartments>();
  const userNameById = new Map(
    usersInActiveDepartments.map((user) => [user.id, user.profile_name?.trim() || user.name]),
  );

  for (const user of usersInActiveDepartments) {
    const bucket = usersByDepartment.get(user.department_id as string) ?? [];
    bucket.push(user);
    usersByDepartment.set(user.department_id as string, bucket);
  }

  const departmentOptions = departments
    .filter((department) => (usersByDepartment.get(department.id)?.length ?? 0) > 0)
    .map<LoginDepartmentOption>((department) => ({
      code: department.code,
      headUserId: department.head_user_id,
      headUserName: department.head_user_id ? userNameById.get(department.head_user_id) ?? null : null,
      id: department.id,
      name: department.name,
      userCount: usersByDepartment.get(department.id)?.length ?? 0,
    }));

  const userOptions = usersInActiveDepartments.map<LoginUserOption>((user) => ({
    departmentId: user.department_id,
    departmentName: user.department_id ? activeDepartmentMap.get(user.department_id)?.name ?? null : null,
    displayName: user.profile_name?.trim() || user.name,
    id: user.id,
    name: user.name,
    profileName: user.profile_name,
    role: user.role,
    title: user.title,
  }));

  return {
    departments: departmentOptions,
    users: userOptions,
  };
}

export async function getInitialSetupUsersByDepartment(departmentId: string): Promise<LoginUsersData> {
  const bootstrapData = await getInitialSetupBootstrapData();
  const department = bootstrapData.departments.find((item) => item.id === departmentId) ?? null;

  return {
    department,
    users: bootstrapData.users.filter((user) => user.departmentId === departmentId),
  };
}

export async function lookupUserForInitialSetup(
  input: InitialSetupLookupInput,
): Promise<InitialSetupLookupData> {
  const user = await findUserByDepartmentAndName(input);

  if (!user || !user.is_active) {
    throw new ApiError(
      404,
      "선택한 부서와 이름에 해당하는 사용자를 찾을 수 없습니다.",
      null,
      "AUTH_SETUP_USER_NOT_FOUND",
    );
  }

  const department = await getDepartmentRecord(user.department_id);

  return {
    canRegisterCompanyEmail: !hasCompanyEmail(user.email),
    existingEmail: normalizeEmailAddress(user.email),
    profile: buildAuthenticatedProfile(user, department),
  };
}

export async function registerCompanyEmail(
  input: RegisterCompanyEmailInput,
): Promise<RegisterCompanyEmailResult> {
  const normalizedEmail = normalizeEmailAddress(input.email);

  if (!normalizedEmail || !normalizedEmail.endsWith(COMPANY_EMAIL_DOMAIN)) {
    throw new ApiError(400, "회사 이메일만 등록할 수 있습니다.", null, "AUTH_COMPANY_EMAIL_REQUIRED");
  }

  const client = createSupabaseServerClient();
  const user = await findUserById(input.userId);

  if (!user || !user.is_active) {
    throw new ApiError(
      404,
      "선택한 부서와 이름에 해당하는 사용자를 찾을 수 없습니다.",
      null,
      "AUTH_SETUP_USER_NOT_FOUND",
    );
  }

  if (hasCompanyEmail(user.email)) {
    throw new ApiError(
      409,
      "이미 회사 이메일이 등록된 사용자입니다. 이메일 로그인 또는 비밀번호 재설정을 이용해주세요.",
      null,
      "AUTH_COMPANY_EMAIL_ALREADY_REGISTERED",
    );
  }

  await ensureCompanyEmailAvailable(normalizedEmail, user.id);

  const beforeEmail = normalizeEmailAddress(user.email);
  const updateQuery = await client
    .from("users")
    .update({
      email: normalizedEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id")
    .single<{ id: string }>();

  if (updateQuery.error) {
    throw new ApiError(500, "회사 이메일을 저장하지 못했습니다.", updateQuery.error, "AUTH_EMAIL_REGISTER_FAILED");
  }

  await recordHistory(client, {
    action: beforeEmail ? "USER_EMAIL_UPDATED" : "USER_EMAIL_REGISTERED",
    actorId: user.id,
    afterData: { email: normalizedEmail },
    beforeData: { email: beforeEmail },
    entityId: user.id,
    entityType: "user",
    metadata: {
      registeredBy: "self-service",
      type: "company-email",
    },
  });

  return {
    email: normalizedEmail,
    message: "이메일이 등록되었습니다. 비밀번호를 설정해주세요.",
  };
}

export async function activateUserWithEmail(input: ActivateAccountInput): Promise<ActivateAccountResult> {
  const user = await findUserById(input.userId);

  if (!user || !user.is_active) {
    throw new ApiError(
      404,
      "선택한 부서와 이름에 해당하는 사용자를 찾을 수 없습니다.",
      null,
      "AUTH_SETUP_USER_NOT_FOUND",
    );
  }

  if (input.password !== input.passwordConfirm) {
    throw new ApiError(400, "비밀번호 확인이 일치하지 않습니다.", null, "AUTH_PASSWORD_CONFIRM_MISMATCH");
  }

  const email = normalizeEmailAddress(user.email);

  if (!email || !hasCompanyEmail(email)) {
    throw new ApiError(400, "회사 이메일을 먼저 등록해주세요.", null, "AUTH_COMPANY_EMAIL_NOT_REGISTERED");
  }

  await ensureCompanyEmailAvailable(email, user.id);

  const authUser = await upsertAuthUser(user, email, input.password);
  await linkAuthUserToPublicUser(user.id, authUser.id);

  return {
    completed: true,
    email,
    message: "비밀번호 설정이 완료되었습니다. 이메일로 로그인해주세요.",
    redirectTo: `/login?setup=completed&email=${encodeURIComponent(email)}`,
  };
}

export async function loginWithEmail(input: LoginRequestInput): Promise<AuthLoginResult> {
  const email = normalizeEmailAddress(input.email);
  const requestContext = await readRequestContextFromHeaders();

  if (!email) {
    throw new ApiError(401, "이메일 또는 비밀번호를 확인해주세요.", null, "AUTH_LOGIN_FAILED");
  }

  try {
    const authUser = await authenticateWithSupabase(email, input.password);
    const publicUser = await findUserByAuthUserId(authUser.id);

    if (!publicUser || !publicUser.is_active || !hasCompanyEmail(publicUser.email)) {
      throw new ApiError(401, "이메일 또는 비밀번호를 확인해주세요.", null, "AUTH_PUBLIC_USER_NOT_FOUND");
    }

    await updateUserLoginTimestamps(publicUser.id);
    const refreshedUser = (await findUserById(publicUser.id)) ?? publicUser;
    const result = await buildLoginResult(refreshedUser, input.rememberMe);

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
    const publicUser = await findUserByNormalizedEmail(email).catch(() => null);

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
      throw new ApiError(401, "이메일 또는 비밀번호를 확인해주세요.", error.details, "AUTH_LOGIN_FAILED");
    }

    throw new ApiError(401, "이메일 또는 비밀번호를 확인해주세요.", null, "AUTH_LOGIN_FAILED");
  }
}

export async function requestPasswordReset(input: PasswordResetRequestInput) {
  const email = normalizeEmailAddress(input.email);

  if (!email) {
    return { requested: true };
  }

  const publicUser = await findUserByNormalizedEmail(email);

  if (!publicUser?.auth_user_id || !publicUser.is_active || !hasCompanyEmail(publicUser.email)) {
    return { requested: true };
  }

  const client = createSupabaseAuthServerClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: input.redirectTo,
  });

  if (error) {
    throw new ApiError(500, "비밀번호 재설정 메일을 보내지 못했습니다.", error, "AUTH_PASSWORD_RESET_FAILED");
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

  if (!user || user.id !== payload.userId || !hasCompanyEmail(user.email)) {
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

function auditUnauthorizedDashboardAccess(
  session: AppSession,
  attemptedPath: string,
  requiredRoles: UserRole[],
  accessType: "API" | "PAGE",
) {
  runBackgroundTask("dashboard-access-denied", () =>
    trackUserActivity({
      activityType: accessType === "API" ? "UNAUTHORIZED_API_ACCESS" : "UNAUTHORIZED_ROUTE_ACCESS",
      metadata: {
        accessType,
        attemptedPath,
        requiredRoles: requiredRoles.join(","),
        role: session.role,
      },
      pagePath: attemptedPath,
      session,
      targetType: "dashboard",
    }),
  );
}

function redirectUnauthorizedRoleHome(
  session: AppSession,
  attemptedPath: string,
  requiredRoles: UserRole[],
) {
  auditUnauthorizedDashboardAccess(session, attemptedPath, requiredRoles, "PAGE");
  redirect(getDefaultAppRoute(session.role));
}

export async function requireDashboardSession(attemptedPath = "/dashboard/ceo") {
  const session = await requireCurrentSession();

  if (!canViewDashboard(session.role)) {
    redirectUnauthorizedRoleHome(session, attemptedPath, ["CEO", "SUPER_ADMIN"]);
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

export async function requireDepartmentHeadSession(attemptedPath = "/board") {
  const session = await requireCurrentSession();

  if (!session.departmentId || !canViewDepartmentBoard(session.role)) {
    redirectUnauthorizedRoleHome(session, attemptedPath, ["DEPARTMENT_HEAD"]);
  }

  return session;
}

export async function requireStaffSession(attemptedPath = "/workspace") {
  const session = await requireCurrentSession();

  if (!canViewStaffHome(session.role)) {
    redirectUnauthorizedRoleHome(session, attemptedPath, ["STAFF"]);
  }

  return session;
}

export async function requireViewerSession(attemptedPath = "/viewer") {
  const session = await requireCurrentSession();

  if (!canViewViewerHome(session.role)) {
    redirectUnauthorizedRoleHome(session, attemptedPath, ["VIEWER"]);
  }

  return session;
}

export function auditUnauthorizedDashboardApiAccess(
  session: AppSession,
  attemptedPath: string,
  requiredRoles: UserRole[],
) {
  auditUnauthorizedDashboardAccess(session, attemptedPath, requiredRoles, "API");
}

export async function requireDepartmentSession() {
  const session = await requireCurrentSession();

  if (!session.departmentId) {
    throw new ApiError(403, "부서 정보가 없는 계정입니다.", null, "SESSION_DEPARTMENT_REQUIRED");
  }

  return session;
}

export async function getAuthLookupResult(input: InitialSetupLookupInput): Promise<AuthLookupResult> {
  const lookup = await lookupUserForInitialSetup(input);

  return {
    found: Boolean(lookup.profile),
    user: lookup.profile,
  };
}
