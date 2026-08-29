import type { AnyRoute } from "@tanstack/react-router";

import { createRootRoute, createRoute } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { PluginRouteModuleRegistry } from "@/framework/plugin-routes";
import type { PluginRoute } from "@/routing";

import type { PluginRoutePageHead } from "./mount";

import { fileRoutePaths } from "./collision";
import { PLUGIN_ROUTES_ROUTE_ID } from "./container";
import { withPluginRoutes } from "./mount";
import { pluginRouteSpecs } from "./specs";

/**
 * Plugin routes, from a manifest to a mounted TanStack route *tree*.
 *
 * Route structure only: which routes exist, what they claim, who their parent
 * is, and what the composition refuses. Nothing renders - whether a plugin's
 * page produces the right HTML is the plugin's own business, and a component
 * test would only assert that `lazyRouteComponent` works. What a spec *is* is
 * `./specs.test.ts`; the modules are `./module-ref.test.ts`.
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

/** The host's own binding, which is all this composition needs of one. */
const pageHead: PluginRoutePageHead = ({ description, robots, title }) => ({
  meta: [
    ...(robots ? [{ content: robots, name: "robots" }] : []),
    ...(title ? [{ title: `${title} - VitNode` }] : []),
    ...(description ? [{ content: description, name: "description" }] : []),
  ],
});

const mount = (tree: AnyRoute, specs: ReturnType<typeof pluginRouteSpecs>) =>
  withPluginRoutes(tree, specs, { pageHead });

const optionsOf = (route: AnyRoute): { id?: string; path?: string } =>
  route.options;

