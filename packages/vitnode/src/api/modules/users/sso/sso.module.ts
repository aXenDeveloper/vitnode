import { buildModule } from "@/api/builders";

import { ssoConnectionsModule } from "./connections/connections.module";
import { callbackRoute } from "./routes/callback.route";
import { createUrlRoute } from "./routes/create-url.route";
import { linkRoute } from "./routes/link.route";

export const ssoUserModule = buildModule({
  name: "sso",
  routes: [callbackRoute, createUrlRoute, linkRoute],
  modules: [ssoConnectionsModule],
});
