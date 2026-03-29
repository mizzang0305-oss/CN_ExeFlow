import { LoadingCard, SkeletonBlock } from "@/components";

export default function DirectiveDetailLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="panel-strong p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-7 w-28 rounded-full" />
          </div>
          <SkeletonBlock className="h-10 w-3/4 rounded-[20px]" />
          <SkeletonBlock className="h-4 w-full rounded-full" />
          <SkeletonBlock className="h-4 w-5/6 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <LoadingCard variant="list" />
        <LoadingCard variant="list" />
      </div>

      <LoadingCard variant="list" />
    </main>
  );
}
