import { buildModule } from "@/api/builders";

import { deleteFileAltAdminRoute } from "./routes/delete-alt.route";
import { deleteFileAdminRoute } from "./routes/delete.route";
import { downloadFileAdminRoute } from "./routes/download.route";
import { uploadEditorFileAdminRoute } from "./routes/editor-upload.route";
import { listFilesAdminRoute } from "./routes/list.route";
import { getFileAltAdminRoute } from "./routes/show-alt.route";
import { updateFileAltPolicyAdminRoute } from "./routes/update-alt-policy.route";
import { updateFileAltAdminRoute } from "./routes/update-alt.route";

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
