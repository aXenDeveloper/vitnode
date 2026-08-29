// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../..");

/**
 * The AdminCP shell, split down the middle.
 *
 * The same boundary `auth-boundaries.test.ts` draws around the auth screens, for
 * the same reason and with the same machinery. Stage 12 gives the AdminCP shell
 * two callers - the Next.js `AdminLayout` and the TanStack Start `_admin` route -
 * and a shared component that reaches `@/lib/navigation`, a `"use server"`
 * module or `next-intl/server` cannot be rendered by the second one. Nothing
 * about that failure is visible until somebody tries: it is a runtime resolution
 * error deep inside a Vite SSR pass, not a type error.
 *
 * Two of these entries are the ones that actually bit. `components/ui/sidebar`
 * and `components/ui/sheet` are shadcn primitives nobody thinks of as
 * Next-coupled, and both imported `useTranslations` from `next-intl` - which
 * resolves a *different* React context than the `use-intl` provider a TanStack
 * route mounts, so the whole AdminCP threw "No intl context found" on the server
 * and silently fell back to client rendering.
 */
const SHARED = {
  breadcrumb: join(here, "breadcrumb/breadcrumb-admin-content.tsx"),
  navActive: join(here, "sidebar/nav/nav-active.ts"),
  navItem: join(here, "sidebar/nav/item-content.tsx"),
  navModel: join(here, "sidebar/nav/nav-model.tsx"),
  navSidebar: join(here, "sidebar/nav/nav-content.tsx"),
  search: join(here, "search/search-content.tsx"),
  searchDialog: join(here, "search/search-dialog-content.tsx"),
  searchFlatten: join(here, "search/flatten-nav.ts"),
  searchOnlyPages: join(here, "search/search-only-pages.tsx"),
  sidebar: join(here, "sidebar/sidebar-content.tsx"),
  sidebarPrimitive: join(srcRoot, "components/ui/sidebar.tsx"),
  sheetPrimitive: join(srcRoot, "components/ui/sheet.tsx"),
  userBar: join(here, "user-bar/user-bar-content.tsx"),
};

/** The Next.js half: server actions, `next-intl/navigation`, `next-intl/server`. */
const NEXT_WRAPPERS = {
  breadcrumb: join(here, "breadcrumb/breadcrumb-admin.tsx"),
  navItem: join(here, "sidebar/nav/item.tsx"),
  navSidebar: join(here, "sidebar/nav/nav.tsx"),
  search: join(here, "search/search.tsx"),
  searchIndex: join(here, "search/get-search-nav-items.tsx"),
  sidebar: join(here, "sidebar/sidebar.tsx"),
  userBar: join(here, "user-bar/user-bar.tsx"),
};

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
 * `import type` statements are stripped first: the shared search dialog imports
 * the *type* of the user lookup from a module whose implementation is a Server
 * Action, which is erased at compile time and never reaches a bundle.
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
 * framework-free. What matters here is that the shared shell reaches for
 * `use-intl` *directly* rather than through `next-intl` - see the separate
 * assertion below, which is the one that catches the sidebar primitive.
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
  /**
   * Every assertion below is a "found nothing" one, which a scanner that
   * silently matches nothing also satisfies. The Next wrappers are the control:
   * they provably import the things the shared shell must not.
   */
  it("finds the Next-only imports in the Next wrappers", () => {
    expect(offenders(NEXT_WRAPPERS.navItem, NEXT_INTL_RUNTIME)).not.toEqual([]);
    expect(offenders(NEXT_WRAPPERS.searchIndex, NEXT_ONLY)).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // `lib/navigation` is two hops from the wrapper, not one.
    expect(
      offenders(NEXT_WRAPPERS.userBar, ["next-intl/navigation"]).join(),
    ).toContain("user-bar.tsx");
  });
});

describe("the shared AdminCP shell is framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL_RUNTIME)).toEqual([]);
    },
  );

  /**
   * The failure this file was written for.
   *
   * `next-intl` bundles its own copy of `use-intl`, so its `useTranslations`
   * reads a different React context than the `IntlProvider` a TanStack route
   * mounts. A shared component that imports from `next-intl` typechecks, renders
   * fine under Next, and throws "No intl context found" the first time a
   * TanStack Start route server-renders it.
   */
  it.each(sharedEntries)("$name translates through use-intl", ({ path }) => {
    expect(offenders(path, ["next-intl"])).toEqual([]);
  });

  /**
   * A `"use server"` module reaching a shared component is the other half of the
   * same problem: it drags `@/lib/fetcher`, and with it `server-only` and
   * `next/headers`, into the browser graph.
   */
  it.each(sharedEntries)("$name imports no server action", ({ path }) => {
    const serverModules = [...externalGraph(path).keys()].filter(specifier =>
      specifier.endsWith(".server"),
    );

    expect(serverModules).toEqual([]);
  });
});
