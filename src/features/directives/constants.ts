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
  NEW: "신규",
  IN_PROGRESS: "진행 중",
  COMPLETION_REQUESTED: "승인 대기",
  DELAYED: "지연",
  COMPLETED: "완료",
  REJECTED: "반려",
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
