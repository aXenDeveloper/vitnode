// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRouteDeclaration } from "../../routing/tree.js";
import type { PluginRouteCompilerSource } from "./compile.js";

import { PluginRouteError } from "../../routing/errors.js";
import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "../../routing/tree.js";
import { compilePluginRoutes } from "./compile.js";
import { hostRoutePathsFromFiles } from "./host-routes.js";

/**
 * The whole build-time compilation, from what plugins declare to the one file an
 * app holds.
 *
 * Nothing here touches a filesystem: what is asserted is the part that has to be
 * *exactly* reproducible, and the diagnostics a plugin author actually reads.
 * Whether a page's module exists on disk is the Vite layer's question, and
 * `lazyImportSpecifier` is what lets it ask.
 */
const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

const source = (
  pluginId: string,
  ...routes: PluginRouteDeclaration[]
): PluginRouteCompilerSource => ({
  pluginId,
  routes: definePluginRoutes(routes),
  routesSpecifier: `${pluginId}/routes`,
});

const compile = (...sources: PluginRouteCompilerSource[]) =>
  compilePluginRoutes({ sources });

const thrownBy = (build: () => unknown): Error => {
  try {
    build();
  } catch (error) {
    if (error instanceof Error) return error;

    throw error;
  }

  throw new Error("expected a failure");
};

describe("compilePluginRoutes", () => {
  it("compiles a plugin's tree into a manifest, its components and one source", () => {
    const compiled = compile(
      source(
        "@vitnode/example",
        page("/example", { component: lazyPage() }),
        layout("/example/guide", {
          component: lazyPage(),
          messages: ["@vitnode/example.guide"],
          children: [
            index({ component: lazyPage() }),
            page(":topic", { component: lazyPage() }),
          ],
        }),
      ),
    );

    expect(compiled.manifest.map(route => [route.kind, route.path])).toEqual([
      ["page", "/example"],
      ["layout", "/example/guide"],
      ["page", "/example/guide"],
      ["page", "/example/guide/:topic"],
    ]);
    expect(compiled.components.size).toBe(4);
    expect(compiled.modules).toEqual([
      { pluginId: "@vitnode/example", specifier: "@vitnode/example/routes" },
    ]);
    expect(compiled.source).toContain(
      "import { routes as pluginRoutes0 } from '@vitnode/example/routes'",
    );
  });

  it("compiles nothing at all for an app with no plugins", () => {
    const compiled = compile();

    expect(compiled.manifest).toEqual([]);
    expect(compiled.modules).toEqual([]);
    expect(compiled.source).toContain("export const pluginRouteSources = []");
  });

  it("imports a plugin that resolves a routes module but declares none", () => {
    // Importing it is harmless and keeps the dev server's watcher meaningful:
    // the file exists, so adding the first route to it regenerates rather than
    // requiring a restart.
    const compiled = compile(source("@vitnode/example"));

    expect(compiled.manifest).toEqual([]);
    expect(compiled.modules).toHaveLength(1);
  });

  it("leaves out a plugin with no routes module at all", () => {
    const compiled = compilePluginRoutes({
      sources: [{ pluginId: "@vitnode/blog" }],
    });

    expect(compiled.modules).toEqual([]);
    expect(compiled.source).toContain("export const pluginRouteSources = []");
  });
});

describe("determinism", () => {
  const one = () =>
    source("@vitnode/example", page("/example", { component: lazyPage() }));
  const two = () =>
    source("@acme/blog", page("/blog", { component: lazyPage() }));

  it("produces the same bytes whichever order the plugins were configured in", () => {
    expect(compile(one(), two()).source).toBe(compile(two(), one()).source);
  });

  it("produces the same manifest whichever order they were configured in", () => {
    expect(compile(one(), two()).manifest).toEqual(
      compile(two(), one()).manifest,
    );
  });

  it("sorts static paths before the dynamic ones that shadow them", () => {
    expect(
      compile(
        source(
          "@vitnode/example",
          page("/example/:id", { component: lazyPage() }),
          page("/example/new", { component: lazyPage() }),
        ),
      ).manifest.map(route => route.path),
    ).toEqual(["/example/new", "/example/:id"]);
  });
});

describe("one snapshot, one file", () => {
  it("keys a component for every route in the manifest", () => {
    const compiled = compile(
      source(
        "@vitnode/example",
        layout("/example", {
          component: lazyPage(),
          children: [index({ component: lazyPage() })],
        }),
      ),
    );

    for (const route of compiled.manifest) {
      expect(compiled.components.get(route.id)).toBeDefined();
    }
  });

  it("writes the file from the plugins that survived validation", () => {
    // A tree that cannot be flattened fails the whole compilation, so there is
    // no state in which a broken plugin leaves a stale import behind.
    expect(
      thrownBy(() =>
        compile(
          source(
            "@vitnode/example",
            page("/example", { component: lazyPage() }),
          ),
          source("@acme/blog", page("blog", { component: lazyPage() })),
        ),
      ).message,
    ).toContain("A top-level page in @acme/blog");
  });

  it("names no page module in the generated source", () => {
    const compiled = compile(
      source("@vitnode/example", page("/example", { component: lazyPage() })),
    );

    expect(compiled.source).not.toContain("pages/");
  });
});

