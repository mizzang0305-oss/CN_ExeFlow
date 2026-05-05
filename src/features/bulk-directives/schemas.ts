import { z } from "zod";

export const bulkDirectiveRegisterSchema = z.object({
  batchId: z.string().uuid(),
  selectedRowIds: z.array(z.string().uuid()).min(1, "등록할 행을 선택해주세요."),
});

export const bulkDirectiveReplaceRegisterSchema = z.object({
  batchId: z.string().uuid(),
  confirmText: z.string().trim().refine((value) => value === "전체교체", {
    message: "확인 문구로 전체교체를 입력해주세요.",
  }),
});

export const bulkDirectiveArchiveSchema = z
  .object({
    batchId: z.string().uuid().optional(),
    directiveIds: z.array(z.string().uuid()).optional(),
    reason: z.string().trim().min(1, "비노출 사유를 입력해주세요."),
  })
  .refine((value) => Boolean(value.batchId) || Boolean(value.directiveIds?.length), {
    message: "비노출할 대상을 선택해주세요.",
    path: ["batchId"],
  });
