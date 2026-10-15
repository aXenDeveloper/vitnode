import { buildModule } from "@/api/builders";

import { routeMiddleware } from "./route";

export const middlewareModule = buildModule({
  name: "middleware",
  routes: [routeMiddleware],
});
