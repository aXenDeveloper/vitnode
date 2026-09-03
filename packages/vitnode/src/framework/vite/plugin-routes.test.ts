import { describe, expect, it } from "vitest";

import type { ResolvedAdminNavModule } from "../admin-nav";
import type { ResolvedContentRegistryModule } from "../content-registry";

import { generateAdminNavSource } from "../admin-nav";
import { generateContentRegistrySource } from "../content-registry";
import { readOptionalPluginModules } from "./plugin-routes";

/** A resolver over a fixed map of specifier → file, as the build sees one. */
const resolverFor =
  (
    exportsBySpecifier: Record<string, string>,
  ): ((specifier: string) => null | string) =>
  specifier =>
    exportsBySpecifier[specifier] ?? null;

const WORKSPACE = resolverFor({
  // Both: the shape this repository's own plugins happen to have.
  "@acme/blog/admin/content": "/pkg/blog/dist/admin/content.js",
  "@acme/blog/admin/nav": "/pkg/blog/dist/admin/nav.js",
  // Navigation only: an AdminCP screen that registers no content types.
  "@acme/settings/admin/nav": "/pkg/settings/dist/admin/nav.js",
  // Content only: generated screens, no hand-declared navigation.
  "@acme/docs/admin/content": "/pkg/docs/dist/admin/content.js",
  // `@acme/quiet` resolves neither, and is deliberately absent from this map.
});

const ALL = ["@acme/blog", "@acme/docs", "@acme/quiet", "@acme/settings"];

const navOf = (pluginIds: readonly string[] = ALL) =>
  readOptionalPluginModules<ResolvedAdminNavModule>(
    pluginIds,
    "admin/nav",
    WORKSPACE,
  );

const contentOf = (pluginIds: readonly string[] = ALL) =>
  readOptionalPluginModules<ResolvedContentRegistryModule>(
    pluginIds,
    "admin/content",
    WORKSPACE,
  );

const idsOf = (result: { modules: { pluginId: string }[] }) =>
  result.modules.map(module => module.pluginId);

describe("each subpath is discovered on its own", () => {
  it("collects only the plugins that export it", () => {
    expect(idsOf(navOf())).toEqual(["@acme/blog", "@acme/settings"]);
    expect(idsOf(contentOf())).toEqual(["@acme/blog", "@acme/docs"]);
  });

  /**
   * The assertion the removed test contradicted: the two projections are not
   * the same set and are not required to be.
   */
  it("does not require a plugin to export both", () => {
    expect(idsOf(navOf())).not.toEqual(idsOf(contentOf()));
  });

  it("lets a plugin have navigation without content", () => {
    expect(idsOf(navOf())).toContain("@acme/settings");
    expect(idsOf(contentOf())).not.toContain("@acme/settings");
  });

  it("lets a plugin have content without extra navigation", () => {
    expect(idsOf(contentOf())).toContain("@acme/docs");
    expect(idsOf(navOf())).not.toContain("@acme/docs");
  });

  /**
   * The common case, and the one that must never become an error: most plugins
   * contribute to neither projection.
   */
  it("silently skips a plugin that exports neither", () => {
    expect(idsOf(navOf())).not.toContain("@acme/quiet");
    expect(idsOf(contentOf())).not.toContain("@acme/quiet");
    expect(() => navOf(["@acme/quiet"])).not.toThrow();
    expect(navOf(["@acme/quiet"])).toEqual({ modules: [], watch: [] });
  });
});

describe("what discovery returns", () => {
  it("names the specifier the generated file will import", () => {
    expect(contentOf(["@acme/blog"]).modules).toEqual([
      {
        pluginId: "@acme/blog",
        specifier: "@acme/blog/admin/content",
      },
    ]);
  });

  it("returns one watch file per resolved module and no more", () => {
    expect(contentOf().watch).toEqual([
      "/pkg/blog/dist/admin/content.js",
      "/pkg/docs/dist/admin/content.js",
    ]);
    expect(navOf().watch).toEqual([
      "/pkg/blog/dist/admin/nav.js",
      "/pkg/settings/dist/admin/nav.js",
    ]);
  });

  it("imports nothing - a specifier is a string", () => {
    // The resolver is the only thing that touches the filesystem, and it is
    // handed in. A build tool evaluating a plugin's React components to find
    // out that they exist is the failure this shape rules out.
    const seen: string[] = [];

    readOptionalPluginModules(ALL, "admin/content", specifier => {
      seen.push(specifier);

      return null;
    });

    expect(seen).toEqual(ALL.map(id => `${id}/admin/content`));
  });
});

describe("removing a plugin from the configuration", () => {
  /**
   * Discovery walks the configured ids and nothing else, so a plugin dropped
   * from `vitnode.config.ts` loses *every* projection it was in at once. There
   * is no second list, and no `node_modules` scan that could put it back.
   */
  it("removes it from both projections together", () => {
    const remaining = ALL.filter(id => id !== "@acme/blog");

    expect(idsOf(navOf(remaining))).not.toContain("@acme/blog");
    expect(idsOf(contentOf(remaining))).not.toContain("@acme/blog");
    expect(generateAdminNavSource(navOf(remaining).modules)).not.toContain(
      "@acme/blog",
    );
    expect(
      generateContentRegistrySource(contentOf(remaining).modules),
    ).not.toContain("@acme/blog");
  });

  it("leaves the other plugins where they were", () => {
    const remaining = ALL.filter(id => id !== "@acme/blog");

    expect(idsOf(navOf(remaining))).toEqual(["@acme/settings"]);
    expect(idsOf(contentOf(remaining))).toEqual(["@acme/docs"]);
  });
});

describe("both projections stay deterministic", () => {
  /**
   * Discovery preserves the configured order and each generator re-sorts, so
   * the bytes depend on which plugins are configured and on nothing else - not
   * on the order they were listed in, and not on the filesystem.
   */
  it("is the same bytes whichever order the plugins are configured in", () => {
    const reversed = [...ALL].reverse();

    expect(generateContentRegistrySource(contentOf(reversed).modules)).toBe(
      generateContentRegistrySource(contentOf(ALL).modules),
    );
    expect(generateAdminNavSource(navOf(reversed).modules)).toBe(
      generateAdminNavSource(navOf(ALL).modules),
    );
  });

  it("generates a registry for each projection independently", () => {
    const content = generateContentRegistrySource(contentOf().modules);
    const nav = generateAdminNavSource(navOf().modules);

    // Each names its own plugins and only its own.
    expect(content).toContain("@acme/docs/admin/content");
    expect(content).not.toContain("@acme/settings");
    expect(nav).toContain("@acme/settings/admin/nav");
    expect(nav).not.toContain("@acme/docs");
  });
});
