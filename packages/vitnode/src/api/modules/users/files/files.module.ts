import { buildModule } from "@/api/builders";

import { deleteUserFileRoute } from "./routes/delete.route";
import { downloadUserFileRoute } from "./routes/download.route";
import { listUserFilesRoute } from "./routes/list.route";

export const userFilesModule = buildModule({
  name: "files",
  routes: [listUserFilesRoute, downloadUserFileRoute, deleteUserFileRoute],
});
