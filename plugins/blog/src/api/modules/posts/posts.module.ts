import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { postsRoute } from "./routes/get.route";

export const postsModule = buildModule({
  name: "posts",
  routes: [postsRoute],
});

export const postsModuleApi = postsModule.build(CONFIG_PLUGIN.pluginId);
