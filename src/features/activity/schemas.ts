import { z } from "zod";

import type { UserActivityType } from "./types";

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
  "NOTIFICATION_INBOX_VIEW",
  "NOTIFICATION_PERMISSION_GRANTED",
  "NOTIFICATION_PERMISSION_DENIED",
];

export const activityPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(120).optional(),
});

export const activityPaginationQuerySchema = activityPaginationSchema;

export const trackUserActivitySchema = z.object({
  activityType: z.enum(userActivityTypes),
  metadata: z.record(z.string(), z.any()).optional(),
  pagePath: z.string().trim().max(240).optional(),
  targetId: z.string().trim().max(120).optional(),
  targetType: z.string().trim().max(80).optional(),
});
