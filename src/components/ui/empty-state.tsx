type EmptyStateProps = {
  action?: React.ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-brand-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(238,244,255,0.62))] px-5 py-6">
      <div className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-sm font-semibold text-brand-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          CN
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-ink-950">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-ink-700">{description}</p>
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
