import { z } from "zod";

import {
  notificationChannels,
  notificationDeliveryStatuses,
  notificationTypes,
} from "./constants";
import type { NotificationPermissionState } from "./types";

const notificationPermissionStates: NotificationPermissionState[] = [
  "default",
  "denied",
  "granted",
  "unsupported",
];

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

export const registerUserDeviceSchema = z.object({
  appVersion: z.string().trim().max(80).nullable().optional(),
  browserName: z.string().trim().max(80).nullable().optional(),
  deviceKey: z.string().trim().min(8).max(160),
  deviceType: z.string().trim().min(2).max(40),
  isActive: z.boolean().optional(),
  notificationPermission: z.enum(notificationPermissionStates),
  platform: z.string().trim().min(2).max(40),
  pushToken: z.string().trim().max(500).nullable().optional(),
});

export const notificationInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationLogsQuerySchema = z.object({
  channel: z.enum(notificationChannels).optional(),
  deliveryStatus: z.enum(notificationDeliveryStatuses).optional(),
  fromDate: dateStringSchema.optional(),
  notificationType: z.enum(notificationTypes).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(120).optional(),
  toDate: dateStringSchema.optional(),
  userId: z.string().uuid().optional(),
});

export const notificationClickSchema = z.object({
  targetPath: z.string().trim().max(240).optional(),
});
