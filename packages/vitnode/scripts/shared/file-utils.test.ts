import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cleanupDeletedFiles, transformFileImports } from "./file-utils";

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
    const sourceDir = join(root, "src", "routes", "main");
    const destinationDir = join(
      root,
      "app",
      "[locale]",
      "(main)",
      "(plugins)",
      "(blog)",
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

  it("never prunes a shared @breadcrumb dir even when the source owns files", () => {
    const sourceDir = join(root, "src", "routes", "breadcrumb", "main");
    const destinationDir = join(
      root,
      "app",
      "[locale]",
      "(main)",
      "@breadcrumb",
    );

    write(join(sourceDir, "page.tsx"));

    const owned = join(destinationDir, "page.tsx");
    const foreign = join(destinationDir, "other", "page.tsx");
    write(owned);
    write(foreign);

    cleanupDeletedFiles(sourceDir, destinationDir, remove);

    expect(removed).toEqual([]);
    expect(existsSync(owned)).toBe(true);
    expect(existsSync(foreign)).toBe(true);
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

/**
 * What a route file's imports become on their way into a Next.js app.
 *
 * `src/routes/**` in a plugin (core included) is the source of truth, and this
 * is what rewrites its imports so the copy resolves from the app: `@/x` and
 * `../x` both become `<package>/x`. A specifier this misses is copied through
 * untouched, where `@/` points at the *app's* own `src/` - so it resolves to
 * nothing, and the error appears in a generated file nobody edited.
 */
describe("transformFileImports", () => {
  const transform = (code: string) =>
    transformFileImports(code, "@vitnode/core");

  it("rewrites a named value import", () => {
    expect(
      transform('import { HeaderContent } from "@/components/ui/x";'),
    ).toBe('import { HeaderContent } from "@vitnode/core/components/ui/x";');
  });

  it("rewrites a named *type* import", () => {
    // The case that broke: the named-binding alternative came before the bare
    // identifier one, so `type` was consumed as the identifier and the clause
    // then failed to find `from`.
    expect(
      transform('import type { Params } from "@/views/admin/table/x";'),
    ).toBe('import type { Params } from "@vitnode/core/views/admin/table/x";');
  });

  it("rewrites a default type import", () => {
    expect(transform('import type Params from "@/views/admin/table/x";')).toBe(
      'import type Params from "@vitnode/core/views/admin/table/x";',
    );
  });

  it("rewrites relative imports the same way", () => {
    expect(transform('import type { A } from "../../lib/a";')).toBe(
      'import type { A } from "@vitnode/core/lib/a";',
    );
  });

  it("rewrites a lazy import's specifier", () => {
    expect(transform('const X = React.lazy(() => import("@/views/x"));')).toBe(
      'const X = React.lazy(() => import("@vitnode/core/views/x"));',
    );
  });

  it("leaves a package specifier alone", () => {
    const code = 'import type { Metadata } from "next";';

    expect(transform(code)).toBe(code);
  });
});
