import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import type { NotFoundRouteProps } from "@tanstack/react-router";

import {
  createRoute,
  lazyRouteComponent,
  useRouter,
} from "@tanstack/react-router";

import type { PluginRouteArea } from "@/routing";

import { PLUGIN_ROUTE_AREAS } from "@/routing";

import type { RouteHeadOptions, RouteHeadResult } from "../metadata";
import type { PluginRouteLoaderData } from "./loader-data";
import type { PluginRouteModuleRef } from "./module-ref";
import type { PluginRouteSpec } from "./specs";

// Loaded for its `declare module` augmentation, which is what puts `breadcrumb`
// on a route's `staticData` - see `../breadcrumb/model`.
import "../breadcrumb/model";
import { intlQueryOptions } from "../i18n/query";
import { pageHead as defaultPageHead } from "../metadata";
import {
  assertNoAppCollision,
  declaredOptions,
  fileRoutePaths,
} from "./collision";
import {
  pluginLayoutComponent,
  pluginPageComponent,
  pluginRouteBreadcrumb,
} from "./components";
import { PLUGIN_ROUTES_ROUTE_ID } from "./container";
import { pluginRouteGuard } from "./guard";
import { normalizePluginRouteHead } from "./head";
import { pluginRouteTranslator } from "./translator";
import { pluginRouteSearchDeps } from "./specs";

export interface PluginRouteRuntimeContext {
  /** Present in the `admin` area, contributed by the AdminCP shell. */
  adminAccess?: unknown;
  /** Present on a guarded route, contributed by that route's own guard. */
  auth?: unknown;
  locale: string;
  queryClient: QueryClient;
}

export type PluginRoutePageHead = (
  options: RouteHeadOptions,
) => RouteHeadResult;

export type PluginRouteAreaRoutes = Partial<Record<PluginRouteArea, AnyRoute>>;

export interface PluginRoutesMountOptions {
  mountUnder?: PluginRouteAreaRoutes;
  /**
   * Optional, and only for an application that formats its titles differently:
   * `pageHead` reads the site's own metadata from the VitNode config itself, so
   * the default is already this application's.
   */
  pageHead?: PluginRoutePageHead;
}

const pluginRouteHead =
  (spec: PluginRouteSpec, pageHead: PluginRoutePageHead) =>
  async ({
    loaderData,
    match,
    params,
  }: {
    loaderData?: unknown;
    /** The router hands `head` the match, and a match carries its context. */
    match: { context: PluginRouteRuntimeContext };
    params: Readonly<Record<string, string>>;
  }): Promise<Partial<RouteHeadResult>> => {
    const { route } = await spec.module();

    if (!route.head) return {};

    const envelope = (loaderData ?? {}) as Partial<PluginRouteLoaderData>;

    return pageHead(
      normalizePluginRouteHead(
        route.head({
          loaderData: envelope.data,
          params,
          search: envelope.search ?? {},
          // `head` runs outside the React tree, so `useTranslations` cannot
          // reach it. The namespaces are already cached by the loader, so this
          // resolves without a request.
          t: await pluginRouteTranslator(spec, match.context),
        }),
      ),
    );
  };

const pluginRouteLoader =
  (spec: PluginRouteSpec) =>
  async ({
    context,
    deps,
    params,
  }: {
    context: PluginRouteRuntimeContext;
    deps: Record<string, unknown>;
    params: Readonly<Record<string, string>>;
  }): Promise<PluginRouteLoaderData> => {
    const [{ route }] = await Promise.all([
      spec.module(),
      spec.namespaces.length === 0
        ? undefined
        : context.queryClient.query({
            ...intlQueryOptions({
              locale: context.locale,
              namespaces: spec.namespaces,
            }),
            staleTime: "static",
          }),
    ]);
    // Built from the query the line above just warmed, so it costs a cache read.
    const t = await pluginRouteTranslator(spec, context);

    const search = spec.validateSearch
      ? deps
      : route.parseSearch
        ? route.parseSearch(deps)
        : {};

    return {
      data: route.load
        ? // Projected, never forwarded. `context` here is the host's, and handing
          // it over whole would make every field on it public API by accident -
          // compiling today and arriving `undefined` on a host that has no such
          // field. What crosses the boundary is the four fields below and
          // nothing else, which is what `RouteLoadContext` and its two narrower
          // spellings describe.
          //
          // `auth` and `adminAccess` are copied across only when the host put
          // them there, so a route that declared neither `requires` nor the
          // `admin` area cannot observe one - and the type it is authored
          // against says the same.
          await route.load({
            t,
            context: {
              ...(context.adminAccess === undefined
                ? {}
                : { adminAccess: context.adminAccess }),
              ...(context.auth === undefined ? {} : { auth: context.auth }),
              locale: context.locale,
              queryClient: context.queryClient,
            },
            params,
            search,
          })
        : undefined,
      search,
    };
  };

