// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, "../..");

const SKIP_DIRECTORIES = ["dist", "node_modules"];

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      if (SKIP_DIRECTORIES.includes(name)) continue;
      entries.push(...filesUnder(path));
      continue;
    }

    if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) entries.push(path);
  }

  return entries;
};

const isTest = (path: string): boolean =>
  /\.test(-d)?\.tsx?$/.test(path) || path.includes(`${sep}tests${sep}`);

const runtimeSources = (): string[] =>
  filesUnder(sourceRoot).filter(path => !isTest(path));

const asEntry = (path: string): string =>
  relative(sourceRoot, path).split(sep).join("/");

/**
 * Comments stripped, so prose about caching is not mistaken for a header.
 *
 * This codebase explains its cache decisions at length next to the code that
 * makes them - which is right, and which would make a scan over raw text report
 * every one of those explanations.
 */
const codeOf = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Every `Cache-Control` value a source sets, however it spells the assignment.
 *
 * Three forms are matched: the object literal a `c.json(body, status, headers)`
 * takes, the `c.header("Cache-Control", value)` call, and a
 * `headers.set("cache-control", NAME)` whose value is a `const` declared in the
 * same file. That last one is not a convenience - the document rule is a named
 * constant on purpose, so the invariant can be documented once and referred to,
 * and a scan that could not follow it would report the file with no value and
 * pin nothing.
 *
 * A value assembled at runtime is still not captured, and would show up here as
 * a file with no values - which fails the "exactly the declared values"
 * assertion below rather than passing quietly.
 *
 * De-duplicated: what matters is which directives a file can produce, not how
 * many statements produce each one.
 */
const cacheControlValues = (path: string): string[] => {
  const code = codeOf(path);
  const constants = new Map(
    [
      ...code.matchAll(
        /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*["'`]([^"'`]*)["'`]/g,
      ),
    ].map(match => [match[1], match[2]] as const),
  );

  return [
    ...new Set(
      [
        ...code.matchAll(
          /["'`]?[Cc]ache-[Cc]ontrol["'`]?\s*[,:]\s*(?:["'`]([^"'`]*)["'`]|([A-Za-z_$][\w$]*))/g,
        ),
      ]
        .map(match => match[1] ?? constants.get(match[2]))
        .filter((value): value is string => value !== undefined),
    ),
  ];
};

const mentionsCacheControl = (path: string): boolean =>
  /[Cc]ache-[Cc]ontrol/.test(codeOf(path));

const isSharedCacheable = (value: string): boolean => {
  const directives = value
    .toLowerCase()
    .split(",")
    .map(one => one.trim());

  if (directives.includes("no-store")) return false;
  if (directives.includes("private")) return false;
  if (directives.includes("public")) return true;

  return directives.some(one => {
    const seconds = /^s-maxage=(\d+)$/.exec(one) ?? /^max-age=(\d+)$/.exec(one);

    return seconds !== null && Number(seconds[1]) > 0;
  });
};

const DECLARED = {
  "content/server/public-routes.ts": ["private, no-store"],
  "tanstack/start/document-headers.ts": ["private, no-store"],
} satisfies Record<string, string[]>;

describe("the cacheability predicate says what it means", () => {
  it.each([
    "no-store",
    "private, no-store",
    "private",
    "private, max-age=60",
    "no-cache, no-store, must-revalidate",
  ])("treats %s as private", value => {
    expect(isSharedCacheable(value)).toBe(false);
  });

  it.each([
    "public",
    "public, max-age=3600",
    "s-maxage=60",
    "max-age=300",
    "max-age=300, stale-while-revalidate=60",
  ])("treats %s as shared-cacheable", value => {
    // The control for the assertions below: a predicate that answered `false` to
    // everything would satisfy all of them.
    expect(isSharedCacheable(value)).toBe(true);
  });

  it("does not mistake max-age=0 for a shared cache directive", () => {
    expect(isSharedCacheable("max-age=0")).toBe(false);
  });
});

