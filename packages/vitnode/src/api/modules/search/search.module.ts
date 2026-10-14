import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { authorsRoute } from "./routes/authors.route";
import { facetsRoute } from "./routes/facets.route";
import { searchRoute } from "./routes/search.route";
import { timelineRoute } from "./routes/timeline.route";
import { rebuildSearchIndexTask } from "./tasks/rebuild-index.task";

export const searchModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "search",
  routes: [searchRoute, timelineRoute, authorsRoute, facetsRoute],
  queueTasks: [rebuildSearchIndexTask],
});
