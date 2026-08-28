// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../..");

/**
 * The data table, split down the middle.
 *
 * The same boundary `feed-boundaries.test.ts` and `auth-boundaries.test.ts`
 * draw, with the same machinery and for the same reason: a shared component
 * that reaches `@/lib/navigation` - or anything else built on Next's request
 * scope - cannot be rendered by a TanStack Start route, and nothing about that
 * failure is visible until somebody tries.
 *
 * The table is the widest instance of it in the codebase. Four separate
 * controls used to import Next's router directly, so every AdminCP screen and
 * `/files` inherited the coupling from a header cell.
 */
const SHARED = {
  content: join(here, "content.tsx"),
  filters: join(here, "filters.tsx"),
  orderHead: join(here, "order-table-head.tsx"),
  pagination: join(here, "pagination.tsx"),
  search: join(here, "search.tsx"),
  seam: join(here, "navigation.tsx"),
  skeletonAndTypes: join(here, "data-table-content.tsx"),
  urlState: join(here, "url-state.ts"),
};

/** The Next.js half: locale-aware navigation, and the error screen built on it. */
const NEXT_WRAPPERS = {
  navigation: join(here, "navigation-next.tsx"),
  table: join(here, "data-table.tsx"),
};

/**
 * The specifier a `from "..."` resolves to, or `null` when it leaves the
 * package.
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
 * `import type` statements are stripped first: the shared table imports its own
 * props type from the module the Next.js wrapper lives beside, and that import
 * is erased at compile time rather than reaching a bundle.
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
 * The root entry is deliberately absent: it re-exports `use-intl`, which is
 * framework-free. These four reach for Next's request scope, its middleware or
 * its build plugin - and `lib/navigation` is built on two of them.
 */
const NEXT_INTL_RUNTIME = [
  "next-intl/middleware",
  "next-intl/navigation",
  "next-intl/plugin",
  "next-intl/server",
];

const sharedEntries = Object.entries(SHARED).map(([name, path]) => ({
  name,
  path,
}));

describe("the import scan finds what it is looking for", () => {
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. The Next wrappers are the control:
  // they provably import the things the shared table must not.
  it("finds the Next-only imports in the Next wrappers", () => {
    expect(offenders(NEXT_WRAPPERS.navigation, NEXT_ONLY)).not.toEqual([]);
    expect(offenders(NEXT_WRAPPERS.navigation, NEXT_INTL_RUNTIME)).not.toEqual(
      [],
    );
  });

  it("walks past the entry file into its dependencies", () => {
    // `lib/navigation` is two hops from the table, not one: nothing in
    // `data-table.tsx` imports `next-intl` itself.
    expect(
      offenders(NEXT_WRAPPERS.table, ["next-intl/navigation"]).join(),
    ).toContain("data-table.tsx -> ");
    expect(runtimeImports(NEXT_WRAPPERS.table)).not.toContain(
      "next-intl/navigation",
    );
  });
});

describe("the shared data table is framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL_RUNTIME)).toEqual([]);
    },
  );

  it.each(sharedEntries)(
    "$name never reaches the locale-aware navigation module",
    ({ path }) => {
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.includes("lib/navigation"))).toBe(false);
    },
  );

  it("keeps the URL arithmetic free of every import", () => {
    // The point of `url-state.ts`: no router, no React, nothing to mock. If an
    // import ever appears here, the seam has started growing a second job.
    expect(runtimeImports(SHARED.urlState)).toEqual([]);
  });
});

describe("the shared controls take their navigation from the seam", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const controls = [
    SHARED.filters,
    SHARED.orderHead,
    SHARED.pagination,
    SHARED.search,
  ];

  it("asks the seam where it is rather than a router", () => {
    for (const path of controls) {
      const code = withoutComments(path);

      expect(code).toContain("useDataTableUrl");
      expect(code).not.toContain("useSearchParams");
      expect(code).not.toContain("useRouter");
      expect(code).not.toContain("usePathname");
    }
  });

  it("builds no URLs of its own", () => {
    // Every `new URLSearchParams(...)` in a control was a copy of the current
    // search about to be edited by hand. That is `url-state.ts`'s job now, and
    // a control that starts doing it again is a rule nobody can test.
    for (const path of controls) {
      expect(withoutComments(path)).not.toContain("new URLSearchParams");
    }
  });

  it("never names a pathname, because it is not given one", () => {
    for (const path of controls) {
      expect(withoutComments(path)).not.toContain("pathname");
    }
  });
});

describe("the Next wrapper keeps the Next-only pieces", () => {
  it("is the only half that knows about next-intl navigation", () => {
    expect(
      offenders(NEXT_WRAPPERS.table, ["next-intl/navigation"]),
    ).not.toEqual([]);
    expect(offenders(SHARED.content, ["next-intl/navigation"])).toEqual([]);
  });

  it("is where the scroll-free push and the locale-aware pathname live", () => {
    const code = readFileSync(NEXT_WRAPPERS.navigation, "utf8");

    expect(code).toContain("scroll: false");
    expect(code).toContain('from "@/lib/navigation"');
  });
});
