import { LoadingCard, SkeletonBlock } from "@/components";

export default function UserMasterLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="panel-strong p-6">
        <div className="space-y-3">
          <SkeletonBlock className="h-6 w-40 rounded-full" />
          <SkeletonBlock className="h-10 w-2/3 rounded-[20px]" />
          <SkeletonBlock className="h-4 w-4/5 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <LoadingCard />
        <LoadingCard variant="list" />
      </div>
    </main>
  );
}
