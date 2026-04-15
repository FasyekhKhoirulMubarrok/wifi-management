/** Called from instrumentation.ts on Node.js runtime startup. */
export function initCronJobs(): void {
  import("./cron")
    .then(({ scheduleCronJobs }) => scheduleCronJobs())
    .catch((err) => console.error("[cronInit] Failed to start cron jobs:", err));
}
