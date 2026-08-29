import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";

import { createRoute, lazyRouteComponent } from "@tanstack/react-router";

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

/** The narrowest slice of a host's route context a plugin route reads. */
export interface PluginRouteContext {
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

export interface PluginRoutesMountOptions {
  /**
   * Which route the plugin subtree hangs from, defaulting to the tree's root.
   *
   * The only reason it is a parameter is the application shell. Every plugin
   * route declares `area: "main"` (see `@vitnode/core/routing`), which is a
   * statement about *layout*: this page belongs on the public site, with the
   * header and the breadcrumb area a page of the site has. In a router, a layout
   * is a parent - so honouring that declaration is choosing a parent, and a host
   * passes its `_main` route.
   *
   * Nothing about the path changes: `_main` is pathless, so `/example` stays
   * `/example`. And the collision check still walks the whole tree from its
   * root, because what a plugin route may not shadow is *any* URL the app
   * answers, wherever in the tree it was declared.
   */
  mountUnder?: AnyRoute;
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
 * ## Why the search contract is applied here
 *
 * A route's `validateSearch` normally runs during path matching, which is
 * *before* any chunk is fetched - that is why TanStack's own lazy route files
 * may not contain one, and it is why a plugin route registers none. Applying it
 * here is what keeps both promises: the page's code is still split, and nothing
 * downstream of the module ever sees a raw query parameter. `load` is handed the
 * validated value, and so - through the envelope this returns - is `head`.
 *
 * The consequence, stated plainly: a plugin route's `search` is a *loader*
 * contract, not a URL contract. Links the router builds to a plugin route carry
 * whatever they were given.
 *
 * The query string reaches a loader as `deps`, never as `search` - a router
 * loader is not handed the search directly, which is what `loaderDeps` is for.
 * That works in this runtime's favour: `deps` is the normalised query string,
 * so the value the search contract is applied to is by construction the same
 * value the loader re-runs for.
 */
const pluginRouteLoader =
  (spec: PluginRouteSpec) =>
  async ({
    context,
    deps,
    params,
  }: {
    context: PluginRouteContext;
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

    const validated = route.validateSearch ? route.validateSearch(deps) : {};

    return {
      data: route.load
        ? await route.load({ context, params, search: validated })
        : undefined,
      search: validated,
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
     * `validateSearch`, the runtime cannot know before the chunk loads whether
     * this route has a search contract at all, so it assumes one. A route whose
     * module declares `validateSearch` therefore re-runs `load` whenever the
     * search changes, which is the contract; a route that declares none pays for
     * it with a re-run on a query parameter it does not read.
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
 * Mounts the plugin routes on a route tree, and hands the same tree back.
 *
 * One pass, parents before children, which is what `buildPluginRouteGraph`'s
 * node order buys: by the time a nested route is reached, the layout it hangs
 * from exists. Nothing here re-derives a parent - the compiled graph is the only
 * answer, and it is the same function that validated the hierarchy when the app
 * was built, so the runtime cannot disagree with the build about what the tree
 * is.
 *
 * ## Idempotent
 *
 * `addChildren` **replaces** a route's children and mutates the route in place,
 * so the plugin subtree is rebuilt from the mount point's current children with
 * any previous copy of itself removed. Calling this twice on one tree is
 * therefore the same as calling it once, which is what makes it safe in a dev
 * server that re-evaluates this module while `routeTree.gen.ts` stays cached.
 *
 * Removing the *last* plugin is the same property read the other way, and it is
 * the one case an early `return` used to skip: the tree handed back is the one
 * a previous pass already mutated, so a subtree nobody declares any more has to
 * be taken off it rather than merely not re-added. A tree that never had one is
 * still left exactly as it arrived - `addChildren` is not called at all, so a
 * route with no children does not acquire an empty array.
 */
export const withPluginRoutes = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  specs: PluginRouteSpec[],
  { mountUnder = routeTree, pageHead }: PluginRoutesMountOptions,
): TRouteTree => {
  const mounted: AnyRoute[] = mountUnder.children ?? [];
  const siblings = mounted.filter(
    (child: AnyRoute) => declaredOptions(child).id !== PLUGIN_ROUTES_ROUTE_ID,
  );

  if (specs.length === 0) {
    if (siblings.length !== mounted.length) mountUnder.addChildren(siblings);

    return routeTree;
  }

  assertNoAppCollision(specs, fileRoutePaths(routeTree));

  const container = createRoute({
    getParentRoute: () => mountUnder,
    id: PLUGIN_ROUTES_ROUTE_ID,
  });

  const byId = new Map(specs.map(spec => [spec.route.id, spec]));
  const routes = new Map<string, AnyRoute>();
  // Keyed by parent id, with `null` for the roots - a real `null` key rather
  // than the container's id, so nothing depends on a plugin route being unable
  // to be called `_plugins`.
  const children = new Map<null | string, AnyRoute[]>();

  for (const spec of specs) {
    const parent =
      spec.parentId === null ? container : routes.get(spec.parentId);

    if (!parent) {
      // Unreachable: the graph orders parents before children. Stated rather
      // than asserted away, because the alternative is a `!` that would hide a
      // future ordering change behind a null-pointer error at import time.
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
  mountUnder.addChildren([...siblings, container]);

  return routeTree;
};
