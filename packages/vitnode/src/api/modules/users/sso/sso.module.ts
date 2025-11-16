import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { callbackRoute } from "./routes/callback.route";
import { createUrlRoute } from "./routes/create-url.route";

export const ssoUserModule = buildModule({
  name: "sso",
  routes: [callbackRoute, createUrlRoute],
});

export const ssoUserModuleApi = ssoUserModule.build(CONFIG_PLUGIN.pluginId);
