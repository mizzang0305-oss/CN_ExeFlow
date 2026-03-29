import type { JsonObject } from "@/types";

import type { UserRole } from "@/features/auth/types";

export type AuthActivityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_EXPIRED";

export type AuthActivityEventResult = "SUCCESS" | "FAILED" | "EXPIRED";

export type UserActivityType =
  | "DASHBOARD_VIEW"
  | "DIRECTIVE_LIST_VIEW"
  | "DIRECTIVE_DETAIL_VIEW"
  | "COMPLETION_REQUEST_CLICK"
  | "APPROVAL_CLICK"
  | "REJECTION_CLICK"
  | "APPROVAL_QUEUE_VIEW"
  | "DIRECTIVE_LOG_CREATE"
  | "ATTACHMENT_UPLOAD";

export type NotificationType =
  | "DIRECTIVE_ASSIGNED"
  | "COMPLETION_REQUESTED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_COMPLETED"
  | "DIRECTIVE_REJECTED"
  | "DIRECTIVE_DELAYED";

export type NotificationChannel = "PUSH";

export type NotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "READ";

export type NotificationPermissionStatus = "default" | "granted" | "denied" | "unsupported";

export interface PaginationInput {
  page: number;
  pageSize: number;
  search?: string | null;
}

export interface PaginatedActivityLogs<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TrackAuthActivityInput {
  deviceType?: string | null;
  email?: string | null;
  eventResult: AuthActivityEventResult;
  eventType: AuthActivityEventType;
  happenedAt?: string;
  ipAddress?: string | null;
  platform?: string | null;
  userAgent?: string | null;
  userId?: string | null;
}

export interface TrackUserActivityInput {
  activityType: UserActivityType;
  departmentId?: string | null;
  happenedAt?: string;
  metadata?: JsonObject;
  pagePath?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  userId: string;
}

export interface RegisterUserDeviceInput {
  deviceKey: string;
  deviceType: string;
  notificationPermission: NotificationPermissionStatus;
  platform: string;
  pushToken?: string | null;
}

export interface QueueNotificationLogInput {
  body: string;
  channel?: NotificationChannel;
  deliveryStatus?: NotificationDeliveryStatus;
  directiveId?: string | null;
  metadata?: JsonObject;
  notificationType: NotificationType;
  title: string;
  userIds: string[];
}

export interface ActivityUserSummary {
  departmentId: string | null;
  departmentName: string | null;
  displayName: string;
  email: string | null;
  role: UserRole;
  title: string | null;
  userId: string;
}

export interface AuthActivityLogItem {
  deviceType: string | null;
  email: string | null;
  eventResult: AuthActivityEventResult;
  eventType: AuthActivityEventType;
  happenedAt: string;
  id: string;
  ipAddress: string | null;
  platform: string | null;
  user: ActivityUserSummary | null;
  userAgent: string | null;
}

export interface UserActivityLogItem {
  activityType: UserActivityType;
  happenedAt: string;
  id: string;
  metadata: JsonObject;
  pagePath: string | null;
  targetId: string | null;
  targetType: string | null;
  user: ActivityUserSummary | null;
}

export interface NotificationLogItem {
  body: string;
  channel: NotificationChannel;
  clickedAt: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  directiveId: string | null;
  directiveNo: string | null;
  directiveTitle: string | null;
  id: string;
  metadata: JsonObject;
  notificationType: NotificationType;
  readAt: string | null;
  sentAt: string;
  title: string;
  user: ActivityUserSummary | null;
}
