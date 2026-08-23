import { describe, expect, it } from "vitest";

import {
  buildMonthFolder,
  buildStorageKey,
  generateStorageFileName,
  getFileExtension,
  parseImageDimensions,
  replaceFileExtension,
  sanitizeFolder,
} from "./upload";

describe("buildMonthFolder", () => {
  it("formats as month_{month}_{year} with a 1-based month", () => {
    expect(buildMonthFolder(new Date(2026, 6, 5))).toBe("month_7_2026");
  });

  it("uses January as month 1", () => {
    expect(buildMonthFolder(new Date(2026, 0, 15))).toBe("month_1_2026");
  });
});

describe("sanitizeFolder", () => {
  it("accepts a simple path segment", () => {
    expect(sanitizeFolder("avatars")).toBe("avatars");
    expect(sanitizeFolder("blog-images_2")).toBe("blog-images_2");
  });

  it("accepts nesting, so uploads can be grouped by owner", () => {
    // What the Content Engine's generated route uses: `{plugin}/{module}`, so a
    // bucket reads as the plugins in it rather than as one flat pile.
    expect(sanitizeFolder("vitnode-blog/posts")).toBe("vitnode-blog/posts");
    expect(sanitizeFolder("a/b/c")).toBe("a/b/c");
  });

  it.each([
    "../etc",
    "a/../b",
    "..",
    "a/..",
    "",
    " ",
    "foo/",
    "/foo",
    "a//b",
    ".",
    "a/.hidden",
    "a\\..\\b",
  ])("rejects unsafe folder %j", invalid => {
    // Every one of these is refused by the *segment* rule rather than by a list
    // of known tricks: climbing out needs a segment that is not a plain name.
    expect(() => sanitizeFolder(invalid)).toThrow();
  });
});

describe("getFileExtension", () => {
  it("returns the lowercased extension", () => {
    expect(getFileExtension("Photo.PNG")).toBe(".png");
    expect(getFileExtension("archive.tar.gz")).toBe(".gz");
  });

  it("returns an empty string when there is no usable extension", () => {
    expect(getFileExtension("README")).toBe("");
    expect(getFileExtension(".env")).toBe("");
    expect(getFileExtension("trailing.")).toBe("");
  });
});

describe("generateStorageFileName", () => {
  it("uses a random uuid and preserves the extension", () => {
    expect(generateStorageFileName("photo.png")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
  });

  it("produces a unique name each time", () => {
    expect(generateStorageFileName("a.png")).not.toBe(
      generateStorageFileName("a.png"),
    );
  });

  it("overrides the extension when one is given", () => {
    expect(generateStorageFileName("photo.png", ".webp")).toMatch(
      /^[0-9a-f-]{36}\.webp$/,
    );
  });
});

describe("replaceFileExtension", () => {
  it("swaps an existing extension", () => {
    expect(replaceFileExtension("photo.png", ".webp")).toBe("photo.webp");
    expect(replaceFileExtension("archive.tar.gz", ".webp")).toBe(
      "archive.tar.webp",
    );
  });

  it("adds the extension when the name has none", () => {
    expect(replaceFileExtension("photo", ".webp")).toBe("photo.webp");
  });
});

describe("buildStorageKey", () => {
  it("builds month_x_y/{folder}/{fileName}", () => {
    expect(
      buildStorageKey({
        folder: "avatars",
        fileName: "abc.png",
        now: new Date(2026, 6, 5),
      }),
    ).toBe("month_7_2026/avatars/abc.png");
  });

  it("rejects an unsafe folder", () => {
    expect(() =>
      buildStorageKey({ folder: "../secrets", fileName: "x.png" }),
    ).toThrow();
  });
});

describe("parseImageDimensions", () => {
  it("reads numeric width and height", () => {
    expect(
      parseImageDimensions({ dimensions: { width: 320, height: 180 } }),
    ).toEqual({ width: 320, height: 180 });
  });

  it("returns null when dimensions are missing or malformed", () => {
    expect(parseImageDimensions({})).toBeNull();
    expect(parseImageDimensions({ dimensions: null })).toBeNull();
    expect(
      parseImageDimensions({ dimensions: { width: "320", height: 180 } }),
    ).toBeNull();
    expect(parseImageDimensions({ dimensions: { width: 320 } })).toBeNull();
  });
});
