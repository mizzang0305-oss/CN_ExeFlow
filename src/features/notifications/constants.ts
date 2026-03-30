import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from "./types";

export const notificationTypes: NotificationType[] = [
  "DIRECTIVE_ASSIGNED",
  "COMPLETION_REQUESTED",
  "APPROVAL_REQUIRED",
  "REJECTED",
  "APPROVED",
  "DELAY_WARNING",
];

export const notificationChannels: NotificationChannel[] = ["IN_APP", "WEB_PUSH"];

export const notificationDeliveryStatuses: NotificationDeliveryStatus[] = [
  "PENDING",
  "SENT",
  "FAILED",
  "OPENED",
  "READ",
];

export const notificationTypeLabels: Record<NotificationType, string> = {
  APPROVAL_REQUIRED: "승인 필요",
  APPROVED: "승인 완료",
  COMPLETION_REQUESTED: "완료 요청",
  DELAY_WARNING: "지연 경고",
  DIRECTIVE_ASSIGNED: "지시 배정",
  REJECTED: "반려",
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  IN_APP: "인앱",
  WEB_PUSH: "웹푸시",
};

export const notificationDeliveryStatusLabels: Record<NotificationDeliveryStatus, string> = {
  FAILED: "실패",
  OPENED: "클릭",
  PENDING: "대기",
  READ: "읽음",
  SENT: "전송",
};
