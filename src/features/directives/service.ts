import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { AppSession } from "@/features/auth/types";
import {
  canViewDashboard,
  isAdminRole,
  isExecutiveRole,
  isReadOnlyRole,
} from "@/features/auth/utils";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";
import { sanitizeFileName } from "@/lib/utils";

import type {
  CreateDirectiveInput,
  CreateDirectiveLogInput,
  DashboardData,
  DashboardRecentUpdate,
  DeleteDirectiveLogInput,
  DepartmentBoardData,
  DepartmentRecord,
  DirectiveActivitySummary,
  DirectiveAttachmentItem,
  DirectiveAttachmentRow,
  DirectiveDepartmentRow,
  DirectiveDetail,
  DirectiveListFilters,
  DirectiveListItem,
  DirectiveLogItem,
  DirectiveLogMeta,
  DirectiveLogRow,
  DirectiveRow,
  PaginatedDirectives,
  UpdateDirectiveLogInput,
  UserRecord,
  WorkflowDecisionInput,
} from "./types";

const DIRECTIVE_NUMBER_PREFIX = "CN";
const DIRECTIVE_EVIDENCE_BUCKET = "directive-evidence";
const LOG_META_PREFIX = "__CNEXEFLOW_META__:";
const MAX_DIRECTIVE_NUMBER_RETRIES = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

type ActivityMaps = {
  attachmentCountByDirectiveId: Map<string, number>;
  lastActivityAtByDirectiveId: Map<string, string>;
  logCountByDirectiveId: Map<string, number>;
};

function computeIsDelayed(dueDate: string | null, status: string) {
  if (!dueDate || status === "COMPLETED") {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[,*]/g, " ").trim();
}

function mapSupabaseError(error: PostgrestError, fallbackMessage: string, code = "SUPABASE_ERROR") {
  if (error.code === "23505") {
    return new ApiError(409, "중복된 데이터가 이미 존재합니다.", error, "DUPLICATE_VALUE");
  }

  if (error.code === "23503") {
    return new ApiError(400, "연결된 기준정보를 찾을 수 없습니다.", error, "REFERENCE_NOT_FOUND");
  }

  if (error.code === "42P01" || error.code === "42703") {
    return new ApiError(
      500,
      "운영 스키마와 코드가 맞지 않습니다. 필요한 컬럼과 테이블을 먼저 확인해 주세요.",
      error,
      "SCHEMA_MISMATCH",
    );
  }

  return new ApiError(500, fallbackMessage, error, code);
}

function buildUserDisplayName(user: Pick<UserRecord, "name" | "profile_name"> | null | undefined) {
  if (!user) {
    return null;
  }

  return user.profile_name?.trim() || user.name;
}

