import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";

import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

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
import { pluginRouteSearchDeps } from "./specs";

export interface PluginRouteRuntimeContext {
  locale: string;
  queryClient: QueryClient;
}

export type PluginRoutePageHead = (
  options: RouteHeadOptions,
) => RouteHeadResult;

export type PluginRouteAreaRoutes = Partial<Record<PluginRouteArea, AnyRoute>>;

export interface PluginRoutesMountOptions {
  mountUnder?: PluginRouteAreaRoutes;
  pageHead: PluginRoutePageHead;
}

const pluginRouteHead =
  (module: PluginRouteModuleRef, pageHead: PluginRoutePageHead) =>
  async ({
    loaderData,
    params,
  }: {
    loaderData?: unknown;
    params: Readonly<Record<string, string>>;
  }): Promise<Partial<RouteHeadResult>> => {
    const { route } = await module();

    if (!route.head) return {};

    const envelope = (loaderData ?? {}) as Partial<PluginRouteLoaderData>;

    return pageHead(
      normalizePluginRouteHead(
        route.head({
          loaderData: envelope.data,
          params,
          search: envelope.search ?? {},
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
        : context.queryClient.ensureQueryData(
            intlQueryOptions({
              locale: context.locale,
              namespaces: spec.namespaces,
            }),
          ),
    ]);

    const search = spec.validateSearch
      ? deps
      : route.parseSearch
        ? route.parseSearch(deps)
        : {};

    return {
      data: route.load
        ? // Projected, never forwarded. `context` here is the host's - it holds
          // this app's `QueryClient` - and handing it over whole would make
          // every field on it public plugin API by accident, compiling today and
          // arriving `undefined` on a host that has no such field. What crosses
          // the boundary is `PluginRouteContext` and only that.
          await route.load({
            context: { locale: context.locale },
            params,
            search,
          })
        : undefined,
      search,
    };
  };

const pluginRouteOptions = (
  spec: PluginRouteSpec,
  pageHead: PluginRoutePageHead,
) => {
  const beforeLoad = pluginRouteGuard(spec.route.requires);

  return {
    ...(beforeLoad ? { beforeLoad } : {}),

    ...(spec.validateSearch ? { validateSearch: spec.validateSearch } : {}),
    component: lazyRouteComponent(async () => ({
      default: (spec.route.kind === "layout"
        ? pluginLayoutComponent
        : pluginPageComponent)(await spec.module(), spec.namespaces),
    })),
    head: pluginRouteHead(spec.module, pageHead),
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

export const withPluginRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  specs: PluginRouteSpec[],
  { mountUnder, pageHead }: PluginRoutesMountOptions,
): TRouteTree => {
  // Stage 11's default, kept: an application that names no shell has its plugin
  // pages hang from the tree's root, which is what a host with no chrome wants.
  // It applies only when the option is absent entirely - a host that passes the
  // record has answered the question, and an area missing from its answer is
  // missing rather than defaulted somewhere else.
  const areaRoutes: PluginRouteAreaRoutes = mountUnder ?? { main: routeTree };
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
