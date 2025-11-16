import { buildModule } from "@/api/lib/module";

import { cleanCron } from "./cron/clean.cron";
import { runCronRoute } from "./routes/cron.route";

export const cronModule = buildModule({
  name: "cron",
  routes: [runCronRoute],
  cronJobs: [cleanCron],
});
