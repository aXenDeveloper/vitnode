// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  collectNavigationPresets,
  findNavigationPreset,
  NavigationPresetError,
} from "./navigation-presets";

describe("collectNavigationPresets", () => {
  it("stamps every preset with its plugin and a resolved new-tab flag", () => {
    expect(
      collectNavigationPresets([
        {
          navigation: [{ href: "/discover", icon: "compass", id: "discover" }],
          pluginId: "@vitnode/core",
        },
        {
          navigation: [
            { href: "https://vitnode.com", id: "site", isOpenInNewTab: true },
          ],
          pluginId: "@vitnode/blog",
        },
        { pluginId: "@vitnode/example" },
      ]),
    ).toEqual([
      {
        href: "/discover",
        icon: "icon:compass",
        id: "discover",
        isOpenInNewTab: false,
        pluginId: "@vitnode/core",
      },
      {
        href: "https://vitnode.com",
        icon: null,
        id: "site",
        isOpenInNewTab: true,
        pluginId: "@vitnode/blog",
      },
    ]);
  });

  it.each(["Compass", "compass icon", "", 42])("refuses the icon %j", icon => {
    expect(() =>
      collectNavigationPresets([
        {
          navigation: [{ href: "/a", icon: icon as string, id: "home" }],
          pluginId: "@acme/a",
        },
      ]),
    ).toThrow(NavigationPresetError);
  });

  it("lets two plugins use the same preset id", () => {
    expect(
      collectNavigationPresets([
        { navigation: [{ href: "/a", id: "home" }], pluginId: "@acme/a" },
        { navigation: [{ href: "/b", id: "home" }], pluginId: "@acme/b" },
      ]),
    ).toHaveLength(2);
  });

  it("refuses one plugin declaring an id twice", () => {
    expect(() =>
      collectNavigationPresets([
        {
          navigation: [
            { href: "/a", id: "home" },
            { href: "/b", id: "home" },
          ],
          pluginId: "@acme/a",
        },
      ]),
    ).toThrow(NavigationPresetError);
  });

  it.each(["Home", "1 2", "-home", "home/page", ""])(
    "refuses the id %j",
    id => {
      expect(() =>
        collectNavigationPresets([
          { navigation: [{ href: "/a", id }], pluginId: "@acme/a" },
        ]),
      ).toThrow(NavigationPresetError);
    },
  );

  it.each(["", "home", "//cdn", "javascript:alert(1)"])(
    "refuses the href %j",
    href => {
      expect(() =>
        collectNavigationPresets([
          { navigation: [{ href, id: "home" }], pluginId: "@acme/a" },
        ]),
      ).toThrow(NavigationPresetError);
    },
  );
});

describe("findNavigationPreset", () => {
  const presets = collectNavigationPresets([
    { navigation: [{ href: "/a", id: "home" }], pluginId: "@acme/a" },
    { navigation: [{ href: "/b", id: "home" }], pluginId: "@acme/b" },
  ]);

  it("matches on the plugin and the id together", () => {
    expect(findNavigationPreset(presets, "@acme/b", "home")?.href).toBe("/b");
    expect(findNavigationPreset(presets, "@acme/c", "home")).toBeUndefined();
  });
});
