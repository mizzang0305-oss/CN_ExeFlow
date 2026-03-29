import { LoadingCard, SkeletonBlock } from "@/components";

export default function DirectivesLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="panel-strong p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <SkeletonBlock className="h-5 w-32 rounded-full" />
            <SkeletonBlock className="h-8 w-2/3 rounded-[18px]" />
            <SkeletonBlock className="h-4 w-4/5 rounded-full" />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SkeletonBlock className="h-12 w-56 rounded-[22px]" />
            <SkeletonBlock className="h-12 w-36 rounded-[22px]" />
          </div>
        </div>
      </div>

      <LoadingCard variant="list" />
      <LoadingCard variant="list" />
      <LoadingCard variant="list" />
    </main>
  );
}
