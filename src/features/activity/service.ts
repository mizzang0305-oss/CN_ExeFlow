import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { JsonObject } from "@/types";
import type { AppSession } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import { runBackgroundTask } from "@/lib/background-task";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import type {
  ActivityPaginationInput,
  AuthActivityLogItem,
  NotificationLogItem,
  PaginatedAuthActivityLogs,
  PaginatedNotificationLogs,
  PaginatedUserActivityLogs,
  QueueNotificationInput,
  RegisterUserDeviceInput,
  TrackAuthActivityInput,
  TrackUserActivityInput,
  UserActivityLogItem,
} from "./types";

type ActivityUserRow = {
  department_id: string | null;
  id: string;
  name: string;
  profile_name: string | null;
};

type DepartmentRow = {
  id: string;
  name: string;
};

function buildDisplayName(user: Pick<ActivityUserRow, "name" | "profile_name"> | null | undefined) {
  if (!user) {
    return null;
  }

  return user.profile_name?.trim() || user.name;
}

function normalizeSearch(search: string | undefined) {
  const value = search?.trim();
  return value && value.length > 0 ? value : null;
}

function buildContainsPattern(search: string) {
  return `*${search.replace(/[,*()]/g, " ").trim()}*`;
}

function buildPagination(input: ActivityPaginationInput, total: number) {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

async function loadUsersMap(client: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ActivityUserRow>();
  }

  const { data, error } = await client
    .from("users")
    .select("id, name, profile_name, department_id")
    .in("id", userIds);

  if (error) {
    throw new ApiError(500, "사용자 정보를 불러오지 못했습니다.", error, "ACTIVITY_USERS_LOAD_FAILED");
  }

  return new Map(((data ?? []) as ActivityUserRow[]).map((user) => [user.id, user]));
}

async function loadDepartmentsMap(client: SupabaseClient, departmentIds: string[]) {
  if (departmentIds.length === 0) {
    return new Map<string, DepartmentRow>();
  }

  const { data, error } = await client
    .from("departments")
    .select("id, name")
    .in("id", departmentIds);

  if (error) {
    throw new ApiError(500, "부서 정보를 불러오지 못했습니다.", error, "ACTIVITY_DEPARTMENTS_LOAD_FAILED");
  }

  return new Map(((data ?? []) as DepartmentRow[]).map((department) => [department.id, department]));
}

async function resolveVisibleUserIds(client: SupabaseClient, session: AppSession) {
  if (isAdminRole(session.role)) {
    return null;
  }

  if (session.role === "DEPARTMENT_HEAD" && session.departmentId) {
    const { data, error } = await client
      .from("users")
      .select("id")
      .eq("department_id", session.departmentId)
      .eq("is_active", true);

    if (error) {
      throw new ApiError(500, "부서 사용자 범위를 확인하지 못했습니다.", error, "ACTIVITY_SCOPE_LOAD_FAILED");
    }

    return (data ?? []).map((item) => item.id as string);
  }

  return [session.userId];
}

async function touchUserLastActiveAt(client: SupabaseClient, userId: string, minIntervalMs = 5 * 60 * 1000) {
  const { data, error } = await client
    .from("users")
    .select("last_active_at")
    .eq("id", userId)
    .maybeSingle<{ last_active_at: string | null }>();

  if (error) {
    throw new ApiError(500, "마지막 활동 시각을 확인하지 못했습니다.", error, "USER_LAST_ACTIVE_LOAD_FAILED");
  }

  const lastActiveAt = data?.last_active_at ? new Date(data.last_active_at).getTime() : 0;

  if (Date.now() - lastActiveAt < minIntervalMs) {
    return;
  }

  const { error: updateError } = await client
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateError) {
    throw new ApiError(500, "마지막 활동 시각을 갱신하지 못했습니다.", updateError, "USER_LAST_ACTIVE_UPDATE_FAILED");
  }
}

