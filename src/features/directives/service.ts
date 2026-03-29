import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { AppSession } from "@/features/auth/types";
import {
  canApproveDirective,
  canViewDashboard,
  isAdminRole,
  isExecutiveRole,
  isReadOnlyRole,
} from "@/features/auth/utils";
import { ApiError } from "@/lib/errors";
import { recordHistory } from "@/lib/history";
import { createSupabaseServerClient } from "@/lib/supabase";
import { sanitizeFileName } from "@/lib/utils";

import { normalizeUrgentLevel } from "./schemas";
import type {
  DirectiveApprovalQueueData,
  DirectiveApprovalQueueItem,
  CreateDirectiveInput,
  CreateDirectiveLogInput,
  DashboardData,
  DashboardRecentUpdate,
  DeleteDirectiveLogInput,
  DepartmentBoardData,
  DepartmentRecord,
  DirectiveActivitySummary,
  DirectiveDepartmentAssignmentRole,
  DirectiveDepartmentProgress,
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
  DirectiveStatus,
  DirectiveTargetScope,
  PaginatedDirectives,
  UpdateDirectiveLogInput,
  UserRecord,
  WorkflowDecisionInput,
} from "./types";
import { validateCompletionRequestReason, validateDirectiveLogSubmission } from "./validation";

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

type DepartmentActivityMaps = {
  attachmentCountByDepartmentId: Map<string, number>;
  lastActivityAtByDepartmentId: Map<string, string>;
  logCountByDepartmentId: Map<string, number>;
};

type CompletionRequestAuditRecord = {
  acted_at: string;
  acted_by: string;
  after_data: {
    current?: unknown;
    metadata?: Record<string, unknown>;
  } | null;
  entity_id: string;
};

type CompletionRequestAuditSummary = {
  requestedAt: string;
  requestedBy: string | null;
  requestReason: string | null;
};

type DirectiveAssignmentSummary = {
  currentDepartment: DirectiveDepartmentProgress | null;
  departmentProgress: Record<DirectiveStatus, number>;
  departments: DirectiveDepartmentProgress[];
  supportDepartmentCount: number;
  targetDepartmentCount: number;
  targetScope: DirectiveTargetScope;
};

type DirectiveCreationMetadata = {
  primaryDepartmentId?: string | null;
  targetDepartmentCount?: number;
  targetDepartmentIds?: string[];
  targetScope?: DirectiveTargetScope | null;
};

const directiveStatusPriority: DirectiveStatus[] = [
  "COMPLETION_REQUESTED",
  "REJECTED",
  "DELAYED",
  "IN_PROGRESS",
  "COMPLETED",
  "NEW",
];

