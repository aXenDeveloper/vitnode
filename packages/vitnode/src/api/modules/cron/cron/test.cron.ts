import { buildCron } from "@/api/lib/cron";

export const testCron = buildCron({
  name: "test cron job",
  description: "A cron job that runs every minute for testing purposes",
  schedule: "*/1 * * * *",
  handler: () => {
    // biome-ignore lint/suspicious/noConsole: needed for testing cron functionality
    console.log("Test cron job executed");
  },
});
