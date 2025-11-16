import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import {
  type EnvVitNode,
  pluginMiddleware,
} from "../middlewares/global.middleware";
import { getCurrentPluginId } from "./plugin-context";

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
}): Route<R & { path: P }> => {
  const pluginId = getCurrentPluginId();
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
    handler: handler as Route<R & { path: P }>["handler"],
    pluginId,
  };
};

export interface Route<R extends RouteConfig = RouteConfig> {
  handler: (...args: unknown[]) => Promise<Response> | Response;
  pluginId: string;
  route: R;
}