describe("withPluginRoutes", () => {
  const appTree = () => {
    const root = createRootRoute();

    return root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/" }),
      createRoute({ getParentRoute: () => root, path: "/discover" }),
    ]);
  };

  const containerOf = (tree: AnyRoute): AnyRoute | undefined =>
    (tree.children ?? []).find(
      (child: AnyRoute) => optionsOf(child).id === PLUGIN_ROUTES_ROUTE_ID,
    );

  const pluginChildren = (tree: AnyRoute) =>
    (containerOf(tree)?.children ?? []).map(
      (child: AnyRoute) => optionsOf(child).path,
    );

  it("mounts one route per plugin route, under the plugin container", () => {
    const tree = mount(
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
    const tree = withPluginRoutes(appTree(), [], { pageHead });

    expect(containerOf(tree)).toBeUndefined();
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

    mount(tree, pluginRouteSpecs([route()], registryOf("plugin:page")));
    mount(tree, pluginRouteSpecs([route()], registryOf("plugin:page")));

    expect(pluginChildren(tree)).toEqual(["/page"]);
    expect(tree.children).toHaveLength(3);
  });

  /**
   * The same property, read the other way: uninstalling the *last* plugin.
   *
   * The tree a second pass is handed is the one the first pass already mutated,
   * so "no plugin declares a route" cannot mean "add nothing" - the subtree
   * nobody declares any more has to come off. Measured in a dev server, an early
   * return here left `/example` answering from memory until the server was
   * restarted, with both generated files already empty.
   */
  it("takes the plugin subtree off again when the last plugin goes away", () => {
    const tree = appTree();

    mount(tree, pluginRouteSpecs([route()], registryOf("plugin:page")));
    expect(containerOf(tree)).toBeDefined();

    withPluginRoutes(tree, [], { pageHead });

    expect(containerOf(tree)).toBeUndefined();
    expect(fileRoutePaths(tree)).toEqual(["/", "/discover"]);
    expect(tree.children).toHaveLength(2);
  });

  /**
   * A plugin route declares `area: "main"`, which is a statement about layout -
   * and in a router a layout is a parent. Mounting under the shell route is the
   * whole of what honouring that declaration amounts to; there is no per-route
   * shell metadata and no second copy of the header.
   */
  it("hangs the subtree from the route it is told to, not from the root", () => {
    const root = createRootRoute();
    const shell = createRoute({ getParentRoute: () => root, id: "_main" });

    shell.addChildren([
      createRoute({ getParentRoute: () => shell, path: "/" }),
    ]);

    const tree = withPluginRoutes(
      root.addChildren([shell]),
      pluginRouteSpecs([route()], registryOf("plugin:page")),
      { mountUnder: shell, pageHead },
    );

    expect(containerOf(tree)).toBeUndefined();
    expect(pluginChildren(shell)).toEqual(["/page"]);
    // The shell keeps the children it already had.
    expect(shell.children).toHaveLength(2);
  });

  /**
   * The manifest layer rejects two plugins claiming one URL and cannot see this
   * case - it does not know which application it is being built for.
   */
  it("refuses a plugin route that would shadow one of the app’s own pages", () => {
    expect(() =>
      mount(
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
 * A plugin's own hierarchy, as actual parent and child routes.
 *
 * The compiled graph decides the shape and this builds it - so a layout is a
 * real TanStack parent with its pages underneath, rather than three flat routes
 * that happen to share a prefix and each redraw the frame.
 */
describe("a nested plugin subtree", () => {
  const GUIDE: PluginRoute[] = [
    route({
      id: "plugin:guide",
      kind: "layout",
      path: "/example/guide",
      routeId: "guide",
      segments: [
        { kind: "static", value: "example" },
        { kind: "static", value: "guide" },
      ],
    }),
    route({
      id: "plugin:guide-index",
      parentId: "plugin:guide",
      path: "/example/guide",
      routeId: "guide-index",
      segments: [
        { kind: "static", value: "example" },
        { kind: "static", value: "guide" },
      ],
    }),
    route({
      id: "plugin:guide-topic",
      parentId: "plugin:guide",
      path: "/example/guide/:topic",
      routeId: "guide-topic",
      segments: [
        { kind: "static", value: "example" },
        { kind: "static", value: "guide" },
        { kind: "param", name: "topic" },
      ],
    }),
  ];

  const mounted = () => {
    const root = createRootRoute();
    const tree = withPluginRoutes(
      root.addChildren([
        createRoute({ getParentRoute: () => root, path: "/" }),
      ]),
      pluginRouteSpecs(
        GUIDE,
        registryOf("plugin:guide", "plugin:guide-index", "plugin:guide-topic"),
      ),
      { pageHead },
    );

    const container = (tree.children ?? []).find(
      (child: AnyRoute) => optionsOf(child).id === PLUGIN_ROUTES_ROUTE_ID,
    );

    return { container: container as AnyRoute, tree };
  };

  it("mounts the layout at the container and its pages inside it", () => {
    const { container } = mounted();
    const layout = (container.children ?? [])[0] as AnyRoute;

    expect((container.children ?? []).map(optionsOf).map(o => o.path)).toEqual([
      "/example/guide",
    ]);
    expect((layout.children ?? []).map(optionsOf).map(o => o.path)).toEqual([
      "/",
      "/$topic",
    ]);
  });

  it("makes each nested route a child of its own plugin's layout", () => {
    const { container } = mounted();
    const layout = (container.children ?? [])[0] as AnyRoute;

    // `getParentRoute` rather than `parentRoute`, which a route only resolves
    // once a router initialises it - and no router is created here.
    for (const child of layout.children ?? []) {
      const parentOf = (child as AnyRoute).options.getParentRoute as
        (() => AnyRoute) | undefined;

      expect(parentOf?.()).toBe(layout);
    }
  });

  /**
   * A nested route claims a URL of its own, so it is checked against the app's
   * route files like any other - a layout included, because a layout beside an
   * application's own route of the same path is two routes competing for one
   * subtree.
   */
  it.each([
    ["a nested page", "/example/guide/$topic"],
    ["a layout", "/example/guide"],
  ])("refuses a plugin route that shadows the app's %s", (_label, appPath) => {
    const root = createRootRoute();
    const tree = root.addChildren([
      createRoute({ getParentRoute: () => root, path: appPath }),
    ]);

    expect(() =>
      withPluginRoutes(
        tree,
        pluginRouteSpecs(
          GUIDE,
          registryOf(
            "plugin:guide",
            "plugin:guide-index",
            "plugin:guide-topic",
          ),
        ),
        { pageHead },
      ),
    ).toThrow(/conflicts with application route/);
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

  const mountOne = (
    tree: AnyRoute,
    path: string,
    segments: PluginRoute["segments"],
  ) =>
    mount(
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
      expect(() =>
        mountOne(treeWith(appPath), pluginPath, [...segments]),
      ).toThrow(/conflicts with application route/);
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
        mountOne(treeWith(appPath), pluginPath, [...segments]),
      ).not.toThrow();
    },
  );

  it("names the plugin route, its canonical path and the app route it hit", () => {
    let message = "";

    try {
      mountOne(treeWith("/users/$id"), "/users/:userId", [
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
    const tree = mount(
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
      mount(
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
