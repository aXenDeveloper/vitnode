import { describe, expect, it } from "vitest";

import type { PluginRouteDeclaration } from "@/routing";

import { definePluginRoutes, index, layout, lazy, page } from "@/routing";

import { pluginRouteSearchDeps, pluginRouteSpecs } from "./specs";

const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

const specsOf = (...routes: PluginRouteDeclaration[]) =>
  pluginRouteSpecs([
    { pluginId: "plugin", routes: definePluginRoutes(routes) },
  ]);

const guideSpecs = () =>
  specsOf(
    layout("/example/guide", {
      component: lazyPage(),
      messages: ["plugin.guide"],
      children: [
        index({ component: lazyPage() }),
        page(":topic", {
          component: lazyPage(),
          messages: ["plugin.topic"],
        }),
      ],
    }),
  );

const byId = (id: string) => {
  const spec = guideSpecs().find(candidate => candidate.route.id === id);

  if (!spec) throw new Error(`No spec for ${id}.`);

  return spec;
};

const GUIDE = "plugin:layout#/example/guide";
const GUIDE_INDEX = "plugin:page#/example/guide";
const GUIDE_TOPIC = "plugin:page#/example/guide/:topic";

describe("pluginRouteSpecs", () => {
  it("pairs each route with its module and converts the path for TanStack", () => {
    const specs = specsOf(page("/blog/:slug", { component: lazyPage() }));

    expect(specs).toHaveLength(1);
    // `:slug` in the manifest, `$slug` in the router. Neither spelling is the
    // other's, which is the reason the conversion is a function and not a regex
    // written twice.
    expect(specs[0].path).toBe("/blog/$slug");
    expect(specs[0].route.path).toBe("/blog/:slug");
  });

  it("leaves an app with no plugin routes with nothing to register", () => {
    expect(pluginRouteSpecs([])).toEqual([]);
    expect(specsOf()).toEqual([]);
  });

  it("carries each route's own lazy component", async () => {
    const [spec] = specsOf(page("/blog", { component: lazyPage() }));

    await expect(spec.module()).resolves.toHaveProperty("component");
  });

  /**
   * The same validation the build ran, re-run over the same declarations - so a
   * plugin built against another version of VitNode fails here, naming the
   * plugin, rather than becoming a route nothing can ever match.
   */
  it("refuses a tree that does not hold together", () => {
    expect(() =>
      pluginRouteSpecs([
        {
          pluginId: "plugin",
          routes: definePluginRoutes([
            layout("/frame", { component: lazyPage(), children: [] }),
          ]),
        },
      ]),
    ).toThrow(/layout with no `children`/);
  });

  it("refuses a plugin whose routes are not a tree at all", () => {
    expect(() =>
      pluginRouteSpecs([
        {
          pluginId: "plugin",
          routes: [{ path: "/frame" }] as unknown as ReturnType<
            typeof definePluginRoutes
          >,
        },
      ]),
    ).toThrow(/page\(\), layout\(\) or index\(\)/);
  });
});

describe("the tree a nested declaration describes", () => {
  it("orders parents before their children, so one pass can build them", () => {
    expect(guideSpecs().map(spec => spec.route.id)).toEqual([
      GUIDE,
      GUIDE_INDEX,
      GUIDE_TOPIC,
    ]);
  });

  it("names each route's parent by the same global id everything else uses", () => {
    expect(byId(GUIDE).parentId).toBeNull();
    expect(byId(GUIDE_INDEX).parentId).toBe(GUIDE);
    expect(byId(GUIDE_TOPIC).parentId).toBe(GUIDE);
  });

  /**
   * A flattened route carries its path in full - which is what makes a collision
   * visible - and a router composes a child's path onto its parent's. This is
   * the one place the first form becomes the second.
   */
  it("gives a child only what it adds to its parent's path", () => {
    expect(byId(GUIDE).path).toBe("/example/guide");
    expect(byId(GUIDE).route.path).toBe("/example/guide");
    expect(byId(GUIDE_TOPIC).path).toBe("/$topic");
    expect(byId(GUIDE_TOPIC).route.path).toBe("/example/guide/:topic");
  });

  it("gives a layout's index route the router's index path", () => {
    expect(byId(GUIDE_INDEX).path).toBe("/");
    expect(byId(GUIDE_INDEX).isIndex).toBe(true);
    expect(byId(GUIDE_TOPIC).isIndex).toBe(false);
  });
});

describe("the namespaces a route's provider mounts", () => {
  /**
   * A route's provider *replaces* the shell's rather than adding to it, so a
   * page inside a layout has to name the layout's strings too - and `core.global`
   * is what every shared VitNode component translates through.
   */
  it("inherits its layouts' namespaces and adds the global set", () => {
    expect(byId(GUIDE_INDEX).namespaces).toEqual([
      "core.global",
      "plugin.guide",
    ]);
    expect(byId(GUIDE_TOPIC).namespaces).toEqual([
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
      specsOf(page("/page", { component: lazyPage() }))[0].namespaces,
    ).toEqual([]);
  });
});

describe("the eager search schema", () => {
  it("is on the spec of the route that declared it, and nowhere else", () => {
    const search = () => ({ page: 1 });
    const specs = specsOf(
      page("/browse", { component: lazyPage(), search }),
      page("/read", { component: lazyPage() }),
    );

    expect(specs.map(spec => spec.validateSearch)).toEqual([search, null]);
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
