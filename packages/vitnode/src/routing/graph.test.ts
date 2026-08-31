// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRouteGraph, PluginRouteNode } from "./graph";
import type { PluginRoute, PluginRouteDefinition } from "./types";

import { PluginRouteError } from "./errors";
import { buildPluginRouteGraph, pluginRouteNamespaces } from "./graph";
import { buildPluginRouteManifest } from "./manifest";

/** The manifest a plugin's declarations build into, which is what a graph reads. */
const manifestOf = (
  ...sources: { pluginId: string; routes: PluginRouteDefinition[] }[]
): PluginRoute[] => buildPluginRouteManifest(sources);

const example = (...routes: PluginRouteDefinition[]) => ({
  pluginId: "@vitnode/example",
  routes,
});

const blog = (...routes: PluginRouteDefinition[]) => ({
  pluginId: "@vitnode/blog",
  routes,
});

const page = (
  id: string,
  path: string,
  rest: Partial<PluginRouteDefinition> = {},
): PluginRouteDefinition => ({ entry: `routes/${id}`, id, path, ...rest });

const layout = (
  id: string,
  path: string,
  rest: Partial<PluginRouteDefinition> = {},
): PluginRouteDefinition => page(id, path, { kind: "layout", ...rest });

/** One node of a graph, or a failure that names the id rather than `undefined`. */
const nodeOf = (graph: PluginRouteGraph, id: string): PluginRouteNode => {
  const node = graph.byId.get(id);

  if (!node) throw new Error(`no node for "${id}"`);

  return node;
};

/** The error a call threw, typed - `expect().toThrow` only sees the message. */
const thrownBy = (build: () => unknown): PluginRouteError => {
  try {
    build();
  } catch (error) {
    if (error instanceof PluginRouteError) return error;
    throw error;
  }

  throw new Error("expected a PluginRouteError");
};

/**
 * The shape core's own settings screens have had since long before this
 * contract existed - a frame, its index, and three siblings - which is the one
 * real nested route tree VitNode ships through the plugin pipeline.
 */
const settings = () =>
  example(
    layout("settings", "/settings"),
    page("settings-index", "/settings", { parentId: "settings" }),
    page("security", "/settings/security", { parentId: "settings" }),
    page("devices", "/settings/devices", { parentId: "settings" }),
  );

describe("a flat manifest", () => {
  it("is all roots", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(example(page("a", "/a"), page("b", "/b/:id"))),
    );

    expect(graph.roots.map(node => node.route.id)).toEqual([
      "@vitnode/example:a",
      "@vitnode/example:b",
    ]);
    expect(graph.nodes.every(node => node.parent === null)).toBe(true);
    expect(graph.nodes.every(node => node.depth === 0)).toBe(true);
  });

  it("gives a root its own path as its relative path", () => {
    const [node] = buildPluginRouteGraph(
      manifestOf(example(page("a", "/blog/:slug"))),
    ).nodes;

    expect(node.relativePath).toBe("/blog/:slug");
    expect(node.isIndex).toBe(false);
  });

  it("is empty for a manifest with no routes", () => {
    const graph = buildPluginRouteGraph([]);

    expect(graph.nodes).toEqual([]);
    expect(graph.roots).toEqual([]);
    expect(graph.byId.size).toBe(0);
  });
});

