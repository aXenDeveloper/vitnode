import type { AnyRoute } from "@tanstack/react-router";

import { createRootRoute, createRoute } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { PluginRouteModuleRegistry } from "@/framework/plugin-routes";
import type { PluginRoute } from "@/routing";

import {
  assertPluginRouteModule,
  fileRoutePaths,
  PLUGIN_ROUTES_ROUTE_ID,
  pluginRouteSpecs,
  withPluginRoutes,
} from ".";

/**
 * Plugin routes, from a plugin's declaration to a mounted TanStack route.
 *
 * Everything here is route *data*: what a manifest and a registry say, what the
 * composition builds out of them, and what the resulting route tree claims to
 * own. Nothing renders - whether a plugin's page produces the right HTML is the
 * plugin's own business, and a component test would only assert that
 * `lazyRouteComponent` works.
 *
 * The other half of this coverage is the host's: an application asserts that its
 * *own* generated files reach its *own* router, which is a question about that
 * application and not about this composition. See
 * `apps/web/src/tests/plugin-routes.test.ts`.
 */

const route = (overrides: Partial<PluginRoute> = {}): PluginRoute => ({
  area: "main",
  entry: "routes/page",
  id: "plugin:page",
  path: "/page",
  pluginId: "plugin",
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

describe("pluginRouteSpecs", () => {
  it("pairs each route with its module and converts the path for TanStack", () => {
    const specs = pluginRouteSpecs(
      [
        route({
          id: "plugin:article",
          path: "/blog/:slug",
          routeId: "article",
          segments: [
            { kind: "static", value: "blog" },
            { kind: "param", name: "slug" },
          ],
        }),
      ],
      registryOf("plugin:article"),
    );

    expect(specs).toHaveLength(1);
    // `:slug` in the manifest, `$slug` in the router. Neither spelling is the
    // other's, which is the reason the conversion is a function and not a regex
    // written twice.
    expect(specs[0].path).toBe("/blog/$slug");
    expect(specs[0].route.path).toBe("/blog/:slug");
  });

  it("leaves an app with no plugin routes with nothing to register", () => {
    expect(pluginRouteSpecs([], {})).toEqual([]);
  });

  it("rejects a manifest route the registry has no module for", () => {
    expect(() => pluginRouteSpecs([route()], {})).toThrow(/plugin:page/);
  });

  it("rejects a registry module no manifest route claims", () => {
    expect(() => pluginRouteSpecs([], registryOf("plugin:page"))).toThrow(
      /plugin:page/,
    );
  });
});

describe("assertPluginRouteModule", () => {
  it("accepts a module with a component as its default export", () => {
    const module = { default: () => null };

    expect(assertPluginRouteModule(module, "plugin:page")).toBe(module);
  });

  it.each([
    ["no default export", {}],
    ["a default export that is not a component", { default: "page" }],
    ["nothing at all", null],
  ])("rejects a module with %s", (_label, module) => {
    expect(() => assertPluginRouteModule(module, "plugin:page")).toThrow(
      /plugin:page/,
    );
  });
});

describe("withPluginRoutes", () => {
  const appTree = () => {
    const root = createRootRoute();

    return root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/" }),
      createRoute({ getParentRoute: () => root, path: "/discover" }),
    ]);
  };

  const pluginChildren = (tree: ReturnType<typeof appTree>) =>
    (tree.children ?? [])
      .filter(
        child =>
          (child.options as { id?: string }).id === PLUGIN_ROUTES_ROUTE_ID,
      )
      .flatMap(container => container.children ?? [])
      .map(child => (child.options as { path?: string }).path);

  it("mounts one route per plugin route, under the plugin container", () => {
    const tree = withPluginRoutes(
      appTree(),
      pluginRouteSpecs(
        [route({ path: "/example" })],
        registryOf("plugin:page"),
      ),
    );

    expect(pluginChildren(tree)).toEqual(["/page"]);
    expect(fileRoutePaths(tree)).toEqual(["/", "/discover"]);
  });

  it("leaves the app route tree alone when no plugin declares a route", () => {
    const tree = withPluginRoutes(appTree(), []);

    expect(pluginChildren(tree)).toEqual([]);
    expect(tree.children).toHaveLength(2);
  });

  /**
   * The property that keeps a dev server honest. Vite re-evaluates the module
   * that composes the tree without re-evaluating `routeTree.gen.ts`, so the
   * composition runs more than once against the same root route object - and
   * `addChildren` replaces rather than appends only because the plugin subtree is
   * one identifiable child.
   */
  it("replaces the plugin subtree rather than appending a second copy", () => {
    const tree = appTree();
    const specs = pluginRouteSpecs([route()], registryOf("plugin:page"));

    withPluginRoutes(tree, specs);
    withPluginRoutes(tree, specs);

    expect(pluginChildren(tree)).toEqual(["/page"]);
    expect(tree.children).toHaveLength(3);
  });

  /**
   * The manifest layer rejects two plugins claiming one URL and cannot see this
   * case - it does not know which application it is being built for.
   */
  it("refuses a plugin route that would shadow one of the app’s own pages", () => {
    expect(() =>
      withPluginRoutes(
        appTree(),
        pluginRouteSpecs(
          [
            route({
              path: "/discover",
              segments: [{ kind: "static", value: "discover" }],
            }),
          ],
          registryOf("plugin:page"),
        ),
      ),
    ).toThrow(/discover/);
  });
});

