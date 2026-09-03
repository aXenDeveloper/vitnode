// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRouteDeclaration } from "./tree";
import type { PluginRouteArea } from "./types";

import { PluginRouteError } from "./errors";
import {
  buildPluginRouteManifest,
  compilePluginRouteTrees,
  pluginRouteId,
} from "./manifest";
import { comparePluginRoutes } from "./order";
import { definePluginRoutes, index, layout, lazy, page } from "./tree";
import { PLUGIN_ROUTE_AREAS } from "./types";

const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

const catalog = (...routes: PluginRouteDeclaration[]) => ({
  pluginId: "@acme/catalog",
  routes: definePluginRoutes(routes),
});

const blog = (...routes: PluginRouteDeclaration[]) => ({
  pluginId: "@acme/blog",
  routes: definePluginRoutes(routes),
});

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
    expect(pluginRouteId("@acme/catalog", "page#/catalog")).toBe(
      "@acme/catalog:page#/catalog",
    );
  });

  it("lets two plugins claim their own paths without knowing about each other", () => {
    const manifest = buildPluginRouteManifest([
      catalog(page("/catalog", { component: lazyPage() })),
      blog(page("/blog", { component: lazyPage() })),
    ]);

    expect(manifest.map(route => route.id)).toEqual([
      "@acme/blog:page#/blog",
      "@acme/catalog:page#/catalog",
    ]);
  });

  it("namespaces a parent id with the declaring plugin", () => {
    const [frame, indexRoute] = buildPluginRouteManifest([
      catalog(
        layout("/catalog", {
          component: lazyPage(),
          children: [index({ component: lazyPage() })],
        }),
      ),
    ]);

    expect(frame.parentId).toBeNull();
    expect(indexRoute.parentId).toBe("@acme/catalog:layout#/catalog");
  });
});

describe("what a compiled tree carries", () => {
  const compiled = () =>
    compilePluginRouteTrees([
      catalog(
        page("/catalog", {
          component: lazyPage(),
          search: () => ({ page: 1 }),
        }),
        page("/catalog/about", { component: lazyPage() }),
      ),
    ]);

  it("keys every route's component by the route's own id", () => {
    const { components, manifest } = compiled();

    expect([...components.keys()].sort()).toEqual(
      manifest.map(route => route.id).sort(),
    );
  });

  it("keys only the routes that declared a search schema", () => {
    expect([...compiled().searchValidators.keys()]).toEqual([
      "@acme/catalog:page#/catalog",
    ]);
  });

  it("is empty when nothing declares a route", () => {
    const { components, manifest, searchValidators } = compilePluginRouteTrees([
      { pluginId: "@acme/catalog" },
      { pluginId: "@acme/blog", routes: definePluginRoutes([]) },
    ]);

    expect(manifest).toEqual([]);
    expect(components.size).toBe(0);
    expect(searchValidators.size).toBe(0);
  });
});

describe("normalising a declaration", () => {
  it("fills in the defaults a plugin left out", () => {
    expect(
      buildPluginRouteManifest([
        catalog(page("/catalog/:productId", { component: lazyPage() })),
      ]),
    ).toEqual([
      {
        area: "main",
        id: "@acme/catalog:page#/catalog/:productId",
        kind: "page",
        messages: [],
        parentId: null,
        path: "/catalog/:productId",
        pluginId: "@acme/catalog",
        requires: null,
        routeId: "page#/catalog/:productId",
        segments: [
          { kind: "static", value: "catalog" },
          { kind: "param", name: "productId" },
        ],
      },
    ]);
  });

  it("keeps an explicit area", () => {
    const [route] = buildPluginRouteManifest([
      catalog(page("/admin/catalog", { area: "admin", component: lazyPage() })),
    ]);

    expect(route.area).toBe("admin");
  });
});

