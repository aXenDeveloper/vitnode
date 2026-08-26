// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(import.meta.dirname, "../..");

/**
 * Everything the shared provider layer is allowed to reach, transitively.
 *
 * Both `apps/docs` (Next.js) and `apps/web` (TanStack Start) mount this tree, so
 * a `next/*` import anywhere under it is not a type error but a build failure in
 * the app that has no Next.js - and one that appears in whichever module happens
 * to import it, a long way from the line that caused it.
 */
const NEXT_ONLY = ["next", "server-only"];

/**
 * next-intl's Next-only halves. The root entry is deliberately absent: it
 * re-exports `use-intl`, which is framework-free, and `RateLimitListener` reads
 * its `useTranslations` in the browser on both frameworks.
 */
const NEXT_INTL_RUNTIME = [
  "next-intl/middleware",
  "next-intl/navigation",
  "next-intl/plugin",
  "next-intl/server",
];

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
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. This is the control: the Next.js
  // shell provably imports the things the shared layer must not.
  it("finds the Next.js imports in the Next.js shell", () => {
    expect(offendersIn(["views/layouts/provider.tsx"], NEXT_ONLY)).not.toEqual(
      [],
    );
  });

  it("walks past the entry file", () => {
    expect(
      externalsReachableFrom(["views/layouts/providers.tsx"]).size,
    ).toBeGreaterThan(5);
  });
});

describe("the shared VitNode provider layer", () => {
  it("never imports next/* or server-only", () => {
    expect(offendersIn(SHARED_MODULES, NEXT_ONLY)).toEqual([]);
  });

  it("never imports next-intl's Next-only entries", () => {
    expect(offendersIn(SHARED_MODULES, NEXT_INTL_RUNTIME)).toEqual([]);
  });

  it("keeps the theme system framework-free on its own", () => {
    // Called out separately because the theme is the one that used to be
    // coupled: `ThemeProvider` reached for `useServerInsertedHTML`, so every app
    // that wanted a theme needed Next.js' router.
    expect(
      offendersIn(
        ["components/theme-provider.tsx", "components/theme-script.tsx"],
        [...NEXT_ONLY, ...NEXT_INTL_RUNTIME],
      ),
    ).toEqual([]);
  });
});
