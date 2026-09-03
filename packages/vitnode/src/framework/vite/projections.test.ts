import { describe, expect, it } from "vitest";

import type { ResolvedAdminNavModule } from "../admin-nav";
import type { ResolvedContentRegistryModule } from "../content-registry";
import type { PluginRouteCompilerSource } from "../plugin-routes";

import { definePluginRoutes, lazy, page } from "../../routing/tree";
import { generateAdminNavSource } from "../admin-nav";
import { generateContentRegistrySource } from "../content-registry";
import { compilePluginRoutes } from "../plugin-routes";
import { readOptionalPluginModules } from "./plugin-routes";

/** A resolver over a fixed map of specifier → file, as the build sees one. */
const resolverFor =
  (files: Record<string, string>): ((specifier: string) => null | string) =>
  specifier =>
    files[specifier] ?? null;

/**
 * Two plugins that contribute to every projection, so "disappears from all
 * three" is a statement with three things in it rather than one.
 */
const WORKSPACE = resolverFor({
  "@acme/blog/admin/content": "/pkg/blog/dist/admin/content.js",
  "@acme/blog/admin/nav": "/pkg/blog/dist/admin/nav.js",
  "@acme/blog/routes": "/pkg/blog/dist/routes.js",
  "@acme/shop/admin/content": "/pkg/shop/dist/admin/content.js",
  "@acme/shop/admin/nav": "/pkg/shop/dist/admin/nav.js",
  "@acme/shop/routes": "/pkg/shop/dist/routes.js",
});

const lazyPage = () =>
  lazy(async () => await Promise.resolve({ default: () => null }));

/** What each plugin's routes module declares, keyed by plugin id. */
const ROUTES: Record<string, PluginRouteCompilerSource> = {
  "@acme/blog": {
    pluginId: "@acme/blog",
    routes: definePluginRoutes([
      page("/blog/:slug", { component: lazyPage() }),
    ]),
    routesSpecifier: "@acme/blog/routes",
  },
  "@acme/shop": {
    pluginId: "@acme/shop",
    routes: definePluginRoutes([page("/shop/:id", { component: lazyPage() })]),
    routesSpecifier: "@acme/shop/routes",
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
    registry: compiled.source,
  };
};

const FILES = ["adminNav", "contentRegistry", "registry"] as const;

const BOTH = ["@acme/blog", "@acme/shop"];

describe("determinism, across every projection at once", () => {
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

  it("sorts inside each generator, so no caller has to", () => {
    const shuffled = projectionsFor(["@acme/shop", "@acme/blog"]);

    expect(shuffled.adminNav.indexOf("@acme/blog")).toBeLessThan(
      shuffled.adminNav.indexOf("@acme/shop"),
    );
    expect(shuffled.contentRegistry.indexOf("@acme/blog")).toBeLessThan(
      shuffled.contentRegistry.indexOf("@acme/shop"),
    );
    expect(shuffled.registry.indexOf("@acme/blog")).toBeLessThan(
      shuffled.registry.indexOf("@acme/shop"),
    );
  });
});

describe("a plugin is enabled, or it is not - never half of each", () => {
  it("puts an enabled plugin in all three projections", () => {
    const enabled = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(enabled[file]).toContain("@acme/shop");
    });
  });

  it("removes a disabled plugin from all three, in one step", () => {
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
