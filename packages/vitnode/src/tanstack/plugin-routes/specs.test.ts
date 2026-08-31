import { describe, expect, it } from "vitest";

import type { PluginRouteModuleRegistry } from "@/framework/plugin-routes";
import type { PluginRoute } from "@/routing";

import { pluginRouteSearchDeps, pluginRouteSpecs } from "./specs";

/**
 * The manifest and the registry, as the route specs a router is built from.
 *
 * Everything here is data: what the two generated files say, and what the
 * composition makes of them. Nothing renders and no route is created - whether a
 * spec becomes the right TanStack route is `./plugin-routes.test.ts`, and
 * whether a plugin's page produces the right HTML is the plugin's own business.
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
  searchEntry: null,
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

/**
 * The nested shape the example plugin ships, and the smallest manifest that
 * exercises every part of the hierarchy: a layout, its index page at the same
 * path, and a dynamic child one segment deeper.
 */
const GUIDE: PluginRoute[] = [
  route({
    id: "plugin:guide",
    kind: "layout",
    namespaces: ["plugin.guide"],
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
    namespaces: ["plugin.topic"],
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

const guideSpecs = () =>
  pluginRouteSpecs(
    GUIDE,
    registryOf("plugin:guide", "plugin:guide-index", "plugin:guide-topic"),
  );

const byId = (id: string) => {
  const spec = guideSpecs().find(candidate => candidate.route.id === id);

  if (!spec) throw new Error(`No spec for ${id}.`);

  return spec;
};

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

  /**
   * The graph is the build's own validation, re-run over the generated manifest
   * - so a manifest that could not describe a tree fails here rather than
   * becoming a route nothing can ever match.
   */
  it("refuses a manifest whose hierarchy does not hold together", () => {
    expect(() =>
      pluginRouteSpecs(
        [route({ id: "plugin:frame", kind: "layout", routeId: "frame" })],
        registryOf("plugin:frame"),
      ),
    ).toThrow(/layout with no routes inside it/);
  });
});

describe("the tree a nested manifest describes", () => {
  it("orders parents before their children, so one pass can build them", () => {
    expect(guideSpecs().map(spec => spec.route.id)).toEqual([
      "plugin:guide",
      "plugin:guide-index",
      "plugin:guide-topic",
    ]);
  });

  it("names each route's parent by the same global id everything else uses", () => {
    expect(byId("plugin:guide").parentId).toBeNull();
    expect(byId("plugin:guide-index").parentId).toBe("plugin:guide");
    expect(byId("plugin:guide-topic").parentId).toBe("plugin:guide");
  });

  /**
   * A manifest spells every path out in full - which is what makes a collision
   * visible in a diff - and a router composes a child's path onto its parent's.
   * This is the one place the first form becomes the second.
   */
  it("gives a child only what it adds to its parent's path", () => {
    expect(byId("plugin:guide").path).toBe("/example/guide");
    expect(byId("plugin:guide-topic").path).toBe("/$topic");
  });

  it("gives a layout's index route the router's index path", () => {
    expect(byId("plugin:guide-index").path).toBe("/");
    expect(byId("plugin:guide-index").isIndex).toBe(true);
    expect(byId("plugin:guide-topic").isIndex).toBe(false);
  });
});

describe("the namespaces a route's provider mounts", () => {
  /**
   * A route's provider *replaces* the shell's rather than adding to it, so a
   * page inside a layout has to name the layout's strings too - and `core.global`
   * is what every shared VitNode component translates through.
   */
  it("inherits its layouts' namespaces and adds the global set", () => {
    expect(byId("plugin:guide-index").namespaces).toEqual([
      "core.global",
      "plugin.guide",
    ]);
    expect(byId("plugin:guide-topic").namespaces).toEqual([
      "core.global",
      "plugin.guide",
      "plugin.topic",
    ]);
  });

  /**
   * The other half of the same rule: a route that declares nothing mounts no
   * provider at all and reads the root's, which already holds exactly
   * `core.global`. A second identical provider would be a second cache read for
   * the same bytes.
   */
  it("stays empty for a route that declares none", () => {
    expect(
      pluginRouteSpecs([route()], registryOf("plugin:page"))[0].namespaces,
    ).toEqual([]);
  });
});

describe("the breadcrumb chain", () => {
  /**
   * Stage 8's rule is "the deepest matched route that declared a crumb wins",
   * and inside a plugin subtree it cannot be decided by `staticData` alone -
   * whether a route declares a crumb is in its module, which has not been
   * fetched when `staticData` is written. The chain is what lets the runtime
   * apply the same rule once the modules have arrived.
   */
  it("is the route itself, then its layouts, deepest first", () => {
    expect(byId("plugin:guide-topic").breadcrumbChain).toEqual([
      "plugin:guide-topic",
      "plugin:guide",
    ]);
    expect(byId("plugin:guide").breadcrumbChain).toEqual(["plugin:guide"]);
  });
});

describe("pluginRouteSearchDeps", () => {
  /**
   * A match id is built from the loader's deps, so two spellings of one query
   * string must produce one object - otherwise swapping two parameters re-runs
   * the loader and remounts the page.
   */
  it("sorts keys, so parameter order is not part of the identity", () => {
    expect(Object.keys(pluginRouteSearchDeps({ b: 2, a: 1, c: 3 }))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(JSON.stringify(pluginRouteSearchDeps({ b: 2, a: 1 }))).toBe(
      JSON.stringify(pluginRouteSearchDeps({ a: 1, b: 2 })),
    );
  });

  it("drops undefined values, which JSON would not carry anyway", () => {
    expect(pluginRouteSearchDeps({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it.each([
    ["a string", "?a=1"],
    ["null", null],
    ["nothing", undefined],
  ])("answers %s with an empty object", (_label, search) => {
    expect(pluginRouteSearchDeps(search)).toEqual({});
  });

  /**
   * `Object.fromEntries` defines own properties rather than assigning them, so a
   * `__proto__` parameter is an own key here and not a prototype write.
   */
  it("keeps a __proto__ parameter as an ordinary key", () => {
    const deps = pluginRouteSearchDeps(JSON.parse('{"__proto__": {"bad": 1}}'));

    expect(Object.hasOwn(deps, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).bad).toBeUndefined();
  });
});
