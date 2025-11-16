import { buildModule } from "@vitnode/core/api/lib/module";

import { categoriesAdminModule } from "./categories/categories.admin.module";
import { postsAdminModule } from "./posts/posts.admin.module";

export const adminModule = buildModule({
  name: "admin",
  modules: [categoriesAdminModule, postsAdminModule],
  routes: [],
});
