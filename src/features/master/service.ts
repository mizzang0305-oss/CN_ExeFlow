import "server-only";

import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";

import type { UserRole } from "@/features/auth/types";
import type {
  DepartmentReorderInput,
  DepartmentUpsertInput,
  MasterDepartmentItem,
  MasterLookupData,
  MasterUserItem,
  OrgDepartmentNode,
  OrgTreeData,
  UserMoveInput,
  UserUpsertInput,
} from "./types";

type DepartmentRow = {
  code: string;
  head_user_id: string | null;
  id: string;
  is_active: boolean;
  name: string;
  parent_id: string | null;
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

const nameCollator = new Intl.Collator("ko");

function buildDisplayName(user: Pick<UserRow, "name" | "profile_name">) {
  const profileName = user.profile_name?.trim();
  return profileName && profileName.length > 0 ? profileName : user.name;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function compareDepartments(left: DepartmentRow, right: DepartmentRow) {
  const leftSort = left.sort_order ?? 0;
  const rightSort = right.sort_order ?? 0;

  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }

  return nameCollator.compare(left.name, right.name);
}

function compareUsers(left: UserRow, right: UserRow) {
  if (left.is_active !== right.is_active) {
    return left.is_active ? -1 : 1;
  }

  return nameCollator.compare(buildDisplayName(left), buildDisplayName(right));
}

async function loadMasterRows() {
  const client = createSupabaseServerClient();
  const [departmentsQuery, usersQuery] = await Promise.all([
    client
      .from("departments")
      .select("id, code, name, parent_id, head_user_id, sort_order, is_active, updated_at")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    client
      .from("users")
      .select("id, name, profile_name, email, title, role, department_id, is_active, updated_at")
      .order("is_active", { ascending: false })
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

function buildDepartmentPathInfo(
  departmentId: string,
  departmentMap: Map<string, DepartmentRow>,
  cache: Map<string, { depth: number; fullPath: string }>,
  trail: Set<string> = new Set(),
): { depth: number; fullPath: string } {
  const cached = cache.get(departmentId);

  if (cached) {
    return cached;
  }

  const current = departmentMap.get(departmentId);

  if (!current) {
    const fallback = { depth: 0, fullPath: "" };
    cache.set(departmentId, fallback);
    return fallback;
  }

  if (trail.has(departmentId)) {
    const cyclic = { depth: 0, fullPath: current.name };
    cache.set(departmentId, cyclic);
    return cyclic;
  }

  const nextTrail = new Set(trail);
  nextTrail.add(departmentId);

  const parent =
    current.parent_id && departmentMap.has(current.parent_id) ? departmentMap.get(current.parent_id) ?? null : null;

  if (!parent) {
    const rootInfo = {
      depth: 0,
      fullPath: current.name,
    };
    cache.set(departmentId, rootInfo);
    return rootInfo;
  }

  const parentInfo = buildDepartmentPathInfo(parent.id, departmentMap, cache, nextTrail);
  const info = {
    depth: parentInfo.depth + 1,
    fullPath: `${parentInfo.fullPath} / ${current.name}`,
  };

  cache.set(departmentId, info);
  return info;
}

function buildOrgTreeDataFromRows(departments: DepartmentRow[], users: UserRow[]): OrgTreeData {
  const sortedDepartments = [...departments].sort(compareDepartments);
  const sortedUsers = [...users].sort(compareUsers);
  const departmentMap = new Map(sortedDepartments.map((department) => [department.id, department]));
  const userMap = new Map(sortedUsers.map((user) => [user.id, user]));
  const usersByDepartment = new Map<string, number>();
  const activeUsersByDepartment = new Map<string, number>();
  const childrenByParent = new Map<string | null, DepartmentRow[]>();
  const pathCache = new Map<string, { depth: number; fullPath: string }>();

  for (const user of sortedUsers) {
    if (!user.department_id) {
      continue;
    }

    usersByDepartment.set(user.department_id, (usersByDepartment.get(user.department_id) ?? 0) + 1);

    if (user.is_active) {
      activeUsersByDepartment.set(
        user.department_id,
        (activeUsersByDepartment.get(user.department_id) ?? 0) + 1,
      );
    }
  }

  for (const department of sortedDepartments) {
    const parentId =
      department.parent_id && departmentMap.has(department.parent_id) ? department.parent_id : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(department);
    childrenByParent.set(parentId, siblings);
  }

  const departmentItems = sortedDepartments.map<MasterDepartmentItem>((department) => {
    const pathInfo = buildDepartmentPathInfo(department.id, departmentMap, pathCache);

    return {
      activeUserCount: activeUsersByDepartment.get(department.id) ?? 0,
      childCount: childrenByParent.get(department.id)?.length ?? 0,
      code: department.code,
      depth: pathInfo.depth,
      fullPath: pathInfo.fullPath,
      headUserId: department.head_user_id,
      headUserName: department.head_user_id
        ? buildDisplayName(userMap.get(department.head_user_id) ?? { name: "", profile_name: null })
        : null,
      id: department.id,
      isActive: department.is_active,
      name: department.name,
      parentId: department.parent_id && departmentMap.has(department.parent_id) ? department.parent_id : null,
      sortOrder: department.sort_order ?? 0,
      updatedAt: department.updated_at,
    };
  });

  const departmentItemMap = new Map(departmentItems.map((department) => [department.id, department]));
  const userItems = sortedUsers.map<MasterUserItem>((user) => ({
    departmentCode: user.department_id ? departmentMap.get(user.department_id)?.code ?? null : null,
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
  }));
  const visited = new Set<string>();

  const buildNodes = (parentId: string | null): OrgDepartmentNode[] => {
    const children = [...(childrenByParent.get(parentId) ?? [])].sort(compareDepartments);

    return children
      .filter((department) => !visited.has(department.id))
      .map<OrgDepartmentNode>((department) => {
        visited.add(department.id);
        const item = departmentItemMap.get(department.id);

        if (!item) {
          throw new ApiError(500, "조직도 데이터를 구성하지 못했습니다.", null, "ORG_TREE_BUILD_FAILED");
        }

        return {
          ...item,
          children: buildNodes(department.id),
        };
      });
  };

  const rootNodes = buildNodes(null);
  const orphanNodes = departmentItems
    .filter((department) => !visited.has(department.id))
    .sort((left, right) => {
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }

      return left.sortOrder - right.sortOrder || nameCollator.compare(left.name, right.name);
    })
    .map<OrgDepartmentNode>((department) => {
      visited.add(department.id);

      return {
        ...department,
        children: buildNodes(department.id),
      };
    });

  return {
    departments: departmentItems,
    tree: [...rootNodes, ...orphanNodes],
    users: userItems,
  };
}

async function ensureDepartmentExists(client: ReturnType<typeof createSupabaseServerClient>, departmentId: string) {
  const { data, error } = await client
    .from("departments")
    .select("id, name, parent_id, sort_order")
    .eq("id", departmentId)
    .maybeSingle<{ id: string; name: string; parent_id: string | null; sort_order: number | null }>();

  if (error) {
    throw new ApiError(
      500,
      "부서 정보를 확인하지 못했습니다.",
      error,
      "MASTER_DEPARTMENT_LOOKUP_FAILED",
    );
  }

  if (!data) {
    throw new ApiError(404, "대상 부서를 찾을 수 없습니다.", null, "MASTER_DEPARTMENT_NOT_FOUND");
  }

  return data;
}

async function ensureUserExists(client: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data, error } = await client
    .from("users")
    .select("id, is_active")
    .eq("id", userId)
    .maybeSingle<{ id: string; is_active: boolean }>();

  if (error) {
    throw new ApiError(500, "사용자 정보를 확인하지 못했습니다.", error, "MASTER_USER_LOOKUP_FAILED");
  }

  if (!data) {
    throw new ApiError(404, "대상 사용자를 찾을 수 없습니다.", null, "MASTER_USER_NOT_FOUND");
  }

  return data;
}

async function ensureParentDepartmentAssignable(
  client: ReturnType<typeof createSupabaseServerClient>,
  departmentId: string,
  parentId: string | null,
) {
  if (!parentId) {
    return;
  }

  if (departmentId === parentId) {
    throw new ApiError(400, "부서를 자기 자신 아래로 이동할 수 없습니다.", null, "MASTER_PARENT_SELF_INVALID");
  }

  const { departments } = await loadMasterRows();
  const departmentMap = new Map(departments.map((department) => [department.id, department]));

  if (!departmentMap.has(parentId)) {
    throw new ApiError(404, "상위 부서를 찾을 수 없습니다.", null, "MASTER_PARENT_NOT_FOUND");
  }

  let cursor: string | null = parentId;

  while (cursor) {
    if (cursor === departmentId) {
      throw new ApiError(400, "하위 조직 아래로는 이동할 수 없습니다.", null, "MASTER_PARENT_CYCLE_INVALID");
    }

    cursor = departmentMap.get(cursor)?.parent_id ?? null;
  }
}

async function ensureDepartmentReference(
  client: ReturnType<typeof createSupabaseServerClient>,
  departmentId: string | null,
) {
  if (!departmentId) {
    return;
  }

  await ensureDepartmentExists(client, departmentId);
}

async function ensureUserEmailUnique(
  client: ReturnType<typeof createSupabaseServerClient>,
  email: string,
  excludeUserId?: string,
) {
  let query = client.from("users").select("id").ilike("email", normalizeEmail(email));

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new ApiError(500, "이메일 중복 여부를 확인하지 못했습니다.", error, "MASTER_USER_EMAIL_CHECK_FAILED");
  }

  if ((data ?? []).length > 0) {
    throw new ApiError(409, "이미 사용 중인 이메일입니다.", null, "MASTER_USER_EMAIL_DUPLICATED");
  }
}

async function getNextSortOrder(
  client: ReturnType<typeof createSupabaseServerClient>,
  parentId: string | null,
  excludeDepartmentId?: string,
) {
  let query = client
    .from("departments")
    .select("sort_order")
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1);

  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);

  if (excludeDepartmentId) {
    query = query.neq("id", excludeDepartmentId);
  }

  const { data, error } = await query.maybeSingle<{ sort_order: number | null }>();

  if (error) {
    throw new ApiError(500, "정렬 순서를 계산하지 못했습니다.", error, "MASTER_SORT_ORDER_FAILED");
  }

  return (data?.sort_order ?? 0) + 1;
}

