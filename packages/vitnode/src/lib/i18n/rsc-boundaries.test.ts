// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../..");
const repoRoot = resolve(srcRoot, "../../..");

/**
 * Where a shared component may read `use-intl`, and where it may not.
 *
 * `useTranslations` from `use-intl` is a React context read, and a React Server
 * Component has no context. `next-intl`'s root entry hides that difference - it
 * resolves to an RSC-capable implementation under Next's `react-server`
 * condition and to the context-reading one everywhere else - so a component
 * that reads through it translates in both environments without anybody having
 * to know which one it is in.
 *
 * That is convenient and it is exactly the thing this migration is removing:
 * every component `apps/web` renders now imports `use-intl` directly, because
 * TanStack Start has no `react-server` condition and the `next-intl` root entry
 * was the last Next.js dependency in the shared tree.
 *
 * The trade is that the environment now matters, and `ContentDataTable` is the
 * component that proves it: `DataTable` mounts no client boundary of its own,
 * so React renders the AdminCP's table *on the server* while `apps/web` renders
 * the same component in the browser. Swapping its `next-intl` import for
 * `use-intl` compiled, type-checked, passed every test in this repository and
 * broke every AdminCP table - which is why the check is here rather than in a
 * reviewer's head. Its two strings now live in `NoResultsDataTable`, behind
 * `"use client"`.
 *
 * The rule, then: **a module React renders on the server may not read
 * `use-intl`.** It may take its copy as a prop, or delegate to a client leaf
 * that reads it.
 */

const SKIP_DIRECTORIES = new Set([
  ".next",
  ".output",
  ".source",
  ".turbo",
  "dist",
  "node_modules",
]);

/** Next's own file conventions - every module React can render from. */
const ENTRY_FILE =
  /\/(page|layout|template|route|not-found|error|global-error|default|loading|opengraph-image|sitemap|robots)\.tsx?$/;

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRECTORIES.has(name)) entries.push(...filesUnder(path));
      continue;
    }

    if (
      /\.tsx?$/.test(name) &&
      !name.endsWith(".d.ts") &&
      !/\.test\.tsx?$/.test(name)
    ) {
      entries.push(path);
    }
  }

  return entries;
};

const isClientModule = (path: string): boolean =>
  /^\s*["']use client["']/.test(readFileSync(path, "utf8"));

/**
 * Every specifier a file imports at runtime.
 *
 * `import type` is stripped first: the compiler erases it, so it is not part of
 * the graph React renders.
 */
const importsFrom = (path: string): string[] => {
  const source = readFileSync(path, "utf8");

  return [
    ...source.matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g,
    ),
  ]
    .filter(match => {
      const before = source.slice(
        Math.max(0, (match.index ?? 0) - 220),
        match.index,
      );
      const statement = before.lastIndexOf("import");

      return (
        statement === -1 || !/^import\s+type\b/.test(before.slice(statement))
      );
    })
    .map(match => match[1] ?? match[2])
    .filter((specifier): specifier is string => Boolean(specifier));
};

const resolveSpecifier = (specifier: string, from: string): null | string => {
  let base: string;

  if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith("@vitnode/core/")) {
    base = join(srcRoot, specifier.slice("@vitnode/core/".length));
  } else if (specifier.startsWith("."))
    base = resolve(dirname(from), specifier);
  else return null;

  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
};

/**
 * Every module React renders on the server, and the entry that reaches it.
 *
 * Walks out from each Next entry point and **stops at every `"use client"`
 * boundary** - which is precisely React's own rule for what runs where.
 */
const serverRenderedModules = (): Map<string, string> => {
  const entries = [
    ...filesUnder(join(srcRoot, "routes")),
    ...filesUnder(join(repoRoot, "apps/docs/src")),
    ...filesUnder(join(repoRoot, "plugins/blog/src/routes")),
    ...filesUnder(join(repoRoot, "plugins/example/src/routes")),
  ].filter(path => ENTRY_FILE.test(path) && !isClientModule(path));

  const reached = new Map<string, string>();
  const stack: { entry: string; module: string }[] = entries.map(entry => ({
    entry,
    module: entry,
  }));

  for (let next = stack.pop(); next; next = stack.pop()) {
    const { entry, module } = next;
    if (reached.has(module)) continue;
    reached.set(module, entry);

    for (const specifier of importsFrom(module)) {
      const target = resolveSpecifier(specifier, module);
      if (target && !isClientModule(target))
        stack.push({ entry, module: target });
    }
  }

  return reached;
};

describe("the server-rendered half of the package never reads a React context", () => {
  const modules = serverRenderedModules();

  it("finds the Next.js entry points it is walking from", () => {
    // Every assertion below is a "found nothing" one, which a walk that reached
    // nothing also satisfies.
    expect(modules.size).toBeGreaterThan(100);
    expect(
      [...modules.keys()].some(path =>
        path.endsWith("components/table/content.tsx"),
      ),
      "the AdminCP tables reach ContentDataTable on the server",
    ).toBe(true);
  });

  it("stops at every client boundary", () => {
    // The control: `AutoForm` is `"use client"`, so nothing below it is server
    // rendered even though a Server Component page renders one.
    expect(
      [...modules.keys()].filter(path =>
        path.endsWith("components/form/auto-form.tsx"),
      ),
    ).toEqual([]);
  });

  it("reads use-intl from nowhere React renders on the server", () => {
    const offenders = [...modules.entries()]
      .filter(([path]) =>
        /(?:^|[^\w$.])from\s*["']use-intl["']/.test(readFileSync(path, "utf8")),
      )
      .map(
        ([path, entry]) =>
          `${relative(repoRoot, path)} (rendered by ${relative(repoRoot, entry)})`,
      );

    expect(offenders).toEqual([]);
  });
});
