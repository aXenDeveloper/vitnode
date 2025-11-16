import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";

import type { EnvVitNode } from "../middlewares/global.middleware";

export const buildRoute = <
  P extends string,
  R extends Omit<RouteConfig, "path"> & {
    path: P;
    withCaptcha?: boolean;
  },
>({
  route,
  handler,
}: {
  handler: RouteHandler<R & { path: P }, EnvVitNode>;
  route: R;
}): Route<R & { path: P }> => ({
  route: route as R & { path: P },
  handler: handler as Route<R & { path: P }>["handler"],
});

export interface Route<R extends RouteConfig = RouteConfig> {
  handler: (...args: unknown[]) => Promise<Response> | Response;
  route: R;
}
