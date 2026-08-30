import { describe, expect, it } from "vitest";

import type { ResolvedAdminNavModule } from "../admin-nav";
import type { ResolvedContentRegistryModule } from "../content-registry";
import type { PluginRouteCompilerSource } from "../plugin-routes";

import { generateAdminNavSource } from "../admin-nav";
import { generateContentRegistrySource } from "../content-registry";
import { compilePluginRoutes } from "../plugin-routes";
import { readOptionalPluginModules } from "./plugin-routes";

/**
 * All four generated projections, from one configured plugin list, in one pass.
 *
 * Each generator has its own determinism test beside it, and each says the same
 * thing about itself: sorted input, sorted output, same bytes. What none of them
 * can say is the thing that actually matters to an installation - that the four
 * are projections of **one list**, so a plugin cannot be half-enabled.
 *
 * That is the property this file is for, and it is not hypothetical. The four
 * files are read by four different parts of the app, and they used to be written
 * by separate passes:
 *
 *     plugin-route-manifest.gen.ts   what routes exist
 *     plugin-routes.gen.ts           how each route's module is imported
 *     admin-nav.gen.ts               what the AdminCP sidebar shows
 *     content-registry.gen.ts        which content types have screens
 *
 * A plugin present in one and absent from another is not a build error anywhere
 * - each file is individually valid - and the symptoms are all somewhere else: a
 * sidebar entry whose page 404s, a content screen with no route, a route the
 * router still claims for a plugin nobody configured. So "removed from the
 * config" has to mean removed from all four, and that is asserted here rather
 * than left to four files each checking its own half.
 *
 * Pure throughout: a resolver over a fixed map stands in for `node_modules`, and
 * every generator takes data and returns a string. There is no dev server here -
 * `./generation-queue.test.ts` owns the concurrency, and Agent G owns the smoke
 * test.
 */

/** A resolver over a fixed map of specifier → file, as the build sees one. */
const resolverFor =
  (files: Record<string, string>): ((specifier: string) => null | string) =>
  specifier =>
    files[specifier] ?? null;

/**
 * Two plugins that contribute to every projection, so "disappears from all
 * four" is a statement with four things in it rather than one.
 */
const WORKSPACE = resolverFor({
  "@acme/blog/admin/content": "/pkg/blog/dist/admin/content.js",
  "@acme/blog/admin/nav": "/pkg/blog/dist/admin/nav.js",
  "@acme/blog/routes/post": "/pkg/blog/dist/routes/post.js",
  "@acme/shop/admin/content": "/pkg/shop/dist/admin/content.js",
  "@acme/shop/admin/nav": "/pkg/shop/dist/admin/nav.js",
  "@acme/shop/routes/product": "/pkg/shop/dist/routes/product.js",
});

/** What each plugin's route manifest declares, keyed by plugin id. */
const ROUTES: Record<string, PluginRouteCompilerSource> = {
  "@acme/blog": {
    manifestSpecifier: "@acme/blog/routes/manifest",
    pluginId: "@acme/blog",
    routes: [{ entry: "routes/post", id: "post", path: "/blog/:slug" }],
  },
  "@acme/shop": {
    manifestSpecifier: "@acme/shop/routes/manifest",
    pluginId: "@acme/shop",
    routes: [{ entry: "routes/product", id: "product", path: "/shop/:id" }],
  },
};

/** Every generated file, for a given configured plugin list. */
const projectionsFor = (pluginIds: readonly string[]) => {
  const compiled = compilePluginRoutes({
    sources: pluginIds.map(pluginId => ROUTES[pluginId]),
  });

  return {
    adminNav: generateAdminNavSource(
      readOptionalPluginModules<ResolvedAdminNavModule>(
        pluginIds,
        "admin/nav",
        WORKSPACE,
      ).modules,
    ),
    contentRegistry: generateContentRegistrySource(
      readOptionalPluginModules<ResolvedContentRegistryModule>(
        pluginIds,
        "admin/content",
        WORKSPACE,
      ).modules,
    ),
    manifest: compiled.manifestSource,
    registry: compiled.registrySource,
  };
};

const FILES = ["adminNav", "contentRegistry", "manifest", "registry"] as const;

const BOTH = ["@acme/blog", "@acme/shop"];

