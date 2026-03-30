import type {
  DashboardKpi,
  DashboardRecentUpdate,
  DirectiveApprovalQueueItem,
  DirectiveListItem,
  WeeklyReportSummary,
} from "@/features/directives/types";

export type DashboardCardTone = "danger" | "default" | "success" | "warning";

export interface DashboardActionCard {
  description: string;
  href: string;
  id: "approval_waiting" | "delayed" | "due_today" | "urgent";
  tone: DashboardCardTone;
  value: number;
  label: string;
}

export interface DashboardQueueItem {
  badgeTone: DashboardCardTone;
  badgeText: string;
  directiveId: string;
  directiveNo: string;
  dueDate: string | null;
  href: string;
  subtitle: string;
  title: string;
}

export interface DepartmentAnalysisItem {
  completedCount: number;
  completionRate: number;
  delayedCount: number;
  departmentName: string;
  totalCount: number;
  urgentCount: number;
  waitingApprovalCount: number;
}

export interface WeeklyTrendPoint {
  completedCount: number;
  completionRate: number | null;
  delayedCount: number;
  label: string;
  onTimeCompletionRate: number | null;
  totalCount: number;
}

export interface CeoDashboardData {
  actionCards: DashboardActionCard[];
  approveNowQueue: DashboardQueueItem[];
  checkTodayQueue: DashboardQueueItem[];
  departments: DepartmentAnalysisItem[];
  latestReport: WeeklyReportSummary | null;
  recentActivity: DashboardRecentUpdate[];
  reportSummaryCards: DashboardKpi[];
  riskNowQueue: DashboardQueueItem[];
  weeklyTrend: WeeklyTrendPoint[];
}

export interface StaffRecentLogItem {
  actionSummary: string;
  attachmentCount: number;
  departmentName: string | null;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
  happenedAt: string;
  logId: string;
}

export interface QuickLogDirectiveOption {
  departmentId: string | null;
  departmentName: string | null;
  directiveId: string;
  directiveNo: string;
  dueDate: string | null;
  title: string;
}

export interface StaffWorkspaceData {
  departmentSupportItems: DirectiveListItem[];
  dueSoonItems: DirectiveListItem[];
  missingEvidenceItems: DirectiveListItem[];
  myAssignedItems: DirectiveListItem[];
  quickLogOptions: QuickLogDirectiveOption[];
  recentLogs: StaffRecentLogItem[];
  rejectedItems: DirectiveListItem[];
  summaryCards: DashboardKpi[];
}

export interface ViewerHomeData {
  delayedItems: DirectiveListItem[];
  recentDirectives: DirectiveListItem[];
  recentReports: WeeklyReportSummary[];
  summaryCards: DashboardKpi[];
}

export interface DepartmentDashboardAccess {
  data: Awaited<Promise<unknown>>;
  departmentId: string;
  departmentName: string | null;
}

export type ApprovalQueueSource = DirectiveApprovalQueueItem;
