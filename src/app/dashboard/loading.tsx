import { LoadingCard } from "@/components";

export default function DashboardLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingCard key={index} />
        ))}
      </div>
      <LoadingCard />
      <LoadingCard />
    </main>
  );
}