/**
 * Plugin-vs-application collisions, compared by the URLs a route matches rather
 * than by the text of its path.
 *
 * The two sides are written in different syntaxes and name their parameters
 * independently, so `/users/$id` and `/users/:userId` are the same route spelled
 * two ways - and a string comparison sees two different strings.
 */
describe("plugin ↔ application collisions", () => {
  const treeWith = (...paths: string[]) => {
    const root = createRootRoute();

    return root.addChildren(
      paths.map(path => createRoute({ getParentRoute: () => root, path })),
    );
  };

  const mount = (
    tree: AnyRoute,
    path: string,
    segments: PluginRoute["segments"],
  ) =>
    withPluginRoutes(
      tree,
      pluginRouteSpecs([route({ path, segments })], registryOf("plugin:page")),
    );

  const param = (name: string) => ({ kind: "param" as const, name });
  const staticSegment = (value: string) => ({ kind: "static" as const, value });

  it.each([
    ["/users/$id", "/users/:userId", [staticSegment("users"), param("userId")]],
    [
      "/blog/$slug/comments",
      "/blog/:postId/comments",
      [staticSegment("blog"), param("postId"), staticSegment("comments")],
    ],
    ["/discover", "/discover", [staticSegment("discover")]],
  ] as const)(
    "refuses app %s against plugin %s",
    (appPath, pluginPath, segments) => {
      expect(() => mount(treeWith(appPath), pluginPath, [...segments])).toThrow(
        /conflicts with application route/,
      );
    },
  );

  it.each([
    ["/users/new", "/users/:id", [staticSegment("users"), param("id")]],
    [
      "/users/$id",
      "/users/new",
      [staticSegment("users"), staticSegment("new")],
    ],
    ["/discover", "/example", [staticSegment("example")]],
  ] as const)(
    "allows app %s beside plugin %s",
    (appPath, pluginPath, segments) => {
      expect(() =>
        mount(treeWith(appPath), pluginPath, [...segments]),
      ).not.toThrow();
    },
  );

  it("names the plugin route, its canonical path and the app route it hit", () => {
    let message = "";

    try {
      mount(treeWith("/users/$id"), "/users/:userId", [
        staticSegment("users"),
        param("userId"),
      ]);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("plugin:page");
    expect(message).toContain("/users/:userId");
    expect(message).toContain("/users/$id");
  });
});

/**
 * What the application is understood to already claim.
 *
 * A TanStack route can be a page *and* a layout at once, so "has children" does
 * not mean "claims no URL" - and a pathless route claims nothing by definition.
 */
describe("fileRoutePaths", () => {
  it("includes a route that has both a path and children", () => {
    const root = createRootRoute();
    const blog = createRoute({ getParentRoute: () => root, path: "/blog" });

    blog.addChildren([
      createRoute({ getParentRoute: () => blog, path: "/" }),
      createRoute({ getParentRoute: () => blog, path: "/$slug" }),
    ]);

    expect(fileRoutePaths(root.addChildren([blog]))).toEqual([
      "/blog",
      "/blog/",
      "/blog/$slug",
    ]);
  });

  it("does not let a pathless layout claim a URL", () => {
    const root = createRootRoute();
    const layout = createRoute({ getParentRoute: () => root, id: "_shell" });

    layout.addChildren([
      createRoute({ getParentRoute: () => layout, path: "/settings" }),
    ]);

    expect(fileRoutePaths(root.addChildren([layout]))).toEqual(["/settings"]);
  });

  it("excludes the plugin container and everything under it", () => {
    const tree = withPluginRoutes(
      (() => {
        const root = createRootRoute();

        return root.addChildren([
          createRoute({ getParentRoute: () => root, path: "/discover" }),
        ]);
      })(),
      pluginRouteSpecs([route()], registryOf("plugin:page")),
    );

    expect(fileRoutePaths(tree)).toEqual(["/discover"]);
  });

  /**
   * The regression the leaf-only walk allowed: a parent route that is also a
   * page could be claimed by a plugin.
   */
  it("protects a parent route that is also a page", () => {
    const root = createRootRoute();
    const blog = createRoute({ getParentRoute: () => root, path: "/blog" });

    blog.addChildren([
      createRoute({ getParentRoute: () => blog, path: "/$slug" }),
    ]);

    expect(() =>
      withPluginRoutes(
        root.addChildren([blog]),
        pluginRouteSpecs(
          [
            route({
              path: "/blog",
              segments: [{ kind: "static", value: "blog" }],
            }),
          ],
          registryOf("plugin:page"),
        ),
      ),
    ).toThrow(/conflicts with application route/);
  });
});
