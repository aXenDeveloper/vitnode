// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRouteDeclaration } from "./tree";

import { PluginRouteError } from "./errors";
import { flattenPluginRoutes, pluginRouteIdFor } from "./flatten";
import {
  definePluginRoutes,
  index,
  isPluginRouteLazyComponent,
  layout,
  lazy,
  page,
} from "./tree";

/**
 * A plugin's route tree, flattened - which is the whole of what an author's
 * `routes.ts` has to survive before anything else in VitNode sees it.
 *
 * Every test here goes through the real helpers rather than building a
 * declaration by hand, because the helpers are the API: what `page()`,
 * `layout()` and `index()` put on a node is exactly what the flattener is
 * allowed to read, and a test that wrote the node itself would pass while the
 * helpers were broken.
 */
const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

const flatten = (...routes: PluginRouteDeclaration[]) =>
  flattenPluginRoutes("@acme/catalog", definePluginRoutes(routes));

/**
 * A declaration with a field the types do not allow.
 *
 * Which is the only way to test the diagnostics that exist for a plugin written
 * in JavaScript: `search` on a layout and `area` on a nested route are both
 * compile errors, and both still have to fail loudly rather than be dropped.
 */
const withExtra = <TOptions>(
  options: TOptions,
  extra: Record<string, unknown>,
): TOptions => ({ ...options, ...extra });

const thrownBy = (build: () => unknown): PluginRouteError => {
  try {
    build();
  } catch (error) {
    if (error instanceof PluginRouteError) return error;

    throw error;
  }

  throw new Error("expected a PluginRouteError");
};

describe("lazy", () => {
  it("does not call the import until somebody asks for the module", async () => {
    let called = 0;
    const component = lazy(async () => {
      called += 1;

      return await Promise.resolve({ default: () => null });
    });

    expect(called).toBe(0);
    expect(isPluginRouteLazyComponent(component)).toBe(true);

    await component.load();

    expect(called).toBe(1);
  });

  it("is not satisfied by a bare function", () => {
    expect(isPluginRouteLazyComponent(() => null)).toBe(false);
    expect(isPluginRouteLazyComponent({ load: () => null })).toBe(false);
  });
});

describe("a simple page", () => {
  it("is one route at the path it declared", () => {
    expect(flatten(page("/catalog", { component: lazyPage() }))).toMatchObject([
      {
        area: "main",
        kind: "page",
        messages: [],
        parentId: null,
        path: "/catalog",
        requires: null,
        routeId: "page#/catalog",
        search: null,
      },
    ]);
  });

  it("carries the component it declared, unwrapped", async () => {
    const component = lazyPage();
    const [route] = flatten(page("/catalog", { component }));

    expect(route.component).toBe(component);
    await expect(route.component.load()).resolves.toHaveProperty("default");
  });
});

describe("a nested tree", () => {
  const tree = () =>
    flatten(
      layout("/catalog", {
        component: lazyPage(),
        messages: ["@acme/catalog"],
        children: [
          page("dashboard", { component: lazyPage() }),
          layout("products", {
            component: lazyPage(),
            children: [
              index({ component: lazyPage() }),
              layout(":categorySlug", {
                component: lazyPage(),
                children: [
                  index({ component: lazyPage() }),
                  page(":productId", { component: lazyPage() }),
                ],
              }),
            ],
          }),
        ],
      }),
    );

  it("flattens parents before children", () => {
    expect(tree().map(route => route.routeId)).toEqual([
      "layout#/catalog",
      "page#/catalog/dashboard",
      "layout#/catalog/products",
      "page#/catalog/products",
      "layout#/catalog/products/:categorySlug",
      "page#/catalog/products/:categorySlug",
      "page#/catalog/products/:categorySlug/:productId",
    ]);
  });

  it("joins every relative path onto its parent's", () => {
    expect(tree().map(route => route.path)).toEqual([
      "/catalog",
      "/catalog/dashboard",
      "/catalog/products",
      "/catalog/products",
      "/catalog/products/:categorySlug",
      "/catalog/products/:categorySlug",
      "/catalog/products/:categorySlug/:productId",
    ]);
  });

  it("makes an index route claim exactly its layout's URL", () => {
    const routes = tree();
    const products = routes.find(
      route => route.routeId === "layout#/catalog/products",
    );
    const indexRoute = routes.find(
      route => route.routeId === "page#/catalog/products",
    );

    expect(indexRoute?.path).toBe(products?.path);
    expect(indexRoute?.parentId).toBe("layout#/catalog/products");
  });

  it("points each child at the layout it was written inside", () => {
    expect(tree().map(route => [route.routeId, route.parentId])).toEqual([
      ["layout#/catalog", null],
      ["page#/catalog/dashboard", "layout#/catalog"],
      ["layout#/catalog/products", "layout#/catalog"],
      ["page#/catalog/products", "layout#/catalog/products"],
      ["layout#/catalog/products/:categorySlug", "layout#/catalog/products"],
      [
        "page#/catalog/products/:categorySlug",
        "layout#/catalog/products/:categorySlug",
      ],
      [
        "page#/catalog/products/:categorySlug/:productId",
        "layout#/catalog/products/:categorySlug",
      ],
    ]);
  });

  it("parses a dynamic segment into a parameter", () => {
    const product = tree().at(-1);

    expect(product?.segments).toEqual([
      { kind: "static", value: "catalog" },
      { kind: "static", value: "products" },
      { kind: "param", name: "categorySlug" },
      { kind: "param", name: "productId" },
    ]);
  });
});

