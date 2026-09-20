import { describe, expect, it } from "vitest";

import type { PublicNavigationItem } from "./navigation";

import {
  isExternalNavigationHref,
  isValidNavigationHref,
  navigationItemLabels,
  navigationMessagesNamespace,
  navigationNamespaces,
  navigationPresetKey,
  parseNavigationPresetKey,
  resolveNavigationText,
} from "./navigation";

const preset = (
  overrides: Partial<PublicNavigationItem> = {},
): PublicNavigationItem => ({
  description: [],
  href: "/discover",
  icon: null,
  id: 1,
  isOpenInNewTab: false,
  kind: "preset",
  pluginId: "@vitnode/core",
  presetId: "discover",
  title: [],
  ...overrides,
});

const messages: Record<string, Record<string, string>> = {
  "core.navigation": {
    "discover.description": "Fresh threads",
    "discover.title": "Discover",
  },
};

const translate = (namespace: string, key: string) =>
  messages[namespace]?.[key];

describe("navigationMessagesNamespace", () => {
  it("maps core onto its own message tree", () => {
    expect(navigationMessagesNamespace("@vitnode/core")).toBe(
      "core.navigation",
    );
  });

  it("gives every other plugin a namespace under its id", () => {
    expect(navigationMessagesNamespace("@vitnode/blog")).toBe(
      "@vitnode/blog.navigation",
    );
  });
});

describe("resolveNavigationText", () => {
  it("prefers the reader's own language", () => {
    expect(
      resolveNavigationText({
        fallback: "Default",
        locale: "pl",
        values: [
          { languageCode: "en", value: "English" },
          { languageCode: "pl", value: "Polski" },
        ],
      }),
    ).toBe("Polski");
  });

  it("falls back to the preset default before another language", () => {
    expect(
      resolveNavigationText({
        fallback: "Odkrywaj",
        locale: "pl",
        values: [{ languageCode: "en", value: "Discover" }],
      }),
    ).toBe("Odkrywaj");
  });

  it("uses any language rather than nothing", () => {
    expect(
      resolveNavigationText({
        locale: "pl",
        values: [
          { languageCode: "de", value: "   " },
          { languageCode: "en", value: "Discover" },
        ],
      }),
    ).toBe("Discover");
  });

  it("treats a blank override as no override", () => {
    expect(
      resolveNavigationText({
        fallback: "Discover",
        locale: "en",
        values: [{ languageCode: "en", value: "  " }],
      }),
    ).toBe("Discover");
  });
});

describe("navigationItemLabels", () => {
  it("reads a preset's defaults from its plugin namespace", () => {
    expect(
      navigationItemLabels({ item: preset(), locale: "en", translate }),
    ).toEqual({ description: "Fresh threads", title: "Discover" });
  });

  it("lets a stored title win over the preset default", () => {
    expect(
      navigationItemLabels({
        item: preset({ title: [{ languageCode: "en", value: "Explore" }] }),
        locale: "en",
        translate,
      }).title,
    ).toBe("Explore");
  });

  it("has no defaults for a custom link", () => {
    expect(
      navigationItemLabels({
        item: preset({
          kind: "custom",
          pluginId: null,
          presetId: null,
          title: [{ languageCode: "en", value: "Docs" }],
        }),
        locale: "en",
        translate,
      }),
    ).toEqual({ description: "", title: "Docs" });
  });
});

describe("navigationNamespaces", () => {
  it("collects one namespace per plugin with a preset in the menu", () => {
    expect(
      navigationNamespaces([
        preset(),
        preset({ id: 2, presetId: "search" }),
        preset({ id: 3, pluginId: "@vitnode/blog", presetId: "posts" }),
        preset({ id: 4, kind: "custom", pluginId: null, presetId: null }),
      ]),
    ).toEqual(["@vitnode/blog.navigation", "core.navigation"]);
  });

  it("is empty when the menu is custom links only", () => {
    expect(
      navigationNamespaces([
        preset({ kind: "custom", pluginId: null, presetId: null }),
      ]),
    ).toEqual([]);
  });
});

describe("hrefs", () => {
  it.each([
    "/discover",
    "/docs/dev",
    "https://vitnode.com",
    "https://a.b/c?x=1",
  ])("accepts %s", href => {
    expect(isValidNavigationHref(href)).toBe(true);
  });

  it.each([
    "",
    " /x",
    "//evil.com",
    "javascript:alert(1)",
    "discover",
    "/a b",
    "http://vitnode.com",
    "HTTP://vitnode.com",
  ])("rejects %s", href => {
    expect(isValidNavigationHref(href)).toBe(false);
  });

  it("tells an external address from a path on this site", () => {
    expect(isExternalNavigationHref("https://vitnode.com")).toBe(true);
    expect(isExternalNavigationHref("mailto:hi@vitnode.com")).toBe(true);
    expect(isExternalNavigationHref("//cdn.example")).toBe(true);
    expect(isExternalNavigationHref("/discover")).toBe(false);
  });
});

describe("preset keys", () => {
  it("round-trips a scoped plugin id", () => {
    const key = navigationPresetKey("@vitnode/blog", "posts");

    expect(parseNavigationPresetKey(key)).toEqual({
      pluginId: "@vitnode/blog",
      presetId: "posts",
    });
  });

  it("refuses a key with either half missing", () => {
    expect(parseNavigationPresetKey("posts")).toBeNull();
    expect(parseNavigationPresetKey("::posts")).toBeNull();
    expect(parseNavigationPresetKey("@vitnode/blog::")).toBeNull();
  });
});
