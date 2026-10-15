import { buildModule } from "@/api/builders";

import { authorizeSsoConnectionRoute } from "./routes/authorize.route";
import { ssoConnectionCallbackRoute } from "./routes/callback.route";
import { disconnectSsoConnectionRoute } from "./routes/disconnect.route";
import {
  ssoApplyImportRoute,
  ssoDiscardImportRoute,
  ssoImportPreviewRoute,
} from "./routes/import.route";
import { listSsoConnectionsRoute } from "./routes/list.route";
import { ssoPreferencesRoute } from "./routes/preferences.route";

export const ssoConnectionsModule = buildModule({
  name: "connections",
  routes: [
    listSsoConnectionsRoute,
    ssoPreferencesRoute,
    authorizeSsoConnectionRoute,
    ssoConnectionCallbackRoute,
    ssoImportPreviewRoute,
    ssoApplyImportRoute,
    ssoDiscardImportRoute,
    disconnectSsoConnectionRoute,
  ],
});
