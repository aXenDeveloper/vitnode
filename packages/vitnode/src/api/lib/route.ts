import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Context, MiddlewareHandler } from "hono";
import type { ZodError } from "zod";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import type { EnvVitNode } from "../middlewares/global.middleware";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import { pluginMiddleware } from "../middlewares/plugin.middleware";
import { assertStaffPermission } from "./check-staff-permission";
import { pluginTag } from "./openapi-tags";

/**
 * Runs after request validation, as `@hono/zod-openapi`'s hook. Return a
 * `Response` to answer a failed validation yourself; return nothing for the
 * default handling.
 */
export type RouteValidationHook = (
  result: { error: ZodError; success: false } | { success: true },
  c: Context,
) => Promise<Response | undefined> | Response | undefined;

/** The admin staff permission a route requires. */
export interface AdminStaffPermission {
  /** The permission module, e.g. `posts`. */
  module: string;
  /** The permission within it, e.g. `can_edit`. */
  permission: string;
  /** The plugin that declares the permission. Defaults to the route's own plugin. */
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

/**
 * Every route under an `admin` path segment without an `adminStaffPermission`
 * guard, as sorted `METHOD /path` labels. Use it in a test (core and the
 * bundled plugins do) to keep an admin API from shipping an unguarded route.
 */
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

/** A `@hono/zod-openapi` route definition, plus VitNode's own options. */
export type BuildRouteConfig<P extends string> = Omit<RouteConfig, "path"> & {
  /** Relative to the module, with OpenAPI-style params, e.g. `/{id}`. Also the fetcher's `path`. */
  path: P;
  /**
   * Requires a valid captcha token in the `x-vitnode-captcha-token` header
   * when the app has a captcha configured; answers `400` otherwise. Callers
   * pass it as the fetcher's `captchaToken`. No effect without a captcha config.
   */
  withCaptcha?: boolean;
};

/** What `buildRoute` accepts. */
export interface BuildRouteOptions<
  P extends string,
  R extends BuildRouteConfig<P>,
> {
  /**
   * Requires an admin with this staff permission; anyone else gets `403`.
   * Paths containing `/admin/` already require an admin session, but this is
   * the only per-permission check, so every admin route should set it.
   */
  adminStaffPermission?: AdminStaffPermission;
  /** The Hono handler, typed from `route`: `c.req.valid(...)` and `c.json(...)` follow its schemas. */
  handler: RouteHandler<R & { path: P }, EnvVitNode>;
  hook?: RouteValidationHook;
  route: R;
}

/**
 * Defines one typed API route. Plugins call the bound version from
 * `bindApiPlugin`, which supplies `pluginId`.
 *
 * The route is tagged with its plugin for OpenAPI and runs behind middleware
 * that sets `c.get("plugin")`, then the staff-permission guard and the captcha
 * check when requested, then the route's own `middleware`.
 *
 * @example
 * ```ts
 * import { z } from "@hono/zod-openapi";
 *
 * import { buildRoute } from "@/api/builders";
 *
 * export const showPostRoute = buildRoute({
 *   adminStaffPermission: { module: "posts", permission: "can_view" },
 *   route: {
 *     method: "get",
 *     path: "/{id}",
 *     request: { params: z.object({ id: z.string() }) },
 *     responses: {
 *       200: {
 *         content: { "application/json": { schema: z.object({ title: z.string() }) } },
 *         description: "The post",
 *       },
 *     },
 *   },
 *   handler: c => c.json({ title: c.req.valid("param").id }, 200),
 * });
 * ```
 */
export const buildRoute = <
  Plugin extends string,
  P extends string,
  R extends BuildRouteConfig<P>,
>({
  route,
  handler,
  hook,
  pluginId,
  adminStaffPermission,
}: BuildRouteOptions<P, R> & {
  pluginId: Plugin;
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
    ...(hook ? { hook } : {}),
    pluginId,
  };
};

/** A built route, ready for `buildModule`'s `routes`. */
export interface Route<
  Plugin extends string = string,
  R extends RouteConfig = RouteConfig,
> {
  handler: (...args: unknown[]) => Promise<Response> | Response;
  hook?: RouteValidationHook;
  pluginId: Plugin;
  route: R;
}
