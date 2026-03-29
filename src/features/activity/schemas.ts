import { z } from "zod";

import type {
  NotificationPermissionStatus,
  UserActivityType,
} from "./types";

const userActivityTypes: UserActivityType[] = [
  "DASHBOARD_VIEW",
  "DIRECTIVE_LIST_VIEW",
  "DIRECTIVE_DETAIL_VIEW",
  "COMPLETION_REQUEST_CLICK",
  "APPROVAL_CLICK",
  "REJECTION_CLICK",
  "APPROVAL_QUEUE_VIEW",
  "DIRECTIVE_LOG_CREATE",
  "ATTACHMENT_UPLOAD",
];

const notificationPermissionValues: NotificationPermissionStatus[] = [
  "default",
  "granted",
  "denied",
  "unsupported",
];

export const activityPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
  search: z.string().trim().max(100).optional(),
});

export const trackUserActivitySchema = z.object({
  activityType: z.enum(userActivityTypes),
  metadata: z.record(z.string(), z.unknown()).optional(),
  pagePath: z.string().trim().max(240).optional(),
  targetId: z.string().trim().max(120).optional(),
  targetType: z.string().trim().max(80).optional(),
});

export const registerUserDeviceSchema = z.object({
  deviceKey: z.string().trim().min(8).max(120),
  deviceType: z.string().trim().min(2).max(40),
  notificationPermission: z.enum(notificationPermissionValues),
  platform: z.string().trim().min(2).max(40),
  pushToken: z.string().trim().max(500).nullable().optional(),
});