function buildDirectiveNumberPrefix(createdAt: string) {
  const date = new Date(createdAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${DIRECTIVE_NUMBER_PREFIX}-${year}-${month}-`;
}

function buildYearMonthValue(createdAt: string) {
  const date = new Date(createdAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function generateDirectiveNumber(client: SupabaseClient, createdAt: string) {
  const prefix = buildDirectiveNumberPrefix(createdAt);
  const { data, error } = await client
    .from("directives")
    .select("directive_no")
    .like("directive_no", `${prefix}%`)
    .order("directive_no", { ascending: false })
    .limit(1);

  if (error) {
    throw mapSupabaseError(error, "관리번호를 생성하지 못했습니다.", "DIRECTIVE_NO_GENERATION_FAILED");
  }

  const latestDirectiveNumber = data?.[0]?.directive_no as string | undefined;
  const nextSequence = latestDirectiveNumber
    ? Number.parseInt(latestDirectiveNumber.slice(-3), 10) + 1
    : 1;

  return {
    directiveNo: `${prefix}${String(nextSequence).padStart(3, "0")}`,
    sequence: nextSequence,
  };
}

function isDirectiveNumberConflict(error: PostgrestError) {
  const detail = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return error.code === "23505" && detail.includes("directive_no");
}

function encodeLogMeta(meta: DirectiveLogMeta) {
  return `${LOG_META_PREFIX}${JSON.stringify(meta)}`;
}

function decodeLogMeta(rawDetail: string | null, fallbackAt: string): DirectiveLogMeta {
  if (!rawDetail) {
    return {
      detail: null,
      happenedAt: fallbackAt,
      logType: "STATUS_NOTE",
      nextAction: null,
      riskNote: null,
    };
  }

  if (!rawDetail.startsWith(LOG_META_PREFIX)) {
    return {
      detail: rawDetail,
      happenedAt: fallbackAt,
      logType: "STATUS_NOTE",
      nextAction: null,
      riskNote: null,
    };
  }

  try {
    const parsed = JSON.parse(rawDetail.slice(LOG_META_PREFIX.length)) as Partial<DirectiveLogMeta>;

    return {
      detail: typeof parsed.detail === "string" ? parsed.detail : null,
      happenedAt:
        typeof parsed.happenedAt === "string" && parsed.happenedAt.length > 0
          ? parsed.happenedAt
          : fallbackAt,
      logType:
        typeof parsed.logType === "string"
          ? (parsed.logType as DirectiveLogMeta["logType"])
          : "STATUS_NOTE",
      nextAction: typeof parsed.nextAction === "string" ? parsed.nextAction : null,
      riskNote: typeof parsed.riskNote === "string" ? parsed.riskNote : null,
    };
  } catch {
    return {
      detail: rawDetail,
      happenedAt: fallbackAt,
      logType: "STATUS_NOTE",
      nextAction: null,
      riskNote: null,
    };
  }
}

async function loadDepartmentsMap(client: SupabaseClient, departmentIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean) as string[]));

  if (ids.length === 0) {
    return new Map<string, DepartmentRecord>();
  }

  const { data, error } = await client.from("departments").select("id, code, name, head_user_id").in("id", ids);

  if (error) {
    throw mapSupabaseError(error, "부서 정보를 불러오지 못했습니다.", "DEPARTMENT_LOAD_FAILED");
  }

  return new Map(((data ?? []) as DepartmentRecord[]).map((department) => [department.id, department]));
}

async function loadUsersMap(client: SupabaseClient, userIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));

  if (ids.length === 0) {
    return new Map<string, UserRecord>();
  }

  const { data, error } = await client
    .from("users")
    .select("id, name, profile_name, role, department_id, title")
    .in("id", ids);

  if (error) {
    throw mapSupabaseError(error, "사용자 정보를 불러오지 못했습니다.", "USER_LOAD_FAILED");
  }

  return new Map(((data ?? []) as UserRecord[]).map((user) => [user.id, user]));
}

async function loadDirectiveDepartmentsMap(client: SupabaseClient, directiveIds: string[]) {
  if (directiveIds.length === 0) {
    return new Map<string, DirectiveDepartmentRow[]>();
  }

  const { data, error } = await client
    .from("directive_departments")
    .select("*")
    .in("directive_id", directiveIds);

  if (error) {
    throw mapSupabaseError(
      error,
      "지시사항 부서 배정 정보를 불러오지 못했습니다.",
      "DIRECTIVE_DEPARTMENTS_LOAD_FAILED",
    );
  }

  const rows = (data ?? []) as DirectiveDepartmentRow[];
  const map = new Map<string, DirectiveDepartmentRow[]>();

  for (const row of rows) {
    const current = map.get(row.directive_id) ?? [];
    current.push(row);
    map.set(row.directive_id, current);
  }

  return map;
}

async function loadActivityMaps(client: SupabaseClient, directiveIds: string[]): Promise<ActivityMaps> {
  const attachmentCountByDirectiveId = new Map<string, number>();
  const lastActivityAtByDirectiveId = new Map<string, string>();
  const logCountByDirectiveId = new Map<string, number>();

  if (directiveIds.length === 0) {
    return {
      attachmentCountByDirectiveId,
      lastActivityAtByDirectiveId,
      logCountByDirectiveId,
    };
  }

  const [logsQuery, attachmentsQuery] = await Promise.all([
    client
      .from("directive_logs")
      .select("id, directive_id, created_at, updated_at")
      .eq("is_deleted", false)
      .in("directive_id", directiveIds),
    client
      .from("directive_attachments")
      .select("id, directive_id, log_id, uploaded_at")
      .in("directive_id", directiveIds),
  ]);

  if (logsQuery.error) {
    throw mapSupabaseError(logsQuery.error, "실행 로그 요약을 불러오지 못했습니다.", "DIRECTIVE_LOGS_SUMMARY_FAILED");
  }

  if (attachmentsQuery.error) {
    throw mapSupabaseError(
      attachmentsQuery.error,
      "증빙 요약을 불러오지 못했습니다.",
      "DIRECTIVE_ATTACHMENTS_SUMMARY_FAILED",
    );
  }

  const logs = (logsQuery.data ?? []) as Array<Pick<DirectiveLogRow, "id" | "directive_id" | "created_at" | "updated_at">>;
  const visibleLogIds = new Set(logs.map((log) => log.id));

  for (const log of logs) {
    logCountByDirectiveId.set(log.directive_id, (logCountByDirectiveId.get(log.directive_id) ?? 0) + 1);
    const activityAt = log.updated_at ?? log.created_at;
    const existing = lastActivityAtByDirectiveId.get(log.directive_id);

    if (!existing || new Date(activityAt).getTime() > new Date(existing).getTime()) {
      lastActivityAtByDirectiveId.set(log.directive_id, activityAt);
    }
  }

  for (const attachment of (attachmentsQuery.data ?? []) as Array<Pick<DirectiveAttachmentRow, "directive_id" | "log_id" | "uploaded_at">>) {
    if (attachment.log_id && !visibleLogIds.has(attachment.log_id)) {
      continue;
    }

    attachmentCountByDirectiveId.set(
      attachment.directive_id,
      (attachmentCountByDirectiveId.get(attachment.directive_id) ?? 0) + 1,
    );

    const existing = lastActivityAtByDirectiveId.get(attachment.directive_id);

    if (!existing || new Date(attachment.uploaded_at).getTime() > new Date(existing).getTime()) {
      lastActivityAtByDirectiveId.set(attachment.directive_id, attachment.uploaded_at);
    }
  }

  return {
    attachmentCountByDirectiveId,
    lastActivityAtByDirectiveId,
    logCountByDirectiveId,
  };
}

function buildActivitySummary(
  directive: DirectiveRow,
  activityMaps: ActivityMaps,
): DirectiveActivitySummary {
  return {
    attachmentCount: activityMaps.attachmentCountByDirectiveId.get(directive.id) ?? 0,
    lastActivityAt: activityMaps.lastActivityAtByDirectiveId.get(directive.id) ?? directive.created_at,
    logCount: activityMaps.logCountByDirectiveId.get(directive.id) ?? 0,
  };
}

function mapDirectiveSummary(
  directive: DirectiveRow,
  departmentMap: Map<string, DepartmentRecord>,
  userMap: Map<string, UserRecord>,
  activityMaps: ActivityMaps,
): DirectiveListItem {
  const ownerDepartment = directive.owner_department_id ? departmentMap.get(directive.owner_department_id) : null;
  const ownerUser = directive.owner_user_id ? userMap.get(directive.owner_user_id) : null;
  const activitySummary = buildActivitySummary(directive, activityMaps);

  return {
    ...activitySummary,
    directiveNo: directive.directive_no,
    dueDate: directive.due_date,
    id: directive.id,
    isDelayed: computeIsDelayed(directive.due_date, directive.status),
    isUrgent: directive.is_urgent,
    ownerDepartmentCode: ownerDepartment?.code ?? null,
    ownerDepartmentName: ownerDepartment?.name ?? null,
    ownerUserName: buildUserDisplayName(ownerUser),
    status: directive.status,
    title: directive.title,
    urgentLevel: directive.urgent_level,
  };
}

async function getAccessibleDirectiveIds(client: SupabaseClient, session: AppSession) {
  if (isExecutiveRole(session.role) || isAdminRole(session.role)) {
    return null;
  }

  const ids = new Set<string>();

  if (session.departmentId) {
    const [departmentAssignments, ownedByDepartment] = await Promise.all([
      client.from("directive_departments").select("directive_id").eq("department_id", session.departmentId),
      client
        .from("directives")
        .select("id")
        .eq("owner_department_id", session.departmentId)
        .eq("is_archived", false),
    ]);

    if (departmentAssignments.error) {
      throw mapSupabaseError(
        departmentAssignments.error,
        "부서 범위 지시사항을 불러오지 못했습니다.",
        "DIRECTIVE_SCOPE_LOAD_FAILED",
      );
    }

    if (ownedByDepartment.error) {
      throw mapSupabaseError(
        ownedByDepartment.error,
        "부서 지시사항을 불러오지 못했습니다.",
        "DIRECTIVE_SCOPE_OWNED_FAILED",
      );
    }

    for (const row of departmentAssignments.data ?? []) {
      if (row.directive_id) {
        ids.add(row.directive_id as string);
      }
    }

    for (const row of ownedByDepartment.data ?? []) {
      if (row.id) {
        ids.add(row.id as string);
      }
    }
  }

  if (session.role === "STAFF") {
    const ownedByUser = await client
      .from("directives")
      .select("id")
      .eq("owner_user_id", session.userId)
      .eq("is_archived", false);

    if (ownedByUser.error) {
      throw mapSupabaseError(ownedByUser.error, "개인 배정 지시사항을 불러오지 못했습니다.", "DIRECTIVE_SCOPE_USER_FAILED");
    }

    for (const row of ownedByUser.data ?? []) {
      if (row.id) {
        ids.add(row.id as string);
      }
    }
  }

  return Array.from(ids);
}

function canViewDirective(
  session: AppSession,
  directive: DirectiveRow,
  directiveDepartments: DirectiveDepartmentRow[],
) {
  if (directive.is_archived) {
    return false;
  }

  if (isExecutiveRole(session.role) || isAdminRole(session.role)) {
    return true;
  }

  if (directive.owner_user_id === session.userId) {
    return true;
  }

  if (session.departmentId && directive.owner_department_id === session.departmentId) {
    return true;
  }

  return directiveDepartments.some((item) => item.department_id === session.departmentId);
}

function canManageDirectiveLogs(
  session: AppSession,
  directive: DirectiveRow,
  directiveDepartments: DirectiveDepartmentRow[],
) {
  if (isReadOnlyRole(session.role)) {
    return false;
  }

  if (isAdminRole(session.role)) {
    return true;
  }

  if (!session.departmentId) {
    return directive.owner_user_id === session.userId;
  }

  if (directive.owner_user_id === session.userId) {
    return true;
  }

  return (
    directive.owner_department_id === session.departmentId ||
    directiveDepartments.some((item) => item.department_id === session.departmentId)
  );
}

function canRequestDirectiveCompletion(
  session: AppSession,
  directive: DirectiveRow,
  directiveDepartments: DirectiveDepartmentRow[],
  activitySummary: DirectiveActivitySummary,
) {
  if (activitySummary.logCount < 1 || activitySummary.attachmentCount < 1) {
    return false;
  }

  if (directive.status !== "IN_PROGRESS") {
    return false;
  }

  if (isAdminRole(session.role)) {
    return true;
  }

  if (session.role !== "DEPARTMENT_HEAD" || !session.departmentId) {
    return false;
  }

  return (
    directive.owner_department_id === session.departmentId ||
    directiveDepartments.some((item) => item.department_id === session.departmentId)
  );
}

function assertDirectiveViewAccess(
  session: AppSession,
  directive: DirectiveRow,
  directiveDepartments: DirectiveDepartmentRow[],
) {
  if (!canViewDirective(session, directive, directiveDepartments)) {
    throw new ApiError(403, "해당 지시사항을 볼 권한이 없습니다.", null, "DIRECTIVE_ACCESS_DENIED");
  }
}

async function readDirectiveOrThrow(client: SupabaseClient, directiveId: string) {
  const { data, error } = await client.from("directives").select("*").eq("id", directiveId).maybeSingle<DirectiveRow>();

  if (error) {
    throw mapSupabaseError(error, "지시사항을 불러오지 못했습니다.", "DIRECTIVE_LOAD_FAILED");
  }

  if (!data) {
    throw new ApiError(404, "지시사항을 찾을 수 없습니다.", null, "DIRECTIVE_NOT_FOUND");
  }

  return data;
}

async function readDirectiveContext(client: SupabaseClient, directiveId: string) {
  const directive = await readDirectiveOrThrow(client, directiveId);
  const directiveDepartmentsMap = await loadDirectiveDepartmentsMap(client, [directiveId]);
  return {
    directive,
    directiveDepartments: directiveDepartmentsMap.get(directiveId) ?? [],
  };
}

async function updateDirectiveStatus(client: SupabaseClient, directiveId: string, status: DirectiveRow["status"]) {
  const { error } = await client.from("directives").update({ status }).eq("id", directiveId);

  if (error) {
    throw mapSupabaseError(error, "지시사항 상태를 갱신하지 못했습니다.", "DIRECTIVE_STATUS_UPDATE_FAILED");
  }
}

async function updateDirectiveDepartmentStatus(
  client: SupabaseClient,
  directiveId: string,
  status: DirectiveRow["status"],
  options?: { closedAt?: string | null; departmentId?: string | null },
) {
  let query = client
    .from("directive_departments")
    .update({
      department_closed_at: options?.closedAt ?? null,
      department_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("directive_id", directiveId);

  if (options?.departmentId) {
    query = query.eq("department_id", options.departmentId);
  }

  const { error } = await query;

  if (error) {
    throw mapSupabaseError(
      error,
      "지시사항 부서 상태를 갱신하지 못했습니다.",
      "DIRECTIVE_DEPARTMENT_STATUS_UPDATE_FAILED",
    );
  }
}

async function promoteDirectiveToInProgressIfNeeded(
  client: SupabaseClient,
  directive: DirectiveRow,
  departmentId: string | null,
) {
  if (!["NEW", "REJECTED", "DELAYED"].includes(directive.status)) {
    return;
  }

  await updateDirectiveStatus(client, directive.id, "IN_PROGRESS");

  if (departmentId) {
    await updateDirectiveDepartmentStatus(client, directive.id, "IN_PROGRESS", {
      departmentId,
    });
  }
}

function resolveAttachmentFileType(file: File): DirectiveAttachmentRow["file_type"] {
  if (file.type.startsWith("image/")) {
    return "IMAGE";
  }

  if (
    file.type.includes("pdf") ||
    file.type.includes("document") ||
    file.type.includes("sheet") ||
    file.type.includes("presentation")
  ) {
    return "DOCUMENT";
  }

  return "OTHER";
}

async function uploadDirectiveAttachments(options: {
  client: SupabaseClient;
  departmentId: string;
  directiveId: string;
  files: File[];
  logId: string | null;
  uploadedBy: string;
}) {
  const validFiles = options.files.filter((file) => file.size > 0 && file.name);

  if (validFiles.length === 0) {
    return [] as DirectiveAttachmentRow[];
  }

  const rows: Omit<DirectiveAttachmentRow, "uploaded_at">[] = [];

  for (const file of validFiles) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ApiError(
        400,
        `${file.name} 파일은 15MB 이하만 업로드할 수 있습니다.`,
        { size: file.size },
        "ATTACHMENT_TOO_LARGE",
      );
    }

    const safeName = sanitizeFileName(file.name);
    const storagePath = `${options.departmentId}/${options.directiveId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const uploadResult = await options.client.storage
      .from(DIRECTIVE_EVIDENCE_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadResult.error) {
      throw new ApiError(500, "증빙 파일 업로드에 실패했습니다.", uploadResult.error, "ATTACHMENT_UPLOAD_FAILED");
    }

    rows.push({
      directive_id: options.directiveId,
      file_name: file.name,
      file_size: file.size,
      file_type: resolveAttachmentFileType(file),
      file_url: storagePath,
      id: crypto.randomUUID(),
      log_id: options.logId,
      mime_type: file.type || null,
      uploaded_by: options.uploadedBy,
    });
  }

  const insertResult = await options.client.from("directive_attachments").insert(rows).select("*");

  if (insertResult.error) {
    throw mapSupabaseError(insertResult.error, "증빙 메타데이터를 저장하지 못했습니다.", "ATTACHMENT_INSERT_FAILED");
  }

  return (insertResult.data ?? []) as DirectiveAttachmentRow[];
}

function coerceFiles(files?: FormDataEntryValue[]) {
  return (files ?? []).filter((value): value is File => value instanceof File);
}

async function buildAttachmentItems(
  client: SupabaseClient,
  attachments: DirectiveAttachmentRow[],
  userMap: Map<string, UserRecord>,
) {
  const paths = attachments.map((attachment) => attachment.file_url);
  const signedUrlMap = new Map<string, string | null>();

  if (paths.length > 0) {
    const signedUrlResult = await client.storage
      .from(DIRECTIVE_EVIDENCE_BUCKET)
      .createSignedUrls(paths, 60 * 60);

    if (signedUrlResult.error) {
      throw new ApiError(500, "증빙 파일 링크를 생성하지 못했습니다.", signedUrlResult.error, "ATTACHMENT_SIGN_URL_FAILED");
    }

    for (const entry of signedUrlResult.data ?? []) {
      if (entry.path) {
        signedUrlMap.set(entry.path, entry.signedUrl ?? null);
      }
    }
  }

  return attachments.map<DirectiveAttachmentItem>((attachment) => ({
    downloadUrl: signedUrlMap.get(attachment.file_url) ?? null,
    fileName: attachment.file_name,
    fileSize: attachment.file_size,
    fileType: attachment.file_type,
    id: attachment.id,
    isImage: attachment.file_type === "IMAGE",
    logId: attachment.log_id,
    mimeType: attachment.mime_type,
    uploadedAt: attachment.uploaded_at,
    uploadedBy: attachment.uploaded_by,
    uploadedByName: buildUserDisplayName(userMap.get(attachment.uploaded_by)) ?? null,
  }));
}

async function buildRecentUpdates(
  client: SupabaseClient,
  directiveItems: DirectiveListItem[],
  accessibleIds: string[] | null,
  limit = 8,
) {
  const directiveMap = new Map(directiveItems.map((item) => [item.id, item]));
  let query = client
    .from("directive_logs")
    .select("*")
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (accessibleIds && accessibleIds.length > 0) {
    query = query.in("directive_id", accessibleIds);
  }

  if (accessibleIds && accessibleIds.length === 0) {
    return [] as DashboardRecentUpdate[];
  }

  const { data, error } = await query;

  if (error) {
    throw mapSupabaseError(error, "최근 업데이트를 불러오지 못했습니다.", "RECENT_UPDATES_FAILED");
  }

  const logs = (data ?? []) as DirectiveLogRow[];
  const usersMap = await loadUsersMap(client, logs.map((log) => log.user_id));

  return logs
    .map<DashboardRecentUpdate | null>((log) => {
      const directive = directiveMap.get(log.directive_id);

      if (!directive) {
        return null;
      }

      const meta = decodeLogMeta(log.detail, log.updated_at ?? log.created_at);
      return {
        actionSummary: log.action_summary,
        directiveId: directive.id,
        directiveNo: directive.directiveNo,
        directiveTitle: directive.title,
        happenedAt: meta.happenedAt,
        logType: meta.logType,
        userName: buildUserDisplayName(usersMap.get(log.user_id)),
      };
    })
    .filter((item): item is DashboardRecentUpdate => Boolean(item))
    .slice(0, limit);
}

export async function createDirectiveAsSession(session: AppSession, input: CreateDirectiveInput) {
  if (!isAdminRole(session.role) && !isExecutiveRole(session.role)) {
    throw new ApiError(403, "지시사항을 생성할 권한이 없습니다.", null, "DIRECTIVE_CREATE_DENIED");
  }

  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const departmentsMap = await loadDepartmentsMap(client, [input.ownerDepartmentId]);
  const department = departmentsMap.get(input.ownerDepartmentId);

  if (!department) {
    throw new ApiError(404, "담당 부서를 찾을 수 없습니다.", null, "DIRECTIVE_OWNER_DEPARTMENT_NOT_FOUND");
  }

  for (let attempt = 0; attempt < MAX_DIRECTIVE_NUMBER_RETRIES; attempt += 1) {
    const generatedDirectiveNumber = await generateDirectiveNumber(client, now);
    const insertResult = await client
      .from("directives")
      .insert({
        content: input.content,
        created_by: session.userId,
        directive_no: generatedDirectiveNumber.directiveNo,
        due_date: input.dueDate,
        id: crypto.randomUUID(),
        is_archived: false,
        is_urgent: input.isUrgent,
        owner_department_id: input.ownerDepartmentId,
        owner_user_id: input.ownerUserId,
        sequence: generatedDirectiveNumber.sequence,
        status: "NEW",
        title: input.title,
        urgent_level: input.urgentLevel,
        year_month: buildYearMonthValue(now),
      })
      .select("*")
      .single<DirectiveRow>();

    if (insertResult.error) {
      if (isDirectiveNumberConflict(insertResult.error)) {
        continue;
      }

      throw mapSupabaseError(insertResult.error, "지시사항을 생성하지 못했습니다.", "DIRECTIVE_CREATE_FAILED");
    }

    const departmentLink = await client.from("directive_departments").insert({
      assigned_at: now,
      department_closed_at: null,
      department_due_date: input.dueDate,
      department_head_id: department.head_user_id,
      department_id: input.ownerDepartmentId,
      department_status: "NEW",
      directive_id: insertResult.data.id,
      id: crypto.randomUUID(),
      updated_at: now,
    });

    if (departmentLink.error) {
      throw mapSupabaseError(
        departmentLink.error,
        "지시사항 부서 배정을 저장하지 못했습니다.",
        "DIRECTIVE_DEPARTMENT_LINK_FAILED",
      );
    }

    await recordHistory(client, {
      action: "DIRECTIVE_CREATED",
      actorId: session.userId,
      afterData: insertResult.data,
      entityId: insertResult.data.id,
      entityType: "directive",
      metadata: {
        directiveNo: insertResult.data.directive_no,
      },
    });

    return insertResult.data;
  }

  throw new ApiError(409, "관리번호를 생성하지 못했습니다. 다시 시도해 주세요.", null, "DIRECTIVE_NO_CONFLICT");
}

export async function listDirectivesForSession(
  session: AppSession,
  filters: DirectiveListFilters,
): Promise<PaginatedDirectives> {
  const client = createSupabaseServerClient();
  const accessibleIds = await getAccessibleDirectiveIds(client, session);

  if (accessibleIds && accessibleIds.length === 0) {
    return {
      items: [],
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: 0,
        totalPages: 1,
      },
    };
  }

  let query = client
    .from("directives")
    .select(
      "id, directive_no, title, content, due_date, status, owner_department_id, owner_user_id, created_by, is_archived, created_at, is_urgent, urgent_level",
      { count: "exact" },
    )
    .eq("is_archived", false);

  if (accessibleIds) {
    query = query.in("id", accessibleIds);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.search) {
    const searchTerm = sanitizeSearchTerm(filters.search);

    if (searchTerm) {
      query = query.or(
        [`directive_no.ilike.*${searchTerm}*`, `title.ilike.*${searchTerm}*`, `content.ilike.*${searchTerm}*`].join(","),
      );
    }
  }

  query = query
    .order("is_urgent", { ascending: false })
    .order("urgent_level", { ascending: false, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw mapSupabaseError(error, "지시사항 목록을 불러오지 못했습니다.", "DIRECTIVE_LIST_FAILED");
  }

  const rows = (data ?? []) as DirectiveRow[];
  const activityMaps = await loadActivityMaps(client, rows.map((row) => row.id));
  const departmentsMap = await loadDepartmentsMap(client, rows.map((row) => row.owner_department_id));
  const usersMap = await loadUsersMap(client, rows.map((row) => row.owner_user_id));
  const items = rows.map((row) => mapDirectiveSummary(row, departmentsMap, usersMap, activityMaps));
  const total = count ?? 0;

  return {
    items,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  };
}

export async function getDirectiveDetailForSession(session: AppSession, directiveId: string): Promise<DirectiveDetail> {
  const client = createSupabaseServerClient();
  const { directive, directiveDepartments } = await readDirectiveContext(client, directiveId);
  assertDirectiveViewAccess(session, directive, directiveDepartments);

  const [logsResult, attachmentsResult, departmentsMap] = await Promise.all([
    client
      .from("directive_logs")
      .select("*")
      .eq("directive_id", directiveId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    client.from("directive_attachments").select("*").eq("directive_id", directiveId).order("uploaded_at", { ascending: false }),
    loadDepartmentsMap(client, [directive.owner_department_id, ...directiveDepartments.map((item) => item.department_id)]),
  ]);

  if (logsResult.error) {
    throw mapSupabaseError(logsResult.error, "행동 로그를 불러오지 못했습니다.", "DIRECTIVE_LOGS_LOAD_FAILED");
  }

  if (attachmentsResult.error) {
    throw mapSupabaseError(attachmentsResult.error, "증빙 목록을 불러오지 못했습니다.", "DIRECTIVE_ATTACHMENTS_LOAD_FAILED");
  }

  const logs = (logsResult.data ?? []) as DirectiveLogRow[];
  const visibleLogIds = new Set(logs.map((log) => log.id));
  const attachments = ((attachmentsResult.data ?? []) as DirectiveAttachmentRow[]).filter(
    (attachment) => !attachment.log_id || visibleLogIds.has(attachment.log_id),
  );
  const usersMap = await loadUsersMap(client, [
    directive.created_by,
    directive.owner_user_id,
    ...logs.map((log) => log.user_id),
    ...attachments.map((attachment) => attachment.uploaded_by),
  ]);
  const attachmentItems = await buildAttachmentItems(client, attachments, usersMap);
  const attachmentCountByLogId = new Map<string, number>();

  for (const attachment of attachmentItems) {
    if (!attachment.logId) {
      continue;
    }

    attachmentCountByLogId.set(attachment.logId, (attachmentCountByLogId.get(attachment.logId) ?? 0) + 1);
  }

  const logItems = logs
    .map<DirectiveLogItem>((log) => {
      const meta = decodeLogMeta(log.detail, log.updated_at ?? log.created_at);

      return {
        actionSummary: log.action_summary,
        attachmentCount: attachmentCountByLogId.get(log.id) ?? 0,
        createdAt: log.created_at,
        deleteReason: log.delete_reason,
        deletedAt: log.deleted_at,
        deletedBy: log.deleted_by,
        departmentId: log.department_id,
        departmentName: departmentsMap.get(log.department_id)?.name ?? null,
        detail: meta.detail,
        directiveId: log.directive_id,
        happenedAt: meta.happenedAt,
        id: log.id,
        isDeleted: log.is_deleted,
        logType: meta.logType,
        nextAction: meta.nextAction,
        riskNote: meta.riskNote,
        updatedAt: log.updated_at,
        userId: log.user_id,
        userName: buildUserDisplayName(usersMap.get(log.user_id)),
      };
    })
    .sort((left, right) => new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime());

  const activitySummary: DirectiveActivitySummary = {
    attachmentCount: attachmentItems.length,
    lastActivityAt:
      logItems[0]?.updatedAt ??
      logItems[0]?.happenedAt ??
      attachmentItems[0]?.uploadedAt ??
      directive.created_at,
    logCount: logItems.length,
  };

  return {
    ...activitySummary,
    attachments: attachmentItems,
    content: directive.content,
    createdAt: directive.created_at,
    createdBy: directive.created_by,
    createdByName: buildUserDisplayName(usersMap.get(directive.created_by)),
    directiveNo: directive.directive_no,
    dueDate: directive.due_date,
    id: directive.id,
    isArchived: directive.is_archived,
    isDelayed: computeIsDelayed(directive.due_date, directive.status),
    isUrgent: directive.is_urgent,
    logs: logItems,
    ownerDepartmentId: directive.owner_department_id,
    ownerDepartmentName: directive.owner_department_id
      ? departmentsMap.get(directive.owner_department_id)?.name ?? null
      : null,
    ownerUserId: directive.owner_user_id,
    ownerUserName: buildUserDisplayName(usersMap.get(directive.owner_user_id ?? "")),
    status: directive.status,
    title: directive.title,
    urgentLevel: directive.urgent_level,
    workflow: {
      canApprove: isAdminRole(session.role) && directive.status === "COMPLETION_REQUESTED",
      canCreateDirective: isAdminRole(session.role) || isExecutiveRole(session.role),
      canManageLogs: canManageDirectiveLogs(session, directive, directiveDepartments),
      canReject: isAdminRole(session.role) && directive.status === "COMPLETION_REQUESTED",
      canRequestCompletion: canRequestDirectiveCompletion(session, directive, directiveDepartments, activitySummary),
      isReadOnly: isReadOnlyRole(session.role),
    },
  };
}

export async function createDirectiveLogAsSession(
  session: AppSession,
  input: CreateDirectiveLogInput,
  files?: FormDataEntryValue[],
) {
  const client = createSupabaseServerClient();
  const { directive, directiveDepartments } = await readDirectiveContext(client, input.directiveId);
  assertDirectiveViewAccess(session, directive, directiveDepartments);

  if (!canManageDirectiveLogs(session, directive, directiveDepartments)) {
    throw new ApiError(403, "행동 로그를 등록할 권한이 없습니다.", null, "DIRECTIVE_LOG_CREATE_DENIED");
  }

  const departmentId =
    session.departmentId ??
    directive.owner_department_id ??
    directiveDepartments[0]?.department_id;

  if (!departmentId) {
    throw new ApiError(400, "로그를 남길 부서 정보를 확인할 수 없습니다.", null, "DIRECTIVE_LOG_DEPARTMENT_REQUIRED");
  }

  const insertResult = await client
    .from("directive_logs")
    .insert({
      action_summary: input.actionSummary,
      department_id: departmentId,
      detail: encodeLogMeta({
        detail: input.detail,
        happenedAt: input.happenedAt,
        logType: input.logType,
        nextAction: input.nextAction,
        riskNote: input.riskNote,
      }),
      directive_id: input.directiveId,
      id: crypto.randomUUID(),
      user_id: session.userId,
    })
    .select("*")
    .single<DirectiveLogRow>();

  if (insertResult.error) {
    throw mapSupabaseError(insertResult.error, "행동 로그를 저장하지 못했습니다.", "DIRECTIVE_LOG_CREATE_FAILED");
  }

  const uploadedAttachments = await uploadDirectiveAttachments({
    client,
    departmentId,
    directiveId: input.directiveId,
    files: coerceFiles(files),
    logId: insertResult.data.id,
    uploadedBy: session.userId,
  });

  await promoteDirectiveToInProgressIfNeeded(client, directive, departmentId);
  await recordHistory(client, {
    action: "DIRECTIVE_LOG_CREATED",
    actorId: session.userId,
    afterData: insertResult.data,
    entityId: insertResult.data.id,
    entityType: "directive_log",
    metadata: {
      attachmentCount: uploadedAttachments.length,
      directiveId: directive.id,
      directiveNo: directive.directive_no,
    },
  });

  return insertResult.data;
}

export async function updateDirectiveLogAsSession(
  session: AppSession,
  input: UpdateDirectiveLogInput,
  files?: FormDataEntryValue[],
) {
  const client = createSupabaseServerClient();
  const { directive, directiveDepartments } = await readDirectiveContext(client, input.directiveId);
  assertDirectiveViewAccess(session, directive, directiveDepartments);

  if (!canManageDirectiveLogs(session, directive, directiveDepartments)) {
    throw new ApiError(403, "행동 로그를 수정할 권한이 없습니다.", null, "DIRECTIVE_LOG_UPDATE_DENIED");
  }

  const existingLog = await client
    .from("directive_logs")
    .select("*")
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .eq("is_deleted", false)
    .maybeSingle<DirectiveLogRow>();

  if (existingLog.error) {
    throw mapSupabaseError(existingLog.error, "기존 로그를 불러오지 못했습니다.", "DIRECTIVE_LOG_EXISTING_FAILED");
  }

  if (!existingLog.data) {
    throw new ApiError(404, "수정할 로그를 찾을 수 없습니다.", null, "DIRECTIVE_LOG_NOT_FOUND");
  }

  const departmentId =
    session.departmentId ??
    existingLog.data.department_id ??
    directive.owner_department_id ??
    directiveDepartments[0]?.department_id;

  if (!departmentId) {
    throw new ApiError(400, "로그 부서를 확인할 수 없습니다.", null, "DIRECTIVE_LOG_DEPARTMENT_REQUIRED");
  }

  const updateResult = await client
    .from("directive_logs")
    .update({
      action_summary: input.actionSummary,
      department_id: departmentId,
      detail: encodeLogMeta({
        detail: input.detail,
        happenedAt: input.happenedAt,
        logType: input.logType,
        nextAction: input.nextAction,
        riskNote: input.riskNote,
      }),
      updated_at: new Date().toISOString(),
      user_id: session.userId,
    })
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .select("*")
    .single<DirectiveLogRow>();

  if (updateResult.error) {
    throw mapSupabaseError(updateResult.error, "행동 로그를 수정하지 못했습니다.", "DIRECTIVE_LOG_UPDATE_FAILED");
  }

  const uploadedAttachments = await uploadDirectiveAttachments({
    client,
    departmentId,
    directiveId: input.directiveId,
    files: coerceFiles(files),
    logId: input.logId,
    uploadedBy: session.userId,
  });

  await promoteDirectiveToInProgressIfNeeded(client, directive, departmentId);
  await recordHistory(client, {
    action: "DIRECTIVE_LOG_UPDATED",
    actorId: session.userId,
    afterData: updateResult.data,
    beforeData: existingLog.data,
    entityId: updateResult.data.id,
    entityType: "directive_log",
    metadata: {
      attachmentCount: uploadedAttachments.length,
      directiveId: directive.id,
      directiveNo: directive.directive_no,
    },
  });

  return updateResult.data;
}

export async function softDeleteDirectiveLogAsSession(session: AppSession, input: DeleteDirectiveLogInput) {
  const client = createSupabaseServerClient();
  const { directive, directiveDepartments } = await readDirectiveContext(client, input.directiveId);
  assertDirectiveViewAccess(session, directive, directiveDepartments);

  if (!canManageDirectiveLogs(session, directive, directiveDepartments)) {
    throw new ApiError(403, "행동 로그를 비노출 처리할 권한이 없습니다.", null, "DIRECTIVE_LOG_DELETE_DENIED");
  }

  const existingLog = await client
    .from("directive_logs")
    .select("*")
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .eq("is_deleted", false)
    .maybeSingle<DirectiveLogRow>();

  if (existingLog.error) {
    throw mapSupabaseError(existingLog.error, "행동 로그를 불러오지 못했습니다.", "DIRECTIVE_LOG_DELETE_LOAD_FAILED");
  }

  if (!existingLog.data) {
    throw new ApiError(404, "비노출 처리할 로그를 찾을 수 없습니다.", null, "DIRECTIVE_LOG_NOT_FOUND");
  }

  const now = new Date().toISOString();
  const updateResult = await client
    .from("directive_logs")
    .update({
      delete_reason: input.reason,
      deleted_at: now,
      deleted_by: session.userId,
      is_deleted: true,
      updated_at: now,
    })
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .select("*")
    .single<DirectiveLogRow>();

  if (updateResult.error) {
    throw mapSupabaseError(updateResult.error, "행동 로그를 비노출 처리하지 못했습니다.", "DIRECTIVE_LOG_DELETE_FAILED");
  }

  await recordHistory(client, {
    action: "DIRECTIVE_LOG_SOFT_DELETED",
    actorId: session.userId,
    afterData: updateResult.data,
    beforeData: existingLog.data,
    entityId: updateResult.data.id,
    entityType: "directive_log",
    metadata: {
      directiveId: directive.id,
      directiveNo: directive.directive_no,
      reason: input.reason,
    },
  });

  return updateResult.data;
}

export async function requestDirectiveCompletionAsSession(session: AppSession, input: WorkflowDecisionInput) {
  const client = createSupabaseServerClient();
  const detail = await getDirectiveDetailForSession(session, input.directiveId);

  if (!detail.workflow.canRequestCompletion) {
    throw new ApiError(
      400,
      "완료 요청은 진행 중 상태에서 실행 로그와 증빙이 모두 있어야 가능합니다.",
      null,
      "DIRECTIVE_COMPLETION_REQUEST_DENIED",
    );
  }

  await updateDirectiveStatus(client, input.directiveId, "COMPLETION_REQUESTED");
  await updateDirectiveDepartmentStatus(client, input.directiveId, "COMPLETION_REQUESTED", {
    departmentId: session.departmentId,
  });
  await recordHistory(client, {
    action: "DIRECTIVE_COMPLETION_REQUESTED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      reason: input.reason,
    },
  });
}

export async function approveDirectiveCompletionAsSession(session: AppSession, input: WorkflowDecisionInput) {
  if (!isAdminRole(session.role)) {
    throw new ApiError(403, "완료 승인 권한이 없습니다.", null, "DIRECTIVE_APPROVE_DENIED");
  }

  const client = createSupabaseServerClient();
  const directive = await readDirectiveOrThrow(client, input.directiveId);

  if (directive.status !== "COMPLETION_REQUESTED") {
    throw new ApiError(400, "승인 대기 상태의 지시사항만 승인할 수 있습니다.", null, "DIRECTIVE_APPROVE_INVALID_STATUS");
  }

  const closedAt = new Date().toISOString();
  await updateDirectiveStatus(client, input.directiveId, "COMPLETED");
  await updateDirectiveDepartmentStatus(client, input.directiveId, "COMPLETED", {
    closedAt,
  });
  await recordHistory(client, {
    action: "DIRECTIVE_APPROVED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      closedAt,
      reason: input.reason,
    },
  });
}

