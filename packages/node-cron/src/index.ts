import { type CronAdapter, handleCronJobs } from "@vitnode/core/api/lib/cron";
import { schedule } from "node-cron";

export const NodeCronAdapter = (): CronAdapter => {
  return {
    schedule() {
      schedule(
        "*/1 * * * *",
        async () => {
          await handleCronJobs();
        },
        // Skip a tick while the previous one is still waiting on the API.
        { noOverlap: true },
      );
    },
  };
};
