import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { createUserAdminRoute } from "./routes/create.route";
import { listUserDevicesAdminRoute } from "./routes/devices.route";
import { deleteUserImageAdminRoute } from "./routes/image-delete.route";
import { uploadUserImageAdminRoute } from "./routes/image-upload.route";
import { listUsersAdminRoute } from "./routes/list.route";
import { updateUserNotificationPreferencesAdminRoute } from "./routes/notification-preferences-update.route";
import { listUserNotificationPreferencesAdminRoute } from "./routes/notification-preferences.route";
import { deleteUserPasskeyAdminRoute } from "./routes/passkey-delete.route";
import { renameUserPasskeyAdminRoute } from "./routes/passkey-rename.route";
import { listUserPasskeysAdminRoute } from "./routes/passkeys.route";
import { setPasswordUserAdminRoute } from "./routes/password.route";
import { revokeUserDeviceAdminRoute } from "./routes/revoke-device.route";
import { revokeUserDevicesAdminRoute } from "./routes/revoke-devices.route";
import { showUserAdminRoute } from "./routes/show.route";
import { disconnectUserSsoAdminRoute } from "./routes/sso-disconnect.route";
import { updateUserSsoPreferencesAdminRoute } from "./routes/sso-preferences.route";
import { listUserSsoAdminRoute } from "./routes/sso.route";
import { timelineUserAdminRoute } from "./routes/timeline.route";
import { updateUserAdminRoute } from "./routes/update.route";
import { verifyEmailUserAdminRoute } from "./routes/verify-email.route";

export const usersAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "users",
  routes: [
    listUsersAdminRoute,
    createUserAdminRoute,
    showUserAdminRoute,
    timelineUserAdminRoute,
    updateUserAdminRoute,
    verifyEmailUserAdminRoute,
    setPasswordUserAdminRoute,
    listUserDevicesAdminRoute,
    revokeUserDeviceAdminRoute,
    revokeUserDevicesAdminRoute,
    listUserPasskeysAdminRoute,
    renameUserPasskeyAdminRoute,
    deleteUserPasskeyAdminRoute,
    listUserSsoAdminRoute,
    disconnectUserSsoAdminRoute,
    updateUserSsoPreferencesAdminRoute,
    listUserNotificationPreferencesAdminRoute,
    updateUserNotificationPreferencesAdminRoute,
    uploadUserImageAdminRoute,
    deleteUserImageAdminRoute,
  ],
});
