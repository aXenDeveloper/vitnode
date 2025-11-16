import { buildModule } from "@vitnode/core/api/lib/module";

import { createPostRoute } from "./routes/create.route";
import { deletePostRoute } from "./routes/delete.route";
import { editPostRoute } from "./routes/edit.route";

export const postsAdminModule = buildModule({
  name: "posts",
  routes: [editPostRoute, createPostRoute, deletePostRoute],
});
