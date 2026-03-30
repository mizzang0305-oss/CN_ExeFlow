import { z } from "zod";

import type { UserRole } from "@/features/auth/types";

const roleOptions: UserRole[] = [
  "CEO",
  "SUPER_ADMIN",
  "DEPARTMENT_HEAD",
  "STAFF",
  "VIEWER",
];

const nullableUuidSchema = z.string().uuid().nullable().optional();

export const departmentUpsertSchema = z
  .object({
    code: z.string().trim().min(2).max(24),
    headUserId: nullableUuidSchema,
    isActive: z.boolean().default(true),
    name: z.string().trim().min(2).max(80),
    parentId: nullableUuidSchema,
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .transform((value) => ({
    ...value,
    headUserId: value.headUserId ?? null,
    parentId: value.parentId ?? null,
  }));

export const departmentReorderSchema = z
  .object({
    departmentId: z.string().uuid(),
    parentId: nullableUuidSchema,
  })
  .transform((value) => ({
    ...value,
    parentId: value.parentId ?? null,
  }));

export const userUpsertSchema = z
  .object({
    departmentId: nullableUuidSchema,
    email: z
      .string()
      .trim()
      .email("올바른 이메일 형식을 입력해주세요.")
      .nullable()
      .optional()
      .or(z.literal("")),
    isActive: z.boolean().default(true),
    name: z.string().trim().min(2).max(80),
    profileName: z.string().trim().max(80).nullable().optional(),
    role: z.enum(roleOptions),
    title: z.string().trim().max(80).nullable().optional(),
  })
  .transform((value) => ({
    ...value,
    departmentId: value.departmentId ?? null,
    email: typeof value.email === "string" ? value.email.trim() || null : null,
    profileName: value.profileName ?? null,
    title: value.title ?? null,
  }));

export const userMoveSchema = z
  .object({
    departmentId: nullableUuidSchema,
    userId: z.string().uuid(),
  })
  .transform((value) => ({
    ...value,
    departmentId: value.departmentId ?? null,
  }));
