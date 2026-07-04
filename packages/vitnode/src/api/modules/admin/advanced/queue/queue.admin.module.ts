import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { getQueueTasksRoute } from "./routes/get.route";

export const queueAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "queue",
  routes: [getQueueTasksRoute],
});
