import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import { APP_SESSION_COOKIE } from "./constants";
import type {
  AppSession,
  LoginBootstrapData,
  LoginDepartmentOption,
  LoginUserOption,
  LoginUsersData,
  SessionCreateResult,
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
  head_user_id: string | null;
  id: string;
  is_active: boolean;
  name: string;
  sort_order: number | null;
};

type UserRow = {
  department_id: string | null;
  email: string | null;
  id: string;
  is_active: boolean;
  name: string;
  profile_name: string | null;
  role: UserRole;
  title: string | null;
};

function buildDisplayName(user: Pick<UserRow, "name" | "profile_name">) {
  const profileName = user.profile_name?.trim();
  return profileName && profileName.length > 0 ? profileName : user.name;
}

function mapLoginUser(user: UserRow, departmentName: string | null): LoginUserOption {
  return {
    departmentId: user.department_id,
    departmentName,
    displayName: buildDisplayName(user),
    id: user.id,
    name: user.name,
    profileName: user.profile_name,
    role: user.role,
    title: user.title,
  };
}

async function listActiveUsers() {
  const client = createSupabaseServerClient();
  const usersQuery = await client
    .from("users")
    .select("id, name, profile_name, role, department_id, title, email, is_active")
    .eq("is_active", true)
    .order("profile_name", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (usersQuery.error) {
    throw new ApiError(
      500,
      "활성 사용자 목록을 불러오지 못했습니다.",
      usersQuery.error,
      "LOGIN_USERS_LOAD_FAILED",
    );
  }

  return (usersQuery.data ?? []) as UserRow[];
}

async function listActiveDepartmentsRaw() {
  const client = createSupabaseServerClient();
  const departmentsQuery = await client
    .from("departments")
    .select("id, code, name, head_user_id, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (departmentsQuery.error) {
    throw new ApiError(
      500,
      "활성 부서 목록을 불러오지 못했습니다.",
      departmentsQuery.error,
      "LOGIN_DEPARTMENTS_LOAD_FAILED",
    );
  }

  return (departmentsQuery.data ?? []) as DepartmentRow[];
}

function mapDepartmentOption(
  department: DepartmentRow,
  userCount: number,
  headUserName: string | null,
): LoginDepartmentOption {
  return {
    code: department.code,
    headUserId: department.head_user_id,
    headUserName,
    id: department.id,
    name: department.name,
    userCount,
  };
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
    .maybeSingle<{ code: string; id: string; name: string }>();

  if (departmentQuery.error) {
    throw new ApiError(
      500,
      "부서 정보를 확인하지 못했습니다.",
      departmentQuery.error,
      "SESSION_DEPARTMENT_LOAD_FAILED",
    );
  }

  return departmentQuery.data ?? null;
}

function buildSession(
  user: UserRow,
  department: { code: string; name: string } | null,
): AppSession {
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

export async function listLoginBootstrapData(): Promise<LoginBootstrapData> {
  const [departments, users] = await Promise.all([
    listActiveDepartmentsRaw(),
    listActiveUsers(),
  ]);
  const usersByDepartment = new Map<string, number>();
  const usersById = new Map(users.map((user) => [user.id, user]));

  for (const user of users) {
    if (!user.department_id) {
      continue;
    }

    usersByDepartment.set(
      user.department_id,
      (usersByDepartment.get(user.department_id) ?? 0) + 1,
    );
  }

  return {
    departments: departments.map((department) =>
      mapDepartmentOption(
        department,
        usersByDepartment.get(department.id) ?? 0,
        department.head_user_id
          ? buildDisplayName(usersById.get(department.head_user_id) ?? { name: "", profile_name: null })
          : null,
      ),
    ),
  };
}

export async function listUsersForDepartment(
  departmentId: string,
): Promise<LoginUsersData> {
  const [departments, users] = await Promise.all([
    listActiveDepartmentsRaw(),
    listActiveUsers(),
  ]);
  const department = departments.find((item) => item.id === departmentId) ?? null;

  if (!department) {
    throw new ApiError(
      404,
      "선택한 부서를 찾을 수 없습니다.",
      null,
      "LOGIN_DEPARTMENT_NOT_FOUND",
    );
  }

  return {
    department: mapDepartmentOption(
      department,
      users.filter((user) => user.department_id === departmentId).length,
      null,
    ),
    users: users
      .filter((user) => user.department_id === departmentId)
      .map((user) => mapLoginUser(user, department.name)),
  };
}

export async function createSessionFromUserSelection(input: {
  departmentId: string;
  userId: string;
}): Promise<SessionCreateResult> {
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("users")
    .select("id, name, profile_name, role, department_id, title, email, is_active")
    .eq("id", input.userId)
    .eq("is_active", true)
    .maybeSingle<UserRow>();

  if (error) {
    throw new ApiError(
      500,
      "로그인 대상 사용자를 확인하지 못했습니다.",
      error,
      "SESSION_USER_LOOKUP_FAILED",
    );
  }

  if (!data) {
    throw new ApiError(
      404,
      "선택한 사용자를 찾을 수 없습니다.",
      null,
      "SESSION_USER_NOT_FOUND",
    );
  }

  if (data.department_id !== input.departmentId) {
    throw new ApiError(
      400,
      "선택한 부서와 사용자가 일치하지 않습니다.",
      null,
      "SESSION_DEPARTMENT_MISMATCH",
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, data.id, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax",
  });

  const department = await getDepartmentRecord(data.department_id);
  const session = buildSession(data, department);

  return {
    redirectTo: getDefaultAppRoute(data.role),
    session,
  };
}

export async function clearAppSession() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
}

export async function getCurrentSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!userId) {
    return null;
  }

  const client = createSupabaseServerClient();
  const userQuery = await client
    .from("users")
    .select("id, name, profile_name, role, department_id, title, email, is_active")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle<UserRow>();

  if (userQuery.error) {
    throw new ApiError(
      500,
      "현재 사용자 정보를 확인하지 못했습니다.",
      userQuery.error,
      "SESSION_LOAD_FAILED",
    );
  }

  if (!userQuery.data) {
    return null;
  }

  const department = await getDepartmentRecord(userQuery.data.department_id);
  return buildSession(userQuery.data, department);
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