describe("derived route ids", () => {
  it("are the route's kind and its full path", () => {
    expect(pluginRouteIdFor("page", "/catalog/dashboard")).toBe(
      "page#/catalog/dashboard",
    );
    expect(pluginRouteIdFor("layout", "/catalog")).toBe("layout#/catalog");
  });

  it("tell a layout from the index page inside it", () => {
    const routes = flatten(
      layout("/catalog", {
        component: lazyPage(),
        children: [index({ component: lazyPage() })],
      }),
    );

    expect(routes.map(route => route.routeId)).toEqual([
      "layout#/catalog",
      "page#/catalog",
    ]);
  });

  it("cannot be declared by a plugin", () => {
    // The types have no `id`, and the flattened route's is derived - so a
    // declaration that tried to carry one is ignored rather than honoured.
    const [route] = flatten(
      page("/catalog", withExtra({ component: lazyPage() }, { id: "mine" })),
    );

    expect(route.routeId).toBe("page#/catalog");
  });
});

describe("paths", () => {
  it("requires a top-level path to be absolute", () => {
    const error = thrownBy(() =>
      flatten(page("catalog", { component: lazyPage() })),
    );

    expect(error.code).toBe("invalid-path");
    expect(error.message).toContain('write "/catalog"');
  });

  it("requires a nested path to be relative", () => {
    const error = thrownBy(() =>
      flatten(
        layout("/catalog", {
          component: lazyPage(),
          children: [page("/catalog/dashboard", { component: lazyPage() })],
        }),
      ),
    );

    expect(error.code).toBe("invalid-path");
    expect(error.message).toContain('write "catalog/dashboard"');
  });

  it("refuses a path VitNode does not represent", () => {
    expect(
      thrownBy(() => flatten(page("/Catalog", { component: lazyPage() }))).code,
    ).toBe("invalid-path");
    expect(
      thrownBy(() => flatten(page("/catalog/$id", { component: lazyPage() })))
        .message,
    ).toContain('write ":id"');
    expect(
      thrownBy(() => flatten(page("/catalog/[id]", { component: lazyPage() })))
        .message,
    ).toContain('write ":id"');
  });
});

describe("the shape of a tree", () => {
  it("refuses a layout with no children", () => {
    const error = thrownBy(() =>
      flatten(layout("/catalog", { component: lazyPage(), children: [] })),
    );

    expect(error.code).toBe("childless-layout");
    expect(error.message).toContain("index()");
  });

  it("refuses an index route with no layout around it", () => {
    const error = thrownBy(() => flatten(index({ component: lazyPage() })));

    expect(error.code).toBe("invalid-tree");
    expect(error.message).toContain("top level");
  });

  it("refuses a node that did not come from page(), layout() or index()", () => {
    const error = thrownBy(() =>
      flattenPluginRoutes("@acme/catalog", [
        { component: lazyPage(), path: "/catalog" },
      ]),
    );

    expect(error.code).toBe("invalid-tree");
    expect(error.message).toContain("page(), layout() or index()");
  });

  it("refuses routes that are not an array", () => {
    expect(
      thrownBy(() => flattenPluginRoutes("@acme/catalog", { nope: true })).code,
    ).toBe("malformed-route");
  });

  it("is empty when a plugin declares nothing", () => {
    expect(flattenPluginRoutes("@acme/catalog", undefined)).toEqual([]);
    expect(flatten()).toEqual([]);
  });

  it("refuses a hand-written array through definePluginRoutes too", () => {
    expect(() =>
      definePluginRoutes([
        { component: lazyPage(), path: "/catalog" },
      ] as unknown as PluginRouteDeclaration[]),
    ).toThrow(/page\(\), layout\(\) or index\(\)/);
  });
});

describe("components", () => {
  it("refuses a component that is not lazy", () => {
    const error = thrownBy(() =>
      flatten(
        page("/catalog", {
          component: (() => null) as unknown as ReturnType<typeof lazyPage>,
        }),
      ),
    );

    expect(error.code).toBe("eager-component");
    expect(error.message).toContain("initial bundle");
    expect(error.message).toContain('lazy(() => import("./pages/my-page"))');
  });

  it("refuses a plain module object, which is the other way to be eager", () => {
    const error = thrownBy(() =>
      flatten(
        page("/catalog", {
          component: { default: () => null } as unknown as ReturnType<
            typeof lazyPage
          >,
        }),
      ),
    );

    expect(error.code).toBe("eager-component");
  });
});

