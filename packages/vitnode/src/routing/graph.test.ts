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