async function ensureNotificationAccess(client: SupabaseClient, session: AppSession, notificationId: string) {
  const { data, error } = await client
    .from("notification_logs")
    .select("id, user_id")
    .eq("id", notificationId)
    .maybeSingle<{ id: string; user_id: string }>();

  if (error) {
    throw new ApiError(500, "알림 로그를 확인하지 못했습니다.", error, "NOTIFICATION_LOG_LOAD_FAILED");
  }

  if (!data) {
    throw new ApiError(404, "알림 로그를 찾을 수 없습니다.", null, "NOTIFICATION_LOG_NOT_FOUND");
  }

  if (isAdminRole(session.role)) {
    return data;
  }

  const visibleUserIds = await resolveVisibleUserIds(client, session);

  if (!visibleUserIds?.includes(data.user_id)) {
    throw new ApiError(403, "이 알림 로그를 처리할 권한이 없습니다.", null, "NOTIFICATION_LOG_ACCESS_DENIED");
  }

  return data;
}

export async function trackAuthActivity(input: TrackAuthActivityInput) {
  const client = createSupabaseServerClient();
  const { error } = await client.from("auth_activity_logs").insert({
    device_type: input.requestContext?.deviceType ?? null,
    email: input.email ?? null,
    event_result: input.eventResult,
    event_type: input.eventType,
    happened_at: new Date().toISOString(),
    ip_address: input.requestContext?.ipAddress ?? null,
    platform: input.requestContext?.platform ?? null,
    user_agent: input.requestContext?.userAgent ?? null,
    user_id: input.userId ?? null,
  });

  if (error) {
    throw new ApiError(500, "접속 로그를 기록하지 못했습니다.", error, "AUTH_ACTIVITY_LOG_WRITE_FAILED");
  }
}

export async function trackUserActivity(input: TrackUserActivityInput) {
  const client = createSupabaseServerClient();
  const { error } = await client.from("user_activity_logs").insert({
    activity_type: input.activityType,
    department_id: input.session.departmentId,
    happened_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
    page_path: input.pagePath ?? null,
    target_id: input.targetId ?? null,
    target_type: input.targetType ?? null,
    user_id: input.session.userId,
  });

  if (error) {
    throw new ApiError(500, "사용자 활동 로그를 기록하지 못했습니다.", error, "USER_ACTIVITY_LOG_WRITE_FAILED");
  }

  await touchUserLastActiveAt(client, input.session.userId);
}

