import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { postsRoute } from "./routes/get.route";

export const postsModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "posts",
  routes: [postsRoute],
});
