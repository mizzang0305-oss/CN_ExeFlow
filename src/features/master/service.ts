import "server-only";

import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";

import type { UserRole } from "@/features/auth/types";
import type {
  DepartmentUpsertInput,
  MasterDepartmentItem,
  MasterLookupData,
  MasterUserItem,
  UserUpsertInput,
} from "./types";

type DepartmentRow = {
  code: string;
  head_user_id: string | null;
  id: string;
  is_active: boolean;
  name: string;
  sort_order: number | null;
  updated_at: string | null;
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
  updated_at: string | null;
};

function buildDisplayName(user: Pick<UserRow, "name" | "profile_name">) {
  const profileName = user.profile_name?.trim();
  return profileName && profileName.length > 0 ? profileName : user.name;
}

async function loadMasterRows() {
  const client = createSupabaseServerClient();
  const [departmentsQuery, usersQuery] = await Promise.all([
    client
      .from("departments")
      .select("id, code, name, head_user_id, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    client
      .from("users")
      .select("id, name, profile_name, email, title, role, department_id, is_active, updated_at")
      .order("profile_name", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
  ]);

  if (departmentsQuery.error) {
    throw new ApiError(
      500,
      "부서 기준정보를 불러오지 못했습니다.",
      departmentsQuery.error,
      "MASTER_DEPARTMENTS_LOAD_FAILED",
    );
  }

  if (usersQuery.error) {
    throw new ApiError(
      500,
      "사용자 기준정보를 불러오지 못했습니다.",
      usersQuery.error,
      "MASTER_USERS_LOAD_FAILED",
    );
  }

  return {
    departments: (departmentsQuery.data ?? []) as DepartmentRow[],
    users: (usersQuery.data ?? []) as UserRow[],
  };
}

export async function listMasterLookupData(): Promise<MasterLookupData> {
  const { departments, users } = await loadMasterRows();
  const departmentMap = new Map(departments.map((department) => [department.id, department]));
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
    departments: departments.map<MasterDepartmentItem>((department) => ({
      activeUserCount: usersByDepartment.get(department.id) ?? 0,
      code: department.code,
      headUserId: department.head_user_id,
      headUserName: department.head_user_id
        ? buildDisplayName(usersById.get(department.head_user_id) ?? { name: "", profile_name: null })
        : null,
      id: department.id,
      isActive: department.is_active,
      name: department.name,
      sortOrder: department.sort_order ?? 0,
      updatedAt: department.updated_at,
    })),
    users: users.map<MasterUserItem>((user) => ({
      departmentId: user.department_id,
      departmentName: user.department_id ? departmentMap.get(user.department_id)?.name ?? null : null,
      displayName: buildDisplayName(user),
      email: user.email,
      id: user.id,
      isActive: user.is_active,
      name: user.name,
      profileName: user.profile_name,
      role: user.role,
      title: user.title,
      updatedAt: user.updated_at,
    })),
  };
}

export async function createDepartment(input: DepartmentUpsertInput, actorId: string) {
  const client = createSupabaseServerClient();
  const departmentId = crypto.randomUUID();
  const insertQuery = await client
    .from("departments")
    .insert({
      code: input.code,
      head_user_id: input.headUserId,
      id: departmentId,
      is_active: input.isActive,
      name: input.name,
      sort_order: input.sortOrder,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertQuery.error) {
    throw new ApiError(
      500,
      "부서를 생성하지 못했습니다.",
      insertQuery.error,
      "MASTER_DEPARTMENT_CREATE_FAILED",
    );
  }

  await recordHistory(client, {
    action: "DEPARTMENT_CREATED",
    actorId,
    afterData: input,
    entityId: departmentId,
    entityType: "department",
  });

  return insertQuery.data;
}

export async function updateDepartment(
  departmentId: string,
  input: DepartmentUpsertInput,
  actorId: string,
) {
  const client = createSupabaseServerClient();
  const existingDepartment = await client
    .from("departments")
    .select("code, head_user_id, is_active, name, sort_order")
    .eq("id", departmentId)
    .maybeSingle();

  if (existingDepartment.error) {
    throw new ApiError(
      500,
      "기존 부서 정보를 불러오지 못했습니다.",
      existingDepartment.error,
      "MASTER_DEPARTMENT_BEFORE_LOAD_FAILED",
    );
  }

  const updateQuery = await client
    .from("departments")
    .update({
      code: input.code,
      head_user_id: input.headUserId,
      is_active: input.isActive,
      name: input.name,
      sort_order: input.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", departmentId)
    .select("id")
    .single<{ id: string }>();

  if (updateQuery.error) {
    throw new ApiError(
      500,
      "부서를 수정하지 못했습니다.",
      updateQuery.error,
      "MASTER_DEPARTMENT_UPDATE_FAILED",
    );
  }

  await recordHistory(client, {
    action: "DEPARTMENT_UPDATED",
    actorId,
    afterData: input,
    beforeData: existingDepartment.data,
    entityId: departmentId,
    entityType: "department",
  });

  return updateQuery.data;
}

export async function createUser(input: UserUpsertInput, actorId: string) {
  const client = createSupabaseServerClient();
  const userId = crypto.randomUUID();
  const insertQuery = await client
    .from("users")
    .insert({
      department_id: input.departmentId,
      email: input.email,
      id: userId,
      is_active: input.isActive,
      name: input.name,
      profile_name: input.profileName,
      role: input.role,
      title: input.title,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertQuery.error) {
    throw new ApiError(
      500,
      "사용자를 생성하지 못했습니다.",
      insertQuery.error,
      "MASTER_USER_CREATE_FAILED",
    );
  }

  await recordHistory(client, {
    action: "USER_CREATED",
    actorId,
    afterData: input,
    entityId: userId,
    entityType: "user",
  });

  return insertQuery.data;
}

export async function updateUser(userId: string, input: UserUpsertInput, actorId: string) {
  const client = createSupabaseServerClient();
  const existingUser = await client
    .from("users")
    .select("department_id, email, is_active, name, profile_name, role, title")
    .eq("id", userId)
    .maybeSingle();

  if (existingUser.error) {
    throw new ApiError(
      500,
      "기존 사용자 정보를 불러오지 못했습니다.",
      existingUser.error,
      "MASTER_USER_BEFORE_LOAD_FAILED",
    );
  }

  const updateQuery = await client
    .from("users")
    .update({
      department_id: input.departmentId,
      email: input.email,
      is_active: input.isActive,
      name: input.name,
      profile_name: input.profileName,
      role: input.role,
      title: input.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .single<{ id: string }>();

  if (updateQuery.error) {
    throw new ApiError(
      500,
      "사용자 정보를 수정하지 못했습니다.",
      updateQuery.error,
      "MASTER_USER_UPDATE_FAILED",
    );
  }

  await recordHistory(client, {
    action: "USER_UPDATED",
    actorId,
    afterData: input,
    beforeData: existingUser.data,
    entityId: userId,
    entityType: "user",
  });

  return updateQuery.data;
}
