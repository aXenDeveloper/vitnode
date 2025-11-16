import { buildModule } from "@/api/lib/module";

import { cronAdminModule } from "./cron/cron.admin.module";

export const advancedAdminModule = buildModule({
  name: "advanced",
  routes: [],
  modules: [cronAdminModule],
});