describe("determinism, across every projection at once", () => {
  /**
   * The property each generator claims for itself, asserted for all four
   * together: the bytes are a function of *which plugins are configured* and of
   * nothing else - not of the order they were listed in, not of which manifest
   * happened to resolve first, not of the machine.
   */
  it("is byte-identical whichever order the plugins were configured in", () => {
    const forwards = projectionsFor(["@acme/blog", "@acme/shop"]);
    const backwards = projectionsFor(["@acme/shop", "@acme/blog"]);

    FILES.forEach(file => {
      expect(backwards[file]).toBe(forwards[file]);
    });
  });

  it("is byte-identical when the same configuration is compiled twice", () => {
    const first = projectionsFor(BOTH);
    const second = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(second[file]).toBe(first[file]);
    });
  });

  /**
   * Sorting is the generators' own, not the caller's. Every one of them re-sorts
   * what it is given, which is what makes "same configuration, same bytes" a
   * property of the functions rather than a promise about how they are called -
   * and it is why nothing above has to hand them a sorted list.
   */
  it("sorts inside each generator, so no caller has to", () => {
    const shuffled = projectionsFor(["@acme/shop", "@acme/blog"]);

    expect(shuffled.adminNav.indexOf("@acme/blog")).toBeLessThan(
      shuffled.adminNav.indexOf("@acme/shop"),
    );
    expect(shuffled.contentRegistry.indexOf("@acme/blog")).toBeLessThan(
      shuffled.contentRegistry.indexOf("@acme/shop"),
    );
    expect(shuffled.manifest.indexOf("/blog/")).toBeLessThan(
      shuffled.manifest.indexOf("/shop/"),
    );
    expect(shuffled.registry.indexOf("@acme/blog")).toBeLessThan(
      shuffled.registry.indexOf("@acme/shop"),
    );
  });
});

describe("a plugin is enabled, or it is not - never half of each", () => {
  it("puts an enabled plugin in all four projections", () => {
    const enabled = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(enabled[file]).toContain("@acme/shop");
    });
  });

  /**
   * The one that matters. Disabling a plugin has to take its routes, its module
   * imports, its sidebar entries and its content screens away together - a
   * sidebar entry that outlived its route is a 404 nobody can attribute to a
   * config edit.
   */
  it("removes a disabled plugin from all four, in one step", () => {
    const disabled = projectionsFor(["@acme/blog"]);

    FILES.forEach(file => {
      expect(disabled[file]).not.toContain("@acme/shop");
      expect(disabled[file]).not.toContain("/shop/");
    });
  });

  it("leaves the plugins that are still configured exactly where they were", () => {
    const both = projectionsFor(BOTH);
    const one = projectionsFor(["@acme/blog"]);

    FILES.forEach(file => {
      expect(both[file]).toContain("@acme/blog");
      expect(one[file]).toContain("@acme/blog");
    });
  });

  /**
   * No orphan imports: a disabled plugin leaves neither an `import` statement
   * nor an `import()` call behind. The generated files are rewritten from the
   * list its routes are no longer in, rather than filtered - so there is nothing
   * left to go stale.
   */
  it("leaves no import naming a plugin that is gone", () => {
    const disabled = projectionsFor(["@acme/blog"]);
    const specifiers = FILES.flatMap(file =>
      [...disabled[file].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]),
    );

    expect(specifiers.filter(value => value.includes("@acme/shop"))).toEqual(
      [],
    );
  });

  it("is the same output whether a plugin was removed or never configured", () => {
    const removed = projectionsFor(["@acme/blog"]);
    const neverThere = projectionsFor(["@acme/blog"]);

    FILES.forEach(file => {
      expect(removed[file]).toBe(neverThere[file]);
    });
  });

  /**
   * Re-enabling is not a special case and must not be: the projections are a
   * function of the current list, so the bytes an app had before a plugin was
   * disabled are the bytes it gets back when the plugin returns.
   */
  it("restores exactly the previous bytes when a plugin is re-enabled", () => {
    const before = projectionsFor(BOTH);

    projectionsFor(["@acme/blog"]);

    const after = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(after[file]).toBe(before[file]);
    });
  });

  it("writes empty projections for an app with no plugins at all", () => {
    const none = projectionsFor([]);

    FILES.forEach(file => {
      expect(none[file]).not.toContain("@acme/");
    });
    expect(none.adminNav).toContain("[]");
    expect(none.contentRegistry).toContain("[]");
  });
});

describe("the generated bytes are canonical as written", () => {
  /**
   * Each file says so at the top, and that line is load-bearing rather than
   * decorative: these are rewritten on every build, so anything a formatter
   * changes is lost - and a formatter that reflowed one entry would make the
   * output depend on how long a plugin's name happens to be. The apps exclude
   * them from linting and formatting; this is the assertion that the files still
   * say why.
   */
  it("tells a reader not to edit or format them", () => {
    const generated = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(generated[file]).toContain("generated by VitNode");
      expect(generated[file]).toContain("do not format it");
      expect(generated[file].startsWith("/* eslint-disable */")).toBe(true);
    });
  });

  it("ends every file with exactly one newline", () => {
    const generated = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(generated[file].endsWith("\n")).toBe(true);
      expect(generated[file].endsWith("\n\n")).toBe(false);
    });
  });
});
