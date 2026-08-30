import type { AnyRoute } from "@tanstack/react-router";

import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { PluginRouteModuleRegistry } from "@/framework/plugin-routes";
import type { PluginRoute } from "@/routing";

import type { PluginRoutePageHead } from "./mount";

import { PLUGIN_ROUTES_ROUTE_ID } from "./container";
import { withPluginRoutes } from "./mount";
import { pluginRouteSpecs } from "./specs";

/**
 * What happens to a route tree when a plugin is enabled, disabled and enabled
 * again while the process keeps running.
 *
 * This is the dev-server question, and it is not the same one `./mount` answers
 * for a cold start. A generated file changing invalidates the module that reads
 * it, so the composition runs again - but the route tree it runs against is the
 * one a *previous* pass already mutated, because `routeTree.gen.ts` is a module
 * singleton and `addChildren` writes into it in place. So "mount the new routes"
 * is only half the job: the old ones have to stop existing, and they have to
 * stop existing on the tree that is already there rather than on a fresh one.
 *
 * The symptom when they do not is route *ownership*, not a broken page. VitNode
 * asks the live route tree whether it serves a path - `isTanStackOwnedPath`,
 * which is `matchRoutes` and nothing else - and every link, redirect and guard
 * decides from that answer. A subtree nobody declares any more still matches, so
 * a URL that has gone back to the other application keeps being claimed by this
 * one: the click is handled client-side and lands on a not-found instead of the
 * page that is actually serving it.
 *
 * `matchRoutes` is used directly here for the same reason the app's own seam
 * uses it: the route tree is the only table, and a test that consulted a list of
 * expected paths would be asserting against its own copy of the answer.
 */

const route = (overrides: Partial<PluginRoute> = {}): PluginRoute => ({
  area: "main",
  entry: "routes/page",
  id: "plugin:page",
  kind: "page",
  namespaces: [],
  parentId: null,
  path: "/page",
  pluginId: "plugin",
  requires: null,
  routeId: "page",
  segments: [{ kind: "static", value: "page" }],
  ...overrides,
});

const registryOf = (...keys: string[]): PluginRouteModuleRegistry =>
  Object.fromEntries(
    keys.map(key => [
      key,
      async () => Promise.resolve({ default: () => null }),
    ]),
  );

const pageHead: PluginRoutePageHead = ({ title }) => ({
  meta: title ? [{ title }] : [],
});

/** One plugin's page, at `/example`. */
const EXAMPLE = route({
  entry: "routes/example",
  id: "example:page",
  path: "/example",
  pluginId: "example",
  routeId: "page",
  segments: [{ kind: "static", value: "example" }],
});

/** A second plugin's page, at `/reports`, so removal can be told from a reset. */
const REPORTS = route({
  entry: "routes/reports",
  id: "reports:page",
  path: "/reports",
  pluginId: "reports",
  routeId: "page",
  segments: [{ kind: "static", value: "reports" }],
});

/**
 * The two generated files for a given configuration, as one call.
 *
 * The registry is derived from the same route list rather than being a fixed
 * superset, because that is the invariant the real build has: both generated
 * files are written from one pass over one configured plugin list, so a disabled
 * plugin loses its manifest entry and its module import together.
 * `pluginRouteSpecs` refuses anything else, which is how this was found.
 */
const specsFor = (...routes: PluginRoute[]) =>
  pluginRouteSpecs(routes, registryOf(...routes.map(entry => entry.id)));

/**
 * The app's own tree, built once - which is the point. Every mount below
 * mutates *this* object, exactly as a dev server's repeated composition mutates
 * the one `routeTree.gen.ts` exports.
 */
const appTree = (): { admin: AnyRoute; main: AnyRoute; root: AnyRoute } => {
  const root = createRootRoute();
  const main = createRoute({ getParentRoute: () => root, id: "_main" });
  const admin = createRoute({ getParentRoute: () => root, id: "_admin" });

  main.addChildren([createRoute({ getParentRoute: () => main, path: "/" })]);
  admin.addChildren([
    createRoute({ getParentRoute: () => admin, path: "/admin" }),
  ]);
  root.addChildren([main, admin]);

  // Widened at the boundary rather than at every use. `createRoute` types
  // `children` as the tuple it was built with, and every assertion below reads
  // the tree *after* the composition has mutated it - which is a different
  // shape, and the one this file is about.
  return { admin, main, root };
};

/**
 * The ownership question, as the application asks it: does the deepest match
 * consume the whole path?
 *
 * A copy of `isTanStackOwnedPath`'s rule minus the locale and origin handling,
 * which are the host's and are tested there. "Something matched" is not enough:
 * `matchRoutes` answers with the deepest *ancestor* it can resolve, so a removed
 * `/example` still comes back as a match on the root.
 */
const owns = (tree: AnyRoute, pathname: string): boolean => {
  // A router per question, built from the tree as it stands right now - which is
  // the state the dev server is in after a composition: a new router graph over
  // the mutated singleton. Asking a router held from before the change would be
  // testing the wrong thing.
  const matches = createRouter({ routeTree: tree }).matchRoutes(
    pathname,
    undefined,
  ) as { pathname: string; routeId: string }[];
  const deepest = matches.at(-1);

  if (!deepest || deepest.routeId === "__root__") return false;

  return deepest.pathname.replace(/(.)\/+$/, "$1") === pathname;
};

