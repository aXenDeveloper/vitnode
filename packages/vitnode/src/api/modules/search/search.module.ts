import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { searchRoute } from "./routes/search.route";
import { rebuildSearchIndexTask } from "./tasks/rebuild-index.task";

export const searchModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "search",
  routes: [searchRoute],
  queueTasks: [rebuildSearchIndexTask],
});