export async function rejectDirectiveCompletionAsSession(session: AppSession, input: WorkflowDecisionInput) {
  if (!isAdminRole(session.role)) {
    throw new ApiError(403, "반려 권한이 없습니다.", null, "DIRECTIVE_REJECT_DENIED");
  }

  const client = createSupabaseServerClient();
  const directive = await readDirectiveOrThrow(client, input.directiveId);

  if (directive.status !== "COMPLETION_REQUESTED") {
    throw new ApiError(400, "승인 대기 상태의 지시사항만 반려할 수 있습니다.", null, "DIRECTIVE_REJECT_INVALID_STATUS");
  }

  await updateDirectiveStatus(client, input.directiveId, "REJECTED");
  await updateDirectiveDepartmentStatus(client, input.directiveId, "REJECTED");
  await recordHistory(client, {
    action: "DIRECTIVE_REJECTED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      reason: input.reason,
    },
  });
}

async function loadDirectiveItemsForDashboard(client: SupabaseClient, session: AppSession) {
  const accessibleIds = await getAccessibleDirectiveIds(client, session);

  if (accessibleIds && accessibleIds.length === 0) {
    return { accessibleIds, items: [] as DirectiveListItem[] };
  }

  let query = client
    .from("directives")
    .select(
      "id, directive_no, title, content, due_date, status, owner_department_id, owner_user_id, created_by, is_archived, created_at, is_urgent, urgent_level",
    )
    .eq("is_archived", false);

  if (accessibleIds) {
    query = query.in("id", accessibleIds);
  }

  const { data, error } = await query
    .order("is_urgent", { ascending: false })
    .order("urgent_level", { ascending: false, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw mapSupabaseError(error, "대시보드용 지시사항을 불러오지 못했습니다.", "DASHBOARD_DIRECTIVE_LOAD_FAILED");
  }

  const rows = (data ?? []) as DirectiveRow[];
  const activityMaps = await loadActivityMaps(client, rows.map((row) => row.id));
  const departmentsMap = await loadDepartmentsMap(client, rows.map((row) => row.owner_department_id));
  const usersMap = await loadUsersMap(client, rows.map((row) => row.owner_user_id));

  return {
    accessibleIds,
    items: rows.map((row) => mapDirectiveSummary(row, departmentsMap, usersMap, activityMaps)),
  };
}

export async function getDashboardData(session: AppSession): Promise<DashboardData> {
  if (!canViewDashboard(session.role) && !isAdminRole(session.role)) {
    throw new ApiError(403, "대시보드를 볼 권한이 없습니다.", null, "DASHBOARD_ACCESS_DENIED");
  }

  const client = createSupabaseServerClient();
  const { accessibleIds, items } = await loadDirectiveItemsForDashboard(client, session);
  const recentUpdates = await buildRecentUpdates(client, items, accessibleIds, 8);

  return {
    delayedItems: items.filter((item) => item.isDelayed).slice(0, 6),
    kpis: [
      { label: "전체 건수", tone: "default", value: items.length },
      { label: "진행 중", tone: "muted", value: items.filter((item) => item.status === "IN_PROGRESS").length },
      { label: "지연", tone: "warning", value: items.filter((item) => item.isDelayed).length },
      { label: "완료", tone: "success", value: items.filter((item) => item.status === "COMPLETED").length },
      { label: "긴급", tone: "danger", value: items.filter((item) => item.isUrgent).length },
    ],
    recentUpdates,
    urgentItems: items.filter((item) => item.isUrgent && item.status !== "COMPLETED").slice(0, 6),
    waitingApprovalItems: items.filter((item) => item.status === "COMPLETION_REQUESTED").slice(0, 6),
  };
}

export async function getDepartmentBoardData(session: AppSession): Promise<DepartmentBoardData> {
  if (!session.departmentId) {
    throw new ApiError(403, "부서 실행보드는 부서 계정만 볼 수 있습니다.", null, "DEPARTMENT_BOARD_ACCESS_DENIED");
  }

  const client = createSupabaseServerClient();
  const { accessibleIds, items } = await loadDirectiveItemsForDashboard(client, session);
  const recentUpdates = await buildRecentUpdates(client, items, accessibleIds, 6);
  const now = Date.now();
  const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;
  const missingEvidenceItems = items
    .filter((item) => item.status !== "COMPLETED" && item.attachmentCount === 0)
    .slice(0, 6);

  return {
    dueSoonItems: items
      .filter((item) => item.dueDate)
      .filter((item) => {
        const target = new Date(item.dueDate as string).getTime();
        return target >= now && target <= sevenDaysLater && item.status !== "COMPLETED";
      })
      .slice(0, 6),
    kpis: [
      { label: "배정 건수", tone: "default", value: items.length },
      { label: "진행 중", tone: "muted", value: items.filter((item) => item.status === "IN_PROGRESS").length },
      { label: "승인 대기", tone: "default", value: items.filter((item) => item.status === "COMPLETION_REQUESTED").length },
      { label: "지연", tone: "warning", value: items.filter((item) => item.isDelayed).length },
      { label: "증빙 필요", tone: "danger", value: missingEvidenceItems.length },
    ],
    missingEvidenceItems,
    recentUpdates,
    urgentItems: items.filter((item) => item.isUrgent && item.status !== "COMPLETED").slice(0, 6),
    waitingApprovalItems: items.filter((item) => item.status === "COMPLETION_REQUESTED").slice(0, 6),
  };
}
