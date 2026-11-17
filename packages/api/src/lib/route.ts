import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Context, MiddlewareHandler } from "hono";
import type { ZodError } from "zod";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { RouteMcpConfig } from "./mcp/route-options";
import type { PermissionStaffType } from "./permission-staff";
import type {
  AdminStaffPermissionRef,
  ModeratorStaffPermissionRef,
  StaffPermissionRef,
} from "./staff-permissions";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import { pluginMiddleware } from "../middlewares/plugin.middleware";
import { assertStaffPermission } from "./check-staff-permission";
import { pluginTag } from "./openapi-tags";
import {
  isAdminApiPath,
  setRouteMcp,
  setRouteStaffPermissions,
} from "./route-metadata";
import { staffPermissionArgs } from "./staff-permissions";

/**
 * Runs after request validation, as `@hono/zod-openapi`'s hook. Return a
 * `Response` to answer a failed validation yourself; return nothing for the
 * default handling.
 */
export type RouteValidationHook = (
  result: { error: ZodError; success: false } | { success: true },
  c: Context,
) => Promise<Response | undefined> | Response | undefined;

const staffPermissionGuards = new WeakSet<MiddlewareHandler>();

const staffPermissionGuard = (
  type: PermissionStaffType,
  ref: StaffPermissionRef,
): MiddlewareHandler => {
  if (ref.staffType !== type) {
    throw new Error(
      `${type}StaffPermission received the ${ref.staffType} permission ${ref.plugin}:${ref.module}:${ref.permission}.`,
    );
  }
  const { module, permission, plugin } = ref;

  return async (c, next) => {
    await assertStaffPermission(c, { type, plugin, module, permission });
    await next();
  };
};

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
    if (method === "ALL" || !isAdminApiPath(path)) continue;

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
  /**
   * Exposes the route as a tool on the install's MCP endpoint (`/api/mcp`),
   * when the API config turns MCP on. Off when omitted or `false`; `true` uses
   * the route's own `operationId` and `description` (or `summary`), an object
   * overrides them - see `RouteMcpOptions` in `@vitnode/api/lib/mcp/route-options`.
   *
   * The tool runs this same route - its middleware, staff-permission guards,
   * validation and handler - as the user who owns the MCP token, and only when
   * the token grants it. A tool needs a description, JSON request bodies,
   * no declared headers or cookies, and no `withCaptcha`: the API refuses to
   * start otherwise. Not part of the OpenAPI document.
   */
  mcp?: RouteMcpConfig;
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
   *
   * A reference from `defineStaffPermissions` (`staffPermissions.admin.posts.canEdit`),
   * checked against the plugin that declares it - another plugin's reference
   * guards with that plugin's permission.
   */
  adminStaffPermission?: AdminStaffPermissionRef;
  /** The Hono handler, typed from `route`: `c.req.valid(...)` and `c.json(...)` follow its schemas. */
  handler: RouteHandler<R & { path: P }, EnvVitNode>;
  hook?: RouteValidationHook;
  /**
   * Requires a signed-in member who is a moderator with this staff permission;
   * anyone else gets `403`. Checked against the member's site session, so use
   * it on public routes, not under `/admin/`. A grant scoped to selected
   * resources does not pass: check those in the handler with
   * `assertStaffPermission` and a `resource`.
   *
   * A moderator reference from `defineStaffPermissions`, checked against the
   * plugin that declares it.
   */
  moderatorStaffPermission?: ModeratorStaffPermissionRef;
  route: R;
}

/**
 * Defines one typed API route. Plugins call the bound version from
 * `bindApiPlugin`, which supplies `pluginId`.
 *
 * The route is tagged with its plugin for OpenAPI and runs behind middleware
 * that sets `c.get("plugin")`, then the admin and moderator staff-permission
 * guards and the captcha check when requested, then the route's own
 * `middleware`.
 *
 * With `route.mcp`, the same route is also an MCP tool when the API config
 * turns MCP on. Tool calls run this route through the full pipeline above, so
 * nothing about the route is declared twice.
 *
 * @example
 * ```ts
 * import { z } from "@hono/zod-openapi";
 *
 * import { buildRoute } from "@/builders";
 * import { staffPermissions } from "@/staff-permissions";
 *
 * export const showPostRoute = buildRoute({
 *   adminStaffPermission: staffPermissions.admin.posts.canView,
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
  moderatorStaffPermission,
}: BuildRouteOptions<P, R> & {
  pluginId: Plugin;
}): Route<Plugin, R & { path: P }> => {
  // MCP options are VitNode's own: they are kept off the OpenAPI document and
  // recorded on the built route instead.
  const { mcp, ...openApiRoute } = route;
  const tags = [pluginTag(pluginId), ...(route.tags ?? [])];

  const middleware: MiddlewareHandler[] = [pluginMiddleware(pluginId)];

  if (adminStaffPermission) {
    const guard = staffPermissionGuard("admin", adminStaffPermission);
    staffPermissionGuards.add(guard);
    middleware.push(guard);
  }

  if (moderatorStaffPermission) {
    middleware.push(
      staffPermissionGuard("moderator", moderatorStaffPermission),
    );
  }

  if (route.withCaptcha) {
    middleware.push(captchaMiddleware());
  }

  if (Array.isArray(route.middleware)) {
    middleware.push(...route.middleware);
  } else if (route.middleware) {
    middleware.push(route.middleware);
  }

  const built: Route<Plugin, R & { path: P }> = {
    // Typed as declared: the one key the runtime value lacks is `mcp`, which
    // lives on the built route's metadata instead.
    route: createRouteHono({
      // `route` is spread first on purpose: `tags` and `middleware` already
      // merge the route's own values, so letting the spread win would drop
      // `pluginMiddleware` and the staff-permission guard.
      ...openApiRoute,
      tags,
      middleware,
    }) as unknown as R & { path: P },
    handler: handler as Route<Plugin, R & { path: P }>["handler"],
    ...(hook ? { hook } : {}),
    pluginId,
  };

  if (mcp) {
    setRouteMcp(built, mcp === true ? {} : mcp);
  }

  if (adminStaffPermission || moderatorStaffPermission) {
    setRouteStaffPermissions(built, {
      admin: adminStaffPermission && staffPermissionArgs(adminStaffPermission),
      moderator:
        moderatorStaffPermission &&
        staffPermissionArgs(moderatorStaffPermission),
    });
  }

  return built;
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
