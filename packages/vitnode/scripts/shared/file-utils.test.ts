import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupDeletedFiles } from "./file-utils";

describe("cleanupDeletedFiles", () => {
  let root: string;
  let removed: string[];
  let counter = 0;

  const remove = (p: string) => {
    removed.push(p);
    rmSync(p, { force: true });
  };

  const write = (p: string, content = "x") => {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  };

  beforeEach(() => {
    counter += 1;
    root = join(tmpdir(), `vitnode-cleanup-${process.pid}-${counter}`);
    mkdirSync(root, { recursive: true });
    removed = [];
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("does NOT remove anything from a shared destination when the source dir is missing", () => {
    // Reproduces the bug: a plugin without breadcrumb routes (e.g. @vitnode/blog)
    // points at the SHARED `@breadcrumb` slot that core populated. Its source
    // dir does not exist, so nothing it "owns" is there to mirror.
    const sourceDir = join(
      root,
      "plugins",
      "blog",
      "routes",
      "breadcrumb",
      "main",
    );
    const destinationDir = join(
      root,
      "app",
      "[locale]",
      "(main)",
      "@breadcrumb",
    );

    // core already copied its breadcrumb files into the shared destination
    const corePage = join(destinationDir, "page.tsx");
    const coreSettings = join(destinationDir, "settings", "page.tsx");
    write(corePage);
    write(coreSettings);

    expect(existsSync(sourceDir)).toBe(false);

    cleanupDeletedFiles(sourceDir, destinationDir, remove);

    expect(removed).toEqual([]);
    expect(existsSync(corePage)).toBe(true);
    expect(existsSync(coreSettings)).toBe(true);
  });

  it("removes only orphaned dest files that no longer exist in an owned source", () => {
    const sourceDir = join(root, "src", "routes", "breadcrumb", "main");
    const destinationDir = join(
      root,
      "app",
      "[locale]",
      "(main)",
      "@breadcrumb",
    );

    // source ships only `page.tsx`
    write(join(sourceDir, "page.tsx"));

    // destination has the current file plus a stale one
    const kept = join(destinationDir, "page.tsx");
    const stale = join(destinationDir, "old", "page.tsx");
    write(kept);
    write(stale);

    cleanupDeletedFiles(sourceDir, destinationDir, remove);

    expect(removed).toEqual([stale]);
    expect(existsSync(kept)).toBe(true);
    expect(existsSync(stale)).toBe(false);
  });

  it("never prunes locale directories even with a mismatched source", () => {
    const sourceDir = join(root, "src", "locales");
    const destinationDir = join(root, "app", "src", "locales", "@vitnode-core");

    write(join(sourceDir, "en.json")); // source exists but content differs
    const localeFile = join(destinationDir, "en.json");
    write(localeFile);

    cleanupDeletedFiles(sourceDir, destinationDir, remove);

    expect(removed).toEqual([]);
    expect(existsSync(localeFile)).toBe(true);
  });

  it("does nothing when the destination dir does not exist", () => {
    const sourceDir = join(root, "src", "routes", "breadcrumb", "main");
    write(join(sourceDir, "page.tsx"));
    const destinationDir = join(root, "does", "not", "exist");

    cleanupDeletedFiles(sourceDir, destinationDir, remove);

    expect(removed).toEqual([]);
  });
});
