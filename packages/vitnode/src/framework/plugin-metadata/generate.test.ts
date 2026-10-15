import { describe, expect, it } from "vitest";

import { pluginMetadataFromManifest } from "./generate.js";

const SOURCE = "package.json";

describe("pluginMetadataFromManifest", () => {
  it("reads the package fields, trimmed, and ignores everything else", () => {
    expect(
      pluginMetadataFromManifest(
        {
          description: "  Posts and categories  ",
          name: "@acme/blog",
          version: "1.2.0",
          vitnode: { icon: "./assets/icon.svg", title: "Blog" },
        },
        SOURCE,
      ),
    ).toEqual({
      description: "Posts and categories",
      id: "@acme/blog",
      version: "1.2.0",
    });
  });

  it.each([
    ["missing", { name: "@acme/blog" }],
    ["blank", { description: " ", name: "@acme/blog", version: "" }],
    ["null", { description: null, name: "@acme/blog", version: null }],
  ])("reads %s optional fields as unknown", (_, manifest) => {
    expect(pluginMetadataFromManifest(manifest, SOURCE)).toEqual({
      description: null,
      id: "@acme/blog",
      version: null,
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
      "a non-string description",
      { description: ["Posts"], name: "@acme/blog" },
      /`description`.*has to be a string/,
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
