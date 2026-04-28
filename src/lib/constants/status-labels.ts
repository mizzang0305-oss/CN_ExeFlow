export const DIRECTIVE_STATUS_VALUES = [
  "NEW",
  "IN_PROGRESS",
  "COMPLETION_REQUESTED",
  "DELAYED",
  "COMPLETED",
  "REJECTED",
] as const;

export type DirectiveStatusValue = (typeof DIRECTIVE_STATUS_VALUES)[number];

export const DIRECTIVE_STATUS_LABELS: Record<DirectiveStatusValue, string> = {
  COMPLETED: "완료",
  COMPLETION_REQUESTED: "승인 대기",
  DELAYED: "지연",
  IN_PROGRESS: "진행중",
  NEW: "신규",
  REJECTED: "반려",
};

export const URGENT_STATUS_LABEL = "긴급";

export type StatusFilterOption = {
  key: "ALL" | DirectiveStatusValue | "URGENT";
  label: string;
  status: DirectiveStatusValue | null;
  urgent: boolean;
};

export const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { key: "ALL", label: "전체", status: null, urgent: false },
  { key: "IN_PROGRESS", label: DIRECTIVE_STATUS_LABELS.IN_PROGRESS, status: "IN_PROGRESS", urgent: false },
  {
    key: "COMPLETION_REQUESTED",
    label: DIRECTIVE_STATUS_LABELS.COMPLETION_REQUESTED,
    status: "COMPLETION_REQUESTED",
    urgent: false,
  },
  { key: "DELAYED", label: DIRECTIVE_STATUS_LABELS.DELAYED, status: "DELAYED", urgent: false },
  { key: "COMPLETED", label: DIRECTIVE_STATUS_LABELS.COMPLETED, status: "COMPLETED", urgent: false },
  { key: "REJECTED", label: DIRECTIVE_STATUS_LABELS.REJECTED, status: "REJECTED", urgent: false },
  { key: "URGENT", label: URGENT_STATUS_LABEL, status: null, urgent: true },
];

const statusSet = new Set<string>(DIRECTIVE_STATUS_VALUES);

export type CeoDirectiveQuery = {
  departmentId: string;
  limit: number;
  page: number;
  status: DirectiveStatusValue | null;
  urgent: boolean;
};

export type DepartmentDirectiveCacheKeyInput = {
  departmentId: string;
  limit: number;
  page: number;
  status: DirectiveStatusValue | null;
  urgent: boolean;
};

function normalizePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isDirectiveStatusValue(value: unknown): value is DirectiveStatusValue {
  return typeof value === "string" && statusSet.has(value);
}

export function normalizeDirectiveStatus(value: string | null | undefined): DirectiveStatusValue | null {
  return isDirectiveStatusValue(value) ? value : null;
}

export function normalizeUrgentQueryValue(value: string | null | undefined) {
  return value === "true" || value === "1";
}

export function normalizeCeoDirectiveQuery(searchParams: URLSearchParams): CeoDirectiveQuery {
  const departmentId = searchParams.get("departmentId")?.trim() ?? "";
  const page = normalizePositiveInteger(searchParams.get("page"), 1);
  const requestedLimit = normalizePositiveInteger(searchParams.get("limit"), 50);

  return {
    departmentId,
    limit: Math.min(requestedLimit, 100),
    page,
    status: normalizeDirectiveStatus(searchParams.get("status")),
    urgent: normalizeUrgentQueryValue(searchParams.get("urgent")),
  };
}

export function buildDepartmentDirectiveCacheKey({
  departmentId,
  limit,
  page,
  status,
  urgent,
}: DepartmentDirectiveCacheKeyInput) {
  return `${departmentId}|${status ?? "ALL"}|${urgent}|${page}|${limit}`;
}

export function getDirectiveStatusLabel(status: string) {
  return isDirectiveStatusValue(status) ? DIRECTIVE_STATUS_LABELS[status] : "상태 확인 필요";
}
