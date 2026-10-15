import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { FrontendPluginInventoryEntry } from "../../lib/plugin-metadata.js";

import {
  generatePluginInventorySource,
  pluginInventoryFromLoadedConfig,
} from "./generate.js";

const SOURCE = "src/vitnode.config.ts";

const BLOG_METADATA = {
  description: "Posts",
  icon: "newspaper",
  id: "@acme/blog",
  title: "Blog",
  version: "1.0.0",
};

describe("pluginInventoryFromLoadedConfig", () => {
  it("lists each registration with its metadata, or null without one", () => {
    expect(
      pluginInventoryFromLoadedConfig(
        [
          { metadata: BLOG_METADATA, pluginId: "@acme/blog", routes: {} },
          { pluginId: "@acme/shop" },
        ],
        SOURCE,
      ),
    ).toEqual([
      { id: "@acme/blog", metadata: BLOG_METADATA },
      { id: "@acme/shop", metadata: null },
    ]);
  });

  it.each([
    ["a string", "Blog"],
    ["a missing title", { ...BLOG_METADATA, title: undefined }],
    ["a missing icon", { ...BLOG_METADATA, icon: undefined }],
    ["a numeric version", { ...BLOG_METADATA, version: 1 }],
    ["an undefined description", { ...BLOG_METADATA, description: undefined }],
  ])("rejects metadata that is %s", (_, metadata) => {
    expect(() =>
      pluginInventoryFromLoadedConfig(
        [{ metadata, pluginId: "@acme/blog" }],
        SOURCE,
      ),
    ).toThrow(/vitNodeConfig.plugins\[0\].metadata.*is not plugin metadata/);
  });

  it("rejects metadata generated for another package", () => {
    expect(() =>
      pluginInventoryFromLoadedConfig(
        [{ metadata: BLOG_METADATA, pluginId: "@acme/shop" }],
        SOURCE,
      ),
    ).toThrow(
      /registers the plugin "@acme\/shop" with the metadata of "@acme\/blog"/,
    );
  });
});

describe("generatePluginInventorySource", () => {
  const blog: FrontendPluginInventoryEntry = {
    id: "@acme/blog",
    metadata: BLOG_METADATA,
  };
  const shop: FrontendPluginInventoryEntry = {
    id: "@acme/shop",
    metadata: null,
  };
  const forum: FrontendPluginInventoryEntry = {
    id: "@acme/forum",
    metadata: { ...BLOG_METADATA, icon: null, id: "@acme/forum" },
  };

  it("writes the same bytes whatever order the plugins are configured in", () => {
    expect(generatePluginInventorySource([forum, shop, blog])).toBe(
      generatePluginInventorySource([shop, blog, forum]),
    );
  });

  it("evaluates to the entries, sorted by id", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vitnode-plugin-inventory-"));
    const path = join(dir, "plugin-inventory.gen.ts");
    writeFileSync(path, generatePluginInventorySource([shop, blog, forum]));

    try {
      const module = (await import(path)) as { frontendPlugins: unknown };

      expect(module.frontendPlugins).toEqual([blog, forum, shop]);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
