import { buildModule } from "@/builders";

import { getCronHealthRoute } from "./routes/health.route";
import { getCronHeartbeatRoute } from "./routes/heartbeat.route";
import { getCronsRoute } from "./routes/list.route";
import { runCronRoute } from "./routes/run.route";

export const cronAdminModule = buildModule({
  name: "cron",
  routes: [
    getCronsRoute,
    getCronHealthRoute,
    getCronHeartbeatRoute,
    runCronRoute,
  ],
});
