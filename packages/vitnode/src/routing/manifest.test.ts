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
import { PLUGIN_ROUTE_AREAS } from "./types";

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
      kind: "page",
      namespaces: [],
      parentId: null,
      path: "/example/x",
      pluginId: "@vitnode/example",
      requires: null,
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

  /**
   * A path a router would match case-insensitively but this layer would compare
   * as two different strings. Rejected here rather than lowercased, and the
   * failure names the plugin - see `path.test.ts` for the rule itself.
   */
  it("rejects an uppercase path, naming the plugin", () => {
    const error = thrownBy(() =>
      build({
        pluginId: "@vitnode/example",
        routes: [{ entry: "routes/x", id: "x", path: "/Example" }],
      }),
    );

    expect(error.code).toBe("invalid-path");
    expect(error.pluginId).toBe("@vitnode/example");
    expect(error.message).toContain('Write "example"');
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

  /**
   * `blank`, `api`, `settings`, `moderator` - every area somebody might assume
   * exists. Two do, and a member is added by a stage that has a shell to point
   * it at, never by a plugin declaring one.
   */
  it("rejects an unknown area", () => {
    const error = thrownBy(() =>
      build({
        pluginId: "@vitnode/example",
        routes: [{ area: "blank", entry: "routes/x", id: "x", path: "/x" }],
      }),
    );

    expect(error.code).toBe("invalid-area");
    expect(error.message).toContain("admin, main");
  });
});

/**
 * The AdminCP, as a place a plugin may put a page - Stage 12's one addition to
 * this layer.
 *
 * An area chooses a shell and never rewrites a path, which is what every
 * assertion here is ultimately about: an admin route says `/admin/…` in full,
 * two areas at one pathname are two URLs, and a subtree renders in one shell.
 */
describe("the admin area", () => {
  const one = (route: Partial<PluginRouteDefinition>) =>
    buildPluginRouteManifest([
      {
        pluginId: "@vitnode/example",
        routes: [
          { entry: "routes/x", id: "x", path: "/admin/reports", ...route },
        ],
      },
    ])[0];

  it("is an area a route may declare", () => {
    expect(one({ area: "admin" })).toMatchObject({
      area: "admin",
      path: "/admin/reports",
    });
  });

  /**
   * The invariant the whole design rests on. Nothing prefixes a path from an
   * area, so a manifest is readable - and a collision visible in a diff -
   * without anybody walking a graph to find out where a page actually is.
   */
  it("does not prefix, rewrite or infer the path", () => {
    expect(one({ area: "admin", path: "/admin/reports/:id" })).toMatchObject({
      path: "/admin/reports/:id",
      segments: [
        { kind: "static", value: "admin" },
        { kind: "static", value: "reports" },
        { kind: "param", name: "id" },
      ],
    });

    // And an admin-area route is not *made* to live under `/admin` either. The
    // area names a shell; where that shell's own routes sit is the host's.
    expect(one({ area: "admin", path: "/reports" })).toMatchObject({
      area: "admin",
      path: "/reports",
    });
  });

  it("does not collide with the same pathname in another area", () => {
    const manifest = buildPluginRouteManifest([
      example(
        { area: "admin", entry: "routes/a", id: "a", path: "/reports" },
        { entry: "routes/b", id: "b", path: "/reports" },
      ),
    ]);

    expect(manifest.map(route => [route.area, route.path])).toEqual([
      ["admin", "/reports"],
      ["main", "/reports"],
    ]);
  });

  it("collides with another admin route at the same path", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        example({
          area: "admin",
          entry: "routes/a",
          id: "a",
          path: "/admin/reports",
        }),
        blog({
          area: "admin",
          entry: "routes/b",
          id: "b",
          path: "/admin/reports",
        }),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
    expect(error.message).toContain("(admin)");
  });

  /**
   * `requires` is about the public session; the AdminCP runs on a second one
   * under its own cookie, and an admin route is already behind that shell's
   * guard. A field that reads as enforcement and enforces a different session's
   * answer is worse than no field, so it is refused rather than ignored.
   */
  it.each(["authenticated", "guest"] as const)(
    "refuses `requires: %s` on an admin route",
    requires => {
      const error = thrownBy(() => one({ area: "admin", requires }));

      expect(error.code).toBe("requires-in-admin-area");
      expect(error.message).toContain("public session");
    },
  );

  it("still accepts `requires` in the main area", () => {
    expect(one({ requires: "authenticated" })).toMatchObject({
      area: "main",
      requires: "authenticated",
    });
  });

  /**
   * The list is data that other layers iterate - a diagnostic lists it, and the
   * TanStack runtime walks it to hang one subtree per shell - so its order is
   * part of the contract rather than an artefact of how this file was edited.
   *
   * Two members, and only two. `blank`, `api`, `settings` and `moderator` are
   * areas somebody will assume exist; a member is added by a stage that has a
   * shell to point it at.
   */
  it("lists every area in a fixed order", () => {
    expect(PLUGIN_ROUTE_AREAS).toEqual(["admin", "main"]);
    expect([...PLUGIN_ROUTE_AREAS].sort()).toEqual(PLUGIN_ROUTE_AREAS);
  });

  /**
   * Type-level, and checked by `tsc` rather than at runtime: an area is a closed
   * union, so a plugin cannot invent one and have it merely fail validation
   * later.
   */
  it("is a closed union at the type level", () => {
    const admin = {
      area: "admin",
      entry: "routes/x",
      id: "x",
      path: "/admin/reports",
    } satisfies PluginRouteDefinition;

    const invalid = {
      // @ts-expect-error - "blank" is not an area VitNode has.
      area: "blank",
      entry: "routes/x",
      id: "x",
      path: "/x",
    } satisfies PluginRouteDefinition;

    expect([admin.area, invalid.entry]).toEqual(["admin", "routes/x"]);
  });
});

