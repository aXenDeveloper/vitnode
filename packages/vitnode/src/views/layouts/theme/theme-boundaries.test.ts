// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../..");

/**
 * The main shell, split down the middle.
 *
 * The same boundary `auth-boundaries.test.ts` draws around the login screens,
 * for the same reason and with the same machinery: `ThemeLayoutContent` is
 * rendered by a TanStack Start route as well as by Next.js, and a single import
 * that only resolves inside a Next.js app turns that route into a build error
 * nobody sees until they try it.
 *
 * The shared half is the *structure* - the slot order and the `<main>` landmark.
 * Everything that fills a slot is the framework's, and `layout.tsx` is the proof
 * that the Next.js half really does reach the things the shared half must not.
 */
const SHARED_ENTRY = join(here, "layout-content.tsx");
const NEXT_WRAPPER = join(here, "layout.tsx");

const resolveSpecifier = (specifier: string, from: string): null | string => {
  let base: string;

  if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;

  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return existsSync(base) && statSync(base).isFile() ? base : null;
};

/** Every specifier a file imports at runtime; `import type` is erased first. */
const runtimeImports = (path: string): string[] => {
  const source = readFileSync(path, "utf8").replace(
    /(^|[\n;])\s*import\s+type\s[\s\S]*?from\s*["'][^"']+["']/g,
    "$1",
  );

  return [
    ...source.matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
    ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));
};

/** Every external specifier reachable from an entry, with the chain that got there. */
const externalGraph = (entry: string): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  const parents = new Map<string, string>();
  const seen = new Set<string>();

  const chain = (file: string): string => {
    const parts: string[] = [];
    for (let at: string | undefined = file; at; at = parents.get(at)) {
      parts.unshift(relative(srcRoot, at));
    }

    return parts.join(" -> ");
  };

  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);

    for (const specifier of runtimeImports(file)) {
      const target = resolveSpecifier(specifier, file);

      if (target) {
        if (!parents.has(target)) parents.set(target, file);
        walk(target);
        continue;
      }

      found.set(specifier, [...(found.get(specifier) ?? []), chain(file)]);
    }
  };

  walk(entry);

  return found;
};

const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

const offenders = (entry: string, forbidden: string[]): string[] =>
  [...externalGraph(entry)]
    .filter(([specifier]) => forbidden.some(one => matches(specifier, one)))
    .flatMap(([specifier, chains]) => chains.map(at => `${specifier} in ${at}`))
    .sort();

/** Anything that only resolves inside a Next.js app. */
const NEXT_ONLY = ["next", "server-only"];

/**
 * `next-intl`'s Next-only halves. The root entry is absent on purpose: it
 * re-exports `use-intl`, which is framework-free.
 */
const NEXT_INTL_RUNTIME = [
  "next-intl/middleware",
  "next-intl/navigation",
  "next-intl/plugin",
  "next-intl/server",
];

describe("the import scan finds what it is looking for", () => {
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. The Next wrapper is the control.
  it("finds the Next-only imports in the Next wrapper", () => {
    expect(
      offenders(NEXT_WRAPPER, [...NEXT_ONLY, ...NEXT_INTL_RUNTIME]),
    ).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // The session read is two hops from the wrapper, not one: `layout.tsx` ->
    // `lib/api/get-session-api` -> `lib/fetcher`.
    expect([...externalGraph(NEXT_WRAPPER).keys()]).toContain("next/headers");
  });
});

describe("the shared main shell is framework-neutral", () => {
  it("reaches nothing from next/*", () => {
    expect(offenders(SHARED_ENTRY, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(SHARED_ENTRY, NEXT_INTL_RUNTIME)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("never reaches a server action", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(
      runtimeImports(SHARED_ENTRY).some(one => one.includes(".server")),
    ).toBe(false);
  });
});

describe("the shared main shell takes its framework parts as slots", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const code = withoutComments(SHARED_ENTRY);

  it.each(["breadcrumb", "header", "listeners"])(
    "asks for %s rather than rendering it",
    slot => {
      expect(code).toContain(slot);
    },
  );

  it("renders the header and the notification listeners itself in neither case", () => {
    expect(code).not.toContain("HeaderLayout");
    expect(code).not.toContain("NotificationListener");
    expect(code).not.toContain("WebSocketAuthSync");
  });

  /**
   * One `<main>`, in the shell. A page under it renders its own container, not a
   * second landmark - see the note on `ThemeLayoutContent`.
   */
  it("owns the one main landmark", () => {
    expect(code.match(/<main>/g)).toHaveLength(1);
  });
});
