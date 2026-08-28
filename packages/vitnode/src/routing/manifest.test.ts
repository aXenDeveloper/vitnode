// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { BuildPluginReturn } from "../lib/plugin";
import type { PluginRouteDefinition, PluginRouteSource } from "./types";

import { PluginRouteError } from "./errors";
import {
  buildPluginRouteManifest,
  comparePluginRoutes,
  pluginRouteId,
} from "./manifest";

const route = (id: string, path: string): PluginRouteDefinition => ({
  entry: `routes/${id}`,
  id,
  path,
});

const example = (...routes: PluginRouteDefinition[]): PluginRouteSource => ({
  pluginId: "@vitnode/example",
  routes,
});

const blog = (...routes: PluginRouteDefinition[]): PluginRouteSource => ({
  pluginId: "@vitnode/blog",
  routes,
});

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

describe("route ids", () => {
  it("namespaces a route id by its plugin", () => {
    // The same key `framework/plugin-routes` registers the module loader under,
    // so a manifest entry addresses its own module with no translation step.
    expect(pluginRouteId("@vitnode/example", "hello")).toBe(
      "@vitnode/example:hello",
    );
  });

  it("lets two plugins use the same local id", () => {
    const manifest = buildPluginRouteManifest([
      example(route("index", "/example")),
      blog(route("index", "/blog")),
    ]);

    expect(manifest.map(entry => entry.id)).toEqual([
      "@vitnode/blog:index",
      "@vitnode/example:index",
    ]);
  });
});

describe("the seam with the generated module registry", () => {
  it("takes an app's configured plugin list exactly as it is", () => {
    // The call an application makes: `buildPluginRouteManifest(config.plugins)`.
    // `BuildPluginReturn` is not imported by the routing layer - it reaches the
    // AdminCP nav and the Content Engine, and through them React - so the two
    // types meet structurally or not at all. This is where that is checked.
    const plugins: BuildPluginReturn[] = [
      {
        pluginId: "@vitnode/example",
        routes: [route("hello", "/example/hello")],
      },
      { pluginId: "@vitnode/blog" },
    ];

    expect(buildPluginRouteManifest(plugins).map(entry => entry.id)).toEqual([
      "@vitnode/example:hello",
    ]);
  });

  it("declares the two fields the registry reads, and no more", () => {
    // `framework/plugin-routes` takes `id` and `entry` off these same records
    // and generates a lazy import for each. A definition is assignable to that
    // shape by construction, which is what lets one list in a plugin's
    // `routes/manifest.ts` serve both layers.
    const declaration: { entry: string; id: string } = route("hello", "/x");

    expect(declaration).toMatchObject({ entry: "routes/hello", id: "hello" });
  });

  it("addresses a module by the key that registry is keyed on", () => {
    const [route] = buildPluginRouteManifest([
      example({ entry: "routes/hello", id: "hello", path: "/example/hello" }),
    ]);

    expect(route.id).toBe(`${route.pluginId}:${route.routeId}`);
    expect(route.entry).toBe("routes/hello");
  });
});

describe("normalising a declaration", () => {
  it("fills in the defaults a plugin left out", () => {
    const [route] = buildPluginRouteManifest([
      example({ entry: "routes/x", id: "x", path: "/example/x/" }),
    ]);

    expect(route).toEqual({
      area: "main",
      entry: "routes/x",
      id: "@vitnode/example:x",
      path: "/example/x",
      pluginId: "@vitnode/example",
      routeId: "x",
      segments: [
        { kind: "static", value: "example" },
        { kind: "static", value: "x" },
      ],
    });
  });

  it("keeps an explicit area", () => {
    const [route] = buildPluginRouteManifest([
      example({
        area: "main",
        entry: "routes/hello",
        id: "hello",
        path: "/example/hello",
      }),
    ]);

    expect(route.area).toBe("main");
  });

  it("is an empty manifest when nothing declares a route", () => {
    expect(
      buildPluginRouteManifest([
        { pluginId: "@vitnode/example" },
        { pluginId: "@vitnode/blog", routes: [] },
      ]),
    ).toEqual([]);
  });
});

/**
 * The property the whole manifest rests on: two installs with the same plugins
 * in a different order resolve the same URLs to the same pages.
 */
