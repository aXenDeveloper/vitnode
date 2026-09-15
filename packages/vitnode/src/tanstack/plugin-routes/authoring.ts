import type { QueryClient } from "@tanstack/react-query";

import type {
  AuthoredPluginRouteOptions,
  PluginRouteBreadcrumbGroup,
  PluginRouteBreadcrumbProps,
  PluginRouteContext,
  PluginRouteOptions,
} from "@/routing";

import type { AdminAccessState } from "../admin/session-api";
import type { AuthState } from "../auth/state";

/**
 * What every route mounted by `withVitNodeRoutes` can count on.
 *
 * The locale a plugin already had, plus the query client - which is not a
 * convenience. VitNode's whole caching story is "warm the route's data in its
 * loader with `queryClient.query(...)`", and a loader that cannot reach one has
 * to fetch in render instead.
 *
 * Still a projection of the host's context, not the host's context: these two
 * fields are what every host promises, and a field a particular host happens to
 * carry stays invisible here.
 */
export interface RouteLoadContext extends PluginRouteContext {
  queryClient: QueryClient;
}

/**
 * The signed-in half of {@link AuthState}.
 *
 * `AuthState` is a union whose anonymous branch has a `null` user, and a route
 * behind `requires: "authenticated"` has already been through a guard that
 * redirected every visitor in that branch away. Narrowing here is what turns
 * that runtime fact into a type - so a loader reads `auth.user.id` without a
 * check it has no way to fail.
 */
export type AuthenticatedState = Extract<AuthState, { isAuthenticated: true }>;

/** {@link RouteLoadContext} for a route that declared `requires`. */
export interface AuthenticatedRouteLoadContext extends RouteLoadContext {
  /** Resolved by the guard before `load` runs, so never anonymous here. */
  auth: AuthenticatedState;
}

/** {@link RouteLoadContext} for a route in the `admin` area. */
export interface AdminRouteLoadContext extends RouteLoadContext {
  /** Resolved by the AdminCP shell, which a route in this area renders inside. */
  adminAccess: AdminAccessState;
}

/**
 * `definePluginRoute`, with the context a mounted route actually gets.
 *
 * Three doors rather than one, because the difference between them is a promise
 * a route has already earned: `auth` exists because the route declared
 * `requires` and a guard resolved it, and `adminAccess` exists because the route
 * is in the `admin` area and renders inside the AdminCP shell. A route that made
 * neither declaration is handed neither, and asking for one is a type error
 * rather than an `undefined` at runtime.
 */
export const defineRoute = <TData = never, TSearch = Record<string, never>>(
  options: AuthoredPluginRouteOptions<TData, TSearch, RouteLoadContext>,
): PluginRouteOptions<TData, TSearch, RouteLoadContext> => options;

/** {@link defineRoute}, for a route that declared `requires`. */
export const defineAuthenticatedRoute = <
  TData = never,
  TSearch = Record<string, never>,
>(
  options: AuthoredPluginRouteOptions<
    TData,
    TSearch,
    AuthenticatedRouteLoadContext
  >,
): PluginRouteOptions<TData, TSearch, AuthenticatedRouteLoadContext> => options;

/** {@link defineRoute}, for a route in the `admin` area. */
export const defineAdminRoute = <
  TData = never,
  TSearch = Record<string, never>,
>(
  options: AuthoredPluginRouteOptions<TData, TSearch, AdminRouteLoadContext>,
): PluginRouteOptions<TData, TSearch, AdminRouteLoadContext> => options;

/**
 * Declares that a route contributes several crumbs rather than one label.
 *
 * Generic where `breadcrumbGroup` in the breadcrumb model is not, so a group
 * reads this route's own `loaderData` and `search` with their real types instead
 * of `unknown`. The runtime renders the two shapes identically - this one only
 * exists so the declaration can be type-checked against the route that carries
 * it.
 */
export const routeBreadcrumbGroup = <TData = unknown, TSearch = unknown>(
  group: PluginRouteBreadcrumbGroup<TData, TSearch>["group"],
): PluginRouteBreadcrumbGroup<TData, TSearch> => ({ group });
