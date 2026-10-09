import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import type { EnvVitNode } from "../middlewares/global.middleware";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import { pluginMiddleware } from "../middlewares/plugin.middleware";
import { assertStaffPermission } from "./check-staff-permission";
import { pluginTag } from "./openapi-tags";

export interface AdminStaffPermission {
  module: string;
  permission: string;
  plugin?: string;
}

const staffPermissionGuards = new WeakSet<MiddlewareHandler>();

interface MountedRoute {
  handler: unknown;
  method: string;
  path: string;
}

const unwrapHandler = (handler: unknown): unknown =>
  typeof handler === "function" && "__COMPOSED_HANDLER" in handler
    ? unwrapHandler(handler.__COMPOSED_HANDLER)
    : handler;

export const findAdminRoutesWithoutStaffPermission = (hono: {
  routes: readonly MountedRoute[];
}): string[] => {
  const guarded = new Map<string, boolean>();

  for (const { handler, method, path } of hono.routes) {
    if (method === "ALL" || !/(^|\/)admin(\/|$)/.test(path)) continue;

    const label = `${method} ${path}`;
    const handlerFn = unwrapHandler(handler);
    const isGuard =
      typeof handlerFn === "function" &&
      staffPermissionGuards.has(handlerFn as MiddlewareHandler);
    guarded.set(label, (guarded.get(label) ?? false) || isGuard);
  }

  return [...guarded]
    .filter(([, isGuarded]) => !isGuarded)
    .map(([label]) => label)
    .sort();
};

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
  const tags = [pluginTag(pluginId), ...(route.tags ?? [])];

  const middleware: MiddlewareHandler[] = [pluginMiddleware(pluginId)];

  if (adminStaffPermission) {
    const { plugin, module, permission } = adminStaffPermission;
    const guard: MiddlewareHandler = async (c, next) => {
      await assertStaffPermission(c, {
        type: "admin",
        plugin: plugin ?? pluginId,
        module,
        permission,
      });
      await next();
    };
    staffPermissionGuards.add(guard);
    middleware.push(guard);
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
      // `route` is spread first on purpose: `tags` and `middleware` already
      // merge the route's own values, so letting the spread win would drop
      // `pluginMiddleware` and the staff-permission guard.
      ...route,
      tags,
      middleware,
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
