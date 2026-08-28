// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "../../../..");

/**
 * `/settings/devices`, split down the middle.
 *
 * The same boundary `files-boundaries.test.ts` and `auth-boundaries.test.ts`
 * draw, with the same machinery and for the same reason: a shared module that
 * reaches `next/headers`, a server action or `@/lib/navigation` cannot be loaded
 * by a TanStack Start route, and nothing about that failure is visible until
 * somebody tries. A scan is the only way to state it, because the offending
 * import is usually two files away from the one being written - this feature's
 * would have been the server action, imported by the revoke button, behind the
 * list.
 */
const SHARED = {
  item: join(here, "device-item.tsx"),
  list: join(here, "devices-content.tsx"),
  query: join(here, "devices-query.ts"),
  revoke: join(here, "devices-revoke.ts"),
  revokeButton: join(here, "revoke-device-button.tsx"),
  skeleton: join(here, "devices-list-skeleton.tsx"),
};

/** The Next.js half: `next/navigation`, `next/cache`, `fetcher()`, the action. */
const NEXT_WRAPPERS = {
  list: join(here, "devices-list.tsx"),
  page: join(here, "devices.tsx"),
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
 * `import type` statements are stripped first: the query module imports the users
 * API module's *type* to keep the fetcher's route literals inferring, and that
 * module is a Hono server module. It is erased at compile time and never reaches
 * a bundle, so counting it would fail this suite on something that cannot break.
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
 * framework-free, and `apps/web` already renders core components that import it -
 * `ConfirmActionAlertDialog`, which is what the revoke button's dialog is. These
 * four reach for Next's request scope, its middleware or its build plugin, and
 * `@/lib/navigation` is built on two of them.
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

const wrapperEntries = Object.entries(NEXT_WRAPPERS).map(([name, path]) => ({
  name,
  path,
}));

describe("the import scan finds what it is looking for", () => {
  // Most assertions below are "found nothing" ones, which a scanner that
  // silently matches nothing also satisfies. The Next wrappers are the control:
  // they provably import the things the shared modules must not.
  it.each(wrapperEntries)(
    "finds the Next-only imports in the $name wrapper",
    ({ path }) => {
      expect(offenders(path, NEXT_ONLY)).not.toEqual([]);
    },
  );

  it("walks past the entry file into its dependencies", () => {
    // `next/headers` is two hops from the list wrapper - through `@/lib/fetcher` -
    // not one.
    expect(offenders(NEXT_WRAPPERS.list, ["next/headers"]).join()).toContain(
      "lib/fetcher.ts",
    );
  });
});

describe("the shared devices modules are framework-neutral", () => {
  it.each(sharedEntries)("$name reaches nothing from next/*", ({ path }) => {
    expect(offenders(path, NEXT_ONLY)).toEqual([]);
  });

  it.each(sharedEntries)(
    "$name reaches none of next-intl's Next-only entrypoints",
    ({ path }) => {
      expect(offenders(path, NEXT_INTL_RUNTIME)).toEqual([]);
    },
  );

  it.each(sharedEntries)("$name never reaches a server action", ({ path }) => {
    // A `"use server"` module is the other way Next.js gets in: importing one
    // pulls the fetcher, `next/headers` and the whole API module graph behind it.
    // The revoke is a prop instead.
    const reached = [...externalGraph(path).keys()];

    expect(reached.some(one => one.endsWith(".server"))).toBe(false);
    expect(runtimeImports(path).some(one => one.includes(".server"))).toBe(
      false,
    );
  });

  it("never imports the API's own module for one plugin id", () => {
    // The fetchers need the users module's *type* to keep route literals
    // inferring; a value import would drag Hono, Drizzle and `@/database` into
    // the browser bundle of every page that lists a device.
    const reached = [...externalGraph(SHARED.query).keys()];

    expect(reached).not.toContain("drizzle-orm");
    expect(reached.some(one => one.startsWith("hono"))).toBe(false);
  });
});

describe("the shared list takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("is handed the devices rather than fetching them", () => {
    const code = withoutComments(SHARED.list);

    expect(code).toContain("devices: Device[];");
    expect(code).not.toContain("useQuery");
    expect(code).not.toContain("fetcher");
  });

  it("is handed the revoke rather than importing one", () => {
    const code = withoutComments(SHARED.list);

    expect(code).toContain("onRevoke: RevokeDevice;");
  });

  it("passes the revoke down to the button rather than the button finding it", () => {
    expect(withoutComments(SHARED.revokeButton)).toContain(
      "onRevoke: RevokeDevice;",
    );
  });
});

describe("the Next wrapper keeps the Next-only pieces", () => {
  it("is the only half that fetches and refuses", () => {
    const code = readFileSync(NEXT_WRAPPERS.list, "utf8");

    expect(code).toContain("notFound");
    expect(runtimeImports(NEXT_WRAPPERS.list)).toContain("@/lib/fetcher");
  });

  it("builds its request from the shared contract rather than its own", () => {
    // The point of the split: a list means the same thing in both apps because
    // both call the same function, not because two places look alike.
    expect(readFileSync(NEXT_WRAPPERS.list, "utf8")).toContain(
      "devicesRequest",
    );
  });

  it("is where the server action and its revalidate live", () => {
    const action = readFileSync(join(here, "revoke-action.server.ts"), "utf8");

    expect(action).toContain('"use server"');
    expect(action).toContain("revalidatePath");
    // ...and it applies the shared refresh rule rather than a second copy of it.
    expect(action).toContain("shouldRefreshAfterRevoke");
    expect(action).toContain("revokeDeviceRequest");
  });
});
