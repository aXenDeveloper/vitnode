import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { excerptAiAdminRoute } from "./routes/excerpt.route";
import { translateAiAdminRoute } from "./routes/translate.route";

export const aiAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "ai",
  routes: [translateAiAdminRoute, excerptAiAdminRoute],
});
