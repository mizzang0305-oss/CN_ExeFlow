import { LoadingCard } from "@/components";

export default function ViewerLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingCard key={index} variant="kpi" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <LoadingCard variant="list" />
        <LoadingCard variant="list" />
      </div>

      <LoadingCard variant="list" />
    </main>
  );
}
