// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../..");

/**
 * The role field, split down the middle.
 *
 * The same boundary `table-boundaries.test.ts` draws around the data table, with
 * the same machinery, for a failure discovered the same way: a shared component
 * that reaches Next's request scope cannot be rendered by a TanStack Start
 * route, and nothing about that is visible until something tries. Here it was
 * `/docs/ui/roles` - a documentation preview - that tried.
 *
 * Two couplings, and neither looked like one:
 *
 * - `useLocale`/`useTranslations` came from `next-intl`, whose root entry
 *   re-exports `use-intl`. It *worked*, which is why it survived.
 * - `search` defaulted to `searchRoles`, a `"use server"` action carrying
 *   `server-only`. A static import put that marker in the graph of every app
 *   rendering the field; deferring it behind `await import()` only moved the
 *   throw from load time to the first keystroke.
 *
 * So the type moved to a module with no imports, and the search became an
 * injected, required prop with a Next.js adapter beside the field.
 */
const SHARED = {
  /** The framework-neutral field. */
  field: join(here, "input-roles.tsx"),
  /** The type and the search signature, with no imports at all. */
  types: join(here, "roles.ts"),
};

/** The Next.js half: the `"use server"` action, and the adapter that injects it. */
const NEXT_WRAPPERS = {
  action: join(here, "search-roles.action.server.ts"),
  adapter: join(here, "input-roles-next.tsx"),
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
 * `import type` is stripped: the action module still re-exports `RoleOption` for
 * an existing importer, and a type import is erased before any bundler sees it.
 * Dynamic `import()` is *not* stripped - it is exactly what the previous attempt
 * at this fix used, and it is still a runtime edge.
 */
const runtimeImports = (path: string): string[] => {
  const source = readFileSync(path, "utf8").replace(
    /(^|[\n;])\s*(?:import|export)\s+type\s[\s\S]*?from\s*["'][^"']+["']/g,
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

/** Every file reachable from an entry, and every specifier that left the package. */
const graph = (entry: string) => {
  const externals = new Map<string, string[]>();
  const parents = new Map<string, string>();
  const files = new Set<string>();

  const chain = (file: string): string => {
    const parts: string[] = [];
    for (let at: string | undefined = file; at; at = parents.get(at)) {
      parts.unshift(relative(srcRoot, at));
    }

    return parts.join(" -> ");
  };

  const walk = (file: string) => {
    if (files.has(file)) return;
    files.add(file);

    for (const specifier of runtimeImports(file)) {
      const target = resolveSpecifier(specifier, file);

      if (target) {
        if (!parents.has(target)) parents.set(target, file);
        walk(target);
        continue;
      }

      externals.set(specifier, [
        ...(externals.get(specifier) ?? []),
        chain(file),
      ]);
    }
  };

  walk(entry);

  return { externals, files: [...files].map(one => relative(srcRoot, one)) };
};

const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

const offenders = (entry: string, forbidden: string[]): string[] =>
  [...graph(entry).externals]
    .filter(([specifier]) => forbidden.some(one => matches(specifier, one)))
    .flatMap(([specifier, chains]) => chains.map(at => `${specifier} in ${at}`))
    .sort();

/** Anything that only resolves inside a Next.js app. */
const NEXT_ONLY = ["next", "server-only"];

const read = (path: string) => readFileSync(path, "utf8");

describe("the import scan finds what it is looking for", () => {
  // Every assertion below is a "found nothing" one, which a scanner that
  // silently matches nothing also satisfies. The Next.js half is the control.
  it("finds the Next-only imports in the Next.js adapter", () => {
    expect(offenders(NEXT_WRAPPERS.adapter, NEXT_ONLY)).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // `server-only` is two hops from the adapter, not one: the adapter imports
    // the action, and the action's `fetcher` is what reaches Next.
    expect(offenders(NEXT_WRAPPERS.adapter, ["server-only"]).join()).toContain(
      "input-roles-next.tsx -> ",
    );
    expect(runtimeImports(NEXT_WRAPPERS.adapter)).not.toContain("server-only");
  });
});

describe("the shared role field is framework-neutral", () => {
  it("reaches nothing from next/*", () => {
    expect(offenders(SHARED.field, NEXT_ONLY)).toEqual([]);
  });

  it("never imports next-intl, root entry included", () => {
    // The one that worked, and was therefore the one that lasted: `next-intl`'s
    // root re-exports `use-intl` and resolves fine outside Next.js. What it
    // costs is the boundary, not a render.
    expect(offenders(SHARED.field, ["next-intl"])).toEqual([]);
  });

  it("takes its translations from use-intl", () => {
    expect([...graph(SHARED.field).externals.keys()]).toContain("use-intl");
  });

  it("never reaches the role search action, statically or dynamically", () => {
    // Both spellings. `await import("./search-roles.action.server")` was the
    // previous attempt at this fix and is still a runtime edge - the scanner
    // above deliberately follows dynamic imports.
    expect(graph(SHARED.field).files).not.toContain(
      "components/form/fields/search-roles.action.server.ts",
    );
  });

  it("declares its role types in a module that imports nothing", () => {
    expect(runtimeImports(SHARED.types)).toEqual([]);
    expect(graph(SHARED.types).files).toEqual([
      "components/form/fields/roles.ts",
    ]);
  });

  it("reads RoleOption from that module rather than from the action", () => {
    const source = read(SHARED.field);

    expect(source).toMatch(
      /import type \{ RoleOption, RoleSearch \} from "\.\/roles"/,
    );
    expect(source).not.toContain("search-roles.action.server");
  });
});

/**
 * The contract itself, read off the source.
 *
 * A type test would be the stronger form and cannot be written here: `search`
 * being required is a property of a `.tsx` component's props, and this suite is
 * a static scan by the migration testing policy. What is asserted instead is the
 * two things that made it optional - a default parameter and a fallback - being
 * absent.
 */
describe("the search dependency is injected", () => {
  it("is required on the props type", () => {
    expect(read(SHARED.field)).toMatch(/\n {2}search: RoleSearch;/);
  });

  it("has no default parameter", () => {
    // The destructured parameter, at its own indent - `search={...}` further
    // down is the prop handed to `AsyncPicker` and is not what this is about.
    const source = read(SHARED.field);

    expect(source).toMatch(/\n {2}search,\n/);
    expect(source).not.toMatch(/\n {2}search\s*=/);
  });

  it("has no fallback and no host detection", () => {
    const source = read(SHARED.field);

    expect(source).not.toContain("searchRolesLazily");
    expect(source).not.toMatch(/typeof window|process\.env|import\.meta\.env/);
  });

  it("is what the Next.js adapter exists to supply", () => {
    const source = read(NEXT_WRAPPERS.adapter);

    expect(source).toContain("AutoFormRolesNext");
    // The action is this adapter's default, and it is the only place in the
    // package that may be. A caller may still override it, which is why the
    // prop is threaded through rather than hard-coded.
    expect(source).toMatch(/search = searchRoles/);
    expect(source).toMatch(
      /<AutoFormRoles \{\.\.\.props\} search=\{search\} \/>/,
    );
  });
});
