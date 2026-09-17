import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { getZonesLayoutRoute } from "./routes/get-layout.route";

export const zonesModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "zones",
  routes: [getZonesLayoutRoute],
});
