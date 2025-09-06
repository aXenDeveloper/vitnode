import { CONFIG_PLUGIN } from "../../../../config";
import { buildModule } from "../../../lib/module";
import { logsDebugAdminRoute } from "./routes/logs.route";

export const debugAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "debug",
  routes: [logsDebugAdminRoute],
});
