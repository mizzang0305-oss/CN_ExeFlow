export type CeoReportBucket = "진행중" | "완료" | "지속";
export type CeoReportSourceLabel = "대표 지시사항" | "부사장 지시사항";

export type CeoReportInputItem = {
  assignedDepartments?: readonly { departmentName?: string | null }[];
  content?: string | null;
  departments?: readonly string[];
  directiveNo?: string | null;
  dueDate?: string | null;
  id?: string | null;
  instructedAt?: string | null;
  internalStatus?: string | null;
  originalDepartmentText?: string | null;
  rawStatus?: string | null;
  reportBucket?: string | null;
  sourceOrder?: number | string | null;
  sourceLabel?: string | null;
  status?: string | null;
  title?: string | null;
};

export type CeoReportMetricSummary = {
  completedCount: number;
  completionRate: number;
  continuingCount: number;
  inProgressCount: number;
  totalCount: number;
};

export type CeoReportDepartmentSummary = CeoReportMetricSummary & {
  departmentName: string;
};

export type CeoReportSourceSummary = CeoReportMetricSummary & {
  sourceLabel: CeoReportSourceLabel;
};

export type CeoReportDirectiveItem = {
  departmentNames: string[];
  directiveNo: string;
  dueDate: string | null;
  href: string;
  id: string;
  instructedAt: string | null;
  reportBucket: CeoReportBucket;
  sourceLabel: CeoReportSourceLabel;
  status: string;
  statusLabel: string;
  title: string;
};

export type CeoReportDrilldownFilter = {
  bucket?: CeoReportBucket;
  buckets?: CeoReportBucket[];
  departmentName?: string;
  sourceLabel?: CeoReportSourceLabel;
  title: string;
};

export type CeoReportSummary = {
  departmentSummary: CeoReportDepartmentSummary[];
  items: CeoReportDirectiveItem[];
  meetingLabel: string;
  reportDateLabel: string;
  sourceSummary: CeoReportSourceSummary[];
  total: CeoReportMetricSummary;
};

const CEO_REPORT_DEPARTMENT_ORDER = [
  "전 부서",
  "기획영업부",
  "경영관리센터",
  "구매물류부",
  "각 부서장",
  "각 리더",
  "공장총괄본부",
] as const;

const CEO_REPORT_SOURCE_ORDER = ["대표 지시사항", "부사장 지시사항"] as const;

const CEO_REPORT_STATUS_LABELS = new Map<string, string>([
  ["NEW", "대기"],
  ["IN_PROGRESS", "진행중"],
  ["COMPLETION_REQUESTED", "승인 대기"],
  ["DELAYED", "지연"],
  ["COMPLETED", "완료"],
  ["REJECTED", "반려"],
]);

const departmentAliases = new Map<string, (typeof CEO_REPORT_DEPARTMENT_ORDER)[number]>([
  ["전체", "전 부서"],
  ["전부서", "전 부서"],
  ["전 부서", "전 부서"],
  ["주식회사 씨엔푸드", "전 부서"],
  ["영업본부", "기획영업부"],
  ["기획영업부", "기획영업부"],
  ["경영관리부", "경영관리센터"],
  ["경영지원센터", "경영관리센터"],
  ["경영관리센터", "경영관리센터"],
  ["HACCP", "경영관리센터"],
  ["구매물류부", "구매물류부"],
  ["물류부", "구매물류부"],
  ["공장총괄", "공장총괄본부"],
  ["공장총괄본부", "공장총괄본부"],
  ["육가공", "공장총괄본부"],
  ["각 부서장", "각 부서장"],
  ["각 리더", "각 리더"],
]);

function createEmptyMetricSummary(): CeoReportMetricSummary {
  return {
    completedCount: 0,
    completionRate: 0,
    continuingCount: 0,
    inProgressCount: 0,
    totalCount: 0,
  };
}

