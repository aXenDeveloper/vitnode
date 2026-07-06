import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import type { EnvVitNode } from "../middlewares/global.middleware";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import { pluginMiddleware } from "../middlewares/plugin.middleware";
import { assertStaffPermission } from "./check-staff-permission";

export interface AdminStaffPermission {
  module: string;
  permission: string;
  plugin?: string;
}

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
  adminStaffPermission,
}: {
  adminStaffPermission?: AdminStaffPermission;
  handler: RouteHandler<R & { path: P }, EnvVitNode>;
  pluginId: Plugin;
  route: R;
}): Route<Plugin, R & { path: P }> => {
  const pluginTag = pluginId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const tags = [pluginTag, ...(route.tags ?? [])];

  const middleware: MiddlewareHandler[] = [pluginMiddleware(pluginId)];

  if (adminStaffPermission) {
    const { plugin, module, permission } = adminStaffPermission;
    middleware.push(async (c, next) => {
      await assertStaffPermission(c, {
        type: "admin",
        plugin: plugin ?? pluginId,
        module,
        permission,
      });
      await next();
    });
  }

  if (route.withCaptcha) {
    middleware.push(captchaMiddleware());
  }

  if (Array.isArray(route.middleware)) {
    middleware.push(...route.middleware);
  } else if (route.middleware) {
    middleware.push(route.middleware);
  }

  return {
    route: createRouteHono({
      tags,
      middleware,
      ...route,
    }),
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