describe("nesting", () => {
  it("places every child under its layout", () => {
    const graph = buildPluginRouteGraph(manifestOf(settings()));
    const parent = graph.byId.get("@vitnode/example:settings");

    // The index first, then the two siblings in path order: a shorter path sorts
    // ahead of a longer one that starts the same way, and nothing here depends
    // on the order the routes were declared in.
    expect(parent?.children.map(node => node.route.routeId)).toEqual([
      "settings-index",
      "devices",
      "security",
    ]);
    expect(parent?.children.every(node => node.depth === 1)).toBe(true);
  });

  /**
   * The whole cost of "a nested route declares its full path": the manifest
   * stays readable and collides visibly, and exactly one function turns
   * `/settings/security` back into the `/security` a router composes.
   */
  it("relativises a child against its parent", () => {
    const graph = buildPluginRouteGraph(manifestOf(settings()));

    expect(graph.byId.get("@vitnode/example:security")?.relativePath).toBe(
      "/security",
    );
    expect(
      graph.byId.get("@vitnode/example:security")?.relativeSegments,
    ).toEqual([{ kind: "static", value: "security" }]);
  });

  /** `page.tsx` beside `layout.tsx`; `index.tsx` beside `settings.tsx`. */
  it("reads a child at its parent's own path as the index route", () => {
    const index = buildPluginRouteGraph(manifestOf(settings())).byId.get(
      "@vitnode/example:settings-index",
    );

    expect(index?.isIndex).toBe(true);
    expect(index?.relativePath).toBe("/");
    expect(index?.relativeSegments).toEqual([]);
  });

  it("nests layouts, and counts the depth", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("a", "/a"),
          layout("b", "/a/b", { parentId: "a" }),
          page("c", "/a/b/c", { parentId: "b" }),
        ),
      ),
    );

    expect(graph.byId.get("@vitnode/example:c")?.depth).toBe(2);
    expect(graph.byId.get("@vitnode/example:c")?.relativePath).toBe("/c");
    expect(graph.roots.map(node => node.route.routeId)).toEqual(["a"]);
  });

  it("carries a parameter from a layout into its children", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("post", "/blog/:slug"),
          page("post-index", "/blog/:slug", { parentId: "post" }),
          page("comments", "/blog/:slug/comments", { parentId: "post" }),
        ),
      ),
    );

    expect(graph.byId.get("@vitnode/example:comments")?.relativePath).toBe(
      "/comments",
    );
    expect(graph.byId.get("@vitnode/example:post-index")?.isIndex).toBe(true);
  });

  /**
   * Parents before children, which is what lets a router be built in one pass:
   * by the time a node is reached, the route it hangs from exists.
   */
  it("orders nodes with every parent before its children", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("a", "/a"),
          page("a-deep", "/a/deep", { parentId: "a" }),
          page("z", "/z"),
        ),
      ),
    );

    const ids = graph.nodes.map(node => node.route.routeId);

    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("a-deep"));
  });

  /**
   * Nothing about the tree may depend on which order the plugins were
   * configured in, which order their manifests happened to load, or which
   * machine the build ran on.
   */
  it("does not depend on declaration order", () => {
    const shape = (routes: PluginRouteDefinition[]) =>
      buildPluginRouteGraph(manifestOf(example(...routes))).nodes.map(node => [
        node.route.id,
        node.relativePath,
        node.depth,
      ]);

    const declared = [
      layout("settings", "/settings"),
      page("security", "/settings/security", { parentId: "settings" }),
      page("settings-index", "/settings", { parentId: "settings" }),
    ];

    expect(shape([...declared].reverse())).toEqual(shape(declared));
  });
});

