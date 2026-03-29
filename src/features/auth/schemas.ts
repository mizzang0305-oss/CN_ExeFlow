import { z } from "zod";

export const departmentIdSchema = z.string().uuid("부서를 다시 선택해 주세요.");

export const loginUsersQuerySchema = z.object({
  departmentId: departmentIdSchema,
});

export const loginSessionSchema = z.object({
  departmentId: departmentIdSchema,
  userId: z.string().uuid("사용자를 다시 선택해 주세요."),
});

export const loginSelectionSchema = loginSessionSchema;