export async function registerUserDevice(input: RegisterUserDeviceInput) {
  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("user_devices")
    .upsert(
      {
        device_key: input.deviceKey,
        device_type: input.deviceType,
        last_seen_at: now,
        notification_permission: input.notificationPermission,
        platform: input.platform,
        push_token: input.pushToken ?? null,
        updated_at: now,
        user_id: input.session.userId,
      },
      {
        onConflict: "user_id,device_key",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw new ApiError(500, "디바이스 정보를 저장하지 못했습니다.", error, "USER_DEVICE_UPSERT_FAILED");
  }

  await touchUserLastActiveAt(client, input.session.userId);

  return data;
}

export async function queueNotificationLogs(input: QueueNotificationInput) {
  const client = createSupabaseServerClient();
  const uniqueUserIds = Array.from(new Set(input.userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("notification_logs")
    .insert(
      uniqueUserIds.map((userId) => ({
        body: input.body,
        channel: input.channel ?? "PUSH",
        delivery_status: input.deliveryStatus ?? "PENDING",
        directive_id: input.directiveId ?? null,
        metadata: input.metadata ?? {},
        notification_type: input.notificationType,
        sent_at: new Date().toISOString(),
        title: input.title,
        user_id: userId,
      })),
    )
    .select("id");

  if (error) {
    throw new ApiError(500, "알림 로그를 기록하지 못했습니다.", error, "NOTIFICATION_LOG_WRITE_FAILED");
  }

  return data ?? [];
}

export async function markNotificationReadAsSession(session: AppSession, notificationId: string) {
  const client = createSupabaseServerClient();
  await ensureNotificationAccess(client, session, notificationId);
  const now = new Date().toISOString();
  const { error } = await client
    .from("notification_logs")
    .update({
      delivery_status: "SENT",
      read_at: now,
    })
    .eq("id", notificationId);

  if (error) {
    throw new ApiError(500, "알림 읽음 시각을 저장하지 못했습니다.", error, "NOTIFICATION_READ_UPDATE_FAILED");
  }
}

export async function markNotificationClickedAsSession(session: AppSession, notificationId: string) {
  const client = createSupabaseServerClient();
  await ensureNotificationAccess(client, session, notificationId);
  const now = new Date().toISOString();
  const { error } = await client
    .from("notification_logs")
    .update({
      clicked_at: now,
      delivery_status: "SENT",
    })
    .eq("id", notificationId);

  if (error) {
    throw new ApiError(500, "알림 클릭 시각을 저장하지 못했습니다.", error, "NOTIFICATION_CLICK_UPDATE_FAILED");
  }
}

export async function listAuthActivityLogsForSession(
  session: AppSession,
  filters: ActivityPaginationInput,
): Promise<PaginatedAuthActivityLogs> {
  const client = createSupabaseServerClient();
  const visibleUserIds = await resolveVisibleUserIds(client, session);
  const search = normalizeSearch(filters.search);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = client
    .from("auth_activity_logs")
    .select("*", { count: "exact" })
    .order("happened_at", { ascending: false });

  if (visibleUserIds && visibleUserIds.length === 0) {
    return {
      items: [],
      pagination: buildPagination(filters, 0),
    };
  }

  if (visibleUserIds) {
    query = query.in("user_id", visibleUserIds);
  }

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw new ApiError(500, "접속 로그를 불러오지 못했습니다.", error, "AUTH_ACTIVITY_LOG_LIST_FAILED");
  }

  const rows = (data ?? []) as Array<{
    device_type: string | null;
    email: string | null;
    event_result: AuthActivityLogItem["eventResult"];
    event_type: AuthActivityLogItem["eventType"];
    happened_at: string;
    id: string;
    ip_address: string | null;
    platform: string | null;
    user_agent: string | null;
    user_id: string | null;
  }>;
  const userIds = rows.map((row) => row.user_id).filter((value): value is string => Boolean(value));
  const usersMap = await loadUsersMap(client, userIds);
  const departmentIds = Array.from(
    new Set(Array.from(usersMap.values()).map((user) => user.department_id).filter((value): value is string => Boolean(value))),
  );
  const departmentsMap = await loadDepartmentsMap(client, departmentIds);

  return {
    items: rows.map((row) => {
      const user = row.user_id ? usersMap.get(row.user_id) ?? null : null;
      const department = user?.department_id ? departmentsMap.get(user.department_id) ?? null : null;

      return {
        departmentName: department?.name ?? null,
        deviceType: row.device_type,
        email: row.email,
        eventResult: row.event_result,
        eventType: row.event_type,
        happenedAt: row.happened_at,
        id: row.id,
        ipAddress: row.ip_address,
        platform: row.platform,
        userAgent: row.user_agent,
        userId: row.user_id,
        userName: buildDisplayName(user),
      };
    }),
    pagination: buildPagination(filters, count ?? 0),
  };
}

export async function listUserActivityLogsForSession(
  session: AppSession,
  filters: ActivityPaginationInput,
): Promise<PaginatedUserActivityLogs> {
  const client = createSupabaseServerClient();
  const visibleUserIds = await resolveVisibleUserIds(client, session);
  const search = normalizeSearch(filters.search);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = client
    .from("user_activity_logs")
    .select("*", { count: "exact" })
    .order("happened_at", { ascending: false });

  if (visibleUserIds && visibleUserIds.length === 0) {
    return {
      items: [],
      pagination: buildPagination(filters, 0),
    };
  }

  if (visibleUserIds) {
    query = query.in("user_id", visibleUserIds);
  }

  if (search) {
    const pattern = buildContainsPattern(search);
    query = query.or(
      [`activity_type.ilike.${pattern}`, `page_path.ilike.${pattern}`, `target_type.ilike.${pattern}`].join(","),
    );
  }

  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw new ApiError(500, "활동 로그를 불러오지 못했습니다.", error, "USER_ACTIVITY_LOG_LIST_FAILED");
  }

  const rows = (data ?? []) as Array<{
    activity_type: UserActivityLogItem["activityType"];
    department_id: string | null;
    happened_at: string;
    id: string;
    metadata: JsonObject | null;
    page_path: string | null;
    target_id: string | null;
    target_type: string | null;
    user_id: string;
  }>;
  const usersMap = await loadUsersMap(
    client,
    Array.from(new Set(rows.map((row) => row.user_id))),
  );
  const departmentIds = Array.from(
    new Set(rows.map((row) => row.department_id).filter((value): value is string => Boolean(value))),
  );
  const departmentsMap = await loadDepartmentsMap(client, departmentIds);

  return {
    items: rows.map((row) => ({
      activityType: row.activity_type,
      departmentName: row.department_id ? departmentsMap.get(row.department_id)?.name ?? null : null,
      happenedAt: row.happened_at,
      id: row.id,
      metadata: row.metadata ?? {},
      pagePath: row.page_path,
      targetId: row.target_id,
      targetType: row.target_type,
      userId: row.user_id,
      userName: buildDisplayName(usersMap.get(row.user_id)),
    })),
    pagination: buildPagination(filters, count ?? 0),
  };
}

export async function listNotificationLogsForSession(
  session: AppSession,
  filters: ActivityPaginationInput,
): Promise<PaginatedNotificationLogs> {
  const client = createSupabaseServerClient();
  const visibleUserIds = await resolveVisibleUserIds(client, session);
  const search = normalizeSearch(filters.search);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = client
    .from("notification_logs")
    .select("*", { count: "exact" })
    .order("sent_at", { ascending: false });

  if (visibleUserIds && visibleUserIds.length === 0) {
    return {
      items: [],
      pagination: buildPagination(filters, 0),
    };
  }

  if (visibleUserIds) {
    query = query.in("user_id", visibleUserIds);
  }

  if (search) {
    const pattern = buildContainsPattern(search);
    query = query.or(
      [`title.ilike.${pattern}`, `body.ilike.${pattern}`, `notification_type.ilike.${pattern}`].join(","),
    );
  }

  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw new ApiError(500, "알림 로그를 불러오지 못했습니다.", error, "NOTIFICATION_LOG_LIST_FAILED");
  }

  const rows = (data ?? []) as Array<{
    body: string;
    channel: NotificationLogItem["channel"];
    clicked_at: string | null;
    delivery_status: NotificationLogItem["deliveryStatus"];
    directive_id: string | null;
    id: string;
    metadata: JsonObject | null;
    notification_type: NotificationLogItem["notificationType"];
    read_at: string | null;
    sent_at: string;
    title: string;
    user_id: string;
  }>;
  const usersMap = await loadUsersMap(
    client,
    Array.from(new Set(rows.map((row) => row.user_id))),
  );

  return {
    items: rows.map((row) => ({
      body: row.body,
      channel: row.channel,
      clickedAt: row.clicked_at,
      deliveryStatus: row.delivery_status,
      directiveId: row.directive_id,
      id: row.id,
      metadata: row.metadata ?? {},
      notificationType: row.notification_type,
      readAt: row.read_at,
      sentAt: row.sent_at,
      title: row.title,
      userId: row.user_id,
      userName: buildDisplayName(usersMap.get(row.user_id)),
    })),
    pagination: buildPagination(filters, count ?? 0),
  };
}

export function trackUserActivityAsync(input: TrackUserActivityInput) {
  runBackgroundTask("user-activity-log", () => trackUserActivity(input));
}

export function queueNotificationLogsAsync(input: QueueNotificationInput) {
  runBackgroundTask("notification-log-queue", async () => {
    await queueNotificationLogs(input);
  });
}
