import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { JsonObject } from "@/types";
import type { AppSession, UserRole } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import { runBackgroundTask } from "@/lib/background-task";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import type {
  ActivityUserSummary,
  AuthActivityLogItem,
  NotificationLogItem,
  PaginatedActivityLogs,
  PaginationInput,
  QueueNotificationLogInput,
  RegisterUserDeviceInput,
  TrackAuthActivityInput,
  TrackUserActivityInput,
  UserActivityLogItem,
} from "./types";

const LAST_ACTIVE_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

type ActivityUserRow = {
  department_id: string | null;
  email: string | null;
  id: string;
  name: string;
  profile_name: string | null;
  role: UserRole;
  title: string | null;
};

type ActivityDepartmentRow = {
  id: string;
  name: string;
};

type DirectiveSummaryRow = {
  directive_no: string;
  id: string;
  title: string;
};

function mapSupabaseActivityError(error: unknown, message: string, code: string) {
  return new ApiError(500, message, error, code);
}

function normalizeSearch(search: string | null | undefined) {
  return search?.trim() ?? "";
}

function buildDisplayName(user: Pick<ActivityUserRow, "name" | "profile_name">) {
  return user.profile_name?.trim() || user.name;
}

function ensureJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonObject;
}

async function loadUserSummaryMap(client: SupabaseClient, userIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));

  if (ids.length === 0) {
    return new Map<string, ActivityUserSummary>();
  }

  const { data, error } = await client
    .from("users")
    .select("id, name, profile_name, email, role, title, department_id")
    .in("id", ids);

  if (error) {
    throw mapSupabaseActivityError(error, "사용자 정보를 불러오지 못했습니다.", "ACTIVITY_USER_LOAD_FAILED");
  }

  const rows = (data ?? []) as ActivityUserRow[];
  const departmentIds = Array.from(new Set(rows.map((row) => row.department_id).filter(Boolean) as string[]));
  const departmentMap = await loadDepartmentMap(client, departmentIds);

  return new Map(
    rows.map((row) => [
      row.id,
      {
        departmentId: row.department_id,
        departmentName: row.department_id ? departmentMap.get(row.department_id)?.name ?? null : null,
        displayName: buildDisplayName(row),
        email: row.email,
        role: row.role,
        title: row.title,
        userId: row.id,
      } satisfies ActivityUserSummary,
    ]),
  );
}

async function loadDepartmentMap(client: SupabaseClient, departmentIds: string[]) {
  if (departmentIds.length === 0) {
    return new Map<string, ActivityDepartmentRow>();
  }

  const { data, error } = await client.from("departments").select("id, name").in("id", departmentIds);

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "부서 정보를 불러오지 못했습니다.",
      "ACTIVITY_DEPARTMENT_LOAD_FAILED",
    );
  }

  return new Map(((data ?? []) as ActivityDepartmentRow[]).map((row) => [row.id, row]));
}

async function loadDirectiveSummaryMap(client: SupabaseClient, directiveIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(directiveIds.filter(Boolean) as string[]));

  if (ids.length === 0) {
    return new Map<string, DirectiveSummaryRow>();
  }

  const { data, error } = await client
    .from("directives")
    .select("id, directive_no, title")
    .in("id", ids);

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "지시 요약 정보를 불러오지 못했습니다.",
      "ACTIVITY_DIRECTIVE_LOAD_FAILED",
    );
  }

  return new Map(((data ?? []) as DirectiveSummaryRow[]).map((row) => [row.id, row]));
}

async function resolveAccessibleUserIds(client: SupabaseClient, session: AppSession) {
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
      throw mapSupabaseActivityError(
        error,
        "부서 사용자 범위를 확인하지 못했습니다.",
        "ACTIVITY_SCOPE_LOAD_FAILED",
      );
    }

    return (data ?? []).map((row) => row.id as string);
  }

  return [session.userId];
}

function applyUserScope<TQuery extends { in: (column: string, values: string[]) => TQuery }>(
  query: TQuery,
  userIds: string[] | null,
) {
  if (!userIds) {
    return query;
  }

  return query.in("user_id", userIds);
}

function buildPagination<T>(items: T[], page: number, pageSize: number, total: number): PaginatedActivityLogs<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function touchUserLastActiveAt(options: {
  client?: SupabaseClient;
  force?: boolean;
  lastActiveAt?: string | null;
  userId: string;
}) {
  const shouldUpdate =
    options.force ||
    !options.lastActiveAt ||
    Date.now() - new Date(options.lastActiveAt).getTime() >= LAST_ACTIVE_UPDATE_INTERVAL_MS;

  if (!shouldUpdate) {
    return false;
  }

  const client = options.client ?? createSupabaseServerClient();
  const { error } = await client
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", options.userId);

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "최근 활동 시각을 갱신하지 못했습니다.",
      "USER_LAST_ACTIVE_UPDATE_FAILED",
    );
  }

  return true;
}

