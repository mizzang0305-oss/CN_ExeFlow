import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { AppSession } from "@/features/auth/types";
import { isExecutiveRole } from "@/features/auth/utils";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";
import { sanitizeFileName } from "@/lib/utils";

import type {
  CreateDirectiveInput,
  CreateDirectiveLogInput,
  DashboardData,
  DashboardRecentUpdate,
  DepartmentRecord,
  DeleteDirectiveLogInput,
  DirectiveAttachmentItem,
  DirectiveAttachmentRow,
  DirectiveDetail,
  DirectiveListFilters,
  DirectiveListItem,
  DirectiveLogItem,
  DirectiveLogRow,
  DirectiveRow,
  PaginatedDirectives,
  UpdateDirectiveLogInput,
  UserRecord,
} from "./types";

const DIRECTIVE_NUMBER_PREFIX = "CN";
const DIRECTIVE_EVIDENCE_BUCKET = "directive-evidence";
const MAX_DIRECTIVE_NUMBER_RETRIES = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

function computeIsDelayed(dueDate: string | null, status: string) {
  if (!dueDate) {
    return false;
  }

  if (status === "COMPLETED") {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[,*]/g, " ").trim();
}

function mapSupabaseError(error: PostgrestError, fallbackMessage: string) {
  if (error.code === "23505") {
    return new ApiError(409, "중복된 데이터가 이미 존재합니다.", error);
  }

  if (error.code === "23503") {
    return new ApiError(400, "연결된 참조 데이터가 존재하지 않습니다.", error);
  }

  if (error.code === "42P01" || error.code === "42703") {
    return new ApiError(
      500,
      "필수 Supabase 테이블 또는 컬럼이 없습니다. migration SQL을 먼저 적용해 주세요.",
      error,
    );
  }

  return new ApiError(500, fallbackMessage, error);
}

function isDirectiveNumberConflict(error: PostgrestError) {
  const detail = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return error.code === "23505" && detail.includes("directive_no");
}

