import { describe, expect, it } from "vitest";

import { generateContentRegistrySource } from "./generate";

/**
 * The Content Engine registry projection, as bytes.
 *
 * Asserted literally rather than by parsing, for the same reason the plugin
 * route registry and the navigation projection are: this file is committed, so
 * it appears in diffs, and a generator that reordered itself or reflowed an
 * entry would produce a diff on somebody else's machine and none on the
 * author's. "Same configuration, same bytes" is the property, and the only
 * honest way to state it is to write the bytes down.
 */
describe("generateContentRegistrySource", () => {
  it("writes an empty registry when no plugin registers content types", () => {
    const source = generateContentRegistrySource([]);

    expect(source).toContain(
      "export const pluginContentTypes: ContentFrontendPluginSource[] = []",
    );
    // Nothing to import, so nothing is imported: a stray alias would be an
    // unused binding in an app's own `src/`.
    expect(source).not.toContain("import { adminContent");
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

  /**
   * The whole point of generating this file rather than serialising a registry:
   * a component cannot cross a JSON boundary, and a specifier assembled from a
   * plugin id is a module a bundler cannot follow.
   */
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

    expect(imports).toHaveLength(3);
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

    expect(source.startsWith("/* eslint-disable */")).toBe(true);
    expect(source).toContain("generated by VitNode");
  });
});
