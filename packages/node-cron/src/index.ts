import { type CronAdapter, handleCronJobs } from "@vitnode/core/api/lib/cron";
import { schedule } from "node-cron";

export const NodeCronAdapter = (): CronAdapter => {
  return {
    schedule() {
      schedule("*/1 * * * *", async () => {
        await handleCronJobs();
      });
    },
  };
};
