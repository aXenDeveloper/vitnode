// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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

/** The request APIs this layer exists to own. */
const REQUEST_MODULES = ["next/headers", "next/server"];

/** Everything in this folder that must stay loadable without a framework. */
const AGNOSTIC = ["runtime.ts", "types.ts"];

/**
 * The rule the `framework/request` layer is for, asserted rather than
 * remembered.
 *
 * Per-request state is the part of a host framework that reaches furthest into
 * a codebase: cookies and headers are read wherever the API is called, and
 * "wait for a real request" is read wherever something is cached. Left alone
 * those imports spread, and by the time a second runtime is on the table the
 * coupling is everywhere instead of in one file.
 *
 * Both halves are pinned here, because either one alone is satisfiable by
 * accident: nothing outside `next.ts` imports the request APIs, and the
 * framework-free files stay framework-free so an adapter for another runtime -
 * and the plain-Node processes that load `content/` - can import them.
 */
describe("request layer boundaries", () => {
  const sourceFiles = filesUnder(sourceRoot);
  const adapter = relative(sourceRoot, join(here, "next.ts"));

  it("has files to check", () => {
    // A move that relocated the package should fail loudly here rather than
    // making the suite vacuously pass.
    expect(sourceFiles.length).toBeGreaterThan(100);
    expect(AGNOSTIC.every(name => sourceFiles.includes(join(here, name)))).toBe(
      true,
    );
  });

  it.each(REQUEST_MODULES)(
    "imports %s in the Next adapter and nowhere else",
    specifier => {
      const importers = sourceFiles
        .filter(path => importsFrom(path).includes(specifier))
        .map(path => relative(sourceRoot, path));

      expect(importers).toEqual([adapter]);
    },
  );

  it("is where those imports actually live", () => {
    // The other half of the rule. Without this the suite above passes just as
    // happily when the adapter has been gutted.
    expect(importsFrom(join(here, "next.ts"))).toEqual(
      expect.arrayContaining(REQUEST_MODULES),
    );
  });

  it.each(AGNOSTIC)("keeps %s free of any framework import", name => {
    // These two are what a second framework's adapter is written against, and
    // what has to keep loading in `apps/api` and drizzle-kit. One `next/*`
    // here - including a convenience re-export from `./next` - puts Next back
    // in that graph, and `server-only` would do the same to the browser.
    const offenders = importsFrom(join(here, name)).filter(
      specifier =>
        specifier.startsWith("next/") ||
        specifier === "./next" ||
        specifier === "server-only",
    );

    expect(offenders).toEqual([]);
  });

  it("installs the adapter from the barrel, not from the adapter itself", () => {
    // `./next` stays a plain description of one framework: the barrel is what
    // decides it is the default. An adapter that installed itself on import
    // would make `hasRequestAdapter()` depend on which module a bundler
    // happened to reach first.
    expect(importsFrom(join(here, "index.ts"))).toEqual(
      expect.arrayContaining(["./next", "./runtime"]),
    );
    expect(readFileSync(join(here, "index.ts"), "utf8")).toContain(
      "setDefaultRequestAdapter(nextRequestAdapter)",
    );
    expect(readFileSync(join(here, "next.ts"), "utf8")).not.toContain(
      "setDefaultRequestAdapter(",
    );
  });
});
