import type { JsonObject } from "@/types";

import type { directiveLogTypes, directiveStatuses } from "./constants";

export type DirectiveStatus = (typeof directiveStatuses)[number];
export type DirectiveLogType = (typeof directiveLogTypes)[number];
export type DirectiveTargetScope = "ALL" | "SELECTED";
export type DirectiveDepartmentAssignmentRole = "OWNER" | "SUPPORT" | "REFERENCE";

export interface DirectiveRow {
  content: string;
  created_at: string;
  created_by: string;
  directive_no: string;
  due_date: string | null;
  id: string;
  is_archived: boolean;
  is_urgent: boolean;
  owner_department_id: string | null;
  owner_user_id: string | null;
  status: DirectiveStatus;
  title: string;
  urgent_level: number | null;
}

export interface DirectiveDepartmentRow {
  assigned_at: string | null;
  assignment_role?: DirectiveDepartmentAssignmentRole | null;
  created_at: string;
  department_closed_at: string | null;
  department_due_date: string | null;
  department_head_id: string | null;
  department_id: string;
  department_status: DirectiveStatus;
  directive_id: string;
  id: string;
  is_primary?: boolean | null;
  updated_at: string | null;
}

export interface DirectiveLogRow {
  action_summary: string;
  created_at: string;
  delete_reason: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  department_id: string;
  detail: string | null;
  directive_id: string;
  id: string;
  is_deleted: boolean;
  updated_at: string | null;
  user_id: string;
}

export interface DirectiveAttachmentRow {
  directive_id: string;
  file_name: string;
  file_size: number | null;
  file_type: "DOCUMENT" | "IMAGE" | "OTHER";
  file_url: string;
  id: string;
  log_id: string | null;
  mime_type: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

export interface WeeklyReportRow {
  completed_count: number;
  completion_rate: number | null;
  created_at: string;
  created_by: string | null;
  delayed_count: number;
  id: string;
  in_progress_count: number;
  new_count: number;
  on_time_completion_rate: number | null;
  report_json: JsonObject | null;
  total_count: number;
  week_end: string;
  week_start: string;
}

export interface DepartmentRecord {
  code: string;
  head_user_id: string | null;
  id: string;
  name: string;
}

export interface UserRecord {
  department_id: string | null;
  id: string;
  name: string;
  profile_name: string | null;
  role: string;
  title: string | null;
}

export interface DirectiveListFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: DirectiveStatus;
}

export interface CreateDirectiveInput {
  content: string;
  dueDate: string | null;
  isUrgent: boolean;
  ownerUserId: string | null;
  primaryDepartmentId: string;
  selectedDepartmentIds: string[];
  targetScope: DirectiveTargetScope;
  title: string;
  urgentLevel: number | null;
}

export interface CreateDirectiveLogInput {
  actionSummary: string;
  detail: string | null;
  departmentId: string | null;
  directiveId: string;
  happenedAt: string;
  logType: DirectiveLogType;
  nextAction: string | null;
  riskNote: string | null;
}

export interface UpdateDirectiveLogInput extends CreateDirectiveLogInput {
  logId: string;
}

export interface DeleteDirectiveLogInput {
  directiveId: string;
  logId: string;
  reason: string | null;
}

export interface WorkflowDecisionInput {
  departmentId: string | null;
  directiveId: string;
  reason: string | null;
}

export interface DirectiveActivitySummary {
  attachmentCount: number;
  lastActivityAt: string;
  logCount: number;
}

export interface DirectiveListItem extends DirectiveActivitySummary {
  departmentProgress: Record<DirectiveStatus, number>;
  directiveNo: string;
  dueDate: string | null;
  id: string;
  isDelayed: boolean;
  isUrgent: boolean;
  ownerDepartmentCode: string | null;
  ownerDepartmentName: string | null;
  ownerUserName: string | null;
  status: DirectiveStatus;
  supportDepartmentCount: number;
  targetDepartmentCount: number;
  targetScope: DirectiveTargetScope;
  title: string;
  urgentLevel: number | null;
}

export interface DirectiveLogMeta {
  detail: string | null;
  happenedAt: string;
  logType: DirectiveLogType;
  nextAction: string | null;
  riskNote: string | null;
}

