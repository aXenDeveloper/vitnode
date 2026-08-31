// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { NEXT_INTL, NEXT_ONLY } from "@/tests/import-graph";

const srcRoot = resolve(import.meta.dirname, "../..");

/**
 * Everything the shared provider layer is allowed to reach, transitively.
 *
 * The reason this scan exists has outlived the two-host situation that prompted
 * it. It was written because `apps/docs` (Next.js) and `apps/web` (TanStack
 * Start) both mounted this tree, so a `next/*` import anywhere under it was a
 * build failure in the app without Next.js - surfacing in whichever module
 * happened to import it, a long way from the line that caused it. There is one
 * host now, and the same import would instead be a package that silently
 * requires a framework it no longer declares.
 *
 * `NEXT_INTL` covers the root entry too, which it deliberately did not before:
 * that entry re-exports `use-intl` and resolves fine, which is exactly what let
 * it survive - and what made two components read a `use-intl` context from a
 * module record nothing provided into.
 */

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

const resolveModule = (base: string): null | string => {
  if (existsSync(base) && statSync(base).isFile()) return base;

  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
};

/**
 * The runtime imports of one file.
 *
 * `import type` statements are skipped: they are erased before a bundler sees
 * them, so they cannot pull a package into an app. That is what lets a config
 * type describe a Next.js-only progress bar without every consumer of the config
 * needing Next.js - and it is why this scan measures the bundle rather than the
 * type graph.
 */
const runtimeImports = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8").matchAll(
      /(?:^|\n)\s*import\s+(type\s+)?(?:[^"';]*?from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g,
    ),
  ]
    .filter(match => !match[1])
    .map(match => match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));

/** Every package specifier reachable at runtime from `entries`, transitively. */
const externalsReachableFrom = (entries: string[]): Map<string, string[]> => {
  const visited = new Set<string>();
  const externals = new Map<string, string[]>();

  const walk = (path: string, chain: string[]) => {
    if (visited.has(path)) return;
    visited.add(path);

    for (const specifier of runtimeImports(path)) {
      const target = specifier.startsWith("@/")
        ? resolveModule(join(srcRoot, specifier.slice(2)))
        : specifier.startsWith(".")
          ? resolveModule(resolve(dirname(path), specifier))
          : null;

      if (target) {
        walk(target, [...chain, relative(srcRoot, target)]);
      } else if (!externals.has(specifier)) {
        externals.set(specifier, chain);
      }
    }
  };

  for (const entry of entries) {
    const path = resolveModule(join(srcRoot, entry));
    expect(path, `${entry} exists`).not.toBeNull();
    if (path) walk(path, [entry]);
  }

  return externals;
};

const offendersIn = (entries: string[], forbidden: string[]): string[] => {
  const externals = externalsReachableFrom(entries);

  return [...externals]
    .filter(([specifier]) =>
      forbidden.some(
        entry => specifier === entry || specifier.startsWith(`${entry}/`),
      ),
    )
    .map(([specifier, chain]) => `${specifier} via ${chain.join(" -> ")}`);
};

/**
 * The modules an app on any framework imports from `@vitnode/core`.
 *
 * This list is the contract. Adding to it is fine; adding something that reaches
 * Next.js is what this file exists to stop.
 */
const SHARED_MODULES = [
  "components/languages-provider.tsx",
  "components/theme-provider.tsx",
  "components/theme-script.tsx",
  "components/ui/sonner.tsx",
  "components/ui/tooltip.tsx",
  "lib/i18n/load-messages.ts",
  "lib/i18n/pick-messages.ts",
  "lib/i18n/sources.ts",
  "lib/metadata.ts",
  "lib/query-client.ts",
  "views/layouts/providers.tsx",
  "views/layouts/rate-limit-listener.tsx",
  "vitnode.config.ts",
  "ws/provider.tsx",
];

describe("the import scan finds what it is looking for", () => {
  /**
   * The control used to be `views/layouts/provider.tsx` - the Next.js shell,
   * which provably imported what the shared layer must not. It is deleted, and a
   * scanner that silently matched nothing would now pass every assertion below.
   *
   * The positive controls moved to `src/next-boundary.test.ts`, which scans a
   * committed fixture built for the purpose rather than production code, so they
   * cannot be deleted out from under the suite again. What stays here is the
   * cheap local check that this scanner walks at all.
   */
  it("walks past the entry file", () => {
    expect(
      externalsReachableFrom(["views/layouts/providers.tsx"]).size,
    ).toBeGreaterThan(5);
  });

  it("has no Next.js shell left beside the shared one", () => {
    expect(existsSync(join(srcRoot, "views/layouts/provider.tsx"))).toBe(false);
  });
});

describe("the shared VitNode provider layer", () => {
  it("never imports next/* or server-only", () => {
    expect(offendersIn(SHARED_MODULES, NEXT_ONLY)).toEqual([]);
  });

  it("never imports next-intl's Next-only entries", () => {
    expect(offendersIn(SHARED_MODULES, NEXT_INTL)).toEqual([]);
  });

  it("keeps the theme system framework-free on its own", () => {
    // Called out separately because the theme is the one that used to be
    // coupled: `ThemeProvider` reached for `useServerInsertedHTML`, so every app
    // that wanted a theme needed Next.js' router.
    expect(
      offendersIn(
        ["components/theme-provider.tsx", "components/theme-script.tsx"],
        [...NEXT_ONLY, ...NEXT_INTL],
      ),
    ).toEqual([]);
  });
});
