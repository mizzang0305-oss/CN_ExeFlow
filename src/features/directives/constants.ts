export const directiveSourceTypes = ["CEO_DIRECT", "MEETING", "FOLLOW_UP"] as const;

export const directivePriorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;

export const directiveStatuses = [
  "NEW",
  "IN_PROGRESS",
  "COMPLETION_REQUESTED",
  "DELAYED",
  "COMPLETED",
  "REJECTED",
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

export const directiveStatusLabels = {
  COMPLETED: "완료",
  COMPLETION_REQUESTED: "확인 대기",
  DELAYED: "지연",
  IN_PROGRESS: "진행 중",
  NEW: "신규",
  REJECTED: "반려",
} as const;

export const directivePriorityLabels = {
  CRITICAL: "매우 높음",
  HIGH: "높음",
  LOW: "낮음",
  MEDIUM: "보통",
} as const;

export const directiveLogTypeLabels = {
  CALL: "통화",
  DOCUMENT_SUBMITTED: "문서 제출",
  ISSUE_FOUND: "이슈 발견",
  ISSUE_RESOLVED: "이슈 해결",
  MEETING: "미팅",
  PHOTO_UPLOADED: "사진 업로드",
  STATUS_NOTE: "상태 메모",
  VISIT: "현장 방문",
} as const;
