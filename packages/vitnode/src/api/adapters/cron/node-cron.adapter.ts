import { schedule } from "node-cron";

import { type CronAdapter, handleCronJobs } from "@/api/lib/cron";

export const NodeCronAdapter = (): CronAdapter => {
  return {
    schedule() {
      schedule("*/1 * * * *", async () => {
        await handleCronJobs();
      });
    },
  };
};
