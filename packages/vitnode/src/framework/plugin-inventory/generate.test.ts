import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { FrontendPluginInventoryEntry } from "../../lib/plugin-manifest.js";

import {
  generatePluginInventorySource,
  pluginInventoryFromLoadedConfig,
} from "./generate.js";

const SOURCE = "src/vitnode.config.ts";

const BLOG_MANIFEST = {
  author: null,
  description: "Posts",
  icon: "newspaper",
  id: "@acme/blog",
  license: null,
  title: "Blog",
  version: "1.0.0",
};

describe("pluginInventoryFromLoadedConfig", () => {
  it("lists each registration with its manifest, or null without one", () => {
    expect(
      pluginInventoryFromLoadedConfig(
        [
          { manifest: BLOG_MANIFEST, pluginId: "@acme/blog", routes: {} },
          { pluginId: "@acme/shop" },
        ],
        SOURCE,
      ),
    ).toEqual([
      { id: "@acme/blog", manifest: BLOG_MANIFEST },
      { id: "@acme/shop", manifest: null },
    ]);
  });

  it.each([
    ["a string", "Blog"],
    ["a missing title", { ...BLOG_MANIFEST, title: undefined }],
    ["a missing icon", { ...BLOG_MANIFEST, icon: undefined }],
    ["a numeric version", { ...BLOG_MANIFEST, version: 1 }],
    ["an undefined description", { ...BLOG_MANIFEST, description: undefined }],
  ])("rejects manifest that is %s", (_, manifest) => {
    expect(() =>
      pluginInventoryFromLoadedConfig(
        [{ manifest, pluginId: "@acme/blog" }],
        SOURCE,
      ),
    ).toThrow(/vitNodeConfig.plugins\[0\].manifest.*is not a plugin manifest/);
  });

  it("rejects manifest generated for another package", () => {
    expect(() =>
      pluginInventoryFromLoadedConfig(
        [{ manifest: BLOG_MANIFEST, pluginId: "@acme/shop" }],
        SOURCE,
      ),
    ).toThrow(
      /registers the plugin "@acme\/shop" with the manifest of "@acme\/blog"/,
    );
  });
});

describe("generatePluginInventorySource", () => {
  const blog: FrontendPluginInventoryEntry = {
    id: "@acme/blog",
    manifest: BLOG_MANIFEST,
  };
  const shop: FrontendPluginInventoryEntry = {
    id: "@acme/shop",
    manifest: null,
  };
  const forum: FrontendPluginInventoryEntry = {
    id: "@acme/forum",
    manifest: { ...BLOG_MANIFEST, icon: null, id: "@acme/forum" },
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
