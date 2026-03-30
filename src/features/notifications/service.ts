import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppSession } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import type {
  CreateNotificationLogInput,
  DispatchApprovalRequiredInput,
  DispatchApprovedInput,
  DispatchCompletionRequestedInput,
  DispatchDelayWarningInput,
  DispatchDirectiveAssignedInput,
  DispatchRejectedInput,
  NotificationInboxFilters,
  NotificationInboxItem,
  NotificationInboxResult,
  NotificationListFilters,
  NotificationListResult,
  NotificationLogListItem,
  NotificationPayload,
  NotificationType,
  NotificationUserOption,
  RegisterUserDeviceInput,
} from "./types";

type ActivityUserRow = {
  department_id: string | null;
  id: string;
  name: string;
  profile_name: string | null;
};

type NotificationLogRow = {
  body: string;
  channel: NotificationLogListItem["channel"];
  clicked_at: string | null;
  created_at: string;
  delivery_status: NotificationLogListItem["deliveryStatus"];
  directive_department_id: string | null;
  directive_id: string | null;
  id: string;
  metadata: NotificationPayload | null;
  notification_type: NotificationType;
  payload: NotificationPayload | null;
  read_at: string | null;
  sent_at: string;
  title: string;
  user_id: string;
};

type DirectiveRow = {
  directive_no: string | null;
  id: string;
  title: string | null;
};

type DateRange = {
  fromIso: string | null;
  toIso: string | null;
};

function buildDisplayName(user: Pick<ActivityUserRow, "name" | "profile_name"> | null | undefined) {
  if (!user) {
    return null;
  }

  return user.profile_name?.trim() || user.name;
}

function buildPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function buildContainsPattern(search: string) {
  return `*${search.replace(/[,*()]/g, " ").trim()}*`;
}

function normalizeSearch(search: string | undefined) {
  const value = search?.trim();
  return value && value.length > 0 ? value : null;
}

function dedupeUserIds(userIds: Array<string | null | undefined>) {
  return Array.from(new Set(userIds.filter(Boolean) as string[]));
}

function normalizePayload(payload: NotificationPayload | null | undefined) {
  return payload ?? {};
}

function resolvePayloadTargetPath(payload: NotificationPayload) {
  return typeof payload.targetPath === "string" && payload.targetPath.length > 0 ? payload.targetPath : null;
}

function buildDateRange(fromDate?: string, toDate?: string): DateRange {
  const fromIso = fromDate ? new Date(`${fromDate}T00:00:00+09:00`).toISOString() : null;
  const toIso = toDate ? new Date(`${toDate}T23:59:59.999+09:00`).toISOString() : null;

  return { fromIso, toIso };
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
    throw new ApiError(500, "사용자 정보를 불러오지 못했습니다.", error, "NOTIFICATION_USERS_LOAD_FAILED");
  }

  return new Map(((data ?? []) as ActivityUserRow[]).map((user) => [user.id, user]));
}

async function loadDirectiveMap(client: SupabaseClient, directiveIds: string[]) {
  if (directiveIds.length === 0) {
    return new Map<string, DirectiveRow>();
  }

  const { data, error } = await client
    .from("directives")
    .select("id, directive_no, title")
    .in("id", directiveIds);

  if (error) {
    throw new ApiError(500, "관련 지시사항을 불러오지 못했습니다.", error, "NOTIFICATION_DIRECTIVES_LOAD_FAILED");
  }

  return new Map(((data ?? []) as DirectiveRow[]).map((directive) => [directive.id, directive]));
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
      throw new ApiError(500, "조회 가능한 사용자 범위를 확인하지 못했습니다.", error, "NOTIFICATION_SCOPE_LOAD_FAILED");
    }

    return (data ?? []).map((item) => item.id as string);
  }

  return [session.userId];
}

