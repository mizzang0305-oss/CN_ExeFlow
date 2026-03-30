import { LoadingCard, SkeletonBlock } from "@/components";

export default function CeoDashboardLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingCard key={index} variant="kpi" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <LoadingCard key={index} variant="list" />
        ))}
      </div>

      <div className="panel p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <SkeletonBlock className="h-10 w-24 rounded-full" />
            <SkeletonBlock className="h-10 w-24 rounded-full" />
            <SkeletonBlock className="h-10 w-24 rounded-full" />
          </div>
          <SkeletonBlock className="h-8 w-48 rounded-[20px]" />
          <SkeletonBlock className="h-40 rounded-[28px]" />
        </div>
      </div>
    </main>
  );
}
