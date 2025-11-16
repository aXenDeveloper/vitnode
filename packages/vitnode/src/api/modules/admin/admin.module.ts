import { buildModule } from "@/api/lib/module";

import { advancedAdminModule } from "./advanced/advanced.admin.module";
import { debugAdminModule } from "./debug/debug.admin.module";
import { sessionAdminRoute } from "./routes/session.route";
import { usersAdminModule } from "./users/users.admin.module";

export const adminModule = buildModule({
  name: "admin",
  routes: [sessionAdminRoute],
  modules: [usersAdminModule, debugAdminModule, advancedAdminModule],
  cronJobs: [],
});
