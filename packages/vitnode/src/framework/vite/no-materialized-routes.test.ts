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

const lazyPage = (specifier: string) =>
  lazy(
    // oxlint-disable-next-line typescript/no-implied-eval
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