export function calculateCeoReportCompletionRate(
  completedCount: number,
  continuingCount: number,
  totalCount: number,
) {
  return totalCount === 0 ? 0 : Math.round(((completedCount + continuingCount) / totalCount) * 100);
}

function applyBucket(summary: CeoReportMetricSummary, bucket: CeoReportBucket) {
  summary.totalCount += 1;

  if (bucket === "완료") {
    summary.completedCount += 1;
  } else if (bucket === "지속") {
    summary.continuingCount += 1;
  } else {
    summary.inProgressCount += 1;
  }
}

function finalizeSummary(summary: CeoReportMetricSummary): CeoReportMetricSummary {
  return {
    ...summary,
    completionRate: calculateCeoReportCompletionRate(
      summary.completedCount,
      summary.continuingCount,
      summary.totalCount,
    ),
  };
}

export function normalizeCeoReportBucket(value: string | null | undefined, internalStatus?: string | null): CeoReportBucket {
  const trimmed = value?.trim();

  if (trimmed === "완료") {
    return "완료";
  }

  if (trimmed === "지속") {
    return "지속";
  }

  if (trimmed === "진행중") {
    return "진행중";
  }

  return internalStatus === "COMPLETED" ? "완료" : "진행중";
}

export function normalizeCeoReportSourceLabel(value: string | null | undefined): CeoReportSourceLabel {
  const trimmed = value?.trim();
  return trimmed?.includes("부사장") ? "부사장 지시사항" : "대표 지시사항";
}

export function normalizeCeoReportDepartments(value: string | readonly string[] | null | undefined) {
  const labels =
    typeof value === "string"
      ? value.split(/\s*(?:,|\/|\\|\||ㆍ|·|，|、|;|；|\n|\r|\+|&)\s*/)
      : (value ?? []);
  const normalized: string[] = [];

  for (const label of labels) {
    const mapped = departmentAliases.get(label.trim());

    if (mapped && !normalized.includes(mapped)) {
      normalized.push(mapped);
    }
  }

  return normalized;
}

function readContentLabel(content: string | null | undefined, label: string) {
  if (!content) {
    return null;
  }

  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`(?:^|\\n)\\s*(?:-\\s*)?${escaped}\\s*:\\s*([^\\n]+)`));
  return match?.[1]?.trim() || null;
}

export function extractCeoReportMetadata(content: string | null | undefined) {
  const reportBucket = readContentLabel(content, "보고상태") ?? readContentLabel(content, "원본상태");
  const departmentText = readContentLabel(content, "원본담당부서") ?? readContentLabel(content, "보고담당부서");
  const sourceLabel = readContentLabel(content, "주관");

  return {
    departments: normalizeCeoReportDepartments(departmentText),
    reportBucket,
    sourceLabel,
  };
}

function resolveReportDepartments(item: CeoReportInputItem, metadata: ReturnType<typeof extractCeoReportMetadata>) {
  if (Array.isArray(item.departments) && item.departments.length > 0) {
    return normalizeCeoReportDepartments(item.departments);
  }

  if (metadata.departments.length > 0) {
    return metadata.departments;
  }

  const assignedDepartmentNames =
    item.assignedDepartments?.flatMap((department) => department.departmentName ?? []) ?? [];

  return normalizeCeoReportDepartments(
    assignedDepartmentNames.length > 0 ? assignedDepartmentNames : item.originalDepartmentText,
  );
}

function getCeoReportStatusLabel(status: string) {
  return CEO_REPORT_STATUS_LABELS.get(status) ?? "상태 확인 필요";
}

function getFallbackDirectiveNo(item: CeoReportInputItem, index: number) {
  if (item.sourceOrder !== null && item.sourceOrder !== undefined && `${item.sourceOrder}`.trim()) {
    return `REPORT-${`${item.sourceOrder}`.trim().padStart(3, "0")}`;
  }

  return `REPORT-${`${index + 1}`.padStart(3, "0")}`;
}

