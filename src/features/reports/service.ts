import "server-only";

import type { AppSession } from "@/features/auth/types";
import { isAdminRole, isExecutiveRole } from "@/features/auth/utils";
import type {
  DashboardKpi,
  ReportsOverview,
  WeeklyReportRow,
  WeeklyReportSummary,
} from "@/features/directives/types";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

type ReportDirectiveRow = {
  created_at: string;
  due_date: string | null;
  id: string;
  is_archived: boolean;
  owner_department_id: string | null;
  owner_user_id: string | null;
  status: string;
};

type DirectiveApprovalAuditRow = {
  acted_at: string;
  entity_id: string;
};

type WeekRange = {
  end: string;
  endAt: string;
  start: string;
  startAt: string;
};

type ReportSnapshot = {
  completedCount: number;
  completionRate: number;
  delayedCount: number;
  inProgressCount: number;
  newCount: number;
  onTimeCompletionRate: number;
  totalCount: number;
};

function mapReportSummary(row: WeeklyReportRow): WeeklyReportSummary {
  return {
    completionRate: row.completion_rate,
    completedCount: row.completed_count,
    createdAt: row.created_at,
    createdBy: row.created_by,
    delayedCount: row.delayed_count,
    id: row.id,
    inProgressCount: row.in_progress_count,
    newCount: row.new_count,
    onTimeCompletionRate: row.on_time_completion_rate,
    totalCount: row.total_count,
    weekEnd: row.week_end,
    weekStart: row.week_start,
  };
}

