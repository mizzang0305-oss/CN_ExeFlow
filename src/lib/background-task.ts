export function runBackgroundTask(label: string, task: () => Promise<void>) {
  void task().catch((error) => {
    console.error(`[background:${label}]`, error);
  });
}