function getFallbackTitle(content: string | null | undefined) {
  const firstLine = content?.split(/\r?\n/).find((line) => line.trim())?.trim();
  return firstLine || "지시사항";
}

function buildCeoReportDirectiveItem(
  item: CeoReportInputItem,
  options: {
    bucket: CeoReportBucket;
    departments: string[];
    index: number;
    sourceLabel: CeoReportSourceLabel;
  },
): CeoReportDirectiveItem {
  const id = item.id?.trim() || `report-${options.index + 1}`;
  const status = item.status ?? item.internalStatus ?? (options.bucket === "완료" ? "COMPLETED" : "IN_PROGRESS");

  return {
    departmentNames: [...options.departments],
    directiveNo: item.directiveNo?.trim() || getFallbackDirectiveNo(item, options.index),
    dueDate: item.dueDate ?? null,
    href: `/directives/${id}`,
    id,
    instructedAt: item.instructedAt ?? null,
    reportBucket: options.bucket,
    sourceLabel: options.sourceLabel,
    status,
    statusLabel: getCeoReportStatusLabel(status),
    title: item.title?.trim() || getFallbackTitle(item.content),
  };
}

export function filterCeoReportDirectiveItems(
  items: readonly CeoReportDirectiveItem[],
  filter: CeoReportDrilldownFilter,
) {
  return items.filter((item) => {
    if (filter.bucket && item.reportBucket !== filter.bucket) {
      return false;
    }

    if (filter.buckets && !filter.buckets.includes(item.reportBucket)) {
      return false;
    }

    if (filter.departmentName && !item.departmentNames.includes(filter.departmentName)) {
      return false;
    }

    if (filter.sourceLabel && item.sourceLabel !== filter.sourceLabel) {
      return false;
    }

    return true;
  });
}

export function buildCeoReportSummary(items: readonly CeoReportInputItem[]): CeoReportSummary {
  const total = createEmptyMetricSummary();
  const reportItems: CeoReportDirectiveItem[] = [];
  const departmentMap = new Map<string, CeoReportMetricSummary>(
    CEO_REPORT_DEPARTMENT_ORDER.map((departmentName) => [departmentName, createEmptyMetricSummary()]),
  );
  const sourceMap = new Map<CeoReportSourceLabel, CeoReportMetricSummary>(
    CEO_REPORT_SOURCE_ORDER.map((sourceLabel) => [sourceLabel, createEmptyMetricSummary()]),
  );

  for (const [index, item] of items.entries()) {
    const metadata = extractCeoReportMetadata(item.content);
    const bucket = normalizeCeoReportBucket(
      item.reportBucket ?? item.rawStatus ?? metadata.reportBucket,
      item.status ?? item.internalStatus,
    );
    const sourceLabel = normalizeCeoReportSourceLabel(item.sourceLabel ?? metadata.sourceLabel);
    const departments = resolveReportDepartments(item, metadata);

    applyBucket(total, bucket);
    applyBucket(sourceMap.get(sourceLabel) ?? total, bucket);

    for (const departmentName of departments) {
      const summary = departmentMap.get(departmentName);

      if (summary) {
        applyBucket(summary, bucket);
      }
    }

    reportItems.push(
      buildCeoReportDirectiveItem(item, {
        bucket,
        departments,
        index,
        sourceLabel,
      }),
    );
  }

  return {
    departmentSummary: CEO_REPORT_DEPARTMENT_ORDER.map((departmentName) => ({
      departmentName,
      ...finalizeSummary(departmentMap.get(departmentName) ?? createEmptyMetricSummary()),
    })),
    items: reportItems,
    meetingLabel: "주간 관리자 회의",
    reportDateLabel: "2026. 5. 8.",
    sourceSummary: CEO_REPORT_SOURCE_ORDER.map((sourceLabel) => ({
      sourceLabel,
      ...finalizeSummary(sourceMap.get(sourceLabel) ?? createEmptyMetricSummary()),
    })),
    total: finalizeSummary(total),
  };
}
