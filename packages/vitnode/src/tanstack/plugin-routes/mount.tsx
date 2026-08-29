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
  PluginRouteBreadcrumb,
} from "./components";
import { PLUGIN_ROUTES_ROUTE_ID } from "./container";
import { pluginRouteGuard } from "./guard";
import { normalizePluginRouteHead } from "./head";
import { pluginRouteSearchDeps } from "./specs";

/**
 * Plugin pages, in a TanStack Start application's route tree.
 *
 * Three inputs, and the whole point of the design is that each one answers
 * exactly one question:
 *
 *     plugin-route-manifest.gen.ts   what routes exist, where, in which shape
 *     plugin-routes.gen.ts           how each route's module is imported
 *     this module                    how that becomes a TanStack route
 *
 * The first two are generated *per application*, because only an installation
 * knows which plugins it has and a bundler needs a literal `import()` per module
 * to follow. This one is the composition, which is identical everywhere, so it
 * lives here rather than once per host.
 *
 * Neither generated file mentions a router, and no plugin page is copied into
 * the host's `src/routes` - the component stays compiled in the plugin's own
 * `dist` and arrives here as a lazy import the bundler resolved at build time.
 *
 * What is deliberately *not* here: a locale. `/example` and `/pl/example` are the
 * same route, because the router's rewrite strips the prefix before matching and
 * writes it back into every link (`@vitnode/core/tanstack/i18n`'s
 * `createLocaleRewrite`). A plugin declares the logical path and the locale layer
 * owns the public one, so there is nothing to prefix and no route to duplicate
 * per language.
 */

/**
 * What this runtime has on hand when a plugin route loads - the *host's*
 * context, not the plugin's.
 *
 * Named apart from `@vitnode/core/routing`'s `PluginRouteContext` on purpose:
 * that one is the public promise, this one is whatever the TanStack host
 * happens to hold. The two must not converge. A plugin's `load` is handed a
 * projection of this - see `pluginRouteLoader` - so a `QueryClient` living here
 * never becomes something a plugin may compile against.
 */
export interface PluginRouteRuntimeContext {
  locale: string;
  queryClient: QueryClient;
}

/**
 * The host's `head` rule, bound to its own name - `createRouteHead(metadata)`.
 *
 * Required rather than optional, and that is the point: a plugin's `<title>`
 * goes through the same `"<page> - <site>"` rule every VitNode page's does. A
 * package cannot know the site's name, and a plugin route that built its own
 * title would produce one that disagreed with every other page of the same site.
 */
export type PluginRoutePageHead = (
  options: RouteHeadOptions,
) => RouteHeadResult;

/**
 * Which route each area's plugin subtree hangs from.
 *
 * A finite record rather than an open registry, and that is a contract rather
 * than a limitation: the areas are `@vitnode/core/routing`'s
 * {@link PluginRouteArea}, a host may name a parent for each one, and a route
 * declaring an area this host has not named is a hard failure instead of a page
 * quietly rendered in the wrong shell.
 *
 * Partial because an application need not have every shell - a headless app has
 * no AdminCP - and because "not configured" and "configured wrongly" have to be
 * different states. The first is only an error once a plugin actually declares
 * that area; the second cannot happen, because there is nowhere to put a name
 * that is not an area.
 */
export type PluginRouteAreaRoutes = Partial<Record<PluginRouteArea, AnyRoute>>;

export interface PluginRoutesMountOptions {
  /**
   * Which route each area's plugin subtree hangs from.
   *
   * The whole of what an `area` declaration amounts to at runtime. A plugin says
   * `area: "main"` or `area: "admin"` (see `@vitnode/core/routing`), which is a
   * statement about *layout*: this page belongs on the public site with the site
   * header, or inside the AdminCP with the sidebar and the admin session guard.
   * In a router a layout is a parent, so honouring that declaration is choosing
   * a parent - and this is where a host names them:
   *
   *     { mountUnder: { admin: adminShellRoute, main: mainShellRoute }, pageHead }
   *
   * Nothing about a path changes. Both shells are pathless routes, so `/example`
   * stays `/example` and `/admin/reports` stays `/admin/reports` - the area
   * chose the frame, and the manifest still says the URL in full.
   *
   * **An area with no entry here is refused**, naming the route that declared
   * it. That is the one behaviour this field exists for: silently falling back
   * to another shell would mount an AdminCP page on the public site, outside the
   * admin session guard, and it would look like it worked.
   *
   * Omitted entirely, the plugin subtree hangs from the tree's root as `main` -
   * which is what an app with no shell wants, and what Stage 11 did. Pass the
   * record and it is the whole answer: an area missing from it is missing.
   *
   * The collision check still walks the whole tree from its root, because what a
   * plugin route may not shadow is *any* URL the app answers, in any shell.
   */
  mountUnder?: PluginRouteAreaRoutes;
  pageHead: PluginRoutePageHead;
}

