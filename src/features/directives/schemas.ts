import { z } from "zod";

import type { DirectiveUrgentLevel } from "./types";

import { directiveLogTypes, directiveStatuses, directiveUrgentLevels } from "./constants";

function normalizeDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid datetime");
  }

  return parsed.toISOString();
}

function normalizeOptionalDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return normalizeDateTime(value);
}

const directiveUrgentLevelSchema = z.enum(directiveUrgentLevels);

export function normalizeUrgentLevel(value: unknown): DirectiveUrgentLevel | null {
  if (value === null || value === undefined || value === "" || value === 0 || value === "0") {
    return null;
  }

  if (value === 1 || value === "1") {
    return "LOW";
  }

  if (value === 2 || value === "2") {
    return "HIGH";
  }

  if (value === 3 || value === "3") {
    return "CRITICAL";
  }

  if (value === "LOW" || value === "HIGH" || value === "CRITICAL") {
    return value;
  }

  return null;
}

const directiveUrgentLevelInputSchema = z.preprocess(
  (value) => normalizeUrgentLevel(value),
  directiveUrgentLevelSchema.nullable(),
);

export const directiveListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(directiveStatuses).optional(),
});

export const createDirectiveSchema = z
  .object({
    content: z.string().trim().min(1).max(3000),
    dueDate: z.string().trim().nullable().optional(),
    isUrgent: z.boolean().default(false),
    ownerUserId: z.string().uuid().nullable().optional(),
    primaryDepartmentId: z.string().uuid(),
    selectedDepartmentIds: z.array(z.string().uuid()).min(1),
    targetScope: z.enum(["ALL", "SELECTED"]),
    title: z.string().trim().min(1).max(160),
    urgentLevel: directiveUrgentLevelInputSchema.optional(),
  })
  .superRefine((value, context) => {
    if (!value.selectedDepartmentIds.includes(value.primaryDepartmentId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "주관 부서는 대상 부서 목록에 포함되어야 합니다.",
        path: ["primaryDepartmentId"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    dueDate: normalizeOptionalDateTime(value.dueDate ?? null),
    ownerUserId: value.ownerUserId ?? null,
    selectedDepartmentIds: Array.from(new Set(value.selectedDepartmentIds)),
    urgentLevel: value.isUrgent ? value.urgentLevel ?? null : null,
  }));

export const logPayloadSchema = z
  .object({
    actionSummary: z.string().trim().min(1).max(160),
    departmentId: z.string().uuid().nullable().optional(),
    detail: z.string().trim().max(3000).nullable().optional(),
    happenedAt: z.string().trim().transform(normalizeDateTime),
    logType: z.enum(directiveLogTypes),
    nextAction: z.string().trim().max(400).nullable().optional(),
    riskNote: z.string().trim().max(400).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    departmentId: value.departmentId ?? null,
    detail: value.detail ?? null,
    nextAction: value.nextAction ?? null,
    riskNote: value.riskNote ?? null,
  }));

export const deleteLogSchema = z
  .object({
    reason: z.string().trim().max(400).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    reason: value.reason ?? null,
  }));

export const workflowReasonSchema = z
  .object({
    departmentId: z.string().uuid().nullable().optional(),
    reason: z.string().trim().max(400).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    departmentId: value.departmentId ?? null,
    reason: value.reason ?? null,
  }));
