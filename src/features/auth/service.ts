import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import { APP_SESSION_COOKIE } from "./constants";
import type { AppSession, LoginDepartmentOption, LoginUserOption, UserRole } from "./types";
import { getDefaultAppRoute, isExecutiveRole } from "./utils";

type DepartmentRow = {
  code: string;
  id: string;
  name: string;
  sort_order: number;
};

type UserRow = {
  department_id: string | null;
  email: string;
  id: string;
  is_active: boolean;
  name: string;
  position: string | null;
  role: UserRole;
};

function mapLoginUser(row: UserRow): LoginUserOption {
  return {
    departmentId: row.department_id,
    id: row.id,
    name: row.name,
    position: row.position,
    role: row.role,
  };
}

export async function listLoginOptions(): Promise<LoginDepartmentOption[]> {
  const client = createSupabaseServerClient();
  const [departmentsQuery, usersQuery] = await Promise.all([
    client
      .from("departments")
      .select("id, code, name, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    client
      .from("users")
      .select("id, name, role, department_id, position, email, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (departmentsQuery.error) {
    throw new ApiError(500, "부서 목록을 불러오지 못했습니다.", departmentsQuery.error);
  }

  if (usersQuery.error) {
    throw new ApiError(500, "사용자 목록을 불러오지 못했습니다.", usersQuery.error);
  }

  const usersByDepartment = new Map<string, LoginUserOption[]>();

  for (const user of (usersQuery.data ?? []) as UserRow[]) {
    if (!user.department_id) {
      continue;
    }

    const currentUsers = usersByDepartment.get(user.department_id) ?? [];
    currentUsers.push(mapLoginUser(user));
    usersByDepartment.set(user.department_id, currentUsers);
  }

  return ((departmentsQuery.data ?? []) as DepartmentRow[]).map((department) => ({
    code: department.code,
    id: department.id,
    name: department.name,
    users: usersByDepartment.get(department.id) ?? [],
  }));
}

export async function createSessionFromUserSelection(input: {
  departmentId: string;
  userId: string;
}) {
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("users")
    .select("id, name, role, department_id, email, position, is_active")
    .eq("id", input.userId)
    .eq("is_active", true)
    .maybeSingle<UserRow>();

  if (error) {
    throw new ApiError(500, "로그인 정보를 확인하지 못했습니다.", error);
  }

  if (!data) {
    throw new ApiError(404, "선택한 사용자를 찾을 수 없습니다.");
  }

  if (data.department_id !== input.departmentId) {
    throw new ApiError(400, "선택한 부서와 사용자가 일치하지 않습니다.");
  }

  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, data.id, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: "/",
    sameSite: "lax",
  });

  return {
    redirectTo: getDefaultAppRoute(data.role),
    role: data.role,
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
    .select("id, name, role, department_id, email, position, is_active")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle<UserRow>();

  if (userQuery.error) {
    throw new ApiError(500, "현재 사용자 정보를 확인하지 못했습니다.", userQuery.error);
  }

  if (!userQuery.data) {
    return null;
  }

  let departmentCode: string | null = null;
  let departmentName: string | null = null;

  if (userQuery.data.department_id) {
    const departmentQuery = await client
      .from("departments")
      .select("id, code, name")
      .eq("id", userQuery.data.department_id)
      .maybeSingle<{ code: string; id: string; name: string }>();

    if (departmentQuery.error) {
      throw new ApiError(500, "부서 정보를 확인하지 못했습니다.", departmentQuery.error);
    }

    departmentCode = departmentQuery.data?.code ?? null;
    departmentName = departmentQuery.data?.name ?? null;
  }

  return {
    departmentCode,
    departmentId: userQuery.data.department_id,
    departmentName,
    email: userQuery.data.email,
    name: userQuery.data.name,
    position: userQuery.data.position,
    role: userQuery.data.role,
    userId: userQuery.data.id,
  };
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireExecutiveSession() {
  const session = await requireCurrentSession();

  if (!isExecutiveRole(session.role)) {
    redirect("/directives");
  }

  return session;
}
