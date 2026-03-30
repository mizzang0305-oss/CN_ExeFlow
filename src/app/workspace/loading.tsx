import { LoadingCard, SkeletonBlock } from "@/components";

export default function WorkspaceLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingCard key={index} variant="kpi" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <LoadingCard variant="list" />
        <LoadingCard variant="list" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LoadingCard variant="list" />
        <LoadingCard variant="list" />
      </div>

      <div className="panel p-6">
        <SkeletonBlock className="h-6 w-36 rounded-full" />
        <SkeletonBlock className="mt-4 h-28 rounded-[24px]" />
      </div>
    </main>
  );
}
