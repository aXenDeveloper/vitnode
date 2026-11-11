import { buildModule } from "@/api/builders";

import { cronAdminModule } from "./cron/cron.module";
import { queueAdminModule } from "./queue/queue.module";

export const advancedAdminModule = buildModule({
  name: "advanced",
  routes: [],
  modules: [cronAdminModule, queueAdminModule],
});