/** A route's children as the composition leaves them, whatever it was built with. */
const childrenOf = (route: AnyRoute): AnyRoute[] =>
  (route.children ?? []) as AnyRoute[];

const containerOf = (mountPoint: AnyRoute): AnyRoute | undefined =>
  childrenOf(mountPoint).find(
    (child: AnyRoute) =>
      (child.options as { id?: string }).id === PLUGIN_ROUTES_ROUTE_ID,
  );

const pluginPaths = (mountPoint: AnyRoute): string[] => {
  const container = containerOf(mountPoint);

  return (container ? childrenOf(container) : [])
    .map(child => (child.options as { path?: string }).path ?? "")
    .sort();
};

describe("enabling, disabling and re-enabling a plugin on a live route tree", () => {
  it("claims the plugin's path once it is mounted", () => {
    const { admin, main, root } = appTree();

    expect(owns(root, "/example")).toBe(false);

    withPluginRoutes(root, specsFor(EXAMPLE), {
      mountUnder: { admin, main },
      pageHead,
    });

    expect(owns(root, "/example")).toBe(true);
  });

  /**
   * The one this whole module is for. The second composition runs against the
   * tree the first one mutated, and the route it no longer declares has to be
   * gone from that tree - not merely absent from the specs.
   */
  it("stops claiming a path once the plugin declaring it is disabled", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };

    withPluginRoutes(root, specsFor(EXAMPLE, REPORTS), {
      mountUnder,
      pageHead,
    });
    expect(owns(root, "/example")).toBe(true);
    expect(owns(root, "/reports")).toBe(true);

    // `example` removed from the app's configuration; `reports` still there.
    withPluginRoutes(root, specsFor(REPORTS), { mountUnder, pageHead });

    expect(owns(root, "/example")).toBe(false);
    expect(owns(root, "/reports")).toBe(true);
  });

  it("claims it again when the plugin comes back", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };

    withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });
    withPluginRoutes(root, specsFor(), { mountUnder, pageHead });
    expect(owns(root, "/example")).toBe(false);

    withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });
    expect(owns(root, "/example")).toBe(true);
  });

  /**
   * A path *edit* rather than a removal - the same route id, moved. Both halves
   * have to hold, and only the removal half is easy to get wrong.
   */
  it("follows a route that moved, and drops the path it left", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };

    withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });
    expect(owns(root, "/example")).toBe(true);

    withPluginRoutes(
      root,
      specsFor({
        ...EXAMPLE,
        path: "/showcase",
        segments: [{ kind: "static", value: "showcase" }],
      }),
      { mountUnder, pageHead },
    );

    expect(owns(root, "/example")).toBe(false);
    expect(owns(root, "/showcase")).toBe(true);
  });
});

describe("no orphan routes are left on the tree", () => {
  it("leaves exactly one plugin container, however many times it runs", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };

    for (let pass = 0; pass < 4; pass++) {
      withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });
    }

    const containers = childrenOf(main).filter(
      child => (child.options as { id?: string }).id === PLUGIN_ROUTES_ROUTE_ID,
    );

    expect(containers).toHaveLength(1);
    expect(pluginPaths(main)).toEqual(["/example"]);
  });

  it("keeps the application's own routes across every pass", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };

    const ownPaths = () =>
      childrenOf(main)
        .filter(
          child =>
            (child.options as { id?: string }).id !== PLUGIN_ROUTES_ROUTE_ID,
        )
        .map(child => (child.options as { path?: string }).path);

    withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });
    expect(ownPaths()).toEqual(["/"]);

    withPluginRoutes(root, specsFor(), { mountUnder, pageHead });
    expect(ownPaths()).toEqual(["/"]);
    expect(owns(root, "/")).toBe(true);
  });

  /**
   * Per shell, not globally. The last admin plugin route going away has to clear
   * the AdminCP's container while the public one keeps its own - a single shared
   * "did anything mount" flag gets this wrong in the direction that leaves an
   * admin URL claimed by a plugin that is gone.
   */
  it("clears one shell's plugin subtree without touching the other's", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };
    const ADMIN_PAGE = route({
      area: "admin",
      entry: "routes/admin",
      id: "admin:page",
      path: "/admin/reports",
      pluginId: "admin",
      routeId: "page",
      segments: [
        { kind: "static", value: "admin" },
        { kind: "static", value: "reports" },
      ],
    });

    withPluginRoutes(root, specsFor(EXAMPLE, ADMIN_PAGE), {
      mountUnder,
      pageHead,
    });
    expect(owns(root, "/example")).toBe(true);
    expect(owns(root, "/admin/reports")).toBe(true);

    // Only the admin plugin is disabled.
    withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });

    expect(owns(root, "/admin/reports")).toBe(false);
    expect(owns(root, "/example")).toBe(true);
    expect(pluginPaths(admin)).toEqual([]);
    expect(pluginPaths(main)).toEqual(["/example"]);
  });

  it("leaves a shell that never had a plugin route exactly as it was", () => {
    const { admin, main, root } = appTree();
    const before = childrenOf(admin).length;

    withPluginRoutes(root, specsFor(EXAMPLE), {
      mountUnder: { admin, main },
      pageHead,
    });

    expect(childrenOf(admin).length).toBe(before);
    expect(containerOf(admin)).toBeUndefined();
  });
});
