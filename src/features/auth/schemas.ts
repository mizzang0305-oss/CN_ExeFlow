import { z } from "zod";

export const authEmailSchema = z
  .string()
  .trim()
  .email("올바른 이메일 주소를 입력해주세요.")
  .max(120, "이메일은 120자 이하로 입력해주세요.");

export const authPasswordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상 입력해주세요.")
  .max(72, "비밀번호는 72자 이하로 입력해주세요.")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "비밀번호는 영문과 숫자를 함께 포함해주세요.",
  });

export const authLookupSchema = z.object({
  email: authEmailSchema,
});

export const authLoginSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요."),
  rememberMe: z.boolean().default(false),
});

export const authActivateSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export const authResetPasswordSchema = z.object({
  email: authEmailSchema,
});
