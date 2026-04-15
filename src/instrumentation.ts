/**
 * Next.js server instrumentation hook.
 * Runs once at server startup in the Node.js runtime.
 * Used to initialize cron jobs (node-cron requires Node.js, not Edge).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initCronJobs } = await import("./lib/cronInit");
    initCronJobs();
  }
}
