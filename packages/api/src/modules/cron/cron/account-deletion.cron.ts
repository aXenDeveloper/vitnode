import { processDueAccountDeletions } from "@/lib/account-deletion/erase";
import { buildCron } from "@/lib/cron";

export const accountDeletionCron = buildCron({
  name: "account-deletion",
  description:
    "Erase accounts whose deletion grace period is over (users.accountDeletion.graceDays in the API config)",
  schedule: "25 * * * *",
  handler: async c => {
    await processDueAccountDeletions(c);
  },
});
