import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appOverrideTree, effectiveDefaultTree } from "./i18n-shared";

const CORE = "@vitnode/core";
const webScope = { api: false, web: true };

/** Writes a package's frontend locale file under a fake `node_modules`. */
const writePackageLocale = (
  root: string,
  locale: string,
  tree: Record<string, unknown>,
) => {
  const dir = join(root, "node_modules", CORE, "src", "locales");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${locale}.json`), JSON.stringify(tree));
};

/** Writes the app's own flat override for a package/locale. */
const writeAppOverride = (
  root: string,
  locale: string,
  tree: Record<string, unknown>,
) => {
  const dir = join(root, "src", "locales", CORE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${locale}.json`), JSON.stringify(tree));
};

describe("effectiveDefaultTree", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vitnode-i18n-"));
    // `findPackagePath` resolves against `process.cwd()`; pin it to the fake
    // repo so the fixture package resolves and the real one never does.
    vi.spyOn(process, "cwd").mockReturnValue(root);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { force: true, recursive: true });
  });

  const resolve = (defaultLocale: string) =>
    effectiveDefaultTree(CORE, {
      appDir: root,
      defaultLocale,
      repoRoot: root,
      scope: webScope,
    });

  it("uses the app's override as the source when the package doesn't ship the default locale", () => {
    // The package ships only `en`; the app declares `pl` as its default and
    // provides the strings itself. Previously this resolved to `{}` and every
    // translation was skipped.
    writePackageLocale(root, "en", {
      core: { cancel: "Cancel", save: "Save" },
    });
    writeAppOverride(root, "pl", {
      core: { cancel: "Anuluj", save: "Zapisz" },
    });

    expect(resolve("pl")).toEqual({
      core: { cancel: "Anuluj", save: "Zapisz" },
    });
  });

  it("merges the app override over the package tree when both ship the default locale", () => {
    writePackageLocale(root, "pl", { core: { cancel: "PKG", save: "PKG" } });
    writeAppOverride(root, "pl", { core: { save: "Zapisz" } });

    // The app override wins per key; keys it omits fall through to the package.
    expect(resolve("pl")).toEqual({
      core: { cancel: "PKG", save: "Zapisz" },
    });
  });

  it("falls back to the package tree in the ordinary `en`-default case", () => {
    writePackageLocale(root, "en", { core: { save: "Save" } });

    expect(resolve("en")).toEqual({ core: { save: "Save" } });
  });

  it("returns an empty tree when neither the package nor the app provides the default locale", () => {
    // Package ships `en` only, app has no `pl` override: nothing is a source of
    // truth, so callers can safely skip rather than emptying files.
    writePackageLocale(root, "en", { core: { save: "Save" } });

    expect(resolve("pl")).toEqual({});
  });
});

describe("appOverrideTree", () => {
  it("returns an empty tree when the app wrote no override", () => {
    const root = mkdtempSync(join(tmpdir(), "vitnode-i18n-"));
    try {
      expect(appOverrideTree(root, CORE, "pl")).toEqual({});
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
