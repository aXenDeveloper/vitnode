// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../..");

/**
 * `/files`, split down the middle.
 *
 * The same boundary `auth-boundaries.test.ts` and `feed-boundaries.test.ts`
 * draw, with the same machinery and for the same reason: a shared module that
 * reaches `next/headers`, a server action or `@/lib/navigation` cannot be loaded
 * by a TanStack Start route, and nothing about that failure is visible until
 * somebody tries. A scan is the only way to state it, because the offending
 * import is usually three files away from the one being written - this feature's
 * was `next/dynamic`, inside the confirm dialog, behind the delete button.
 */
const SHARED = {
  bulkActions: join(here, "actions/files-bulk-actions.tsx"),
  deletes: join(here, "my-files-delete.ts"),
  query: join(here, "my-files-query.ts"),
  rowActions: join(here, "actions/file-row-actions.tsx"),
  table: join(here, "my-files-table-content.tsx"),
};

/** The Next.js half: `next/headers`, `notFound`, and the server actions. */
const NEXT_WRAPPER = join(here, "my-files-table-view.tsx");

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
 * `import type` statements are stripped first: the query module imports the
 * files API module's *type* to keep the fetcher's route literals inferring, and
 * that module is a Hono server module. It is erased at compile time and never
 * reaches a bundle, so counting it would fail this suite on something that
 * cannot break.
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
 * framework-free, and `apps/web` already renders core components that import it.
 * These four reach for Next's request scope, its middleware or its build plugin
 * - and `@/lib/navigation` is built on two of them.
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
  // Most assertions below are "found nothing" ones, which a scanner that
  // silently matches nothing also satisfies. The Next wrapper is the control: it
  // provably imports the things the shared modules must not.
  it("finds the Next-only imports in the Next wrapper", () => {
    expect(offenders(NEXT_WRAPPER, NEXT_ONLY)).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // `next/headers` is two hops from the wrapper - through `@/lib/fetcher` -
    // not one.
    expect(offenders(NEXT_WRAPPER, ["next/headers"]).join()).toContain(
      "lib/fetcher.ts",
    );
  });
});

describe("the shared files modules are framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    // The table is in here too, which is only true because it renders
    // `ContentDataTable`: `DataTable` mounts the Next.js navigation provider,
    // and every one of the table's controls reads the URL through the seam in
    // `components/table/navigation` instead of `next/navigation`.
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL_RUNTIME)).toEqual([]);
    },
  );

  it.each(sharedEntries)(
    "$name never reaches the locale-aware navigation module directly",
    ({ path }) => {
      const reached = [...externalGraph(path).keys()];

      expect(reached.some(one => one.includes("next-intl/navigation"))).toBe(
        false,
      );
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    // A `"use server"` module is the other way Next.js gets in: importing one
    // pulls the fetcher, `next/headers` and the whole API module graph behind
    // it. Both deletes are a prop instead.
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never imports the API's storage model for one string", () => {
    // `readFileInUse` needs the `FILE_IN_USE` code, which used to live in
    // `@/api/models/storage` - a value import that dragged Hono, Drizzle and
    // `@/database` into the browser bundle of every surface that deletes a file.
    const reached = [...externalGraph(SHARED.deletes).keys()];

    expect(reached).not.toContain("drizzle-orm");
    expect(reached.some(one => one.startsWith("hono"))).toBe(false);
  });
});

describe("the shared table takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("is handed a page rather than fetching one", () => {
    const code = withoutComments(SHARED.table);

    expect(code).toContain("data: MyFilesPage;");
    expect(code).not.toContain("useQuery");
    expect(code).not.toContain("fetcher");
  });

  it("is handed both deletes rather than calling a mutation", () => {
    const code = withoutComments(SHARED.table);

    expect(code).toContain("onDeleteFile: DeleteMyFile;");
    expect(code).toContain("onDeleteFiles: DeleteMyFiles;");
  });

  it("renders the framework-neutral table, not the Next.js one", () => {
    // `DataTable` *is* the Next.js wiring - it mounts `NextDataTableNavigation`.
    // The shared table renders `ContentDataTable` and leaves the provider to
    // whoever is rendering it.
    const code = withoutComments(SHARED.table);

    expect(code).toContain("ContentDataTable");
    expect(code).not.toContain("components/table/data-table");
  });
});

describe("the Next wrapper keeps the Next-only pieces", () => {
  it("is the only half that fetches, refuses and revalidates", () => {
    const code = readFileSync(NEXT_WRAPPER, "utf8");

    expect(code).toContain("notFound");
    expect(runtimeImports(NEXT_WRAPPER)).toContain("@/lib/fetcher");
    expect(
      runtimeImports(NEXT_WRAPPER).some(one =>
        one.includes("delete-action.server"),
      ),
    ).toBe(true);
  });

  it("builds its request from the shared contract rather than its own", () => {
    // The point of the split: a URL means the same thing in both apps because
    // both call these two functions, not because two places look alike.
    const code = readFileSync(NEXT_WRAPPER, "utf8");

    expect(code).toContain("normalizeMyFilesParams");
    expect(code).toContain("myFilesRequest");
  });
});
