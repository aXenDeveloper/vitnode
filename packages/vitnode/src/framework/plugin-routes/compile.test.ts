// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { PluginRouteDefinition } from "../../routing/types.js";
import type { PluginRouteCompilerSource } from "./compile.js";

import { PluginRouteError } from "../../routing/errors.js";
import { compilePluginRoutes } from "./compile.js";

const page = (id: string, path: string): PluginRouteDefinition => ({
  entry: `routes/${id}`,
  id,
  path,
});

const plugin = (
  pluginId: string,
  ...routes: PluginRouteDefinition[]
): PluginRouteCompilerSource => ({
  manifestSpecifier: `${pluginId}/routes/manifest`,
  pluginId,
  routes,
});

const example = (...routes: PluginRouteDefinition[]) =>
  plugin("@vitnode/example", ...routes);

const blog = (...routes: PluginRouteDefinition[]) =>
  plugin("@vitnode/blog", ...routes);

const compile = (...sources: PluginRouteCompilerSource[]) =>
  compilePluginRoutes({ sources });

/** The message a call threw. `expect().toThrow` cannot narrow to a type. */
const messageOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("expected a failure");
};

describe("compilePluginRoutes", () => {
  it("compiles a plugin's routes into a manifest and a module registry", () => {
    const { manifest, modules } = compile(example(page("hello", "/hello")));

    expect(manifest).toEqual([
      {
        area: "main",
        entry: "routes/hello",
        id: "@vitnode/example:hello",
        kind: "page",
        namespaces: [],
        parentId: null,
        path: "/hello",
        pluginId: "@vitnode/example",
        requires: null,
        routeId: "hello",
        searchEntry: null,
        segments: [{ kind: "static", value: "hello" }],
      },
    ]);
    expect(modules).toEqual([
      {
        entry: "routes/hello",
        key: "@vitnode/example:hello",
        pluginId: "@vitnode/example",
        routeId: "hello",
        specifier: "@vitnode/example/routes/hello",
      },
    ]);
  });

  it("compiles nothing at all for an app with no plugins", () => {
    const { manifest, manifestSource, modules, registrySource } =
      compilePluginRoutes({ sources: [] });

    expect(manifest).toEqual([]);
    expect(modules).toEqual([]);
    expect(manifestSource).toContain("export const pluginRouteManifest = []");
    expect(registrySource).toContain("export const pluginRouteModules = {}");
  });

  it("compiles nothing for a plugin that ships no routes", () => {
    // Most plugins are AdminCP content types with no pages at all, and a
    // missing route manifest has to mean "none" rather than failing a build.
    expect(
      compile({ pluginId: "@vitnode/blog" }, example(page("hello", "/hello")))
        .modules,
    ).toHaveLength(1);
  });

  it("carries every field of the contract into the generated manifest", () => {
    const { manifestSource } = compile(
      example(
        { entry: "routes/frame", id: "frame", kind: "layout", path: "/x" },
        {
          entry: "routes/inner",
          id: "inner",
          namespaces: ["@vitnode/example.b", "@vitnode/example.a"],
          parentId: "frame",
          path: "/x/inner",
          requires: "authenticated",
        },
      ),
    );

    expect(manifestSource).toContain("kind: 'layout',");
    expect(manifestSource).toContain(
      "namespaces: ['@vitnode/example.a', '@vitnode/example.b'],",
    );
    expect(manifestSource).toContain("parentId: '@vitnode/example:frame',");
    expect(manifestSource).toContain("requires: 'authenticated',");
  });

  it("normalises once, so nothing downstream has to", () => {
    const [route] = compile(
      example({
        entry: "routes/hello",
        id: "hello",
        namespaces: ["b", "a", "b"],
        path: "/hello/",
      }),
    ).manifest;

    // A trailing slash is formatting, and a namespace list is a set.
    expect(route.path).toBe("/hello");
    expect(route.namespaces).toEqual(["a", "b"]);
  });
});

