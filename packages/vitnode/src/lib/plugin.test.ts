import { describe, expect, it } from "vitest";

import type { PluginMetadata } from "./plugin-metadata";

import { buildPlugin } from "./plugin";

const BLOG: PluginMetadata = {
  description: null,
  icon: "newspaper",
  id: "@acme/blog",
  title: "Blog",
  version: "1.0.0",
};

describe("buildPlugin metadata", () => {
  it("accepts its own metadata with a Lucide icon name", () => {
    expect(
      buildPlugin({ metadata: BLOG, pluginId: "@acme/blog" }).metadata,
    ).toBe(BLOG);
  });

  it.each([
    [
      "metadata generated for another package",
      "@acme/shop",
      BLOG,
      /^\[VitNode plugin metadata\] buildPlugin\(\) registers the plugin "@acme\/shop" with the metadata of "@acme\/blog"/,
    ],
    [
      "an icon that is not a Lucide icon name",
      "@acme/blog",
      { ...BLOG, icon: "./assets/icon.svg" },
      /^\[VitNode plugin metadata\] buildPlugin\(\) gives the plugin "@acme\/blog" the icon "\.\/assets\/icon\.svg"/,
    ],
  ])("refuses %s", (_, pluginId, metadata, error) => {
    expect(() => buildPlugin({ metadata, pluginId })).toThrow(error);
  });
});