/**
 * The screen a route shows when it - or its loader - answers `notFound()`.
 *
 * Lazy, and deliberately so: unlike the pending skeleton, which has to exist
 * before the module does, a not-found screen is only ever rendered after the
 * route has been matched. It can live in the module's own chunk and cost an
 * unvisited route nothing.
 *
 * Every route gets one, because whether a module declares `notFound` is not
 * knowable until the module has loaded and a route's options are fixed when the
 * route is built. A module that declares none falls through to the application's
 * own `defaultNotFoundComponent`, which is what the route would have reached had
 * it declared nothing at all - so the fallback is the default, not a blank page.
 */
const pluginRouteNotFound = (spec: PluginRouteSpec) =>
  lazyRouteComponent(async () => {
    const { route } = await spec.module();

    return {
      default:
        route.notFound ??
        function PluginRouteNotFoundFallback(props: NotFoundRouteProps) {
          const Default = useRouter().options.defaultNotFoundComponent;

          return Default ? <Default {...props} /> : null;
        },
    };
  });

const pluginRouteOptions = (
  spec: PluginRouteSpec,
  pageHead: PluginRoutePageHead,
) => {
  const beforeLoad = pluginRouteGuard(spec.route.requires);

  return {
    ...(beforeLoad ? { beforeLoad } : {}),

    ...(spec.validateSearch ? { validateSearch: spec.validateSearch } : {}),
    // Absent rather than `undefined`, so a route that declares none leaves the
    // router's own `defaultPendingComponent` in place instead of overriding it
    // with nothing.
    ...(spec.pendingComponent
      ? { pendingComponent: spec.pendingComponent }
      : {}),
    notFoundComponent: pluginRouteNotFound(spec),
    component: lazyRouteComponent(async () => ({
      default: (spec.route.kind === "layout"
        ? pluginLayoutComponent
        : pluginPageComponent)(await spec.module(), spec.namespaces),
    })),
    head: pluginRouteHead(spec, pageHead),
    loader: pluginRouteLoader(spec),

    loaderDeps: ({ search }: { search: unknown }) =>
      pluginRouteSearchDeps(search),
    path: spec.path,

    staticData: {
      breadcrumb: pluginRouteBreadcrumb(spec.module, spec.namespaces),
    },
  };
};

const specsByMountPoint = (
  areaRoutes: PluginRouteAreaRoutes,
  specs: readonly PluginRouteSpec[],
): Map<AnyRoute, PluginRouteSpec[]> => {
  const byMountPoint = new Map<AnyRoute, PluginRouteSpec[]>();

  for (const area of PLUGIN_ROUTE_AREAS) {
    const mountPoint = areaRoutes[area];

    if (mountPoint && !byMountPoint.has(mountPoint)) {
      byMountPoint.set(mountPoint, []);
    }
  }

  for (const spec of specs) {
    const mountPoint = areaRoutes[spec.route.area];

    if (!mountPoint) {
      throw new Error(
        `[VitNode plugin routes] Plugin route "${spec.route.id}" claims "${spec.route.path}" in the "${spec.route.area}" area, which this application has no mount point for. Name the route that renders the "${spec.route.area}" shell: withPluginRoutes(tree, specs, { mountUnder: { ${spec.route.area}: <that route> }, pageHead }). VitNode will not fall back to another shell - a page framed by the wrong one would render outside the guards and chrome its area is the whole statement about.`,
      );
    }

    // Read-modify-write rather than `get(...)?.push(...)`: the loop above has
    // already created a bucket for every named area, so the optional call could
    // only ever be a no-op - and a no-op here is a route that vanishes from the
    // tree without anybody being told.
    const mounted = byMountPoint.get(mountPoint) ?? [];

    mounted.push(spec);
    byMountPoint.set(mountPoint, mounted);
  }

  return byMountPoint;
};