function computeIsDelayed(dueDate: string | null, status: string) {
  if (!dueDate || status === "COMPLETED") {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
}

function createStatusCountMap(): Record<DirectiveStatus, number> {
  return {
    COMPLETED: 0,
    COMPLETION_REQUESTED: 0,
    DELAYED: 0,
    IN_PROGRESS: 0,
    NEW: 0,
    REJECTED: 0,
  };
}

function normalizeAssignmentRole(
  assignment: DirectiveDepartmentRow,
  primaryDepartmentId: string | null,
): DirectiveDepartmentAssignmentRole {
  if (assignment.department_id === primaryDepartmentId) {
    return "OWNER";
  }

  return assignment.assignment_role ?? "SUPPORT";
}

function normalizeIsPrimary(assignment: DirectiveDepartmentRow, primaryDepartmentId: string | null) {
  return assignment.department_id === primaryDepartmentId || assignment.is_primary === true;
}

function resolveTargetScope(
  assignments: DirectiveDepartmentRow[],
  activeDepartmentIds: string[],
): DirectiveTargetScope {
  if (assignments.length === 0) {
    return "SELECTED";
  }

  if (activeDepartmentIds.length > 0 && assignments.length === activeDepartmentIds.length) {
    const assignmentIds = new Set(assignments.map((assignment) => assignment.department_id));

    if (activeDepartmentIds.every((departmentId) => assignmentIds.has(departmentId))) {
      return "ALL";
    }
  }

  return "SELECTED";
}

function aggregateDirectiveStatusFromDepartments(assignments: DirectiveDepartmentRow[]): DirectiveStatus {
  const statuses = assignments.map((assignment) => assignment.department_status);

  if (statuses.length === 0) {
    return "NEW";
  }

  if (statuses.every((status) => status === "COMPLETED")) {
    return "COMPLETED";
  }

  if (statuses.some((status) => status === "COMPLETION_REQUESTED")) {
    return "COMPLETION_REQUESTED";
  }

  if (statuses.some((status) => status === "REJECTED")) {
    return "REJECTED";
  }

  if (statuses.some((status) => status === "DELAYED")) {
    return "DELAYED";
  }

  if (statuses.some((status) => status === "IN_PROGRESS")) {
    return "IN_PROGRESS";
  }

  if (statuses.some((status) => status === "COMPLETED")) {
    return "IN_PROGRESS";
  }

  return "NEW";
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

async function loadActiveDepartments(client: SupabaseClient) {
  const { data, error } = await client
    .from("departments")
    .select("id, code, name, head_user_id")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw mapSupabaseError(error, "활성 부서 목록을 불러오지 못했습니다.", "ACTIVE_DEPARTMENTS_LOAD_FAILED");
  }

  return (data ?? []) as DepartmentRecord[];
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

async function loadDirectiveCreationMetadataMap(client: SupabaseClient, directiveIds: string[]) {
  if (directiveIds.length === 0) {
    return new Map<string, DirectiveCreationMetadata>();
  }

  const { data, error } = await client
    .from("audit_logs")
    .select("entity_id, after_data, acted_at")
    .eq("entity_type", "directive")
    .eq("action", "DIRECTIVE_CREATED")
    .in("entity_id", directiveIds)
    .order("acted_at", { ascending: false });

  if (error) {
    throw mapSupabaseError(
      error,
      "지시 생성 메타데이터를 불러오지 못했습니다.",
      "DIRECTIVE_CREATION_METADATA_LOAD_FAILED",
    );
  }

  const map = new Map<string, DirectiveCreationMetadata>();

  for (const row of data ?? []) {
    const directiveId = typeof row.entity_id === "string" ? row.entity_id : null;

    if (!directiveId || map.has(directiveId)) {
      continue;
    }

    const afterData = row.after_data as Record<string, unknown> | null;
    const metadata =
      afterData && typeof afterData.metadata === "object" && afterData.metadata !== null
        ? (afterData.metadata as Record<string, unknown>)
        : null;

    map.set(directiveId, {
      primaryDepartmentId:
        typeof metadata?.primaryDepartmentId === "string" ? metadata.primaryDepartmentId : null,
      targetDepartmentCount:
        typeof metadata?.targetDepartmentCount === "number" ? metadata.targetDepartmentCount : undefined,
      targetDepartmentIds: Array.isArray(metadata?.targetDepartmentIds)
        ? metadata?.targetDepartmentIds.filter((value): value is string => typeof value === "string")
        : undefined,
      targetScope:
        metadata?.targetScope === "ALL" || metadata?.targetScope === "SELECTED"
          ? (metadata.targetScope as DirectiveTargetScope)
          : null,
    });
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

function buildDepartmentActivityMaps(
  directiveDepartments: DirectiveDepartmentRow[],
  logs: DirectiveLogRow[],
  attachments: DirectiveAttachmentRow[],
) {
  const attachmentCountByDepartmentId = new Map<string, number>();
  const logCountByDepartmentId = new Map<string, number>();
  const lastActivityAtByDepartmentId = new Map<string, string>();
  const logDepartmentById = new Map<string, string>();
  const validDepartmentIds = new Set(directiveDepartments.map((assignment) => assignment.department_id));

  for (const log of logs) {
    if (!validDepartmentIds.has(log.department_id)) {
      continue;
    }

    logDepartmentById.set(log.id, log.department_id);
    logCountByDepartmentId.set(log.department_id, (logCountByDepartmentId.get(log.department_id) ?? 0) + 1);
    const activityAt = log.updated_at ?? log.created_at;
    const existing = lastActivityAtByDepartmentId.get(log.department_id);

    if (!existing || new Date(activityAt).getTime() > new Date(existing).getTime()) {
      lastActivityAtByDepartmentId.set(log.department_id, activityAt);
    }
  }

  for (const attachment of attachments) {
    const departmentId = attachment.log_id ? logDepartmentById.get(attachment.log_id) ?? null : null;

    if (!departmentId) {
      continue;
    }

    attachmentCountByDepartmentId.set(
      departmentId,
      (attachmentCountByDepartmentId.get(departmentId) ?? 0) + 1,
    );

    const existing = lastActivityAtByDepartmentId.get(departmentId);

    if (!existing || new Date(attachment.uploaded_at).getTime() > new Date(existing).getTime()) {
      lastActivityAtByDepartmentId.set(departmentId, attachment.uploaded_at);
    }
  }

  return {
    attachmentCountByDepartmentId,
    lastActivityAtByDepartmentId,
    logCountByDepartmentId,
  } satisfies DepartmentActivityMaps;
}

function buildDirectiveAssignmentSummary(options: {
  activeDepartmentIds: string[];
  creationMetadata?: DirectiveCreationMetadata | null;
  departmentActivityMaps: DepartmentActivityMaps;
  departmentMap: Map<string, DepartmentRecord>;
  directive: DirectiveRow;
  directiveDepartments: DirectiveDepartmentRow[];
  session: AppSession;
  userMap: Map<string, UserRecord>;
}) {
  const departmentProgress = createStatusCountMap();

  const departments = options.directiveDepartments
    .map<DirectiveDepartmentProgress>((assignment) => {
      const department = options.departmentMap.get(assignment.department_id);
      const departmentHead = assignment.department_head_id
        ? options.userMap.get(assignment.department_head_id)
        : null;
      const assignmentRole = normalizeAssignmentRole(assignment, options.directive.owner_department_id);
      const isPrimary = normalizeIsPrimary(assignment, options.directive.owner_department_id);
      const logCount = options.departmentActivityMaps.logCountByDepartmentId.get(assignment.department_id) ?? 0;
      const attachmentCount =
        options.departmentActivityMaps.attachmentCountByDepartmentId.get(assignment.department_id) ?? 0;
      const lastActivityAt =
        options.departmentActivityMaps.lastActivityAtByDepartmentId.get(assignment.department_id) ?? null;
      const isCurrentDepartment = Boolean(
        options.session.departmentId && assignment.department_id === options.session.departmentId,
      );

      departmentProgress[assignment.department_status] += 1;

      return {
        assignmentRole,
        assignedAt: assignment.assigned_at,
        attachmentCount,
        canRequestCompletion:
          isCurrentDepartment &&
          options.session.role === "DEPARTMENT_HEAD" &&
          ["IN_PROGRESS", "DELAYED"].includes(assignment.department_status),
        canResumeProgress:
          isCurrentDepartment &&
          options.session.role === "DEPARTMENT_HEAD" &&
          assignment.department_status === "REJECTED",
        departmentCode: department?.code ?? null,
        departmentHeadId: assignment.department_head_id,
        departmentHeadName: buildUserDisplayName(departmentHead),
        departmentId: assignment.department_id,
        departmentName: department?.name ?? null,
        departmentStatus: assignment.department_status,
        dueDate: assignment.department_due_date,
        isCurrentDepartment,
        isPrimary,
        isReadyForCompletionRequest:
          isCurrentDepartment &&
          options.session.role === "DEPARTMENT_HEAD" &&
          ["IN_PROGRESS", "DELAYED"].includes(assignment.department_status) &&
          logCount > 0 &&
          attachmentCount > 0 &&
          Boolean(options.directive.owner_user_id),
        lastActivityAt,
        logCount,
      };
    })
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      const leftPriority = directiveStatusPriority.indexOf(left.departmentStatus);
      const rightPriority = directiveStatusPriority.indexOf(right.departmentStatus);

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return (left.departmentName ?? "").localeCompare(right.departmentName ?? "", "ko");
    });

  return {
    currentDepartment:
      departments.find((department) => department.departmentId === options.session.departmentId) ?? null,
    departmentProgress,
    departments,
    supportDepartmentCount: Math.max(0, departments.length - 1),
    targetDepartmentCount: departments.length,
    targetScope:
      options.creationMetadata?.targetScope ??
      resolveTargetScope(options.directiveDepartments, options.activeDepartmentIds),
  } satisfies DirectiveAssignmentSummary;
}

function mapDirectiveSummary(options: {
  activeDepartmentIds: string[];
  activityMaps: ActivityMaps;
  creationMetadataMap: Map<string, DirectiveCreationMetadata>;
  departmentAssignmentsMap: Map<string, DirectiveDepartmentRow[]>;
  departmentMap: Map<string, DepartmentRecord>;
  directive: DirectiveRow;
  sessionDepartmentId?: string | null;
  userMap: Map<string, UserRecord>;
}) {
  const ownerDepartment = options.directive.owner_department_id
    ? options.departmentMap.get(options.directive.owner_department_id)
    : null;
  const ownerUser = options.directive.owner_user_id ? options.userMap.get(options.directive.owner_user_id) : null;
  const activitySummary = buildActivitySummary(options.directive, options.activityMaps);
  const directiveAssignments = options.departmentAssignmentsMap.get(options.directive.id) ?? [];
  const creationMetadata = options.creationMetadataMap.get(options.directive.id);
  const departmentProgress = createStatusCountMap();
  const currentDepartmentAssignment = options.sessionDepartmentId
    ? directiveAssignments.find((assignment) => assignment.department_id === options.sessionDepartmentId) ?? null
    : null;

  for (const assignment of directiveAssignments) {
    departmentProgress[assignment.department_status] += 1;
  }

  const targetDepartmentCount = directiveAssignments.length || (options.directive.owner_department_id ? 1 : 0);
  const targetScope =
    creationMetadata?.targetScope ?? resolveTargetScope(directiveAssignments, options.activeDepartmentIds);

  return {
    ...activitySummary,
    departmentProgress,
    directiveNo: options.directive.directive_no,
    dueDate: options.directive.due_date,
    id: options.directive.id,
    isDelayed:
      computeIsDelayed(options.directive.due_date, options.directive.status) ||
      departmentProgress.DELAYED > 0,
    isUrgent: options.directive.is_urgent,
    currentDepartmentId: currentDepartmentAssignment?.department_id ?? null,
    currentDepartmentStatus: currentDepartmentAssignment?.department_status ?? null,
    ownerDepartmentCode: ownerDepartment?.code ?? null,
    ownerDepartmentName: ownerDepartment?.name ?? null,
    ownerUserId: options.directive.owner_user_id,
    ownerUserName: buildUserDisplayName(ownerUser),
    status: options.directive.status,
    supportDepartmentCount: Math.max(0, targetDepartmentCount - 1),
    targetDepartmentCount,
    targetScope,
    title: options.directive.title,
    urgentLevel: options.directive.urgent_level,
  } satisfies DirectiveListItem;
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

function canShowDirectiveCompletionRequest(
  session: AppSession,
  currentDepartment: DirectiveDepartmentProgress | null,
) {
  if (!currentDepartment) {
    return false;
  }

  if (!["IN_PROGRESS", "DELAYED"].includes(currentDepartment.departmentStatus)) {
    return false;
  }

  if (session.role !== "DEPARTMENT_HEAD" || !session.departmentId) {
    return false;
  }

  return currentDepartment.departmentId === session.departmentId;
}

function canResumeDirectiveProgress(
  session: AppSession,
  currentDepartment: DirectiveDepartmentProgress | null,
) {
  if (!currentDepartment || currentDepartment.departmentStatus !== "REJECTED") {
    return false;
  }

  if (session.role !== "DEPARTMENT_HEAD" || !session.departmentId) {
    return false;
  }

  return currentDepartment.departmentId === session.departmentId;
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

async function syncDirectiveAggregateStatus(client: SupabaseClient, directiveId: string) {
  const { data, error } = await client
    .from("directive_departments")
    .select("department_status")
    .eq("directive_id", directiveId);

  if (error) {
    throw mapSupabaseError(
      error,
      "지시사항 부서 상태를 집계하지 못했습니다.",
      "DIRECTIVE_STATUS_AGGREGATION_FAILED",
    );
  }

  const nextStatus = aggregateDirectiveStatusFromDepartments((data ?? []) as DirectiveDepartmentRow[]);
  await updateDirectiveStatus(client, directiveId, nextStatus);

  return nextStatus;
}

function resolveRequestedDepartmentId(
  session: AppSession,
  directive: DirectiveRow,
  directiveDepartments: DirectiveDepartmentRow[],
  requestedDepartmentId: string | null | undefined,
) {
  if (requestedDepartmentId) {
    return requestedDepartmentId;
  }

  return session.departmentId ?? directive.owner_department_id ?? directiveDepartments[0]?.department_id ?? null;
}

async function promoteDirectiveToInProgressIfNeeded(
  client: SupabaseClient,
  directive: DirectiveRow,
  directiveDepartments: DirectiveDepartmentRow[],
  departmentId: string | null,
) {
  const currentDepartment =
    departmentId
      ? directiveDepartments.find((assignment) => assignment.department_id === departmentId) ?? null
      : null;

  if (currentDepartment?.department_status === "NEW") {
    await updateDirectiveDepartmentStatus(client, directive.id, "IN_PROGRESS", {
      departmentId,
    });
  }

  if (directive.status === "NEW") {
    await updateDirectiveStatus(client, directive.id, "IN_PROGRESS");
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

function countUploadableFiles(files: File[]) {
  return files.filter((file) => file.size > 0 && file.name).length;
}

async function buildAttachmentItems(
  client: SupabaseClient,
  attachments: DirectiveAttachmentRow[],
  departmentMap: Map<string, DepartmentRecord>,
  logDepartmentMap: Map<string, string>,
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
    departmentId: attachment.log_id ? logDepartmentMap.get(attachment.log_id) ?? null : null,
    departmentName:
      attachment.log_id && logDepartmentMap.get(attachment.log_id)
        ? departmentMap.get(logDepartmentMap.get(attachment.log_id) ?? "")?.name ?? null
        : null,
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
        logId: log.id,
        logType: meta.logType,
        userName: buildUserDisplayName(usersMap.get(log.user_id)),
      };
    })
    .filter((item): item is DashboardRecentUpdate => Boolean(item))
    .slice(0, limit);
}

function buildDirectiveDepartmentKey(directiveId: string, departmentId: string) {
  return `${directiveId}:${departmentId}`;
}

async function loadCompletionRequestAuditSummaryMap(client: SupabaseClient, directiveIds: string[]) {
  const summaryMap = new Map<string, CompletionRequestAuditSummary>();

  if (directiveIds.length === 0) {
    return summaryMap;
  }

  const { data, error } = await client
    .from("audit_logs")
    .select("entity_id, acted_at, acted_by, after_data")
    .eq("entity_type", "directive")
    .eq("action", "DIRECTIVE_COMPLETION_REQUESTED")
    .in("entity_id", directiveIds)
    .order("acted_at", { ascending: false });

  if (error) {
    throw mapSupabaseError(
      error,
      "완료 요청 이력을 불러오지 못했습니다.",
      "DIRECTIVE_COMPLETION_REQUEST_HISTORY_FAILED",
    );
  }

  for (const row of (data ?? []) as CompletionRequestAuditRecord[]) {
    const metadata =
      row.after_data && typeof row.after_data.metadata === "object" && row.after_data.metadata !== null
        ? row.after_data.metadata
        : null;
    const departmentId = typeof metadata?.departmentId === "string" ? metadata.departmentId : null;

    if (!departmentId || !row.entity_id) {
      continue;
    }

    const key = buildDirectiveDepartmentKey(row.entity_id, departmentId);

    if (summaryMap.has(key)) {
      continue;
    }

    summaryMap.set(key, {
      requestReason: typeof metadata?.reason === "string" ? metadata.reason : null,
      requestedAt: row.acted_at,
      requestedBy: typeof row.acted_by === "string" ? row.acted_by : null,
    });
  }

  return summaryMap;
}

export async function createDirectiveAsSession(session: AppSession, input: CreateDirectiveInput) {
  if (!isAdminRole(session.role) && !isExecutiveRole(session.role)) {
    throw new ApiError(403, "지시사항을 생성할 권한이 없습니다.", null, "DIRECTIVE_CREATE_DENIED");
  }

  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const normalizedUrgentLevel = input.isUrgent ? normalizeUrgentLevel(input.urgentLevel) : null;
  const activeDepartments = await loadActiveDepartments(client);
  const activeDepartmentIds = activeDepartments.map((department) => department.id);
  const activeDepartmentsMap = new Map(activeDepartments.map((department) => [department.id, department]));
  const targetDepartmentIds =
    input.targetScope === "ALL" ? activeDepartmentIds : Array.from(new Set(input.selectedDepartmentIds));

  if (targetDepartmentIds.length === 0) {
    throw new ApiError(400, "대상 부서를 최소 1개 이상 선택해 주세요.", null, "DIRECTIVE_TARGET_DEPARTMENT_REQUIRED");
  }

  if (!targetDepartmentIds.includes(input.primaryDepartmentId)) {
    throw new ApiError(
      400,
      "주관 부서는 대상 부서에 포함되어야 합니다.",
      null,
      "DIRECTIVE_PRIMARY_DEPARTMENT_INVALID",
    );
  }

  const missingDepartmentId = targetDepartmentIds.find((departmentId) => !activeDepartmentsMap.has(departmentId));

  if (missingDepartmentId) {
    throw new ApiError(
      404,
      "선택한 부서 중 비활성 또는 존재하지 않는 부서가 있습니다.",
      { missingDepartmentId },
      "DIRECTIVE_TARGET_DEPARTMENT_NOT_FOUND",
    );
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
        owner_department_id: input.primaryDepartmentId,
        owner_user_id: input.ownerUserId,
        sequence: generatedDirectiveNumber.sequence,
        status: "NEW",
        title: input.title,
        urgent_level: normalizedUrgentLevel,
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

    const departmentLink = await client.from("directive_departments").insert(
      targetDepartmentIds.map((departmentId) => {
        const department = activeDepartmentsMap.get(departmentId);

        return {
          assigned_at: now,
          department_closed_at: null,
          department_due_date: input.dueDate,
          department_head_id: department?.head_user_id ?? null,
          department_id: departmentId,
          department_status: "NEW",
          directive_id: insertResult.data.id,
          id: crypto.randomUUID(),
          updated_at: now,
        };
      }),
    );

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
        primaryDepartmentId: input.primaryDepartmentId,
        targetDepartmentCount: targetDepartmentIds.length,
        targetDepartmentIds,
        targetScope:
          input.targetScope === "ALL" && targetDepartmentIds.length === activeDepartmentIds.length
            ? "ALL"
            : "SELECTED",
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

  if (filters.urgent !== undefined) {
    query = query.eq("is_urgent", filters.urgent);
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
    .order("urgent_level", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const { count, data, error } = await query.range(from, to);

  if (error) {
    throw mapSupabaseError(error, "지시사항 목록을 불러오지 못했습니다.", "DIRECTIVE_LIST_FAILED");
  }

  const rows = (data ?? []) as DirectiveRow[];
  const directiveIds = rows.map((row) => row.id);
  const [activityMaps, creationMetadataMap, directiveDepartmentsMap, activeDepartments] = await Promise.all([
    loadActivityMaps(client, directiveIds),
    loadDirectiveCreationMetadataMap(client, directiveIds),
    loadDirectiveDepartmentsMap(client, directiveIds),
    loadActiveDepartments(client),
  ]);
  const departmentsMap = await loadDepartmentsMap(
    client,
    rows.flatMap((row) => [
      row.owner_department_id,
      ...(directiveDepartmentsMap.get(row.id) ?? []).map((assignment) => assignment.department_id),
    ]),
  );
  const usersMap = await loadUsersMap(client, rows.map((row) => row.owner_user_id));
  const items = rows.map((row) =>
    mapDirectiveSummary({
      activeDepartmentIds: activeDepartments.map((department) => department.id),
      activityMaps,
      creationMetadataMap,
      departmentAssignmentsMap: directiveDepartmentsMap,
      departmentMap: departmentsMap,
      directive: row,
      sessionDepartmentId: session.departmentId,
      userMap: usersMap,
    }),
  );
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

  const [logsResult, attachmentsResult, activeDepartments, creationMetadataMap, departmentsMap] = await Promise.all([
    client
      .from("directive_logs")
      .select("*")
      .eq("directive_id", directiveId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    client.from("directive_attachments").select("*").eq("directive_id", directiveId).order("uploaded_at", { ascending: false }),
    loadActiveDepartments(client),
    loadDirectiveCreationMetadataMap(client, [directiveId]),
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
  const logDepartmentMap = new Map(logs.map((log) => [log.id, log.department_id]));
  const usersMap = await loadUsersMap(client, [
    directive.created_by,
    directive.owner_user_id,
    ...directiveDepartments.map((item) => item.department_head_id),
    ...logs.map((log) => log.user_id),
    ...attachments.map((attachment) => attachment.uploaded_by),
  ]);
  const attachmentItems = await buildAttachmentItems(client, attachments, departmentsMap, logDepartmentMap, usersMap);
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
  const departmentActivityMaps = buildDepartmentActivityMaps(directiveDepartments, logs, attachments);
  const assignmentSummary = buildDirectiveAssignmentSummary({
    activeDepartmentIds: activeDepartments.map((department) => department.id),
    creationMetadata: creationMetadataMap.get(directiveId),
    departmentActivityMaps,
    departmentMap: departmentsMap,
    directive,
    directiveDepartments,
    session,
    userMap: usersMap,
  });

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
    isDelayed: computeIsDelayed(directive.due_date, directive.status) || assignmentSummary.departmentProgress.DELAYED > 0,
    isUrgent: directive.is_urgent,
    departments: assignmentSummary.departments,
    departmentProgress: assignmentSummary.departmentProgress,
    logs: logItems,
    ownerDepartmentId: directive.owner_department_id,
    ownerDepartmentName: directive.owner_department_id
      ? departmentsMap.get(directive.owner_department_id)?.name ?? null
      : null,
    ownerUserId: directive.owner_user_id,
    ownerUserName: buildUserDisplayName(usersMap.get(directive.owner_user_id ?? "")),
    status: directive.status,
    supportDepartmentCount: assignmentSummary.supportDepartmentCount,
    targetDepartmentCount: assignmentSummary.targetDepartmentCount,
    targetScope: assignmentSummary.targetScope,
    title: directive.title,
    urgentLevel: directive.urgent_level,
    workflow: {
      canCreateDirective: isAdminRole(session.role) || isExecutiveRole(session.role),
      canManageMultipleDepartments: isAdminRole(session.role) || isExecutiveRole(session.role),
      canManageLogs: canManageDirectiveLogs(session, directive, directiveDepartments),
      canRequestCompletion: canShowDirectiveCompletionRequest(session, assignmentSummary.currentDepartment),
      currentDepartmentId: assignmentSummary.currentDepartment?.departmentId ?? session.departmentId ?? null,
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
  const uploadFiles = coerceFiles(files);
  assertDirectiveViewAccess(session, directive, directiveDepartments);

  if (!canManageDirectiveLogs(session, directive, directiveDepartments)) {
    throw new ApiError(403, "행동 로그를 등록할 권한이 없습니다.", null, "DIRECTIVE_LOG_CREATE_DENIED");
  }

  const departmentId = resolveRequestedDepartmentId(
    session,
    directive,
    directiveDepartments,
    input.departmentId,
  );

  if (!departmentId) {
    throw new ApiError(400, "로그를 남길 부서 정보를 확인할 수 없습니다.", null, "DIRECTIVE_LOG_DEPARTMENT_REQUIRED");
  }

  if (!directiveDepartments.some((assignment) => assignment.department_id === departmentId)) {
    throw new ApiError(403, "대상 부서에 배정된 지시사항에만 로그를 남길 수 있습니다.", null, "DIRECTIVE_LOG_DEPARTMENT_INVALID");
  }

  const validationMessage = validateDirectiveLogSubmission({
    ...input,
    attachmentCount: countUploadableFiles(uploadFiles),
  });

  if (validationMessage) {
    throw new ApiError(400, validationMessage, null, "DIRECTIVE_LOG_INVALID");
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
    files: uploadFiles,
    logId: insertResult.data.id,
    uploadedBy: session.userId,
  });

  await promoteDirectiveToInProgressIfNeeded(client, directive, directiveDepartments, departmentId);
  await syncDirectiveAggregateStatus(client, directive.id);
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
  const uploadFiles = coerceFiles(files);
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

  const departmentId = resolveRequestedDepartmentId(
    session,
    directive,
    directiveDepartments,
    input.departmentId ?? existingLog.data.department_id,
  );

  if (!departmentId) {
    throw new ApiError(400, "로그 부서를 확인할 수 없습니다.", null, "DIRECTIVE_LOG_DEPARTMENT_REQUIRED");
  }

  if (!directiveDepartments.some((assignment) => assignment.department_id === departmentId)) {
    throw new ApiError(403, "대상 부서에 배정된 지시사항 로그만 수정할 수 있습니다.", null, "DIRECTIVE_LOG_DEPARTMENT_INVALID");
  }

  const existingAttachmentsQuery = await client
    .from("directive_attachments")
    .select("id", { count: "exact", head: true })
    .eq("directive_id", input.directiveId)
    .eq("log_id", input.logId);

  if (existingAttachmentsQuery.error) {
    throw mapSupabaseError(
      existingAttachmentsQuery.error,
      "기존 증빙 정보를 확인하지 못했습니다.",
      "DIRECTIVE_LOG_ATTACHMENT_CHECK_FAILED",
    );
  }

  const validationMessage = validateDirectiveLogSubmission({
    ...input,
    attachmentCount: (existingAttachmentsQuery.count ?? 0) + countUploadableFiles(uploadFiles),
  });

  if (validationMessage) {
    throw new ApiError(400, validationMessage, null, "DIRECTIVE_LOG_INVALID");
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
    files: uploadFiles,
    logId: input.logId,
    uploadedBy: session.userId,
  });

  await promoteDirectiveToInProgressIfNeeded(client, directive, directiveDepartments, departmentId);
  await syncDirectiveAggregateStatus(client, directive.id);
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
  const targetDepartment =
    detail.departments.find((department) => department.departmentId === input.departmentId) ??
    detail.departments.find((department) => department.departmentId === detail.workflow.currentDepartmentId) ??
    null;

  if (!targetDepartment || !targetDepartment.canRequestCompletion || !detail.workflow.canRequestCompletion) {
    throw new ApiError(
      400,
      "해당 부서는 진행 중 또는 지연 상태에서만 완료 요청을 진행할 수 있습니다.",
      null,
      "DIRECTIVE_COMPLETION_REQUEST_DENIED",
    );
  }

  if (!targetDepartment.isReadyForCompletionRequest) {
    throw new ApiError(
      400,
      "로그 1건 이상, 증빙 1건 이상, 담당자 지정이 모두 완료되어야 완료 요청을 진행할 수 있습니다.",
      null,
      "DIRECTIVE_COMPLETION_REQUEST_CHECKLIST_INCOMPLETE",
    );
  }

  const completionReasonError = validateCompletionRequestReason(input.reason);

  if (completionReasonError) {
    throw new ApiError(400, completionReasonError, null, "DIRECTIVE_COMPLETION_REASON_REQUIRED");
  }

  await updateDirectiveDepartmentStatus(client, input.directiveId, "COMPLETION_REQUESTED", {
    departmentId: targetDepartment.departmentId,
  });
  const directiveStatus = await syncDirectiveAggregateStatus(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_COMPLETION_REQUESTED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      departmentId: targetDepartment.departmentId,
      departmentName: targetDepartment.departmentName,
      directiveStatus,
      reason: input.reason,
    },
  });
}

export async function approveDirectiveCompletionAsSession(session: AppSession, input: WorkflowDecisionInput) {
  if (!canApproveDirective(session.role)) {
    throw new ApiError(403, "완료 승인 권한이 없습니다.", null, "DIRECTIVE_APPROVE_DENIED");
  }

  const client = createSupabaseServerClient();
  const { directive, directiveDepartments } = await readDirectiveContext(client, input.directiveId);
  const targetDepartment =
    directiveDepartments.find((assignment) => assignment.department_id === input.departmentId) ?? null;

  if (!targetDepartment) {
    throw new ApiError(404, "승인할 대상 부서를 찾을 수 없습니다.", null, "DIRECTIVE_APPROVE_DEPARTMENT_NOT_FOUND");
  }

  if (targetDepartment.department_status !== "COMPLETION_REQUESTED") {
    throw new ApiError(
      400,
      "완료 요청 상태의 부서만 승인할 수 있습니다.",
      null,
      "DIRECTIVE_APPROVE_INVALID_STATUS",
    );
  }

  const closedAt = new Date().toISOString();
  await updateDirectiveDepartmentStatus(client, input.directiveId, "COMPLETED", {
    closedAt,
    departmentId: targetDepartment.department_id,
  });
  const directiveStatus = await syncDirectiveAggregateStatus(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_APPROVED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      closedAt,
      departmentId: targetDepartment.department_id,
      directiveNo: directive.directive_no,
      directiveStatus,
      reason: input.reason,
    },
  });
}

export async function rejectDirectiveCompletionAsSession(session: AppSession, input: WorkflowDecisionInput) {
  if (!canApproveDirective(session.role)) {
    throw new ApiError(403, "반려 권한이 없습니다.", null, "DIRECTIVE_REJECT_DENIED");
  }

  const client = createSupabaseServerClient();
  const { directive, directiveDepartments } = await readDirectiveContext(client, input.directiveId);
  const targetDepartment =
    directiveDepartments.find((assignment) => assignment.department_id === input.departmentId) ?? null;

  if (!targetDepartment) {
    throw new ApiError(404, "반려할 대상 부서를 찾을 수 없습니다.", null, "DIRECTIVE_REJECT_DEPARTMENT_NOT_FOUND");
  }

  if (targetDepartment.department_status !== "COMPLETION_REQUESTED") {
    throw new ApiError(
      400,
      "완료 요청 상태의 부서만 반려할 수 있습니다.",
      null,
      "DIRECTIVE_REJECT_INVALID_STATUS",
    );
  }

  await updateDirectiveDepartmentStatus(client, input.directiveId, "REJECTED", {
    departmentId: targetDepartment.department_id,
  });
  const directiveStatus = await syncDirectiveAggregateStatus(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_REJECTED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      departmentId: targetDepartment.department_id,
      directiveNo: directive.directive_no,
      directiveStatus,
      reason: input.reason,
    },
  });
}

export async function resumeDirectiveProgressAsSession(session: AppSession, input: WorkflowDecisionInput) {
  const detail = await getDirectiveDetailForSession(session, input.directiveId);
  const targetDepartment =
    detail.departments.find((department) => department.departmentId === input.departmentId) ??
    detail.departments.find((department) => department.departmentId === detail.workflow.currentDepartmentId) ??
    null;

  if (!targetDepartment || !targetDepartment.canResumeProgress || !canResumeDirectiveProgress(session, targetDepartment)) {
    throw new ApiError(400, "반려된 부서만 재진행으로 전환할 수 있습니다.", null, "DIRECTIVE_RESUME_DENIED");
  }

  const client = createSupabaseServerClient();
  await updateDirectiveDepartmentStatus(client, input.directiveId, "IN_PROGRESS", {
    departmentId: targetDepartment.departmentId,
  });
  const directiveStatus = await syncDirectiveAggregateStatus(client, input.directiveId);
  await recordHistory(client, {
    action: "DIRECTIVE_RESUMED",
    actorId: session.userId,
    entityId: input.directiveId,
    entityType: "directive",
    metadata: {
      departmentId: targetDepartment.departmentId,
      departmentName: targetDepartment.departmentName,
      directiveStatus,
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
    .order("urgent_level", { ascending: true, nullsFirst: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw mapSupabaseError(error, "대시보드용 지시사항을 불러오지 못했습니다.", "DASHBOARD_DIRECTIVE_LOAD_FAILED");
  }

  const rows = (data ?? []) as DirectiveRow[];
  const directiveIds = rows.map((row) => row.id);
  const [activityMaps, creationMetadataMap, directiveDepartmentsMap, activeDepartments] = await Promise.all([
    loadActivityMaps(client, directiveIds),
    loadDirectiveCreationMetadataMap(client, directiveIds),
    loadDirectiveDepartmentsMap(client, directiveIds),
    loadActiveDepartments(client),
  ]);
  const departmentsMap = await loadDepartmentsMap(
    client,
    rows.flatMap((row) => [
      row.owner_department_id,
      ...(directiveDepartmentsMap.get(row.id) ?? []).map((assignment) => assignment.department_id),
    ]),
  );
  const usersMap = await loadUsersMap(client, rows.map((row) => row.owner_user_id));

  return {
    accessibleIds,
    items: rows.map((row) =>
      mapDirectiveSummary({
        activeDepartmentIds: activeDepartments.map((department) => department.id),
        activityMaps,
        creationMetadataMap,
        departmentAssignmentsMap: directiveDepartmentsMap,
        departmentMap: departmentsMap,
        directive: row,
        sessionDepartmentId: session.departmentId,
        userMap: usersMap,
      }),
    ),
  };
}

export async function getDashboardData(session: AppSession): Promise<DashboardData> {
  if (!canViewDashboard(session.role) && !isAdminRole(session.role)) {
    throw new ApiError(403, "대표 대시보드를 볼 권한이 없습니다.", null, "DASHBOARD_ACCESS_DENIED");
  }

  const client = createSupabaseServerClient();
  const { accessibleIds, items } = await loadDirectiveItemsForDashboard(client, session);
  const recentUpdates = await buildRecentUpdates(client, items, accessibleIds, 8);
  const waitingApprovalCount = items.filter((item) => item.status === "COMPLETION_REQUESTED").length;

  return {
    delayedItems: items.filter((item) => item.isDelayed).slice(0, 6),
    items,
    kpis: [
      { label: "전체 건수", tone: "default", value: items.length, description: "현재 집행 범위 전체" },
      {
        label: "진행 중",
        tone: "muted",
        value: items.filter((item) => item.status === "IN_PROGRESS").length,
        description: "현재 실행이 이어지는 지시",
      },
      {
        label: "지연",
        tone: "warning",
        value: items.filter((item) => item.isDelayed).length,
        description: "즉시 점검이 필요한 일정",
      },
      {
        label: "완료",
        tone: "success",
        value: items.filter((item) => item.status === "COMPLETED").length,
        description: "승인까지 끝난 실행",
      },
      {
        label: "긴급",
        tone: "danger",
        value: items.filter((item) => item.isUrgent).length,
        description: "즉시 확인이 필요한 항목",
      },
      {
        label: "승인 대기",
        tone: "default",
        value: waitingApprovalCount,
        description: "부서별 완료 요청이 올라온 항목",
      },
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
    items,
    kpis: [
      { label: "배정 건수", tone: "default", value: items.length, description: "우리 부서에 연결된 전체 지시" },
      {
        label: "진행 중",
        tone: "muted",
        value: items.filter((item) => item.status === "IN_PROGRESS").length,
        description: "현재 실행 중인 항목",
      },
      {
        label: "승인 대기",
        tone: "default",
        value: items.filter((item) => item.status === "COMPLETION_REQUESTED").length,
        description: "완료 요청 후 승인을 기다리는 항목",
      },
      {
        label: "지연",
        tone: "warning",
        value: items.filter((item) => item.isDelayed).length,
        description: "마감 리스크가 있는 항목",
      },
      {
        label: "증빙 필요",
        tone: "danger",
        value: missingEvidenceItems.length,
        description: "로그는 있지만 증빙이 비어 있는 항목",
      },
    ],
    missingEvidenceItems,
    recentUpdates,
    urgentItems: items.filter((item) => item.isUrgent && item.status !== "COMPLETED").slice(0, 6),
    waitingApprovalItems: items.filter((item) => item.status === "COMPLETION_REQUESTED").slice(0, 6),
  };
}

export async function getDirectiveApprovalQueueForSession(
  session: AppSession,
): Promise<DirectiveApprovalQueueData> {
  if (!canApproveDirective(session.role)) {
    throw new ApiError(403, "승인 대기 큐를 조회할 권한이 없습니다.", null, "DIRECTIVE_APPROVAL_QUEUE_DENIED");
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("directive_departments")
    .select("directive_id, department_id, department_status, updated_at")
    .eq("department_status", "COMPLETION_REQUESTED")
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw mapSupabaseError(
      error,
      "승인 대기 큐를 불러오지 못했습니다.",
      "DIRECTIVE_APPROVAL_QUEUE_LOAD_FAILED",
    );
  }

  const queueRows = (data ?? []) as Pick<
    DirectiveDepartmentRow,
    "department_id" | "department_status" | "directive_id" | "updated_at"
  >[];

  if (queueRows.length === 0) {
    return {
      items: [],
      total: 0,
    };
  }

  const directiveIds = Array.from(new Set(queueRows.map((row) => row.directive_id)));
  const departmentIds = Array.from(new Set(queueRows.map((row) => row.department_id)));

  const [directivesQuery, departmentsMap, requestAuditMap, logsQuery, attachmentsQuery] = await Promise.all([
    client
      .from("directives")
      .select("id, directive_no, title, created_at")
      .in("id", directiveIds),
    loadDepartmentsMap(client, departmentIds),
    loadCompletionRequestAuditSummaryMap(client, directiveIds),
    client
      .from("directive_logs")
      .select("id, directive_id, department_id")
      .eq("is_deleted", false)
      .in("directive_id", directiveIds),
    client
      .from("directive_attachments")
      .select("id, directive_id, log_id")
      .in("directive_id", directiveIds),
  ]);

  if (directivesQuery.error) {
    throw mapSupabaseError(
      directivesQuery.error,
      "승인 대기 지시 정보를 불러오지 못했습니다.",
      "DIRECTIVE_APPROVAL_QUEUE_DIRECTIVES_FAILED",
    );
  }

  if (logsQuery.error) {
    throw mapSupabaseError(logsQuery.error, "승인 대기 로그 정보를 불러오지 못했습니다.", "DIRECTIVE_APPROVAL_QUEUE_LOGS_FAILED");
  }

  if (attachmentsQuery.error) {
    throw mapSupabaseError(
      attachmentsQuery.error,
      "승인 대기 증빙 정보를 불러오지 못했습니다.",
      "DIRECTIVE_APPROVAL_QUEUE_ATTACHMENTS_FAILED",
    );
  }

  const directivesMap = new Map(
    ((directivesQuery.data ?? []) as Array<Pick<DirectiveRow, "created_at" | "directive_no" | "id" | "title">>).map(
      (directive) => [directive.id, directive],
    ),
  );
  const logCountByKey = new Map<string, number>();
  const attachmentCountByKey = new Map<string, number>();
  const logKeyById = new Map<string, string>();
  const filteredDepartmentIds = new Set(departmentIds);

  for (const log of (logsQuery.data ?? []) as Array<Pick<DirectiveLogRow, "department_id" | "directive_id" | "id">>) {
    if (!filteredDepartmentIds.has(log.department_id)) {
      continue;
    }

    const key = buildDirectiveDepartmentKey(log.directive_id, log.department_id);
    logCountByKey.set(key, (logCountByKey.get(key) ?? 0) + 1);
    logKeyById.set(log.id, key);
  }

  for (const attachment of (attachmentsQuery.data ?? []) as Array<Pick<DirectiveAttachmentRow, "directive_id" | "id" | "log_id">>) {
    if (!attachment.log_id) {
      continue;
    }

    const key = logKeyById.get(attachment.log_id);

    if (!key) {
      continue;
    }

    attachmentCountByKey.set(key, (attachmentCountByKey.get(key) ?? 0) + 1);
  }

  const requesterIds = Array.from(
    new Set(
      Array.from(requestAuditMap.values())
        .map((item) => item.requestedBy)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const requesterMap = await loadUsersMap(client, requesterIds);

  const items = queueRows
    .map<DirectiveApprovalQueueItem | null>((row) => {
      const directive = directivesMap.get(row.directive_id);

      if (!directive) {
        return null;
      }

      const key = buildDirectiveDepartmentKey(row.directive_id, row.department_id);
      const auditSummary = requestAuditMap.get(key);

      return {
        attachmentCount: attachmentCountByKey.get(key) ?? 0,
        departmentId: row.department_id,
        directiveId: row.directive_id,
        directiveNo: directive.directive_no,
        logCount: logCountByKey.get(key) ?? 0,
        requestDepartmentName: departmentsMap.get(row.department_id)?.name ?? null,
        requestReason: auditSummary?.requestReason ?? null,
        requestedAt: auditSummary?.requestedAt ?? row.updated_at ?? directive.created_at,
        requesterName: auditSummary?.requestedBy
          ? buildUserDisplayName(requesterMap.get(auditSummary.requestedBy))
          : null,
        title: directive.title,
      };
    })
    .filter((item): item is DirectiveApprovalQueueItem => Boolean(item))
    .sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());

  return {
    items,
    total: items.length,
  };
}