export interface DirectiveLogItem {
  actionSummary: string;
  attachmentCount: number;
  createdAt: string;
  deleteReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  departmentId: string;
  departmentName: string | null;
  detail: string | null;
  directiveId: string;
  happenedAt: string;
  id: string;
  isDeleted: boolean;
  logType: DirectiveLogType;
  nextAction: string | null;
  riskNote: string | null;
  updatedAt: string | null;
  userId: string;
  userName: string | null;
}

export interface DirectiveAttachmentItem {
  downloadUrl: string | null;
  departmentId: string | null;
  departmentName: string | null;
  fileName: string;
  fileSize: number | null;
  fileType: "DOCUMENT" | "IMAGE" | "OTHER";
  id: string;
  isImage: boolean;
  logId: string | null;
  mimeType: string | null;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string | null;
}

export interface DirectiveWorkflowFlags {
  canCreateDirective: boolean;
  canManageLogs: boolean;
  canManageMultipleDepartments: boolean;
  canRequestCompletion: boolean;
  currentDepartmentId: string | null;
  isReadOnly: boolean;
}

export interface DirectiveDepartmentProgress {
  assignmentRole: DirectiveDepartmentAssignmentRole;
  assignedAt: string | null;
  attachmentCount: number;
  departmentCode: string | null;
  departmentHeadId: string | null;
  departmentHeadName: string | null;
  departmentId: string;
  departmentName: string | null;
  departmentStatus: DirectiveStatus;
  dueDate: string | null;
  isCurrentDepartment: boolean;
  isPrimary: boolean;
  isRequestableByCurrentUser: boolean;
  lastActivityAt: string | null;
  logCount: number;
}

export interface DirectiveDetail extends DirectiveActivitySummary {
  attachments: DirectiveAttachmentItem[];
  content: string;
  createdAt: string;
  createdBy: string;
  createdByName: string | null;
  directiveNo: string;
  dueDate: string | null;
  id: string;
  isArchived: boolean;
  isDelayed: boolean;
  isUrgent: boolean;
  departments: DirectiveDepartmentProgress[];
  departmentProgress: Record<DirectiveStatus, number>;
  logs: DirectiveLogItem[];
  ownerDepartmentId: string | null;
  ownerDepartmentName: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  status: DirectiveStatus;
  supportDepartmentCount: number;
  targetDepartmentCount: number;
  targetScope: DirectiveTargetScope;
  title: string;
  urgentLevel: number | null;
  workflow: DirectiveWorkflowFlags;
}

export interface DashboardKpi {
  label: string;
  tone: "danger" | "default" | "muted" | "success" | "warning";
  value: number;
}

export interface DashboardRecentUpdate {
  actionSummary: string;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
  happenedAt: string;
  logType: DirectiveLogType;
  userName: string | null;
}

export interface DashboardData {
  delayedItems: DirectiveListItem[];
  kpis: DashboardKpi[];
  recentUpdates: DashboardRecentUpdate[];
  urgentItems: DirectiveListItem[];
  waitingApprovalItems: DirectiveListItem[];
}

export interface DepartmentBoardData {
  dueSoonItems: DirectiveListItem[];
  kpis: DashboardKpi[];
  missingEvidenceItems: DirectiveListItem[];
  recentUpdates: DashboardRecentUpdate[];
  urgentItems: DirectiveListItem[];
  waitingApprovalItems: DirectiveListItem[];
}

export interface WeeklyReportSummary {
  completionRate: number | null;
  completedCount: number;
  createdAt: string;
  createdBy: string | null;
  delayedCount: number;
  id: string;
  inProgressCount: number;
  newCount: number;
  onTimeCompletionRate: number | null;
  totalCount: number;
  weekEnd: string;
  weekStart: string;
}

export interface ReportsOverview {
  canGenerate: boolean;
  latestReport: WeeklyReportSummary | null;
  recentReports: WeeklyReportSummary[];
  summaryCards: DashboardKpi[];
}

export interface PaginatedDirectives {
  items: DirectiveListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface HistoryMetadata extends JsonObject {
  [key: string]: string | number | boolean | null | JsonObject | undefined;
}