describe("enabling and disabling a plugin", () => {
  const example = () =>
    source("@vitnode/example", page("/example", { component: lazyPage() }));
  const blog = () =>
    source("@acme/blog", page("/blog", { component: lazyPage() }));

  it("leaves a disabled plugin no route and no import", () => {
    const compiled = compile(example());

    expect(compiled.source).not.toContain("@acme/blog");
    expect(compiled.manifest.map(route => route.pluginId)).toEqual([
      "@vitnode/example",
    ]);
  });

  it("is the same compilation whether a plugin was never there or removed", () => {
    expect(compile(example()).source).toBe(compile(example()).source);
    expect(compile(example(), blog()).source).not.toBe(
      compile(example()).source,
    );
  });

  it("follows a changed path", () => {
    const moved = compile(
      source("@vitnode/example", page("/moved", { component: lazyPage() })),
    );

    expect(moved.manifest[0].path).toBe("/moved");
    expect(moved.manifest[0].id).toBe("@vitnode/example:page#/moved");
  });
});

describe("diagnostics", () => {
  it("names the module a colliding route was declared in", () => {
    const error = thrownBy(() =>
      compile(
        source("@vitnode/example", page("/example", { component: lazyPage() })),
        source("@acme/blog", page("/example", { component: lazyPage() })),
      ),
    );

    expect(error).toBeInstanceOf(PluginRouteError);
    expect(error.message).toContain("[VitNode plugin routes]");
    expect(error.message).toContain('Declared in "@acme/blog/routes"');
    expect(error.message).toContain('is declared in "@vitnode/example/routes"');
  });

  it("names the module of a route that is illegal on its own", () => {
    expect(
      thrownBy(() =>
        compile(source("@acme/blog", page("/Blog", { component: lazyPage() }))),
      ).message,
    ).toContain('Declared in "@acme/blog/routes"');
  });

  it("rejects a plugin route that shadows one of the application's own", () => {
    const error = thrownBy(() =>
      compilePluginRoutes({
        hostRoutes: hostRoutePathsFromFiles(["_main/discover.tsx"]),
        sources: [
          source(
            "@vitnode/example",
            page("/discover", { component: lazyPage() }),
          ),
        ],
      }),
    );

    expect(error.message).toContain("/discover");
    expect(error.message).toContain("_main/discover.tsx");
  });

  it("does not confuse a static host route with a dynamic plugin one", () => {
    expect(() =>
      compilePluginRoutes({
        hostRoutes: hostRoutePathsFromFiles(["_main/example.new.tsx"]),
        sources: [
          source(
            "@vitnode/example",
            page("/example/:id", { component: lazyPage() }),
          ),
        ],
      }),
    ).not.toThrow();
  });
});

describe("the admin area", () => {
  const admin = () =>
    source(
      "@vitnode/example",
      page("/admin/example", { area: "admin", component: lazyPage() }),
    );

  it("carries the area into the manifest", () => {
    expect(compile(admin()).manifest[0]).toMatchObject({
      area: "admin",
      path: "/admin/example",
    });
  });

  it("generates the same one static import a public route gets", () => {
    expect(compile(admin()).modules).toEqual([
      { pluginId: "@vitnode/example", specifier: "@vitnode/example/routes" },
    ]);
  });

  it("refuses an admin route and a public route at one pathname", () => {
    expect(
      thrownBy(() =>
        compile(
          admin(),
          source(
            "@acme/blog",
            page("/admin/example", { component: lazyPage() }),
          ),
        ),
      ).message,
    ).toContain("path collision");
  });
});

describe("hierarchy", () => {
  it("carries a nested route's parent as a namespaced id", () => {
    const compiled = compile(
      source(
        "@vitnode/example",
        layout("/example/guide", {
          component: lazyPage(),
          children: [page(":topic", { component: lazyPage() })],
        }),
      ),
    );

    expect(compiled.manifest.map(route => [route.id, route.parentId])).toEqual([
      ["@vitnode/example:layout#/example/guide", null],
      [
        "@vitnode/example:page#/example/guide/:topic",
        "@vitnode/example:layout#/example/guide",
      ],
    ]);
  });

  it("fails the build on a layout with nothing inside it", () => {
    expect(
      thrownBy(() =>
        compile(
          source(
            "@vitnode/example",
            layout("/example", { component: lazyPage(), children: [] }),
          ),
        ),
      ).message,
    ).toContain("layout with no `children`");
  });
});