async function ensureOwnNotification(client: SupabaseClient, session: AppSession, notificationId: string) {
  const { data, error } = await client
    .from("notification_logs")
    .select("id, user_id, delivery_status, payload, metadata, read_at")
    .eq("id", notificationId)
    .maybeSingle<{
      delivery_status: NotificationLogListItem["deliveryStatus"];
      id: string;
      metadata: NotificationPayload | null;
      payload: NotificationPayload | null;
      read_at: string | null;
      user_id: string;
    }>();

  if (error) {
    throw new ApiError(500, "알림 정보를 확인하지 못했습니다.", error, "NOTIFICATION_LOAD_FAILED");
  }

  if (!data) {
    throw new ApiError(404, "알림을 찾을 수 없습니다.", null, "NOTIFICATION_NOT_FOUND");
  }

  if (data.user_id !== session.userId) {
    throw new ApiError(403, "다른 사용자의 알림을 처리할 수 없습니다.", null, "NOTIFICATION_ACCESS_DENIED");
  }

  return data;
}

async function loadWebPushEligibleUserIds(client: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await client
    .from("user_devices")
    .select("user_id, push_token")
    .in("user_id", userIds)
    .eq("is_active", true)
    .eq("notification_permission", "granted")
    .not("push_token", "is", null);

  if (error) {
    throw new ApiError(500, "웹푸시 대상 디바이스를 확인하지 못했습니다.", error, "NOTIFICATION_DEVICE_SCOPE_FAILED");
  }

  return new Set(
    (data ?? [])
      .filter((row) => typeof row.push_token === "string" && !row.push_token.startsWith("preview-web-push:"))
      .map((row) => row.user_id as string),
  );
}

function dedupeEntries(entries: CreateNotificationLogInput[]) {
  return entries.filter(
    (entry, index, allEntries) =>
      index ===
      allEntries.findIndex(
        (candidate) =>
          candidate.userId === entry.userId &&
          candidate.channel === entry.channel &&
          candidate.notificationType === entry.notificationType &&
          candidate.directiveId === entry.directiveId &&
          candidate.directiveDepartmentId === entry.directiveDepartmentId,
      ),
  );
}

