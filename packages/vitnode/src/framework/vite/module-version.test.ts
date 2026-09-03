import { describe, expect, it } from "vitest";

import { moduleFileVersion, versionedModuleUrl } from "./module-version";

const stats = (size: number, mtimeMs: number) => ({ mtimeMs, size });

describe("the version is a fingerprint, not a clock", () => {
  it("is the same tag for the same file, however often it is asked", () => {
    const file = stats(1024, 1_700_000_000_000);

    expect(moduleFileVersion(file)).toBe(moduleFileVersion(file));
    expect(moduleFileVersion(file)).toBe(
      moduleFileVersion(stats(1024, 1_700_000_000_000)),
    );
  });

  it("does not move on its own", async () => {
    const file = stats(64, 1);
    const before = moduleFileVersion(file);

    await new Promise(resolve => setTimeout(resolve, 5));

    expect(moduleFileVersion(file)).toBe(before);
  });

  it("changes when the file is rewritten to a different length", () => {
    expect(moduleFileVersion(stats(1024, 5))).not.toBe(
      moduleFileVersion(stats(1025, 5)),
    );
  });

  it("changes when the file is rewritten to the same length", () => {
    expect(moduleFileVersion(stats(1024, 5))).not.toBe(
      moduleFileVersion(stats(1024, 6)),
    );
  });

  it("changes when only the length moved, for a filesystem whose clock did not", () => {
    expect(moduleFileVersion(stats(900, 1_700_000_000_000))).not.toBe(
      moduleFileVersion(stats(901, 1_700_000_000_000)),
    );
  });

  it("reads both fields, so neither can be dropped without a failure here", () => {
    const tag = moduleFileVersion(stats(4096, 1_700_000_123_456));

    expect(tag).toContain("4096");
    expect(tag).toContain("1700000123456");
  });
});

describe("the URL the loader is handed", () => {
  it("points at the file, and carries the version as a query parameter", () => {
    const href = versionedModuleUrl(
      "/pkg/example/dist/routes/manifest.js",
      stats(10, 20),
    );
    const url = new URL(href);

    expect(url.protocol).toBe("file:");
    expect(url.pathname).toBe("/pkg/example/dist/routes/manifest.js");
    expect(url.searchParams.get("v")).toBe("10-20");
  });

  it("is the same URL for an unchanged file, so no cache entry leaks per pass", () => {
    const unchanged = stats(10, 20);

    expect(versionedModuleUrl("/pkg/a/manifest.js", unchanged)).toBe(
      versionedModuleUrl("/pkg/a/manifest.js", unchanged),
    );
  });

  it("is a different URL once the file changes, which is what re-reads it", () => {
    expect(versionedModuleUrl("/pkg/a/manifest.js", stats(10, 20))).not.toBe(
      versionedModuleUrl("/pkg/a/manifest.js", stats(10, 21)),
    );
  });

  it("does not confuse two files that happen to share a version", () => {
    const same = stats(10, 20);

    expect(versionedModuleUrl("/pkg/a/manifest.js", same)).not.toBe(
      versionedModuleUrl("/pkg/b/manifest.js", same),
    );
  });

  it("encodes a path that would otherwise break the query it is given", () => {
    const href = versionedModuleUrl("/pkg/we?rd/man#ifest.js", stats(1, 2));
    const url = new URL(href);

    expect(url.searchParams.get("v")).toBe("1-2");
    expect(decodeURIComponent(url.pathname)).toBe("/pkg/we?rd/man#ifest.js");
  });
});
