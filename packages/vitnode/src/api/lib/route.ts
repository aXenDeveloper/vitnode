import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import {
  type EnvVitNode,
  pluginMiddleware,
} from "../middlewares/global.middleware";

export const buildRoute = <
  Plugin extends string,
  P extends string,
  R extends Omit<RouteConfig, "path"> & {
    path: P;
    withCaptcha?: boolean;
  },
>({
  route,
  handler,
  pluginId,
}: {
  handler: RouteHandler<R & { path: P }, EnvVitNode>;
  pluginId: Plugin;
  route: R;
}): Route<Plugin, R & { path: P }> => {
  const pluginTag = pluginId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const tags = [pluginTag, ...(route.tags ?? [])];

  return {
    route: createRouteHono({
      tags,
      middleware: [
        pluginMiddleware(pluginId),
        ...(route.withCaptcha ? [captchaMiddleware()] : []),
        ...(Array.isArray(route.middleware)
          ? route.middleware
          : route.middleware
            ? [route.middleware]
            : []),
      ],
      ...route,
    }) as R & { path: P },
    handler: handler as Route<Plugin, R & { path: P }>["handler"],
    pluginId,
  };
};

export interface Route<
  Plugin extends string = string,
  R extends RouteConfig = RouteConfig,
> {
  handler: (...args: unknown[]) => Promise<Response> | Response;
  pluginId: Plugin;
  route: R;
}
