export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPollingLoop } = await import("./lib/polling");
    const interval = Number(process.env.POLL_INTERVAL_MS) || 30000;
    startPollingLoop(interval);
  }
}
