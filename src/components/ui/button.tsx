import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";
type ButtonSize = "lg" | "md" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  block?: boolean;
  icon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const sizeClassMap: Record<ButtonSize, string> = {
  lg: "h-12 rounded-2xl px-5 text-sm font-semibold",
  md: "h-11 rounded-2xl px-4 text-sm font-semibold",
  sm: "h-9 rounded-xl px-3 text-sm font-medium",
};

const variantClassMap: Record<ButtonVariant, string> = {
  danger:
    "bg-danger-600 text-white shadow-[0_12px_30px_rgba(220,38,38,0.22)] hover:bg-danger-700",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100",
  primary:
    "bg-ink-950 text-white shadow-[0_12px_30px_rgba(18,24,38,0.18)] hover:bg-ink-900",
  secondary: "bg-brand-50 text-brand-600 hover:bg-brand-50/80",
};

export function Button({
  block = false,
  className,
  icon,
  size = "md",
  type = "button",
  variant = "primary",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-60",
        block && "w-full",
        sizeClassMap[size],
        variantClassMap[variant],
        className,
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