export async function trackAuthActivity(input: TrackAuthActivityInput) {
  const client = createSupabaseServerClient();
  const { error } = await client.from("auth_activity_logs").insert({
    device_type: input.deviceType ?? null,
    email: input.email ?? null,
    event_result: input.eventResult,
    event_type: input.eventType,
    happened_at: input.happenedAt ?? new Date().toISOString(),
    ip_address: input.ipAddress ?? null,
    platform: input.platform ?? null,
    user_agent: input.userAgent ?? null,
    user_id: input.userId ?? null,
  });

  if (error) {
    throw mapSupabaseActivityError(error, "접속 로그를 기록하지 못했습니다.", "AUTH_ACTIVITY_WRITE_FAILED");
  }
}

export function trackAuthActivityAsync(input: TrackAuthActivityInput) {
  runBackgroundTask("auth-activity", () => trackAuthActivity(input));
}

export async function trackUserActivity(input: TrackUserActivityInput) {
  const client = createSupabaseServerClient();
  const { error } = await client.from("user_activity_logs").insert({
    activity_type: input.activityType,
    department_id: input.departmentId ?? null,
    happened_at: input.happenedAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
    page_path: input.pagePath ?? null,
    target_id: input.targetId ?? null,
    target_type: input.targetType ?? null,
    user_id: input.userId,
  });

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "사용자 활동 로그를 기록하지 못했습니다.",
      "USER_ACTIVITY_WRITE_FAILED",
    );
  }
}

export function trackUserActivityAsync(input: TrackUserActivityInput) {
  runBackgroundTask("user-activity", () => trackUserActivity(input));
}

export async function registerUserDevice(session: AppSession, input: RegisterUserDeviceInput) {
  const client = createSupabaseServerClient();
  const happenedAt = new Date().toISOString();
  const { data, error } = await client
    .from("user_devices")
    .upsert(
      {
        device_key: input.deviceKey,
        device_type: input.deviceType,
        last_seen_at: happenedAt,
        notification_permission: input.notificationPermission,
        platform: input.platform,
        push_token: input.pushToken ?? null,
        user_id: session.userId,
      },
      { onConflict: "user_id,device_key" },
    )
    .select("*")
    .single();

  if (error) {
    throw mapSupabaseActivityError(error, "디바이스 정보를 저장하지 못했습니다.", "USER_DEVICE_UPSERT_FAILED");
  }

  await touchUserLastActiveAt({
    client,
    force: true,
    userId: session.userId,
  });

  return data;
}

export function registerUserDeviceAsync(session: AppSession, input: RegisterUserDeviceInput) {
  runBackgroundTask("user-device", () => registerUserDevice(session, input));
}

export async function queueNotificationLogs(input: QueueNotificationLogInput) {
  const userIds = Array.from(new Set(input.userIds.filter(Boolean)));

  if (userIds.length === 0) {
    return 0;
  }

  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await client.from("notification_logs").insert(
    userIds.map((userId) => ({
      body: input.body,
      channel: input.channel ?? "PUSH",
      delivery_status: input.deliveryStatus ?? "PENDING",
      directive_id: input.directiveId ?? null,
      metadata: input.metadata ?? {},
      notification_type: input.notificationType,
      sent_at: now,
      title: input.title,
      user_id: userId,
    })),
  );

  if (error) {
    throw mapSupabaseActivityError(error, "알림 로그를 적재하지 못했습니다.", "NOTIFICATION_LOG_WRITE_FAILED");
  }

  return userIds.length;
}

export function queueNotificationLogsAsync(input: QueueNotificationLogInput) {
  runBackgroundTask("notification-log", () => queueNotificationLogs(input));
}

export async function markNotificationReadAsSession(session: AppSession, notificationId: string) {
  const client = createSupabaseServerClient();
  let query = client
    .from("notification_logs")
    .update({
      delivery_status: "READ",
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId);

  if (!isAdminRole(session.role)) {
    query = query.eq("user_id", session.userId);
  }

  const { error } = await query;

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "알림 읽음 상태를 저장하지 못했습니다.",
      "NOTIFICATION_READ_UPDATE_FAILED",
    );
  }
}

export async function markNotificationClickedAsSession(session: AppSession, notificationId: string) {
  const client = createSupabaseServerClient();
  let query = client
    .from("notification_logs")
    .update({
      clicked_at: new Date().toISOString(),
    })
    .eq("id", notificationId);

  if (!isAdminRole(session.role)) {
    query = query.eq("user_id", session.userId);
  }

  const { error } = await query;

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "알림 클릭 기록을 저장하지 못했습니다.",
      "NOTIFICATION_CLICK_UPDATE_FAILED",
    );
  }
}

