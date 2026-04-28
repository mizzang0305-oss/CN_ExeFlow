import { DIRECTIVE_STATUS_LABELS, DIRECTIVE_STATUS_VALUES } from "@/lib/constants/status-labels";

export const directiveStatuses = [
  ...DIRECTIVE_STATUS_VALUES,
] as const;

export const directiveLogTypes = [
  "VISIT",
  "CALL",
  "MEETING",
  "DOCUMENT_SUBMITTED",
  "ISSUE_FOUND",
  "ISSUE_RESOLVED",
  "PHOTO_UPLOADED",
  "STATUS_NOTE",
] as const;

export const directiveUrgentLevels = ["LOW", "HIGH", "CRITICAL"] as const;

export const directiveStatusLabels = {
  ...DIRECTIVE_STATUS_LABELS,
} as const;

export const directiveUrgentLevelLabels = {
  LOW: "L1",
  HIGH: "L2",
  CRITICAL: "L3",
} as const;

export const directiveLogTypeLabels = {
  VISIT: "현장 방문",
  CALL: "통화",
  MEETING: "미팅",
  DOCUMENT_SUBMITTED: "문서 제출",
  ISSUE_FOUND: "이슈 발견",
  ISSUE_RESOLVED: "이슈 해결",
  PHOTO_UPLOADED: "사진 업로드",
  STATUS_NOTE: "상태 메모",
} as const;
