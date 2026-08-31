// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The manifest and the filesystem, checked against each other.
 *
 * `package.json` is the only file in this package whose mistakes are invisible
 * from inside it. Every path in `exports` and `sideEffects` points into `dist/`,
 * which does not exist until `build:plugins` has run, so nothing - not the
 * compiler, not a test, not `pnpm build` - notices a subpath whose files were
 * deleted underneath it. `./tanstack/<name>/client` survived the whole Next.js
 * migration that way: a pattern with zero files behind it, published, and
 * resolving to a module error for the first consumer to try it.
 *
 * So the check is a mapping rather than a resolution. Each manifest path is
 * turned back into the source it is compiled from - `./dist/src/x.js` is
 * `src/x.ts` - and a subpath with no source behind it is a dead subpath. That
 * catches deletion, which is the only way these go wrong; a build that fails to
 * emit is a different failure with its own loud output.
 */

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

interface Manifest {
  exports: Record<string, Record<string, string> | string>;
  sideEffects: string[];
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as Manifest;

/** Every file this package could compile or publish, relative to its root. */
const sourceFiles = ((): string[] => {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        if ([".turbo", "dist", "node_modules"].includes(entry.name)) continue;
        walk(path);
        continue;
      }

      found.push(relative(packageRoot, path));
    }
  };

  walk(join(packageRoot, "src"));

  return found;
})();

/**
 * A manifest path as the source pattern it is built from.
 *
 * Two rewrites, both of them how this package's build is actually configured:
 * `swc src -d dist` puts sources under `dist/src`, so `./dist/src/` is `src/`;
 * and a `.js` in `exports` came from a `.ts` or a `.tsx`, which is why the
 * extension becomes an alternation rather than a literal.
 *
 * A glob `*` stops at a path separator and a leading globstar does not, which
 * is what lets one entry mean "this filename anywhere" and another mean "one
 * directory level here". A `sideEffects` glob with no separator in it at all is
 * a bundler's basename rule - `*.css` means every stylesheet, not a stylesheet
 * in the package root - so it is anchored the same way, one level down.
 */
const sourcePattern = (manifestPath: string): RegExp => {
  const cleaned = manifestPath
    .replace(/^\.\//, "")
    .replace(/^dist\/src\//, "src/");

  const anchored = cleaned.includes("/") ? cleaned : `**/${cleaned}`;

  // One pass over both glob shapes, the longer alternative first, so the
  // single-star rewrite cannot eat half of a globstar. The escape above
  // deliberately leaves `*` alone, which is what lets this run second.
  const escaped = anchored
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/|\*/g, glob => (glob === "*" ? "[^/]*" : "(?:.*/)?"));

  const withExtension = escaped.replace(
    /\\\.(?:js|d\\\.ts)$/,
    "\\.(?:ts|tsx|mts|cts)",
  );

  return new RegExp(`^${withExtension}$`);
};

const matchesFor = (manifestPath: string): string[] => {
  const pattern = sourcePattern(manifestPath);

  return sourceFiles.filter(file => pattern.test(file));
};

/** The `import` target of a subpath, which is the one a bundler follows. */
const importTarget = (value: Record<string, string> | string): string =>
  typeof value === "string" ? value : value.import;

describe("the export map is checked against a populated tree", () => {
  it("found the source files to check against", () => {
    // Guards the guard: an empty list makes every assertion below vacuous.
    expect(sourceFiles.length).toBeGreaterThan(1000);
  });

  it("rewrites a dist path back to the source it is built from", () => {
    expect(matchesFor("./dist/src/content/index.js")).toEqual([
      "src/content/index.ts",
    ]);
  });

  it("finds a .tsx behind a .js, because most components are one", () => {
    expect(matchesFor("./dist/src/components/ui/button.js")).toEqual([
      "src/components/ui/button.tsx",
    ]);
  });

  it("expands a pattern subpath across the directories it covers", () => {
    expect(matchesFor("./dist/src/tanstack/*/index.js").length).toBeGreaterThan(
      5,
    );
  });

  it("keeps a single star inside one directory level", () => {
    // `*` must not cross a separator, or a dead one-level pattern would be
    // rescued by a file several directories down.
    expect(matchesFor("./dist/src/*.js")).not.toContain("src/content/index.ts");
  });

  it("reads a separator-free glob as a basename, the way a bundler does", () => {
    // `sideEffects: ["*.css"]` means every stylesheet in the package, not one
    // sitting in its root. Anchoring it literally would fail the entry for
    // being correct.
    expect(matchesFor("*.css")).toContain("src/tiptap.css");
  });

  it("reports nothing for a path whose files are gone", () => {
    // The shape of the bug this file exists to catch, as a positive control.
    expect(matchesFor("./dist/src/tanstack/*/client.js")).toEqual([]);
    expect(matchesFor("./dist/src/content/next/index.js")).toEqual([]);
  });
});

describe("every export subpath has at least one file behind it", () => {
  const subpaths = Object.keys(manifest.exports);

  it("covers the whole map, so no subpath is checked by accident", () => {
    expect(subpaths.length).toBeGreaterThan(10);
  });

  it.each(subpaths)("%s", subpath => {
    expect(
      matchesFor(importTarget(manifest.exports[subpath])).length,
    ).toBeGreaterThan(0);
  });
});

describe("every sideEffects entry has at least one file behind it", () => {
  /**
   * A `*.server.js` glob was in this list until Stage 18 and matched nothing:
   * the package has no `*.server.ts` module and never did on Vite. Server
   * separation here is `content/` versus `content/server/`, plus the
   * `server.ts` beside each TanStack namespace - which the `server.js` entry
   * covers. A stale glob is harmless to a bundler and a lie to a reader, and
   * the reader is the only reason this field is hand-maintained.
   */
  it.each(manifest.sideEffects)("%s", entry => {
    expect(matchesFor(entry).length).toBeGreaterThan(0);
  });
});

describe("the compatibility subpaths keep pointing where they point", () => {
  /**
   * Two subpaths whose names invite exactly the wrong deletion, pinned here as
   * well as in `next-boundary.test.ts` because the question differs. There it
   * is "did this survive the migration"; here it is "does the alias still
   * resolve", which is what a consumer's import actually depends on.
   */
  it("./content/fingerprint is still the hash module, not a fingerprint.ts", () => {
    expect(importTarget(manifest.exports["./content/fingerprint"])).toBe(
      "./dist/src/content/hash.js",
    );
    expect(existsSync(join(packageRoot, "src/content/hash.ts"))).toBe(true);
    // Renaming the source to match the subpath is the tempting mistake: it
    // would move the file every internal importer names.
    expect(existsSync(join(packageRoot, "src/content/fingerprint.ts"))).toBe(
      false,
    );
  });

  it("./content/admin-form is still the Content Engine layout API", () => {
    expect(importTarget(manifest.exports["./content/admin-form"])).toBe(
      "./dist/src/views/admin/views/content/form/index.js",
    );
  });
});
