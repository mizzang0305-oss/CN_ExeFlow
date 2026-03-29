import { LoadingCard } from "@/components";

export default function DirectiveDetailLoading() {
  return (
    <main className="app-container space-y-4 py-8">
      <LoadingCard />
      <LoadingCard />
      <LoadingCard />
    </main>
  );
}
