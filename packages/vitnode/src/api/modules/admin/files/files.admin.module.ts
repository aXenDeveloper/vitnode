import { buildModule } from "@/api/builders";

import {
  deleteFileAltAdminRoute,
  getFileAltAdminRoute,
  updateFileAltAdminRoute,
  updateFileAltPolicyAdminRoute,
} from "./routes/alt.route";
import { deleteFileAdminRoute } from "./routes/delete.route";
import { downloadFileAdminRoute } from "./routes/download.route";
import { uploadEditorFileAdminRoute } from "./routes/editor-upload.route";
import { listFilesAdminRoute } from "./routes/list.route";

export const filesAdminModule = buildModule({
  name: "files",
  routes: [
    listFilesAdminRoute,
    downloadFileAdminRoute,
    deleteFileAdminRoute,
    getFileAltAdminRoute,
    updateFileAltAdminRoute,
    deleteFileAltAdminRoute,
    updateFileAltPolicyAdminRoute,
    uploadEditorFileAdminRoute,
  ],
});
