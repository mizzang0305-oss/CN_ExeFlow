import type { DirectiveStatus, DirectiveUrgentLevel } from "@/features/directives";

export type BulkImportBatchStatus = "CANCELED" | "FAILED" | "PREVIEW" | "REGISTERED";
export type BulkImportType = "DIRECTIVE" | "DIRECTIVE_REPLACE";

export type BulkDirectiveDepartment = {
  code: string | null;
  headUserId: string | null;
  id: string;
  name: string;
};

export type BulkDirectiveNormalizedData = {
  chairRole: string | null;
  content: string;
  departmentIds: string[];
  departments: string[];
  directiveNo?: string | null;
  dueDate: string | null;
  isUrgent: boolean;
  meetingDate: string;
  note: string | null;
  sequence?: number | null;
  sourceNo?: string | null;
  status: DirectiveStatus;
  statusLabel: string;
  targetScope?: "ALL" | "SELECTED";
  title: string;
  urgentLevel: DirectiveUrgentLevel | null;
  warnings?: string[];
  yearMonth?: string | null;
};

export type BulkDirectivePreviewRow = {
  batchRowId: string | null;
  chairRole: string | null;
  content: string;
  departments: string[];
  directiveNo?: string | null;
  dueDate: string | null;
  errors: string[];
  isUrgent: boolean;
  meetingDate: string;
  note: string | null;
  rowNumber: number;
  status: DirectiveStatus;
  statusLabel: string;
  title: string;
  urgentLevel: DirectiveUrgentLevel | null;
  valid: boolean;
  warnings?: string[];
};

export type BulkDirectivePreviewResponse = {
  activeDirectivesCount?: number;
  batchId: string;
  invalidRows: number;
  replaceMode?: boolean;
  rows: BulkDirectivePreviewRow[];
  totalRows: number;
  validRows: number;
};

export type BulkImportBatchRow = {
  archived_directives_count?: number | null;
  archive_reason?: string | null;
  created_at: string;
  created_by: string;
  file_name: string;
  id: string;
  invalid_rows: number;
  registered_at: string | null;
  status: BulkImportBatchStatus;
  total_rows: number;
  type: BulkImportType;
  valid_rows: number;
  replace_mode?: boolean | null;
};

export type BulkImportRowRow = {
  batch_id: string;
  created_at: string;
  directive_id: string | null;
  errors: string[] | null;
  id: string;
  normalized_data: BulkDirectiveNormalizedData | null;
  raw_data: Record<string, string | null>;
  row_number: number;
  valid: boolean;
};

export type BulkDirectiveBatchItem = {
  archivedDirectivesCount?: number;
  archiveReason?: string | null;
  createdAt: string;
  createdByName: string | null;
  fileName: string;
  id: string;
  invalidRows: number;
  registeredAt: string | null;
  registeredCount: number;
  status: BulkImportBatchStatus;
  totalRows: number;
  validRows: number;
};

export type BulkDirectiveManagementData = {
  batches: BulkDirectiveBatchItem[];
};

export type BulkDirectiveRegisterResult = {
  createdDirectiveIds: string[];
  message: string;
  registeredCount: number;
};

export type BulkDirectiveReplaceRegisterResult = BulkDirectiveRegisterResult & {
  archivedCount: number;
};

export type BulkDirectiveArchiveResult = {
  archivedCount: number;
  archivedDirectiveIds: string[];
  message: string;
};
