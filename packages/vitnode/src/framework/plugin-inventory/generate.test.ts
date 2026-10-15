import { describe, expect, it } from "vitest";

import type { FrontendPluginInventoryEntry } from "../../lib/plugin-metadata.js";

import {
  generatePluginInventorySource,
  pluginInventoryFromLoadedConfig,
} from "./generate.js";

const SOURCE = "src/vitnode.config.ts";

const BLOG_METADATA = {
  description: "Posts",
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
  it("writes the same bytes whatever order the plugins are configured in", () => {
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
      metadata: null,
    };

    const source = generatePluginInventorySource([shop, blog, forum]);

    expect(generatePluginInventorySource([forum, shop, blog])).toBe(source);
    expect(source.indexOf("@acme/blog")).toBeLessThan(
      source.indexOf("@acme/forum"),
    );
    expect(source.indexOf("@acme/forum")).toBeLessThan(
      source.indexOf("@acme/shop"),
    );
  });
});