function computeIsDelayed(dueDate: string | null, status: string) {
  if (!dueDate || status === "COMPLETED") {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getCurrentWeekRange(): WeekRange {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    end: toDateOnly(end),
    endAt: end.toISOString(),
    start: toDateOnly(start),
    startAt: start.toISOString(),
  };
}

function buildReportSnapshot(
  directives: ReportDirectiveRow[],
  weekRange: WeekRange,
  completedAtByDirectiveId: Map<string, string>,
): ReportSnapshot {
  const startAt = new Date(weekRange.startAt).getTime();
  const endAt = new Date(weekRange.endAt).getTime();
  const createdThisWeek = directives.filter((directive) => {
    const createdAt = new Date(directive.created_at).getTime();
    return createdAt >= startAt && createdAt <= endAt;
  });
  const completedDirectives = directives.filter((directive) => directive.status === "COMPLETED");
  const delayedCount = directives.filter((directive) =>
    computeIsDelayed(directive.due_date, directive.status),
  ).length;
  const onTimeCompleted = completedDirectives.filter((directive) => {
    const completedAt = completedAtByDirectiveId.get(directive.id);

    if (!directive.due_date) {
      return true;
    }

    if (!completedAt) {
      return false;
    }

    return new Date(directive.due_date).getTime() >= new Date(completedAt).getTime();
  });

  return {
    completedCount: completedDirectives.length,
    completionRate:
      directives.length === 0 ? 0 : (completedDirectives.length / directives.length) * 100,
    delayedCount,
    inProgressCount: directives.filter((directive) => directive.status === "IN_PROGRESS").length,
    newCount: createdThisWeek.length,
    onTimeCompletionRate:
      completedDirectives.length === 0
        ? 0
        : (onTimeCompleted.length / completedDirectives.length) * 100,
    totalCount: directives.length,
  };
}

async function loadDirectiveCompletedAtMap(directiveIds: string[]) {
  if (directiveIds.length === 0) {
    return new Map<string, string>();
  }

  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("audit_logs")
    .select("entity_id, acted_at")
    .eq("entity_type", "directive")
    .eq("action", "DIRECTIVE_APPROVED")
    .in("entity_id", directiveIds)
    .order("acted_at", { ascending: false });

  if (error) {
    throw new ApiError(
      500,
      "완료 승인 이력을 불러오지 못했습니다.",
      error,
      "WEEKLY_REPORT_COMPLETION_HISTORY_FAILED",
    );
  }

  const map = new Map<string, string>();

  for (const row of (data ?? []) as DirectiveApprovalAuditRow[]) {
    if (!map.has(row.entity_id)) {
      map.set(row.entity_id, row.acted_at);
    }
  }

  return map;
}

function buildSummaryCards(snapshot: Pick<
  ReportSnapshot,
  "completedCount" | "delayedCount" | "inProgressCount" | "newCount" | "totalCount"
>): DashboardKpi[] {
  return [
    { label: "전체 건수", tone: "default", value: snapshot.totalCount },
    { label: "신규", tone: "muted", value: snapshot.newCount },
    { label: "진행 중", tone: "default", value: snapshot.inProgressCount },
    { label: "지연", tone: "warning", value: snapshot.delayedCount },
    { label: "완료", tone: "success", value: snapshot.completedCount },
  ];
}

async function getAccessibleDirectiveIds(session: AppSession) {
  const client = createSupabaseServerClient();

  if (isExecutiveRole(session.role) || isAdminRole(session.role)) {
    return null;
  }

  const ids = new Set<string>();

  if (session.departmentId) {
    const [departmentAssignments, ownedByDepartment] = await Promise.all([
      client
        .from("directive_departments")
        .select("directive_id")
        .eq("department_id", session.departmentId),
      client
        .from("directives")
        .select("id")
        .eq("owner_department_id", session.departmentId)
        .eq("is_archived", false),
    ]);

    if (departmentAssignments.error || ownedByDepartment.error) {
      throw new ApiError(
        500,
        "리포트 조회 범위를 계산하지 못했습니다.",
        {
          departmentAssignments: departmentAssignments.error,
          ownedByDepartment: ownedByDepartment.error,
        },
        "REPORT_SCOPE_LOAD_FAILED",
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
      throw new ApiError(
        500,
        "개인 리포트 조회 범위를 계산하지 못했습니다.",
        ownedByUser.error,
        "REPORT_USER_SCOPE_LOAD_FAILED",
      );
    }

    for (const row of ownedByUser.data ?? []) {
      if (row.id) {
        ids.add(row.id as string);
      }
    }
  }

  return Array.from(ids);
}

async function loadScopedDirectives(session: AppSession) {
  const client = createSupabaseServerClient();
  const accessibleIds = await getAccessibleDirectiveIds(session);

  if (accessibleIds && accessibleIds.length === 0) {
    return [];
  }

  let query = client
    .from("directives")
    .select("id, status, due_date, created_at, is_archived, owner_department_id, owner_user_id")
    .eq("is_archived", false);

  if (accessibleIds) {
    query = query.in("id", accessibleIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new ApiError(
      500,
      "리포트용 지시사항을 불러오지 못했습니다.",
      error,
      "REPORT_DIRECTIVES_LOAD_FAILED",
    );
  }

  return (data ?? []) as ReportDirectiveRow[];
}

export async function getReportsOverview(session: AppSession): Promise<ReportsOverview> {
  const client = createSupabaseServerClient();
  const weekRange = getCurrentWeekRange();
  const [reportsQuery, directives] = await Promise.all([
    client.from("weekly_reports").select("*").order("week_start", { ascending: false }).limit(12),
    loadScopedDirectives(session),
  ]);

  if (reportsQuery.error) {
    throw new ApiError(
      500,
      "주간 결산을 불러오지 못했습니다.",
      reportsQuery.error,
      "WEEKLY_REPORT_LOAD_FAILED",
    );
  }

  const reports = ((reportsQuery.data ?? []) as WeeklyReportRow[]).map(mapReportSummary);
  const latestReport = reports[0] ?? null;
  const currentWeekReport =
    reports.find((report) => report.weekStart === weekRange.start && report.weekEnd === weekRange.end) ??
    null;
  const completedAtByDirectiveId = await loadDirectiveCompletedAtMap(directives.map((directive) => directive.id));
  const snapshot = currentWeekReport
    ? {
        completedCount: currentWeekReport.completedCount,
        delayedCount: currentWeekReport.delayedCount,
        inProgressCount: currentWeekReport.inProgressCount,
        newCount: currentWeekReport.newCount,
        totalCount: currentWeekReport.totalCount,
      }
    : buildReportSnapshot(directives, weekRange, completedAtByDirectiveId);

  return {
    canGenerate:
      (isAdminRole(session.role) || isExecutiveRole(session.role)) && currentWeekReport === null,
    latestReport,
    recentReports: reports,
    summaryCards: buildSummaryCards(snapshot),
  };
}

export async function generateWeeklyReport(session: AppSession) {
  if (!isAdminRole(session.role) && !isExecutiveRole(session.role)) {
    throw new ApiError(
      403,
      "주간 결산 생성 권한이 없습니다.",
      null,
      "WEEKLY_REPORT_CREATE_DENIED",
    );
  }

  const client = createSupabaseServerClient();
  const weekRange = getCurrentWeekRange();

  const existing = await client
    .from("weekly_reports")
    .select("*")
    .eq("week_start", weekRange.start)
    .eq("week_end", weekRange.end)
    .maybeSingle<WeeklyReportRow>();

  if (existing.error) {
    throw new ApiError(
      500,
      "기존 주간 결산을 확인하지 못했습니다.",
      existing.error,
      "WEEKLY_REPORT_EXISTING_LOAD_FAILED",
    );
  }

  if (existing.data) {
    return existing.data;
  }

  const directives = await loadScopedDirectives({
    ...session,
    role: "CEO",
  });
  const completedAtByDirectiveId = await loadDirectiveCompletedAtMap(directives.map((directive) => directive.id));
  const snapshot = buildReportSnapshot(directives, weekRange, completedAtByDirectiveId);

  const insertResult = await client
    .from("weekly_reports")
    .insert({
      completed_count: snapshot.completedCount,
      completion_rate: snapshot.completionRate,
      created_by: session.userId,
      delayed_count: snapshot.delayedCount,
      id: crypto.randomUUID(),
      in_progress_count: snapshot.inProgressCount,
      new_count: snapshot.newCount,
      on_time_completion_rate: snapshot.onTimeCompletionRate,
      report_json: {
        generatedAt: new Date().toISOString(),
        scope: "global",
      },
      total_count: snapshot.totalCount,
      week_end: weekRange.end,
      week_start: weekRange.start,
    })
    .select("*")
    .single<WeeklyReportRow>();

  if (insertResult.error) {
    throw new ApiError(
      500,
      "주간 결산을 생성하지 못했습니다.",
      insertResult.error,
      "WEEKLY_REPORT_CREATE_FAILED",
    );
  }

  return insertResult.data;
}