/**
 * A plugin route's `head`.
 *
 * Async, which the router supports - it awaits `head` while projecting a
 * match - and which is what lets the metadata come out of the lazily imported
 * module without the module being in the initial bundle. By the time this runs
 * the chunk is in hand anyway: the router awaited it to render the match.
 *
 * `loaderData` is optional on a route's first pass, before the loader has
 * resolved, so both halves of the envelope are read defensively and the plugin's
 * own `head` gets `undefined` for its data - which is exactly the contract it is
 * written against.
 *
 * The result goes through `normalizePluginRouteHead` and then the host's own
 * `pageHead`, so a plugin cannot put an arbitrary element in the host's
 * document: three fields survive, and the title is formatted by the same rule
 * every VitNode page's is.
 */
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

/**
 * A plugin route's loader: its strings, its module, its search and its data.
 *
 * The messages and the chunk are fetched **in parallel**, which is the reason
 * namespaces are declared in the manifest rather than in the module: a list that
 * lived inside the code could only be read after downloading the page it
 * describes, making two requests into a waterfall.
 *
 * ## Why `parseSearch` is applied here
 *
 * A route's `validateSearch` runs during path matching, which is *before* any
 * chunk is fetched - that is why TanStack's own lazy route files may not contain
 * one, and it is why a plugin route registers none. A plugin's module is lazy,
 * so there is nothing to ask at matching time. Applying `parseSearch` in the
 * loader is what keeps both promises: the page's code is still split, and
 * nothing downstream of the module ever sees a raw query parameter. `load` is
 * handed the parsed value, and so - through the envelope this returns - is
 * `head`.
 *
 * The consequence, and the reason the option is not called `validateSearch`: a
 * plugin route's `search` is a *loader* contract, not a URL one. The router's own
 * search type for the route is untouched, links it builds to a plugin route
 * carry whatever they were given, and no URL is ever rejected.
 *
 * The query string reaches a loader as `deps`, never as `search` - a router
 * loader is not handed the search directly, which is what `loaderDeps` is for.
 * That works in this runtime's favour: `deps` is the normalised query string,
 * so the value `parseSearch` is applied to is by construction the same value the
 * loader re-runs for.
 */
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

    const search = route.parseSearch ? route.parseSearch(deps) : {};

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

/**
 * One plugin route's TanStack options.
 *
 * Everything a plugin can contribute passes through here, and every one of them
 * is reached through the same memoised module ref - so a route's component, its
 * loader, its metadata and its breadcrumb are four readers of one import rather
 * than four imports.
 *
 * `lazyRouteComponent` over that ref is the supported way to code-split a
 * code-based route: the plugin's page gets its own Rollup chunk, stays out of
 * the initial bundle, and the router awaits `component.preload()` before it
 * renders the match - so SSR and hydration both have the module in hand rather
 * than suspending on it. A module that does not satisfy the contract fails
 * inside `readPluginRouteModule`, with the plugin route's id in the message,
 * rather than as React's "type is invalid" three frames away.
 */
