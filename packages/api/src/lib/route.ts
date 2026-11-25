import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Context, MiddlewareHandler } from "hono";
import type { ZodError } from "zod";

import { createRoute as createRouteHono } from "@hono/zod-openapi";

import type { EnvVitNode } from "../middlewares/global.middleware";
import type { PermissionStaffType } from "./permission-staff";
import type {
  AdminStaffPermissionRef,
  ModeratorStaffPermissionRef,
  StaffPermissionRef,
} from "./staff-permissions";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import { pluginMiddleware } from "../middlewares/plugin.middleware";
import { siteOfflineGuard } from "../middlewares/site-offline.middleware";
import { assertStaffPermission } from "./check-staff-permission";
import { pluginTag } from "./openapi-tags";
import { isAdminApiPath, setRouteStaffPermissions } from "./route-metadata";
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
  /** Relative to the module, with OpenAPI-style params, e.g. `/{id}`. Also the fetcher's `path`. */
  path: P;
  /**
   * Requires a valid captcha token in the `x-vitnode-captcha-token` header
   * when the app has a captcha configured; answers `400` otherwise. Callers
   * pass it as the fetcher's `captchaToken`. No effect without a captcha config.
   */
  withCaptcha?: boolean;
};

/**
 * Exposes a route as a Model Context Protocol tool: `true`, or the tool's own
 * `name` and `description`. See `BuildRouteOptions.mcp`.
 */
export type RouteMcpOption =
  | true
  | {
      /**
       * What the tool does, for the AI model, in plain English. Defaults to
       * the route's `description`; one of the two is required.
       */
      description?: string;
      /**
       * The tool's name inside the plugin, replacing the derived one:
       * lowercase letters and digits in groups joined by `.`, `_` or `-`.
       */
      name?: string;
    };

/** What `buildRoute` accepts. */
export interface BuildRouteOptions<
  P extends string,
  R extends BuildRouteConfig<P>,
  Mcp extends RouteMcpOption | undefined = undefined,
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
  /**
   * Keeps the route working for everyone while the site is offline. Without
   * it, a visitor who is not staff gets `503 { error: "site_offline" }`. Set
   * it on what an offline site still needs: signing in, webhooks, cron, and
   * reads the offline page itself makes. Routes under `/admin/` and routes
   * with `adminStaffPermission` are never blocked. Defaults to `false`.
   */
  allowWhenOffline?: boolean;
  /** The Hono handler, typed from `route`: `c.req.valid(...)` and `c.json(...)` follow its schemas. */
  handler: RouteHandler<R & { path: P }, EnvVitNode>;
  hook?: RouteValidationHook;
  /**
   * Offers the route to AI clients as a tool on the MCP endpoint (`/api/mcp`),
   * when the app turns it on with `mcp.enabled`. The tool runs the route itself,
   * in process, as the member who connected the client (or a guest): every
   * check the route makes still applies.
   *
   * The tool's name is the module path, the route path (`{id}` read as `id`)
   * and the lowercase method joined by `.` - `GET /stats/forums` in the
   * `forum` module is `forum.stats.forums.get`, listed to clients as
   * `forum_forum_stats_forums_get` (the plugin id without `@vitnode/`, then the
   * name). Its arguments are the route's path params, query and JSON body
   * merged into one object. A `GET` tool needs the `read` scope; every other
   * method needs `write`.
   *
   * `buildApiPlugin` refuses, at startup, a tool under an `admin` path segment,
   * one with `adminStaffPermission`, `moderatorStaffPermission` or
   * `withCaptcha`, a body that is not `application/json` with an object
   * schema, a key shared by params, query and body, a name that is invalid or
   * taken, and a tool with no description.
   *
   * @example
   * ```ts
   * buildRoute({
   *   mcp: { description: "Lists the newest topics of one forum." },
   *   route: { method: "get", path: "/topics", ... },
   *   handler: ...,
   * });
   * ```
   */
  mcp?: Mcp;
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
 * that sets `c.get("plugin")`, then the offline-site guard (see
 * `allowWhenOffline`), then the admin and moderator staff-permission
 * guards and the captcha check when requested, then the route's own
 * `middleware`.
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
  const Mcp extends RouteMcpOption | undefined = undefined,
>({
  route,
  handler,
  hook,
  pluginId,
  adminStaffPermission,
  allowWhenOffline = false,
  mcp,
  moderatorStaffPermission,
}: BuildRouteOptions<P, R, Mcp> & {
  pluginId: Plugin;
}): Route<Plugin, R & { path: P }, Mcp> => {
  const tags = [pluginTag(pluginId), ...(route.tags ?? [])];

  const middleware: MiddlewareHandler[] = [pluginMiddleware(pluginId)];

  if (!allowWhenOffline && !adminStaffPermission) {
    middleware.push(siteOfflineGuard);
  }

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

  const built: Route<Plugin, R & { path: P }, Mcp> = {
    route: createRouteHono({
      // `route` is spread first on purpose: `tags` and `middleware` already
      // merge the route's own values, so letting the spread win would drop
      // `pluginMiddleware` and the staff-permission guard.
      ...route,
      tags,
      middleware,
    }),
    handler: handler as Route<Plugin, R & { path: P }, Mcp>["handler"],
    ...(hook ? { hook } : {}),
    ...(mcp ? { mcp } : {}),
    pluginId,
  };

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
  Mcp extends RouteMcpOption | undefined = RouteMcpOption | undefined,
> {
  handler: (...args: unknown[]) => Promise<Response> | Response;
  hook?: RouteValidationHook;
  /**
   * The route's MCP tool option, as passed to `buildRoute`. Its type keeps the
   * literal, so the plugin's contract can name the tool (`McpToolKey`).
   */
  mcp?: Mcp;
  pluginId: Plugin;
  route: R;
}
