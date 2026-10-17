import { buildModule } from "@/api/builders";

import { checkUpdatesCron } from "./cron/check-updates.cron";
import { cleanCron } from "./cron/clean.cron";
import { runCronRoute } from "./routes/cron.route";

export const cronModule = buildModule({
  name: "cron",
  routes: [runCronRoute],
  cronJobs: [cleanCron, checkUpdatesCron],
});
