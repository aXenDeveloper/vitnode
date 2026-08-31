// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { PluginRouteDefinition } from "../../routing/types.js";
import type { PluginRouteCompilerSource } from "../plugin-routes/compile.js";

import { compilePluginRoutes } from "../plugin-routes/compile.js";

/**
 * The generation pass writes **registries**, never pages.
 *
 * Two claims, one per layer, and they are the two halves of the same invariant:
 *
 * - `compilePluginRoutes` decides *what* is written, and what it produces is
 *   data - a validated manifest and one lazy `import()` per route. Nothing it
 *   returns is a framework route module.
 * - `vitNodePluginRoutes` decides *where*, and every destination it can name is
 *   a `*.gen.ts` at the top of the app's `src/`. It reads the app's routes
 *   directory and never writes into it.
 *
 * Pure and static: the compiler is called as the function it is, and the writer
 * is read as the text it is. No Vite, no dev server, no app on disk, no
 * `node_modules` to resolve.
 *
 * ## What this is a regression test for
 *
 * VitNode shipped a plugin route *copier* for years, and the correct fix has now
 * been mis-implemented twice in a row in two frameworks - so the invariant is
 * worth stating from the generator's own side rather than only from an app's.
 *
 *     WRONG, Next.js era      plugin src/routes/main/page.tsx
 *                               → copied into an app's src/app/[locale]/(main)/
 *
 *     WRONG, the same mistake plugin manifest route "/example/guide/:topic"
 *     spelled in TanStack       → generated as src/routes/_main/example/guide/$topic.tsx
 *
 *     RIGHT                   plugin manifest route "/example/guide/:topic"
 *                               → one line of data in plugin-route-manifest.gen.ts
 *                               → one literal import in plugin-routes.gen.ts
 *                               → mounted by withPluginRoutes at runtime
 *
 * Both wrong shapes fail silently rather than loudly: the app ends up holding a
 * second copy of a page nobody wrote, and which of the two runs is decided by a
 * router's ranking. `scripts/no-route-copier.test.ts` keeps the first engine
 * deleted; this keeps the second from being built.
 *
 * The routes below are the ones the brief names, including the dynamic child,
 * because a dynamic segment is the case a materialising generator has to invent
 * a filename for (`$topic.tsx`) and therefore the one where it would show.
 */

const source = (...parts: string[]): string =>
  readFileSync(join(import.meta.dirname, ...parts), "utf8");

const definitions: PluginRouteDefinition[] = [
  { entry: "routes/example-page", id: "example-page", path: "/example" },
  {
    entry: "routes/guide-layout",
    id: "guide",
    kind: "layout",
    path: "/example/guide",
  },
  {
    entry: "routes/guide-index-page",
    id: "guide-index",
    parentId: "guide",
    path: "/example/guide",
  },
  {
    entry: "routes/guide-topic-page",
    id: "guide-topic",
    parentId: "guide",
    path: "/example/guide/:topic",
  },
  {
    area: "admin",
    entry: "routes/admin-example-page",
    id: "admin-overview",
    path: "/admin/example",
  },
];

const example: PluginRouteCompilerSource = {
  manifestSpecifier: "@vitnode/example/routes/manifest",
  pluginId: "@vitnode/example",
  routes: definitions,
};

const compiled = compilePluginRoutes({ sources: [example] });
const generated = [compiled.manifestSource, compiled.registrySource];

