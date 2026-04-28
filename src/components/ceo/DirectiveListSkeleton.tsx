export function DirectiveListSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="rounded-[28px] border border-brand-100 bg-white px-5 py-5 shadow-[0_18px_44px_rgba(6,18,38,0.06)]"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-lg font-bold text-ink-950">지시사항을 불러오는 중입니다</p>
          <p className="mt-1 text-sm font-semibold text-ink-600">화면은 그대로 유지됩니다</p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-ink-100">
          <div className="executive-skeleton h-full w-full rounded-full" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid gap-4 rounded-[22px] border border-ink-100 bg-ink-50/70 px-4 py-4 sm:grid-cols-[8rem_1fr_8rem]"
          >
            <div className="space-y-2">
              <div className="executive-skeleton h-5 w-24 rounded-full" />
              <div className="executive-skeleton h-4 w-20 rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="executive-skeleton h-6 w-5/6 rounded-[14px]" />
              <div className="executive-skeleton h-4 w-2/3 rounded-full" />
            </div>
            <div className="executive-skeleton h-11 w-full rounded-[18px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
