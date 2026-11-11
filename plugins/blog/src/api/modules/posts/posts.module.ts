import { buildModule } from "@/api/builders";

import { postSlugRoute } from "./routes/show-slug.route";

export const postsModule = buildModule({
  name: "posts",
  routes: [postSlugRoute],
});