describe("what a compilation produces", () => {
  /**
   * Guards the guard: every assertion below is an absence, and an empty
   * compilation would satisfy all of them.
   */
  it("compiled the routes it was given", () => {
    expect(compiled.manifest).toHaveLength(definitions.length);
    expect(compiled.modules).toHaveLength(definitions.length);
    expect(compiled.manifest.map(route => route.path)).toContain(
      "/example/guide/:topic",
    );
  });

  /**
   * The result's shape *is* the contract. One resolved snapshot, the two source
   * strings written from it, and two lists of package export subpaths.
   *
   * Another - `files`, `routeFiles`, `pages`, anything keyed by a path - would be
   * the compiler gaining somewhere else to write, which is the first thing a
   * materialising generator needs. Pinned as an exact list so it cannot grow
   * quietly.
   *
   * `searchModules` is the one field added since, and it is the same kind of
   * thing `modules` is: a route's eager `validateSearch` module, named by the
   * subpath its own package exports it at. The test below says so in the terms
   * that matter here - it is a specifier, never a path this compiler could write
   * to.
   */
  it("returns two sources and a snapshot, and nothing keyed by a file path", () => {
    expect(Object.keys(compiled).sort()).toEqual([
      "manifest",
      "manifestSource",
      "modules",
      "registrySource",
      "searchModules",
    ]);
  });

  /**
   * Neither generated file is a route module.
   *
   * These are the tokens a TanStack route file cannot be written without, plus
   * JSX and the extension itself. A generated page would contain at least one of
   * them however it were spelled, and none of them has any business in a file
   * whose entire content is data and `import()` calls.
   */
  it.each([
    ["a file route factory", /createFileRoute|createRootRoute/],
    ["a route constructor", /\bcreateRoute\s*\(/],
    ["a route export", /export\s+const\s+Route\b/],
    ["a route api handle", /getRouteApi/],
    ["a component export", /export\s+default\s+(?:function|\(|[A-Z])/],
    ["JSX", /<\/?[A-Z][A-Za-z]*[\s/>]/],
    ["a route file extension", /\.[jt]sx\b/],
  ])("contains no %s", (_label, forbidden) => {
    for (const file of generated) expect(file).not.toMatch(forbidden);
  });

  /**
   * Every route reaches the app as one lazy, literal import of the *plugin's*
   * module - which is the positive claim that makes the deletions above a design
   * rather than a gap.
   *
   * The specifier is a package export subpath, so a relative or app-internal one
   * (`./routes/…`, `#/routes/…`, `src/routes/…`) would mean the module had been
   * moved into the application: the copy, arrived by a different road.
   */
  it("imports every route from the plugin package, lazily and literally", () => {
    for (const module of compiled.modules) {
      expect(module.specifier).toBe(`@vitnode/example/${module.entry}`);
      expect(compiled.registrySource).toContain(
        `() => import('${module.specifier}')`,
      );
    }

    expect(compiled.registrySource).not.toMatch(/import\(\s*[^'"]/);
    expect(compiled.registrySource).not.toMatch(/import\(['"][.#]/);
    expect(compiled.registrySource).not.toMatch(/src\/routes/);
  });

  /**
   * And a search schema is imported the same way - out of the plugin's package,
   * by a subpath it exports - the only difference being that this one is static.
   *
   * The eagerness is the whole point of the field and the whole of its cost, so
   * it is asserted rather than assumed: a `() => import()` here would compile,
   * type-check, and give the route no `validateSearch` at all, because the router
   * would have matched long before the promise resolved.
   */
  it("imports every search schema from the plugin package, eagerly and literally", () => {
    for (const module of compiled.searchModules) {
      expect(module.specifier).toBe(`@vitnode/example/${module.searchEntry}`);
      expect(module.specifier).not.toMatch(/^[.#/]/);
      expect(compiled.registrySource).toContain(`from '${module.specifier}'`);
      expect(compiled.registrySource).not.toContain(
        `import('${module.specifier}')`,
      );
    }
  });

  /**
   * A dynamic segment stays VitNode's own spelling in the data, and is never
   * turned into a filename.
   *
   * `$topic.tsx` is what a materialising generator would have had to invent, so
   * its absence beside `:topic`'s presence is the sharpest single statement of
   * the difference between the two architectures.
   */
  it("keeps a dynamic segment as data rather than as a filename", () => {
    expect(compiled.manifestSource).toContain(
      "{ kind: 'param', name: 'topic' }",
    );
    for (const file of generated) {
      expect(file).not.toContain("$topic");
      expect(file).not.toContain("[topic]");
    }
  });
});

describe("where the generation pass is allowed to write", () => {
  const writer = source("plugin-routes.ts");

  /** `key: join(appRoot, "src", "<file>")`, as the writer declares them. */
  const pathsForFiles = new Map(
    [...writer.matchAll(/(\w+): join\(appRoot, "src", "([^"]+)"\)/g)].map(
      match => [match[1], match[2]] as const,
    ),
  );

  /** The first argument of every `writeIfChanged` call site. */
  const written = [...writer.matchAll(/writeIfChanged\(\s*([\w.]+)\s*,/g)].map(
    match => match[1],
  );

  it("declares the destinations this test reads", () => {
    expect(pathsForFiles.size).toBeGreaterThan(0);
    expect(written.length).toBeGreaterThan(0);
  });

  /**
   * Every write goes through `paths`, so the set of destinations is the set
   * `pathsFor` declares and cannot be assembled at a call site.
   */
  it("writes only to a declared path", () => {
    for (const destination of written) {
      expect(destination).toMatch(/^paths\.\w+$/);
      expect(pathsForFiles.has(destination.slice("paths.".length))).toBe(true);
    }
  });

  /**
   * And each of those is a generated data file at the top of `src/` - never a
   * page, and never inside a directory a router reads as routes.
   */
  it("writes four generated data files and no source file", () => {
    // `?? destination` rather than a non-null assertion: an unresolved key is a
    // real possible failure - a `writeIfChanged(paths.somethingNew, …)` whose
    // key `pathsFor` does not declare - and it should fail the assertion below
    // by name instead of being asserted away.
    const files = written.map(
      destination =>
        pathsForFiles.get(destination.slice("paths.".length)) ?? destination,
    );

    expect([...files].sort()).toEqual([
      "admin-nav.gen.ts",
      "content-registry.gen.ts",
      "plugin-route-manifest.gen.ts",
      "plugin-routes.gen.ts",
    ]);
    for (const file of files) {
      expect(file).toMatch(/^[\w-]+\.gen\.ts$/);
      expect(file).not.toContain("/");
    }
  });

  /**
   * The app's routes directory is read, and only read.
   *
   * `readHostRoutes` lists it so that a plugin shadowing one of the app's own
   * URLs fails the build, and the dev server watches it so that *adding* an app
   * route can turn a legal plugin route into a collision. Neither is a write,
   * and a write there would invert the direction of the entire layer.
   */
  it("never passes a routes directory to a write", () => {
    expect(writer).toContain("DEFAULT_HOST_ROUTES_DIR");
    expect(writer).toContain("readHostRoutes");
    expect(writer).not.toMatch(
      /write(?:File|IfChanged)\([^)]*(?:routesDir|hostRoutesDir|DEFAULT_HOST_ROUTES_DIR)/,
    );
  });

  /**
   * It creates no directory either.
   *
   * A generator that materialised `src/routes/_main/example/guide/$topic.tsx`
   * would have to make the directories on the way down. Four files at a fixed
   * depth in an existing `src/` need none, so the absence of `mkdir` is a cheap
   * proof that the output is flat.
   */
  it("creates no directory", () => {
    expect(writer).not.toMatch(/\bmkdir\b/);
    expect(writer).not.toMatch(/recursive:\s*true/);
  });

  /**
   * And it copies nothing. `cp`, `copyFile` and a read-then-write of somebody
   * else's module are what the deleted Next.js copier was made of; the only read
   * here is `writeIfChanged` comparing a generated file to its own previous
   * bytes.
   */
  it("copies no file", () => {
    expect(writer).not.toMatch(/\b(?:cp|copyFile|copyFileSync|cpSync)\s*\(/);
    expect(writer).not.toMatch(/\bcopyDirectoryRecursive\b/);
  });
});
