import { buildModule } from "@/api/lib/module";

import { getCronsRoute } from "./routes/get.route";
import { runCronRoute } from "./routes/run.route";

export const cronAdminModule = buildModule({
  name: "cron",
  routes: [getCronsRoute, runCronRoute],
});