async function insertNotificationEntries(client: SupabaseClient, entries: CreateNotificationLogInput[]) {
  const dedupedEntries = dedupeEntries(entries);

  if (dedupedEntries.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("notification_logs")
    .insert(
      dedupedEntries.map((entry) => {
        const sentAt = entry.sentAt ?? new Date().toISOString();
        const payload = normalizePayload(entry.payload);

        return {
          body: entry.body,
          channel: entry.channel,
          created_at: sentAt,
          delivery_status: entry.deliveryStatus ?? (entry.channel === "IN_APP" ? "SENT" : "PENDING"),
          directive_department_id: entry.directiveDepartmentId ?? null,
          directive_id: entry.directiveId ?? null,
          metadata: payload,
          notification_type: entry.notificationType,
          payload,
          sent_at: sentAt,
          title: entry.title,
          user_id: entry.userId,
        };
      }),
    )
    .select("id");

  if (error) {
    throw new ApiError(500, "알림 로그를 저장하지 못했습니다.", error, "NOTIFICATION_CREATE_FAILED");
  }

  return (data ?? []).map((row) => row.id as string);
}

async function buildChannelEntries(
  client: SupabaseClient,
  baseEntry: Omit<CreateNotificationLogInput, "channel" | "deliveryStatus" | "userId">,
  userIds: string[],
) {
  const webPushEligibleUserIds = await loadWebPushEligibleUserIds(client, userIds);
  const entries: CreateNotificationLogInput[] = [];

  for (const userId of userIds) {
    entries.push({
      ...baseEntry,
      channel: "IN_APP",
      deliveryStatus: "SENT",
      userId,
    });

    if (webPushEligibleUserIds.has(userId)) {
      entries.push({
        ...baseEntry,
        channel: "WEB_PUSH",
        deliveryStatus: "PENDING",
        userId,
      });
    }
  }

  return entries;
}

function mapNotificationRow(
  row: NotificationLogRow,
  usersMap: Map<string, ActivityUserRow>,
  directiveMap: Map<string, DirectiveRow>,
): NotificationLogListItem {
  const directive = row.directive_id ? directiveMap.get(row.directive_id) ?? null : null;
  const payload = normalizePayload(row.payload ?? row.metadata);

  return {
    body: row.body,
    channel: row.channel,
    clickedAt: row.clicked_at,
    createdAt: row.created_at,
    deliveryStatus: row.delivery_status,
    directiveDepartmentId: row.directive_department_id,
    directiveId: row.directive_id,
    directiveNo: directive?.directive_no ?? (typeof payload.directiveNo === "string" ? payload.directiveNo : null),
    directiveTitle: directive?.title ?? null,
    id: row.id,
    notificationType: row.notification_type,
    payload,
    readAt: row.read_at,
    sentAt: row.sent_at,
    title: row.title,
    userId: row.user_id,
    userName: buildDisplayName(usersMap.get(row.user_id)),
  };
}

function mapInboxItem(
  row: NotificationLogRow,
  usersMap: Map<string, ActivityUserRow>,
  directiveMap: Map<string, DirectiveRow>,
): NotificationInboxItem {
  const item = mapNotificationRow(row, usersMap, directiveMap);

  return {
    ...item,
    isUnread: item.readAt == null,
    targetPath: resolvePayloadTargetPath(item.payload) ?? (item.directiveId ? `/directives/${item.directiveId}` : null),
  };
}

async function loadApproverUserIds(client: SupabaseClient) {
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("is_active", true)
    .in("role", ["CEO", "SUPER_ADMIN"]);

  if (error) {
    throw new ApiError(500, "승인권자 정보를 불러오지 못했습니다.", error, "NOTIFICATION_APPROVER_LOAD_FAILED");
  }

  return (data ?? []).map((row) => row.id as string);
}

export async function registerUserDevice(input: RegisterUserDeviceInput) {
  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("user_devices")
    .upsert(
      {
        app_version: input.appVersion ?? null,
        browser_name: input.browserName ?? null,
        device_key: input.deviceKey,
        device_type: input.deviceType,
        is_active: input.isActive ?? true,
        last_seen_at: now,
        notification_permission: input.notificationPermission,
        platform: input.platform,
        push_token: input.pushToken ?? null,
        updated_at: now,
        user_id: input.session.userId,
      },
      { onConflict: "user_id,device_key" },
    )
    .select("*")
    .single();

  if (error) {
    throw new ApiError(500, "디바이스 정보를 저장하지 못했습니다.", error, "USER_DEVICE_UPSERT_FAILED");
  }

  return data;
}

export async function createNotificationLog(input: CreateNotificationLogInput | CreateNotificationLogInput[]) {
  const client = createSupabaseServerClient();
  const entries = Array.isArray(input) ? input : [input];
  return insertNotificationEntries(client, entries);
}

export async function dispatchDirectiveAssignedNotifications(input: DispatchDirectiveAssignedInput) {
  const recipientAssignments = new Map<string, DispatchDirectiveAssignedInput["assignments"]>();

  for (const assignment of input.assignments) {
    if (!assignment.departmentHeadId) {
      continue;
    }

    const current = recipientAssignments.get(assignment.departmentHeadId) ?? [];
    current.push(assignment);
    recipientAssignments.set(assignment.departmentHeadId, current);
  }

  if (recipientAssignments.size === 0) {
    return [];
  }

  const client = createSupabaseServerClient();
  const entries: CreateNotificationLogInput[] = [];
  const webPushEligibleUserIds = await loadWebPushEligibleUserIds(client, Array.from(recipientAssignments.keys()));

  for (const [userId, assignments] of recipientAssignments.entries()) {
    const departmentNames = assignments.map((assignment) => assignment.departmentName);
    const body =
      departmentNames.length === 1
        ? `[${departmentNames[0]}] 지시사항이 등록되었습니다. 내용을 확인해주세요.`
        : `[${departmentNames.join(", ")}] 지시사항이 등록되었습니다. 내용을 확인해주세요.`;

    entries.push({
      body,
      channel: "IN_APP",
      deliveryStatus: "SENT",
      directiveDepartmentId: assignments[0]?.directiveDepartmentId ?? null,
      directiveId: input.directiveId,
      notificationType: "DIRECTIVE_ASSIGNED",
      payload: {
        departmentIds: assignments.map((assignment) => assignment.departmentId),
        departmentNames,
        directiveNo: input.directiveNo,
        targetPath: `/directives/${input.directiveId}`,
        targetPathLabel: "지시 상세",
      },
      title: "새 지시사항이 배정되었습니다",
      userId,
    });

    if (webPushEligibleUserIds.has(userId)) {
      entries.push({
        body,
        channel: "WEB_PUSH",
        deliveryStatus: "PENDING",
        directiveDepartmentId: assignments[0]?.directiveDepartmentId ?? null,
        directiveId: input.directiveId,
        notificationType: "DIRECTIVE_ASSIGNED",
        payload: {
          departmentIds: assignments.map((assignment) => assignment.departmentId),
          departmentNames,
          directiveNo: input.directiveNo,
          targetPath: `/directives/${input.directiveId}`,
          targetPathLabel: "지시 상세",
        },
        title: "새 지시사항이 배정되었습니다",
        userId,
      });
    }
  }

  return insertNotificationEntries(client, entries);
}

export async function dispatchCompletionRequestedNotifications(input: DispatchCompletionRequestedInput) {
  const client = createSupabaseServerClient();
  const approverUserIds = await loadApproverUserIds(client);

  if (approverUserIds.length === 0) {
    return [];
  }

  const entries = await buildChannelEntries(
    client,
    {
      body: `[${input.departmentName}]에서 완료 요청을 제출했습니다.`,
      directiveDepartmentId: input.directiveDepartmentId ?? null,
      directiveId: input.directiveId,
      notificationType: "COMPLETION_REQUESTED",
      payload: {
        departmentId: input.departmentId,
        departmentName: input.departmentName,
        directiveNo: input.directiveNo,
        reason: input.reason ?? null,
        targetPath: "/directives/approval-queue",
        targetPathLabel: "승인 대기",
      },
      title: "완료 요청이 접수되었습니다",
    },
    approverUserIds,
  );

  return insertNotificationEntries(client, entries);
}

export async function dispatchApprovalRequiredNotifications(input: DispatchApprovalRequiredInput) {
  const client = createSupabaseServerClient();
  const approverUserIds = await loadApproverUserIds(client);

  if (approverUserIds.length === 0) {
    return [];
  }

  const entries = await buildChannelEntries(
    client,
    {
      body: "승인 대기 중인 지시사항을 확인해주세요.",
      directiveDepartmentId: input.directiveDepartmentId ?? null,
      directiveId: input.directiveId,
      notificationType: "APPROVAL_REQUIRED",
      payload: {
        departmentId: input.departmentId,
        departmentName: input.departmentName,
        directiveNo: input.directiveNo,
        targetPath: "/directives/approval-queue",
        targetPathLabel: "승인 대기",
      },
      title: "승인이 필요한 지시사항이 있습니다",
    },
    approverUserIds,
  );

  return insertNotificationEntries(client, entries);
}

export async function dispatchRejectedNotifications(input: DispatchRejectedInput) {
  const userIds = dedupeUserIds([input.departmentHeadId, input.ownerUserId, ...(input.relatedUserIds ?? [])]);

  if (userIds.length === 0) {
    return [];
  }

  const client = createSupabaseServerClient();
  const entries = await buildChannelEntries(
    client,
    {
      body: "보완 후 다시 진행해주세요.",
      directiveDepartmentId: input.directiveDepartmentId ?? null,
      directiveId: input.directiveId,
      notificationType: "REJECTED",
      payload: {
        departmentId: input.departmentId,
        departmentName: input.departmentName,
        directiveNo: input.directiveNo,
        reason: input.reason ?? null,
        targetPath: `/directives/${input.directiveId}`,
        targetPathLabel: "지시 상세",
      },
      title: "완료 요청이 반려되었습니다",
    },
    userIds,
  );

  return insertNotificationEntries(client, entries);
}

export async function dispatchApprovedNotifications(input: DispatchApprovedInput) {
  const userIds = dedupeUserIds([input.departmentHeadId, input.ownerUserId, ...(input.relatedUserIds ?? [])]);

  if (userIds.length === 0) {
    return [];
  }

  const client = createSupabaseServerClient();
  const entries = await buildChannelEntries(
    client,
    {
      body: `[${input.departmentName}] 완료 요청이 승인되었습니다.`,
      directiveDepartmentId: input.directiveDepartmentId ?? null,
      directiveId: input.directiveId,
      notificationType: "APPROVED",
      payload: {
        departmentId: input.departmentId,
        departmentName: input.departmentName,
        directiveNo: input.directiveNo,
        targetPath: `/directives/${input.directiveId}`,
        targetPathLabel: "지시 상세",
      },
      title: "지시사항 승인이 완료되었습니다",
    },
    userIds,
  );

  return insertNotificationEntries(client, entries);
}

export async function dispatchDelayWarningNotifications(input: DispatchDelayWarningInput) {
  const userIds = dedupeUserIds([input.ownerUserId, ...input.departmentHeads]);

  if (userIds.length === 0) {
    return [];
  }

  const client = createSupabaseServerClient();
  const entries = await buildChannelEntries(
    client,
    {
      body: "마감일이 지난 지시사항이 있습니다. 진행 현황을 확인해주세요.",
      directiveDepartmentId: null,
      directiveId: input.directiveId,
      notificationType: "DELAY_WARNING",
      payload: {
        directiveNo: input.directiveNo,
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        targetPath: `/directives/${input.directiveId}`,
        targetPathLabel: "지시 상세",
      },
      title: "지연 위험 지시사항이 있습니다",
    },
    userIds,
  );

  return insertNotificationEntries(client, entries);
}

export async function markNotificationClicked(session: AppSession, notificationId: string, targetPath?: string) {
  const client = createSupabaseServerClient();
  const notification = await ensureOwnNotification(client, session, notificationId);
  const now = new Date().toISOString();
  const payload = normalizePayload(notification.payload ?? notification.metadata);

  if (targetPath) {
    payload.targetPath = targetPath;
  }

  const nextStatus = notification.read_at ? "READ" : "OPENED";
  const { error } = await client
    .from("notification_logs")
    .update({
      clicked_at: now,
      delivery_status: nextStatus,
      metadata: payload,
      payload,
    })
    .eq("id", notificationId);

  if (error) {
    throw new ApiError(500, "알림 클릭 기록을 저장하지 못했습니다.", error, "NOTIFICATION_CLICK_UPDATE_FAILED");
  }
}

export async function markNotificationRead(session: AppSession, notificationId: string) {
  const client = createSupabaseServerClient();
  await ensureOwnNotification(client, session, notificationId);
  const now = new Date().toISOString();
  const { error } = await client
    .from("notification_logs")
    .update({
      delivery_status: "READ",
      read_at: now,
    })
    .eq("id", notificationId);

  if (error) {
    throw new ApiError(500, "알림 읽음 처리를 저장하지 못했습니다.", error, "NOTIFICATION_READ_UPDATE_FAILED");
  }
}

export async function getNotificationSummary(session: AppSession) {
  const client = createSupabaseServerClient();

  const [{ count, error: unreadError }, { data, error: latestError }] = await Promise.all([
    client
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .is("read_at", null),
    client
      .from("notification_logs")
      .select("id, title, sent_at")
      .eq("user_id", session.userId)
      .order("sent_at", { ascending: false })
      .limit(5),
  ]);

  if (unreadError || latestError) {
    throw new ApiError(500, "알림 요약을 불러오지 못했습니다.", unreadError ?? latestError, "NOTIFICATION_SUMMARY_FAILED");
  }

  return {
    latestItems: data ?? [],
    unreadCount: count ?? 0,
  };
}

export async function listInboxNotifications(
  session: AppSession,
  filters: NotificationInboxFilters,
): Promise<NotificationInboxResult> {
  const client = createSupabaseServerClient();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const [{ count, data, error }, unreadCountResult] = await Promise.all([
    client
      .from("notification_logs")
      .select(
        "id, user_id, directive_id, directive_department_id, notification_type, channel, title, body, delivery_status, payload, metadata, sent_at, clicked_at, read_at, created_at",
        { count: "exact" },
      )
      .eq("user_id", session.userId)
      .order("sent_at", { ascending: false })
      .range(from, to),
    client
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .is("read_at", null),
  ]);

  if (error || unreadCountResult.error) {
    throw new ApiError(
      500,
      "알림함을 불러오지 못했습니다.",
      error ?? unreadCountResult.error,
      "NOTIFICATION_INBOX_LIST_FAILED",
    );
  }

  const rows = (data ?? []) as NotificationLogRow[];
  const usersMap = await loadUsersMap(client, [session.userId]);
  const directiveMap = await loadDirectiveMap(
    client,
    Array.from(new Set(rows.map((row) => row.directive_id).filter((value): value is string => Boolean(value)))),
  );

  return {
    items: rows.map((row) => mapInboxItem(row, usersMap, directiveMap)),
    pagination: buildPagination(filters.page, filters.pageSize, count ?? 0),
    unreadCount: unreadCountResult.count ?? 0,
  };
}

export async function listNotificationLogsForSession(
  session: AppSession,
  filters: NotificationListFilters,
): Promise<NotificationListResult> {
  const client = createSupabaseServerClient();
  const visibleUserIds = await resolveVisibleUserIds(client, session);
  const search = normalizeSearch(filters.search);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { fromIso, toIso } = buildDateRange(filters.fromDate, filters.toDate);

  let query = client
    .from("notification_logs")
    .select(
      "id, user_id, directive_id, directive_department_id, notification_type, channel, title, body, delivery_status, payload, metadata, sent_at, clicked_at, read_at, created_at",
      { count: "exact" },
    )
    .order("sent_at", { ascending: false });

  if (visibleUserIds && visibleUserIds.length === 0) {
    return {
      items: [],
      pagination: buildPagination(filters.page, filters.pageSize, 0),
    };
  }

  if (visibleUserIds) {
    query = query.in("user_id", visibleUserIds);
  }

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.notificationType) {
    query = query.eq("notification_type", filters.notificationType);
  }

  if (filters.channel) {
    query = query.eq("channel", filters.channel);
  }

  if (filters.deliveryStatus) {
    query = query.eq("delivery_status", filters.deliveryStatus);
  }

  if (fromIso) {
    query = query.gte("sent_at", fromIso);
  }

  if (toIso) {
    query = query.lte("sent_at", toIso);
  }

  if (search) {
    const pattern = buildContainsPattern(search);
    query = query.or([`title.ilike.${pattern}`, `body.ilike.${pattern}`, `notification_type.ilike.${pattern}`].join(","));
  }

  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw new ApiError(500, "알림 로그를 불러오지 못했습니다.", error, "NOTIFICATION_LOG_LIST_FAILED");
  }

  const rows = (data ?? []) as NotificationLogRow[];
  const usersMap = await loadUsersMap(client, Array.from(new Set(rows.map((row) => row.user_id))));
  const directiveMap = await loadDirectiveMap(
    client,
    Array.from(new Set(rows.map((row) => row.directive_id).filter((value): value is string => Boolean(value)))),
  );

  return {
    items: rows.map((row) => mapNotificationRow(row, usersMap, directiveMap)),
    pagination: buildPagination(filters.page, filters.pageSize, count ?? 0),
  };
}

export async function listNotificationUserOptionsForSession(session: AppSession): Promise<NotificationUserOption[]> {
  const client = createSupabaseServerClient();
  const visibleUserIds = await resolveVisibleUserIds(client, session);
  let query = client
    .from("users")
    .select("id, name, profile_name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (visibleUserIds && visibleUserIds.length === 0) {
    return [];
  }

  if (visibleUserIds) {
    query = query.in("id", visibleUserIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, "알림 대상 사용자 목록을 불러오지 못했습니다.", error, "NOTIFICATION_FILTER_USERS_FAILED");
  }

  return ((data ?? []) as ActivityUserRow[]).map((user) => ({
    id: user.id,
    name: buildDisplayName(user) ?? user.id,
  }));
}
