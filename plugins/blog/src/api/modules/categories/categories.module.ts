import { buildModule } from "@/api/builders";

import { publicCategoriesRoute } from "./routes/list.route";

/** `GET /api/@vitnode/blog/categories` - the public category summaries. */
export const categoriesModule = buildModule({
  name: "categories",
  routes: [publicCategoriesRoute],
});
