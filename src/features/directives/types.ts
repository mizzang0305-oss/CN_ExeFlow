import type { JsonObject } from "@/types";

import type {
  directiveLogTypes,
  directivePriorities,
  directiveSourceTypes,
  directiveStatuses,
} from "./constants";

export type DirectiveSourceType = (typeof directiveSourceTypes)[number];
export type DirectivePriority = (typeof directivePriorities)[number];
export type DirectiveStatus = (typeof directiveStatuses)[number];
export type DirectiveLogType = (typeof directiveLogTypes)[number];

export interface DirectiveRow {
  close_reason: string | null;
  closed_at: string | null;
  content: string;
  created_at: string;
  created_by: string;
  directive_no: string;
  due_date: string | null;
  id: string;
  instructed_at: string;
  is_archived: boolean;
  is_urgent: boolean;
  owner_department_id: string | null;
  owner_user_id: string | null;
  priority: DirectivePriority;
  source_type: DirectiveSourceType;
  status: DirectiveStatus;
  title: string;
  updated_at: string;
  urgent_level: number | null;
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
  happened_at: string;
  id: string;
  is_deleted: boolean;
  log_type: string;
  next_action: string | null;
  risk_note: string | null;
  task_id: string | null;
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

export interface DepartmentRecord {
  code: string;
  id: string;
  name: string;
}

export interface UserRecord {
  department_id: string | null;
  id: string;
  name: string;
  role: string;
}

export interface DirectiveListFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: DirectiveStatus;
}

export interface CreateDirectiveInput {
  content: string;
  createdBy: string;
  dueDate: string | null;
  instructedAt: string;
  isUrgent: boolean;
  ownerDepartmentId: string | null;
  ownerUserId: string | null;
  priority: DirectivePriority;
  sourceType: DirectiveSourceType;
  title: string;
  urgentLevel: number | null;
}

export interface CreateDirectiveLogInput {
  actionSummary: string;
  departmentId: string;
  detail: string | null;
  directiveId: string;
  happenedAt: string;
  logType: DirectiveLogType;
  nextAction: string | null;
  riskNote: string | null;
  taskId: string | null;
  userId: string;
}

export interface UpdateDirectiveLogInput extends CreateDirectiveLogInput {
  logId: string;
}

export interface DeleteDirectiveLogInput {
  deletedBy: string;
  directiveId: string;
  logId: string;
  reason: string | null;
}

export interface DirectiveListItem {
  directiveNo: string;
  dueDate: string | null;
  id: string;
  isDelayed: boolean;
  isUrgent: boolean;
  ownerDepartmentCode: string | null;
  ownerDepartmentName: string | null;
  priority: DirectivePriority;
  status: DirectiveStatus;
  title: string;
  updatedAt: string;
  urgentLevel: number | null;
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
  logType: string;
  nextAction: string | null;
  riskNote: string | null;
  taskId: string | null;
  updatedAt: string | null;
  userId: string;
  userName: string | null;
}

export interface DirectiveAttachmentItem {
  downloadUrl: string | null;
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

export interface DirectiveDetail {
  attachments: DirectiveAttachmentItem[];
  canManageLogs: boolean;
  closeReason: string | null;
  closedAt: string | null;
  content: string;
  createdAt: string;
  createdBy: string;
  createdByName: string | null;
  directiveNo: string;
  dueDate: string | null;
  id: string;
  instructedAt: string;
  isArchived: boolean;
  isDelayed: boolean;
  isUrgent: boolean;
  logs: DirectiveLogItem[];
  ownerDepartmentId: string | null;
  ownerDepartmentName: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  priority: DirectivePriority;
  sourceType: DirectiveSourceType;
  status: DirectiveStatus;
  title: string;
  updatedAt: string;
  urgentLevel: number | null;
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
  logType: string;
  userName: string | null;
}

export interface DashboardData {
  delayedItems: DirectiveListItem[];
  kpis: DashboardKpi[];
  recentUpdates: DashboardRecentUpdate[];
  urgentItems: DirectiveListItem[];
  waitingApprovalItems: DirectiveListItem[];
}

export interface DirectiveDetailApiResponse {
  data: DirectiveDetail;
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
