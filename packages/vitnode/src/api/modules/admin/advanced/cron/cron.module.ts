import { buildModule } from "@/api/builders";

import { getCronHealthRoute } from "./routes/health.route";
import { getCronsRoute } from "./routes/list.route";
import { runCronRoute } from "./routes/run.route";

export const cronAdminModule = buildModule({
  name: "cron",
  routes: [getCronsRoute, getCronHealthRoute, runCronRoute],
});
