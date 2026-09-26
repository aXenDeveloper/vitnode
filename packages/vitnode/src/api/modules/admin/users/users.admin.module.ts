import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { createUserAdminRoute } from "./routes/create.route";
import { deleteUserImageAdminRoute } from "./routes/image-delete.route";
import { uploadUserImageAdminRoute } from "./routes/image-upload.route";
import { listUsersAdminRoute } from "./routes/list.route";
import { showUserAdminRoute } from "./routes/show.route";
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
    uploadUserImageAdminRoute,
    deleteUserImageAdminRoute,
  ],
});
