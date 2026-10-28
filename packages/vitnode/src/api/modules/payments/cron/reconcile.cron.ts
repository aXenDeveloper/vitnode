import { buildCron } from "@/api/lib/cron";

export const reconcilePaymentsCron = buildCron({
  name: "reconcile-payments",
  description:
    "Re-read open payments from their provider and expire checkouts that were never created",
  schedule: "*/5 * * * *",
  handler: async c => {
    if (c.get("core").payments.providers.length === 0) return;

    await c.get("payments").reconcile();
  },
});
