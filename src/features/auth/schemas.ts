import { z } from "zod";

import { COMPANY_EMAIL_DOMAIN, normalizeEmailAddress } from "./utils";

export const authEmailSchema = z
  .string()
  .trim()
  .email("올바른 이메일 주소를 입력해주세요.")
  .max(120, "이메일은 120자 이하로 입력해주세요.");

export const companyEmailSchema = authEmailSchema.refine(
  (value) => normalizeEmailAddress(value)?.endsWith(COMPANY_EMAIL_DOMAIN) === true,
  {
    message: "회사 이메일만 등록할 수 있습니다.",
  },
);

export const authPasswordSchema = z
  .string()
  .min(8, "비밀번호를 8자 이상 입력해주세요.")
  .max(72, "비밀번호는 72자 이하로 입력해주세요.");

export const initialSetupLookupSchema = z.object({
  departmentId: z.string().uuid("부서를 다시 선택해주세요."),
  name: z.string().trim().min(1, "이름을 선택해주세요.").max(80, "이름을 다시 선택해주세요."),
  userId: z.string().uuid().optional(),
});

export const authLoginSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요."),
  rememberMe: z.boolean().default(false),
});

export const authRegisterCompanyEmailSchema = z.object({
  email: companyEmailSchema,
  userId: z.string().uuid("사용자 정보를 다시 확인해주세요."),
});

export const authActivateSchema = z
  .object({
    password: authPasswordSchema,
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해주세요."),
    userId: z.string().uuid("사용자 정보를 다시 확인해주세요."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "비밀번호 확인이 일치하지 않습니다.",
        path: ["passwordConfirm"],
      });
    }
  });

export const authResetPasswordSchema = z.object({
  email: authEmailSchema,
});
