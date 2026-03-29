import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  hint?: string;
  label: string;
  required?: boolean;
};

export function FieldLabel({ hint, label, required }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-ink-950">
        {label}
        {required ? <span className="ml-1 text-danger-600">*</span> : null}
      </label>
      {hint ? <p className="text-xs leading-5 text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function FieldGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cn("field", className)} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select className={cn("field appearance-none", className)} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea className={cn("textarea-field", className)} {...rest} />;
}
