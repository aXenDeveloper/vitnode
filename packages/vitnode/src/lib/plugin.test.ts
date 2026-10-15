import { describe, expect, it } from "vitest";

import type { PluginManifest } from "./plugin-manifest";

import { buildPlugin } from "./plugin";

const BLOG: PluginManifest<"@acme/blog"> = {
  author: null,
  description: null,
  icon: "newspaper",
  id: "@acme/blog",
  license: null,
  title: "Blog",
  version: "1.0.0",
};

describe("buildPlugin manifest", () => {
  it("takes its plugin id from the manifest", () => {
    const plugin = buildPlugin({ manifest: BLOG });

    expect(plugin.pluginId).toBe("@acme/blog");
    expect(plugin.manifest).toBe(BLOG);
  });

  it("refuses an icon that is not a Lucide icon name", () => {
    expect(() =>
      buildPlugin({ manifest: { ...BLOG, icon: "./assets/icon.svg" } }),
    ).toThrow(
      /^\[VitNode plugin manifest\] buildPlugin\(\) gives the plugin "@acme\/blog" the icon "\.\/assets\/icon\.svg"/,
    );
  });
});
