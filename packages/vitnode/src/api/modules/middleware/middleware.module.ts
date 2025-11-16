import { buildModule } from "@/api/lib/module";

import { routeMiddleware } from "./route";

export const middlewareModule = buildModule({
  name: "middleware",
  routes: [routeMiddleware],
});
