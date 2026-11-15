import { describe, expect, it } from "vitest";

import type { PluginManifest } from "@/lib/plugin-manifest";

import { buildInstalledPluginRegistry } from "../installed-plugins";
import { collectUpdateComponents } from "./components";

const manifest = (
  id: string,
  overrides: Partial<PluginManifest> = {},
): PluginManifest => ({
  author: null,
  description: null,
  icon: null,
  id,
  license: null,
  title: id,
  version: "1.0.0",
  ...overrides,
});

const CORE = {
  id: "@vitnode/core",
  updates: { url: "https://example.com/core.json" },
  version: "2.0.0",
};

const collect = (
  api: { manifest?: PluginManifest; pluginId: string }[],
  frontend: { id: string; manifest: null | PluginManifest }[],
) =>
  collectUpdateComponents({
    api,
    core: CORE,
    frontend,
    registry: buildInstalledPluginRegistry({ api, frontend }),
  });

describe("collectUpdateComponents", () => {
  it("lists core first, then each plugin with the versions both sides run", () => {
    const blog = (version: string) =>
      manifest("@acme/blog", {
        updates: { url: "https://example.com/acme.json" },
        version,
      });

    expect(
      collect(
        [{ manifest: blog("1.2.0"), pluginId: "@acme/blog" }],
        [{ id: "@acme/blog", manifest: blog("1.1.0") }],
      ),
    ).toEqual([
      {
        hasUnknownVersion: false,
        id: "@vitnode/core",
        kind: "core",
        sourceUrl: "https://example.com/core.json",
        versions: ["2.0.0"],
      },
      {
        hasUnknownVersion: false,
        id: "@acme/blog",
        kind: "plugin",
        sourceUrl: "https://example.com/acme.json",
        versions: ["1.2.0", "1.1.0"],
      },
    ]);
  });

  it("takes the update source from the API manifest over the web app's", () => {
    const [, plugin] = collect(
      [
        {
          manifest: manifest("@acme/blog", {
            updates: { url: "https://api.example.com/updates.json" },
          }),
          pluginId: "@acme/blog",
        },
      ],
      [
        {
          id: "@acme/blog",
          manifest: manifest("@acme/blog", {
            updates: { url: "https://web.example.com/updates.json" },
          }),
        },
      ],
    );

    expect(plugin?.sourceUrl).toBe("https://api.example.com/updates.json");
  });

  it("falls back to the web app's update source", () => {
    const [, plugin] = collect(
      [{ manifest: manifest("@acme/blog"), pluginId: "@acme/blog" }],
      [
        {
          id: "@acme/blog",
          manifest: manifest("@acme/blog", {
            updates: { url: "https://web.example.com/updates.json" },
          }),
        },
      ],
    );

    expect(plugin?.sourceUrl).toBe("https://web.example.com/updates.json");
  });

  it("leaves a plugin without an update source uncheckable, and flags a side with no version", () => {
    const [, plugin] = collect(
      [{ pluginId: "@acme/blog" }],
      [{ id: "@acme/blog", manifest: manifest("@acme/blog") }],
    );

    expect(plugin).toMatchObject({
      hasUnknownVersion: true,
      sourceUrl: null,
      versions: ["1.0.0"],
    });
  });
});
