import { describe, expect, it } from "vitest";

import { pluginManifestFromPackageJson } from "./generate.js";

const SOURCE = "package.json";

describe("pluginManifestFromPackageJson", () => {
  it("reads the package fields, trimmed, and ignores everything else", () => {
    expect(
      pluginManifestFromPackageJson(
        {
          description: "  Posts and categories  ",
          name: "@acme/blog",
          version: "1.2.0",
          vitnode: { icon: "./assets/icon.svg", title: "Blog" },
        },
        SOURCE,
      ),
    ).toEqual({
      author: null,
      description: "Posts and categories",
      id: "@acme/blog",
      license: null,
      updates: null,
      version: "1.2.0",
    });
  });

  it.each([
    ["missing", { name: "@acme/blog" }],
    ["blank", { description: " ", name: "@acme/blog", version: "" }],
    ["null", { description: null, name: "@acme/blog", version: null }],
  ])("reads %s optional fields as unknown", (_, manifest) => {
    expect(pluginManifestFromPackageJson(manifest, SOURCE)).toEqual({
      author: null,
      description: null,
      id: "@acme/blog",
      license: null,
      updates: null,
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
    expect(() => pluginManifestFromPackageJson(manifest, SOURCE)).toThrow(
      error,
    );
  });

  it("reads the update source from `vitnode.updates.url`, trimmed", () => {
    expect(
      pluginManifestFromPackageJson(
        {
          name: "@acme/blog",
          vitnode: {
            updates: { url: " https://example.com/acme/updates.json " },
          },
        },
        SOURCE,
      ).updates,
    ).toEqual({ url: "https://example.com/acme/updates.json" });
  });

  it.each([
    ["a non-object `vitnode`", "plugin", /`vitnode` in package\.json/],
    ["no url", { updates: {} }, /`vitnode\.updates` in package\.json/],
    ["a non-string url", { updates: { url: 1 } }, /`vitnode\.updates`/],
    [
      "a url carrying a token",
      { updates: { url: "https://example.com/updates.json?token=secret" } },
      /`vitnode\.updates\.url` in package\.json cannot carry a query string/,
    ],
  ])("rejects an update source with %s", (_, vitnode, error) => {
    expect(() =>
      pluginManifestFromPackageJson({ name: "@acme/blog", vitnode }, SOURCE),
    ).toThrow(error);
  });

  it("names the file and the manifest prefix in its errors", () => {
    expect(() =>
      pluginManifestFromPackageJson({}, "plugins/blog/package.json"),
    ).toThrow(/^\[VitNode plugin manifest\] plugins\/blog\/package.json/);
  });
});
