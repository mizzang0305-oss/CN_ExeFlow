import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "danger" | "ghost" | "primary" | "secondary";
type ButtonSize = "lg" | "md" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  block?: boolean;
  icon?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const sizeClassMap: Record<ButtonSize, string> = {
  lg: "h-12 rounded-[22px] px-5 text-sm font-semibold",
  md: "h-11 rounded-[20px] px-4 text-sm font-semibold",
  sm: "h-9 rounded-2xl px-3.5 text-sm font-medium",
};

const variantClassMap: Record<ButtonVariant, string> = {
  danger:
    "bg-[linear-gradient(135deg,var(--color-danger-600),#b91c1c)] text-white shadow-[0_18px_34px_rgba(220,38,38,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(220,38,38,0.28)]",
  ghost:
    "border border-brand-100/75 bg-white/85 text-brand-900 shadow-[0_12px_28px_rgba(7,32,63,0.08)] hover:-translate-y-0.5 hover:bg-brand-50/80",
  primary:
    "bg-[linear-gradient(135deg,var(--color-brand-900),var(--color-brand-700))] text-white shadow-[0_18px_34px_rgba(7,32,63,0.22)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(7,32,63,0.28)]",
  secondary:
    "border border-brand-100/80 bg-brand-50/85 text-brand-900 shadow-[0_12px_28px_rgba(7,32,63,0.08)] hover:-translate-y-0.5 hover:bg-white",
};

const spinnerTrackClassMap: Record<ButtonVariant, string> = {
  danger: "border-white/25",
  ghost: "border-brand-200/70",
  primary: "border-white/25",
  secondary: "border-brand-200/70",
};

const spinnerHeadClassMap: Record<ButtonVariant, string> = {
  danger: "border-t-white",
  ghost: "border-t-brand-700",
  primary: "border-t-white",
  secondary: "border-t-brand-700",
};

export function Button({
  block = false,
  className,
  icon,
  isLoading = false,
  loadingLabel,
  size = "md",
  type = "button",
  variant = "primary",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={isLoading}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center gap-2 relative overflow-hidden transition duration-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none",
        block && "w-full",
        sizeClassMap[size],
        variantClassMap[variant],
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <span className={cn("absolute inset-0 rounded-full border-2", spinnerTrackClassMap[variant])} />
          <span
            className={cn(
              "absolute inset-0 rounded-full border-2 border-transparent animate-spin",
              spinnerHeadClassMap[variant],
            )}
          />
        </span>
      ) : (
        icon
      )}
      <span>{isLoading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