describe("ordering is decided by the paths, not by the registration order", () => {
  const routes = [
    example(
      route("slug", "/example/:slug"),
      route("new", "/example/new"),
      route("index", "/example"),
    ),
    blog(route("post", "/blog/:postId/comments"), route("index", "/blog")),
  ];

  it("puts static segments before parameters at the same depth", () => {
    expect(buildPluginRouteManifest(routes).map(entry => entry.path)).toEqual([
      "/blog",
      "/blog/:postId/comments",
      "/example",
      "/example/new",
      "/example/:slug",
    ]);
  });

  it("gives the same order whichever plugin registered first", () => {
    const forwards = buildPluginRouteManifest(routes);
    const backwards = buildPluginRouteManifest([...routes].reverse());

    expect(backwards.map(entry => entry.id)).toEqual(
      forwards.map(entry => entry.id),
    );
  });

  it("gives the same order whichever route a plugin declared first", () => {
    const declared = buildPluginRouteManifest([
      example(route("index", "/example"), route("slug", "/example/:slug")),
    ]);
    const reversed = buildPluginRouteManifest([
      example(route("slug", "/example/:slug"), route("index", "/example")),
    ]);

    expect(reversed.map(entry => entry.path)).toEqual(
      declared.map(entry => entry.path),
    );
  });

  it("is a total order, so a sort of a manifest is a no-op", () => {
    const manifest = buildPluginRouteManifest(routes);

    expect([...manifest].sort(comparePluginRoutes)).toEqual(manifest);
  });
});

describe("collisions are errors, never resolutions", () => {
  it("names both plugins when two claim the same path", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        example(route("hello", "/hello")),
        blog(route("greeting", "/hello")),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
    expect(error.path).toBe("/hello");
    expect(error.pluginId).toBe("@vitnode/blog");
    expect(error.conflictsWith).toEqual({
      pluginId: "@vitnode/example",
      routeId: "@vitnode/example:hello",
    });
    expect(error.message).toContain("/hello");
    expect(error.message).toContain("@vitnode/example");
    expect(error.message).toContain("@vitnode/blog");
  });

  it("catches a collision that only normalisation reveals", () => {
    expect(() =>
      buildPluginRouteManifest([
        example(route("a", "/hello")),
        blog(route("b", "/hello/")),
      ]),
    ).toThrow(PluginRouteError);
  });

  it("treats two paths that differ only by a parameter name as one path", () => {
    // `/example/:slug` and `/example/:id` match exactly the same URLs.
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        example(route("a", "/example/:slug")),
        blog(route("b", "/example/:id")),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
    // Both spellings, because neither plugin author wrote the other's.
    expect(error.message).toContain("/example/:slug");
    expect(error.message).toContain("/example/:id");
  });

  it("rejects one plugin declaring the same id twice", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        example(route("hello", "/a"), route("hello", "/b")),
      ]),
    );

    expect(error.code).toBe("duplicate-id");
    expect(error.message).toContain("@vitnode/example:hello");
  });
});

describe("malformed declarations", () => {
  const build = (source: unknown) =>
    buildPluginRouteManifest([source] as PluginRouteSource[]);

  it("rejects an empty plugin id", () => {
    for (const pluginId of ["", "   ", undefined]) {
      expect(thrownBy(() => build({ pluginId, routes: [] })).code).toBe(
        "invalid-plugin-id",
      );
    }
  });

  it("rejects a route that is not an object", () => {
    expect(
      thrownBy(() => build({ pluginId: "@vitnode/example", routes: ["/x"] }))
        .code,
    ).toBe("malformed-route");
  });

  it("rejects a missing or unusable id", () => {
    for (const id of [
      undefined,
      "",
      "with space",
      "-leading-dash",
      "../escape",
    ]) {
      expect(
        thrownBy(() =>
          build({
            pluginId: "@vitnode/example",
            routes: [{ entry: "routes/x", id, path: "/x" }],
          }),
        ).code,
      ).toBe("invalid-id");
    }
  });

  it("rejects a missing or malformed path", () => {
    for (const path of [undefined, "", "x", "/x/[id]"]) {
      const error = thrownBy(() =>
        build({
          pluginId: "@vitnode/example",
          routes: [{ entry: "routes/x", id: "x", path }],
        }),
      );

      expect(error.code).toBe("invalid-path");
      expect(error.routeId).toBe("x");
    }
  });

  it("rejects an entry an application could never import", () => {
    for (const entry of [
      undefined,
      "",
      "/routes/x",
      "routes/../../secret",
      "routes/x.tsx",
      "routes/x'\\n",
    ]) {
      expect(
        thrownBy(() =>
          build({
            pluginId: "@vitnode/example",
            routes: [{ entry, id: "x", path: "/x" }],
          }),
        ).code,
      ).toBe("invalid-entry");
    }
  });

  it("rejects an unknown area", () => {
    const error = thrownBy(() =>
      build({
        pluginId: "@vitnode/example",
        routes: [{ area: "admin", entry: "routes/x", id: "x", path: "/x" }],
      }),
    );

    expect(error.code).toBe("invalid-area");
    expect(error.message).toContain("main");
  });
});
