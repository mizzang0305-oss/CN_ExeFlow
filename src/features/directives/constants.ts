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
  "FOLLOW_UP_DIRECTIVE",
  "ADDITIONAL_INSTRUCTION",
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
  ADDITIONAL_INSTRUCTION: "추가 지시",
  CALL: "통화",
  DOCUMENT_SUBMITTED: "문서 제출",
  FOLLOW_UP_DIRECTIVE: "후속 지시",
  ISSUE_FOUND: "이슈 발견",
  ISSUE_RESOLVED: "이슈 해결",
  MEETING: "회의",
  PHOTO_UPLOADED: "사진 등록",
  STATUS_NOTE: "상태 메모",
  VISIT: "현장 방문",
} as const;