describe("the fields Stage 11 added", () => {
  const one = (route: Partial<PluginRouteDefinition>) =>
    buildPluginRouteManifest([
      {
        pluginId: "@vitnode/example",
        routes: [{ entry: "routes/x", id: "x", path: "/x", ...route }],
      },
    ])[0];

  /**
   * The prototype's three-field declaration still says exactly what it used to,
   * and every new field arrives with its default already filled in - so nothing
   * downstream re-implements "and if it is missing, it means".
   */
  it("defaults every new field", () => {
    expect(one({})).toEqual({
      area: "main",
      entry: "routes/x",
      id: "@vitnode/example:x",
      kind: "page",
      namespaces: [],
      parentId: null,
      path: "/x",
      pluginId: "@vitnode/example",
      requires: null,
      routeId: "x",
      segments: [{ kind: "static", value: "x" }],
    });
  });

  /**
   * A plugin names its own route, and this puts its own plugin's id in front of
   * it - so there is no spelling of `parentId` that reaches another plugin.
   * Cross-plugin nesting is not forbidden by a check, it is unrepresentable.
   */
  it("namespaces a parentId with the declaring plugin", () => {
    const manifest = buildPluginRouteManifest([
      {
        pluginId: "@vitnode/example",
        routes: [
          { entry: "routes/f", id: "frame", kind: "layout", path: "/f" },
          {
            entry: "routes/x",
            id: "x",
            parentId: "frame",
            path: "/f/x",
          },
        ],
      },
    ]);

    expect(manifest.map(route => route.parentId)).toEqual([
      null,
      "@vitnode/example:frame",
    ]);
  });

  it("de-duplicates and sorts declared namespaces", () => {
    expect(
      one({ namespaces: ["core.search", "core.global", "core.search"] })
        .namespaces,
    ).toEqual(["core.global", "core.search"]);
  });

  it.each([
    ["kind", "section", "invalid-kind"],
    ["requires", "admin", "invalid-requires"],
    ["parentId", "@vitnode/blog:frame", "invalid-parent"],
    ["parentId", "/frame", "invalid-parent"],
    ["namespaces", "core.global", "invalid-namespace"],
    ["namespaces", ["core..global"], "invalid-namespace"],
    ["namespaces", ["__proto__"], "invalid-namespace"],
  ])("rejects %s: %s", (field, value, code) => {
    expect(thrownBy(() => one({ [field]: value })).code).toBe(code);
  });

  /**
   * A layout claims no URL, so a layout at `/settings` and the index page inside
   * it both spell `/settings` and are the two halves of one screen rather than a
   * collision. Two *pages* there still are one.
   */
  it("lets a layout and its index route share a path", () => {
    expect(() =>
      buildPluginRouteManifest([
        {
          pluginId: "@vitnode/example",
          routes: [
            {
              entry: "routes/settings",
              id: "settings",
              kind: "layout",
              path: "/settings",
            },
            {
              entry: "routes/settings-index",
              id: "index",
              parentId: "settings",
              path: "/settings",
            },
          ],
        },
      ]),
    ).not.toThrow();
  });

  it("still refuses two pages at one path", () => {
    expect(
      thrownBy(() =>
        buildPluginRouteManifest([
          example(route("a", "/same")),
          blog(route("b", "/same")),
        ]),
      ).code,
    ).toBe("duplicate-path");
  });

  it("refuses two layouts at one path", () => {
    expect(
      thrownBy(() =>
        buildPluginRouteManifest([
          {
            pluginId: "@vitnode/example",
            routes: [
              {
                entry: "routes/a",
                id: "a",
                kind: "layout",
                path: "/f",
              },
              {
                entry: "routes/b",
                id: "b",
                kind: "layout",
                path: "/f",
              },
              { entry: "routes/x", id: "x", parentId: "a", path: "/f/x" },
            ],
          },
        ]),
      ).code,
    ).toBe("duplicate-path");
  });

  /**
   * The hierarchy is validated here rather than only where it is used, so a
   * broken `parentId` stops a build instead of producing a generated manifest
   * that fails in a browser.
   */
  it("fails the build on a hierarchy that does not hold together", () => {
    expect(
      thrownBy(() =>
        buildPluginRouteManifest([
          example({
            entry: "routes/x",
            id: "x",
            parentId: "ghost",
            path: "/x",
          }),
        ]),
      ).code,
    ).toBe("unknown-parent");
  });
});