describe("this test is looking at the right tree", () => {
  it("has sources to scan", () => {
    expect(runtimeSources().length).toBeGreaterThan(100);
  });

  it("finds the header that provably exists", () => {
    // The control. Every "found nothing" assertion below would also be satisfied
    // by a scan that matched nothing at all.
    expect(
      cacheControlValues(join(sourceRoot, "content/server/public-routes.ts")),
    ).toEqual(["private, no-store"]);
  });
});

describe("no response is offered to a shared cache", () => {
  const setters = (): string[] =>
    runtimeSources().filter(mentionsCacheControl).map(asEntry).sort();

  it("sets the header in exactly the declared places", () => {
    // A new `Cache-Control` anywhere in the package has to be classified here
    // before it can ship. That is the whole enforcement: the values are then
    // checked, and a middleware is refused outright.
    expect(setters()).toEqual(Object.keys(DECLARED).sort());
  });

  it("sets exactly the declared values", () => {
    const actual = Object.fromEntries(
      setters().map(entry => [
        entry,
        cacheControlValues(join(sourceRoot, entry)),
      ]),
    );

    expect(actual).toStrictEqual(DECLARED);
  });

  it.each(Object.values(DECLARED).flat())(
    "%s keeps the response out of a shared cache",
    value => {
      expect(isSharedCacheable(value)).toBe(false);
    },
  );
});

describe("no middleware applies a cache policy by path", () => {
  const surfaces = () =>
    runtimeSources().filter(path => {
      const entry = asEntry(path);

      return (
        entry.startsWith("api/middlewares/") ||
        entry === "api/lib/route.ts" ||
        entry === "api/config.ts"
      );
    });

  it("has the middleware layer to check", () => {
    expect(surfaces().length).toBeGreaterThan(3);
  });

  it("sets no cache header anywhere in it", () => {
    expect(surfaces().filter(mentionsCacheControl).map(asEntry)).toEqual([]);
  });

  it("mounts no cache middleware from hono", () => {
    // `hono/cache` is a Web Cache API middleware. It stores by request URL and
    // knows nothing about a cookie, so mounting it over `/api` would serve one
    // visitor's authenticated response to the next.
    const offenders = runtimeSources()
      .filter(path => /["']hono\/cache["']/.test(codeOf(path)))
      .map(asEntry);

    expect(offenders).toEqual([]);
  });
});

describe("Vary is set only where a header actually chose the response", () => {
  const varyValues = (path: string): string[] =>
    [
      ...codeOf(path).matchAll(
        /["'`]?Vary["'`]?\s*[,:]\s*["'`]([^"'`]*)["'`]/g,
      ),
    ].map(match => match[1]);

  const setters = (): string[] =>
    runtimeSources()
      .filter(path => varyValues(path).length > 0)
      .map(asEntry)
      .sort();

  it("is set in exactly one place", () => {
    expect(setters()).toEqual(["content/server/public-routes.ts"]);
  });

  it("varies on Accept-Language and nothing else", () => {
    expect(
      varyValues(join(sourceRoot, "content/server/public-routes.ts")),
    ).toEqual(["Accept-Language"]);
  });

  it("adds it only when the locale was negotiated", () => {
    // An explicit `?locale=` is part of the URL, so the response is already
    // keyed by it. Varying on a header that decided nothing fragments every
    // shared cache for no correctness at all - and varying on it when it *did*
    // decide is what stops a Polish response being served to an English reader.
    expect(codeOf(join(sourceRoot, "content/server/public-routes.ts"))).toMatch(
      /source === "negotiated"\s*\?\s*\{ Vary: "Accept-Language" \}/,
    );
  });
});

describe("nothing claims conditional-request support it does not have", () => {
  it("sets no ETag", () => {
    // No route computes one, so a `If-None-Match` is answered with a full body.
    // Stated as a test because a hand-written `ETag` on one route would imply a
    // 304 path that does not exist anywhere else.
    const offenders = runtimeSources()
      .filter(path => /["'`]ETag["'`]\s*[,:]/i.test(codeOf(path)))
      .map(asEntry);

    expect(offenders).toEqual([]);
  });
});
