import { describe, expect, it } from "vitest";

import {
  buildMonthFolder,
  buildStorageKey,
  generateStorageFileName,
  getFileExtension,
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

  it.each(["../etc", "a/b", "", " ", "foo/", "/foo", "."])(
    "rejects unsafe folder %j",
    invalid => {
      expect(() => sanitizeFolder(invalid)).toThrow();
    },
  );
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
