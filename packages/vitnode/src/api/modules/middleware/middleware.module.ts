import { buildModule } from "@/api/builders";

import { routeMiddleware } from "./routes/show-config.route";

export const middlewareModule = buildModule({
  name: "middleware",
  routes: [routeMiddleware],
});
