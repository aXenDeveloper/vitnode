import { schedule } from "node-cron";
import type { CronAdapter } from "@/api/lib/cron";
import { CONFIG } from "@/lib/config";

export const NodeCronAdapter = (): CronAdapter => {
  return {
    schedule(cronSecret) {
      schedule("*/1 * * * *", async () => {
        const url = new URL("/api/@vitnode/core/cron", CONFIG.api.origin);
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };

        // Add authorization header if cronSecret is provided
        if (cronSecret) {
          headers.authorization = `Bearer ${cronSecret}`;
        }

        const res = await fetch(url.toString(), {
          method: "POST",
          headers,
        });
        // biome-ignore lint/suspicious/noConsole: needed for cron job monitoring
        console.log("Cron job response status", res.status);
      });
    },
  };
};
