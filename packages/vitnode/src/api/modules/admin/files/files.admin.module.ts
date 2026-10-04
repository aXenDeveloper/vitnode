import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import {
  deleteFileAltAdminRoute,
  getFileAltAdminRoute,
  updateFileAltAdminRoute,
  updateFileAltPolicyAdminRoute,
} from "./routes/alt.route";
import { deleteFileAdminRoute } from "./routes/delete.route";
import { downloadFileAdminRoute } from "./routes/download.route";
import { listFilesAdminRoute } from "./routes/list.route";

export const filesAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "files",
  routes: [
    listFilesAdminRoute,
    downloadFileAdminRoute,
    deleteFileAdminRoute,
    getFileAltAdminRoute,
    updateFileAltAdminRoute,
    deleteFileAltAdminRoute,
    updateFileAltPolicyAdminRoute,
  ],
});
