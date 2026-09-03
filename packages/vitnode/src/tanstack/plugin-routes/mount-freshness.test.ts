import type { AnyRoute } from "@tanstack/react-router";

import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { PluginRouteDeclarationSource } from "@/routing";

import { definePluginRoutes, lazy, page } from "@/routing";

import type { PluginRoutePageHead } from "./mount";

import { PLUGIN_ROUTES_ROUTE_ID } from "./container";
import { withPluginRoutes } from "./mount";
import { pluginRouteSpecs } from "./specs";

const pageHead: PluginRoutePageHead = ({ title }) => ({
  meta: title ? [{ title }] : [],
});

/** One configured plugin with one page, as the generated file holds it. */
const plugin = (
  pluginId: string,
  path: string,
): PluginRouteDeclarationSource => ({
  pluginId,
  routes: definePluginRoutes([
    page(path, {
      component: lazy(
        async () => await Promise.resolve({ default: () => null }),
      ),
    }),
  ]),
});

/** One plugin's page, at `/example`. */
const EXAMPLE = plugin("example", "/example");

/** A second plugin's page, at `/reports`, so removal can be told from a reset. */
const REPORTS = plugin("reports", "/reports");

const specsFor = (...sources: PluginRouteDeclarationSource[]) =>
  pluginRouteSpecs(sources);

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
   * A path *edit* rather than a removal - the same plugin, a different URL. Both
   * halves have to hold, and only the removal half is easy to get wrong.
   */
  it("follows a route that moved, and drops the path it left", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };

    withPluginRoutes(root, specsFor(EXAMPLE), { mountUnder, pageHead });
    expect(owns(root, "/example")).toBe(true);

    withPluginRoutes(root, specsFor(plugin("example", "/showcase")), {
      mountUnder,
      pageHead,
    });

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

  it("clears one shell's plugin subtree without touching the other's", () => {
    const { admin, main, root } = appTree();
    const mountUnder = { admin, main };
    const ADMIN_PAGE: PluginRouteDeclarationSource = {
      pluginId: "admin",
      routes: definePluginRoutes([
        page("/admin/reports", {
          area: "admin",
          component: lazy(
            async () => await Promise.resolve({ default: () => null }),
          ),
        }),
      ]),
    };

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
