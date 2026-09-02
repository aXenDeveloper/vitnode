import { describe, expect, it } from "vitest";

import {
  buildMonthFolder,
  buildStorageKey,
  generateStorageFileName,
  getFileExtension,
  parseImageDimensions,
  replaceFileExtension,
  safeStorageExtension,
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

describe("safeStorageExtension", () => {
  describe("when the media type is one VitNode knows", () => {
    it("keeps an extension that belongs to it", () => {
      expect(safeStorageExtension(".png", "image/png")).toBe(".png");
      expect(safeStorageExtension(".jpeg", "image/jpeg")).toBe(".jpeg");
    });

    it("replaces one that does not", () => {
      // The attack this exists for: the browser announces `image/gif`, the file
      // passes the media-type check, and the name decides what it is written to
      // disk as. Served back from the site's own origin, `.html` is a page.
      expect(safeStorageExtension(".html", "image/gif")).toBe(".gif");
      expect(safeStorageExtension(".svg", "image/png")).toBe(".png");
      expect(safeStorageExtension("", "image/webp")).toBe(".webp");
    });

    it("reads the type without its parameters", () => {
      expect(safeStorageExtension(".png", "image/png; charset=binary")).toBe(
        ".png",
      );
    });

    it("is case-insensitive on both sides", () => {
      expect(safeStorageExtension(".PNG", "IMAGE/PNG")).toBe(".png");
    });

    it("still stores SVG as SVG", () => {
      // A real image type. Script inside one is the serving layer's problem -
      // see the sandbox headers on the uploads mount.
      expect(safeStorageExtension(".svg", "image/svg+xml")).toBe(".svg");
    });
  });

  describe("when the media type is unknown", () => {
    it("keeps an inert extension", () => {
      expect(safeStorageExtension(".psd", "application/octet-stream")).toBe(
        ".psd",
      );
      expect(safeStorageExtension(".docx")).toBe(".docx");
    });

    it.each([
      ".html",
      ".htm",
      ".xhtml",
      ".js",
      ".mjs",
      ".php",
      ".phtml",
      ".jsp",
      ".aspx",
      ".xml",
      ".xsl",
      ".svgz",
      ".swf",
      ".sh",
    ])("neutralises %s", extension => {
      expect(safeStorageExtension(extension)).toBe(".bin");
    });

    it("neutralises them case-insensitively", () => {
      expect(safeStorageExtension(".HTML")).toBe(".bin");
      expect(safeStorageExtension(".PhP")).toBe(".bin");
    });

    it.each([
      ["", "no extension"],
      [".", "a bare dot"],
      ["..", "a climb"],
      [".a b", "a space"],
      [".ht/ml", "a separator"],
      [".verylongextensionindeed", "an overlong one"],
    ])("neutralises %s (%s)", extension => {
      expect(safeStorageExtension(extension)).toBe(".bin");
    });
  });
});

describe("generateStorageFileName with a media type", () => {
  it("stores a mislabelled name under the media type's extension", () => {
    expect(
      generateStorageFileName("payload.html", undefined, "image/gif"),
    ).toMatch(/^[0-9a-f-]{36}\.gif$/);
  });

  it("keeps a server-derived override that fits the type", () => {
    expect(generateStorageFileName("photo.png", ".webp", "image/webp")).toMatch(
      /^[0-9a-f-]{36}\.webp$/,
    );
  });

  it("neutralises an executable extension when the type is unknown", () => {
    expect(generateStorageFileName("payload.php")).toMatch(
      /^[0-9a-f-]{36}\.bin$/,
    );
  });
});
