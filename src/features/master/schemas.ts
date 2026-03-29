import { z } from "zod";

import type { UserRole } from "@/features/auth/types";

const roleOptions: UserRole[] = [
  "CEO",
  "SUPER_ADMIN",
  "DEPARTMENT_HEAD",
  "STAFF",
  "VIEWER",
];

export const departmentUpsertSchema = z.object({
  code: z.string().trim().min(2).max(24),
  headUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
  name: z.string().trim().min(2).max(80),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
}).transform((value) => ({
  ...value,
  headUserId: value.headUserId ?? null,
}));

export const userUpsertSchema = z.object({
  departmentId: z.string().uuid().nullable().optional(),
  email: z.string().trim().email(),
  isActive: z.boolean().default(true),
  name: z.string().trim().min(2).max(80),
  profileName: z.string().trim().max(80).nullable().optional(),
  role: z.enum(roleOptions),
  title: z.string().trim().max(80).nullable().optional(),
}).transform((value) => ({
  ...value,
  departmentId: value.departmentId ?? null,
  profileName: value.profileName ?? null,
  title: value.title ?? null,
}));
