import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import { deleteUserFileRoute } from "./routes/delete.route";
import { downloadUserFileRoute } from "./routes/download.route";
import { listUserFilesRoute } from "./routes/list.route";
import { uploadLimitsUserFilesRoute } from "./routes/upload-limits.route";
import { uploadUserFilesRoute } from "./routes/upload.route";

export const userFilesModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "files",
  routes: [
    listUserFilesRoute,
    uploadLimitsUserFilesRoute,
    uploadUserFilesRoute,
    downloadUserFileRoute,
    deleteUserFileRoute,
  ],
});