describe("a hierarchy that does not hold together", () => {
  it("refuses a parent no route has", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(example(page("a", "/a", { parentId: "ghost" }))),
      ),
    );

    expect(error.code).toBe("unknown-parent");
    expect(error.message).toContain("@vitnode/example:ghost");
  });

  it("refuses a route that is its own parent", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(example(layout("a", "/a", { parentId: "a" }))),
      ),
    );

    expect(error.code).toBe("parent-cycle");
  });

  /**
   * Unrepresentable in a declaration - a `parentId` is namespaced with the
   * declaring plugin's own id - and still checked, because this also runs over a
   * generated manifest whose ids are already global. One plugin's page inside
   * another plugin's frame would make a route tree depend on which plugins
   * happen to be installed beside it.
   */
  it("refuses a parent in another plugin", () => {
    const theirs = manifestOf(
      blog(
        layout("frame", "/blog"),
        page("x", "/blog/x", { parentId: "frame" }),
      ),
    );
    const [mine] = manifestOf(example(page("a", "/blog/mine")));
    const child: PluginRoute = { ...mine, parentId: "@vitnode/blog:frame" };

    const error = thrownBy(() => buildPluginRouteGraph([...theirs, child]));

    expect(error.code).toBe("cross-plugin-parent");
  });

  /**
   * Nesting *is* how a shell is chosen: a nested route mounts under its layout,
   * and the layout mounts under its area's shell - so a child's own `area` is
   * never consulted again once it has a parent.
   *
   * Which makes a mismatch a declaration that does not describe where the page
   * renders, and silently in the worst direction: a route marked `admin` under a
   * `main` layout would come out on the public site, outside the AdminCP session
   * guard. Refused rather than inherited from the parent, because filling the
   * field in would make the manifest that reads wrong behave like the one that
   * reads right, and the wrong one is what a reviewer sees.
   */
  it.each([
    ["an admin page under a main layout", "main", "admin"],
    ["a main page under an admin layout", "admin", "main"],
  ] as const)("refuses %s", (_label, parentArea, childArea) => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("frame", "/x", { area: parentArea }),
            page("child", "/x/y", { area: childArea, parentId: "frame" }),
          ),
        ),
      ),
    );

    expect(error.code).toBe("cross-area-parent");
    expect(error.message).toContain(`"${childArea}" area`);
  });

  it("allows a subtree that stays in one area", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("frame", "/admin/reports", { area: "admin" }),
          page("index", "/admin/reports", {
            area: "admin",
            parentId: "frame",
          }),
        ),
      ),
    );

    expect(nodeOf(graph, "@vitnode/example:index").parent?.route.id).toBe(
      "@vitnode/example:frame",
    );
  });

  it("refuses a parent that is a page", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(page("a", "/a"), page("b", "/a/b", { parentId: "a" })),
        ),
      ),
    );

    expect(error.code).toBe("invalid-parent-kind");
  });

  /**
   * Two layouts that are each other's parent, so neither is reachable from a
   * root. Hand-built, because a declaration cannot express it: a `parentId` is
   * plugin-local, a child's path has to extend its parent's, and no two paths
   * can each extend the other. This runs over generated manifests too, and the
   * walk that assigns depth has to be able to state that it terminates.
   */
  it("refuses a cycle between two routes", () => {
    const [a, b] = manifestOf(
      example(
        layout("a", "/a"),
        layout("b", "/a/b", { parentId: "a" }),
        page("leaf", "/a/b/leaf", { parentId: "b" }),
      ),
    );

    const error = thrownBy(() =>
      buildPluginRouteGraph([{ ...a, parentId: b.id }, b]),
    );

    expect(error.code).toBe("parent-cycle");
    expect(error.message).toContain("never reaches a route without one");
  });

  it("refuses a child that is not inside its parent", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("settings", "/settings"),
            page("elsewhere", "/account", { parentId: "settings" }),
          ),
        ),
      ),
    );

    expect(error.code).toBe("invalid-parent-path");
  });

  /**
   * The parent named that segment, so a child that renames it would read a
   * parameter that never exists. A build error beats `params.postId` being
   * silently `undefined`.
   */
  it("refuses a child that renames its parent's parameter", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("post", "/blog/:slug"),
            page("comments", "/blog/:postId/comments", { parentId: "post" }),
          ),
        ),
      ),
    );

    expect(error.code).toBe("invalid-parent-path");
  });

  /**
   * Next's `(group)` folders, which this contract does not have. Hand-built,
   * because two layouts at one path never reach the graph from a declaration -
   * the manifest refuses them as a collision first.
   */
  it("refuses a nested layout that adds no segment", () => {
    const [outer, leaf] = manifestOf(
      example(
        layout("outer", "/a"),
        page("leaf", "/a/leaf", { parentId: "outer" }),
      ),
    );
    const inner: PluginRoute = {
      ...outer,
      entry: "routes/inner",
      id: "@vitnode/example:inner",
      parentId: outer.id,
      routeId: "inner",
    };

    const error = thrownBy(() =>
      buildPluginRouteGraph([outer, inner, { ...leaf, parentId: inner.id }]),
    );

    expect(error.code).toBe("invalid-parent-path");
    expect(error.message).toContain("pathless group");
  });

  it("refuses a layout with nothing inside it", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(manifestOf(example(layout("frame", "/frame")))),
    );

    expect(error.code).toBe("childless-layout");
  });

  it("refuses two routes with one id", () => {
    const [route] = manifestOf(example(page("a", "/a")));

    expect(thrownBy(() => buildPluginRouteGraph([route, route])).code).toBe(
      "duplicate-id",
    );
  });
});

/**
 * The one URL clash the flat manifest cannot judge for itself.
 *
 * `buildPluginRouteManifest` refuses two routes of the same kind at one path,
 * which is where the ordinary collision is caught. A layout and a page at one
 * path are a different question, because exactly one spelling of it is legal -
 * a layout beside its own index child - and telling that apart needs the tree.
 *
 * Left unrefused, these reached the router, which rejects them too but as
 * `Invariant failed: Duplicate routes found with id: /_plugins/foo` - naming
 * neither plugin, and pointing at a container no plugin author wrote.
 */