export async function listOrgTreeData(): Promise<OrgTreeData> {
  const { departments, users } = await loadMasterRows();
  return buildOrgTreeDataFromRows(departments, users);
}

export async function listMasterLookupData(): Promise<MasterLookupData> {
  const data = await listOrgTreeData();

  return {
    departments: data.departments,
    users: data.users,
  };
}

export async function createDepartment(input: DepartmentUpsertInput, actorId: string) {
  const client = createSupabaseServerClient();
  const departmentId = crypto.randomUUID();

  if (input.parentId) {
    await ensureDepartmentExists(client, input.parentId);
  }

  if (input.headUserId) {
    const headUser = await ensureUserExists(client, input.headUserId);

    if (!headUser.is_active) {
      throw new ApiError(400, "비활성 사용자는 부서장으로 지정할 수 없습니다.", null, "MASTER_HEAD_USER_INACTIVE");
    }
  }

  const insertQuery = await client
    .from("departments")
    .insert({
      code: input.code,
      head_user_id: input.headUserId,
      id: departmentId,
      is_active: input.isActive,
      name: input.name,
      parent_id: input.parentId,
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
    metadata: {
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    },
  });

  return insertQuery.data;
}

export async function updateDepartment(
  departmentId: string,
  input: DepartmentUpsertInput,
  actorId: string,
) {
  const client = createSupabaseServerClient();

  if (input.parentId) {
    await ensureParentDepartmentAssignable(client, departmentId, input.parentId);
  }

  if (input.headUserId) {
    const headUser = await ensureUserExists(client, input.headUserId);

    if (!headUser.is_active) {
      throw new ApiError(400, "비활성 사용자는 부서장으로 지정할 수 없습니다.", null, "MASTER_HEAD_USER_INACTIVE");
    }
  }

  const existingDepartment = await client
    .from("departments")
    .select("code, head_user_id, is_active, name, parent_id, sort_order")
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

  if (!existingDepartment.data) {
    throw new ApiError(404, "수정할 부서를 찾을 수 없습니다.", null, "MASTER_DEPARTMENT_NOT_FOUND");
  }

  const updateQuery = await client
    .from("departments")
    .update({
      code: input.code,
      head_user_id: input.headUserId,
      is_active: input.isActive,
      name: input.name,
      parent_id: input.parentId,
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
    metadata: {
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    },
  });

  return updateQuery.data;
}