const pluginRouteOptions = (
  spec: PluginRouteSpec,
  byId: ReadonlyMap<string, PluginRouteSpec>,
  pageHead: PluginRoutePageHead,
) => {
  const beforeLoad = pluginRouteGuard(spec.route.requires);

  return {
    ...(beforeLoad ? { beforeLoad } : {}),
    component: lazyRouteComponent(async () => ({
      default: (spec.route.kind === "layout"
        ? pluginLayoutComponent
        : pluginPageComponent)(await spec.module(), spec.namespaces),
    })),
    head: pluginRouteHead(spec.module, pageHead),
    loader: pluginRouteLoader(spec),
    /**
     * What the loader re-runs for.
     *
     * The query string, normalised - because a plugin route registers no
     * `validateSearch` of the router's own, the runtime cannot know before the
     * chunk loads whether this route reads the query string at all, so it
     * assumes it does. A route whose module declares `parseSearch` therefore
     * re-runs `load` whenever the query string changes, which is the contract; a
     * route that declares none pays for it with a re-run on a query parameter it
     * does not read.
     */
    loaderDeps: ({ search }: { search: unknown }) =>
      pluginRouteSearchDeps(search),
    path: spec.path,
    /**
     * The crumb, as the chain of routes that could own it.
     *
     * Resolved to the specs themselves rather than left as ids, so the component
     * has both halves it needs of each candidate - the module that may declare a
     * crumb, and the namespaces that crumb translates through.
     */
    staticData: {
      breadcrumb: (
        <PluginRouteBreadcrumb
          crumbs={spec.breadcrumbChain.flatMap(id => {
            const candidate = byId.get(id);

            return candidate
              ? [
                  {
                    module: candidate.module,
                    namespaces: candidate.namespaces,
                  },
                ]
              : [];
          })}
        />
      ),
    },
  };
};

/**
 * Every mount point this composition touches, with the specs that belong to it.
 *
 * Two jobs, and the second is the reason it is one function. It **groups** the
 * specs by the route their area names - and it **refuses** a route whose area
 * this host has not named, which is the failure `PluginRoutesMountOptions`
 * exists to produce. A fallback would mount an AdminCP page under the public
 * shell: outside the admin session guard, wearing the site header, and looking
 * for all the world like it worked.
 *
 * Every configured mount point is in the result even when nothing mounts under
 * it, because that is what takes a stale plugin subtree off a shell whose last
 * plugin route was removed. See the idempotence note on {@link withPluginRoutes}.
 *
 * Keyed by the route *object*, so two areas a host points at one route share one
 * container rather than adding two children with the same id. Iterated in
 * `PLUGIN_ROUTE_AREAS` order, so the tree is the same whichever order the record
 * happened to be written in; within a mount point the specs keep the graph's own
 * order, which is parents before children.
 */
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

/**
 * One mount point's plugin subtree, built and hung from it.
 *
 * One pass, parents before children, which is what `buildPluginRouteGraph`'s
 * node order buys: by the time a nested route is reached, the layout it hangs
 * from exists. Nothing here re-derives a parent - the compiled graph is the only
 * answer, and it is the same function that validated the hierarchy when the app
 * was built, so the runtime cannot disagree with the build about what the tree
 * is.
 *
 * A parent is always in this same group: `buildPluginRouteGraph` refuses a route
 * whose area differs from its layout's, so a subtree cannot span two shells and
 * `routes` never has to look outside the specs it was handed.
 */
const mountPluginSubtree = (
  mountPoint: AnyRoute,
  specs: readonly PluginRouteSpec[],
  byId: ReadonlyMap<string, PluginRouteSpec>,
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
      ...pluginRouteOptions(spec, byId, pageHead),
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
 * Mounts the plugin routes on a route tree, and hands the same tree back.
 *
 * One subtree per shell: the specs are grouped by the area they declare, each
 * group is hung from the route its host named for that area, and a route whose
 * area was not named fails the composition rather than being mounted somewhere
 * plausible. See {@link PluginRoutesMountOptions.mountUnder}.
 *
 * ## Idempotent
 *
 * `addChildren` **replaces** a route's children and mutates the route in place,
 * so each plugin subtree is rebuilt from its mount point's current children with
 * any previous copy of itself removed. Calling this twice on one tree is
 * therefore the same as calling it once, which is what makes it safe in a dev
 * server that re-evaluates this module while `routeTree.gen.ts` stays cached.
 *
 * Removing the *last* plugin is the same property read the other way, and it is
 * the one case an early `return` used to skip: the tree handed back is the one a
 * previous pass already mutated, so a subtree nobody declares any more has to be
 * taken off it rather than merely not re-added. That now holds per shell - the
 * last admin plugin route going away has to clear the AdminCP's container while
 * the public one keeps its own - which is why every configured mount point is
 * visited even when nothing mounts under it. A tree that never had a container
 * is still left exactly as it arrived: `addChildren` is not called at all, so a
 * route with no children does not acquire an empty array.
 */
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

  const byId = new Map(specs.map(spec => [spec.route.id, spec]));

  for (const [mountPoint, mountedSpecs] of byMountPoint) {
    mountPluginSubtree(mountPoint, mountedSpecs, byId, pageHead);
  }

  return routeTree;
};
