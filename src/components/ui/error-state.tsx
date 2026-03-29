import type { ReactNode } from "react";

type ErrorStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function ErrorState({ action, description, title }: ErrorStateProps) {
  return (
    <div className="rounded-[30px] border border-danger-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,241,0.92))] p-6 shadow-[0_24px_60px_rgba(220,38,38,0.08)]">
      <div className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-50 text-lg font-semibold text-danger-700">
          !
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-ink-950">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-ink-700">{description}</p>
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
