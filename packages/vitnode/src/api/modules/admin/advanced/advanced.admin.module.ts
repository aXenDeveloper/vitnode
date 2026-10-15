import { buildModule } from "@/api/builders";

import { cronAdminModule } from "./cron/cron.admin.module";
import { queueAdminModule } from "./queue/queue.admin.module";

export const advancedAdminModule = buildModule({
  name: "advanced",
  routes: [],
  modules: [cronAdminModule, queueAdminModule],
});
