import { buildModule } from "@/api/builders";

import { listPluginsAdminRoute } from "./routes/list.route";

export const pluginsAdminModule = buildModule({
  name: "plugins",
  routes: [listPluginsAdminRoute],
});
