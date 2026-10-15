import { buildModule } from "@/api/builders";

import { getCronsRoute } from "./routes/get.route";
import { getCronHealthRoute } from "./routes/health.route";
import { runCronRoute } from "./routes/run.route";

export const cronAdminModule = buildModule({
  name: "cron",
  routes: [getCronsRoute, getCronHealthRoute, runCronRoute],
});
