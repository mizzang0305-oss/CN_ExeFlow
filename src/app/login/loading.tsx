import { LoadingCard } from "@/components";

export default function LoginLoading() {
  return (
    <main className="app-container flex min-h-screen items-center justify-center py-10">
      <div className="w-full max-w-lg">
        <LoadingCard />
      </div>
    </main>
  );
}
