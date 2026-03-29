export function runBackgroundTask(label: string, task: () => Promise<unknown>) {
  void Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(`[background:${label}]`, error);
    });
}
