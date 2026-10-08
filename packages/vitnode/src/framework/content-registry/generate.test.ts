import { describe, expect, it } from "vitest";

import { generateContentRegistrySource } from "./generate";

describe("generateContentRegistrySource", () => {
  it("writes an empty registry when no plugin registers content types", () => {
    const source = generateContentRegistrySource([]);

    expect(source).toContain(
      "export const pluginContentTypes: ContentFrontendPluginSource[] = []",
    );
    // Nothing to import, so no plugin alias: a stray one would be an unused
    // binding in an app's own `src/`.
    expect(source).not.toContain("import { adminContent as");
  });

  /**
   * An application with no content plugins still has to satisfy the registry
   * contract - `/admin/content` reads it either way - so the empty file builds
   * and registers an empty registry rather than leaving one unregistered.
   */
  it("builds and registers the registry in the empty case too", () => {
    const source = generateContentRegistrySource([]);

    expect(source).toContain(
      "import { buildContentFrontendRegistry, setContentFrontendRegistry } from '@vitnode/core/content'",
    );
    expect(source).toContain(
      "export const contentRegistry = buildContentFrontendRegistry(pluginContentTypes)",
    );
    expect(source).toContain("setContentFrontendRegistry(contentRegistry)");
  });

  it("registers the registry it derived, in order", () => {
    const source = generateContentRegistrySource([
      {
        pluginId: "@vitnode/example",
        specifier: "@vitnode/example/admin/content",
      },
      { pluginId: "@vitnode/blog", specifier: "@vitnode/blog/admin/content" },
    ]);

    expect(source).toContain("export const pluginContentTypes = [");
    expect(source.indexOf("export const pluginContentTypes")).toBeLessThan(
      source.indexOf("export const contentRegistry"),
    );
    expect(source.indexOf("export const contentRegistry")).toBeLessThan(
      source.indexOf("setContentFrontendRegistry(contentRegistry)"),
    );
  });

  it("imports one module per plugin, by literal specifier", () => {
    const source = generateContentRegistrySource([
      {
        pluginId: "@vitnode/example",
        specifier: "@vitnode/example/admin/content",
      },
    ]);

    expect(source).toContain(
      "import { adminContent as adminContent0 } from '@vitnode/example/admin/content'",
    );
    expect(source).toContain("satisfies ContentFrontendPluginSource[]");
  });

  it("never builds a specifier from a variable", () => {
    const source = generateContentRegistrySource([
      { pluginId: "@vitnode/blog", specifier: "@vitnode/blog/admin/content" },
      {
        pluginId: "@vitnode/example",
        specifier: "@vitnode/example/admin/content",
      },
    ]);

    // No dynamic import at all, and no interpolation anywhere - the doc comment
    // is allowed its backticks, an import statement is not.
    expect(source).not.toContain("import(");
    expect(source).not.toContain("${");

    const imports = source
      .split("\n")
      .filter(line => line.startsWith("import "));

    expect(imports).toHaveLength(4);
    imports.forEach(line => {
      expect(line).toMatch(/ from '[^'`$]+'$/);
    });
  });

  /**
   * Sorted here rather than trusted to arrive sorted, so the ordering is a
   * property of the function instead of a promise about how it is called.
   */
  it("is the same bytes whichever order the plugins arrive in", () => {
    const modules = [
      {
        pluginId: "@vitnode/example",
        specifier: "@vitnode/example/admin/content",
      },
      { pluginId: "@vitnode/blog", specifier: "@vitnode/blog/admin/content" },
    ];

    expect(generateContentRegistrySource(modules)).toBe(
      generateContentRegistrySource([...modules].reverse()),
    );
    expect(
      generateContentRegistrySource(modules).indexOf("@vitnode/blog"),
    ).toBeLessThan(
      generateContentRegistrySource(modules).indexOf("@vitnode/example"),
    );
  });

  /**
   * Positional aliases, because a plugin id is not a JavaScript identifier -
   * deriving one would mean two ids differing only in punctuation colliding on
   * a single binding, silently.
   */
  it("gives each module its own alias", () => {
    const source = generateContentRegistrySource([
      { pluginId: "@vitnode/blog", specifier: "@vitnode/blog/admin/content" },
      {
        pluginId: "@vitnode/example",
        specifier: "@vitnode/example/admin/content",
      },
    ]);

    expect(source).toContain("adminContent as adminContent0");
    expect(source).toContain("adminContent as adminContent1");
    expect(source).toContain("  adminContent0, // @vitnode/blog");
    expect(source).toContain("  adminContent1, // @vitnode/example");
  });

  /**
   * Removing a plugin from `vitnode.config.ts` removes its entry, because the
   * generator is a pure function of the module list discovery produced - and
   * discovery walks the configured ids. There is no other way in.
   */
  it("drops a plugin that is no longer configured", () => {
    const both = generateContentRegistrySource([
      { pluginId: "@vitnode/blog", specifier: "@vitnode/blog/admin/content" },
      {
        pluginId: "@vitnode/example",
        specifier: "@vitnode/example/admin/content",
      },
    ]);
    const one = generateContentRegistrySource([
      { pluginId: "@vitnode/blog", specifier: "@vitnode/blog/admin/content" },
    ]);

    expect(both).toContain("@vitnode/example");
    expect(one).not.toContain("@vitnode/example");
    expect(one).toContain("  adminContent0, // @vitnode/blog");
  });

  it("tells whoever opens it not to edit it", () => {
    const source = generateContentRegistrySource([]);

    expect(source.startsWith("/* oxlint-disable */")).toBe(true);
    expect(source).toContain("generated by VitNode");
  });
});
