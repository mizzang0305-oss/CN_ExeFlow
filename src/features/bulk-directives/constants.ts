import type { DirectiveStatus, DirectiveUrgentLevel } from "@/features/directives";

export const BULK_DIRECTIVE_TEMPLATE_PATH = "/templates/CN_EXEFLOW_지시사항_일괄등록_양식.xlsx";
export const BULK_DIRECTIVE_TEMPLATE_FILE_NAME = "CN_EXEFLOW_지시사항_일괄등록_양식.xlsx";

export const BULK_DIRECTIVE_REQUIRED_COLUMNS = [
  "회의일",
  "주관",
  "지시사항",
  "담당부서",
  "상태",
  "긴급여부",
  "긴급등급",
  "마감일",
  "비고",
] as const;

export const BULK_DIRECTIVE_ALLOWED_DEPARTMENTS = [
  "전체",
  "경영관리센터",
  "영업본부",
  "구매물류부",
  "공장총괄본부",
] as const;

export const BULK_DIRECTIVE_STATUS_LABEL_TO_VALUE: Record<string, DirectiveStatus> = {
  대기: "NEW",
  완료: "COMPLETED",
  반려: "REJECTED",
  "승인 대기": "COMPLETION_REQUESTED",
  승인대기: "COMPLETION_REQUESTED",
  진행중: "IN_PROGRESS",
  지연: "DELAYED",
};

export const BULK_DIRECTIVE_STATUS_VALUE_TO_LABEL: Record<DirectiveStatus, string> = {
  COMPLETED: "완료",
  COMPLETION_REQUESTED: "승인 대기",
  DELAYED: "지연",
  IN_PROGRESS: "진행중",
  NEW: "대기",
  REJECTED: "반려",
};

export const BULK_DIRECTIVE_URGENT_LEVEL_LABELS: Record<DirectiveUrgentLevel, string> = {
  CRITICAL: "매우 긴급",
  HIGH: "높음",
  LOW: "낮음",
};

export const BULK_DIRECTIVE_STATUS_BADGE_LABELS = {
  CANCELED: "비노출",
  FAILED: "실패",
  PREVIEW: "미리보기",
  REGISTERED: "등록 완료",
} as const;
