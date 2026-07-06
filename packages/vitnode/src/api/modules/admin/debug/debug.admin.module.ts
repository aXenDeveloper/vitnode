import { CONFIG_PLUGIN } from "../../../../config";
import { buildModule } from "../../../lib/module";
import { integrationsDebugAdminRoute } from "./routes/integrations.route";
import { logsDebugAdminRoute } from "./routes/logs.route";
import { queueDebugAdminRoute } from "./routes/queue.route";
import { sendTestEmailDebugAdminRoute } from "./routes/send-test-email.route";
import { testStorageUploadDebugAdminRoute } from "./routes/test-storage-upload.route";

export const debugAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "debug",
  routes: [
    logsDebugAdminRoute,
    integrationsDebugAdminRoute,
    queueDebugAdminRoute,
    sendTestEmailDebugAdminRoute,
    testStorageUploadDebugAdminRoute,
  ],
});
