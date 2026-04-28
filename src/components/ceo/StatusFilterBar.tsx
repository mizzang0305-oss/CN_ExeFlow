"use client";

import type { DirectiveStatusValue } from "@/lib/constants/status-labels";
import { STATUS_FILTER_OPTIONS } from "@/lib/constants/status-labels";
import { cn } from "@/lib/utils";

type StatusFilterBarProps = {
  currentStatus: DirectiveStatusValue | null;
  currentUrgent: boolean;
  onChange: (status: DirectiveStatusValue | null, urgent: boolean) => void;
};

export function StatusFilterBar({
  currentStatus,
  currentUrgent,
  onChange,
}: StatusFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="상태 선택">
      {STATUS_FILTER_OPTIONS.map((option) => {
        const isActive = option.urgent
          ? currentUrgent
          : !currentUrgent && currentStatus === option.status;

        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            aria-label={`${option.label} 지시사항 보기`}
            onClick={() => onChange(option.status, option.urgent)}
            className={cn(
              "management-clickable min-h-11 rounded-[18px] border px-4 py-2 text-sm font-bold transition",
              isActive
                ? "border-brand-900 bg-brand-900 text-white shadow-[0_14px_28px_rgba(3,19,38,0.2)]"
                : "border-ink-200 bg-white text-ink-800 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
