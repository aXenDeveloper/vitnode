import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { saveZonesLayoutAdminRoute } from "./routes/save-layout.route";

export const zonesAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "zones",
  routes: [saveZonesLayoutAdminRoute],
});