describe("two routes answering one URL", () => {
  it("lets a layout share its path with its own index child", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("guide", "/guide"),
          page("guide-index", "/guide", { parentId: "guide" }),
          page("guide-topic", "/guide/:topic", { parentId: "guide" }),
        ),
      ),
    );

    expect(nodeOf(graph, "@vitnode/example:guide-index").isIndex).toBe(true);
  });

  it("refuses another plugin's page at a layout's path", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("frame", "/foo"),
            page("inside", "/foo/bar", { parentId: "frame" }),
          ),
          blog(page("post", "/foo")),
        ),
      ),
    );

    expect(error.code).toBe("duplicate-path");
    expect(error.message).toContain("@vitnode/example");
    expect(error.message).toContain("@vitnode/blog");
  });

  /**
   * The cross-kind clash does **not** stop at an area boundary, and an earlier
   * draft of Stage 12 believed it did.
   *
   * A layout in the AdminCP and a page on the public site that spell one
   * pathname are framed by different shells - and both of those shells are
   * *pathless*, so neither of them moves a URL. `/foo` is one URL claimed by two
   * routes, and only the router's own ranking would decide which of them a
   * browser reaches. The legal pairing is still exactly one: a layout and the
   * index page inside it.
   */
  it("refuses a layout and a page sharing a pathname across two areas", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("frame", "/foo", { area: "admin" }),
            page("inside", "/foo/bar", { area: "admin", parentId: "frame" }),
          ),
          blog(page("post", "/foo")),
        ),
      ),
    );

    expect(error.code).toBe("duplicate-path");
    // A diagnostic still names both areas, even though neither decides the
    // collision - it is the first thing an author checks.
    expect(error.message).toContain("(admin)");
    expect(error.message).toContain("main");
    expect(error.message).toContain("@vitnode/blog");
    expect(error.message).toContain("@vitnode/example");
  });

  /**
   * The same tree, moved to the URL an admin page would actually claim.
   *
   * Nothing about the areas changed; the paths did, which is the only thing that
   * ever decided this.
   */
  it("accepts the same tree once the admin routes claim /admin paths", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("frame", "/admin/foo", { area: "admin" }),
          page("inside", "/admin/foo/bar", {
            area: "admin",
            parentId: "frame",
          }),
        ),
        blog(page("post", "/foo")),
      ),
    );

    expect(graph.roots.map(root => root.route.id)).toEqual([
      "@vitnode/example:frame",
      "@vitnode/blog:post",
    ]);
  });

  /**
   * The same clash inside one plugin: a layout and a page at its path that is
   * not the layout's child. Legal-looking, and the router refuses it too.
   */
  it("refuses a page at its own plugin's layout path that is not its index", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("frame", "/foo"),
            page("inside", "/foo/bar", { parentId: "frame" }),
            page("loose", "/foo"),
          ),
        ),
      ),
    );

    expect(error.code).toBe("duplicate-path");
  });

  /**
   * Matched on the URLs a route answers rather than on its text, the same way
   * the manifest's own collision check is - so a parameter renamed does not
   * make it a different route.
   */
  it("refuses a dynamic path that differs only in its parameter name", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("frame", "/member/:id"),
            page("posts", "/member/:id/posts", { parentId: "frame" }),
          ),
          blog(page("profile", "/member/:slug")),
        ),
      ),
    );

    expect(error.code).toBe("duplicate-path");
  });
});