describe("determinism", () => {
  it("produces the same bytes whichever order the plugins were configured in", () => {
    const forwards = compile(example(page("b", "/b")), blog(page("a", "/a")));
    const backwards = compile(blog(page("a", "/a")), example(page("b", "/b")));

    expect(backwards.manifestSource).toBe(forwards.manifestSource);
    expect(backwards.registrySource).toBe(forwards.registrySource);
  });

  it("produces the same bytes whichever order one plugin declared its routes in", () => {
    const forwards = compile(example(page("a", "/a"), page("b", "/b")));
    const backwards = compile(example(page("b", "/b"), page("a", "/a")));

    expect(backwards.manifestSource).toBe(forwards.manifestSource);
    expect(backwards.registrySource).toBe(forwards.registrySource);
  });

  it("sorts static paths before the dynamic ones that shadow them", () => {
    expect(
      compile(
        example(page("show", "/member/:id"), page("new", "/member/new")),
      ).manifest.map(route => route.path),
    ).toEqual(["/member/new", "/member/:id"]);
  });
});

describe("the two generated files describe one set of routes", () => {
  it("registers a module for every route in the manifest, under its id", () => {
    const { manifest, modules } = compile(
      example(page("a", "/a")),
      blog(page("b", "/b"), page("c", "/c")),
    );

    expect(modules.map(module => module.key)).toEqual(
      [...manifest].map(route => route.id).sort(),
    );
  });

  it("derives the registry from the manifest, so a rejected route reaches neither", () => {
    // The manifest is built first and the registry from it, which is what makes
    // "a route that fails validation cannot leave an import behind" structural
    // rather than something the two steps have to agree about.
    const failed = messageOf(() =>
      compile(example(page("ok", "/ok"), page("bad", "/BAD"))),
    );

    expect(failed).toContain("uppercase letters");
  });

  it("writes one literal import per route, and never a computed specifier", () => {
    const { registrySource } = compile(
      example(page("a", "/a")),
      blog(page("b", "/b")),
    );

    expect(registrySource).toContain(
      "'@vitnode/blog:b': () => import('@vitnode/blog/routes/b'),",
    );
    expect(registrySource).toContain(
      "'@vitnode/example:a': () => import('@vitnode/example/routes/a'),",
    );
    // Every specifier a bundler has to follow is a literal string in the source.
    expect(registrySource).not.toMatch(/import\((?!')/);
  });
});

describe("enabling and disabling a plugin", () => {
  const both = () => compile(example(page("a", "/a")), blog(page("b", "/b")));
  const one = () => compile(example(page("a", "/a")));

  it("leaves a disabled plugin no route and no module import", () => {
    const { manifestSource, registrySource } = one();

    expect(manifestSource).not.toContain("@vitnode/blog");
    expect(registrySource).not.toContain("@vitnode/blog");
  });

  it("is the same compilation whether a plugin was never there or removed", () => {
    // Both generated files are written from the list the plugin's routes are no
    // longer in, so "disabled" and "never installed" cannot differ.
    expect(one().registrySource).toBe(
      compilePluginRoutes({
        sources: [example(page("a", "/a")), { pluginId: "@vitnode/blog" }],
      }).registrySource,
    );
  });

  it("adds exactly the enabled plugin's routes back", () => {
    expect(both().manifest.map(route => route.id)).toEqual([
      "@vitnode/example:a",
      "@vitnode/blog:b",
    ]);
  });

  it("follows a changed path without changing the route's identity", () => {
    const before = compile(example(page("a", "/a")));
    const after = compile(example({ entry: "routes/a", id: "a", path: "/z" }));

    expect(after.manifest[0].id).toBe(before.manifest[0].id);
    expect(after.manifest[0].path).toBe("/z");
    expect(after.registrySource).toBe(before.registrySource);
  });

  it("follows a changed entry into the generated import", () => {
    const { registrySource } = compile(
      example({ entry: "routes/moved", id: "a", path: "/a" }),
    );

    expect(registrySource).toContain(
      "'@vitnode/example:a': () => import('@vitnode/example/routes/moved'),",
    );
  });
});

/**
 * Adding, removing and renaming a *route*, which is the mutation a plugin author
 * makes far more often than adding or removing a plugin.
 *
 * The same claim as the block above, one level down, and it needs stating
 * separately because the failure is different. A disabled plugin disappearing
 * from both files is a property of the plugin list; a *deleted route* leaving no
 * trace is a property of the derivation - the manifest is built first and the
 * registry is derived from it, so there is no second pass that could remember a
 * route the first one no longer has. What would go wrong without it is quiet: a
 * lazy `import()` for a page that no longer exists, which the bundler resolves
 * against a `dist` that still has yesterday's file.
 *
 * Every assertion is a byte comparison, and several are round trips - remove and
 * re-add, rename and rename back - because "no stale entry" and "deterministic"
 * are the same property looked at twice: if the output is a pure function of the
 * input then returning to a previous input has to return the previous bytes.
 */
describe("adding, removing and renaming a route", () => {
  const routes = (...defs: PluginRouteDefinition[]) =>
    compile(example(...defs));
  const bytes = (...defs: PluginRouteDefinition[]) => {
    const { manifestSource, registrySource } = routes(...defs);

    return { manifestSource, registrySource };
  };

  const a = page("a", "/a");
  const b = page("b", "/b");

  it("adds a route to both files and nothing else", () => {
    const before = routes(a);
    const after = routes(a, b);

    expect(after.manifest.map(route => route.id)).toEqual([
      "@vitnode/example:a",
      "@vitnode/example:b",
    ]);
    // The route that did not change is still described the same way, so a diff
    // adding a page is a diff adding a page.
    expect(before.manifest[0]).toEqual(
      after.manifest.find(route => route.id === "@vitnode/example:a"),
    );
  });

  it("leaves no manifest entry and no import behind when a route is removed", () => {
    const { manifestSource, registrySource } = bytes(a);

    expect(manifestSource).not.toContain("'@vitnode/example:b'");
    expect(manifestSource).not.toContain("'/b'");
    expect(manifestSource).not.toContain("'routes/b'");
    expect(registrySource).not.toContain("@vitnode/example:b");
    expect(registrySource).not.toContain("routes/b");
  });

  /**
   * Remove a route, then add it back: the original bytes, exactly.
   *
   * Written as three states in sequence rather than as one repeated call,
   * because the claim is about the round trip and not about the function being
   * called twice - a generator that kept any state between passes would fail
   * this and pass a self-comparison.
   */
  it("restores exactly the previous bytes when the route is added back", () => {
    const original = bytes(a, b);
    const removed = bytes(a);
    const restored = bytes(a, b);

    expect(removed).not.toEqual(original);
    expect(restored).toEqual(original);
  });

  it("does not depend on the order the routes were declared in", () => {
    expect(bytes(a, b)).toEqual(bytes(b, a));
  });

  /**
   * A rename is a removal and an addition at once, and the id is what makes it
   * legible: an `id` survives a path change - that is what it is for - so
   * renaming the *path* keeps the registry identical, and renaming the *id*
   * rewrites both files.
   */
  it("keeps only the new spelling when a route's id is renamed", () => {
    const { manifestSource, registrySource } = bytes(page("renamed", "/a"));

    expect(manifestSource).toContain("'@vitnode/example:renamed'");
    expect(manifestSource).not.toContain("'@vitnode/example:a'");
    expect(registrySource).toContain("'@vitnode/example:renamed'");
    expect(registrySource).not.toContain("'@vitnode/example:a'");
  });

  it("keeps only the new path when a route's path is renamed", () => {
    const { manifestSource } = bytes({
      entry: "routes/a",
      id: "a",
      path: "/renamed",
    });

    expect(manifestSource).toContain("'/renamed'");
    expect(manifestSource).not.toContain("'/a'");
  });

  it("keeps only the new entry when a route's module is renamed", () => {
    const { registrySource } = bytes({
      entry: "routes/renamed",
      id: "a",
      path: "/a",
    });

    expect(registrySource).toContain("'@vitnode/example/routes/renamed'");
    expect(registrySource).not.toContain("'@vitnode/example/routes/a'");
  });

  /**
   * And a route dropping its eager search schema drops the *static* import too.
   *
   * The one entry in these files that is not lazy, so a leftover would be a
   * module in the initial bundle for a contract nothing validates - and
   * `pluginRouteSpecs` refuses the mismatched pair at runtime, which is a
   * failure a build should not have handed it.
   */
  it("drops the eager search import when a searchEntry is removed", () => {
    const withSearch = bytes({
      entry: "routes/a",
      id: "a",
      path: "/a",
      searchEntry: "routes/a.search",
    });

    expect(withSearch.registrySource).toContain("routes/a.search");
    expect(bytes(a).registrySource).not.toContain("routes/a.search");
    expect(bytes(a).registrySource).not.toContain("pluginRouteSearch0");
  });
});

describe("collisions", () => {
  it("rejects two plugins claiming one path", () => {
    expect(
      messageOf(() => compile(example(page("a", "/x")), blog(page("b", "/x")))),
    ).toContain("Plugin route path collision");
  });

  it("rejects two paths that are one route space spelled twice", () => {
    // `/member/:id` and `/member/:slug` match exactly the same URLs.
    expect(
      messageOf(() =>
        compile(
          example(page("mine", "/member/:id")),
          blog(page("theirs", "/member/:slug")),
        ),
      ),
    ).toContain("collision");
  });

  it("does not confuse a static path with the dynamic one beside it", () => {
    expect(
      compile(
        example(page("new", "/member/new")),
        blog(page("show", "/member/:id")),
      ).manifest,
    ).toHaveLength(2);
  });

  it("rejects a duplicate route id within one plugin", () => {
    expect(
      messageOf(() => compile(example(page("a", "/a"), page("a", "/b")))),
    ).toContain('Duplicate plugin route id "@vitnode/example:a"');
  });

  it("lets two plugins use the same local route id", () => {
    expect(
      compile(
        example(page("index", "/a")),
        blog(page("index", "/b")),
      ).modules.map(module => module.key),
    ).toEqual(["@vitnode/blog:index", "@vitnode/example:index"]);
  });

  it("rejects a plugin route that shadows one of the application's own", () => {
    const message = messageOf(() =>
      compilePluginRoutes({
        hostRoutes: [{ file: "src/routes/_main/search.tsx", path: "/search" }],
        sources: [example(page("search", "/search"))],
      }),
    );

    expect(message).toContain('claims "/search"');
    expect(message).toContain("src/routes/_main/search.tsx");
  });

  /**
   * `/admin/content/blog` used to be refused here.
   *
   * A build-time strangler - `assertNoLegacyRouteCollision` - read every URL the
   * Next.js AdminCP answered off `@vitnode/core`'s own `src/routes/admin/**` and
   * refused a plugin route that claimed one, because a TanStack route at that
   * path turned a working Next.js screen into a not-found. There is one
   * application now and that directory is gone, so a plugin may claim any URL
   * the host's own route files do not - which is exactly what
   * `assertNoHostRouteCollision` above checks, against the real route tree
   * rather than against a second application.
   */
  it("compiles a plugin route under /admin/content, which no other app answers", () => {
    expect(
      compile(
        example({
          area: "admin",
          entry: "routes/posts",
          id: "posts",
          path: "/admin/content/blog",
        }),
      ).manifest,
    ).toHaveLength(1);
  });
});

/**
 * The AdminCP as a destination for a plugin page, through the whole compiler.
 *
 * The unit rules are `routing/manifest.test.ts`'s and `routing/graph.test.ts`'s.
 * What is asserted here is that an admin route survives the parts a build adds -
 * the generated literal, the registry, the parity check - unchanged.
 */
describe("the admin area", () => {
  const reports = (): PluginRouteCompilerSource =>
    example({
      area: "admin",
      entry: "routes/reports",
      id: "reports",
      namespaces: ["@vitnode/example.admin"],
      path: "/admin/reports",
    });

  it("carries the area into the generated manifest", () => {
    const { manifest, manifestSource } = compile(reports());

    expect(manifest[0]).toMatchObject({
      area: "admin",
      path: "/admin/reports",
    });
    expect(manifestSource).toContain("area: 'admin'");
    expect(manifestSource).toContain("path: '/admin/reports'");
  });

  /**
   * The generated registry is the *how*, and an area is not part of it: a module
   * is imported the same way wherever its page is framed. One literal `import()`
   * per route, exactly as Stage 11 emits for a public page.
   */
  it("generates the same one literal import a public route gets", () => {
    expect(compile(reports()).registrySource).toContain(
      "'@vitnode/example:reports': () => import('@vitnode/example/routes/reports'),",
    );
  });

  /**
   * An area frames a page; it does not move it. Both shells are pathless, so an
   * admin route and a public route spelling one pathname are one URL claimed
   * twice - and the compiler refuses it with both plugins and both manifests
   * named, which is the whole value of catching it here rather than in a router.
   */
  it("refuses an admin route and a public route at one pathname", () => {
    expect(() =>
      compile(
        example(
          { area: "admin", entry: "routes/a", id: "a", path: "/reports" },
          { entry: "routes/b", id: "b", path: "/reports" },
        ),
      ),
    ).toThrow(/collision on "\/reports"/);
  });

  /** The pair that is actually two URLs, and is accepted. */
  it("keeps an admin route and a public route with different paths", () => {
    expect(
      compile(
        example(
          { area: "admin", entry: "routes/a", id: "a", path: "/admin/reports" },
          { entry: "routes/b", id: "b", path: "/reports" },
        ),
      ).manifest.map(route => [route.area, route.path]),
    ).toEqual([
      ["admin", "/admin/reports"],
      ["main", "/reports"],
    ]);
  });
});

describe("hierarchy", () => {
  const frame = (id: string, path: string): PluginRouteDefinition => ({
    entry: `routes/${id}`,
    id,
    kind: "layout",
    path,
  });

  const child = (
    id: string,
    path: string,
    parentId: string,
  ): PluginRouteDefinition => ({ entry: `routes/${id}`, id, parentId, path });

  it("namespaces a declared parent id, so a manifest addresses one id space", () => {
    const manifest = compile(
      example(
        frame("settings", "/settings"),
        child("index", "/settings", "settings"),
      ),
    ).manifest;

    expect(manifest.find(route => route.routeId === "index")?.parentId).toBe(
      "@vitnode/example:settings",
    );
  });

  it("rejects a parent no route in the manifest has", () => {
    expect(
      messageOf(() => compile(example(child("a", "/a", "nope")))),
    ).toContain("declares the parent");
  });

  it("rejects a route that is its own parent", () => {
    expect(messageOf(() => compile(example(child("a", "/a", "a"))))).toContain(
      "is its own parent",
    );
  });

  it("rejects a cycle", () => {
    expect(
      messageOf(() =>
        compile(
          example(
            { ...frame("a", "/a"), parentId: "b" },
            { ...frame("b", "/b"), parentId: "a" },
          ),
        ),
      ),
    ).toContain("parent cycle");
  });

  it("rejects a parent that is not a layout", () => {
    expect(
      messageOf(() =>
        compile(example(page("a", "/a"), child("b", "/a/b", "a"))),
      ),
    ).toContain("rather than a layout");
  });

  it("rejects a layout with nothing inside it", () => {
    expect(
      messageOf(() => compile(example(frame("frame", "/frame")))),
    ).toContain("layout with no routes inside it");
  });

  it("rejects a child that claims a path outside its parent", () => {
    expect(
      messageOf(() =>
        compile(
          example(
            frame("frame", "/frame"),
            child("away", "/elsewhere", "frame"),
          ),
        ),
      ),
    ).toContain("not inside its parent");
  });

  it("cannot express a parent in another plugin", () => {
    // A `parentId` is plugin-local, so the id is namespaced into the declaring
    // plugin and the other plugin's route is simply not found.
    expect(
      messageOf(() =>
        compile(
          blog(frame("frame", "/frame"), child("in", "/frame/in", "frame")),
          example(child("stolen", "/frame/mine", "frame")),
        ),
      ),
    ).toContain('"@vitnode/example:frame"');
  });

  it("keeps a parent in front of its children in the compiled manifest", () => {
    expect(
      compile(
        example(
          child("security", "/settings/security", "settings"),
          child("index", "/settings", "settings"),
          frame("settings", "/settings"),
        ),
      ).manifest.map(route => route.routeId),
    ).toEqual(["index", "settings", "security"]);
  });
});

describe("diagnostics", () => {
  it("names the manifest a bad route was declared in", () => {
    expect(messageOf(() => compile(example(page("a", "/A"))))).toContain(
      'Declared in "@vitnode/example/routes/manifest".',
    );
  });

  it("names both manifests in a collision between two plugins", () => {
    const message = messageOf(() =>
      compile(example(page("a", "/x")), blog(page("b", "/x"))),
    );

    expect(message).toContain('Declared in "@vitnode/blog/routes/manifest".');
    expect(message).toContain(
      'is declared in "@vitnode/example/routes/manifest".',
    );
  });

  it("prefixes every failure so it can be found in a Vite log", () => {
    expect(messageOf(() => compile(example(page("a", "/A"))))).toContain(
      "[VitNode plugin routes]",
    );
  });

  /**
   * A host collision is fixed by editing one of two files, so it names both.
   *
   * It always named the application's - `hostRoutes` carries the file for that
   * reason - and it named the plugin's only once the refusal became a
   * `PluginRouteError`: the annotation that adds "Declared in …" ignores anything
   * else, so for as long as this threw a plain `Error` the half an author could
   * not guess was the half that was missing.
   */
  it("names both files when a plugin shadows the application's own page", () => {
    const message = messageOf(() =>
      compilePluginRoutes({
        hostRoutes: [{ file: "src/routes/_main/search.tsx", path: "/search" }],
        sources: [example(page("search", "/search"))],
      }),
    );

    expect(message).toContain("[VitNode plugin routes]");
    expect(message).toContain("src/routes/_main/search.tsx");
    expect(message).toContain(
      'Declared in "@vitnode/example/routes/manifest".',
    );
  });

  it("keeps the host route on the error a host collision throws", () => {
    let thrown: unknown;

    try {
      compilePluginRoutes({
        hostRoutes: [{ file: "src/routes/_main/search.tsx", path: "/search" }],
        sources: [example(page("search", "/search"))],
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PluginRouteError);
    expect(thrown).toMatchObject({
      code: "host-route-collision",
      conflictsWithHostRoute: {
        file: "src/routes/_main/search.tsx",
        path: "/search",
      },
      path: "/search",
      pluginId: "@vitnode/example",
    });
  });

  it("keeps the structured fields a build tool can render itself", () => {
    let thrown: unknown;

    try {
      compile(example(page("a", "/A")));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PluginRouteError);
    expect(thrown).toMatchObject({
      code: "invalid-path",
      path: "/A",
      pluginId: "@vitnode/example",
      routeId: "a",
    });
  });

  it("says which property is wrong, not just that the route is", () => {
    expect(
      messageOf(() =>
        compile(example({ entry: "routes/a.tsx", id: "a", path: "/a" })),
      ),
    ).toContain("invalid entry");
    expect(
      messageOf(() =>
        compile(
          example({
            entry: "routes/a",
            id: "a",
            namespaces: ["__proto__"],
            path: "/a",
          }),
        ),
      ),
    ).toContain("namespaces[0]");
  });

  it("still fails clearly for a plugin that declared no manifest specifier", () => {
    expect(
      messageOf(() =>
        compilePluginRoutes({
          sources: [
            { pluginId: "@vitnode/example", routes: [page("a", "/A")] },
          ],
        }),
      ),
    ).toContain("uppercase letters");
  });
});

describe("escaping", () => {
  it("escapes a value that would otherwise close its own string literal", () => {
    // Nothing that reaches here can contain a quote today - every field is
    // matched against a pattern first - and a generator that concatenates
    // unescaped strings is one refactor away from writing a plugin's data into
    // an app's source.
    const { manifestSource } = compilePluginRoutes({
      sources: [
        {
          pluginId: "@vitnode/example",
          routes: [
            {
              entry: "routes/a",
              id: "a",
              namespaces: ["it's"],
              path: "/a",
            },
          ],
        },
      ],
    });

    expect(manifestSource).toContain("namespaces: ['it\\'s'],");
  });
});
