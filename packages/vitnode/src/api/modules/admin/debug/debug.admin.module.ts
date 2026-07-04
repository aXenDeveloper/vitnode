import { CONFIG_PLUGIN } from "../../../../config";
import { buildModule } from "../../../lib/module";
import { integrationsDebugAdminRoute } from "./routes/integrations.route";
import { logsDebugAdminRoute } from "./routes/logs.route";
import { sendTestEmailDebugAdminRoute } from "./routes/send-test-email.route";

export const debugAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "debug",
  routes: [
    logsDebugAdminRoute,
    integrationsDebugAdminRoute,
    sendTestEmailDebugAdminRoute,
  ],
});
