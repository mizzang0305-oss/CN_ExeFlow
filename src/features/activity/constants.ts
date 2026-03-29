import type {
  AuthActivityEventResult,
  AuthActivityEventType,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  UserActivityType,
} from "./types";

export const authActivityEventLabels: Record<AuthActivityEventType, string> = {
  LOGIN_FAILED: "로그인 실패",
  LOGIN_SUCCESS: "로그인 성공",
  LOGOUT: "로그아웃",
  SESSION_EXPIRED: "세션 만료",
};

export const authActivityEventResultLabels: Record<AuthActivityEventResult, string> = {
  EXPIRED: "만료",
  FAILED: "실패",
  SUCCESS: "성공",
};

export const userActivityTypeLabels: Record<UserActivityType, string> = {
  APPROVAL_CLICK: "승인 클릭",
  APPROVAL_QUEUE_VIEW: "승인 대기 큐 조회",
  ATTACHMENT_UPLOAD: "첨부 업로드",
  COMPLETION_REQUEST_CLICK: "완료 요청 클릭",
  DASHBOARD_VIEW: "대시보드 진입",
  DIRECTIVE_DETAIL_VIEW: "지시 상세 조회",
  DIRECTIVE_LIST_VIEW: "지시사항 목록 조회",
  DIRECTIVE_LOG_CREATE: "로그 등록",
  REJECTION_CLICK: "반려 클릭",
};

export const activityTargetTypeLabels: Record<string, string> = {
  directive: "지시",
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  APPROVAL_COMPLETED: "승인 완료",
  APPROVAL_REQUESTED: "승인 요청",
  COMPLETION_REQUESTED: "완료 요청",
  DIRECTIVE_ASSIGNED: "지시 배정",
  DIRECTIVE_DELAYED: "지연 발생",
  DIRECTIVE_REJECTED: "반려",
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  PUSH: "푸시",
};

export const notificationDeliveryStatusLabels: Record<NotificationDeliveryStatus, string> = {
  FAILED: "실패",
  PENDING: "대기",
  READ: "읽음",
  SENT: "발송",
};
