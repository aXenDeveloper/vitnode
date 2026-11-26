import { buildModule } from "@/builders";

import { getCronHealthRoute } from "./routes/health.route";
import { getCronsRoute } from "./routes/list.route";
import { runCronRoute } from "./routes/run.route";
import { getCronSummaryRoute } from "./routes/summary.route";

export const cronAdminModule = buildModule({
  name: "cron",
  routes: [
    getCronsRoute,
    getCronHealthRoute,
    getCronSummaryRoute,
    runCronRoute,
  ],
});
