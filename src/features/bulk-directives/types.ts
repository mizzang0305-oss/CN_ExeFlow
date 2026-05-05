import type { DirectiveStatus, DirectiveUrgentLevel } from "@/features/directives";

export type BulkImportBatchStatus = "CANCELED" | "FAILED" | "PREVIEW" | "REGISTERED";
export type BulkImportType = "DIRECTIVE";

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
  dueDate: string | null;
  isUrgent: boolean;
  meetingDate: string;
  note: string | null;
  status: DirectiveStatus;
  statusLabel: string;
  title: string;
  urgentLevel: DirectiveUrgentLevel | null;
};

export type BulkDirectivePreviewRow = {
  batchRowId: string | null;
  chairRole: string | null;
  content: string;
  departments: string[];
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
};

export type BulkDirectivePreviewResponse = {
  batchId: string;
  invalidRows: number;
  rows: BulkDirectivePreviewRow[];
  totalRows: number;
  validRows: number;
};

export type BulkImportBatchRow = {
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

export type BulkDirectiveArchiveResult = {
  archivedCount: number;
  archivedDirectiveIds: string[];
  message: string;
};
