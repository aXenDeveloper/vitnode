// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, "../..");

const filesUnder = (directory: string): string[] => {
  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      entries.push(...filesUnder(path));
      continue;
    }
    if (/\.tsx?$/.test(name)) entries.push(path);
  }

  return entries;
};

const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8").matchAll(
      /from\s+"([^"]+)"|import\s+"([^"]+)"/g,
    ),
  ]
    .map(match => match[1] ?? match[2])
    .filter(Boolean);

/**
 * The rule the `framework/cache` layer is for, asserted rather than remembered.
 *
 * Cache invalidation is spread across every write path there is - forty-odd
 * server actions, the Content Engine, the search feed - so left alone it couples
 * the whole codebase to one framework's cache functions a line at a time. This
 * suite pins both halves: `next/cache` is imported in exactly one file, and the
 * framework-free half stays loadable from plain Node so `apps/api` and
 * drizzle-kit can keep reading the parts of the layer that are only types and
 * strings.
 */
describe("cache layer boundaries", () => {
  const sourceFiles = filesUnder(sourceRoot);
  const adapter = relative(sourceRoot, join(here, "next.ts"));

  it("has files to check", () => {
    // A move that relocated the package should fail loudly here rather than
    // making the suite vacuously pass.
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it("imports next/cache from the Next adapter and nowhere else", () => {
    const importers = sourceFiles
      .filter(path => importsFrom(path).includes("next/cache"))
      .map(path => relative(sourceRoot, path));

    expect(importers).toEqual([adapter]);
  });

  it("keeps the framework-agnostic half free of any framework import", () => {
    // An adapter for another framework imports these, and so does anything that
    // has to load in plain Node. One `next/*` import here would put Next back in
    // that graph.
    const agnostic = ["runtime.ts", "types.ts"];

    const offenders = agnostic.filter(name =>
      importsFrom(join(here, name)).some(specifier =>
        specifier.startsWith("next/"),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("routes the whole layer through the barrel, not the adapter", () => {
    // Importing `./next` directly would bind a call site to Next again even
    // though it went through this folder to do it.
    const offenders = sourceFiles
      .filter(path => dirname(path) !== here)
      .filter(path =>
        importsFrom(path).some(specifier =>
          specifier.endsWith("framework/cache/next"),
        ),
      )
      .map(path => relative(sourceRoot, path));

    expect(offenders).toEqual([]);
  });

  it("never puts the barrel in a plain-Node layer's import graph", () => {
    // The barrel installs the Next adapter, so importing it pulls in both
    // `next/cache` and `server-only` - and `content/` and `content/server/` are
    // loaded by `apps/api` (a plain `@hono/node-server` process) and by
    // drizzle-kit, where both of those throw. Those layers read `./runtime` and
    // `./types` instead, and `content/boundaries.test.ts` cannot catch a slip
    // here: the specifier it would see is a relative path, not `next/*`.
    const plainNode = filesUnder(join(sourceRoot, "content")).filter(
      path => !path.includes(`${sep}content${sep}next${sep}`),
    );

    const offenders = plainNode
      .filter(path =>
        importsFrom(path).some(specifier =>
          /^(?:@\/|(?:\.\.\/)+)framework\/cache$/.test(specifier),
        ),
      )
      .map(path => relative(sourceRoot, path));

    expect(offenders).toEqual([]);
  });
});
