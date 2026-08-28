// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../..");

const SHARED_ENTRY = join(here, "search-feed-content.tsx");
const NEXT_WRAPPER = join(here, "search-feed.tsx");

/**
 * The search page's controls, and the Next wrapper they were split out of.
 *
 * The same boundary as the feed's, one level up and with more at stake: the
 * controls render an input group, a native select and a row of buttons, so this
 * is where a stray Next.js import inside the *design system* would show up. That
 * is not hypothetical - `HeaderContent` was Next-only for one back button, and
 * `use-captcha` made every `AutoForm` Next-only for one navigation import.
 */
const SHARED_CONTROLS = join(here, "search-controls-content.tsx");
const NEXT_CONTROLS = join(here, "search-controls.tsx");

/**
 * The other half of what a migrated feed page renders.
 *
 * Scanned here rather than in a file of its own because it is the same boundary
 * for the same reason: `/discover` is a heading and a feed, and either one
 * reaching `next-intl/navigation` makes the whole page Next-only. This one did,
 * until the back link became a prop.
 */
const HEADER_CONTENT = join(here, "../../components/ui/header-content.tsx");

/**
 * The specifier a `from "..."` resolves to, or `null` when it leaves the
 * package.
 *
 * Only `@/` and relative paths are followed. Anything else is a bare package
 * name, which is exactly what the assertions below are looking at.
 */
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

/**
 * Every specifier a file imports **at runtime**.
 *
 * `import type` statements are stripped first: the feed imports the search
 * module's *type* to keep `fetcherClient` typed, and that module is a Hono
 * server module. It is erased at compile time and never reaches a bundle, so
 * counting it would make this suite fail on something that cannot break.
 */
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
 * `next-intl`'s Next-only halves.
 *
 * The root entry is deliberately absent, for the same reason `apps/web`'s
 * `isolation.test.ts` leaves it out: it re-exports `use-intl`, which is
 * framework-free, and `apps/web` already renders core components that import it.
 * These four are the ones that reach for Next's request scope, its middleware or
 * its build plugin - and `lib/navigation` is built on two of them.
 */
const NEXT_INTL_RUNTIME = [
  "next-intl/middleware",
  "next-intl/navigation",
  "next-intl/plugin",
  "next-intl/server",
];

describe("the import scan finds what it is looking for", () => {
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. The Next wrapper is the control:
  // it provably imports the things the shared feed must not.
  it("finds the Next-only imports in the Next wrapper", () => {
    expect(offenders(NEXT_WRAPPER, NEXT_INTL_RUNTIME)).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // `lib/navigation` is two hops from the wrapper, not one.
    expect(offenders(NEXT_WRAPPER, ["next-intl/navigation"]).join()).toContain(
      "lib/navigation",
    );
  });
});

describe("the shared search feed is framework-neutral", () => {
  it("reaches nothing from next/* or server-only", () => {
    expect(offenders(SHARED_ENTRY, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(SHARED_ENTRY, NEXT_INTL_RUNTIME)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    const reached = [...externalGraph(SHARED_ENTRY).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("takes its translations from use-intl, not from next-intl", () => {
    const imports = runtimeImports(SHARED_ENTRY);

    expect(imports).toContain("use-intl");
    expect(imports).not.toContain("next-intl");
  });

  it("takes its query as a prop rather than building one", () => {
    // Comments stripped first - the file explains at length *why* it no longer
    // resolves a locale or builds a request, and prose is not a call site.
    const code = readFileSync(SHARED_ENTRY, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(code).not.toContain("useLocale");
    expect(code).toContain("queryOptions: SearchFeedQueryOptions;");
    // One `useInfiniteQuery`, and it is handed its definition. A second
    // implementation here is the bug this boundary exists to prevent.
    expect(code.match(/useInfiniteQuery\(/g)).toHaveLength(1);
    expect(code).toContain("useInfiniteQuery(queryOptions)");
  });
});

describe("the shared header is framework-neutral", () => {
  it("reaches nothing from next/* or server-only", () => {
    expect(offenders(HEADER_CONTENT, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(HEADER_CONTENT, NEXT_INTL_RUNTIME)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    // It used to import it directly, for one back button on one admin screen.
    const reached = [...externalGraph(HEADER_CONTENT).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("takes the back link as a prop instead of importing one", () => {
    const code = readFileSync(HEADER_CONTENT, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(code).toContain("BackLink");
    expect(code).not.toContain("@/lib/navigation");
  });
});

describe("the shared search controls are framework-neutral", () => {
  it("reaches nothing from next/* or server-only", () => {
    expect(offenders(SHARED_CONTROLS, NEXT_ONLY)).toEqual([]);
  });

  it("reaches none of next-intl's Next-only entrypoints", () => {
    expect(offenders(SHARED_CONTROLS, NEXT_INTL_RUNTIME)).toEqual([]);
  });

  it("never reaches the locale-aware navigation module", () => {
    const reached = [...externalGraph(SHARED_CONTROLS).keys()];

    expect(reached.some(one => one.includes("navigation"))).toBe(false);
  });

  it("takes its translations from use-intl, not from next-intl", () => {
    const imports = runtimeImports(SHARED_CONTROLS);

    expect(imports).toContain("use-intl");
    expect(imports).not.toContain("next-intl");
  });

  it("walks into the design system it renders", () => {
    // Otherwise the assertions above would pass on a graph that stopped at the
    // controls themselves - which is exactly the graph that cannot break.
    const reached = [...externalGraph(SHARED_CONTROLS).keys()];
    const visited = runtimeImports(SHARED_CONTROLS);

    expect(visited).toContain("@/components/ui/input-group");
    expect(reached).toContain("lucide-react");
  });

  it("takes its query and its link as props rather than building either", () => {
    const code = readFileSync(SHARED_CONTROLS, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    // Neither a locale nor a transport: the whole request is `feedQuery`'s, and
    // `feedQuery` comes from whichever app is rendering this.
    expect(code).not.toContain("useLocale");
    expect(code).not.toContain("searchFeedQueryOptions");
    expect(code).toContain("feedQuery: SearchFeedQueryFactory;");
    expect(code).toContain("LinkComponent: SearchFeedLinkComponent;");
    // One feed, and it is the shared one. A second renderer here is the drift
    // this boundary exists to prevent.
    expect(code.match(/<SearchFeedContent/g)).toHaveLength(1);
  });
});

describe("the Next wrapper keeps the Next-only pieces", () => {
  it("is the only one of the two that knows about next-intl navigation", () => {
    expect(offenders(NEXT_WRAPPER, ["next-intl/navigation"])).not.toEqual([]);
    expect(offenders(SHARED_ENTRY, ["next-intl/navigation"])).toEqual([]);
  });

  it("resolves the locale itself", () => {
    expect(readFileSync(NEXT_WRAPPER, "utf8")).toContain("useLocale()");
  });

  it("is where the search controls' Next-only half lives too", () => {
    // The control for the suite above: `search-controls.tsx` provably imports
    // what `search-controls-content.tsx` must not.
    expect(offenders(NEXT_CONTROLS, NEXT_INTL_RUNTIME)).not.toEqual([]);
    expect(readFileSync(NEXT_CONTROLS, "utf8")).toContain("useLocale()");
  });

  it("hands the shared controls the same link the feed gets", () => {
    // Two copies would be two component types, and the search page would
    // remount its whole result list on every keystroke.
    expect(runtimeImports(NEXT_CONTROLS)).toContain("./search-feed");
    expect(readFileSync(NEXT_WRAPPER, "utf8")).toContain(
      "export const NextSearchFeedLink",
    );
  });
});
