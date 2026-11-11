import { buildModule } from "@/api/builders";

import { auditRetentionCron } from "./cron/audit-retention.cron";
import { checkUpdatesCron } from "./cron/check-updates.cron";
import { cleanCron } from "./cron/clean.cron";
import { runCronRoute } from "./routes/run.route";

export const cronModule = buildModule({
  name: "cron",
  routes: [runCronRoute],
  cronJobs: [cleanCron, checkUpdatesCron, auditRetentionCron],
});
