import { describe, expect, it } from "vitest";

import type { ResolvedApiPluginModule } from "./types.js";

import {
  API_REGISTRY_SPECIFIER,
  generateApiRegistrySource,
} from "./generate.js";

const BLOG: ResolvedApiPluginModule = {
  pluginId: "@acme/blog",
  specifier: "@acme/blog/config.api",
};

const SHOP: ResolvedApiPluginModule = {
  pluginId: "@acme/shop",
  specifier: "@acme/shop/config.api",
};

describe("generateApiRegistrySource", () => {
  it("names one reduced type per plugin rather than a module namespace", () => {
    const source = generateApiRegistrySource([BLOG, SHOP]);

    expect(source).toContain(
      "import type { VitNodeApiPlugin as ApiPlugin0 } from '@acme/blog/config.api'",
    );
    expect(source).toContain(
      "import type { VitNodeApiPlugin as ApiPlugin1 } from '@acme/shop/config.api'",
    );
    // A namespace import would make the registry resolve every export of a
    // plugin's API config, and searching them for the factory.
    expect(source).not.toContain("* as");
  });

  it("imports types and never values, and executes nothing", () => {
    const source = generateApiRegistrySource([BLOG, SHOP]);

    expect(source).not.toMatch(/^import (?!type )/m);
    expect(source).not.toContain("()");
    expect(source).not.toContain("typeof ");
  });

  it("augments the registry the fetcher reads, keyed by plugin id", () => {
    const source = generateApiRegistrySource([BLOG]);

    expect(source).toContain(`declare module '${API_REGISTRY_SPECIFIER}'`);
    expect(source).toContain("interface ApiPluginRegistry {");
    expect(source).toContain("'@acme/blog': ApiPlugin0");
  });

  it("sorts by plugin id, whatever order it was handed", () => {
    expect(generateApiRegistrySource([SHOP, BLOG])).toBe(
      generateApiRegistrySource([BLOG, SHOP]),
    );
    expect(
      generateApiRegistrySource([SHOP, BLOG]).indexOf("@acme/blog"),
    ).toBeLessThan(
      generateApiRegistrySource([SHOP, BLOG]).indexOf("@acme/shop"),
    );
  });

  it("stays a module with an empty registry, so the declaration augments rather than replaces", () => {
    const source = generateApiRegistrySource([]);

    expect(source).toContain("interface ApiPluginRegistry {\n  }");
    expect(source).not.toMatch(/^import /m);
    expect(
      source
        .trimEnd()
        .endsWith(
          `export type { ApiPluginRegistry } from '${API_REGISTRY_SPECIFIER}'`,
        ),
    ).toBe(true);
  });

  it("brings the registry module into the program, which an augmentation alone does not", () => {
    // TypeScript merges `declare module 'x'` only into a module the program has
    // loaded through an import; a type-only re-export is that import.
    const source = generateApiRegistrySource([BLOG]);

    expect(source).toContain(
      `export type { ApiPluginRegistry } from '${API_REGISTRY_SPECIFIER}'`,
    );
    expect(source).not.toContain("export {}");
  });

  it("escapes a specifier rather than trusting a package name", () => {
    const source = generateApiRegistrySource([
      { pluginId: "@acme/it's", specifier: "@acme/it's/config.api" },
    ]);

    expect(source).toContain("'@acme/it\\'s/config.api'");
    expect(source).toContain("'@acme/it\\'s': ApiPlugin0");
  });

  it("is a pure function of its input", () => {
    expect(generateApiRegistrySource([BLOG, SHOP])).toBe(
      generateApiRegistrySource([BLOG, SHOP]),
    );
  });
});
