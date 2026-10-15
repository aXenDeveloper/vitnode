import { describe, expect, it } from "vitest";

import {
  assertIconPath,
  PLUGIN_ICON_MAX_BYTES,
  pluginIconDataUrl,
  pluginMetadataFromManifest,
} from "./generate.js";

const SOURCE = "package.json";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

const WEBP = new Uint8Array([
  ...text("RIFF"),
  0x24,
  0x00,
  0x00,
  0x00,
  ...text("WEBP"),
]);

describe("pluginMetadataFromManifest", () => {
  it("reads the catalog fields, trimmed, with the declared icon path", () => {
    expect(
      pluginMetadataFromManifest(
        {
          description: "  Posts and categories  ",
          name: "@acme/blog",
          version: "1.2.0",
          vitnode: { icon: "./assets/icon.svg", title: " Blog " },
        },
        SOURCE,
      ),
    ).toEqual({
      icon: "./assets/icon.svg",
      metadata: {
        description: "Posts and categories",
        id: "@acme/blog",
        title: "Blog",
        version: "1.2.0",
      },
    });
  });

  it.each([
    ["no vitnode field", { name: "@acme/blog" }],
    [
      "blank description and version",
      { description: " ", name: "@acme/blog", version: "" },
    ],
    [
      "null optional fields",
      { description: null, name: "@acme/blog", version: null },
    ],
  ])("falls back to the id and unknown values with %s", (_, manifest) => {
    expect(pluginMetadataFromManifest(manifest, SOURCE)).toEqual({
      icon: null,
      metadata: {
        description: null,
        id: "@acme/blog",
        title: "@acme/blog",
        version: null,
      },
    });
  });

  it.each([
    ["a non-object manifest", ["@acme/blog"], /is not a JSON object/],
    ["a missing name", { version: "1.0.0" }, /has no `name`/],
    ["a blank name", { name: "  " }, /has no `name`/],
    [
      "a non-string version",
      { name: "@acme/blog", version: 1 },
      /`version`.*has to be a string/,
    ],
    [
      "a non-object vitnode field",
      { name: "@acme/blog", vitnode: "Blog" },
      /`vitnode`.*has to be an object/,
    ],
    [
      "an array vitnode field",
      { name: "@acme/blog", vitnode: [] },
      /`vitnode`.*has to be an object/,
    ],
    [
      "an empty title",
      { name: "@acme/blog", vitnode: { title: " " } },
      /`vitnode.title`.*is empty/,
    ],
    [
      "an empty icon",
      { name: "@acme/blog", vitnode: { icon: "" } },
      /`vitnode.icon`.*is empty/,
    ],
    [
      "a URL icon",
      { name: "@acme/blog", vitnode: { icon: "https://x.dev/a.svg" } },
      /a URL/,
    ],
  ])("rejects %s", (_, manifest, error) => {
    expect(() => pluginMetadataFromManifest(manifest, SOURCE)).toThrow(error);
  });

  it("names the file and the metadata prefix in its errors", () => {
    expect(() =>
      pluginMetadataFromManifest({}, "plugins/blog/package.json"),
    ).toThrow(/^\[VitNode plugin metadata\] plugins\/blog\/package.json/);
  });
});

describe("assertIconPath", () => {
  it.each([
    "./assets/icon.svg",
    "assets/icon.png",
    "icon.webp",
    "./icon.jpg",
    "./ICON.JPEG",
  ])("accepts %s", path => {
    expect(() => {
      assertIconPath(path, SOURCE);
    }).not.toThrow();
  });

  it.each([
    ["https://cdn.example.com/icon.svg", /a URL/],
    ["data:image/svg+xml;base64,PHN2Zz4=", /a URL/],
    ["file:///tmp/icon.svg", /a URL/],
    ["//cdn.example.com/icon.svg", /a URL/],
    ["/etc/icon.svg", /absolute path/],
    ["\\icons\\icon.svg", /absolute path/],
    ["./assets/icon.gif", /Supported icon formats/],
    ["./assets/icon", /Supported icon formats/],
  ])("rejects %s", (path, error) => {
    expect(() => {
      assertIconPath(path, SOURCE);
    }).toThrow(error);
  });
});

describe("pluginIconDataUrl", () => {
  it.each([
    [
      "icon.svg",
      text('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      "image/svg+xml",
    ],
    ["icon.png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a), "image/png"],
    ["icon.jpg", bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    ["icon.jpeg", bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    ["icon.webp", WEBP, "image/webp"],
  ])("inlines %s as a %s data URL", (path, content, type) => {
    expect(pluginIconDataUrl(path, content, SOURCE)).toBe(
      `data:${type};base64,${Buffer.from(content).toString("base64")}`,
    );
  });

  it.each([
    ["icon.svg", text("<html></html>")],
    ["icon.png", text('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["icon.jpg", bytes(0x89, 0x50, 0x4e, 0x47)],
    [
      "icon.webp",
      new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WAVE")]),
    ],
  ])("refuses %s whose bytes are another format", (path, content) => {
    expect(() => pluginIconDataUrl(path, content, SOURCE)).toThrow(
      /is not a valid/,
    );
  });

  it("refuses an icon over the size limit, and keeps one at it", () => {
    const svg = (size: number) => {
      const content = new Uint8Array(size).fill(0x20);
      content.set(text("<svg>"));

      return content;
    };

    expect(() =>
      pluginIconDataUrl("icon.svg", svg(PLUGIN_ICON_MAX_BYTES + 1), SOURCE),
    ).toThrow(/bytes/);
    expect(
      pluginIconDataUrl("icon.svg", svg(PLUGIN_ICON_MAX_BYTES), SOURCE),
    ).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
