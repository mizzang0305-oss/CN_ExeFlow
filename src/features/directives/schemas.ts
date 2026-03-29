import { z } from "zod";

import {
  directiveLogTypes,
  directivePriorities,
  directiveSourceTypes,
  directiveStatuses,
} from "./constants";

function normalizeDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid datetime");
  }

  return parsed.toISOString();
}

export const directiveListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(directiveStatuses).optional(),
});

export const createDirectiveSchema = z
  .object({
    content: z.string().trim().min(1).max(3000),
    createdBy: z.string().uuid(),
    dueDate: z.string().trim().transform(normalizeDateTime).nullable().optional(),
    instructedAt: z.string().trim().transform(normalizeDateTime).optional(),
    isUrgent: z.boolean().default(false),
    ownerDepartmentId: z.string().uuid().nullable().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
    priority: z.enum(directivePriorities),
    sourceType: z.enum(directiveSourceTypes),
    title: z.string().trim().min(1).max(160),
    urgentLevel: z.number().int().min(1).max(3).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    dueDate: value.dueDate ?? null,
    instructedAt: value.instructedAt ?? new Date().toISOString(),
    ownerDepartmentId: value.ownerDepartmentId ?? null,
    ownerUserId: value.ownerUserId ?? null,
    urgentLevel: value.isUrgent ? value.urgentLevel ?? 1 : null,
  }));

export const logPayloadSchema = z
  .object({
    actionSummary: z.string().trim().min(1).max(160),
    departmentId: z.string().uuid(),
    detail: z.string().trim().max(3000).nullable().optional(),
    happenedAt: z.string().trim().transform(normalizeDateTime),
    logType: z.enum(directiveLogTypes),
    nextAction: z.string().trim().max(400).nullable().optional(),
    riskNote: z.string().trim().max(400).nullable().optional(),
    taskId: z.string().uuid().nullable().optional(),
    userId: z.string().uuid(),
  })
  .transform((value) => ({
    ...value,
    detail: value.detail ?? null,
    nextAction: value.nextAction ?? null,
    riskNote: value.riskNote ?? null,
    taskId: value.taskId ?? null,
  }));

export const deleteLogSchema = z
  .object({
    deletedBy: z.string().uuid(),
    reason: z.string().trim().max(400).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    reason: value.reason ?? null,
  }));
