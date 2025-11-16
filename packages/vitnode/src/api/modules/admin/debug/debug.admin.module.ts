import { CONFIG_PLUGIN } from "../../../../config";
import { buildModule } from "../../../lib/module";
import { logsDebugAdminRoute } from "./routes/logs.route";

export const debugAdminModule = buildModule({
  name: "debug",
  routes: [logsDebugAdminRoute],
});

export const debugAdminModuleApi = debugAdminModule.build(
  CONFIG_PLUGIN.pluginId,
);
