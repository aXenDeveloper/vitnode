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

const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const importsFrom = (path: string): string[] =>
  [...codeOf(path).matchAll(/from\s+"([^"]+)"|import\s+"([^"]+)"/g)]
    .map(match => match[1] ?? match[2])
    .filter((specifier): specifier is string => Boolean(specifier));

describe("the routing layer is framework-neutral", () => {
  // `.test-d.ts` as well as `.test.ts`: a type test asserts against `vitest`'s
  // `expectTypeOf` and is erased before anything runs, so its import is not one
  // this layer makes.
  const files = filesUnder(here).filter(
    path => !/\.test(-d)?\.tsx?$/.test(path),
  );

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