export async function moveDepartment(input: DepartmentReorderInput, actorId: string) {
  const client = createSupabaseServerClient();
  const department = await ensureDepartmentExists(client, input.departmentId);

  await ensureParentDepartmentAssignable(client, input.departmentId, input.parentId);

  const nextSortOrder =
    department.parent_id === input.parentId
      ? department.sort_order ?? 0
      : await getNextSortOrder(client, input.parentId, input.departmentId);

  const updateQuery = await client
    .from("departments")
    .update({
      parent_id: input.parentId,
      sort_order: nextSortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.departmentId)
    .select("id")
    .single<{ id: string }>();

  if (updateQuery.error) {
    throw new ApiError(
      500,
      "부서 위치를 변경하지 못했습니다.",
      updateQuery.error,
      "MASTER_DEPARTMENT_MOVE_FAILED",
    );
  }

  await recordHistory(client, {
    action: "DEPARTMENT_MOVED",
    actorId,
    afterData: {
      parentId: input.parentId,
      sortOrder: nextSortOrder,
    },
    beforeData: {
      parentId: department.parent_id,
      sortOrder: department.sort_order,
    },
    entityId: input.departmentId,
    entityType: "department",
    metadata: {
      fromParentId: department.parent_id,
      toParentId: input.parentId,
    },
  });

  return updateQuery.data;
}

export async function createUser(input: UserUpsertInput, actorId: string) {
  const client = createSupabaseServerClient();
  const userId = crypto.randomUUID();

  await ensureDepartmentReference(client, input.departmentId);
  await ensureUserEmailUnique(client, input.email);

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
    metadata: {
      departmentId: input.departmentId,
      isActive: input.isActive,
    },
  });

  return insertQuery.data;
}

