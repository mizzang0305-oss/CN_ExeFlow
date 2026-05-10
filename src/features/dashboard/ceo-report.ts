export type CeoReportBucket = "진행중" | "완료" | "지속";
export type CeoReportSourceLabel = "대표 지시사항" | "부사장 지시사항";

export type CeoReportInputItem = {
  assignedDepartments?: readonly { departmentName?: string | null }[];
  content?: string | null;
  departments?: readonly string[];
  originalDepartmentText?: string | null;
  rawStatus?: string | null;
  reportBucket?: string | null;
  sourceLabel?: string | null;
  status?: string | null;
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

export type CeoReportSummary = {
  departmentSummary: CeoReportDepartmentSummary[];
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
  const departmentText = readContentLabel(content, "보고담당부서") ?? readContentLabel(content, "원본담당부서");
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

export function buildCeoReportSummary(items: readonly CeoReportInputItem[]): CeoReportSummary {
  const total = createEmptyMetricSummary();
  const departmentMap = new Map<string, CeoReportMetricSummary>(
    CEO_REPORT_DEPARTMENT_ORDER.map((departmentName) => [departmentName, createEmptyMetricSummary()]),
  );
  const sourceMap = new Map<CeoReportSourceLabel, CeoReportMetricSummary>(
    CEO_REPORT_SOURCE_ORDER.map((sourceLabel) => [sourceLabel, createEmptyMetricSummary()]),
  );

  for (const item of items) {
    const metadata = extractCeoReportMetadata(item.content);
    const bucket = normalizeCeoReportBucket(
      item.reportBucket ?? item.rawStatus ?? metadata.reportBucket,
      item.status,
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
  }

  return {
    departmentSummary: CEO_REPORT_DEPARTMENT_ORDER.map((departmentName) => ({
      departmentName,
      ...finalizeSummary(departmentMap.get(departmentName) ?? createEmptyMetricSummary()),
    })),
    meetingLabel: "주간 관리자 회의",
    reportDateLabel: "2026. 5. 8.",
    sourceSummary: CEO_REPORT_SOURCE_ORDER.map((sourceLabel) => ({
      sourceLabel,
      ...finalizeSummary(sourceMap.get(sourceLabel) ?? createEmptyMetricSummary()),
    })),
    total: finalizeSummary(total),
  };
}
