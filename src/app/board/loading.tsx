import { LoadingCard, SkeletonBlock } from "@/components";

export default function BoardLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="panel-strong p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4">
            <SkeletonBlock className="h-6 w-36 rounded-full" />
            <SkeletonBlock className="h-12 w-3/4 rounded-[20px]" />
            <SkeletonBlock className="h-4 w-full rounded-full" />
            <div className="grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-28 rounded-[26px]" />
              ))}
            </div>
          </div>
          <SkeletonBlock className="min-h-[240px] rounded-[30px]" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingCard key={index} variant="kpi" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LoadingCard variant="list" />
        <LoadingCard variant="list" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LoadingCard variant="list" />
        <LoadingCard variant="list" />
      </div>
    </main>
  );
}
