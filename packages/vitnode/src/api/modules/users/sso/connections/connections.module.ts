import { buildModule } from "@/api/builders";

import { ssoApplyImportRoute } from "./routes/apply-import.route";
import { authorizeSsoConnectionRoute } from "./routes/authorize.route";
import { ssoConnectionCallbackRoute } from "./routes/callback.route";
import { ssoDiscardImportRoute } from "./routes/discard-import.route";
import { disconnectSsoConnectionRoute } from "./routes/disconnect.route";
import { listSsoConnectionsRoute } from "./routes/list.route";
import { ssoImportPreviewRoute } from "./routes/preview-import.route";
import { ssoPreferencesRoute } from "./routes/update-preferences.route";

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
