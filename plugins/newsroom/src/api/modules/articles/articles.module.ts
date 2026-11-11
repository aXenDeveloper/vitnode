import { buildModule } from "@/api/builders";

import { articleSlugRoute } from "./routes/show-slug.route";

export const articlesModule = buildModule({
  name: "articles",
  routes: [articleSlugRoute],
});
