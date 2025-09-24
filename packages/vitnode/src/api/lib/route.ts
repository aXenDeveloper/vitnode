import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import {
  type EnvVitNode,
  pluginMiddleware,
} from "../middlewares/global.middleware";

type RoutingPath<P extends string> =
  P extends `${infer Head}/{${infer Param}}${infer Tail}`
    ? `${Head}/:${Param}${RoutingPath<Tail>}`
    : P;

type ValidHandler<R extends RouteConfig> = (
  c: Parameters<RouteHandler<R, EnvVitNode>>[0],
) => ReturnType<RouteHandler<R>>;

export const buildRoute = <
  Plugin extends string,
  P extends string,
  R extends Omit<RouteConfig, "path"> & {
    path: P;
    withCaptcha?: boolean;
  },
  H extends ValidHandler<R & { path: P }>,
>({
  route,
  handler,
  pluginId,
}: {
  handler: H;
  pluginId: Plugin;
  route: R;
}): {
  handler: H;
  pluginId: Plugin;
  route: R & {
    getRoutingPath: () => RoutingPath<R["path"]>;
  };
} => {
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
    }) as R & {
      getRoutingPath: () => RoutingPath<R["path"]>;
    },
    handler,
    pluginId,
  };
};

export interface Route<
  Plugin extends string = string,
  R extends RouteConfig = RouteConfig,
  H extends RouteHandler<R> = RouteHandler<R>,
> {
  handler: H;
  pluginId: Plugin;
  route: R;
}
