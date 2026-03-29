export function LoadingCard() {
  return (
    <div className="panel p-5 sm:p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-28 rounded-full bg-ink-100" />
        <div className="h-6 w-2/3 rounded-full bg-ink-100" />
        <div className="h-4 w-full rounded-full bg-ink-100" />
        <div className="h-4 w-4/5 rounded-full bg-ink-100" />
      </div>
    </div>
  );
}