export async function updateUser(userId: string, input: UserUpsertInput, actorId: string) {
  const client = createSupabaseServerClient();

  await ensureDepartmentReference(client, input.departmentId);
  await ensureUserEmailUnique(client, input.email, userId);

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

  if (!existingUser.data) {
    throw new ApiError(404, "수정할 사용자를 찾을 수 없습니다.", null, "MASTER_USER_NOT_FOUND");
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
    action: input.isActive ? "USER_UPDATED" : "USER_SOFT_DELETED",
    actorId,
    afterData: input,
    beforeData: existingUser.data,
    entityId: userId,
    entityType: "user",
    metadata: {
      departmentId: input.departmentId,
      isActive: input.isActive,
    },
  });

  return updateQuery.data;
}

export async function moveUser(input: UserMoveInput, actorId: string) {
  const client = createSupabaseServerClient();
  const user = await ensureUserExists(client, input.userId);

  await ensureDepartmentReference(client, input.departmentId);

  const existingUser = await client
    .from("users")
    .select("department_id")
    .eq("id", input.userId)
    .maybeSingle<{ department_id: string | null }>();

  if (existingUser.error) {
    throw new ApiError(
      500,
      "기존 사용자 소속을 확인하지 못했습니다.",
      existingUser.error,
      "MASTER_USER_MOVE_BEFORE_LOAD_FAILED",
    );
  }

  if (!existingUser.data) {
    throw new ApiError(404, "이동할 사용자를 찾을 수 없습니다.", null, "MASTER_USER_NOT_FOUND");
  }

  const updateQuery = await client
    .from("users")
    .update({
      department_id: input.departmentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId)
    .select("id")
    .single<{ id: string }>();

  if (updateQuery.error) {
    throw new ApiError(500, "사용자 부서를 이동하지 못했습니다.", updateQuery.error, "MASTER_USER_MOVE_FAILED");
  }

  await recordHistory(client, {
    action: "USER_MOVED",
    actorId,
    afterData: {
      departmentId: input.departmentId,
      isActive: user.is_active,
    },
    beforeData: {
      departmentId: existingUser.data.department_id,
      isActive: user.is_active,
    },
    entityId: input.userId,
    entityType: "user",
    metadata: {
      fromDepartmentId: existingUser.data.department_id,
      toDepartmentId: input.departmentId,
    },
  });

  return updateQuery.data;
}
