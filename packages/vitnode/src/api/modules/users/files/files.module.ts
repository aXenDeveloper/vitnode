import { buildModule } from "@/api/builders";

import { deleteUserFileRoute } from "./routes/delete.route";
import { downloadUserFileRoute } from "./routes/download.route";
import { uploadEditorFileRoute } from "./routes/editor-upload.route";
import { listUserFilesRoute } from "./routes/list.route";

export const userFilesModule = buildModule({
  name: "files",
  routes: [
    listUserFilesRoute,
    downloadUserFileRoute,
    deleteUserFileRoute,
    uploadEditorFileRoute,
  ],
});