describe("ordering is decided by the paths, not by the registration order", () => {
  const paths = (...sources: Parameters<typeof buildPluginRouteManifest>[0]) =>
    buildPluginRouteManifest(sources).map(route => route.path);

  it("puts static segments before parameters at the same depth", () => {
    expect(
      paths(
        catalog(
          page("/catalog/:productId", { component: lazyPage() }),
          page("/catalog/new", { component: lazyPage() }),
        ),
      ),
    ).toEqual(["/catalog/new", "/catalog/:productId"]);
  });

  it("gives the same order whichever plugin registered first", () => {
    const one = catalog(page("/catalog", { component: lazyPage() }));
    const two = blog(page("/blog", { component: lazyPage() }));

    expect(paths(one, two)).toEqual(paths(two, one));
  });

  it("puts a layout in front of the index page inside it", () => {
    const manifest = buildPluginRouteManifest([
      catalog(
        layout("/catalog", {
          component: lazyPage(),
          children: [index({ component: lazyPage() })],
        }),
      ),
    ]);

    expect(manifest.map(route => route.kind)).toEqual(["layout", "page"]);
  });

  it("is a total order, so sorting a manifest again is a no-op", () => {
    const manifest = buildPluginRouteManifest([
      catalog(
        layout("/catalog", {
          component: lazyPage(),
          children: [
            index({ component: lazyPage() }),
            page(":productId", { component: lazyPage() }),
          ],
        }),
      ),
      blog(page("/blog", { component: lazyPage() })),
    ]);

    expect([...manifest].sort(comparePluginRoutes)).toEqual(manifest);
  });
});

describe("collisions are errors, never resolutions", () => {
  it("names both plugins when two claim the same path", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(page("/catalog", { component: lazyPage() })),
        blog(page("/catalog", { component: lazyPage() })),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
    expect(error.pluginId).toBe("@acme/blog");
    expect(error.conflictsWith?.pluginId).toBe("@acme/catalog");
    expect(error.message).toContain("@acme/catalog");
    expect(error.message).toContain("@acme/blog");
  });

  it("treats two paths that differ only by a parameter name as one path", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(page("/catalog/:productId", { component: lazyPage() })),
        blog(page("/catalog/:slug", { component: lazyPage() })),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
  });

  it("collides across areas, because a shell is pathless", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(page("/reports", { area: "admin", component: lazyPage() })),
        blog(page("/reports", { component: lazyPage() })),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
  });

  it("rejects one plugin declaring the same route twice", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(
          page("/catalog", { component: lazyPage() }),
          page("/catalog", { component: lazyPage() }),
        ),
      ]),
    );

    expect(error.code).toBe("duplicate-id");
    expect(error.message).toContain("two pages");
  });

  it("refuses two layouts at one path", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(
          layout("/catalog", {
            component: lazyPage(),
            children: [index({ component: lazyPage() })],
          }),
        ),
        blog(
          layout("/catalog", {
            component: lazyPage(),
            children: [index({ component: lazyPage() })],
          }),
        ),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
  });

  it("lets a layout and the index page inside it share a path", () => {
    expect(
      buildPluginRouteManifest([
        catalog(
          layout("/catalog", {
            component: lazyPage(),
            children: [index({ component: lazyPage() })],
          }),
        ),
      ]).map(route => [route.kind, route.path]),
    ).toEqual([
      ["layout", "/catalog"],
      ["page", "/catalog"],
    ]);
  });

  it("refuses another plugin's page at a layout's path", () => {
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(
          layout("/catalog", {
            component: lazyPage(),
            children: [index({ component: lazyPage() })],
          }),
        ),
        blog(page("/catalog", { component: lazyPage() })),
      ]),
    );

    expect(error.code).toBe("duplicate-path");
  });
});

describe("malformed sources", () => {
  it("rejects a plugin with no id", () => {
    expect(
      thrownBy(() =>
        buildPluginRouteManifest([
          { pluginId: "", routes: definePluginRoutes([]) },
        ]),
      ).code,
    ).toBe("invalid-plugin-id");
  });

  it("fails on a hierarchy that does not hold together", () => {
    // A `guest` page inside an `authenticated` layout: no visitor could ever
    // reach it, and the graph is what says so.
    const error = thrownBy(() =>
      buildPluginRouteManifest([
        catalog(
          layout("/catalog", {
            component: lazyPage(),
            requires: "authenticated",
            children: [index({ component: lazyPage(), requires: "guest" })],
          }),
        ),
      ]),
    );

    expect(error.code).toBe("conflicting-requires");
  });
});

describe("the areas", () => {
  it("are listed in a fixed order", () => {
    expect(PLUGIN_ROUTE_AREAS).toEqual(["admin", "main"]);
  });

  it("are a closed union at the type level", () => {
    const areas: PluginRouteArea[] = ["admin", "main"];

    expect(areas).toHaveLength(PLUGIN_ROUTE_AREAS.length);
  });
});
