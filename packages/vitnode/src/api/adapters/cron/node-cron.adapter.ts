import type { CronAdapter } from "@/api/lib/cron";

export const NodeCronAdapter = (): CronAdapter => {
  return {
    schedule() {},
  };
};
