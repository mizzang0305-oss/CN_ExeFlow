import type { JsonObject } from "@/types";

import type { AppSession } from "@/features/auth/types";

export type AuthActivityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "SESSION_EXPIRED";

export type AuthActivityResult = "SUCCESS" | "FAILED" | "EXPIRED";

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

export type NotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

export interface ActivityPaginationInput {
  page: number;
  pageSize: number;
  search?: string;
}

export interface ActivityPaginationResult {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthActivityLogItem {
  departmentName: string | null;
  deviceType: string | null;
  email: string | null;
  eventResult: AuthActivityResult;
  eventType: AuthActivityEventType;
  happenedAt: string;
  id: string;
  ipAddress: string | null;
  platform: string | null;
  userAgent: string | null;
  userId: string | null;
  userName: string | null;
}

export interface UserActivityLogItem {
  activityType: UserActivityType;
  departmentName: string | null;
  happenedAt: string;
  id: string;
  metadata: JsonObject;
  pagePath: string | null;
  targetId: string | null;
  targetType: string | null;
  userId: string;
  userName: string | null;
}

export interface NotificationLogItem {
  body: string;
  channel: NotificationChannel;
  deliveryStatus: NotificationDeliveryStatus;
  directiveId: string | null;
  id: string;
  metadata: JsonObject;
  notificationType: NotificationType;
  readAt: string | null;
  sentAt: string;
  title: string;
  clickedAt: string | null;
  userId: string;
  userName: string | null;
}

export interface PaginatedAuthActivityLogs {
  items: AuthActivityLogItem[];
  pagination: ActivityPaginationResult;
}

export interface PaginatedUserActivityLogs {
  items: UserActivityLogItem[];
  pagination: ActivityPaginationResult;
}

export interface PaginatedNotificationLogs {
  items: NotificationLogItem[];
  pagination: ActivityPaginationResult;
}

export interface TrackAuthActivityInput {
  email?: string | null;
  eventResult: AuthActivityResult;
  eventType: AuthActivityEventType;
  requestContext?: {
    deviceType?: string | null;
    ipAddress?: string | null;
    platform?: string | null;
    userAgent?: string | null;
  };
  userId?: string | null;
}

export interface TrackUserActivityInput {
  activityType: UserActivityType;
  metadata?: JsonObject;
  pagePath?: string | null;
  session: AppSession;
  targetId?: string | null;
  targetType?: string | null;
}

export interface RegisterUserDeviceInput {
  deviceKey: string;
  deviceType: string;
  notificationPermission: NotificationPermissionState;
  platform: string;
  pushToken?: string | null;
  session: AppSession;
}

export interface QueueNotificationInput {
  body: string;
  channel?: NotificationChannel;
  deliveryStatus?: NotificationDeliveryStatus;
  directiveId?: string | null;
  metadata?: JsonObject;
  notificationType: NotificationType;
  title: string;
  userIds: string[];
}

export interface DeviceRegistrationPayload {
  deviceKey: string;
  deviceType: string;
  notificationPermission: NotificationPermissionState;
  platform: string;
  pushToken?: string | null;
}
