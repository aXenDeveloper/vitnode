// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../../..");

/**
 * The user header, split down the middle.
 *
 * The same boundary `theme-boundaries.test.ts` and `auth-boundaries.test.ts`
 * draw, for the same reason and with the same machinery: `UserHeaderContent` is
 * rendered by a TanStack Start route as well as by Next.js, and one import that
 * only resolves inside a Next.js app turns that route into a failure nobody sees
 * until they try it. This is the header slot most likely to acquire one - it is
 * the part with links, a session and a mutation in it.
 *
 * `next-user-header.tsx` is the control: it provably reaches the locale-aware
 * `Link` and the sign-out server action, which is exactly what the shared half
 * must not.
 */
const SHARED = {
  content: join(here, "user-header-content.tsx"),
  model: join(here, "user-header-model.ts"),
};

const NEXT_WRAPPER = join(here, "next-user-header.tsx");

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
 * `import type` statements are stripped first: the wrapper imports the *type* of
 * the user it renders, which TypeScript erases and which never reaches a bundle.
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

/** `next-intl`'s Next-only halves - `lib/navigation` is built on two of them. */
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
  // silently matches nothing also satisfies. The wrapper is the control.
  it("finds the Next-only imports in the Next wrapper", () => {
    expect(
      offenders(NEXT_WRAPPER, [...NEXT_ONLY, ...NEXT_INTL_RUNTIME]),
    ).not.toEqual([]);
  });

  it("walks past the entry file into its dependencies", () => {
    // The server action is one hop from the wrapper; `next/cache` is two.
    expect([...externalGraph(NEXT_WRAPPER).keys()]).toContain("next/cache");
  });
});

describe("the shared user header is framework-neutral", () => {
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

      expect(reached.some(one => one.includes("navigation"))).toBe(false);
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never reaches the session read either", () => {
    // The whole point of taking a state instead of fetching one: a shared
    // component that imported `getSessionApi` would pull `next/headers` in
    // behind it, and would be a second source of truth in the app that already
    // has a canonical session query.
    const reached = [...externalGraph(SHARED.content).keys()];

    expect(reached.some(one => one.includes("get-session-api"))).toBe(false);
  });
});

describe("the shared user header takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const code = withoutComments(SHARED.content);

  it("takes its links as a component", () => {
    expect(code).toContain("LinkComponent");
  });

  it("asks for a sign-out callback rather than calling a mutation", () => {
    expect(code).toContain("onSignOut");
    expect(code).not.toContain("logOutMutationApi");
  });

  it("renders a state rather than reading a session", () => {
    expect(code).toContain("state: UserHeaderState;");
    expect(code).not.toContain("useQuery");
  });
});
