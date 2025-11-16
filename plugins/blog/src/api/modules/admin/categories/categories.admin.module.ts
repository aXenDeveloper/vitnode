import { buildModule } from "@vitnode/core/api/lib/module";

import { createCategoryRoute } from "./routes/create.route";
import { deleteCategoryRoute } from "./routes/delete.route";
import { editCategoryRoute } from "./routes/edit.route";

export const categoriesAdminModule = buildModule({
  name: "categories",
  routes: [createCategoryRoute, editCategoryRoute, deleteCategoryRoute],
});
