import { buildModule } from "@/builders";

import { accountDeletionCron } from "./cron/account-deletion.cron";
import { auditRetentionCron } from "./cron/audit-retention.cron";
import { checkUpdatesCron } from "./cron/check-updates.cron";
import { cleanCron } from "./cron/clean.cron";
import { ipRetentionCron } from "./cron/ip-retention.cron";
import { runCronRoute } from "./routes/run.route";

export const cronModule = buildModule({
  name: "cron",
  routes: [runCronRoute],
  cronJobs: [
    cleanCron,
    checkUpdatesCron,
    auditRetentionCron,
    accountDeletionCron,
    ipRetentionCron,
  ],
});
