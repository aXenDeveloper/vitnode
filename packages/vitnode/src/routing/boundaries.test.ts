// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

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
    .filter((specifier): specifier is string => Boolean(specifier));

/**
 * The rule this layer exists to keep.
 *
 * A plugin route manifest is VitNode configuration data. It is read while a
 * Next.js app builds, while a TanStack Start app builds, and by a plain
 * `vitest` process with no framework loaded at all - so a single import of
 * `next/*` or `@tanstack/*` here does not fail in review, it fails for whoever
 * is not using that framework.
 *
 * Stated as "imports nothing but its own files" rather than as a list of banned
 * packages, because a list is something somebody has to remember to extend.
 */
describe("the routing layer is framework-neutral", () => {
  const files = filesUnder(here).filter(path => !/\.test\.tsx?$/.test(path));

  it("has files to check", () => {
    // Every assertion below is vacuously true against an empty list.
    expect(files.length).toBeGreaterThan(3);
  });

  it("imports nothing but its own modules", () => {
    const offenders = files.flatMap(path =>
      importsFrom(path)
        .filter(specifier => !specifier.startsWith("."))
        .map(specifier => `${relative(here, path)} -> ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it.each([
    "@tanstack/react-router",
    "@tanstack/react-start",
    "next",
    "next-intl",
    "react",
    "server-only",
  ])("never imports %s", forbidden => {
    // Redundant with the rule above by construction, and worth writing anyway:
    // this is the list a failure should name, and these are the packages a
    // future contributor will actually be tempted to reach for.
    const offenders = files.filter(path =>
      importsFrom(path).some(
        specifier =>
          specifier === forbidden || specifier.startsWith(`${forbidden}/`),
      ),
    );

    expect(offenders.map(path => relative(here, path))).toEqual([]);
  });
});