describe("requirements", () => {
  it("lets a subtree inherit its layout's requirement", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("settings", "/settings", { requires: "authenticated" }),
          page("index", "/settings", { parentId: "settings" }),
        ),
      ),
    );

    // Declared where it is decided, and inherited by the tree rather than
    // restated: a page under the frame says nothing about sessions.
    expect(graph.byId.get("@vitnode/example:index")?.route.requires).toBeNull();
    expect(nodeOf(graph, "@vitnode/example:settings").route.requires).toBe(
      "authenticated",
    );
  });

  it("lets a page restate the requirement it already inherits", () => {
    expect(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("settings", "/settings", { requires: "authenticated" }),
            page("index", "/settings", {
              parentId: "settings",
              requires: "authenticated",
            }),
          ),
        ),
      ),
    ).not.toThrow();
  });

  it("refuses a guest-only page inside a signed-in subtree", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("settings", "/settings", { requires: "authenticated" }),
            page("index", "/settings", {
              parentId: "settings",
              requires: "guest",
            }),
          ),
        ),
      ),
    );

    expect(error.code).toBe("conflicting-requires");
    expect(error.message).toContain("No visitor could ever reach it");
  });

  /**
   * The rule read down the *whole* chain rather than one link of it.
   *
   * A neutral layout between the two is the case that matters, because it is
   * the one that used to pass: compared only against its immediate parent, the
   * page below declared `guest` inside something declaring nothing, and nothing
   * conflicts with nothing. At runtime every matched route's guard runs, so the
   * `authenticated` layout further up turned guests away and the `guest` page
   * turned everybody else away - a route that 404'd for every human being and
   * validated cleanly.
   */
  it.each([
    ["authenticated", "guest"],
    ["guest", "authenticated"],
  ] as const)(
    "refuses a %s subtree with a %s page under a neutral layout",
    (outer, inner) => {
      const error = thrownBy(() =>
        buildPluginRouteGraph(
          manifestOf(
            example(
              layout("outer", "/a", { requires: outer }),
              layout("middle", "/a/b", { parentId: "outer" }),
              page("leaf", "/a/b/c", { parentId: "middle", requires: inner }),
            ),
          ),
        ),
      );

      expect(error.code).toBe("conflicting-requires");
      // The route that actually imposed it, which is not the parent.
      expect(error.message).toContain("@vitnode/example:outer");
    },
  );

  it("refuses a conflict several neutral layouts deep", () => {
    const error = thrownBy(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("outer", "/a", { requires: "authenticated" }),
            layout("mid1", "/a/b", { parentId: "outer" }),
            layout("mid2", "/a/b/c", { parentId: "mid1" }),
            page("leaf", "/a/b/c/d", { parentId: "mid2", requires: "guest" }),
          ),
        ),
      ),
    );

    expect(error.code).toBe("conflicting-requires");
  });

  it("accepts a page restating the requirement through a neutral layout", () => {
    expect(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("outer", "/a", { requires: "authenticated" }),
            layout("middle", "/a/b", { parentId: "outer" }),
            page("leaf", "/a/b/c", {
              parentId: "middle",
              requires: "authenticated",
            }),
          ),
        ),
      ),
    ).not.toThrow();
  });

  it("accepts a neutral page under a neutral layout under a guarded one", () => {
    expect(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("outer", "/a", { requires: "authenticated" }),
            layout("middle", "/a/b", { parentId: "outer" }),
            page("leaf", "/a/b/c", { parentId: "middle" }),
          ),
        ),
      ),
    ).not.toThrow();
  });

  /**
   * A requirement first declared *below* an unguarded root is not in conflict
   * with anything - there is nothing above it to disagree with.
   */
  it("accepts a requirement introduced part-way down an open subtree", () => {
    expect(() =>
      buildPluginRouteGraph(
        manifestOf(
          example(
            layout("outer", "/a"),
            layout("middle", "/a/b", {
              parentId: "outer",
              requires: "authenticated",
            }),
            page("leaf", "/a/b/c", { parentId: "middle" }),
          ),
        ),
      ),
    ).not.toThrow();
  });

  /**
   * The manifest keeps saying what the plugin wrote. Inheritance is this
   * graph's reading of the tree, never written back onto a route - a generated
   * manifest that had absorbed it would no longer round-trip to the plugin's
   * own declaration.
   */
  it("leaves an inheriting route's own `requires` null", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("outer", "/a", { requires: "authenticated" }),
          layout("middle", "/a/b", { parentId: "outer" }),
          page("leaf", "/a/b/c", { parentId: "middle" }),
        ),
      ),
    );

    expect(nodeOf(graph, "@vitnode/example:middle").route.requires).toBeNull();
    expect(nodeOf(graph, "@vitnode/example:leaf").route.requires).toBeNull();
    expect(nodeOf(graph, "@vitnode/example:outer").route.requires).toBe(
      "authenticated",
    );
  });
});

describe("pluginRouteNamespaces", () => {
  it("is a route's own namespaces plus every layout's above it", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("settings", "/settings", { namespaces: ["core.global"] }),
          page("security", "/settings/security", {
            namespaces: ["@vitnode/example.security"],
            parentId: "settings",
          }),
        ),
      ),
    );

    const node = nodeOf(graph, "@vitnode/example:security");

    // A page mounts one provider and it *replaces* the shell's rather than
    // adding to it, so it has to name the frame's strings too.
    expect(pluginRouteNamespaces(node)).toEqual([
      "@vitnode/example.security",
      "core.global",
    ]);
  });

  it("de-duplicates what a layout and its child both declare", () => {
    const graph = buildPluginRouteGraph(
      manifestOf(
        example(
          layout("a", "/a", { namespaces: ["core.global"] }),
          page("b", "/a/b", { namespaces: ["core.global"], parentId: "a" }),
        ),
      ),
    );

    expect(pluginRouteNamespaces(nodeOf(graph, "@vitnode/example:b"))).toEqual([
      "core.global",
    ]);
  });

  it("is empty for a route that declares none", () => {
    const graph = buildPluginRouteGraph(manifestOf(example(page("a", "/a"))));

    expect(pluginRouteNamespaces(graph.roots[0])).toEqual([]);
  });
});
