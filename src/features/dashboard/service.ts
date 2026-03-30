import "server-only";

import type { AppSession } from "@/features/auth/types";
import { isAdminRole } from "@/features/auth/utils";
import {
  getDashboardData,
  getDepartmentBoardData,
  getDirectiveApprovalQueueForSession,
  listDirectivesForSession,
  type DirectiveListItem,
} from "@/features/directives";
import { getReportsOverview } from "@/features/reports";
import { ApiError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase";

import type {
  CeoDashboardData,
  DashboardQueueItem,
  DepartmentAnalysisItem,
  QuickLogDirectiveOption,
  StaffRecentLogItem,
  StaffWorkspaceData,
  ViewerHomeData,
  WeeklyTrendPoint,
} from "./types";

type StaffLogRow = {
  action_summary: string;
  created_at: string;
  department_id: string;
  directive_id: string;
  id: string;
};

type DirectiveSummaryRow = {
  directive_no: string;
  id: string;
  title: string;
};

type AttachmentCountRow = {
  id: string;
  log_id: string | null;
};

type DepartmentNameRow = {
  id: string;
  name: string;
};

function isActiveDirective(item: DirectiveListItem) {
  return item.status !== "COMPLETED";
}

function isDueWithinDays(item: DirectiveListItem, days: number) {
  if (!item.dueDate || item.status === "COMPLETED") {
    return false;
  }

  const now = Date.now();
  const dueDate = new Date(item.dueDate).getTime();
  return dueDate >= now && dueDate <= now + days * 24 * 60 * 60 * 1000;
}

function isDueToday(item: DirectiveListItem) {
  if (!item.dueDate || item.status === "COMPLETED") {
    return false;
  }

  const dueDate = new Date(item.dueDate);
  const today = new Date();

  return (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate()
  );
}

function sortByDueDate(items: DirectiveListItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function buildDirectiveQueueItem(
  item: DirectiveListItem,
  options: {
    badgeText: string;
    badgeTone: DashboardQueueItem["badgeTone"];
    subtitle: string;
  },
): DashboardQueueItem {
  return {
    badgeText: options.badgeText,
    badgeTone: options.badgeTone,
    directiveId: item.id,
    directiveNo: item.directiveNo,
    dueDate: item.dueDate,
    href: `/directives/${item.id}`,
    subtitle: options.subtitle,
    title: item.title,
  };
}

async function loadDepartmentName(departmentId: string) {
  const client = createSupabaseServerClient();
  const { data, error } = await client
    .from("departments")
    .select("id, name")
    .eq("id", departmentId)
    .maybeSingle<DepartmentNameRow>();

  if (error) {
    throw new ApiError(500, "부서 정보를 불러오지 못했습니다.", error, "DASHBOARD_DEPARTMENT_LOOKUP_FAILED");
  }

  return data?.name ?? null;
}

function summarizeDepartments(items: DirectiveListItem[]): DepartmentAnalysisItem[] {
  const summaryMap = new Map<string, DepartmentAnalysisItem>();

  for (const item of items) {
    const key = item.ownerDepartmentName ?? "미지정 부서";
    const current = summaryMap.get(key) ?? {
      completedCount: 0,
      completionRate: 0,
      delayedCount: 0,
      departmentName: key,
      totalCount: 0,
      urgentCount: 0,
      waitingApprovalCount: 0,
    };

    current.totalCount += 1;
    current.completedCount += item.status === "COMPLETED" ? 1 : 0;
    current.delayedCount += item.isDelayed ? 1 : 0;
    current.urgentCount += item.isUrgent ? 1 : 0;
    current.waitingApprovalCount += item.status === "COMPLETION_REQUESTED" ? 1 : 0;
    summaryMap.set(key, current);
  }

  return Array.from(summaryMap.values())
    .map((department) => ({
      ...department,
      completionRate: department.totalCount === 0 ? 0 : Math.round((department.completedCount / department.totalCount) * 100),
    }))
    .sort((left, right) => {
      const leftRisk = left.delayedCount + left.waitingApprovalCount + left.urgentCount;
      const rightRisk = right.delayedCount + right.waitingApprovalCount + right.urgentCount;
      if (leftRisk !== rightRisk) {
        return rightRisk - leftRisk;
      }
      return right.totalCount - left.totalCount;
    })
    .slice(0, 8);
}

function buildWeeklyTrend(recentReports: Awaited<ReturnType<typeof getReportsOverview>>["recentReports"]) {
  return [...recentReports]
    .slice(0, 6)
    .reverse()
    .map<WeeklyTrendPoint>((report) => ({
      completedCount: report.completedCount,
      completionRate: report.completionRate,
      delayedCount: report.delayedCount,
      label: `${report.weekStart.slice(5)} - ${report.weekEnd.slice(5)}`,
      onTimeCompletionRate: report.onTimeCompletionRate,
      totalCount: report.totalCount,
    }));
}

export async function getCeoDashboardData(session: AppSession): Promise<CeoDashboardData> {
  if (!isAdminRole(session.role)) {
    throw new ApiError(403, "CEO 대시보드는 대표와 슈퍼 관리자만 조회할 수 있습니다.", null, "CEO_DASHBOARD_DENIED");
  }

  const [dashboard, approvalQueue, reportsOverview] = await Promise.all([
    getDashboardData(session),
    getDirectiveApprovalQueueForSession(session),
    getReportsOverview(session),
  ]);

  const dueTodayItems = sortByDueDate(dashboard.items.filter(isDueToday)).slice(0, 6);
  const urgentItems = sortByDueDate(dashboard.items.filter((item) => item.isUrgent && isActiveDirective(item))).slice(0, 6);
  const riskItems = sortByDueDate(
    dashboard.items.filter(
      (item) =>
        isActiveDirective(item) &&
        (item.isDelayed || item.attachmentCount === 0 || item.logCount === 0 || item.status === "REJECTED"),
    ),
  ).slice(0, 6);

  return {
    actionCards: [
      {
        description: "지금 승인 결정을 기다리는 완료 요청입니다.",
        href: "/directives/approval-queue",
        id: "approval_waiting",
        label: "승인 대기",
        tone: "warning",
        value: approvalQueue.total,
      },
      {
        description: "마감이 지났지만 아직 닫히지 않은 지시입니다.",
        href: "/directives?status=DELAYED",
        id: "delayed",
        label: "지연",
        tone: "danger",
        value: dashboard.items.filter((item) => item.isDelayed && isActiveDirective(item)).length,
      },
      {
        description: "오늘 안에 확인이 필요한 마감 항목입니다.",
        href: "/directives?due=today",
        id: "due_today",
        label: "오늘 마감",
        tone: "default",
        value: dueTodayItems.length,
      },
      {
        description: "즉시 판단이 필요한 긴급 지시입니다.",
        href: "/directives?urgent=true",
        id: "urgent",
        label: "긴급",
        tone: "danger",
        value: urgentItems.length,
      },
    ],
    approveNowQueue: approvalQueue.items.slice(0, 5).map((item) => ({
      badgeText: "승인 필요",
      badgeTone: "warning",
      directiveId: item.directiveId,
      directiveNo: item.directiveNo,
      dueDate: null,
      href: `/directives/${item.directiveId}`,
      subtitle: `${item.requestDepartmentName ?? "부서 미지정"} · 로그 ${item.logCount}건 · 증빙 ${item.attachmentCount}건`,
      title: item.title,
    })),
    checkTodayQueue: dueTodayItems.map((item) =>
      buildDirectiveQueueItem(item, {
        badgeText: "오늘 확인",
        badgeTone: "default",
        subtitle: `${item.ownerDepartmentName ?? "미지정 부서"} · 마감 대응이 필요합니다.`,
      }),
    ),
    departments: summarizeDepartments(dashboard.items),
    latestReport: reportsOverview.latestReport,
    recentActivity: dashboard.recentUpdates.slice(0, 8),
    reportSummaryCards: reportsOverview.summaryCards,
    riskNowQueue: riskItems.map((item) =>
      buildDirectiveQueueItem(item, {
        badgeText: item.isDelayed ? "지연" : item.status === "REJECTED" ? "반려" : "보완 필요",
        badgeTone: item.isDelayed ? "danger" : "warning",
        subtitle:
          item.attachmentCount === 0
            ? `${item.ownerDepartmentName ?? "미지정 부서"} · 증빙 보완이 필요합니다.`
            : `${item.ownerDepartmentName ?? "미지정 부서"} · 상태 점검이 필요합니다.`,
      }),
    ),
    weeklyTrend: buildWeeklyTrend(reportsOverview.recentReports),
  };
}

export async function getDepartmentDashboardData(session: AppSession, departmentId: string) {
  if (!departmentId) {
    throw new ApiError(400, "부서가 지정되지 않았습니다.", null, "DEPARTMENT_DASHBOARD_DEPARTMENT_REQUIRED");
  }

  if (!isAdminRole(session.role) && session.role !== "DEPARTMENT_HEAD") {
    throw new ApiError(403, "부서 실행 보드는 권한이 있는 사용자만 조회할 수 있습니다.", null, "DEPARTMENT_DASHBOARD_DENIED");
  }

  if (session.role === "DEPARTMENT_HEAD" && session.departmentId !== departmentId) {
    throw new ApiError(403, "본인 부서의 실행 보드만 조회할 수 있습니다.", null, "DEPARTMENT_DASHBOARD_SCOPE_DENIED");
  }

  const departmentName = await loadDepartmentName(departmentId);
  const scopedSession: AppSession = {
    ...session,
    departmentId,
    departmentName,
    role: "DEPARTMENT_HEAD",
  };

  return getDepartmentBoardData(scopedSession);
}

async function loadStaffRecentLogs(session: AppSession): Promise<StaffRecentLogItem[]> {
  const client = createSupabaseServerClient();
  const logsQuery = await client
    .from("directive_logs")
    .select("id, directive_id, department_id, action_summary, created_at")
    .eq("user_id", session.userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(6);

  if (logsQuery.error) {
    throw new ApiError(500, "최근 로그를 불러오지 못했습니다.", logsQuery.error, "STAFF_RECENT_LOGS_FAILED");
  }

  const logs = (logsQuery.data ?? []) as StaffLogRow[];

  if (logs.length === 0) {
    return [];
  }

  const directiveIds = Array.from(new Set(logs.map((log) => log.directive_id)));
  const departmentIds = Array.from(new Set(logs.map((log) => log.department_id)));
  const logIds = logs.map((log) => log.id);

  const [directivesQuery, departmentsQuery, attachmentsQuery] = await Promise.all([
    client.from("directives").select("id, directive_no, title").in("id", directiveIds),
    client.from("departments").select("id, name").in("id", departmentIds),
    client.from("directive_attachments").select("id, log_id").in("log_id", logIds),
  ]);

  if (directivesQuery.error || departmentsQuery.error || attachmentsQuery.error) {
    throw new ApiError(
      500,
      "최근 로그 상세 정보를 불러오지 못했습니다.",
      {
        attachments: attachmentsQuery.error,
        departments: departmentsQuery.error,
        directives: directivesQuery.error,
      },
      "STAFF_RECENT_LOG_DETAILS_FAILED",
    );
  }

  const directivesMap = new Map(((directivesQuery.data ?? []) as DirectiveSummaryRow[]).map((directive) => [directive.id, directive]));
  const departmentsMap = new Map(((departmentsQuery.data ?? []) as DepartmentNameRow[]).map((department) => [department.id, department.name]));
  const attachmentCountByLogId = new Map<string, number>();

  for (const attachment of (attachmentsQuery.data ?? []) as AttachmentCountRow[]) {
    if (!attachment.log_id) {
      continue;
    }

    attachmentCountByLogId.set(attachment.log_id, (attachmentCountByLogId.get(attachment.log_id) ?? 0) + 1);
  }

  return logs.map((log) => {
    const directive = directivesMap.get(log.directive_id);

    return {
      actionSummary: log.action_summary,
      attachmentCount: attachmentCountByLogId.get(log.id) ?? 0,
      departmentName: departmentsMap.get(log.department_id) ?? null,
      directiveId: log.directive_id,
      directiveNo: directive?.directive_no ?? "지시 번호 없음",
      directiveTitle: directive?.title ?? "지시 제목 없음",
      happenedAt: log.created_at,
      logId: log.id,
    };
  });
}

function buildQuickLogOptions(items: DirectiveListItem[]): QuickLogDirectiveOption[] {
  const seen = new Set<string>();
  const options: QuickLogDirectiveOption[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    options.push({
      departmentId: item.currentDepartmentId,
      departmentName: item.ownerDepartmentName,
      directiveId: item.id,
      directiveNo: item.directiveNo,
      dueDate: item.dueDate,
      title: item.title,
    });
  }

  return options;
}

export async function getStaffWorkspaceData(session: AppSession): Promise<StaffWorkspaceData> {
  if (session.role !== "STAFF") {
    throw new ApiError(403, "실무자 홈은 STAFF 계정만 조회할 수 있습니다.", null, "STAFF_WORKSPACE_DENIED");
  }

  const [listResult, recentLogs] = await Promise.all([
    listDirectivesForSession(session, { page: 1, pageSize: 80 }),
    loadStaffRecentLogs(session),
  ]);

  const allItems = listResult.items;
  const myAssignedItems = sortByDueDate(allItems.filter((item) => item.ownerUserId === session.userId)).slice(0, 8);
  const departmentSupportItems = sortByDueDate(
    allItems.filter((item) => item.currentDepartmentId === session.departmentId && item.ownerUserId !== session.userId),
  ).slice(0, 8);
  const workspaceItems = myAssignedItems.length > 0 ? myAssignedItems : departmentSupportItems;
  const dueSoonItems = sortByDueDate(workspaceItems.filter((item) => isDueWithinDays(item, 7))).slice(0, 6);
  const missingEvidenceItems = workspaceItems
    .filter((item) => item.status !== "COMPLETED" && item.attachmentCount === 0)
    .slice(0, 6);
  const rejectedItems = workspaceItems
    .filter((item) => item.currentDepartmentStatus === "REJECTED" || item.status === "REJECTED")
    .slice(0, 6);
  const quickLogOptions = buildQuickLogOptions([...myAssignedItems, ...departmentSupportItems]);

  return {
    departmentSupportItems,
    dueSoonItems,
    missingEvidenceItems,
    myAssignedItems,
    quickLogOptions,
    recentLogs,
    rejectedItems,
    summaryCards: [
      {
        description: "개인 담당으로 지정된 지시입니다.",
        label: "내 담당",
        tone: "default",
        value: myAssignedItems.length,
      },
      {
        description: "7일 안에 마감되는 항목입니다.",
        label: "마감 임박",
        tone: "warning",
        value: dueSoonItems.length,
      },
      {
        description: "사진이나 문서 증빙이 부족한 항목입니다.",
        label: "증빙 보완",
        tone: "danger",
        value: missingEvidenceItems.length,
      },
      {
        description: "반려되어 재작업이 필요한 항목입니다.",
        label: "반려 재작업",
        tone: "warning",
        value: rejectedItems.length,
      },
    ],
  };
}

export async function getViewerHomeData(session: AppSession): Promise<ViewerHomeData> {
  if (session.role !== "VIEWER") {
    throw new ApiError(403, "조회 전용 홈은 VIEWER 계정만 조회할 수 있습니다.", null, "VIEWER_HOME_DENIED");
  }

  const [listResult, reportsOverview] = await Promise.all([
    listDirectivesForSession(session, { page: 1, pageSize: 24 }),
    getReportsOverview(session),
  ]);

  const items = listResult.items;

  return {
    delayedItems: sortByDueDate(items.filter((item) => item.isDelayed && isActiveDirective(item))).slice(0, 5),
    recentDirectives: sortByDueDate(items).slice(0, 8),
    recentReports: reportsOverview.recentReports.slice(0, 4),
    summaryCards: [
      {
        description: "현재 조회 가능한 지시 총량입니다.",
        label: "조회 가능 지시",
        tone: "default",
        value: items.length,
      },
      {
        description: "읽기만 필요한 승인 대기 항목입니다.",
        label: "승인 대기",
        tone: "warning",
        value: items.filter((item) => item.status === "COMPLETION_REQUESTED").length,
      },
      {
        description: "마감이 지난 지시입니다.",
        label: "지연",
        tone: "danger",
        value: items.filter((item) => item.isDelayed && isActiveDirective(item)).length,
      },
      {
        description: "승인까지 종료된 지시입니다.",
        label: "완료",
        tone: "success",
        value: items.filter((item) => item.status === "COMPLETED").length,
      },
    ],
  };
}
