import type { JsonObject } from "@/types";

import type { AppSession } from "@/features/auth/types";

export type NotificationType =
  | "DIRECTIVE_ASSIGNED"
  | "COMPLETION_REQUESTED"
  | "APPROVAL_REQUIRED"
  | "REJECTED"
  | "APPROVED"
  | "DELAY_WARNING";

export type NotificationChannel = "IN_APP" | "WEB_PUSH";

export type NotificationDeliveryStatus = "PENDING" | "SENT" | "FAILED" | "OPENED" | "READ";

export type NotificationPermissionState = "default" | "denied" | "granted" | "unsupported";

export interface NotificationPayload extends JsonObject {
  departmentId?: string;
  departmentIds?: string[];
  departmentName?: string;
  departmentNames?: string[];
  directiveNo?: string;
  reason?: string | null;
  targetPath?: string;
  targetPathLabel?: string;
}

export interface RegisterUserDeviceInput {
  appVersion?: string | null;
  browserName?: string | null;
  deviceKey: string;
  deviceType: string;
  isActive?: boolean;
  notificationPermission: NotificationPermissionState;
  platform: string;
  pushToken?: string | null;
  session: AppSession;
}

export interface DeviceRegistrationPayload {
  appVersion?: string | null;
  browserName?: string | null;
  deviceKey: string;
  deviceType: string;
  isActive?: boolean;
  notificationPermission: NotificationPermissionState;
  platform: string;
  pushToken?: string | null;
}

export interface CreateNotificationLogInput {
  body: string;
  channel: NotificationChannel;
  deliveryStatus?: NotificationDeliveryStatus;
  directiveDepartmentId?: string | null;
  directiveId?: string | null;
  payload?: NotificationPayload;
  notificationType: NotificationType;
  sentAt?: string;
  title: string;
  userId: string;
}

export interface DispatchDirectiveAssignedInput {
  assignments: Array<{
    departmentHeadId: string | null;
    departmentId: string;
    departmentName: string;
    directiveDepartmentId?: string | null;
  }>;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
}

export interface DispatchCompletionRequestedInput {
  departmentHeadId?: string | null;
  departmentId: string;
  departmentName: string;
  directiveDepartmentId?: string | null;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
  reason?: string | null;
}

export interface DispatchApprovalRequiredInput {
  departmentId: string;
  departmentName: string;
  directiveDepartmentId?: string | null;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
}

export interface DispatchRejectedInput {
  departmentHeadId?: string | null;
  departmentId: string;
  departmentName: string;
  directiveDepartmentId?: string | null;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
  ownerUserId?: string | null;
  reason?: string | null;
  relatedUserIds?: string[];
}

export interface DispatchApprovedInput {
  departmentHeadId?: string | null;
  departmentId: string;
  departmentName: string;
  directiveDepartmentId?: string | null;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
  ownerUserId?: string | null;
  relatedUserIds?: string[];
}

export interface DispatchDelayWarningInput {
  departmentHeads: Array<string | null | undefined>;
  directiveId: string;
  directiveNo: string;
  directiveTitle: string;
  dueDate?: string | null;
  ownerUserId?: string | null;
}

export interface NotificationListFilters {
  channel?: NotificationChannel;
  deliveryStatus?: NotificationDeliveryStatus;
  fromDate?: string;
  notificationType?: NotificationType;
  page: number;
  pageSize: number;
  search?: string;
  toDate?: string;
  userId?: string;
}

export interface NotificationInboxFilters {
  page: number;
  pageSize: number;
}

export interface NotificationLogListItem {
  body: string;
  channel: NotificationChannel;
  clickedAt: string | null;
  createdAt: string;
  deliveryStatus: NotificationDeliveryStatus;
  directiveDepartmentId: string | null;
  directiveId: string | null;
  directiveNo: string | null;
  directiveTitle: string | null;
  id: string;
  notificationType: NotificationType;
  payload: NotificationPayload;
  readAt: string | null;
  sentAt: string;
  title: string;
  userId: string;
  userName: string | null;
}

export interface NotificationInboxItem extends NotificationLogListItem {
  isUnread: boolean;
  targetPath: string | null;
}

export interface NotificationUserOption {
  id: string;
  name: string;
}

export interface NotificationListResult {
  items: NotificationLogListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationInboxResult {
  items: NotificationInboxItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}
