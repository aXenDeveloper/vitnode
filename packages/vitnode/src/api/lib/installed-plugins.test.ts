import { describe, expect, it } from "vitest";

import type { PluginManifest } from "@/lib/plugin-manifest";

import { buildInstalledPluginRegistry } from "./installed-plugins";

const manifest = (
  id: string,
  overrides: Partial<PluginManifest> = {},
): PluginManifest => ({
  author: null,
  description: `${id} description`,
  icon: null,
  id,
  license: null,
  title: `${id} title`,
  version: "1.0.0",
  ...overrides,
});

describe("buildInstalledPluginRegistry", () => {
  it("lists each plugin once, sorted by id, without core", () => {
    const registry = buildInstalledPluginRegistry({
      api: [
        { manifest: manifest("@acme/shop"), pluginId: "@acme/shop" },
        { pluginId: "@vitnode/core" },
        { manifest: manifest("@acme/blog"), pluginId: "@acme/blog" },
      ],
      frontend: [
        { id: "@vitnode/core", manifest: null },
        { id: "@acme/blog", manifest: manifest("@acme/blog") },
        { id: "@acme/analytics", manifest: manifest("@acme/analytics") },
      ],
    });

    expect(registry.plugins.map(plugin => plugin.id)).toEqual([
      "@acme/analytics",
      "@acme/blog",
      "@acme/shop",
    ]);
  });

  it("merges both registrations of a plugin", () => {
    const [plugin] = buildInstalledPluginRegistry({
      api: [{ manifest: manifest("@acme/blog"), pluginId: "@acme/blog" }],
      frontend: [{ id: "@acme/blog", manifest: manifest("@acme/blog") }],
    }).plugins;

    expect(plugin).toEqual({
      author: null,
      description: "@acme/blog description",
      icon: null,
      id: "@acme/blog",
      license: null,
      registrations: {
        api: { version: "1.0.0" },
        frontend: { version: "1.0.0" },
      },
      title: "@acme/blog title",
      version: "1.0.0",
      versionMismatch: false,
    });
  });

  it.each([
    ["the frontend inventory is given", [], true],
    ["no frontend inventory is given", undefined, false],
  ])("reports whether %s", (_, frontend, expected) => {
    expect(
      buildInstalledPluginRegistry({ api: [], frontend }).frontendInventory,
    ).toBe(expected);
  });

  it.each([
    ["only the API knows it", "2.0.0", null, "2.0.0", false],
    ["only the frontend knows it", null, "3.0.0", "3.0.0", false],
    ["both agree", "2.0.0", "2.0.0", "2.0.0", false],
    ["they differ, preferring the API's", "2.0.0", "3.0.0", "2.0.0", true],
    ["neither knows it", null, null, null, false],
  ])(
    "resolves the version when %s",
    (_, apiVersion, frontendVersion, version, versionMismatch) => {
      const [plugin] = buildInstalledPluginRegistry({
        api: [
          {
            manifest: manifest("@acme/blog", { version: apiVersion }),
            pluginId: "@acme/blog",
          },
        ],
        frontend: [
          {
            id: "@acme/blog",
            manifest: manifest("@acme/blog", { version: frontendVersion }),
          },
        ],
      }).plugins;

      expect({
        version: plugin?.version,
        versionMismatch: plugin?.versionMismatch,
      }).toEqual({ version, versionMismatch });
    },
  );

  it.each([
    [
      "the API's manifest first",
      manifest("@acme/blog", { icon: "rss" }),
      "rss",
    ],
    ["the frontend's when the API has no manifest", undefined, "newspaper"],
  ])("takes the icon from %s", (_, apiMetadata, icon) => {
    const [plugin] = buildInstalledPluginRegistry({
      api: [{ manifest: apiMetadata, pluginId: "@acme/blog" }],
      frontend: [
        {
          id: "@acme/blog",
          manifest: manifest("@acme/blog", { icon: "newspaper" }),
        },
      ],
    }).plugins;

    expect(plugin?.icon).toBe(icon);
  });

  it("treats a side without manifest as unknown, not a mismatch", () => {
    const [plugin] = buildInstalledPluginRegistry({
      api: [{ pluginId: "@acme/blog" }],
      frontend: [{ id: "@acme/blog", manifest: manifest("@acme/blog") }],
    }).plugins;

    expect(plugin?.registrations).toEqual({
      api: { version: null },
      frontend: { version: "1.0.0" },
    });
    expect(plugin?.version).toBe("1.0.0");
    expect(plugin?.versionMismatch).toBe(false);
  });

  it("lists a plugin with no manifest anywhere by its id", () => {
    const [plugin] = buildInstalledPluginRegistry({
      api: [],
      frontend: [{ id: "@acme/blog", manifest: null }],
    }).plugins;

    expect(plugin).toEqual({
      author: null,
      description: null,
      icon: null,
      id: "@acme/blog",
      license: null,
      registrations: { api: null, frontend: { version: null } },
      title: "@acme/blog",
      version: null,
      versionMismatch: false,
    });
  });

  it.each([
    [
      "the API",
      {
        api: [{ pluginId: "@acme/blog" }, { pluginId: "@acme/blog" }],
        frontend: undefined,
      },
    ],
    [
      "the frontend",
      {
        api: [],
        frontend: [
          { id: "@acme/blog", manifest: null },
          { id: "@acme/blog", manifest: null },
        ],
      },
    ],
  ])("refuses an id registered twice by %s", (_, input) => {
    expect(() => buildInstalledPluginRegistry(input)).toThrow(
      /claim the same id: "@acme\/blog"/,
    );
  });

  it("refuses manifest registered under another plugin's id", () => {
    expect(() =>
      buildInstalledPluginRegistry({
        api: [],
        frontend: [{ id: "@acme/shop", manifest: manifest("@acme/blog") }],
      }),
    ).toThrow(/\[VitNode plugin manifest\]/);
  });
});
