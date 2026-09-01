import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { userFilesModule } from "./files/files.module";
import { changePasswordRoute } from "./routes/change-password.route";
import { listDevicesRoute } from "./routes/devices.route";
import { permissionsRoute } from "./routes/permissions.route";
import { resetPasswordRoute } from "./routes/reset-passowrd.route";
import { revokeDeviceRoute } from "./routes/revoke-device.route";
import { sessionRoute } from "./routes/session.route";
import { signInRoute } from "./routes/sign-in.route";
import { signOutRoute } from "./routes/sign-out.route";
import { signUpRoute } from "./routes/sign-up.route";
import { ssoUserModule } from "./sso/sso.module";

export const usersModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "users",
  routes: [
    sessionRoute,
    signInRoute,
    signOutRoute,
    signUpRoute,
    resetPasswordRoute,
    changePasswordRoute,
    permissionsRoute,
    listDevicesRoute,
    revokeDeviceRoute,
  ],
  modules: [ssoUserModule, userFilesModule],
});