export async function listAuthActivityLogsForSession(
  session: AppSession,
  filters: PaginationInput,
): Promise<PaginatedActivityLogs<AuthActivityLogItem>> {
  const client = createSupabaseServerClient();
  const scopedUserIds = await resolveAccessibleUserIds(client, session);

  if (scopedUserIds && scopedUserIds.length === 0) {
    return buildPagination([], filters.page, filters.pageSize, 0);
  }

  let query = client
    .from("auth_activity_logs")
    .select("*", { count: "exact" })
    .order("happened_at", { ascending: false });

  query = applyUserScope(query, scopedUserIds);

  const search = normalizeSearch(filters.search);

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "접속 로그를 불러오지 못했습니다.",
      "AUTH_ACTIVITY_LIST_FAILED",
    );
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
  const userMap = await loadUserSummaryMap(client, rows.map((row) => row.user_id));

  return buildPagination(
    rows.map((row) => ({
      deviceType: row.device_type,
      email: row.email,
      eventResult: row.event_result,
      eventType: row.event_type,
      happenedAt: row.happened_at,
      id: row.id,
      ipAddress: row.ip_address,
      platform: row.platform,
      user: row.user_id ? userMap.get(row.user_id) ?? null : null,
      userAgent: row.user_agent,
    })),
    filters.page,
    filters.pageSize,
    count ?? 0,
  );
}

export async function listUserActivityLogsForSession(
  session: AppSession,
  filters: PaginationInput,
): Promise<PaginatedActivityLogs<UserActivityLogItem>> {
  const client = createSupabaseServerClient();
  const scopedUserIds = await resolveAccessibleUserIds(client, session);

  if (scopedUserIds && scopedUserIds.length === 0) {
    return buildPagination([], filters.page, filters.pageSize, 0);
  }

  let query = client
    .from("user_activity_logs")
    .select("*", { count: "exact" })
    .order("happened_at", { ascending: false });

  query = applyUserScope(query, scopedUserIds);

  const search = normalizeSearch(filters.search);

  if (search) {
    query = query.or(
      [`activity_type.ilike.*${search}*`, `page_path.ilike.*${search}*`, `target_type.ilike.*${search}*`].join(","),
    );
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "사용자 활동 로그를 불러오지 못했습니다.",
      "USER_ACTIVITY_LIST_FAILED",
    );
  }

  const rows = (data ?? []) as Array<{
    activity_type: UserActivityLogItem["activityType"];
    department_id: string | null;
    happened_at: string;
    id: string;
    metadata: unknown;
    page_path: string | null;
    target_id: string | null;
    target_type: string | null;
    user_id: string;
  }>;
  const userMap = await loadUserSummaryMap(client, rows.map((row) => row.user_id));

  return buildPagination(
    rows.map((row) => ({
      activityType: row.activity_type,
      happenedAt: row.happened_at,
      id: row.id,
      metadata: ensureJsonObject(row.metadata),
      pagePath: row.page_path,
      targetId: row.target_id,
      targetType: row.target_type,
      user: userMap.get(row.user_id) ?? null,
    })),
    filters.page,
    filters.pageSize,
    count ?? 0,
  );
}

export async function listNotificationLogsForSession(
  session: AppSession,
  filters: PaginationInput,
): Promise<PaginatedActivityLogs<NotificationLogItem>> {
  const client = createSupabaseServerClient();
  const scopedUserIds = await resolveAccessibleUserIds(client, session);

  if (scopedUserIds && scopedUserIds.length === 0) {
    return buildPagination([], filters.page, filters.pageSize, 0);
  }

  let query = client
    .from("notification_logs")
    .select("*", { count: "exact" })
    .order("sent_at", { ascending: false });

  query = applyUserScope(query, scopedUserIds);

  const search = normalizeSearch(filters.search);

  if (search) {
    query = query.or(
      [`title.ilike.*${search}*`, `body.ilike.*${search}*`, `notification_type.ilike.*${search}*`].join(","),
    );
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw mapSupabaseActivityError(
      error,
      "알림 로그를 불러오지 못했습니다.",
      "NOTIFICATION_LOG_LIST_FAILED",
    );
  }

  const rows = (data ?? []) as Array<{
    body: string;
    channel: NotificationLogItem["channel"];
    clicked_at: string | null;
    delivery_status: NotificationLogItem["deliveryStatus"];
    directive_id: string | null;
    id: string;
    metadata: unknown;
    notification_type: NotificationLogItem["notificationType"];
    read_at: string | null;
    sent_at: string;
    title: string;
    user_id: string;
  }>;
  const [userMap, directiveMap] = await Promise.all([
    loadUserSummaryMap(client, rows.map((row) => row.user_id)),
    loadDirectiveSummaryMap(client, rows.map((row) => row.directive_id)),
  ]);

  return buildPagination(
    rows.map((row) => {
      const directive = row.directive_id ? directiveMap.get(row.directive_id) ?? null : null;

      return {
        body: row.body,
        channel: row.channel,
        clickedAt: row.clicked_at,
        deliveryStatus: row.delivery_status,
        directiveId: row.directive_id,
        directiveNo: directive?.directive_no ?? null,
        directiveTitle: directive?.title ?? null,
        id: row.id,
        metadata: ensureJsonObject(row.metadata),
        notificationType: row.notification_type,
        readAt: row.read_at,
        sentAt: row.sent_at,
        title: row.title,
        user: userMap.get(row.user_id) ?? null,
      } satisfies NotificationLogItem;
    }),
    filters.page,
    filters.pageSize,
    count ?? 0,
  );
}
