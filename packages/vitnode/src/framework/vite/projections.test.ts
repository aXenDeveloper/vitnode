import { describe, expect, it } from "vitest";

import type { ResolvedAdminNavModule } from "../admin-nav";
import type { ResolvedApiPluginModule } from "../api-registry";
import type { ResolvedContentRegistryModule } from "../content-registry";
import type { PluginRouteCompilerSource } from "../plugin-routes";

import { definePluginRoutes, lazy, page } from "../../routing/tree";
import { generateAdminNavSource } from "../admin-nav";
import { generateApiRegistrySource } from "../api-registry";
import { generateContentRegistrySource } from "../content-registry";
import {
  generatePackageMessagesSource,
  resolvePackageMessagesModules,
} from "../package-messages";
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
  "@acme/blog/config.api": "/pkg/blog/dist/config.api.js",
  "@acme/blog/routes": "/pkg/blog/dist/routes.js",
  "@acme/shop/admin/content": "/pkg/shop/dist/admin/content.js",
  "@acme/shop/admin/nav": "/pkg/shop/dist/admin/nav.js",
  "@acme/shop/config.api": "/pkg/shop/dist/config.api.js",
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

/** What each plugin's factory declares, keyed by plugin id. */
const LOCALE_FILES: Record<string, Record<string, string>> = {
  "@acme/blog": {
    en: "@acme/blog/locales/en.json",
    pl: "@acme/blog/locales/pl.json",
  },
  "@acme/shop": { en: "@acme/shop/locales/en.json" },
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
    apiRegistry: generateApiRegistrySource(
      readOptionalPluginModules<ResolvedApiPluginModule>(
        pluginIds,
        "config.api",
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
    packageMessages: generatePackageMessagesSource(
      resolvePackageMessagesModules(
        pluginIds.map(pluginId => ({
          localeFiles: LOCALE_FILES[pluginId],
          pluginId,
        })),
        "src/vitnode.config.ts",
      ),
    ),
    registry: compiled.source,
  };
};

const FILES = [
  "adminNav",
  "apiRegistry",
  "contentRegistry",
  "packageMessages",
  "registry",
] as const;

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
    expect(shuffled.packageMessages.indexOf("@acme/blog")).toBeLessThan(
      shuffled.packageMessages.indexOf("@acme/shop"),
    );
    expect(shuffled.apiRegistry.indexOf("@acme/blog")).toBeLessThan(
      shuffled.apiRegistry.indexOf("@acme/shop"),
    );
  });
});

describe("a plugin is enabled, or it is not - never half of each", () => {
  it("puts an enabled plugin in all five projections", () => {
    const enabled = projectionsFor(BOTH);

    FILES.forEach(file => {
      expect(enabled[file]).toContain("@acme/shop");
    });
  });

  it("removes a disabled plugin from all five, in one step", () => {
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
    expect(none.apiRegistry).toContain("interface ApiPluginRegistry {\n  }");
    // Except this one, which still registers core: an app with no plugins has
    // no plugin translations and every string core renders.
    expect(none.packageMessages).toContain("'@vitnode/core'");
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
