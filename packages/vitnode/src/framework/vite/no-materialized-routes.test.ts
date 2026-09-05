// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { PluginRouteCompilerSource } from "../plugin-routes/compile.js";

import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "../../routing/tree.js";
import { compilePluginRoutes } from "../plugin-routes/compile.js";
import { lazyImportSpecifier } from "../plugin-routes/component-source.js";

const source = (...parts: string[]): string =>
  readFileSync(join(import.meta.dirname, ...parts), "utf8");

const lazyPage = (specifier: string) =>
  lazy(
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    new Function(
      `return () => import("${specifier}")`,
    )() as () => Promise<unknown>,
  );

const routes = definePluginRoutes([
  page("/example", { component: lazyPage("./pages/example-page.js") }),
  layout("/example/guide", {
    component: lazyPage("./pages/guide-layout.js"),
    children: [
      index({ component: lazyPage("./pages/guide-index-page.js") }),
      page(":topic", { component: lazyPage("./pages/guide-topic-page.js") }),
    ],
  }),
  page("/admin/example", {
    area: "admin",
    component: lazyPage("./pages/admin-example-page.js"),
    search: () => ({ page: 1 }),
  }),
]);

const example: PluginRouteCompilerSource = {
  pluginId: "@vitnode/example",
  routes,
  routesSpecifier: "@vitnode/example/routes",
};

const compiled = compilePluginRoutes({ sources: [example] });
const generated = [compiled.source];

describe("what a compilation produces", () => {
  /**
   * Guards the guard: every assertion below is an absence, and an empty
   * compilation would satisfy all of them.
   */
  it("compiled the routes it was given", () => {
    expect(compiled.manifest).toHaveLength(5);
    expect(compiled.components.size).toBe(5);
    expect(compiled.manifest.map(route => route.path)).toContain(
      "/example/guide/:topic",
    );
  });

  it("returns one source and a snapshot, and nothing keyed by a file path", () => {
    expect(Object.keys(compiled).sort()).toEqual([
      "components",
      "manifest",
      "modules",
      "source",
    ]);
  });

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

  it("imports each plugin's route tree from its package, statically", () => {
    for (const module of compiled.modules) {
      expect(module.specifier).toBe(`${module.pluginId}/routes`);
      expect(module.specifier).not.toMatch(/^[.#/]/);
      expect(compiled.source).toContain(
        `import { routes as pluginRoutes0 } from '${module.specifier}'`,
      );
    }

    expect(compiled.source).not.toMatch(/src\/routes/);
  });

  /**
   * And every *page* is reached through the plugin's own literal `import()`,
   * which the app never names.
   *
   * That is the whole shape of the design: the app holds one import per plugin,
   * the plugin holds one import per page, and Rollup follows the second into a
   * chunk of its own. A specifier the build could not read would be a page it
   * could not check exists - see `lazyImportSpecifier`.
   */
  it("leaves every page behind the plugin's own lazy import", () => {
    const specifiers = compiled.manifest.map(route =>
      lazyImportSpecifier(compiled.components.get(route.id)?.load),
    );

    expect(
      specifiers.every(specifier => specifier?.startsWith("./pages/")),
    ).toBe(true);
    for (const specifier of specifiers) {
      expect(compiled.source).not.toContain(specifier);
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
    expect(compiled.manifest.flatMap(route => route.segments)).toContainEqual({
      kind: "param",
      name: "topic",
    });
    for (const file of generated) {
      expect(file).not.toContain("$topic");
      expect(file).not.toContain("[topic]");
      expect(file).not.toContain(":topic");
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
  it("writes three generated data files and no source file", () => {
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