function buildDirectiveNumberPrefix(instructedAt: string) {
  const date = new Date(instructedAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${DIRECTIVE_NUMBER_PREFIX}-${year}-${month}-`;
}

async function generateDirectiveNumber(instructedAt: string) {
  const client = createSupabaseServerClient();
  const prefix = buildDirectiveNumberPrefix(instructedAt);
  const { data, error } = await client
    .from("directives")
    .select("directive_no")
    .like("directive_no", `${prefix}%`)
    .order("directive_no", { ascending: false })
    .limit(1);

  if (error) {
    throw mapSupabaseError(error, "관리번호를 생성하지 못했습니다.");
  }

  const latestDirectiveNumber = data?.[0]?.directive_no as string | undefined;
  const nextSequence = latestDirectiveNumber
    ? Number.parseInt(latestDirectiveNumber.slice(-3), 10) + 1
    : 1;

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
}

function getScopedDepartmentId(session: AppSession) {
  if (isExecutiveRole(session.role)) {
    return null;
  }

  if (!session.departmentId) {
    throw new ApiError(403, "부서 정보가 없는 사용자는 지시사항을 조회할 수 없습니다.");
  }

  return session.departmentId;
}

async function loadDepartmentsMap(
  client: SupabaseClient,
  departmentIds: Array<string | null | undefined>,
) {
  const ids = Array.from(new Set(departmentIds.filter(Boolean) as string[]));

  if (ids.length === 0) {
    return new Map<string, DepartmentRecord>();
  }

  const { data, error } = await client
    .from("departments")
    .select("id, code, name")
    .in("id", ids);

  if (error) {
    throw mapSupabaseError(error, "부서 정보를 불러오지 못했습니다.");
  }

  return new Map(
    ((data ?? []) as DepartmentRecord[]).map((department) => [
      department.id,
      department,
    ]),
  );
}

async function loadUsersMap(
  client: SupabaseClient,
  userIds: Array<string | null | undefined>,
) {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));

  if (ids.length === 0) {
    return new Map<string, UserRecord>();
  }

  const { data, error } = await client
    .from("users")
    .select("id, name, department_id, role")
    .in("id", ids);

  if (error) {
    throw mapSupabaseError(error, "사용자 정보를 불러오지 못했습니다.");
  }

  return new Map(((data ?? []) as UserRecord[]).map((user) => [user.id, user]));
}

function canManageDirectiveLogs(session: AppSession, directive: DirectiveRow) {
  if (session.role === "SUPER_ADMIN") {
    return true;
  }

  if (session.role === "DEPARTMENT_HEAD" || session.role === "STAFF") {
    return Boolean(
      session.departmentId &&
        directive.owner_department_id &&
        session.departmentId === directive.owner_department_id,
    );
  }

  return false;
}

function assertCanViewDirective(session: AppSession, directive: DirectiveRow) {
  if (directive.is_archived) {
    throw new ApiError(410, "보관 처리된 지시사항입니다.");
  }

  if (isExecutiveRole(session.role)) {
    return;
  }

  if (!session.departmentId || directive.owner_department_id !== session.departmentId) {
    throw new ApiError(403, "해당 지시사항을 볼 수 있는 권한이 없습니다.");
  }
}

async function readDirectiveRow(
  client: SupabaseClient,
  directiveId: string,
) {
  const directiveQuery = await client
    .from("directives")
    .select("*")
    .eq("id", directiveId)
    .maybeSingle<DirectiveRow>();

  if (directiveQuery.error) {
    throw mapSupabaseError(directiveQuery.error, "지시사항을 불러오지 못했습니다.");
  }

  if (!directiveQuery.data) {
    throw new ApiError(404, "지시사항을 찾을 수 없습니다.");
  }

  return directiveQuery.data;
}

async function touchDirective(client: SupabaseClient, directiveId: string) {
  const now = new Date().toISOString();
  const updateQuery = await client
    .from("directives")
    .update({ updated_at: now })
    .eq("id", directiveId);

  if (updateQuery.error) {
    throw mapSupabaseError(updateQuery.error, "지시사항의 최신 상태를 반영하지 못했습니다.");
  }
}

function resolveFileType(file: File): DirectiveAttachmentRow["file_type"] {
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
  directiveId: string;
  files: File[];
  logId: string | null;
  uploadedBy: string;
}) {
  const validFiles = options.files.filter((file) => file.size > 0 && file.name);

  if (validFiles.length === 0) {
    return [] as DirectiveAttachmentRow[];
  }

  const insertedRows: Omit<DirectiveAttachmentRow, "uploaded_at">[] = [];

  for (const file of validFiles) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ApiError(
        400,
        `${file.name} 파일이 너무 큽니다. 15MB 이하 파일만 업로드할 수 있습니다.`,
      );
    }

    const extensionSafeName = sanitizeFileName(file.name);
    const storagePath =
      `${options.directiveId}/${options.logId ?? "general"}/${Date.now()}-${crypto.randomUUID()}-${extensionSafeName}`;

    const uploadResult = await options.client.storage
      .from(DIRECTIVE_EVIDENCE_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadResult.error) {
      throw new ApiError(500, "증빙 파일 업로드에 실패했습니다.", uploadResult.error);
    }

    insertedRows.push({
      directive_id: options.directiveId,
      file_name: file.name,
      file_size: file.size,
      file_type: resolveFileType(file),
      file_url: storagePath,
      id: crypto.randomUUID(),
      log_id: options.logId,
      mime_type: file.type || null,
      uploaded_by: options.uploadedBy,
    });
  }

  const attachmentInsert = await options.client
    .from("directive_attachments")
    .insert(insertedRows)
    .select("*");

  if (attachmentInsert.error) {
    throw mapSupabaseError(attachmentInsert.error, "증빙 메타데이터를 저장하지 못했습니다.");
  }

  return (attachmentInsert.data ?? []) as DirectiveAttachmentRow[];
}

async function buildAttachmentItems(
  client: SupabaseClient,
  attachments: DirectiveAttachmentRow[],
  userMap: Map<string, UserRecord>,
) {
  const paths = attachments.map((attachment) => attachment.file_url);

  let signedUrlMap = new Map<string, string | null>();

  if (paths.length > 0) {
    const signedUrlQuery = await client.storage
      .from(DIRECTIVE_EVIDENCE_BUCKET)
      .createSignedUrls(paths, 60 * 60);

    if (signedUrlQuery.error) {
      throw new ApiError(500, "증빙 링크를 생성하지 못했습니다.", signedUrlQuery.error);
    }

    signedUrlMap = new Map<string, string | null>();

    for (const entry of signedUrlQuery.data ?? []) {
      if (typeof entry.path === "string" && entry.path.length > 0) {
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
    uploadedByName: userMap.get(attachment.uploaded_by)?.name ?? null,
  }));
}

function mapDirectiveSummary(
  directive: DirectiveRow,
  departmentMap: Map<string, DepartmentRecord>,
): DirectiveListItem {
  const ownerDepartment = directive.owner_department_id
    ? departmentMap.get(directive.owner_department_id)
    : null;

  return {
    directiveNo: directive.directive_no,
    dueDate: directive.due_date,
    id: directive.id,
    isDelayed: computeIsDelayed(directive.due_date, directive.status),
    isUrgent: directive.is_urgent,
    ownerDepartmentCode: ownerDepartment?.code ?? null,
    ownerDepartmentName: ownerDepartment?.name ?? null,
    priority: directive.priority,
    status: directive.status,
    title: directive.title,
    updatedAt: directive.updated_at,
    urgentLevel: directive.urgent_level,
  };
}

export async function createDirective(input: CreateDirectiveInput) {
  const client = createSupabaseServerClient();

  for (let attempt = 0; attempt < MAX_DIRECTIVE_NUMBER_RETRIES; attempt += 1) {
    const directiveNo = await generateDirectiveNumber(input.instructedAt);
    const directiveInsert = await client
      .from("directives")
      .insert({
        close_reason: null,
        closed_at: null,
        content: input.content,
        created_by: input.createdBy,
        directive_no: directiveNo,
        due_date: input.dueDate,
        id: crypto.randomUUID(),
        instructed_at: input.instructedAt,
        is_archived: false,
        is_urgent: input.isUrgent,
        owner_department_id: input.ownerDepartmentId,
        owner_user_id: input.ownerUserId,
        priority: input.priority,
        source_type: input.sourceType,
        status: "NEW",
        title: input.title,
        urgent_level: input.urgentLevel,
      })
      .select("*")
      .single<DirectiveRow>();

    if (directiveInsert.error) {
      if (isDirectiveNumberConflict(directiveInsert.error)) {
        continue;
      }

      throw mapSupabaseError(directiveInsert.error, "지시사항을 생성하지 못했습니다.");
    }

    await recordHistory(client, {
      action: "DIRECTIVE_CREATED",
      actorId: input.createdBy,
      afterData: directiveInsert.data,
      entityId: directiveInsert.data.id,
      entityType: "directive",
      metadata: {
        directiveNo: directiveInsert.data.directive_no,
      },
    });

    return directiveInsert.data;
  }

  throw new ApiError(409, "고유한 관리번호를 생성하지 못했습니다. 다시 시도해 주세요.");
}

export async function listDirectivesForSession(
  session: AppSession,
  filters: DirectiveListFilters,
): Promise<PaginatedDirectives> {
  const client = createSupabaseServerClient();
  let query = client
    .from("directives")
    .select(
      "id, directive_no, title, status, priority, due_date, updated_at, owner_department_id, is_urgent, urgent_level",
      { count: "exact" },
    )
    .eq("is_archived", false);
  const scopedDepartmentId = getScopedDepartmentId(session);

  if (scopedDepartmentId) {
    query = query.eq("owner_department_id", scopedDepartmentId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.search) {
    const searchTerm = sanitizeSearchTerm(filters.search);

    if (searchTerm) {
      query = query.or(
        [
          `directive_no.ilike.*${searchTerm}*`,
          `title.ilike.*${searchTerm}*`,
          `content.ilike.*${searchTerm}*`,
        ].join(","),
      );
    }
  }

  query = query
    .order("is_urgent", { ascending: false })
    .order("urgent_level", { ascending: false, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw mapSupabaseError(error, "지시사항 목록을 불러오지 못했습니다.");
  }

  const rows = (data ?? []) as DirectiveRow[];
  const departmentMap = await loadDepartmentsMap(
    client,
    rows.map((row) => row.owner_department_id),
  );
  const items = rows.map((row) => mapDirectiveSummary(row, departmentMap));
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

export async function getDirectiveDetailForSession(
  session: AppSession,
  directiveId: string,
): Promise<DirectiveDetail> {
  const client = createSupabaseServerClient();
  const directive = await readDirectiveRow(client, directiveId);
  assertCanViewDirective(session, directive);

  const logsQuery = await client
    .from("directive_logs")
    .select("*")
    .eq("directive_id", directiveId)
    .eq("is_deleted", false)
    .order("happened_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (logsQuery.error) {
    throw mapSupabaseError(logsQuery.error, "행동 로그를 불러오지 못했습니다.");
  }

  const logs = (logsQuery.data ?? []) as DirectiveLogRow[];
  const visibleLogIds = new Set(logs.map((log) => log.id));
  const attachmentsQuery = await client
    .from("directive_attachments")
    .select("*")
    .eq("directive_id", directiveId)
    .order("uploaded_at", { ascending: false });

  if (attachmentsQuery.error) {
    throw mapSupabaseError(attachmentsQuery.error, "증빙 목록을 불러오지 못했습니다.");
  }

  const rawAttachments = ((attachmentsQuery.data ?? []) as DirectiveAttachmentRow[]).filter(
    (attachment) => !attachment.log_id || visibleLogIds.has(attachment.log_id),
  );

  const departmentMap = await loadDepartmentsMap(client, [
    directive.owner_department_id,
    ...logs.map((log) => log.department_id),
  ]);
  const userMap = await loadUsersMap(client, [
    directive.created_by,
    directive.owner_user_id,
    ...logs.map((log) => log.user_id),
    ...rawAttachments.map((attachment) => attachment.uploaded_by),
  ]);
  const attachments = await buildAttachmentItems(client, rawAttachments, userMap);
  const attachmentCountByLogId = new Map<string, number>();

  for (const attachment of attachments) {
    if (!attachment.logId) {
      continue;
    }

    attachmentCountByLogId.set(
      attachment.logId,
      (attachmentCountByLogId.get(attachment.logId) ?? 0) + 1,
    );
  }

  const ownerDepartment = directive.owner_department_id
    ? departmentMap.get(directive.owner_department_id)
    : null;
  const logsList = logs.map<DirectiveLogItem>((log) => ({
    actionSummary: log.action_summary,
    attachmentCount: attachmentCountByLogId.get(log.id) ?? 0,
    createdAt: log.created_at,
    deleteReason: log.delete_reason,
    deletedAt: log.deleted_at,
    deletedBy: log.deleted_by,
    departmentId: log.department_id,
    departmentName: departmentMap.get(log.department_id)?.name ?? null,
    detail: log.detail,
    directiveId: log.directive_id,
    happenedAt: log.happened_at,
    id: log.id,
    isDeleted: log.is_deleted,
    logType: log.log_type,
    nextAction: log.next_action,
    riskNote: log.risk_note,
    taskId: log.task_id,
    updatedAt: log.updated_at,
    userId: log.user_id,
    userName: userMap.get(log.user_id)?.name ?? null,
  }));

  return {
    attachments,
    canManageLogs: canManageDirectiveLogs(session, directive),
    closeReason: directive.close_reason,
    closedAt: directive.closed_at,
    content: directive.content,
    createdAt: directive.created_at,
    createdBy: directive.created_by,
    createdByName: userMap.get(directive.created_by)?.name ?? null,
    directiveNo: directive.directive_no,
    dueDate: directive.due_date,
    id: directive.id,
    instructedAt: directive.instructed_at,
    isArchived: directive.is_archived,
    isDelayed: computeIsDelayed(directive.due_date, directive.status),
    isUrgent: directive.is_urgent,
    logs: logsList,
    ownerDepartmentId: directive.owner_department_id,
    ownerDepartmentName: ownerDepartment?.name ?? null,
    ownerUserId: directive.owner_user_id,
    ownerUserName: directive.owner_user_id
      ? userMap.get(directive.owner_user_id)?.name ?? null
      : null,
    priority: directive.priority,
    sourceType: directive.source_type,
    status: directive.status,
    title: directive.title,
    updatedAt: directive.updated_at,
    urgentLevel: directive.urgent_level,
  };
}

function coerceFiles(files: FormDataEntryValue[] | undefined) {
  return (files ?? []).filter((value): value is File => value instanceof File);
}

async function createOrUpdateLogAttachments(options: {
  client: SupabaseClient;
  directiveId: string;
  files?: FormDataEntryValue[];
  logId: string;
  uploadedBy: string;
}) {
  return uploadDirectiveAttachments({
    client: options.client,
    directiveId: options.directiveId,
    files: coerceFiles(options.files),
    logId: options.logId,
    uploadedBy: options.uploadedBy,
  });
}

export async function createDirectiveLogAsSession(
  session: AppSession,
  input: CreateDirectiveLogInput,
  files?: FormDataEntryValue[],
) {
  const client = createSupabaseServerClient();
  const directive = await readDirectiveRow(client, input.directiveId);
  assertCanViewDirective(session, directive);

  if (!canManageDirectiveLogs(session, directive)) {
    throw new ApiError(403, "행동 로그를 등록할 수 있는 권한이 없습니다.");
  }

  const insertQuery = await client
    .from("directive_logs")
    .insert({
      action_summary: input.actionSummary,
      department_id: input.departmentId,
      detail: input.detail,
      directive_id: input.directiveId,
      happened_at: input.happenedAt,
      id: crypto.randomUUID(),
      log_type: input.logType,
      next_action: input.nextAction,
      risk_note: input.riskNote,
      task_id: input.taskId,
      updated_at: new Date().toISOString(),
      user_id: input.userId,
    })
    .select("*")
    .single<DirectiveLogRow>();

  if (insertQuery.error) {
    throw mapSupabaseError(insertQuery.error, "행동 로그를 저장하지 못했습니다.");
  }

  const uploadedAttachments = await createOrUpdateLogAttachments({
    client,
    directiveId: input.directiveId,
    files,
    logId: insertQuery.data.id,
    uploadedBy: session.userId,
  });

  await touchDirective(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_LOG_CREATED",
    actorId: session.userId,
    afterData: insertQuery.data,
    entityId: insertQuery.data.id,
    entityType: "directive_log",
    metadata: {
      attachmentCount: uploadedAttachments.length,
      directiveId: directive.id,
      directiveNo: directive.directive_no,
    },
  });

  return insertQuery.data;
}

export async function updateDirectiveLogAsSession(
  session: AppSession,
  input: UpdateDirectiveLogInput,
  files?: FormDataEntryValue[],
) {
  const client = createSupabaseServerClient();
  const directive = await readDirectiveRow(client, input.directiveId);
  assertCanViewDirective(session, directive);

  if (!canManageDirectiveLogs(session, directive)) {
    throw new ApiError(403, "행동 로그를 수정할 수 있는 권한이 없습니다.");
  }

  const existingLogQuery = await client
    .from("directive_logs")
    .select("*")
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .eq("is_deleted", false)
    .maybeSingle<DirectiveLogRow>();

  if (existingLogQuery.error) {
    throw mapSupabaseError(existingLogQuery.error, "기존 행동 로그를 읽지 못했습니다.");
  }

  if (!existingLogQuery.data) {
    throw new ApiError(404, "수정할 행동 로그를 찾을 수 없습니다.");
  }

  const updateQuery = await client
    .from("directive_logs")
    .update({
      action_summary: input.actionSummary,
      department_id: input.departmentId,
      detail: input.detail,
      happened_at: input.happenedAt,
      log_type: input.logType,
      next_action: input.nextAction,
      risk_note: input.riskNote,
      task_id: input.taskId,
      updated_at: new Date().toISOString(),
      user_id: input.userId,
    })
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .select("*")
    .single<DirectiveLogRow>();

  if (updateQuery.error) {
    throw mapSupabaseError(updateQuery.error, "행동 로그를 수정하지 못했습니다.");
  }

  const uploadedAttachments = await createOrUpdateLogAttachments({
    client,
    directiveId: input.directiveId,
    files,
    logId: input.logId,
    uploadedBy: session.userId,
  });

  await touchDirective(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_LOG_UPDATED",
    actorId: session.userId,
    afterData: updateQuery.data,
    beforeData: existingLogQuery.data,
    entityId: updateQuery.data.id,
    entityType: "directive_log",
    metadata: {
      attachmentCount: uploadedAttachments.length,
      directiveId: directive.id,
      directiveNo: directive.directive_no,
    },
  });

  return updateQuery.data;
}

export async function softDeleteDirectiveLogAsSession(
  session: AppSession,
  input: DeleteDirectiveLogInput,
) {
  const client = createSupabaseServerClient();
  const directive = await readDirectiveRow(client, input.directiveId);
  assertCanViewDirective(session, directive);

  if (!canManageDirectiveLogs(session, directive)) {
    throw new ApiError(403, "행동 로그를 비노출 처리할 권한이 없습니다.");
  }

  const existingLogQuery = await client
    .from("directive_logs")
    .select("*")
    .eq("id", input.logId)
    .eq("directive_id", input.directiveId)
    .eq("is_deleted", false)
    .maybeSingle<DirectiveLogRow>();

  if (existingLogQuery.error) {
    throw mapSupabaseError(existingLogQuery.error, "행동 로그를 읽지 못했습니다.");
  }

  if (!existingLogQuery.data) {
    throw new ApiError(404, "비노출 처리할 행동 로그를 찾을 수 없습니다.");
  }

  const now = new Date().toISOString();
  const updateQuery = await client
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

  if (updateQuery.error) {
    throw mapSupabaseError(updateQuery.error, "행동 로그를 비노출 처리하지 못했습니다.");
  }

  await touchDirective(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_LOG_SOFT_DELETED",
    actorId: session.userId,
    afterData: updateQuery.data,
    beforeData: existingLogQuery.data,
    entityId: updateQuery.data.id,
    entityType: "directive_log",
    metadata: {
      directiveId: directive.id,
      directiveNo: directive.directive_no,
      reason: input.reason,
    },
  });

  return updateQuery.data;
}

export async function getDashboardData(session: AppSession): Promise<DashboardData> {
  if (!isExecutiveRole(session.role)) {
    throw new ApiError(403, "대시보드는 대표 또는 전략기획팀만 볼 수 있습니다.");
  }

  const client = createSupabaseServerClient();
  const directivesQuery = await client
    .from("directives")
    .select(
      "id, directive_no, title, status, priority, due_date, updated_at, owner_department_id, is_urgent, urgent_level, is_archived",
    )
    .eq("is_archived", false)
    .order("is_urgent", { ascending: false })
    .order("urgent_level", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (directivesQuery.error) {
    throw mapSupabaseError(directivesQuery.error, "대시보드 지시사항을 불러오지 못했습니다.");
  }

  const directives = (directivesQuery.data ?? []) as DirectiveRow[];
  const departmentMap = await loadDepartmentsMap(
    client,
    directives.map((row) => row.owner_department_id),
  );

  const summaryItems = directives.map((directive) =>
    mapDirectiveSummary(directive, departmentMap),
  );

  const recentLogsQuery = await client
    .from("directive_logs")
    .select("*")
    .eq("is_deleted", false)
    .order("happened_at", { ascending: false })
    .limit(8);

  if (recentLogsQuery.error) {
    throw mapSupabaseError(recentLogsQuery.error, "최근 업데이트를 불러오지 못했습니다.");
  }

  const recentLogs = (recentLogsQuery.data ?? []) as DirectiveLogRow[];
  const recentUsersMap = await loadUsersMap(
    client,
    recentLogs.map((log) => log.user_id),
  );
  const directiveMap = new Map(summaryItems.map((item) => [item.id, item]));
  const recentUpdates = recentLogs
    .map<DashboardRecentUpdate | null>((log) => {
      const directive = directiveMap.get(log.directive_id);

      if (!directive) {
        return null;
      }

      return {
        actionSummary: log.action_summary,
        directiveId: directive.id,
        directiveNo: directive.directiveNo,
        directiveTitle: directive.title,
        happenedAt: log.happened_at,
        logType: log.log_type,
        userName: recentUsersMap.get(log.user_id)?.name ?? null,
      };
    })
    .filter((item): item is DashboardRecentUpdate => Boolean(item));

  const delayedItems = summaryItems.filter((item) => item.isDelayed).slice(0, 6);
  const urgentItems = summaryItems
    .filter((item) => item.isUrgent && item.status !== "COMPLETED")
    .slice(0, 6);
  const waitingApprovalItems = summaryItems
    .filter((item) => item.status === "COMPLETION_REQUESTED")
    .slice(0, 6);

  const kpis = [
    { label: "총 건수", tone: "default" as const, value: summaryItems.length },
    {
      label: "진행 중",
      tone: "muted" as const,
      value: summaryItems.filter((item) => item.status === "IN_PROGRESS").length,
    },
    {
      label: "지연",
      tone: "warning" as const,
      value: summaryItems.filter((item) => item.isDelayed).length,
    },
    {
      label: "완료",
      tone: "success" as const,
      value: summaryItems.filter((item) => item.status === "COMPLETED").length,
    },
    {
      label: "긴급",
      tone: "danger" as const,
      value: summaryItems.filter((item) => item.isUrgent).length,
    },
  ];

  return {
    delayedItems,
    kpis,
    recentUpdates,
    urgentItems,
    waitingApprovalItems,
  };
}