describe("the eager search schema", () => {
  it("is carried through for a page", () => {
    const search = () => ({ page: 1 });
    const [route] = flatten(
      page("/catalog", { component: lazyPage(), search }),
    );

    expect(route.search).toBe(search);
  });

  it("is carried through for an index route", () => {
    const search = () => ({ page: 1 });
    const routes = flatten(
      layout("/catalog", {
        component: lazyPage(),
        children: [index({ component: lazyPage(), search })],
      }),
    );

    expect(routes[1].search).toBe(search);
  });

  it("is refused on a layout, which claims no URL of its own", () => {
    const error = thrownBy(() =>
      flatten(
        layout(
          "/catalog",
          withExtra(
            {
              component: lazyPage(),
              children: [index({ component: lazyPage() })],
            },
            { search: () => ({}) },
          ),
        ),
      ),
    );

    expect(error.code).toBe("invalid-search");
    expect(error.message).toContain("claims no URL of its own");
  });

  it("is refused when it is not a function", () => {
    expect(
      thrownBy(() =>
        flatten(
          page(
            "/catalog",
            withExtra({ component: lazyPage() }, { search: { page: 1 } }),
          ),
        ),
      ).code,
    ).toBe("invalid-search");
  });
});

describe("messages", () => {
  it("are de-duplicated and sorted", () => {
    const [route] = flatten(
      page("/catalog", {
        component: lazyPage(),
        messages: ["@acme/catalog.b", "@acme/catalog.a", "@acme/catalog.b"],
      }),
    );

    expect(route.messages).toEqual(["@acme/catalog.a", "@acme/catalog.b"]);
  });

  it("stay on the route that declared them", () => {
    const routes = flatten(
      layout("/catalog", {
        component: lazyPage(),
        messages: ["@acme/catalog"],
        children: [index({ component: lazyPage() })],
      }),
    );

    expect(routes.map(route => route.messages)).toEqual([
      ["@acme/catalog"],
      [],
    ]);
  });

  it("refuse a namespace VitNode cannot warm", () => {
    expect(
      thrownBy(() =>
        flatten(
          page("/catalog", { component: lazyPage(), messages: ["", "x"] }),
        ),
      ).code,
    ).toBe("invalid-namespace");
    expect(
      thrownBy(() =>
        flatten(
          page(
            "/catalog",
            withExtra({ component: lazyPage() }, { messages: "nope" }),
          ),
        ),
      ).code,
    ).toBe("invalid-namespace");
  });
});

describe("the area", () => {
  it("defaults to the public site", () => {
    expect(flatten(page("/catalog", { component: lazyPage() }))[0].area).toBe(
      "main",
    );
  });

  it("is inherited by every route inside a layout", () => {
    const routes = flatten(
      layout("/admin/catalog", {
        area: "admin",
        component: lazyPage(),
        children: [
          index({ component: lazyPage() }),
          page("products", { component: lazyPage() }),
        ],
      }),
    );

    expect(routes.map(route => route.area)).toEqual([
      "admin",
      "admin",
      "admin",
    ]);
  });

  it("may not be declared by a nested route", () => {
    const error = thrownBy(() =>
      flatten(
        layout("/catalog", {
          component: lazyPage(),
          children: [
            index(withExtra({ component: lazyPage() }, { area: "admin" })),
          ],
        }),
      ),
    );

    expect(error.code).toBe("invalid-area");
    expect(error.message).toContain("Only a top-level route chooses its shell");
  });

  it("refuses an area VitNode does not have", () => {
    expect(
      thrownBy(() =>
        flatten(
          page(
            "/catalog",
            withExtra({ component: lazyPage() }, { area: "blank" }),
          ),
        ),
      ).code,
    ).toBe("invalid-area");
  });

  it("does not prefix the path it frames", () => {
    const [route] = flatten(
      page("/admin/catalog", { area: "admin", component: lazyPage() }),
    );

    expect(route.path).toBe("/admin/catalog");
  });
});

describe("requires", () => {
  it("is carried through on the public site", () => {
    const [route] = flatten(
      page("/catalog", { component: lazyPage(), requires: "authenticated" }),
    );

    expect(route.requires).toBe("authenticated");
  });

  it("is refused in the AdminCP, which has its own session", () => {
    const error = thrownBy(() =>
      flatten(
        page("/admin/catalog", {
          area: "admin",
          component: lazyPage(),
          requires: "authenticated",
        }),
      ),
    );

    expect(error.code).toBe("requires-in-admin-area");
  });

  it("refuses a requirement VitNode does not have", () => {
    expect(
      thrownBy(() =>
        flatten(
          page(
            "/catalog",
            withExtra({ component: lazyPage() }, { requires: "staff" }),
          ),
        ),
      ).code,
    ).toBe("invalid-requires");
  });
});