const mountPluginSubtree = (
  mountPoint: AnyRoute,
  specs: readonly PluginRouteSpec[],
  pageHead: PluginRoutePageHead,
): void => {
  const mounted: AnyRoute[] = mountPoint.children ?? [];
  const siblings = mounted.filter(
    (child: AnyRoute) => declaredOptions(child).id !== PLUGIN_ROUTES_ROUTE_ID,
  );

  if (specs.length === 0) {
    if (siblings.length !== mounted.length) mountPoint.addChildren(siblings);

    return;
  }

  const container = createRoute({
    getParentRoute: () => mountPoint,
    id: PLUGIN_ROUTES_ROUTE_ID,
  });

  const routes = new Map<string, AnyRoute>();
  // Keyed by parent id, with `null` for the roots - a real `null` key rather
  // than the container's id, so nothing depends on a plugin route being unable
  // to be called `_plugins`.
  const children = new Map<null | string, AnyRoute[]>();

  for (const spec of specs) {
    const parent =
      spec.parentId === null ? container : routes.get(spec.parentId);

    if (!parent) {
      // Unreachable: the graph orders parents before children, and a child is
      // in its parent's area so it is in this group. Stated rather than asserted
      // away, because the alternative is a `!` that would hide a future ordering
      // change behind a null-pointer error at import time.
      throw new Error(
        `[VitNode plugin routes] Plugin route "${spec.route.id}" is nested inside "${spec.parentId}", which has not been built yet.`,
      );
    }

    const route: AnyRoute = createRoute({
      ...pluginRouteOptions(spec, pageHead),
      getParentRoute: () => parent,
    });

    routes.set(spec.route.id, route);
    children.set(spec.parentId, [
      ...(children.get(spec.parentId) ?? []),
      route,
    ]);
  }

  for (const [parentId, kids] of children) {
    if (parentId === null) continue;

    routes.get(parentId)?.addChildren(kids);
  }

  container.addChildren(children.get(null) ?? []);
  mountPoint.addChildren([...siblings, container]);
};

/**
 * Mounts every declared route - core's own and every configured plugin's - into
 * an application's route tree.
 *
 * One call, because there is one kind of route now. `@vitnode/core` reaches this
 * through the same registry a plugin does, so an application no longer composes
 * `withCoreRootRoutes(withCoreAdminRoutes(withCoreMainRoutes(…)))` around it
 * and can no longer get that nesting wrong.
 */
export const withVitNodeRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  specs: PluginRouteSpec[],
  { mountUnder, pageHead = defaultPageHead }: PluginRoutesMountOptions,
): TRouteTree => {
  // Stage 11's default, kept: an application that names no shell has its plugin
  // pages hang from the tree's root, which is what a host with no chrome wants.
  // It applies only when the option is absent entirely - a host that passes the
  // record has answered the question, and an area missing from its answer is
  // missing rather than defaulted somewhere else.
  const areaRoutes: PluginRouteAreaRoutes = mountUnder ?? {
    blank: routeTree,
    main: routeTree,
  };
  const byMountPoint = specsByMountPoint(areaRoutes, specs);

  // Once, over every spec and against the whole tree from its root - a plugin
  // route may not shadow a URL this app answers, whichever shell either of them
  // renders in.
  if (specs.length > 0) assertNoAppCollision(specs, fileRoutePaths(routeTree));

  for (const [mountPoint, mountedSpecs] of byMountPoint) {
    mountPluginSubtree(mountPoint, mountedSpecs, pageHead);
  }

  return routeTree;
};

/** @deprecated Renamed to {@link withVitNodeRoutes}; core's routes mount here too. */
export const withPluginRoutes = withVitNodeRoutes;
