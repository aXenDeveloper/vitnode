import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "../../../../const";
import { createPostRoute } from "./routes/create.route";
import { deletePostRoute } from "./routes/delete.route";
import { editPostRoute } from "./routes/edit.route";

export const postsAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "posts",
  routes: [editPostRoute, createPostRoute, deletePostRoute],
});
