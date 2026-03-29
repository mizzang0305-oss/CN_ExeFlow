import { z } from "zod";

export const loginSelectionSchema = z.object({
  departmentId: z.string().uuid("부서를 다시 선택해 주세요."),
  userId: z.string().uuid("사용자를 다시 선택해 주세요."),
});
