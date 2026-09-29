import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { passkeyAdminSignInOptionsRoute } from "./routes/admin-sign-in-options.route";
import { passkeyAdminSignInVerifyRoute } from "./routes/admin-sign-in-verify.route";
import { passkeyAuthenticationOptionsRoute } from "./routes/authentication-options.route";
import { passkeyAuthenticationVerifyRoute } from "./routes/authentication-verify.route";
import { deletePasskeyRoute } from "./routes/delete.route";
import { listPasskeysRoute } from "./routes/list.route";
import { passkeyRegistrationOptionsRoute } from "./routes/registration-options.route";
import { passkeyRegistrationVerifyRoute } from "./routes/registration-verify.route";
import { renamePasskeyRoute } from "./routes/rename.route";

export const passkeysUserModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "passkeys",
  routes: [
    listPasskeysRoute,
    passkeyRegistrationOptionsRoute,
    passkeyRegistrationVerifyRoute,
    passkeyAuthenticationOptionsRoute,
    passkeyAuthenticationVerifyRoute,
    passkeyAdminSignInOptionsRoute,
    passkeyAdminSignInVerifyRoute,
    renamePasskeyRoute,
    deletePasskeyRoute,
  ],
});
