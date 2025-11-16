import { buildModule } from "@vitnode/core/api/lib/module";


import { postsRoute } from "./routes/get.route";

export const postsModule = buildModule({
  name: "posts",
  routes: [postsRoute],
});
